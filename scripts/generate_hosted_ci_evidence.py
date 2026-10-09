#!/usr/bin/env python3
"""Record and assemble artifact-backed GitHub Actions evidence."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import platform
import shutil
import subprocess
from pathlib import Path
from typing import Any, Mapping

import validate_hosted_ci_evidence as validator
import release_personal_ui as release


SKILL_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_FIXTURES = SKILL_ROOT / "references" / "support-fixtures.json"


def read_object(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"expected a JSON object: {path}")
    return value


def write_object(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def fixture_by_id(catalog: Mapping[str, object], fixture_id: str) -> Mapping[str, object]:
    fixtures = catalog.get("fixtures")
    if not isinstance(fixtures, list):
        raise ValueError("support fixture catalog has no fixtures array")
    for fixture in fixtures:
        if isinstance(fixture, dict) and fixture.get("id") == fixture_id:
            return fixture
    raise ValueError(f"unknown support fixture: {fixture_id}")


def required_environment(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise ValueError(f"required GitHub Actions environment variable is missing: {name}")
    return value


def positive_environment_integer(name: str) -> int:
    value = int(required_environment(name))
    if value < 1:
        raise ValueError(f"{name} must be a positive integer")
    return value


def github_context(*, expected_job: str) -> dict[str, object]:
    actual_job = required_environment("GITHUB_JOB")
    if actual_job != expected_job:
        raise ValueError(f"expected GitHub job {expected_job!r}, received {actual_job!r}")
    repository = required_environment("GITHUB_REPOSITORY")
    run_id = positive_environment_integer("GITHUB_RUN_ID")
    source_commit = required_environment("PUI_SOURCE_COMMIT").lower()
    if validator.COMMIT_PATTERN.fullmatch(source_commit) is None:
        raise ValueError("PUI_SOURCE_COMMIT must be a complete Git object id")
    return {
        "sourceCommit": source_commit,
        "repository": repository,
        "runId": run_id,
        "runAttempt": positive_environment_integer("GITHUB_RUN_ATTEMPT"),
        "workflowRef": required_environment("GITHUB_WORKFLOW_REF"),
        "event": required_environment("GITHUB_EVENT_NAME"),
        "runUrl": f"https://github.com/{repository}/actions/runs/{run_id}",
        "runner": {
            "hosted": True,
            "os": required_environment("RUNNER_OS"),
            "architecture": required_environment("RUNNER_ARCH"),
        },
    }


def command_version(command: list[str]) -> str:
    result = subprocess.run(
        command,
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(f"version command failed: {' '.join(command)}\n{result.stderr}")
    value = result.stdout.strip() or result.stderr.strip()
    if not value:
        raise RuntimeError(f"version command returned no output: {' '.join(command)}")
    return value


def record_fixture(
    *,
    fixture_id: str,
    report_path: Path,
    output: Path,
    fixture_catalog: Path = DEFAULT_FIXTURES,
) -> dict[str, object]:
    catalog = read_object(fixture_catalog)
    fixture = fixture_by_id(catalog, fixture_id)
    report = read_object(report_path)
    ci = fixture.get("ci")
    environment = fixture.get("environment")
    if not isinstance(ci, dict) or not isinstance(environment, dict):
        raise ValueError(f"fixture is incomplete: {fixture_id}")
    if report.get("fixtureId") != fixture_id or report.get("result") != "passed":
        raise ValueError("fixture report is not a passing report for the requested fixture")
    required_operations = fixture.get("operations")
    if report.get("executedOperations") != required_operations:
        raise ValueError("fixture report does not contain every required operation")
    actual = report.get("actualEnvironment")
    if not isinstance(actual, dict):
        raise ValueError("fixture report is missing actualEnvironment")
    record: dict[str, object] = {
        "schemaVersion": validator.SCHEMA_VERSION,
        "kind": validator.FIXTURE_KIND,
        "jobId": ci.get("job"),
        "fixtureId": fixture_id,
        **github_context(expected_job=str(ci.get("job"))),
        "requiredOperations": required_operations,
        "executedOperations": report.get("executedOperations"),
        "actualEnvironment": actual,
        "fixtureReportSha256": hashlib.sha256(report_path.read_bytes()).hexdigest(),
        "result": "passed",
    }
    write_object(output, record)
    return record


def record_browser(*, report_path: Path, output: Path) -> dict[str, object]:
    report = read_object(report_path)
    if report.get("schemaVersion") != 1 or report.get("evidenceKind") != "playwright-browser-version-inventory":
        raise ValueError("browser report schema or kind is unsupported")
    environment = report.get("environment")
    browsers = report.get("browsers")
    if not isinstance(environment, dict) or not isinstance(browsers, list):
        raise ValueError("browser report is incomplete")
    record: dict[str, object] = {
        "schemaVersion": validator.SCHEMA_VERSION,
        "kind": validator.BROWSER_KIND,
        "jobId": "browser-quality",
        **github_context(expected_job="browser-quality"),
        "executedOperations": validator.REQUIRED_BROWSER_OPERATIONS,
        "actualTools": {
            "node": str(environment.get("node", "")),
            "npm": command_version(["npm", "--version"]),
            "python": platform.python_version(),
            "playwright": str(environment.get("playwright", "")),
        },
        "browsers": browsers,
        "result": "passed",
    }
    write_object(output, record)
    return record


def record_safari(*, report_path: Path, output: Path) -> dict[str, object]:
    report = read_object(report_path)
    if (
        report.get("schemaVersion") != 1
        or report.get("kind") != "personal-ui-real-safari-smoke"
        or report.get("result") != "passed"
    ):
        raise ValueError("Safari report is not a passing real-Safari smoke report")
    safari = report.get("safari")
    checks = report.get("checks")
    actual_tools = report.get("actualTools")
    if not isinstance(safari, dict) or not isinstance(checks, dict) or not isinstance(actual_tools, dict):
        raise ValueError("Safari report is incomplete")
    record: dict[str, object] = {
        "schemaVersion": validator.SCHEMA_VERSION,
        "kind": validator.SAFARI_KIND,
        "jobId": "safari-quality",
        **github_context(expected_job="safari-quality"),
        "safari": safari,
        "checks": checks,
        "actualTools": actual_tools,
        "result": "passed",
    }
    write_object(output, record)
    return record


def _record_key(record: Mapping[str, object]) -> tuple[str, str]:
    kind = record.get("kind")
    if kind == validator.FIXTURE_KIND:
        fixture_id = record.get("fixtureId")
        if not isinstance(fixture_id, str) or not fixture_id:
            raise ValueError("fixture evidence has no fixtureId")
        return "fixture", fixture_id
    if kind == validator.BROWSER_KIND:
        return "browser", "browser-quality"
    if kind == validator.SAFARI_KIND:
        return "safari", "safari-quality"
    raise ValueError(f"unsupported hosted evidence input kind: {kind!r}")


def assemble_bundle(
    *,
    plan_path: Path,
    input_root: Path,
    output: Path,
    fixture_catalog: Path = DEFAULT_FIXTURES,
) -> dict[str, object]:
    plan = read_object(plan_path)
    try:
        release.validate_rc_release_plan(plan)
    except release.ReleaseError as error:
        raise ValueError(f"hosted evidence requires a trusted RC release plan: {error}") from error
    catalog = read_object(fixture_catalog)
    source = plan.get("source")
    artifacts = plan.get("artifacts")
    archive = artifacts.get("archive") if isinstance(artifacts, dict) else None
    if not isinstance(source, dict) or not isinstance(archive, dict):
        raise ValueError("release plan is missing source or archive bindings")

    inputs: dict[tuple[str, str], tuple[Path, dict[str, Any]]] = {}
    for path in sorted(input_root.rglob("*.json")):
        record = read_object(path)
        key = _record_key(record)
        if key in inputs:
            raise ValueError(f"duplicate hosted evidence input: {key[0]}/{key[1]}")
        inputs[key] = (path, record)
    if not inputs:
        raise ValueError("no hosted evidence inputs were found")

    fixture_ids = set(validator._fixture_index(catalog))
    expected_keys = {("fixture", fixture_id) for fixture_id in fixture_ids} | {
        ("browser", "browser-quality"),
        ("safari", "safari-quality"),
    }
    if set(inputs) != expected_keys:
        missing = sorted(expected_keys - set(inputs))
        extra = sorted(set(inputs) - expected_keys)
        raise ValueError(f"hosted evidence inputs are incomplete (missing={missing}, extra={extra})")

    first = next(iter(inputs.values()))[1]
    common_fields = (
        "sourceCommit",
        "repository",
        "runId",
        "runAttempt",
        "workflowRef",
        "event",
        "runUrl",
    )
    for _, record in inputs.values():
        for field in common_fields:
            if record.get(field) != first.get(field):
                raise ValueError(f"hosted evidence inputs disagree on {field}")
    if first.get("sourceCommit") != source.get("commit"):
        raise ValueError("hosted evidence source commit does not match the release plan")

    output = output.resolve()
    bundle_root = output.parent
    artifact_root = bundle_root / "artifacts"
    artifact_root.mkdir(parents=True, exist_ok=True)
    descriptors: list[dict[str, object]] = []
    for (role, artifact_id), (path, _record) in sorted(inputs.items()):
        destination_name = f"{role}-{artifact_id}.json"
        destination = artifact_root / destination_name
        content = path.read_bytes()
        destination.write_bytes(content)
        descriptors.append(
            {
                "role": role,
                "id": artifact_id,
                "path": f"artifacts/{destination_name}",
                "size": len(content),
                "sha256": hashlib.sha256(content).hexdigest(),
            }
        )

    evidence: dict[str, object] = {
        "schemaVersion": validator.SCHEMA_VERSION,
        "kind": validator.EVIDENCE_KIND,
        "type": validator.EVIDENCE_TYPE,
        "planDigest": plan.get("planDigest"),
        "sourceCommit": source.get("commit"),
        "archiveSha256": archive.get("sha256"),
        "workflow": {
            "repository": first.get("repository"),
            "ref": first.get("workflowRef"),
            "runId": first.get("runId"),
            "runAttempt": first.get("runAttempt"),
            "runUrl": first.get("runUrl"),
            "event": first.get("event"),
            "sourceCommit": first.get("sourceCommit"),
        },
        "artifacts": descriptors,
        "result": "passed",
    }
    result = validator.validate_hosted_ci_evidence(
        evidence,
        evidence_root=bundle_root,
        fixture_catalog=catalog,
        expected_bindings={
            "planDigest": plan.get("planDigest"),
            "sourceCommit": source.get("commit"),
            "archiveSha256": archive.get("sha256"),
        },
    )
    if not result.accepted:
        raise ValueError("assembled hosted evidence is invalid: " + "; ".join(result.errors))
    write_object(output, evidence)
    return evidence


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(description=__doc__)
    subparsers = root.add_subparsers(dest="command", required=True)

    fixture = subparsers.add_parser("record-fixture")
    fixture.add_argument("--fixture-id", required=True)
    fixture.add_argument("--report", type=Path, required=True)
    fixture.add_argument("--output", type=Path, required=True)
    fixture.add_argument("--fixtures", type=Path, default=DEFAULT_FIXTURES)

    browser = subparsers.add_parser("record-browser")
    browser.add_argument("--report", type=Path, required=True)
    browser.add_argument("--output", type=Path, required=True)

    safari = subparsers.add_parser("record-safari")
    safari.add_argument("--report", type=Path, required=True)
    safari.add_argument("--output", type=Path, required=True)

    assemble = subparsers.add_parser("assemble")
    assemble.add_argument("--plan", type=Path, required=True)
    assemble.add_argument("--input", type=Path, required=True)
    assemble.add_argument("--output", type=Path, required=True)
    assemble.add_argument("--fixtures", type=Path, default=DEFAULT_FIXTURES)
    return root


def main() -> int:
    args = parser().parse_args()
    try:
        if args.command == "record-fixture":
            result = record_fixture(
                fixture_id=args.fixture_id,
                report_path=args.report,
                output=args.output,
                fixture_catalog=args.fixtures,
            )
        elif args.command == "record-browser":
            result = record_browser(report_path=args.report, output=args.output)
        elif args.command == "record-safari":
            result = record_safari(report_path=args.report, output=args.output)
        else:
            result = assemble_bundle(
                plan_path=args.plan,
                input_root=args.input,
                output=args.output,
                fixture_catalog=args.fixtures,
            )
        print(json.dumps(result, indent=2, sort_keys=True))
        return 0
    except (OSError, RuntimeError, ValueError, json.JSONDecodeError) as error:
        print(f"error: {error}", file=os.sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
