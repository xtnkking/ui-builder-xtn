#!/usr/bin/env python3
"""Run one M7 support fixture in an isolated temporary project."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import platform
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path
from typing import Any

import install_personal_ui as installer
from personal_ui_installation import STATE_RELATIVE, InstallationContext


SKILL_ROOT = Path(__file__).resolve().parents[1]
FIXTURE_CATALOG = SKILL_ROOT / "references" / "support-fixtures.json"
VERIFIER = SKILL_ROOT / "scripts" / "verify_personal_ui.py"
IGNORED_SNAPSHOT_PARTS = {
    ".next",
    ".support-render",
    "dist",
    "node_modules",
}


def read_object(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"expected JSON object: {path}")
    return value


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")


def fixture_by_id(fixture_id: str) -> dict[str, Any]:
    catalog = read_object(FIXTURE_CATALOG)
    fixtures = catalog.get("fixtures")
    if not isinstance(fixtures, list):
        raise ValueError("support fixture catalog has no fixtures")
    for fixture in fixtures:
        if isinstance(fixture, dict) and fixture.get("id") == fixture_id:
            return fixture
    raise ValueError(f"unknown support fixture: {fixture_id}")


def package_command(manager: str, *arguments: str) -> list[str]:
    return [manager, *arguments]


def build_fixture_plan(fixture: dict[str, Any]) -> dict[str, Any]:
    environment = fixture["environment"]
    project = fixture["project"]
    manager = environment["packageManager"]
    fixture_id = fixture["id"]
    return {
        "fixtureId": fixture_id,
        "catalogStatus": fixture["status"],
        "hostedEvidenceRecorded": bool(fixture.get("evidence")),
        "node": environment["node"],
        "packageManager": manager["name"],
        "packageManagerVersion": manager["version"],
        "framework": environment["framework"]["name"],
        "frameworkVersion": environment["framework"]["version"],
        "layout": project["layout"],
        "packageRoot": project["packageRoot"],
        "sourceRoot": project["sourceRoot"],
        "operations": list(fixture["operations"]),
        "commands": {
            "managerVersion": package_command(manager["name"], "--version"),
            "cleanInstall": package_command(manager["name"], "install"),
            "typecheck": package_command(manager["name"], "run", "typecheck"),
            "render": package_command(manager["name"], "run", "render"),
            "build": package_command(manager["name"], "run", "build"),
            "start": package_command(manager["name"], "run", "start"),
        },
    }


def relative_import(from_directory: Path, source_root: Path) -> str:
    value = os.path.relpath(source_root, from_directory).replace("\\", "/")
    return value if value.startswith(".") else f"./{value}"


def package_manifest(fixture: dict[str, Any]) -> dict[str, Any]:
    environment = fixture["environment"]
    framework = environment["framework"]
    dependencies = {
        "react": environment["react"],
        "react-dom": environment["reactDom"],
        framework["name"]: framework["version"],
    }
    scripts = {
        "typecheck": "tsc --noEmit",
        "build": "vite build" if framework["name"] == "vite" else "next build",
        "render": (
            "vite build --ssr src/render-smoke.tsx --outDir .support-render "
            "--emptyOutDir && node .support-render/render-smoke.js"
            if framework["name"] == "vite"
            else "next build"
        ),
        "start": "vite preview" if framework["name"] == "vite" else "next start",
    }
    return {
        "name": "@personal-ui/support-fixture",
        "private": True,
        "version": "0.0.0",
        "type": "module",
        "scripts": scripts,
        "dependencies": dependencies,
        "devDependencies": {
            "@types/node": "22.15.21",
            "@types/react": environment["reactTypes"],
            "@types/react-dom": environment["reactDomTypes"],
            "typescript": environment["typescript"],
        },
    }


def scaffold_fixture(root: Path, fixture: dict[str, Any]) -> tuple[Path, Path]:
    environment = fixture["environment"]
    project = fixture["project"]
    manager = environment["packageManager"]
    package_relative = Path(project["packageRoot"])
    package_root = root if package_relative == Path(".") else root / package_relative
    package_root.mkdir(parents=True, exist_ok=True)

    if project["layout"] == "workspace":
        write_json(
            root / "package.json",
            {
                "name": "personal-ui-support-workspace",
                "private": True,
                "packageManager": f"{manager['name']}@{manager['version']}",
                "workspaces": [package_relative.as_posix()],
            },
        )
        if manager["name"] == "pnpm":
            (root / "pnpm-workspace.yaml").write_text(
                f"packages:\n  - '{package_relative.as_posix()}'\n", encoding="utf-8"
            )
    else:
        manifest = package_manifest(fixture)
        manifest["packageManager"] = f"{manager['name']}@{manager['version']}"
        write_json(package_root / "package.json", manifest)

    if project["layout"] == "workspace":
        write_json(package_root / "package.json", package_manifest(fixture))
    if manager["name"] == "yarn":
        (root / ".yarnrc.yml").write_text("nodeLinker: node-modules\n", encoding="utf-8")

    source_root = package_root / Path(project["sourceRoot"])
    framework = environment["framework"]["name"]
    if framework == "vite":
        component_import = relative_import(package_root / "src", source_root)
        (package_root / "src").mkdir(parents=True, exist_ok=True)
        (package_root / "index.html").write_text(
            '<div id="root"></div><script type="module" src="/src/main.tsx"></script>\n',
            encoding="utf-8",
        )
        (package_root / "src" / "main.tsx").write_text(
            "import React from 'react';\n"
            "import { createRoot } from 'react-dom/client';\n"
            f"import {{ Button }} from '{component_import}';\n"
            f"import '{component_import}/styles.css';\n"
            "createRoot(document.getElementById('root')!).render(<Button>Fixture ready</Button>);\n",
            encoding="utf-8",
        )
        (package_root / "src" / "render-smoke.tsx").write_text(
            "import React from 'react';\n"
            "import { renderToString } from 'react-dom/server';\n"
            f"import {{ Button }} from '{component_import}';\n"
            "const html = renderToString(<Button>Fixture ready</Button>);\n"
            "if (!html.includes('Fixture ready')) throw new Error('render smoke failed');\n"
            "console.log(html);\n",
            encoding="utf-8",
        )
        write_json(
            package_root / "tsconfig.json",
            {
                "compilerOptions": {
                    "target": "ES2022",
                    "lib": ["ES2022", "DOM", "DOM.Iterable"],
                    "module": "ESNext",
                    "moduleResolution": "Bundler",
                    "jsx": "react-jsx",
                    "strict": True,
                    "skipLibCheck": True,
                    "noEmit": True,
                },
                "include": ["src", project["sourceRoot"]],
            },
        )
    else:
        component_import = relative_import(package_root / "app", source_root)
        (package_root / "app").mkdir(parents=True, exist_ok=True)
        (package_root / "app" / "layout.tsx").write_text(
            "import type { ReactNode } from 'react';\n"
            f"import '{component_import}/styles.css';\n"
            "export default function Layout({ children }: { children: ReactNode }) {\n"
            "  return <html><body>{children}</body></html>;\n}\n",
            encoding="utf-8",
        )
        (package_root / "app" / "page.tsx").write_text(
            "'use client';\n"
            f"import {{ Button }} from '{component_import}';\n"
            "export default function Page() { return <Button>Fixture ready</Button>; }\n",
            encoding="utf-8",
        )
        write_json(
            package_root / "tsconfig.json",
            {
                "compilerOptions": {
                    "target": "ES2022",
                    "lib": ["DOM", "DOM.Iterable", "ES2022"],
                    "allowJs": True,
                    "skipLibCheck": True,
                    "strict": True,
                    "noEmit": True,
                    "esModuleInterop": True,
                    "module": "ESNext",
                    "moduleResolution": "Bundler",
                    "resolveJsonModule": True,
                    "isolatedModules": True,
                    "jsx": "preserve",
                    "plugins": [{"name": "next"}],
                },
                "include": ["next-env.d.ts", ".next/types/**/*.ts", "**/*.ts", "**/*.tsx"],
                "exclude": ["node_modules"],
            },
        )
        (package_root / "next-env.d.ts").write_text(
            '/// <reference types="next" />\n/// <reference types="next/image-types/global" />\n',
            encoding="utf-8",
        )
    return root, package_root


def run(command: list[str], *, cwd: Path, environment: dict[str, str]) -> str:
    result = subprocess.run(
        command,
        cwd=cwd,
        env=environment,
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"command failed ({result.returncode}): {' '.join(command)}\n"
            f"stdout:\n{result.stdout}\nstderr:\n{result.stderr}"
        )
    return result.stdout.strip()


def tree_snapshot(package_root: Path) -> dict[str, str]:
    result: dict[str, str] = {}
    for path in package_root.rglob("*"):
        if not path.is_file():
            continue
        relative = path.relative_to(package_root)
        if any(part in IGNORED_SNAPSHOT_PARTS for part in relative.parts):
            continue
        result[relative.as_posix()] = hashlib.sha256(path.read_bytes()).hexdigest()
    return result


def context_for(root: Path, package_root: Path, fixture: dict[str, Any]) -> InstallationContext:
    environment = fixture["environment"]
    project = fixture["project"]
    return installer.resolve_integrated_context(
        target=None,
        project_root=root,
        package_root=package_root.relative_to(root),
        source_root=Path(project["sourceRoot"]),
        package_manager=environment["packageManager"]["name"],
        framework=environment["framework"]["name"],
    )


def wait_for_ssr(process: subprocess.Popen[str], port: int) -> None:
    deadline = time.monotonic() + 45
    url = f"http://127.0.0.1:{port}/"
    while time.monotonic() < deadline:
        if process.poll() is not None:
            output, _ = process.communicate()
            raise RuntimeError(f"SSR server exited before smoke request:\n{output}")
        try:
            with urllib.request.urlopen(url, timeout=2) as response:
                body = response.read().decode("utf-8")
            if response.status == 200 and "Fixture ready" in body:
                return
        except OSError:
            time.sleep(0.5)
    raise RuntimeError("SSR server did not become ready within 45 seconds")


def run_ssr(plan: dict[str, Any], *, cwd: Path, environment: dict[str, str]) -> None:
    with socket.socket() as reservation:
        reservation.bind(("127.0.0.1", 0))
        port = reservation.getsockname()[1]
    server_environment = dict(environment)
    server_environment.update({"HOSTNAME": "127.0.0.1", "PORT": str(port)})
    process = subprocess.Popen(
        plan["commands"]["start"],
        cwd=cwd,
        env=server_environment,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
    )
    try:
        wait_for_ssr(process, port)
    finally:
        process.terminate()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=10)


def assert_runtime_versions(
    fixture: dict[str, Any], plan: dict[str, Any], *, cwd: Path, environment: dict[str, str]
) -> dict[str, object]:
    actual_node = run(["node", "--version"], cwd=cwd, environment=environment).lstrip("v")
    if actual_node != plan["node"]:
        raise RuntimeError(f"expected Node {plan['node']}, received {actual_node}")
    actual_manager = run(plan["commands"]["managerVersion"], cwd=cwd, environment=environment)
    if actual_manager != plan["packageManagerVersion"]:
        raise RuntimeError(
            f"expected {plan['packageManager']} {plan['packageManagerVersion']}, received {actual_manager}"
        )
    expected_packages = {
        "react": fixture["environment"]["react"],
        "react-dom": fixture["environment"]["reactDom"],
        "typescript": fixture["environment"]["typescript"],
        plan["framework"]: plan["frameworkVersion"],
    }
    actual_packages: dict[str, str] = {}
    for package, expected in expected_packages.items():
        actual = run(
            ["node", "-p", f"require('{package}/package.json').version"],
            cwd=cwd,
            environment=environment,
        )
        if actual != expected:
            raise RuntimeError(f"expected {package} {expected}, received {actual}")
        actual_packages[package] = actual
    return {
        "node": actual_node,
        "python": platform.python_version(),
        "packageManager": {
            "name": plan["packageManager"],
            "version": actual_manager,
        },
        "react": actual_packages["react"],
        "reactDom": actual_packages["react-dom"],
        "typescript": actual_packages["typescript"],
        "framework": {
            "name": plan["framework"],
            "version": actual_packages[plan["framework"]],
        },
    }


def execute_fixture(fixture: dict[str, Any], workspace: Path) -> dict[str, Any]:
    plan = build_fixture_plan(fixture)
    if plan["catalogStatus"] not in {"target", "verified"}:
        raise ValueError("support runner accepts only target or verified fixtures")
    project_root, package_root = scaffold_fixture(workspace, fixture)
    context = context_for(project_root, package_root, fixture)
    registry = installer.load_registry()
    before = tree_snapshot(package_root)
    first = installer.install_integrated(
        context, registry=registry, force=False, dry_run=True
    )
    second = installer.install_integrated(
        context, registry=registry, force=False, dry_run=True
    )
    if first["plan"]["planDigest"] != second["plan"]["planDigest"]:
        raise RuntimeError("installer dry-run is not deterministic")
    if tree_snapshot(package_root) != before:
        raise RuntimeError("installer dry-run wrote to the fixture")
    installed = installer.install_integrated(
        context, registry=registry, force=False, dry_run=False
    )
    if installed["operation"] != "install":
        raise RuntimeError(f"expected install operation, received {installed['operation']}")

    environment = dict(os.environ)
    environment.update({"CI": "1", "NEXT_TELEMETRY_DISABLED": "1"})
    run(plan["commands"]["cleanInstall"], cwd=project_root, environment=environment)
    actual_environment = assert_runtime_versions(
        fixture, plan, cwd=package_root, environment=environment
    )
    run(plan["commands"]["typecheck"], cwd=package_root, environment=environment)
    if plan["framework"] == "vite":
        run(plan["commands"]["render"], cwd=package_root, environment=environment)
        render_output = package_root / ".support-render"
        if (
            render_output.is_symlink()
            or not render_output.is_dir()
            or render_output.resolve().parent != package_root.resolve()
        ):
            raise RuntimeError("support render output is missing or unsafe to remove")
        shutil.rmtree(render_output)
    run(plan["commands"]["build"], cwd=package_root, environment=environment)
    if "ssr" in plan["operations"]:
        run_ssr(plan, cwd=package_root, environment=environment)

    verify_command = [
        sys.executable,
        str(VERIFIER),
        "--project-root",
        str(project_root),
        "--package-root",
        str(package_root.relative_to(project_root)),
    ]
    run(verify_command, cwd=SKILL_ROOT, environment=environment)

    state_path = package_root / STATE_RELATIVE
    state = read_object(state_path)
    state["version"] = "0.2.18"
    write_json(state_path, state)
    upgrade = installer.install_integrated(
        context, registry=registry, force=False, dry_run=False
    )
    if upgrade["operation"] != "upgrade":
        raise RuntimeError(f"expected upgrade operation, received {upgrade['operation']}")
    run(verify_command, cwd=SKILL_ROOT, environment=environment)

    rollback_state = read_object(state_path)
    rollback_state["version"] = "0.2.17"
    write_json(state_path, rollback_state)
    rollback_before = tree_snapshot(package_root)
    try:
        installer.install_integrated(
            context,
            registry=registry,
            force=False,
            dry_run=False,
            failure_point="commit",
        )
    except RuntimeError as error:
        if "injected installer failure" not in str(error):
            raise
    else:
        raise RuntimeError("rollback fixture did not reach the injected failure")
    if tree_snapshot(package_root) != rollback_before:
        raise RuntimeError("rollback did not restore the fixture surface")
    installer.install_integrated(
        context, registry=registry, force=False, dry_run=False
    )

    return {
        **plan,
        "result": "passed",
        "executedOperations": list(plan["operations"]),
        "actualEnvironment": actual_environment,
        "note": "This report records one run; promotion still requires hosted bundle validation.",
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fixture-id", required=True)
    parser.add_argument("--print-plan", action="store_true")
    parser.add_argument("--work-root", type=Path)
    parser.add_argument("--keep", action="store_true")
    parser.add_argument("--report-output", type=Path)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        fixture = fixture_by_id(args.fixture_id)
        plan = build_fixture_plan(fixture)
        if args.print_plan:
            print(json.dumps(plan, indent=2, sort_keys=True))
            return 0
        if args.work_root is not None:
            args.work_root.mkdir(parents=True, exist_ok=False)
            report = execute_fixture(fixture, args.work_root)
            if args.report_output is not None:
                write_json(args.report_output, report)
            print(json.dumps(report, indent=2, sort_keys=True))
            return 0
        if args.keep:
            workspace = Path(tempfile.mkdtemp(prefix=f"pui-{args.fixture_id}-"))
            report = execute_fixture(fixture, workspace)
            report["retainedWorkspace"] = str(workspace)
        else:
            with tempfile.TemporaryDirectory(prefix=f"pui-{args.fixture_id}-") as temporary:
                report = execute_fixture(fixture, Path(temporary))
        if args.report_output is not None:
            write_json(args.report_output, report)
        print(json.dumps(report, indent=2, sort_keys=True))
        return 0
    except (OSError, RuntimeError, ValueError) as error:
        print(json.dumps({"fixtureId": args.fixture_id, "result": "failed", "error": str(error)}, indent=2))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
