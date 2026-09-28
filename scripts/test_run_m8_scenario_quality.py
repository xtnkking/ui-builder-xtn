#!/usr/bin/env python3
"""Focused contracts for the M8 per-scenario quality producer."""

from __future__ import annotations

import contextlib
import io
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import m8_evidence
import run_m8_quality as quality
import run_m8_scenario_quality as producer
import test_run_m8_quality as quality_fixtures
import validate_m8_evidence as validator


SCENARIO_ID = validator.M8_SCENARIOS[0]


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(quality.canonical_json(value))


def producer_plan(*, typecheck_exit: int = 0, behavior_module: str = "consumer/tests/m8-quality.mjs") -> dict[str, object]:
    def command(label: str, exit_code: int = 0) -> list[str]:
        return [
            sys.executable,
            "-c",
            f"print({label!r}); raise SystemExit({exit_code})",
        ]

    return {
        "schemaVersion": 1,
        "kind": producer.PLAN_KIND,
        "projectRoot": "consumer",
        "commands": {
            "typecheck": command("typecheck executed", typecheck_exit),
            "build": command("build executed"),
            "verifier": command("verifier executed"),
        },
        "browser": {
            "nodeArgv": ["node"],
            "serverArgv": ["node", "server.mjs"],
            "readyUrl": "http://127.0.0.1:4173/",
            "url": f"http://127.0.0.1:4173/{SCENARIO_ID}",
            "behaviorModule": behavior_module,
            "viewportHeight": 240,
            "serverTimeoutSeconds": 30,
            "actionTimeoutMs": 30000,
        },
    }


def make_producer_workspace(
    root: Path,
    *,
    typecheck_exit: int = 0,
    behavior_module: str = "consumer/tests/m8-quality.mjs",
) -> tuple[Path, Path, dict[str, object]]:
    binding = quality_fixtures.candidate_binding()
    workspace, _old_report = quality_fixtures.make_workspace(root, SCENARIO_ID, binding, 1)
    shutil.rmtree(workspace / "quality")
    behavior_path = workspace.joinpath(*behavior_module.split("/"))
    behavior_path.parent.mkdir(parents=True, exist_ok=True)
    behavior_path.write_text(
        "export async function runScenario() { return { result: 'passed' }; }\n",
        encoding="utf-8",
    )
    plan_path = workspace / "consumer/m8-quality-plan.json"
    write_json(
        plan_path,
        producer_plan(typecheck_exit=typecheck_exit, behavior_module=behavior_module),
    )
    return workspace, plan_path, binding


def fake_browser_worker(
    inputs: producer.ProducerInputs,
    *,
    omit: str | None = None,
    placeholder_screenshot: bool = False,
) -> producer.CommandCapture:
    producer.worker_config(inputs)
    capture = producer.execute_command(
        inputs,
        purpose="browser-quality",
        argv=[sys.executable, "-c", "print('browser-quality mock executed')"],
    )
    recorded_at = capture.started_at
    browser_products = {
        "chromium": "Playwright Chromium",
        "firefox": "Playwright Firefox",
        "webkit": "Playwright WebKit",
    }
    write_json(
        inputs.output_root / "browser-versions.raw.json",
        {
            "schemaVersion": 1,
            "evidenceKind": "playwright-browser-version-inventory",
            "recordedAt": recorded_at,
            "environment": {
                "node": "22.12.0",
                "platform": "win32",
                "architecture": "x64",
                "playwright": "1.55.1",
            },
            "browsers": [
                {
                    "project": engine,
                    "product": browser_products[engine],
                    "version": quality_fixtures.BROWSER_VERSIONS[engine],
                    "evidenceKind": "playwright-browser",
                    "realSafari": False,
                    "safariEvidence": False,
                }
                for engine in validator.REQUIRED_ENGINES
            ],
            "safari": {"acceptedFromThisReport": False},
        },
    )
    raw = inputs.output_root / "raw"
    raw.mkdir()
    for engine in validator.REQUIRED_ENGINES:
        for width in validator.REQUIRED_WIDTHS:
            stem = raw / f"{engine}-{width}"
            url = f"http://127.0.0.1:4173/{SCENARIO_ID}"
            artifacts: dict[str, tuple[Path, object | bytes]] = {
                "behavior": (
                    Path(f"{stem}-behavior.json"),
                    {
                        "schemaVersion": 1,
                        "kind": quality.BEHAVIOR_KIND,
                        "scenarioId": SCENARIO_ID,
                        "engine": engine,
                        "width": width,
                        "result": "passed",
                        "recordedAt": recorded_at,
                        "browserVersion": quality_fixtures.BROWSER_VERSIONS[engine],
                        "userAgent": quality_fixtures.USER_AGENTS[engine],
                        "url": url,
                        "deviceScaleFactor": 1,
                        "assertions": [
                            {"name": "consumer workflow completes", "result": "passed"}
                        ],
                    },
                ),
                "axe": (
                    Path(f"{stem}-axe.json"),
                    {
                        "testEngine": {"name": "axe-core", "version": "4.10.3"},
                        "testRunner": {"name": "axe"},
                        "timestamp": recorded_at,
                        "url": url,
                        "passes": [{"id": "document-title", "impact": "serious"}],
                        "incomplete": [],
                        "violations": [],
                    },
                ),
                "responsive": (
                    Path(f"{stem}-responsive.json"),
                    {
                        "schemaVersion": 1,
                        "kind": quality.RESPONSIVE_KIND,
                        "scenarioId": SCENARIO_ID,
                        "engine": engine,
                        "width": width,
                        "result": "passed",
                        "viewport": {"width": width, "height": 240},
                        "document": {
                            "documentElementClientWidth": width,
                            "documentElementScrollWidth": width,
                            "bodyClientWidth": width,
                            "bodyScrollWidth": width,
                        },
                        "pageHorizontalOverflow": False,
                        "assertions": [
                            {"name": "document has no horizontal overflow", "result": "passed"}
                        ],
                    },
                ),
                "screenshot": (
                    Path(f"{stem}.png"),
                    quality_fixtures.screenshot_png(
                        width, placeholder=placeholder_screenshot
                    ),
                ),
            }
            for role, (path, value) in artifacts.items():
                if omit == f"{engine}-{width}-{role}":
                    continue
                if isinstance(value, bytes):
                    path.write_bytes(value)
                else:
                    write_json(path, value)
    return capture


class M8ScenarioQualityProducerContracts(unittest.TestCase):
    def test_producer_report_is_accepted_unchanged_by_quality_validator(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pui-m8-scenario-producer-") as temporary:
            root = Path(temporary)
            workspace, plan_path, binding = make_producer_workspace(root)
            with mock.patch.object(
                producer,
                "run_browser_worker",
                side_effect=lambda inputs: fake_browser_worker(inputs),
            ):
                report_path = producer.produce_scenario_quality(
                    workspace=workspace,
                    plan=plan_path,
                    output=Path("quality"),
                )

            report = json.loads(report_path.read_text(encoding="utf-8"))
            self.assertEqual(
                [record["purpose"] for record in report["commands"]],
                list(producer.PURPOSES),
            )
            self.assertEqual(len(report["measurements"]), 18)
            self.assertFalse((workspace / "quality/failure.json").exists())
            for command in report["commands"]:
                self.assertEqual(command["exitCode"], 0)
                stdout = workspace.joinpath(*command["stdout"]["path"].split("/"))
                self.assertGreater(stdout.stat().st_size, 0)

            capture_path = workspace / "quality/command-captures/01-typecheck.json"
            with (
                mock.patch.object(m8_evidence, "record_command", return_value={}) as record,
                contextlib.redirect_stdout(io.StringIO()),
            ):
                self.assertEqual(
                    m8_evidence.main(
                        [
                            "record-command",
                            "--workspace",
                            str(workspace),
                            "--record",
                            str(capture_path),
                        ]
                    ),
                    0,
                )
            self.assertEqual(record.call_args.kwargs["cwd"], "consumer")
            self.assertEqual(
                record.call_args.kwargs["stdout"],
                workspace / "quality/logs/typecheck.stdout.log",
            )

            # Restore the source tree frozen by make_workspace before invoking the
            # unchanged aggregate validator. Producer output is outside the project.
            plan_path.unlink()
            (workspace / "consumer/tests/m8-quality.mjs").unlink()
            (workspace / "consumer/tests").rmdir()
            accepted = quality.validate_scenario_report(
                workspace, report_path, candidate_binding=binding
            )
            self.assertEqual(accepted.scenario_id, SCENARIO_ID)
            self.assertEqual(len(accepted.measurements), 18)

    def test_nonzero_static_command_writes_failure_without_passed_report(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pui-m8-scenario-command-fail-") as temporary:
            workspace, plan_path, _binding = make_producer_workspace(
                Path(temporary), typecheck_exit=7
            )
            with self.assertRaisesRegex(producer.ScenarioQualityError, "typecheck.*exit code 7"):
                producer.produce_scenario_quality(
                    workspace=workspace,
                    plan=plan_path,
                    output=Path("quality"),
                )
            self.assertTrue((workspace / "quality/failure.json").is_file())
            self.assertFalse((workspace / "quality/scenario-report.json").exists())
            failure = json.loads(
                (workspace / "quality/failure.json").read_text(encoding="utf-8")
            )
            self.assertEqual(failure["commands"][0]["exitCode"], 7)

    def test_successful_browser_process_cannot_replace_missing_or_tampered_raw_evidence(self) -> None:
        cases = (
            ("chromium-2560-screenshot", False, "does not exist"),
            (None, True, "near-blank placeholder"),
        )
        for index, (omit, placeholder, message) in enumerate(cases):
            with self.subTest(omit=omit, placeholder=placeholder):
                with tempfile.TemporaryDirectory(
                    prefix=f"pui-m8-scenario-browser-invalid-{index}-"
                ) as temporary:
                    workspace, plan_path, _binding = make_producer_workspace(Path(temporary))
                    with (
                        mock.patch.object(
                            producer,
                            "run_browser_worker",
                            side_effect=lambda inputs, omit=omit, placeholder=placeholder: fake_browser_worker(
                                inputs,
                                omit=omit,
                                placeholder_screenshot=placeholder,
                            ),
                        ),
                        self.assertRaisesRegex(producer.ScenarioQualityError, message),
                    ):
                        producer.produce_scenario_quality(
                            workspace=workspace,
                            plan=plan_path,
                            output=Path("quality"),
                        )
                    self.assertTrue((workspace / "quality/failure.json").is_file())
                    self.assertFalse((workspace / "quality/scenario-report.json").exists())

    def test_behavior_module_must_exist_inside_consumer_project(self) -> None:
        for behavior_module, create_outside, message in (
            ("consumer/tests/missing.mjs", False, "does not exist"),
            ("outside.mjs", True, "inside projectRoot"),
        ):
            with self.subTest(behavior_module=behavior_module):
                with tempfile.TemporaryDirectory(prefix="pui-m8-scenario-module-") as temporary:
                    root = Path(temporary)
                    workspace, plan_path, _binding = make_producer_workspace(root)
                    existing = workspace / "consumer/tests/m8-quality.mjs"
                    existing.unlink()
                    if create_outside:
                        (workspace / behavior_module).write_text(
                            "export async function runScenario() {}\n", encoding="utf-8"
                        )
                    write_json(plan_path, producer_plan(behavior_module=behavior_module))
                    with self.assertRaisesRegex(producer.ScenarioQualityError, message):
                        producer.produce_scenario_quality(
                            workspace=workspace,
                            plan=plan_path,
                            output=Path("quality"),
                        )
                    self.assertFalse((workspace / "quality").exists())

    def test_returned_passed_result_cannot_substitute_for_executed_checks(self) -> None:
        worker_url = producer.DEFAULT_WORKER.resolve().as_uri()
        script = f"""
          import {{ executeScenario }} from {json.dumps(worker_url)};
          try {{
            await executeScenario({{
              runScenario: async () => ({{ result: 'passed' }}),
              page: {{}}, expect: () => {{}}, engine: 'chromium', width: 320,
              url: 'http://127.0.0.1:4173/'
            }});
            process.exitCode = 2;
          }} catch (error) {{
            const message = error instanceof Error ? error.message : String(error);
            console.log(message);
            if (!message.includes('at least one check')) process.exitCode = 3;
          }}
        """
        completed = subprocess.run(
            ["node", "--input-type=module", "--eval", script],
            capture_output=True,
            text=True,
            encoding="utf-8",
            check=False,
        )
        self.assertEqual(completed.returncode, 0, completed.stderr)
        self.assertIn("at least one check", completed.stdout)


if __name__ == "__main__":
    unittest.main()
