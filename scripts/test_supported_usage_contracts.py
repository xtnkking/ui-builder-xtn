#!/usr/bin/env python3
"""Focused public-type/provenance equivalence and fail-closed spread contracts."""
from __future__ import annotations

import unittest
import json
import runpy
import shutil
import subprocess
import tempfile
from pathlib import Path

from test_strict_enforcement import SKILL_ROOT, MANAGED_SOURCE, MANIFEST, SCANNER, FULL_VERIFIER, REGISTRY, expect_issue, expect_valid


class SupportedUsageContracts(unittest.TestCase):
    def test_complete_official_explicit_example_passes_provenance(self):
        fixture = SKILL_ROOT / "assets/react-kit/tests/fixtures/supported-public-usage.tsx"
        source = fixture.read_text(encoding="utf-8").replace('"../../src/personal-ui"', '"./personal-ui"')
        expect_valid("complete explicit-prop example", {"src/App.tsx": source}, {"Button", "Field", "Form", "Input", "Select", "Stack"})

    def scan_both(self, source, extra=None):
        verifier = runpy.run_path(str(FULL_VERIFIER))
        registry = json.loads(REGISTRY.read_text(encoding="utf-8"))
        protected = verifier["classified_runtime_exports"](registry, "fixed-control")
        aliases = {name: name for name in registry["exports"]}
        with tempfile.TemporaryDirectory(prefix="pui-typed-usage-") as temporary:
            target = Path(temporary)
            shutil.copytree(MANAGED_SOURCE, target / "src/personal-ui")
            (target / "src/personal-ui/registry.json").write_text(json.dumps(registry), encoding="utf-8")
            files = {"src/App.tsx": source, **(extra or {})}
            for relative, text in files.items():
                destination = target / relative
                destination.parent.mkdir(parents=True, exist_ok=True)
                destination.write_text(text, encoding="utf-8")
            result = subprocess.run([shutil.which("node") or "node", str(SCANNER), "--target", str(target), "--source-root", "src/personal-ui", "--manifest", str(MANIFEST)], capture_output=True, text=True, encoding="utf-8", timeout=60)
            report = json.loads(result.stdout)
            errors = []
            code = verifier["masked_code"](source, verifier["code_position_mask"](source))
            verifier["inspect_component_style_overrides"](target, target / "src/App.tsx", source, code, aliases, set(), protected, errors)
            return report, errors

    def test_safe_typed_spreads_share_the_public_type_contract(self):
        source = '''
import {Button, Button as Action, Input, DataTable, type ButtonProps, type DataTableProps} from "./personal-ui";
import {createElement} from "react";
import {jsx} from "react/jsx-runtime";
import {imported} from "./props";
const literal = {disabled:false, children:"Save"} satisfies ButtonProps;
const alias = literal;
function makeProps(): ButtonProps { return {children:"Factory"}; }
function Param(props: ButtonProps) { return <Button {...props} />; }
function Generic<T extends ButtonProps>(props: T) { return <Button {...props} />; }
const condition = Math.random() > .5;
const union = condition ? {disabled:true, children:"A"} : {disabled:false, children:"B"};
type Row = {id:string};
const table: DataTableProps<Row> = {rows:[],columns:[],rowKey:row=>row.id,ariaLabel:"Rows"};
const nativeFactory = createElement(Button, literal);
const spreadFactory = createElement(Button, {...literal});
const runtimeFactory = jsx(Button, literal);
export const App = () => <><Button {...literal} /><Action {...alias} /><Button {...makeProps()} />
<Button {...imported} /><Button {...union} /><Button {...{...literal, loading:false}} />
<Input {...{defaultValue:"Ada"}} /><DataTable<Row> {...table} /><Param {...literal}/><Generic {...literal}/></>;
'''
        report, errors = self.scan_both(source, {"src/props.ts": 'import type {ButtonProps} from "./personal-ui"; export const imported: ButtonProps = {children:"Imported"};'})
        self.assertTrue(report["valid"], report)
        self.assertEqual(errors, [])

    def test_opaque_hidden_and_ill_typed_spreads_fail_in_both_gates(self):
        source = '''
import {Button, Input, type ButtonProps} from "./personal-ui";
import {createElement} from "react";
import {jsx} from "react/jsx-runtime";
declare const opaque: any;
declare const indexed: Record<string, unknown>;
const hidden = {children:"Bad", style:{color:"red"}};
const widened: ButtonProps = hidden;
const marker = {"data-pui-owner":"Consumer"};
const unknown = {children:"Bad", notAPublicProp:true};
const typedWrong: ButtonProps = {disabled:"yes"};
function hiddenFactory(): ButtonProps {return hidden;}
const badFactory = createElement(Button, {disabled:"yes"});
const badRuntimeFactory = jsx(Button, {disabled:"yes"});
const hiddenFactoryProps = createElement(Button, widened);
export const App = () => <><Button {...opaque}/><Button {...indexed}/><Button {...widened}/>
<Button {...marker}/><Button {...unknown}/><Button {...typedWrong}/><Button {...hiddenFactory()}/>
<Button disabled="yes"/><Input value="controlled"/></>;
'''
        report, errors = self.scan_both(source)
        self.assertFalse(report["valid"])
        combined = "\n".join(report["errors"])
        for reason in ("any/unknown", "index signature", "style prop hidden", "data-pui-owner", "notAPublicProp", "ill-typed spread source", "PUI_PUBLIC_PROP_TYPE"):
            self.assertIn(reason, combined)
            self.assertIn(reason, "\n".join(errors))
        self.assertTrue(any("invalid public call props" in error for error in errors))

    def test_installer_distributes_the_same_compiler_helper(self):
        installer = runpy.run_path(str(SKILL_ROOT / "scripts/install_personal_ui.py"))
        relative = Path("tools/personal-ui/typed-usage.mjs")
        payload = installer["support_file_map"]()
        self.assertEqual(payload[relative], (SKILL_ROOT / "assets/react-kit" / relative).read_bytes())
        self.assertIn(relative.as_posix(), installer["INTEGRATED_SUPPORT_OWNERSHIP"])

    def test_react_intrinsic_key_is_supported_without_weakening_public_props(self):
        prefix = '''
import {Button} from "./personal-ui";
import {createElement} from "react";
import {jsx} from "react/jsx-runtime";
'''
        valid = prefix + '''
const props = {key:"save", children:"Save"};
const keyOnly = {key:12};
const emptyKey = {key:null, children:"Save"};
const unsetKey = {key:undefined, children:"Save"};
const factories = [createElement(Button, props), createElement(Button, {...keyOnly}), jsx(Button, props), jsx(Button, keyOnly)];
export const App = () => <><Button {...props}/><Button {...keyOnly}/><Button {...emptyKey}/><Button {...unsetKey}/></>;
'''
        report, errors = self.scan_both(valid)
        self.assertTrue(report["valid"], report)
        self.assertEqual(errors, [])
        invalid = prefix + '''
const badObject = {key:{id:"save"}, children:"Save"};
const badBoolean = {key:true, children:"Save"};
const badStyle = {key:"save", style:{color:"red"}, children:"Save"};
const badRef = {key:"save", ref:()=>undefined, children:"Save"};
const factories = [createElement(Button, badObject), createElement(Button, badBoolean), jsx(Button, badObject), jsx(Button, badBoolean)];
export const App = () => <><Button {...badObject}/><Button {...badBoolean}/><Button {...badStyle}/><Button {...badRef}/></>;
'''
        report, errors = self.scan_both(invalid)
        self.assertFalse(report["valid"])
        for text in ("invalid React intrinsic key type", "PUI_PUBLIC_PROP_TYPE", "style prop hidden", "ref prop hidden"):
            self.assertIn(text, "\n".join(report["errors"]))
            self.assertIn(text, "\n".join(errors))

    def test_form_binding_exception_does_not_allow_external_visual_props(self):
        sources = {
            "visual prop": 'import {Button} from "./personal-ui"; import {useController} from "react-hook-form"; const {field}=useController({name:"email"}); export const App=()=> <Button icon={field}>Save</Button>;',
            "foreign binding": 'import {Input} from "./personal-ui"; import {field} from "foreign-form"; export const App=()=> <Input controllerField={field} />;',
        }
        for name, source in sources.items():
            with self.subTest(name=name):
                expect_issue(name, {"src/App.tsx": source}, {"PUI_EXTERNAL_JSX"})

    def test_explicit_styling_ref_and_ownership_escapes_are_rejected(self):
        for prop in ('className="foreign"', 'style={{color:"red"}}', 'css={{color:"red"}}', 'sx={{color:"red"}}', 'tw="foreign"', 'ref={()=>undefined}', 'data-pui-owner="Foreign"'):
            with self.subTest(prop=prop):
                expect_issue(prop, {"src/App.tsx": f'import {{Button}} from "./personal-ui"; export const App=()=> <Button {prop}>Save</Button>;'}, {"PUI_COMPONENT_STYLE_OVERRIDE"})


if __name__ == "__main__":
    unittest.main()
