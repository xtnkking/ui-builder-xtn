#!/usr/bin/env python3
"""Focused positive and negative contracts for the support matrix validator."""

from __future__ import annotations

import copy
import json
import unittest

from validate_support_matrix import (
    DEFAULT_FIXTURES,
    DEFAULT_MATRIX,
    DEFAULT_WORKFLOW,
    validate_support_contract,
)


class SupportMatrixContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.matrix = json.loads(DEFAULT_MATRIX.read_text(encoding="utf-8"))
        cls.fixtures = json.loads(DEFAULT_FIXTURES.read_text(encoding="utf-8"))
        cls.workflow = DEFAULT_WORKFLOW.read_text(encoding="utf-8")

    def validate(
        self,
        *,
        matrix: dict | None = None,
        fixtures: dict | None = None,
        workflow: str | None = None,
    ) -> dict:
        return validate_support_contract(
            copy.deepcopy(self.matrix if matrix is None else matrix),
            copy.deepcopy(self.fixtures if fixtures is None else fixtures),
            self.workflow if workflow is None else workflow,
        )

    def assert_has_error(self, report: dict, fragment: str) -> None:
        self.assertFalse(report["valid"], report)
        self.assertTrue(
            any(fragment in error for error in report["errors"]),
            f"expected {fragment!r} in {report['errors']!r}",
        )

    def evidence(self, fixture: dict, *, artifact: str = "a" * 64) -> dict:
        return {
            "id": fixture["id"],
            "kind": "hosted-ci-fixture",
            "source": "https://github.com/xtnkking/ui-builder-xtn/actions/runs/123",
            "sourceCommit": "b" * 40,
            "runId": 123,
            "runAttempt": 1,
            "job": fixture["ci"]["job"],
            "artifactSha256": artifact,
            "recordedAt": "2026-09-27T08:00:00Z",
            "result": "passed",
            "environment": copy.deepcopy(fixture["environment"]),
            "operations": list(fixture["operations"]),
        }

    def test_repository_support_contract_is_valid(self) -> None:
        report = self.validate()
        self.assertTrue(report["valid"], report["errors"])
        self.assertEqual(report["fixtureCount"], 8)
        self.assertEqual(report["configuredFixtureCount"], 8)
        self.assertEqual(
            [row["node"] for row in report["matrices"]["static_matrix"]["include"]],
            ["22.12.0", "24.0.0"],
        )
        self.assertEqual(
            [
                (row["react"], row["react_dom"], row["typescript"])
                for row in report["matrices"]["compatibility_matrix"]["include"]
            ],
            [
                ("18.3.1", "18.3.1", "5.7.3"),
                ("19.1.1", "19.1.1", "5.9.3"),
            ],
        )
        self.assertEqual(
            [
                (
                    row["package_manager"],
                    row["package_manager_version"],
                    row["node"],
                )
                for row in report["matrices"]["integration_matrix"]["include"]
            ],
            [
                ("pnpm", "9.15.9", "22.12.0"),
                ("pnpm", "10.17.1", "24.0.0"),
                ("yarn", "4.9.4", "22.12.0"),
                ("yarn", "4.9.4", "24.0.0"),
            ],
        )

    def test_verified_without_evidence_is_rejected(self) -> None:
        fixtures = copy.deepcopy(self.fixtures)
        fixtures["fixtures"][0]["status"] = "verified"
        fixtures["fixtures"][0]["evidence"] = []
        report = self.validate(fixtures=fixtures)
        self.assert_has_error(report, "verified without structured evidence")

    def test_fixture_and_ci_can_promote_to_verified_with_structured_evidence(self) -> None:
        matrix = copy.deepcopy(self.matrix)
        fixtures = copy.deepcopy(self.fixtures)
        for fixture in fixtures["fixtures"]:
            fixture["status"] = "verified"
            fixture["ci"]["configurationOnly"] = False
            fixture["evidence"] = [self.evidence(fixture)]
        fixtures["ci"]["configurationStatus"] = "verified"
        fixtures["ci"]["evidence"] = [
            {
                **self.evidence(fixtures["fixtures"][0]),
                "id": "quality-run-123",
                "kind": "hosted-ci-release-bundle",
                "job": "hosted-evidence",
                "operations": ["all-eight-fixtures", "browser-quality", "real-safari-smoke"],
            }
        ]
        matrix["profiles"]["0.3.0"]["verifiedFixtureIds"] = [
            fixture["id"] for fixture in fixtures["fixtures"]
        ]
        report = self.validate(matrix=matrix, fixtures=fixtures)
        self.assertTrue(report["valid"], report["errors"])

    def test_thin_verified_evidence_is_rejected(self) -> None:
        fixtures = copy.deepcopy(self.fixtures)
        fixture = fixtures["fixtures"][0]
        fixture["status"] = "verified"
        fixture["ci"]["configurationOnly"] = False
        fixture["evidence"] = [
            {
                "id": fixture["id"],
                "kind": "hosted-ci-fixture",
                "source": "https://example.invalid/run/1",
                "recordedAt": "2026-09-27T08:00:00Z",
                "result": "passed",
                "environment": {},
            }
        ]
        matrix = copy.deepcopy(self.matrix)
        matrix["profiles"]["0.3.0"]["verifiedFixtureIds"] = [fixture["id"]]
        report = self.validate(matrix=matrix, fixtures=fixtures)
        self.assert_has_error(report, "sourceCommit")

    def test_react_and_react_dom_must_match(self) -> None:
        fixtures = copy.deepcopy(self.fixtures)
        fixtures["fixtures"][0]["environment"]["reactDom"] = "19.1.1"
        report = self.validate(fixtures=fixtures)
        self.assert_has_error(report, "must match React and React DOM exactly")

    def test_missing_target_lane_is_rejected(self) -> None:
        fixtures = copy.deepcopy(self.fixtures)
        fixtures["fixtures"] = [
            fixture
            for fixture in fixtures["fixtures"]
            if fixture["environment"]["packageManager"]["version"] != "10.17.1"
        ]
        report = self.validate(fixtures=fixtures)
        self.assert_has_error(report, "fixture catalog does not cover packageManagers")

    def test_missing_rollback_is_rejected(self) -> None:
        fixtures = copy.deepcopy(self.fixtures)
        fixtures["fixtures"][0]["operations"].remove("rollback")
        report = self.validate(fixtures=fixtures)
        self.assert_has_error(report, "missing required operation(s): rollback")

    def test_next_fixture_without_ssr_is_rejected(self) -> None:
        fixtures = copy.deepcopy(self.fixtures)
        next_fixture = next(
            fixture
            for fixture in fixtures["fixtures"]
            if fixture["environment"]["framework"]["name"] == "next"
        )
        next_fixture["operations"].remove("ssr")
        report = self.validate(fixtures=fixtures)
        self.assert_has_error(report, "Next.js fixture is missing required operation: ssr")

    def test_playwright_webkit_cannot_verify_safari(self) -> None:
        matrix = copy.deepcopy(self.matrix)
        safari = matrix["profiles"]["0.3.0"]["browsers"]["safari"]
        safari["status"] = "verified"
        safari["evidence"] = [
            {
                "id": "webkit-is-not-safari",
                "kind": "browser-smoke",
                "source": "https://example.invalid/actions/run/1",
                "recordedAt": "2026-09-22T08:00:00Z",
                "result": "passed",
                "environment": {
                    "product": "Playwright WebKit",
                    "engine": "webkit",
                    "runner": "playwright-webkit",
                    "version": "26.0",
                    "realSafari": False
                }
            }
        ]
        report = self.validate(matrix=matrix)
        self.assert_has_error(report, "Playwright WebKit is not Safari evidence")

    def test_local_absolute_path_is_rejected(self) -> None:
        fixtures = copy.deepcopy(self.fixtures)
        fixtures["fixtures"][0]["project"]["sourceRoot"] = (
            "C:\\Users\\example\\.codex\\skills\\ui-builder-xtn"
        )
        report = self.validate(fixtures=fixtures)
        self.assert_has_error(report, "contains a local absolute path")

    def test_unknown_ci_fixture_reference_is_rejected(self) -> None:
        fixtures = copy.deepcopy(self.fixtures)
        fixtures["ci"]["staticFixtureIds"].append("missing-fixture")
        report = self.validate(fixtures=fixtures)
        self.assert_has_error(report, "CI references unknown fixture id")

    def test_missing_workflow_gate_is_rejected(self) -> None:
        workflow = self.workflow.replace("  support-contract:\n", "  removed-contract:\n", 1)
        report = self.validate(workflow=workflow)
        self.assert_has_error(report, "workflow is missing required job: support-contract")

    def test_real_safari_and_hosted_bundle_jobs_are_required(self) -> None:
        workflow = self.workflow.replace("  safari-quality:\n", "  removed-safari:\n", 1)
        report = self.validate(workflow=workflow)
        self.assert_has_error(report, "workflow is missing required job: safari-quality")

        workflow = self.workflow.replace("  hosted-evidence:\n", "  removed-hosted:\n", 1)
        report = self.validate(workflow=workflow)
        self.assert_has_error(report, "workflow is missing required job: hosted-evidence")

    def test_integration_job_requires_current_corepack_and_validator_dependencies(self) -> None:
        workflow = self.workflow.replace("corepack@0.34.0", "corepack@0.29.4", 1)
        report = self.validate(workflow=workflow)
        self.assert_has_error(report, "corepack@0.34.0")

        workflow = self.workflow.replace(
            "      - name: Install repository validator dependencies\n"
            "        working-directory: assets/react-kit\n"
            "        run: npm ci\n\n",
            "",
            1,
        )
        report = self.validate(workflow=workflow)
        self.assert_has_error(report, "working-directory: assets/react-kit")


if __name__ == "__main__":
    unittest.main()
