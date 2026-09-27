#!/usr/bin/env python3
"""Run a real system Safari smoke through Apple's safaridriver."""

from __future__ import annotations

import argparse
import json
import platform
import re
import shutil
import socket
import subprocess
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any


ELEMENT_KEY = "element-6066-11e4-a52e-4f735466cecf"


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


def free_port() -> int:
    with socket.socket() as reservation:
        reservation.bind(("127.0.0.1", 0))
        return int(reservation.getsockname()[1])


def request_json(
    method: str,
    url: str,
    body: object | None = None,
    *,
    timeout: float = 10,
) -> dict[str, Any]:
    content = None if body is None else json.dumps(body).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=content,
        method=method,
        headers={"Content-Type": "application/json; charset=utf-8"},
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            value = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"WebDriver request failed ({error.code}): {detail}") from error
    if not isinstance(value, dict):
        raise RuntimeError("WebDriver response must be a JSON object")
    response_value = value.get("value")
    if isinstance(response_value, dict) and response_value.get("error"):
        raise RuntimeError(f"WebDriver error: {response_value}")
    return value


def wait_for_http(url: str, *, timeout: float) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=2) as response:
                if 200 <= response.status < 500:
                    return
        except OSError:
            time.sleep(0.25)
    raise RuntimeError(f"HTTP endpoint did not become ready: {url}")


def execute(driver_url: str, session_id: str, script: str) -> object:
    response = request_json(
        "POST",
        f"{driver_url}/session/{session_id}/execute/sync",
        {"script": script, "args": []},
    )
    return response.get("value")


def run_smoke(*, url: str, timeout: float = 60) -> dict[str, object]:
    if platform.system() != "Darwin":
        raise RuntimeError("real Safari evidence requires a macOS runner")
    executable = shutil.which("safaridriver")
    if not executable:
        raise RuntimeError("system safaridriver is unavailable")
    driver_version = command_version([executable, "--version"])
    port = free_port()
    driver_url = f"http://127.0.0.1:{port}"
    process = subprocess.Popen(
        [executable, "--port", str(port)],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
    )
    session_id: str | None = None
    try:
        wait_for_http(f"{driver_url}/status", timeout=20)
        session_response = request_json(
            "POST",
            f"{driver_url}/session",
            {
                "capabilities": {
                    "alwaysMatch": {
                        "browserName": "safari",
                        "safari:automaticInspection": False,
                        "safari:automaticProfiling": False,
                    }
                }
            },
            timeout=30,
        )
        session_value = session_response.get("value")
        if not isinstance(session_value, dict):
            raise RuntimeError("safaridriver did not return session capabilities")
        session_id_value = session_value.get("sessionId") or session_response.get("sessionId")
        if not isinstance(session_id_value, str) or not session_id_value:
            raise RuntimeError("safaridriver did not return a session id")
        session_id = session_id_value
        capabilities = session_value.get("capabilities")
        if not isinstance(capabilities, dict):
            capabilities = {}
        browser_name = str(capabilities.get("browserName", "safari"))

        request_json("POST", f"{driver_url}/session/{session_id}/url", {"url": url})
        deadline = time.monotonic() + timeout
        ready = False
        while time.monotonic() < deadline:
            ready = bool(
                execute(
                    driver_url,
                    session_id,
                    "return document.readyState === 'complete' && Boolean(document.querySelector('.pui-root'));",
                )
            )
            if ready:
                break
            time.sleep(0.25)
        if not ready:
            raise RuntimeError("Personal UI root did not render in Safari")

        element_response = request_json(
            "POST",
            f"{driver_url}/session/{session_id}/element",
            {"using": "css selector", "value": 'input[aria-label="搜索组件"]'},
        )
        element_value = element_response.get("value")
        if not isinstance(element_value, dict):
            raise RuntimeError("Safari smoke could not locate the public SearchInput")
        element_id = element_value.get(ELEMENT_KEY) or element_value.get("ELEMENT")
        if not isinstance(element_id, str) or not element_id:
            raise RuntimeError("Safari smoke received an invalid WebDriver element")
        text = "Button"
        request_json(
            "POST",
            f"{driver_url}/session/{session_id}/element/{element_id}/value",
            {"text": text, "value": list(text)},
        )
        interaction = execute(
            driver_url,
            session_id,
            "const input=document.querySelector('input[aria-label=\"搜索组件\"]');"
            "const status=input?.closest('.demo-explorer-search')?.querySelector('[role=status]');"
            "return {value:input?.value||'',status:status?.textContent||'',root:Boolean(document.querySelector('.pui-root'))};",
        )
        if not isinstance(interaction, dict) or interaction.get("value") != text or not interaction.get("root"):
            raise RuntimeError(f"SearchInput interaction failed in Safari: {interaction!r}")

        user_agent = execute(driver_url, session_id, "return navigator.userAgent;")
        if not isinstance(user_agent, str):
            raise RuntimeError("Safari did not return a user agent")
        if (
            "Safari/" not in user_agent
            or "Version/" not in user_agent
            or any(token in user_agent for token in ("Chrome/", "Chromium/", "CriOS/", "FxiOS/"))
        ):
            raise RuntimeError(f"user agent does not identify real Safari: {user_agent}")
        version_match = re.search(r"Version/(\d+(?:\.\d+)*)", user_agent)
        if version_match is None:
            raise RuntimeError("Safari user agent has no Version token")
        version = version_match.group(1)
        major = int(version.split(".", 1)[0])
        if major < 18:
            raise RuntimeError(f"Safari {version} is below the required major version 18")
        capability_version = capabilities.get("browserVersion")
        if isinstance(capability_version, str) and capability_version:
            capability_major = int(capability_version.split(".", 1)[0])
            if capability_major != major:
                raise RuntimeError(
                    f"Safari capability version {capability_version} disagrees with user agent {version}"
                )
        return {
            "schemaVersion": 1,
            "kind": "personal-ui-real-safari-smoke",
            "result": "passed",
            "safari": {
                "product": "Safari",
                "browserName": browser_name,
                "version": version,
                "majorVersion": major,
                "capabilityVersion": capability_version,
                "userAgent": user_agent,
                "driver": "safaridriver",
                "realSafari": True,
            },
            "checks": {
                "documentReady": "passed",
                "rootRendered": "passed",
                "componentInteraction": "passed",
            },
            "actualTools": {
                "node": command_version(["node", "--version"]).lstrip("v"),
                "npm": command_version(["npm", "--version"]),
                "python": platform.python_version(),
                "safaridriver": driver_version,
            },
        }
    finally:
        if session_id is not None:
            try:
                request_json("DELETE", f"{driver_url}/session/{session_id}", timeout=5)
            except (OSError, RuntimeError):
                pass
        process.terminate()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=10)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--timeout", type=float, default=60)
    args = parser.parse_args()
    try:
        wait_for_http(args.url, timeout=min(args.timeout, 30))
        report = run_smoke(url=args.url, timeout=args.timeout)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        print(json.dumps(report, indent=2, sort_keys=True))
        return 0
    except (OSError, RuntimeError, ValueError, json.JSONDecodeError) as error:
        print(f"error: {error}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
