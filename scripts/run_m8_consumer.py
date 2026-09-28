#!/usr/bin/env python3
"""Create a sealed M8 evaluator workspace from a verified release candidate.

This command prepares inputs only. It does not install dependencies, launch a
browser, run an evaluator, or create M8 acceptance evidence.
"""

from __future__ import annotations

import argparse
import copy
import datetime as dt
import json
import os
import re
import shutil
import stat
import sys
import uuid
from pathlib import Path, PurePosixPath
from typing import Any, Mapping, Sequence

import release_personal_ui as release


SCHEMA_VERSION = 1
MANIFEST_NAME = "visible-inputs.json"
REQUEST_NAME = "request.md"
CONSUMER_ROOT = PurePosixPath("consumer")
EVIDENCE_ROOT = PurePosixPath("evidence")
PROJECTION_ROOT = PurePosixPath("skill/ui-builder-xtn")
SCENARIO_CATALOG_PATH = PurePosixPath("evaluation/m8/scenarios.json")
ACCEPTANCE_RULES_PATH = PurePosixPath("evaluation/m8/acceptance-rules.json")
FORBIDDEN_PROJECTION_PATHS = frozenset(
    {
        "evaluation/m8/acceptance-rules.json",
        "references/m8-evaluation-protocol.md",
        "references/v0.3.0-roadmap.md",
        "references/v0.3.0-m4-m8-execution-plan.md",
    }
)
FORBIDDEN_PROJECTION_PREFIXES = ("evaluation/",)
FIXTURE_CATALOG_PATH = "references/support-fixtures.json"
IDENTIFIER_PATTERN = re.compile(r"[a-z0-9][a-z0-9-]{0,127}")
SHA256_PATTERN = re.compile(r"[0-9a-f]{64}")
RUN_ID_PATTERN = re.compile(
    r"m8-[a-z0-9][a-z0-9-]{0,127}-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}"
)


class M8ConsumerError(RuntimeError):
    """Raised when evaluator inputs cannot be created safely."""


def _has_parent_traversal(path: Path) -> bool:
    return any(part == ".." for part in path.parts)


def _absolute_without_links(path: Path, *, label: str) -> Path:
    expanded = path.expanduser()
    if _has_parent_traversal(expanded):
        raise M8ConsumerError(f"{label} must not contain parent traversal")
    return Path(os.path.abspath(os.fspath(expanded)))


def _is_link_or_junction(path: Path) -> bool:
    if path.is_symlink():
        return True
    is_junction = getattr(path, "is_junction", None)
    return bool(is_junction and is_junction())


def _reject_link_chain(path: Path, *, label: str) -> None:
    absolute = _absolute_without_links(path, label=label)
    anchor = Path(absolute.anchor)
    current = anchor
    for part in absolute.parts[1:]:
        current = current / part
        if _is_link_or_junction(current):
            raise M8ConsumerError(f"{label} must not traverse a symbolic link or junction")
        if not current.exists():
            break


def _reject_links_below(root: Path, *, label: str) -> None:
    for directory, directory_names, file_names in os.walk(root, followlinks=False):
        parent = Path(directory)
        for name in [*directory_names, *file_names]:
            child = parent / name
            if _is_link_or_junction(child):
                raise M8ConsumerError(
                    f"{label} contains a symbolic link or junction: "
                    f"{child.relative_to(root).as_posix()}"
                )


def _is_within(path: Path, parent: Path) -> bool:
    try:
        path.relative_to(parent)
        return True
    except ValueError:
        return False


def _reject_overlapping_roots(left: Path, right: Path, *, label: str) -> None:
    if _is_within(left, right) or _is_within(right, left):
        raise M8ConsumerError(f"{label} must use disjoint directories")


def _safe_candidate(candidate: Path) -> Path:
    absolute = _absolute_without_links(candidate, label="candidate")
    _reject_link_chain(absolute, label="candidate")
    if not absolute.is_dir():
        raise M8ConsumerError(f"candidate directory does not exist: {absolute}")
    _reject_link_chain(absolute / release.PLAN_NAME, label="release plan")
    _reject_link_chain(absolute / release.JOURNAL_NAME, label="release journal")
    return absolute


def _reject_bound_candidate_links(
    candidate: Path,
    plan: Mapping[str, object],
) -> None:
    staging = candidate / "staging" / release.ARCHIVE_PREFIX
    _reject_link_chain(staging, label="candidate staging")
    entries = plan.get("candidateFiles")
    if not isinstance(entries, list):
        raise release.ReleaseError("release plan candidateFiles is invalid")
    for entry in entries:
        if not isinstance(entry, dict) or not isinstance(entry.get("path"), str):
            raise release.ReleaseError("release plan candidate file entry is invalid")
        relative = release.validate_relative_path(entry["path"])
        _reject_link_chain(
            staging.joinpath(*relative.parts),
            label=f"candidate file {relative.as_posix()}",
        )

    artifacts = plan.get("artifacts")
    if not isinstance(artifacts, dict):
        raise release.ReleaseError("release plan artifacts are invalid")
    for name, metadata in artifacts.items():
        if not isinstance(metadata, dict) or not isinstance(metadata.get("path"), str):
            raise release.ReleaseError(f"release artifact metadata is invalid: {name}")
        relative = release.validate_relative_path(metadata["path"])
        _reject_link_chain(
            candidate.joinpath(*relative.parts),
            label=f"release artifact {name}",
        )


def _candidate_json(
    files: Mapping[str, bytes],
    path: PurePosixPath,
    *,
    label: str,
) -> dict[str, Any]:
    content = files.get(path.as_posix())
    if content is None:
        raise M8ConsumerError(f"candidate is missing {label}")
    try:
        value = json.loads(content.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise M8ConsumerError(f"candidate {label} is invalid") from error
    if not isinstance(value, dict):
        raise M8ConsumerError(f"candidate {label} must be an object")
    return value


def _validate_candidate_materials(files: Mapping[str, bytes]) -> None:
    catalog = _candidate_json(files, SCENARIO_CATALOG_PATH, label="M8 scenario catalog")
    rules = _candidate_json(files, ACCEPTANCE_RULES_PATH, label="M8 acceptance rules")
    fixtures = _candidate_json(
        files,
        PurePosixPath(FIXTURE_CATALOG_PATH),
        label="support fixture catalog",
    )
    scenarios = catalog.get("scenarios")
    rule_entries = rules.get("scenarioRules")
    fixture_entries = fixtures.get("fixtures")
    if (
        catalog.get("schemaVersion") != SCHEMA_VERSION
        or catalog.get("kind") != "personal-ui-m8-scenarios"
        or not isinstance(scenarios, list)
        or not scenarios
    ):
        raise M8ConsumerError("candidate M8 scenario catalog schema is unsupported")
    if (
        rules.get("schemaVersion") != SCHEMA_VERSION
        or rules.get("kind") != "personal-ui-m8-acceptance-rules"
        or rules.get("visibility") != "organizer-only"
        or not isinstance(rule_entries, list)
        or not isinstance(rules.get("attributionEnum"), list)
    ):
        raise M8ConsumerError("candidate M8 acceptance rules schema is unsupported")
    if not isinstance(fixture_entries, list):
        raise M8ConsumerError("candidate support fixture catalog has no fixtures")
    scenario_ids = [item.get("id") for item in scenarios if isinstance(item, dict)]
    rule_ids = [item.get("id") for item in rule_entries if isinstance(item, dict)]
    if (
        len(scenario_ids) != len(scenarios)
        or len(set(scenario_ids)) != len(scenario_ids)
        or any(not isinstance(item, str) or IDENTIFIER_PATTERN.fullmatch(item) is None for item in scenario_ids)
        or rule_ids != scenario_ids
    ):
        raise M8ConsumerError("candidate M8 scenarios and organizer rules do not match")
    fixture_ids = {
        item.get("id") for item in fixture_entries if isinstance(item, dict)
    }
    for item in scenarios:
        assert isinstance(item, dict)
        request = item.get("request")
        fixture_id = item.get("supportFixtureId")
        if not isinstance(request, dict) or fixture_id not in fixture_ids:
            raise M8ConsumerError("candidate M8 scenario references an unknown fixture")
        request_path = request.get("path")
        digest = request.get("sha256")
        if (
            not isinstance(request_path, str)
            or "\\" in request_path
            or not isinstance(digest, str)
            or SHA256_PATTERN.fullmatch(digest) is None
        ):
            raise M8ConsumerError("candidate M8 scenario request metadata is invalid")
        relative = PurePosixPath(request_path)
        if (
            relative.is_absolute()
            or any(part in {"", ".", ".."} for part in relative.parts)
            or relative.parts[:3] != ("evaluation", "m8", "requests")
            or relative.suffix != ".md"
        ):
            raise M8ConsumerError("candidate M8 scenario request path is unsafe")
        content = files.get(relative.as_posix())
        if content is None or not content.strip() or release.sha256_bytes(content) != digest:
            raise M8ConsumerError("candidate M8 scenario request hash mismatch")


def _scenario_inputs(
    *,
    scenario_id: str,
    candidate: Path,
    candidate_files: Mapping[str, bytes],
    catalog_root: Path | None,
) -> tuple[dict[str, object], bytes]:
    if IDENTIFIER_PATTERN.fullmatch(scenario_id) is None:
        raise M8ConsumerError(f"invalid M8 scenario id: {scenario_id!r}")
    catalog_relative = SCENARIO_CATALOG_PATH.as_posix()
    catalog_content = candidate_files.get(catalog_relative)
    if catalog_content is None:
        raise M8ConsumerError("candidate is missing the frozen M8 scenario catalog")
    try:
        catalog = json.loads(catalog_content.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise M8ConsumerError("M8 scenario catalog is invalid") from error
    if not isinstance(catalog, dict) or not isinstance(catalog.get("scenarios"), list):
        raise M8ConsumerError("M8 scenario catalog schema or kind is unsupported")
    scenarios = catalog["scenarios"]
    scenario = next(
        (entry for entry in scenarios if isinstance(entry, dict) and entry.get("id") == scenario_id),
        None,
    )
    if scenario is None:
        raise M8ConsumerError(f"unknown M8 scenario id: {scenario_id}")
    request = scenario.get("request")
    fixture_id = scenario.get("supportFixtureId")
    deliverables = scenario.get("allowedDeliverables")
    if not isinstance(request, dict):
        raise M8ConsumerError(f"M8 scenario request is invalid: {scenario_id}")
    request_path = request.get("path")
    expected_digest = request.get("sha256")
    if not isinstance(request_path, str) or "\\" in request_path:
        raise M8ConsumerError(f"M8 scenario request path is invalid: {scenario_id}")
    relative = PurePosixPath(request_path)
    if (
        relative.is_absolute()
        or any(part in {"", ".", ".."} for part in relative.parts)
        or relative.parts[:3] != ("evaluation", "m8", "requests")
        or relative.suffix != ".md"
    ):
        raise M8ConsumerError(f"M8 scenario request path is unsafe: {request_path!r}")
    if not isinstance(expected_digest, str) or SHA256_PATTERN.fullmatch(expected_digest) is None:
        raise M8ConsumerError(f"M8 scenario request hash is invalid: {scenario_id}")
    if not isinstance(fixture_id, str) or IDENTIFIER_PATTERN.fullmatch(fixture_id) is None:
        raise M8ConsumerError(f"M8 scenario support fixture is invalid: {scenario_id}")
    if (
        not isinstance(deliverables, list)
        or not deliverables
        or any(
            not isinstance(value, str) or IDENTIFIER_PATTERN.fullmatch(value) is None
            for value in deliverables
        )
        or len(set(deliverables)) != len(deliverables)
    ):
        raise M8ConsumerError(f"M8 scenario allowed deliverables are invalid: {scenario_id}")
    request_content = candidate_files.get(relative.as_posix())
    if request_content is None:
        raise M8ConsumerError(f"candidate is missing the frozen scenario request: {request_path}")
    if not request_content.strip():
        raise M8ConsumerError("scenario request must not be empty")
    try:
        request_content.decode("utf-8")
    except UnicodeDecodeError as error:
        raise M8ConsumerError("scenario request must be UTF-8 text") from error
    actual_digest = release.sha256_bytes(request_content)
    if actual_digest != expected_digest:
        raise M8ConsumerError(
            f"scenario request hash mismatch: expected {expected_digest}, found {actual_digest}"
        )

    if catalog_root is not None:
        root = _absolute_without_links(catalog_root, label="scenario catalog root")
        _reject_link_chain(root, label="scenario catalog root")
        if not root.is_dir():
            raise M8ConsumerError(f"scenario catalog root does not exist: {root}")
        _reject_overlapping_roots(root, candidate, label="scenario catalog and candidate")
        catalog_path = root.joinpath(*SCENARIO_CATALOG_PATH.parts)
        request_file = root.joinpath(*relative.parts)
        _reject_link_chain(catalog_path, label="scenario catalog")
        _reject_link_chain(request_file, label="scenario request")
        if not catalog_path.is_file():
            raise M8ConsumerError("scenario catalog differs from the frozen candidate")
        try:
            external_catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise M8ConsumerError("scenario catalog differs from the frozen candidate") from error
        if external_catalog != catalog:
            raise M8ConsumerError("scenario catalog differs from the frozen candidate")
        if not request_file.is_file() or request_file.read_bytes() != request_content:
            raise M8ConsumerError("scenario request differs from the frozen candidate")
    return (
        {
            "id": scenario_id,
            "catalogSha256": release.sha256_bytes(catalog_content),
            "requestPath": request_path,
            "requestSha256": expected_digest,
            "supportFixtureId": fixture_id,
            "allowedDeliverables": list(deliverables),
        },
        request_content,
    )


def _safe_new_output(
    output: Path,
    *,
    candidate: Path,
    repository_root: Path,
) -> Path:
    absolute = _absolute_without_links(output, label="output")
    repository = repository_root.resolve(strict=True)
    _reject_overlapping_roots(absolute, repository, label="output and repository")
    _reject_overlapping_roots(absolute, candidate, label="output and candidate")
    if absolute.exists() or absolute.is_symlink():
        raise M8ConsumerError(f"output must be a new path: {absolute}")
    _reject_link_chain(absolute.parent, label="output parent")
    absolute.parent.mkdir(parents=True, exist_ok=True)
    _reject_link_chain(absolute.parent, label="output parent")
    return absolute


def _fixture_record(files: Mapping[str, bytes], fixture_id: str) -> dict[str, Any]:
    if IDENTIFIER_PATTERN.fullmatch(fixture_id) is None:
        raise M8ConsumerError(f"invalid support fixture id: {fixture_id!r}")
    content = files.get(FIXTURE_CATALOG_PATH)
    if content is None:
        raise M8ConsumerError("candidate is missing the support fixture catalog")
    try:
        catalog = json.loads(content.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise M8ConsumerError("candidate support fixture catalog is invalid") from error
    fixtures = catalog.get("fixtures") if isinstance(catalog, dict) else None
    if not isinstance(fixtures, list):
        raise M8ConsumerError("candidate support fixture catalog has no fixtures")
    for fixture in fixtures:
        if isinstance(fixture, dict) and fixture.get("id") == fixture_id:
            environment = fixture.get("environment")
            project = fixture.get("project")
            if not isinstance(environment, dict) or not isinstance(project, dict):
                raise M8ConsumerError(f"support fixture is incomplete: {fixture_id}")
            return {
                "fixtureId": fixture_id,
                "status": "not-executed",
                "declared": {
                    "environment": copy.deepcopy(environment),
                    "project": copy.deepcopy(project),
                },
                "actual": None,
            }
    raise M8ConsumerError(f"unknown support fixture id: {fixture_id}")


def _candidate_bindings(plan: Mapping[str, object]) -> dict[str, object]:
    source = plan.get("source")
    artifacts = plan.get("artifacts")
    archive = artifacts.get("archive") if isinstance(artifacts, dict) else None
    bindings: dict[str, object] = {
        "version": plan.get("candidateVersion"),
        "planDigest": plan.get("planDigest"),
        "sourceCommit": source.get("commit") if isinstance(source, dict) else None,
        "sourceContentDigest": (
            source.get("contentDigest") if isinstance(source, dict) else None
        ),
        "sourceDateEpoch": (
            source.get("sourceDateEpoch") if isinstance(source, dict) else None
        ),
        "candidateContentDigest": plan.get("candidateContentDigest"),
        "archive": copy.deepcopy(archive) if isinstance(archive, dict) else None,
    }
    if not isinstance(bindings["version"], str) or not bindings["version"]:
        raise M8ConsumerError("candidate version binding is invalid")
    for field in ("planDigest", "sourceContentDigest", "candidateContentDigest"):
        if not isinstance(bindings[field], str) or SHA256_PATTERN.fullmatch(bindings[field]) is None:
            raise M8ConsumerError(f"candidate {field} binding is invalid")
    if not isinstance(bindings["sourceCommit"], str) or not bindings["sourceCommit"]:
        raise M8ConsumerError("candidate sourceCommit binding is invalid")
    if not isinstance(bindings["sourceDateEpoch"], int) or bindings["sourceDateEpoch"] < 0:
        raise M8ConsumerError("candidate sourceDateEpoch binding is invalid")
    archive_binding = bindings["archive"]
    if not isinstance(archive_binding, dict):
        raise M8ConsumerError("candidate archive binding is invalid")
    archive_path = archive_binding.get("path")
    archive_size = archive_binding.get("size")
    archive_sha256 = archive_binding.get("sha256")
    if not isinstance(archive_path, str):
        raise M8ConsumerError("candidate archive path binding is invalid")
    release.validate_relative_path(archive_path)
    if not isinstance(archive_size, int) or archive_size < 0:
        raise M8ConsumerError("candidate archive size binding is invalid")
    if not isinstance(archive_sha256, str) or SHA256_PATTERN.fullmatch(archive_sha256) is None:
        raise M8ConsumerError("candidate archive SHA-256 binding is invalid")
    return {
        "version": str(bindings["version"]),
        "planDigest": str(bindings["planDigest"]),
        "sourceCommit": str(bindings["sourceCommit"]),
        "sourceContentDigest": str(bindings["sourceContentDigest"]),
        "sourceDateEpoch": bindings["sourceDateEpoch"],
        "candidateContentDigest": str(bindings["candidateContentDigest"]),
        "archive": {
            "path": archive_path,
            "size": archive_size,
            "sha256": archive_sha256,
        },
    }


def _candidate_gate_blockers(
    plan: Mapping[str, object],
    journal: Mapping[str, object],
) -> tuple[list[str], list[str]]:
    source = plan.get("source")
    official: list[str] = []
    if not isinstance(source, dict):
        official.append("candidate-source-invalid")
    else:
        if source.get("mode") != "commit":
            official.append("source-is-not-an-immutable-commit")
        if source.get("dirty") is not False:
            official.append("source-worktree-is-dirty")
        if not isinstance(source.get("tree"), str) or not source["tree"]:
            official.append("source-tree-is-missing")
    if plan.get("publishable") is not True:
        official.append("candidate-is-not-publishable")
    verification = release._verification_journal_blockers(plan, journal)
    return sorted(set(official)), sorted(set(verification))


def _is_forbidden_projection_path(relative: str) -> bool:
    normalized = relative.casefold()
    return normalized in {path.casefold() for path in FORBIDDEN_PROJECTION_PATHS} or any(
        normalized.startswith(prefix.casefold())
        for prefix in FORBIDDEN_PROJECTION_PREFIXES
    )


def _projection(files: Mapping[str, bytes]) -> dict[str, bytes]:
    projected = {
        relative: content
        for relative, content in files.items()
        if not _is_forbidden_projection_path(relative)
    }
    leaked = sorted(path for path in projected if _is_forbidden_projection_path(path))
    if leaked:
        raise M8ConsumerError(f"evaluator projection leaked internal files: {leaked}")
    if "SKILL.md" not in projected:
        raise M8ConsumerError("evaluator projection is missing SKILL.md")
    return projected


def _inventory(files: Mapping[str, bytes]) -> list[dict[str, object]]:
    return [
        {
            "path": relative,
            "size": len(files[relative]),
            "sha256": release.sha256_bytes(files[relative]),
        }
        for relative in sorted(files)
    ]


def _write_projection(root: Path, files: Mapping[str, bytes]) -> None:
    for relative, content in sorted(files.items()):
        safe = release.validate_relative_path(relative)
        target = root.joinpath(*safe.parts)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)


def _collect_projection(root: Path) -> dict[str, bytes]:
    result: dict[str, bytes] = {}
    for path in sorted(root.rglob("*")):
        if _is_link_or_junction(path):
            raise M8ConsumerError("materialized projection contains a link or junction")
        if path.is_file():
            result[path.relative_to(root).as_posix()] = path.read_bytes()
    return result


def _make_read_only(path: Path) -> None:
    if path.is_file():
        path.chmod(stat.S_IREAD | stat.S_IRGRP | stat.S_IROTH)
        return
    for child in sorted(path.rglob("*"), reverse=True):
        if child.is_file():
            child.chmod(stat.S_IREAD | stat.S_IRGRP | stat.S_IROTH)
        elif child.is_dir():
            child.chmod(
                stat.S_IREAD
                | stat.S_IRGRP
                | stat.S_IROTH
                | stat.S_IEXEC
                | stat.S_IXGRP
                | stat.S_IXOTH
            )
    path.chmod(
        stat.S_IREAD
        | stat.S_IRGRP
        | stat.S_IROTH
        | stat.S_IEXEC
        | stat.S_IXGRP
        | stat.S_IXOTH
    )


def _remove_created_output(path: Path) -> None:
    def handle_read_only(_function: object, target: str, _error: object) -> None:
        os.chmod(target, stat.S_IWRITE | stat.S_IREAD | stat.S_IEXEC)
        if os.path.isdir(target):
            os.rmdir(target)
        else:
            os.unlink(target)

    shutil.rmtree(path, onerror=handle_read_only)


def _utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z")


def create_evaluator_workspace(
    *,
    candidate: Path,
    scenario_id: str,
    output: Path,
    rehearsal: bool = False,
    catalog_root: Path | None = None,
    repository_root: Path = release.SKILL_ROOT,
) -> dict[str, object]:
    """Verify a candidate and materialize deterministic evaluator-visible inputs."""

    safe_candidate = _safe_candidate(candidate)
    plan, journal = release.load_candidate(safe_candidate)
    _reject_bound_candidate_links(safe_candidate, plan)
    candidate_files = release.collect_staged_files(safe_candidate)
    release.verify_candidate_files(plan, candidate_files)
    release.verify_artifact_bundle(safe_candidate, plan, candidate_files)
    _validate_candidate_materials(candidate_files)

    official_blockers, verification_blockers = _candidate_gate_blockers(plan, journal)
    if verification_blockers:
        raise M8ConsumerError(
            "candidate verification gate failed: " + ", ".join(verification_blockers)
        )
    if official_blockers and not rehearsal:
        raise M8ConsumerError(
            "official evaluator workspace gate failed: " + ", ".join(official_blockers)
        )

    scenario, request_content = _scenario_inputs(
        scenario_id=scenario_id,
        candidate=safe_candidate,
        candidate_files=candidate_files,
        catalog_root=catalog_root,
    )
    safe_output = _safe_new_output(
        output,
        candidate=safe_candidate,
        repository_root=repository_root,
    )
    bindings = _candidate_bindings(plan)
    fixture_id = str(scenario["supportFixtureId"])
    environment = _fixture_record(candidate_files, fixture_id)
    projected = _projection(candidate_files)
    projection_inventory = _inventory(projected)
    official = not rehearsal
    run_id = f"m8-{scenario_id}-{uuid.uuid4()}"
    if RUN_ID_PATTERN.fullmatch(run_id) is None:
        raise M8ConsumerError("generated M8 run id is invalid")
    manifest: dict[str, object] = {
        "schemaVersion": SCHEMA_VERSION,
        "kind": "personal-ui-m8-evaluator-inputs",
        "official": official,
        "run": {
            "id": run_id,
            "createdAt": _utc_now(),
        },
        "candidate": bindings,
        "scenario": scenario,
        "organizerBindings": {
            "acceptanceRules": {
                "path": ACCEPTANCE_RULES_PATH.as_posix(),
                "size": len(candidate_files[ACCEPTANCE_RULES_PATH.as_posix()]),
                "sha256": release.sha256_bytes(
                    candidate_files[ACCEPTANCE_RULES_PATH.as_posix()]
                ),
            },
        },
        "request": {
            "path": REQUEST_NAME,
            "size": len(request_content),
            "sha256": release.sha256_bytes(request_content),
        },
        "environment": environment,
        "projection": {
            "root": PROJECTION_ROOT.as_posix(),
            "fileCount": len(projected),
            "contentDigest": release.digest_file_map(projected),
            "files": projection_inventory,
            "excluded": sorted(
                [*FORBIDDEN_PROJECTION_PATHS, *FORBIDDEN_PROJECTION_PREFIXES]
            ),
        },
        "inputPolicy": {
            "firstInputsFrozen": True,
            "overwriteAllowed": False,
            "readOnly": True,
            "postWriteVerified": True,
            "commandsExecuted": [],
            "evaluatorStarted": False,
        },
        "bundleLayout": {
            "consumerRoot": CONSUMER_ROOT.as_posix(),
            "evidenceRoot": EVIDENCE_ROOT.as_posix(),
        },
        "acceptanceEvidence": {
            "eligible": official,
            "generated": False,
        },
        "rehearsal": {
            "enabled": rehearsal,
            "waivedOfficialBlockers": official_blockers if rehearsal else [],
        },
    }

    created = False
    try:
        safe_output.mkdir(exist_ok=False)
        created = True
        projection_root = safe_output.joinpath(*PROJECTION_ROOT.parts)
        _write_projection(projection_root, projected)
        (safe_output / REQUEST_NAME).write_bytes(request_content)
        materialized = _collect_projection(projection_root)
        if materialized != projected:
            raise M8ConsumerError("materialized projection differs from the frozen candidate")
        if (safe_output / REQUEST_NAME).read_bytes() != request_content:
            raise M8ConsumerError("materialized request differs from the frozen candidate")
        safe_output.joinpath(*CONSUMER_ROOT.parts).mkdir()
        safe_output.joinpath(*EVIDENCE_ROOT.parts).mkdir()
        (safe_output / MANIFEST_NAME).write_bytes(release.pretty_json_bytes(manifest))
        parsed_manifest = json.loads((safe_output / MANIFEST_NAME).read_text(encoding="utf-8"))
        if parsed_manifest != manifest:
            raise M8ConsumerError("materialized input manifest failed its write verification")
        _make_read_only(projection_root)
        _make_read_only(safe_output / REQUEST_NAME)
        _make_read_only(safe_output / MANIFEST_NAME)
    except Exception:
        if created and safe_output.exists() and not _is_link_or_junction(safe_output):
            try:
                _reject_links_below(safe_output, label="partial output")
            except M8ConsumerError:
                pass
            else:
                _remove_created_output(safe_output)
        raise
    return manifest


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--candidate", type=Path, required=True)
    parser.add_argument("--scenario-id", required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--rehearsal", action="store_true")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    try:
        manifest = create_evaluator_workspace(
            candidate=args.candidate,
            scenario_id=args.scenario_id,
            output=args.output,
            rehearsal=args.rehearsal,
        )
        print(json.dumps(manifest, ensure_ascii=False, indent=2))
        return 0
    except (M8ConsumerError, OSError, release.ReleaseError, ValueError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
