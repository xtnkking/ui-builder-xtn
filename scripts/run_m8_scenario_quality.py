#!/usr/bin/env python3
"""Produce validator-ready M8 quality evidence for one evaluator scenario.

The producer executes the consumer's typecheck, build, verifier, and browser
quality commands without a shell.  A passed scenario report is written only
after the existing M8 quality validators accept every raw browser artifact.
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Any, Mapping, Sequence
from urllib.parse import urlparse

import run_m8_consumer as consumer
import run_m8_quality as quality
import validate_m8_evidence as validator


SCHEMA_VERSION = 1
PLAN_KIND = "personal-ui-m8-scenario-quality-plan"
FAILURE_KIND = "personal-ui-m8-scenario-quality-failure"
CAPTURE_KIND = "personal-ui-m8-quality-command-capture"
CAPTURE_INDEX_KIND = "personal-ui-m8-quality-command-capture-index"
WORKER_CONFIG_KIND = "personal-ui-m8-browser-quality-worker-config"
PURPOSES = ("typecheck", "build", "verifier", "browser-quality")
STATIC_PURPOSES = PURPOSES[:3]
DEFAULT_WORKER = Path(__file__).with_suffix(".mjs")
SHA256_PATTERN = re.compile(r"^[0-9a-f]{64}$")
FAILURE_EXIT_CODE = 8


class ScenarioQualityError(RuntimeError):
    """The scenario producer input or measured evidence is invalid."""


@dataclass(frozen=True)
class CommandCapture:
    purpose: str
    argv: tuple[str, ...]
    cwd: str
    exit_code: int
    started_at: str
    ended_at: str
    stdout_path: str
    stderr_path: str
    capture_path: str


@dataclass(frozen=True)
class ProducerInputs:
    workspace: Path
    project_root: Path
    project_relative: PurePosixPath
    plan_path: Path
    plan_relative: PurePosixPath
    output_root: Path
    output_relative: PurePosixPath
    manifest: dict[str, Any]
    plan: dict[str, Any]
    scenario_id: str
    run_id: str


def canonical_json(value: object) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z")


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def is_link_like(path: Path) -> bool:
    is_junction = getattr(path, "is_junction", None)
    return path.is_symlink() or bool(is_junction and is_junction())


def is_within(path: Path, parent: Path) -> bool:
    try:
        path.relative_to(parent)
        return True
    except ValueError:
        return False


def absolute_without_links(path: Path, *, label: str, must_exist: bool) -> Path:
    if any(part == ".." for part in path.parts):
        raise ScenarioQualityError(f"{label} must not contain parent traversal")
    absolute = Path(os.path.abspath(os.fspath(path.expanduser())))
    current = Path(absolute.anchor)
    for part in absolute.parts[1:]:
        current /= part
        if is_link_like(current):
            raise ScenarioQualityError(f"{label} must not traverse a link or junction")
        if not current.exists():
            break
    if must_exist and not absolute.exists():
        raise ScenarioQualityError(f"{label} does not exist: {absolute}")
    return absolute


def safe_relative(value: object, *, label: str) -> PurePosixPath:
    if not isinstance(value, str) or not value or "\\" in value or "\x00" in value:
        raise ScenarioQualityError(f"{label} must be a POSIX relative path")
    relative = PurePosixPath(value)
    if (
        relative.is_absolute()
        or relative.as_posix() != value
        or any(part in {"", ".", ".."} for part in relative.parts)
        or (relative.parts and re.fullmatch(r"[A-Za-z]:", relative.parts[0]) is not None)
    ):
        raise ScenarioQualityError(f"{label} must be a canonical safe relative path")
    return relative


def workspace_path(
    workspace: Path,
    value: Path,
    *,
    label: str,
    must_exist: bool,
) -> tuple[Path, PurePosixPath]:
    candidate = value if value.is_absolute() else workspace.joinpath(*value.parts)
    absolute = absolute_without_links(candidate, label=label, must_exist=must_exist)
    try:
        relative_text = absolute.relative_to(workspace).as_posix()
    except ValueError as error:
        raise ScenarioQualityError(f"{label} must stay inside the evaluator workspace") from error
    relative = safe_relative(relative_text, label=label)
    return absolute, relative


def read_json_object(path: Path, *, label: str) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ScenarioQualityError(f"unable to read {label}: {error}") from error
    if not isinstance(value, dict):
        raise ScenarioQualityError(f"{label} must contain a JSON object")
    return value


def write_new_bytes(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        with path.open("xb") as stream:
            stream.write(content)
    except FileExistsError as error:
        raise ScenarioQualityError(f"refusing to overwrite producer artifact: {path}") from error
    if path.read_bytes() != content:
        raise ScenarioQualityError(f"producer artifact failed write verification: {path}")


def write_new_json(path: Path, value: object) -> None:
    write_new_bytes(path, canonical_json(value))


def descriptor(workspace: Path, path: Path) -> dict[str, object]:
    absolute = absolute_without_links(path, label="producer artifact", must_exist=True)
    if not absolute.is_file():
        raise ScenarioQualityError(f"producer artifact must be a regular file: {absolute}")
    try:
        relative = absolute.relative_to(workspace).as_posix()
    except ValueError as error:
        raise ScenarioQualityError("producer artifact must stay inside the evaluator workspace") from error
    safe_relative(relative, label="producer artifact path")
    content = absolute.read_bytes()
    return {"path": relative, "size": len(content), "sha256": sha256_bytes(content)}


def validate_candidate_binding(value: object) -> dict[str, object]:
    if not isinstance(value, dict):
        raise ScenarioQualityError("workspace candidate binding must be an object")
    archive = value.get("archive")
    normalized: dict[str, object] = {
        "version": value.get("version"),
        "planDigest": value.get("planDigest"),
        "sourceCommit": value.get("sourceCommit"),
        "sourceContentDigest": value.get("sourceContentDigest"),
        "sourceDateEpoch": value.get("sourceDateEpoch"),
        "candidateContentDigest": value.get("candidateContentDigest"),
        "archive": archive,
    }
    if not isinstance(normalized["version"], str) or not normalized["version"]:
        raise ScenarioQualityError("workspace candidate version is invalid")
    if not isinstance(normalized["sourceCommit"], str) or not normalized["sourceCommit"]:
        raise ScenarioQualityError("workspace candidate sourceCommit is invalid")
    for field in ("planDigest", "sourceContentDigest", "candidateContentDigest"):
        if not isinstance(normalized[field], str) or SHA256_PATTERN.fullmatch(normalized[field]) is None:
            raise ScenarioQualityError(f"workspace candidate {field} is invalid")
    epoch = normalized["sourceDateEpoch"]
    if not isinstance(epoch, int) or isinstance(epoch, bool) or epoch < 0:
        raise ScenarioQualityError("workspace candidate sourceDateEpoch is invalid")
    if not isinstance(archive, dict):
        raise ScenarioQualityError("workspace candidate archive binding is invalid")
    archive_path = safe_relative(archive.get("path"), label="workspace candidate archive.path")
    archive_size = archive.get("size")
    archive_digest = archive.get("sha256")
    if not isinstance(archive_size, int) or isinstance(archive_size, bool) or archive_size < 0:
        raise ScenarioQualityError("workspace candidate archive.size is invalid")
    if not isinstance(archive_digest, str) or SHA256_PATTERN.fullmatch(archive_digest) is None:
        raise ScenarioQualityError("workspace candidate archive.sha256 is invalid")
    normalized["archive"] = {
        "path": archive_path.as_posix(),
        "size": archive_size,
        "sha256": archive_digest,
    }
    if value != normalized:
        raise ScenarioQualityError("workspace candidate binding contains unsupported or noncanonical fields")
    return normalized


def command_argv(value: object, *, label: str) -> list[str]:
    if (
        not isinstance(value, list)
        or not value
        or any(not isinstance(item, str) or not item.strip() or "\x00" in item for item in value)
    ):
        raise ScenarioQualityError(f"{label} must be a non-empty string array")
    return list(value)


def positive_number(
    value: object,
    *,
    label: str,
    minimum: float,
    maximum: float,
) -> float:
    if (
        not isinstance(value, (int, float))
        or isinstance(value, bool)
        or value < minimum
        or value > maximum
    ):
        raise ScenarioQualityError(f"{label} must be between {minimum:g} and {maximum:g}")
    return float(value)


def loopback_url(value: object, *, label: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ScenarioQualityError(f"{label} must be a non-empty URL")
    parsed = urlparse(value)
    if (
        parsed.scheme != "http"
        or parsed.hostname not in {"127.0.0.1", "localhost", "::1"}
        or parsed.username is not None
        or parsed.password is not None
        or parsed.port is None
    ):
        raise ScenarioQualityError(f"{label} must be a loopback HTTP URL with an explicit port")
    return value


def validate_plan(
    workspace: Path,
    manifest: Mapping[str, object],
    plan: dict[str, Any],
    *,
    plan_path: Path,
) -> tuple[Path, PurePosixPath, dict[str, Any]]:
    if plan.get("schemaVersion") != SCHEMA_VERSION or plan.get("kind") != PLAN_KIND:
        raise ScenarioQualityError("quality plan schemaVersion or kind is invalid")
    project_relative = safe_relative(plan.get("projectRoot"), label="quality plan projectRoot")
    layout = manifest.get("bundleLayout")
    consumer_value = layout.get("consumerRoot") if isinstance(layout, dict) else None
    consumer_relative = safe_relative(consumer_value, label="workspace consumerRoot")
    if (
        project_relative != consumer_relative
        and project_relative.parts[: len(consumer_relative.parts)] != consumer_relative.parts
    ):
        raise ScenarioQualityError("quality plan projectRoot must stay under the consumer root")
    project_root = workspace.joinpath(*project_relative.parts)
    project_root = absolute_without_links(project_root, label="consumer projectRoot", must_exist=True)
    if not project_root.is_dir():
        raise ScenarioQualityError("consumer projectRoot must be a directory")
    if not is_within(plan_path, project_root):
        raise ScenarioQualityError("quality plan must be stored inside the consumer project")

    commands = plan.get("commands")
    if not isinstance(commands, dict) or set(commands) != set(STATIC_PURPOSES):
        raise ScenarioQualityError("quality plan commands must contain typecheck, build, and verifier")
    normalized_commands = {
        purpose: command_argv(commands[purpose], label=f"quality plan commands.{purpose}")
        for purpose in STATIC_PURPOSES
    }

    browser = plan.get("browser")
    if not isinstance(browser, dict):
        raise ScenarioQualityError("quality plan browser must be an object")
    required_browser_fields = {
        "nodeArgv",
        "serverArgv",
        "readyUrl",
        "url",
        "behaviorModule",
        "viewportHeight",
        "serverTimeoutSeconds",
        "actionTimeoutMs",
    }
    if set(browser) != required_browser_fields:
        missing = sorted(required_browser_fields - set(browser))
        extra = sorted(set(browser) - required_browser_fields)
        raise ScenarioQualityError(
            f"quality plan browser fields are incomplete (missing={missing}, extra={extra})"
        )
    ready_url = loopback_url(browser.get("readyUrl"), label="quality plan browser.readyUrl")
    target_url = loopback_url(browser.get("url"), label="quality plan browser.url")
    ready_parsed = urlparse(ready_url)
    target_parsed = urlparse(target_url)
    if (ready_parsed.hostname, ready_parsed.port) != (target_parsed.hostname, target_parsed.port):
        raise ScenarioQualityError("browser readyUrl and url must use the same loopback server")
    behavior_relative = safe_relative(
        browser.get("behaviorModule"), label="quality plan browser.behaviorModule"
    )
    behavior_path = workspace.joinpath(*behavior_relative.parts)
    behavior_path = absolute_without_links(
        behavior_path, label="consumer behaviorModule", must_exist=True
    )
    if not behavior_path.is_file() or not is_within(behavior_path, project_root):
        raise ScenarioQualityError("consumer behaviorModule must be a file inside projectRoot")
    viewport_height = positive_number(
        browser.get("viewportHeight"),
        label="quality plan browser.viewportHeight",
        minimum=240,
        maximum=5000,
    )
    if not viewport_height.is_integer():
        raise ScenarioQualityError("quality plan browser.viewportHeight must be an integer")
    server_timeout = positive_number(
        browser.get("serverTimeoutSeconds"),
        label="quality plan browser.serverTimeoutSeconds",
        minimum=1,
        maximum=600,
    )
    action_timeout = positive_number(
        browser.get("actionTimeoutMs"),
        label="quality plan browser.actionTimeoutMs",
        minimum=1000,
        maximum=300000,
    )
    if not action_timeout.is_integer():
        raise ScenarioQualityError("quality plan browser.actionTimeoutMs must be an integer")
    normalized_browser: dict[str, Any] = {
        "nodeArgv": command_argv(browser.get("nodeArgv"), label="quality plan browser.nodeArgv"),
        "serverArgv": command_argv(
            browser.get("serverArgv"), label="quality plan browser.serverArgv"
        ),
        "readyUrl": ready_url,
        "url": target_url,
        "behaviorModule": behavior_relative.as_posix(),
        "viewportHeight": int(viewport_height),
        "serverTimeoutSeconds": server_timeout,
        "actionTimeoutMs": int(action_timeout),
    }
    normalized = {
        "schemaVersion": SCHEMA_VERSION,
        "kind": PLAN_KIND,
        "projectRoot": project_relative.as_posix(),
        "commands": normalized_commands,
        "browser": normalized_browser,
    }
    if plan != normalized:
        raise ScenarioQualityError("quality plan contains unsupported or noncanonical fields")
    return project_root, project_relative, normalized


def load_inputs(
    *,
    workspace_path: Path,
    plan_path: Path,
    output_path: Path,
) -> ProducerInputs:
    workspace = absolute_without_links(workspace_path, label="evaluator workspace", must_exist=True)
    if not workspace.is_dir():
        raise ScenarioQualityError("evaluator workspace must be a directory")
    workspace = workspace.resolve(strict=True)
    manifest_path = workspace / consumer.MANIFEST_NAME
    manifest = read_json_object(manifest_path, label="workspace visible inputs")
    run = manifest.get("run")
    scenario = manifest.get("scenario")
    acceptance = manifest.get("acceptanceEvidence")
    if (
        manifest.get("schemaVersion") != SCHEMA_VERSION
        or manifest.get("kind") != "personal-ui-m8-evaluator-inputs"
        or manifest.get("official") is not True
        or not isinstance(acceptance, dict)
        or acceptance.get("eligible") is not True
        or not isinstance(run, dict)
        or not isinstance(run.get("id"), str)
        or consumer.RUN_ID_PATTERN.fullmatch(run["id"]) is None
        or not isinstance(scenario, dict)
        or scenario.get("id") not in validator.M8_SCENARIOS
    ):
        raise ScenarioQualityError("workspace is not an official M8 evaluator workspace")
    validate_candidate_binding(manifest.get("candidate"))

    resolved_plan, plan_relative = workspace_path_fn(
        workspace, plan_path, label="quality plan", must_exist=True
    )
    if not resolved_plan.is_file():
        raise ScenarioQualityError("quality plan must be a regular file")
    plan = read_json_object(resolved_plan, label="quality plan")
    project_root, project_relative, normalized_plan = validate_plan(
        workspace, manifest, plan, plan_path=resolved_plan
    )

    output_root, output_relative = workspace_path_fn(
        workspace, output_path, label="quality output", must_exist=False
    )
    if output_root.exists() or is_link_like(output_root):
        raise ScenarioQualityError(f"quality output must be a new directory: {output_root}")
    if is_within(output_root, project_root) or is_within(project_root, output_root):
        raise ScenarioQualityError("quality output must not overlap the consumer project")
    return ProducerInputs(
        workspace=workspace,
        project_root=project_root,
        project_relative=project_relative,
        plan_path=resolved_plan,
        plan_relative=plan_relative,
        output_root=output_root,
        output_relative=output_relative,
        manifest=manifest,
        plan=normalized_plan,
        scenario_id=str(scenario["id"]),
        run_id=str(run["id"]),
    )


# Keep the public helper name readable without shadowing the workspace argument.
workspace_path_fn = workspace_path


def command_log_bytes(content: bytes, *, stream: str) -> bytes:
    if content:
        return content
    return f"[m8-quality] command emitted no {stream}\n".encode("utf-8")


def resolved_argv(argv: Sequence[str], *, cwd: Path) -> list[str]:
    values = list(argv)
    executable = values[0]
    has_directory = any(separator in executable for separator in ("/", "\\"))
    if has_directory:
        candidate = Path(executable)
        if not candidate.is_absolute():
            candidate = cwd / candidate
        resolved = shutil.which(str(candidate))
    else:
        resolved = shutil.which(executable)
    if resolved is None:
        return values
    resolved_path = Path(resolved).resolve()
    if os.name == "nt" and resolved_path.suffix.lower() in {".cmd", ".bat"}:
        command_name = resolved_path.stem.lower()
        npm_entrypoints = {"npm": "npm-cli.js", "npx": "npx-cli.js"}
        entrypoint_name = npm_entrypoints.get(command_name)
        if entrypoint_name is None:
            raise ScenarioQualityError(
                f"command {executable!r} resolves to a batch shim; declare its direct executable argv"
            )
        node = resolved_path.parent / "node.exe"
        entrypoint = resolved_path.parent / "node_modules" / "npm" / "bin" / entrypoint_name
        if not node.is_file() or not entrypoint.is_file():
            raise ScenarioQualityError(
                f"unable to resolve the direct {command_name} JavaScript entry point"
            )
        return [str(node.resolve()), str(entrypoint.resolve()), *values[1:]]
    values[0] = str(resolved_path)
    return values


def execute_command(
    inputs: ProducerInputs,
    *,
    purpose: str,
    argv: Sequence[str],
) -> CommandCapture:
    if purpose not in PURPOSES:
        raise ScenarioQualityError(f"unsupported command purpose: {purpose}")
    logs = inputs.output_root / "logs"
    stdout_path = logs / f"{purpose}.stdout.log"
    stderr_path = logs / f"{purpose}.stderr.log"
    actual_argv = resolved_argv(argv, cwd=inputs.project_root)
    started_at = utc_now()
    try:
        completed = subprocess.run(
            actual_argv,
            cwd=inputs.project_root,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            shell=False,
            check=False,
        )
        exit_code = completed.returncode
        stdout = completed.stdout
        stderr = completed.stderr
    except OSError as error:
        exit_code = 127
        stdout = b""
        stderr = f"{type(error).__name__}: {error}\n".encode("utf-8", "replace")
    ended_at = utc_now()
    write_new_bytes(stdout_path, command_log_bytes(stdout, stream="stdout"))
    write_new_bytes(stderr_path, stderr)
    stdout_relative = stdout_path.relative_to(inputs.workspace).as_posix()
    stderr_relative = stderr_path.relative_to(inputs.workspace).as_posix()
    capture_path = inputs.output_root / "command-captures" / f"{PURPOSES.index(purpose) + 1:02d}-{purpose}.json"
    capture = {
        "schemaVersion": SCHEMA_VERSION,
        "kind": CAPTURE_KIND,
        "runId": inputs.run_id,
        "scenarioId": inputs.scenario_id,
        "purpose": purpose,
        "argv": actual_argv,
        "cwd": inputs.project_relative.as_posix(),
        "exitCode": exit_code,
        "startedAt": started_at,
        "endedAt": ended_at,
        "stdout": stdout_relative,
        "stderr": stderr_relative,
    }
    write_new_json(capture_path, capture)
    return CommandCapture(
        purpose=purpose,
        argv=tuple(actual_argv),
        cwd=inputs.project_relative.as_posix(),
        exit_code=exit_code,
        started_at=started_at,
        ended_at=ended_at,
        stdout_path=stdout_relative,
        stderr_path=stderr_relative,
        capture_path=capture_path.relative_to(inputs.workspace).as_posix(),
    )


def report_command(inputs: ProducerInputs, capture: CommandCapture) -> dict[str, object]:
    return {
        "purpose": capture.purpose,
        "argv": list(capture.argv),
        "cwd": capture.cwd,
        "exitCode": capture.exit_code,
        "startedAt": capture.started_at,
        "endedAt": capture.ended_at,
        "stdout": descriptor(inputs.workspace, inputs.workspace / capture.stdout_path),
        "stderr": descriptor(inputs.workspace, inputs.workspace / capture.stderr_path),
    }


def write_capture_index(inputs: ProducerInputs, captures: Sequence[CommandCapture]) -> Path:
    path = inputs.output_root / "command-capture-index.json"
    write_new_json(
        path,
        {
            "schemaVersion": SCHEMA_VERSION,
            "kind": CAPTURE_INDEX_KIND,
            "runId": inputs.run_id,
            "scenarioId": inputs.scenario_id,
            "commands": [
                {
                    "purpose": capture.purpose,
                    "record": descriptor(
                        inputs.workspace, inputs.workspace / capture.capture_path
                    ),
                }
                for capture in captures
            ],
        },
    )
    return path


def worker_config(inputs: ProducerInputs) -> tuple[Path, list[str]]:
    browser = inputs.plan["browser"]
    assert isinstance(browser, dict)
    worker = absolute_without_links(DEFAULT_WORKER, label="browser quality worker", must_exist=True)
    config_path = inputs.output_root / "browser-worker-config.json"
    config = {
        "schemaVersion": SCHEMA_VERSION,
        "kind": WORKER_CONFIG_KIND,
        "scenarioId": inputs.scenario_id,
        "projectRoot": str(inputs.project_root),
        "outputRoot": str(inputs.output_root),
        "serverArgv": resolved_argv(browser["serverArgv"], cwd=inputs.project_root),
        "readyUrl": browser["readyUrl"],
        "url": browser["url"],
        "behaviorModule": str(inputs.workspace.joinpath(*PurePosixPath(browser["behaviorModule"]).parts)),
        "viewportHeight": browser["viewportHeight"],
        "serverTimeoutSeconds": browser["serverTimeoutSeconds"],
        "actionTimeoutMs": browser["actionTimeoutMs"],
        "engines": list(validator.REQUIRED_ENGINES),
        "widths": list(validator.REQUIRED_WIDTHS),
    }
    write_new_json(config_path, config)
    node_argv = browser["nodeArgv"]
    assert isinstance(node_argv, list)
    return config_path, [*node_argv, str(worker), "--config", str(config_path)]


def run_browser_worker(inputs: ProducerInputs) -> CommandCapture:
    _config_path, argv = worker_config(inputs)
    return execute_command(inputs, purpose="browser-quality", argv=argv)


def load_raw_json(path: Path, *, label: str) -> dict[str, Any]:
    return read_json_object(
        absolute_without_links(path, label=label, must_exist=True), label=label
    )


def build_and_validate_browser_evidence(
    inputs: ProducerInputs,
    browser_capture: CommandCapture,
) -> tuple[dict[str, object], list[dict[str, object]]]:
    if browser_capture.exit_code != 0:
        raise ScenarioQualityError(
            f"browser-quality command failed with exit code {browser_capture.exit_code}"
        )
    browser_window = (
        quality._timestamp(browser_capture.started_at, label="browser-quality startedAt"),
        quality._timestamp(browser_capture.ended_at, label="browser-quality endedAt"),
    )
    retained: dict[str, quality.RetainedSource] = {}
    browser_versions_path = inputs.output_root / "browser-versions.raw.json"
    browser_versions_descriptor = descriptor(inputs.workspace, browser_versions_path)
    try:
        versions = quality._validate_browser_versions(
            inputs.workspace,
            browser_versions_descriptor,
            scenario_id=inputs.scenario_id,
            windows=[browser_window],
            retained=retained,
        )
    except quality.M8QualityError as error:
        raise ScenarioQualityError(f"browser version evidence is invalid: {error}") from error
    expected_versions = {str(item["project"]): str(item["version"]) for item in versions}
    measurements: list[dict[str, object]] = []
    used_artifact_paths: set[str] = set()
    observed: set[tuple[str, int]] = set()
    for engine in validator.REQUIRED_ENGINES:
        for width in validator.REQUIRED_WIDTHS:
            stem = inputs.output_root / "raw" / f"{engine}-{width}"
            behavior_path = Path(f"{stem}-behavior.json")
            axe_path = Path(f"{stem}-axe.json")
            responsive_path = Path(f"{stem}-responsive.json")
            screenshot_path = Path(f"{stem}.png")
            behavior_record = load_raw_json(
                behavior_path, label=f"{engine}/{width} behavior artifact"
            )
            behavior_assertions = behavior_record.get("assertions")
            assertion_count = len(behavior_assertions) if isinstance(behavior_assertions, list) else 0
            measurement: dict[str, object] = {
                "engine": engine,
                "width": width,
                "result": "passed",
                "recordedAt": behavior_record.get("recordedAt"),
                "browserVersion": behavior_record.get("browserVersion"),
                "userAgent": behavior_record.get("userAgent"),
                "url": behavior_record.get("url"),
                "deviceScaleFactor": behavior_record.get("deviceScaleFactor"),
                "checks": {name: "passed" for name in quality.CHECKS},
                "behavior": {
                    "result": "passed",
                    "assertionCount": assertion_count,
                    "artifact": descriptor(inputs.workspace, behavior_path),
                },
                "axe": {
                    "result": "passed",
                    "critical": 0,
                    "serious": 0,
                    "artifact": descriptor(inputs.workspace, axe_path),
                },
                "responsive": {
                    "result": "passed",
                    "pageHorizontalOverflow": False,
                    "artifact": descriptor(inputs.workspace, responsive_path),
                },
                "screenshot": descriptor(inputs.workspace, screenshot_path),
            }
            try:
                key, _normalized = quality._validate_measurement(
                    inputs.workspace,
                    measurement,
                    scenario_id=inputs.scenario_id,
                    expected_versions=expected_versions,
                    command_windows=[browser_window],
                    retained=retained,
                    used_artifact_paths=used_artifact_paths,
                )
            except quality.M8QualityError as error:
                raise ScenarioQualityError(
                    f"{engine}/{width} browser evidence is invalid: {error}"
                ) from error
            if key in observed:
                raise ScenarioQualityError(f"duplicate browser evidence measurement: {key}")
            observed.add(key)
            measurements.append(measurement)
    expected = {
        (engine, width)
        for engine in validator.REQUIRED_ENGINES
        for width in validator.REQUIRED_WIDTHS
    }
    if observed != expected:
        raise ScenarioQualityError("browser worker did not produce the complete engine/width matrix")
    return browser_versions_descriptor, measurements


def write_failure(
    inputs: ProducerInputs,
    *,
    error: BaseException,
    captures: Sequence[CommandCapture],
) -> None:
    target = inputs.output_root / "failure.json"
    if target.exists():
        return
    write_new_json(
        target,
        {
            "schemaVersion": SCHEMA_VERSION,
            "kind": FAILURE_KIND,
            "result": "failed",
            "scenarioId": inputs.scenario_id,
            "runId": inputs.run_id,
            "failedAt": utc_now(),
            "error": f"{type(error).__name__}: {error}",
            "commands": [report_command(inputs, capture) for capture in captures],
        },
    )


def produce_scenario_quality(
    *,
    workspace: Path,
    plan: Path,
    output: Path,
) -> Path:
    inputs = load_inputs(workspace_path=workspace, plan_path=plan, output_path=output)
    inputs.output_root.mkdir(parents=True, exist_ok=False)
    captures: list[CommandCapture] = []
    try:
        commands = inputs.plan["commands"]
        assert isinstance(commands, dict)
        for purpose in STATIC_PURPOSES:
            argv = commands[purpose]
            assert isinstance(argv, list)
            capture = execute_command(inputs, purpose=purpose, argv=argv)
            captures.append(capture)
            if capture.exit_code != 0:
                raise ScenarioQualityError(
                    f"{purpose} command failed with exit code {capture.exit_code}"
                )
        browser_capture = run_browser_worker(inputs)
        captures.append(browser_capture)
        if browser_capture.exit_code != 0:
            raise ScenarioQualityError(
                f"browser-quality command failed with exit code {browser_capture.exit_code}"
            )
        browser_versions, measurements = build_and_validate_browser_evidence(
            inputs, browser_capture
        )
        capture_index = write_capture_index(inputs, captures)
        report = {
            "schemaVersion": SCHEMA_VERSION,
            "kind": quality.SCENARIO_REPORT_KIND,
            "result": "passed",
            "scenarioId": inputs.scenario_id,
            "runId": inputs.run_id,
            "candidate": inputs.manifest["candidate"],
            "workspaceRoot": ".",
            "projectRoot": inputs.project_relative.as_posix(),
            "commands": [report_command(inputs, capture) for capture in captures],
            "browserVersions": browser_versions,
            "measurements": measurements,
            "producerEvidence": {
                "plan": descriptor(inputs.workspace, inputs.plan_path),
                "browserWorkerConfig": descriptor(
                    inputs.workspace, inputs.output_root / "browser-worker-config.json"
                ),
                "commandCaptureIndex": descriptor(inputs.workspace, capture_index),
            },
        }
        report_path = inputs.output_root / "scenario-report.json"
        write_new_json(report_path, report)
        return report_path
    except BaseException as error:
        write_failure(inputs, error=error, captures=captures)
        raise


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    result.add_argument("--workspace", type=Path, required=True)
    result.add_argument("--plan", type=Path, required=True)
    result.add_argument("--output", type=Path, required=True)
    return result


def main(argv: Sequence[str] | None = None) -> int:
    args = parser().parse_args(argv)
    try:
        report = produce_scenario_quality(
            workspace=args.workspace,
            plan=args.plan,
            output=args.output,
        )
    except (ScenarioQualityError, quality.M8QualityError, OSError, ValueError) as error:
        print(f"M8 scenario quality failed: {error}", file=sys.stderr)
        return FAILURE_EXIT_CODE
    print(report)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
