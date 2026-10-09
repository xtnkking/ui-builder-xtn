#!/usr/bin/env python3
"""Focused contracts for artifact-backed hosted CI evidence."""

from __future__ import annotations

import copy
import hashlib
import json
import tempfile
import unittest
from pathlib import Path

import generate_hosted_ci_evidence as generator
import release_personal_ui as release
import test_release_personal_ui as release_fixture
import validate_hosted_ci_evidence as validator


ROOT = Path(__file__).resolve().parents[1]
FIXTURES = json.loads((ROOT / "references/support-fixtures.json").read_text(encoding="utf-8"))
SOURCE_COMMIT = "a" * 40
PLAN_DIGEST = "b" * 64
ARCHIVE_SHA = "c" * 64
RUN_ID = 123456789
RUN_ATTEMPT = 2


def json_bytes(value: object) -> bytes:
    return (json.dumps(value, indent=2, sort_keys=True) + "\n").encode("utf-8")


def common_record(job_id: str) -> dict[str, object]:
    return {
        "jobId": job_id,
        "sourceCommit": SOURCE_COMMIT,
        "repository": "xtnkking/ui-builder-xtn",
        "runId": RUN_ID,
        "runAttempt": RUN_ATTEMPT,
        "workflowRef": "xtnkking/ui-builder-xtn/.github/workflows/quality.yml@refs/heads/main",
        "event": "push",
        "runUrl": f"https://github.com/xtnkking/ui-builder-xtn/actions/runs/{RUN_ID}",
        "runner": {"hosted": True, "os": "Linux", "architecture": "X64"},
        "result": "passed",
    }


def fixture_record(fixture: dict[str, object]) -> dict[str, object]:
    environment = fixture["environment"]
    ci = fixture["ci"]
    assert isinstance(environment, dict)
    assert isinstance(ci, dict)
    return {
        "schemaVersion": 1,
        "kind": validator.FIXTURE_KIND,
        **common_record(str(ci["job"])),
        "fixtureId": fixture["id"],
        "requiredOperations": fixture["operations"],
        "executedOperations": fixture["operations"],
        "actualEnvironment": {
            "node": environment["node"],
            "python": "3.13.7",
            "packageManager": environment["packageManager"],
            "react": environment["react"],
            "reactDom": environment["reactDom"],
            "typescript": environment["typescript"],
            "framework": environment["framework"],
        },
        "fixtureReportSha256": "d" * 64,
    }


def browser_record() -> dict[str, object]:
    return {
        "schemaVersion": 1,
        "kind": validator.BROWSER_KIND,
        **common_record("browser-quality"),
        "executedOperations": validator.REQUIRED_BROWSER_OPERATIONS,
        "actualTools": {
            "node": "22.12.0",
            "npm": "10.9.3",
            "python": "3.13.7",
            "playwright": "1.55.1",
        },
        "browsers": [
            {"project": "chromium", "product": "Playwright Chromium", "version": "140.0", "realSafari": False},
            {"project": "firefox", "product": "Playwright Firefox", "version": "141.0", "realSafari": False},
            {"project": "webkit", "product": "Playwright WebKit", "version": "26.0", "realSafari": False},
        ],
    }


def safari_record() -> dict[str, object]:
    return {
        "schemaVersion": 1,
        "kind": validator.SAFARI_KIND,
        **common_record("safari-quality"),
        "runner": {"hosted": True, "os": "macOS", "architecture": "ARM64"},
        "safari": {
            "product": "Safari",
            "browserName": "safari",
            "version": "18.6",
            "majorVersion": 18,
            "capabilityVersion": "18.6",
            "userAgent": "Mozilla/5.0 Version/18.6 Safari/605.1.15",
            "driver": "safaridriver",
            "realSafari": True,
        },
        "checks": {
            "documentReady": "passed",
            "rootRendered": "passed",
            "componentInteraction": "passed",
        },
        "actualTools": {
            "node": "22.12.0",
            "npm": "10.9.3",
            "python": "3.13.7",
            "safaridriver": "Included with Safari 18.6",
        },
    }


def create_bundle(root: Path) -> tuple[Path, dict[str, object]]:
    artifact_root = root / "artifacts"
    artifact_root.mkdir(parents=True)
    records: list[tuple[str, str, dict[str, object]]] = []
    for fixture in FIXTURES["fixtures"]:
        records.append(("fixture", fixture["id"], fixture_record(fixture)))
    records.extend(
        [
            ("browser", "browser-quality", browser_record()),
            ("safari", "safari-quality", safari_record()),
        ]
    )
    descriptors: list[dict[str, object]] = []
    for role, artifact_id, record in records:
        relative = f"artifacts/{role}-{artifact_id}.json"
        content = json_bytes(record)
        (root / relative).write_bytes(content)
        descriptors.append(
            {
                "role": role,
                "id": artifact_id,
                "path": relative,
                "size": len(content),
                "sha256": hashlib.sha256(content).hexdigest(),
            }
        )
    evidence: dict[str, object] = {
        "schemaVersion": 1,
        "kind": validator.EVIDENCE_KIND,
        "type": validator.EVIDENCE_TYPE,
        "planDigest": PLAN_DIGEST,
        "sourceCommit": SOURCE_COMMIT,
        "archiveSha256": ARCHIVE_SHA,
        "workflow": {
            "repository": "xtnkking/ui-builder-xtn",
            "ref": "xtnkking/ui-builder-xtn/.github/workflows/quality.yml@refs/heads/main",
            "runId": RUN_ID,
            "runAttempt": RUN_ATTEMPT,
            "runUrl": f"https://github.com/xtnkking/ui-builder-xtn/actions/runs/{RUN_ID}",
            "event": "push",
            "sourceCommit": SOURCE_COMMIT,
        },
        "artifacts": descriptors,
        "result": "passed",
    }
    path = root / "hosted-ci.json"
    path.write_bytes(json_bytes(evidence))
    return path, evidence


class HostedEvidenceContracts(unittest.TestCase):
    def validate(self, path: Path) -> validator.HostedCIEvidenceValidation:
        return validator.validate_hosted_ci_evidence_file(
            path,
            fixture_catalog=FIXTURES,
            expected_bindings={
                "planDigest": PLAN_DIGEST,
                "sourceCommit": SOURCE_COMMIT,
                "archiveSha256": ARCHIVE_SHA,
            },
        )

    def test_complete_artifact_backed_bundle_is_accepted(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pui-hosted-") as temporary:
            path, _ = create_bundle(Path(temporary))
            result = self.validate(path)
            self.assertTrue(result.accepted, result.errors)

    def test_thin_passed_json_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pui-hosted-") as temporary:
            path = Path(temporary) / "hosted-ci.json"
            path.write_bytes(
                json_bytes(
                    {
                        "schemaVersion": 1,
                        "kind": validator.EVIDENCE_KIND,
                        "type": validator.EVIDENCE_TYPE,
                        "planDigest": PLAN_DIGEST,
                        "sourceCommit": SOURCE_COMMIT,
                        "archiveSha256": ARCHIVE_SHA,
                        "result": "passed",
                    }
                )
            )
            self.assertEqual(self.validate(path).category, "invalid")

    def test_tampered_artifact_bytes_are_rejected(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pui-hosted-") as temporary:
            root = Path(temporary)
            path, evidence = create_bundle(root)
            descriptor = evidence["artifacts"][0]
            (root / descriptor["path"]).write_text("{}\n", encoding="utf-8")
            self.assertEqual(self.validate(path).category, "artifact-mismatch")

    def test_missing_fixture_and_operation_are_rejected(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pui-hosted-") as temporary:
            root = Path(temporary)
            path, evidence = create_bundle(root)
            descriptor = evidence["artifacts"].pop(0)
            path.write_bytes(json_bytes(evidence))
            result = self.validate(path)
            self.assertEqual(result.category, "invalid")
            self.assertTrue(any("missing hosted fixture evidence" in error for error in result.errors))

        with tempfile.TemporaryDirectory(prefix="pui-hosted-") as temporary:
            root = Path(temporary)
            path, evidence = create_bundle(root)
            descriptor = evidence["artifacts"][0]
            artifact = root / descriptor["path"]
            record = json.loads(artifact.read_text(encoding="utf-8"))
            record["executedOperations"] = record["executedOperations"][:-1]
            content = json_bytes(record)
            artifact.write_bytes(content)
            descriptor["size"] = len(content)
            descriptor["sha256"] = hashlib.sha256(content).hexdigest()
            path.write_bytes(json_bytes(evidence))
            result = self.validate(path)
            self.assertEqual(result.category, "invalid")
            self.assertTrue(any("executedOperations" in error for error in result.errors))

    def test_fixture_report_hash_is_required(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pui-hosted-") as temporary:
            root = Path(temporary)
            path, evidence = create_bundle(root)
            descriptor = evidence["artifacts"][0]
            artifact = root / descriptor["path"]
            record = json.loads(artifact.read_text(encoding="utf-8"))
            record["fixtureReportSha256"] = "not-a-digest"
            content = json_bytes(record)
            artifact.write_bytes(content)
            descriptor["size"] = len(content)
            descriptor["sha256"] = hashlib.sha256(content).hexdigest()
            path.write_bytes(json_bytes(evidence))
            result = self.validate(path)
            self.assertEqual(result.category, "invalid")
            self.assertTrue(any("fixtureReportSha256" in error for error in result.errors))

    def test_playwright_webkit_cannot_impersonate_real_safari(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pui-hosted-") as temporary:
            root = Path(temporary)
            path, evidence = create_bundle(root)
            descriptor = next(item for item in evidence["artifacts"] if item["role"] == "safari")
            artifact = root / descriptor["path"]
            record = json.loads(artifact.read_text(encoding="utf-8"))
            record["safari"].update(
                {
                    "product": "Playwright WebKit",
                    "browserName": "webkit",
                    "driver": "playwright-webkit",
                    "realSafari": False,
                }
            )
            content = json_bytes(record)
            artifact.write_bytes(content)
            descriptor["size"] = len(content)
            descriptor["sha256"] = hashlib.sha256(content).hexdigest()
            path.write_bytes(json_bytes(evidence))
            result = self.validate(path)
            self.assertEqual(result.category, "invalid")
            self.assertTrue(any("system Safari" in error for error in result.errors))

    def test_release_binding_mismatch_is_classified(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pui-hosted-") as temporary:
            path, _ = create_bundle(Path(temporary))
            result = validator.validate_hosted_ci_evidence_file(
                path,
                fixture_catalog=FIXTURES,
                expected_bindings={
                    "planDigest": "e" * 64,
                    "sourceCommit": SOURCE_COMMIT,
                    "archiveSha256": ARCHIVE_SHA,
                },
            )
            self.assertEqual(result.category, "binding-mismatch")

    def test_job_records_must_match_the_workflow_event_and_run_url(self) -> None:
        for field, replacement in (
            ("event", "workflow_dispatch"),
            ("runUrl", "https://github.com/xtnkking/ui-builder-xtn/actions/runs/999"),
        ):
            with self.subTest(field=field), tempfile.TemporaryDirectory(
                prefix="pui-hosted-"
            ) as temporary:
                root = Path(temporary)
                path, evidence = create_bundle(root)
                descriptor = evidence["artifacts"][0]
                artifact = root / descriptor["path"]
                record = json.loads(artifact.read_text(encoding="utf-8"))
                record[field] = replacement
                content = json_bytes(record)
                artifact.write_bytes(content)
                descriptor["size"] = len(content)
                descriptor["sha256"] = hashlib.sha256(content).hexdigest()
                path.write_bytes(json_bytes(evidence))
                result = self.validate(path)
                self.assertEqual(result.category, "invalid")
                self.assertTrue(any(f".{field}" in error for error in result.errors))

    def test_workflow_identity_must_be_internally_consistent(self) -> None:
        for field, replacement, error_fragment in (
            ("runUrl", "https://github.com/xtnkking/ui-builder-xtn/actions/runs/999", "workflow.runUrl"),
            ("event", "schedule", "workflow.event"),
            (
                "ref",
                "different/repository/.github/workflows/quality.yml@refs/heads/main",
                "workflow.ref",
            ),
        ):
            with self.subTest(field=field), tempfile.TemporaryDirectory(
                prefix="pui-hosted-"
            ) as temporary:
                root = Path(temporary)
                path, evidence = create_bundle(root)
                evidence["workflow"][field] = replacement
                path.write_bytes(json_bytes(evidence))
                result = self.validate(path)
                self.assertEqual(result.category, "invalid")
                self.assertTrue(any(error_fragment in error for error in result.errors))

    def test_assembler_copies_inputs_and_revalidates_bundle(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pui-hosted-") as temporary:
            root = Path(temporary)
            source_bundle = root / "source"
            _, evidence = create_bundle(source_bundle)
            inputs = root / "inputs"
            inputs.mkdir()
            for descriptor in evidence["artifacts"]:
                source = source_bundle / descriptor["path"]
                (inputs / source.name).write_bytes(source.read_bytes())
            plan, _, _, _ = release.build_release_plan(
                release_fixture.snapshot(
                    release_fixture.fixture_files(licensed=True), publishable_source=True
                ),
                candidate_version="0.3.0-rc.1",
            )
            plan_path = root / "plan.json"
            plan_path.write_bytes(json_bytes(plan))
            output = root / "assembled" / "hosted-ci.json"
            generator.assemble_bundle(
                plan_path=plan_path,
                input_root=inputs,
                output=output,
                fixture_catalog=ROOT / "references/support-fixtures.json",
            )
            result = validator.validate_hosted_ci_evidence_file(
                output,
                fixture_catalog=ROOT / "references/support-fixtures.json",
                expected_bindings={
                    "planDigest": plan["planDigest"],
                    "sourceCommit": plan["source"]["commit"],
                    "archiveSha256": plan["artifacts"]["archive"]["sha256"],
                },
            )
            self.assertTrue(result.accepted, result.errors)

    def test_next_patch_plan_is_exact_and_untrusted_plan_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pui-hosted-next-patch-") as temporary:
            root = Path(temporary)
            source_root = root / "source"
            source_path, evidence = create_bundle(source_root)
            original_source_bytes = source_path.read_bytes()
            inputs = root / "inputs"
            inputs.mkdir()
            for descriptor in evidence["artifacts"]:
                source = source_root / descriptor["path"]
                (inputs / source.name).write_bytes(source.read_bytes())
            plan, _, _, _ = release.build_release_plan(
                release_fixture.snapshot(
                    release_fixture.fixture_files(licensed=True, release_target="0.3.1"),
                    publishable_source=True,
                ),
                candidate_version="0.3.1-rc.2",
                existing_versions=["v0.3.0"],
            )
            plan_path = root / "plan.json"
            plan_path.write_bytes(json_bytes(plan))
            output = root / "assembled/hosted-ci.json"
            assembled = generator.assemble_bundle(
                plan_path=plan_path,
                input_root=inputs,
                output=output,
                fixture_catalog=ROOT / "references/support-fixtures.json",
            )
            self.assertEqual(assembled["planDigest"], plan["planDigest"])
            self.assertEqual(assembled["sourceCommit"], plan["source"]["commit"])
            self.assertEqual(assembled["archiveSha256"], plan["artifacts"]["archive"]["sha256"])
            self.assertEqual(assembled["workflow"]["runAttempt"], RUN_ATTEMPT)
            result = validator.validate_hosted_ci_evidence_file(
                output, fixture_catalog=ROOT / "references/support-fixtures.json",
                expected_bindings={
                    "planDigest": plan["planDigest"],
                    "sourceCommit": plan["source"]["commit"],
                    "archiveSha256": plan["artifacts"]["archive"]["sha256"],
                },
            )
            self.assertTrue(result.accepted, result.errors)
            for mutation in ("digest", "line", "formal", "source"):
                bad = copy.deepcopy(plan)
                if mutation == "digest":
                    bad["candidateVersion"] = "0.3.1-rc.999"
                elif mutation == "line":
                    bad["versionPolicy"]["releaseTarget"] = "0.4.0"
                elif mutation == "formal":
                    bad["verificationCommands"] = []
                else:
                    bad["source"]["commit"] = "d" * 40
                if mutation != "digest":
                    bad = release.attach_plan_digest(bad)
                plan_path.write_bytes(json_bytes(bad))
                rejected_output = root / "rejected" / mutation / "hosted-ci.json"
                with self.subTest(mutation=mutation), self.assertRaises(ValueError):
                    generator.assemble_bundle(
                        plan_path=plan_path, input_root=inputs, output=rejected_output,
                        fixture_catalog=ROOT / "references/support-fixtures.json",
                    )
                self.assertFalse(rejected_output.exists())
                self.assertEqual(source_path.read_bytes(), original_source_bytes)


if __name__ == "__main__":
    unittest.main()
