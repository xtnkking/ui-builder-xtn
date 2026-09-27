#!/usr/bin/env python3
"""Build strict M8 consumer quality evidence from six completed workspaces.

The runner consumes organizer-controlled, file-backed scenario reports. It does
not trust summary ``passed`` strings: every command log and every browser,
behavior, axe, responsive, and screenshot artifact is resolved inside its
evaluator workspace, checked against its size and SHA-256, and retained in the
new output bundle.
"""

from __future__ import annotations

import argparse
import dataclasses
import datetime as dt
import hashlib
import json
import os
import re
import shutil
import stat
import struct
import sys
import tempfile
import zipfile
import zlib
from pathlib import Path, PurePosixPath
from typing import Any, Mapping, Sequence
from urllib.parse import urlparse

import release_personal_ui as release
import m8_evidence as evidence_records
import run_m8_consumer as consumer
import validate_hosted_ci_evidence as hosted_validator
import validate_m8_evidence as validator


SCHEMA_VERSION = 1
SCENARIO_REPORT_KIND = "personal-ui-m8-scenario-quality-report"
BEHAVIOR_KIND = "personal-ui-m8-browser-behavior"
RESPONSIVE_KIND = "personal-ui-m8-responsive-measurement"
RAW_INVENTORY_KIND = "personal-ui-m8-quality-raw-artifact-inventory"
SAFARI_WRAPPER_KIND = "personal-ui-real-safari-smoke"
QUALITY_FRAGMENT_NAME = "quality-fragment.json"
QUALITY_DIRECTORY = PurePosixPath("quality")
CHECKS = ("behavior", "a11y", "responsive")
FINAL_CHECKS = ("typecheck", "build", "verifier", *CHECKS)
SAFARI_CHECKS = ("documentReady", "rootRendered", "componentInteraction")
MAX_SCREENSHOT_PIXELS = 40_000_000
MIN_SCREENSHOT_COLORS = 8
MAX_SCREENSHOT_DOMINANT_RATIO = 0.995
SHA256_PATTERN = re.compile(r"[0-9a-f]{64}")
VERSION_PATTERN = re.compile(r"[0-9]+(?:\.[0-9A-Za-z][0-9A-Za-z+_-]*)*")
PLACEHOLDER_PATTERN = re.compile(
    r"(?:^|[^a-z0-9])(?:todo|tbd|placeholder|pending|not[- ]?run|unknown)(?:$|[^a-z0-9])",
    re.IGNORECASE,
)
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


class M8QualityError(RuntimeError):
    """Raised when source quality evidence cannot be accepted safely."""


@dataclasses.dataclass(frozen=True)
class SourceArtifact:
    path: str
    content: bytes

    @property
    def size(self) -> int:
        return len(self.content)

    @property
    def sha256(self) -> str:
        return hashlib.sha256(self.content).hexdigest()


@dataclasses.dataclass
class RetainedSource:
    content: bytes
    roles: set[str]


@dataclasses.dataclass(frozen=True)
class ValidatedScenario:
    scenario_id: str
    run_id: str
    project_root: str
    browser_versions: tuple[dict[str, object], ...]
    measurements: tuple[dict[str, object], ...]
    command_summaries: tuple[dict[str, object], ...]
    raw_sources: Mapping[str, RetainedSource]
    report_sha256: str


def canonical_json(value: object) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode(
        "utf-8"
    )


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def _is_link(path: Path) -> bool:
    if path.is_symlink():
        return True
    is_junction = getattr(path, "is_junction", None)
    return bool(is_junction and is_junction())


def _absolute_without_links(path: Path, *, label: str, must_exist: bool) -> Path:
    expanded = path.expanduser()
    if any(part == ".." for part in expanded.parts):
        raise M8QualityError(f"{label} must not contain parent traversal")
    absolute = Path(os.path.abspath(os.fspath(expanded)))
    current = Path(absolute.anchor)
    for part in absolute.parts[1:]:
        current = current / part
        if _is_link(current):
            raise M8QualityError(f"{label} must not traverse a link or junction")
        if not current.exists():
            break
    if must_exist and not absolute.exists():
        raise M8QualityError(f"{label} does not exist: {absolute}")
    return absolute


def _within(path: Path, parent: Path) -> bool:
    try:
        path.relative_to(parent)
        return True
    except ValueError:
        return False


def _safe_relative(value: object, *, label: str) -> PurePosixPath:
    if not isinstance(value, str) or not value or "\\" in value or "\x00" in value:
        raise M8QualityError(f"{label} must be a POSIX relative path")
    path = PurePosixPath(value)
    if (
        path.is_absolute()
        or path.as_posix() != value
        or any(part in {"", ".", ".."} for part in path.parts)
        or (path.parts and re.fullmatch(r"[A-Za-z]:", path.parts[0]) is not None)
    ):
        raise M8QualityError(f"{label} must be a canonical safe relative path")
    return path


def _safe_workspace_file(workspace: Path, relative: PurePosixPath, *, label: str) -> Path:
    current = workspace
    for part in relative.parts:
        current = current / part
        if _is_link(current):
            raise M8QualityError(f"{label} must not traverse a link or junction")
    try:
        resolved = current.resolve(strict=True)
        resolved.relative_to(workspace)
    except (OSError, ValueError) as error:
        raise M8QualityError(f"{label} must resolve inside the evaluator workspace") from error
    if not resolved.is_file():
        raise M8QualityError(f"{label} must reference a regular file")
    return resolved


def _safe_workspace_directory(
    workspace: Path, relative: PurePosixPath, *, label: str
) -> Path:
    current = workspace
    for part in relative.parts:
        current = current / part
        if _is_link(current):
            raise M8QualityError(f"{label} must not traverse a link or junction")
    try:
        resolved = current.resolve(strict=True)
        resolved.relative_to(workspace)
    except (OSError, ValueError) as error:
        raise M8QualityError(f"{label} must resolve inside the evaluator workspace") from error
    if not resolved.is_dir():
        raise M8QualityError(f"{label} must reference a directory")
    return resolved


def _json_object(content: bytes, *, label: str) -> dict[str, Any]:
    try:
        value = json.loads(content.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise M8QualityError(f"{label} must contain valid UTF-8 JSON") from error
    if not isinstance(value, dict):
        raise M8QualityError(f"{label} must contain a JSON object")
    return value


def _read_workspace_json(
    workspace: Path, relative: PurePosixPath, *, label: str
) -> tuple[dict[str, Any], SourceArtifact]:
    path = _safe_workspace_file(workspace, relative, label=label)
    content = path.read_bytes()
    return _json_object(content, label=label), SourceArtifact(relative.as_posix(), content)


def _artifact(
    workspace: Path,
    value: object,
    *,
    label: str,
    allow_empty: bool = False,
) -> SourceArtifact:
    if not isinstance(value, dict):
        raise M8QualityError(f"{label} must be an artifact descriptor")
    relative = _safe_relative(value.get("path"), label=f"{label}.path")
    size = value.get("size")
    digest = value.get("sha256")
    if not isinstance(size, int) or isinstance(size, bool) or size < 0:
        raise M8QualityError(f"{label}.size must be a non-negative integer")
    if not isinstance(digest, str) or SHA256_PATTERN.fullmatch(digest) is None:
        raise M8QualityError(f"{label}.sha256 must be a lowercase SHA-256")
    path = _safe_workspace_file(workspace, relative, label=label)
    content = path.read_bytes()
    if len(content) != size or sha256_bytes(content) != digest:
        raise M8QualityError(f"{label} does not match its retained bytes")
    if not content and not allow_empty:
        raise M8QualityError(f"{label} must not be empty")
    return SourceArtifact(relative.as_posix(), content)


def _timestamp(value: object, *, label: str) -> dt.datetime:
    if not isinstance(value, str) or not value:
        raise M8QualityError(f"{label} must be an ISO-8601 timestamp")
    try:
        parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise M8QualityError(f"{label} must be an ISO-8601 timestamp") from error
    if parsed.tzinfo is None:
        raise M8QualityError(f"{label} must include a timezone")
    return parsed


def _actual_text(value: object, *, label: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise M8QualityError(f"{label} must be non-empty")
    result = value.strip()
    if PLACEHOLDER_PATTERN.search(result):
        raise M8QualityError(f"{label} must not contain placeholder data")
    return result


def _version(value: object, *, label: str) -> str:
    result = _actual_text(value, label=label)
    if VERSION_PATTERN.fullmatch(result) is None:
        raise M8QualityError(f"{label} must be an actual dotted browser version")
    return result


def _http_url(value: object, *, label: str) -> str:
    result = _actual_text(value, label=label)
    parsed = urlparse(result)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise M8QualityError(f"{label} must be an HTTP(S) URL")
    if parsed.hostname in {"example.com", "example.invalid"}:
        raise M8QualityError(f"{label} must not be a placeholder URL")
    return result


def _candidate_summary(candidate: Mapping[str, object]) -> dict[str, object]:
    archive = candidate.get("archive")
    return {
        "version": candidate.get("version"),
        "planDigest": candidate.get("planDigest"),
        "sourceCommit": candidate.get("sourceCommit"),
        "archiveSha256": archive.get("sha256") if isinstance(archive, dict) else None,
        "candidateContentDigest": candidate.get("candidateContentDigest"),
    }


def load_verified_candidate(candidate_path: Path) -> tuple[Path, dict[str, object], dict[str, object]]:
    """Verify a release candidate and return its full and validator bindings."""

    try:
        candidate = consumer._safe_candidate(candidate_path)
        plan, journal = release.load_candidate(candidate)
        consumer._reject_bound_candidate_links(candidate, plan)
        files = release.collect_staged_files(candidate)
        release.verify_candidate_files(plan, files)
        release.verify_artifact_bundle(candidate, plan, files)
        consumer._validate_candidate_materials(files)
        official, verification = consumer._candidate_gate_blockers(plan, journal)
        if verification:
            raise M8QualityError(
                "candidate verification gate failed: " + ", ".join(verification)
            )
        if official:
            raise M8QualityError("official candidate gate failed: " + ", ".join(official))
        binding = consumer._candidate_bindings(plan)
    except (consumer.M8ConsumerError, release.ReleaseError, OSError, ValueError) as error:
        if isinstance(error, M8QualityError):
            raise
        raise M8QualityError(f"candidate verification failed: {error}") from error
    summary = _candidate_summary(binding)
    if any(value is None for value in summary.values()):
        raise M8QualityError("candidate summary binding is incomplete")
    return candidate, binding, summary


def _candidate_fixture_catalog(candidate: Path) -> dict[str, Any]:
    try:
        files = release.collect_staged_files(candidate)
        content = files.get(consumer.FIXTURE_CATALOG_PATH)
        if content is None:
            raise M8QualityError("candidate is missing the support fixture catalog")
        catalog = _json_object(content, label="candidate support fixture catalog")
        if not isinstance(catalog.get("fixtures"), list):
            raise M8QualityError("candidate support fixture catalog is incomplete")
        return catalog
    except (release.ReleaseError, OSError, ValueError) as error:
        if isinstance(error, M8QualityError):
            raise
        raise M8QualityError(f"candidate support fixture catalog failed: {error}") from error


def _retain(
    retained: dict[str, RetainedSource], artifact: SourceArtifact, *, role: str
) -> None:
    existing = retained.get(artifact.path)
    if existing is None:
        retained[artifact.path] = RetainedSource(artifact.content, {role})
        return
    if existing.content != artifact.content:
        raise M8QualityError(f"artifact bytes changed while reading: {artifact.path}")
    existing.roles.add(role)


def _validate_source_snapshot(
    project_root: Path,
    archive: SourceArtifact,
    inventory_artifact: SourceArtifact,
    *,
    label: str,
) -> None:
    try:
        files = evidence_records._source_files(project_root)
        release.verify_zip_bytes(archive.content, files)
    except (
        evidence_records.M8EvidenceError,
        release.ReleaseError,
        zipfile.BadZipFile,
        KeyError,
        OSError,
        RuntimeError,
    ) as error:
        raise M8QualityError(f"{label} source ZIP is invalid or stale: {error}") from error
    inventory = _json_object(
        inventory_artifact.content,
        label=f"{label} source inventory",
    )
    if (
        inventory.get("schemaVersion") != SCHEMA_VERSION
        or inventory.get("kind") != "personal-ui-m8-source-inventory"
        or inventory.get("contentDigest") != release.digest_file_map(files)
        or inventory.get("files") != release.file_inventory(files)
    ):
        raise M8QualityError(f"{label} source ZIP does not match its official inventory")


def _load_recorded_commands(
    workspace: Path,
    *,
    run_id: str,
    retained: dict[str, RetainedSource],
) -> tuple[list[dict[str, object]], tuple[dict[str, Any], ...]]:
    command_index, index_source = _read_workspace_json(
        workspace,
        PurePosixPath("evidence/command-index.json"),
        label="evaluator command index",
    )
    descriptors = command_index.get("commands")
    if (
        command_index.get("schemaVersion") != SCHEMA_VERSION
        or command_index.get("kind") != "personal-ui-m8-command-index"
        or command_index.get("runId") != run_id
        or not isinstance(descriptors, list)
        or not descriptors
    ):
        raise M8QualityError("evaluator command index is incomplete or unbound")
    _retain(retained, index_source, role="evaluator-command-index")
    records: list[dict[str, Any]] = []
    normalized_descriptors: list[dict[str, object]] = []
    paths: set[str] = set()
    for offset, descriptor in enumerate(descriptors, start=1):
        artifact = _artifact(
            workspace,
            descriptor,
            label=f"evaluator command index[{offset - 1}]",
        )
        if artifact.path in paths:
            raise M8QualityError("evaluator command index contains duplicate records")
        paths.add(artifact.path)
        record = _json_object(
            artifact.content,
            label=f"evaluator command record {offset}",
        )
        argv = record.get("argv")
        if (
            record.get("schemaVersion") != SCHEMA_VERSION
            or record.get("kind") != "personal-ui-m8-command"
            or record.get("runId") != run_id
            or record.get("sequence") != offset
            or not isinstance(argv, list)
            or not argv
            or any(not isinstance(item, str) or not item.strip() for item in argv)
            or not isinstance(record.get("exitCode"), int)
            or isinstance(record.get("exitCode"), bool)
        ):
            raise M8QualityError("evaluator command record is incomplete or unbound")
        cwd = _safe_relative(record.get("cwd"), label="evaluator command cwd")
        _safe_workspace_directory(workspace, cwd, label="evaluator command cwd")
        started = _timestamp(record.get("startedAt"), label="evaluator command startedAt")
        ended = _timestamp(record.get("endedAt"), label="evaluator command endedAt")
        if ended < started:
            raise M8QualityError("evaluator command ends before it starts")
        stdout = _artifact(
            workspace,
            record.get("stdout"),
            label="evaluator command stdout",
            allow_empty=True,
        )
        stderr = _artifact(
            workspace,
            record.get("stderr"),
            label="evaluator command stderr",
            allow_empty=True,
        )
        _retain(retained, artifact, role="evaluator-command-record")
        _retain(retained, stdout, role="evaluator-command-stdout")
        _retain(retained, stderr, role="evaluator-command-stderr")
        assert isinstance(descriptor, dict)
        normalized_descriptors.append(dict(descriptor))
        records.append(record)
    return normalized_descriptors, tuple(records)


def _validate_final_result(
    workspace: Path,
    *,
    manifest: Mapping[str, object],
    candidate_binding: Mapping[str, object],
    project_root: Path,
    scenario_id: str,
    retained: dict[str, RetainedSource],
) -> tuple[dict[str, Any], ...]:
    run = manifest.get("run")
    run_id = run.get("id") if isinstance(run, dict) else None
    start_relative = PurePosixPath("evidence/run-start.json")
    start, start_source = _read_workspace_json(
        workspace, start_relative, label=f"{scenario_id} evaluator run start"
    )
    visible = _artifact(
        workspace,
        start.get("visibleInputs"),
        label=f"{scenario_id} run-start visible inputs",
    )
    request = _artifact(
        workspace,
        start.get("request"),
        label=f"{scenario_id} run-start request",
    )
    manifest_request = _artifact(
        workspace,
        manifest.get("request"),
        label=f"{scenario_id} manifest request",
    )
    if (
        start.get("schemaVersion") != SCHEMA_VERSION
        or start.get("kind") != "personal-ui-m8-run-start"
        or start.get("runId") != run_id
        or start.get("scenarioId") != scenario_id
        or start.get("candidate") != candidate_binding
        or visible.path != consumer.MANIFEST_NAME
        or visible.content
        != _safe_workspace_file(
            workspace,
            PurePosixPath(consumer.MANIFEST_NAME),
            label=f"{scenario_id} visible inputs",
        ).read_bytes()
        or request.path != consumer.REQUEST_NAME
        or request.content != manifest_request.content
    ):
        raise M8QualityError(f"{scenario_id} evaluator run start is incomplete or unbound")
    _timestamp(start.get("startedAt"), label=f"{scenario_id} evaluator startedAt")
    _retain(retained, start_source, role="evaluator-run-start")
    _retain(retained, request, role="evaluator-request")

    relative = PurePosixPath("evidence/final/result.json")
    final, source = _read_workspace_json(
        workspace, relative, label=f"{scenario_id} final evaluator result"
    )
    checks = final.get("checks")
    if (
        final.get("schemaVersion") != SCHEMA_VERSION
        or final.get("kind") != "personal-ui-m8-final-result"
        or final.get("runId") != run_id
        or final.get("result") != "passed"
        or not isinstance(checks, dict)
        or any(checks.get(name) != "passed" for name in FINAL_CHECKS)
    ):
        raise M8QualityError(f"{scenario_id} evaluator final result is missing or not passed")
    _timestamp(final.get("frozenAt"), label=f"{scenario_id} final frozenAt")
    _retain(retained, source, role="evaluator-final-result")
    final_artifacts: dict[str, SourceArtifact] = {}
    verification: dict[str, Any] | None = None
    for name in ("sourceArchive", "sourceInventory", "verification"):
        artifact = _artifact(
            workspace,
            final.get(name),
            label=f"{scenario_id} final {name}",
        )
        final_artifacts[name] = artifact
        _retain(retained, artifact, role=f"evaluator-final-{name}")
        if name == "verification":
            verification = _json_object(
                artifact.content, label=f"{scenario_id} final verification"
            )
    _validate_source_snapshot(
        project_root,
        final_artifacts["sourceArchive"],
        final_artifacts["sourceInventory"],
        label=f"{scenario_id} final",
    )
    command_descriptors, recorded_commands = _load_recorded_commands(
        workspace,
        run_id=str(run_id),
        retained=retained,
    )
    assert verification is not None
    verification_checks = verification.get("checks")
    if (
        verification.get("schemaVersion") != SCHEMA_VERSION
        or verification.get("kind") != "personal-ui-m8-quality-verification"
        or verification.get("runId") != run_id
        or verification.get("candidate") != candidate_binding
        or verification.get("result") != "passed"
        or not isinstance(verification_checks, dict)
        or any(verification_checks.get(name) != "passed" for name in FINAL_CHECKS)
        or verification.get("commands") != command_descriptors
    ):
        raise M8QualityError(
            f"{scenario_id} final verification is incomplete, unbound, or inconsistent"
        )
    return recorded_commands


def _validate_command(
    workspace: Path,
    value: object,
    *,
    scenario_id: str,
    project_root: PurePosixPath,
    index: int,
    retained: dict[str, RetainedSource],
) -> tuple[dict[str, object], tuple[dt.datetime, dt.datetime]]:
    label = f"{scenario_id} commands[{index}]"
    if not isinstance(value, dict):
        raise M8QualityError(f"{label} must be an object")
    purpose = value.get("purpose")
    if purpose not in {"typecheck", "build", "verifier", "browser-quality"}:
        raise M8QualityError(f"{label}.purpose is unsupported")
    argv = value.get("argv")
    if (
        not isinstance(argv, list)
        or not argv
        or any(not isinstance(item, str) or not item.strip() for item in argv)
    ):
        raise M8QualityError(f"{label}.argv must contain non-empty arguments")
    cwd = _safe_relative(value.get("cwd"), label=f"{label}.cwd")
    if cwd != project_root and cwd.parts[: len(project_root.parts)] != project_root.parts:
        raise M8QualityError(f"{label}.cwd must stay under projectRoot")
    _safe_workspace_directory(workspace, cwd, label=f"{label}.cwd")
    exit_code = value.get("exitCode")
    if not isinstance(exit_code, int) or isinstance(exit_code, bool) or exit_code != 0:
        raise M8QualityError(f"{label}.exitCode must be zero")
    started = _timestamp(value.get("startedAt"), label=f"{label}.startedAt")
    ended = _timestamp(value.get("endedAt"), label=f"{label}.endedAt")
    if ended < started:
        raise M8QualityError(f"{label} ends before it starts")
    stdout = _artifact(workspace, value.get("stdout"), label=f"{label}.stdout")
    stderr = _artifact(
        workspace, value.get("stderr"), label=f"{label}.stderr", allow_empty=True
    )
    _retain(retained, stdout, role=f"command-{purpose}-stdout")
    _retain(retained, stderr, role=f"command-{purpose}-stderr")
    return (
        {
            "purpose": purpose,
            "argv": list(argv),
            "cwd": cwd.as_posix(),
            "exitCode": 0,
            "startedAt": value.get("startedAt"),
            "endedAt": value.get("endedAt"),
            "stdoutSha256": stdout.sha256,
            "stderrSha256": stderr.sha256,
        },
        (started, ended),
    )


def _within_command_window(
    timestamp: dt.datetime,
    windows: Sequence[tuple[dt.datetime, dt.datetime]],
    *,
    label: str,
) -> None:
    if not any(started <= timestamp <= ended for started, ended in windows):
        raise M8QualityError(f"{label} was not recorded during a passed browser-quality command")


def _validate_browser_versions(
    workspace: Path,
    value: object,
    *,
    scenario_id: str,
    windows: Sequence[tuple[dt.datetime, dt.datetime]],
    retained: dict[str, RetainedSource],
) -> tuple[dict[str, object], ...]:
    artifact = _artifact(
        workspace,
        value,
        label=f"{scenario_id} browserVersions",
    )
    report = _json_object(artifact.content, label=f"{scenario_id} browserVersions")
    recorded_at = _timestamp(
        report.get("recordedAt"), label=f"{scenario_id} browserVersions.recordedAt"
    )
    _within_command_window(
        recorded_at,
        windows,
        label=f"{scenario_id} browserVersions",
    )
    environment = report.get("environment")
    if (
        report.get("schemaVersion") != SCHEMA_VERSION
        or report.get("evidenceKind") != "playwright-browser-version-inventory"
        or not isinstance(environment, dict)
        or any(
            not isinstance(environment.get(name), str) or not environment[name].strip()
            for name in ("node", "platform", "architecture", "playwright")
        )
    ):
        raise M8QualityError(f"{scenario_id} browser version report is incomplete")
    browsers = report.get("browsers")
    if not isinstance(browsers, list) or len(browsers) != len(validator.REQUIRED_ENGINES):
        raise M8QualityError(f"{scenario_id} browser version report must contain three engines")
    normalized: list[dict[str, object]] = []
    expected_products = {
        "chromium": "Playwright Chromium",
        "firefox": "Playwright Firefox",
        "webkit": "Playwright WebKit",
    }
    for index, (expected, item) in enumerate(zip(validator.REQUIRED_ENGINES, browsers)):
        label = f"{scenario_id} browserVersions.browsers[{index}]"
        if not isinstance(item, dict) or item.get("project") != expected:
            raise M8QualityError(f"{label} must describe {expected}")
        product = _actual_text(item.get("product"), label=f"{label}.product")
        version = _version(item.get("version"), label=f"{label}.version")
        if (
            product != expected_products[expected]
            or item.get("evidenceKind") != "playwright-browser"
            or item.get("realSafari") is not False
            or item.get("safariEvidence") is not False
        ):
            raise M8QualityError(f"{label} must be actual Playwright browser evidence")
        normalized.append(
            {
                "project": expected,
                "product": product,
                "version": version,
                "realSafari": False,
            }
        )
    safari = report.get("safari")
    if not isinstance(safari, dict) or safari.get("acceptedFromThisReport") is not False:
        raise M8QualityError(
            f"{scenario_id} browser report must not claim Playwright WebKit as Safari"
        )
    _retain(retained, artifact, role="browser-version-report")
    return tuple(normalized)


def _validate_behavior_artifact(
    artifact: SourceArtifact,
    *,
    scenario_id: str,
    engine: str,
    width: int,
) -> int:
    record = _json_object(
        artifact.content,
        label=f"{scenario_id} {engine}/{width} behavior artifact",
    )
    assertions = record.get("assertions")
    if (
        record.get("schemaVersion") != SCHEMA_VERSION
        or record.get("kind") != BEHAVIOR_KIND
        or record.get("scenarioId") != scenario_id
        or record.get("engine") != engine
        or record.get("width") != width
        or record.get("result") != "passed"
        or not isinstance(assertions, list)
        or not assertions
    ):
        raise M8QualityError(
            f"{scenario_id} {engine}/{width} behavior artifact is incomplete or unbound"
        )
    names: set[str] = set()
    for index, assertion in enumerate(assertions):
        label = f"{scenario_id} {engine}/{width} assertions[{index}]"
        if not isinstance(assertion, dict) or assertion.get("result") != "passed":
            raise M8QualityError(f"{label} must be a passed behavior assertion")
        name = _actual_text(assertion.get("name"), label=f"{label}.name")
        if name in names:
            raise M8QualityError(f"{label}.name must be unique")
        names.add(name)
    return len(assertions)


def _axe_impact_counts(items: object, *, label: str) -> tuple[int, int]:
    if not isinstance(items, list):
        raise M8QualityError(f"{label} must be an array")
    critical = 0
    serious = 0
    ids: set[str] = set()
    for index, item in enumerate(items):
        if not isinstance(item, dict):
            raise M8QualityError(f"{label}[{index}] must be an object")
        rule_id = _actual_text(item.get("id"), label=f"{label}[{index}].id")
        if rule_id in ids:
            raise M8QualityError(f"{label} contains duplicate rule {rule_id}")
        ids.add(rule_id)
        impact = item.get("impact")
        if impact == "critical":
            critical += 1
        elif impact == "serious":
            serious += 1
    return critical, serious


def _validate_axe_artifact(
    artifact: SourceArtifact,
    *,
    scenario_id: str,
    engine: str,
    width: int,
    url: str,
    command_windows: Sequence[tuple[dt.datetime, dt.datetime]],
) -> tuple[int, int, str]:
    record = _json_object(
        artifact.content,
        label=f"{scenario_id} {engine}/{width} axe artifact",
    )
    test_engine = record.get("testEngine")
    test_runner = record.get("testRunner")
    if (
        not isinstance(test_engine, dict)
        or test_engine.get("name") != "axe-core"
        or not isinstance(test_engine.get("version"), str)
        or not test_engine["version"].strip()
        or not isinstance(test_runner, dict)
        or str(test_runner.get("name", "")).lower() != "axe"
    ):
        raise M8QualityError(
            f"{scenario_id} {engine}/{width} axe artifact lacks actual axe metadata"
        )
    axe_url = _http_url(record.get("url"), label=f"{scenario_id} {engine}/{width} axe.url")
    if axe_url != url:
        raise M8QualityError(f"{scenario_id} {engine}/{width} axe URL mismatch")
    axe_timestamp = _timestamp(
        record.get("timestamp"), label=f"{scenario_id} {engine}/{width} axe.timestamp"
    )
    _within_command_window(
        axe_timestamp,
        command_windows,
        label=f"{scenario_id} {engine}/{width} axe artifact",
    )
    passes = record.get("passes")
    if not isinstance(passes, list) or not passes:
        raise M8QualityError(f"{scenario_id} {engine}/{width} axe scan has no passed rules")
    _axe_impact_counts(passes, label=f"{scenario_id} {engine}/{width} axe.passes")
    critical, serious = _axe_impact_counts(
        record.get("violations"),
        label=f"{scenario_id} {engine}/{width} axe.violations",
    )
    incomplete_critical, incomplete_serious = _axe_impact_counts(
        record.get("incomplete"),
        label=f"{scenario_id} {engine}/{width} axe.incomplete",
    )
    if critical or serious or incomplete_critical or incomplete_serious:
        raise M8QualityError(
            f"{scenario_id} {engine}/{width} axe has critical/serious violations or incomplete checks"
        )
    return critical, serious, str(test_engine["version"])


def _positive_integer(value: object, *, label: str) -> int:
    if not isinstance(value, int) or isinstance(value, bool) or value <= 0:
        raise M8QualityError(f"{label} must be a positive integer")
    return value


def _validate_responsive_artifact(
    artifact: SourceArtifact,
    *,
    scenario_id: str,
    engine: str,
    width: int,
) -> dict[str, object]:
    record = _json_object(
        artifact.content,
        label=f"{scenario_id} {engine}/{width} responsive artifact",
    )
    viewport = record.get("viewport")
    document = record.get("document")
    assertions = record.get("assertions")
    if (
        record.get("schemaVersion") != SCHEMA_VERSION
        or record.get("kind") != RESPONSIVE_KIND
        or record.get("scenarioId") != scenario_id
        or record.get("engine") != engine
        or record.get("width") != width
        or record.get("result") != "passed"
        or not isinstance(viewport, dict)
        or not isinstance(document, dict)
        or not isinstance(assertions, list)
        or not assertions
    ):
        raise M8QualityError(
            f"{scenario_id} {engine}/{width} responsive artifact is incomplete or unbound"
        )
    viewport_width = _positive_integer(
        viewport.get("width"), label=f"{scenario_id} {engine}/{width} viewport.width"
    )
    viewport_height = _positive_integer(
        viewport.get("height"), label=f"{scenario_id} {engine}/{width} viewport.height"
    )
    if viewport_width != width:
        raise M8QualityError(f"{scenario_id} {engine}/{width} viewport width mismatch")
    client_width = _positive_integer(
        document.get("documentElementClientWidth"),
        label=f"{scenario_id} {engine}/{width} documentElementClientWidth",
    )
    scroll_width = _positive_integer(
        document.get("documentElementScrollWidth"),
        label=f"{scenario_id} {engine}/{width} documentElementScrollWidth",
    )
    body_client = _positive_integer(
        document.get("bodyClientWidth"),
        label=f"{scenario_id} {engine}/{width} bodyClientWidth",
    )
    body_scroll = _positive_integer(
        document.get("bodyScrollWidth"),
        label=f"{scenario_id} {engine}/{width} bodyScrollWidth",
    )
    if (
        client_width != width
        or body_client > width
        or scroll_width < client_width
        or body_scroll < body_client
        or scroll_width > client_width
        or body_scroll > width
        or record.get("pageHorizontalOverflow") is not False
    ):
        raise M8QualityError(f"{scenario_id} {engine}/{width} has page horizontal overflow")
    names: set[str] = set()
    for index, assertion in enumerate(assertions):
        label = f"{scenario_id} {engine}/{width} responsive.assertions[{index}]"
        if not isinstance(assertion, dict) or assertion.get("result") != "passed":
            raise M8QualityError(f"{label} must be passed")
        name = _actual_text(assertion.get("name"), label=f"{label}.name")
        if name in names:
            raise M8QualityError(f"{label}.name must be unique")
        names.add(name)
    return {
        "viewportWidth": viewport_width,
        "viewportHeight": viewport_height,
        "documentElementClientWidth": client_width,
        "documentElementScrollWidth": scroll_width,
        "bodyClientWidth": body_client,
        "bodyScrollWidth": body_scroll,
        "assertionCount": len(assertions),
        "pageHorizontalOverflow": False,
    }


def _png_dimensions(content: bytes, *, label: str) -> tuple[int, int]:
    if len(content) < 80 or not content.startswith(PNG_SIGNATURE):
        raise M8QualityError(f"{label} must be a non-empty PNG screenshot")
    offset = len(PNG_SIGNATURE)
    header: bytes | None = None
    image_data = bytearray()
    saw_end = False
    while offset < len(content):
        if offset + 12 > len(content):
            raise M8QualityError(f"{label} has a truncated PNG chunk")
        length = struct.unpack(">I", content[offset : offset + 4])[0]
        chunk_type = content[offset + 4 : offset + 8]
        chunk_end = offset + 12 + length
        if chunk_end > len(content):
            raise M8QualityError(f"{label} has a truncated PNG chunk")
        data = content[offset + 8 : offset + 8 + length]
        expected_crc = struct.unpack(">I", content[offset + 8 + length : chunk_end])[0]
        if zlib.crc32(chunk_type + data) & 0xFFFFFFFF != expected_crc:
            raise M8QualityError(f"{label} has an invalid PNG checksum")
        if chunk_type == b"IHDR":
            if header is not None or offset != len(PNG_SIGNATURE) or length != 13:
                raise M8QualityError(f"{label} has an invalid PNG header")
            header = data
        elif chunk_type == b"IDAT":
            image_data.extend(data)
        elif chunk_type == b"IEND":
            if length != 0 or chunk_end != len(content):
                raise M8QualityError(f"{label} has an invalid PNG ending")
            saw_end = True
            break
        offset = chunk_end
    if header is None or not image_data or not saw_end:
        raise M8QualityError(f"{label} is missing required PNG chunks")
    width, height, bit_depth, color_type, compression, filtering, interlace = struct.unpack(
        ">IIBBBBB", header
    )
    if (
        width <= 0
        or height < 240
        or bit_depth != 8
        or color_type not in {2, 6}
        or compression != 0
        or filtering != 0
        or interlace != 0
    ):
        raise M8QualityError(f"{label} uses unsupported or placeholder PNG geometry")
    if width * height > MAX_SCREENSHOT_PIXELS:
        raise M8QualityError(f"{label} exceeds the screenshot pixel limit")
    channels = 3 if color_type == 2 else 4
    row_bytes = width * channels
    try:
        decoded = zlib.decompress(bytes(image_data))
    except zlib.error as error:
        raise M8QualityError(f"{label} has invalid PNG image data") from error
    if len(decoded) != (row_bytes + 1) * height:
        raise M8QualityError(f"{label} PNG data does not match its dimensions")

    previous = bytearray(row_bytes)
    color_counts = [0] * 65536
    for row_index in range(height):
        start = row_index * (row_bytes + 1)
        filter_type = decoded[start]
        encoded = decoded[start + 1 : start + 1 + row_bytes]
        if filter_type > 4:
            raise M8QualityError(f"{label} has an unsupported PNG filter")
        row = bytearray(row_bytes)
        for index, byte in enumerate(encoded):
            left = row[index - channels] if index >= channels else 0
            above = previous[index]
            upper_left = previous[index - channels] if index >= channels else 0
            if filter_type == 0:
                predictor = 0
            elif filter_type == 1:
                predictor = left
            elif filter_type == 2:
                predictor = above
            elif filter_type == 3:
                predictor = (left + above) // 2
            else:
                estimate = left + above - upper_left
                left_distance = abs(estimate - left)
                above_distance = abs(estimate - above)
                upper_left_distance = abs(estimate - upper_left)
                predictor = (
                    left
                    if left_distance <= above_distance and left_distance <= upper_left_distance
                    else above
                    if above_distance <= upper_left_distance
                    else upper_left
                )
            row[index] = (byte + predictor) & 0xFF
        for index in range(0, row_bytes, channels):
            red, green, blue = row[index : index + 3]
            alpha = row[index + 3] if channels == 4 else 255
            color_key = (
                (red >> 4) << 12
                | (green >> 4) << 8
                | (blue >> 4) << 4
                | (alpha >> 4)
            )
            color_counts[color_key] += 1
        previous = row
    populated_colors = [count for count in color_counts if count]
    if (
        len(populated_colors) < MIN_SCREENSHOT_COLORS
        or max(populated_colors) / (width * height) > MAX_SCREENSHOT_DOMINANT_RATIO
    ):
        raise M8QualityError(f"{label} is a blank or near-blank placeholder screenshot")
    return width, height


def _validate_user_agent(engine: str, value: object, *, label: str) -> str:
    user_agent = _actual_text(value, label=label)
    tokens = {
        "chromium": ("Chrome/", "Chromium/", "HeadlessChrome/"),
        "firefox": ("Firefox/",),
        "webkit": ("AppleWebKit/",),
    }[engine]
    if not any(token in user_agent for token in tokens):
        raise M8QualityError(f"{label} does not identify the measured {engine} engine")
    forbidden = {
        "chromium": ("Firefox/",),
        "firefox": ("Chrome/", "Chromium/", "HeadlessChrome/"),
        "webkit": (
            "Chrome/",
            "Chromium/",
            "HeadlessChrome/",
            "Firefox/",
            "CriOS/",
            "FxiOS/",
            "Edg/",
        ),
    }[engine]
    if any(token in user_agent for token in forbidden):
        raise M8QualityError(f"{label} identifies a different browser engine")
    return user_agent


def _validate_measurement(
    workspace: Path,
    value: object,
    *,
    scenario_id: str,
    expected_versions: Mapping[str, str],
    command_windows: Sequence[tuple[dt.datetime, dt.datetime]],
    retained: dict[str, RetainedSource],
    used_artifact_paths: set[str],
) -> tuple[tuple[str, int], dict[str, object]]:
    if not isinstance(value, dict):
        raise M8QualityError(f"{scenario_id} measurement must be an object")
    engine = value.get("engine")
    width = value.get("width")
    if engine not in validator.REQUIRED_ENGINES or width not in validator.REQUIRED_WIDTHS:
        raise M8QualityError(f"{scenario_id} measurement has an unsupported engine or width")
    assert isinstance(engine, str) and isinstance(width, int)
    label = f"{scenario_id} {engine}/{width}"
    if value.get("result") != "passed":
        raise M8QualityError(f"{label} result must be passed")
    checks = value.get("checks")
    if not isinstance(checks, dict) or any(checks.get(name) != "passed" for name in CHECKS):
        raise M8QualityError(f"{label} must pass behavior, a11y, and responsive")
    recorded_at = _timestamp(value.get("recordedAt"), label=f"{label}.recordedAt")
    _within_command_window(recorded_at, command_windows, label=label)
    browser_version = _version(value.get("browserVersion"), label=f"{label}.browserVersion")
    if browser_version != expected_versions[engine]:
        raise M8QualityError(f"{label} browser version differs from the launched browser report")
    user_agent = _validate_user_agent(engine, value.get("userAgent"), label=f"{label}.userAgent")
    url = _http_url(value.get("url"), label=f"{label}.url")
    device_scale = value.get("deviceScaleFactor")
    if (
        not isinstance(device_scale, (int, float))
        or isinstance(device_scale, bool)
        or device_scale <= 0
        or device_scale > 4
    ):
        raise M8QualityError(f"{label}.deviceScaleFactor must be between 0 and 4")

    behavior_block = value.get("behavior")
    axe_block = value.get("axe")
    responsive_block = value.get("responsive")
    if not isinstance(behavior_block, dict) or behavior_block.get("result") != "passed":
        raise M8QualityError(f"{label}.behavior must be passed")
    if not isinstance(axe_block, dict) or axe_block.get("result") != "passed":
        raise M8QualityError(f"{label}.axe must be passed")
    if not isinstance(responsive_block, dict) or responsive_block.get("result") != "passed":
        raise M8QualityError(f"{label}.responsive must be passed")

    behavior = _artifact(
        workspace, behavior_block.get("artifact"), label=f"{label}.behavior.artifact"
    )
    axe = _artifact(workspace, axe_block.get("artifact"), label=f"{label}.axe.artifact")
    responsive = _artifact(
        workspace,
        responsive_block.get("artifact"),
        label=f"{label}.responsive.artifact",
    )
    screenshot = _artifact(workspace, value.get("screenshot"), label=f"{label}.screenshot")
    for role, artifact in (
        ("behavior", behavior),
        ("axe", axe),
        ("responsive", responsive),
        ("screenshot", screenshot),
    ):
        if artifact.path in used_artifact_paths:
            raise M8QualityError(f"{label}.{role} must use a unique retained artifact")
        used_artifact_paths.add(artifact.path)
        _retain(retained, artifact, role=f"{engine}-{width}-{role}")

    assertion_count = _validate_behavior_artifact(
        behavior, scenario_id=scenario_id, engine=engine, width=width
    )
    if behavior_block.get("assertionCount") != assertion_count:
        raise M8QualityError(f"{label}.behavior assertion count mismatch")
    critical, serious, axe_version = _validate_axe_artifact(
        axe,
        scenario_id=scenario_id,
        engine=engine,
        width=width,
        url=url,
        command_windows=command_windows,
    )
    if axe_block.get("critical") != critical or axe_block.get("serious") != serious:
        raise M8QualityError(f"{label}.axe severity counts mismatch")
    responsive_facts = _validate_responsive_artifact(
        responsive, scenario_id=scenario_id, engine=engine, width=width
    )
    if responsive_block.get("pageHorizontalOverflow") is not False:
        raise M8QualityError(f"{label}.responsive must record no page horizontal overflow")
    pixel_width, pixel_height = _png_dimensions(screenshot.content, label=f"{label}.screenshot")
    expected_pixel_width = round(width * float(device_scale))
    expected_pixel_height = round(int(responsive_facts["viewportHeight"]) * float(device_scale))
    if pixel_width != expected_pixel_width or pixel_height != expected_pixel_height:
        raise M8QualityError(f"{label}.screenshot dimensions do not match the viewport")

    return (engine, width), {
        "engine": engine,
        "width": width,
        "behavior": "passed",
        "a11y": "passed",
        "responsive": "passed",
        "recordedAt": value.get("recordedAt"),
        "browserVersion": browser_version,
        "userAgent": user_agent,
        "url": url,
        "deviceScaleFactor": device_scale,
        "behaviorAssertionCount": assertion_count,
        "axe": {
            "engineVersion": axe_version,
            "critical": critical,
            "serious": serious,
        },
        "responsiveFacts": responsive_facts,
        "screenshot": {
            "width": pixel_width,
            "height": pixel_height,
            "size": screenshot.size,
            "sha256": screenshot.sha256,
        },
        "rawArtifactSha256": {
            "behavior": behavior.sha256,
            "axe": axe.sha256,
            "responsive": responsive.sha256,
        },
    }


def _workspace_report_path(workspace: Path, report_path: Path, *, label: str) -> tuple[Path, str]:
    candidate = report_path if report_path.is_absolute() else workspace / report_path
    absolute = _absolute_without_links(candidate, label=label, must_exist=True)
    try:
        relative = absolute.relative_to(workspace).as_posix()
    except ValueError as error:
        raise M8QualityError(f"{label} must stay inside its evaluator workspace") from error
    safe_relative = _safe_relative(relative, label=label)
    verified = _safe_workspace_file(workspace, safe_relative, label=label)
    return verified, safe_relative.as_posix()


def validate_scenario_report(
    workspace_path: Path,
    report_path: Path,
    *,
    candidate_binding: Mapping[str, object],
) -> ValidatedScenario:
    """Validate one completed evaluator workspace and its raw quality report."""

    workspace = _absolute_without_links(
        workspace_path, label="evaluator workspace", must_exist=True
    )
    if not workspace.is_dir():
        raise M8QualityError(f"evaluator workspace must be a directory: {workspace}")
    workspace = workspace.resolve(strict=True)
    manifest, manifest_source = _read_workspace_json(
        workspace,
        PurePosixPath(consumer.MANIFEST_NAME),
        label="workspace visible inputs",
    )
    run = manifest.get("run")
    scenario = manifest.get("scenario")
    acceptance = manifest.get("acceptanceEvidence")
    if (
        manifest.get("schemaVersion") != SCHEMA_VERSION
        or manifest.get("kind") != "personal-ui-m8-evaluator-inputs"
        or manifest.get("official") is not True
        or not isinstance(acceptance, dict)
        or acceptance.get("eligible") is not True
        or not isinstance(run, dict)
        or not isinstance(run.get("id"), str)
        or consumer.RUN_ID_PATTERN.fullmatch(run["id"]) is None
        or not isinstance(scenario, dict)
        or scenario.get("id") not in validator.M8_SCENARIOS
    ):
        raise M8QualityError("workspace visible inputs are not official M8 evaluator inputs")
    scenario_id = str(scenario["id"])
    if manifest.get("candidate") != candidate_binding:
        raise M8QualityError(f"{scenario_id} workspace candidate binding mismatch")

    report_file, report_relative = _workspace_report_path(
        workspace,
        report_path,
        label=f"{scenario_id} scenario report",
    )
    report_content = report_file.read_bytes()
    report = _json_object(report_content, label=f"{scenario_id} scenario report")
    if (
        report.get("schemaVersion") != SCHEMA_VERSION
        or report.get("kind") != SCENARIO_REPORT_KIND
        or report.get("result") != "passed"
        or report.get("scenarioId") != scenario_id
        or report.get("runId") != run["id"]
        or report.get("candidate") != candidate_binding
        or report.get("workspaceRoot") != "."
    ):
        raise M8QualityError(f"{scenario_id} scenario report is incomplete or unbound")

    project_relative = _safe_relative(
        report.get("projectRoot"), label=f"{scenario_id} projectRoot"
    )
    layout = manifest.get("bundleLayout")
    consumer_root_value = layout.get("consumerRoot") if isinstance(layout, dict) else None
    consumer_root = _safe_relative(
        consumer_root_value, label=f"{scenario_id} manifest consumerRoot"
    )
    if (
        project_relative != consumer_root
        and project_relative.parts[: len(consumer_root.parts)] != consumer_root.parts
    ):
        raise M8QualityError(f"{scenario_id} projectRoot must stay under the consumer root")
    project_directory = _safe_workspace_directory(
        workspace, project_relative, label=f"{scenario_id} projectRoot"
    )

    retained: dict[str, RetainedSource] = {}
    _retain(retained, manifest_source, role="visible-inputs")
    _retain(
        retained,
        SourceArtifact(report_relative, report_content),
        role="scenario-quality-report",
    )
    _validate_final_result(
        workspace,
        manifest=manifest,
        candidate_binding=candidate_binding,
        project_root=project_directory,
        scenario_id=scenario_id,
        retained=retained,
    )

    commands = report.get("commands")
    if not isinstance(commands, list) or not commands:
        raise M8QualityError(f"{scenario_id} commands must be a non-empty array")
    command_summaries: list[dict[str, object]] = []
    purposes: set[object] = set()
    browser_windows: list[tuple[dt.datetime, dt.datetime]] = []
    for index, command in enumerate(commands):
        summary, window = _validate_command(
            workspace,
            command,
            scenario_id=scenario_id,
            project_root=project_relative,
            index=index,
            retained=retained,
        )
        command_summaries.append(summary)
        purposes.add(summary["purpose"])
        if summary["purpose"] == "browser-quality":
            browser_windows.append(window)
    required_purposes = {"typecheck", "build", "verifier", "browser-quality"}
    if purposes != required_purposes:
        missing = sorted(required_purposes - purposes)
        extra = sorted(str(value) for value in purposes - required_purposes)
        raise M8QualityError(
            f"{scenario_id} commands must cover each required purpose exactly as a set; "
            f"missing={missing}, extra={extra}"
        )
    if not browser_windows:
        raise M8QualityError(f"{scenario_id} has no passed browser-quality command")

    browser_versions = _validate_browser_versions(
        workspace,
        report.get("browserVersions"),
        scenario_id=scenario_id,
        windows=browser_windows,
        retained=retained,
    )
    versions_by_engine = {
        str(item["project"]): str(item["version"]) for item in browser_versions
    }
    measurements = report.get("measurements")
    if not isinstance(measurements, list):
        raise M8QualityError(f"{scenario_id} measurements must be an array")
    expected_keys = {
        (engine, width)
        for engine in validator.REQUIRED_ENGINES
        for width in validator.REQUIRED_WIDTHS
    }
    normalized: dict[tuple[str, int], dict[str, object]] = {}
    used_artifact_paths: set[str] = set()
    for measurement in measurements:
        key, item = _validate_measurement(
            workspace,
            measurement,
            scenario_id=scenario_id,
            expected_versions=versions_by_engine,
            command_windows=browser_windows,
            retained=retained,
            used_artifact_paths=used_artifact_paths,
        )
        if key in normalized:
            raise M8QualityError(f"{scenario_id} contains duplicate measurement {key}")
        normalized[key] = item
    if set(normalized) != expected_keys or len(measurements) != len(expected_keys):
        missing = sorted(expected_keys - set(normalized))
        extra = sorted(set(normalized) - expected_keys)
        raise M8QualityError(
            f"{scenario_id} must retain every engine/width measurement; "
            f"missing={missing}, extra={extra}"
        )
    ordered = tuple(
        normalized[(engine, width)]
        for engine in validator.REQUIRED_ENGINES
        for width in validator.REQUIRED_WIDTHS
    )
    return ValidatedScenario(
        scenario_id=scenario_id,
        run_id=str(run["id"]),
        project_root=project_relative.as_posix(),
        browser_versions=browser_versions,
        measurements=ordered,
        command_summaries=tuple(command_summaries),
        raw_sources=retained,
        report_sha256=sha256_bytes(report_content),
    )


def _hosted_safari_bundle(
    path: Path,
) -> tuple[Path, dict[str, Any], bytes, Path | None]:
    absolute = _absolute_without_links(
        path, label="hosted Safari evidence", must_exist=True
    )
    if not absolute.is_file():
        raise M8QualityError("hosted Safari evidence must be a regular file")
    content = absolute.read_bytes()
    if not content:
        raise M8QualityError("hosted Safari evidence must not be empty")
    document = _json_object(content, label="hosted Safari evidence")
    kind = document.get("kind")
    if kind == hosted_validator.EVIDENCE_KIND:
        return absolute, document, content, None
    if kind == hosted_validator.SAFARI_KIND:
        if absolute.parent.name != "artifacts":
            raise M8QualityError(
                "a hosted Safari record is accepted only inside its hosted-ci bundle"
            )
        bundle_path = _absolute_without_links(
            absolute.parent.parent / "hosted-ci.json",
            label="hosted Safari bundle",
            must_exist=True,
        )
        if not bundle_path.is_file():
            raise M8QualityError("hosted Safari bundle must be a regular file")
        bundle_content = bundle_path.read_bytes()
        bundle = _json_object(bundle_content, label="hosted Safari bundle")
        return bundle_path, bundle, bundle_content, absolute
    if kind == SAFARI_WRAPPER_KIND:
        raise M8QualityError(
            "raw self-reported Safari JSON is not hosted GitHub Actions evidence"
        )
    raise M8QualityError("Safari evidence must be a hosted Safari record or bundle")


def _validate_safari_payload(record: Mapping[str, object]) -> None:
    safari = record.get("safari")
    checks = record.get("checks")
    tools = record.get("actualTools")
    if not isinstance(safari, dict):
        raise M8QualityError("hosted Safari record has no safari object")
    version = _version(safari.get("version"), label="real Safari version")
    try:
        major = int(version.split(".", 1)[0])
    except ValueError as error:
        raise M8QualityError("real Safari version is invalid") from error
    user_agent = _actual_text(safari.get("userAgent"), label="real Safari userAgent")
    if (
        record.get("schemaVersion") != SCHEMA_VERSION
        or record.get("kind") != hosted_validator.SAFARI_KIND
        or record.get("jobId") != "safari-quality"
        or record.get("result") != "passed"
        or record.get("playwrightWebKit", False) is not False
        or safari.get("product") != "Safari"
        or str(safari.get("browserName", "")).lower() != "safari"
        or safari.get("version") != safari.get("capabilityVersion")
        or safari.get("majorVersion") != major
        or major < 18
        or safari.get("driver") != "safaridriver"
        or safari.get("realSafari") is not True
        or "Version/" not in user_agent
        or "Safari/" not in user_agent
        or any(
            token in user_agent
            for token in ("Chrome/", "Chromium/", "CriOS/", "FxiOS/")
        )
        or not isinstance(checks, dict)
        or any(checks.get(name) != "passed" for name in SAFARI_CHECKS)
        or not isinstance(tools, dict)
        or any(
            not isinstance(tools.get(name), str) or not tools[name].strip()
            for name in ("node", "npm", "python", "safaridriver")
        )
    ):
        raise M8QualityError(
            "hosted Safari record is incomplete, synthetic, or below Safari 18"
        )


def _validate_safari_report(
    path: Path,
    *,
    candidate_summary: Mapping[str, object],
    fixture_catalog: Mapping[str, object],
) -> tuple[dict[str, Any], bytes]:
    bundle_path, bundle, bundle_bytes, requested_record = _hosted_safari_bundle(path)
    expected_bindings = {
        "planDigest": candidate_summary.get("planDigest"),
        "sourceCommit": candidate_summary.get("sourceCommit"),
        "archiveSha256": candidate_summary.get("archiveSha256"),
    }
    result = hosted_validator.validate_hosted_ci_evidence(
        bundle,
        evidence_root=bundle_path.parent,
        fixture_catalog=fixture_catalog,
        expected_bindings=expected_bindings,
    )
    if not result.accepted:
        details = "; ".join(result.errors) or result.category
        raise M8QualityError(f"hosted Safari bundle is not accepted: {details}")

    descriptors = bundle.get("artifacts")
    assert isinstance(descriptors, list)
    matches = [
        item
        for item in descriptors
        if isinstance(item, dict)
        and item.get("role") == "safari"
        and item.get("id") == "safari-quality"
    ]
    if len(matches) != 1:
        raise M8QualityError(
            "hosted Safari bundle must contain exactly one safari-quality artifact"
        )
    descriptor = matches[0]
    relative = _safe_relative(
        descriptor.get("path"), label="hosted Safari artifact path"
    )
    if relative.parts[:1] != ("artifacts",):
        raise M8QualityError("hosted Safari artifact must stay under artifacts/")
    record_path = _safe_workspace_file(
        bundle_path.parent, relative, label="hosted Safari artifact"
    )
    if requested_record is not None and record_path != requested_record.resolve(strict=True):
        raise M8QualityError(
            "hosted Safari record is not the bundle's safari-quality artifact"
        )
    record_bytes = record_path.read_bytes()
    if (
        descriptor.get("size") != len(record_bytes)
        or descriptor.get("sha256") != sha256_bytes(record_bytes)
    ):
        raise M8QualityError("hosted Safari artifact bytes do not match the bundle")
    record = _json_object(record_bytes, label="hosted Safari artifact")
    _validate_safari_payload(record)

    runner = record.get("runner")
    workflow = bundle.get("workflow")
    if (
        not isinstance(runner, dict)
        or runner.get("hosted") is not True
        or str(runner.get("os", "")).lower() != "macos"
        or not isinstance(workflow, dict)
    ):
        raise M8QualityError(
            "Safari evidence must come from the hosted macOS safari-quality job"
        )

    safari = record["safari"]
    checks = record["checks"]
    tools = record["actualTools"]
    assert isinstance(safari, dict)
    assert isinstance(checks, dict)
    assert isinstance(tools, dict)
    normalized = {
        "schemaVersion": SCHEMA_VERSION,
        "kind": SAFARI_WRAPPER_KIND,
        "result": "passed",
        "playwrightWebKit": False,
        "safari": safari,
        "checks": checks,
        "actualTools": tools,
        "hostedEvidence": {
            "kind": hosted_validator.SAFARI_KIND,
            "jobId": "safari-quality",
            "planDigest": bundle["planDigest"],
            "sourceCommit": bundle["sourceCommit"],
            "archiveSha256": bundle["archiveSha256"],
            "repository": workflow["repository"],
            "workflowRef": workflow["ref"],
            "runId": workflow["runId"],
            "runAttempt": workflow["runAttempt"],
            "runUrl": workflow["runUrl"],
            "event": workflow["event"],
            "runner": runner,
            "recordSha256": sha256_bytes(record_bytes),
            "bundleSha256": sha256_bytes(bundle_bytes),
        },
    }
    return normalized, canonical_json(normalized)


def _descriptor(files: Mapping[str, bytes], relative: str) -> dict[str, object]:
    content = files[relative]
    return {
        "path": relative,
        "size": len(content),
        "sha256": sha256_bytes(content),
    }


def _new_output(
    output_path: Path,
    *,
    candidate: Path,
    workspaces: Sequence[Path],
    repository: Path,
) -> Path:
    if str(output_path).strip() in {"", "."}:
        raise M8QualityError("output must be an explicit new directory")
    output = _absolute_without_links(output_path, label="output", must_exist=False)
    parent = _absolute_without_links(output.parent, label="output parent", must_exist=True)
    if not parent.is_dir():
        raise M8QualityError("output parent must be a directory")
    if output.exists() or _is_link(output):
        raise M8QualityError(f"output must be a new path: {output}")
    occupied = [(candidate, "candidate"), (repository.resolve(strict=True), "repository")]
    occupied.extend((workspace, "evaluator workspace") for workspace in workspaces)
    for path, label in occupied:
        if _within(output, path) or _within(path, output):
            raise M8QualityError(f"output must not overlap the {label}")
    return output


def _quality_files(
    scenarios: Sequence[ValidatedScenario],
    *,
    candidate_summary: Mapping[str, object],
    safari_report: Mapping[str, object],
    safari_bytes: bytes,
) -> tuple[dict[str, bytes], dict[str, object]]:
    files: dict[str, bytes] = {}
    raw_inventory_items: list[dict[str, object]] = []
    scenario_records: dict[str, dict[str, object]] = {}

    for scenario in scenarios:
        for source_path, source in sorted(scenario.raw_sources.items()):
            source_relative = _safe_relative(
                source_path,
                label=f"{scenario.scenario_id} retained source path",
            )
            retained_relative = (
                QUALITY_DIRECTORY
                / "raw"
                / scenario.scenario_id
                / "workspace"
                / source_relative
            ).as_posix()
            if retained_relative in files:
                raise M8QualityError(f"duplicate retained raw artifact: {retained_relative}")
            files[retained_relative] = source.content
            raw_inventory_items.append(
                {
                    "path": retained_relative,
                    "size": len(source.content),
                    "sha256": sha256_bytes(source.content),
                    "scenarioId": scenario.scenario_id,
                    "roles": sorted(source.roles),
                    "sourcePath": source_path,
                }
            )

        checks = {name: "passed" for name in CHECKS}
        record = {
            "schemaVersion": SCHEMA_VERSION,
            "kind": "personal-ui-m8-quality-scenario",
            "scenarioId": scenario.scenario_id,
            "result": "passed",
            "candidate": dict(candidate_summary),
            "runId": scenario.run_id,
            "projectRoot": scenario.project_root,
            "sourceReportSha256": scenario.report_sha256,
            "widths": list(validator.REQUIRED_WIDTHS),
            "engines": list(validator.REQUIRED_ENGINES),
            "checks": checks,
            "commands": list(scenario.command_summaries),
            "measurements": list(scenario.measurements),
        }
        relative = (QUALITY_DIRECTORY / f"{scenario.scenario_id}.json").as_posix()
        files[relative] = canonical_json(record)
        scenario_records[scenario.scenario_id] = record

    first_versions = scenarios[0].browser_versions
    for scenario in scenarios[1:]:
        if scenario.browser_versions != first_versions:
            raise M8QualityError(
                "all six scenario reports must record the same launched browser versions"
            )

    matrix = {
        "schemaVersion": SCHEMA_VERSION,
        "kind": "personal-ui-m8-quality-matrix",
        "result": "passed",
        "candidate": dict(candidate_summary),
        "widths": list(validator.REQUIRED_WIDTHS),
        "engines": list(validator.REQUIRED_ENGINES),
        "scenarios": list(validator.M8_SCENARIOS),
        "measurementCount": len(validator.M8_SCENARIOS)
        * len(validator.REQUIRED_ENGINES)
        * len(validator.REQUIRED_WIDTHS),
    }
    browser_versions = {
        "schemaVersion": SCHEMA_VERSION,
        "kind": "personal-ui-m8-browser-versions",
        "result": "passed",
        "candidate": dict(candidate_summary),
        "browsers": list(first_versions),
        "scenarioReports": [
            {"id": item.scenario_id, "sha256": item.report_sha256} for item in scenarios
        ],
    }
    responsive_review = {
        "schemaVersion": SCHEMA_VERSION,
        "kind": "personal-ui-m8-responsive-review",
        "result": "passed",
        "candidate": dict(candidate_summary),
        "widths": list(validator.REQUIRED_WIDTHS),
        "scenarios": list(validator.M8_SCENARIOS),
        "engines": list(validator.REQUIRED_ENGINES),
        "measurementCount": matrix["measurementCount"],
        "pageHorizontalOverflowFailures": 0,
    }
    axe_scenarios = [
        {
            "id": scenario_id,
            "critical": 0,
            "serious": 0,
            "scanCount": len(scenario_records[scenario_id]["measurements"]),
        }
        for scenario_id in validator.M8_SCENARIOS
    ]
    axe = {
        "schemaVersion": SCHEMA_VERSION,
        "kind": "personal-ui-m8-axe-report",
        "result": "passed",
        "candidate": dict(candidate_summary),
        "critical": 0,
        "serious": 0,
        "scenarios": axe_scenarios,
    }
    fixed_files = {
        (QUALITY_DIRECTORY / "matrix.json").as_posix(): canonical_json(matrix),
        (QUALITY_DIRECTORY / "browserVersions.json").as_posix(): canonical_json(
            browser_versions
        ),
        (QUALITY_DIRECTORY / "responsiveReview.json").as_posix(): canonical_json(
            responsive_review
        ),
        (QUALITY_DIRECTORY / "axe.json").as_posix(): canonical_json(axe),
        (QUALITY_DIRECTORY / "safari.json").as_posix(): safari_bytes,
    }
    for relative, content in fixed_files.items():
        if relative in files:
            raise M8QualityError(f"duplicate generated artifact: {relative}")
        files[relative] = content

    raw_inventory = {
        "schemaVersion": SCHEMA_VERSION,
        "kind": RAW_INVENTORY_KIND,
        "result": "passed",
        "candidate": dict(candidate_summary),
        "artifactCount": len(raw_inventory_items),
        "artifacts": raw_inventory_items,
    }
    raw_inventory_path = (QUALITY_DIRECTORY / "raw-artifact-inventory.json").as_posix()
    files[raw_inventory_path] = canonical_json(raw_inventory)

    scenario_summaries = []
    for scenario_id in validator.M8_SCENARIOS:
        scenario_path = (QUALITY_DIRECTORY / f"{scenario_id}.json").as_posix()
        scenario_summaries.append(
            {
                "id": scenario_id,
                "widths": list(validator.REQUIRED_WIDTHS),
                "engines": list(validator.REQUIRED_ENGINES),
                "checks": {name: "passed" for name in CHECKS},
                "artifact": _descriptor(files, scenario_path),
            }
        )
    safari = safari_report["safari"]
    assert isinstance(safari, dict)
    fragment: dict[str, object] = {
        "result": "passed",
        "candidate": dict(candidate_summary),
        "widths": list(validator.REQUIRED_WIDTHS),
        "engines": list(validator.REQUIRED_ENGINES),
        "scenarios": scenario_summaries,
        "realSafari": {
            "result": "passed",
            "browser": "Safari",
            "version": safari["version"],
            "playwrightWebKit": False,
            "artifact": _descriptor(files, (QUALITY_DIRECTORY / "safari.json").as_posix()),
        },
        "axe": {
            "result": "passed",
            "critical": 0,
            "serious": 0,
            "artifact": _descriptor(files, (QUALITY_DIRECTORY / "axe.json").as_posix()),
        },
        "artifacts": {
            "matrix": _descriptor(files, (QUALITY_DIRECTORY / "matrix.json").as_posix()),
            "browserVersions": _descriptor(
                files, (QUALITY_DIRECTORY / "browserVersions.json").as_posix()
            ),
            "responsiveReview": _descriptor(
                files, (QUALITY_DIRECTORY / "responsiveReview.json").as_posix()
            ),
            "rawEvidence": _descriptor(files, raw_inventory_path),
        },
    }
    files[QUALITY_FRAGMENT_NAME] = canonical_json(fragment)
    return files, fragment


def _write_bundle(output: Path, files: Mapping[str, bytes]) -> None:
    temporary = Path(
        tempfile.mkdtemp(prefix=f".{output.name}-", dir=output.parent)
    )
    try:
        for relative, content in sorted(files.items()):
            safe = _safe_relative(relative, label="generated artifact path")
            target = temporary.joinpath(*safe.parts)
            target.parent.mkdir(parents=True, exist_ok=True)
            with target.open("xb") as handle:
                handle.write(content)
            if target.read_bytes() != content:
                raise M8QualityError(f"generated artifact failed write verification: {relative}")

        fragment = _json_object(
            (temporary / QUALITY_FRAGMENT_NAME).read_bytes(), label="quality fragment"
        )
        candidate = fragment.get("candidate")
        if not isinstance(candidate, dict):
            raise M8QualityError("generated quality fragment candidate is invalid")
        full_candidate = {
            **candidate,
            "archive": {"sha256": candidate.get("archiveSha256")},
        }
        errors = validator._validate_quality(
            {"qualityMatrix": fragment}, full_candidate, temporary
        )
        if errors:
            raise M8QualityError(
                "generated quality bundle fails the strict validator: " + "; ".join(errors)
            )
        os.replace(temporary, output)
    except Exception:
        if temporary.exists() and not _is_link(temporary):
            shutil.rmtree(temporary, ignore_errors=True)
        raise


def build_quality_bundle(
    *,
    candidate_path: Path,
    workspace_report_pairs: Sequence[tuple[Path, Path]],
    safari_report_path: Path,
    output_path: Path,
    repository: Path = release.SKILL_ROOT,
) -> dict[str, object]:
    """Validate source evidence and atomically create one M8 quality bundle."""

    candidate, binding, summary = load_verified_candidate(candidate_path)
    if len(workspace_report_pairs) != len(validator.M8_SCENARIOS):
        raise M8QualityError(
            f"exactly {len(validator.M8_SCENARIOS)} workspace/report pairs are required"
        )
    workspace_roots: list[Path] = []
    protected_roots = (
        (candidate, "candidate"),
        (_absolute_without_links(repository, label="repository", must_exist=True).resolve(strict=True), "repository"),
    )
    for workspace_path, _ in workspace_report_pairs:
        workspace = _absolute_without_links(
            workspace_path, label="evaluator workspace", must_exist=True
        ).resolve(strict=True)
        if not workspace.is_dir():
            raise M8QualityError(f"evaluator workspace must be a directory: {workspace}")
        for protected, label in protected_roots:
            if _within(workspace, protected) or _within(protected, workspace):
                raise M8QualityError(f"evaluator workspace must not overlap the {label}")
        for existing in workspace_roots:
            if _within(workspace, existing) or _within(existing, workspace):
                raise M8QualityError("evaluator workspaces must be disjoint")
        workspace_roots.append(workspace)
    output = _new_output(
        output_path,
        candidate=candidate,
        workspaces=workspace_roots,
        repository=repository,
    )

    by_id: dict[str, ValidatedScenario] = {}
    for (workspace_path, report_path), workspace in zip(
        workspace_report_pairs, workspace_roots
    ):
        validated = validate_scenario_report(
            workspace,
            report_path,
            candidate_binding=binding,
        )
        if validated.scenario_id in by_id:
            raise M8QualityError(f"duplicate scenario report: {validated.scenario_id}")
        by_id[validated.scenario_id] = validated
    if set(by_id) != set(validator.M8_SCENARIOS):
        missing = sorted(set(validator.M8_SCENARIOS) - set(by_id))
        unknown = sorted(set(by_id) - set(validator.M8_SCENARIOS))
        raise M8QualityError(
            f"scenario reports must cover the frozen catalog; missing={missing}, unknown={unknown}"
        )
    ordered = [by_id[scenario_id] for scenario_id in validator.M8_SCENARIOS]
    safari_report, safari_bytes = _validate_safari_report(
        safari_report_path,
        candidate_summary=summary,
        fixture_catalog=_candidate_fixture_catalog(candidate),
    )
    files, fragment = _quality_files(
        ordered,
        candidate_summary=summary,
        safari_report=safari_report,
        safari_bytes=safari_bytes,
    )
    _write_bundle(output, files)
    return fragment


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--candidate", type=Path, required=True)
    parser.add_argument(
        "--workspace",
        type=Path,
        action="append",
        required=True,
        help="Evaluator workspace root; repeat exactly six times in report order.",
    )
    parser.add_argument(
        "--scenario-report",
        type=Path,
        action="append",
        required=True,
        help="Report path inside the paired workspace; repeat exactly six times.",
    )
    parser.add_argument("--safari-report", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    if len(args.workspace) != len(args.scenario_report):
        print("error: --workspace and --scenario-report must be supplied in pairs", file=sys.stderr)
        return 2
    try:
        fragment = build_quality_bundle(
            candidate_path=args.candidate,
            workspace_report_pairs=list(zip(args.workspace, args.scenario_report)),
            safari_report_path=args.safari_report,
            output_path=args.output,
        )
        print(json.dumps(fragment, ensure_ascii=False, indent=2, sort_keys=True))
        return 0
    except (M8QualityError, OSError, ValueError, json.JSONDecodeError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
