#!/usr/bin/env python3
"""Focused contract tests for public-export classification and coverage metadata."""

from __future__ import annotations

import copy
import json
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from generate_component_coverage import (
    DEFAULT_KIT_ROOT,
    DEFAULT_DOCUMENTATION,
    DEFAULT_MANIFEST,
    DEFAULT_OUTPUT,
    DEFAULT_REGISTRY,
    SKILL_ROOT,
    build_coverage_matrix,
    collect_explicit_test_evidence,
    collect_validated_explorer_evidence,
    collect_validated_test_evidence,
    runtime_exports_from_api_report,
    validate_export_metadata,
    validate_runner_configuration,
)


class ComponentCoverageContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.registry = json.loads(DEFAULT_REGISTRY.read_text(encoding="utf-8"))
        cls.manifest = json.loads(DEFAULT_MANIFEST.read_text(encoding="utf-8"))
        cls.documentation = json.loads(
            DEFAULT_DOCUMENTATION.read_text(encoding="utf-8")
        )

    def test_canonical_registry_classifies_every_export_once(self) -> None:
        exports, classifications, stability, errors = validate_export_metadata(
            self.registry
        )
        self.assertEqual(errors, [])
        self.assertEqual(set(classifications), set(exports))
        self.assertEqual(set(stability), set(exports))
        self.assertEqual(len(exports), len(self.registry["exports"]))

    def test_missing_classification_fails(self) -> None:
        registry = copy.deepcopy(self.registry)
        registry["exportClassifications"]["fixed-control"].remove("Button")
        _, _, _, errors = validate_export_metadata(registry)
        self.assertTrue(
            any("leaves export(s) unclassified: Button" in error for error in errors)
        )

    def test_unknown_classified_export_fails(self) -> None:
        registry = copy.deepcopy(self.registry)
        registry["exportClassifications"]["fixed-control"].append("UnknownControl")
        _, _, _, errors = validate_export_metadata(registry)
        self.assertTrue(
            any("references unknown export(s): UnknownControl" in error for error in errors)
        )

    def test_cross_group_duplicate_fails(self) -> None:
        registry = copy.deepcopy(self.registry)
        registry["exportClassifications"]["layout"].append("Button")
        _, _, _, errors = validate_export_metadata(registry)
        self.assertTrue(
            any("assigns 'Button' to both" in error for error in errors)
        )

    def test_committed_matrix_matches_clean_regeneration(self) -> None:
        committed = json.loads(DEFAULT_OUTPUT.read_text(encoding="utf-8"))
        generated = build_coverage_matrix(
            skill_root=SKILL_ROOT,
            kit_root=DEFAULT_KIT_ROOT,
            manifest=self.manifest,
            registry=self.registry,
        )
        self.assertEqual(committed, generated)

    def test_canonical_documentation_registers_every_export_once(self) -> None:
        self.assertEqual(
            set(self.documentation["exports"]), set(self.registry["exports"])
        )
        self.assertEqual(
            len(self.documentation["exports"]), len(self.registry["exports"])
        )

    def test_missing_documentation_export_fails_generation(self) -> None:
        documentation = copy.deepcopy(self.documentation)
        del documentation["exports"]["Button"]
        with self.assertRaisesRegex(
            ValueError, "component documentation is missing export metadata: Button"
        ):
            build_coverage_matrix(
                skill_root=SKILL_ROOT,
                kit_root=DEFAULT_KIT_ROOT,
                manifest=self.manifest,
                registry=self.registry,
                documentation=documentation,
            )

    def test_strict_documentation_rejects_real_missing_cells(self) -> None:
        documentation = copy.deepcopy(self.documentation)
        overrides = documentation["exports"]["Button"].setdefault("overrides", {})
        overrides["apiPage"] = {"status": "missing"}
        overrides["keyboard"] = {"mode": "custom", "status": "missing"}
        with self.assertRaises(ValueError) as raised:
            build_coverage_matrix(
                skill_root=SKILL_ROOT,
                kit_root=DEFAULT_KIT_ROOT,
                manifest=self.manifest,
                registry=self.registry,
                documentation=documentation,
                enforce_documentation=True,
            )
        message = str(raised.exception)
        self.assertNotIn("Accordion is missing example documentation", message)
        self.assertNotIn("Accordion is missing apiPage documentation", message)
        self.assertIn("Button is missing apiPage documentation", message)
        self.assertIn("Button is missing keyboard evidence for custom owner mode", message)
        self.assertNotIn("Accordion is missing aria evidence", message)

    def test_invalid_owner_mode_fails_generation(self) -> None:
        documentation = copy.deepcopy(self.documentation)
        documentation["exports"]["Button"]["overrides"] = {
            "keyboard": {
                "mode": "automatic",
                "status": "missing",
            }
        }
        with self.assertRaisesRegex(
            ValueError, "unsupported owner mode 'automatic'"
        ):
            build_coverage_matrix(
                skill_root=SKILL_ROOT,
                kit_root=DEFAULT_KIT_ROOT,
                manifest=self.manifest,
                registry=self.registry,
                documentation=documentation,
            )

    def test_none_owner_mode_requires_a_reason(self) -> None:
        documentation = copy.deepcopy(self.documentation)
        documentation["profiles"]["static"]["keyboard"] = {
            "mode": "none",
            "reason": "",
        }
        with self.assertRaisesRegex(
            ValueError, "owner mode none requires a reason"
        ):
            build_coverage_matrix(
                skill_root=SKILL_ROOT,
                kit_root=DEFAULT_KIT_ROOT,
                manifest=self.manifest,
                registry=self.registry,
                documentation=documentation,
            )

    def test_delegated_contract_derives_validated_evidence(self) -> None:
        generated = build_coverage_matrix(
            skill_root=SKILL_ROOT,
            kit_root=DEFAULT_KIT_ROOT,
            manifest=self.manifest,
            registry=self.registry,
            documentation=self.documentation,
        )
        rows = {row["name"]: row for row in generated["exports"]}
        self.assertEqual(
            rows["AuthenticationPage"]["documentation"]["keyboard"]["status"],
            "documented",
        )
        self.assertEqual(
            rows["Form"]["documentation"]["aria"]["status"], "documented"
        )

    def test_generated_component_api_owns_one_page_anchor_per_export(self) -> None:
        generated = build_coverage_matrix(
            skill_root=SKILL_ROOT,
            kit_root=DEFAULT_KIT_ROOT,
            manifest=self.manifest,
            registry=self.registry,
            documentation=self.documentation,
        )
        for row in generated["exports"]:
            api_page = row["documentation"]["apiPage"]
            self.assertEqual(api_page["status"], "documented", row["name"])
            self.assertEqual(api_page["refs"], ["references/component-api.md"])
            self.assertTrue(api_page["id"].startswith("export-"))

    def test_page_pattern_cannot_waive_delegated_ownership(self) -> None:
        documentation = copy.deepcopy(self.documentation)
        documentation["exports"]["AuthenticationPage"]["overrides"] = {
            "keyboard": {
                "mode": "none",
                "reason": "Incorrectly waived.",
            }
        }
        with self.assertRaisesRegex(
            ValueError, "keyboard must use delegated ownership for a composed export"
        ):
            build_coverage_matrix(
                skill_root=SKILL_ROOT,
                kit_root=DEFAULT_KIT_ROOT,
                manifest=self.manifest,
                registry=self.registry,
                documentation=documentation,
            )

    def test_optional_interaction_exports_require_delegated_evidence(self) -> None:
        generated = build_coverage_matrix(
            skill_root=SKILL_ROOT,
            kit_root=DEFAULT_KIT_ROOT,
            manifest=self.manifest,
            registry=self.registry,
            documentation=self.documentation,
        )
        rows = {row["name"]: row["documentation"] for row in generated["exports"]}
        for export_name in ("Attachment", "CodeBlock", "Tag"):
            self.assertEqual(rows[export_name]["keyboard"]["mode"], "delegated")
            self.assertEqual(rows[export_name]["aria"]["mode"], "delegated")
            self.assertEqual(rows[export_name]["keyboard"]["status"], "documented")
            self.assertEqual(rows[export_name]["aria"]["status"], "documented")

    def test_family_is_derived_for_multi_export_manifest_entry(self) -> None:
        generated = build_coverage_matrix(
            skill_root=SKILL_ROOT,
            kit_root=DEFAULT_KIT_ROOT,
            manifest=self.manifest,
            registry=self.registry,
            documentation=self.documentation,
        )
        rows = {row["name"]: row for row in generated["exports"]}
        self.assertEqual(rows["Input"]["documentation"]["family"], "text-input")
        self.assertEqual(
            rows["PasswordInput"]["documentation"]["family"], "text-input"
        )

    def test_every_export_has_verified_api_evidence(self) -> None:
        generated = build_coverage_matrix(
            skill_root=SKILL_ROOT,
            kit_root=DEFAULT_KIT_ROOT,
            manifest=self.manifest,
            registry=self.registry,
        )
        self.assertEqual(generated["summary"]["evidenceCounts"]["api"], len(generated["exports"]))
        self.assertTrue(all(row["api"] for row in generated["exports"]))

    def test_every_export_has_ast_verified_explorer_evidence(self) -> None:
        generated = build_coverage_matrix(
            skill_root=SKILL_ROOT,
            kit_root=DEFAULT_KIT_ROOT,
            manifest=self.manifest,
            registry=self.registry,
            documentation=self.documentation,
        )
        self.assertEqual(
            generated["summary"]["evidenceCounts"]["example"],
            len(generated["exports"]),
        )
        for row in generated["exports"]:
            self.assertEqual(len(row["example"]), 1)
            self.assertEqual(row["documentation"]["example"]["status"], "documented")
            self.assertEqual(
                row["documentation"]["example"]["id"],
                f"{row['documentation']['family']}/overview",
            )

    def test_api_report_inventory_is_parsed_as_a_bounded_section(self) -> None:
        with tempfile.TemporaryDirectory(prefix="personal-ui-api-coverage-") as temporary:
            report = Path(temporary) / "api.md"
            report.write_text(
                "# API\n\n## Runtime export inventory\n\n`Button`, `Input`\n\n"
                "## Type-only export inventory\n\n`ButtonProps`\n",
                encoding="utf-8",
            )
            exports, errors = runtime_exports_from_api_report(report)
        self.assertEqual(errors, [])
        self.assertEqual(exports, ["Button", "Input"])

    def test_missing_runtime_export_in_api_report_fails_matrix_generation(self) -> None:
        with tempfile.TemporaryDirectory(prefix="personal-ui-api-coverage-") as temporary:
            report = Path(temporary) / "personal-ui.api.md"
            canonical = (DEFAULT_KIT_ROOT / "etc" / "personal-ui.api.md").read_text(
                encoding="utf-8"
            )
            report.write_text(canonical.replace("`Accordion`, ", "", 1), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "missing runtime export.*Accordion"):
                build_coverage_matrix(
                    skill_root=SKILL_ROOT,
                    kit_root=DEFAULT_KIT_ROOT,
                    manifest=self.manifest,
                    registry=self.registry,
                    api_report=report,
                )

    def test_runner_configuration_matches_static_collection_rules(self) -> None:
        self.assertEqual(validate_runner_configuration(DEFAULT_KIT_ROOT), [])

    def test_runner_command_drift_invalidates_static_collection_rules(self) -> None:
        with tempfile.TemporaryDirectory(prefix="personal-ui-runner-coverage-") as temporary:
            kit_root = Path(temporary)
            package = json.loads(
                (DEFAULT_KIT_ROOT / "package.json").read_text(encoding="utf-8")
            )
            package["scripts"]["test:browser"] += " --grep smoke"
            (kit_root / "package.json").write_text(
                json.dumps(package), encoding="utf-8"
            )
            (kit_root / "vitest.config.ts").write_text(
                (DEFAULT_KIT_ROOT / "vitest.config.ts").read_text(encoding="utf-8"),
                encoding="utf-8",
            )
            (kit_root / "playwright.config.ts").write_text(
                (DEFAULT_KIT_ROOT / "playwright.config.ts").read_text(encoding="utf-8"),
                encoding="utf-8",
            )
            errors = validate_runner_configuration(kit_root)
        self.assertTrue(any("test:browser" in error for error in errors))

    def test_test_evidence_requires_explicit_metadata(self) -> None:
        with tempfile.TemporaryDirectory(prefix="personal-ui-coverage-") as temporary:
            root = Path(temporary)
            test_file = (
                root
                / "assets"
                / "react-kit"
                / "tests"
                / "components"
                / "button.test.tsx"
            )
            test_file.parent.mkdir(parents=True)
            test_file.write_text(
                '// @personal-ui-coverage {"kind":"unit","runner":"components",'
                '"exports":["Button"]}\n'
                "// Input is an incidental name and must not become evidence.\n",
                encoding="utf-8",
            )
            evidence, metadata_files, errors = collect_explicit_test_evidence(
                skill_root=root,
                exports={"Button", "Input"},
            )
        self.assertEqual(errors, [])
        self.assertEqual(metadata_files, [test_file])
        self.assertEqual(
            evidence["unit"]["Button"],
            ["assets/react-kit/tests/components/button.test.tsx"],
        )
        self.assertEqual(evidence["unit"]["Input"], [])

    def test_metadata_outside_the_declared_runner_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory(prefix="personal-ui-coverage-") as temporary:
            root = Path(temporary)
            test_file = (
                root
                / "assets"
                / "react-kit"
                / "tests"
                / "uncollected"
                / "button.test.tsx"
            )
            test_file.parent.mkdir(parents=True)
            test_file.write_text(
                '// @personal-ui-coverage {"kind":"unit","runner":"components",'
                '"exports":["Button"]}\n',
                encoding="utf-8",
            )
            _, _, errors = collect_explicit_test_evidence(
                skill_root=root,
                exports={"Button"},
            )
        self.assertTrue(any("is not collected by runner" in error for error in errors))

    def test_unknown_metadata_export_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory(prefix="personal-ui-coverage-") as temporary:
            root = Path(temporary)
            test_file = (
                root
                / "assets"
                / "react-kit"
                / "tests"
                / "browser"
                / "unknown.spec.ts"
            )
            test_file.parent.mkdir(parents=True)
            test_file.write_text(
                '// @personal-ui-coverage {"kind":"browser","runner":"browser",'
                '"exports":["UnknownControl"]}\n',
                encoding="utf-8",
            )
            _, _, errors = collect_explicit_test_evidence(
                skill_root=root,
                exports={"Button"},
            )
        self.assertTrue(any("unknown export(s)" in error for error in errors))

    def test_example_evidence_requires_an_explorer_directive(self) -> None:
        with tempfile.TemporaryDirectory(prefix="personal-ui-example-") as temporary:
            root = Path(temporary)
            case_file = (
                root
                / "assets"
                / "react-kit"
                / "src"
                / "explorer"
                / "cases"
                / "button.tsx"
            )
            case_file.parent.mkdir(parents=True)
            case_file.write_text(
                "// Button is incidental text and is not evidence.\n",
                encoding="utf-8",
            )
            evidence, _, errors = collect_explicit_test_evidence(
                skill_root=root, exports={"Button"}
            )
            self.assertEqual(errors, [])
            self.assertEqual(evidence["example"]["Button"], [])
            case_file.write_text(
                '// @personal-ui-coverage {"kind":"example","runner":"explorer",'
                '"caseId":"button/default","exports":["Button"]}\n',
                encoding="utf-8",
            )
            evidence, _, errors = collect_explicit_test_evidence(
                skill_root=root, exports={"Button"}
            )
        self.assertEqual(errors, [])
        self.assertEqual(
            evidence["example"]["Button"],
            ["assets/react-kit/src/explorer/cases/button.tsx"],
        )

    def test_explorer_ast_failure_never_falls_back_to_directive_ownership(self) -> None:
        with tempfile.TemporaryDirectory(prefix="personal-ui-example-ast-") as temporary:
            root = Path(temporary)
            kit_root = root / "assets" / "react-kit"
            validator = kit_root / "tools" / "personal-ui" / "validate-explorer-cases.mjs"
            validator.parent.mkdir(parents=True)
            validator.write_text("// fixture", encoding="utf-8")
            case_file = (
                kit_root
                / "src"
                / "explorer"
                / "cases"
                / "actions"
                / "button.case.tsx"
            )
            case_file.parent.mkdir(parents=True)
            case_file.write_text(
                '// @personal-ui-coverage {"kind":"example","runner":"explorer",'
                '"caseId":"button/overview","exports":["Button"]}\n',
                encoding="utf-8",
            )
            directive_evidence, _, directive_errors = collect_explicit_test_evidence(
                skill_root=root,
                exports={"Button"},
            )
            self.assertEqual(directive_errors, [])
            self.assertTrue(directive_evidence["example"]["Button"])
            with patch("generate_component_coverage.subprocess.run") as run:
                run.return_value = subprocess.CompletedProcess(
                    args=[],
                    returncode=1,
                    stdout=json.dumps(
                        {
                            "ok": False,
                            "errors": ["Button needs reachable JSX"],
                            "evidence": {"Button": []},
                        }
                    ),
                    stderr="",
                )
                evidence, errors = collect_validated_explorer_evidence(
                    skill_root=root,
                    kit_root=kit_root,
                    exports={"Button"},
                )
        self.assertEqual(evidence["Button"], [])
        self.assertEqual(errors, ["Button needs reachable JSX"])

    def test_test_evidence_validator_returns_per_export_runner_refs(self) -> None:
        with tempfile.TemporaryDirectory(prefix="personal-ui-test-evidence-") as temporary:
            root = Path(temporary)
            kit_root = root / "assets" / "react-kit"
            validator = kit_root / "tools" / "personal-ui" / "validate-test-evidence.mjs"
            validator.parent.mkdir(parents=True)
            validator.write_text("// fixture", encoding="utf-8")
            keyboard_ref = "assets/react-kit/tests/browser/button.spec.ts"
            aria_ref = "assets/react-kit/tests/a11y/button.spec.ts"
            for reference in (keyboard_ref, aria_ref):
                target = root / reference
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text("// fixture", encoding="utf-8")
            with patch("generate_component_coverage.subprocess.run") as run:
                run.return_value = subprocess.CompletedProcess(
                    args=[],
                    returncode=0,
                    stdout=json.dumps(
                        {
                            "ok": True,
                            "errors": [],
                            "evidence": {
                                "keyboard": {"Button": [keyboard_ref]},
                                "a11y": {"Button": [aria_ref]},
                            },
                        }
                    ),
                    stderr="",
                )
                evidence, errors = collect_validated_test_evidence(
                    skill_root=root,
                    kit_root=kit_root,
                    exports={"Button"},
                    validator_path=validator,
                )
        self.assertEqual(errors, [])
        self.assertEqual(evidence["keyboard"]["Button"], [keyboard_ref])
        self.assertEqual(evidence["a11y"]["Button"], [aria_ref])

    def test_test_evidence_failure_never_falls_back_to_directives(self) -> None:
        with tempfile.TemporaryDirectory(prefix="personal-ui-test-evidence-") as temporary:
            root = Path(temporary)
            kit_root = root / "assets" / "react-kit"
            validator = kit_root / "tools" / "personal-ui" / "validate-test-evidence.mjs"
            validator.parent.mkdir(parents=True)
            validator.write_text("// fixture", encoding="utf-8")
            with patch("generate_component_coverage.subprocess.run") as run:
                run.return_value = subprocess.CompletedProcess(
                    args=[],
                    returncode=1,
                    stdout=json.dumps(
                        {
                            "ok": False,
                            "errors": ["Button has directive-only keyboard ownership"],
                            "evidence": {},
                        }
                    ),
                    stderr="",
                )
                evidence, errors = collect_validated_test_evidence(
                    skill_root=root,
                    kit_root=kit_root,
                    exports={"Button"},
                    validator_path=validator,
                )
        self.assertEqual(evidence["keyboard"]["Button"], [])
        self.assertEqual(evidence["a11y"]["Button"], [])
        self.assertEqual(errors, ["Button has directive-only keyboard ownership"])

    def test_keyboard_evidence_requires_the_browser_runner(self) -> None:
        with tempfile.TemporaryDirectory(prefix="personal-ui-keyboard-") as temporary:
            root = Path(temporary)
            test_file = (
                root
                / "assets"
                / "react-kit"
                / "tests"
                / "components"
                / "button.test.tsx"
            )
            test_file.parent.mkdir(parents=True)
            test_file.write_text(
                '// @personal-ui-coverage {"kind":"keyboard","runner":"components",'
                '"exports":["Button"]}\n',
                encoding="utf-8",
            )
            _, _, errors = collect_explicit_test_evidence(
                skill_root=root, exports={"Button"}
            )
        self.assertTrue(any("does not match runner" in error for error in errors))


if __name__ == "__main__":
    unittest.main()
