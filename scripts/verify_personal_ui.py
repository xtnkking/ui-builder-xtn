#!/usr/bin/env python3
"""Verify that a project contains and consumes the bundled Personal UI source."""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
from collections import Counter
from pathlib import Path

from validate_component_manifest import validate_component_manifest


SKILL_ROOT = Path(__file__).resolve().parent.parent
ASSET_ROOT = SKILL_ROOT / "assets" / "react-kit"
BUNDLED_SOURCE_ROOT = ASSET_ROOT / "src" / "personal-ui"
REGISTRY_PATH = ASSET_ROOT / "registry.json"
COMPONENT_MANIFEST_PATH = ASSET_ROOT / "component-manifest.json"
PROVENANCE_TOOL_PATH = ASSET_ROOT / "tools" / "personal-ui" / "verify-provenance.mjs"
INSTALLED_TOOL_ROOT = Path("tools") / "personal-ui"
PROVENANCE_SCRIPT_NAME = "verify:personal-ui"
PROVENANCE_SCRIPT_COMMAND = (
    "node tools/personal-ui/verify-provenance.mjs --target . "
    "--source-root src/personal-ui --manifest tools/personal-ui/component-manifest.json"
)
PREBUILD_GATE_COMMAND = f"npm run {PROVENANCE_SCRIPT_NAME}"
COMPONENT_SELECTOR = re.compile(r"(?<![\w-])\.pui-[\w-]+")
OWNER_SELECTOR = re.compile(r"\[\s*data-pui[\w-]*", re.IGNORECASE)
SEMVER = re.compile(
    r"^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)"
    r"(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?"
    r"(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$"
)
RUNTIME_EXPORT_NAME = re.compile(r"^[A-Za-z_$][\w$]*$")
BARREL_STAR_EXPORT = re.compile(
    r"""^\s*export\s+\*\s+from\s+["']([^"']+)["']\s*;?""", re.MULTILINE
)
RUNTIME_DECLARATION = re.compile(
    r"^\s*export\s+(?:default\s+)?(?:async\s+)?(?:function|class|const|let|var)\s+([A-Za-z_$][\w$]*)",
    re.MULTILINE,
)
NAMED_EXPORT = re.compile(r"^\s*export\s*\{([^}]*)\}", re.MULTILINE | re.DOTALL)
STATIC_IMPORT = re.compile(
    r"""^[ \t]*import(?![ \t]+type\b)(?:[\s\S]*?[ \t]+from[ \t]+)?[ \t]*["']([^"']+)["']""",
    re.MULTILINE,
)
STATIC_IMPORT_FROM = re.compile(
    r'''^[ \t]*import(?![ \t]+type\b)([\s\S]*?)[ \t]+from[ \t]+["']([^"']+)["']''',
    re.MULTILINE,
)
DYNAMIC_IMPORT = re.compile(r"""\bimport\s*\(\s*["']([^"']+)["']\s*\)""")
REEXPORT_FROM = re.compile(
    r"""^[ \t]*export(?![ \t]+type\b)(?:\s*\*|\s*\{[\s\S]*?\})\s*from[ \t]+["']([^"']+)["']""",
    re.MULTILINE,
)
CSS_IMPORT = re.compile(
    r"""(?:^|[;{}\n])[ \t]*@(?:import|use|forward)\s+(?:url\(\s*)?(?:["']([^"']+)["']|([^\s);]+))""",
    re.MULTILINE,
)
REQUIRE_IMPORT = re.compile(r"""\brequire\s*\(\s*["']([^"']+)["']\s*\)""")
SCRIPT_SUFFIXES = {".ts", ".tsx", ".js", ".jsx", ".mts", ".cts", ".mjs", ".cjs"}
STYLE_SUFFIXES = {".css", ".pcss", ".postcss", ".scss", ".sass", ".less"}
HTML_SUFFIXES = {".html", ".htm"}
IGNORED_APPLICATION_DIRECTORIES = {
    ".git",
    ".personal-ui-stage",
    "dist",
    "node_modules",
    "build",
    "coverage",
}
CSS_IN_SCRIPT_SELECTOR = re.compile(
    r'''(?<![\w-])\.pui-[\w-]+[^"'`{};]{0,160}\{''', re.DOTALL
)
CSS_IN_SCRIPT_OBJECT_SELECTOR = re.compile(
    r'''["'`]\s*(?:&\s+)?\.pui-[\w-]+[^"'`]*["'`]\s*:\s*\{''', re.DOTALL
)
NATIVE_SELECT_JSX = re.compile(r"<\s*select(?=[\s>/])")
NATIVE_SELECT_HTML = re.compile(r"<\s*select(?=[\s>/])", re.IGNORECASE)
HTML_COMMENT = re.compile(r"<!--.*?-->", re.DOTALL)
HTML_STYLE_BLOCK = re.compile(
    r"<style\b[^>]*>([\s\S]*?)</style\s*>", re.IGNORECASE
)
HTML_LINK_TAG = re.compile(r"<link\b[^>]*>", re.IGNORECASE)
HTML_SCRIPT_SOURCE = re.compile(
    r'''<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>''', re.IGNORECASE
)
CSS_IDENTIFIER_ESCAPE = re.compile(
    r"\\([0-9a-fA-F]{1,6})(?:\r\n|[\t\n\f\r ])?|\\([^\r\n])"
)
CSS_PROTECTED_TAGS = {
    "a",
    "button",
    "details",
    "dialog",
    "fieldset",
    "form",
    "input",
    "label",
    "meter",
    "optgroup",
    "option",
    "progress",
    "select",
    "summary",
    "table",
    "tbody",
    "td",
    "textarea",
    "tfoot",
    "th",
    "thead",
    "tr",
}
CSS_CLASS_SCOPABLE_MEDIA_TAGS = {"svg"}
CSS_CONTROL_STATE_PSEUDO_CLASSES = {
    "any-link",
    "autofill",
    "checked",
    "disabled",
    "enabled",
    "indeterminate",
    "invalid",
    "optional",
    "placeholder-shown",
    "read-only",
    "read-write",
    "required",
    "user-invalid",
    "user-valid",
    "valid",
}
CSS_SENSITIVE_ATTRIBUTES = {
    "aria-busy",
    "aria-checked",
    "aria-current",
    "aria-disabled",
    "aria-expanded",
    "aria-invalid",
    "aria-pressed",
    "aria-selected",
    "autocomplete",
    "checked",
    "class",
    "contenteditable",
    "data-active",
    "data-current",
    "data-disabled",
    "data-empty",
    "data-invalid",
    "data-loading",
    "data-open",
    "data-partial",
    "data-position",
    "data-positioned",
    "data-selected",
    "data-state",
    "data-tone",
    "disabled",
    "href",
    "multiple",
    "name",
    "placeholder",
    "readonly",
    "required",
    "role",
    "selected",
    "style",
    "tabindex",
    "type",
    "value",
}
CSS_SAFE_INHERITED_FONT_PROPERTIES = {
    "font",
    "font-family",
    "font-feature-settings",
    "font-kerning",
    "font-language-override",
    "font-optical-sizing",
    "font-palette",
    "font-size",
    "font-size-adjust",
    "font-stretch",
    "font-style",
    "font-synthesis",
    "font-variant",
    "font-variation-settings",
    "font-weight",
    "line-height",
}
STYLE_OVERRIDE_LAYOUT_ENTRY_IDS = {
    "aspect",
    "collapse",
    "color",
    "divider",
    "focus-trap",
    "layout",
    "portal",
    "resizable",
    "responsive",
    "responsive-visibility",
    "scroll",
    "sticky",
    "visually-hidden",
}
PROTECTED_COMPONENT_PROPS = ("className", "style", "css", "sx", "tw", "ref")
CSS_IN_JS_PACKAGES = {"styled-components", "@emotion/styled", "@emotion/react"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--target", type=Path, required=True)
    parser.add_argument(
        "--allow-unreferenced",
        action="store_true",
        help="Validate installation before a page imports it.",
    )
    parser.add_argument(
        "--require-component",
        action="append",
        default=[],
        metavar="EXPORT",
        help=(
            "Compatibility-only assertion for a specific public export. Component provenance "
            "is checked automatically even when this option is omitted."
        ),
    )
    return parser.parse_args()


def read_json_object(path: Path, *, label: str) -> dict[str, object]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"{label} must contain a JSON object: {path}")
    return value


def validate_registry_shape(registry: dict[str, object], *, label: str) -> list[str]:
    errors: list[str] = []
    required_fields = {
        "name": str,
        "version": str,
        "sourceRoot": str,
        "styleEntry": str,
        "exports": list,
        "dependencies": dict,
    }
    for field, expected_type in required_fields.items():
        if not isinstance(registry.get(field), expected_type):
            errors.append(f"{label} field {field!r} has the wrong type")
    if registry.get("name") != "personal-ui":
        errors.append(f"{label} has an unexpected name")
    version = registry.get("version")
    if isinstance(version, str) and not SEMVER.fullmatch(version):
        errors.append(f"{label} version must use semantic versioning")
    if (
        registry.get("sourceRoot") != "src/personal-ui"
        or registry.get("styleEntry") != "src/personal-ui/styles.css"
    ):
        errors.append(f"{label} has unexpected managed paths")
    exports = registry.get("exports")
    if isinstance(exports, list):
        export_names = [name for name in exports if isinstance(name, str)]
        if (
            not exports
            or len(export_names) != len(exports)
            or any(not RUNTIME_EXPORT_NAME.fullmatch(name) for name in export_names)
            or len(set(export_names)) != len(export_names)
        ):
            errors.append(
                f"{label} exports must be unique, non-empty runtime identifiers"
            )
    dependencies = registry.get("dependencies")
    if isinstance(dependencies, dict) and any(
        not isinstance(name, str)
        or not name.strip()
        or not isinstance(version, str)
        or not version.strip()
        for name, version in dependencies.items()
    ):
        errors.append(
            f"{label} dependencies must use non-empty string names and versions"
        )
    return errors


def is_recognized_personal_ui_registry(value: object) -> bool:
    return (
        isinstance(value, dict)
        and value.get("name") == "personal-ui"
        and value.get("sourceRoot") == "src/personal-ui"
        and value.get("styleEntry") == "src/personal-ui/styles.css"
        and isinstance(value.get("version"), str)
        and isinstance(value.get("exports"), list)
        and isinstance(value.get("dependencies"), dict)
    )


def is_link_like(path: Path) -> bool:
    is_junction = getattr(path, "is_junction", None)
    return path.is_symlink() or bool(is_junction and is_junction())


def validate_project_path_integrity(
    target: Path, source_root: Path
) -> list[str]:
    errors: list[str] = []
    if is_link_like(target):
        errors.append(f"project target must not be a symbolic link or junction: {target}")

    target_physical = target.resolve(strict=False)
    skill_physical = SKILL_ROOT.resolve(strict=True)
    if is_inside(target_physical, skill_physical) or is_inside(
        skill_physical, target_physical
    ):
        errors.append(
            "project target must be physically separate from the Personal UI Skill source: "
            f"{target} resolves to {target_physical}"
        )

    guarded_paths = {
        "package.json": target / "package.json",
        "application source": target / "src",
        "managed Personal UI source": source_root,
        "installed Personal UI registry": source_root / "registry.json",
        "installed Personal UI tools": target / INSTALLED_TOOL_ROOT,
        "installed Personal UI component manifest": target
        / INSTALLED_TOOL_ROOT
        / "component-manifest.json",
        "installed Personal UI provenance verifier": target
        / INSTALLED_TOOL_ROOT
        / "verify-provenance.mjs",
    }
    for label, path in guarded_paths.items():
        if is_link_like(path):
            errors.append(f"{label} must not be a symbolic link or junction: {path}")

    application_source = target / "src"
    if application_source.is_dir() and not is_link_like(application_source):
        for path in application_source.rglob("*"):
            if is_link_like(path):
                errors.append(
                    f"application source contains a symbolic link or junction: {path}"
                )
    return errors


def validate_bundled_path_integrity() -> list[str]:
    errors: list[str] = []
    for label, path in (
        ("registry", REGISTRY_PATH),
        ("component manifest", COMPONENT_MANIFEST_PATH),
        ("provenance verifier", PROVENANCE_TOOL_PATH),
    ):
        if is_link_like(path):
            errors.append(
                f"bundled Personal UI {label} must not be a symbolic link or junction: {path}"
            )
        elif not path.is_file():
            errors.append(f"missing bundled Personal UI {label}: {path}")
    if is_link_like(BUNDLED_SOURCE_ROOT):
        errors.append(
            f"bundled Personal UI source must not be a symbolic link or junction: {BUNDLED_SOURCE_ROOT}"
        )
        return errors
    if BUNDLED_SOURCE_ROOT.is_dir():
        for path in BUNDLED_SOURCE_ROOT.rglob("*"):
            if is_link_like(path):
                errors.append(
                    f"bundled Personal UI source contains a symbolic link or junction: {path}"
                )
    return errors


def compare_installed_support_file(
    expected: Path,
    installed: Path,
    *,
    label: str,
    errors: list[str],
) -> dict[str, object]:
    report: dict[str, object] = {
        "expected": str(expected),
        "installed": str(installed),
        "matches": False,
    }
    if is_link_like(installed):
        errors.append(
            f"installed Personal UI {label} must not be a symbolic link or junction: {installed}"
        )
        return report
    if not installed.is_file():
        errors.append(f"missing installed Personal UI {label}: {installed}")
        return report
    try:
        matches = expected.read_bytes() == installed.read_bytes()
    except OSError as error:
        errors.append(f"cannot compare installed Personal UI {label}: {error}")
        return report
    report["matches"] = matches
    if not matches:
        errors.append(
            f"installed Personal UI {label} differs from the bundled canonical file: {installed}"
        )
    return report


def run_provenance_scan(
    target: Path,
    source_root: Path,
    errors: list[str],
) -> dict[str, object]:
    empty_report: dict[str, object] = {
        "valid": False,
        "scannedFiles": 0,
        "usedPublicExports": [],
        "issues": [],
        "errors": [],
    }
    node = shutil.which("node")
    if node is None:
        message = "Node.js is required to run the Personal UI provenance verifier"
        errors.append(message)
        empty_report["errors"] = [message]
        return empty_report
    try:
        relative_source_root = source_root.relative_to(target).as_posix()
    except ValueError:
        message = f"managed Personal UI source is outside the project target: {source_root}"
        errors.append(message)
        empty_report["errors"] = [message]
        return empty_report
    try:
        result = subprocess.run(
            [
                node,
                str(PROVENANCE_TOOL_PATH),
                "--target",
                str(target),
                "--source-root",
                relative_source_root,
                "--manifest",
                str(COMPONENT_MANIFEST_PATH),
            ],
            cwd=target,
            capture_output=True,
            text=True,
            encoding="utf-8",
            check=False,
            timeout=60,
        )
    except (OSError, subprocess.SubprocessError) as error:
        message = f"cannot run Personal UI provenance verifier: {error}"
        errors.append(message)
        empty_report["errors"] = [message]
        return empty_report
    try:
        value = json.loads(result.stdout)
        if not isinstance(value, dict):
            raise ValueError("report is not an object")
    except (json.JSONDecodeError, ValueError) as error:
        message = (
            "Personal UI provenance verifier emitted invalid JSON: "
            f"{error}; stderr={result.stderr.strip()!r}"
        )
        errors.append(message)
        empty_report["errors"] = [message]
        return empty_report
    provenance_errors = value.get("errors", [])
    if isinstance(provenance_errors, list):
        for item in provenance_errors:
            if isinstance(item, str):
                errors.append(f"component provenance: {item}")
    else:
        errors.append("Personal UI provenance verifier report has invalid errors field")
    if result.returncode != 0 and not provenance_errors:
        errors.append(
            "Personal UI provenance verifier failed without a diagnostic: "
            f"exit={result.returncode}, stderr={result.stderr.strip()!r}"
        )
    return value


def resolve_typescript_module(base: Path, specifier: str) -> Path | None:
    unresolved = base / specifier
    candidates = [
        Path(f"{unresolved}.ts"),
        Path(f"{unresolved}.tsx"),
        unresolved / "index.ts",
        unresolved / "index.tsx",
    ]
    return next((candidate for candidate in candidates if candidate.is_file()), None)


def named_runtime_exports(text: str) -> list[str]:
    names: list[str] = []
    for body in NAMED_EXPORT.findall(text):
        for raw_item in body.split(","):
            item = raw_item.strip()
            if not item or item.startswith("type "):
                continue
            item = re.sub(r"/\*.*?\*/", "", item, flags=re.DOTALL).strip()
            if not item:
                continue
            parts = re.split(r"\s+as\s+", item)
            name = parts[-1].strip()
            if re.fullmatch(r"[A-Za-z_$][\w$]*", name):
                names.append(name)
    return names


def validate_runtime_exports(
    registry: dict[str, object],
) -> tuple[dict[str, object], list[str]]:
    errors: list[str] = []
    index_path = BUNDLED_SOURCE_ROOT / "index.ts"
    runtime_exports: list[str] = []
    try:
        index_text = index_path.read_text(encoding="utf-8")
    except OSError as error:
        return {
            "registered": registry.get("exports", []),
            "runtime": [],
            "missingFromRegistry": [],
            "missingFromBarrel": [],
            "duplicates": [],
        }, [f"cannot read bundled barrel {index_path}: {error}"]

    runtime_exports.extend(RUNTIME_DECLARATION.findall(index_text))
    runtime_exports.extend(named_runtime_exports(index_text))
    for specifier in BARREL_STAR_EXPORT.findall(index_text):
        module_path = resolve_typescript_module(index_path.parent, specifier)
        if module_path is None:
            errors.append(f"bundled barrel export cannot be resolved: {specifier}")
            continue
        module_text = module_path.read_text(encoding="utf-8")
        runtime_exports.extend(RUNTIME_DECLARATION.findall(module_text))
        runtime_exports.extend(named_runtime_exports(module_text))

    registered_value = registry.get("exports", [])
    registered = (
        [name for name in registered_value if isinstance(name, str)]
        if isinstance(registered_value, list)
        else []
    )
    if isinstance(registered_value, list) and len(registered) != len(registered_value):
        errors.append("bundled registry exports must contain only strings")
    registered_duplicates = sorted(
        name for name, count in Counter(registered).items() if count > 1
    )
    runtime_duplicates = sorted(
        name for name, count in Counter(runtime_exports).items() if count > 1
    )
    missing_from_registry = sorted(set(runtime_exports) - set(registered))
    missing_from_barrel = sorted(set(registered) - set(runtime_exports))
    if registered_duplicates:
        errors.append(
            f"bundled registry contains duplicate runtime exports: {', '.join(registered_duplicates)}"
        )
    if runtime_duplicates:
        errors.append(
            f"bundled barrel contains duplicate runtime exports: {', '.join(runtime_duplicates)}"
        )
    if missing_from_registry:
        errors.append(
            f"bundled runtime exports missing from registry: {', '.join(missing_from_registry)}"
        )
    if missing_from_barrel:
        errors.append(
            f"bundled registry exports missing from barrel: {', '.join(missing_from_barrel)}"
        )
    return {
        "registered": registered,
        "runtime": sorted(set(runtime_exports)),
        "missingFromRegistry": missing_from_registry,
        "missingFromBarrel": missing_from_barrel,
        "duplicates": sorted(set(registered_duplicates + runtime_duplicates)),
    }, errors


def managed_files(root: Path) -> dict[str, Path]:
    if not root.is_dir():
        return {}
    return {
        path.relative_to(root).as_posix(): path
        for path in root.rglob("*")
        if path.is_file() and path.relative_to(root).as_posix() != "registry.json"
    }


def compare_managed_source(
    target_source_root: Path, errors: list[str]
) -> dict[str, list[str]]:
    bundled = managed_files(BUNDLED_SOURCE_ROOT)
    installed = managed_files(target_source_root)
    missing = sorted(set(bundled) - set(installed))
    extra = sorted(set(installed) - set(bundled))
    changed: list[str] = []
    shared: list[str] = []
    for relative in sorted(set(bundled) & set(installed)):
        try:
            if os.path.samefile(bundled[relative], installed[relative]):
                shared.append(relative)
            if bundled[relative].read_bytes() != installed[relative].read_bytes():
                changed.append(relative)
        except OSError as error:
            errors.append(f"cannot compare managed source file {relative}: {error}")
            changed.append(relative)
    if missing:
        errors.append(f"managed Personal UI source has {len(missing)} missing file(s)")
    if changed:
        errors.append(f"managed Personal UI source has {len(changed)} changed file(s)")
    if extra:
        errors.append(f"managed Personal UI source has {len(extra)} extra file(s)")
    if shared:
        errors.append(
            f"managed Personal UI source shares {len(shared)} physical file(s) with the bundled source"
        )
    return {"missing": missing, "changed": changed, "extra": extra, "shared": shared}


def strip_js_comments(text: str) -> str:
    output: list[str] = []
    index = 0
    quote: str | None = None
    escaped = False
    while index < len(text):
        character = text[index]
        following = text[index + 1] if index + 1 < len(text) else ""
        if quote is not None:
            output.append(character)
            if escaped:
                escaped = False
            elif character == "\\":
                escaped = True
            elif character == quote:
                quote = None
            index += 1
            continue
        if character in {"'", '"', "`"}:
            quote = character
            output.append(character)
            index += 1
            continue
        if character == "/" and following == "/":
            output.extend((" ", " "))
            index += 2
            while index < len(text) and text[index] not in "\r\n":
                output.append(" ")
                index += 1
            continue
        if character == "/" and following == "*":
            output.extend((" ", " "))
            index += 2
            while index < len(text):
                if (
                    text[index] == "*"
                    and index + 1 < len(text)
                    and text[index + 1] == "/"
                ):
                    output.extend((" ", " "))
                    index += 2
                    break
                output.append("\n" if text[index] == "\n" else " ")
                index += 1
            continue
        output.append(character)
        index += 1
    return "".join(output)


def strip_css_comments(text: str) -> str:
    return re.sub(
        r"/\*.*?\*/",
        lambda match: "\n" * match.group(0).count("\n"),
        text,
        flags=re.DOTALL,
    )


def source_line(text: str, offset: int) -> int:
    return text.count("\n", 0, max(0, offset)) + 1


def decode_css_identifier_escapes(value: str) -> str:
    def replace(match: re.Match[str]) -> str:
        if match.group(1):
            point = int(match.group(1), 16)
            return chr(0xFFFD if point == 0 or point > 0x10FFFF else point)
        return match.group(2) or ""

    return CSS_IDENTIFIER_ESCAPE.sub(replace, value)


def find_css_block_end(text: str, opening: int, end: int) -> int | None:
    depth = 1
    quote: str | None = None
    escaped = False
    index = opening + 1
    while index < end:
        character = text[index]
        if quote is not None:
            if escaped:
                escaped = False
            elif character == "\\":
                escaped = True
            elif character == quote:
                quote = None
        elif character in {"'", '"'}:
            quote = character
        elif character == "{":
            depth += 1
        elif character == "}":
            depth -= 1
            if depth == 0:
                return index
        index += 1
    return None


def css_rule_blocks(
    text: str,
    start: int = 0,
    end: int | None = None,
    ancestors: tuple[str, ...] = (),
) -> list[tuple[str, str, int, tuple[str, ...]]]:
    limit = len(text) if end is None else end
    rules: list[tuple[str, str, int, tuple[str, ...]]] = []
    statement_start = start
    quote: str | None = None
    escaped = False
    round_depth = 0
    square_depth = 0
    index = start
    while index < limit:
        character = text[index]
        if quote is not None:
            if escaped:
                escaped = False
            elif character == "\\":
                escaped = True
            elif character == quote:
                quote = None
            index += 1
            continue
        if character in {"'", '"'}:
            quote = character
        elif character == "(":
            round_depth += 1
        elif character == ")":
            round_depth = max(0, round_depth - 1)
        elif character == "[":
            square_depth += 1
        elif character == "]":
            square_depth = max(0, square_depth - 1)
        elif character == ";" and round_depth == 0 and square_depth == 0:
            statement_start = index + 1
        elif character == "{" and round_depth == 0 and square_depth == 0:
            closing = find_css_block_end(text, index, limit)
            if closing is None:
                break
            raw_prelude = text[statement_start:index]
            leading = len(raw_prelude) - len(raw_prelude.lstrip())
            prelude = raw_prelude.strip()
            prelude_offset = statement_start + leading
            body = text[index + 1 : closing]
            if prelude:
                rules.append((prelude, body, prelude_offset, ancestors))
            child_ancestors = (
                ancestors
                if not prelude or prelude.startswith("@") or re.match(r"^(?:--|\$)", prelude)
                else (*ancestors, prelude)
            )
            rules.extend(
                css_rule_blocks(
                    text,
                    index + 1,
                    closing,
                    child_ancestors,
                )
            )
            index = closing
            statement_start = closing + 1
        index += 1
    return rules


def indented_sass_rule_blocks(
    text: str,
) -> list[tuple[str, str, int, tuple[str, ...]]]:
    records: list[dict[str, object]] = []
    stack: list[dict[str, object]] = []
    offset = 0
    declaration_pattern = re.compile(r"^((?:--|-?[A-Za-z_])[\w-]*)\s*:\s*(.+)$")
    for raw_line in text.splitlines(keepends=True):
        without_newline = raw_line.rstrip("\r\n")
        stripped = without_newline.strip()
        leading = without_newline[: len(without_newline) - len(without_newline.lstrip())]
        indent = sum(4 if character == "\t" else 1 for character in leading)
        if not stripped or stripped.startswith("//"):
            offset += len(raw_line)
            continue
        while stack and int(stack[-1]["indent"]) >= indent:
            stack.pop()
        declaration = declaration_pattern.match(stripped)
        if declaration and stack:
            owner = next(
                (record for record in reversed(stack) if record["selector"]),
                None,
            )
            if owner is not None:
                owner["declarations"].append(
                    (declaration.group(1).lower(), declaration.group(2).strip())
                )
            offset += len(raw_line)
            continue
        if stack and re.match(
            r"^(?:@(?:include|extend|apply)\b|\+[A-Za-z_-][\w-]*(?:\s*\(|\b))",
            stripped,
            re.IGNORECASE,
        ):
            owner = next(
                (record for record in reversed(stack) if record["selector"]),
                None,
            )
            if owner is not None:
                owner["statements"].append(stripped.rstrip(";"))
            offset += len(raw_line)
            continue
        parent_selectors = tuple(
            str(record["selector"])
            for record in stack
            if record["selector"]
        )
        is_container = stripped.startswith(("@", "$"))
        record: dict[str, object] = {
            "selector": "" if is_container else stripped,
            "offset": offset + len(leading),
            "indent": indent,
            "ancestors": parent_selectors,
            "declarations": [],
            "statements": [],
        }
        stack.append(record)
        if not is_container:
            records.append(record)
        offset += len(raw_line)
    return [
        (
            str(record["selector"]),
            ";".join(
                [
                    f"{property_name}:{value}"
                    for property_name, value in record["declarations"]
                ]
                + [str(value) for value in record["statements"]]
            ),
            int(record["offset"]),
            tuple(str(value) for value in record["ancestors"]),
        )
        for record in records
    ]


def css_top_level_text(text: str) -> str:
    output = list(text)
    quote: str | None = None
    escaped = False
    depth = 0
    for index, character in enumerate(text):
        if quote is not None:
            if depth > 0 and character != "\n":
                output[index] = " "
            if escaped:
                escaped = False
            elif character == "\\":
                escaped = True
            elif character == quote:
                quote = None
            continue
        if character in {"'", '"'}:
            quote = character
            if depth > 0:
                output[index] = " "
        elif character == "{":
            depth += 1
            output[index] = " "
        elif character == "}":
            output[index] = " "
            depth = max(0, depth - 1)
        elif depth > 0 and character != "\n":
            output[index] = " "
    return "".join(output)


def css_declarations(body: str) -> list[tuple[str, str]]:
    top_level = css_top_level_text(body)
    pattern = re.compile(
        r"(?:^|;)\s*((?:--|-?[A-Za-z_])[\w-]*)\s*:\s*([^;{}]+)",
        re.MULTILINE,
    )
    return [
        (match.group(1).lower(), match.group(2).strip())
        for match in pattern.finditer(top_level)
    ]


def css_uninspectable_statements(body: str) -> list[str]:
    """Return top-level style statements that are not plain declarations."""
    statements: list[str] = []
    start = 0
    index = 0
    quote: str | None = None
    escaped = False
    parentheses = 0
    brackets = 0
    while index < len(body):
        character = body[index]
        if quote is not None:
            if escaped:
                escaped = False
            elif character == "\\":
                escaped = True
            elif character == quote:
                quote = None
            index += 1
            continue
        if character in {"'", '"'}:
            quote = character
        elif character == "(":
            parentheses += 1
        elif character == ")":
            parentheses = max(0, parentheses - 1)
        elif character == "[":
            brackets += 1
        elif character == "]":
            brackets = max(0, brackets - 1)
        elif character == "{" and parentheses == 0 and brackets == 0:
            prelude = body[start:index].strip()
            if re.match(
                r"^(?:@(?:include|extend|apply)\b|[.#+]?[A-Za-z_-][\w-]*\s*\()",
                prelude,
                re.IGNORECASE,
            ):
                statements.append(prelude)
            closing = find_css_block_end(body, index, len(body))
            if closing is None:
                statements.append(body[start:].strip())
                return [value for value in statements if value]
            index = closing + 1
            start = index
            continue
        elif (
            character == ";"
            and parentheses == 0
            and brackets == 0
        ):
            statement = body[start:index].strip()
            if statement and not re.fullmatch(
                r"(?:--|-?[A-Za-z_])[\w-]*\s*:\s*[\s\S]+",
                statement,
            ):
                statements.append(statement)
            start = index + 1
        index += 1
    tail = body[start:].strip()
    if tail and not re.fullmatch(
        r"(?:--|-?[A-Za-z_])[\w-]*\s*:\s*[\s\S]+",
        tail,
    ):
        statements.append(tail)
    return statements


def safe_control_reset(declarations: list[tuple[str, str]]) -> bool:
    if not declarations:
        return False
    for property_name, raw_value in declarations:
        value = re.sub(r"\s+", " ", raw_value.strip().lower())
        if "!important" in value:
            return False
        if property_name.startswith("--") and not property_name.startswith("--pui-"):
            continue
        if property_name in {"box-sizing", "-moz-box-sizing", "-webkit-box-sizing"} and value in {
            "border-box",
            "inherit",
        }:
            continue
        if property_name in CSS_SAFE_INHERITED_FONT_PROPERTIES and value == "inherit":
            continue
        return False
    return True


def mask_non_targeting_selector_pseudos(selector: str) -> str:
    output = list(selector)
    lowered = selector.lower()
    pattern = re.compile(r":(?:has|not)\s*\(", re.IGNORECASE)
    for match in pattern.finditer(selector):
        if all(character == " " for character in output[match.start() : match.end()]):
            continue
        depth = 1
        quote: str | None = None
        escaped = False
        cursor = match.end()
        while cursor < len(selector) and depth:
            character = selector[cursor]
            if quote is not None:
                if escaped:
                    escaped = False
                elif character == "\\":
                    escaped = True
                elif character == quote:
                    quote = None
            elif character in {"'", '"'}:
                quote = character
            elif character == "(":
                depth += 1
            elif character == ")":
                depth -= 1
            cursor += 1
        for index in range(match.start(), cursor):
            if output[index] != "\n":
                output[index] = " "
    return "".join(output)


def selector_targets_personal_ui_intrinsic(selector: str) -> bool:
    decoded = decode_css_identifier_escapes(selector)
    target_selector = mask_non_targeting_selector_pseudos(decoded)
    without_attributes = re.sub(r"\[[^\]]*\]", " ", target_selector)
    without_strings = re.sub(r'''(["']).*?\1''', " ", without_attributes)
    protected_tags = CSS_PROTECTED_TAGS | CSS_CLASS_SCOPABLE_MEDIA_TAGS
    token_pattern = re.compile(r"(^|[\s>+~,(|])([A-Za-z][-_A-Za-z0-9]*)")
    for match in token_pattern.finditer(without_strings):
        tag = match.group(2).lower()
        if tag not in protected_tags:
            continue
        if tag in CSS_CLASS_SCOPABLE_MEDIA_TAGS:
            tag_end = match.end(2)
            boundary = re.search(r"[\s>+~,)]+", without_strings[tag_end:])
            compound_tail = (
                without_strings[tag_end:]
                if boundary is None
                else without_strings[tag_end : tag_end + boundary.start()]
            )
            if re.search(r"[.#][-_A-Za-z][-_A-Za-z0-9]*", compound_tail):
                continue
        return True
    if re.search(
        r"(?:^|[\s>+~,(])\*(?=$|[\s>+~.#:[,)])",
        without_strings,
    ):
        return True
    for match in re.finditer(r"\[\s*([\w-]+)", target_selector):
        attribute = match.group(1).lower()
        if (
            attribute.startswith("data-pui")
            or attribute.startswith("aria-")
            or attribute in CSS_SENSITIVE_ATTRIBUTES
        ):
            return True
    pseudo_pattern = re.compile(
        r"(?<!:):(?:-webkit-)?([-_A-Za-z][-_A-Za-z0-9]*)",
        re.IGNORECASE,
    )
    for match in pseudo_pattern.finditer(target_selector):
        if match.group(1).lower() in CSS_CONTROL_STATE_PSEUDO_CLASSES:
            return True
    return False


def application_style_findings(
    text: str, suffix: str = ""
) -> list[tuple[str, int, str]]:
    clean = strip_css_comments(text)
    if suffix in {".scss", ".sass", ".less"}:
        clean = strip_js_comments(clean)
    findings: list[tuple[str, int, str]] = []
    seen: set[tuple[str, int]] = set()
    rules = (
        indented_sass_rule_blocks(clean)
        if suffix == ".sass" and "{" not in clean
        else css_rule_blocks(clean)
    )
    for selector, body, offset, ancestors in rules:
        if selector.lstrip().startswith("@"):
            continue
        line = source_line(clean, offset)
        decoded_selector = decode_css_identifier_escapes(selector)
        if COMPONENT_SELECTOR.search(decoded_selector):
            key = ("PUI_PRIVATE_CLASS", line)
            if key not in seen:
                seen.add(key)
                findings.append(
                    (
                        key[0],
                        line,
                        f"reserved Personal UI class selector is forbidden: {selector!r}",
                    )
                )
        if OWNER_SELECTOR.search(decoded_selector):
            key = ("PUI_RESERVED_MARKER", line)
            if key not in seen:
                seen.add(key)
                findings.append(
                    (
                        key[0],
                        line,
                        f"reserved Personal UI ownership selector is forbidden: {selector!r}",
                    )
                )
        declarations = css_declarations(body)
        inherited_target = any(
            selector_targets_personal_ui_intrinsic(ancestor)
            for ancestor in ancestors
        )
        protected_target = (
            inherited_target or selector_targets_personal_ui_intrinsic(selector)
        )
        injections = css_uninspectable_statements(body) if protected_target else []
        if protected_target and (
            injections or (declarations and not safe_control_reset(declarations))
        ):
            key = ("PUI_GENERIC_STYLE_OVERRIDE", line)
            if key not in seen:
                seen.add(key)
                detail = (
                    f" and contains uninspectable statement {injections[0]!r}"
                    if injections
                    else ""
                )
                findings.append(
                    (
                        key[0],
                        line,
                        "selector can restyle Personal UI-owned elements"
                        f"{detail}: {selector!r}",
                    )
                )
    return findings


def find_jsx_opening_tag_end(source: str, start: int) -> int:
    quote: str | None = None
    escaped = False
    brace_depth = 0
    for index in range(start, len(source)):
        character = source[index]
        if quote is not None:
            if escaped:
                escaped = False
            elif character == "\\":
                escaped = True
            elif character == quote:
                quote = None
            continue
        if character in {"'", '"', "`"}:
            quote = character
        elif character == "{":
            brace_depth += 1
        elif character == "}":
            brace_depth = max(0, brace_depth - 1)
        elif character == ">" and brace_depth == 0:
            return index
    return len(source) - 1


def call_argument_ranges(code: str, opening_parenthesis: int) -> list[tuple[int, int]]:
    if opening_parenthesis >= len(code) or code[opening_parenthesis] != "(":
        return []
    ranges: list[tuple[int, int]] = []
    start = opening_parenthesis + 1
    parentheses = 1
    braces = 0
    brackets = 0
    for index in range(start, len(code)):
        character = code[index]
        if character == "(":
            parentheses += 1
        elif character == ")":
            parentheses -= 1
            if parentheses == 0:
                if code[start:index].strip() or ranges:
                    ranges.append((start, index))
                return ranges
        elif character == "{":
            braces += 1
        elif character == "}":
            braces = max(0, braces - 1)
        elif character == "[":
            brackets += 1
        elif character == "]":
            brackets = max(0, brackets - 1)
        elif (
            character == ","
            and parentheses == 1
            and braces == 0
            and brackets == 0
        ):
            ranges.append((start, index))
            start = index + 1
    return []


def protected_props_override(
    source: str, code: str, argument_range: tuple[int, int] | None
) -> str | None:
    if argument_range is None:
        return None
    start, end = argument_range
    raw = source[start:end].strip()
    syntax = code[start:end].strip()
    if not syntax or re.fullmatch(r"(?:null|undefined|void\s+0)", syntax):
        return None
    if not syntax.startswith("{"):
        return "an opaque props expression"

    braces = 0
    parentheses = 0
    brackets = 0
    segment_start = 1
    closing = -1
    segments: list[tuple[int, int]] = []
    for index, character in enumerate(syntax):
        if character == "{":
            braces += 1
        elif character == "}":
            braces -= 1
            if braces == 0:
                segments.append((segment_start, index))
                closing = index
                break
        elif character == "(":
            parentheses += 1
        elif character == ")":
            parentheses = max(0, parentheses - 1)
        elif character == "[":
            brackets += 1
        elif character == "]":
            brackets = max(0, brackets - 1)
        elif (
            character == ","
            and braces == 1
            and parentheses == 0
            and brackets == 0
        ):
            segments.append((segment_start, index))
            segment_start = index + 1
    if closing < 0 or syntax[closing + 1 :].strip():
        return "an opaque props expression"

    raw_offset = raw.find("{")
    for item_start, item_end in segments:
        item = syntax[item_start:item_end].strip()
        if not item:
            continue
        if item.startswith("..."):
            return "spread props"
        if item.startswith("["):
            return "a computed props key"
        protected_names = "|".join(
            re.escape(value) for value in PROTECTED_COMPONENT_PROPS
        )
        key_match = re.match(
            rf"(?:(?:get|set|async)\s+)?({protected_names})\b", item
        )
        if key_match:
            return f"{key_match.group(1)} prop"
        raw_item = strip_js_comments(
            raw[raw_offset + item_start : raw_offset + item_end]
        ).strip()
        quoted = re.match(
            rf'''(?:get\s+|set\s+|async\s+)?["']({protected_names})["']\s*(?::|\()''',
            raw_item,
        )
        if quoted:
            return f"{quoted.group(1)} prop"
    return None


def named_import_bindings(clause: str) -> list[tuple[str, str]]:
    match = re.search(r"\{([\s\S]*?)\}", clause)
    if not match:
        return []
    bindings: list[tuple[str, str]] = []
    for raw_item in match.group(1).split(","):
        item = re.sub(r"/\*.*?\*/", "", raw_item, flags=re.DOTALL).strip()
        if not item or item.startswith("type "):
            continue
        parts = re.split(r"\s+as\s+", item)
        imported = parts[0].strip()
        local = parts[-1].strip()
        if re.fullmatch(r"[A-Za-z_$][\w$]*", local):
            bindings.append((imported, local))
    return bindings


def propagate_identifier_aliases(code: str, names: set[str]) -> None:
    changed = True
    assignment = re.compile(
        r"\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*"
        r"([A-Za-z_$][\w$]*)\b"
    )
    while changed:
        changed = False
        for match in assignment.finditer(code):
            if match.group(1) not in names and match.group(2) in names:
                names.add(match.group(1))
                changed = True


def inspect_component_style_overrides(
    target: Path,
    path: Path,
    source: str,
    code: str,
    aliases: dict[str, str],
    namespaces: set[str],
    protected_exports: set[str],
    errors: list[str],
) -> None:
    aliases = dict(aliases)
    component_wrapper_factories: set[str] = set()
    react_objects: set[str] = {"React"}
    for match in STATIC_IMPORT_FROM.finditer(source):
        clause, specifier = match.group(1), match.group(2)
        if specifier != "react":
            continue
        for imported, local in named_import_bindings(clause):
            if imported in {"memo", "forwardRef"}:
                component_wrapper_factories.add(local)
        namespace_match = re.search(r"\*\s+as\s+([A-Za-z_$][\w$]*)", clause)
        if namespace_match:
            react_objects.add(namespace_match.group(1))
        default_match = re.match(r"\s*([A-Za-z_$][\w$]*)\s*(?:,|$)", clause)
        if default_match:
            react_objects.add(default_match.group(1))

    required_react_object = re.compile(
        r'''\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*require\s*\(\s*["']react["']\s*\)'''
    )
    react_objects.update(
        match.group(1) for match in required_react_object.finditer(source)
    )
    required_react_bindings = re.compile(
        r'''\b(?:const|let|var)\s*\{([\s\S]*?)\}\s*=\s*require\s*\(\s*["']react["']\s*\)'''
    )
    for match in required_react_bindings.finditer(source):
        for raw_item in match.group(1).split(","):
            parts = re.split(r"\s*:\s*", raw_item.strip())
            if parts and parts[0] in {"memo", "forwardRef"}:
                component_wrapper_factories.add(parts[-1])
    for react_object in react_objects:
        escaped_object = re.escape(react_object)
        member_alias = re.compile(
            rf"\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*"
            rf"{escaped_object}\s*(?:\.\s*(?:memo|forwardRef)|"
            rf'''\[\s*["'](?:memo|forwardRef)["']\s*\])'''
        )
        component_wrapper_factories.update(
            match.group(1) for match in member_alias.finditer(source)
        )
    propagate_identifier_aliases(code, component_wrapper_factories)

    alias_assignment = re.compile(
        r"\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*"
        r"([A-Za-z_$][\w$]*)\b"
    )
    changed = True
    while changed:
        changed = False
        for match in alias_assignment.finditer(code):
            if match.group(1) not in aliases and match.group(2) in aliases:
                aliases[match.group(1)] = aliases[match.group(2)]
                changed = True
        for factory in component_wrapper_factories:
            wrapper = re.compile(
                rf"\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*"
                rf"{re.escape(factory)}\s*\(\s*"
                rf"([A-Za-z_$][\w$]*(?:\s*\.\s*[A-Za-z_$][\w$]*)?)"
            )
            for match in wrapper.finditer(code):
                compact = re.sub(r"\s+", "", match.group(2))
                base, _, member = compact.partition(".")
                exported = aliases.get(base) if not member else (
                    member if base in namespaces else None
                )
                if exported and match.group(1) not in aliases:
                    aliases[match.group(1)] = exported
                    changed = True
        for react_object in react_objects:
            wrapper = re.compile(
                rf"\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*"
                rf"{re.escape(react_object)}\s*(?:\.\s*(?:memo|forwardRef)|"
                rf'''\[\s*["'](?:memo|forwardRef)["']\s*\])\s*\(\s*'''
                rf"([A-Za-z_$][\w$]*(?:\s*\.\s*[A-Za-z_$][\w$]*)?)"
            )
            for match in wrapper.finditer(source):
                compact = re.sub(r"\s+", "", match.group(2))
                base, _, member = compact.partition(".")
                exported = aliases.get(base) if not member else (
                    member if base in namespaces else None
                )
                if exported and match.group(1) not in aliases:
                    aliases[match.group(1)] = exported
                    changed = True

    references = [
        (re.escape(local), exported)
        for local, exported in aliases.items()
        if exported in protected_exports
    ]
    for namespace in namespaces:
        escaped_namespace = re.escape(namespace)
        references.extend(
            (rf"{escaped_namespace}\s*\.\s*{re.escape(exported)}", exported)
            for exported in protected_exports
        )
    relative = path.relative_to(target).as_posix()
    seen: set[tuple[int, str, str]] = set()

    def report(
        offset: int,
        exported: str,
        reason: str,
        syntax: str,
        code_name: str = "PUI_COMPONENT_STYLE_OVERRIDE",
    ) -> None:
        line = source_line(source, offset)
        key = (line, exported, code_name)
        if key in seen:
            return
        seen.add(key)
        if code_name == "PUI_EXTERNAL_STYLE":
            errors.append(
                f"{relative}:{line} [{code_name}] {syntax} around {exported} "
                f"uses {reason}, which can replace bundled component styles"
            )
        else:
            errors.append(
                f"{relative}:{line} [{code_name}] {syntax} for {exported} "
                f"uses {reason}, which bypasses bundled component appearance "
                "or ownership"
            )

    for reference, exported in references:
        pattern = re.compile(rf"<\s*{reference}(?=[\s/>])")
        for match in pattern.finditer(code):
            end = find_jsx_opening_tag_end(source, match.start())
            opening_code = code[match.start() : end + 1]
            offending = []
            for prop_name in PROTECTED_COMPONENT_PROPS:
                if re.search(rf"\b{re.escape(prop_name)}\s*=", opening_code):
                    offending.append(prop_name)
            if re.search(r"\{\s*\.\.\.", opening_code):
                offending.append("spread props")
            if not offending:
                continue
            report(
                match.start(),
                exported,
                ", ".join(offending),
                "JSX",
            )

    element_factories = {"createElement"}
    runtime_factories: set[str] = set()
    runtime_namespaces: set[str] = set()
    for match in STATIC_IMPORT_FROM.finditer(source):
        clause, specifier = match.group(1), match.group(2)
        if specifier == "react":
            for imported, local in named_import_bindings(clause):
                if imported == "createElement":
                    element_factories.add(local)
        elif specifier in {"react/jsx-runtime", "react/jsx-dev-runtime"}:
            for imported, local in named_import_bindings(clause):
                if imported in {"jsx", "jsxs", "jsxDEV"}:
                    runtime_factories.add(local)
            namespace_match = re.search(r"\*\s+as\s+([A-Za-z_$][\w$]*)", clause)
            if namespace_match:
                runtime_namespaces.add(namespace_match.group(1))

    required_react = re.compile(
        r'''\b(?:const|let|var)\s*\{([\s\S]*?)\}\s*=\s*require\s*\(\s*["']react["']\s*\)'''
    )
    for match in required_react.finditer(source):
        for raw_item in match.group(1).split(","):
            parts = re.split(r"\s*:\s*", raw_item.strip())
            if parts and parts[0] == "createElement":
                element_factories.add(parts[-1])
    required_runtime = re.compile(
        r'''\b(?:const|let|var)\s*(\{[\s\S]*?\}|[A-Za-z_$][\w$]*)\s*=\s*require\s*\(\s*["']react/jsx(?:-dev)?-runtime["']\s*\)'''
    )
    for match in required_runtime.finditer(source):
        binding = match.group(1)
        if binding.startswith("{"):
            for raw_item in binding[1:-1].split(","):
                parts = re.split(r"\s*:\s*", raw_item.strip())
                if parts and parts[0] in {"jsx", "jsxs", "jsxDEV"}:
                    runtime_factories.add(parts[-1])
        else:
            runtime_namespaces.add(binding)

    for match in re.finditer(
        r"\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*"
        r"React\s*\.\s*createElement\b",
        code,
    ):
        element_factories.add(match.group(1))
    propagate_identifier_aliases(code, element_factories)
    propagate_identifier_aliases(code, runtime_factories)

    def resolve_export(reference: str) -> str | None:
        compact = re.sub(r"\s+", "", reference)
        base, _, member = compact.partition(".")
        if not member:
            exported = aliases.get(base)
            return exported if exported in protected_exports else None
        if base in namespaces and member in protected_exports:
            return member
        return None

    styled_factories: set[str] = set()
    styled_namespaces: set[str] = set()
    for match in STATIC_IMPORT_FROM.finditer(source):
        clause, specifier = match.group(1), match.group(2)
        if specifier not in CSS_IN_JS_PACKAGES:
            continue
        for imported, local in named_import_bindings(clause):
            if imported in {"styled", "default"}:
                styled_factories.add(local)
        namespace_match = re.search(r"\*\s+as\s+([A-Za-z_$][\w$]*)", clause)
        if namespace_match:
            styled_namespaces.add(namespace_match.group(1))
        if specifier in {"styled-components", "@emotion/styled"}:
            default_match = re.match(
                r"\s*([A-Za-z_$][\w$]*)\s*(?:,|$)", clause
            )
            if default_match:
                styled_factories.add(default_match.group(1))

    css_in_js_package_pattern = "|".join(
        re.escape(value) for value in sorted(CSS_IN_JS_PACKAGES, key=len, reverse=True)
    )
    required_css_in_js = re.compile(
        rf'''\b(?:const|let|var)\s+(\{{[\s\S]*?\}}|[A-Za-z_$][\w$]*)\s*=\s*require\s*\(\s*["']({css_in_js_package_pattern})["']\s*\)(\s*\.\s*default)?'''
    )
    for match in required_css_in_js.finditer(source):
        binding, specifier, default_member = match.groups()
        if binding.startswith("{"):
            for raw_item in binding[1:-1].split(","):
                parts = re.split(r"\s*:\s*", raw_item.strip())
                if parts and parts[0] in {"styled", "default"}:
                    styled_factories.add(parts[-1])
        elif default_member or specifier in {"styled-components", "@emotion/styled"}:
            styled_factories.add(binding)
        else:
            styled_namespaces.add(binding)
    propagate_identifier_aliases(code, styled_factories)

    styled_patterns: list[tuple[re.Pattern[str], str]] = []
    for factory in styled_factories:
        styled_patterns.append(
            (
                re.compile(
                    rf"(?<![\w$.]){re.escape(factory)}\s*\(\s*"
                    r"([A-Za-z_$][\w$]*(?:\s*\.\s*[A-Za-z_$][\w$]*)?)"
                ),
                factory,
            )
        )
    for namespace in styled_namespaces:
        styled_patterns.append(
            (
                re.compile(
                    rf"\b{re.escape(namespace)}\s*\.\s*(?:styled|default)\s*\(\s*"
                    r"([A-Za-z_$][\w$]*(?:\s*\.\s*[A-Za-z_$][\w$]*)?)"
                ),
                f"{namespace}.styled",
            )
        )
    for pattern, syntax in styled_patterns:
        for match in pattern.finditer(code):
            exported = resolve_export(match.group(1))
            if exported:
                report(
                    match.start(),
                    exported,
                    "a styled-components/Emotion wrapper",
                    syntax,
                    "PUI_EXTERNAL_STYLE",
                )

    def inspect_invocation(
        reference: str,
        opening_parenthesis: int,
        props_index: int,
        syntax: str,
    ) -> None:
        exported = resolve_export(reference)
        if not exported:
            return
        ranges = call_argument_ranges(code, opening_parenthesis)
        argument_range = ranges[props_index] if len(ranges) > props_index else None
        reason = protected_props_override(source, code, argument_range)
        if reason:
            offset = argument_range[0] if argument_range else opening_parenthesis
            report(offset, exported, reason, syntax)

    reference_pattern = r"([A-Za-z_$][\w$]*(?:\s*\.\s*[A-Za-z_$][\w$]*)?)"
    direct_references = [reference for reference, _exported in references]
    for reference in direct_references:
        direct_call = re.compile(rf"(?<![\w$.])({reference})\s*(\()")
        for match in direct_call.finditer(code):
            inspect_invocation(match.group(1), match.start(2), 0, "direct call")

    factory_names = sorted(element_factories, key=len, reverse=True)
    factory_prefix = "|".join(re.escape(name) for name in factory_names)
    factory_patterns = [
        re.compile(
            rf"(?<![\w$])(?:React\s*\.\s*)?(?:{factory_prefix})\s*(\()\s*{reference_pattern}"
        ),
        re.compile(
            rf'''(?<![\w$])React\s*\[\s*["']createElement["']\s*\]\s*(\()\s*{reference_pattern}'''
        ),
    ]
    for pattern in factory_patterns:
        for match in pattern.finditer(code):
            inspect_invocation(match.group(2), match.start(1), 1, "createElement")

    if runtime_factories:
        runtime_prefix = "|".join(
            re.escape(name) for name in sorted(runtime_factories, key=len, reverse=True)
        )
        runtime_call = re.compile(
            rf"(?<![\w$])(?:{runtime_prefix})\s*(\()\s*{reference_pattern}"
        )
        for match in runtime_call.finditer(code):
            inspect_invocation(match.group(2), match.start(1), 1, "JSX runtime")
    for namespace in runtime_namespaces:
        runtime_call = re.compile(
            rf"(?<![\w$]){re.escape(namespace)}\s*\.\s*"
            rf"(?:jsx|jsxs|jsxDEV)\s*(\()\s*{reference_pattern}"
        )
        for match in runtime_call.finditer(code):
            inspect_invocation(match.group(2), match.start(1), 1, "JSX runtime")


def style_specifier_path(specifier: str) -> str:
    return specifier.strip().replace("\\", "/").split("?", 1)[0].split("#", 1)[0]


def is_style_specifier(specifier: str) -> bool:
    return Path(style_specifier_path(specifier)).suffix.lower() in STYLE_SUFFIXES


def is_local_style_specifier(specifier: str) -> bool:
    value = specifier.strip().replace("\\", "/")
    return value.startswith((".", "/", "@/", "~/", "src/"))


def is_remote_style_specifier(specifier: str) -> bool:
    value = specifier.strip()
    return bool(
        re.match(r"^(?:https?:)?//", value, re.IGNORECASE)
        or re.match(r"^(?:data|javascript):", value, re.IGNORECASE)
    )


def script_external_style_findings(
    text: str, mask: list[bool]
) -> list[tuple[int, str]]:
    findings: list[tuple[int, str]] = []
    seen: set[tuple[int, str]] = set()
    for pattern in (STATIC_IMPORT, DYNAMIC_IMPORT, REQUIRE_IMPORT):
        for match in pattern.finditer(text):
            if not mask[match.start()]:
                continue
            specifier = match.group(1)
            if not is_style_specifier(specifier) or is_local_style_specifier(specifier):
                continue
            key = (match.start(), specifier)
            if key in seen:
                continue
            seen.add(key)
            findings.append((source_line(text, match.start()), specifier))
    return findings


def stylesheet_directive_findings(
    text: str, *, line_comments: bool
) -> list[tuple[int, str]]:
    mask = code_position_mask(text, line_comments=line_comments)
    findings: list[tuple[int, str]] = []
    for match in CSS_IMPORT.finditer(text):
        if not mask[match.start()]:
            continue
        specifier = match.group(1) or match.group(2)
        if specifier and not is_local_style_specifier(specifier):
            findings.append((source_line(text, match.start()), specifier))
    return findings


def html_literal_attribute(tag: str, attribute: str) -> str | None:
    escaped = re.escape(attribute)
    match = re.search(
        rf"\b{escaped}\s*=\s*(?:\"([^\"]*)\"|'([^']*)'|"
        rf'''\{{\s*["']([^"']*)["']\s*\}}|([^\s>]+))''',
        tag,
        re.IGNORECASE,
    )
    if not match:
        return None
    return (
        match.group(1)
        or match.group(2)
        or match.group(3)
        or match.group(4)
        or ""
    )


def html_external_stylesheet_findings(text: str) -> list[tuple[int, str]]:
    clean = HTML_COMMENT.sub(
        lambda match: "\n" * match.group(0).count("\n"), text
    )
    findings: list[tuple[int, str]] = []
    for match in HTML_LINK_TAG.finditer(clean):
        tag = match.group(0)
        rel = html_literal_attribute(tag, "rel")
        resource_type = html_literal_attribute(tag, "as")
        href = html_literal_attribute(tag, "href")
        if (
            (
                (rel and "stylesheet" in {token.lower() for token in rel.split()})
                or (resource_type and resource_type.lower() == "style")
            )
            and href
            and is_remote_style_specifier(href)
        ):
            findings.append((source_line(clean, match.start()), href))
    return findings


def jsx_external_stylesheet_findings(
    source: str, code: str
) -> list[tuple[int, str]]:
    findings: list[tuple[int, str]] = []
    for match in re.finditer(r"<\s*link(?=[\s>])", code, re.IGNORECASE):
        end = find_jsx_opening_tag_end(source, match.start())
        opening = source[match.start() : end + 1]
        rel = html_literal_attribute(opening, "rel")
        resource_type = html_literal_attribute(opening, "as")
        href = html_literal_attribute(opening, "href")
        if (
            (
                (rel and "stylesheet" in {token.lower() for token in rel.split()})
                or (resource_type and resource_type.lower() == "style")
            )
            and href
            and is_remote_style_specifier(href)
        ):
            findings.append((source_line(source, match.start()), href))
    return findings


def react_clone_element_findings(
    source: str, code: str
) -> list[tuple[str, int, str]]:
    """Reject React cloning because merged props cannot be proven component-owned."""
    findings: list[tuple[str, int, str]] = []
    seen: set[int] = set()
    source_mask = code_position_mask(source)
    react_objects: set[str] = {"React"}
    clone_factories: set[str] = set()

    def add(offset: int, syntax: str) -> None:
        line = source_line(source, offset)
        if line in seen:
            return
        seen.add(line)
        findings.append(
            (
                "PUI_UNINSPECTABLE_PROPS",
                line,
                f"{syntax} can merge uninspectable props into a Personal UI "
                "component and is forbidden",
            )
        )

    for match in STATIC_IMPORT_FROM.finditer(source):
        if match.group(2) != "react" or not source_mask[match.start()]:
            continue
        clause = match.group(1)
        for imported, local in named_import_bindings(clause):
            if imported == "cloneElement":
                clone_factories.add(local)
                add(match.start(), f"React cloneElement import {local}")
        namespace_match = re.search(r"\*\s+as\s+([A-Za-z_$][\w$]*)", clause)
        if namespace_match:
            react_objects.add(namespace_match.group(1))
        default_match = re.match(r"\s*([A-Za-z_$][\w$]*)\s*(?:,|$)", clause)
        if default_match:
            react_objects.add(default_match.group(1))

    required_object = re.compile(
        r'''\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*require\s*\(\s*["']react["']\s*\)'''
    )
    react_objects.update(
        match.group(1)
        for match in required_object.finditer(source)
        if source_mask[match.start()]
    )
    required_bindings = re.compile(
        r'''\b(?:const|let|var)\s*\{([\s\S]*?)\}\s*=\s*require\s*\(\s*["']react["']\s*\)'''
    )
    for match in required_bindings.finditer(source):
        if not source_mask[match.start()]:
            continue
        for raw_item in match.group(1).split(","):
            parts = re.split(r"\s*:\s*", raw_item.strip())
            if parts and parts[0] == "cloneElement":
                clone_factories.add(parts[-1])
                add(match.start(), f"React cloneElement require binding {parts[-1]}")

    propagate_identifier_aliases(code, react_objects)
    for react_object in tuple(react_objects):
        destructured = re.compile(
            rf"\b(?:const|let|var)\s*\{{([\s\S]*?)\}}\s*=\s*"
            rf"{re.escape(react_object)}\b"
        )
        for match in destructured.finditer(source):
            if not source_mask[match.start()]:
                continue
            for raw_item in match.group(1).split(","):
                parts = re.split(r"\s*:\s*", raw_item.strip())
                if parts and parts[0] == "cloneElement":
                    clone_factories.add(parts[-1])
                    add(match.start(), f"{react_object}.cloneElement binding")
        member = re.compile(
            rf"\b{re.escape(react_object)}\s*(?:\.\s*cloneElement|"
            rf'''\[\s*["']cloneElement["']\s*\])'''
        )
        for match in member.finditer(source):
            if source_mask[match.start()]:
                add(match.start(), f"{react_object}.cloneElement")

    direct_require = re.compile(
        r'''\brequire\s*\(\s*["']react["']\s*\)\s*(?:\.\s*cloneElement|\[\s*["']cloneElement["']\s*\])'''
    )
    for match in direct_require.finditer(source):
        if source_mask[match.start()]:
            add(match.start(), "require('react').cloneElement")

    propagate_identifier_aliases(code, clone_factories)
    for factory in clone_factories:
        call = re.compile(rf"(?<![\w$.]){re.escape(factory)}\s*\(")
        for match in call.finditer(code):
            add(match.start(), f"React cloneElement alias {factory}")
    return findings


def dynamic_style_findings(source: str, code: str) -> list[tuple[str, int, str]]:
    """Find explicit DOM and CSSOM appearance mutations without matching data fields."""
    findings: list[tuple[str, int, str]] = []
    seen: set[tuple[str, int]] = set()
    source_mask = code_position_mask(source)

    def add(offset: int, message: str, code_name: str = "PUI_DYNAMIC_STYLE") -> None:
        line = source_line(source, offset)
        key = (code_name, line)
        if key in seen:
            return
        seen.add(key)
        findings.append((code_name, line, message))

    dom_names: set[str] = set()
    dom_refs: set[str] = set()
    sheet_names: set[str] = set()

    dom_type = (
        r"(?:HTMLElement|HTML[A-Za-z0-9_$]*Element|SVGElement|Element|"
        r"Node|EventTarget|CSSStyleDeclaration)"
    )
    for match in re.finditer(
        rf"\b([A-Za-z_$][\w$]*)\s*:\s*{dom_type}\b", code
    ):
        dom_names.add(match.group(1))
    for match in re.finditer(
        r"\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)[^=;\n]*=\s*"
        r"document\s*\.\s*(?:body|head|documentElement|"
        r"querySelector(?:All)?\s*\(|getElementById\s*\(|"
        r"getElementsBy(?:ClassName|Name|TagName)\s*\(|createElement\s*\()",
        code,
    ):
        dom_names.add(match.group(1))
    for match in re.finditer(
        r"\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)[^=;\n]*=\s*"
        r"[A-Za-z_$][\w$]*\s*\.\s*(?:currentTarget|target)\b",
        code,
    ):
        dom_names.add(match.group(1))
    for match in re.finditer(
        r"\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)[^=;\n]*=\s*"
        r"(?:React\s*\.\s*)?useRef\s*(?:<[^;\n>]+>)?\s*\(",
        code,
    ):
        dom_refs.add(match.group(1))
    for match in re.finditer(
        r"\bref\s*=\s*\{\s*(?:\(\s*)?([A-Za-z_$][\w$]*)\b", code
    ):
        dom_names.add(match.group(1))
    for match in re.finditer(
        r"querySelectorAll\s*\([^;\n]*?\)\s*\.\s*forEach\s*\(\s*"
        r"(?:\(\s*)?([A-Za-z_$][\w$]*)\b",
        code,
    ):
        dom_names.add(match.group(1))

    changed = True
    assignment = re.compile(
        r"\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)[^=;\n]*=\s*"
        r"([A-Za-z_$][\w$]*)\b"
    )
    while changed:
        changed = False
        for match in assignment.finditer(code):
            destination, origin = match.groups()
            if origin in dom_names and destination not in dom_names:
                dom_names.add(destination)
                changed = True
            if origin in dom_refs and destination not in dom_refs:
                dom_refs.add(destination)
                changed = True

    for match in re.finditer(
        r"\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)[^=;\n]*=\s*"
        r"(?:new\s+CSSStyleSheet\b|document\s*\.\s*styleSheets\b)",
        code,
    ):
        sheet_names.add(match.group(1))
    for match in re.finditer(
        r"\b([A-Za-z_$][\w$]*)\s*:\s*CSSStyleSheet\b", code
    ):
        sheet_names.add(match.group(1))
    propagate_identifier_aliases(code, sheet_names)

    explicit_patterns: list[tuple[re.Pattern[str], str]] = [
        (
            re.compile(
                r"(?:\.\s*classList|\[\s*[\"']classList[\"']\s*\])\s*"
                r"(?:\.\s*|\[\s*[\"'])(?:add|remove|toggle|replace)"
                r"(?:[\"']\s*\])?\s*\(",
                re.IGNORECASE,
            ),
            "DOM classList mutation is forbidden; use Personal UI props or state",
        ),
        (
            re.compile(
                r"(?:\.\s*style|\[\s*[\"']style[\"']\s*\])\s*"
                r"(?:\.\s*|\[\s*[\"'])setProperty(?:[\"']\s*\])?\s*\(",
                re.IGNORECASE,
            ),
            "CSSStyleDeclaration.setProperty is forbidden; use Personal UI props or tokens",
        ),
        (
            re.compile(
                r"\bsetAttribute\s*\(\s*[\"'](?:class|className|style)[\"']\s*,",
                re.IGNORECASE,
            ),
            "setAttribute cannot mutate class or style outside Personal UI ownership",
        ),
        (
            re.compile(r"\.\s*(?:insertRule|deleteRule)\s*\(", re.IGNORECASE),
            "CSSStyleSheet rule mutation is forbidden",
        ),
        (
            re.compile(r"\badoptedStyleSheets\b"),
            "adoptedStyleSheets can replace application styling and is forbidden",
        ),
        (
            re.compile(r"\bnew\s+CSSStyleSheet\s*\("),
            "constructing a CSSStyleSheet for runtime style injection is forbidden",
        ),
        (
            re.compile(
                r'''\bdocument\s*\.\s*createElement\s*\(\s*["'](?:style|link)["']''',
                re.IGNORECASE,
            ),
            "document.createElement cannot construct runtime style or link elements",
        ),
    ]
    for pattern, message in explicit_patterns:
        for match in pattern.finditer(source):
            if source_mask[match.start()]:
                add(match.start(), message)

    assignment_operator = r"(?:\+=|-=|\*=|/=|%=|\|\|=|&&=|\?\?=|=(?!=))"
    member = lambda name: (  # noqa: E731 - concise regex fragment builder
        rf"(?:\s*(?:\?\.|\.)\s*{name}|\s*\[\s*[\"']{name}[\"']\s*\])"
    )
    receiver_parts = [
        r"document\s*\.\s*(?:body|head|documentElement)",
        r"document\s*\.\s*(?:querySelector(?:All)?|getElementById|"
        r"getElementsBy(?:ClassName|Name|TagName)|createElement)\s*\([^;\n]*?\)",
        r"[A-Za-z_$][\w$]*\s*\.\s*(?:currentTarget|target)",
        r"[A-Za-z_$][\w$]*Ref\s*(?:\?\.|\.)\s*current",
    ]
    receiver_parts.extend(re.escape(value) for value in sorted(dom_names))
    receiver_parts.extend(
        rf"{re.escape(value)}\s*(?:\?\.|\.)\s*current"
        for value in sorted(dom_refs)
    )
    if receiver_parts:
        receiver = rf"(?<![\w$])(?:{'|'.join(receiver_parts)})(?![\w$])"
        mutation_patterns = [
            (
                re.compile(
                    receiver
                    + member("style")
                    + rf"(?:{member(r'[A-Za-z_$][\w$-]*')})?\s*"
                    + assignment_operator
                ),
                "DOM style property assignment is forbidden; use Personal UI props or tokens",
            ),
            (
                re.compile(
                    receiver + member("className") + r"\s*" + assignment_operator
                ),
                "DOM className assignment is forbidden; use component-owned classes",
            ),
        ]
        for pattern, message in mutation_patterns:
            for match in pattern.finditer(source):
                if source_mask[match.start()]:
                    add(match.start(), message)

    sheet_receivers = [
        r"document\s*\.\s*styleSheets(?:\s*\[[^\]]+\])?",
        *[re.escape(value) for value in sorted(sheet_names)],
    ]
    sheet_replace = re.compile(
        rf"(?<![\w$])(?:{'|'.join(sheet_receivers)})(?![\w$])"
        r"\s*\.\s*(?:replaceSync|replace)\s*\("
    )
    for match in sheet_replace.finditer(code):
        add(match.start(), "CSSStyleSheet replace is forbidden")

    return findings


def normalized_import(specifier: str) -> str:
    value = specifier.replace("\\", "/").split("?", 1)[0].split("#", 1)[0].rstrip("/")
    return re.sub(r"\.(?:ts|tsx|js|jsx|mts|cts|mjs|cjs)$", "", value)


def code_position_mask(text: str, *, line_comments: bool = True) -> list[bool]:
    mask = [True] * len(text)
    index = 0
    quote: str | None = None
    escaped = False
    while index < len(text):
        character = text[index]
        following = text[index + 1] if index + 1 < len(text) else ""
        if quote is not None:
            mask[index] = False
            if escaped:
                escaped = False
            elif character == "\\":
                escaped = True
            elif character == quote:
                quote = None
            index += 1
            continue
        if character in {"'", '"', "`"}:
            quote = character
            mask[index] = False
            index += 1
            continue
        if character == "/" and following == "*":
            mask[index] = mask[index + 1] = False
            index += 2
            while index < len(text):
                mask[index] = False
                if (
                    text[index] == "*"
                    and index + 1 < len(text)
                    and text[index + 1] == "/"
                ):
                    mask[index + 1] = False
                    index += 2
                    break
                index += 1
            continue
        if line_comments and character == "/" and following == "/":
            while index < len(text) and text[index] not in "\r\n":
                mask[index] = False
                index += 1
            continue
        index += 1
    return mask


def regex_specifiers(
    pattern: re.Pattern[str], text: str, mask: list[bool]
) -> list[str]:
    return [match.group(1) for match in pattern.finditer(text) if mask[match.start()]]


def masked_code(text: str, mask: list[bool]) -> str:
    return "".join(
        character if mask[index] else "\n" if character == "\n" else " "
        for index, character in enumerate(text)
    )


def runtime_import_aliases(
    clause: str, registered_exports: set[str]
) -> tuple[dict[str, str], str | None]:
    aliases: dict[str, str] = {}
    namespace_match = re.search(r"\*\s+as\s+([A-Za-z_$][\w$]*)", clause)
    namespace = namespace_match.group(1) if namespace_match else None
    named_match = re.search(r"\{([\s\S]*?)\}", clause)
    if not named_match:
        return aliases, namespace
    for raw_item in named_match.group(1).split(","):
        item = re.sub(r"/\*.*?\*/", "", raw_item, flags=re.DOTALL).strip()
        if not item or item.startswith("type "):
            continue
        parts = re.split(r"\s+as\s+", item)
        imported = parts[0].strip()
        local = parts[-1].strip()
        if imported in registered_exports and re.fullmatch(r"[A-Za-z_$][\w$]*", local):
            aliases[local] = imported
    return aliases, namespace


def runtime_usages(
    code: str,
    aliases: dict[str, str],
    namespaces: set[str],
    registered_exports: set[str],
) -> set[str]:
    used: set[str] = set()
    for local, exported in aliases.items():
        escaped = re.escape(local)
        if (
            re.search(rf"<\s*{escaped}(?=[\s/>.])", code)
            or re.search(rf"\b{escaped}\s*\(", code)
            or re.search(rf"\bcreateElement\s*\(\s*{escaped}\b", code)
        ):
            used.add(exported)
    for namespace in namespaces:
        escaped_namespace = re.escape(namespace)
        for exported in registered_exports:
            escaped_export = re.escape(exported)
            if (
                re.search(rf"<\s*{escaped_namespace}\s*\.\s*{escaped_export}(?=[\s/>])", code)
                or re.search(rf"\b{escaped_namespace}\s*\.\s*{escaped_export}\s*\(", code)
                or re.search(
                    rf"\bcreateElement\s*\(\s*{escaped_namespace}\s*\.\s*{escaped_export}\b",
                    code,
                )
            ):
                used.add(exported)
    return used


def load_typescript_aliases(target: Path) -> list[tuple[str, list[Path]]]:
    aliases: list[tuple[str, list[Path]]] = []
    for config_name in ("tsconfig.json", "tsconfig.app.json"):
        config_path = target / config_name
        if not config_path.is_file():
            continue
        try:
            text = strip_js_comments(config_path.read_text(encoding="utf-8"))
            value = json.loads(re.sub(r",\s*([}\]])", r"\1", text))
        except (OSError, UnicodeDecodeError, json.JSONDecodeError):
            continue
        compiler_options = (
            value.get("compilerOptions") if isinstance(value, dict) else None
        )
        if not isinstance(compiler_options, dict):
            continue
        base_url = compiler_options.get("baseUrl", ".")
        paths = compiler_options.get("paths", {})
        if not isinstance(base_url, str) or not isinstance(paths, dict):
            continue
        base = config_path.parent / base_url
        for alias, replacements in paths.items():
            if not isinstance(alias, str) or not isinstance(replacements, list):
                continue
            candidates = [base / item for item in replacements if isinstance(item, str)]
            if candidates:
                aliases.append((alias, candidates))
    return aliases


def module_candidates(
    importer: Path,
    specifier: str,
    target: Path,
    aliases: list[tuple[str, list[Path]]],
) -> list[Path]:
    value = normalized_import(specifier)
    if value.startswith("."):
        return [importer.parent / value]
    if value.startswith("/"):
        return [target / value.lstrip("/")]
    if value.startswith("src/"):
        return [target / value]
    candidates: list[Path] = []
    for alias, replacements in aliases:
        if "*" in alias:
            prefix, suffix = alias.split("*", 1)
            if not value.startswith(prefix) or not value.endswith(suffix):
                continue
            wildcard = value[len(prefix) : len(value) - len(suffix) if suffix else None]
            candidates.extend(
                Path(str(replacement).replace("*", wildcard))
                for replacement in replacements
            )
        elif value == alias:
            candidates.extend(replacements)
    return candidates


def path_matches(candidate: Path, expected: Path, *, allow_index: bool = False) -> bool:
    candidate_value = candidate.resolve(strict=False)
    expected_value = expected.resolve(strict=False)
    if candidate_value == expected_value:
        return True
    return allow_index and candidate_value == (expected_value / "index").resolve(
        strict=False
    )


def is_inside(path: Path, parent: Path) -> bool:
    try:
        path.relative_to(parent)
        return True
    except ValueError:
        return False


def resolve_application_modules(
    candidates: list[Path], known_paths: set[Path]
) -> set[Path]:
    resolved: set[Path] = set()
    for candidate in candidates:
        variants = [candidate]
        if candidate.suffix.lower() not in SCRIPT_SUFFIXES | STYLE_SUFFIXES:
            variants.extend(Path(f"{candidate}{suffix}") for suffix in SCRIPT_SUFFIXES)
            variants.extend(Path(f"{candidate}{suffix}") for suffix in STYLE_SUFFIXES)
            variants.extend(candidate / f"index{suffix}" for suffix in SCRIPT_SUFFIXES)
            variants.extend(candidate / f"index{suffix}" for suffix in STYLE_SUFFIXES)
        for variant in variants:
            normalized = variant.resolve(strict=False)
            if normalized in known_paths:
                resolved.add(normalized)
    return resolved


def discover_application_entrypoints(
    target: Path,
    application_source: Path,
    known_paths: set[Path],
    aliases: list[tuple[str, list[Path]]],
) -> set[Path]:
    entrypoints: set[Path] = set()
    index_path = target / "index.html"
    if index_path.is_file() and not is_link_like(index_path):
        try:
            html = HTML_COMMENT.sub("", index_path.read_text(encoding="utf-8"))
        except (OSError, UnicodeDecodeError):
            html = ""
        for specifier in HTML_SCRIPT_SOURCE.findall(html):
            entrypoints.update(
                resolve_application_modules(
                    module_candidates(index_path, specifier, target, aliases),
                    known_paths,
                )
            )

    for stem in ("main", "index", "root"):
        for suffix in SCRIPT_SUFFIXES:
            candidate = (application_source / f"{stem}{suffix}").resolve(strict=False)
            if candidate in known_paths:
                entrypoints.add(candidate)

    package_path = target / "package.json"
    if package_path.is_file() and not is_link_like(package_path):
        try:
            package = read_json_object(package_path, label="package.json")
        except (OSError, UnicodeDecodeError, json.JSONDecodeError, ValueError):
            package = {}
        for field in ("source", "browser", "module", "main"):
            value = package.get(field)
            if not isinstance(value, str):
                continue
            entrypoints.update(
                resolve_application_modules(
                    module_candidates(package_path, value, target, aliases),
                    known_paths,
                )
            )

    route_names = {"page", "layout", "route", "template", "loading", "error", "not-found"}
    for path in known_paths:
        try:
            relative = path.relative_to(application_source.resolve(strict=False))
        except ValueError:
            continue
        if relative.parts and relative.parts[0] == "app" and path.stem in route_names:
            entrypoints.add(path)
        elif relative.parts and relative.parts[0] == "pages":
            if not path.name.endswith((".test.ts", ".test.tsx", ".spec.ts", ".spec.tsx")):
                entrypoints.add(path)
    return entrypoints


def reachable_modules(
    entrypoints: set[Path], edges: dict[Path, set[Path]]
) -> set[Path]:
    reachable: set[Path] = set()
    pending = list(entrypoints)
    while pending:
        path = pending.pop()
        if path in reachable:
            continue
        reachable.add(path)
        pending.extend(edges.get(path, set()) - reachable)
    return reachable


def inspect_application_usage(
    target: Path,
    source_root: Path,
    style_entry: str,
    registered_exports: set[str],
    style_protected_exports: set[str],
    errors: list[str],
) -> tuple[bool, int, list[str]]:
    application_source = target / "src"
    used_components: set[str] = set()
    style_path = target / style_entry.replace("\\", "/")
    aliases = load_typescript_aliases(target)
    script_records: dict[Path, tuple[str, str, list[bool]]] = {}
    import_specifiers: dict[Path, list[str]] = {}
    direct_aliases: dict[Path, dict[str, str]] = {}
    namespaces: dict[Path, set[str]] = {}

    if not application_source.is_dir():
        return False, 0, []
    for path in target.rglob("*"):
        if not path.is_file() or is_inside(path, source_root):
            continue
        relative = path.relative_to(target)
        if any(
            part in IGNORED_APPLICATION_DIRECTORIES
            or part.startswith(".personal-ui-stage-")
            for part in relative.parts
        ):
            continue
        suffix = path.suffix.lower()
        if suffix not in SCRIPT_SUFFIXES | STYLE_SUFFIXES | HTML_SUFFIXES:
            continue
        try:
            raw_text = path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError) as error:
            errors.append(f"cannot inspect application file {path}: {error}")
            continue
        if suffix in STYLE_SUFFIXES:
            for code, line, message in application_style_findings(raw_text, suffix):
                errors.append(
                    f"{relative.as_posix()}:{line} [{code}] {message}"
                )
            for line, specifier in stylesheet_directive_findings(
                raw_text,
                line_comments=suffix in {".scss", ".sass", ".less"},
            ):
                errors.append(
                    f"{relative.as_posix()}:{line} [PUI_EXTERNAL_STYLE] "
                    f"external stylesheet directive is forbidden: {specifier!r}"
                )
        elif suffix in HTML_SUFFIXES:
            html_text = HTML_COMMENT.sub("", raw_text)
            for match in HTML_STYLE_BLOCK.finditer(html_text):
                base_line = source_line(html_text, match.start(1)) - 1
                for code, line, message in application_style_findings(match.group(1)):
                    errors.append(
                        f"{relative.as_posix()}:{base_line + line} [{code}] {message}"
                    )
                for line, specifier in stylesheet_directive_findings(
                    match.group(1), line_comments=False
                ):
                    errors.append(
                        f"{relative.as_posix()}:{base_line + line} "
                        f"[PUI_EXTERNAL_STYLE] external stylesheet directive is "
                        f"forbidden: {specifier!r}"
                    )
            for line, specifier in html_external_stylesheet_findings(raw_text):
                errors.append(
                    f"{relative.as_posix()}:{line} [PUI_EXTERNAL_STYLE] "
                    f"remote stylesheet link is forbidden: {specifier!r}"
                )
        elif suffix in SCRIPT_SUFFIXES:
            comment_free_text = strip_js_comments(raw_text)
            if (
                CSS_IN_SCRIPT_SELECTOR.search(comment_free_text)
                or CSS_IN_SCRIPT_OBJECT_SELECTOR.search(comment_free_text)
            ):
                errors.append(
                    f"application CSS-in-JS reaches into a Personal UI internal selector: {path}"
                )
            script_mask = code_position_mask(raw_text)
            for line, specifier in script_external_style_findings(
                raw_text, script_mask
            ):
                errors.append(
                    f"{relative.as_posix()}:{line} [PUI_EXTERNAL_STYLE] "
                    f"external stylesheet import is forbidden: {specifier!r}"
                )
            script_code = masked_code(raw_text, script_mask)
            for line, specifier in jsx_external_stylesheet_findings(
                raw_text, script_code
            ):
                errors.append(
                    f"{relative.as_posix()}:{line} [PUI_EXTERNAL_STYLE] "
                    f"remote JSX stylesheet link is forbidden: {specifier!r}"
                )

        if not is_inside(path, application_source):
            continue
        if suffix in SCRIPT_SUFFIXES:
            mask = code_position_mask(raw_text)
            code = masked_code(raw_text, mask)
            normalized_path = path.resolve(strict=False)
            script_records[normalized_path] = (raw_text, code, mask)
            for code_name, line, message in (
                react_clone_element_findings(raw_text, code)
                + dynamic_style_findings(raw_text, code)
            ):
                errors.append(
                    f"{relative.as_posix()}:{line} [{code_name}] {message}"
                )
            if NATIVE_SELECT_JSX.search(code):
                errors.append(
                    f"application renders a native <select> instead of Personal UI Select/Combobox: {path}"
                )
            specifiers = (
                regex_specifiers(STATIC_IMPORT, raw_text, mask)
                + regex_specifiers(DYNAMIC_IMPORT, raw_text, mask)
                + regex_specifiers(REEXPORT_FROM, raw_text, mask)
            )
        elif suffix in STYLE_SUFFIXES:
            mask = code_position_mask(
                raw_text, line_comments=suffix in {".scss", ".sass", ".less"}
            )
            specifiers = [
                match.group(1) or match.group(2)
                for match in CSS_IMPORT.finditer(raw_text)
                if mask[match.start()]
            ]
        else:
            html_text = HTML_COMMENT.sub("", raw_text)
            if NATIVE_SELECT_HTML.search(html_text):
                errors.append(
                    f"application renders a native <select> instead of Personal UI Select/Combobox: {path}"
                )
            specifiers = []
        normalized_path = path.resolve(strict=False)
        import_specifiers[normalized_path] = specifiers

        if suffix in SCRIPT_SUFFIXES:
            for match in STATIC_IMPORT_FROM.finditer(raw_text):
                if not mask[match.start()]:
                    continue
                candidates = module_candidates(path, match.group(2), target, aliases)
                if not any(
                    path_matches(candidate, source_root, allow_index=True)
                    for candidate in candidates
                ):
                    continue
                imported_aliases, namespace = runtime_import_aliases(
                    match.group(1), registered_exports
                )
                direct_aliases.setdefault(normalized_path, {}).update(imported_aliases)
                if namespace:
                    namespaces.setdefault(normalized_path, set()).add(namespace)

    for path, (raw_text, code, _mask) in script_records.items():
        inspect_component_style_overrides(
            target,
            path,
            raw_text,
            code,
            direct_aliases.get(path, {}),
            namespaces.get(path, set()),
            style_protected_exports,
            errors,
        )

    known_paths = set(import_specifiers)
    edges: dict[Path, set[Path]] = {path: set() for path in known_paths}
    personal_style_imports: dict[Path, int] = {}
    for path, specifiers in import_specifiers.items():
        for specifier in specifiers:
            candidates = module_candidates(path, specifier, target, aliases)
            edges[path].update(resolve_application_modules(candidates, known_paths))
            if any(path_matches(candidate, style_path) for candidate in candidates):
                personal_style_imports[path] = personal_style_imports.get(path, 0) + 1

    entrypoints = discover_application_entrypoints(
        target, application_source, known_paths, aliases
    )
    reachable = reachable_modules(entrypoints, edges)
    style_import_count = sum(
        count for path, count in personal_style_imports.items() if path in reachable
    )
    for path, (_raw_text, code, _mask) in script_records.items():
        if path in reachable:
            used_components.update(
                runtime_usages(
                    code,
                    direct_aliases.get(path, {}),
                    namespaces.get(path, set()),
                    registered_exports,
                )
            )
    return bool(used_components), style_import_count, sorted(used_components)


def inspect_dependencies(
    package_path: Path,
    required: object,
    errors: list[str],
    warnings: list[str],
) -> dict[str, dict[str, object]]:
    report: dict[str, dict[str, object]] = {}
    if not package_path.is_file():
        errors.append(f"missing {package_path}")
        return report
    try:
        package = read_json_object(package_path, label="package.json")
    except (OSError, UnicodeDecodeError, json.JSONDecodeError, ValueError) as error:
        errors.append(f"invalid package.json: {error}")
        return report
    if not isinstance(required, dict):
        errors.append("bundled registry dependencies must be an object")
        return report

    sections: dict[str, dict[str, object]] = {}
    for section_name in ("dependencies", "devDependencies"):
        if section_name not in package:
            sections[section_name] = {}
            continue
        section = package[section_name]
        if isinstance(section, dict):
            sections[section_name] = section
        else:
            errors.append(f"package.json field {section_name!r} must be an object")
            sections[section_name] = {}

    for dependency, bundled_version in sorted(required.items()):
        if not isinstance(dependency, str) or not isinstance(bundled_version, str):
            errors.append("bundled dependency names and versions must be strings")
            continue
        runtime_value = sections["dependencies"].get(dependency)
        development_value = sections["devDependencies"].get(dependency)
        if runtime_value is not None and development_value is not None:
            errors.append(
                f"package.json declares {dependency} in both dependencies and devDependencies"
            )
            report[dependency] = {
                "status": "duplicate",
                "bundledVersion": bundled_version,
                "dependencies": runtime_value,
                "devDependencies": development_value,
            }
            continue
        declared = runtime_value if runtime_value is not None else development_value
        section_name = (
            "dependencies"
            if runtime_value is not None
            else "devDependencies"
            if development_value is not None
            else None
        )
        if declared is None:
            errors.append(f"package.json does not declare {dependency}")
            report[dependency] = {
                "status": "missing",
                "bundledVersion": bundled_version,
            }
            continue
        if not isinstance(declared, str):
            errors.append(f"package.json declaration for {dependency} must be a string")
            report[dependency] = {
                "status": "invalid",
                "bundledVersion": bundled_version,
                "section": section_name,
                "declaredVersion": declared,
            }
            continue
        status = "matched" if declared == bundled_version else "incompatible"
        report[dependency] = {
            "status": status,
            "bundledVersion": bundled_version,
            "section": section_name,
            "declaredVersion": declared,
        }
        if section_name == "devDependencies":
            warnings.append(f"{dependency} is declared only in devDependencies")
        if declared != bundled_version:
            errors.append(
                f"package.json declares incompatible {dependency} version {declared}; bundled declaration is {bundled_version}"
            )
    return report


def inspect_build_gate(
    package_path: Path,
    errors: list[str],
) -> dict[str, object]:
    report: dict[str, object] = {
        "verifyScript": None,
        "verifyScriptMatches": False,
        "prebuild": None,
        "prebuildIncludesGate": False,
    }
    if not package_path.is_file():
        return report
    try:
        package = read_json_object(package_path, label="package.json")
    except (OSError, UnicodeDecodeError, json.JSONDecodeError, ValueError):
        return report
    scripts = package.get("scripts")
    if not isinstance(scripts, dict):
        errors.append("package.json scripts are missing; Personal UI build gate is not installed")
        return report

    verify_script = scripts.get(PROVENANCE_SCRIPT_NAME)
    prebuild = scripts.get("prebuild")
    report["verifyScript"] = verify_script
    report["prebuild"] = prebuild
    report["verifyScriptMatches"] = verify_script == PROVENANCE_SCRIPT_COMMAND
    prebuild_parts = (
        [part.strip() for part in prebuild.split("&&")]
        if isinstance(prebuild, str)
        else []
    )
    report["prebuildIncludesGate"] = PREBUILD_GATE_COMMAND in prebuild_parts
    if verify_script != PROVENANCE_SCRIPT_COMMAND:
        errors.append(
            f"package.json script {PROVENANCE_SCRIPT_NAME!r} does not match the mandatory Personal UI provenance gate"
        )
    if PREBUILD_GATE_COMMAND not in prebuild_parts:
        errors.append(
            "package.json prebuild does not invoke the mandatory Personal UI provenance gate"
        )
    return report


def main() -> int:
    args = parse_args()
    target = Path(os.path.abspath(args.target))
    errors: list[str] = []
    warnings: list[str] = []
    raw_required_components = list(args.require_component)
    required_components = sorted(
        {value.strip() for value in raw_required_components if value.strip()}
    )
    if len(required_components) != len(raw_required_components):
        errors.append("--require-component values must be non-empty and unique")
    elif required_components:
        warnings.append(
            "--require-component is retained only for compatibility; automatic source provenance is always enforced"
        )
    errors.extend(validate_bundled_path_integrity())
    try:
        bundled_registry = read_json_object(
            REGISTRY_PATH, label="bundled Personal UI registry"
        )
    except (OSError, UnicodeDecodeError, json.JSONDecodeError, ValueError) as error:
        report = {
            "target": str(target),
            "installedVersion": None,
            "bundledVersion": None,
            "upToDate": False,
            "usedByApplication": False,
            "usedComponents": [],
            "requiredComponents": required_components,
            "missingRequiredComponents": required_components,
            "unknownRequiredComponents": [],
            "stylesheetImportCount": 0,
            "errors": [f"invalid bundled Personal UI registry: {error}"],
            "warnings": [],
        }
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 1

    errors.extend(validate_registry_shape(bundled_registry, label="bundled registry"))
    component_manifest_report = validate_component_manifest(
        COMPONENT_MANIFEST_PATH,
        kit_root=ASSET_ROOT,
        registry_path=REGISTRY_PATH,
    )
    manifest_errors = component_manifest_report.get("errors", [])
    if isinstance(manifest_errors, list):
        errors.extend(
            f"component manifest: {error}"
            for error in manifest_errors
            if isinstance(error, str)
        )
    else:
        errors.append("component manifest validator returned an invalid errors field")
    runtime_export_report, runtime_export_errors = validate_runtime_exports(
        bundled_registry
    )
    errors.extend(runtime_export_errors)
    source_root_value = bundled_registry.get("sourceRoot")
    style_entry_value = bundled_registry.get("styleEntry")
    source_root = target / str(source_root_value or "src/personal-ui")
    manifest_path = source_root / "registry.json"
    legacy_path = target / "registry.json"
    installed_component_manifest_path = (
        target / INSTALLED_TOOL_ROOT / "component-manifest.json"
    )
    installed_provenance_tool_path = (
        target / INSTALLED_TOOL_ROOT / "verify-provenance.mjs"
    )
    path_integrity_errors = validate_project_path_integrity(target, source_root)
    errors.extend(path_integrity_errors)
    installed_support = {
        "componentManifest": compare_installed_support_file(
            COMPONENT_MANIFEST_PATH,
            installed_component_manifest_path,
            label="component manifest",
            errors=errors,
        ),
        "provenanceVerifier": compare_installed_support_file(
            PROVENANCE_TOOL_PATH,
            installed_provenance_tool_path,
            label="provenance verifier",
            errors=errors,
        ),
    }

    installed_registry: dict[str, object] | None = None
    if manifest_path.is_file():
        try:
            installed_registry = read_json_object(
                manifest_path, label="installed Personal UI registry"
            )
            errors.extend(
                validate_registry_shape(installed_registry, label="installed registry")
            )
        except (OSError, UnicodeDecodeError, json.JSONDecodeError, ValueError) as error:
            errors.append(f"invalid installed Personal UI registry: {error}")
    else:
        errors.append(f"missing installed Personal UI registry: {manifest_path}")

    legacy_registry: dict[str, object] | None = None
    if legacy_path.is_file():
        try:
            legacy_value = read_json_object(legacy_path, label="legacy registry")
        except (OSError, UnicodeDecodeError, json.JSONDecodeError, ValueError):
            legacy_value = None
        if is_recognized_personal_ui_registry(legacy_value):
            legacy_registry = legacy_value

    legacy_conflict = False
    if legacy_registry is not None:
        if installed_registry is None:
            errors.append(
                f"legacy Personal UI manifest must be migrated to {manifest_path}"
            )
            legacy_conflict = True
        elif legacy_registry != installed_registry:
            errors.append(f"conflicting legacy Personal UI manifest: {legacy_path}")
            legacy_conflict = True
        else:
            warnings.append(
                f"duplicate legacy Personal UI manifest should be removed: {legacy_path}"
            )

    installed_version = (
        installed_registry.get("version") if installed_registry is not None else None
    )
    bundled_version = bundled_registry.get("version")
    manifest_matches_bundle = installed_registry == bundled_registry
    if installed_registry is not None:
        if installed_registry.get("name") != "personal-ui":
            errors.append("installed registry does not identify Personal UI")
        if installed_registry.get("sourceRoot") != source_root_value:
            errors.append(
                "installed registry sourceRoot does not match the bundled sourceRoot"
            )
        if installed_version != bundled_version:
            errors.append(
                f"installed Personal UI version {installed_version!r} does not match bundled version {bundled_version!r}"
            )
        elif not manifest_matches_bundle:
            errors.append(
                "installed Personal UI registry differs from the bundled registry"
            )

    source_drift = compare_managed_source(source_root, errors)
    dependency_report = inspect_dependencies(
        target / "package.json",
        bundled_registry.get("dependencies"),
        errors,
        warnings,
    )
    build_gate_report = inspect_build_gate(target / "package.json", errors)
    registered_exports_value = runtime_export_report.get("registered", [])
    registered_exports = {
        name for name in registered_exports_value if isinstance(name, str)
    }
    style_protected_exports: set[str] = set()
    manifest_entries = component_manifest_report.get("entries", [])
    if isinstance(manifest_entries, list):
        for entry in manifest_entries:
            if not isinstance(entry, dict):
                continue
            if entry.get("id") in STYLE_OVERRIDE_LAYOUT_ENTRY_IDS:
                continue
            if entry.get("kind") not in {"component", "pattern"}:
                continue
            non_visual = {
                value
                for value in entry.get("nonVisualExports", [])
                if isinstance(value, str)
            }
            style_protected_exports.update(
                value
                for value in entry.get("publicExports", [])
                if isinstance(value, str)
                and value in registered_exports
                and value not in non_visual
            )
    unknown_required_components = sorted(
        set(required_components) - registered_exports
    )
    if unknown_required_components:
        errors.append(
            "unknown required Personal UI runtime export(s): "
            + ", ".join(unknown_required_components)
        )
    if path_integrity_errors:
        used, stylesheet_import_count, used_components = False, 0, []
        provenance_report: dict[str, object] = {
            "valid": False,
            "scannedFiles": 0,
            "usedPublicExports": [],
            "issues": [],
            "errors": ["provenance scan skipped because project path integrity failed"],
        }
    else:
        reachable_used, stylesheet_import_count, reachable_components = inspect_application_usage(
            target,
            source_root,
            str(style_entry_value or "src/personal-ui/styles.css"),
            registered_exports,
            style_protected_exports,
            errors,
        )
        provenance_report = run_provenance_scan(target, source_root, errors)
        provenance_used = provenance_report.get("usedPublicExports", [])
        provenance_components = {
            name
            for name in provenance_used
            if isinstance(name, str) and name in registered_exports
        } if isinstance(provenance_used, list) else set()
        used_components = sorted(
            provenance_components
            & {
                name
                for name in reachable_components
                if name in registered_exports
            }
        )
        if not isinstance(provenance_used, list):
            errors.append("Personal UI provenance verifier report has invalid usedPublicExports field")
        used = reachable_used and bool(used_components)
    if not used:
        if args.allow_unreferenced:
            warnings.append(
                "Personal UI is installed but no runtime export is rendered or called yet."
            )
        else:
            errors.append(
                "no application source renders or calls a Personal UI runtime export"
            )
    elif stylesheet_import_count == 0:
        errors.append("application source does not import the Personal UI stylesheet")
    elif stylesheet_import_count > 1:
        errors.append(
            f"application source imports the Personal UI stylesheet {stylesheet_import_count} times"
        )

    missing_required_components = sorted(
        (set(required_components) & registered_exports) - set(used_components)
    )
    if missing_required_components:
        errors.append(
            "required Personal UI component(s) are not used by reachable application code: "
            + ", ".join(missing_required_components)
        )

    has_source_drift = any(source_drift.values())
    up_to_date = bool(
        installed_registry is not None
        and installed_version == bundled_version
        and manifest_matches_bundle
        and component_manifest_report.get("valid") is True
        and all(
            isinstance(item, dict) and item.get("matches") is True
            for item in installed_support.values()
        )
        and provenance_report.get("valid") is True
        and not has_source_drift
        and not legacy_conflict
        and not errors
    )
    report = {
        "target": str(target),
        "manifestPath": str(manifest_path),
        "legacyManifestPath": str(legacy_path) if legacy_registry is not None else None,
        "installedVersion": installed_version,
        "bundledVersion": bundled_version,
        "upToDate": up_to_date,
        "sourceRoot": str(source_root),
        "usedByApplication": used,
        "usedComponents": used_components,
        "requiredComponents": required_components,
        "missingRequiredComponents": missing_required_components,
        "unknownRequiredComponents": unknown_required_components,
        "stylesheetImportCount": stylesheet_import_count,
        "runtimeExports": runtime_export_report,
        "componentManifest": component_manifest_report,
        "installedSupport": installed_support,
        "provenance": provenance_report,
        "sourceDrift": source_drift,
        "dependencies": dependency_report,
        "buildGate": build_gate_report,
        "errors": errors,
        "warnings": warnings,
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
