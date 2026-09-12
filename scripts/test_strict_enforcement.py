#!/usr/bin/env python3
"""Exercise the Personal UI provenance gate against known bypass patterns."""

from __future__ import annotations

import json
import re
import runpy
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
MANAGED_STYLES = MANAGED_SOURCE / "styles.css"
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


def test_autofill_contract() -> None:
    styles = MANAGED_STYLES.read_text(encoding="utf-8")
    for selector in (
        ".pui-input:-webkit-autofill",
        ".pui-input:-webkit-autofill:hover",
        ".pui-input:-webkit-autofill:focus",
        ".pui-input:autofill",
        ".pui-input:autofill:hover",
        ".pui-input:autofill:focus",
    ):
        if selector not in styles:
            raise AssertionError(f"autofill contract is missing {selector}")
    for declaration in (
        "-webkit-text-fill-color: var(--_pui-input-autofill-text)",
        "caret-color: var(--_pui-input-autofill-text)",
        "inset 0 0 0 100vmax var(--_pui-input-autofill-background)",
    ):
        if declaration not in styles:
            raise AssertionError(f"autofill contract is missing {declaration}")
    embedded = re.search(r"\.pui-input--embedded\s*\{([^}]+)\}", styles)
    if embedded is None or not re.search(r"\bborder-radius\s*:\s*0\s*;", embedded.group(1)):
        raise AssertionError("embedded input must not paint an independent rounded rectangle")


def test_python_style_gate_contract() -> None:
    verifier = runpy.run_path(str(FULL_VERIFIER))
    style_findings = verifier["application_style_findings"]

    unsafe_codes = {
        code
        for code, _line, _message in style_findings(
            ".login-form input { background: #e8f0fe; border-radius: 999px; }"
        )
    }
    if "PUI_GENERIC_STYLE_OVERRIDE" not in unsafe_codes:
        raise AssertionError("Python verifier accepted generic input skin overrides")

    reserved_codes = {
        code
        for code, _line, _message in style_findings(
            ".pui-input { color: red; } [data-pui-owner='Input'] { padding: 0; }"
        )
    }
    if not {"PUI_PRIVATE_CLASS", "PUI_RESERVED_MARKER"} <= reserved_codes:
        raise AssertionError("Python verifier accepted reserved Personal UI selectors")

    safe_findings = style_findings(
        "*, *::before, *::after { box-sizing: border-box; } "
        "input, button, select { font: inherit; box-sizing: border-box; } "
        ".page-shell { display: grid; gap: 16px; --pui-primary: #2563eb; } "
        ".page-shell:has(input) { grid-template-columns: 1fr; }"
    )
    if safe_findings:
        raise AssertionError(f"Python verifier rejected safe application layout/reset CSS: {safe_findings}")

    for suffix, source in (
        (".scss", "@mixin skin { background:red; } input { @include skin; }"),
        (".sass", "@mixin skin\n  background: red\ninput\n  @include skin\n"),
        (".less", ".skin(){background:red;} input { .skin(); }"),
        (".pcss", "input { @apply rounded-none; }"),
    ):
        codes = {
            code
            for code, _line, _message in style_findings(source, suffix)
        }
        if "PUI_GENERIC_STYLE_OVERRIDE" not in codes:
            raise AssertionError(
                f"Python verifier accepted protected preprocessor injection for {suffix}"
            )

    safe_preprocessor = style_findings(
        "@mixin layout { display:grid; } .page-shell { @include layout; }",
        ".scss",
    )
    if safe_preprocessor:
        raise AssertionError(
            f"Python verifier rejected a layout-only preprocessor mixin: {safe_preprocessor}"
        )

    inspect_overrides = verifier["inspect_component_style_overrides"]
    code_mask = verifier["code_position_mask"]
    masked_code = verifier["masked_code"]
    with tempfile.TemporaryDirectory(prefix="personal-ui-python-style-gate-") as temporary:
        target = Path(temporary)
        path = target / "src" / "App.tsx"
        for label, source in (
            ("className", "export const App=()=> <Input className='foreign-input' />;"),
            ("style", "export const App=()=> <Input style={{background:'red'}} />;"),
            ("css", "export const App=()=> <Input css={{background:'red'}} />;"),
            ("sx", "export const App=()=> <Input sx={{background:'red'}} />;"),
            ("tw", "export const App=()=> <Input tw='rounded-none' />;"),
            ("ref", "export const App=()=> <Input ref={(node:any)=>node?.style.setProperty('border-radius','0')} />;"),
            ("spread", "export const App=(props:any)=> <Input {...props} />;"),
        ):
            errors: list[str] = []
            inspect_overrides(
                target,
                path,
                source,
                masked_code(source, code_mask(source)),
                {"Input": "Input"},
                set(),
                {"Input"},
                errors,
            )
            if not any("[PUI_COMPONENT_STYLE_OVERRIDE]" in error for error in errors):
                raise AssertionError(f"Python verifier accepted component {label} override")

        layout_source = "export const App=()=> <Box className='page-shell' />;"
        layout_errors: list[str] = []
        inspect_overrides(
            target,
            path,
            layout_source,
            masked_code(layout_source, code_mask(layout_source)),
            {"Box": "Box"},
            set(),
            set(),
            layout_errors,
        )
        if layout_errors:
            raise AssertionError(f"Python verifier rejected layout composition: {layout_errors}")

        styled_source = (
            "import styled from 'styled-components'; "
            "export const StyledInput=styled(Input)`border-radius:0`;"
        )
        styled_errors: list[str] = []
        inspect_overrides(
            target,
            path,
            styled_source,
            masked_code(styled_source, code_mask(styled_source)),
            {"Input": "Input"},
            set(),
            {"Input"},
            styled_errors,
        )
        if not any("[PUI_EXTERNAL_STYLE]" in error for error in styled_errors):
            raise AssertionError("Python verifier accepted a styled-components wrapper")

    clone_findings = verifier["react_clone_element_findings"]
    for source in (
        "import React from 'react'; React.cloneElement(element,{style:{color:'red'}});",
        "import {cloneElement as copy} from 'react'; copy(element,{css:{color:'red'}});",
        "const {cloneElement:copy}=require('react'); copy(element,{style:{color:'red'}});",
    ):
        code = masked_code(source, code_mask(source))
        codes = {code_name for code_name, _line, _message in clone_findings(source, code)}
        if "PUI_UNINSPECTABLE_PROPS" not in codes:
            raise AssertionError("Python verifier accepted React.cloneElement")

    dynamic_findings = verifier["dynamic_style_findings"]
    for source in (
        "const node=document.querySelector('input'); node?.style.setProperty('color','red');",
        "const node=document.querySelector('input'); node?.classList.add('foreign-input');",
        "const sheet:CSSStyleSheet=getSheet(); sheet.insertRule('input{color:red}');",
        "const sheet:CSSStyleSheet=getSheet(); sheet.replaceSync('input{color:red}');",
        "const sheet:CSSStyleSheet=getSheet(); sheet.replace('input{color:red}');",
        "document.adoptedStyleSheets=[];",
        "document.createElement('style');",
    ):
        code = masked_code(source, code_mask(source))
        codes = {code_name for code_name, _line, _message in dynamic_findings(source, code)}
        if "PUI_DYNAMIC_STYLE" not in codes:
            raise AssertionError(f"Python verifier accepted dynamic style mutation: {source}")

    business_source = (
        "const preferences={style:'comfortable'}; preferences.style='compact'; "
        "const record={className:'tier'}; record.className='plan';"
    )
    business_code = masked_code(business_source, code_mask(business_source))
    if dynamic_findings(business_source, business_code):
        raise AssertionError("Python verifier rejected ordinary business style/className fields")


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
    expect_valid(
        "safe application layout and reset styles",
        {
            "src/App.tsx": """
                import { Box } from './personal-ui';
                import './app.css';
                export const App=()=> <Box className='page-shell'>Content</Box>;
            """,
            "src/app.css": """
                :root { --pui-primary: #2563eb; }
                *, *::before, *::after { box-sizing: border-box; }
                input, button, select { font: inherit; box-sizing: border-box; }
                .page-shell { display: grid; gap: 16px; min-width: 0; }
            """,
        },
        {"Box"},
    )
    expect_valid(
        "product artwork styles and layout props",
        {
            "src/App.tsx": """
                import { Stack } from './personal-ui';
                import './artwork.scss';
                export const App=()=> <Stack style={{minHeight: 0}}><div className='product-artwork' /></Stack>;
            """,
            "src/artwork.scss": """
                .product-artwork { display: grid; }
                .product-artwork__icon,
                svg.product-artwork__icon,
                .product-artwork svg.product-artwork__icon { width: 100%; height: auto; }
            """,
        },
        {"Stack"},
    )
    expect_valid(
        "relational selector styles only its layout subject",
        {"src/app.css": ".page-shell:has(input) { display: grid; gap: 16px; }"},
        set(),
    )
    expect_valid(
        "preprocessor directives outside protected selectors",
        {
            "src/layout.scss": "@mixin page-grid { display:grid; gap:16px; } .page-shell { @include page-grid; }",
            "src/utilities.pcss": ".page-actions { @apply flex gap-4; }",
        },
        set(),
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
        (
            "generic input CSS override",
            {"src/app.css": ".login-form input { background: #e8f0fe; border-radius: 999px; }"},
            {"PUI_GENERIC_STYLE_OVERRIDE"},
        ),
        (
            "password attribute CSS override",
            {"src/app.css": "[type='password'] { padding-right: 0; }"},
            {"PUI_GENERIC_STYLE_OVERRIDE"},
        ),
        (
            "autofill CSS override",
            {"src/app.css": "input:-webkit-autofill { box-shadow: inset 0 0 0 100px pink; }"},
            {"PUI_GENERIC_STYLE_OVERRIDE"},
        ),
        (
            "universal CSS skin override",
            {"src/app.css": "* { border-radius: 0 !important; }"},
            {"PUI_GENERIC_STYLE_OVERRIDE"},
        ),
        (
            "descendant universal CSS skin override",
            {"src/app.css": ".login-form > * { border-radius: 0; }"},
            {"PUI_GENERIC_STYLE_OVERRIDE"},
        ),
        (
            "functional universal CSS skin override",
            {"src/app.css": ".login-form :where(*) { min-width: 0; }"},
            {"PUI_GENERIC_STYLE_OVERRIDE"},
        ),
        (
            "table descendant CSS override",
            {"src/app.css": ".table-wrap td { padding: 0; }"},
            {"PUI_GENERIC_STYLE_OVERRIDE"},
        ),
        (
            "generic descendant SVG override",
            {"src/app.css": ".login-form svg { transform: translateY(3px); }"},
            {"PUI_GENERIC_STYLE_OVERRIDE"},
        ),
        (
            "private class CSS selector",
            {"src/app.css": ".pui-input { background: red; }"},
            {"PUI_PRIVATE_CLASS"},
        ),
        (
            "reserved ownership CSS selector",
            {"src/app.css": "[data-pui-owner='Input'] { padding: 0; }"},
            {"PUI_RESERVED_MARKER"},
        ),
        (
            "nested SCSS control override",
            {"src/app.scss": ".login-form { input { background: red; } }"},
            {"PUI_GENERIC_STYLE_OVERRIDE"},
        ),
        (
            "indented Sass control override",
            {"src/app.sass": ".login-form\n  input\n    background: red\n"},
            {"PUI_GENERIC_STYLE_OVERRIDE"},
        ),
        (
            "HTML style control override",
            {"public/embed.html": "<style>.login-form input { background: red; }</style><div></div>"},
            {"PUI_GENERIC_STYLE_OVERRIDE"},
        ),
        (
            "component className override",
            {"src/App.tsx": "import {Input} from './personal-ui'; export const App=()=> <Input className='foreign-input' />;"},
            {"PUI_COMPONENT_STYLE_OVERRIDE"},
        ),
        (
            "component inline style override",
            {"src/App.tsx": "import {Input} from './personal-ui'; export const App=()=> <Input style={{background:'red'}} />;"},
            {"PUI_COMPONENT_STYLE_OVERRIDE"},
        ),
        (
            "component spread style bypass",
            {"src/App.tsx": "import {Input} from './personal-ui'; export const App=(props:any)=> <Input {...props} />;"},
            {"PUI_COMPONENT_STYLE_OVERRIDE"},
        ),
        (
            "component transformed style props",
            {"src/App.tsx": "import {Input} from './personal-ui'; export const App=()=> <><Input css={{borderRadius:0}} /><Input sx={{background:'red'}} /><Input tw='rounded-none' /></>;"},
            {"PUI_COMPONENT_STYLE_OVERRIDE"},
        ),
        (
            "component imperative ref escape hatch",
            {"src/App.tsx": "import {Input} from './personal-ui'; export const App=()=> <Input ref={(node:any)=>node?.style.setProperty('border-radius','0')} />;"},
            {"PUI_COMPONENT_STYLE_OVERRIDE"},
        ),
        (
            "aliased component style override",
            {"src/App.tsx": "import {Input} from './personal-ui'; const LoginInput=Input; export const App=()=> <LoginInput className='foreign-input' />;"},
            {"PUI_COMPONENT_STYLE_OVERRIDE"},
        ),
        (
            "namespace component style override",
            {"src/App.tsx": "import * as UI from './personal-ui'; export const App=()=> <UI.Input style={{background:'red'}} />;"},
            {"PUI_COMPONENT_STYLE_OVERRIDE"},
        ),
        (
            "dynamic JSX style element",
            {"src/App.tsx": "export const App=()=> <style>{`input { min-height: 96px; }`}</style>;"},
            {"PUI_UNINSPECTABLE_STYLE"},
        ),
        (
            "createElement component style override",
            {"src/App.tsx": "import React from 'react'; import {Input} from './personal-ui'; export const App=()=> React.createElement(Input,{style:{background:'red'}});"},
            {"PUI_COMPONENT_STYLE_OVERRIDE"},
        ),
        (
            "createElement transformed style prop",
            {"src/App.tsx": "import React from 'react'; import {Input} from './personal-ui'; export const App=()=> React.createElement(Input,{css:{borderRadius:0}});"},
            {"PUI_COMPONENT_STYLE_OVERRIDE"},
        ),
        (
            "aliased createElement component class override",
            {"src/App.tsx": "import React from 'react'; import {Input} from './personal-ui'; const h=React.createElement; export const App=()=> h(Input,{className:'foreign-input'});"},
            {"PUI_COMPONENT_STYLE_OVERRIDE"},
        ),
        (
            "jsx runtime component style override",
            {"src/App.js": "import {jsx as _jsx} from 'react/jsx-runtime'; import {Input} from './personal-ui'; export const App=()=>_jsx(Input,{style:{background:'red'}});"},
            {"PUI_COMPONENT_STYLE_OVERRIDE"},
        ),
        (
            "jsx runtime transformed style prop",
            {"src/App.js": "import {jsx as _jsx} from 'react/jsx-runtime'; import {Input} from './personal-ui'; export const App=()=>_jsx(Input,{sx:{borderRadius:0}});"},
            {"PUI_COMPONENT_STYLE_OVERRIDE"},
        ),
        (
            "direct component call style override",
            {"src/App.tsx": "import {Input} from './personal-ui'; export const App=()=> Input({className:'foreign-input'});"},
            {"PUI_COMPONENT_STYLE_OVERRIDE"},
        ),
        (
            "direct component call transformed style prop",
            {"src/App.tsx": "import {Input} from './personal-ui'; export const App=()=> Input({tw:'rounded-none'});"},
            {"PUI_COMPONENT_STYLE_OVERRIDE"},
        ),
        (
            "memo component style override",
            {"src/App.tsx": "import React from 'react'; import {Input} from './personal-ui'; const MemoInput=React.memo(Input); export const App=()=> <MemoInput className='foreign-input' />;"},
            {"PUI_COMPONENT_STYLE_OVERRIDE"},
        ),
        (
            "React cloneElement escape hatch",
            {"src/App.tsx": "import React from 'react'; import {Input} from './personal-ui'; export const App=()=> React.cloneElement(<Input />, {className:'foreign-input',style:{background:'red'}});"},
            {"PUI_UNINSPECTABLE_PROPS"},
        ),
        (
            "aliased cloneElement escape hatch",
            {"src/App.tsx": "import {cloneElement as copy} from 'react'; import {Input} from './personal-ui'; export const App=()=> copy(<Input />, {css:{background:'red'}});"},
            {"PUI_UNINSPECTABLE_PROPS"},
        ),
        (
            "required cloneElement escape hatch",
            {"src/App.tsx": "const {cloneElement:copy}=require('react'); import {Input} from './personal-ui'; export const App=()=> copy(<Input />, {style:{background:'red'}});"},
            {"PUI_UNINSPECTABLE_PROPS"},
        ),
        (
            "styled-components protected wrapper",
            {
                "src/Styled.tsx": "import styled from 'styled-components'; import {Input} from './personal-ui'; export const StyledInput=styled(Input)`border-radius:0;background:red;`;",
                "src/App.tsx": "import {StyledInput} from './Styled'; export const App=()=> <StyledInput />;",
            },
            {"PUI_EXTERNAL_STYLE"},
        ),
        (
            "Emotion protected wrapper",
            {
                "src/Styled.tsx": "import styled from '@emotion/styled'; import {Input} from './personal-ui'; export const StyledInput=styled(Input)({borderRadius:0,background:'red'});",
                "src/App.tsx": "import {StyledInput} from './Styled'; export const App=()=> <StyledInput />;",
            },
            {"PUI_EXTERNAL_STYLE"},
        ),
        (
            "CSSOM rule injection",
            {"src/App.tsx": "const sheet=new CSSStyleSheet(); sheet.insertRule('input{border-radius:0}'); sheet.deleteRule(0); sheet.replaceSync('input{background:red}'); sheet.replace('input{height:90px}'); document.styleSheets[0].insertRule('button{border-radius:0}'); document.adoptedStyleSheets=[sheet]; export const App=()=> null;"},
            {"PUI_DYNAMIC_STYLE"},
        ),
        (
            "CSSStyleSheet insertRule in isolation",
            {"src/App.tsx": "export const inject=(sheet:CSSStyleSheet)=>sheet.insertRule('input{border-radius:0}');"},
            {"PUI_DYNAMIC_STYLE"},
        ),
        (
            "CSSStyleSheet deleteRule in isolation",
            {"src/App.tsx": "export const remove=(sheet:CSSStyleSheet)=>sheet.deleteRule(0);"},
            {"PUI_DYNAMIC_STYLE"},
        ),
        (
            "CSSStyleSheet replaceSync in isolation",
            {"src/App.tsx": "export const rewrite=(sheet:CSSStyleSheet)=>sheet.replaceSync('input{border-radius:0}');"},
            {"PUI_DYNAMIC_STYLE"},
        ),
        (
            "CSSStyleSheet async replace in isolation",
            {"src/App.tsx": "export const rewrite=(sheet:CSSStyleSheet)=>sheet.replace('input{border-radius:0}');"},
            {"PUI_DYNAMIC_STYLE"},
        ),
        (
            "adoptedStyleSheets assignment in isolation",
            {"src/App.tsx": "export const install=(sheet:CSSStyleSheet)=>{document.adoptedStyleSheets=[sheet]};"},
            {"PUI_DYNAMIC_STYLE"},
        ),
        (
            "CSSStyleSheet construction in isolation",
            {"src/App.tsx": "export const makeSheet=()=>new CSSStyleSheet();"},
            {"PUI_DYNAMIC_STYLE"},
        ),
        (
            "DOM style and class mutation",
            {"src/App.tsx": "const node=document.querySelector('input'); node?.style.setProperty('border-radius','0'); if(node){node.style.background='red';node.className='foreign-input';node.classList.add('foreign-input');node.classList.remove('pui-input');node.classList.toggle('flat');node.classList.replace('old','new')} export const App=()=> null;"},
            {"PUI_DYNAMIC_STYLE"},
        ),
        (
            "DOM style attribute mutation",
            {"src/App.tsx": "const node=document.querySelector('input'); node?.setAttribute('style','border-radius:0'); node?.setAttribute('class','foreign-input'); export const App=()=> null;"},
            {"PUI_DYNAMIC_STYLE"},
        ),
        (
            "dynamic style element creation",
            {"src/App.tsx": "const style=document.createElement('style'); style.textContent='input{border-radius:0}'; document.head.append(style); export const App=()=> null;"},
            {"PUI_DYNAMIC_STYLE"},
        ),
        (
            "external package stylesheet import",
            {"src/App.tsx": "import 'redteam-global/style.css'; export const App=()=> null;"},
            {"PUI_EXTERNAL_STYLE"},
        ),
        (
            "remote CSS import",
            {"src/app.css": "@import url('https://example.com/foreign.css'); .page { display: grid; }"},
            {"PUI_EXTERNAL_STYLE"},
        ),
        (
            "bare CSS package import",
            {"src/app.scss": "@use 'foreign-theme'; .page { display: grid; }"},
            {"PUI_EXTERNAL_STYLE"},
        ),
        (
            "remote HTML stylesheet",
            {"public/embed.html": "<link rel='stylesheet' href='https://example.com/foreign.css'><div></div>"},
            {"PUI_EXTERNAL_STYLE"},
        ),
        (
            "autofill state pseudo-class override",
            {"src/app.css": ".login-form :autofill { background: pink; }"},
            {"PUI_GENERIC_STYLE_OVERRIDE"},
        ),
        (
            "link state pseudo-class override",
            {"src/app.css": ".navigation :any-link { border-radius: 0; }"},
            {"PUI_GENERIC_STYLE_OVERRIDE"},
        ),
        (
            "escaped input selector override",
            {"src/app.css": "\\69nput { min-height: 96px; }"},
            {"PUI_GENERIC_STYLE_OVERRIDE"},
        ),
        (
            "escaped private class selector",
            {"src/app.css": ".\\70 ui-input { background: red; }"},
            {"PUI_PRIVATE_CLASS"},
        ),
        (
            "SCSS mixin inside protected selector",
            {"src/app.scss": "@mixin foreign-skin { background: red; } input { @include foreign-skin; }"},
            {"PUI_GENERIC_STYLE_OVERRIDE"},
        ),
        (
            "indented Sass mixin inside protected selector",
            {"src/app.sass": "@mixin foreign-skin\n  background: red\ninput\n  @include foreign-skin\n"},
            {"PUI_GENERIC_STYLE_OVERRIDE"},
        ),
        (
            "Less mixin inside protected selector",
            {"src/app.less": ".foreign-skin(){background:red;} input { .foreign-skin(); }"},
            {"PUI_GENERIC_STYLE_OVERRIDE"},
        ),
        (
            "PostCSS apply inside protected selector",
            {"src/app.pcss": "input { @apply rounded-none bg-red-500; }"},
            {"PUI_GENERIC_STYLE_OVERRIDE"},
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

    test_autofill_contract()
    test_python_style_gate_contract()
    test_installer_build_gate()

    print(
        json.dumps(
            {
                "valid": True,
                "scannerCases": len(cases) + 9,
                "installerGate": True,
                "autofillContract": True,
                "pythonStyleGate": True,
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
