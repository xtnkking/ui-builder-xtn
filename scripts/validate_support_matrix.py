#!/usr/bin/env python3
"""Validate the v0.3.0 support targets, representative fixtures, and CI wiring."""

from __future__ import annotations

import argparse
import json
import os
import re
from pathlib import Path, PurePosixPath, PureWindowsPath
from typing import Any, Iterable


SKILL_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MATRIX = SKILL_ROOT / "references" / "support-matrix.json"
DEFAULT_FIXTURES = SKILL_ROOT / "references" / "support-fixtures.json"
DEFAULT_WORKFLOW = SKILL_ROOT / ".github" / "workflows" / "quality.yml"

EXPECTED_NODE = ["22.12.0", "24.0.0"]
EXPECTED_REACT = ["18.3.1", "19.1.1"]
EXPECTED_TYPESCRIPT = ["5.7.3", "5.9.3"]
EXPECTED_PACKAGE_MANAGERS = {
    "npm": ["10.9.3", "11.3.0"],
    "pnpm": ["9.15.9", "10.17.1"],
    "yarn": ["4.9.4"],
}
EXPECTED_FRAMEWORKS = {"vite": ["6.4.3"], "next": ["15.5.3"]}
EXPECTED_LAYOUTS = ["single-package", "workspace"]
EXPECTED_SOURCE_ROOT_MODES = ["canonical", "custom"]
EXPECTED_OPERATIONS = [
    "clean-install",
    "typecheck",
    "render",
    "build",
    "ssr",
    "verify",
    "upgrade",
    "rollback",
]
COMMON_FIXTURE_OPERATIONS = {
    "clean-install",
    "typecheck",
    "render",
    "build",
    "verify",
    "upgrade",
    "rollback",
}
CI_OPERATIONS = {"clean-install", "typecheck", "render", "build", "verify"}
REACT_TYPE_VERSIONS = {
    "18.3.1": ("18.3.31", "18.3.7"),
    "19.1.1": ("19.1.16", "19.1.9"),
}
EVIDENCE_FIELDS = {
    "id",
    "kind",
    "source",
    "sourceCommit",
    "runId",
    "runAttempt",
    "job",
    "artifactSha256",
    "recordedAt",
    "result",
    "environment",
    "operations",
}
SUPPORTED_TARGET_STATUSES = {"target", "verified"}


def read_json_object(path: Path, *, label: str) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"{label} must be a JSON object")
    return value


def expect_equal(
    errors: list[str], label: str, actual: Any, expected: Any
) -> None:
    if actual != expected:
        errors.append(f"{label} must equal {expected!r}; received {actual!r}")


def require_object(
    value: Any, *, label: str, errors: list[str]
) -> dict[str, Any]:
    if not isinstance(value, dict):
        errors.append(f"{label} must be an object")
        return {}
    return value


def require_list(value: Any, *, label: str, errors: list[str]) -> list[Any]:
    if not isinstance(value, list):
        errors.append(f"{label} must be an array")
        return []
    return value


def walk_values(value: Any, path: str = "$") -> Iterable[tuple[str, Any]]:
    yield path, value
    if isinstance(value, dict):
        for key, child in value.items():
            yield from walk_values(child, f"{path}.{key}")
    elif isinstance(value, list):
        for index, child in enumerate(value):
            yield from walk_values(child, f"{path}[{index}]")


def is_local_absolute_path(value: str) -> bool:
    candidate = value.strip()
    if not candidate or "://" in candidate:
        return False
    return (
        PureWindowsPath(candidate).is_absolute()
        or PurePosixPath(candidate).is_absolute()
        or candidate.startswith("\\\\")
    )


def validate_no_absolute_paths(
    value: Any, *, label: str, errors: list[str]
) -> None:
    for path, candidate in walk_values(value):
        if isinstance(candidate, str) and is_local_absolute_path(candidate):
            errors.append(
                f"{label}{path[1:]} contains a local absolute path: {candidate!r}"
            )


def validate_evidence_record(
    evidence: Any, *, label: str, errors: list[str]
) -> None:
    if not isinstance(evidence, dict):
        errors.append(f"{label} must be an object")
        return
    missing = sorted(EVIDENCE_FIELDS - set(evidence))
    if missing:
        errors.append(f"{label} is missing field(s): {', '.join(missing)}")
    for field in ("id", "kind", "source"):
        if not isinstance(evidence.get(field), str) or not evidence[field].strip():
            errors.append(f"{label}.{field} must be a non-empty string")
    recorded_at = evidence.get("recordedAt")
    if not isinstance(recorded_at, str) or not re.fullmatch(
        r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z", recorded_at
    ):
        errors.append(f"{label}.recordedAt must be an ISO-8601 UTC timestamp")
    if evidence.get("result") != "passed":
        errors.append(f"{label}.result must be 'passed'")
    if not isinstance(evidence.get("environment"), dict):
        errors.append(f"{label}.environment must be an object")
    source_commit = evidence.get("sourceCommit")
    if not isinstance(source_commit, str) or re.fullmatch(r"[0-9a-f]{40}(?:[0-9a-f]{24})?", source_commit) is None:
        errors.append(f"{label}.sourceCommit must be a complete lowercase Git object id")
    for field in ("runId", "runAttempt"):
        value = evidence.get(field)
        if not isinstance(value, int) or isinstance(value, bool) or value < 1:
            errors.append(f"{label}.{field} must be a positive integer")
    if not isinstance(evidence.get("job"), str) or not evidence["job"].strip():
        errors.append(f"{label}.job must be a non-empty string")
    digest = evidence.get("artifactSha256")
    if not isinstance(digest, str) or re.fullmatch(r"[0-9a-f]{64}", digest) is None:
        errors.append(f"{label}.artifactSha256 must be a lowercase SHA-256")
    operations = evidence.get("operations")
    if not isinstance(operations, list) or not operations or not all(
        isinstance(operation, str) and operation for operation in operations
    ):
        errors.append(f"{label}.operations must be a non-empty string array")


def validate_target_status(value: object, *, label: str, errors: list[str]) -> None:
    if value not in SUPPORTED_TARGET_STATUSES:
        errors.append(f"{label} must be 'target' or 'verified'")


def validate_verified_nodes(value: Any, *, errors: list[str]) -> None:
    for path, node in walk_values(value):
        if not isinstance(node, dict) or node.get("status") != "verified":
            continue
        evidence = node.get("evidence")
        if not isinstance(evidence, list) or not evidence:
            errors.append(f"{path} is verified without structured evidence")
            continue
        for index, record in enumerate(evidence):
            validate_evidence_record(
                record, label=f"{path}.evidence[{index}]", errors=errors
            )


def validate_support_matrix(matrix: dict[str, Any], *, errors: list[str]) -> None:
    expect_equal(errors, "support matrix schemaVersion", matrix.get("schemaVersion"), 2)
    expect_equal(
        errors, "support matrix lastReviewed", matrix.get("lastReviewed"), "2026-09-27"
    )
    expect_equal(
        errors,
        "support matrix fixtureCatalog",
        matrix.get("fixtureCatalog"),
        "references/support-fixtures.json",
    )

    definitions = require_object(
        matrix.get("statusDefinitions"), label="statusDefinitions", errors=errors
    )
    expect_equal(
        errors,
        "statusDefinitions keys",
        sorted(definitions),
        ["declared", "target", "verified"],
    )
    for name in ("declared", "target", "verified"):
        if not isinstance(definitions.get(name), str) or not definitions[name].strip():
            errors.append(f"statusDefinitions.{name} must be a non-empty string")

    policy = require_object(
        matrix.get("evidencePolicy"), label="evidencePolicy", errors=errors
    )
    expected_policy = {
        "verifiedRequiresStructuredEvidence": True,
        "ciConfigurationIsEvidence": False,
        "localRunIsHostedCiEvidence": False,
        "playwrightWebKitIsSafariEvidence": False,
        "browserEvidenceMustRecordActualVersion": True,
    }
    for key, expected in expected_policy.items():
        expect_equal(errors, f"evidencePolicy.{key}", policy.get(key), expected)

    profiles = require_object(matrix.get("profiles"), label="profiles", errors=errors)
    target = require_object(profiles.get("0.3.0"), label="profiles.0.3.0", errors=errors)
    validate_target_status(target.get("status"), label="profiles.0.3.0.status", errors=errors)

    runtime = require_object(
        target.get("runtime"), label="profiles.0.3.0.runtime", errors=errors
    )
    node = require_object(runtime.get("node"), label="runtime.node", errors=errors)
    react_pairs = require_object(
        runtime.get("reactPairs"), label="runtime.reactPairs", errors=errors
    )
    typescript = require_object(
        runtime.get("typescript"), label="runtime.typescript", errors=errors
    )
    expect_equal(errors, "runtime.node.targets", node.get("targets"), EXPECTED_NODE)
    expect_equal(
        errors,
        "runtime.reactPairs.targets",
        react_pairs.get("targets"),
        [
            {"react": "18.3.1", "reactDom": "18.3.1"},
            {"react": "19.1.1", "reactDom": "19.1.1"},
        ],
    )
    expect_equal(
        errors,
        "runtime.typescript.targets",
        typescript.get("targets"),
        EXPECTED_TYPESCRIPT,
    )

    package_managers = require_object(
        target.get("packageManagers"), label="packageManagers", errors=errors
    )
    expect_equal(
        errors,
        "packageManagers.targets",
        package_managers.get("targets"),
        EXPECTED_PACKAGE_MANAGERS,
    )
    expect_equal(
        errors,
        "packageManagers.excluded",
        package_managers.get("excluded"),
        ["yarn-classic"],
    )

    projects = require_object(
        target.get("projects"), label="profiles.0.3.0.projects", errors=errors
    )
    expect_equal(errors, "projects.frameworks", projects.get("frameworks"), EXPECTED_FRAMEWORKS)
    expect_equal(errors, "projects.layouts", projects.get("layouts"), EXPECTED_LAYOUTS)
    expect_equal(
        errors,
        "projects.sourceRootModes",
        projects.get("sourceRootModes"),
        EXPECTED_SOURCE_ROOT_MODES,
    )
    expect_equal(
        errors, "projects.requiredFlow", projects.get("requiredFlow"), EXPECTED_OPERATIONS
    )

    for label, dimension in (
        ("runtime.node", node),
        ("runtime.reactPairs", react_pairs),
        ("runtime.typescript", typescript),
        ("packageManagers", package_managers),
        ("projects", projects),
    ):
        validate_target_status(dimension.get("status"), label=f"{label}.status", errors=errors)
        if not isinstance(dimension.get("evidence"), list):
            errors.append(f"{label}.evidence must be an array")

    browsers = require_object(
        target.get("browsers"), label="profiles.0.3.0.browsers", errors=errors
    )
    for browser_name in ("chromium", "firefox", "webkit", "safari"):
        browser = require_object(
            browsers.get(browser_name), label=f"browsers.{browser_name}", errors=errors
        )
        validate_target_status(
            browser.get("status"), label=f"browsers.{browser_name}.status", errors=errors
        )
        expect_equal(
            errors,
            f"browsers.{browser_name}.actualVersionRequired",
            browser.get("actualVersionRequired"),
            True,
        )
        if not isinstance(browser.get("evidence"), list):
            errors.append(f"browsers.{browser_name}.evidence must be an array")

    webkit = require_object(browsers.get("webkit"), label="browsers.webkit", errors=errors)
    expect_equal(errors, "browsers.webkit.product", webkit.get("product"), "Playwright WebKit")
    expect_equal(errors, "browsers.webkit.realSafari", webkit.get("realSafari"), False)

    safari = require_object(browsers.get("safari"), label="browsers.safari", errors=errors)
    expect_equal(errors, "browsers.safari.minimumMajor", safari.get("minimumMajor"), 18)
    expect_equal(
        errors, "browsers.safari.realSafariRequired", safari.get("realSafariRequired"), True
    )
    expect_equal(
        errors,
        "browsers.safari.acceptsPlaywrightWebKit",
        safari.get("acceptsPlaywrightWebKit"),
        False,
    )
    if safari.get("status") == "verified":
        for index, record in enumerate(safari.get("evidence", [])):
            environment = record.get("environment", {}) if isinstance(record, dict) else {}
            product = str(environment.get("product", "")).lower()
            engine = str(environment.get("engine", "")).lower()
            runner = str(environment.get("runner", "")).lower()
            if (
                environment.get("realSafari") is not True
                or product != "safari"
                or "webkit" in engine
                or "webkit" in runner
            ):
                errors.append(
                    f"browsers.safari.evidence[{index}] must come from real Safari; Playwright WebKit is not Safari evidence"
                )

    responsive = require_object(
        target.get("responsive"), label="profiles.0.3.0.responsive", errors=errors
    )
    validate_target_status(responsive.get("status"), label="responsive.status", errors=errors)
    expect_equal(
        errors,
        "responsive.cssWidths",
        responsive.get("cssWidths"),
        [2560, 1440, 1024, 736, 360, 320],
    )
    expect_equal(errors, "responsive.evidenceMilestone", responsive.get("evidenceMilestone"), "M8")

    validate_verified_nodes(matrix, errors=errors)
    validate_no_absolute_paths(matrix, label="support matrix", errors=errors)


def fixture_index(
    fixtures_document: dict[str, Any], *, errors: list[str]
) -> tuple[list[dict[str, Any]], dict[str, dict[str, Any]]]:
    raw_fixtures = require_list(
        fixtures_document.get("fixtures"), label="fixtures", errors=errors
    )
    fixtures: list[dict[str, Any]] = []
    by_id: dict[str, dict[str, Any]] = {}
    for index, raw_fixture in enumerate(raw_fixtures):
        if not isinstance(raw_fixture, dict):
            errors.append(f"fixtures[{index}] must be an object")
            continue
        fixture_id = raw_fixture.get("id")
        if not isinstance(fixture_id, str) or not re.fullmatch(
            r"[a-z0-9]+(?:-[a-z0-9]+)*", fixture_id
        ):
            errors.append(f"fixtures[{index}].id must be lowercase kebab-case")
            continue
        if fixture_id in by_id:
            errors.append(f"duplicate fixture id: {fixture_id}")
        by_id[fixture_id] = raw_fixture
        fixtures.append(raw_fixture)
    return fixtures, by_id


def validate_fixture_catalog(
    fixtures_document: dict[str, Any], *, errors: list[str]
) -> tuple[list[dict[str, Any]], dict[str, dict[str, Any]]]:
    expect_equal(
        errors,
        "support fixtures schemaVersion",
        fixtures_document.get("schemaVersion"),
        1,
    )
    expect_equal(
        errors,
        "support fixtures lastReviewed",
        fixtures_document.get("lastReviewed"),
        "2026-09-27",
    )
    selection = require_object(
        fixtures_document.get("selectionPolicy"), label="selectionPolicy", errors=errors
    )
    expect_equal(
        errors,
        "selectionPolicy.representativeCombinations",
        selection.get("representativeCombinations"),
        True,
    )
    expect_equal(
        errors,
        "selectionPolicy.fullCartesianProductRequired",
        selection.get("fullCartesianProductRequired"),
        False,
    )

    targets = require_object(
        fixtures_document.get("targets"), label="targets", errors=errors
    )
    expected_targets = {
        "node": EXPECTED_NODE,
        "react": EXPECTED_REACT,
        "reactDom": EXPECTED_REACT,
        "typescript": EXPECTED_TYPESCRIPT,
        "packageManagers": EXPECTED_PACKAGE_MANAGERS,
        "excludedPackageManagers": ["yarn-classic"],
        "frameworks": EXPECTED_FRAMEWORKS,
        "projectLayouts": EXPECTED_LAYOUTS,
        "sourceRootModes": EXPECTED_SOURCE_ROOT_MODES,
        "operations": EXPECTED_OPERATIONS,
    }
    for key, expected in expected_targets.items():
        expect_equal(errors, f"targets.{key}", targets.get(key), expected)

    fixtures, by_id = fixture_index(fixtures_document, errors=errors)
    coverage: dict[str, set[Any]] = {
        "node": set(),
        "react": set(),
        "reactDom": set(),
        "typescript": set(),
        "packageManagers": set(),
        "frameworks": set(),
        "projectLayouts": set(),
        "sourceRootModes": set(),
        "operations": set(),
    }

    for index, fixture in enumerate(fixtures):
        fixture_id = str(fixture.get("id"))
        label = f"fixture {fixture_id!r}"
        if fixture.get("status") not in {"target", "verified"}:
            errors.append(f"{label} status must be 'target' or 'verified'")
        if not isinstance(fixture.get("purpose"), str) or not fixture["purpose"].strip():
            errors.append(f"{label} purpose must be a non-empty string")

        environment = require_object(
            fixture.get("environment"), label=f"{label} environment", errors=errors
        )
        project = require_object(
            fixture.get("project"), label=f"{label} project", errors=errors
        )
        package_manager = require_object(
            environment.get("packageManager"),
            label=f"{label} packageManager",
            errors=errors,
        )
        framework = require_object(
            environment.get("framework"), label=f"{label} framework", errors=errors
        )

        node = environment.get("node")
        react = environment.get("react")
        react_dom = environment.get("reactDom")
        typescript = environment.get("typescript")
        manager_name = package_manager.get("name")
        manager_version = package_manager.get("version")
        framework_name = framework.get("name")
        framework_version = framework.get("version")
        layout = project.get("layout")
        source_root_mode = project.get("sourceRootMode")

        for value, allowed, field in (
            (node, EXPECTED_NODE, "node"),
            (react, EXPECTED_REACT, "react"),
            (react_dom, EXPECTED_REACT, "reactDom"),
            (typescript, EXPECTED_TYPESCRIPT, "typescript"),
            (layout, EXPECTED_LAYOUTS, "project.layout"),
            (source_root_mode, EXPECTED_SOURCE_ROOT_MODES, "project.sourceRootMode"),
        ):
            if value not in allowed:
                errors.append(f"{label} {field} has unsupported target {value!r}")

        if react != react_dom:
            errors.append(
                f"{label} must match React and React DOM exactly; received {react!r} and {react_dom!r}"
            )
        expected_types = REACT_TYPE_VERSIONS.get(str(react))
        if expected_types and (
            environment.get("reactTypes"), environment.get("reactDomTypes")
        ) != expected_types:
            errors.append(
                f"{label} must pin matching React type packages {expected_types!r}"
            )

        if manager_name not in EXPECTED_PACKAGE_MANAGERS:
            errors.append(f"{label} has unsupported package manager {manager_name!r}")
        elif manager_version not in EXPECTED_PACKAGE_MANAGERS[manager_name]:
            errors.append(
                f"{label} has unsupported {manager_name} version {manager_version!r}"
            )
        if framework_name not in EXPECTED_FRAMEWORKS:
            errors.append(f"{label} has unsupported framework {framework_name!r}")
        elif framework_version not in EXPECTED_FRAMEWORKS[framework_name]:
            errors.append(
                f"{label} has unsupported {framework_name} version {framework_version!r}"
            )

        operations_list = require_list(
            fixture.get("operations"), label=f"{label} operations", errors=errors
        )
        operations = set(operations_list)
        if len(operations) != len(operations_list):
            errors.append(f"{label} operations must not contain duplicates")
        missing_common = sorted(COMMON_FIXTURE_OPERATIONS - operations)
        if missing_common:
            errors.append(
                f"{label} is missing required operation(s): {', '.join(missing_common)}"
            )
        if framework_name == "next" and "ssr" not in operations:
            errors.append(f"{label} Next.js fixture is missing required operation: ssr")
        if framework_name == "next" and project.get("renderMode") != "ssr-hydration":
            errors.append(f"{label} Next.js fixture must use ssr-hydration render mode")
        if framework_name == "vite" and project.get("renderMode") != "client":
            errors.append(f"{label} Vite fixture must use client render mode")

        package_root = project.get("packageRoot")
        source_root = project.get("sourceRoot")
        if layout == "single-package" and package_root != ".":
            errors.append(f"{label} single-package fixture must use packageRoot '.'")
        if layout == "workspace" and package_root == ".":
            errors.append(f"{label} workspace fixture must identify a packageRoot")
        if source_root_mode == "canonical" and source_root != "src/personal-ui":
            errors.append(f"{label} canonical source root must be 'src/personal-ui'")
        if source_root_mode == "custom" and source_root == "src/personal-ui":
            errors.append(f"{label} custom source root must differ from 'src/personal-ui'")
        for path_field in ("workspaceRoot", "packageRoot", "sourceRoot"):
            path_value = project.get(path_field)
            if not isinstance(path_value, str) or not path_value:
                errors.append(f"{label} project.{path_field} must be a non-empty string")
            elif ".." in PurePosixPath(path_value).parts:
                errors.append(f"{label} project.{path_field} must not escape its root")

        evidence = fixture.get("evidence")
        if not isinstance(evidence, list):
            errors.append(f"{label} evidence must be an array")
        elif fixture.get("status") == "verified" and not evidence:
            errors.append(f"{label} is verified without structured evidence")

        coverage["node"].add(node)
        coverage["react"].add(react)
        coverage["reactDom"].add(react_dom)
        coverage["typescript"].add(typescript)
        coverage["packageManagers"].add((manager_name, manager_version))
        coverage["frameworks"].add((framework_name, framework_version))
        coverage["projectLayouts"].add(layout)
        coverage["sourceRootModes"].add(source_root_mode)
        coverage["operations"].update(operations)

    expected_coverage: dict[str, set[Any]] = {
        "node": set(EXPECTED_NODE),
        "react": set(EXPECTED_REACT),
        "reactDom": set(EXPECTED_REACT),
        "typescript": set(EXPECTED_TYPESCRIPT),
        "packageManagers": {
            (name, version)
            for name, versions in EXPECTED_PACKAGE_MANAGERS.items()
            for version in versions
        },
        "frameworks": {
            (name, version)
            for name, versions in EXPECTED_FRAMEWORKS.items()
            for version in versions
        },
        "projectLayouts": set(EXPECTED_LAYOUTS),
        "sourceRootModes": set(EXPECTED_SOURCE_ROOT_MODES),
        "operations": set(EXPECTED_OPERATIONS),
    }
    for dimension, expected in expected_coverage.items():
        missing = expected - coverage[dimension]
        if missing:
            errors.append(
                f"fixture catalog does not cover {dimension} target(s): "
                + ", ".join(sorted(map(str, missing)))
            )

    ci = require_object(fixtures_document.get("ci"), label="ci", errors=errors)
    configuration_status = ci.get("configurationStatus")
    if configuration_status not in {"configured-not-executed", "verified"}:
        errors.append("ci.configurationStatus must be 'configured-not-executed' or 'verified'")
    expect_equal(errors, "ci.workflow", ci.get("workflow"), ".github/workflows/quality.yml")
    ci_evidence = ci.get("evidence")
    if not isinstance(ci_evidence, list):
        errors.append("ci.evidence must be an array")
    elif configuration_status == "configured-not-executed" and ci_evidence:
        errors.append("ci.evidence must be empty while CI is configured-not-executed")
    elif configuration_status == "verified":
        if not ci_evidence:
            errors.append("verified CI requires structured hosted evidence")
        for index, record in enumerate(ci_evidence):
            validate_evidence_record(record, label=f"ci.evidence[{index}]", errors=errors)

    static_ids = require_list(
        ci.get("staticFixtureIds"), label="ci.staticFixtureIds", errors=errors
    )
    compatibility_ids = require_list(
        ci.get("compatibilityFixtureIds"),
        label="ci.compatibilityFixtureIds",
        errors=errors,
    )
    integration_ids = require_list(
        ci.get("integrationFixtureIds"),
        label="ci.integrationFixtureIds",
        errors=errors,
    )
    configured_sets = (set(static_ids), set(compatibility_ids), set(integration_ids))
    if any(
        configured_sets[left] & configured_sets[right]
        for left in range(len(configured_sets))
        for right in range(left + 1, len(configured_sets))
    ):
        errors.append("CI fixture ID groups must be pairwise distinct")

    for fixture_id, expected_job, expected_operations in (
        *((fixture_id, "static-quality", CI_OPERATIONS) for fixture_id in static_ids),
        *((fixture_id, "react-typescript-compatibility", CI_OPERATIONS) for fixture_id in compatibility_ids),
        *((fixture_id, "package-manager-framework-integration", None) for fixture_id in integration_ids),
    ):
        fixture = by_id.get(fixture_id)
        if fixture is None:
            errors.append(f"CI references unknown fixture id: {fixture_id!r}")
            continue
        fixture_ci = require_object(
            fixture.get("ci"), label=f"fixture {fixture_id!r} ci", errors=errors
        )
        expect_equal(errors, f"fixture {fixture_id!r} ci.job", fixture_ci.get("job"), expected_job)
        expect_equal(
            errors,
            f"fixture {fixture_id!r} ci.configurationOnly",
            fixture_ci.get("configurationOnly"),
            fixture.get("status") != "verified",
        )
        expect_equal(
            errors,
            f"fixture {fixture_id!r} ci.configuredOperations",
            set(fixture_ci.get("configuredOperations", [])),
            set(fixture.get("operations", []))
            if expected_operations is None
            else expected_operations,
        )
        environment = fixture.get("environment", {})
        project = fixture.get("project", {})
        if fixture_id not in integration_ids:
            if environment.get("packageManager", {}).get("name") != "npm":
                errors.append(f"CI fixture {fixture_id!r} must use npm")
            if environment.get("framework", {}).get("name") != "vite":
                errors.append(f"CI fixture {fixture_id!r} must use Vite")
            if project.get("layout") != "single-package":
                errors.append(f"CI fixture {fixture_id!r} must use a single package")
            if project.get("sourceRootMode") != "canonical":
                errors.append(f"CI fixture {fixture_id!r} must use the canonical source root")

    static_combinations = {
        (
            by_id[fixture_id]["environment"]["node"],
            by_id[fixture_id]["environment"]["packageManager"]["version"],
        )
        for fixture_id in static_ids
        if fixture_id in by_id
    }
    expect_equal(
        errors,
        "static CI Node/npm combinations",
        static_combinations,
        {("22.12.0", "10.9.3"), ("24.0.0", "11.3.0")},
    )
    compatibility_combinations = {
        (
            by_id[fixture_id]["environment"]["react"],
            by_id[fixture_id]["environment"]["typescript"],
        )
        for fixture_id in compatibility_ids
        if fixture_id in by_id
    }
    expect_equal(
        errors,
        "compatibility CI React/TypeScript combinations",
        compatibility_combinations,
        {("18.3.1", "5.7.3"), ("19.1.1", "5.9.3")},
    )
    integration_combinations = {
        (
            by_id[fixture_id]["environment"]["packageManager"]["name"],
            by_id[fixture_id]["environment"]["packageManager"]["version"],
            by_id[fixture_id]["environment"]["framework"]["name"],
            by_id[fixture_id]["project"]["layout"],
            by_id[fixture_id]["project"]["sourceRootMode"],
        )
        for fixture_id in integration_ids
        if fixture_id in by_id
    }
    expect_equal(
        errors,
        "integration CI package-manager/framework combinations",
        integration_combinations,
        {
            ("pnpm", "9.15.9", "vite", "workspace", "canonical"),
            ("pnpm", "10.17.1", "vite", "single-package", "custom"),
            ("yarn", "4.9.4", "vite", "workspace", "canonical"),
            ("yarn", "4.9.4", "next", "workspace", "custom"),
        },
    )

    if configuration_status == "verified" and any(
        fixture.get("status") != "verified" for fixture in fixtures
    ):
        errors.append("verified CI requires every configured fixture to be verified")
    if configuration_status != "verified" and all(
        fixture.get("status") == "verified" for fixture in fixtures
    ):
        errors.append("CI must be verified when every configured fixture is verified")

    validate_verified_nodes(fixtures_document, errors=errors)
    validate_no_absolute_paths(fixtures_document, label="support fixtures", errors=errors)
    return fixtures, by_id


def workflow_job_block(workflow: str, job: str) -> str | None:
    match = re.search(
        rf"(?ms)^  {re.escape(job)}:\s*\n(.*?)(?=^  [A-Za-z0-9_-]+:\s*\n|\Z)",
        workflow,
    )
    return match.group(1) if match else None


def require_workflow_snippets(
    block: str | None, *, job: str, snippets: Iterable[str], errors: list[str]
) -> None:
    if block is None:
        errors.append(f"workflow is missing required job: {job}")
        return
    for snippet in snippets:
        if snippet not in block:
            errors.append(f"workflow job {job!r} is missing contract: {snippet}")


def validate_workflow(
    workflow: str, *, by_id: dict[str, dict[str, Any]], errors: list[str]
) -> None:
    support = workflow_job_block(workflow, "support-contract")
    require_workflow_snippets(
        support,
        job="support-contract",
        snippets=(
            "static_matrix: ${{ steps.support-matrix.outputs.static_matrix }}",
            "compatibility_matrix: ${{ steps.support-matrix.outputs.compatibility_matrix }}",
            "integration_matrix: ${{ steps.support-matrix.outputs.integration_matrix }}",
            "python scripts/validate_support_matrix.py --github-output \"$GITHUB_OUTPUT\"",
            "python scripts/test_support_matrix.py",
        ),
        errors=errors,
    )
    static = workflow_job_block(workflow, "static-quality")
    require_workflow_snippets(
        static,
        job="static-quality",
        snippets=(
            "needs: support-contract",
            "matrix: ${{ fromJSON(needs.support-contract.outputs.static_matrix) }}",
            "fetch-depth: 0",
            "node-version: ${{ matrix.node }}",
            "npm@${{ matrix.npm }}",
            "npm ci",
            "npm run test:types",
            "npm run test:components",
            "npm run build",
            "python scripts/run_support_fixture.py",
            "python scripts/generate_hosted_ci_evidence.py record-fixture",
            "hosted-ci-fixture-${{ matrix.fixture_id }}",
        ),
        errors=errors,
    )
    compatibility = workflow_job_block(workflow, "react-typescript-compatibility")
    require_workflow_snippets(
        compatibility,
        job="react-typescript-compatibility",
        snippets=(
            "needs: support-contract",
            "matrix: ${{ fromJSON(needs.support-contract.outputs.compatibility_matrix) }}",
            "node-version: ${{ matrix.node }}",
            "npm@${{ matrix.npm }}",
            "npm ci",
            "react@${{ matrix.react }}",
            "react-dom@${{ matrix.react_dom }}",
            "@types/react@${{ matrix.react_types }}",
            "@types/react-dom@${{ matrix.react_dom_types }}",
            "typescript@${{ matrix.typescript }}",
            "npm run test:types",
            "tests/components/simple-fixed-controls.test.tsx",
            "npm run build",
            "python scripts/run_support_fixture.py",
            "python scripts/generate_hosted_ci_evidence.py record-fixture",
            "hosted-ci-fixture-${{ matrix.fixture_id }}",
        ),
        errors=errors,
    )
    integration = workflow_job_block(workflow, "package-manager-framework-integration")
    require_workflow_snippets(
        integration,
        job="package-manager-framework-integration",
        snippets=(
            "needs: support-contract",
            "matrix: ${{ fromJSON(needs.support-contract.outputs.integration_matrix) }}",
            "node-version: ${{ matrix.node }}",
            "working-directory: assets/react-kit",
            "npm ci",
            "corepack@0.34.0",
            "corepack install --global ${{ matrix.package_manager }}@${{ matrix.package_manager_version }}",
            "python scripts/run_support_fixture.py",
            "--fixture-id ${{ matrix.fixture_id }}",
            "python scripts/generate_hosted_ci_evidence.py record-fixture",
            "hosted-ci-fixture-${{ matrix.fixture_id }}",
        ),
        errors=errors,
    )
    browser = workflow_job_block(workflow, "browser-quality")
    require_workflow_snippets(
        browser,
        job="browser-quality",
        snippets=(
            "needs: [static-quality, react-typescript-compatibility]",
            "node-version: 22.12.0",
            "npm@10.9.3",
            "report-browser-versions.mjs",
            "browser-version-evidence.json",
            "generate_hosted_ci_evidence.py record-browser",
            "hosted-ci-browser-quality",
            "actions/upload-artifact@v4",
        ),
        errors=errors,
    )
    safari = workflow_job_block(workflow, "safari-quality")
    require_workflow_snippets(
        safari,
        job="safari-quality",
        snippets=(
            "runs-on: macos-15",
            "sudo safaridriver --enable",
            "run_safari_smoke.py",
            "#/components/button",
            "generate_hosted_ci_evidence.py record-safari",
            "hosted-ci-safari-quality",
            "m8-real-safari-smoke",
            "assets/react-kit/test-results/real-safari-smoke.json",
        ),
        errors=errors,
    )
    hosted = workflow_job_block(workflow, "hosted-evidence")
    require_workflow_snippets(
        hosted,
        job="hosted-evidence",
        snippets=(
            "static-quality",
            "react-typescript-compatibility",
            "package-manager-framework-integration",
            "browser-quality",
            "safari-quality",
            "actions/download-artifact@v4",
            "--source-mode commit",
            "generate_hosted_ci_evidence.py assemble",
            "validate_hosted_ci_evidence.py",
            "hosted-ci-release-evidence-${{ github.run_attempt }}",
        ),
        errors=errors,
    )

    for fixture_id, fixture in by_id.items():
        fixture_ci = fixture.get("ci")
        if isinstance(fixture_ci, dict):
            job = fixture_ci.get("job")
            if not isinstance(job, str) or workflow_job_block(workflow, job) is None:
                errors.append(
                    f"fixture {fixture_id!r} references missing workflow job {job!r}"
                )


def validate_cross_references(
    matrix: dict[str, Any],
    fixtures_document: dict[str, Any],
    *,
    by_id: dict[str, dict[str, Any]],
    errors: list[str],
) -> None:
    target = matrix.get("profiles", {}).get("0.3.0", {})
    fixture_ids = target.get("fixtureIds")
    if fixture_ids != list(by_id):
        errors.append("profiles.0.3.0.fixtureIds must list every fixture exactly once in catalog order")
    verified_ids = [
        fixture_id
        for fixture_id, fixture in by_id.items()
        if fixture.get("status") == "verified"
    ]
    if target.get("verifiedFixtureIds") != verified_ids:
        errors.append(
            "profiles.0.3.0.verifiedFixtureIds must match fixtures with verified status"
        )
    ci = fixtures_document.get("ci", {})
    if target.get("status") == "verified":
        if len(verified_ids) != len(by_id):
            errors.append("a verified 0.3.0 profile requires every fixture to be verified")
        if ci.get("configurationStatus") != "verified":
            errors.append("a verified 0.3.0 profile requires verified hosted CI")
    configured_ids = (
        list(ci.get("staticFixtureIds", []))
        + list(ci.get("compatibilityFixtureIds", []))
        + list(ci.get("integrationFixtureIds", []))
    )
    if target.get("ciConfiguration", {}).get("configuredFixtureIds") != configured_ids:
        errors.append(
            "profiles.0.3.0.ciConfiguration.configuredFixtureIds must match the fixture catalog"
        )

    targets = fixtures_document.get("targets", {})
    runtime = target.get("runtime", {})
    if runtime.get("node", {}).get("targets") != targets.get("node"):
        errors.append("Node targets drift between support matrix and fixture catalog")
    if runtime.get("typescript", {}).get("targets") != targets.get("typescript"):
        errors.append("TypeScript targets drift between support matrix and fixture catalog")
    if target.get("packageManagers", {}).get("targets") != targets.get("packageManagers"):
        errors.append("package-manager targets drift between support matrix and fixture catalog")
    if target.get("projects", {}).get("frameworks") != targets.get("frameworks"):
        errors.append("framework targets drift between support matrix and fixture catalog")


def build_ci_matrices(
    fixtures_document: dict[str, Any], by_id: dict[str, dict[str, Any]]
) -> dict[str, dict[str, list[dict[str, str]]]]:
    ci = fixtures_document["ci"]
    static_include: list[dict[str, str]] = []
    for fixture_id in ci["staticFixtureIds"]:
        environment = by_id[fixture_id]["environment"]
        static_include.append(
            {
                "fixture_id": fixture_id,
                "node": environment["node"],
                "npm": environment["packageManager"]["version"],
            }
        )
    compatibility_include: list[dict[str, str]] = []
    for fixture_id in ci["compatibilityFixtureIds"]:
        environment = by_id[fixture_id]["environment"]
        compatibility_include.append(
            {
                "fixture_id": fixture_id,
                "node": environment["node"],
                "npm": environment["packageManager"]["version"],
                "react": environment["react"],
                "react_dom": environment["reactDom"],
                "react_types": environment["reactTypes"],
                "react_dom_types": environment["reactDomTypes"],
                "typescript": environment["typescript"],
            }
        )
    integration_include: list[dict[str, str]] = []
    for fixture_id in ci["integrationFixtureIds"]:
        environment = by_id[fixture_id]["environment"]
        integration_include.append(
            {
                "fixture_id": fixture_id,
                "node": environment["node"],
                "package_manager": environment["packageManager"]["name"],
                "package_manager_version": environment["packageManager"]["version"],
            }
        )
    return {
        "static_matrix": {"include": static_include},
        "compatibility_matrix": {"include": compatibility_include},
        "integration_matrix": {"include": integration_include},
    }


def validate_support_contract(
    matrix: dict[str, Any], fixtures_document: dict[str, Any], workflow: str
) -> dict[str, Any]:
    errors: list[str] = []
    validate_support_matrix(matrix, errors=errors)
    fixtures, by_id = validate_fixture_catalog(fixtures_document, errors=errors)
    validate_cross_references(
        matrix, fixtures_document, by_id=by_id, errors=errors
    )
    validate_workflow(workflow, by_id=by_id, errors=errors)
    matrices: dict[str, Any] = {}
    if not errors:
        matrices = build_ci_matrices(fixtures_document, by_id)
    return {
        "valid": not errors,
        "fixtureCount": len(fixtures),
        "configuredFixtureCount": len(
            fixtures_document.get("ci", {}).get("staticFixtureIds", [])
        )
        + len(fixtures_document.get("ci", {}).get("compatibilityFixtureIds", []))
        + len(fixtures_document.get("ci", {}).get("integrationFixtureIds", [])),
        "matrices": matrices,
        "errors": errors,
    }


def write_github_output(path: Path, matrices: dict[str, Any]) -> None:
    with path.open("a", encoding="utf-8", newline="\n") as output:
        for name in ("static_matrix", "compatibility_matrix", "integration_matrix"):
            compact = json.dumps(matrices[name], separators=(",", ":"), sort_keys=True)
            output.write(f"{name}={compact}\n")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--matrix", type=Path, default=DEFAULT_MATRIX)
    parser.add_argument("--fixtures", type=Path, default=DEFAULT_FIXTURES)
    parser.add_argument("--workflow", type=Path, default=DEFAULT_WORKFLOW)
    parser.add_argument("--github-output", type=Path)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        matrix = read_json_object(args.matrix, label="support matrix")
        fixtures = read_json_object(args.fixtures, label="support fixtures")
        workflow = args.workflow.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError, json.JSONDecodeError, ValueError) as error:
        print(json.dumps({"valid": False, "errors": [str(error)]}, indent=2))
        return 1

    report = validate_support_contract(matrix, fixtures, workflow)
    github_output = args.github_output
    if github_output is None and os.environ.get("GITHUB_OUTPUT"):
        github_output = Path(os.environ["GITHUB_OUTPUT"])
    if report["valid"] and github_output is not None:
        write_github_output(github_output, report["matrices"])
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0 if report["valid"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
