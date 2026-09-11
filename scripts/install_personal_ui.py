#!/usr/bin/env python3
"""Install the bundled Personal UI source into a React project."""

from __future__ import annotations

import argparse
import copy
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import uuid
from pathlib import Path

from validate_component_manifest import validate_component_manifest


SKILL_ROOT = Path(__file__).resolve().parent.parent
ASSET_ROOT = SKILL_ROOT / "assets" / "react-kit"
SOURCE_KIT = ASSET_ROOT / "src" / "personal-ui"
REGISTRY_PATH = ASSET_ROOT / "registry.json"
COMPONENT_MANIFEST_PATH = ASSET_ROOT / "component-manifest.json"
PROVENANCE_TOOL_PATH = ASSET_ROOT / "tools" / "personal-ui" / "verify-provenance.mjs"
INSTALLED_TOOL_ROOT = Path("tools") / "personal-ui"
PROVENANCE_SCRIPT_NAME = "verify:personal-ui"
PROVENANCE_SCRIPT_COMMAND = (
    "node tools/personal-ui/verify-provenance.mjs --target . "
    "--source-root src/personal-ui --manifest tools/personal-ui/component-manifest.json"
)
CANONICAL_SOURCE_PROVENANCE_SCRIPT_COMMAND = (
    "node tools/personal-ui/verify-provenance.mjs --target . "
    "--source-root src/personal-ui --manifest component-manifest.json"
)
PREBUILD_GATE_COMMAND = f"npm run {PROVENANCE_SCRIPT_NAME}"
IGNORED_PARTS = {"node_modules", "dist", ".git", "__pycache__"}
SEMVER = re.compile(
    r"^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)"
    r"(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?"
    r"(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$"
)
RUNTIME_EXPORT = re.compile(r"^[A-Za-z_$][\w$]*$")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mode", choices=("starter", "integrate"), required=True)
    parser.add_argument("--target", type=Path, required=True)
    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite starter-owned paths or completely replace an existing integrated Personal UI source directory.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print the complete create/overwrite/delete plan without writing files.",
    )
    return parser.parse_args()


def read_json_object(path: Path, *, label: str) -> tuple[dict[str, object], str]:
    text = path.read_text(encoding="utf-8")
    value = json.loads(text)
    if not isinstance(value, dict):
        raise ValueError(f"{label} must contain a JSON object: {path}")
    return value, text


def load_registry() -> dict[str, object]:
    if is_link_like(REGISTRY_PATH):
        raise ValueError(
            f"Personal UI registry must not be a symbolic link or junction: {REGISTRY_PATH}"
        )
    registry, _ = read_json_object(REGISTRY_PATH, label="Personal UI registry")
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
            raise ValueError(f"Personal UI registry field {field!r} has the wrong type")
    if registry["name"] != "personal-ui":
        raise ValueError("Personal UI registry has an unexpected name")
    if not SEMVER.fullmatch(str(registry["version"])):
        raise ValueError("Personal UI registry version must be valid semantic versioning")
    if (
        registry["sourceRoot"] != "src/personal-ui"
        or registry["styleEntry"] != "src/personal-ui/styles.css"
    ):
        raise ValueError("Personal UI registry has unexpected managed paths")
    exports = registry["exports"]
    if (
        not exports
        or any(
            not isinstance(name, str) or not RUNTIME_EXPORT.fullmatch(name)
            for name in exports
        )
        or len(set(exports)) != len(exports)
    ):
        raise ValueError(
            "Personal UI registry exports must be unique runtime identifiers"
        )
    dependencies = registry["dependencies"]
    if any(
        not isinstance(name, str)
        or not name.strip()
        or not isinstance(version, str)
        or not version.strip()
        for name, version in dependencies.items()
    ):
        raise ValueError(
            "Personal UI registry dependencies must use non-empty string names and versions"
        )
    manifest_report = validate_component_manifest(
        COMPONENT_MANIFEST_PATH,
        kit_root=ASSET_ROOT,
        registry_path=REGISTRY_PATH,
    )
    manifest_errors = manifest_report.get("errors", [])
    if manifest_errors:
        raise ValueError(
            "Invalid Personal UI component manifest: "
            + "; ".join(str(error) for error in manifest_errors)
        )
    if is_link_like(PROVENANCE_TOOL_PATH) or not PROVENANCE_TOOL_PATH.is_file():
        raise ValueError(
            f"Personal UI provenance verifier is missing or link-like: {PROVENANCE_TOOL_PATH}"
        )
    node = shutil.which("node")
    if node is None:
        raise ValueError("Node.js is required to install the Personal UI provenance verifier")
    syntax_check = subprocess.run(
        [node, "--check", str(PROVENANCE_TOOL_PATH)],
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=False,
    )
    if syntax_check.returncode != 0:
        raise ValueError(
            "Personal UI provenance verifier has invalid JavaScript syntax: "
            + (syntax_check.stderr.strip() or syntax_check.stdout.strip())
        )
    return registry


def support_files() -> dict[Path, Path]:
    return {
        Path("component-manifest.json"): COMPONENT_MANIFEST_PATH,
        Path("verify-provenance.mjs"): PROVENANCE_TOOL_PATH,
    }


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


def recognized_legacy_registry(target: Path) -> Path | None:
    candidate = target / "registry.json"
    if not candidate.is_file() or is_link_like(candidate):
        return None
    try:
        value = json.loads(candidate.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    return candidate if is_recognized_personal_ui_registry(value) else None


def recognized_source_registry(target: Path) -> Path | None:
    candidate = target / "src" / "personal-ui" / "registry.json"
    if not candidate.is_file() or is_link_like(candidate):
        return None
    try:
        value = json.loads(candidate.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    return candidate if is_recognized_personal_ui_registry(value) else None


def is_link_like(path: Path) -> bool:
    is_junction = getattr(path, "is_junction", None)
    return path.is_symlink() or bool(is_junction and is_junction())


def is_within(path: Path, parent: Path) -> bool:
    try:
        path.relative_to(parent)
        return True
    except ValueError:
        return False


def validate_target_is_independent(target: Path) -> None:
    target_physical = target.resolve(strict=False)
    skill_physical = SKILL_ROOT.resolve(strict=True)
    if is_within(target_physical, skill_physical) or is_within(
        skill_physical, target_physical
    ):
        raise ValueError(
            "Installation target must be physically separate from the Personal UI Skill source: "
            f"{target} resolves to {target_physical}"
        )


def validate_managed_path(root: Path, relatives: set[Path], *, label: str) -> None:
    if is_link_like(root):
        raise ValueError(f"{label} must not be a symbolic link or junction: {root}")
    for relative in sorted(relatives):
        current = root
        for index, part in enumerate(relative.parts):
            current /= part
            if is_link_like(current):
                raise ValueError(
                    f"{label} contains a symbolic link or junction: {current}"
                )
            if not current.exists():
                continue
            is_destination = index == len(relative.parts) - 1
            if is_destination and not current.is_file():
                raise ValueError(f"managed file destination is not a file: {current}")
            if not is_destination and not current.is_dir():
                raise ValueError(f"managed parent path is not a directory: {current}")


def validate_tree_has_no_links(root: Path, *, label: str) -> None:
    if not root.exists() and not is_link_like(root):
        return
    if is_link_like(root):
        raise ValueError(f"{label} must not be a symbolic link or junction: {root}")
    for path in root.rglob("*"):
        if is_link_like(path):
            raise ValueError(f"{label} contains a symbolic link or junction: {path}")


def source_files(source: Path, *, skip_root_registry: bool = False) -> dict[Path, Path]:
    if is_link_like(source):
        raise ValueError(
            f"Personal UI source must not be a symbolic link or junction: {source}"
        )
    files: dict[Path, Path] = {}
    for source_path in sorted(source.rglob("*")):
        relative = source_path.relative_to(source)
        if any(part in IGNORED_PARTS for part in relative.parts):
            continue
        if is_link_like(source_path):
            raise ValueError(
                f"Personal UI source contains a symbolic link or junction: {source_path}"
            )
        if source_path.is_file():
            if skip_root_registry and relative == Path("registry.json"):
                continue
            files[relative] = source_path
    return files


def destination_files(destination: Path) -> set[Path]:
    if not destination.exists():
        return set()
    return {
        path for path in destination.rglob("*") if path.is_file() or path.is_symlink()
    }


def plan_dependencies(
    package: dict[str, object],
    required: dict[str, object],
) -> tuple[dict[str, object], dict[str, object]]:
    updated = copy.deepcopy(package)
    sections: dict[str, dict[str, object]] = {}
    for section_name in ("dependencies", "devDependencies"):
        if section_name not in updated:
            sections[section_name] = {}
            continue
        section = updated[section_name]
        if not isinstance(section, dict):
            raise ValueError(f"package.json field {section_name!r} must be an object")
        sections[section_name] = section

    additions: dict[str, str] = {}
    preserved: dict[str, dict[str, str]] = {}
    for dependency, required_version in sorted(required.items()):
        if not isinstance(dependency, str) or not isinstance(required_version, str):
            raise ValueError(
                "Personal UI dependency names and versions must be strings"
            )
        in_runtime = dependency in sections["dependencies"]
        in_development = dependency in sections["devDependencies"]
        if in_runtime and in_development:
            raise ValueError(
                f"package.json declares {dependency} in both dependencies and devDependencies; resolve the duplicate before installing"
            )
        if in_runtime or in_development:
            section_name = "dependencies" if in_runtime else "devDependencies"
            declared_version = sections[section_name][dependency]
            if not isinstance(declared_version, str):
                raise ValueError(
                    f"package.json declaration for {dependency} must be a string"
                )
            if declared_version != required_version:
                raise ValueError(
                    f"package.json declares incompatible {dependency} version {declared_version}; "
                    f"bundled declaration is {required_version}. Resolve the dependency before installing."
                )
            preserved[dependency] = {
                "section": section_name,
                "version": declared_version,
                "bundledVersion": required_version,
            }
            continue
        additions[dependency] = required_version

    if additions:
        runtime_dependencies = sections["dependencies"]
        runtime_dependencies.update(additions)
        updated["dependencies"] = dict(sorted(runtime_dependencies.items()))

    return updated, {"add": additions, "preserve": preserved}


def plan_build_gate(
    package: dict[str, object],
) -> tuple[dict[str, object], dict[str, object]]:
    updated = copy.deepcopy(package)
    scripts_value = updated.get("scripts", {})
    if not isinstance(scripts_value, dict):
        raise ValueError("package.json field 'scripts' must be an object")
    scripts = copy.deepcopy(scripts_value)

    existing_verifier = scripts.get(PROVENANCE_SCRIPT_NAME)
    if existing_verifier is not None and not isinstance(existing_verifier, str):
        raise ValueError(
            f"package.json script {PROVENANCE_SCRIPT_NAME!r} must be a string"
        )
    if existing_verifier not in (
        None,
        PROVENANCE_SCRIPT_COMMAND,
        CANONICAL_SOURCE_PROVENANCE_SCRIPT_COMMAND,
    ):
        raise ValueError(
            f"package.json script {PROVENANCE_SCRIPT_NAME!r} conflicts with the mandatory Personal UI gate"
        )
    scripts[PROVENANCE_SCRIPT_NAME] = PROVENANCE_SCRIPT_COMMAND

    existing_prebuild = scripts.get("prebuild")
    if existing_prebuild is not None and not isinstance(existing_prebuild, str):
        raise ValueError("package.json script 'prebuild' must be a string")
    prebuild_parts = (
        [part.strip() for part in existing_prebuild.split("&&")]
        if existing_prebuild
        else []
    )
    if PREBUILD_GATE_COMMAND not in prebuild_parts:
        scripts["prebuild"] = (
            f"{existing_prebuild} && {PREBUILD_GATE_COMMAND}"
            if existing_prebuild
            else PREBUILD_GATE_COMMAND
        )

    updated["scripts"] = scripts
    return updated, {
        "verifyScript": PROVENANCE_SCRIPT_COMMAND,
        "prebuild": scripts["prebuild"],
        "preservedPrebuild": existing_prebuild,
    }


def file_plan(
    planned_destinations: set[Path],
    *,
    delete: set[Path] | None = None,
    package_path: Path | None = None,
    package_updated: bool = False,
) -> dict[str, list[str]]:
    create = {path for path in planned_destinations if not path.exists()}
    overwrite = {path for path in planned_destinations if path.exists()}
    if package_path is not None and package_updated:
        overwrite.add(package_path)
    return {
        "create": sorted(str(path) for path in create),
        "overwrite": sorted(str(path) for path in overwrite),
        "delete": sorted(str(path) for path in (delete or set())),
    }


def copy_files(files: dict[Path, Path], destination: Path) -> None:
    for relative, source_path in files.items():
        destination_path = destination / relative
        destination_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source_path, destination_path)


def copy_file_atomic(source: Path, destination: Path) -> None:
    temporary = destination.with_name(f".{destination.name}.{uuid.uuid4().hex}.tmp")
    try:
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, temporary)
        temporary.replace(destination)
    finally:
        temporary.unlink(missing_ok=True)


def write_text_atomic(path: Path, text: str) -> None:
    temporary = path.with_name(f".{path.name}.{uuid.uuid4().hex}.tmp")
    try:
        temporary.write_text(text, encoding="utf-8")
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)


def install_starter(
    target: Path,
    *,
    registry: dict[str, object],
    force: bool,
    dry_run: bool,
) -> dict[str, object]:
    validate_target_is_independent(target)
    if is_link_like(target):
        raise ValueError(
            f"Starter destination must not be a symbolic link or junction: {target}"
        )
    if target.exists() and not target.is_dir():
        raise NotADirectoryError(f"Starter destination is not a directory: {target}")
    target_is_nonempty = target.exists() and any(target.iterdir())
    if target_is_nonempty and not force:
        raise FileExistsError(f"Starter destination is not empty: {target}")

    bundled_files = source_files(ASSET_ROOT, skip_root_registry=True)
    bundled_files.pop(Path("component-manifest.json"), None)
    for relative, source_path in support_files().items():
        bundled_files[INSTALLED_TOOL_ROOT / relative] = source_path
    manifest_relative = Path(str(registry["sourceRoot"])) / "registry.json"
    managed_relative = Path(str(registry["sourceRoot"]))
    all_relatives = set(bundled_files) | {manifest_relative}
    validate_managed_path(target, all_relatives, label="Starter destination")

    collisions = {
        relative
        for relative in all_relatives
        if (target / relative).exists() or is_link_like(target / relative)
    }
    planned = {target / relative for relative in bundled_files}
    planned.add(target / manifest_relative)
    legacy_registry = recognized_legacy_registry(target)
    source_registry = recognized_source_registry(target)
    if collisions and source_registry is None and legacy_registry is None:
        raise FileExistsError(
            "Starter --force refuses to overwrite starter-owned paths without a recognized Personal UI manifest."
        )

    managed_destination = target / managed_relative
    validate_tree_has_no_links(managed_destination, label="Existing Personal UI source")
    managed_planned = {
        target / relative
        for relative in all_relatives
        if relative == managed_relative or managed_relative in relative.parents
    }
    existing_managed = destination_files(managed_destination)
    deletions = existing_managed - managed_planned
    if legacy_registry is not None:
        deletions.add(legacy_registry)
    plan = file_plan(planned, delete=deletions)
    result: dict[str, object] = {
        "mode": "starter",
        "version": registry["version"],
        "target": str(target),
        "manifest": str(target / manifest_relative),
        "files": len(planned),
        "packageUpdated": False,
        "plan": {
            **plan,
            "dependencies": {"add": {}, "preserve": {}},
            "buildGate": {
                "verifyScript": PROVENANCE_SCRIPT_COMMAND,
                "prebuild": PREBUILD_GATE_COMMAND,
                "preservedPrebuild": None,
            },
        },
    }
    if dry_run:
        return result

    target.parent.mkdir(parents=True, exist_ok=True)
    stage_parent = Path(
        tempfile.mkdtemp(prefix=".personal-ui-starter-", dir=target.parent)
    )
    staged_root = stage_parent / "payload"
    backup_root = stage_parent / "backup"
    target_existed = target.exists()
    managed_backup = backup_root / "managed"
    root_backups: dict[Path, Path] = {}
    root_created: list[Path] = []
    managed_swapped = False
    legacy_backup: Path | None = None
    try:
        copy_files(bundled_files, staged_root)
        staged_manifest = staged_root / manifest_relative
        staged_manifest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(REGISTRY_PATH, staged_manifest)
        staged_package = staged_root / "package.json"
        package, _ = read_json_object(staged_package, label="starter package.json")
        gated_package, _ = plan_build_gate(package)
        write_text_atomic(
            staged_package,
            json.dumps(gated_package, ensure_ascii=False, indent=2) + "\n",
        )

        if not target_existed:
            staged_root.rename(target)
            return result

        root_relatives = sorted(
            relative
            for relative in all_relatives
            if relative != managed_relative and managed_relative not in relative.parents
        )
        for relative in root_relatives:
            destination_path = target / relative
            if destination_path.exists():
                backup_path = backup_root / "files" / relative
                backup_path.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(destination_path, backup_path)
                root_backups[relative] = backup_path
            else:
                root_created.append(relative)

        managed_destination.parent.mkdir(parents=True, exist_ok=True)
        if managed_destination.exists():
            managed_backup.parent.mkdir(parents=True, exist_ok=True)
            managed_destination.rename(managed_backup)
        (staged_root / managed_relative).rename(managed_destination)
        managed_swapped = True

        for relative in root_relatives:
            copy_file_atomic(staged_root / relative, target / relative)

        if legacy_registry is not None:
            legacy_backup = backup_root / "legacy-registry.json"
            legacy_backup.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(legacy_registry, legacy_backup)
            legacy_registry.unlink()
    except Exception:
        for relative in reversed(root_created):
            destination_path = target / relative
            if destination_path.is_file():
                destination_path.unlink()
        for relative, backup_path in root_backups.items():
            copy_file_atomic(backup_path, target / relative)
        if managed_swapped and managed_destination.exists():
            shutil.rmtree(managed_destination)
        if managed_backup.exists():
            managed_backup.rename(managed_destination)
        if legacy_backup is not None and legacy_backup.exists():
            copy_file_atomic(legacy_backup, target / "registry.json")
        if not target_existed and target.exists():
            shutil.rmtree(target)
        raise
    finally:
        if stage_parent.exists():
            shutil.rmtree(stage_parent)
    return result


def install_integrated(
    target: Path,
    *,
    registry: dict[str, object],
    force: bool,
    dry_run: bool,
) -> dict[str, object]:
    validate_target_is_independent(target)
    if is_link_like(target):
        raise ValueError(
            f"Project target must not be a symbolic link or junction: {target}"
        )
    package_path = target / "package.json"
    project_source = target / "src"
    if is_link_like(package_path) or is_link_like(project_source):
        raise ValueError(
            "package.json and src/ must not be symbolic links or junctions"
        )
    if not package_path.is_file() or not project_source.is_dir():
        raise FileNotFoundError(
            "Integrate mode requires package.json and src/ at the target root."
        )

    destination = target / str(registry["sourceRoot"])
    validate_tree_has_no_links(destination, label="Existing Personal UI source")
    if destination.exists() and not destination.is_dir():
        raise NotADirectoryError(
            f"Personal UI destination is not a directory: {destination}"
        )
    if destination.exists() and not force:
        raise FileExistsError(
            f"Personal UI already exists at {destination}; review local changes before --force."
        )

    bundled_support = support_files()
    support_destination = target / INSTALLED_TOOL_ROOT
    support_relatives = {
        INSTALLED_TOOL_ROOT / relative for relative in bundled_support
    }
    validate_managed_path(target, support_relatives, label="Personal UI support tools")
    validate_tree_has_no_links(
        support_destination, label="Existing Personal UI support tools"
    )
    support_collisions = {
        support_destination / relative
        for relative in bundled_support
        if (support_destination / relative).exists()
        or is_link_like(support_destination / relative)
    }
    if support_collisions and not force:
        raise FileExistsError(
            "Personal UI support tools already exist; review them before --force: "
            + ", ".join(str(path) for path in sorted(support_collisions))
        )

    package, package_text = read_json_object(package_path, label="package.json")
    required_dependencies = registry["dependencies"]
    if not isinstance(required_dependencies, dict):
        raise ValueError("Personal UI registry dependencies must be an object")
    updated_package, dependency_plan = plan_dependencies(package, required_dependencies)
    updated_package, gate_plan = plan_build_gate(updated_package)
    package_updated = updated_package != package

    bundled_files = source_files(SOURCE_KIT)
    planned_relatives = set(bundled_files)
    planned_relatives.add(Path("registry.json"))
    planned_destinations = {destination / relative for relative in planned_relatives}
    planned_destinations.update(
        support_destination / relative for relative in bundled_support
    )
    existing_destinations = destination_files(destination)
    deletions = (
        existing_destinations - planned_destinations if destination.exists() else set()
    )
    legacy_registry = recognized_legacy_registry(target)
    if legacy_registry is not None:
        deletions.add(legacy_registry)
    plan = file_plan(
        planned_destinations,
        delete=deletions,
        package_path=package_path,
        package_updated=package_updated,
    )
    result: dict[str, object] = {
        "mode": "integrate",
        "version": registry["version"],
        "target": str(target),
        "manifest": str(destination / "registry.json"),
        "files": len(planned_destinations),
        "support": sorted(
            str(support_destination / relative) for relative in bundled_support
        ),
        "packageUpdated": package_updated,
        "plan": {
            **plan,
            "dependencies": dependency_plan,
            "buildGate": gate_plan,
        },
    }
    if dry_run:
        return result

    stage_parent = Path(
        tempfile.mkdtemp(prefix=".personal-ui-stage-", dir=target.parent)
    )
    staged_destination = stage_parent / "personal-ui"
    staged_support = stage_parent / "support"
    backup: Path | None = None
    backup_moved = False
    destination_installed = False
    package_written = False
    support_backups: dict[Path, Path] = {}
    support_created: list[Path] = []
    support_destination_existed = support_destination.exists()
    support_parent_existed = support_destination.parent.exists()
    try:
        copy_files(bundled_files, staged_destination)
        shutil.copy2(REGISTRY_PATH, staged_destination / "registry.json")
        copy_files(bundled_support, staged_support)

        if destination.exists():
            backup = stage_parent / "personal-ui-backup"
            destination.rename(backup)
            backup_moved = True
        staged_destination.rename(destination)
        destination_installed = True

        for relative in sorted(bundled_support):
            destination_path = support_destination / relative
            if destination_path.exists():
                backup_path = stage_parent / "support-backup" / relative
                copy_file_atomic(destination_path, backup_path)
                support_backups[relative] = backup_path
            else:
                support_created.append(relative)
            copy_file_atomic(staged_support / relative, destination_path)

        if package_updated:
            updated_text = (
                json.dumps(updated_package, ensure_ascii=False, indent=2) + "\n"
            )
            write_text_atomic(package_path, updated_text)
            package_written = True
        if legacy_registry is not None:
            legacy_registry.unlink()
    except Exception:
        if package_written:
            write_text_atomic(package_path, package_text)
        for relative in reversed(support_created):
            destination_path = support_destination / relative
            if destination_path.is_file():
                destination_path.unlink()
        for relative, backup_path in support_backups.items():
            copy_file_atomic(backup_path, support_destination / relative)
        if (
            not support_destination_existed
            and support_destination.is_dir()
            and not any(support_destination.iterdir())
        ):
            support_destination.rmdir()
        if (
            not support_parent_existed
            and support_destination.parent.is_dir()
            and not any(support_destination.parent.iterdir())
        ):
            support_destination.parent.rmdir()
        if destination_installed:
            if destination.is_dir():
                shutil.rmtree(destination)
            elif destination.exists():
                destination.unlink()
        if backup_moved and backup is not None and backup.exists():
            backup.rename(destination)
        raise
    else:
        if backup is not None:
            shutil.rmtree(backup, ignore_errors=True)
    finally:
        if stage_parent.exists():
            shutil.rmtree(stage_parent, ignore_errors=True)
    return result


def main() -> int:
    args = parse_args()
    target = Path(os.path.abspath(args.target))
    try:
        registry = load_registry()
        result = (
            install_starter(
                target, registry=registry, force=args.force, dry_run=args.dry_run
            )
            if args.mode == "starter"
            else install_integrated(
                target, registry=registry, force=args.force, dry_run=args.dry_run
            )
        )
    except (
        FileExistsError,
        FileNotFoundError,
        NotADirectoryError,
        OSError,
        ValueError,
    ) as error:
        print(f"error: {error}", file=sys.stderr)
        return 2
    result["dryRun"] = args.dry_run
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
