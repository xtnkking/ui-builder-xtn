#!/usr/bin/env python3
"""Validate artifact-backed hosted CI evidence for one release candidate."""

from __future__ import annotations

import argparse
import dataclasses
import hashlib
import json
import re
from pathlib import Path, PurePosixPath
from typing import Any, Mapping


SCHEMA_VERSION = 1
EVIDENCE_KIND = "personal-ui-release-evidence"
EVIDENCE_TYPE = "hosted-ci"
FIXTURE_KIND = "personal-ui-hosted-ci-fixture-evidence"
BROWSER_KIND = "personal-ui-hosted-ci-browser-evidence"
SAFARI_KIND = "personal-ui-hosted-ci-safari-evidence"
SHA256_PATTERN = re.compile(r"^[0-9a-f]{64}$")
COMMIT_PATTERN = re.compile(r"^[0-9a-f]{40}(?:[0-9a-f]{24})?$")
REQUIRED_BROWSER_PROJECTS = {"chromium", "firefox", "webkit"}
REQUIRED_BROWSER_OPERATIONS = [
    "browser-regressions",
    "accessibility",
    "visual-baseline",
    "version-inventory",
]
REQUIRED_SAFARI_CHECKS = {
    "documentReady",
    "rootRendered",
    "componentInteraction",
}


@dataclasses.dataclass(frozen=True)
class HostedCIEvidenceValidation:
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


def _is_sha256(value: object) -> bool:
    return isinstance(value, str) and SHA256_PATTERN.fullmatch(value) is not None


def _read_object(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"expected a JSON object: {path}")
    return value


def _fixture_index(catalog: Mapping[str, object]) -> dict[str, Mapping[str, object]]:
    fixtures = catalog.get("fixtures")
    if not isinstance(fixtures, list):
        raise ValueError("support fixture catalog has no fixtures array")
    result: dict[str, Mapping[str, object]] = {}
    for fixture in fixtures:
        if not isinstance(fixture, dict):
            raise ValueError("support fixture catalog contains a non-object fixture")
        fixture_id = fixture.get("id")
        if not isinstance(fixture_id, str) or not fixture_id or fixture_id in result:
            raise ValueError("support fixture catalog contains an invalid or duplicate id")
        result[fixture_id] = fixture
    if not result:
        raise ValueError("support fixture catalog is empty")
    return result


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
    if not _is_sha256(evidence.get("archiveSha256")):
        errors.append("archiveSha256 must be a lowercase SHA-256")
    source_commit = evidence.get("sourceCommit")
    if not isinstance(source_commit, str) or COMMIT_PATTERN.fullmatch(source_commit) is None:
        errors.append("sourceCommit must be a lowercase 40- or 64-character Git object id")
    if evidence.get("result") not in {"passed", "failed"}:
        errors.append("result must be 'passed' or 'failed'")
    workflow = evidence.get("workflow")
    if not isinstance(workflow, dict):
        errors.append("workflow must be an object")
    else:
        repository = workflow.get("repository")
        run_id = workflow.get("runId")
        workflow_ref = workflow.get("ref")
        if not isinstance(repository, str) or not repository:
            errors.append("workflow.repository must be a non-empty string")
        if (
            not isinstance(workflow_ref, str)
            or not isinstance(repository, str)
            or not workflow_ref.startswith(f"{repository}/.github/workflows/quality.yml@")
            or workflow_ref.endswith("@")
        ):
            errors.append("workflow.ref must identify .github/workflows/quality.yml")
        for field in ("runId", "runAttempt"):
            value = workflow.get(field)
            if not isinstance(value, int) or isinstance(value, bool) or value < 1:
                errors.append(f"workflow.{field} must be a positive integer")
        run_url = workflow.get("runUrl")
        expected_run_url = (
            f"https://github.com/{repository}/actions/runs/{run_id}"
            if isinstance(repository, str)
            and isinstance(run_id, int)
            and not isinstance(run_id, bool)
            and run_id > 0
            else None
        )
        if run_url != expected_run_url:
            errors.append("workflow.runUrl must match workflow.repository and workflow.runId")
        if workflow.get("sourceCommit") != source_commit:
            errors.append("workflow.sourceCommit must match sourceCommit")
        if workflow.get("event") not in {"pull_request", "push", "workflow_dispatch"}:
            errors.append("workflow.event must be pull_request, push, or workflow_dispatch")
    if not isinstance(evidence.get("artifacts"), list):
        errors.append("artifacts must be an array")
    return errors


def _artifact_path(root: Path, value: object) -> Path:
    if not isinstance(value, str) or not value:
        raise ValueError("artifact path must be a non-empty string")
    if "\\" in value:
        raise ValueError("artifact path must use POSIX separators")
    relative = PurePosixPath(value)
    if relative.is_absolute() or ".." in relative.parts or relative.parts[:1] != ("artifacts",):
        raise ValueError("artifact path must stay under artifacts/")
    candidate = root.joinpath(*relative.parts)
    current = root
    for part in relative.parts:
        current = current / part
        if current.is_symlink():
            raise ValueError("artifact path must not traverse a symbolic link")
    resolved_root = root.resolve()
    resolved = candidate.resolve()
    try:
        resolved.relative_to(resolved_root)
    except ValueError as error:
        raise ValueError("artifact path escapes the evidence bundle") from error
    return resolved


def _common_record_errors(
    record: Mapping[str, object],
    *,
    evidence: Mapping[str, object],
    label: str,
) -> list[str]:
    errors: list[str] = []
    workflow = evidence.get("workflow")
    assert isinstance(workflow, dict)
    expected = {
        "sourceCommit": evidence.get("sourceCommit"),
        "repository": workflow.get("repository"),
        "runId": workflow.get("runId"),
        "runAttempt": workflow.get("runAttempt"),
        "workflowRef": workflow.get("ref"),
        "event": workflow.get("event"),
        "runUrl": workflow.get("runUrl"),
        "result": "passed",
    }
    for field, value in expected.items():
        if record.get(field) != value:
            errors.append(f"{label}.{field} must equal {value!r}")
    runner = record.get("runner")
    if not isinstance(runner, dict):
        errors.append(f"{label}.runner must be an object")
    else:
        if runner.get("hosted") is not True:
            errors.append(f"{label}.runner.hosted must be true")
        for field in ("os", "architecture"):
            if not isinstance(runner.get(field), str) or not runner[field]:
                errors.append(f"{label}.runner.{field} must be a non-empty string")
    return errors


def _validate_fixture_record(
    record: Mapping[str, object],
    *,
    fixture: Mapping[str, object],
    evidence: Mapping[str, object],
    label: str,
) -> list[str]:
    errors = _common_record_errors(record, evidence=evidence, label=label)
    if record.get("schemaVersion") != SCHEMA_VERSION or record.get("kind") != FIXTURE_KIND:
        errors.append(f"{label} has an unsupported fixture evidence schema or kind")
    fixture_id = fixture.get("id")
    if record.get("fixtureId") != fixture_id:
        errors.append(f"{label}.fixtureId must equal {fixture_id!r}")
    ci = fixture.get("ci")
    environment = fixture.get("environment")
    if not isinstance(ci, dict) or not isinstance(environment, dict):
        return errors + [f"{label} fixture catalog entry is incomplete"]
    if record.get("jobId") != ci.get("job"):
        errors.append(f"{label}.jobId does not match the fixture CI job")
    required = fixture.get("operations")
    if record.get("requiredOperations") != required:
        errors.append(f"{label}.requiredOperations does not match the fixture catalog")
    if record.get("executedOperations") != required:
        errors.append(f"{label}.executedOperations must contain every required operation")
    if not _is_sha256(record.get("fixtureReportSha256")):
        errors.append(f"{label}.fixtureReportSha256 must be a lowercase SHA-256")

    actual = record.get("actualEnvironment")
    if not isinstance(actual, dict):
        return errors + [f"{label}.actualEnvironment must be an object"]
    expected_scalars = {
        "node": environment.get("node"),
        "react": environment.get("react"),
        "reactDom": environment.get("reactDom"),
        "typescript": environment.get("typescript"),
    }
    for field, expected in expected_scalars.items():
        if actual.get(field) != expected:
            errors.append(f"{label}.actualEnvironment.{field} must equal {expected!r}")
    if not isinstance(actual.get("python"), str) or not actual["python"]:
        errors.append(f"{label}.actualEnvironment.python must be a non-empty string")
    for field in ("packageManager", "framework"):
        expected = environment.get(field)
        if actual.get(field) != expected:
            errors.append(f"{label}.actualEnvironment.{field} must match the fixture catalog")
    return errors


def _validate_browser_record(
    record: Mapping[str, object], *, evidence: Mapping[str, object], label: str
) -> list[str]:
    errors = _common_record_errors(record, evidence=evidence, label=label)
    if record.get("schemaVersion") != SCHEMA_VERSION or record.get("kind") != BROWSER_KIND:
        errors.append(f"{label} has an unsupported browser evidence schema or kind")
    if record.get("jobId") != "browser-quality":
        errors.append(f"{label}.jobId must equal 'browser-quality'")
    if record.get("executedOperations") != REQUIRED_BROWSER_OPERATIONS:
        errors.append(f"{label}.executedOperations is incomplete")
    tools = record.get("actualTools")
    if not isinstance(tools, dict):
        errors.append(f"{label}.actualTools must be an object")
    else:
        for field in ("node", "npm", "python", "playwright"):
            if not isinstance(tools.get(field), str) or not tools[field]:
                errors.append(f"{label}.actualTools.{field} must be a non-empty string")
    browsers = record.get("browsers")
    if not isinstance(browsers, list):
        return errors + [f"{label}.browsers must be an array"]
    seen: set[str] = set()
    for index, browser in enumerate(browsers):
        browser_label = f"{label}.browsers[{index}]"
        if not isinstance(browser, dict):
            errors.append(f"{browser_label} must be an object")
            continue
        project = browser.get("project")
        if project not in REQUIRED_BROWSER_PROJECTS or project in seen:
            errors.append(f"{browser_label}.project is invalid or duplicated")
        else:
            seen.add(str(project))
        if not isinstance(browser.get("version"), str) or not browser["version"]:
            errors.append(f"{browser_label}.version must be a non-empty actual version")
        if browser.get("realSafari") is not False:
            errors.append(f"{browser_label}.realSafari must be false")
    if seen != REQUIRED_BROWSER_PROJECTS:
        errors.append(f"{label}.browsers must cover Chromium, Firefox, and WebKit")
    return errors


def _validate_safari_record(
    record: Mapping[str, object], *, evidence: Mapping[str, object], label: str
) -> list[str]:
    errors = _common_record_errors(record, evidence=evidence, label=label)
    if record.get("schemaVersion") != SCHEMA_VERSION or record.get("kind") != SAFARI_KIND:
        errors.append(f"{label} has an unsupported Safari evidence schema or kind")
    if record.get("jobId") != "safari-quality":
        errors.append(f"{label}.jobId must equal 'safari-quality'")
    safari = record.get("safari")
    if not isinstance(safari, dict):
        return errors + [f"{label}.safari must be an object"]
    product = str(safari.get("product", ""))
    driver = str(safari.get("driver", ""))
    browser_name = str(safari.get("browserName", ""))
    if product != "Safari" or browser_name.lower() != "safari":
        errors.append(f"{label} must identify the system Safari browser")
    if driver != "safaridriver":
        errors.append(f"{label}.safari.driver must equal 'safaridriver'")
    if safari.get("realSafari") is not True:
        errors.append(f"{label}.safari.realSafari must be true")
    if "playwright" in driver.lower() or "webkit" in product.lower():
        errors.append(f"{label} must not use Playwright WebKit as Safari evidence")
    version = safari.get("version")
    major = safari.get("majorVersion")
    if not isinstance(version, str) or not version:
        errors.append(f"{label}.safari.version must be a non-empty actual version")
    if not isinstance(major, int) or isinstance(major, bool) or major < 18:
        errors.append(f"{label}.safari.majorVersion must be at least 18")
    user_agent = safari.get("userAgent")
    if (
        not isinstance(user_agent, str)
        or "Safari/" not in user_agent
        or "Version/" not in user_agent
        or any(token in user_agent for token in ("Chrome/", "Chromium/", "CriOS/", "FxiOS/"))
    ):
        errors.append(f"{label}.safari.userAgent must identify real Safari")
    checks = record.get("checks")
    if not isinstance(checks, dict):
        errors.append(f"{label}.checks must be an object")
    else:
        for check in REQUIRED_SAFARI_CHECKS:
            if checks.get(check) != "passed":
                errors.append(f"{label}.checks.{check} must be 'passed'")
    tools = record.get("actualTools")
    if not isinstance(tools, dict):
        errors.append(f"{label}.actualTools must be an object")
    else:
        for field in ("node", "npm", "python", "safaridriver"):
            if not isinstance(tools.get(field), str) or not tools[field]:
                errors.append(f"{label}.actualTools.{field} must be a non-empty string")
    return errors


def validate_hosted_ci_evidence(
    evidence: object,
    *,
    evidence_root: Path,
    fixture_catalog: Mapping[str, object],
    expected_bindings: Mapping[str, object] | None = None,
) -> HostedCIEvidenceValidation:
    errors = _validate_top_level(evidence)
    if errors:
        return HostedCIEvidenceValidation("invalid", tuple(errors))
    assert isinstance(evidence, dict)
    if expected_bindings is not None:
        binding_errors = [
            f"{field} does not match the release plan"
            for field in ("planDigest", "sourceCommit", "archiveSha256")
            if evidence.get(field) != expected_bindings.get(field)
        ]
        if binding_errors:
            return HostedCIEvidenceValidation("binding-mismatch", tuple(binding_errors))
    if evidence.get("result") != "passed":
        return HostedCIEvidenceValidation("not-passed", ("result is not 'passed'",))
    try:
        fixtures = _fixture_index(fixture_catalog)
    except ValueError as error:
        return HostedCIEvidenceValidation("invalid", (str(error),))

    artifact_errors: list[str] = []
    semantic_errors: list[str] = []
    seen_keys: set[tuple[str, str]] = set()
    seen_fixtures: set[str] = set()
    seen_roles: set[str] = set()
    artifacts = evidence["artifacts"]
    assert isinstance(artifacts, list)
    for index, descriptor in enumerate(artifacts):
        label = f"artifacts[{index}]"
        if not isinstance(descriptor, dict):
            semantic_errors.append(f"{label} must be an object")
            continue
        role = descriptor.get("role")
        artifact_id = descriptor.get("id")
        if role not in {"fixture", "browser", "safari"} or not isinstance(artifact_id, str):
            semantic_errors.append(f"{label} has an invalid role or id")
            continue
        key = (str(role), artifact_id)
        if key in seen_keys:
            semantic_errors.append(f"duplicate hosted evidence artifact: {role}/{artifact_id}")
            continue
        seen_keys.add(key)
        try:
            path = _artifact_path(evidence_root, descriptor.get("path"))
            content = path.read_bytes()
        except (OSError, ValueError) as error:
            artifact_errors.append(f"{label}: {error}")
            continue
        if descriptor.get("size") != len(content):
            artifact_errors.append(f"{label}.size does not match artifact bytes")
        digest = hashlib.sha256(content).hexdigest()
        if descriptor.get("sha256") != digest:
            artifact_errors.append(f"{label}.sha256 does not match artifact bytes")
        try:
            record = json.loads(content.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            artifact_errors.append(f"{label} is not valid UTF-8 JSON: {error}")
            continue
        if not isinstance(record, dict):
            semantic_errors.append(f"{label} record must be an object")
            continue
        if role == "fixture":
            fixture = fixtures.get(artifact_id)
            if fixture is None:
                semantic_errors.append(f"{label} references unknown fixture {artifact_id!r}")
                continue
            seen_fixtures.add(artifact_id)
            semantic_errors.extend(
                _validate_fixture_record(record, fixture=fixture, evidence=evidence, label=label)
            )
        elif role == "browser":
            if artifact_id != "browser-quality":
                semantic_errors.append(f"{label}.id must equal 'browser-quality'")
            seen_roles.add("browser")
            semantic_errors.extend(_validate_browser_record(record, evidence=evidence, label=label))
        else:
            if artifact_id != "safari-quality":
                semantic_errors.append(f"{label}.id must equal 'safari-quality'")
            seen_roles.add("safari")
            semantic_errors.extend(_validate_safari_record(record, evidence=evidence, label=label))

    missing_fixtures = sorted(set(fixtures) - seen_fixtures)
    extra_fixtures = sorted(seen_fixtures - set(fixtures))
    if missing_fixtures:
        semantic_errors.append("missing hosted fixture evidence: " + ", ".join(missing_fixtures))
    if extra_fixtures:
        semantic_errors.append("unexpected hosted fixture evidence: " + ", ".join(extra_fixtures))
    if seen_roles != {"browser", "safari"}:
        semantic_errors.append("hosted evidence must contain browser-quality and safari-quality artifacts")
    expected_count = len(fixtures) + 2
    if len(artifacts) != expected_count:
        semantic_errors.append(f"hosted evidence must contain exactly {expected_count} artifacts")
    if artifact_errors:
        return HostedCIEvidenceValidation("artifact-mismatch", tuple(artifact_errors))
    if semantic_errors:
        return HostedCIEvidenceValidation("invalid", tuple(semantic_errors))
    return HostedCIEvidenceValidation("accepted")


def validate_hosted_ci_evidence_file(
    path: Path,
    *,
    fixture_catalog: Mapping[str, object] | Path,
    expected_bindings: Mapping[str, object] | None = None,
) -> HostedCIEvidenceValidation:
    try:
        evidence = _read_object(path)
        catalog = (
            _read_object(fixture_catalog)
            if isinstance(fixture_catalog, Path)
            else fixture_catalog
        )
    except (OSError, UnicodeDecodeError, json.JSONDecodeError, ValueError) as error:
        return HostedCIEvidenceValidation("invalid", (f"unable to read evidence: {error}",))
    return validate_hosted_ci_evidence(
        evidence,
        evidence_root=path.resolve().parent,
        fixture_catalog=catalog,
        expected_bindings=expected_bindings,
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("evidence", type=Path)
    parser.add_argument("--fixtures", type=Path, required=True)
    parser.add_argument("--plan-digest")
    parser.add_argument("--source-commit")
    parser.add_argument("--archive-sha256")
    args = parser.parse_args()
    binding_values = (args.plan_digest, args.source_commit, args.archive_sha256)
    if any(binding_values) and not all(binding_values):
        parser.error("all release binding arguments must be supplied together")
    expected = None
    if all(binding_values):
        expected = {
            "planDigest": args.plan_digest,
            "sourceCommit": args.source_commit,
            "archiveSha256": args.archive_sha256,
        }
    result = validate_hosted_ci_evidence_file(
        args.evidence,
        fixture_catalog=args.fixtures,
        expected_bindings=expected,
    )
    print(json.dumps(result.as_dict(), indent=2, sort_keys=True))
    return 0 if result.accepted else 1


if __name__ == "__main__":
    raise SystemExit(main())
