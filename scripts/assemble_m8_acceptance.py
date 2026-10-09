#!/usr/bin/env python3
"""Assemble a file-backed M8 acceptance and local RC review bundle."""

from __future__ import annotations

import argparse
import copy
import hashlib
import io
import json
import os
import re
import shutil
import subprocess
import tempfile
import zipfile
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from typing import Any, Mapping, Sequence

import release_personal_ui as release
import run_m8_migration as migration_runner
import validate_m8_evidence as validator


SCHEMA_VERSION = 1
FRAGMENT_NAME = "quality-fragment.json"
ACCEPTANCE_NAME = "m8-acceptance.json"
QUALITY_RAW_INVENTORY_KIND = "personal-ui-m8-quality-raw-artifact-inventory"
REVIEW_INPUTS_KIND = "personal-ui-m8-review-inputs"
EVALUATOR_COMMAND_ROLES = frozenset(
    {
        "evaluator-command-index",
        "evaluator-command-record",
        "evaluator-command-stdout",
        "evaluator-command-stderr",
    }
)
PLACEHOLDER_PATTERN = re.compile(
    r"(?:\b(?:todo|tbd|fixme)\b|^\s*placeholder\s*$|\[\s*placeholder\s*\]|<\s*(?:fill|replace)[^>]*>|replace\s+me)",
    re.IGNORECASE,
)
SHA256_PATTERN = re.compile(r"^[0-9a-f]{64}$")

MIGRATION_PATHS = {
    "baselineSource": "artifacts/baseline-consumer-source.zip",
    "upgradeDiff": "artifacts/migration-diff.patch",
    "conflictReport": "artifacts/conflict-report.json",
    "rollbackReport": "artifacts/rollback-report.json",
    "finalSource": "artifacts/upgraded-consumer-source.zip",
}

MIGRATION_COMMAND_LABELS = (
    "baseline-installer",
    "baseline-lockfile",
    "baseline-clean-install",
    "install-chromium",
    "node-version",
    "npm-version",
    "playwright-version",
    "baseline-verifier",
    "baseline-build",
    "baseline-workflow",
    "upgrade-dry-run",
    "upgrade-apply",
    "pre-migration-build",
    "post-upgrade-clean-install",
    "post-upgrade-npm-verifier",
    "post-upgrade-strict-verifier",
    "post-upgrade-build",
    "post-upgrade-workflow",
    "modified-owned-file-conflict",
    "injected-failure-rollback",
)


class AssemblyError(RuntimeError):
    """Raised when retained evidence cannot produce an accepted M8 bundle."""


def _json_bytes(value: object) -> bytes:
    return release.pretty_json_bytes(value)


def _sha256(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def _is_link(path: Path) -> bool:
    is_junction = getattr(path, "is_junction", None)
    return path.is_symlink() or bool(is_junction and is_junction())


def _traverses_link(path: Path) -> bool:
    absolute = Path(os.path.abspath(os.fspath(path)))
    current = Path(absolute.anchor)
    for part in absolute.parts[1:]:
        current = current / part
        if _is_link(current):
            return True
        if not current.exists():
            break
    return False


def _safe_relative(value: object, *, label: str) -> PurePosixPath:
    if not isinstance(value, str) or not value or "\\" in value:
        raise AssemblyError(f"{label} must be a non-empty POSIX relative path")
    path = PurePosixPath(value)
    if path.is_absolute() or any(part in {"", ".", ".."} for part in path.parts):
        raise AssemblyError(f"{label} is unsafe: {value!r}")
    return path


def _regular_file(path: Path, *, label: str) -> Path:
    if _traverses_link(path):
        raise AssemblyError(f"{label} must not traverse a link or junction: {path}")
    try:
        resolved = path.resolve(strict=True)
    except OSError as error:
        raise AssemblyError(f"{label} does not exist: {path}") from error
    if not resolved.is_file() or _is_link(resolved):
        raise AssemblyError(f"{label} must be a regular file: {path}")
    return resolved


def _regular_directory(path: Path, *, label: str) -> Path:
    if _traverses_link(path):
        raise AssemblyError(f"{label} must not traverse a link or junction: {path}")
    try:
        resolved = path.resolve(strict=True)
    except OSError as error:
        raise AssemblyError(f"{label} does not exist: {path}") from error
    if not resolved.is_dir() or _is_link(resolved):
        raise AssemblyError(f"{label} must be a regular directory: {path}")
    return resolved


def _within(path: Path, root: Path) -> bool:
    try:
        path.relative_to(root)
        return True
    except ValueError:
        return False


def _read_json(path: Path, *, label: str) -> dict[str, Any]:
    source = _regular_file(path, label=label)
    try:
        value = json.loads(source.read_text(encoding="utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise AssemblyError(f"{label} must contain valid UTF-8 JSON: {error}") from error
    if not isinstance(value, dict):
        raise AssemblyError(f"{label} must contain a JSON object")
    return value


def _write_once(path: Path, content: bytes) -> None:
    if path.exists() or _is_link(path):
        raise AssemblyError(f"refusing to overwrite retained evidence: {path}")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)


def _copy_exact(source: Path, target: Path, *, label: str) -> None:
    source = _regular_file(source, label=label)
    _write_once(target, source.read_bytes())


def _descriptor(bundle_root: Path, path: Path) -> dict[str, object]:
    path = _regular_file(path, label="retained artifact")
    root = bundle_root.resolve(strict=True)
    try:
        relative = path.relative_to(root).as_posix()
    except ValueError as error:
        raise AssemblyError(f"retained artifact is outside the bundle: {path}") from error
    content = path.read_bytes()
    return {"path": relative, "size": len(content), "sha256": _sha256(content)}


def _descriptor_shape(value: object) -> bool:
    return (
        isinstance(value, dict)
        and isinstance(value.get("path"), str)
        and isinstance(value.get("size"), int)
        and not isinstance(value.get("size"), bool)
        and isinstance(value.get("sha256"), str)
        and SHA256_PATTERN.fullmatch(str(value["sha256"])) is not None
    )


def _reject_placeholders(value: object, *, label: str) -> None:
    if isinstance(value, str):
        if PLACEHOLDER_PATTERN.search(value):
            raise AssemblyError(f"{label} contains placeholder text")
        return
    if isinstance(value, list):
        for index, item in enumerate(value):
            _reject_placeholders(item, label=f"{label}[{index}]")
        return
    if isinstance(value, dict):
        for key, item in value.items():
            _reject_placeholders(item, label=f"{label}.{key}")


def _candidate_binding(plan: Mapping[str, object]) -> dict[str, object]:
    try:
        release.validate_rc_release_plan(plan)
    except release.ReleaseError as error:
        raise AssemblyError(f"candidate RC release contract is invalid: {error}") from error
    source = plan.get("source")
    artifacts = plan.get("artifacts")
    archive = artifacts.get("archive") if isinstance(artifacts, dict) else None
    if not isinstance(source, dict) or not isinstance(archive, dict):
        raise AssemblyError("candidate plan lacks source or archive bindings")
    candidate = {
        "version": plan.get("candidateVersion"),
        "planDigest": plan.get("planDigest"),
        "sourceCommit": source.get("commit"),
        "sourceContentDigest": source.get("contentDigest"),
        "sourceDateEpoch": source.get("sourceDateEpoch"),
        "candidateContentDigest": plan.get("candidateContentDigest"),
        "archive": copy.deepcopy(archive),
    }
    probe = {
        "schemaVersion": SCHEMA_VERSION,
        "kind": validator.EVIDENCE_KIND,
        "type": validator.EVIDENCE_TYPE,
        "planDigest": candidate["planDigest"],
        "sourceCommit": candidate["sourceCommit"],
        "archiveSha256": archive.get("sha256"),
        "candidate": candidate,
        "result": "passed",
    }
    errors: list[str] = []
    validator._validate_candidate(probe, errors)
    if errors:
        raise AssemblyError("candidate binding is invalid: " + "; ".join(errors))
    return candidate


def _candidate_summary(candidate: Mapping[str, object]) -> dict[str, object]:
    return validator._candidate_summary(candidate)


def _load_candidate(candidate_path: Path) -> tuple[dict[str, object], dict[str, bytes], dict[str, object]]:
    try:
        plan, files, _ = migration_runner.load_verified_candidate(candidate_path)
    except (migration_runner.MigrationError, release.ReleaseError, OSError, ValueError) as error:
        raise AssemblyError(f"candidate is not an immutable verified M8 candidate: {error}") from error
    expected_commands = [copy.deepcopy(dict(item)) for item in release.DEFAULT_VERIFICATION_COMMANDS]
    if plan.get("verificationCommands") != expected_commands:
        raise AssemblyError("candidate does not use the frozen formal verification command set")
    try:
        _, journal = release.load_candidate(candidate_path)
    except (release.ReleaseError, OSError, ValueError) as error:
        raise AssemblyError(f"candidate verification journal is invalid: {error}") from error
    verify = journal.get("steps", {}).get("verify") if isinstance(journal.get("steps"), dict) else None
    expected_executed = [
        {**copy.deepcopy(command), "exitCode": 0} for command in expected_commands
    ]
    if (
        journal.get("status") != "verified"
        or not isinstance(verify, dict)
        or verify.get("status") != "complete"
        or verify.get("commands") != expected_executed
    ):
        raise AssemblyError("candidate lacks exact successful formal verification evidence")
    candidate = _candidate_binding(plan)
    try:
        frozen_policy = json.loads(files[release.VERSION_PATHS["policy"]].decode("utf-8"))
        frozen_compatibility = json.loads(files[release.VERSION_PATHS["compatibility"]].decode("utf-8"))
    except (KeyError, UnicodeError, json.JSONDecodeError) as error:
        raise AssemblyError(f"candidate frozen release policy is invalid: {error}") from error
    version_policy = plan["versionPolicy"]
    if (
        not isinstance(frozen_policy, dict)
        or frozen_policy.get("schemaVersion") != SCHEMA_VERSION
        or frozen_policy.get("baselineVersion") != version_policy["baselineVersion"]
        or frozen_policy.get("releaseTarget") != version_policy["releaseTarget"]
        or not isinstance(frozen_compatibility, dict)
        or frozen_compatibility.get("classification") != version_policy["classification"]
    ):
        raise AssemblyError("candidate frozen release policy differs from its plan")
    compatibility_policy = frozen_compatibility.get("versionPolicy")
    compatibility_current = frozen_compatibility.get("current")
    if (
        not isinstance(compatibility_policy, dict)
        or compatibility_policy.get("releaseTarget") != version_policy["releaseTarget"]
        or compatibility_policy.get("packageVersion") != candidate["version"]
        or not isinstance(compatibility_current, dict)
        or compatibility_current.get("version") != candidate["version"]
    ):
        raise AssemblyError("candidate frozen release policy differs from its plan")
    return plan, files, candidate


def _artifact_source(root: Path, descriptor: Mapping[str, object], *, label: str) -> Path:
    relative = _safe_relative(descriptor.get("path"), label=f"{label}.path")
    source = _regular_file(root.joinpath(*relative.parts), label=label)
    content = source.read_bytes()
    if descriptor.get("size") != len(content) or descriptor.get("sha256") != _sha256(content):
        raise AssemblyError(f"{label} does not match its retained bytes")
    return source


def _validate_artifact_root(
    root_path: Path,
    fragment_path: Path,
    descriptors: Sequence[Mapping[str, object]],
    *,
    label: str,
) -> Path:
    if not descriptors:
        raise AssemblyError(f"{label} has no retained artifact descriptors")
    root = _regular_directory(root_path, label=f"{label} root")
    fragment_path = _regular_file(fragment_path, label=label)
    if not _within(fragment_path, root):
        raise AssemblyError(f"{label} must be retained inside its explicit root")
    for descriptor in descriptors:
        _artifact_source(root, descriptor, label=f"{label} artifact")
    return root


def _zip_file_map(content: bytes, *, label: str, prefix: str) -> dict[str, bytes]:
    files: dict[str, bytes] = {}
    folded: set[str] = set()
    try:
        with zipfile.ZipFile(io.BytesIO(content), mode="r") as archive:
            for info in archive.infolist():
                if info.is_dir() or info.flag_bits & 0x1:
                    raise AssemblyError(f"{label} contains a directory or encrypted entry")
                archived = _safe_relative(info.filename, label=f"{label} entry")
                if archived.parts[:1] != (prefix,) or len(archived.parts) < 2:
                    raise AssemblyError(f"{label} entry is outside the expected {prefix}/ prefix")
                name = PurePosixPath(*archived.parts[1:]).as_posix()
                if name in files or name.casefold() in folded:
                    raise AssemblyError(f"{label} contains a duplicate path: {name}")
                data = archive.read(info)
                if len(data) != info.file_size:
                    raise AssemblyError(f"{label} entry size is inconsistent: {name}")
                files[name] = data
                folded.add(name.casefold())
    except (zipfile.BadZipFile, RuntimeError, OSError) as error:
        raise AssemblyError(f"{label} is not a valid source ZIP: {error}") from error
    if not files:
        raise AssemblyError(f"{label} contains no source files")
    return files


def _validate_scenario_source_freeze(
    root: Path,
    result_descriptor: Mapping[str, object],
    outer_archive: Mapping[str, object],
    *,
    label: str,
) -> None:
    result_path = _artifact_source(root, result_descriptor, label=f"{label} result")
    result = _read_json(result_path, label=f"{label} result")
    archive_descriptor = result.get("sourceArchive")
    inventory_descriptor = result.get("sourceInventory")
    if not _descriptor_shape(archive_descriptor) or not _descriptor_shape(inventory_descriptor):
        raise AssemblyError(f"{label} result lacks source archive and inventory descriptors")
    assert isinstance(archive_descriptor, dict) and isinstance(inventory_descriptor, dict)
    if archive_descriptor != outer_archive:
        raise AssemblyError(f"{label} source archive differs from the scenario fragment")
    archive_path = _artifact_source(root, archive_descriptor, label=f"{label} source archive")
    inventory_path = _artifact_source(
        root, inventory_descriptor, label=f"{label} source inventory"
    )
    files = _zip_file_map(
        archive_path.read_bytes(), label=f"{label} source archive", prefix=release.ARCHIVE_PREFIX
    )
    inventory = _read_json(inventory_path, label=f"{label} source inventory")
    if (
        inventory.get("schemaVersion") != SCHEMA_VERSION
        or inventory.get("kind") != "personal-ui-m8-source-inventory"
        or inventory.get("contentDigest") != release.digest_file_map(files)
        or inventory.get("files") != release.file_inventory(files)
    ):
        raise AssemblyError(f"{label} source ZIP does not match its official inventory")


class _ScenarioRebaser:
    def __init__(self, source_root: Path, bundle_root: Path, prefix: PurePosixPath):
        self.source_root = source_root
        self.bundle_root = bundle_root
        self.prefix = prefix
        self.memo: dict[str, dict[str, object]] = {}
        self.visiting: set[str] = set()

    def _source(self, relative: PurePosixPath) -> Path:
        source = self.source_root.joinpath(*relative.parts)
        return _regular_file(source, label=f"scenario artifact {relative.as_posix()}")

    def materialize_descriptor(self, value: Mapping[str, object]) -> dict[str, object]:
        relative = _safe_relative(value.get("path"), label="scenario artifact path")
        source = self._source(relative)
        original = source.read_bytes()
        if value.get("size") != len(original) or value.get("sha256") != _sha256(original):
            raise AssemblyError(f"scenario artifact descriptor is stale: {relative.as_posix()}")
        return self.materialize(relative)

    def materialize(self, relative: PurePosixPath) -> dict[str, object]:
        key = relative.as_posix()
        if key in self.memo:
            return copy.deepcopy(self.memo[key])
        if key in self.visiting:
            raise AssemblyError(f"scenario artifact descriptor cycle: {key}")
        self.visiting.add(key)
        source = self._source(relative)
        content = source.read_bytes()
        try:
            document = json.loads(content.decode("utf-8")) if relative.suffix.lower() == ".json" else None
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise AssemblyError(f"scenario JSON artifact is invalid: {key}: {error}") from error
        if isinstance(document, dict) and document.get("kind") == "personal-ui-m8-source-inventory":
            # Entries address ZIP members, not workspace files. Source ZIPs and
            # their inventories are validated together before rebasing.
            pass
        elif document is not None:
            content = _json_bytes(self.transform(document))
        target_relative = self.prefix / relative
        target = self.bundle_root.joinpath(*target_relative.parts)
        _write_once(target, content)
        result = _descriptor(self.bundle_root, target)
        self.memo[key] = result
        self.visiting.remove(key)
        return copy.deepcopy(result)

    def transform(self, value: object) -> object:
        if _descriptor_shape(value):
            assert isinstance(value, dict)
            try:
                relative = _safe_relative(value.get("path"), label="scenario nested artifact path")
                source = self.source_root.joinpath(*relative.parts)
                if source.exists() or _is_link(source):
                    return self.materialize_descriptor(value)
            except AssemblyError:
                raise
            return copy.deepcopy(value)
        if isinstance(value, dict):
            return {key: self.transform(item) for key, item in value.items()}
        if isinstance(value, list):
            return [self.transform(item) for item in value]
        return copy.deepcopy(value)


def _scenario_descriptors(fragment: Mapping[str, object], *, label: str) -> list[Mapping[str, object]]:
    run = fragment.get("run")
    artifacts = run.get("artifacts") if isinstance(run, dict) else None
    if not isinstance(artifacts, dict):
        raise AssemblyError(f"{label}.run.artifacts must be an object")
    descriptors: list[Mapping[str, object]] = []
    for name in validator.M8_RUN_ARTIFACTS:
        descriptor = artifacts.get(name)
        if not _descriptor_shape(descriptor):
            raise AssemblyError(f"{label}.run.artifacts.{name} is incomplete")
        assert isinstance(descriptor, dict)
        descriptors.append(descriptor)
    return descriptors


def _assemble_scenarios(
    scenario_inputs: Sequence[tuple[Path, Path]],
    bundle_root: Path,
    candidate_summary: Mapping[str, object],
) -> list[dict[str, object]]:
    if len(scenario_inputs) != len(validator.M8_SCENARIOS):
        raise AssemblyError(f"exactly {len(validator.M8_SCENARIOS)} scenario fragments are required")
    assembled: dict[str, dict[str, object]] = {}
    for root_path, fragment_path in scenario_inputs:
        fragment = _read_json(fragment_path, label="scenario fragment")
        scenario_id = fragment.get("id")
        if scenario_id not in validator.M8_SCENARIOS or not isinstance(scenario_id, str):
            raise AssemblyError(f"unknown scenario fragment id: {scenario_id!r}")
        if scenario_id in assembled:
            raise AssemblyError(f"duplicate scenario fragment: {scenario_id}")
        if fragment.get("result") != "passed":
            raise AssemblyError(f"scenario fragment is not passed: {scenario_id}")
        run = fragment.get("run")
        if not isinstance(run, dict) or not isinstance(run.get("summary"), str) or not run["summary"].strip():
            raise AssemblyError(f"scenario fragment summary is missing: {scenario_id}")
        _reject_placeholders(
            {"summary": run.get("summary"), "review": run.get("review")},
            label=f"scenario {scenario_id}",
        )
        descriptors = _scenario_descriptors(fragment, label=f"scenario {scenario_id}")
        source_root = _validate_artifact_root(
            root_path,
            fragment_path,
            descriptors,
            label=f"scenario fragment {scenario_id}",
        )
        run_artifacts = run["artifacts"]
        assert isinstance(run_artifacts, dict)
        for stage, result_name, archive_name in (
            ("initial", "first-verification", "initial-source"),
            ("final", "final-verification", "final-source"),
        ):
            result_descriptor = run_artifacts[result_name]
            archive_descriptor = run_artifacts[archive_name]
            assert isinstance(result_descriptor, dict) and isinstance(archive_descriptor, dict)
            _validate_scenario_source_freeze(
                source_root,
                result_descriptor,
                archive_descriptor,
                label=f"scenario {scenario_id} {stage}",
            )
        rebaser = _ScenarioRebaser(
            source_root,
            bundle_root,
            PurePosixPath("scenarios", scenario_id),
        )
        transformed = rebaser.transform(fragment)
        if not isinstance(transformed, dict):
            raise AssemblyError(f"scenario fragment is not an object after rebasing: {scenario_id}")
        retained_fragment = bundle_root / "scenarios" / scenario_id / "scenario-fragment.json"
        _write_once(retained_fragment, _json_bytes(transformed))
        assembled[scenario_id] = transformed
    missing = [scenario_id for scenario_id in validator.M8_SCENARIOS if scenario_id not in assembled]
    if missing:
        raise AssemblyError("missing scenario fragments: " + ", ".join(missing))
    result = [assembled[scenario_id] for scenario_id in validator.M8_SCENARIOS]
    for scenario in result:
        visible = scenario["run"]["artifacts"]["visible-inputs"]  # type: ignore[index]
        visible_path = bundle_root.joinpath(*PurePosixPath(str(visible["path"])).parts)  # type: ignore[index]
        visible_document = _read_json(visible_path, label="rebased visible inputs")
        if visible_document.get("candidate") is None:
            raise AssemblyError("scenario visible inputs lack a candidate binding")
        if validator._candidate_summary(visible_document["candidate"]) != candidate_summary:  # type: ignore[arg-type]
            raise AssemblyError(f"scenario candidate binding mismatch: {scenario['id']}")
    return result


def _migration_command_artifact(
    root: Path,
    relative_value: object,
    *,
    expected_label: str,
    inventory_entries: Mapping[str, Mapping[str, object]],
) -> Path:
    relative = _safe_relative(relative_value, label="migration command path")
    relative_text = relative.as_posix()
    if relative.parts[:2] != ("artifacts", "commands"):
        raise AssemblyError("migration commands must be retained under artifacts/commands/")
    item = inventory_entries.get(relative_text)
    if item is None:
        raise AssemblyError(f"migration command is absent from the official inventory: {relative_text}")
    command_path = _artifact_source(root, item, label=f"migration command {expected_label}")
    command = _read_json(command_path, label=f"migration command {expected_label}")
    return_code = command.get("returnCode")
    expected_code = {
        "modified-owned-file-conflict": 3,
        "injected-failure-rollback": migration_runner.FAILURE_EXIT_CODE,
    }.get(expected_label)
    if (
        command.get("schemaVersion") != SCHEMA_VERSION
        or command.get("kind") != "personal-ui-m8-migration-command"
        or command.get("label") != expected_label
        or not isinstance(command.get("argv"), list)
        or not command["argv"]
        or any(not isinstance(value, str) or not value for value in command["argv"])
        or not isinstance(command.get("cwd"), str)
        or not command["cwd"]
        or not isinstance(return_code, int)
        or isinstance(return_code, bool)
        or (expected_label == "pre-migration-build" and return_code == 0)
        or (expected_label != "pre-migration-build" and expected_code is None and return_code != 0)
        or (expected_code is not None and return_code != expected_code)
    ):
        raise AssemblyError(f"migration command record is not an official {expected_label} result")
    for stream in ("stdout", "stderr"):
        descriptor = command.get(stream)
        if not isinstance(descriptor, dict):
            raise AssemblyError(f"migration command {expected_label} lacks {stream} evidence")
        stream_relative = _safe_relative(
            descriptor.get("path"), label=f"migration command {expected_label} {stream} path"
        )
        stream_item = inventory_entries.get(stream_relative.as_posix())
        if stream_item is None:
            raise AssemblyError(f"migration command {expected_label} {stream} is not inventoried")
        stream_path = _artifact_source(
            root, stream_item, label=f"migration command {expected_label} {stream}"
        )
        if descriptor.get("sha256") != _sha256(stream_path.read_bytes()):
            raise AssemblyError(f"migration command {expected_label} {stream} hash mismatch")
    return command_path


def _validate_migration_source_freeze(
    root: Path, *, archive_relative: str, inventory_relative: str, phase: str
) -> None:
    archive = _regular_file(root.joinpath(*PurePosixPath(archive_relative).parts), label=f"migration {phase} source archive")
    inventory = _read_json(
        root.joinpath(*PurePosixPath(inventory_relative).parts),
        label=f"migration {phase} source inventory",
    )
    files = _zip_file_map(
        archive.read_bytes(),
        label=f"migration {phase} source archive",
        prefix=migration_runner.ARCHIVE_PREFIX,
    )
    if (
        inventory.get("schemaVersion") != SCHEMA_VERSION
        or inventory.get("kind") != "personal-ui-m8-consumer-source-inventory"
        or inventory.get("phase") != phase
        or inventory.get("fileCount") != len(files)
        or inventory.get("contentDigest") != release.digest_file_map(files)
        or inventory.get("files") != release.file_inventory(files)
    ):
        raise AssemblyError(f"migration {phase} source ZIP does not match its official inventory")


def _assemble_migration(
    migration_root: Path,
    bundle_root: Path,
    candidate_summary: Mapping[str, object],
    candidate_files: Mapping[str, bytes],
) -> dict[str, object]:
    root = _regular_directory(migration_root, label="migration bundle")
    inventory_path = root / "artifact-inventory.json"
    try:
        inventory = migration_runner.validate_artifact_inventory(inventory_path)
    except (migration_runner.MigrationError, OSError, ValueError) as error:
        raise AssemblyError(f"migration bundle is invalid: {error}") from error
    report = _read_json(root / "migration-report.json", label="migration report")
    if (
        report.get("schemaVersion") != SCHEMA_VERSION
        or report.get("kind") != migration_runner.REPORT_KIND
        or report.get("result") != "passed"
        or report.get("candidate") != candidate_summary
        or report.get("artifactInventory") != "artifact-inventory.json"
    ):
        raise AssemblyError("migration report is failed or bound to another candidate")
    checks = report.get("checks")
    if not isinstance(checks, dict) or any(
        checks.get(name) != "passed" for name in validator.MIGRATION_REPORT_CHECKS
    ):
        raise AssemblyError("migration report contains a non-passing check")
    items = inventory.get("artifacts")
    if not isinstance(items, list):
        raise AssemblyError("migration artifact inventory is incomplete")
    inventory_entries = {
        str(item["path"]): item
        for item in items
        if isinstance(item, dict) and isinstance(item.get("path"), str)
    }
    candidate_input = _read_json(
        root / "artifacts/candidate-input-inventory.json",
        label="migration candidate input inventory",
    )
    if (
        candidate_input.get("schemaVersion") != SCHEMA_VERSION
        or candidate_input.get("kind") != "personal-ui-m8-migration-candidate-input"
        or candidate_input.get("candidate") != candidate_summary
        or candidate_input.get("fileCount") != len(candidate_files)
        or candidate_input.get("contentDigest") != release.digest_file_map(candidate_files)
        or candidate_input.get("files") != release.file_inventory(candidate_files)
    ):
        raise AssemblyError("migration producer candidate manifest is incomplete or unbound")
    _validate_migration_source_freeze(
        root,
        archive_relative="artifacts/baseline-consumer-source.zip",
        inventory_relative="artifacts/baseline-consumer-source.json",
        phase="before-upgrade",
    )
    _validate_migration_source_freeze(
        root,
        archive_relative="artifacts/upgraded-consumer-source.zip",
        inventory_relative="artifacts/upgraded-consumer-source.json",
        phase="after-upgrade",
    )
    commands = report.get("commands")
    if not isinstance(commands, list) or len(commands) != len(MIGRATION_COMMAND_LABELS):
        raise AssemblyError("migration report does not retain the complete official command sequence")
    command_paths = [
        _migration_command_artifact(
            root,
            relative,
            expected_label=label,
            inventory_entries=inventory_entries,
        )
        for relative, label in zip(commands, MIGRATION_COMMAND_LABELS)
    ]
    destination = bundle_root / "migration"
    for item in items:
        if not isinstance(item, dict):
            raise AssemblyError("migration artifact inventory contains a non-object")
        relative = _safe_relative(item.get("path"), label="migration inventory path")
        _copy_exact(
            root.joinpath(*relative.parts),
            destination.joinpath(*relative.parts),
            label=f"migration artifact {relative.as_posix()}",
        )
    _copy_exact(inventory_path, destination / "artifact-inventory.json", label="migration inventory")
    baseline_verification = command_paths[MIGRATION_COMMAND_LABELS.index("baseline-verifier")]
    final_verification = command_paths[
        MIGRATION_COMMAND_LABELS.index("post-upgrade-strict-verifier")
    ]
    artifact_sources = {
        name: root.joinpath(*PurePosixPath(relative).parts)
        for name, relative in MIGRATION_PATHS.items()
    }
    artifact_sources["baselineVerification"] = baseline_verification
    artifact_sources["finalVerification"] = final_verification
    descriptors: dict[str, dict[str, object]] = {
        "report": _descriptor(bundle_root, destination / "migration-report.json"),
        "inventory": _descriptor(bundle_root, destination / "artifact-inventory.json"),
    }
    for name, source in artifact_sources.items():
        relative = source.resolve(strict=True).relative_to(root).as_posix()
        descriptors[name] = _descriptor(
            bundle_root, destination.joinpath(*PurePosixPath(relative).parts)
        )
    return {
        "result": "passed",
        "fromVersion": "0.2.19",
        "toVersion": candidate_summary["version"],
        "checks": {name: "passed" for name in validator.MIGRATION_CHECKS},
        "artifacts": descriptors,
    }


def _quality_descriptors(fragment: Mapping[str, object]) -> list[Mapping[str, object]]:
    descriptors: list[Mapping[str, object]] = []
    scenarios = fragment.get("scenarios")
    if not isinstance(scenarios, list):
        raise AssemblyError("quality fragment scenarios must be an array")
    for scenario in scenarios:
        descriptor = scenario.get("artifact") if isinstance(scenario, dict) else None
        if not _descriptor_shape(descriptor):
            raise AssemblyError("quality scenario lacks a retained artifact")
        assert isinstance(descriptor, dict)
        descriptors.append(descriptor)
    for container_name, artifact_name in (("realSafari", "artifact"), ("axe", "artifact")):
        container = fragment.get(container_name)
        descriptor = container.get(artifact_name) if isinstance(container, dict) else None
        if not _descriptor_shape(descriptor):
            raise AssemblyError(f"quality fragment {container_name} lacks a retained artifact")
        assert isinstance(descriptor, dict)
        descriptors.append(descriptor)
    artifacts = fragment.get("artifacts")
    if not isinstance(artifacts, dict):
        raise AssemblyError("quality fragment artifacts must be an object")
    for name in validator.QUALITY_ARTIFACTS:
        descriptor = artifacts.get(name)
        if not _descriptor_shape(descriptor):
            raise AssemblyError(f"quality fragment artifacts.{name} is incomplete")
        assert isinstance(descriptor, dict)
        descriptors.append(descriptor)
    raw_evidence = artifacts.get("rawEvidence")
    if not _descriptor_shape(raw_evidence):
        raise AssemblyError("quality fragment artifacts.rawEvidence is incomplete")
    assert isinstance(raw_evidence, dict)
    descriptors.append(raw_evidence)
    return descriptors


def _required_quality_roles() -> set[str]:
    roles = {
        "visible-inputs",
        "scenario-quality-report",
        "evaluator-run-start",
        "evaluator-request",
        "evaluator-final-result",
        "evaluator-final-sourceArchive",
        "evaluator-final-sourceInventory",
        "evaluator-final-verification",
        "browser-version-report",
        *EVALUATOR_COMMAND_ROLES,
    }
    for purpose in ("typecheck", "build", "verifier", "browser-quality"):
        roles.update({f"command-{purpose}-stdout", f"command-{purpose}-stderr"})
    for engine in validator.REQUIRED_ENGINES:
        for width in validator.REQUIRED_WIDTHS:
            roles.update(
                {
                    f"{engine}-{width}-behavior",
                    f"{engine}-{width}-axe",
                    f"{engine}-{width}-responsive",
                    f"{engine}-{width}-screenshot",
                }
            )
    return roles


def _validate_evaluator_command_provenance(
    *,
    scenario_id: str,
    run_id: object,
    role_map: Mapping[str, Sequence[tuple[Mapping[str, object], Path]]],
) -> None:
    index_entries = role_map.get("evaluator-command-index", ())
    if len(index_entries) != 1:
        raise AssemblyError(
            f"quality command index must be unique: {scenario_id}"
        )
    index = _read_json(
        index_entries[0][1], label=f"{scenario_id} evaluator command index"
    )
    descriptors = index.get("commands")
    if (
        index.get("schemaVersion") != SCHEMA_VERSION
        or index.get("kind") != "personal-ui-m8-command-index"
        or index.get("runId") != run_id
        or not isinstance(descriptors, list)
        or not descriptors
    ):
        raise AssemblyError(f"quality command index is incomplete: {scenario_id}")

    def by_source_path(
        role: str,
    ) -> dict[str, tuple[Mapping[str, object], Path]]:
        entries = role_map.get(role, ())
        result: dict[str, tuple[Mapping[str, object], Path]] = {}
        for item, path in entries:
            source_path = item.get("sourcePath")
            if not isinstance(source_path, str) or source_path in result:
                raise AssemblyError(
                    f"quality command raw role is duplicated: {scenario_id}/{role}"
                )
            result[source_path] = (item, path)
        if not result:
            raise AssemblyError(
                f"quality command raw role is missing: {scenario_id}/{role}"
            )
        return result

    record_entries = by_source_path("evaluator-command-record")
    stdout_entries = by_source_path("evaluator-command-stdout")
    stderr_entries = by_source_path("evaluator-command-stderr")
    descriptor_paths: set[str] = set()
    used_stdout: set[str] = set()
    used_stderr: set[str] = set()
    for sequence, descriptor in enumerate(descriptors, start=1):
        if not _descriptor_shape(descriptor):
            raise AssemblyError(
                f"quality command descriptor is invalid: {scenario_id}/{sequence}"
            )
        assert isinstance(descriptor, dict)
        relative = descriptor.get("path")
        if not isinstance(relative, str) or relative in descriptor_paths:
            raise AssemblyError(
                f"quality command descriptor is duplicated: {scenario_id}/{sequence}"
            )
        descriptor_paths.add(relative)
        retained = record_entries.get(relative)
        if retained is None:
            raise AssemblyError(
                f"quality command record is not retained: {scenario_id}/{sequence}"
            )
        raw_item, record_path = retained
        if (
            raw_item.get("size") != descriptor.get("size")
            or raw_item.get("sha256") != descriptor.get("sha256")
        ):
            raise AssemblyError(
                f"quality command descriptor mismatch: {scenario_id}/{sequence}"
            )
        record = _read_json(
            record_path, label=f"{scenario_id} evaluator command {sequence}"
        )
        if (
            record.get("schemaVersion") != SCHEMA_VERSION
            or record.get("kind") != "personal-ui-m8-command"
            or record.get("runId") != run_id
            or record.get("sequence") != sequence
        ):
            raise AssemblyError(
                f"quality command record is incomplete: {scenario_id}/{sequence}"
            )
        for field, entries, used in (
            ("stdout", stdout_entries, used_stdout),
            ("stderr", stderr_entries, used_stderr),
        ):
            value = record.get(field)
            if not _descriptor_shape(value):
                raise AssemblyError(
                    f"quality command {field} descriptor is invalid: "
                    f"{scenario_id}/{sequence}"
                )
            assert isinstance(value, dict)
            output_relative = value.get("path")
            if not isinstance(output_relative, str):
                raise AssemblyError(
                    f"quality command {field} path is invalid: {scenario_id}/{sequence}"
                )
            output = entries.get(output_relative)
            if output is None:
                raise AssemblyError(
                    f"quality command {field} is not retained: {scenario_id}/{sequence}"
                )
            output_item, _ = output
            if (
                output_item.get("size") != value.get("size")
                or output_item.get("sha256") != value.get("sha256")
            ):
                raise AssemblyError(
                    f"quality command {field} mismatch: {scenario_id}/{sequence}"
                )
            used.add(output_relative)

    if set(record_entries) != descriptor_paths:
        raise AssemblyError(f"quality command records are not exact: {scenario_id}")
    if set(stdout_entries) != used_stdout or set(stderr_entries) != used_stderr:
        raise AssemblyError(f"quality command outputs are not exact: {scenario_id}")


def _validate_quality_raw_provenance(
    *,
    fragment: Mapping[str, object],
    source_root: Path,
    items: Sequence[object],
    candidate_summary: Mapping[str, object],
) -> None:
    by_scenario: dict[
        str, dict[str, list[tuple[Mapping[str, object], Path]]]
    ] = {
        scenario_id: {} for scenario_id in validator.M8_SCENARIOS
    }
    required_roles = _required_quality_roles()
    for index, raw_item in enumerate(items):
        if not isinstance(raw_item, dict):
            raise AssemblyError(f"quality raw evidence artifact {index} must be an object")
        scenario_id = raw_item.get("scenarioId")
        roles = raw_item.get("roles")
        source_path_value = raw_item.get("sourcePath")
        if scenario_id not in validator.M8_SCENARIOS or not isinstance(scenario_id, str):
            raise AssemblyError(f"quality raw evidence artifact {index} has an invalid scenarioId")
        if (
            not isinstance(roles, list)
            or not roles
            or any(not isinstance(role, str) or role not in required_roles for role in roles)
            or len(roles) != len(set(roles))
        ):
            raise AssemblyError(f"quality raw evidence artifact {index} has invalid producer roles")
        source_relative = _safe_relative(
            source_path_value, label=f"quality raw evidence artifact {index} sourcePath"
        )
        expected_path = PurePosixPath(
            "quality", "raw", scenario_id, "workspace", *source_relative.parts
        ).as_posix()
        if raw_item.get("path") != expected_path:
            raise AssemblyError(f"quality raw evidence artifact {index} path/sourcePath mismatch")
        source = _artifact_source(
            source_root, raw_item, label=f"quality raw evidence artifact {index}"
        )
        for role in roles:
            by_scenario[scenario_id].setdefault(role, []).append((raw_item, source))

    summaries = fragment.get("scenarios")
    if not isinstance(summaries, list):
        raise AssemblyError("quality fragment scenarios must be an array")
    summary_by_id = {
        str(item.get("id")): item for item in summaries if isinstance(item, dict)
    }
    for scenario_id in validator.M8_SCENARIOS:
        role_map = by_scenario[scenario_id]
        if set(role_map) != required_roles:
            missing = sorted(required_roles - set(role_map))
            extra = sorted(set(role_map) - required_roles)
            raise AssemblyError(
                f"quality raw producer roles are incomplete for {scenario_id} "
                f"(missing={missing[:3]}, extra={extra[:3]})"
            )
        singleton_roles = required_roles - {
            "evaluator-command-record",
            "evaluator-command-stdout",
            "evaluator-command-stderr",
        }
        duplicated = sorted(
            role for role in singleton_roles if len(role_map.get(role, ())) != 1
        )
        if duplicated:
            raise AssemblyError(
                f"quality raw producer role must be unique for {scenario_id}: "
                f"{duplicated[:3]}"
            )

        def single(role: str) -> tuple[Mapping[str, object], Path]:
            return role_map[role][0]

        visible = _read_json(
            single("visible-inputs")[1], label=f"{scenario_id} visible inputs"
        )
        visible_candidate = visible.get("candidate")
        visible_scenario = visible.get("scenario")
        if (
            visible.get("schemaVersion") != SCHEMA_VERSION
            or visible.get("kind") != "personal-ui-m8-evaluator-inputs"
            or visible.get("official") is not True
            or not isinstance(visible_candidate, dict)
            or _candidate_summary(visible_candidate) != candidate_summary
            or not isinstance(visible_scenario, dict)
            or visible_scenario.get("id") != scenario_id
        ):
            raise AssemblyError(f"quality raw visible-inputs manifest is unbound: {scenario_id}")
        visible_run = visible.get("run")
        run_id = visible_run.get("id") if isinstance(visible_run, dict) else None
        _validate_evaluator_command_provenance(
            scenario_id=scenario_id,
            run_id=run_id,
            role_map=role_map,
        )
        final_verification = _read_json(
            single("evaluator-final-verification")[1],
            label=f"{scenario_id} evaluator final verification",
        )
        command_index = _read_json(
            single("evaluator-command-index")[1],
            label=f"{scenario_id} evaluator command index",
        )
        if (
            final_verification.get("schemaVersion") != SCHEMA_VERSION
            or final_verification.get("kind")
            != "personal-ui-m8-quality-verification"
            or final_verification.get("runId") != run_id
            or final_verification.get("candidate") != visible_candidate
            or final_verification.get("result") != "passed"
            or final_verification.get("commands") != command_index.get("commands")
        ):
            raise AssemblyError(
                f"quality final verification is incomplete or unbound: {scenario_id}"
            )
        summary = summary_by_id.get(scenario_id)
        descriptor = summary.get("artifact") if isinstance(summary, dict) else None
        if not isinstance(descriptor, dict):
            raise AssemblyError(f"quality scenario summary is missing: {scenario_id}")
        record_path = _artifact_source(
            source_root, descriptor, label=f"quality scenario record {scenario_id}"
        )
        record = _read_json(record_path, label=f"quality scenario record {scenario_id}")
        if record.get("sourceReportSha256") != single("scenario-quality-report")[0].get("sha256"):
            raise AssemblyError(f"quality scenario report provenance mismatch: {scenario_id}")
        commands = record.get("commands")
        if not isinstance(commands, list) or {item.get("purpose") for item in commands if isinstance(item, dict)} != {
            "typecheck", "build", "verifier", "browser-quality"
        }:
            raise AssemblyError(f"quality command provenance is incomplete: {scenario_id}")
        for command in commands:
            if not isinstance(command, dict):
                raise AssemblyError(f"quality command provenance is invalid: {scenario_id}")
            purpose = str(command["purpose"])
            if (
                command.get("exitCode") != 0
                or command.get("stdoutSha256")
                != single(f"command-{purpose}-stdout")[0].get("sha256")
                or command.get("stderrSha256")
                != single(f"command-{purpose}-stderr")[0].get("sha256")
            ):
                raise AssemblyError(f"quality command raw evidence mismatch: {scenario_id}/{purpose}")
        measurements = record.get("measurements")
        if not isinstance(measurements, list):
            raise AssemblyError(f"quality measurements are missing: {scenario_id}")
        for measurement in measurements:
            if not isinstance(measurement, dict):
                raise AssemblyError(f"quality measurement is invalid: {scenario_id}")
            engine = measurement.get("engine")
            width = measurement.get("width")
            raw = measurement.get("rawArtifactSha256")
            screenshot = measurement.get("screenshot")
            if not isinstance(engine, str) or not isinstance(width, int) or not isinstance(raw, dict):
                raise AssemblyError(f"quality measurement provenance is incomplete: {scenario_id}")
            prefix = f"{engine}-{width}"
            if any(
                raw.get(role) != single(f"{prefix}-{role}")[0].get("sha256")
                for role in ("behavior", "axe", "responsive")
            ) or not isinstance(screenshot, dict) or screenshot.get("sha256") != single(
                f"{prefix}-screenshot"
            )[0].get("sha256"):
                raise AssemblyError(f"quality measurement raw evidence mismatch: {scenario_id}/{prefix}")


def _copy_quality_raw_evidence(
    *,
    fragment: Mapping[str, object],
    source_root: Path,
    bundle_root: Path,
    candidate_summary: Mapping[str, object],
    occupied_paths: set[str],
) -> None:
    artifacts = fragment.get("artifacts")
    raw_descriptor = artifacts.get("rawEvidence") if isinstance(artifacts, dict) else None
    if not isinstance(raw_descriptor, dict):
        raise AssemblyError("quality fragment lacks the raw evidence inventory")
    inventory_path = _artifact_source(
        source_root, raw_descriptor, label="quality raw evidence inventory"
    )
    inventory = _read_json(inventory_path, label="quality raw evidence inventory")
    items = inventory.get("artifacts")
    if (
        inventory.get("schemaVersion") != SCHEMA_VERSION
        or inventory.get("kind") != QUALITY_RAW_INVENTORY_KIND
        or inventory.get("result") != "passed"
        or inventory.get("candidate") != candidate_summary
        or not isinstance(items, list)
        or inventory.get("artifactCount") != (len(items) if isinstance(items, list) else None)
    ):
        raise AssemblyError("quality raw evidence inventory is incomplete or unbound")
    _validate_quality_raw_provenance(
        fragment=fragment,
        source_root=source_root,
        items=items,
        candidate_summary=candidate_summary,
    )
    seen: set[str] = set()
    for index, item in enumerate(items):
        if not _descriptor_shape(item):
            raise AssemblyError(f"quality raw evidence artifact {index} is incomplete")
        assert isinstance(item, dict)
        relative = _safe_relative(item.get("path"), label="quality raw evidence path")
        if relative.parts[:2] != ("quality", "raw"):
            raise AssemblyError("quality raw evidence artifacts must be rooted under quality/raw/")
        relative_text = relative.as_posix()
        if relative_text in seen or relative_text in occupied_paths:
            raise AssemblyError(f"duplicate quality artifact: {relative_text}")
        seen.add(relative_text)
        source = _artifact_source(
            source_root, item, label=f"quality raw evidence artifact {relative_text}"
        )
        _copy_exact(
            source,
            bundle_root.joinpath(*relative.parts),
            label=f"quality raw evidence artifact {relative_text}",
        )
    raw_root = source_root / "quality" / "raw"
    if not raw_root.is_dir() or _traverses_link(raw_root):
        raise AssemblyError("quality raw evidence directory is missing or linked")
    actual: set[str] = set()
    for path in raw_root.rglob("*"):
        if path.is_dir():
            if _is_link(path):
                raise AssemblyError(f"quality raw evidence contains a linked directory: {path}")
            continue
        if _traverses_link(path) or not path.is_file():
            raise AssemblyError(f"quality raw evidence contains a linked or special file: {path}")
        actual.add(path.relative_to(source_root).as_posix())
    if actual != seen:
        missing = sorted(actual - seen)
        extra = sorted(seen - actual)
        raise AssemblyError(
            "quality raw evidence inventory does not exactly cover quality/raw/ "
            f"(unlisted={missing[:3]}, missing={extra[:3]})"
        )


def _assemble_quality(
    quality_bundle: Path, bundle_root: Path, candidate_summary: Mapping[str, object]
) -> dict[str, object]:
    supplied = quality_bundle
    fragment_path = supplied if supplied.is_file() else supplied / FRAGMENT_NAME
    fragment = _read_json(fragment_path, label="quality fragment")
    if fragment.get("result") != "passed" or fragment.get("candidate") != candidate_summary:
        raise AssemblyError("quality fragment is failed or bound to another candidate")
    descriptors = _quality_descriptors(fragment)
    root = _validate_artifact_root(
        supplied if supplied.is_dir() else supplied.parent,
        fragment_path,
        descriptors,
        label="quality fragment",
    )
    seen: set[str] = set()
    for descriptor in descriptors:
        relative = _safe_relative(descriptor.get("path"), label="quality artifact path")
        if relative.parts[:1] != ("quality",):
            raise AssemblyError("quality artifacts must be rooted under quality/")
        if relative.as_posix() in seen:
            raise AssemblyError(f"duplicate quality artifact: {relative.as_posix()}")
        seen.add(relative.as_posix())
        source = _artifact_source(root, descriptor, label="quality artifact")
        _copy_exact(
            source,
            bundle_root.joinpath(*relative.parts),
            label=f"quality artifact {relative.as_posix()}",
        )
    _copy_quality_raw_evidence(
        fragment=fragment,
        source_root=root,
        bundle_root=bundle_root,
        candidate_summary=candidate_summary,
        occupied_paths=seen,
    )
    _copy_exact(
        fragment_path,
        bundle_root / "quality" / FRAGMENT_NAME,
        label="quality fragment",
    )
    return fragment


def _timestamp_from_epoch(candidate: Mapping[str, object]) -> str:
    epoch = candidate.get("sourceDateEpoch")
    if not isinstance(epoch, int) or epoch < 0:
        raise AssemblyError("candidate source date epoch is invalid")
    return datetime.fromtimestamp(epoch, timezone.utc).isoformat().replace("+00:00", "Z")


def _command_argv(value: object, *, label: str) -> list[str]:
    if (
        not isinstance(value, list)
        or not value
        or any(not isinstance(item, str) or not item.strip() for item in value)
    ):
        raise AssemblyError(f"{label} must contain executable argv")
    _reject_placeholders(value, label=label)
    return [str(item) for item in value]


def _load_review_inputs(
    path: Path,
    *,
    candidate_summary: Mapping[str, object],
    scenarios: Sequence[Mapping[str, object]],
) -> dict[str, object]:
    value = _read_json(path, label="M8 review inputs")
    limitations = value.get("knownLimitations")
    previews = value.get("previews")
    if (
        value.get("schemaVersion") != SCHEMA_VERSION
        or value.get("kind") != REVIEW_INPUTS_KIND
        or value.get("candidate") != candidate_summary
        or not isinstance(limitations, list)
        or not isinstance(previews, list)
    ):
        raise AssemblyError("M8 review inputs are incomplete or bound to another candidate")
    limitation_ids: set[str] = set()
    for index, limitation in enumerate(limitations):
        if not isinstance(limitation, dict):
            raise AssemblyError(f"known limitation {index} must be an object")
        identifier = limitation.get("id")
        summary = limitation.get("summary")
        status = limitation.get("status")
        evidence = limitation.get("evidence")
        if (
            not isinstance(identifier, str)
            or not identifier.strip()
            or identifier in limitation_ids
            or not isinstance(summary, str)
            or not summary.strip()
            or status not in {"open", "accepted"}
            or not isinstance(evidence, list)
            or any(not isinstance(item, str) or not item.strip() for item in evidence)
        ):
            raise AssemblyError(f"known limitation {index} is incomplete")
        _reject_placeholders(limitation, label=f"known limitation {identifier}")
        limitation_ids.add(identifier)
    scenario_by_id = {str(item["id"]): item for item in scenarios}
    preview_by_id: dict[str, dict[str, object]] = {}
    for index, preview in enumerate(previews):
        if not isinstance(preview, dict):
            raise AssemblyError(f"preview input {index} must be an object")
        scenario_id = preview.get("id")
        if scenario_id not in scenario_by_id or not isinstance(scenario_id, str) or scenario_id in preview_by_id:
            raise AssemblyError(f"preview input {index} has an invalid or duplicate scenario id")
        run = scenario_by_id[scenario_id].get("run")
        artifacts = run.get("artifacts") if isinstance(run, dict) else None
        final_source = artifacts.get("final-source") if isinstance(artifacts, dict) else None
        if (
            not isinstance(final_source, dict)
            or preview.get("sourceArchiveSha256") != final_source.get("sha256")
        ):
            raise AssemblyError(f"preview input source archive mismatch: {scenario_id}")
        _command_argv(preview.get("installArgv"), label=f"{scenario_id} preview installArgv")
        _command_argv(preview.get("startArgv"), label=f"{scenario_id} preview startArgv")
        preview_by_id[scenario_id] = preview
    if set(preview_by_id) != set(validator.M8_SCENARIOS):
        raise AssemblyError("review inputs must provide one preview command set per M8 scenario")
    return value


def _definition_of_done(candidate_files: Mapping[str, bytes]) -> list[dict[str, object]]:
    try:
        coverage = json.loads(candidate_files["assets/react-kit/component-coverage.json"].decode("utf-8"))
    except (KeyError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise AssemblyError("candidate coverage matrix cannot support the Global DoD report") from error
    summary = coverage.get("summary") if isinstance(coverage, dict) else None
    classifications = summary.get("classificationCounts") if isinstance(summary, dict) else None
    evidence = summary.get("evidenceCounts") if isinstance(summary, dict) else None
    exports = coverage.get("exports") if isinstance(coverage, dict) else None
    if (
        not isinstance(summary, dict)
        or summary.get("exportCount") != 142
        or not isinstance(classifications, dict)
        or classifications.get("non-visual") != 5
        or not isinstance(evidence, dict)
        or evidence.get("api") != 142
        or evidence.get("example") != 142
        or not isinstance(exports, list)
        or len(exports) != 142
    ):
        raise AssemblyError("candidate coverage matrix does not satisfy the frozen export DoD")
    return [
        {"id": "runtime-exports", "status": "passed", "evidence": ["review/component-coverage.json: 142 classified exports", "review/component-api.md"]},
        {"id": "examples-and-usage-docs", "status": "passed", "evidence": ["candidate component-coverage.json: 142/142 example ownership, including 137 visual and 5 non-visual exports"]},
        {"id": "interactive-keyboard-and-a11y-ownership", "status": "passed", "evidence": ["candidate component-coverage.json keyboard and a11y ownership"]},
        {"id": "maintained-example-axe", "status": "passed", "evidence": ["quality/axe.json: zero critical and serious findings"]},
        {"id": "typescript-verifier-policy", "status": "passed", "evidence": ["frozen candidate formal release:check", "six final consumer verifier results"]},
        {"id": "forms-modals-widgets-themes-portals", "status": "passed", "evidence": ["frozen candidate formal release:check", "quality scenario behavior evidence"]},
        {"id": "three-engines-six-widths", "status": "passed", "evidence": ["quality/matrix.json", "quality/browserVersions.json", "quality/responsiveReview.json"]},
        {"id": "clean-clone-and-release-reproduction", "status": "separate-release-evidence", "evidence": ["local formal verification passed; exact hosted clean-clone evidence is validated separately by the publication gate"]},
        {"id": "source-license-release-identity", "status": "pending-publication", "evidence": ["candidate changelog, MIT license, archive and SHA256SUMS retained; immutable tag and GitHub Release are M8-06 actions"]},
        {"id": "user-review-and-authorization", "status": "pending-explicit-authorization", "evidence": ["local RC bundle is review material and does not itself grant publication authorization"]},
    ]


def _review_materials(
    *,
    candidate_path: Path,
    candidate_files: Mapping[str, bytes],
    candidate: Mapping[str, object],
    scenarios: Sequence[Mapping[str, object]],
    quality: Mapping[str, object],
    review_inputs_path: Path,
    bundle_root: Path,
) -> dict[str, object]:
    review_root = bundle_root / "review"
    archive = candidate["archive"]
    assert isinstance(archive, dict)
    archive_relative = _safe_relative(archive.get("path"), label="candidate archive path")
    archive_name = archive_relative.name
    candidate_archive = review_root / archive_name
    _copy_exact(
        candidate_path.joinpath(*archive_relative.parts),
        candidate_archive,
        label="candidate archive",
    )
    artifacts = release.load_candidate(candidate_path)[0].get("artifacts")
    checksums_meta = artifacts.get("checksums") if isinstance(artifacts, dict) else None
    if not isinstance(checksums_meta, dict):
        raise AssemblyError("candidate plan lacks SHA256SUMS metadata")
    checksums_relative = _safe_relative(
        checksums_meta.get("path"), label="candidate SHA256SUMS path"
    )
    checksums = review_root / "SHA256SUMS"
    _copy_exact(
        candidate_path.joinpath(*checksums_relative.parts),
        checksums,
        label="candidate SHA256SUMS",
    )

    copied_candidate_files: dict[str, Path] = {}
    for artifact_name, candidate_relative in validator.CANDIDATE_REVIEW_FILES.items():
        content = candidate_files.get(candidate_relative)
        if content is None:
            raise AssemblyError(f"candidate lacks review material: {candidate_relative}")
        destination_name = PurePosixPath(candidate_relative).name
        destination = review_root / destination_name
        _write_once(destination, content)
        copied_candidate_files[artifact_name] = destination

    for artifact_name, candidate_relative, destination_name in (
        ("componentCoverage", "assets/react-kit/component-coverage.json", "component-coverage.json"),
        ("componentApi", "references/component-api.md", "component-api.md"),
    ):
        content = candidate_files.get(candidate_relative)
        if content is None:
            raise AssemblyError(f"candidate lacks review material: {candidate_relative}")
        destination = review_root / destination_name
        _write_once(destination, content)
        copied_candidate_files[artifact_name] = destination

    summary = _candidate_summary(candidate)
    review_inputs = _load_review_inputs(
        review_inputs_path,
        candidate_summary=summary,
        scenarios=scenarios,
    )
    retained_review_inputs = review_root / "review-inputs.json"
    _copy_exact(review_inputs_path, retained_review_inputs, label="M8 review inputs")
    generated_at = _timestamp_from_epoch(candidate)
    scenario_rows: list[dict[str, object]] = []
    for scenario in scenarios:
        run = scenario["run"]
        assert isinstance(run, dict)
        scenario_rows.append(
            {
                "id": scenario["id"],
                "result": scenario["result"],
                "runId": run.get("runId"),
                "summary": run.get("summary"),
                "firstResult": run.get("firstResult"),
                "review": run.get("review"),
                "repairCount": len(run.get("repairs", [])) if isinstance(run.get("repairs"), list) else None,
                "finalResult": run.get("finalResult"),
                "checks": run.get("checks"),
            }
        )
    independent_report = {
        "schemaVersion": SCHEMA_VERSION,
        "kind": "personal-ui-m8-independent-consumer-report",
        "result": "passed",
        "generatedAt": generated_at,
        "candidate": summary,
        "scenarios": list(validator.M8_SCENARIOS),
        "runs": scenario_rows,
        "completionStatus": "pending-publication-prerequisites",
        "definitionOfDone": _definition_of_done(candidate_files),
    }
    report_path = review_root / "independent-consumer-report.json"
    _write_once(report_path, _json_bytes(independent_report))

    limitation_entries = review_inputs["knownLimitations"]
    assert isinstance(limitation_entries, list)
    limitation_lines = [
        "# Known limitations",
        "",
        "This file is generated from the retained review input, not inferred from passing summaries.",
        "",
    ]
    if limitation_entries:
        for limitation in limitation_entries:
            assert isinstance(limitation, dict)
            limitation_lines.extend(
                [
                    f"## {limitation['id']}",
                    "",
                    f"Status: `{limitation['status']}`",
                    "",
                    str(limitation["summary"]),
                    "",
                    *[f"- Evidence: `{item}`" for item in limitation["evidence"]],
                    "",
                ]
            )
    else:
        limitation_lines.extend(["No product limitation was declared in the retained review input.", ""])
    limitations = "\n".join(limitation_lines).rstrip() + "\n"
    limitations_path = review_root / "known-limitations.md"
    _write_once(limitations_path, limitations.encode("utf-8"))

    preview_by_id = {
        str(item["id"]): item
        for item in review_inputs["previews"]  # type: ignore[index]
        if isinstance(item, dict)
    }
    preview_lines = [
        "# Preview instructions",
        "",
        "Run these commands from the acceptance bundle root in PowerShell.",
        "Each command set is bound to the retained final source archive hash in review-inputs.json.",
        "",
    ]
    for scenario in scenarios:
        scenario_id = str(scenario["id"])
        run = scenario["run"]
        assert isinstance(run, dict)
        artifacts_map = run.get("artifacts")
        environment = run.get("environment")
        final_source = artifacts_map.get("final-source") if isinstance(artifacts_map, dict) else None
        preview = preview_by_id[scenario_id]
        assert isinstance(final_source, dict)
        source_path = str(final_source["path"])
        destination = f"preview/{scenario_id}"
        install = _command_argv(preview["installArgv"], label=f"{scenario_id} installArgv")
        start = _command_argv(preview["startArgv"], label=f"{scenario_id} startArgv")
        preview_lines.extend(
            [
                f"## {scenario_id}",
                "",
                "```powershell",
                subprocess.list2cmdline(["python", "-m", "zipfile", "-e", source_path, destination]),
                f"Set-Location {subprocess.list2cmdline([destination + '/' + release.ARCHIVE_PREFIX])}",
                subprocess.list2cmdline(install),
                subprocess.list2cmdline(start),
                "```",
                "",
            ]
        )
    preview_path = review_root / "preview-instructions.md"
    _write_once(preview_path, ("\n".join(preview_lines).rstrip() + "\n").encode("utf-8"))

    checklist = {
        "schemaVersion": SCHEMA_VERSION,
        "kind": "personal-ui-m8-release-checklist",
        "result": "passed",
        "generatedAt": generated_at,
        "candidate": summary,
        "checks": ["candidate", "migration", "quality", "review"],
        "details": [
            {"id": "candidate", "status": "passed", "evidence": archive_name},
            {"id": "migration", "status": "passed", "evidence": "migration/migration-report.json"},
            {"id": "quality", "status": "passed", "evidence": "quality/quality-fragment.json"},
            {"id": "review", "status": "passed", "evidence": "review/independent-consumer-report.json"},
        ],
        "externalActions": [
            {
                "id": "public-release",
                "status": "requires-explicit-authorization",
                "includes": ["immutable tag", "GitHub Release", "public reinstall", "installed-copy synchronization"],
            }
        ],
    }
    checklist_path = review_root / "release-checklist.json"
    _write_once(checklist_path, _json_bytes(checklist))

    result = {
        "candidateArchive": _descriptor(bundle_root, candidate_archive),
        "checksums": _descriptor(bundle_root, checksums),
        **{
            name: _descriptor(bundle_root, path)
            for name, path in copied_candidate_files.items()
        },
        "independentConsumerReport": _descriptor(bundle_root, report_path),
        "knownLimitations": _descriptor(bundle_root, limitations_path),
        "previewInstructions": _descriptor(bundle_root, preview_path),
        "releaseChecklist": _descriptor(bundle_root, checklist_path),
        "reviewInputs": _descriptor(bundle_root, retained_review_inputs),
    }
    return {"result": "passed", "artifacts": result}


def _validate_new_output(output: Path, occupied: Sequence[tuple[Path, str]]) -> Path:
    if str(output).strip() in {"", "."}:
        raise AssemblyError("output must be an explicit new directory")
    absolute = Path(os.path.abspath(os.fspath(output)))
    if _traverses_link(absolute.parent):
        raise AssemblyError("output parent must not traverse a link or junction")
    if absolute.exists() or _is_link(absolute):
        raise AssemblyError(f"output already exists: {absolute}")
    for path, label in occupied:
        resolved = path.resolve(strict=True)
        if absolute == resolved or absolute in resolved.parents or resolved in absolute.parents:
            raise AssemblyError(f"output must not overlap the {label}")
    return absolute


def assemble(
    *,
    candidate_path: Path,
    scenario_inputs: Sequence[tuple[Path, Path]],
    migration_bundle: Path,
    quality_bundle: Path,
    review_inputs: Path,
    output: Path,
) -> dict[str, object]:
    candidate_path = _regular_directory(candidate_path, label="candidate")
    plan, candidate_files, candidate = _load_candidate(candidate_path)
    candidate_summary = _candidate_summary(candidate)
    scenario_roots: list[Path] = []
    for root_path, fragment_path in scenario_inputs:
        fragment = _read_json(fragment_path, label="scenario fragment")
        scenario_id = fragment.get("id")
        descriptors = _scenario_descriptors(
            fragment, label=f"scenario {scenario_id if isinstance(scenario_id, str) else 'unknown'}"
        )
        scenario_roots.append(
            _validate_artifact_root(
                root_path, fragment_path, descriptors, label="scenario fragment"
            )
        )
    quality_fragment_path = (
        quality_bundle if quality_bundle.is_file() else quality_bundle / FRAGMENT_NAME
    )
    quality_fragment = _read_json(quality_fragment_path, label="quality fragment")
    quality_root = _validate_artifact_root(
        quality_bundle if quality_bundle.is_dir() else quality_bundle.parent,
        quality_fragment_path,
        _quality_descriptors(quality_fragment),
        label="quality fragment",
    )
    occupied = [
        (release.SKILL_ROOT.resolve(strict=True), "repository"),
        (candidate_path, "candidate"),
        (_regular_directory(migration_bundle, label="migration bundle"), "migration bundle"),
        *((root, "scenario workspace") for root in scenario_roots),
        (quality_root, "quality bundle"),
    ]
    output = _validate_new_output(output, occupied)
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = Path(tempfile.mkdtemp(prefix=f".{output.name}-", dir=output.parent))
    try:
        scenarios = _assemble_scenarios(scenario_inputs, temporary, candidate_summary)
        migration = _assemble_migration(
            migration_bundle, temporary, candidate_summary, candidate_files
        )
        quality = _assemble_quality(quality_bundle, temporary, candidate_summary)
        review = _review_materials(
            candidate_path=candidate_path,
            candidate_files=candidate_files,
            candidate=candidate,
            scenarios=scenarios,
            quality=quality,
            review_inputs_path=review_inputs,
            bundle_root=temporary,
        )
        archive = candidate["archive"]
        assert isinstance(archive, dict)
        evidence = {
            "schemaVersion": SCHEMA_VERSION,
            "kind": validator.EVIDENCE_KIND,
            "type": validator.EVIDENCE_TYPE,
            "planDigest": candidate["planDigest"],
            "sourceCommit": candidate["sourceCommit"],
            "archiveSha256": archive["sha256"],
            "candidate": candidate,
            "result": "passed",
            "scenarios": scenarios,
            "migration": migration,
            "qualityMatrix": quality,
            "reviewBundle": review,
        }
        evidence_path = temporary / ACCEPTANCE_NAME
        _write_once(evidence_path, _json_bytes(evidence))
        expected = {
            "planDigest": candidate["planDigest"],
            "sourceCommit": candidate["sourceCommit"],
            "archiveSha256": archive["sha256"],
        }
        result = validator.validate_m8_evidence_file(
            evidence_path,
            expected_bindings=expected,
            bundle_root=temporary,
        )
        if not result.accepted:
            raise AssemblyError(
                "strict M8 validation rejected the assembled bundle: " + "; ".join(result.errors)
            )
        temporary.replace(output)
        return {
            "schemaVersion": SCHEMA_VERSION,
            "kind": "personal-ui-m8-acceptance-assembly",
            "result": "passed",
            "bundle": str(output),
            "evidence": str(output / ACCEPTANCE_NAME),
            "candidate": candidate_summary,
            "planDigest": plan["planDigest"],
        }
    except Exception:
        shutil.rmtree(temporary, ignore_errors=True)
        raise


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--candidate", type=Path, required=True)
    parser.add_argument(
        "--scenario-root",
        type=Path,
        action="append",
        required=True,
        help="Explicit evaluator workspace root; repeat exactly six times in fragment order.",
    )
    parser.add_argument(
        "--scenario-fragment",
        type=Path,
        action="append",
        required=True,
        help="Repeat exactly six times, once for each official scenario fragment.",
    )
    parser.add_argument("--migration-bundle", type=Path, required=True)
    parser.add_argument("--quality-bundle", type=Path, required=True)
    parser.add_argument("--review-inputs", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    if len(args.scenario_root) != len(args.scenario_fragment):
        print(
            "error: --scenario-root and --scenario-fragment must be supplied in pairs",
            file=os.sys.stderr,
        )
        return 2
    try:
        result = assemble(
            candidate_path=args.candidate,
            scenario_inputs=list(zip(args.scenario_root, args.scenario_fragment)),
            migration_bundle=args.migration_bundle,
            quality_bundle=args.quality_bundle,
            review_inputs=args.review_inputs,
            output=args.output,
        )
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    except (AssemblyError, OSError, ValueError, release.ReleaseError) as error:
        print(f"error: {error}", file=os.sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
