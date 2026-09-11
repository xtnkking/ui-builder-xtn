#!/usr/bin/env python3
"""Exercise the Personal UI provenance gate against known bypass patterns."""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


SKILL_ROOT = Path(__file__).resolve().parent.parent
SCANNER = (
    SKILL_ROOT
    / "assets"
    / "react-kit"
    / "tools"
    / "personal-ui"
    / "verify-provenance.mjs"
)
MANIFEST = SKILL_ROOT / "assets" / "react-kit" / "component-manifest.json"
MANAGED_SOURCE = SKILL_ROOT / "assets" / "react-kit" / "src" / "personal-ui"
INSTALLER = SKILL_ROOT / "scripts" / "install_personal_ui.py"
FULL_VERIFIER = SKILL_ROOT / "scripts" / "verify_personal_ui.py"
VERIFY_SCRIPT = (
    "node tools/personal-ui/verify-provenance.mjs --target . "
    "--source-root src/personal-ui --manifest tools/personal-ui/component-manifest.json"
)


def run_scan(
    files: dict[str, str],
    *,
    remove: tuple[str, ...] = (),
) -> tuple[subprocess.CompletedProcess[str], dict[str, object]]:
    node = shutil.which("node")
    if node is None:
        raise RuntimeError("Node.js is required for strict enforcement tests")
    with tempfile.TemporaryDirectory(prefix="personal-ui-enforcement-") as temporary:
        target = Path(temporary)
        shutil.copytree(MANAGED_SOURCE, target / "src" / "personal-ui")
        for relative, source in files.items():
            destination = target / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_text(source, encoding="utf-8")
        for relative in remove:
            (target / relative).unlink()
        result = subprocess.run(
            [
                node,
                str(SCANNER),
                "--target",
                str(target),
                "--source-root",
                "src/personal-ui",
                "--manifest",
                str(MANIFEST),
            ],
            capture_output=True,
            text=True,
            encoding="utf-8",
            check=False,
        )
        try:
            report = json.loads(result.stdout)
        except json.JSONDecodeError as error:
            raise AssertionError(
                f"scanner emitted invalid JSON: {error}; stderr={result.stderr!r}"
            ) from error
        if not isinstance(report, dict):
            raise AssertionError("scanner report must be an object")
        return result, report


def expect_valid(name: str, files: dict[str, str], used: set[str]) -> None:
    result, report = run_scan(files)
    if result.returncode != 0 or report.get("valid") is not True:
        raise AssertionError(f"{name}: expected valid scan, got {report}")
    actual = set(report.get("usedPublicExports", []))
    if not used <= actual:
        raise AssertionError(f"{name}: missing used exports {sorted(used - actual)}")


def expect_issue(
    name: str,
    files: dict[str, str],
    expected_codes: set[str],
    *,
    remove: tuple[str, ...] = (),
) -> None:
    result, report = run_scan(files, remove=remove)
    if result.returncode == 0 or report.get("valid") is not False:
        raise AssertionError(f"{name}: expected scan failure, got {report}")
    issues = report.get("issues", [])
    actual_codes = {
        issue.get("code")
        for issue in issues
        if isinstance(issue, dict) and isinstance(issue.get("code"), str)
    }
    missing = expected_codes - actual_codes
    if missing:
        raise AssertionError(
            f"{name}: missing issue code(s) {sorted(missing)}; got {sorted(actual_codes)}"
        )


def run_checked_json(command: list[str], *, cwd: Path | None = None) -> dict[str, object]:
    result = subprocess.run(
        command,
        cwd=cwd,
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=False,
    )
    try:
        report = json.loads(result.stdout)
    except json.JSONDecodeError as error:
        raise AssertionError(
            f"command emitted invalid JSON: {command}; stdout={result.stdout!r}; stderr={result.stderr!r}"
        ) from error
    if result.returncode != 0:
        raise AssertionError(
            f"command failed: {command}; report={report}; stderr={result.stderr!r}"
        )
    if not isinstance(report, dict):
        raise AssertionError(f"command report must be an object: {command}")
    return report


def assert_gate(package_path: Path, expected_prebuild: str) -> None:
    package = json.loads(package_path.read_text(encoding="utf-8"))
    scripts = package.get("scripts")
    if not isinstance(scripts, dict):
        raise AssertionError("installed package.json has no scripts object")
    if scripts.get("verify:personal-ui") != VERIFY_SCRIPT:
        raise AssertionError("installer did not install the canonical provenance command")
    if scripts.get("prebuild") != expected_prebuild:
        raise AssertionError(
            f"installer wrote unexpected prebuild: {scripts.get('prebuild')!r}"
        )


def test_installer_build_gate() -> None:
    node = shutil.which("node")
    npm = shutil.which("npm")
    if node is None or npm is None:
        raise RuntimeError("Node.js and npm are required for installer gate tests")
    with tempfile.TemporaryDirectory(prefix="personal-ui-installer-") as temporary:
        root = Path(temporary)
        integrated = root / "integrated"
        (integrated / "src").mkdir(parents=True)
        (integrated / "package.json").write_text(
            json.dumps(
                {
                    "name": "gate-fixture",
                    "private": True,
                    "scripts": {
                        "prebuild": "node existing.mjs",
                        "build": "vite build",
                    },
                    "dependencies": {},
                },
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )
        main_path = integrated / "src" / "main.tsx"
        valid_main = """
            import { Button } from './personal-ui';
            import './personal-ui/styles.css';
            export const App = () => <Button>Run</Button>;
        """
        main_path.write_text(valid_main, encoding="utf-8")
        install_report = run_checked_json(
            [
                sys.executable,
                str(INSTALLER),
                "--mode",
                "integrate",
                "--target",
                str(integrated),
            ]
        )
        if install_report.get("packageUpdated") is not True:
            raise AssertionError("integrated install did not report its package gate update")
        assert_gate(
            integrated / "package.json",
            "node existing.mjs && npm run verify:personal-ui",
        )
        verification = run_checked_json(
            [sys.executable, str(FULL_VERIFIER), "--target", str(integrated)]
        )
        if verification.get("upToDate") is not True:
            raise AssertionError(f"full verifier rejected gated install: {verification}")

        dead_path = integrated / "src" / "Dead.tsx"
        dead_path.write_text(
            "import {Button} from './personal-ui'; export const Dead=()=> <Button>Dead</Button>;",
            encoding="utf-8",
        )
        main_path.write_text(
            "import './personal-ui/styles.css'; export const App=()=> <div>Composition only</div>;",
            encoding="utf-8",
        )
        dead_result = subprocess.run(
            [sys.executable, str(FULL_VERIFIER), "--target", str(integrated)],
            capture_output=True,
            text=True,
            encoding="utf-8",
            check=False,
        )
        if (
            dead_result.returncode == 0
            or "no application source renders or calls a Personal UI runtime export"
            not in dead_result.stdout
        ):
            raise AssertionError("full verifier counted unreachable Personal UI dead code")
        dead_path.unlink()
        main_path.write_text(valid_main, encoding="utf-8")

        managed_file = integrated / "src" / "personal-ui" / "forms.tsx"
        managed_bytes = managed_file.read_bytes()
        managed_file.write_bytes(managed_bytes + b"\n")
        drift_rejected = subprocess.run(
            [npm, "run", "verify:personal-ui"],
            cwd=integrated,
            capture_output=True,
            text=True,
            encoding="utf-8",
            check=False,
        )
        if (
            drift_rejected.returncode == 0
            or "PUI_MANAGED_CHANGED" not in drift_rejected.stdout
        ):
            raise AssertionError("installed npm gate accepted changed managed source")
        managed_file.write_bytes(managed_bytes)

        main_path.write_text("export const App=()=> <button>Bypass</button>;", encoding="utf-8")
        rejected = subprocess.run(
            [npm, "run", "verify:personal-ui"],
            cwd=integrated,
            capture_output=True,
            text=True,
            encoding="utf-8",
            check=False,
        )
        if rejected.returncode == 0 or "PUI_RAW_CONTROL" not in rejected.stdout:
            raise AssertionError("installed npm provenance gate accepted a raw button")

        starter = root / "starter"
        run_checked_json(
            [
                sys.executable,
                str(INSTALLER),
                "--mode",
                "starter",
                "--target",
                str(starter),
            ]
        )
        assert_gate(starter / "package.json", "npm run verify:personal-ui")
        starter_gate = subprocess.run(
            [npm, "run", "verify:personal-ui"],
            cwd=starter,
            capture_output=True,
            text=True,
            encoding="utf-8",
            check=False,
        )
        if starter_gate.returncode != 0:
            raise AssertionError(
                f"starter npm provenance gate failed: {starter_gate.stdout}\n{starter_gate.stderr}"
            )


def main() -> int:
    expect_valid(
        "public barrel and approved icon",
        {
            "src/App.tsx": """
                import { Button, SearchInput, useToast } from './personal-ui';
                import { Search } from 'lucide-react';
                export function App() {
                  const toast = useToast();
                  return <div><Search /><SearchInput value='' onChange={() => {}} /><Button onClick={() => toast.success('ok')}>Run</Button></div>;
                }
            """,
        },
        {"Button", "SearchInput", "useToast"},
    )
    expect_valid(
        "explicit local component factory",
        {
            "src/App.tsx": """
                import React from 'react';
                import { Button } from './personal-ui';
                const Local = () => <Button>Run</Button>;
                export const App = () => React.createElement(Local);
            """,
        },
        {"Button"},
    )
    expect_valid(
        "static relative local component",
        {
            "src/App.tsx": "import {WorkspaceView} from './WorkspaceView'; export const App=()=> <WorkspaceView />;",
            "src/WorkspaceView.tsx": "import {Button} from './personal-ui'; export const WorkspaceView=()=> <Button>Run</Button>;",
        },
        {"Button"},
    )

    cases: list[tuple[str, dict[str, str], set[str]]] = [
        (
            "raw controls and extended intrinsics",
            {"src/App.tsx": "export const App=()=> <><button>Run</button><label>Name</label><progress /><svg /></>;"},
            {"PUI_RAW_CONTROL"},
        ),
        (
            "raw role and event",
            {"src/App.tsx": "export const App=()=> <><div role='button'>Run</div><a onClick={()=>{}}>Link</a></>;"},
            {"PUI_INTERACTIVE_ROLE", "PUI_RAW_CONTROL"},
        ),
        (
            "raw spread props",
            {"src/App.tsx": "export const App=(props:any)=> <div {...props}>Run</div>;"},
            {"PUI_UNINSPECTABLE_PROPS"},
        ),
        (
            "deep import",
            {"src/App.tsx": "import {Button} from './personal-ui/primitives'; export const App=()=> <Button />;"},
            {"PUI_DEEP_IMPORT"},
        ),
        (
            "external JSX alias",
            {"src/App.tsx": "import {Button as MuiButton} from '@mui/material'; const X=MuiButton; export const App=()=> <X />;"},
            {"PUI_EXTERNAL_JSX"},
        ),
        (
            "external createElement",
            {"src/App.tsx": "import React from 'react'; import {Button as MuiButton} from '@mui/material'; export const App=()=> React.createElement(MuiButton);"},
            {"PUI_EXTERNAL_JSX"},
        ),
        (
            "external re-export",
            {"src/ui.ts": "export {Button as Action} from '@mui/material';"},
            {"PUI_EXTERNAL_REEXPORT"},
        ),
        (
            "dynamic external component",
            {"src/App.tsx": "const Mui = await import('@mui/material'); const X=Mui.Button; export const App=()=> <X />;"},
            {"PUI_EXTERNAL_JSX"},
        ),
        (
            "require external component",
            {"src/App.tsx": "const {Button: X}=require('@mui/material'); export const App=()=> <X />;"},
            {"PUI_EXTERNAL_JSX"},
        ),
        (
            "string tag JSX alias",
            {"srcTape/App.tsx": "const Raw='button'; const Alias=Raw; export const App=()=> <Alias />;"},
            {"PUI_RAW_CONTROL"},
        ),
        (
            "string tag factory alias",
            {"packages/web/App.tsx": "import React from 'react'; const Raw='input'; export const App=()=> React.createElement(Raw);"},
            {"PUI_RAW_CONTROL"},
        ),
        (
            "computed string tag",
            {"src/App.tsx": "const Raw=Math.random()?'button':'input'; export const App=()=> <Raw />;"},
            {"PUI_RAW_CONTROL"},
        ),
        (
            "concatenated string factory tag",
            {"src/App.tsx": "import React from 'react'; import {Button} from './personal-ui'; const Raw='but'+'ton'; export const App=()=> <><Button>Good</Button>{React.createElement(Raw)}</>;"},
            {"PUI_UNINSPECTABLE_ELEMENT"},
        ),
        (
            "concatenated string JSX tag",
            {"src/App.tsx": "import {Button} from './personal-ui'; const Raw='but'+'ton'; export const App=()=> <><Button>Good</Button><Raw /></>;"},
            {"PUI_UNINSPECTABLE_ELEMENT"},
        ),
        (
            "object member string tag",
            {"src/App.tsx": "const Raw={Button:'button'}; export const App=()=> <Raw.Button />;"},
            {"PUI_RAW_CONTROL"},
        ),
        (
            "aliased createElement",
            {"src/App.tsx": "import React from 'react'; const h=React.createElement; export const App=()=> h('button',null,'Run');"},
            {"PUI_RAW_CONTROL"},
        ),
        (
            "bracket createElement",
            {"src/App.tsx": "import React from 'react'; export const App=()=> React['createElement']('input');"},
            {"PUI_RAW_CONTROL"},
        ),
        (
            "jsx runtime raw tag",
            {"packages/web/App.js": "import {jsx as _jsx} from 'react/jsx-runtime'; export const App=()=>_jsx('button',{children:'Run'});"},
            {"PUI_RAW_CONTROL"},
        ),
        (
            "required jsx runtime",
            {"packages/web/App.js": "const {jsx:h}=require('react/jsx-runtime'); export const App=()=>h('button',{children:'Run'});"},
            {"PUI_RAW_CONTROL"},
        ),
        (
            "jsx runtime external component",
            {"src/App.js": "import {jsx as _jsx} from 'react/jsx-runtime'; import {Button as MuiButton} from '@mui/material'; export const App=()=>_jsx(MuiButton,{});"},
            {"PUI_EXTERNAL_JSX"},
        ),
        (
            "reserved ownership and class",
            {"src/App.tsx": "export const App=()=> <div data-pui-owner='Button' className='pui-button' />;"},
            {"PUI_RESERVED_MARKER", "PUI_PRIVATE_CLASS"},
        ),
        (
            "React lazy external component",
            {"src/App.tsx": "import React from 'react'; const Lazy=React.lazy(()=>import('@mui/material')); export const App=()=> <Lazy />;"},
            {"PUI_EXTERNAL_JSX"},
        ),
        (
            "CommonJS external shim",
            {"src/ui.cjs": "module.exports=require('@mui/material');"},
            {"PUI_EXTERNAL_REEXPORT"},
        ),
        (
            "external component object propagation",
            {"src/App.tsx": "import {Button as MuiButton} from '@mui/material'; const UI={Button:MuiButton}; export const App=()=> <UI.Button />;"},
            {"PUI_EXTERNAL_JSX"},
        ),
        (
            "external component prop injection",
            {"src/App.tsx": "import {Button as MuiButton} from '@mui/material'; const Slot=({Control}:any)=><Control/>; export const App=()=> <Slot Control={MuiButton}/>;"},
            {"PUI_EXTERNAL_JSX", "PUI_UNINSPECTABLE_ELEMENT"},
        ),
        (
            "unknown dynamic component prop",
            {"src/App.tsx": "import {Button} from './personal-ui'; export const App=({Control}:any)=> <Button component={Control}>Run</Button>;"},
            {"PUI_UNINSPECTABLE_ELEMENT"},
        ),
        (
            "local registered-family shadow",
            {"src/App.tsx": "const UserBadge=()=> <span>Admin</span>; export const App=()=> <UserBadge/>;"},
            {"PUI_COMPONENT_SHADOW"},
        ),
        (
            "external component array propagation",
            {"src/App.tsx": "import {Button as MuiButton} from '@mui/material'; const items=[MuiButton]; const [Action]=items; export const App=()=> <Action />;"},
            {"PUI_EXTERNAL_JSX"},
        ),
        (
            "external render function",
            {"src/App.tsx": "import {renderButton} from '@mui/material'; export const App=()=>renderButton();"},
            {"PUI_EXTERNAL_JSX"},
        ),
        (
            "MDX raw control",
            {"content/page.mdx": "# Account\n\n<button>Run</button>"},
            {"PUI_RAW_CONTROL"},
        ),
        (
            "relative require deep import",
            {"src/App.tsx": "const P=require('./personal-ui/forms'); export const App=()=> <P.Input />;"},
            {"PUI_DEEP_IMPORT"},
        ),
        (
            "relative dynamic deep import",
            {"src/App.tsx": "const P=await import('./personal-ui/forms'); export const App=()=> <P.Input />;"},
            {"PUI_DEEP_IMPORT"},
        ),
        (
            "computed module import",
            {"src/App.ts": "const root='./personal-ui'; export const load=()=>import(root+'/forms');"},
            {"PUI_UNINSPECTABLE_IMPORT"},
        ),
        (
            "HTML role and interaction",
            {"public/embed.html": "<div role=button onclick='run()'>Run</div>"},
            {"PUI_INTERACTIVE_ROLE", "PUI_RAW_INTERACTION"},
        ),
        (
            "test-named production module",
            {"src/Imported.test.tsx": "export const Bad=()=> <input />;", "src/App.tsx": "import {Bad} from './Imported.test'; export const App=Bad;"},
            {"PUI_RAW_CONTROL"},
        ),
        (
            "uninspectable DOM markup",
            {"src/App.ts": "export function mount(el:HTMLElement, html:string){ el['innerHTML']=html; el.insertAdjacentHTML('beforeend',html); }"},
            {"PUI_UNINSPECTABLE_MARKUP"},
        ),
        (
            "raw DOM listener",
            {"src/App.ts": "export function wire(el:HTMLElement){ el.addEventListener('click',()=>{}); }"},
            {"PUI_RAW_INTERACTION"},
        ),
        (
            "DOM property and role mutation",
            {"src/App.tsx": "export function wire(ref:any){ ref.current.onclick=()=>{}; ref.current.setAttribute('role','button'); return <div ref={ref}>Run</div>; }"},
            {"PUI_RAW_INTERACTION", "PUI_INTERACTIVE_ROLE"},
        ),
        (
            "dynamic code construction",
            {"src/App.ts": "export const build=(source:string)=>eval(source); export const compile=(source:string)=>new Function(source);"},
            {"PUI_UNINSPECTABLE_CODE"},
        ),
        (
            "computed DOM markup method",
            {"src/App.ts": "export function inject(el:any,html:string){ const method='insertAdjacent'+'HTML'; el[method]('beforeend',html); }"},
            {"PUI_UNINSPECTABLE_MARKUP"},
        ),
    ]
    for name, files, codes in cases:
        expect_issue(name, files, codes)

    expect_issue(
        "changed managed source",
        {"src/personal-ui/forms.tsx": "export const tampered = true;"},
        {"PUI_MANAGED_CHANGED"},
    )
    expect_issue(
        "extra managed source",
        {"src/personal-ui/local-extension.tsx": "export const Local=()=>null;"},
        {"PUI_MANAGED_EXTRA"},
    )
    expect_issue(
        "missing managed source",
        {},
        {"PUI_MANAGED_MISSING"},
        remove=("src/personal-ui/forms.tsx",),
    )

    test_installer_build_gate()

    print(
        json.dumps(
            {
                "valid": True,
                "scannerCases": len(cases) + 6,
                "installerGate": True,
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
