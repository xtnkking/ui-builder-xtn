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
    r"""^[ \t]*@(?:import|use|forward)\s+(?:url\(\s*)?(?:["']([^"']+)["']|([^\s);]+))""",
    re.MULTILINE,
)
SCRIPT_SUFFIXES = {".ts", ".tsx", ".js", ".jsx", ".mts", ".cts", ".mjs", ".cjs"}
STYLE_SUFFIXES = {".css", ".scss", ".sass", ".less"}
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
HTML_SCRIPT_SOURCE = re.compile(
    r'''<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>''', re.IGNORECASE
)


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
            style_text = strip_css_comments(raw_text)
            if COMPONENT_SELECTOR.search(style_text):
                errors.append(
                    f"application styling reaches into a Personal UI internal selector: {path}"
                )
        elif suffix in HTML_SUFFIXES:
            html_text = HTML_COMMENT.sub("", raw_text)
            style_blocks = (
                strip_css_comments(match.group(1))
                for match in HTML_STYLE_BLOCK.finditer(html_text)
            )
            if any(COMPONENT_SELECTOR.search(block) for block in style_blocks):
                errors.append(
                    f"application HTML styling reaches into a Personal UI internal selector: {path}"
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

        if not is_inside(path, application_source):
            continue
        if suffix in SCRIPT_SUFFIXES:
            mask = code_position_mask(raw_text)
            code = masked_code(raw_text, mask)
            normalized_path = path.resolve(strict=False)
            script_records[normalized_path] = (raw_text, code, mask)
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
