#!/usr/bin/env python3
"""Focused contracts for the bounded R3 sampled-impact evidence policy."""

from __future__ import annotations

import copy
import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

import m8_impact_acceptance as impact
import run_m8_quality as quality
import test_validate_m8_evidence as evidence_fixture
import validate_m8_evidence as m8


START = "2026-10-10T00:00:00Z"
VERSIONS = {"chromium": "140.0.0", "firefox": "142.0.0", "webkit": "26.0.0"}


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(quality.canonical_json(value))


def candidate_plan(version: str, commit: str, marker: str) -> dict[str, object]:
    return {
        "candidateVersion": version,
        "planDigest": marker * 64,
        "source": {
            "commit": commit,
            "contentDigest": marker * 64,
            "sourceDateEpoch": 1_800_000_000,
        },
        "candidateContentDigest": marker * 64,
        "artifacts": {
            "archive": {
                "path": f"artifacts/ui-builder-xtn-{version}.zip",
                "size": 10,
                "sha256": marker * 64,
            }
        },
    }


def full_binding(plan: dict[str, object]) -> dict[str, object]:
    source = plan["source"]
    assert isinstance(source, dict)
    artifacts = plan["artifacts"]
    assert isinstance(artifacts, dict)
    return {
        "version": plan["candidateVersion"],
        "planDigest": plan["planDigest"],
        "sourceCommit": source["commit"],
        "sourceContentDigest": source["contentDigest"],
        "sourceDateEpoch": source["sourceDateEpoch"],
        "candidateContentDigest": plan["candidateContentDigest"],
        "archive": artifacts["archive"],
    }


def api_contract() -> bytes:
    return quality.canonical_json({
        "current": {
            "apiDigest": "a" * 64,
            "compatibilityDigest": "b" * 64,
            "runtimeExports": ["CodeBlock", "Dialog"],
            "typeOnlyExports": [],
            "publicSignatures": [],
        },
        "changes": [],
    })


class ImpactAcceptanceContracts(unittest.TestCase):
    def setUp(self) -> None:
        temporary = tempfile.TemporaryDirectory(prefix="pui-m8-impact-")
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.repository = self.root / "repository"
        self.repository.mkdir()
        self.origin_root = self.root / "origin-rc"
        self.target_root = self.root / "target-rc"
        self.origin_root.mkdir()
        self.target_root.mkdir()
        self.origin_plan = candidate_plan("0.3.1-rc.8", impact.ORIGIN_COMMIT, "1")
        self.target_plan = candidate_plan("0.3.1-rc.9", "a" * 40, "2")
        self.origin_binding = impact._binding(self.origin_plan)
        self.target_binding = impact._binding(self.target_plan)
        self.before = {
            "assets/react-kit/etc/personal-ui.api-compatibility.json": api_contract(),
            "assets/react-kit/src/personal-ui/display/display.tsx": b"export const display = 1;\n",
            "assets/react-kit/src/personal-ui/internal/layer-kernel.tsx": b"export const layer = 1;\n",
            "scripts/install_personal_ui.py": b"# fixture installer\n",
            "scripts/verify_personal_ui.py": b"# fixture verifier\n",
            "scripts/run_m8_scenario_quality.mjs": b"// fixture browser worker\n",
            "scripts/run_m8_scenario_quality.py": b"# fixture producer\n",
            "scripts/run_m8_quality.py": Path(quality.__file__).read_bytes(),
        }
        for name in impact.SOURCE_CHANGED - impact.MANAGED_CHANGED - {
            "scripts/m8_impact_acceptance.py", "scripts/test_m8_impact_acceptance.py"
        }:
            self.before[name] = f"{name}: before\n".encode("utf-8")
        self.after = dict(self.before)
        for name in impact.SOURCE_CHANGED - {
            "scripts/m8_impact_acceptance.py", "scripts/test_m8_impact_acceptance.py"
        }:
            self.after[name] = f"{name}: after\n".encode("utf-8")
        self.after["scripts/m8_impact_acceptance.py"] = b"# fixture impact validator\n"
        self.after["scripts/test_m8_impact_acceptance.py"] = b"# fixture regression\n"
        self.native_before = dict(self.before)
        self.native_after = dict(self.after)
        self._make_target_scripts()
        self.family_workspace = self.root / "family-workspace"
        self.family_workspace.mkdir()
        family_report = self.family_workspace / "quality-repair" / "scenario-report.json"
        failure = evidence_fixture.artifact(
            self.family_workspace,
            "quality-repair/failure.json",
            {"result": "failed", "error": "retained fixture first attempt"},
        )
        family_tool = self.root / "family-quality-exception.py"
        family_tool.write_text("# fixture narrowly scoped review\n", encoding="utf-8")
        tool_sha = impact._digest(family_tool.read_bytes())
        write_json(family_report, {
            "kind": quality.SCENARIO_REPORT_KIND,
            "result": "passed",
            "runId": "m8-family-fixture",
            "evidenceRecovery": {
                "originalGuardAttempt": "original-family-failure",
                "originalProducerExitCode": 8,
                "originalFailure": failure,
                "toolSha256": tool_sha,
            },
        })
        self.family_recovery = self.root / "family-recovery.json"
        write_json(self.family_recovery, {
            "schemaVersion": 1,
            "kind": "personal-ui-m8-family-quality-evidence-recovery",
            "result": "passed",
            "candidate": full_binding(self.origin_plan),
            "scenarioId": "family-login",
            "runId": "m8-family-fixture",
            "originalGuardAttempt": "original-family-failure",
            "originalProducerExitCode": 8,
            "originalFailure": failure,
            "recoveredReport": impact._descriptor(self.family_workspace, family_report),
            "toolRevision": {
                "path": str(family_tool),
                "sha256": tool_sha,
                "frozenQualitySha256": impact._digest(self.native_before["scripts/run_m8_quality.py"]),
                "frozenProducerSha256": impact._digest(self.native_before["scripts/run_m8_scenario_quality.py"]),
            },
        })
        self.migration = self.root / "origin-migration"
        self.migration.mkdir()
        write_json(self.migration / "artifact-inventory.json", {"candidate": self.origin_binding})
        write_json(self.migration / "migration-report.json", {
            "result": "passed",
            "candidate": self.origin_binding,
            "checks": {f"check-{index}": "passed" for index in range(15)},
            "commands": [{} for _ in range(20)],
        })
        self.ledger_path = self.root / "execution-state.json"
        self.ledger: dict[str, object] = {"steps": [], "history": []}
        self.capture_helper = self.root / "capture-evaluator-command.mjs"
        self.capture_helper.write_text("// fixture capture helper\n", encoding="utf-8")
        history = self.ledger["history"]
        assert isinstance(history, list)
        history.append({
            "id": "original-family-failure",
            "step": "remaining-r3-matrix-family-login-rc8",
            "status": "failed",
            "exitCode": 8,
            "argv": ["python", "run_m8_scenario_quality.py", "--output", "quality-repair"],
        })
        consumers = [self._make_consumer(scenario) for scenario in impact.SCENARIOS]
        write_json(self.ledger_path, self.ledger)
        self.report = {
            "schemaVersion": 1,
            "kind": impact.KIND,
            "policy": impact.POLICY,
            "result": "passed",
            "mode": "sampled-impact",
            "fullMatrixProven": False,
            "repository": str(self.repository),
            "executionLedger": str(self.ledger_path),
            "originCandidateRoot": str(self.origin_root),
            "targetCandidateRoot": str(self.target_root),
            "originCandidate": self.origin_binding,
            "candidate": self.target_binding,
            "sourceDelta": impact._delta(self.before, self.after),
            "candidateDelta": impact._delta(self.native_before, self.native_after),
            "family": {
                "workspace": str(self.family_workspace),
                "report": "quality-repair/scenario-report.json",
                "recoveryReceipt": str(self.family_recovery),
            },
            "migration": {"bundle": str(self.migration)},
            "targetConsumers": consumers,
            "selectedCells": impact._selected(),
            "unprovenCells": impact._unproven(),
            "limitations": {
                "fullMatrixProven": False,
                "newBlindEvaluation": False,
                "originMigrationAppliesToTarget": False,
                "unprovenCellCount": 60,
            },
        }
        self.report_path = self.root / "impact-report.json"

    def _make_target_scripts(self) -> None:
        staging = self.target_root / "staging" / "ui-builder-xtn" / "scripts"
        staging.mkdir(parents=True)
        for name in ("install_personal_ui.py", "verify_personal_ui.py", "run_m8_scenario_quality.mjs"):
            (staging / name).write_bytes(self.native_after[f"scripts/{name}"])
        self.installer = staging / "install_personal_ui.py"
        self.verifier = staging / "verify_personal_ui.py"
        self.worker = staging / "run_m8_scenario_quality.mjs"

    def _capture(self, workspace: Path, project: Path, name: str, argv: list[str], minute: int) -> str:
        logs = workspace / "consumer" / "logs"
        logs.mkdir(parents=True, exist_ok=True)
        stdout = logs / f"{name}.stdout.log"
        stderr = logs / f"{name}.stderr.log"
        stdout.write_text(f"{name} passed\n", encoding="utf-8")
        stderr.write_bytes(b"")
        relative = f"consumer/logs/{name}.json"
        write_json(workspace / relative, {
            "kind": "consumer-command-record",
            "argv": argv,
            "cwd": str(project),
            "startedAt": f"2026-10-10T00:0{minute}:00Z",
            "endedAt": f"2026-10-10T00:0{minute}:10Z",
            "exitCode": 0,
            "signal": None,
            "stdoutFile": str(stdout),
            "stderrFile": str(stderr),
        })
        action_id = f"capture-{workspace.name}-{name}"
        guard_stdout = workspace / "consumer" / "logs" / f"{name}.guard.stdout.log"
        guard_stderr = workspace / "consumer" / "logs" / f"{name}.guard.stderr.log"
        guard_stdout.write_text(
            json.dumps({"record": str(workspace / relative), "exitCode": 0, "signal": None, "spawnError": None}) + "\n",
            encoding="utf-8",
        )
        guard_stderr.write_bytes(b"")
        steps = self.ledger["steps"]
        history = self.ledger["history"]
        assert isinstance(steps, list) and isinstance(history, list)
        steps.append({"id": action_id, "status": "passed", "lastCommand": action_id})
        history.append({
            "id": action_id,
            "step": action_id,
            "status": "passed",
            "exitCode": 0,
            "argv": ["node", str(self.capture_helper), str(workspace), str(project), "--", *argv],
            "cwd": str(workspace),
            "startedAt": f"2026-10-10T00:0{minute}:00Z",
            "endedAt": f"2026-10-10T00:0{minute}:10Z",
            "stdout": str(guard_stdout),
            "stderr": str(guard_stderr),
        })
        return relative

    def _make_consumer(self, scenario: str) -> dict[str, object]:
        workspace = self.root / f"target-{scenario}"
        project = workspace / "consumer" / "project"
        project.mkdir(parents=True)
        run_id = f"m8-{scenario}-fixture"
        write_json(workspace / "visible-inputs.json", {
            "kind": "personal-ui-m8-evaluator-inputs",
            "candidate": full_binding(self.target_plan),
            "scenario": {"id": scenario},
            "run": {"id": run_id},
            "bundleLayout": {"consumerRoot": "consumer"},
        })
        write_json(workspace / "evidence" / "run-start.json", {
            "runId": run_id,
            "candidate": full_binding(self.target_plan),
            "startedAt": START,
        })
        source = project / "src" / "personal-ui"
        owned: dict[str, str] = {}
        for name, content in self.native_after.items():
            prefix = "assets/react-kit/src/personal-ui/"
            if not name.startswith(prefix):
                continue
            relative = name.removeprefix(prefix)
            path = source / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(content)
            owned[f"src/personal-ui/{relative}"] = impact._digest(content)
        write_json(project / "tools" / "personal-ui" / "install-state.json", {
            "version": self.target_plan["candidateVersion"],
            "packageRoot": ".",
            "sourceRoot": "src/personal-ui",
            "packageManager": "npm",
            "framework": "vite",
            "ownedFiles": owned,
        })
        behavior_module = project / "tests" / "m8-quality.mjs"
        behavior_module.parent.mkdir()
        behavior_module.write_text("export async function runScenario() {}\n", encoding="utf-8")
        static_argv = {
            "typecheck": ["node", "typecheck.mjs"],
            "build": ["node", "build.mjs"],
            "verifier": ["python", str(self.verifier), "--target", str(project)],
        }
        write_json(project / "m8-quality-plan.json", {
            "projectRoot": "consumer/project",
            "commands": static_argv,
            "browser": {"behaviorModule": "consumer/project/tests/m8-quality.mjs"},
        })
        captures = {
            "install": self._capture(workspace, project, "install", [
                "python", str(self.installer), "--mode", "integrate",
                "--project-root", str(project), "--package-root", ".",
                "--source-root", "src/personal-ui", "--package-manager", "npm",
                "--framework", "vite",
            ], 1),
            **{
                name: self._capture(workspace, project, name, argv, minute)
                for minute, (name, argv) in enumerate(static_argv.items(), start=2)
            },
        }
        output = workspace / "impact-quality"
        raw_root = output / "raw"
        raw_root.mkdir(parents=True)
        widths = [1440, 320] if scenario in {"member-crud", "searchable-table"} else [2560, 320]
        write_json(output / "browser-worker-config.json", {
            "scenarioId": scenario,
            "engines": list(m8.REQUIRED_ENGINES),
            "widths": widths,
            "outputRoot": str(output),
            "behaviorModule": str(behavior_module),
        })
        write_json(output / "browser-versions.raw.json", {"browsers": list(VERSIONS)})
        measurements = []
        for engine in m8.REQUIRED_ENGINES:
            for width in widths:
                stem = f"impact-quality/raw/{engine}-{width}"
                behavior = evidence_fixture.artifact(workspace, f"{stem}-behavior.json", {
                    "scenarioId": scenario,
                    "engine": engine,
                    "width": width,
                    "result": "passed",
                    "recordedAt": "2026-10-10T00:05:05Z",
                    "browserVersion": VERSIONS[engine],
                    "userAgent": f"{engine} fixture",
                    "url": "http://127.0.0.1:4173/",
                    "deviceScaleFactor": 1,
                    "assertions": [{"name": "workflow", "result": "passed"}],
                })
                axe = evidence_fixture.artifact(workspace, f"{stem}-axe.json", {"passes": [{"id": "document-title"}], "violations": [], "incomplete": []})
                responsive = evidence_fixture.artifact(workspace, f"{stem}-responsive.json", {"pageHorizontalOverflow": False})
                screenshot = evidence_fixture.artifact(workspace, f"{stem}.png", b"fixture screenshot")
                measurements.append({"engine": engine, "width": width, "behavior": behavior, "axe": axe, "responsive": responsive, "screenshot": screenshot})
        guard_step = f"guard-{scenario}"
        guard_action = f"action-{scenario}"
        guard_stdout = workspace / "guard.stdout.log"
        guard_stderr = workspace / "guard.stderr.log"
        guard_stdout.write_text("browser passed\n", encoding="utf-8")
        guard_stderr.write_bytes(b"")
        steps = self.ledger["steps"]
        history = self.ledger["history"]
        assert isinstance(steps, list) and isinstance(history, list)
        steps.append({"id": guard_step, "status": "passed", "lastCommand": guard_action})
        history.append({
            "id": guard_action,
            "step": guard_step,
            "status": "passed",
            "exitCode": 0,
            "argv": ["node", str(self.worker), "--config", str(output / "browser-worker-config.json")],
            "cwd": str(workspace),
            "startedAt": "2026-10-10T00:05:00Z",
            "endedAt": "2026-10-10T00:05:10Z",
            "stdout": str(guard_stdout),
            "stderr": str(guard_stderr),
        })
        return {
            "id": scenario,
            "workspace": str(workspace),
            "projectRoot": "consumer/project",
            "qualityRoot": "impact-quality",
            "captureRecords": captures,
            "guardStepId": guard_step,
            "measurements": measurements,
        }

    def _validate(self, report: dict[str, object] | None = None):
        write_json(self.report_path, self.report if report is None else report)
        def checked_candidate(root: Path, _repository: Path):
            if root == self.origin_root:
                return self.origin_plan, self.before, self.native_before
            if root == self.target_root:
                return self.target_plan, self.after, self.native_after
            raise AssertionError(f"unexpected candidate: {root}")
        def checked_measurement(_workspace: Path, measurement: dict[str, object], **_kwargs: object):
            return (measurement["engine"], measurement["width"]), measurement
        with (
            mock.patch.object(impact, "_candidate", side_effect=checked_candidate),
            mock.patch.object(quality, "validate_scenario_report", return_value=SimpleNamespace(scenario_id="family-login", measurements=[{}] * 18, run_id="m8-family-fixture")),
            mock.patch.object(impact.migration, "validate_artifact_inventory", return_value={"candidate": self.origin_binding}),
            mock.patch.object(quality, "_validate_browser_versions", return_value=tuple({"project": engine, "version": version} for engine, version in VERSIONS.items())),
            mock.patch.object(quality, "_validate_measurement", side_effect=checked_measurement),
        ):
            return impact.validate_impact_file(self.report_path, expected_plan=self.target_plan)

    def test_fixed_sample_passes_without_claiming_full_matrix(self) -> None:
        result = self._validate()
        self.assertTrue(result.accepted, result.errors)
        expected_cells = [
            {"scenarioId": scenario, "engine": engine, "width": width}
            for scenario in ("member-crud", "complex-form", "searchable-table", "detail-panel", "nested-modal")
            for engine in ("chromium", "firefox", "webkit")
            for width in ((1440, 320) if scenario in {"member-crud", "searchable-table"} else (2560, 320))
        ]
        self.assertEqual(self.report["selectedCells"], expected_cells)
        self.assertEqual(len(self.report["unprovenCells"]), 60)
        self.assertIs(self.report["fullMatrixProven"], False)

    def test_wrong_policy_or_candidate_binding_is_rejected(self) -> None:
        for change in (
            {"policy": "waiver"},
            {"fullMatrixProven": True},
            {"candidate": self.origin_binding},
        ):
            with self.subTest(change=change):
                report = copy.deepcopy(self.report)
                report.update(change)
                self.assertFalse(self._validate(report).accepted)

    def test_honest_but_unreviewed_source_change_is_rejected(self) -> None:
        original_after = self.after
        original_native = self.native_after
        self.after = {**original_after, "README.md": b"unreviewed source change\n"}
        self.native_after = {**original_native, "README.md": b"unreviewed source change\n"}
        try:
            report = copy.deepcopy(self.report)
            report["sourceDelta"] = impact._delta(self.before, self.after)
            report["candidateDelta"] = impact._delta(self.native_before, self.native_after)
            self.assertFalse(self._validate(report).accepted)
        finally:
            self.after = original_after
            self.native_after = original_native

    def test_changed_or_unrun_cell_cannot_inherit_an_origin_result(self) -> None:
        for change in ("omit-selected", "claim-unproven", "duplicate-measurement"):
            with self.subTest(change=change):
                report = copy.deepcopy(self.report)
                if change == "omit-selected":
                    report["selectedCells"].pop()
                elif change == "claim-unproven":
                    report["unprovenCells"].pop()
                else:
                    report["targetConsumers"][0]["measurements"][0] = report["targetConsumers"][0]["measurements"][1]
                self.assertFalse(self._validate(report).accepted)

    def test_forged_capture_and_wrong_installer_source_are_rejected(self) -> None:
        workspace = Path(self.report["targetConsumers"][0]["workspace"])
        capture = workspace / "consumer" / "logs" / "install.json"
        original = capture.read_bytes()
        wrong_installer = self.root / "wrong-install_personal_ui.py"
        wrong_installer.write_bytes(b"# unrelated installer\n")
        try:
            for mutation in ("kind", "installer"):
                with self.subTest(mutation=mutation):
                    document = json.loads(original)
                    if mutation == "kind":
                        document["kind"] = "handwritten-success"
                    else:
                        document["argv"][1] = str(wrong_installer)
                    write_json(capture, document)
                    self.assertFalse(self._validate().accepted)
        finally:
            capture.write_bytes(original)

    def test_guard_failure_and_missing_raw_cell_are_rejected(self) -> None:
        original_ledger = self.ledger_path.read_bytes()
        ledger = json.loads(original_ledger)
        ledger["steps"][0]["status"] = "failed"
        write_json(self.ledger_path, ledger)
        self.assertFalse(self._validate().accepted)
        self.ledger_path.write_bytes(original_ledger)
        report = copy.deepcopy(self.report)
        report["targetConsumers"][0]["measurements"].pop()
        self.assertFalse(self._validate(report).accepted)


if __name__ == "__main__":
    unittest.main()
