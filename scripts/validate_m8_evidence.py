#!/usr/bin/env python3
"""Validate a complete, file-backed M8 acceptance evidence bundle."""

from __future__ import annotations

import argparse
import dataclasses
import datetime as dt
import hashlib
import io
import json
import os
import re
import sys
import zipfile
from pathlib import Path, PurePosixPath
from typing import Any, Mapping, Sequence


SCHEMA_VERSION = 1
EVIDENCE_KIND = "personal-ui-release-evidence"
EVIDENCE_TYPE = "m8-acceptance"
M8_SCENARIOS = (
    "family-login",
    "member-crud",
    "complex-form",
    "searchable-table",
    "detail-panel",
    "nested-modal",
)
M8_RUN_ARTIFACTS = (
    "request",
    "visible-inputs",
    "run-start",
    "initial-source",
    "first-verification",
    "command-index",
    "organizer-review",
    "repair-trace",
    "final-source",
    "final-verification",
)
M8_CHECKS = ("typecheck", "build", "verifier", "behavior", "a11y", "responsive")
M8_ATTRIBUTIONS = (
    "none",
    "skill-routing",
    "api-clarity",
    "component-defect",
    "installer-defect",
    "consumer-omission",
    "evaluation-infrastructure",
    "external-environment",
)
M8_ENVIRONMENT_FIELDS = (
    "operatingSystem",
    "architecture",
    "node",
    "packageManager",
    "browser",
    "python",
    "installerCommand",
)
MIGRATION_CHECKS = (
    "baselineTypecheck",
    "baselineBuild",
    "upgrade",
    "conflict",
    "rollback",
    "finalTypecheck",
    "finalBuild",
    "verifier",
)
MIGRATION_ARTIFACTS = (
    "baselineSource",
    "baselineVerification",
    "upgradeDiff",
    "conflictReport",
    "rollbackReport",
    "finalSource",
    "finalVerification",
)
MIGRATION_REPORT_CHECKS = (
    "baselineSource",
    "baselineInstall",
    "baselineBuild",
    "baselineVerifier",
    "baselineBehavior",
    "upgradeDryRun",
    "upgradeApply",
    "documentedApiMigration",
    "businessFilesPreserved",
    "postUpgradeInstall",
    "postUpgradeBuild",
    "postUpgradeVerifier",
    "postUpgradeBehavior",
    "conflictReport",
    "failureRecovery",
)
REQUIRED_WIDTHS = (2560, 1440, 1024, 736, 360, 320)
REQUIRED_ENGINES = ("chromium", "firefox", "webkit")
QUALITY_ARTIFACTS = ("matrix", "browserVersions", "responsiveReview")
REVIEW_BUNDLE_ARTIFACTS = (
    "candidateArchive",
    "checksums",
    "migrationGuide",
    "changelog",
    "supportMatrix",
    "independentConsumerReport",
    "knownLimitations",
    "previewInstructions",
    "releaseChecklist",
)
CANDIDATE_ARCHIVE_PREFIX = "ui-builder-xtn"
CANDIDATE_SCENARIOS_PATH = "evaluation/m8/scenarios.json"
CANDIDATE_RULES_PATH = "evaluation/m8/acceptance-rules.json"
CANDIDATE_REVIEW_FILES = {
    "migrationGuide": "references/v0.3.0-migrations.md",
    "changelog": "CHANGELOG.md",
    "supportMatrix": "references/support-matrix.json",
}
QUALITY_CHECKS = ("behavior", "a11y", "responsive")
SAFARI_CHECKS = ("documentReady", "rootRendered", "componentInteraction")

SHA256_PATTERN = re.compile(r"^[0-9a-f]{64}$")
COMMIT_PATTERN = re.compile(r"^[0-9a-f]{40}(?:[0-9a-f]{24})?$")
RUN_ID_PATTERN = re.compile(
    r"^m8-[a-z0-9][a-z0-9-]{0,127}-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
)


@dataclasses.dataclass(frozen=True)
class M8EvidenceValidation:
    category: str
    errors: tuple[str, ...] = ()

    @property
    def accepted(self) -> bool:
        return self.category == "accepted"

    def as_dict(self) -> dict[str, object]:
        return {
            "accepted": self.accepted,
            "category": self.category,
            "errors": list(self.errors),
        }


@dataclasses.dataclass(frozen=True)
class CandidateMaterials:
    files: Mapping[str, bytes]
    catalog_sha256: str
    scenarios: Mapping[str, Mapping[str, Any]]
    rules_size: int
    rules_sha256: str


def _is_sha256(value: object) -> bool:
    return isinstance(value, str) and SHA256_PATTERN.fullmatch(value) is not None


def _is_link(path: Path) -> bool:
    if path.is_symlink():
        return True
    is_junction = getattr(path, "is_junction", None)
    return bool(is_junction and is_junction())


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


def _is_timestamp(value: object) -> bool:
    if not isinstance(value, str) or not value:
        return False
    try:
        parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return False
    return parsed.tzinfo is not None


def _nonempty_strings(value: object) -> bool:
    return isinstance(value, list) and bool(value) and all(
        isinstance(item, str) and bool(item.strip()) for item in value
    )


def _artifact_shape(value: object, label: str, errors: list[str]) -> bool:
    if not isinstance(value, dict):
        errors.append(f"{label} must be an artifact object")
        return False
    relative_text = value.get("path")
    if not isinstance(relative_text, str) or "\\" in relative_text:
        errors.append(f"{label}.path must be a POSIX relative path")
        return False
    relative = PurePosixPath(relative_text)
    if relative.is_absolute() or any(part in {"", ".", ".."} for part in relative.parts):
        errors.append(f"{label}.path must be a safe relative path")
        return False
    if not isinstance(value.get("size"), int) or value["size"] < 0:
        errors.append(f"{label}.size must be a non-negative integer")
        return False
    if not _is_sha256(value.get("sha256")):
        errors.append(f"{label}.sha256 must be a lowercase SHA-256")
        return False
    return True


def _artifact_file(
    value: object,
    label: str,
    errors: list[str],
    bundle_root: Path | None,
) -> Path | None:
    if not _artifact_shape(value, label, errors):
        return None
    assert isinstance(value, dict)
    if bundle_root is None:
        errors.append(f"{label} cannot be verified without a bundle root")
        return None
    root = bundle_root.resolve(strict=True)
    relative = PurePosixPath(str(value["path"]))
    current = root
    for part in relative.parts:
        current = current / part
        if _is_link(current):
            errors.append(f"{label} traverses a link or junction")
            return None
    try:
        target = current.resolve(strict=True)
        target.relative_to(root)
    except (OSError, ValueError):
        errors.append(f"{label} does not resolve inside the evidence bundle")
        return None
    if not target.is_file():
        errors.append(f"{label} does not reference a regular file")
        return None
    content = target.read_bytes()
    if len(content) != value["size"]:
        errors.append(f"{label}.size does not match the artifact bytes")
    if hashlib.sha256(content).hexdigest() != value["sha256"]:
        errors.append(f"{label}.sha256 does not match the artifact bytes")
    return target


def _json_artifact(
    value: object,
    label: str,
    errors: list[str],
    bundle_root: Path | None,
) -> dict[str, Any] | None:
    path = _artifact_file(value, label, errors, bundle_root)
    if path is None:
        return None
    try:
        document = json.loads(path.read_text(encoding="utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        errors.append(f"{label} must contain valid UTF-8 JSON")
        return None
    if not isinstance(document, dict):
        errors.append(f"{label} JSON must be an object")
        return None
    return document


def _json_bytes(content: bytes, label: str, errors: list[str]) -> dict[str, Any] | None:
    try:
        document = json.loads(content.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        errors.append(f"{label} must contain valid UTF-8 JSON")
        return None
    if not isinstance(document, dict):
        errors.append(f"{label} JSON must be an object")
        return None
    return document


def _candidate_summary(candidate: Mapping[str, object]) -> dict[str, object]:
    archive = candidate.get("archive")
    return {
        "version": candidate.get("version"),
        "planDigest": candidate.get("planDigest"),
        "sourceCommit": candidate.get("sourceCommit"),
        "archiveSha256": archive.get("sha256") if isinstance(archive, dict) else None,
        "candidateContentDigest": candidate.get("candidateContentDigest"),
    }


def _load_candidate_materials(
    archive_path: Path | None,
    errors: list[str],
) -> CandidateMaterials | None:
    if archive_path is None:
        return None
    try:
        with zipfile.ZipFile(io.BytesIO(archive_path.read_bytes()), "r") as archive:
            names = archive.namelist()
            seen: set[str] = set()
            files: dict[str, bytes] = {}
            for name in names:
                path = PurePosixPath(name)
                folded = name.casefold()
                if (
                    name in {"", "."}
                    or "\\" in name
                    or path.is_absolute()
                    or any(part in {"", ".", ".."} for part in path.parts)
                    or path.parts[:1] != (CANDIDATE_ARCHIVE_PREFIX,)
                    or len(path.parts) < 2
                    or folded in seen
                ):
                    errors.append("reviewBundle candidate archive contains an unsafe or duplicate member")
                    return None
                seen.add(folded)
                info = archive.getinfo(name)
                mode = info.external_attr >> 16
                if info.is_dir() or (mode and (mode & 0o170000) not in {0, 0o100000}):
                    errors.append("reviewBundle candidate archive contains a non-regular member")
                    return None
                relative = PurePosixPath(*path.parts[1:]).as_posix()
                files[relative] = archive.read(name)
    except (OSError, zipfile.BadZipFile, RuntimeError) as error:
        errors.append(f"reviewBundle candidateArchive is not a readable candidate ZIP: {error}")
        return None

    catalog_content = files.get(CANDIDATE_SCENARIOS_PATH)
    rules_content = files.get(CANDIDATE_RULES_PATH)
    if catalog_content is None or rules_content is None:
        errors.append("reviewBundle candidate archive lacks frozen M8 scenarios or acceptance rules")
        return None
    catalog = _json_bytes(catalog_content, "candidate M8 scenario catalog", errors)
    rules = _json_bytes(rules_content, "candidate M8 acceptance rules", errors)
    if catalog is None or rules is None:
        return None
    scenario_entries = catalog.get("scenarios")
    rule_entries = rules.get("scenarioRules")
    if (
        catalog.get("schemaVersion") != SCHEMA_VERSION
        or catalog.get("kind") != "personal-ui-m8-scenarios"
        or not isinstance(scenario_entries, list)
        or rules.get("schemaVersion") != SCHEMA_VERSION
        or rules.get("kind") != "personal-ui-m8-acceptance-rules"
        or rules.get("visibility") != "organizer-only"
        or rules.get("attributionEnum") != list(M8_ATTRIBUTIONS[1:])
        or not isinstance(rule_entries, list)
    ):
        errors.append("reviewBundle candidate archive has unsupported M8 fact sources")
        return None
    scenario_ids = [item.get("id") for item in scenario_entries if isinstance(item, dict)]
    rule_ids = [item.get("id") for item in rule_entries if isinstance(item, dict)]
    if scenario_ids != list(M8_SCENARIOS) or rule_ids != list(M8_SCENARIOS):
        errors.append("reviewBundle candidate M8 scenarios and organizer rules are incomplete")
        return None
    for entry in rule_entries:
        assert isinstance(entry, dict)
        checks = entry.get("checks")
        if not isinstance(checks, dict) or any(
            not _nonempty_strings(checks.get(name))
            for name in ("behavior", "source", "accessibility", "responsive")
        ):
            errors.append(f"candidate M8 organizer rule is incomplete: {entry.get('id')}")
            return None
    scenario_map: dict[str, Mapping[str, Any]] = {}
    for entry in scenario_entries:
        assert isinstance(entry, dict)
        scenario_id = entry["id"]
        request = entry.get("request")
        fixture_id = entry.get("supportFixtureId")
        deliverables = entry.get("allowedDeliverables")
        if (
            not isinstance(request, dict)
            or not isinstance(fixture_id, str)
            or not fixture_id
            or not _nonempty_strings(deliverables)
        ):
            errors.append(f"candidate M8 scenario is incomplete: {scenario_id}")
            continue
        request_path = request.get("path")
        request_digest = request.get("sha256")
        if not isinstance(request_path, str) or "\\" in request_path or not _is_sha256(request_digest):
            errors.append(f"candidate M8 scenario request is invalid: {scenario_id}")
            continue
        relative = PurePosixPath(request_path)
        if (
            relative.is_absolute()
            or any(part in {"", ".", ".."} for part in relative.parts)
            or relative.parts[:3] != ("evaluation", "m8", "requests")
            or relative.suffix != ".md"
        ):
            errors.append(f"candidate M8 scenario request path is unsafe: {scenario_id}")
            continue
        content = files.get(relative.as_posix())
        if content is None or not content.strip() or hashlib.sha256(content).hexdigest() != request_digest:
            errors.append(f"candidate M8 scenario request hash mismatch: {scenario_id}")
            continue
        scenario_map[str(scenario_id)] = entry
    if set(scenario_map) != set(M8_SCENARIOS):
        return None
    return CandidateMaterials(
        files=files,
        catalog_sha256=hashlib.sha256(catalog_content).hexdigest(),
        scenarios=scenario_map,
        rules_size=len(rules_content),
        rules_sha256=hashlib.sha256(rules_content).hexdigest(),
    )


def _descriptor_matches(left: object, right: object) -> bool:
    if not isinstance(left, dict) or not isinstance(right, dict):
        return False
    return all(left.get(field) == right.get(field) for field in ("path", "size", "sha256"))


def _artifact_text(path: Path | None, label: str, errors: list[str]) -> str | None:
    if path is None:
        return None
    try:
        value = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        errors.append(f"{label} must be UTF-8 text")
        return None
    if not value.strip():
        errors.append(f"{label} must not be empty")
        return None
    return value


def _validate_top_level(evidence: object) -> list[str]:
    if not isinstance(evidence, dict):
        return ["evidence must be a JSON object"]
    errors: list[str] = []
    for key, expected in {
        "schemaVersion": SCHEMA_VERSION,
        "kind": EVIDENCE_KIND,
        "type": EVIDENCE_TYPE,
    }.items():
        if evidence.get(key) != expected:
            errors.append(f"{key} must equal {expected!r}")
    if not _is_sha256(evidence.get("planDigest")):
        errors.append("planDigest must be a lowercase SHA-256")
    commit = evidence.get("sourceCommit")
    if not isinstance(commit, str) or COMMIT_PATTERN.fullmatch(commit) is None:
        errors.append("sourceCommit must be a lowercase 40- or 64-character Git object id")
    if not _is_sha256(evidence.get("archiveSha256")):
        errors.append("archiveSha256 must be a lowercase SHA-256")
    if evidence.get("result") not in {"passed", "failed"}:
        errors.append("result must be 'passed' or 'failed'")
    return errors


def _validate_candidate(
    evidence: Mapping[str, object],
    errors: list[str],
) -> dict[str, Any] | None:
    candidate = evidence.get("candidate")
    if not isinstance(candidate, dict):
        errors.append("candidate must be a complete binding object")
        return None
    if not isinstance(candidate.get("version"), str) or not candidate["version"]:
        errors.append("candidate.version must be non-empty")
    commit = candidate.get("sourceCommit")
    if not isinstance(commit, str) or COMMIT_PATTERN.fullmatch(commit) is None:
        errors.append("candidate.sourceCommit must be a Git object id")
    for field in ("planDigest", "sourceContentDigest", "candidateContentDigest"):
        if not _is_sha256(candidate.get(field)):
            errors.append(f"candidate.{field} must be a lowercase SHA-256")
    if not isinstance(candidate.get("sourceDateEpoch"), int) or candidate["sourceDateEpoch"] < 0:
        errors.append("candidate.sourceDateEpoch must be a non-negative integer")
    archive = candidate.get("archive")
    if not isinstance(archive, dict):
        errors.append("candidate.archive must be an object")
    else:
        relative_text = archive.get("path")
        if not isinstance(relative_text, str) or "\\" in relative_text:
            errors.append("candidate.archive.path must be a POSIX relative path")
        else:
            relative = PurePosixPath(relative_text)
            if relative.is_absolute() or any(part in {"", ".", ".."} for part in relative.parts):
                errors.append("candidate.archive.path must be safe")
        if not isinstance(archive.get("size"), int) or archive["size"] < 0:
            errors.append("candidate.archive.size must be non-negative")
        if not _is_sha256(archive.get("sha256")):
            errors.append("candidate.archive.sha256 must be a lowercase SHA-256")
    flat = {
        "planDigest": candidate.get("planDigest"),
        "sourceCommit": candidate.get("sourceCommit"),
        "archiveSha256": archive.get("sha256") if isinstance(archive, dict) else None,
    }
    for field, nested in flat.items():
        if evidence.get(field) != nested:
            errors.append(f"{field} must match the complete candidate binding")
    return candidate


def _validate_command_record(
    value: object,
    *,
    label: str,
    run_id: str,
    sequence: int,
    errors: list[str],
    bundle_root: Path | None,
) -> None:
    record = _json_artifact(value, label, errors, bundle_root)
    if record is None:
        return
    if record.get("kind") != "personal-ui-m8-command" or record.get("runId") != run_id:
        errors.append(f"{label} is not a command for this run")
    if record.get("sequence") != sequence:
        errors.append(f"{label}.sequence must equal {sequence}")
    if not _nonempty_strings(record.get("argv")):
        errors.append(f"{label}.argv must contain command arguments")
    if not isinstance(record.get("cwd"), str) or not record["cwd"]:
        errors.append(f"{label}.cwd must be non-empty")
    if not isinstance(record.get("exitCode"), int):
        errors.append(f"{label}.exitCode must be an integer")
    for field in ("startedAt", "endedAt"):
        if not _is_timestamp(record.get(field)):
            errors.append(f"{label}.{field} must be timezone-aware")
    _artifact_file(record.get("stdout"), f"{label}.stdout", errors, bundle_root)
    _artifact_file(record.get("stderr"), f"{label}.stderr", errors, bundle_root)


def _validate_repair_record(
    value: object,
    *,
    label: str,
    run_id: str,
    sequence: int,
    errors: list[str],
    bundle_root: Path | None,
) -> None:
    record = _json_artifact(value, label, errors, bundle_root)
    if record is None:
        return
    if record.get("kind") != "personal-ui-m8-repair" or record.get("runId") != run_id:
        errors.append(f"{label} is not a repair for this run")
    if record.get("sequence") != sequence:
        errors.append(f"{label}.sequence must equal {sequence}")
    if record.get("attribution") not in M8_ATTRIBUTIONS[1:]:
        errors.append(f"{label}.attribution must identify a primary cause")
    if not isinstance(record.get("reason"), str) or not record["reason"].strip():
        errors.append(f"{label}.reason must be non-empty")
    if not _nonempty_strings(record.get("changedFiles")):
        errors.append(f"{label}.changedFiles must be non-empty")
    if record.get("candidateChanged") is not False:
        errors.append(f"{label}.candidateChanged must be false for this binding")
    if not _is_timestamp(record.get("recordedAt")):
        errors.append(f"{label}.recordedAt must be timezone-aware")
    _artifact_file(record.get("diff"), f"{label}.diff", errors, bundle_root)
    _artifact_file(record.get("verification"), f"{label}.verification", errors, bundle_root)


def _validate_result_record(
    document: Mapping[str, object],
    *,
    label: str,
    stage: str,
    run_id: str,
    outer_source: object,
    errors: list[str],
    bundle_root: Path | None,
) -> None:
    expected_kind = f"personal-ui-m8-{stage}-result"
    if (
        document.get("schemaVersion") != SCHEMA_VERSION
        or document.get("kind") != expected_kind
        or document.get("runId") != run_id
    ):
        errors.append(f"{label} has an unsupported schema, kind, or run binding")
    result = document.get("result")
    if result not in {"passed", "failed", "blocked"}:
        errors.append(f"{label}.result is invalid")
    checks = document.get("checks")
    if not isinstance(checks, dict) or any(checks.get(name) not in {"passed", "failed", "blocked", "not-run"} for name in M8_CHECKS):
        errors.append(f"{label}.checks is incomplete")
    elif result == "passed" and any(checks.get(name) != "passed" for name in M8_CHECKS):
        errors.append(f"{label} passed but its first-result checks did not all pass" if stage == "initial" else f"{label} passed but its checks did not all pass")
    elif result in {"failed", "blocked"} and all(checks.get(name) == "passed" for name in M8_CHECKS):
        errors.append(f"{label} is {result} but has no non-passing check")
    if not _descriptor_matches(document.get("sourceArchive"), outer_source):
        errors.append(f"{label}.sourceArchive differs from the retained {stage} source")
    _artifact_file(document.get("sourceArchive"), f"{label}.sourceArchive", errors, bundle_root)
    inventory = _json_artifact(
        document.get("sourceInventory"), f"{label}.sourceInventory", errors, bundle_root
    )
    if inventory is not None:
        files = inventory.get("files")
        if (
            inventory.get("schemaVersion") != SCHEMA_VERSION
            or inventory.get("kind") != "personal-ui-m8-source-inventory"
            or not _is_sha256(inventory.get("contentDigest"))
            or not isinstance(files, list)
            or not files
        ):
            errors.append(f"{label}.sourceInventory is incomplete")
    verification = _json_artifact(
        document.get("verification"), f"{label}.verification", errors, bundle_root
    )
    if verification is not None and verification.get("result") != result:
        errors.append(f"{label}.verification result mismatch")


def _validate_scenarios(
    evidence: Mapping[str, object],
    candidate: Mapping[str, object],
    materials: CandidateMaterials | None,
    bundle_root: Path | None,
) -> list[str]:
    scenarios = evidence.get("scenarios")
    if not isinstance(scenarios, list):
        return ["passed evidence must contain a scenarios array"]
    errors: list[str] = []
    seen: set[str] = set()
    seen_run_ids: set[str] = set()
    for index, scenario in enumerate(scenarios):
        label = f"scenarios[{index}]"
        if not isinstance(scenario, dict):
            errors.append(f"{label} must be an object")
            continue
        scenario_id = scenario.get("id")
        if not isinstance(scenario_id, str) or scenario_id not in M8_SCENARIOS:
            errors.append(f"{label}.id is not a required M8 scenario")
        elif scenario_id in seen:
            errors.append(f"duplicate M8 scenario: {scenario_id}")
        else:
            seen.add(scenario_id)
        if scenario.get("result") != "passed":
            errors.append(f"{label}.result must be 'passed'")
        run = scenario.get("run")
        if not isinstance(run, dict):
            errors.append(f"{label}.run must be an object")
            continue
        run_id = run.get("runId")
        if not isinstance(run_id, str) or RUN_ID_PATTERN.fullmatch(run_id) is None:
            errors.append(f"{label}.run.runId is invalid")
            run_id = "invalid"
        elif run_id in seen_run_ids:
            errors.append(f"{label}.run.runId must be unique across M8 scenarios")
        else:
            seen_run_ids.add(run_id)
            if isinstance(scenario_id, str) and not run_id.startswith(f"m8-{scenario_id}-"):
                errors.append(f"{label}.run.runId is not bound to its scenario")
        if not isinstance(run.get("summary"), str) or not run["summary"].strip():
            errors.append(f"{label}.run.summary must be non-empty")
        if run.get("freshContext") is not True or run.get("forbiddenInputsAbsent") is not True:
            errors.append(f"{label}.run must attest fresh context and absent forbidden inputs")
        attribution = run.get("attribution")
        if attribution not in M8_ATTRIBUTIONS:
            errors.append(f"{label}.run.attribution is invalid")
        for field in ("startedAt", "endedAt"):
            if not _is_timestamp(run.get(field)):
                errors.append(f"{label}.run.{field} must be timezone-aware")

        environment = run.get("environment")
        if not isinstance(environment, dict):
            errors.append(f"{label}.run.environment must be an object")
        else:
            if not isinstance(environment.get("fixtureId"), str) or not environment["fixtureId"]:
                errors.append(f"{label}.run.environment.fixtureId must be non-empty")
            actual = environment.get("actual")
            if not isinstance(actual, dict):
                errors.append(f"{label}.run.environment.actual must be an object")
            else:
                for field in M8_ENVIRONMENT_FIELDS:
                    if not isinstance(actual.get(field), str) or not actual[field].strip():
                        errors.append(f"{label}.run.environment.actual.{field} must be non-empty")
            expected_scenario = (
                materials.scenarios.get(scenario_id)
                if materials is not None and isinstance(scenario_id, str)
                else None
            )
            if expected_scenario is not None and environment.get("fixtureId") != expected_scenario.get("supportFixtureId"):
                errors.append(f"{label}.run.environment fixture differs from the frozen candidate")

        artifacts = run.get("artifacts")
        if not isinstance(artifacts, dict):
            errors.append(f"{label}.run.artifacts must be an object")
            artifacts = {}
        retained_paths = [
            value.get("path")
            for value in artifacts.values()
            if isinstance(value, dict) and isinstance(value.get("path"), str)
        ]
        if len(retained_paths) != len(set(retained_paths)):
            errors.append(f"{label}.run.artifacts must reference distinct retained files")
        documents: dict[str, dict[str, Any] | None] = {}
        artifact_paths: dict[str, Path | None] = {}
        json_names = {
            "visible-inputs",
            "run-start",
            "first-verification",
            "command-index",
            "organizer-review",
            "repair-trace",
            "final-verification",
        }
        for name in M8_RUN_ARTIFACTS:
            value = artifacts.get(name)
            if name in json_names:
                documents[name] = _json_artifact(
                    value,
                    f"{label}.run.artifacts.{name}",
                    errors,
                    bundle_root,
                )
                artifact_paths[name] = _artifact_file(value, f"{label}.run.artifacts.{name}", [], bundle_root)
            else:
                artifact_paths[name] = _artifact_file(
                    value,
                    f"{label}.run.artifacts.{name}",
                    errors,
                    bundle_root,
                )

        visible_descriptor = artifacts.get("visible-inputs")
        request_descriptor = artifacts.get("request")
        if isinstance(visible_descriptor, dict) and isinstance(request_descriptor, dict):
            visible_path = visible_descriptor.get("path")
            request_path = request_descriptor.get("path")
            if isinstance(visible_path, str) and isinstance(request_path, str):
                workspace_prefix = PurePosixPath(visible_path).parent
                if PurePosixPath(request_path).parent != workspace_prefix:
                    errors.append(f"{label} request and visible inputs do not share a workspace")
                for name in M8_RUN_ARTIFACTS:
                    if name in {"request", "visible-inputs"}:
                        continue
                    value = artifacts.get(name)
                    path_value = value.get("path") if isinstance(value, dict) else None
                    if isinstance(path_value, str):
                        try:
                            PurePosixPath(path_value).relative_to(workspace_prefix / "evidence")
                        except ValueError:
                            errors.append(f"{label}.run.artifacts.{name} is outside its evidence workspace")

        visible = documents.get("visible-inputs")
        if visible is not None:
            visible_run = visible.get("run")
            visible_scenario = visible.get("scenario")
            policy = visible.get("inputPolicy")
            expected_scenario = (
                materials.scenarios.get(scenario_id)
                if materials is not None and isinstance(scenario_id, str)
                else None
            )
            if (
                visible.get("schemaVersion") != SCHEMA_VERSION
                or visible.get("kind") != "personal-ui-m8-evaluator-inputs"
            ):
                errors.append(f"{label} visible inputs schema or kind is unsupported")
            if visible.get("official") is not True:
                errors.append(f"{label} visible inputs must be official")
            if not isinstance(visible_run, dict) or visible_run.get("id") != run_id:
                errors.append(f"{label} visible inputs run id mismatch")
            if not isinstance(visible_scenario, dict) or visible_scenario.get("id") != scenario_id:
                errors.append(f"{label} visible inputs scenario mismatch")
            if visible.get("candidate") != candidate:
                errors.append(f"{label} visible inputs candidate binding mismatch")
            if (
                not isinstance(policy, dict)
                or policy.get("firstInputsFrozen") is not True
                or policy.get("readOnly") is not True
                or policy.get("postWriteVerified") is not True
            ):
                errors.append(f"{label} visible inputs were not frozen and write-verified")
            request_meta = visible.get("request")
            request_artifact = artifacts.get("request")
            if isinstance(request_meta, dict) and isinstance(request_artifact, dict):
                if (
                    request_meta.get("size") != request_artifact.get("size")
                    or request_meta.get("sha256") != request_artifact.get("sha256")
                ):
                    errors.append(f"{label} request does not match visible inputs")
            else:
                errors.append(f"{label} visible inputs request metadata is incomplete")
            organizer = visible.get("organizerBindings")
            frozen_rules = organizer.get("acceptanceRules") if isinstance(organizer, dict) else None
            if not isinstance(frozen_rules, dict) or not _is_sha256(frozen_rules.get("sha256")):
                errors.append(f"{label} visible inputs lack frozen organizer rules")
            if expected_scenario is not None and materials is not None:
                expected_request = expected_scenario.get("request")
                expected_request_path = (
                    expected_request.get("path") if isinstance(expected_request, dict) else None
                )
                expected_request_sha = (
                    expected_request.get("sha256") if isinstance(expected_request, dict) else None
                )
                expected_content = (
                    materials.files.get(expected_request_path)
                    if isinstance(expected_request_path, str)
                    else None
                )
                if (
                    not isinstance(visible_scenario, dict)
                    or visible_scenario.get("catalogSha256") != materials.catalog_sha256
                    or visible_scenario.get("requestPath") != expected_request_path
                    or visible_scenario.get("requestSha256") != expected_request_sha
                    or visible_scenario.get("supportFixtureId") != expected_scenario.get("supportFixtureId")
                    or visible_scenario.get("allowedDeliverables") != expected_scenario.get("allowedDeliverables")
                ):
                    errors.append(f"{label} visible scenario differs from the frozen candidate")
                request_path = artifact_paths.get("request")
                if request_path is None or expected_content is None or request_path.read_bytes() != expected_content:
                    errors.append(f"{label} request differs from the frozen candidate request")
                if (
                    not isinstance(frozen_rules, dict)
                    or frozen_rules.get("path") != CANDIDATE_RULES_PATH
                    or frozen_rules.get("size") != materials.rules_size
                    or frozen_rules.get("sha256") != materials.rules_sha256
                ):
                    errors.append(f"{label} organizer rules differ from the frozen candidate")

        for name, kind in {
            "run-start": "personal-ui-m8-run-start",
            "first-verification": "personal-ui-m8-initial-result",
            "organizer-review": "personal-ui-m8-organizer-review",
            "final-verification": "personal-ui-m8-final-result",
        }.items():
            document = documents.get(name)
            if document is not None and (
                document.get("schemaVersion") != SCHEMA_VERSION
                or document.get("kind") != kind
                or document.get("runId") != run_id
            ):
                errors.append(f"{label} {name} is not bound to this run")

        start_document = documents.get("run-start")
        if start_document is not None:
            if start_document.get("schemaVersion") != SCHEMA_VERSION:
                errors.append(f"{label} run-start schema is unsupported")
            if start_document.get("candidate") != candidate:
                errors.append(f"{label} run-start candidate binding mismatch")
            if start_document.get("scenarioId") != scenario_id:
                errors.append(f"{label} run-start scenario mismatch")
            if start_document.get("actualEnvironment") != (
                environment.get("actual") if isinstance(environment, dict) else None
            ):
                errors.append(f"{label} run-start environment mismatch")
            expected_scenario = (
                materials.scenarios.get(scenario_id)
                if materials is not None and isinstance(scenario_id, str)
                else None
            )
            if expected_scenario is not None and start_document.get("fixtureId") != expected_scenario.get("supportFixtureId"):
                errors.append(f"{label} run-start fixture differs from the frozen candidate")
            if not _descriptor_matches(start_document.get("visibleInputs"), artifacts.get("visible-inputs")):
                errors.append(f"{label} run-start visible-input binding mismatch")
            if not _descriptor_matches(start_document.get("request"), artifacts.get("request")):
                errors.append(f"{label} run-start request binding mismatch")

        first = run.get("firstResult")
        if (
            not isinstance(first, dict)
            or first.get("status") not in {"passed", "failed", "blocked"}
            or not _is_timestamp(first.get("frozenAt"))
        ):
            errors.append(f"{label}.run.firstResult is invalid")
        review = run.get("review")
        if (
            not isinstance(review, dict)
            or review.get("status") not in {"passed", "failed", "blocked"}
            or not _is_timestamp(review.get("reviewedAt"))
            or not _nonempty_strings(review.get("observations"))
        ):
            errors.append(f"{label}.run.review must be complete and timestamped")
        final = run.get("finalResult")
        if (
            not isinstance(final, dict)
            or final.get("status") != "passed"
            or not _is_timestamp(final.get("frozenAt"))
        ):
            errors.append(f"{label}.run.finalResult must be passed and timestamped")

        initial_document = documents.get("first-verification")
        if initial_document is not None and isinstance(first, dict):
            if (
                initial_document.get("result") != first.get("status")
                or initial_document.get("frozenAt") != first.get("frozenAt")
            ):
                errors.append(f"{label} first-result record mismatch")
            _validate_result_record(
                initial_document,
                label=f"{label}.run.firstResult",
                stage="initial",
                run_id=run_id,
                outer_source=artifacts.get("initial-source"),
                errors=errors,
                bundle_root=bundle_root,
            )
        review_document = documents.get("organizer-review")
        if review_document is not None and isinstance(review, dict):
            if (
                review_document.get("result") != review.get("status")
                or review_document.get("reviewedAt") != review.get("reviewedAt")
                or review_document.get("observations") != review.get("observations")
                or review_document.get("attribution") != attribution
            ):
                errors.append(f"{label} organizer-review record mismatch")
            if not _descriptor_matches(
                review_document.get("initialResult"), artifacts.get("first-verification")
            ):
                errors.append(f"{label} organizer review is not bound to the first result")
            rules_descriptor = review_document.get("acceptanceRules")
            _artifact_file(
                rules_descriptor,
                f"{label}.run.review.acceptanceRules",
                errors,
                bundle_root,
            )
            rules_path = _artifact_file(
                rules_descriptor,
                f"{label}.run.review.acceptanceRules",
                [],
                bundle_root,
            )
            if materials is not None and (
                not isinstance(rules_descriptor, dict)
                or rules_descriptor.get("size") != materials.rules_size
                or rules_descriptor.get("sha256") != materials.rules_sha256
                or rules_path is None
                or rules_path.read_bytes() != materials.files[CANDIDATE_RULES_PATH]
            ):
                errors.append(f"{label} organizer review rules differ from the frozen candidate")
            if visible is not None:
                organizer = visible.get("organizerBindings")
                frozen_rules = organizer.get("acceptanceRules") if isinstance(organizer, dict) else None
                if isinstance(rules_descriptor, dict) and isinstance(frozen_rules, dict) and (
                    rules_descriptor.get("size") != frozen_rules.get("size")
                    or rules_descriptor.get("sha256") != frozen_rules.get("sha256")
                ):
                    errors.append(f"{label} organizer rules differ from frozen candidate")
        final_document = documents.get("final-verification")
        if final_document is not None and isinstance(final, dict):
            if (
                final_document.get("result") != final.get("status")
                or final_document.get("frozenAt") != final.get("frozenAt")
                or final_document.get("checks") != run.get("checks")
            ):
                errors.append(f"{label} final-result record mismatch")
            _validate_result_record(
                final_document,
                label=f"{label}.run.finalResult",
                stage="final",
                run_id=run_id,
                outer_source=artifacts.get("final-source"),
                errors=errors,
                bundle_root=bundle_root,
            )

        commands = run.get("commands")
        if not isinstance(commands, list) or not commands:
            errors.append(f"{label}.run.commands must contain retained command records")
        else:
            for command_index, command in enumerate(commands, start=1):
                _validate_command_record(
                    command,
                    label=f"{label}.run.commands[{command_index - 1}]",
                    run_id=run_id,
                    sequence=command_index,
                    errors=errors,
                    bundle_root=bundle_root,
                )
        command_index_document = documents.get("command-index")
        if command_index_document is not None and (
            command_index_document.get("schemaVersion") != SCHEMA_VERSION
            or command_index_document.get("kind") != "personal-ui-m8-command-index"
            or command_index_document.get("runId") != run_id
            or command_index_document.get("commands") != commands
        ):
            errors.append(f"{label} command index differs from retained commands")
        repairs = run.get("repairs")
        if not isinstance(repairs, list):
            errors.append(f"{label}.run.repairs must be an array")
            repairs = []
        for repair_index, repair in enumerate(repairs, start=1):
            _validate_repair_record(
                repair,
                label=f"{label}.run.repairs[{repair_index - 1}]",
                run_id=run_id,
                sequence=repair_index,
                errors=errors,
                bundle_root=bundle_root,
            )
        repair_trace_document = documents.get("repair-trace")
        if repair_trace_document is not None:
            if (
                repair_trace_document.get("schemaVersion") != SCHEMA_VERSION
                or repair_trace_document.get("kind") != "personal-ui-m8-repair-trace"
                or repair_trace_document.get("runId") != run_id
                or repair_trace_document.get("repairs") != repairs
            ):
                errors.append(f"{label} repair trace differs from retained repairs")
        needs_repair = (
            isinstance(first, dict) and first.get("status") != "passed"
        ) or (
            isinstance(review, dict) and review.get("status") != "passed"
        )
        if needs_repair and not repairs:
            errors.append(f"{label}.run.repairs must retain remediation after a failed first pass or review")
        if (repairs or needs_repair) and attribution == "none":
            errors.append(f"{label}.run.attribution must identify the first-pass failure")
        checks = run.get("checks")
        if not isinstance(checks, dict):
            errors.append(f"{label}.run.checks must be an object")
        else:
            for check in M8_CHECKS:
                if checks.get(check) != "passed":
                    errors.append(f"{label}.run.checks.{check} must be 'passed'")

    missing = sorted(set(M8_SCENARIOS) - seen)
    if missing:
        errors.append("missing M8 scenarios: " + ", ".join(missing))
    if len(scenarios) != len(M8_SCENARIOS):
        errors.append(f"passed evidence must contain exactly {len(M8_SCENARIOS)} scenarios")
    return errors


def _validate_migration(
    evidence: Mapping[str, object],
    candidate: Mapping[str, object],
    bundle_root: Path | None,
) -> list[str]:
    errors: list[str] = []
    migration = evidence.get("migration")
    if not isinstance(migration, dict):
        return ["migration must be a passed v0.2.19 consumer migration record"]
    if migration.get("result") != "passed" or migration.get("fromVersion") != "0.2.19":
        errors.append("migration must pass from immutable v0.2.19")
    if migration.get("toVersion") != candidate.get("version"):
        errors.append("migration.toVersion must match the candidate version")
    checks = migration.get("checks")
    if not isinstance(checks, dict):
        errors.append("migration.checks must be an object")
    else:
        for check in MIGRATION_CHECKS:
            if checks.get(check) != "passed":
                errors.append(f"migration.checks.{check} must be 'passed'")
    artifacts = migration.get("artifacts")
    if not isinstance(artifacts, dict):
        errors.append("migration.artifacts must be an object")
        artifacts = {}
    artifact_paths = {
        name: _artifact_file(
            artifacts.get(name), f"migration.artifacts.{name}", errors, bundle_root
        )
        for name in MIGRATION_ARTIFACTS
    }
    migration_descriptors = [
        artifacts.get(name) for name in ("report", "inventory", *MIGRATION_ARTIFACTS)
    ]
    migration_paths = [
        value.get("path")
        for value in migration_descriptors
        if isinstance(value, dict) and isinstance(value.get("path"), str)
    ]
    if len(migration_paths) != len(set(migration_paths)):
        errors.append("migration artifacts must reference distinct retained files")
    report = _json_artifact(
        artifacts.get("report"), "migration.artifacts.report", errors, bundle_root
    )
    inventory = _json_artifact(
        artifacts.get("inventory"), "migration.artifacts.inventory", errors, bundle_root
    )
    candidate_summary = _candidate_summary(candidate)
    if report is not None:
        baseline = report.get("baseline")
        report_checks = report.get("checks")
        source = report.get("source")
        commands = report.get("commands")
        if (
            report.get("schemaVersion") != SCHEMA_VERSION
            or report.get("kind") != "personal-ui-m8-migration-report"
            or report.get("result") != "passed"
            or not _is_timestamp(report.get("recordedAt"))
            or report.get("candidate") != candidate_summary
            or not isinstance(baseline, dict)
            or baseline.get("version") != "0.2.19"
            or baseline.get("tag") != "v0.2.19"
            or not isinstance(baseline.get("commit"), str)
            or COMMIT_PATTERN.fullmatch(baseline["commit"]) is None
            or not isinstance(baseline.get("tree"), str)
            or COMMIT_PATTERN.fullmatch(baseline["tree"]) is None
            or not isinstance(report_checks, dict)
            or any(report_checks.get(name) != "passed" for name in MIGRATION_REPORT_CHECKS)
            or not isinstance(source, dict)
            or source.get("beforeArchive") != "artifacts/baseline-consumer-source.zip"
            or source.get("afterArchive") != "artifacts/upgraded-consumer-source.zip"
            or source.get("diff") != "artifacts/migration-diff.patch"
            or not isinstance(commands, list)
            or not commands
            or report.get("artifactInventory") != "artifact-inventory.json"
        ):
            errors.append("migration report is incomplete, unbound, or not passed")

    inventory_path = _artifact_file(
        artifacts.get("inventory"),
        "migration.artifacts.inventory",
        [],
        bundle_root,
    )
    inventory_entries: dict[str, Mapping[str, object]] = {}
    if inventory is not None and inventory_path is not None:
        items = inventory.get("artifacts")
        baseline = report.get("baseline") if isinstance(report, dict) else None
        if (
            inventory.get("schemaVersion") != SCHEMA_VERSION
            or inventory.get("kind") != "personal-ui-m8-migration-artifact-inventory"
            or inventory.get("result") != "passed"
            or inventory.get("candidate") != candidate_summary
            or inventory.get("baseline") != baseline
            or not isinstance(items, list)
            or inventory.get("artifactCount") != (len(items) if isinstance(items, list) else None)
        ):
            errors.append("migration artifact inventory is incomplete or unbound")
            items = []
        inventory_root = inventory_path.parent.resolve(strict=True)
        for index, item in enumerate(items):
            label = f"migration.artifacts.inventory.artifacts[{index}]"
            if not isinstance(item, dict):
                errors.append(f"{label} must be an object")
                continue
            relative_text = item.get("path")
            if not isinstance(relative_text, str) or "\\" in relative_text:
                errors.append(f"{label}.path must be a POSIX relative path")
                continue
            relative = PurePosixPath(relative_text)
            if (
                relative.is_absolute()
                or any(part in {"", ".", ".."} for part in relative.parts)
                or relative_text in inventory_entries
            ):
                errors.append(f"{label}.path is unsafe or duplicated")
                continue
            current = inventory_root
            linked = False
            for part in relative.parts:
                current = current / part
                if _is_link(current):
                    errors.append(f"{label} traverses a link or junction")
                    linked = True
                    break
            if linked:
                continue
            try:
                retained = current.resolve(strict=True)
                retained.relative_to(inventory_root)
            except (OSError, ValueError):
                errors.append(f"{label} does not resolve inside the migration bundle")
                continue
            if not retained.is_file():
                errors.append(f"{label} does not reference a regular file")
                continue
            content = retained.read_bytes()
            if item.get("size") != len(content) or item.get("sha256") != hashlib.sha256(content).hexdigest():
                errors.append(f"{label} hash does not match the retained migration artifact")
            inventory_entries[relative_text] = item
        if len(inventory_entries) != len(items):
            errors.append("migration artifact inventory must contain unique retained files")

        for name, path in {"report": _artifact_file(artifacts.get("report"), "migration.artifacts.report", [], bundle_root), **artifact_paths}.items():
            if path is None:
                continue
            try:
                relative = path.resolve(strict=True).relative_to(inventory_root).as_posix()
            except ValueError:
                errors.append(f"migration.artifacts.{name} is outside the retained migration bundle")
                continue
            descriptor = artifacts.get(name)
            item = inventory_entries.get(relative)
            if (
                not isinstance(descriptor, dict)
                or item is None
                or item.get("size") != descriptor.get("size")
                or item.get("sha256") != descriptor.get("sha256")
            ):
                errors.append(f"migration.artifacts.{name} is absent from the migration inventory")
    return errors


def _validate_quality(
    evidence: Mapping[str, object],
    candidate: Mapping[str, object],
    bundle_root: Path | None,
) -> list[str]:
    errors: list[str] = []
    quality = evidence.get("qualityMatrix")
    if not isinstance(quality, dict):
        return ["qualityMatrix must be a complete passed quality record"]
    if quality.get("result") != "passed":
        errors.append("qualityMatrix.result must be 'passed'")
    candidate_summary = _candidate_summary(candidate)
    if quality.get("candidate") != candidate_summary:
        errors.append("qualityMatrix candidate binding mismatch")
    if quality.get("widths") != list(REQUIRED_WIDTHS):
        errors.append("qualityMatrix.widths must contain all six required widths")
    if quality.get("engines") != list(REQUIRED_ENGINES):
        errors.append("qualityMatrix.engines must contain Chromium, Firefox, and WebKit")
    scenarios = quality.get("scenarios")
    seen: set[str] = set()
    if not isinstance(scenarios, list):
        errors.append("qualityMatrix.scenarios must be an array")
        scenarios = []
    for index, scenario in enumerate(scenarios):
        label = f"qualityMatrix.scenarios[{index}]"
        if not isinstance(scenario, dict):
            errors.append(f"{label} must be an object")
            continue
        scenario_id = scenario.get("id")
        if scenario_id not in M8_SCENARIOS or scenario_id in seen:
            errors.append(f"{label}.id must be a unique required scenario")
        elif isinstance(scenario_id, str):
            seen.add(scenario_id)
        if scenario.get("widths") != list(REQUIRED_WIDTHS):
            errors.append(f"{label}.widths must contain all required widths")
        if scenario.get("engines") != list(REQUIRED_ENGINES):
            errors.append(f"{label}.engines must contain all required engines")
        checks = scenario.get("checks")
        if not isinstance(checks, dict) or any(
            checks.get(name) != "passed" for name in QUALITY_CHECKS
        ):
            errors.append(f"{label}.checks must pass behavior, a11y, and responsive")
        record = _json_artifact(
            scenario.get("artifact"), f"{label}.artifact", errors, bundle_root
        )
        if record is not None:
            if (
                record.get("schemaVersion") != SCHEMA_VERSION
                or record.get("kind") != "personal-ui-m8-quality-scenario"
                or record.get("scenarioId") != scenario_id
                or record.get("result") != "passed"
                or record.get("candidate") != candidate_summary
                or record.get("widths") != list(REQUIRED_WIDTHS)
                or record.get("engines") != list(REQUIRED_ENGINES)
                or record.get("checks") != checks
            ):
                errors.append(f"{label}.artifact is not a bound passing quality record")
            measurements = record.get("measurements")
            expected_measurements = {
                (engine, width)
                for engine in REQUIRED_ENGINES
                for width in REQUIRED_WIDTHS
            }
            seen_measurements: set[tuple[str, int]] = set()
            if not isinstance(measurements, list):
                errors.append(f"{label}.artifact.measurements must be an array")
            else:
                for measurement in measurements:
                    if not isinstance(measurement, dict):
                        errors.append(f"{label}.artifact contains a non-object measurement")
                        continue
                    engine = measurement.get("engine")
                    width = measurement.get("width")
                    key = (str(engine), width) if isinstance(width, int) and not isinstance(width, bool) else None
                    if (
                        key is None
                        or key not in expected_measurements
                        or key in seen_measurements
                        or any(measurement.get(name) != "passed" for name in QUALITY_CHECKS)
                    ):
                        errors.append(f"{label}.artifact contains an invalid or duplicate measurement")
                    else:
                        seen_measurements.add(key)
                if seen_measurements != expected_measurements or len(measurements) != len(expected_measurements):
                    errors.append(
                        f"{label}.artifact must retain every engine and width measurement"
                    )
    if seen != set(M8_SCENARIOS) or len(scenarios) != len(M8_SCENARIOS):
        errors.append("qualityMatrix.scenarios must cover each M8 scenario exactly once")

    safari = quality.get("realSafari")
    if not isinstance(safari, dict):
        errors.append("qualityMatrix.realSafari must be an object")
    else:
        try:
            safari_major = int(str(safari.get("version")).split(".", 1)[0])
        except (TypeError, ValueError):
            safari_major = 0
        if (
            safari.get("result") != "passed"
            or safari.get("browser") != "Safari"
            or safari_major < 18
            or safari.get("playwrightWebKit") is not False
        ):
            errors.append("qualityMatrix.realSafari must record a real Safari 18+ pass")
        safari_record = _json_artifact(
            safari.get("artifact"),
            "qualityMatrix.realSafari.artifact",
            errors,
            bundle_root,
        )
        if safari_record is not None:
            safari_details = safari_record.get("safari")
            safari_checks = safari_record.get("checks")
            tools = safari_record.get("actualTools")
            if (
                safari_record.get("schemaVersion") != SCHEMA_VERSION
                or safari_record.get("kind") != "personal-ui-real-safari-smoke"
                or safari_record.get("result") != "passed"
                or not isinstance(safari_details, dict)
                or safari_details.get("product") != "Safari"
                or str(safari_details.get("browserName", "")).lower() != "safari"
                or safari_details.get("version") != safari.get("version")
                or safari_details.get("majorVersion") != safari_major
                or safari_details.get("driver") != "safaridriver"
                or safari_details.get("realSafari") is not True
                or not isinstance(safari_checks, dict)
                or any(safari_checks.get(name) != "passed" for name in SAFARI_CHECKS)
                or not isinstance(tools, dict)
                or any(not isinstance(tools.get(name), str) or not tools[name] for name in ("node", "npm", "python", "safaridriver"))
            ):
                errors.append("qualityMatrix real Safari artifact is incomplete or synthetic")
            else:
                user_agent = safari_details.get("userAgent")
                if (
                    not isinstance(user_agent, str)
                    or "Version/" not in user_agent
                    or "Safari/" not in user_agent
                    or any(token in user_agent for token in ("Chrome/", "Chromium/", "CriOS/", "FxiOS/"))
                ):
                    errors.append("qualityMatrix real Safari artifact has an invalid user agent")
    axe = quality.get("axe")
    if not isinstance(axe, dict):
        errors.append("qualityMatrix.axe must be an object")
    else:
        if axe.get("result") != "passed" or axe.get("critical") != 0 or axe.get("serious") != 0:
            errors.append("qualityMatrix.axe must pass with zero critical or serious issues")
        axe_record = _json_artifact(
            axe.get("artifact"), "qualityMatrix.axe.artifact", errors, bundle_root
        )
        if axe_record is not None:
            axe_scenarios = axe_record.get("scenarios")
            axe_ids: list[object] = []
            axe_entries_valid = isinstance(axe_scenarios, list)
            if isinstance(axe_scenarios, list):
                for item in axe_scenarios:
                    if not isinstance(item, dict):
                        axe_entries_valid = False
                        continue
                    axe_ids.append(item.get("id"))
                    if item.get("critical") != 0 or item.get("serious") != 0:
                        axe_entries_valid = False
            if (
                axe_record.get("schemaVersion") != SCHEMA_VERSION
                or axe_record.get("kind") != "personal-ui-m8-axe-report"
                or axe_record.get("result") != "passed"
                or axe_record.get("candidate") != candidate_summary
                or axe_record.get("critical") != 0
                or axe_record.get("serious") != 0
                or not axe_entries_valid
                or axe_ids != list(M8_SCENARIOS)
            ):
                errors.append("qualityMatrix axe artifact is incomplete or unbound")
    artifacts = quality.get("artifacts")
    if not isinstance(artifacts, dict):
        errors.append("qualityMatrix.artifacts must be an object")
        artifacts = {}
    quality_records = {
        name: _json_artifact(
            artifacts.get(name), f"qualityMatrix.artifacts.{name}", errors, bundle_root
        )
        for name in QUALITY_ARTIFACTS
    }
    matrix = quality_records.get("matrix")
    if matrix is not None and (
        matrix.get("schemaVersion") != SCHEMA_VERSION
        or matrix.get("kind") != "personal-ui-m8-quality-matrix"
        or matrix.get("result") != "passed"
        or matrix.get("candidate") != candidate_summary
        or matrix.get("widths") != list(REQUIRED_WIDTHS)
        or matrix.get("engines") != list(REQUIRED_ENGINES)
        or matrix.get("scenarios") != list(M8_SCENARIOS)
    ):
        errors.append("qualityMatrix.artifacts.matrix is incomplete or unbound")
    versions = quality_records.get("browserVersions")
    if versions is not None:
        browser_entries = versions.get("browsers")
        projects: list[object] = []
        valid_versions = isinstance(browser_entries, list)
        if isinstance(browser_entries, list):
            for item in browser_entries:
                if not isinstance(item, dict):
                    valid_versions = False
                    continue
                projects.append(item.get("project"))
                if (
                    not isinstance(item.get("version"), str)
                    or not item["version"]
                    or item.get("realSafari") is not False
                ):
                    valid_versions = False
        if (
            versions.get("schemaVersion") != SCHEMA_VERSION
            or versions.get("kind") != "personal-ui-m8-browser-versions"
            or versions.get("candidate") != candidate_summary
            or not valid_versions
            or projects != list(REQUIRED_ENGINES)
        ):
            errors.append("qualityMatrix.artifacts.browserVersions lacks three actual engines")
    responsive = quality_records.get("responsiveReview")
    if responsive is not None and (
        responsive.get("schemaVersion") != SCHEMA_VERSION
        or responsive.get("kind") != "personal-ui-m8-responsive-review"
        or responsive.get("result") != "passed"
        or responsive.get("candidate") != candidate_summary
        or responsive.get("widths") != list(REQUIRED_WIDTHS)
        or responsive.get("scenarios") != list(M8_SCENARIOS)
    ):
        errors.append("qualityMatrix.artifacts.responsiveReview is incomplete or unbound")
    return errors


def _validate_review_bundle(
    evidence: Mapping[str, object],
    candidate: Mapping[str, object],
    bundle_root: Path | None,
) -> tuple[list[str], CandidateMaterials | None]:
    errors: list[str] = []
    review = evidence.get("reviewBundle")
    if not isinstance(review, dict):
        return ["reviewBundle must be a complete local RC review bundle"], None
    if review.get("result") != "passed":
        errors.append("reviewBundle.result must be 'passed'")
    artifacts = review.get("artifacts")
    if not isinstance(artifacts, dict):
        errors.append("reviewBundle.artifacts must be an object")
        artifacts = {}
    paths: dict[str, Path | None] = {}
    for name in REVIEW_BUNDLE_ARTIFACTS:
        paths[name] = _artifact_file(
            artifacts.get(name),
            f"reviewBundle.artifacts.{name}",
            errors,
            bundle_root,
        )
    descriptor_paths = [
        value.get("path")
        for value in artifacts.values()
        if isinstance(value, dict) and isinstance(value.get("path"), str)
    ]
    if len(descriptor_paths) != len(set(descriptor_paths)):
        errors.append("reviewBundle artifacts must reference distinct retained files")
    archive = candidate.get("archive")
    candidate_archive = artifacts.get("candidateArchive")
    if isinstance(archive, dict) and isinstance(candidate_archive, dict):
        if (
            archive.get("size") != candidate_archive.get("size")
            or archive.get("sha256") != candidate_archive.get("sha256")
        ):
            errors.append("reviewBundle candidate archive does not match the candidate binding")
    materials = _load_candidate_materials(paths.get("candidateArchive"), errors)
    if materials is not None:
        for name, candidate_path in CANDIDATE_REVIEW_FILES.items():
            retained = paths.get(name)
            expected = materials.files.get(candidate_path)
            if retained is None or expected is None or retained.read_bytes() != expected:
                errors.append(
                    f"reviewBundle.artifacts.{name} differs from the frozen candidate"
                )

    checksums = _artifact_text(paths.get("checksums"), "reviewBundle.artifacts.checksums", errors)
    if checksums is not None and isinstance(archive, dict):
        archive_path = archive.get("path")
        archive_name = (
            PurePosixPath(archive_path).name if isinstance(archive_path, str) else ""
        )
        archive_digest = archive.get("sha256")
        if (
            not isinstance(archive_digest, str)
            or archive_digest not in checksums
            or not archive_name
            or archive_name not in checksums
        ):
            errors.append("reviewBundle checksums do not bind the candidate archive")

    report_path = paths.get("independentConsumerReport")
    report = (
        _json_bytes(
            report_path.read_bytes(),
            "reviewBundle.artifacts.independentConsumerReport",
            errors,
        )
        if report_path is not None
        else None
    )
    if report is not None and (
        report.get("schemaVersion") != SCHEMA_VERSION
        or report.get("kind") != "personal-ui-m8-independent-consumer-report"
        or report.get("result") != "passed"
        or report.get("candidate") != _candidate_summary(candidate)
        or report.get("scenarios") != list(M8_SCENARIOS)
    ):
        errors.append("reviewBundle independentConsumerReport is incomplete or unbound")

    checklist_path = paths.get("releaseChecklist")
    checklist = (
        _json_bytes(
            checklist_path.read_bytes(),
            "reviewBundle.artifacts.releaseChecklist",
            errors,
        )
        if checklist_path is not None
        else None
    )
    if checklist is not None:
        required_checks = {"candidate", "migration", "quality", "review"}
        checks = checklist.get("checks")
        if (
            checklist.get("schemaVersion") != SCHEMA_VERSION
            or checklist.get("kind") != "personal-ui-m8-release-checklist"
            or checklist.get("result") != "passed"
            or checklist.get("candidate") != _candidate_summary(candidate)
            or not isinstance(checks, list)
            or set(checks) != required_checks
            or len(checks) != len(required_checks)
        ):
            errors.append("reviewBundle releaseChecklist is incomplete or unbound")

    _artifact_text(
        paths.get("knownLimitations"),
        "reviewBundle.artifacts.knownLimitations",
        errors,
    )
    _artifact_text(
        paths.get("previewInstructions"),
        "reviewBundle.artifacts.previewInstructions",
        errors,
    )
    return errors, materials


def validate_m8_evidence(
    evidence: object,
    *,
    expected_bindings: Mapping[str, object] | None = None,
    bundle_root: Path | None = None,
) -> M8EvidenceValidation:
    errors = _validate_top_level(evidence)
    if errors:
        return M8EvidenceValidation("invalid", tuple(errors))
    assert isinstance(evidence, dict)
    if expected_bindings is not None:
        binding_errors = [
            f"{key} does not match the release plan"
            for key in ("planDigest", "sourceCommit", "archiveSha256")
            if evidence.get(key) != expected_bindings.get(key)
        ]
        if binding_errors:
            return M8EvidenceValidation("binding-mismatch", tuple(binding_errors))
    if evidence.get("result") != "passed":
        return M8EvidenceValidation("not-passed", ("result is not 'passed'",))
    candidate_errors: list[str] = []
    candidate = _validate_candidate(evidence, candidate_errors)
    if candidate is None:
        return M8EvidenceValidation("invalid", tuple(candidate_errors))
    try:
        if bundle_root is not None and _traverses_link(bundle_root):
            return M8EvidenceValidation(
                "invalid", ("evidence bundle root must not be a link or junction",)
            )
        root = bundle_root.resolve(strict=True) if bundle_root is not None else None
        if root is not None and not root.is_dir():
            return M8EvidenceValidation("invalid", ("evidence bundle root must be a directory",))
    except OSError as error:
        return M8EvidenceValidation("invalid", (f"unable to resolve evidence bundle: {error}",))
    review_errors, materials = _validate_review_bundle(evidence, candidate, root)
    candidate_errors.extend(review_errors)
    candidate_errors.extend(_validate_scenarios(evidence, candidate, materials, root))
    candidate_errors.extend(_validate_migration(evidence, candidate, root))
    candidate_errors.extend(_validate_quality(evidence, candidate, root))
    if candidate_errors:
        return M8EvidenceValidation("invalid", tuple(candidate_errors))
    return M8EvidenceValidation("accepted")


def validate_m8_evidence_file(
    path: Path,
    *,
    expected_bindings: Mapping[str, object] | None = None,
    bundle_root: Path | None = None,
) -> M8EvidenceValidation:
    try:
        if _traverses_link(path):
            return M8EvidenceValidation(
                "invalid", ("evidence file must not be a link or junction",)
            )
        absolute = path.resolve(strict=True)
        evidence = json.loads(absolute.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        return M8EvidenceValidation("invalid", (f"unable to read evidence: {error}",))
    return validate_m8_evidence(
        evidence,
        expected_bindings=expected_bindings,
        bundle_root=bundle_root or absolute.parent,
    )


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("evidence", type=Path)
    parser.add_argument("--bundle-root", type=Path)
    parser.add_argument("--plan-digest")
    parser.add_argument("--source-commit")
    parser.add_argument("--archive-sha256")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    values = (args.plan_digest, args.source_commit, args.archive_sha256)
    if any(value is not None for value in values) and not all(value is not None for value in values):
        print("error: candidate binding arguments must be supplied together", file=sys.stderr)
        return 2
    bindings = None
    if all(value is not None for value in values):
        bindings = {
            "planDigest": args.plan_digest,
            "sourceCommit": args.source_commit,
            "archiveSha256": args.archive_sha256,
        }
    result = validate_m8_evidence_file(
        args.evidence,
        expected_bindings=bindings,
        bundle_root=args.bundle_root,
    )
    print(json.dumps(result.as_dict(), ensure_ascii=False, indent=2))
    return 0 if result.accepted else 2


if __name__ == "__main__":
    raise SystemExit(main())
