#!/usr/bin/env python3
"""Validate the canonical Personal UI component manifest."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
from pathlib import Path
from typing import Any


SKILL_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_KIT_ROOT = SKILL_ROOT / "assets" / "react-kit"
DEFAULT_MANIFEST = DEFAULT_KIT_ROOT / "component-manifest.json"
DEFAULT_REGISTRY = DEFAULT_KIT_ROOT / "registry.json"
SEMVER = re.compile(
    r"^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)"
    r"(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?"
    r"(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$"
)
ENTRY_ID = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
RUNTIME_EXPORT = re.compile(r"^[A-Za-z_$][\w$]*$")
OWNER_MARKER = re.compile(r"^[A-Za-z0-9]+(?:[._:-][A-Za-z0-9]+)*$")
NON_VISUAL_HOOK = re.compile(r"^use[A-Z][A-Za-z0-9_$]*$")
NON_VISUAL_CONSTANT = re.compile(r"^[A-Z][A-Z0-9_]*$")
RUNTIME_DECLARATION = re.compile(
    r"^\s*export\s+(?:default\s+)?(?:async\s+)?"
    r"(?:function|class|const|let|var)\s+([A-Za-z_$][\w$]*)",
    re.MULTILINE,
)
NAMED_EXPORT = re.compile(r"^\s*export\s*\{([^}]*)\}", re.MULTILINE | re.DOTALL)
SCRIPT_SUFFIXES = {".ts", ".tsx", ".js", ".jsx", ".mts", ".cts", ".mjs", ".cjs"}
ENTRY_KINDS = {"foundation", "component", "pattern"}
REQUIRED_POLICY_FIELDS = {
    "forbiddenIntrinsicTags",
    "forbiddenRoles",
    "allowedExternalJsxPackages",
}
MINIMUM_FORBIDDEN_INTRINSICS = {
    "a",
    "audio",
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
    "svg",
    "table",
    "textarea",
    "video",
}
MINIMUM_FORBIDDEN_ROLES = {
    "button",
    "checkbox",
    "combobox",
    "dialog",
    "listbox",
    "menu",
    "menuitem",
    "option",
    "radio",
    "slider",
    "spinbutton",
    "switch",
    "tab",
    "tablist",
    "tree",
}


def read_json_object(path: Path, *, label: str) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"{label} must contain a JSON object: {path}")
    return value


def is_link_like(path: Path) -> bool:
    is_junction = getattr(path, "is_junction", None)
    return path.is_symlink() or bool(is_junction and is_junction())


def is_within(path: Path, parent: Path) -> bool:
    try:
        path.relative_to(parent)
        return True
    except ValueError:
        return False


def string_array(
    value: object,
    *,
    label: str,
    errors: list[str],
    allow_empty: bool,
) -> list[str]:
    if not isinstance(value, list):
        errors.append(f"{label} must be an array")
        return []
    items = [item for item in value if isinstance(item, str)]
    if len(items) != len(value) or any(not item.strip() for item in items):
        errors.append(f"{label} must contain only non-empty strings")
    if len(set(items)) != len(items):
        errors.append(f"{label} must not contain duplicates")
    if not allow_empty and not items:
        errors.append(f"{label} must not be empty")
    return items


def resolve_source_file(kit_root: Path, source_file: str) -> Path | None:
    relative = Path(source_file.replace("\\", "/"))
    if relative.is_absolute() or ".." in relative.parts:
        return None
    candidates = [kit_root / relative]
    if not relative.parts or relative.parts[:2] != ("src", "personal-ui"):
        candidates.append(kit_root / "src" / "personal-ui" / relative)
    kit_physical = kit_root.resolve(strict=True)
    for candidate in candidates:
        physical = candidate.resolve(strict=False)
        if is_within(physical, kit_physical) and candidate.is_file():
            return candidate
    return None


def validate_source_integrity(
    manifest: dict[str, Any],
    kit_root: Path,
    errors: list[str],
) -> dict[str, Any]:
    source_root = kit_root / "src" / "personal-ui"
    declared_value = manifest.get("sourceIntegrity")
    if not isinstance(declared_value, dict) or not declared_value:
        errors.append("component manifest sourceIntegrity must be a non-empty object")
        declared_value = {}

    declared: dict[str, str] = {}
    for raw_relative, raw_digest in declared_value.items():
        if not isinstance(raw_relative, str) or not raw_relative:
            errors.append("component manifest sourceIntegrity paths must be non-empty strings")
            continue
        relative = Path(raw_relative.replace("\\", "/"))
        if (
            raw_relative != relative.as_posix()
            or relative.is_absolute()
            or ".." in relative.parts
        ):
            errors.append(
                f"component manifest sourceIntegrity has unsafe path: {raw_relative!r}"
            )
            continue
        if not isinstance(raw_digest, str) or not re.fullmatch(
            r"[0-9a-f]{64}", raw_digest
        ):
            errors.append(
                f"component manifest sourceIntegrity has invalid SHA-256 for {raw_relative!r}"
            )
            continue
        declared[raw_relative] = raw_digest

    actual: dict[str, Path] = {}
    if not source_root.is_dir() or is_link_like(source_root):
        errors.append(f"managed Personal UI source root is missing or link-like: {source_root}")
    else:
        for path in source_root.rglob("*"):
            relative = path.relative_to(source_root).as_posix()
            if is_link_like(path):
                errors.append(f"managed Personal UI source contains a link: {relative}")
                continue
            if path.is_file():
                actual[relative] = path

    missing = sorted(set(declared) - set(actual))
    extra = sorted(set(actual) - set(declared))
    changed: list[str] = []
    for relative in sorted(set(declared) & set(actual)):
        digest = hashlib.sha256(actual[relative].read_bytes()).hexdigest()
        if digest != declared[relative]:
            changed.append(relative)
    if missing:
        errors.append(
            "component manifest sourceIntegrity references missing file(s): "
            + ", ".join(missing)
        )
    if extra:
        errors.append(
            "component manifest sourceIntegrity omits managed file(s): "
            + ", ".join(extra)
        )
    if changed:
        errors.append(
            "component manifest sourceIntegrity SHA-256 mismatch for: "
            + ", ".join(changed)
        )
    return {
        "valid": not (missing or extra or changed) and bool(declared),
        "fileCount": len(declared),
        "missing": missing,
        "extra": extra,
        "changed": changed,
    }


def strip_script_comments(text: str) -> str:
    """Blank JavaScript comments while preserving strings and line positions."""
    output = list(text)
    state = "code"
    quote = ""
    escaped = False
    index = 0
    while index < len(text):
        character = text[index]
        following = text[index + 1] if index + 1 < len(text) else ""
        if state == "line-comment":
            if character == "\n":
                state = "code"
            else:
                output[index] = " "
        elif state == "block-comment":
            if character == "*" and following == "/":
                output[index] = output[index + 1] = " "
                index += 1
                state = "code"
            elif character != "\n":
                output[index] = " "
        elif state == "string":
            if escaped:
                escaped = False
            elif character == "\\":
                escaped = True
            elif character == quote:
                state = "code"
        elif character in {'"', "'", "`"}:
            state = "string"
            quote = character
        elif character == "/" and following == "/":
            output[index] = output[index + 1] = " "
            index += 1
            state = "line-comment"
        elif character == "/" and following == "*":
            output[index] = output[index + 1] = " "
            index += 1
            state = "block-comment"
        index += 1
    return "".join(output)


def runtime_exports(text: str) -> set[str]:
    code = strip_script_comments(text)
    exports = set(RUNTIME_DECLARATION.findall(code))
    for body in NAMED_EXPORT.findall(code):
        for raw_item in body.split(","):
            item = raw_item.strip()
            if not item or item.startswith("type "):
                continue
            parts = re.split(r"\s+as\s+", item)
            name = parts[-1].strip()
            if RUNTIME_EXPORT.fullmatch(name):
                exports.add(name)
    return exports


def owner_marker_is_bound(text: str, marker: str) -> bool:
    code = strip_script_comments(text)
    escaped = re.escape(marker)
    direct = re.compile(
        rf"(?:\bdata-pui-owner\s*=|[\"']data-pui-owner[\"']\s*:)"
        rf"\s*(?:\"{escaped}\"|'{escaped}')"
    )
    if direct.search(code):
        return True
    for match in re.finditer(
        r"\bdata-pui-owner\s*=\s*\{\s*([A-Za-z_$][\w$]*)\s*\}", code
    ):
        variable = re.escape(match.group(1))
        literal = rf"(?:\"{escaped}\"|'{escaped}')"
        bindings = (
            rf"\b{variable}\s*=\s*{literal}",
            rf"[\"']data-pui-owner[\"']\s*:\s*{variable}\s*=\s*{literal}",
            rf"\b{variable}\s*:\s*[^;=\n]*{literal}",
        )
        if any(re.search(pattern, code) for pattern in bindings):
            return True
    return False


def validate_component_manifest(
    manifest_path: Path = DEFAULT_MANIFEST,
    *,
    kit_root: Path = DEFAULT_KIT_ROOT,
    registry_path: Path = DEFAULT_REGISTRY,
) -> dict[str, Any]:
    errors: list[str] = []
    entries_report: list[dict[str, Any]] = []
    manifest_path = Path(os.path.abspath(manifest_path))
    kit_root = Path(os.path.abspath(kit_root))
    registry_path = Path(os.path.abspath(registry_path))

    try:
        if is_link_like(manifest_path):
            raise ValueError("manifest must not be a symbolic link or junction")
        manifest = read_json_object(manifest_path, label="component manifest")
    except (OSError, UnicodeDecodeError, json.JSONDecodeError, ValueError) as error:
        return {
            "valid": False,
            "manifest": str(manifest_path),
            "kitRoot": str(kit_root),
            "registry": str(registry_path),
            "entries": [],
            "publicExports": [],
            "nonVisualExports": [],
            "ownerMarkers": [],
            "aliases": [],
            "errors": [f"invalid component manifest: {error}"],
        }

    try:
        registry = read_json_object(registry_path, label="Personal UI registry")
    except (OSError, UnicodeDecodeError, json.JSONDecodeError, ValueError) as error:
        registry = {}
        errors.append(f"invalid Personal UI registry: {error}")

    if manifest.get("schemaVersion") != 2:
        errors.append("component manifest schemaVersion must be 2")
    kit_version = manifest.get("kitVersion")
    if not isinstance(kit_version, str) or not SEMVER.fullmatch(kit_version):
        errors.append("component manifest kitVersion must use semantic versioning")
    registry_version = registry.get("version")
    if isinstance(kit_version, str) and kit_version != registry_version:
        errors.append(
            "component manifest kitVersion does not match registry version: "
            f"{kit_version!r} versus {registry_version!r}"
        )

    registry_exports_value = registry.get("exports", [])
    registry_exports = {
        item for item in registry_exports_value if isinstance(item, str)
    } if isinstance(registry_exports_value, list) else set()
    if not registry_exports:
        errors.append("Personal UI registry must contain runtime exports")

    source_integrity_report = validate_source_integrity(manifest, kit_root, errors)

    entries_value = manifest.get("entries")
    if not isinstance(entries_value, list) or not entries_value:
        errors.append("component manifest entries must be a non-empty array")
        entries_value = []

    entry_ids: list[str] = []
    declared_exports: set[str] = set()
    export_to_entry: dict[str, str] = {}
    declared_non_visual: set[str] = set()
    owner_to_entry: dict[str, str] = {}
    alias_to_entry: dict[str, str] = {}
    for index, raw_entry in enumerate(entries_value):
        label = f"component manifest entry {index}"
        if not isinstance(raw_entry, dict):
            errors.append(f"{label} must be an object")
            continue
        entry_id = raw_entry.get("id")
        kind = raw_entry.get("kind")
        if not isinstance(entry_id, str) or not ENTRY_ID.fullmatch(entry_id):
            errors.append(f"{label} id must be a lowercase kebab-case identifier")
            entry_id = f"entry-{index}"
        entry_ids.append(entry_id)
        if kind not in ENTRY_KINDS:
            errors.append(f"component manifest entry {entry_id!r} has invalid kind")

        public_exports = string_array(
            raw_entry.get("publicExports"),
            label=f"entry {entry_id!r} publicExports",
            errors=errors,
            allow_empty=kind == "foundation",
        )
        source_files = string_array(
            raw_entry.get("sourceFiles"),
            label=f"entry {entry_id!r} sourceFiles",
            errors=errors,
            allow_empty=False,
        )
        aliases = string_array(
            raw_entry.get("aliases", []),
            label=f"entry {entry_id!r} aliases",
            errors=errors,
            allow_empty=True,
        )
        owner_markers = string_array(
            raw_entry.get("ownerMarkers", []),
            label=f"entry {entry_id!r} ownerMarkers",
            errors=errors,
            allow_empty=True,
        )
        non_visual_exports = string_array(
            raw_entry.get("nonVisualExports", []),
            label=f"entry {entry_id!r} nonVisualExports",
            errors=errors,
            allow_empty=True,
        )
        if kind in {"component", "pattern"} and not owner_markers:
            errors.append(
                f"entry {entry_id!r} must declare at least one visual owner marker"
            )
        for export_name in public_exports:
            if not RUNTIME_EXPORT.fullmatch(export_name):
                errors.append(
                    f"entry {entry_id!r} has invalid public export {export_name!r}"
                )
            elif export_name not in registry_exports:
                errors.append(
                    f"entry {entry_id!r} references unregistered public export {export_name!r}"
                )
            previous = export_to_entry.get(export_name)
            if previous is not None and previous != entry_id:
                errors.append(
                    f"public export {export_name!r} belongs to both {previous!r} and {entry_id!r}"
                )
            export_to_entry[export_name] = entry_id
            declared_exports.add(export_name)

        public_export_set = set(public_exports)
        owner_marker_set = set(owner_markers)
        non_visual_set = set(non_visual_exports)
        unknown_markers = sorted(owner_marker_set - public_export_set)
        if unknown_markers:
            errors.append(
                f"entry {entry_id!r} owner marker(s) are not public exports: "
                + ", ".join(unknown_markers)
            )
        unknown_non_visual = sorted(non_visual_set - public_export_set)
        if unknown_non_visual:
            errors.append(
                f"entry {entry_id!r} nonVisualExports are not public exports: "
                + ", ".join(unknown_non_visual)
            )
        overlapping_ownership = sorted(owner_marker_set & non_visual_set)
        if overlapping_ownership:
            errors.append(
                f"entry {entry_id!r} exports cannot be both visual and non-visual: "
                + ", ".join(overlapping_ownership)
            )
        unclassified = sorted(public_export_set - owner_marker_set - non_visual_set)
        if unclassified:
            errors.append(
                f"entry {entry_id!r} public export(s) lack an ownership classification: "
                + ", ".join(unclassified)
            )
        for export_name in non_visual_exports:
            if not (
                NON_VISUAL_HOOK.fullmatch(export_name)
                or NON_VISUAL_CONSTANT.fullmatch(export_name)
            ):
                errors.append(
                    f"entry {entry_id!r} non-visual export {export_name!r} must be a use* hook or uppercase constant"
                )
            declared_non_visual.add(export_name)
        for alias in aliases:
            if not ENTRY_ID.fullmatch(alias):
                errors.append(
                    f"entry {entry_id!r} has invalid lowercase kebab-case alias {alias!r}"
                )
            previous = alias_to_entry.get(alias)
            if previous is not None and previous != entry_id:
                errors.append(
                    f"alias {alias!r} belongs to both {previous!r} and {entry_id!r}"
                )
            alias_to_entry[alias] = entry_id

        resolved_files: list[Path] = []
        for source_file in source_files:
            resolved = resolve_source_file(kit_root, source_file)
            if resolved is None:
                errors.append(
                    f"entry {entry_id!r} source file is missing or escapes the kit: {source_file}"
                )
                continue
            if is_link_like(resolved):
                errors.append(
                    f"entry {entry_id!r} source file must not be a link: {source_file}"
                )
                continue
            resolved_files.append(resolved)

        source_texts = {
            path: path.read_text(encoding="utf-8", errors="replace")
            for path in resolved_files
        }
        script_export_names: set[str] = set()
        for path, text in source_texts.items():
            if path.suffix.lower() in SCRIPT_SUFFIXES:
                script_export_names.update(runtime_exports(text))
        for export_name in public_exports:
            if resolved_files and export_name not in script_export_names:
                errors.append(
                    f"entry {entry_id!r} public export {export_name!r} has no runtime export declaration in its source files"
                )
        for marker in owner_markers:
            if not OWNER_MARKER.fullmatch(marker):
                errors.append(
                    f"entry {entry_id!r} has invalid owner marker {marker!r}"
                )
            previous = owner_to_entry.get(marker)
            if previous is not None and previous != entry_id:
                errors.append(
                    f"owner marker {marker!r} belongs to both {previous!r} and {entry_id!r}"
                )
            owner_to_entry[marker] = entry_id
            if resolved_files and not any(
                path.suffix.lower() in SCRIPT_SUFFIXES
                and owner_marker_is_bound(text, marker)
                for path, text in source_texts.items()
            ):
                errors.append(
                    f"entry {entry_id!r} owner marker {marker!r} is not bound to data-pui-owner in its source files"
                )

        entries_report.append(
            {
                "id": entry_id,
                "kind": kind,
                "publicExports": public_exports,
                "sourceFiles": source_files,
                "aliases": aliases,
                "ownerMarkers": owner_markers,
                "nonVisualExports": non_visual_exports,
            }
        )

    duplicate_ids = sorted(
        entry_id for entry_id in set(entry_ids) if entry_ids.count(entry_id) > 1
    )
    if duplicate_ids:
        errors.append(
            "component manifest contains duplicate entry id(s): "
            + ", ".join(duplicate_ids)
        )
    missing_exports = sorted(registry_exports - declared_exports)
    if missing_exports:
        errors.append(
            "registered runtime export(s) missing from component manifest: "
            + ", ".join(missing_exports)
        )
    extra_exports = sorted(declared_exports - registry_exports)
    if extra_exports:
        errors.append(
            "component manifest declares unregistered runtime export(s): "
            + ", ".join(extra_exports)
        )

    policy = manifest.get("policy")
    policy_report: dict[str, list[str]] = {}
    if not isinstance(policy, dict):
        errors.append("component manifest policy must be an object")
        policy = {}
    missing_policy_fields = sorted(REQUIRED_POLICY_FIELDS - set(policy))
    if missing_policy_fields:
        errors.append(
            "component manifest policy is missing field(s): "
            + ", ".join(missing_policy_fields)
        )
    for field in sorted(REQUIRED_POLICY_FIELDS):
        values = string_array(
            policy.get(field, []),
            label=f"component manifest policy {field}",
            errors=errors,
            allow_empty=field == "allowedExternalJsxPackages",
        )
        policy_report[field] = values

    forbidden_tags = {item.lower() for item in policy_report.get("forbiddenIntrinsicTags", [])}
    missing_tags = sorted(MINIMUM_FORBIDDEN_INTRINSICS - forbidden_tags)
    if missing_tags:
        errors.append(
            "component manifest policy weakens required intrinsic protection; missing: "
            + ", ".join(missing_tags)
        )
    forbidden_roles = {item.lower() for item in policy_report.get("forbiddenRoles", [])}
    missing_roles = sorted(MINIMUM_FORBIDDEN_ROLES - forbidden_roles)
    if missing_roles:
        errors.append(
            "component manifest policy weakens required role protection; missing: "
            + ", ".join(missing_roles)
        )

    return {
        "valid": not errors,
        "manifest": str(manifest_path),
        "kitRoot": str(kit_root),
        "registry": str(registry_path),
        "kitVersion": kit_version,
        "entries": entries_report,
        "entryCount": len(entries_report),
        "publicExports": sorted(declared_exports),
        "nonVisualExports": sorted(declared_non_visual),
        "ownerMarkers": sorted(owner_to_entry),
        "aliases": sorted(alias_to_entry),
        "aliasCount": len(alias_to_entry),
        "policy": policy_report,
        "sourceIntegrity": source_integrity_report,
        "errors": errors,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--kit-root", type=Path, default=DEFAULT_KIT_ROOT)
    parser.add_argument("--registry", type=Path, default=DEFAULT_REGISTRY)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    report = validate_component_manifest(
        args.manifest,
        kit_root=args.kit_root,
        registry_path=args.registry,
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["valid"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
