#!/usr/bin/env python3
"""Focused contract for supported explicit props and deliberately unsupported spreads."""
from __future__ import annotations

import unittest

from test_strict_enforcement import SKILL_ROOT, expect_issue, expect_valid


class SupportedUsageContracts(unittest.TestCase):
    def test_complete_official_explicit_example_passes_provenance(self):
        fixture = SKILL_ROOT / "assets/react-kit/tests/fixtures/supported-public-usage.tsx"
        source = fixture.read_text(encoding="utf-8").replace('"../../src/personal-ui"', '"./personal-ui"')
        expect_valid("complete explicit-prop example", {"src/App.tsx": source}, {"Button", "Field", "Form", "Input", "Select", "Stack"})

    def test_type_correct_spread_remains_a_policy_rejection(self):
        expect_issue("typed spread", {"src/App.tsx": 'import {Button, type ButtonProps} from "./personal-ui"; const props = {disabled:false,children:"Save"} satisfies ButtonProps; export const App = () => <Button {...props} />;'}, {"PUI_COMPONENT_STYLE_OVERRIDE"})

    def test_alias_and_form_register_spreads_are_rejected(self):
        sources = {
            "alias": 'import {Button as Action} from "./personal-ui"; const values={children:"Save"}; export const App=()=> <Action {...values} />;',
            "register": 'import {Input} from "./personal-ui"; import {useForm} from "react-hook-form"; export function App(){const {register}=useForm();return <Input {...register("email")} />;}',
        }
        for name, source in sources.items():
            with self.subTest(name=name):
                expect_issue(name, {"src/App.tsx": source}, {"PUI_COMPONENT_STYLE_OVERRIDE"})

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
