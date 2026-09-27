#!/usr/bin/env python3
"""Focused contracts for append-only M8 run evidence."""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

import m8_evidence as evidence
import run_m8_consumer as consumer
import test_run_m8_consumer as fixtures


TIMESTAMP = "2026-09-27T10:00:00Z"
ACTUAL_ENVIRONMENT = {
    "operatingSystem": "Windows 11",
    "architecture": "x64",
    "node": "22.12.0",
    "packageManager": "npm 10.9.3",
    "browser": "Chromium 140",
    "python": "3.13.7",
    "installerCommand": "python install_personal_ui.py install",
}
PASSED_CHECKS = {name: "passed" for name in evidence.CHECKS}


def workspace(root: Path, *, official: bool = True) -> Path:
    request = "Build a family login experience.\n"
    candidate, _ = fixtures.make_candidate(
        root,
        official=official,
        request_text=request,
    )
    catalog, _ = fixtures.make_catalog(root, request)
    output = root / "evaluator"
    consumer.create_evaluator_workspace(
        candidate=candidate,
        scenario_id=fixtures.SCENARIO_ID,
        output=output,
        rehearsal=not official,
        catalog_root=catalog,
    )
    return output


def acceptance_rules(root: Path) -> Path:
    path = root / "organizer-acceptance-rules.json"
    content = fixtures.source_files(licensed=True)["evaluation/m8/acceptance-rules.json"]
    path.write_bytes(content)
    return path


class M8AppendOnlyEvidenceContracts(unittest.TestCase):
    def test_full_first_pass_lifecycle_produces_scenario_fragment(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pui-m8-record-") as temporary:
            root = Path(temporary)
            output = workspace(root)
            project = output / "consumer" / "project"
            project.mkdir()
            (project / "app.tsx").write_text("export const App = () => null;\n", "utf-8")
            verification = output / "consumer" / "verification.json"
            verification.write_text('{"result":"passed"}\n', "utf-8")

            start = evidence.start_run(
                output,
                evaluator_id="fresh-agent-01",
                actual_environment=ACTUAL_ENVIRONMENT,
                started_at=TIMESTAMP,
            )
            recorded_commands: list[tuple[str, dict[str, object]]] = []
            for purpose in evidence.QUALITY_PURPOSES:
                stdout = output / "consumer" / f"{purpose}.stdout"
                stderr = output / "consumer" / f"{purpose}.stderr"
                stdout.write_text(f"{purpose} passed\n", "utf-8")
                stderr.write_bytes(b"")
                record = evidence.record_command(
                    output,
                    argv=["npm", "run", purpose],
                    cwd="consumer/project",
                    exit_code=0,
                    stdout=stdout,
                    stderr=stderr,
                    started_at=TIMESTAMP,
                    ended_at=TIMESTAMP,
                )
                recorded_commands.append((purpose, record))
            evidence.freeze_result(
                output,
                stage="initial",
                result="passed",
                source=project,
                verification=verification,
                checks=PASSED_CHECKS,
                frozen_at=TIMESTAMP,
            )
            wrong_rules = root / "wrong-rules.json"
            wrong_rules.write_text('{"kind":"wrong"}\n', "utf-8")
            with self.assertRaisesRegex(evidence.M8EvidenceError, "frozen candidate"):
                evidence.record_review(
                    output,
                    rules=wrong_rules,
                    result="passed",
                    attribution="none",
                    observations=["This must not be recorded."],
                    reviewed_at=TIMESTAMP,
                )
            evidence.record_review(
                output,
                rules=acceptance_rules(root),
                result="passed",
                attribution="none",
                observations=["All organizer rules passed."],
                reviewed_at=TIMESTAMP,
            )
            manifest = json.loads(
                (output / consumer.MANIFEST_NAME).read_text(encoding="utf-8")
            )
            report_commands = []
            for purpose, record in recorded_commands:
                report_commands.append(
                    {
                        "purpose": purpose,
                        **{
                            field: record[field]
                            for field in (
                                "argv",
                                "cwd",
                                "exitCode",
                                "startedAt",
                                "endedAt",
                                "stdout",
                                "stderr",
                            )
                        },
                    }
                )
            report = output / "quality" / "scenario-report.json"
            report.parent.mkdir()
            report.write_text(
                json.dumps(
                    {
                        "schemaVersion": 1,
                        "kind": evidence.QUALITY_REPORT_KIND,
                        "result": "passed",
                        "scenarioId": fixtures.SCENARIO_ID,
                        "runId": start["runId"],
                        "candidate": manifest["candidate"],
                        "commands": report_commands,
                    }
                )
                + "\n",
                encoding="utf-8",
            )
            quality_verification = evidence.build_quality_verification(
                output,
                scenario_report=report,
            )
            evidence.freeze_result(
                output,
                stage="final",
                result="passed",
                source=project,
                verification=output.joinpath(*evidence.QUALITY_VERIFICATION_PATH.parts),
                checks=PASSED_CHECKS,
                frozen_at=TIMESTAMP,
            )
            fragment = evidence.scenario_fragment(output, summary="Independent pass.")

            self.assertEqual(fragment["result"], "passed")
            self.assertEqual(fragment["run"]["runId"], start["runId"])
            self.assertEqual(len(fragment["run"]["commands"]), 4)
            self.assertEqual(fragment["run"]["repairs"], [])
            self.assertEqual(fragment["run"]["checks"], PASSED_CHECKS)
            self.assertEqual(
                quality_verification["scenarioReport"]["sha256"],
                evidence.release.sha256_bytes(report.read_bytes()),
            )

    def test_records_are_create_once_and_repairs_are_contiguous(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pui-m8-record-") as temporary:
            root = Path(temporary)
            output = workspace(root)
            project = output / "consumer" / "project"
            project.mkdir()
            (project / "app.tsx").write_text("before\n", "utf-8")
            stdout = output / "consumer" / "stdout.log"
            stderr = output / "consumer" / "stderr.log"
            stdout.write_text("failed\n", "utf-8")
            stderr.write_text("error\n", "utf-8")
            verification = output / "consumer" / "verification.json"
            verification.write_text('{"result":"failed"}\n', "utf-8")
            evidence.start_run(
                output,
                evaluator_id="fresh-agent-02",
                actual_environment=ACTUAL_ENVIRONMENT,
                started_at=TIMESTAMP,
            )
            with self.assertRaisesRegex(evidence.M8EvidenceError, "already exists"):
                evidence.start_run(
                    output,
                    evaluator_id="fresh-agent-02",
                    actual_environment=ACTUAL_ENVIRONMENT,
                    started_at=TIMESTAMP,
                )
            evidence.record_command(
                output,
                argv=["npm", "test"],
                cwd="consumer/project",
                exit_code=1,
                stdout=stdout,
                stderr=stderr,
                started_at=TIMESTAMP,
                ended_at=TIMESTAMP,
            )
            failed_checks = dict(PASSED_CHECKS)
            failed_checks["behavior"] = "failed"
            evidence.freeze_result(
                output,
                stage="initial",
                result="failed",
                source=project,
                verification=verification,
                checks=failed_checks,
                frozen_at=TIMESTAMP,
            )
            evidence.record_review(
                output,
                rules=acceptance_rules(root),
                result="failed",
                attribution="consumer-omission",
                observations=["The consumer omitted the retry path."],
                reviewed_at=TIMESTAMP,
            )
            diff = output / "consumer" / "repair.diff"
            repair_verification = output / "consumer" / "repair-verification.json"
            diff.write_text("diff --git a/app.tsx b/app.tsx\n", "utf-8")
            repair_verification.write_text('{"result":"passed"}\n', "utf-8")
            record = evidence.record_repair(
                output,
                attribution="consumer-omission",
                reason="Add the missing retry path.",
                changed_files=["app.tsx"],
                candidate_changed=False,
                diff=diff,
                verification=repair_verification,
                recorded_at=TIMESTAMP,
            )
            self.assertEqual(record["sequence"], 1)

    def test_rehearsal_workspace_cannot_start_acceptance_evidence(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pui-m8-record-") as temporary:
            output = workspace(Path(temporary), official=False)
            with self.assertRaisesRegex(evidence.M8EvidenceError, "rehearsal"):
                evidence.start_run(
                    output,
                    evaluator_id="fresh-agent-03",
                    actual_environment=ACTUAL_ENVIRONMENT,
                )

    def test_passed_result_rejects_failed_checks_before_writing_artifacts(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pui-m8-record-") as temporary:
            root = Path(temporary)
            output = workspace(root)
            project = output / "consumer" / "project"
            project.mkdir()
            (project / "app.tsx").write_text("export const App = () => null;\n", "utf-8")
            verification = output / "consumer" / "verification.json"
            verification.write_text('{"result":"passed"}\n', "utf-8")
            evidence.start_run(
                output,
                evaluator_id="fresh-agent-04",
                actual_environment=ACTUAL_ENVIRONMENT,
                started_at=TIMESTAMP,
            )
            inconsistent = dict(PASSED_CHECKS)
            inconsistent["behavior"] = "failed"
            with self.assertRaisesRegex(evidence.M8EvidenceError, "every check"):
                evidence.freeze_result(
                    output,
                    stage="initial",
                    result="passed",
                    source=project,
                    verification=verification,
                    checks=inconsistent,
                    frozen_at=TIMESTAMP,
                )
            self.assertFalse((output / "evidence" / "initial").exists())


if __name__ == "__main__":
    unittest.main()
