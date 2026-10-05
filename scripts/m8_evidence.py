#!/usr/bin/env python3
"""Create append-only records for one isolated M8 consumer run."""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import stat
import sys
from pathlib import Path, PurePosixPath
from typing import Any, Mapping, Sequence

import release_personal_ui as release
import run_m8_consumer as consumer


SCHEMA_VERSION = 1
RESULTS = frozenset({"passed", "failed", "blocked"})
CHECK_RESULTS = frozenset({"passed", "failed", "blocked", "not-run"})
CHECKS = ("typecheck", "build", "verifier", "behavior", "a11y", "responsive")
QUALITY_PURPOSES = ("typecheck", "build", "verifier", "browser-quality")
QUALITY_REPORT_KIND = "personal-ui-m8-scenario-quality-report"
QUALITY_VERIFICATION_KIND = "personal-ui-m8-quality-verification"
QUALITY_VERIFICATION_PATH = PurePosixPath("evidence/quality-verification.json")
ATTRIBUTIONS = frozenset(
    {
        "none",
        "skill-routing",
        "api-clarity",
        "component-defect",
        "installer-defect",
        "consumer-omission",
        "evaluation-infrastructure",
        "external-environment",
    }
)
ACTUAL_ENVIRONMENT_FIELDS = (
    "operatingSystem",
    "architecture",
    "node",
    "packageManager",
    "browser",
    "python",
    "installerCommand",
)
FROZEN_SOURCE_EXCLUDES = frozenset(
    {
        ".git",
        ".next",
        ".vite",
        "coverage",
        "dist",
        "node_modules",
        "playwright-report",
        "test-results",
    }
)
SAFE_ID = re.compile(r"[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}")


class M8EvidenceError(RuntimeError):
    """Raised when append-only M8 evidence cannot be recorded safely."""


def utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z")


def _is_link(path: Path) -> bool:
    if path.is_symlink():
        return True
    is_junction = getattr(path, "is_junction", None)
    return bool(is_junction and is_junction())


def _within(path: Path, root: Path) -> bool:
    try:
        path.relative_to(root)
        return True
    except ValueError:
        return False


def _safe_existing(path: Path, root: Path, *, label: str, directory: bool = False) -> Path:
    root = root.resolve(strict=True)
    if any(part == ".." for part in path.parts):
        raise M8EvidenceError(f"{label} must not contain parent traversal")
    lexical = Path(os.path.abspath(os.fspath(path)))
    if not _within(lexical, root):
        raise M8EvidenceError(f"{label} must stay inside the evaluator workspace")
    current = root
    for part in lexical.relative_to(root).parts:
        current = current / part
        if _is_link(current):
            raise M8EvidenceError(f"{label} must not traverse a link or junction")
    absolute = path.resolve(strict=True)
    if not _within(absolute, root):
        raise M8EvidenceError(f"{label} must stay inside the evaluator workspace")
    current = root
    for part in absolute.relative_to(root).parts:
        current = current / part
        if _is_link(current):
            raise M8EvidenceError(f"{label} must not traverse a link or junction")
    if directory and not absolute.is_dir():
        raise M8EvidenceError(f"{label} must be a directory")
    if not directory and not absolute.is_file():
        raise M8EvidenceError(f"{label} must be a regular file")
    return absolute


def _workspace(path: Path) -> tuple[Path, dict[str, Any]]:
    root = path.resolve(strict=True)
    if _is_link(root) or not root.is_dir():
        raise M8EvidenceError("workspace must be a real directory")
    manifest_path = _safe_existing(root / consumer.MANIFEST_NAME, root, label="input manifest")
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise M8EvidenceError("input manifest is invalid") from error
    if (
        not isinstance(manifest, dict)
        or manifest.get("schemaVersion") != consumer.SCHEMA_VERSION
        or manifest.get("kind") != "personal-ui-m8-evaluator-inputs"
    ):
        raise M8EvidenceError("input manifest schema or kind is unsupported")
    run = manifest.get("run")
    if (
        not isinstance(run, dict)
        or not isinstance(run.get("id"), str)
        or consumer.RUN_ID_PATTERN.fullmatch(run["id"]) is None
    ):
        raise M8EvidenceError("input manifest run id is invalid")
    evidence_root = root.joinpath(*consumer.EVIDENCE_ROOT.parts)
    consumer_root = root.joinpath(*consumer.CONSUMER_ROOT.parts)
    if not evidence_root.is_dir() or not consumer_root.is_dir():
        raise M8EvidenceError("workspace bundle layout is incomplete")
    return root, manifest


def _relative(root: Path, path: Path) -> str:
    return path.resolve(strict=True).relative_to(root.resolve(strict=True)).as_posix()


def descriptor(root: Path, path: Path) -> dict[str, object]:
    safe = _safe_existing(path, root, label="evidence artifact")
    content = safe.read_bytes()
    return {
        "path": _relative(root, safe),
        "size": len(content),
        "sha256": release.sha256_bytes(content),
    }


def _make_file_read_only(path: Path) -> None:
    path.chmod(stat.S_IREAD | stat.S_IRGRP | stat.S_IROTH)


def _write_once(path: Path, content: bytes, root: Path) -> None:
    workspace_root = root.resolve(strict=True)
    absolute = Path(os.path.abspath(os.fspath(path)))
    try:
        relative_parent = absolute.parent.relative_to(workspace_root)
    except ValueError as error:
        raise M8EvidenceError("append-only record must stay inside the evaluator workspace") from error
    current = workspace_root
    for part in relative_parent.parts:
        current = current / part
        if _is_link(current):
            raise M8EvidenceError("append-only record parent must not traverse a link or junction")
        if current.exists() and not current.is_dir():
            raise M8EvidenceError("append-only record parent must be a directory")
    if path.exists() or path.is_symlink():
        raise M8EvidenceError(f"append-only record already exists: {path.name}")
    path.parent.mkdir(parents=True, exist_ok=True)
    current = workspace_root
    for part in relative_parent.parts:
        current = current / part
        if _is_link(current):
            raise M8EvidenceError("append-only record parent must not traverse a link or junction")
    with path.open("xb") as handle:
        handle.write(content)
    if path.read_bytes() != content:
        raise M8EvidenceError(f"append-only record failed write verification: {path.name}")
    _make_file_read_only(path)


def _write_once_json(path: Path, value: Mapping[str, object], root: Path) -> None:
    _write_once(path, release.pretty_json_bytes(value), root)


def _copy_once(source: Path, target: Path, root: Path) -> dict[str, object]:
    safe = _safe_existing(source, root, label="source evidence artifact")
    _write_once(target, safe.read_bytes(), root)
    return descriptor(root, target)


def _validate_timestamp(value: object, *, label: str) -> str:
    if not isinstance(value, str) or not value:
        raise M8EvidenceError(f"{label} must be an ISO-8601 timestamp")
    try:
        parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise M8EvidenceError(f"{label} must be an ISO-8601 timestamp") from error
    if parsed.tzinfo is None:
        raise M8EvidenceError(f"{label} must include a timezone")
    return value


def _timestamp(value: object, *, label: str) -> dt.datetime:
    validated = _validate_timestamp(value, label=label)
    return dt.datetime.fromisoformat(validated.replace("Z", "+00:00"))


def _json_record(path: Path, *, label: str) -> dict[str, object]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise M8EvidenceError(f"{label} must be valid UTF-8 JSON") from error
    if not isinstance(value, dict):
        raise M8EvidenceError(f"{label} must be an object")
    return value


def _validate_environment(value: object) -> dict[str, str]:
    if not isinstance(value, dict):
        raise M8EvidenceError("actual environment must be an object")
    result: dict[str, str] = {}
    for field in ACTUAL_ENVIRONMENT_FIELDS:
        item = value.get(field)
        if not isinstance(item, str) or not item.strip():
            raise M8EvidenceError(f"actual environment {field} must be non-empty")
        result[field] = item.strip()
    return result


def start_run(
    workspace: Path,
    *,
    evaluator_id: str,
    actual_environment: Mapping[str, object],
    started_at: str | None = None,
) -> dict[str, object]:
    root, manifest = _workspace(workspace)
    if not SAFE_ID.fullmatch(evaluator_id):
        raise M8EvidenceError("evaluator id is invalid")
    if manifest.get("official") is not True:
        raise M8EvidenceError("rehearsal workspaces cannot produce acceptance evidence")
    acceptance = manifest.get("acceptanceEvidence")
    if not isinstance(acceptance, dict) or acceptance.get("eligible") is not True:
        raise M8EvidenceError("workspace is not eligible for acceptance evidence")
    run = manifest["run"]
    scenario = manifest.get("scenario")
    environment = manifest.get("environment")
    if not isinstance(run, dict) or not isinstance(scenario, dict) or not isinstance(environment, dict):
        raise M8EvidenceError("workspace manifest is incomplete")
    record: dict[str, object] = {
        "schemaVersion": SCHEMA_VERSION,
        "kind": "personal-ui-m8-run-start",
        "runId": run["id"],
        "scenarioId": scenario.get("id"),
        "evaluatorId": evaluator_id,
        "startedAt": _validate_timestamp(started_at or utc_now(), label="startedAt"),
        "candidate": manifest.get("candidate"),
        "fixtureId": scenario.get("supportFixtureId"),
        "declaredEnvironment": environment.get("declared"),
        "actualEnvironment": _validate_environment(actual_environment),
        "visibleInputs": descriptor(root, root / consumer.MANIFEST_NAME),
        "request": descriptor(root, root / consumer.REQUEST_NAME),
    }
    target = root / "evidence" / "run-start.json"
    _write_once_json(target, record, root)
    return record


def record_command(
    workspace: Path,
    *,
    argv: Sequence[str],
    cwd: str,
    exit_code: int,
    stdout: Path,
    stderr: Path,
    started_at: str,
    ended_at: str,
) -> dict[str, object]:
    root, manifest = _workspace(workspace)
    start_path = root / "evidence" / "run-start.json"
    if not start_path.is_file():
        raise M8EvidenceError("run-start must be frozen before command records")
    if (root / QUALITY_VERIFICATION_PATH.as_posix()).exists():
        raise M8EvidenceError(
            "command records cannot change after quality verification is frozen"
        )
    initial_path = root / "evidence" / "initial" / "result.json"
    if initial_path.is_file():
        initial = _json_record(initial_path, label="initial result")
        if initial.get("result") == "passed":
            raise M8EvidenceError(
                "command records cannot change after a passed initial result"
            )
        if not (root / "evidence" / "review" / "review.json").is_file():
            raise M8EvidenceError(
                "organizer review must be frozen before post-initial command records"
            )
    if not argv or any(not isinstance(value, str) or not value for value in argv):
        raise M8EvidenceError("command argv must contain non-empty strings")
    if not isinstance(exit_code, int):
        raise M8EvidenceError("command exit code must be an integer")
    relative_cwd = PurePosixPath(cwd)
    if relative_cwd.is_absolute() or any(part in {"", ".", ".."} for part in relative_cwd.parts):
        raise M8EvidenceError("command cwd must be a safe workspace-relative path")
    commands_root = root / "evidence" / "commands"
    existing = sorted(commands_root.glob("*.json")) if commands_root.exists() else []
    sequence = len(existing) + 1
    if existing and existing[-1].stem != f"{sequence - 1:04d}":
        raise M8EvidenceError("command records are not a contiguous append-only sequence")
    run = manifest["run"]
    command_started = _timestamp(started_at, label="command startedAt")
    command_ended = _timestamp(ended_at, label="command endedAt")
    if command_ended < command_started:
        raise M8EvidenceError("command endedAt must not precede startedAt")
    run_start = _json_record(start_path, label="run-start")
    if command_started < _timestamp(run_start.get("startedAt"), label="run startedAt"):
        raise M8EvidenceError("command startedAt must not precede the evaluator run")
    review_path = root / "evidence" / "review" / "review.json"
    if initial_path.is_file() and review_path.is_file():
        review = _json_record(review_path, label="organizer review")
        if command_started < _timestamp(review.get("reviewedAt"), label="reviewedAt"):
            raise M8EvidenceError(
                "post-initial command startedAt must not precede organizer review"
            )
    record: dict[str, object] = {
        "schemaVersion": SCHEMA_VERSION,
        "kind": "personal-ui-m8-command",
        "runId": run["id"],
        "sequence": sequence,
        "argv": list(argv),
        "cwd": relative_cwd.as_posix(),
        "exitCode": exit_code,
        "startedAt": started_at,
        "endedAt": ended_at,
        "stdout": descriptor(root, stdout),
        "stderr": descriptor(root, stderr),
    }
    target = commands_root / f"{sequence:04d}.json"
    _write_once_json(target, record, root)
    _make_file_read_only(_safe_existing(stdout, root, label="command stdout"))
    _make_file_read_only(_safe_existing(stderr, root, label="command stderr"))
    return record


def _quality_command_projection(value: Mapping[str, object]) -> dict[str, object]:
    return {
        field: value.get(field)
        for field in (
            "argv",
            "cwd",
            "exitCode",
            "startedAt",
            "endedAt",
            "stdout",
            "stderr",
        )
    }


def _recorded_command_materials(
    root: Path, run_id: object
) -> tuple[list[dict[str, object]], list[dict[str, object]]]:
    command_root = root / "evidence" / "commands"
    command_paths = sorted(command_root.glob("*.json")) if command_root.exists() else []
    if not command_paths:
        raise M8EvidenceError("quality verification requires recorded commands")
    records: list[dict[str, object]] = []
    descriptors: list[dict[str, object]] = []
    for sequence, path in enumerate(command_paths, start=1):
        if path.stem != f"{sequence:04d}":
            raise M8EvidenceError(
                "command records are not a contiguous append-only sequence"
            )
        try:
            record = json.loads(path.read_text(encoding="utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise M8EvidenceError(f"command record {sequence} is invalid") from error
        if (
            not isinstance(record, dict)
            or record.get("schemaVersion") != SCHEMA_VERSION
            or record.get("kind") != "personal-ui-m8-command"
            or record.get("runId") != run_id
            or record.get("sequence") != sequence
        ):
            raise M8EvidenceError(f"command record {sequence} is incomplete or unbound")
        records.append(record)
        descriptors.append(descriptor(root, path))
    return records, descriptors


def _validated_quality_report(
    root: Path,
    manifest: Mapping[str, object],
    scenario_report: Path,
) -> tuple[Path, dict[str, object], list[dict[str, object]], list[dict[str, object]]]:
    report_input = (
        scenario_report
        if scenario_report.is_absolute()
        else root.joinpath(*scenario_report.parts)
    )
    report_path = _safe_existing(
        report_input,
        root,
        label="scenario quality report",
    )
    report = _json_record(report_path, label="scenario quality report")
    run = manifest.get("run")
    scenario = manifest.get("scenario")
    run_id = run.get("id") if isinstance(run, dict) else None
    scenario_id = scenario.get("id") if isinstance(scenario, dict) else None
    if (
        report.get("schemaVersion") != SCHEMA_VERSION
        or report.get("kind") != QUALITY_REPORT_KIND
        or report.get("result") != "passed"
        or report.get("runId") != run_id
        or report.get("scenarioId") != scenario_id
        or report.get("candidate") != manifest.get("candidate")
    ):
        raise M8EvidenceError(
            "scenario quality report is incomplete or bound to another evaluator run"
        )

    report_commands = report.get("commands")
    if (
        not isinstance(report_commands, list)
        or [
            item.get("purpose") if isinstance(item, dict) else None
            for item in report_commands
        ]
        != list(QUALITY_PURPOSES)
    ):
        raise M8EvidenceError(
            "scenario quality report must contain the four producer commands in order"
        )

    command_records, command_descriptors = _recorded_command_materials(root, run_id)
    matched_sequences: set[int] = set()
    for report_command in report_commands:
        assert isinstance(report_command, dict)
        if report_command.get("exitCode") != 0:
            raise M8EvidenceError("passed quality report contains a failed command")
        projection = _quality_command_projection(report_command)
        matches = [
            int(record["sequence"])
            for record in command_records
            if _quality_command_projection(record) == projection
        ]
        if len(matches) != 1 or matches[0] in matched_sequences:
            raise M8EvidenceError(
                "each producer command must match one distinct recorded command"
            )
        matched_sequences.add(matches[0])
    return report_path, report, command_records, command_descriptors


def build_quality_verification(
    workspace: Path,
    *,
    scenario_report: Path,
) -> dict[str, object]:
    """Bind a passed producer report to the append-only evaluator commands."""

    root, manifest = _workspace(workspace)
    if not (root / "evidence" / "run-start.json").is_file():
        raise M8EvidenceError("run-start must be frozen before quality verification")
    if not (root / "evidence" / "review" / "review.json").is_file():
        raise M8EvidenceError("organizer review must be frozen before quality verification")
    if (root / "evidence" / "final" / "result.json").exists():
        raise M8EvidenceError("final result is already frozen")

    report_path, _, _, command_descriptors = _validated_quality_report(
        root,
        manifest,
        scenario_report,
    )
    run = manifest.get("run")
    run_id = run.get("id") if isinstance(run, dict) else None
    initial = _json_record(
        root / "evidence" / "initial" / "result.json",
        label="initial result",
    )
    if initial.get("result") == "passed":
        initial_verification = initial.get("verification")
        report_descriptor = descriptor(root, report_path)
        if (
            not isinstance(initial_verification, dict)
            or initial_verification.get("size") != report_descriptor["size"]
            or initial_verification.get("sha256") != report_descriptor["sha256"]
        ):
            raise M8EvidenceError(
                "a passed first result must reuse its original scenario quality report"
            )

    verification: dict[str, object] = {
        "schemaVersion": SCHEMA_VERSION,
        "kind": QUALITY_VERIFICATION_KIND,
        "runId": run_id,
        "candidate": manifest.get("candidate"),
        "result": "passed",
        "checks": {name: "passed" for name in CHECKS},
        "commands": command_descriptors,
        "scenarioReport": descriptor(root, report_path),
    }
    target = root.joinpath(*QUALITY_VERIFICATION_PATH.parts)
    _write_once_json(target, verification, root)
    return verification


def _validate_quality_verification_record(
    root: Path,
    manifest: Mapping[str, object],
    verification_path: Path,
    verification: Mapping[str, object],
) -> None:
    expected_path = root.joinpath(*QUALITY_VERIFICATION_PATH.parts).resolve(strict=True)
    if verification_path != expected_path:
        raise M8EvidenceError(
            "a passed final result must use the generated quality verification"
        )
    run = manifest.get("run")
    run_id = run.get("id") if isinstance(run, dict) else None
    _, command_descriptors = _recorded_command_materials(root, run_id)
    report_descriptor = verification.get("scenarioReport")
    if not isinstance(report_descriptor, dict):
        raise M8EvidenceError("quality verification lacks its scenario report binding")
    report_relative = PurePosixPath(str(report_descriptor.get("path", "")))
    if (
        report_relative.is_absolute()
        or any(part in {"", ".", ".."} for part in report_relative.parts)
    ):
        raise M8EvidenceError("quality verification scenario report path is unsafe")
    report_path = _safe_existing(
        root.joinpath(*report_relative.parts),
        root,
        label="quality verification scenario report",
    )
    if descriptor(root, report_path) != report_descriptor:
        raise M8EvidenceError("quality verification scenario report binding is stale")
    checks = verification.get("checks")
    if (
        verification.get("schemaVersion") != SCHEMA_VERSION
        or verification.get("kind") != QUALITY_VERIFICATION_KIND
        or verification.get("runId") != run_id
        or verification.get("candidate") != manifest.get("candidate")
        or verification.get("result") != "passed"
        or checks != {name: "passed" for name in CHECKS}
        or verification.get("commands") != command_descriptors
    ):
        raise M8EvidenceError(
            "generated quality verification is incomplete, stale, or unbound"
        )


def _source_files(source: Path) -> dict[str, bytes]:
    files: dict[str, bytes] = {}
    for directory, directory_names, file_names in os.walk(source, followlinks=False):
        parent = Path(directory)
        directory_names[:] = sorted(
            name for name in directory_names if name not in FROZEN_SOURCE_EXCLUDES
        )
        for name in [*directory_names, *file_names]:
            child = parent / name
            if _is_link(child):
                raise M8EvidenceError("consumer source contains a link or junction")
        for name in sorted(file_names):
            child = parent / name
            relative = child.relative_to(source).as_posix()
            if any(part in FROZEN_SOURCE_EXCLUDES for part in PurePosixPath(relative).parts):
                continue
            if not child.is_file():
                raise M8EvidenceError(f"consumer source contains a special file: {relative}")
            files[relative] = child.read_bytes()
    if not files:
        raise M8EvidenceError("consumer source snapshot must not be empty")
    return files


def _checks(value: Mapping[str, object], *, result: str) -> dict[str, str]:
    normalized: dict[str, str] = {}
    for name in CHECKS:
        status = value.get(name)
        if status not in CHECK_RESULTS:
            raise M8EvidenceError(f"check {name} has an invalid status")
        normalized[name] = str(status)
    statuses = set(normalized.values())
    if result == "passed" and statuses != {"passed"}:
        raise M8EvidenceError("a passed result requires every check to pass")
    if result in {"failed", "blocked"} and statuses == {"passed"}:
        raise M8EvidenceError(f"a {result} result requires at least one non-passing check")
    return normalized


def _freeze_source(
    root: Path,
    source: Path,
    target: Path,
    *,
    epoch: int,
) -> tuple[dict[str, object], dict[str, object]]:
    safe_source = _safe_existing(source, root, label="consumer source", directory=True)
    consumer_root = (root / consumer.CONSUMER_ROOT.as_posix()).resolve(strict=True)
    if not _within(safe_source, consumer_root):
        raise M8EvidenceError("consumer source must be under the declared consumer root")
    files = _source_files(safe_source)
    archive = release.deterministic_zip_bytes(files, epoch=epoch)
    archive_path = target / "source.zip"
    inventory_path = target / "source-inventory.json"
    _write_once(archive_path, archive, root)
    _write_once_json(
        inventory_path,
        {
            "schemaVersion": SCHEMA_VERSION,
            "kind": "personal-ui-m8-source-inventory",
            "contentDigest": release.digest_file_map(files),
            "files": release.file_inventory(files),
        },
        root,
    )
    return descriptor(root, archive_path), descriptor(root, inventory_path)


def freeze_result(
    workspace: Path,
    *,
    stage: str,
    result: str,
    source: Path,
    verification: Path,
    checks: Mapping[str, object],
    frozen_at: str | None = None,
) -> dict[str, object]:
    if stage not in {"initial", "final"}:
        raise M8EvidenceError("result stage must be initial or final")
    if result not in RESULTS:
        raise M8EvidenceError("result must be passed, failed, or blocked")
    root, manifest = _workspace(workspace)
    normalized_checks = _checks(checks, result=result)
    frozen_timestamp = _validate_timestamp(frozen_at or utc_now(), label="frozenAt")
    frozen_time = _timestamp(frozen_timestamp, label="frozenAt")
    start_path = root / "evidence" / "run-start.json"
    if not start_path.is_file():
        raise M8EvidenceError("run-start must be frozen before results")
    run_start = _json_record(start_path, label="run-start")
    if frozen_time < _timestamp(run_start.get("startedAt"), label="run startedAt"):
        raise M8EvidenceError("result frozenAt must not precede the evaluator run")
    verification_path = _safe_existing(
        verification, root, label=f"{stage} verification"
    )
    try:
        verification_record = json.loads(verification_path.read_text(encoding="utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise M8EvidenceError(f"{stage} verification must be valid UTF-8 JSON") from error
    if not isinstance(verification_record, dict) or verification_record.get("result") != result:
        raise M8EvidenceError(f"{stage} verification result does not match {result}")
    if stage == "initial" and result == "passed":
        _validated_quality_report(root, manifest, verification_path)
    if stage == "final" and result == "passed":
        _validate_quality_verification_record(
            root,
            manifest,
            verification_path,
            verification_record,
        )
    command_records, _ = _recorded_command_materials(root, manifest["run"]["id"])
    if any(
        _timestamp(record.get("endedAt"), label="command endedAt") > frozen_time
        for record in command_records
    ):
        raise M8EvidenceError("result frozenAt must not precede recorded commands")
    review_path = root / "evidence" / "review" / "review.json"
    if stage == "final":
        if not review_path.is_file():
            raise M8EvidenceError("organizer review must be frozen before the final result")
        review = _json_record(review_path, label="organizer review")
        if frozen_time < _timestamp(review.get("reviewedAt"), label="reviewedAt"):
            raise M8EvidenceError("final frozenAt must not precede organizer review")
    target = root / "evidence" / stage
    candidate = manifest.get("candidate")
    epoch = candidate.get("sourceDateEpoch") if isinstance(candidate, dict) else None
    if not isinstance(epoch, int) or epoch < 0:
        raise M8EvidenceError("workspace candidate source date epoch is invalid")
    source_archive, source_inventory = _freeze_source(
        root,
        source,
        target,
        epoch=epoch,
    )
    verification_copy = _copy_once(
        verification,
        target / "verification.json",
        root,
    )
    run = manifest["run"]
    record: dict[str, object] = {
        "schemaVersion": SCHEMA_VERSION,
        "kind": f"personal-ui-m8-{stage}-result",
        "runId": run["id"],
        "result": result,
        "frozenAt": frozen_timestamp,
        "checks": normalized_checks,
        "sourceArchive": source_archive,
        "sourceInventory": source_inventory,
        "verification": verification_copy,
    }
    _write_once_json(target / "result.json", record, root)
    if stage == "final":
        _freeze_indexes(root, str(run["id"]))
    return record


def record_review(
    workspace: Path,
    *,
    rules: Path,
    result: str,
    attribution: str,
    observations: Sequence[str],
    reviewed_at: str | None = None,
) -> dict[str, object]:
    if result not in RESULTS:
        raise M8EvidenceError("review result is invalid")
    if attribution not in ATTRIBUTIONS:
        raise M8EvidenceError("review attribution is invalid")
    if result != "passed" and attribution == "none":
        raise M8EvidenceError("a failed or blocked review requires a primary attribution")
    if not observations or any(not isinstance(item, str) or not item.strip() for item in observations):
        raise M8EvidenceError("review observations must contain non-empty text")
    root, manifest = _workspace(workspace)
    if not (root / "evidence" / "initial" / "result.json").is_file():
        raise M8EvidenceError("initial result must be frozen before organizer review")
    rules_path = rules.resolve(strict=True)
    if _is_link(rules_path) or not rules_path.is_file():
        raise M8EvidenceError("acceptance rules must be a regular file")
    rules_content = rules_path.read_bytes()
    organizer = manifest.get("organizerBindings")
    frozen_rules = organizer.get("acceptanceRules") if isinstance(organizer, dict) else None
    if (
        not isinstance(frozen_rules, dict)
        or frozen_rules.get("size") != len(rules_content)
        or frozen_rules.get("sha256") != release.sha256_bytes(rules_content)
    ):
        raise M8EvidenceError("acceptance rules differ from the frozen candidate")
    reviewed_timestamp = _validate_timestamp(reviewed_at or utc_now(), label="reviewedAt")
    initial = _json_record(
        root / "evidence" / "initial" / "result.json",
        label="initial result",
    )
    if _timestamp(reviewed_timestamp, label="reviewedAt") < _timestamp(
        initial.get("frozenAt"), label="initial frozenAt"
    ):
        raise M8EvidenceError("reviewedAt must not precede the initial result")
    review_root = root / "evidence" / "review"
    _write_once(review_root / "acceptance-rules.json", rules_content, root)
    run = manifest["run"]
    record: dict[str, object] = {
        "schemaVersion": SCHEMA_VERSION,
        "kind": "personal-ui-m8-organizer-review",
        "runId": run["id"],
        "result": result,
        "attribution": attribution,
        "reviewedAt": reviewed_timestamp,
        "observations": list(observations),
        "acceptanceRules": descriptor(root, review_root / "acceptance-rules.json"),
        "initialResult": descriptor(root, root / "evidence" / "initial" / "result.json"),
    }
    _write_once_json(review_root / "review.json", record, root)
    return record


def record_repair(
    workspace: Path,
    *,
    attribution: str,
    reason: str,
    changed_files: Sequence[str],
    candidate_changed: bool,
    diff: Path,
    verification: Path,
    recorded_at: str | None = None,
) -> dict[str, object]:
    if attribution == "none" or attribution not in ATTRIBUTIONS:
        raise M8EvidenceError("repair attribution must identify a primary cause")
    if not reason.strip() or not changed_files:
        raise M8EvidenceError("repair reason and changed files are required")
    if any(not isinstance(item, str) or not item.strip() for item in changed_files):
        raise M8EvidenceError("repair changed files must be non-empty strings")
    root, manifest = _workspace(workspace)
    if not (root / "evidence" / "review" / "review.json").is_file():
        raise M8EvidenceError("organizer review must be frozen before repairs")
    repairs_root = root / "evidence" / "repairs"
    existing = sorted(path for path in repairs_root.glob("[0-9][0-9][0-9][0-9]") if path.is_dir()) if repairs_root.exists() else []
    sequence = len(existing) + 1
    if existing and existing[-1].name != f"{sequence - 1:04d}":
        raise M8EvidenceError("repair records are not a contiguous append-only sequence")
    recorded_timestamp = _validate_timestamp(recorded_at or utc_now(), label="recordedAt")
    review = _json_record(
        root / "evidence" / "review" / "review.json",
        label="organizer review",
    )
    if _timestamp(recorded_timestamp, label="recordedAt") < _timestamp(
        review.get("reviewedAt"), label="reviewedAt"
    ):
        raise M8EvidenceError("repair recordedAt must not precede organizer review")
    target = repairs_root / f"{sequence:04d}"
    diff_copy = _copy_once(diff, target / "changes.diff", root)
    verification_copy = _copy_once(verification, target / "verification.json", root)
    run = manifest["run"]
    record: dict[str, object] = {
        "schemaVersion": SCHEMA_VERSION,
        "kind": "personal-ui-m8-repair",
        "runId": run["id"],
        "sequence": sequence,
        "recordedAt": recorded_timestamp,
        "attribution": attribution,
        "reason": reason,
        "changedFiles": list(changed_files),
        "candidateChanged": candidate_changed,
        "diff": diff_copy,
        "verification": verification_copy,
    }
    _write_once_json(target / "record.json", record, root)
    return record


def _freeze_indexes(root: Path, run_id: str) -> None:
    _, command_descriptors = _recorded_command_materials(root, run_id)
    repairs = sorted((root / "evidence" / "repairs").glob("*/record.json"))
    _write_once_json(
        root / "evidence" / "command-index.json",
        {
            "schemaVersion": SCHEMA_VERSION,
            "kind": "personal-ui-m8-command-index",
            "runId": run_id,
            "commands": command_descriptors,
        },
        root,
    )
    _write_once_json(
        root / "evidence" / "repair-trace.json",
        {
            "schemaVersion": SCHEMA_VERSION,
            "kind": "personal-ui-m8-repair-trace",
            "runId": run_id,
            "repairs": [descriptor(root, path) for path in repairs],
        },
        root,
    )


def scenario_fragment(workspace: Path, *, summary: str) -> dict[str, object]:
    if not summary.strip():
        raise M8EvidenceError("scenario summary must be non-empty")
    root, manifest = _workspace(workspace)
    paths = {
        "run-start": root / "evidence" / "run-start.json",
        "initial": root / "evidence" / "initial" / "result.json",
        "review": root / "evidence" / "review" / "review.json",
        "final": root / "evidence" / "final" / "result.json",
        "commands": root / "evidence" / "command-index.json",
        "repairs": root / "evidence" / "repair-trace.json",
    }
    records: dict[str, dict[str, Any]] = {}
    for name, path in paths.items():
        safe = _safe_existing(path, root, label=f"{name} record")
        try:
            value = json.loads(safe.read_text(encoding="utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise M8EvidenceError(f"{name} record is invalid") from error
        if not isinstance(value, dict):
            raise M8EvidenceError(f"{name} record must be an object")
        records[name] = value
    run = manifest["run"]
    run_id = str(run["id"])
    if any(record.get("runId") != run_id for record in records.values()):
        raise M8EvidenceError("scenario records do not share the workspace run id")
    final = records["final"]
    review = records["review"]
    start = records["run-start"]
    initial = records["initial"]
    repairs = records["repairs"].get("repairs")
    commands = records["commands"].get("commands")
    if not isinstance(repairs, list) or not isinstance(commands, list) or not commands:
        raise M8EvidenceError("scenario must retain commands and a repair trace")
    scenario = manifest.get("scenario")
    if not isinstance(scenario, dict):
        raise M8EvidenceError("scenario manifest is invalid")
    return {
        "id": scenario.get("id"),
        "result": final.get("result"),
        "run": {
            "runId": run_id,
            "summary": summary,
            "freshContext": True,
            "forbiddenInputsAbsent": True,
            "attribution": review.get("attribution"),
            "startedAt": start.get("startedAt"),
            "endedAt": final.get("frozenAt"),
            "environment": {
                "fixtureId": start.get("fixtureId"),
                "actual": start.get("actualEnvironment"),
            },
            "commands": commands,
            "firstResult": {
                "status": initial.get("result"),
                "frozenAt": initial.get("frozenAt"),
            },
            "review": {
                "status": review.get("result"),
                "reviewedAt": review.get("reviewedAt"),
                "observations": review.get("observations"),
            },
            "repairs": repairs,
            "finalResult": {
                "status": final.get("result"),
                "frozenAt": final.get("frozenAt"),
            },
            "artifacts": {
                "request": descriptor(root, root / consumer.REQUEST_NAME),
                "visible-inputs": descriptor(root, root / consumer.MANIFEST_NAME),
                "run-start": descriptor(root, paths["run-start"]),
                "initial-source": initial.get("sourceArchive"),
                "first-verification": descriptor(root, paths["initial"]),
                "command-index": descriptor(root, paths["commands"]),
                "organizer-review": descriptor(root, paths["review"]),
                "repair-trace": descriptor(root, paths["repairs"]),
                "final-source": final.get("sourceArchive"),
                "final-verification": descriptor(root, paths["final"]),
            },
            "checks": final.get("checks"),
        },
    }


def _load_json_argument(path: Path, *, label: str) -> dict[str, object]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise M8EvidenceError(f"unable to read {label}") from error
    if not isinstance(value, dict):
        raise M8EvidenceError(f"{label} must be an object")
    return value


def _workspace_argument(workspace: Path, value: object) -> Path:
    path = Path(str(value))
    return path if path.is_absolute() else workspace / path


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)
    start = subparsers.add_parser("start")
    start.add_argument("--workspace", type=Path, required=True)
    start.add_argument("--evaluator-id", required=True)
    start.add_argument("--actual-environment", type=Path, required=True)
    command = subparsers.add_parser("record-command")
    command.add_argument("--workspace", type=Path, required=True)
    command.add_argument("--record", type=Path, required=True)
    quality_verification = subparsers.add_parser("build-quality-verification")
    quality_verification.add_argument("--workspace", type=Path, required=True)
    quality_verification.add_argument("--scenario-report", type=Path, required=True)
    for stage in ("initial", "final"):
        freeze = subparsers.add_parser(f"freeze-{stage}")
        freeze.add_argument("--workspace", type=Path, required=True)
        freeze.add_argument("--source", type=Path, required=True)
        freeze.add_argument("--verification", type=Path, required=True)
        freeze.add_argument("--checks", type=Path, required=True)
        freeze.add_argument("--result", choices=sorted(RESULTS), required=True)
        freeze.add_argument("--frozen-at")
    review = subparsers.add_parser("record-review")
    review.add_argument("--workspace", type=Path, required=True)
    review.add_argument("--rules", type=Path, required=True)
    review.add_argument("--result", choices=sorted(RESULTS), required=True)
    review.add_argument("--attribution", choices=sorted(ATTRIBUTIONS), required=True)
    review.add_argument("--observation", action="append", required=True)
    review.add_argument("--reviewed-at")
    repair = subparsers.add_parser("record-repair")
    repair.add_argument("--workspace", type=Path, required=True)
    repair.add_argument("--attribution", choices=sorted(ATTRIBUTIONS - {"none"}), required=True)
    repair.add_argument("--reason", required=True)
    repair.add_argument("--changed-file", action="append", required=True)
    repair.add_argument("--candidate-changed", action="store_true")
    repair.add_argument("--diff", type=Path, required=True)
    repair.add_argument("--verification", type=Path, required=True)
    repair.add_argument("--recorded-at")
    fragment = subparsers.add_parser("scenario-fragment")
    fragment.add_argument("--workspace", type=Path, required=True)
    fragment.add_argument("--summary", required=True)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    try:
        if args.command == "start":
            value = start_run(
                args.workspace,
                evaluator_id=args.evaluator_id,
                actual_environment=_load_json_argument(
                    args.actual_environment,
                    label="actual environment",
                ),
            )
        elif args.command == "record-command":
            record = _load_json_argument(args.record, label="command record")
            value = record_command(
                args.workspace,
                argv=record.get("argv", []),
                cwd=str(record.get("cwd", "")),
                exit_code=record.get("exitCode"),
                stdout=_workspace_argument(args.workspace, record.get("stdout", "")),
                stderr=_workspace_argument(args.workspace, record.get("stderr", "")),
                started_at=str(record.get("startedAt", "")),
                ended_at=str(record.get("endedAt", "")),
            )
        elif args.command == "build-quality-verification":
            value = build_quality_verification(
                args.workspace,
                scenario_report=args.scenario_report,
            )
        elif args.command in {"freeze-initial", "freeze-final"}:
            value = freeze_result(
                args.workspace,
                stage=args.command.removeprefix("freeze-"),
                result=args.result,
                source=args.source,
                verification=args.verification,
                checks=_load_json_argument(args.checks, label="checks"),
                frozen_at=args.frozen_at,
            )
        elif args.command == "record-review":
            value = record_review(
                args.workspace,
                rules=args.rules,
                result=args.result,
                attribution=args.attribution,
                observations=args.observation,
                reviewed_at=args.reviewed_at,
            )
        elif args.command == "record-repair":
            value = record_repair(
                args.workspace,
                attribution=args.attribution,
                reason=args.reason,
                changed_files=args.changed_file,
                candidate_changed=args.candidate_changed,
                diff=args.diff,
                verification=args.verification,
                recorded_at=args.recorded_at,
            )
        else:
            value = scenario_fragment(args.workspace, summary=args.summary)
        print(json.dumps(value, ensure_ascii=False, indent=2))
        return 0
    except (M8EvidenceError, OSError, ValueError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
