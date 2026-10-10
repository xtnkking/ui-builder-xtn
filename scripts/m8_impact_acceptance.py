#!/usr/bin/env python3
"""Validate the bounded RC.8-to-next-RC M8 sampled-impact acceptance record.

This is deliberately a different evidence kind from complete M8 acceptance. It
does not turn failed RC.8 producers into passing cells or claim a new blind run.
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import re
import sys
from pathlib import Path, PurePosixPath
from typing import Any, Mapping, Sequence

import m8_evidence_continuity as continuity
import release_personal_ui as release
import run_m8_migration as migration
import run_m8_quality as quality
import validate_m8_evidence as m8


KIND = "personal-ui-m8-impact-acceptance"
POLICY = "r3-sampled-impact-2026-10-10-v1"
ORIGIN_COMMIT = "9580f396d3e089775b64bee996f03e3ba78b8855"
SCENARIOS = tuple(item for item in m8.M8_SCENARIOS if item != "family-login")
SOURCE_CHANGED = frozenset({
    "CHANGELOG.md",
    "assets/react-kit/component-manifest.json",
    "assets/react-kit/package.json",
    "assets/react-kit/src/explorer/cases/data/code-block.case.tsx",
    "assets/react-kit/src/explorer/cases/overlay/dialog.case.tsx",
    "assets/react-kit/src/personal-ui/display/display.tsx",
    "assets/react-kit/src/personal-ui/internal/layer-kernel.tsx",
    "assets/react-kit/tests/a11y/m6-export-ownership.spec.ts",
    "assets/react-kit/tests/browser/modal-layer-kernel.spec.ts",
    "assets/react-kit/tests/components/display-contracts.test.tsx",
    "assets/react-kit/tests/components/layer-kernel-contracts.test.tsx",
    "references/component-api.md",
    "references/m5-keyboard-contracts.md",
    "references/overlay-contract.md",
    "references/release-process.md",
    "scripts/release_personal_ui.py",
    "scripts/test_release_personal_ui.py",
    "scripts/m8_impact_acceptance.py",
    "scripts/test_m8_impact_acceptance.py",
})
MANAGED_CHANGED = frozenset({
    "assets/react-kit/src/personal-ui/display/display.tsx",
    "assets/react-kit/src/personal-ui/internal/layer-kernel.tsx",
})
CHECKS = ("install", "typecheck", "build", "verifier")
SHA256 = re.compile(r"[0-9a-f]{64}\Z")
FAMILY_EXCEPTION_NAMES = frozenset({
    "Flow credential rejection, stable pending, duplicate prevention",
    "Pulse credential rejection, stable pending, duplicate prevention",
})
FAMILY_NAME_LABEL = re.compile(
    r"family-login (?:chromium|firefox|webkit)/(?:2560|1440|1024|736|360|320) "
    r"assertions\[[0-9]+\]\.name\Z"
)


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise release.ReleaseError(message)


def _json(path: Path, label: str) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    _require(isinstance(value, dict), f"{label} must be a JSON object")
    return value


def _path(value: object, label: str, *, directory: bool = False) -> Path:
    _require(isinstance(value, str) and bool(value), f"{label} must be a path")
    path = quality._absolute_without_links(Path(value), label=label, must_exist=True)
    _require(path.is_dir() if directory else path.is_file(), f"{label} is not a regular {'directory' if directory else 'file'}")
    return path


def _relative_file(root: Path, value: object, label: str) -> Path:
    relative = quality._safe_relative(value, label=label)
    return quality._safe_workspace_file(root, relative, label=label)


def _same_or_inside(path: Path, root: Path) -> bool:
    try:
        path.relative_to(root)
        return True
    except ValueError:
        return False


def _digest(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def _descriptor(root: Path, path: Path) -> dict[str, object]:
    content = path.read_bytes()
    return {"path": path.relative_to(root).as_posix(), "size": len(content), "sha256": _digest(content)}


def _delta(before: Mapping[str, bytes], after: Mapping[str, bytes]) -> list[dict[str, object]]:
    result: list[dict[str, object]] = []
    for path in sorted(set(before) | set(after)):
        old, new = before.get(path), after.get(path)
        if old == new:
            continue
        result.append({
            "path": path,
            "before": None if old is None else {"size": len(old), "sha256": _digest(old)},
            "after": None if new is None else {"size": len(new), "sha256": _digest(new)},
        })
    return result


def _binding(plan: Mapping[str, object]) -> dict[str, object]:
    return continuity._binding(plan)


def _candidate(root: Path, repository: Path) -> tuple[dict[str, Any], dict[str, bytes], dict[str, bytes]]:
    plan, journal = release.load_candidate(root)
    continuity._verified_rc(plan, journal)
    source = plan["source"]
    commit = source["commit"]
    _require(release._git(repository, "rev-parse", commit + "^{tree}") == source["tree"], "candidate Git tree mismatch")
    _require(int(release._git(repository, "show", "-s", "--format=%ct", commit)) == source["sourceDateEpoch"], "candidate Git epoch mismatch")
    files = release.collect_commit_files(repository, commit)
    staged = release.collect_staged_files(root)
    release.verify_candidate_files(plan, staged)
    release.verify_artifact_bundle(root, plan, staged)
    archive = root / plan["artifacts"]["archive"]["path"]
    native = continuity._native_files(plan, files, archive)
    _require(staged == native, "candidate staging differs from its deterministic archive")
    return plan, files, native


def _cell(scenario: str, engine: str, width: int) -> dict[str, object]:
    return {"scenarioId": scenario, "engine": engine, "width": width}


def _selected() -> list[dict[str, object]]:
    return [
        _cell(scenario, engine, width)
        for scenario in SCENARIOS
        for engine in m8.REQUIRED_ENGINES
        for width in ((1440, 320) if scenario in {"member-crud", "searchable-table"} else (2560, 320))
    ]


def _unproven() -> list[dict[str, object]]:
    selected = {(item["scenarioId"], item["engine"], item["width"]) for item in _selected()}
    return [
        _cell(scenario, engine, width)
        for scenario in SCENARIOS
        for engine in m8.REQUIRED_ENGINES
        for width in m8.REQUIRED_WIDTHS
        if (scenario, engine, width) not in selected
    ]


def _source_policy(source_delta: Sequence[Mapping[str, object]], native_delta: Sequence[Mapping[str, object]], old: Mapping[str, bytes], new: Mapping[str, bytes]) -> None:
    _require(all(item["after"] is not None for item in source_delta), "impact source cannot remove files")
    changed = {str(item["path"]) for item in source_delta}
    _require(changed == SOURCE_CHANGED, f"impact source paths differ from reviewed repair: missing={sorted(SOURCE_CHANGED - changed)}, extra={sorted(changed - SOURCE_CHANGED)}")
    additions = {str(item["path"]) for item in source_delta if item["before"] is None}
    _require(additions == {"scripts/m8_impact_acceptance.py", "scripts/test_m8_impact_acceptance.py"}, "impact tool additions differ from reviewed repair")
    managed = {
        str(item["path"]) for item in source_delta
        if str(item["path"]).startswith("assets/react-kit/src/personal-ui/")
    }
    _require(managed == MANAGED_CHANGED, "impact managed source delta is not the two reviewed repairs")
    old_api = json.loads(old["assets/react-kit/etc/personal-ui.api-compatibility.json"])
    new_api = json.loads(new["assets/react-kit/etc/personal-ui.api-compatibility.json"])
    for field in ("apiDigest", "compatibilityDigest", "runtimeExports", "typeOnlyExports", "publicSignatures"):
        _require(old_api["current"][field] == new_api["current"][field], f"public API {field} changed")
    _require(old_api["changes"] == new_api["changes"], "public API changes differ")
    native_managed = {
        str(item["path"]) for item in native_delta
        if str(item["path"]).startswith("assets/react-kit/src/personal-ui/")
    }
    _require(native_managed == MANAGED_CHANGED, "packaged managed delta differs from reviewed source")


def _origin_evidence(record: Mapping[str, object], origin_plan: Mapping[str, object], origin_native: Mapping[str, bytes], ledger: Mapping[str, object], ledger_path: Path) -> None:
    family = record.get("family")
    migration_item = record.get("migration")
    _require(isinstance(family, dict) and isinstance(migration_item, dict), "origin family and migration are required")
    workspace = _path(family.get("workspace"), "family.workspace", directory=True)
    report = quality._safe_relative(family.get("report"), label="family.report")
    expected = {
        "version": origin_plan["candidateVersion"],
        "planDigest": origin_plan["planDigest"],
        "sourceCommit": origin_plan["source"]["commit"],
        "sourceContentDigest": origin_plan["source"]["contentDigest"],
        "sourceDateEpoch": origin_plan["source"]["sourceDateEpoch"],
        "candidateContentDigest": origin_plan["candidateContentDigest"],
        "archive": origin_plan["artifacts"]["archive"],
    }
    receipt_path = _path(family.get("recoveryReceipt"), "family recovery receipt")
    _require(receipt_path.parent == ledger_path.parent, "family recovery receipt is outside the execution organizer")
    receipt = _json(receipt_path, "family recovery receipt")
    recovery = _json(_relative_file(workspace, report.as_posix(), "family recovered report"), "family recovered report")
    revision = receipt.get("toolRevision")
    tool = _path(revision.get("path") if isinstance(revision, dict) else None, "family exception tool")
    _require(tool.parent == ledger_path.parent, "family exception tool is outside the execution organizer")
    history = ledger.get("history")
    original_id = receipt.get("originalGuardAttempt")
    original = [row for row in history if isinstance(row, dict) and row.get("id") == original_id] if isinstance(history, list) else []
    _require(
        receipt.get("schemaVersion") == 1
        and receipt.get("kind") == "personal-ui-m8-family-quality-evidence-recovery"
        and receipt.get("result") == "passed"
        and receipt.get("candidate") == expected
        and receipt.get("scenarioId") == "family-login"
        and receipt.get("runId") == recovery.get("runId")
        and receipt.get("recoveredReport") == _descriptor(workspace, workspace.joinpath(*report.parts))
        and isinstance(revision, dict)
        and Path(str(revision.get("path"))) == tool
        and revision.get("sha256") == _digest(tool.read_bytes())
        and revision.get("frozenQualitySha256") == _digest(origin_native["scripts/run_m8_quality.py"])
        and revision.get("frozenProducerSha256") == _digest(origin_native["scripts/run_m8_scenario_quality.py"])
        and _digest(Path(quality.__file__).read_bytes()) == revision.get("frozenQualitySha256"),
        "origin family recovery receipt, binding, or tool revision differs from retained evidence",
    )
    failure = receipt.get("originalFailure")
    _require(isinstance(failure, dict) and failure == _descriptor(workspace, _relative_file(workspace, failure.get("path"), "family original failure")), "origin family original failure bytes differ")
    _require(
        len(original) == 1 and original[0].get("step") == "remaining-r3-matrix-family-login-rc8"
        and original[0].get("status") == "failed" and original[0].get("exitCode") == 8
        and receipt.get("originalProducerExitCode") == 8
        and isinstance(original[0].get("argv"), list) and original[0]["argv"][-1:] == ["quality-repair"]
        and recovery.get("evidenceRecovery", {}).get("originalGuardAttempt") == original_id
        and recovery["evidenceRecovery"].get("originalProducerExitCode") == 8
        and recovery["evidenceRecovery"].get("originalFailure") == failure
        and recovery["evidenceRecovery"].get("toolSha256") == revision["sha256"],
        "origin family failed producer or narrow recovery record is not retained",
    )
    actual_text = quality._actual_text

    def exact_family_name(value: object, *, label: str) -> str:
        if isinstance(value, str) and value in FAMILY_EXCEPTION_NAMES and FAMILY_NAME_LABEL.fullmatch(label):
            return value
        return actual_text(value, label=label)

    try:
        quality._actual_text = exact_family_name
        checked = quality.validate_scenario_report(workspace, Path(report.as_posix()), candidate_binding=expected)
    finally:
        quality._actual_text = actual_text
    _require(checked.scenario_id == "family-login" and len(checked.measurements) == 18, "origin family is not a complete passing RC.8 run")
    bundle = _path(migration_item.get("bundle"), "migration.bundle", directory=True)
    inventory = migration.validate_artifact_inventory(bundle / "artifact-inventory.json")
    report_doc = _json(bundle / "migration-report.json", "migration report")
    _require(inventory.get("candidate") == _binding(origin_plan), "origin migration candidate mismatch")
    _require(report_doc.get("result") == "passed" and report_doc.get("candidate") == _binding(origin_plan), "origin migration is not passed and bound")
    checks = report_doc.get("checks")
    _require(isinstance(checks, dict) and len(checks) >= 15 and all(value == "passed" for value in checks.values()), "origin migration checks are incomplete")
    _require(isinstance(report_doc.get("commands"), list) and len(report_doc["commands"]) == 20, "origin migration commands are incomplete")


def _capture(workspace: Path, record_path: object, run_started: dt.datetime, project: Path, label: str, ledger: Mapping[str, object], ledger_path: Path) -> tuple[dict[str, Any], dt.datetime]:
    path = _relative_file(workspace, record_path, f"{label} capture")
    record = _json(path, f"{label} capture")
    _require(record.get("kind") == "consumer-command-record" and record.get("exitCode") == 0 and record.get("signal") is None, f"{label} capture is not a passing helper record")
    argv = record.get("argv")
    _require(isinstance(argv, list) and argv and all(isinstance(arg, str) and arg for arg in argv), f"{label} argv invalid")
    cwd = _path(record.get("cwd"), f"{label} cwd", directory=True)
    _require(_same_or_inside(cwd, project), f"{label} cwd is outside project")
    started = quality._timestamp(record.get("startedAt"), label=f"{label} startedAt")
    ended = quality._timestamp(record.get("endedAt"), label=f"{label} endedAt")
    _require(run_started <= started <= ended, f"{label} command predates run-start")
    for stream in ("stdoutFile", "stderrFile"):
        output = _path(record.get(stream), f"{label} {stream}")
        _require(_same_or_inside(output, workspace / "consumer" / "logs"), f"{label} {stream} is outside captured logs")
    history, steps = ledger.get("history"), ledger.get("steps")
    _require(isinstance(history, list) and isinstance(steps, list), "execution ledger has no capture provenance")
    helper = _path(str(ledger_path.parent / "capture-evaluator-command.mjs"), "capture helper")
    matches = []
    for action in history:
        if not isinstance(action, dict):
            continue
        command = action.get("argv")
        if not isinstance(command, list) or len(command) != len(argv) + 5:
            continue
        if not (
            Path(str(command[1])) == helper
            and Path(str(command[2])) == workspace and Path(str(command[3])) == project
            and command[4] == "--" and command[5:] == argv
            and action.get("status") == "passed" and action.get("exitCode") == 0
        ):
            continue
        matching_steps = [step for step in steps if isinstance(step, dict) and step.get("id") == action.get("step") and step.get("status") == "passed" and step.get("lastCommand") == action.get("id")]
        if len(matching_steps) != 1:
            continue
        action_started = quality._timestamp(action.get("startedAt"), label=f"{label} guard startedAt")
        action_ended = quality._timestamp(action.get("endedAt"), label=f"{label} guard endedAt")
        if not action_started <= started <= ended <= action_ended:
            continue
        stdout = _path(action.get("stdout"), f"{label} guard stdout")
        _path(action.get("stderr"), f"{label} guard stderr")
        lines = stdout.read_text(encoding="utf-8").splitlines()
        if not lines:
            continue
        try:
            final = json.loads(lines[-1])
        except json.JSONDecodeError:
            continue
        if final == {"record": str(path), "exitCode": 0, "signal": None, "spawnError": None}:
            matches.append(action)
    _require(len(matches) == 1, f"{label} capture lacks one passed guard action and matching helper log")
    return record, ended


def _installed_target(project: Path, native: Mapping[str, bytes], version: str) -> dict[str, Any]:
    states = [path for path in project.rglob("install-state.json") if path.parts[-3:] == ("tools", "personal-ui", "install-state.json")]
    _require(len(states) == 1, "target consumer needs exactly one install-state")
    state_path = states[0]
    state = _json(state_path, "target install-state")
    _require(state.get("version") == version, "installed kit version differs from target")
    package_root = state_path.parent.parent.parent
    package_relative = package_root.relative_to(project).as_posix() or "."
    _require(state.get("packageRoot") == package_relative, "install-state package root differs from target project")
    source_root = quality._safe_relative(state.get("sourceRoot"), label="install-state sourceRoot")
    source = package_root.joinpath(*source_root.parts)
    _require(_same_or_inside(source, project), "installed source is outside consumer project")
    expected = {
        name.removeprefix("assets/react-kit/src/personal-ui/"): content
        for name, content in native.items() if name.startswith("assets/react-kit/src/personal-ui/")
    }
    _require(expected, "target candidate has no managed kit")
    for relative, content in expected.items():
        path = quality._safe_workspace_file(source, PurePosixPath(relative), label="installed managed source")
        _require(path.read_bytes() == content, f"installed managed source differs from target: {relative}")
    owned = state.get("ownedFiles")
    _require(isinstance(owned, dict), "install-state ownedFiles is missing")
    for relative, digest in owned.items():
        file = quality._safe_workspace_file(package_root, quality._safe_relative(relative, label="owned file"), label="owned file")
        _require(_digest(file.read_bytes()) == digest, f"installed owned file hash mismatch: {relative}")
    return state


def _guard_window(ledger: Mapping[str, object], step_id: object, workspace: Path, config: Path, worker: bytes) -> tuple[dt.datetime, dt.datetime]:
    steps, history = ledger.get("steps"), ledger.get("history")
    _require(isinstance(steps, list) and isinstance(history, list), "execution ledger has no steps/history")
    matches = [step for step in steps if isinstance(step, dict) and step.get("id") == step_id]
    _require(len(matches) == 1 and matches[0].get("status") == "passed", "guard browser step is not uniquely passed")
    step = matches[0]
    actions = [item for item in history if isinstance(item, dict) and item.get("id") == step.get("lastCommand") and item.get("step") == step_id]
    _require(len(actions) == 1 and actions[0].get("status") == "passed" and actions[0].get("exitCode") == 0, "guard browser history is not passed")
    action = actions[0]
    argv = action.get("argv")
    _require(isinstance(argv, list) and str(config) in argv, "guard browser argv does not name the frozen config")
    worker_paths = [Path(arg) for arg in argv if isinstance(arg, str) and arg.endswith("run_m8_scenario_quality.mjs")]
    _require(len(worker_paths) == 1 and _path(str(worker_paths[0]), "guard worker").read_bytes() == worker, "guard did not run target worker bytes")
    _require(_same_or_inside(_path(action.get("cwd"), "guard cwd", directory=True), workspace) or str(action.get("cwd")).endswith("_organizer"), "guard browser cwd is unrelated")
    for name in ("stdout", "stderr"):
        _path(action.get(name), f"guard {name}")
    started = quality._timestamp(action.get("startedAt"), label="guard startedAt")
    ended = quality._timestamp(action.get("endedAt"), label="guard endedAt")
    _require(started <= ended, "guard browser time order invalid")
    return started, ended


def _consumer(item: Mapping[str, object], plan: Mapping[str, object], native: Mapping[str, bytes], ledger: Mapping[str, object], ledger_path: Path) -> None:
    scenario = item.get("id")
    _require(scenario in SCENARIOS, "unknown target consumer")
    workspace = _path(item.get("workspace"), f"{scenario} workspace", directory=True)
    manifest = _json(workspace / "visible-inputs.json", f"{scenario} visible inputs")
    start = _json(workspace / "evidence" / "run-start.json", f"{scenario} run-start")
    run = manifest.get("run")
    _require(manifest.get("kind") == "personal-ui-m8-evaluator-inputs" and manifest.get("candidate") == {
        "version": plan["candidateVersion"], "planDigest": plan["planDigest"],
        "sourceCommit": plan["source"]["commit"], "sourceContentDigest": plan["source"]["contentDigest"],
        "sourceDateEpoch": plan["source"]["sourceDateEpoch"], "candidateContentDigest": plan["candidateContentDigest"],
        "archive": plan["artifacts"]["archive"],
    }, f"{scenario} visible candidate is not target")
    _require(isinstance(run, dict) and manifest.get("scenario", {}).get("id") == scenario and start.get("runId") == run.get("id") and start.get("candidate") == manifest["candidate"], f"{scenario} target run-start mismatch")
    run_started = quality._timestamp(start.get("startedAt"), label=f"{scenario} run startedAt")
    layout = manifest.get("bundleLayout")
    consumer_relative = quality._safe_relative(layout.get("consumerRoot") if isinstance(layout, dict) else None, label=f"{scenario} consumer root")
    consumer_root = quality._safe_workspace_directory(workspace, consumer_relative, label=f"{scenario} consumer root")
    project_relative = quality._safe_relative(item.get("projectRoot"), label=f"{scenario} project root")
    project = quality._safe_workspace_directory(workspace, project_relative, label=f"{scenario} project")
    _require(_same_or_inside(project, consumer_root), f"{scenario} project is outside consumer root")
    install_state = _installed_target(project, native, str(plan["candidateVersion"]))
    plan_doc = _json(project / "m8-quality-plan.json", f"{scenario} quality plan")
    _require(plan_doc.get("projectRoot") == project_relative.as_posix(), f"{scenario} quality plan project root mismatch")
    captures = item.get("captureRecords")
    _require(isinstance(captures, dict) and set(captures) == set(CHECKS), f"{scenario} capture set is incomplete")
    records: dict[str, dict[str, Any]] = {}
    last = run_started
    for name in CHECKS:
        record, ended = _capture(workspace, captures[name], last, project, f"{scenario} {name}", ledger, ledger_path)
        records[name] = record
        last = ended
    installer = [Path(arg) for arg in records["install"]["argv"] if isinstance(arg, str) and arg.endswith("install_personal_ui.py")]
    _require(len(installer) == 1 and _path(str(installer[0]), "target installer").read_bytes() == native["scripts/install_personal_ui.py"], f"{scenario} installer is not from target")
    install_argv = records["install"]["argv"]
    _require(
        len(install_argv) == 14 and install_argv[1] == str(installer[0])
        and install_argv[2:5] == ["--mode", "integrate", "--project-root"]
        and Path(install_argv[5]) == project
        and install_argv[6:] == [
            "--package-root", install_state.get("packageRoot"),
            "--source-root", install_state.get("sourceRoot"),
            "--package-manager", install_state.get("packageManager"),
            "--framework", install_state.get("framework"),
        ],
        f"{scenario} installer command did not target its recorded project and package",
    )
    verifier = [Path(arg) for arg in records["verifier"]["argv"] if isinstance(arg, str) and arg.endswith("verify_personal_ui.py")]
    _require(len(verifier) == 1 and _path(str(verifier[0]), "target verifier").read_bytes() == native["scripts/verify_personal_ui.py"], f"{scenario} verifier is not from target")
    commands = plan_doc.get("commands")
    _require(isinstance(commands, dict) and all(records[name]["argv"] == commands.get(name) for name in ("typecheck", "build", "verifier")), f"{scenario} static captures differ from quality plan")
    output_relative = quality._safe_relative(item.get("qualityRoot"), label=f"{scenario} qualityRoot")
    output = quality._safe_workspace_directory(workspace, output_relative, label=f"{scenario} quality output")
    config_path = output / "browser-worker-config.json"
    config = _json(config_path, f"{scenario} worker config")
    widths = [1440, 320] if scenario in {"member-crud", "searchable-table"} else [2560, 320]
    _require(config.get("scenarioId") == scenario and config.get("engines") == list(m8.REQUIRED_ENGINES) and config.get("widths") == widths and Path(str(config.get("outputRoot"))) == output, f"{scenario} worker selected cells differ from policy")
    browser = plan_doc.get("browser")
    _require(isinstance(browser, dict) and Path(str(config.get("behaviorModule"))) == workspace / browser.get("behaviorModule", ""), f"{scenario} worker behavior module differs from quality plan")
    window = _guard_window(ledger, item.get("guardStepId"), workspace, config_path, native["scripts/run_m8_scenario_quality.mjs"])
    _require(window[0] >= last, f"{scenario} browser step predates static captures")
    versions_descriptor = _descriptor(workspace, output / "browser-versions.raw.json")
    versions = quality._validate_browser_versions(workspace, versions_descriptor, scenario_id=scenario, windows=[window], retained={})
    version_map = {str(entry["project"]): str(entry["version"]) for entry in versions}
    measurements = item.get("measurements")
    _require(isinstance(measurements, list) and len(measurements) == 6, f"{scenario} must retain six selected measurements")
    expected = {(engine, width) for engine in m8.REQUIRED_ENGINES for width in widths}
    seen: set[tuple[str, int]] = set()
    used_paths: set[str] = set()
    for measurement in measurements:
        _require(isinstance(measurement, dict), f"{scenario} measurement is invalid")
        engine, width = measurement.get("engine"), measurement.get("width")
        _require((engine, width) in expected and (engine, width) not in seen, f"{scenario} has an extra or duplicate cell")
        seen.add((engine, width))
        stem = output / "raw" / f"{engine}-{width}"
        artifacts = {
            "behavior": Path(f"{stem}-behavior.json"), "axe": Path(f"{stem}-axe.json"),
            "responsive": Path(f"{stem}-responsive.json"), "screenshot": Path(f"{stem}.png"),
        }
        for name, path in artifacts.items():
            _require(measurement.get(name) == _descriptor(workspace, path), f"{scenario} {engine}/{width} {name} descriptor differs from raw bytes")
        behavior = _json(artifacts["behavior"], "behavior raw")
        raw = {
            "engine": engine, "width": width, "result": "passed", "recordedAt": behavior.get("recordedAt"),
            "browserVersion": behavior.get("browserVersion"), "userAgent": behavior.get("userAgent"),
            "url": behavior.get("url"), "deviceScaleFactor": behavior.get("deviceScaleFactor"),
            "checks": {name: "passed" for name in quality.CHECKS},
            "behavior": {"result": "passed", "assertionCount": len(behavior.get("assertions", [])), "artifact": measurement["behavior"]},
            "axe": {"result": "passed", "critical": 0, "serious": 0, "artifact": measurement["axe"]},
            "responsive": {"result": "passed", "pageHorizontalOverflow": False, "artifact": measurement["responsive"]},
            "screenshot": measurement["screenshot"],
        }
        quality._validate_measurement(workspace, raw, scenario_id=scenario, expected_versions=version_map, command_windows=[window], retained={}, used_artifact_paths=used_paths)
    _require(seen == expected, f"{scenario} selected cells are missing")
    actual_raw = {path.name for path in (output / "raw").iterdir() if path.is_file()}
    expected_raw = {path.name for engine, width in expected for path in (Path(f"{engine}-{width}-behavior.json"), Path(f"{engine}-{width}-axe.json"), Path(f"{engine}-{width}-responsive.json"), Path(f"{engine}-{width}.png"))}
    _require(actual_raw == expected_raw, f"{scenario} raw directory includes missing or extra cells")


def validate_impact(evidence: object, *, expected_plan: Mapping[str, object]) -> m8.M8EvidenceValidation:
    try:
        _require(isinstance(evidence, dict), "impact evidence must be an object")
        assert isinstance(evidence, dict)
        _require(evidence.get("schemaVersion") == 1 and evidence.get("kind") == KIND and evidence.get("policy") == POLICY, "unsupported impact policy")
        _require(evidence.get("result") == "passed" and evidence.get("mode") == "sampled-impact" and evidence.get("fullMatrixProven") is False, "impact must not claim full M8")
        _require(evidence.get("selectedCells") == _selected() and evidence.get("unprovenCells") == _unproven(), "impact cell accounting differs from fixed policy")
        _require(evidence.get("limitations") == {"fullMatrixProven": False, "newBlindEvaluation": False, "originMigrationAppliesToTarget": False, "unprovenCellCount": 60}, "impact limitations must state unproven scope")
        repository = _path(evidence.get("repository"), "repository", directory=True)
        origin_root = _path(evidence.get("originCandidateRoot"), "origin candidate", directory=True)
        target_root = _path(evidence.get("targetCandidateRoot"), "target candidate", directory=True)
        origin, before, origin_native = _candidate(origin_root, repository)
        target, after, target_native = _candidate(target_root, repository)
        _require(origin["source"]["commit"] == ORIGIN_COMMIT, "impact origin is not frozen RC.8")
        reviewed = release._reviewed_evidence_bindings(expected_plan)
        target_binding = _binding(target)
        _require(reviewed == {
            "planDigest": target_binding["planDigest"],
            "sourceCommit": target_binding["sourceCommit"],
            "archiveSha256": target_binding["archiveSha256"],
        }, "impact target is not the reviewed release candidate")
        _require(evidence.get("originCandidate") == _binding(origin) and evidence.get("candidate") == _binding(target), "impact candidate binding mismatch")
        _require(evidence.get("sourceDelta") == _delta(before, after), "impact source delta differs from immutable commits")
        _require(evidence.get("candidateDelta") == _delta(origin_native, target_native), "impact candidate delta differs from packaged bytes")
        _source_policy(evidence["sourceDelta"], evidence["candidateDelta"], before, after)
        ledger_path = _path(evidence.get("executionLedger"), "execution ledger")
        ledger = _json(ledger_path, "execution ledger")
        _origin_evidence(evidence, origin, origin_native, ledger, ledger_path)
        consumers = evidence.get("targetConsumers")
        _require(isinstance(consumers, list) and [item.get("id") if isinstance(item, dict) else None for item in consumers] == list(SCENARIOS), "impact requires exactly five ordered target consumers")
        for item in consumers:
            _consumer(item, target, target_native, ledger, ledger_path)
        return m8.M8EvidenceValidation("accepted", ())
    except (release.ReleaseError, quality.M8QualityError, migration.MigrationError, OSError, ValueError, KeyError, TypeError, AttributeError, json.JSONDecodeError) as error:
        return m8.M8EvidenceValidation("invalid", (str(error),))


def validate_impact_file(path: Path, *, expected_plan: Mapping[str, object]) -> m8.M8EvidenceValidation:
    try:
        document = _json(_path(str(path), "impact report"), "impact report")
        return validate_impact(document, expected_plan=expected_plan)
    except (release.ReleaseError, quality.M8QualityError, OSError, ValueError, json.JSONDecodeError) as error:
        return m8.M8EvidenceValidation("invalid", (str(error),))


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("report", type=Path)
    parser.add_argument("--target-plan", type=Path, required=True)
    args = parser.parse_args(argv)
    try:
        result = validate_impact_file(args.report, expected_plan=_json(args.target_plan, "target plan"))
        print(json.dumps(result.as_dict(), indent=2))
        return 0 if result.accepted else 2
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
