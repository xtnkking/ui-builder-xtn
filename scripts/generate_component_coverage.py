#!/usr/bin/env python3
"""Generate the deterministic Personal UI public-export coverage matrix."""

from __future__ import annotations

import argparse
import json
import re
import subprocess
from pathlib import Path
from typing import Any, Iterable


SKILL_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_KIT_ROOT = SKILL_ROOT / "assets" / "react-kit"
DEFAULT_MANIFEST = DEFAULT_KIT_ROOT / "component-manifest.json"
DEFAULT_REGISTRY = DEFAULT_KIT_ROOT / "registry.json"
DEFAULT_DOCUMENTATION = DEFAULT_KIT_ROOT / "component-docs.json"
DEFAULT_OUTPUT = DEFAULT_KIT_ROOT / "component-coverage.json"
DEFAULT_API_REPORT = DEFAULT_KIT_ROOT / "etc" / "personal-ui.api.md"
DEFAULT_EXPLORER_VALIDATOR = (
    DEFAULT_KIT_ROOT / "tools" / "personal-ui" / "validate-explorer-cases.mjs"
)
DEFAULT_TEST_EVIDENCE_VALIDATOR = (
    DEFAULT_KIT_ROOT / "tools" / "personal-ui" / "validate-test-evidence.mjs"
)

CLASSIFICATIONS = (
    "fixed-control",
    "layout",
    "theme-root",
    "pattern",
    "non-visual",
)
STABILITY_LEVELS = ("stable", "experimental", "deprecated")
DOCUMENTATION_CATEGORIES = (
    "foundation",
    "actions",
    "input",
    "navigation",
    "data",
    "feedback",
    "overlay",
    "pattern",
)
INTERACTION_KINDS = ("interactive", "static", "non-visual")
KEYBOARD_OWNER_MODES = ("custom", "native", "delegated", "none")
ARIA_OWNER_MODES = ("owned", "native", "delegated", "none")
STATE_MODES = (
    "stateless",
    "controlled",
    "uncontrolled",
    "controlled-uncontrolled",
    "provider",
    "composed",
    "hook",
    "constant",
)
APPLICABLE_STATES = (
    "default",
    "disabled",
    "readOnly",
    "controlled",
    "uncontrolled",
    "loading",
    "empty",
    "error",
    "validation",
    "longContent",
    "keyboard",
    "mobile",
    "overlay",
    "dark",
    "locale",
    "usage",
)
SCRIPT_SUFFIXES = {".ts", ".tsx", ".js", ".jsx", ".mts", ".cts", ".mjs", ".cjs"}
IGNORED_PARTS = {".git", "dist", "node_modules", "__pycache__"}
RUNTIME_EXPORT = re.compile(r"^[A-Za-z_$][\w$]*$")
DOCUMENTATION_ID = re.compile(r"^[a-z0-9]+(?:[./-][a-z0-9]+)*$")
CSS_CUSTOM_PROPERTY = re.compile(r"--pui-[a-z0-9-]+")
PUBLIC_THEME_TOKEN_BLOCK = re.compile(
    r"PUBLIC_THEME_TOKEN_NAMES\s*=\s*\[(?P<body>.*?)\]\s*as const",
    re.DOTALL,
)
COVERAGE_METADATA = re.compile(
    r"^\s*//\s*@personal-ui-coverage\s+(?P<payload>\{.*\})\s*$"
)
API_RUNTIME_SECTION = re.compile(
    r"^## Runtime export inventory\s*$\n(?P<body>.*?)(?=^## Type-only export inventory\s*$)",
    re.MULTILINE | re.DOTALL,
)
RUNNER_RULES = {
    "components": {
        "kinds": {"unit"},
        "prefix": "assets/react-kit/tests/components/",
        "name": re.compile(r"\.test\.(?:ts|tsx)$"),
    },
    "browser": {
        "kinds": {"browser", "keyboard"},
        "prefix": "assets/react-kit/tests/browser/",
        "name": re.compile(r"\.(?:spec|test)\.(?:ts|tsx|js|jsx|mjs|cjs)$"),
    },
    "visual": {
        "kinds": {"browser"},
        "prefix": "assets/react-kit/tests/visual/",
        "name": re.compile(r"\.(?:spec|test)\.(?:ts|tsx|js|jsx|mjs|cjs)$"),
    },
    "a11y": {
        "kinds": {"a11y"},
        "prefix": "assets/react-kit/tests/a11y/",
        "name": re.compile(r"\.(?:spec|test)\.(?:ts|tsx|js|jsx|mjs|cjs)$"),
    },
    "explorer": {
        "kinds": {"example"},
        "prefix": "assets/react-kit/src/explorer/cases/",
        "name": re.compile(r"\.(?:ts|tsx)$"),
    },
}


def component_api_anchor(export_name: str) -> str:
    slug = re.sub(r"([a-z0-9])([A-Z])", r"\1-\2", export_name)
    slug = re.sub(r"([A-Z])([A-Z][a-z])", r"\1-\2", slug)
    return "export-" + slug.replace("_", "-").lower()


EXPECTED_RUNNER_COMMANDS = {
    "test:components": "vitest run --config vitest.config.ts",
    "test:browser": (
        "playwright test --config playwright.config.ts tests/browser --workers=1"
    ),
    "test:a11y": "playwright test --config playwright.config.ts tests/a11y --workers=1",
    "test:visual": (
        "playwright test --config playwright.config.ts tests/visual --project=chromium"
    ),
}


def read_json_object(path: Path, *, label: str) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"{label} must contain a JSON object: {path}")
    return value


def _grouped_export_map(
    registry: dict[str, Any],
    *,
    field: str,
    allowed_groups: tuple[str, ...],
    exports: set[str],
) -> tuple[dict[str, str], list[str]]:
    errors: list[str] = []
    raw_groups = registry.get(field)
    if not isinstance(raw_groups, dict):
        return {}, [f"Personal UI registry {field} must be an object"]

    keys = set(raw_groups)
    missing_groups = sorted(set(allowed_groups) - keys)
    extra_groups = sorted(keys - set(allowed_groups))
    if missing_groups:
        errors.append(
            f"Personal UI registry {field} is missing group(s): "
            + ", ".join(missing_groups)
        )
    if extra_groups:
        errors.append(
            f"Personal UI registry {field} has unsupported group(s): "
            + ", ".join(extra_groups)
        )

    export_map: dict[str, str] = {}
    for group in allowed_groups:
        raw_items = raw_groups.get(group, [])
        if not isinstance(raw_items, list):
            errors.append(f"Personal UI registry {field}.{group} must be an array")
            continue
        valid_items = [item for item in raw_items if isinstance(item, str) and item]
        if len(valid_items) != len(raw_items):
            errors.append(
                f"Personal UI registry {field}.{group} must contain only non-empty strings"
            )
        duplicates = sorted(
            item for item in set(valid_items) if valid_items.count(item) > 1
        )
        if duplicates:
            errors.append(
                f"Personal UI registry {field}.{group} contains duplicate export(s): "
                + ", ".join(duplicates)
            )
        for export_name in valid_items:
            previous = export_map.get(export_name)
            if previous is not None and previous != group:
                errors.append(
                    f"Personal UI registry {field} assigns {export_name!r} to both "
                    f"{previous!r} and {group!r}"
                )
            export_map[export_name] = group

    missing_exports = sorted(exports - set(export_map))
    extra_exports = sorted(set(export_map) - exports)
    if missing_exports:
        errors.append(
            f"Personal UI registry {field} leaves export(s) unclassified: "
            + ", ".join(missing_exports)
        )
    if extra_exports:
        errors.append(
            f"Personal UI registry {field} references unknown export(s): "
            + ", ".join(extra_exports)
        )
    return export_map, errors


def validate_export_metadata(
    registry: dict[str, Any],
) -> tuple[list[str], dict[str, str], dict[str, str], list[str]]:
    """Validate and normalize registry export classification and stability metadata."""

    errors: list[str] = []
    raw_exports = registry.get("exports")
    if not isinstance(raw_exports, list):
        return [], {}, {}, ["Personal UI registry exports must be an array"]
    exports = [item for item in raw_exports if isinstance(item, str) and item]
    if len(exports) != len(raw_exports):
        errors.append("Personal UI registry exports must contain only non-empty strings")
    invalid = sorted(item for item in exports if not RUNTIME_EXPORT.fullmatch(item))
    if invalid:
        errors.append(
            "Personal UI registry has invalid runtime export name(s): "
            + ", ".join(invalid)
        )
    duplicates = sorted(item for item in set(exports) if exports.count(item) > 1)
    if duplicates:
        errors.append(
            "Personal UI registry exports must not contain duplicates: "
            + ", ".join(duplicates)
        )
    if not exports:
        errors.append("Personal UI registry must contain runtime exports")

    export_set = set(exports)
    classifications, classification_errors = _grouped_export_map(
        registry,
        field="exportClassifications",
        allowed_groups=CLASSIFICATIONS,
        exports=export_set,
    )
    stability, stability_errors = _grouped_export_map(
        registry,
        field="exportStability",
        allowed_groups=STABILITY_LEVELS,
        exports=export_set,
    )
    errors.extend(classification_errors)
    errors.extend(stability_errors)
    return exports, classifications, stability, errors


def _iter_script_files(root: Path) -> Iterable[Path]:
    if not root.is_dir():
        return
    for path in root.rglob("*"):
        if (
            path.is_file()
            and path.suffix.lower() in SCRIPT_SUFFIXES
            and not any(part in IGNORED_PARTS for part in path.parts)
        ):
            yield path


def _is_test_file(path: Path) -> bool:
    name = path.name.lower()
    normalized = path.as_posix().lower()
    return (
        name.startswith("test_")
        or "-test." in name
        or "_test." in name
        or ".test." in name
        or ".spec." in name
        or "/tests/" in normalized
    )


def _has_export_usage(text: str, export_name: str) -> bool:
    escaped = re.escape(export_name)
    patterns = (
        rf"<\s*{escaped}(?=[\s/>])",
        rf"\b{escaped}\s*\(",
        rf"\b{escaped}\s*(?:\.|\[)",
    )
    return any(re.search(pattern, text) for pattern in patterns)


def _relative_path(path: Path, skill_root: Path) -> str:
    try:
        return path.relative_to(skill_root).as_posix()
    except ValueError:
        return path.as_posix()


def _evidence_for_export(
    export_name: str,
    candidates: Iterable[Path],
    *,
    skill_root: Path,
    require_usage: bool = False,
) -> list[str]:
    evidence: list[str] = []
    for path in candidates:
        text = path.read_text(encoding="utf-8", errors="replace")
        matches = (
            _has_export_usage(text, export_name)
            if require_usage
            else _has_export_reference(text, export_name)
        )
        if matches:
            evidence.append(_relative_path(path, skill_root))
    return sorted(set(evidence))


def runtime_exports_from_api_report(path: Path) -> tuple[list[str], list[str]]:
    """Read the generated API inventory without treating arbitrary prose as evidence."""

    try:
        text = path.read_text(encoding="utf-8")
    except OSError as error:
        return [], [f"unable to read API report {path}: {error}"]
    match = API_RUNTIME_SECTION.search(text.replace("\r\n", "\n"))
    if match is None:
        return [], [f"API report has no runtime export inventory: {path}"]
    names = re.findall(r"`([A-Za-z_$][\w$]*)`", match.group("body"))
    duplicates = sorted(name for name in set(names) if names.count(name) > 1)
    errors: list[str] = []
    if not names:
        errors.append(f"API report runtime export inventory is empty: {path}")
    if duplicates:
        errors.append(
            "API report runtime export inventory contains duplicate export(s): "
            + ", ".join(duplicates)
        )
    return names, errors


def validate_runner_configuration(kit_root: Path) -> list[str]:
    """Keep static evidence path rules tied to the package's actual runner commands."""

    errors: list[str] = []
    try:
        package = read_json_object(kit_root / "package.json", label="React kit package")
    except (OSError, ValueError, json.JSONDecodeError) as error:
        return [str(error)]
    scripts = package.get("scripts")
    if not isinstance(scripts, dict):
        return ["React kit package scripts must be an object"]
    for script_name, expected in EXPECTED_RUNNER_COMMANDS.items():
        actual = scripts.get(script_name)
        if actual != expected:
            errors.append(
                f"runner command {script_name!r} must be {expected!r}; received {actual!r}"
            )

    vitest_path = kit_root / "vitest.config.ts"
    playwright_path = kit_root / "playwright.config.ts"
    try:
        vitest_text = vitest_path.read_text(encoding="utf-8")
    except OSError as error:
        errors.append(f"unable to read Vitest configuration {vitest_path}: {error}")
    else:
        if 'include: ["tests/components/**/*.test.{ts,tsx}"]' not in vitest_text:
            errors.append(
                "Vitest configuration must collect tests/components/**/*.test.{ts,tsx}"
            )
    try:
        playwright_text = playwright_path.read_text(encoding="utf-8")
    except OSError as error:
        errors.append(f"unable to read Playwright configuration {playwright_path}: {error}")
    else:
        if 'testDir: "./tests"' not in playwright_text:
            errors.append("Playwright configuration must use ./tests as its testDir")
        if re.search(r"\btestMatch\s*:", playwright_text):
            errors.append(
                "Playwright testMatch overrides require updating coverage runner validation"
            )
    return errors


def collect_validated_explorer_evidence(
    *,
    skill_root: Path,
    kit_root: Path,
    exports: set[str],
    validator_path: Path | None = None,
    state_coverage: dict[str, Any] | None = None,
) -> tuple[dict[str, list[str]], list[str]]:
    """Return example evidence only after the TypeScript AST validator succeeds."""

    validator = validator_path or (
        kit_root / "tools" / "personal-ui" / "validate-explorer-cases.mjs"
    )
    if not validator.is_file():
        return (
            {export_name: [] for export_name in exports},
            [f"Explorer AST validator is missing: {validator}"],
        )
    try:
        completed = subprocess.run(
            [
                "node",
                str(validator),
                "--kit-root",
                str(kit_root),
                "--json",
            ],
            cwd=kit_root,
            capture_output=True,
            check=False,
            encoding="utf-8",
            errors="replace",
        )
    except OSError as error:
        return (
            {export_name: [] for export_name in exports},
            [f"unable to run Explorer AST validator: {error}"],
        )
    try:
        payload = json.loads(completed.stdout)
    except json.JSONDecodeError as error:
        detail = completed.stderr.strip() or completed.stdout.strip()
        return (
            {export_name: [] for export_name in exports},
            [
                "Explorer AST validator returned invalid JSON: "
                f"{error.msg}{f': {detail}' if detail else ''}"
            ],
        )
    if not isinstance(payload, dict):
        return (
            {export_name: [] for export_name in exports},
            ["Explorer AST validator payload must be an object"],
        )
    raw_errors = payload.get("errors", [])
    validator_errors = (
        [item for item in raw_errors if isinstance(item, str) and item]
        if isinstance(raw_errors, list)
        else ["Explorer AST validator errors must be an array"]
    )
    if completed.returncode != 0 or payload.get("ok") is not True:
        if not validator_errors:
            detail = completed.stderr.strip()
            validator_errors = [
                "Explorer AST validator failed"
                + (f": {detail}" if detail else " without a diagnostic")
            ]
        return {export_name: [] for export_name in exports}, validator_errors

    raw_evidence = payload.get("evidence")
    if not isinstance(raw_evidence, dict):
        return (
            {export_name: [] for export_name in exports},
            ["Explorer AST validator evidence must be an object"],
        )
    unknown = sorted(set(raw_evidence) - exports)
    missing = sorted(exports - set(raw_evidence))
    errors: list[str] = []
    if unknown:
        errors.append(
            "Explorer AST validator returned unknown export(s): " + ", ".join(unknown)
        )
    if missing:
        errors.append(
            "Explorer AST validator omitted export(s): " + ", ".join(missing)
        )
    evidence: dict[str, list[str]] = {}
    for export_name in exports:
        refs = raw_evidence.get(export_name, [])
        if not isinstance(refs, list) or any(
            not isinstance(reference, str) or not reference for reference in refs
        ):
            errors.append(
                f"Explorer AST validator evidence for {export_name} must be a string array"
            )
            evidence[export_name] = []
            continue
        normalized = sorted(set(refs))
        for reference in normalized:
            resolved = (skill_root / reference).resolve()
            try:
                resolved.relative_to(skill_root.resolve())
            except ValueError:
                errors.append(
                    f"Explorer AST validator evidence escapes the Skill root: {reference!r}"
                )
                continue
            if not resolved.is_file():
                errors.append(
                    f"Explorer AST validator evidence does not exist: {reference!r}"
                )
        evidence[export_name] = normalized
    if state_coverage is not None:
        state_coverage.clear()
        coverage = payload.get("stateCoverage")
        if (
            not isinstance(coverage, dict)
            or coverage.get("complete") is not True
            or coverage.get("verificationKind") != "structural-source-fixtures"
            or coverage.get("behavioralVerification") is not False
            or not isinstance(coverage.get("evidence"), dict)
            or set(coverage["evidence"]) != exports
            or coverage.get("errors") != []
            or coverage.get("gaps") != []
        ):
            errors.append("Explorer AST validator must supply complete source-state evidence, not browser certification")
        else:
            for export_name, fixtures in coverage["evidence"].items():
                states: set[str] = set()
                if not isinstance(fixtures, list) or not fixtures:
                    errors.append(f"Explorer state fixtures for {export_name} must be a non-empty array")
                    continue
                for fixture in fixtures:
                    if (
                        not isinstance(fixture, dict)
                        or fixture.get("state") not in APPLICABLE_STATES
                        or fixture.get("state") in states
                        or fixture.get("file") not in evidence[export_name]
                        or type(fixture.get("exampleIndex")) is not int
                        or fixture["exampleIndex"] < 0
                        or fixture.get("verification") != (
                            "manual-interaction-fixture"
                            if fixture.get("state") == "keyboard"
                            else "runnable-source-fixture"
                        )
                    ):
                        errors.append(f"Explorer state fixture for {export_name} has invalid ownership or identity")
                        continue
                    states.add(fixture["state"])
            if not errors:
                state_coverage.update(coverage)
    return evidence, errors


def collect_validated_test_evidence(
    *,
    skill_root: Path,
    kit_root: Path,
    exports: set[str],
    validator_path: Path | None = None,
) -> tuple[dict[str, dict[str, list[str]]], list[str]]:
    """Return per-export keyboard and ARIA refs only after AST validation."""

    empty = {
        kind: {export_name: [] for export_name in exports}
        for kind in ("keyboard", "a11y")
    }
    validator = validator_path or (
        kit_root / "tools" / "personal-ui" / "validate-test-evidence.mjs"
    )
    if not validator.is_file():
        return empty, [f"test evidence validator is missing: {validator}"]
    try:
        completed = subprocess.run(
            [
                "node",
                str(validator),
                "--kit-root",
                str(kit_root),
                "--json",
            ],
            cwd=kit_root,
            capture_output=True,
            check=False,
            encoding="utf-8",
            errors="replace",
        )
    except OSError as error:
        return empty, [f"unable to run test evidence validator: {error}"]
    try:
        payload = json.loads(completed.stdout)
    except json.JSONDecodeError as error:
        detail = completed.stderr.strip() or completed.stdout.strip()
        return empty, [
            "test evidence validator returned invalid JSON: "
            f"{error.msg}{f': {detail}' if detail else ''}"
        ]
    if not isinstance(payload, dict):
        return empty, ["test evidence validator payload must be an object"]
    raw_errors = payload.get("errors", [])
    validator_errors = (
        [item for item in raw_errors if isinstance(item, str) and item]
        if isinstance(raw_errors, list)
        else ["test evidence validator errors must be an array"]
    )
    if completed.returncode != 0 or payload.get("ok") is not True:
        if not validator_errors:
            detail = completed.stderr.strip()
            validator_errors = [
                "test evidence validator failed"
                + (f": {detail}" if detail else " without a diagnostic")
            ]
        return empty, validator_errors

    raw_evidence = payload.get("evidence")
    if not isinstance(raw_evidence, dict):
        return empty, ["test evidence validator evidence must be an object"]
    errors: list[str] = []
    normalized = empty
    unexpected_kinds = sorted(set(raw_evidence) - {"keyboard", "a11y"})
    if unexpected_kinds:
        errors.append(
            "test evidence validator returned unsupported evidence kind(s): "
            + ", ".join(unexpected_kinds)
        )
    for kind in ("keyboard", "a11y"):
        raw_by_export = raw_evidence.get(kind)
        if not isinstance(raw_by_export, dict):
            errors.append(f"test evidence validator {kind} evidence must be an object")
            continue
        unknown = sorted(set(raw_by_export) - exports)
        missing = sorted(exports - set(raw_by_export))
        if unknown:
            errors.append(
                f"test evidence validator returned unknown {kind} export(s): "
                + ", ".join(unknown)
            )
        if missing:
            errors.append(
                f"test evidence validator omitted {kind} export(s): "
                + ", ".join(missing)
            )
        for export_name in exports:
            refs = raw_by_export.get(export_name, [])
            if not isinstance(refs, list) or any(
                not isinstance(reference, str) or not reference for reference in refs
            ):
                errors.append(
                    f"test evidence validator {kind} evidence for {export_name} "
                    "must be a string array"
                )
                continue
            unique_refs = sorted(set(refs))
            if len(unique_refs) != len(refs):
                errors.append(
                    f"test evidence validator {kind} evidence for {export_name} "
                    "contains duplicate refs"
                )
            for reference in unique_refs:
                resolved = (skill_root / reference).resolve()
                try:
                    resolved.relative_to(skill_root.resolve())
                except ValueError:
                    errors.append(
                        "test evidence validator evidence escapes the Skill root: "
                        f"{reference!r}"
                    )
                    continue
                if not resolved.is_file():
                    errors.append(
                        "test evidence validator evidence does not exist: "
                        f"{reference!r}"
                    )
            normalized[kind][export_name] = unique_refs
    return normalized, errors


def _runner_collects(path: Path, *, runner: str, skill_root: Path) -> bool:
    rule = RUNNER_RULES[runner]
    relative = _relative_path(path.resolve(), skill_root.resolve())
    return relative.startswith(rule["prefix"]) and bool(rule["name"].search(path.name))


def collect_explicit_test_evidence(
    *,
    skill_root: Path,
    exports: set[str],
) -> tuple[dict[str, dict[str, list[str]]], list[Path], list[str]]:
    """Collect only structured metadata from files owned by a declared runner.

    Directives assign evidence ownership; they are not proof that an explorer case
    imports or renders an export. M6-03 must establish that with the TypeScript AST.
    """

    evidence = {
        kind: {export_name: [] for export_name in exports}
        for kind in ("unit", "browser", "a11y", "keyboard", "example")
    }
    metadata_files: list[Path] = []
    errors: list[str] = []
    evidence_roots = (
        skill_root / "assets" / "react-kit" / "tests",
        skill_root / "assets" / "react-kit" / "src" / "explorer" / "cases",
    )

    for path in sorted(
        {candidate for root in evidence_roots for candidate in _iter_script_files(root)}
    ):
        directives: list[tuple[int, str]] = []
        for line_number, line in enumerate(
            path.read_text(encoding="utf-8", errors="replace").splitlines(), start=1
        ):
            if "@personal-ui-coverage" not in line:
                continue
            match = COVERAGE_METADATA.fullmatch(line)
            if match is None:
                errors.append(
                    f"invalid coverage metadata syntax at "
                    f"{_relative_path(path, skill_root)}:{line_number}"
                )
                continue
            directives.append((line_number, match.group("payload")))

        if not directives:
            continue
        metadata_files.append(path)
        seen_in_file: set[tuple[str, str]] = set()
        for line_number, payload_text in directives:
            location = f"{_relative_path(path, skill_root)}:{line_number}"
            try:
                payload = json.loads(payload_text)
            except json.JSONDecodeError as error:
                errors.append(f"invalid coverage metadata JSON at {location}: {error.msg}")
                continue
            if not isinstance(payload, dict):
                errors.append(f"coverage metadata must be an object at {location}")
                continue
            allowed_keys = {"kind", "runner", "exports"}
            if payload.get("kind") == "example":
                allowed_keys.add("caseId")
            unexpected = sorted(set(payload) - allowed_keys)
            missing = sorted({"kind", "runner", "exports"} - set(payload))
            if unexpected:
                errors.append(
                    f"coverage metadata has unsupported key(s) at {location}: "
                    + ", ".join(unexpected)
                )
            if missing:
                errors.append(
                    f"coverage metadata is missing key(s) at {location}: "
                    + ", ".join(missing)
                )
            if unexpected or missing:
                continue

            kind = payload["kind"]
            runner = payload["runner"]
            covered_exports = payload["exports"]
            if kind not in evidence:
                errors.append(f"unsupported coverage kind at {location}: {kind!r}")
                continue
            if runner not in RUNNER_RULES:
                errors.append(f"unsupported coverage runner at {location}: {runner!r}")
                continue
            if kind not in RUNNER_RULES[runner]["kinds"]:
                errors.append(
                    f"coverage kind {kind!r} does not match runner {runner!r} at {location}"
                )
                continue
            case_id = payload.get("caseId")
            if kind == "example":
                if not isinstance(case_id, str) or not DOCUMENTATION_ID.fullmatch(case_id):
                    errors.append(
                        f"example coverage metadata requires a valid caseId at {location}"
                    )
                    continue
            elif "caseId" in payload:
                errors.append(
                    f"coverage caseId is only supported for example evidence at {location}"
                )
                continue
            if not _runner_collects(path, runner=runner, skill_root=skill_root):
                errors.append(
                    f"coverage metadata at {location} is not collected by runner {runner!r}"
                )
                continue
            if (
                not isinstance(covered_exports, list)
                or not covered_exports
                or any(not isinstance(name, str) or not name for name in covered_exports)
            ):
                errors.append(
                    f"coverage metadata exports must be a non-empty string array at {location}"
                )
                continue
            duplicates = sorted(
                name for name in set(covered_exports) if covered_exports.count(name) > 1
            )
            if duplicates:
                errors.append(
                    f"coverage metadata contains duplicate export(s) at {location}: "
                    + ", ".join(duplicates)
                )
            unknown = sorted(set(covered_exports) - exports)
            if unknown:
                errors.append(
                    f"coverage metadata references unknown export(s) at {location}: "
                    + ", ".join(unknown)
                )
            if duplicates or unknown:
                continue

            relative = _relative_path(path, skill_root)
            for export_name in covered_exports:
                key = (kind, export_name)
                if key in seen_in_file:
                    errors.append(
                        f"coverage metadata repeats {kind} ownership for "
                        f"{export_name!r} in {relative}"
                    )
                    continue
                seen_in_file.add(key)
                evidence[kind][export_name].append(relative)

    for by_export in evidence.values():
        for paths in by_export.values():
            paths.sort()
    return evidence, sorted(set(metadata_files)), errors


def _string_list(
    value: Any,
    *,
    label: str,
    errors: list[str],
    allow_empty: bool = False,
) -> list[str]:
    if not isinstance(value, list) or any(
        not isinstance(item, str) or not item for item in value
    ):
        errors.append(f"{label} must be an array of non-empty strings")
        return []
    if not value and not allow_empty:
        errors.append(f"{label} must not be empty")
    duplicates = sorted(item for item in set(value) if value.count(item) > 1)
    if duplicates:
        errors.append(f"{label} contains duplicate value(s): " + ", ".join(duplicates))
    return value


def _document_reference(
    value: Any,
    *,
    label: str,
    skill_root: Path,
    errors: list[str],
) -> str | None:
    if not isinstance(value, str) or not value:
        errors.append(f"{label} must be a non-empty repository-relative path")
        return None
    candidate = Path(value)
    if candidate.is_absolute() or ".." in candidate.parts:
        errors.append(f"{label} must stay within the Skill root: {value!r}")
        return None
    resolved = (skill_root / candidate).resolve()
    try:
        resolved.relative_to(skill_root.resolve())
    except ValueError:
        errors.append(f"{label} escapes the Skill root: {value!r}")
        return None
    if not resolved.is_file():
        errors.append(f"{label} does not exist: {value!r}")
        return None
    return candidate.as_posix()


def _validate_status_record(
    value: Any,
    *,
    label: str,
    kind: str,
    interaction: str,
    skill_root: Path,
    errors: list[str],
) -> dict[str, Any]:
    if not isinstance(value, dict):
        errors.append(f"{label} must be an object")
        return {"status": "missing"}
    status = value.get("status")
    if status not in {"missing", "derived", "documented", "not-applicable", "none"}:
        errors.append(f"{label} has unsupported status {status!r}")
        return {"status": "missing"}
    if status == "missing":
        if set(value) != {"status"}:
            errors.append(f"{label} missing status cannot carry evidence")
        return {"status": "missing"}
    if status == "derived":
        expected_source = {
            "example": "explorer-ast",
            "apiPage": "generated-component-api",
        }.get(kind)
        if expected_source is None:
            errors.append(f"{label} {kind} metadata cannot use derived")
        source = value.get("source")
        if source != expected_source:
            errors.append(
                f"{label} derived status requires source {expected_source!r}"
            )
        unexpected = sorted(set(value) - {"status", "source"})
        if unexpected:
            errors.append(f"{label} has unsupported key(s): " + ", ".join(unexpected))
        return {"status": "derived", "source": expected_source}
    if status == "not-applicable":
        reason = value.get("reason")
        if kind in {"example", "apiPage", "migration"}:
            errors.append(f"{label} cannot be not-applicable")
        if not isinstance(reason, str) or not reason.strip():
            errors.append(f"{label} not-applicable status requires a reason")
            reason = ""
        unexpected = sorted(set(value) - {"status", "reason"})
        if unexpected:
            errors.append(f"{label} has unsupported key(s): " + ", ".join(unexpected))
        return {"status": "not-applicable", "reason": reason}
    if status == "none":
        reason = value.get("reason")
        if kind != "migration":
            errors.append(f"{label} only migration metadata may use none")
        if not isinstance(reason, str) or not reason.strip():
            errors.append(f"{label} none status requires a reason")
            reason = ""
        unexpected = sorted(set(value) - {"status", "reason"})
        if unexpected:
            errors.append(f"{label} has unsupported key(s): " + ", ".join(unexpected))
        return {"status": "none", "reason": reason}

    identifier = value.get("id")
    if kind in {"example", "apiPage"} and (
        not isinstance(identifier, str) or not DOCUMENTATION_ID.fullmatch(identifier)
    ):
        errors.append(f"{label} documented status requires a valid id")
        identifier = ""
    refs = _string_list(value.get("refs"), label=f"{label} refs", errors=errors)
    normalized_refs = [
        reference
        for index, item in enumerate(refs)
        if (
            reference := _document_reference(
                item,
                label=f"{label} refs[{index}]",
                skill_root=skill_root,
                errors=errors,
            )
        )
        is not None
    ]
    allowed = {"status", "refs"}
    result: dict[str, Any] = {"status": "documented", "refs": normalized_refs}
    if kind in {"example", "apiPage"}:
        allowed.add("id")
        result["id"] = identifier
    if kind == "migration":
        allowed.add("summary")
        summary = value.get("summary")
        if not isinstance(summary, str) or not summary.strip():
            errors.append(f"{label} documented migration requires a summary")
            summary = ""
        result["summary"] = summary
    unexpected = sorted(set(value) - allowed)
    if unexpected:
        errors.append(f"{label} has unsupported key(s): " + ", ".join(unexpected))
    return result


def _validate_owner_contract(
    value: Any,
    *,
    label: str,
    kind: str,
    skill_root: Path,
    errors: list[str],
) -> dict[str, Any]:
    if not isinstance(value, dict):
        errors.append(f"{label} must be an object")
        return {"mode": "none", "reason": "Invalid owner contract."}
    allowed_modes = KEYBOARD_OWNER_MODES if kind == "keyboard" else ARIA_OWNER_MODES
    mode = value.get("mode")
    if mode not in allowed_modes:
        errors.append(f"{label} has unsupported owner mode {mode!r}")
        return {"mode": "none", "reason": "Invalid owner mode."}
    if mode == "none":
        reason = value.get("reason")
        if not isinstance(reason, str) or not reason.strip():
            errors.append(f"{label} owner mode none requires a reason")
            reason = ""
        unexpected = sorted(set(value) - {"mode", "reason"})
        if unexpected:
            errors.append(f"{label} has unsupported key(s): " + ", ".join(unexpected))
        return {"mode": "none", "reason": reason}

    status = value.get("status")
    if status not in {"missing", "derived", "documented"}:
        errors.append(
            f"{label} owner mode {mode!r} requires missing, derived, or documented status"
        )
        return {"mode": mode, "status": "missing"}
    if status == "missing":
        unexpected = sorted(set(value) - {"mode", "status"})
        if unexpected:
            errors.append(f"{label} missing status cannot carry evidence")
        return {"mode": mode, "status": "missing"}
    if status == "derived":
        source = value.get("source")
        if source != "test-evidence":
            errors.append(
                f"{label} derived status requires source 'test-evidence'"
            )
        unexpected = sorted(set(value) - {"mode", "status", "source"})
        if unexpected:
            errors.append(f"{label} has unsupported key(s): " + ", ".join(unexpected))
        return {"mode": mode, "status": "derived", "source": "test-evidence"}

    refs = _string_list(value.get("refs"), label=f"{label} refs", errors=errors)
    normalized_refs = [
        reference
        for index, item in enumerate(refs)
        if (
            reference := _document_reference(
                item,
                label=f"{label} refs[{index}]",
                skill_root=skill_root,
                errors=errors,
            )
        )
        is not None
    ]
    unexpected = sorted(set(value) - {"mode", "status", "refs"})
    if unexpected:
        errors.append(f"{label} has unsupported key(s): " + ", ".join(unexpected))
    return {"mode": mode, "status": "documented", "refs": normalized_refs}


def _example_case_is_declared(
    path: Path,
    *,
    export_name: str,
    case_id: str,
) -> bool:
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        match = COVERAGE_METADATA.fullmatch(line)
        if match is None:
            continue
        try:
            payload = json.loads(match.group("payload"))
        except json.JSONDecodeError:
            continue
        if (
            isinstance(payload, dict)
            and payload.get("kind") == "example"
            and payload.get("caseId") == case_id
            and export_name in payload.get("exports", [])
        ):
            return True
    return False


def validate_documentation_metadata(
    documentation: dict[str, Any],
    *,
    exports: list[str],
    classifications: dict[str, str],
    stability: dict[str, str],
    export_entries: dict[str, dict[str, Any]],
    evidence: dict[str, dict[str, list[str]]],
    skill_root: Path,
    kit_root: Path,
) -> tuple[dict[str, dict[str, Any]], list[str], list[str]]:
    """Expand documentation annotations and report schema versus completeness errors."""

    errors: list[str] = []
    incomplete: list[str] = []
    theme_contract = (
        kit_root / "src" / "personal-ui" / "internal" / "theme-contract.ts"
    ).read_text(encoding="utf-8")
    public_token_match = PUBLIC_THEME_TOKEN_BLOCK.search(theme_contract)
    if public_token_match is None:
        raise ValueError("theme contract does not declare PUBLIC_THEME_TOKEN_NAMES")
    public_theme_tokens = set(
        CSS_CUSTOM_PROPERTY.findall(public_token_match.group("body"))
    )
    if documentation.get("schemaVersion") != 1:
        errors.append("component documentation schemaVersion must be 1")
    unexpected_top = sorted(
        set(documentation) - {"schemaVersion", "profiles", "families", "exports"}
    )
    if unexpected_top:
        errors.append(
            "component documentation has unsupported top-level key(s): "
            + ", ".join(unexpected_top)
        )

    raw_profiles = documentation.get("profiles")
    if not isinstance(raw_profiles, dict) or not raw_profiles:
        errors.append("component documentation profiles must be a non-empty object")
        raw_profiles = {}
    profiles: dict[str, dict[str, Any]] = {}
    required_profile_keys = {
        "interaction",
        "stateMode",
        "applicableStates",
        "example",
        "apiPage",
        "keyboard",
        "aria",
        "migration",
    }
    for profile_name, raw_profile in raw_profiles.items():
        label = f"component documentation profile {profile_name!r}"
        if not isinstance(profile_name, str) or not DOCUMENTATION_ID.fullmatch(profile_name):
            errors.append(f"{label} name must be a lowercase documentation id")
        if not isinstance(raw_profile, dict):
            errors.append(f"{label} must be an object")
            continue
        missing = sorted(required_profile_keys - set(raw_profile))
        unexpected = sorted(set(raw_profile) - required_profile_keys)
        if missing:
            errors.append(f"{label} is missing key(s): " + ", ".join(missing))
        if unexpected:
            errors.append(f"{label} has unsupported key(s): " + ", ".join(unexpected))
        interaction = raw_profile.get("interaction")
        state_mode = raw_profile.get("stateMode")
        if interaction not in INTERACTION_KINDS:
            errors.append(f"{label} has unsupported interaction {interaction!r}")
            interaction = "static"
        if state_mode not in STATE_MODES:
            errors.append(f"{label} has unsupported stateMode {state_mode!r}")
            state_mode = "stateless"
        applicable_states = _string_list(
            raw_profile.get("applicableStates"),
            label=f"{label} applicableStates",
            errors=errors,
        )
        unknown_states = sorted(set(applicable_states) - set(APPLICABLE_STATES))
        if unknown_states:
            errors.append(
                f"{label} has unsupported applicable state(s): "
                + ", ".join(unknown_states)
            )
        profile = {
            "interaction": interaction,
            "stateMode": state_mode,
            "applicableStates": applicable_states,
        }
        for field in ("example", "apiPage", "migration"):
            profile[field] = _validate_status_record(
                raw_profile.get(field),
                label=f"{label} {field}",
                kind=field,
                interaction=interaction,
                skill_root=skill_root,
                errors=errors,
            )
        for field in ("keyboard", "aria"):
            profile[field] = _validate_owner_contract(
                raw_profile.get(field),
                label=f"{label} {field}",
                kind=field,
                skill_root=skill_root,
                errors=errors,
            )
        profiles[profile_name] = profile

    family_ids = {
        entry.get("id")
        for entry in export_entries.values()
        if isinstance(entry.get("id"), str)
    }
    raw_families = documentation.get("families")
    if not isinstance(raw_families, dict):
        errors.append("component documentation families must be an object")
        raw_families = {}
    missing_families = sorted(family_ids - set(raw_families))
    unknown_families = sorted(set(raw_families) - family_ids)
    if missing_families:
        errors.append(
            "component documentation is missing family metadata: "
            + ", ".join(missing_families)
        )
    if unknown_families:
        errors.append(
            "component documentation references unknown family metadata: "
            + ", ".join(unknown_families)
        )
    family_categories: dict[str, str] = {}
    for family_id, raw_family in raw_families.items():
        label = f"component documentation family {family_id!r}"
        if not isinstance(raw_family, dict) or set(raw_family) != {"category"}:
            errors.append(f"{label} must contain only category")
            continue
        category = raw_family.get("category")
        if category not in DOCUMENTATION_CATEGORIES:
            errors.append(f"{label} has unsupported category {category!r}")
            continue
        family_categories[family_id] = category

    raw_export_docs = documentation.get("exports")
    if not isinstance(raw_export_docs, dict):
        errors.append("component documentation exports must be an object")
        raw_export_docs = {}
    export_set = set(exports)
    missing_exports = sorted(export_set - set(raw_export_docs))
    unknown_exports = sorted(set(raw_export_docs) - export_set)
    if missing_exports:
        errors.append(
            "component documentation is missing export metadata: "
            + ", ".join(missing_exports)
        )
    if unknown_exports:
        errors.append(
            "component documentation references unknown export metadata: "
            + ", ".join(unknown_exports)
        )

    expanded: dict[str, dict[str, Any]] = {}
    for export_name in exports:
        raw_record = raw_export_docs.get(export_name)
        label = f"component documentation export {export_name!r}"
        if not isinstance(raw_record, dict):
            if export_name in raw_export_docs:
                errors.append(f"{label} must be an object")
            continue
        unexpected = sorted(set(raw_record) - {"profile", "overrides"})
        if unexpected:
            errors.append(f"{label} has unsupported key(s): " + ", ".join(unexpected))
        profile_name = raw_record.get("profile")
        if profile_name not in profiles:
            errors.append(f"{label} references unknown profile {profile_name!r}")
            continue
        record = dict(profiles[profile_name])
        overrides = raw_record.get("overrides", {})
        if not isinstance(overrides, dict):
            errors.append(f"{label} overrides must be an object")
            overrides = {}
        unsupported_overrides = sorted(
            set(overrides) - {"applicableStates", "stateMode", "example", "apiPage", "keyboard", "aria", "migration"}
        )
        if unsupported_overrides:
            errors.append(
                f"{label} has unsupported override(s): "
                + ", ".join(unsupported_overrides)
            )
        interaction = record["interaction"]
        if "stateMode" in overrides:
            if overrides["stateMode"] not in STATE_MODES:
                errors.append(
                    f"{label} has unsupported stateMode override {overrides['stateMode']!r}"
                )
            else:
                record["stateMode"] = overrides["stateMode"]
        if "applicableStates" in overrides:
            states = _string_list(
                overrides["applicableStates"],
                label=f"{label} applicableStates override",
                errors=errors,
            )
            unknown_states = sorted(set(states) - set(APPLICABLE_STATES))
            if unknown_states:
                errors.append(
                    f"{label} has unsupported applicable state(s): "
                    + ", ".join(unknown_states)
                )
            record["applicableStates"] = states
        for field in ("example", "apiPage", "migration"):
            if field in overrides:
                record[field] = _validate_status_record(
                    overrides[field],
                    label=f"{label} {field}",
                    kind=field,
                    interaction=interaction,
                    skill_root=skill_root,
                    errors=errors,
                )
        for field in ("keyboard", "aria"):
            if field in overrides:
                record[field] = _validate_owner_contract(
                    overrides[field],
                    label=f"{label} {field}",
                    kind=field,
                    skill_root=skill_root,
                    errors=errors,
                )

        classification = classifications[export_name]
        if (classification == "non-visual") != (interaction == "non-visual"):
            errors.append(
                f"{label} interaction must agree with registry non-visual classification"
            )
        if classification == "pattern" or record["stateMode"] == "composed":
            for field in ("keyboard", "aria"):
                if record[field]["mode"] == "none":
                    errors.append(
                        f"{label} {field} must use delegated ownership for a composed export"
                    )
        entry = export_entries[export_name]
        family = entry.get("id")
        if record["example"]["status"] == "derived":
            explorer_refs = evidence["example"][export_name]
            if len(explorer_refs) == 1 and isinstance(family, str):
                record["example"] = {
                    "status": "documented",
                    "id": f"{family}/overview",
                    "refs": explorer_refs,
                }
            else:
                record["example"] = {"status": "missing"}
        if record["apiPage"]["status"] == "derived":
            api_reference = "references/component-api.md"
            anchor = component_api_anchor(export_name)
            api_path = skill_root / api_reference
            anchor_marker = f'<a id="{anchor}"></a>'
            if api_path.is_file() and anchor_marker in api_path.read_text(encoding="utf-8"):
                record["apiPage"] = {
                    "status": "documented",
                    "id": anchor,
                    "refs": [api_reference],
                }
            else:
                record["apiPage"] = {"status": "missing"}
        for field, evidence_kind in (("keyboard", "keyboard"), ("aria", "a11y")):
            if record[field].get("status") != "derived":
                continue
            refs = evidence[evidence_kind][export_name]
            record[field] = (
                {
                    "mode": record[field]["mode"],
                    "status": "documented",
                    "refs": refs,
                }
                if refs
                else {"mode": record[field]["mode"], "status": "missing"}
            )
        source_files = sorted(
            source
            for source in entry.get("sourceFiles", [])
            if isinstance(source, str)
        )
        type_sources = [
            source for source in source_files if Path(source).suffix.lower() in SCRIPT_SUFFIXES
        ]
        token_sources = [
            source for source in source_files if Path(source).suffix.lower() == ".css"
        ]
        tokens: set[str] = set()
        if interaction != "non-visual":
            for source in token_sources:
                path = kit_root / source
                if path.is_file():
                    tokens.update(
                        token
                        for token in CSS_CUSTOM_PROPERTY.findall(
                            path.read_text(encoding="utf-8")
                        )
                        if token in public_theme_tokens
                    )
        semantic_tokens: dict[str, Any]
        if interaction == "non-visual":
            semantic_tokens = {
                "status": "not-applicable",
                "reason": "Non-visual exports do not own rendered semantic tokens.",
            }
        else:
            semantic_tokens = {
                "status": "derived",
                "source": "manifest-css",
                "files": token_sources,
                "tokens": sorted(tokens),
            }
        record.update(
            {
                "family": family,
                "category": family_categories.get(family),
                "defaultsSource": {
                    "kind": "typescript",
                    "export": export_name,
                    "files": type_sources,
                },
                "semanticTokens": semantic_tokens,
            }
        )
        expanded[export_name] = record

        for field in ("example", "apiPage"):
            if record[field]["status"] == "missing":
                incomplete.append(f"{export_name} is missing {field} documentation")
        for field in ("keyboard", "aria"):
            contract = record[field]
            if contract["mode"] != "none" and contract["status"] == "missing":
                incomplete.append(
                    f"{export_name} is missing {field} evidence for "
                    f"{contract['mode']} owner mode"
                )
        if stability[export_name] == "deprecated" and record["migration"]["status"] != "documented":
            incomplete.append(f"deprecated export {export_name} is missing migration documentation")

        example = record["example"]
        if example["status"] == "documented":
            allowed_refs = set(evidence["example"][export_name])
            unowned = sorted(set(example["refs"]) - allowed_refs)
            if unowned:
                incomplete.append(
                    f"{export_name} example ref(s) are not explorer-owned evidence: "
                    + ", ".join(unowned)
                )
            for reference in example["refs"]:
                path = skill_root / reference
                if path.is_file() and not _example_case_is_declared(
                    path, export_name=export_name, case_id=example["id"]
                ):
                    incomplete.append(
                        f"{export_name} example {example['id']!r} is not declared by {reference}"
                    )
        for field, evidence_kind in (("keyboard", "keyboard"), ("aria", "a11y")):
            contract = record[field]
            if contract["mode"] != "none" and contract["status"] == "documented":
                unowned = sorted(
                    set(contract["refs"]) - set(evidence[evidence_kind][export_name])
                )
                if unowned:
                    incomplete.append(
                        f"{export_name} {field} ref(s) are not {evidence_kind} runner-owned evidence: "
                        + ", ".join(unowned)
                    )

    return expanded, errors, incomplete


def build_coverage_matrix(
    *,
    skill_root: Path = SKILL_ROOT,
    kit_root: Path = DEFAULT_KIT_ROOT,
    manifest: dict[str, Any] | None = None,
    registry: dict[str, Any] | None = None,
    documentation: dict[str, Any] | None = None,
    api_report: Path | None = None,
    enforce_documentation: bool = False,
) -> dict[str, Any]:
    manifest = manifest or read_json_object(
        kit_root / "component-manifest.json", label="component manifest"
    )
    registry = registry or read_json_object(
        kit_root / "registry.json", label="Personal UI registry"
    )
    documentation = documentation or read_json_object(
        kit_root / "component-docs.json", label="component documentation"
    )
    exports, classifications, stability, errors = validate_export_metadata(registry)
    if errors:
        raise ValueError("; ".join(errors))
    api_report = api_report or (kit_root / "etc" / "personal-ui.api.md")
    api_exports, api_errors = runtime_exports_from_api_report(api_report)
    missing_api_exports = sorted(set(exports) - set(api_exports))
    extra_api_exports = sorted(set(api_exports) - set(exports))
    if missing_api_exports:
        api_errors.append(
            "API report is missing runtime export(s): " + ", ".join(missing_api_exports)
        )
    if extra_api_exports:
        api_errors.append(
            "API report contains unknown runtime export(s): " + ", ".join(extra_api_exports)
        )
    if api_errors:
        raise ValueError("; ".join(api_errors))
    runner_errors = validate_runner_configuration(kit_root)
    if runner_errors:
        raise ValueError("; ".join(runner_errors))

    export_entries: dict[str, dict[str, Any]] = {}
    for raw_entry in manifest.get("entries", []):
        if not isinstance(raw_entry, dict):
            continue
        for export_name in raw_entry.get("publicExports", []):
            if not isinstance(export_name, str):
                continue
            if export_name in export_entries:
                raise ValueError(
                    f"component manifest assigns export {export_name!r} more than once"
                )
            export_entries[export_name] = raw_entry

    missing_manifest = sorted(set(exports) - set(export_entries))
    extra_manifest = sorted(set(export_entries) - set(exports))
    if missing_manifest or extra_manifest:
        messages: list[str] = []
        if missing_manifest:
            messages.append(
                "manifest is missing export(s): " + ", ".join(missing_manifest)
            )
        if extra_manifest:
            messages.append(
                "manifest has unknown export(s): " + ", ".join(extra_manifest)
            )
        raise ValueError("; ".join(messages))

    test_evidence, metadata_files, metadata_errors = collect_explicit_test_evidence(
        skill_root=skill_root,
        exports=set(exports),
    )
    if metadata_errors:
        raise ValueError("; ".join(metadata_errors))
    explorer_state_coverage: dict[str, Any] = {}
    explorer_evidence, explorer_errors = collect_validated_explorer_evidence(
        skill_root=skill_root,
        kit_root=kit_root,
        exports=set(exports),
        state_coverage=explorer_state_coverage,
    )
    if explorer_errors:
        raise ValueError("; ".join(explorer_errors))
    # Directives assign ownership, but only AST-verified reachable runtime usage is
    # allowed to become example evidence.
    test_evidence["example"] = explorer_evidence
    validated_test_evidence, test_evidence_errors = collect_validated_test_evidence(
        skill_root=skill_root,
        kit_root=kit_root,
        exports=set(exports),
    )
    if test_evidence_errors:
        raise ValueError("; ".join(test_evidence_errors))
    # Keyboard and ARIA ownership require executable per-export registration plus
    # a real AST-verified Explorer case. A directive by itself is not evidence.
    test_evidence["keyboard"] = validated_test_evidence["keyboard"]
    test_evidence["a11y"] = validated_test_evidence["a11y"]
    documentation_rows, documentation_errors, documentation_incomplete = (
        validate_documentation_metadata(
            documentation,
            exports=exports,
            classifications=classifications,
            stability=stability,
            export_entries=export_entries,
            evidence=test_evidence,
            skill_root=skill_root,
            kit_root=kit_root,
        )
    )
    if documentation_errors:
        raise ValueError("; ".join(documentation_errors))
    if enforce_documentation and documentation_incomplete:
        raise ValueError("; ".join(documentation_incomplete))
    api_evidence = [_relative_path(api_report, skill_root)]

    rows: list[dict[str, Any]] = []
    for export_name in exports:
        entry = export_entries[export_name]
        non_visual = set(entry.get("nonVisualExports", []))
        declared_owner_markers = [
            marker
            for marker in entry.get("ownerMarkers", [])
            if isinstance(marker, str)
        ]
        owner_markers = (
            []
            if export_name in non_visual
            else [export_name]
            if export_name in declared_owner_markers
            else declared_owner_markers
        )
        rows.append(
            {
                "name": export_name,
                "classification": classifications[export_name],
                "stability": stability[export_name],
                "api": api_evidence,
                "owner": {
                    "manifestEntry": entry.get("id"),
                    "markers": owner_markers,
                },
                "source": sorted(
                    source
                    for source in entry.get("sourceFiles", [])
                    if isinstance(source, str)
                ),
                "documentation": documentation_rows[export_name],
                "stateCoverage": {
                    "applicableStates": documentation_rows[export_name]["applicableStates"],
                    "sourceDemonstratedStates": [
                        fixture["state"]
                        for fixture in explorer_state_coverage["evidence"][export_name]
                    ],
                    "fixtures": explorer_state_coverage["evidence"][export_name],
                    "verificationKind": "structural-source-fixtures",
                    "behavioralVerification": False,
                },
                "example": test_evidence["example"][export_name],
                "unit": test_evidence["unit"][export_name],
                "browser": test_evidence["browser"][export_name],
                "keyboard": test_evidence["keyboard"][export_name],
                "a11y": test_evidence["a11y"][export_name],
            }
        )

    def count_by(field: str, values: tuple[str, ...]) -> dict[str, int]:
        return {
            value: sum(row[field] == value for row in rows)
            for value in values
        }

    return {
        "schemaVersion": 3,
        "kitVersion": registry.get("version"),
        "generatedFrom": [
            "assets/react-kit/component-manifest.json",
            "assets/react-kit/registry.json",
            "assets/react-kit/component-docs.json",
            "assets/react-kit/etc/personal-ui.api.md",
            "assets/react-kit/package.json",
            "assets/react-kit/playwright.config.ts",
            "assets/react-kit/vitest.config.ts",
            "assets/react-kit/tools/personal-ui/validate-explorer-cases.mjs",
            "assets/react-kit/tools/personal-ui/validate-test-evidence.mjs",
            *[
                _relative_path(path, skill_root)
                for path in sorted(set(metadata_files))
            ],
        ],
        "summary": {
            "exportCount": len(rows),
            "classificationCounts": count_by("classification", CLASSIFICATIONS),
            "stabilityCounts": count_by("stability", STABILITY_LEVELS),
            "evidenceCounts": {
                field: sum(bool(row[field]) for row in rows)
                for field in (
                    "api",
                    "owner",
                    "source",
                    "example",
                    "unit",
                    "browser",
                    "keyboard",
                    "a11y",
                )
            },
            "documentation": {
                "complete": not documentation_incomplete,
                "missingCount": len(documentation_incomplete),
            },
        },
        "documentationGaps": documentation_incomplete,
        "exports": rows,
    }


def serialized_matrix(matrix: dict[str, Any]) -> str:
    return json.dumps(matrix, ensure_ascii=False, indent=2) + "\n"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--kit-root", type=Path, default=DEFAULT_KIT_ROOT)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--registry", type=Path, default=DEFAULT_REGISTRY)
    parser.add_argument("--documentation", type=Path, default=DEFAULT_DOCUMENTATION)
    parser.add_argument("--api-report", type=Path, default=DEFAULT_API_REPORT)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument(
        "--check",
        action="store_true",
        help="fail when the committed matrix differs instead of rewriting it",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help=(
            "fail on missing examples, per-export API pages, keyboard owners, "
            "ARIA owners, or deprecated-export migration documentation"
        ),
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    manifest = read_json_object(args.manifest, label="component manifest")
    registry = read_json_object(args.registry, label="Personal UI registry")
    documentation = read_json_object(
        args.documentation, label="component documentation"
    )
    matrix = build_coverage_matrix(
        skill_root=SKILL_ROOT,
        kit_root=args.kit_root,
        manifest=manifest,
        registry=registry,
        documentation=documentation,
        api_report=args.api_report,
        enforce_documentation=False,
    )
    if args.strict and matrix["documentationGaps"]:
        gaps = matrix["documentationGaps"]
        print(f"documentation coverage is incomplete: {len(gaps)} gap(s)")
        for gap in gaps[:20]:
            print(f"- {gap}")
        if len(gaps) > 20:
            print(f"- ... {len(gaps) - 20} more gap(s)")
        return 1
    expected = serialized_matrix(matrix)
    if args.check:
        try:
            actual = args.output.read_text(encoding="utf-8")
        except OSError:
            print(f"coverage matrix is missing: {args.output}")
            return 1
        if actual != expected:
            print(
                "coverage matrix is stale; run "
                "python scripts/generate_component_coverage.py"
            )
            return 1
        print(
            f"coverage matrix is current: {len(matrix['exports'])} public exports"
        )
        return 0

    args.output.write_text(expected, encoding="utf-8", newline="\n")
    print(f"wrote {args.output}: {len(matrix['exports'])} public exports")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
