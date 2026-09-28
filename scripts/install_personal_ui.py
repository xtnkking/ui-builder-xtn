#!/usr/bin/env python3
"""Install or upgrade the bundled Personal UI source in a React project."""

from __future__ import annotations

import argparse
import copy
import errno
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from personal_ui_installation import (
    DEFAULT_SOURCE_ROOT,
    STATE_RELATIVE,
    InstallationContext,
    is_link_like,
    is_within,
    normalized_absolute,
    read_json_object as read_shared_json_object,
    relative_report_path,
    resolve_context,
    validate_path_chain,
    validated_relative_path,
)
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
    "--manifest tools/personal-ui/component-manifest.json"
)
STATE_SCHEMA_VERSION = 1
PLAN_SCHEMA_VERSION = 2
SEMVER = re.compile(
    r"^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)"
    r"(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?"
    r"(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$"
)
RUNTIME_EXPORT = re.compile(r"^[A-Za-z_$][\w$]*$")
SOURCE_IGNORED_PARTS = {"node_modules", "dist", ".git", "__pycache__"}
STARTER_ROOT_FILES = {
    "component-docs.json",
    "component-manifest.json",
    "index.html",
    "package-lock.json",
    "package.json",
    "tsconfig.json",
    "vite.config.ts",
}
LEGACY_VERIFY_COMMANDS = {
    "node tools/personal-ui/verify-provenance.mjs --target . "
    "--source-root src/personal-ui --manifest tools/personal-ui/component-manifest.json",
    "node tools/personal-ui/verify-provenance.mjs --target . "
    "--source-root src/personal-ui --manifest component-manifest.json",
}
LEGACY_PREBUILD_GATE = "npm run verify:personal-ui"
LOCK_DIRECTORY_NAME = "personal-ui-installer-locks"
LOCK_RECORD_LIMIT = 8192
INTEGRATED_SUPPORT_OWNERSHIP = {
    (INSTALLED_TOOL_ROOT / "component-manifest.json").as_posix(),
    (INSTALLED_TOOL_ROOT / "verify-provenance.mjs").as_posix(),
    STATE_RELATIVE.as_posix(),
}


class InstallationConflict(RuntimeError):
    def __init__(self, report: dict[str, object]):
        super().__init__("installation plan contains unresolved conflicts")
        self.report = report


@dataclass(frozen=True)
class Mutation:
    path: Path
    relative: str
    before_hash: str | None
    desired: bytes | None
    owner: str

    @property
    def desired_hash(self) -> str | None:
        return sha256_bytes(self.desired) if self.desired is not None else None


def package_lock_path(package_root: Path) -> Path:
    physical = normalized_absolute(package_root).resolve(strict=False)
    identity = os.path.normcase(str(physical)).encode("utf-8")
    name = hashlib.sha256(identity).hexdigest() + ".lock"
    return Path(tempfile.gettempdir()) / LOCK_DIRECTORY_NAME / name


def read_lock_record(file_descriptor: int) -> dict[str, object] | None:
    os.lseek(file_descriptor, 1, os.SEEK_SET)
    payload = os.read(file_descriptor, LOCK_RECORD_LIMIT)
    if not payload:
        return None
    try:
        value = json.loads(payload.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return None
    return value if isinstance(value, dict) else None


def write_lock_record(file_descriptor: int, value: dict[str, object] | None) -> None:
    payload = b"" if value is None else canonical_json(value)
    os.lseek(file_descriptor, 0, os.SEEK_SET)
    os.write(file_descriptor, b"\0" + payload)
    os.ftruncate(file_descriptor, len(payload) + 1)
    os.fsync(file_descriptor)


def try_lock_file(file_descriptor: int) -> bool:
    os.lseek(file_descriptor, 0, os.SEEK_SET)
    if sys.platform == "win32":
        import msvcrt

        try:
            msvcrt.locking(file_descriptor, msvcrt.LK_NBLCK, 1)
        except OSError as error:
            if error.errno in (errno.EACCES, errno.EAGAIN, errno.EDEADLK):
                return False
            raise
        return True

    import fcntl

    try:
        fcntl.flock(file_descriptor, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        return False
    return True


def unlock_file(file_descriptor: int) -> None:
    os.lseek(file_descriptor, 0, os.SEEK_SET)
    if sys.platform == "win32":
        import msvcrt

        msvcrt.locking(file_descriptor, msvcrt.LK_UNLCK, 1)
        return

    import fcntl

    fcntl.flock(file_descriptor, fcntl.LOCK_UN)


class PackageInstallLock:
    """Non-blocking OS lock keyed by the package's physical path."""

    def __init__(self, package_root: Path):
        self.package_root = normalized_absolute(package_root)
        self.path = package_lock_path(self.package_root)
        self.file_descriptor: int | None = None
        self.recovered_stale_record = False

    def __enter__(self) -> PackageInstallLock:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        if is_link_like(self.path.parent) or not self.path.parent.is_dir():
            raise RuntimeError(
                f"installer lock directory is not a regular directory: {self.path.parent}"
            )
        if is_link_like(self.path):
            raise RuntimeError(f"installer lock must not be a link: {self.path}")
        flags = os.O_RDWR | os.O_CREAT | getattr(os, "O_NOFOLLOW", 0)
        file_descriptor = os.open(self.path, flags, 0o600)
        self.file_descriptor = file_descriptor
        locked = False
        try:
            if os.fstat(file_descriptor).st_size == 0:
                os.write(file_descriptor, b"\0")
                os.fsync(file_descriptor)
            if not try_lock_file(file_descriptor):
                owner = read_lock_record(file_descriptor) or {}
                owner_pid = owner.get("pid")
                detail = f" (pid {owner_pid})" if isinstance(owner_pid, int) else ""
                raise RuntimeError(
                    "another Personal UI installation is active for package"
                    f"{detail}: {self.package_root}"
                )
            locked = True
            self.recovered_stale_record = read_lock_record(file_descriptor) is not None
            write_lock_record(
                file_descriptor,
                {
                    "schemaVersion": 1,
                    "pid": os.getpid(),
                    "packageRoot": str(self.package_root.resolve(strict=False)),
                    "token": uuid.uuid4().hex,
                },
            )
            return self
        except Exception:
            if self.file_descriptor is not None:
                if locked:
                    try:
                        unlock_file(file_descriptor)
                    except OSError:
                        pass
                os.close(file_descriptor)
                self.file_descriptor = None
            raise

    def __exit__(self, exc_type: object, exc_value: object, traceback: object) -> None:
        file_descriptor = self.file_descriptor
        if file_descriptor is None:
            return
        cleanup_error: OSError | None = None
        try:
            write_lock_record(file_descriptor, None)
        except OSError as error:
            cleanup_error = error
        try:
            unlock_file(file_descriptor)
        except OSError as error:
            cleanup_error = cleanup_error or error
        finally:
            os.close(file_descriptor)
            self.file_descriptor = None
        if cleanup_error is not None and exc_type is None:
            raise cleanup_error


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mode", choices=("starter", "integrate"), required=True)
    root_group = parser.add_mutually_exclusive_group(required=True)
    root_group.add_argument(
        "--target",
        type=Path,
        help="Compatibility shorthand for a standalone project/package root.",
    )
    root_group.add_argument(
        "--project-root",
        type=Path,
        help="Repository or workspace root that bounds all installer writes.",
    )
    parser.add_argument(
        "--package-root",
        type=Path,
        help="Application package root, absolute or relative to --project-root.",
    )
    parser.add_argument(
        "--source-root",
        type=Path,
        help="Managed Personal UI path relative to the package root.",
    )
    parser.add_argument(
        "--package-manager",
        choices=("auto", "npm", "pnpm", "yarn"),
        default="auto",
    )
    parser.add_argument(
        "--framework", choices=("auto", "vite", "next"), default="auto"
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help=(
            "Replace only modified files recorded as installer-owned. "
            "Unowned files and directories are never removed."
        ),
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print a deterministic plan without writing or installing dependencies.",
    )
    return parser.parse_args()


def read_json_object(path: Path, *, label: str) -> tuple[dict[str, object], str]:
    text = path.read_text(encoding="utf-8")
    value = json.loads(text)
    if not isinstance(value, dict):
        raise ValueError(f"{label} must contain a JSON object: {path}")
    return value, text


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: Path) -> str | None:
    if not path.is_file() or is_link_like(path):
        return None
    return sha256_bytes(path.read_bytes())


def matches_file_snapshot(path: Path, expected_hash: str | None) -> bool:
    if expected_hash is None:
        return not path.exists() and not is_link_like(path)
    return sha256_file(path) == expected_hash


def canonical_json(value: object) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def quote_script_argument(value: str) -> str:
    if '"' in value or "\r" in value or "\n" in value:
        raise ValueError(f"script argument cannot be represented safely: {value!r}")
    return f'"{value}"'


def legacy_provenance_command(source_relative: Path) -> str:
    return (
        "node tools/personal-ui/verify-provenance.mjs --target . "
        f"--source-root {quote_script_argument(source_relative.as_posix())} "
        "--manifest tools/personal-ui/component-manifest.json"
    )


def provenance_command() -> str:
    return PROVENANCE_SCRIPT_COMMAND


def load_registry() -> dict[str, object]:
    if is_link_like(REGISTRY_PATH):
        raise ValueError(
            f"Personal UI registry must not be a symbolic link or junction: {REGISTRY_PATH}"
        )
    registry = read_shared_json_object(REGISTRY_PATH, label="Personal UI registry")
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
        raise ValueError("Personal UI registry version must use semantic versioning")
    exports = registry["exports"]
    if (
        not exports
        or any(
            not isinstance(name, str) or not RUNTIME_EXPORT.fullmatch(name)
            for name in exports
        )
        or len(set(exports)) != len(exports)
    ):
        raise ValueError("Personal UI registry exports must be unique runtime identifiers")
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


def is_recognized_personal_ui_registry(value: object) -> bool:
    return (
        isinstance(value, dict)
        and value.get("name") == "personal-ui"
        and isinstance(value.get("version"), str)
        and isinstance(value.get("exports"), list)
        and isinstance(value.get("dependencies"), dict)
    )


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
    home = Path.home().resolve(strict=False)
    if target_physical == home or target_physical.parent == target_physical:
        raise ValueError(
            f"installation target must not be a home or filesystem root: {target}"
        )


def source_file_map(source: Path) -> dict[Path, bytes]:
    if is_link_like(source):
        raise ValueError(
            f"Personal UI source must not be a symbolic link or junction: {source}"
        )
    files: dict[Path, bytes] = {}
    for source_path in sorted(source.rglob("*")):
        relative = source_path.relative_to(source)
        if any(part in SOURCE_IGNORED_PARTS for part in relative.parts):
            continue
        if is_link_like(source_path):
            raise ValueError(
                f"Personal UI source contains a symbolic link or junction: {source_path}"
            )
        if source_path.is_file():
            files[relative] = source_path.read_bytes()
    return files


def managed_destination(
    package_root: Path, relative: str | Path, *, label: str
) -> tuple[Path, Path]:
    safe_relative = validated_relative_path(Path(relative), label=label)
    destination = normalized_absolute(safe_relative, base=package_root)
    if not is_within(destination, package_root):
        raise ValueError(f"{label} escapes the package root: {relative}")
    if package_root.exists():
        validate_path_chain(package_root, destination, label=label)
    return safe_relative, destination


def validated_desired_files(
    package_root: Path, desired: dict[Path, bytes]
) -> dict[Path, bytes]:
    result: dict[Path, bytes] = {}
    original_by_path: dict[Path, Path] = {}
    for relative, content in desired.items():
        safe_relative, _ = managed_destination(
            package_root, relative, label="managed destination"
        )
        previous = original_by_path.get(safe_relative)
        if previous is not None and previous != relative:
            raise ValueError(
                "managed destinations collide after normalization: "
                f"{previous} and {relative}"
            )
        original_by_path[safe_relative] = relative
        result[safe_relative] = content
    return result


def validated_owned_files(
    package_root: Path, owned: dict[str, str], *, label: str
) -> dict[str, str]:
    result: dict[str, str] = {}
    original_by_path: dict[str, str] = {}
    for relative, digest in owned.items():
        if not isinstance(relative, str) or not isinstance(digest, str):
            raise ValueError(f"{label} must map relative paths to SHA-256")
        if not re.fullmatch(r"[0-9a-f]{64}", digest):
            raise ValueError(f"{label} contains an invalid SHA-256 for: {relative}")
        safe_relative, _ = managed_destination(
            package_root, relative, label=f"{label} path"
        )
        canonical = safe_relative.as_posix()
        previous = original_by_path.get(canonical)
        if previous is not None and previous != relative:
            raise ValueError(
                f"{label} contains colliding paths after normalization: "
                f"{previous} and {relative}"
            )
        original_by_path[canonical] = relative
        result[canonical] = digest
    return result


def validated_legacy_source_path(value: str) -> Path:
    if (
        not value
        or "\\" in value
        or "\x00" in value
        or value.startswith("/")
        or re.match(r"^[A-Za-z]:", value)
    ):
        raise ValueError(
            f"legacy sourceIntegrity path must be a POSIX relative path: {value!r}"
        )
    parts = value.split("/")
    if any(part in ("", ".", "..") for part in parts):
        raise ValueError(
            "legacy sourceIntegrity path must not contain empty, dot, or parent "
            f"segments: {value!r}"
        )
    return Path(*parts)


def support_file_map() -> dict[Path, bytes]:
    return {
        INSTALLED_TOOL_ROOT / "component-manifest.json": COMPONENT_MANIFEST_PATH.read_bytes(),
        INSTALLED_TOOL_ROOT / "verify-provenance.mjs": PROVENANCE_TOOL_PATH.read_bytes(),
    }


def integrated_payload(context: InstallationContext) -> dict[Path, bytes]:
    payload = {
        context.source_relative / relative: content
        for relative, content in source_file_map(SOURCE_KIT).items()
    }
    payload[context.source_relative / "registry.json"] = REGISTRY_PATH.read_bytes()
    payload.update(support_file_map())
    return payload


def starter_payload() -> dict[Path, bytes]:
    payload: dict[Path, bytes] = {}
    for name in sorted(STARTER_ROOT_FILES):
        path = ASSET_ROOT / name
        if not path.is_file() or is_link_like(path):
            raise ValueError(f"starter payload file is missing or link-like: {path}")
        payload[Path(name)] = path.read_bytes()
    for relative, content in source_file_map(ASSET_ROOT / "src").items():
        payload[Path("src") / relative] = content
    payload[DEFAULT_SOURCE_ROOT / "registry.json"] = REGISTRY_PATH.read_bytes()
    payload.update(support_file_map())
    return payload


def plan_dependencies(
    package: dict[str, object], required: dict[str, object]
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
            raise ValueError("Personal UI dependency names and versions must be strings")
        in_runtime = dependency in sections["dependencies"]
        in_development = dependency in sections["devDependencies"]
        if in_runtime and in_development:
            raise ValueError(
                f"package.json declares {dependency} in both dependencies and devDependencies"
            )
        if in_runtime or in_development:
            section_name = "dependencies" if in_runtime else "devDependencies"
            declared = sections[section_name][dependency]
            if not isinstance(declared, str):
                raise ValueError(
                    f"package.json declaration for {dependency} must be a string"
                )
            if declared != required_version:
                raise ValueError(
                    f"package.json declares incompatible {dependency} version {declared}; "
                    f"bundled declaration is {required_version}"
                )
            preserved[dependency] = {
                "section": section_name,
                "version": declared,
                "bundledVersion": required_version,
            }
            continue
        additions[dependency] = required_version
    if additions:
        runtime = sections["dependencies"]
        runtime.update(additions)
        updated["dependencies"] = dict(sorted(runtime.items()))
    return updated, {"add": additions, "preserve": preserved}


def strip_legacy_prebuild(prebuild: object) -> object:
    if not isinstance(prebuild, str):
        return prebuild
    parts = [part.strip() for part in prebuild.split("&&")]
    remaining = [part for part in parts if part != LEGACY_PREBUILD_GATE]
    return " && ".join(remaining) if remaining else None


def unwrap_managed_build(build: str, commands: set[str]) -> str | None:
    for command in sorted(commands, key=len, reverse=True):
        prefix = f"{command} && "
        if build.startswith(prefix):
            return build[len(prefix) :]
    return None


def plan_build_gate(
    package: dict[str, object],
    source_relative: Path,
    previous_state: dict[str, object] | None,
) -> tuple[dict[str, object], dict[str, object], dict[str, object]]:
    updated = copy.deepcopy(package)
    scripts_value = updated.get("scripts")
    if not isinstance(scripts_value, dict):
        raise ValueError("package.json scripts must be an object with a build command")
    scripts = copy.deepcopy(scripts_value)
    build = scripts.get("build")
    if not isinstance(build, str) or not build.strip():
        raise ValueError("package.json script 'build' must be a non-empty string")
    existing_verify = scripts.get(PROVENANCE_SCRIPT_NAME)
    if existing_verify is not None and not isinstance(existing_verify, str):
        raise ValueError(
            f"package.json script {PROVENANCE_SCRIPT_NAME!r} must be a string"
        )

    command = provenance_command()
    known_commands = set(LEGACY_VERIFY_COMMANDS) | {
        command,
        legacy_provenance_command(source_relative),
    }
    previous_package = (
        previous_state.get("packageChanges")
        if isinstance(previous_state, dict)
        and isinstance(previous_state.get("packageChanges"), dict)
        else {}
    )
    if isinstance(previous_package, dict):
        installed_verify = previous_package.get("installedVerify")
        if isinstance(installed_verify, str):
            recorded_source = previous_state.get("sourceRoot") if previous_state else None
            if isinstance(recorded_source, str):
                recorded_relative = validated_relative_path(
                    Path(recorded_source), label="install state sourceRoot"
                )
                known_commands.add(legacy_provenance_command(recorded_relative))
            if installed_verify not in known_commands:
                raise ValueError(
                    "install state packageChanges.installedVerify is not a recognized "
                    "Personal UI provenance command"
                )
            known_commands.add(installed_verify)
    original_build = unwrap_managed_build(build, known_commands) or build
    installed_build = f"{command} && {original_build}"
    scripts["build"] = installed_build
    scripts[PROVENANCE_SCRIPT_NAME] = command

    existing_prebuild = scripts.get("prebuild")
    cleaned_prebuild = strip_legacy_prebuild(existing_prebuild)
    if cleaned_prebuild is None:
        scripts.pop("prebuild", None)
    else:
        scripts["prebuild"] = cleaned_prebuild
    updated["scripts"] = scripts

    initial_original_build = original_build
    initial_verify = existing_verify
    initial_prebuild = existing_prebuild
    if isinstance(previous_package, dict):
        value = previous_package.get("originalBuild")
        if isinstance(value, str):
            initial_original_build = value
        if "originalVerify" in previous_package:
            initial_verify = previous_package.get("originalVerify")
        if "originalPrebuild" in previous_package:
            initial_prebuild = previous_package.get("originalPrebuild")
    state = {
        "originalBuild": initial_original_build,
        "installedBuild": installed_build,
        "originalVerify": initial_verify,
        "installedVerify": command,
        "originalPrebuild": initial_prebuild,
        "installedPrebuild": cleaned_prebuild,
    }
    report = {
        "verifyScript": command,
        "build": installed_build,
        "preservedBuild": original_build,
        "prebuild": cleaned_prebuild,
        "removedLegacyNpmPrebuildGate": existing_prebuild != cleaned_prebuild,
    }
    return updated, report, state


def dependency_commands(context: InstallationContext, package: dict[str, object]) -> dict[str, object]:
    package_name = package.get("name") if isinstance(package.get("name"), str) else None
    if context.package_manager == "npm":
        install = ["npm", "install"]
        build = ["npm", "run", "build"]
        if context.workspace:
            if not package_name:
                raise ValueError("npm workspace package.json must declare a name")
            build.extend(["--workspace", package_name])
    elif context.package_manager == "pnpm":
        install = ["pnpm", "install"]
        build = ["pnpm", "run", "build"]
        if context.workspace:
            selector = package_name or relative_report_path(
                context.package_root, context.project_root
            )
            build = ["pnpm", "--filter", selector, "run", "build"]
    else:
        install = ["yarn", "install"]
        build = ["yarn", "run", "build"]
        if context.workspace:
            if not package_name:
                raise ValueError("Yarn workspace package.json must declare a name")
            build = ["yarn", "workspace", package_name, "run", "build"]
    return {
        "install": {"cwd": ".", "argv": install, "executed": False},
        "build": {"cwd": ".", "argv": build, "executed": False},
        "note": "The installer never installs dependencies during dry-run or apply; run these commands after commit.",
    }


def load_install_state(package_root: Path) -> tuple[dict[str, object] | None, bytes | None]:
    _, path = managed_destination(
        package_root, STATE_RELATIVE, label="install state"
    )
    if not path.exists():
        return None, None
    if is_link_like(path) or not path.is_file():
        raise ValueError(f"install state must be a regular file: {path}")
    raw = path.read_bytes()
    try:
        value = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ValueError(f"invalid Personal UI install state: {error}") from error
    if not isinstance(value, dict) or value.get("schemaVersion") != STATE_SCHEMA_VERSION:
        raise ValueError("unsupported Personal UI install state schema")
    owned = value.get("ownedFiles")
    if not isinstance(owned, dict) or any(
        not isinstance(path, str)
        or not isinstance(digest, str)
        or not re.fullmatch(r"[0-9a-f]{64}", digest)
        for path, digest in owned.items()
    ):
        raise ValueError("install state ownedFiles must map relative paths to SHA-256")
    return value, raw


def validate_install_state_context(
    context: InstallationContext,
    state: dict[str, object],
    *,
    allow_source_migration: bool,
) -> Path:
    version = state.get("version")
    if not isinstance(version, str) or not SEMVER.fullmatch(version):
        raise ValueError("install state version must use semantic versioning")

    expected_package = relative_report_path(context.package_root, context.project_root)
    if state.get("packageRoot") != expected_package:
        raise ValueError(
            "install state packageRoot does not match the resolved package root: "
            f"expected {expected_package!r}"
        )
    if state.get("packageManager") != context.package_manager:
        raise ValueError(
            "install state packageManager does not match project detection: "
            f"expected {context.package_manager!r}"
        )
    if state.get("framework") != context.framework:
        raise ValueError(
            "install state framework does not match project detection: "
            f"expected {context.framework!r}"
        )

    source_value = state.get("sourceRoot")
    if not isinstance(source_value, str):
        raise ValueError("install state sourceRoot must be a relative POSIX path")
    recorded_source = validated_relative_path(
        Path(source_value), label="install state sourceRoot"
    )
    if recorded_source.as_posix() != source_value:
        raise ValueError("install state sourceRoot must use its canonical POSIX form")
    recorded_root = normalized_absolute(recorded_source, base=context.package_root)
    validate_path_chain(
        context.package_root, recorded_root, label="install state sourceRoot"
    )
    if recorded_source != context.source_relative and not allow_source_migration:
        raise ValueError(
            "install state sourceRoot does not match the resolved source root: "
            f"expected {context.source_relative.as_posix()!r}"
        )

    manifest_digest = state.get("manifestSha256")
    if not isinstance(manifest_digest, str) or not re.fullmatch(
        r"[0-9a-f]{64}", manifest_digest
    ):
        raise ValueError("install state manifestSha256 must be a SHA-256 digest")
    if not isinstance(state.get("packageChanges"), dict):
        raise ValueError("install state packageChanges must be an object")
    return recorded_source


def is_path_within(relative: Path, root: Path) -> bool:
    try:
        remainder = relative.relative_to(root)
    except ValueError:
        return False
    return bool(remainder.parts)


def validated_state_owned_files(
    context: InstallationContext,
    state: dict[str, object],
    *,
    mode: str,
    allow_source_migration: bool = False,
    starter_allowlist: set[str] | None = None,
) -> dict[str, str]:
    if state.get("mode") != mode:
        raise ValueError(
            f"install state mode does not match installer mode: expected {mode!r}"
        )
    recorded_source = validate_install_state_context(
        context, state, allow_source_migration=allow_source_migration
    )
    owned_value = state.get("ownedFiles")
    if not isinstance(owned_value, dict):
        raise ValueError("install state ownedFiles must be an object")
    owned = validated_owned_files(
        context.package_root,
        owned_value,
        label="install state ownedFiles",
    )

    if mode == "starter":
        if starter_allowlist is None:
            raise ValueError("starter ownership validation requires an explicit allowlist")
        allowed = set(starter_allowlist) | {STATE_RELATIVE.as_posix()}
        invalid = sorted(set(owned) - allowed)
    elif mode == "integrate":
        roots = {context.source_relative, recorded_source}
        invalid = sorted(
            relative
            for relative in owned
            if relative not in INTEGRATED_SUPPORT_OWNERSHIP
            and not any(is_path_within(Path(relative), root) for root in roots)
        )
    else:
        raise ValueError(f"unknown install state ownership mode: {mode}")
    if invalid:
        raise ValueError(
            f"install state ownedFiles contains paths outside the {mode} ownership allowlist: "
            + ", ".join(invalid)
        )

    # The state file is updated by its dedicated transaction mutation. It must
    # never enter source retirement/deletion classification through ownedFiles.
    owned.pop(STATE_RELATIVE.as_posix(), None)
    return owned


def resolve_integrated_context(
    *,
    target: Path | None,
    project_root: Path | None,
    package_root: Path | None,
    source_root: Path | None,
    package_manager: str,
    framework: str,
) -> InstallationContext:
    context = resolve_context(
        target=target,
        project_root=project_root,
        package_root=package_root,
        source_root=source_root,
        package_manager=package_manager,
        framework=framework,
    )
    if source_root is not None:
        return context

    state, _ = load_install_state(context.package_root)
    if state is None:
        return context
    recorded_source = validate_install_state_context(
        context, state, allow_source_migration=True
    )
    if recorded_source == context.source_relative:
        validated_state_owned_files(context, state, mode="integrate")
        return context

    restored = resolve_context(
        target=target,
        project_root=project_root,
        package_root=package_root,
        source_root=recorded_source,
        package_manager=package_manager,
        framework=framework,
    )
    validated_state_owned_files(restored, state, mode="integrate")
    return restored


def legacy_owned_files(context: InstallationContext) -> dict[str, str]:
    _, registry_path = managed_destination(
        context.package_root,
        context.source_relative / "registry.json",
        label="legacy registry",
    )
    if not registry_path.is_file() or is_link_like(registry_path):
        return {}
    try:
        registry = read_shared_json_object(registry_path, label="installed registry")
    except (OSError, UnicodeDecodeError, json.JSONDecodeError, ValueError):
        return {}
    if not is_recognized_personal_ui_registry(registry):
        return {}
    owned: dict[str, str] = {}
    _, manifest_path = managed_destination(
        context.package_root,
        INSTALLED_TOOL_ROOT / "component-manifest.json",
        label="legacy component manifest",
    )
    if manifest_path.is_file() and not is_link_like(manifest_path):
        try:
            manifest = read_shared_json_object(
                manifest_path, label="installed component manifest"
            )
        except (OSError, UnicodeDecodeError, json.JSONDecodeError, ValueError):
            manifest = {}
        integrity = manifest.get("sourceIntegrity")
        if isinstance(integrity, dict):
            for relative, digest in integrity.items():
                if not isinstance(relative, str) or not isinstance(digest, str):
                    raise ValueError(
                        "legacy sourceIntegrity must map relative paths to SHA-256"
                    )
                source_relative = validated_legacy_source_path(relative)
                if not re.fullmatch(r"[0-9a-f]{64}", digest):
                    raise ValueError(
                        "legacy sourceIntegrity contains an invalid SHA-256 for: "
                        + relative
                    )
                owned[
                    (context.source_relative / source_relative).as_posix()
                ] = digest
    _, provenance_path = managed_destination(
        context.package_root,
        INSTALLED_TOOL_ROOT / "verify-provenance.mjs",
        label="legacy provenance verifier",
    )
    for path in (
        registry_path,
        manifest_path,
        provenance_path,
    ):
        digest = sha256_file(path)
        if digest is not None:
            owned[relative_report_path(path, context.package_root)] = digest
    legacy_registry = context.package_root / "registry.json"
    if legacy_registry.is_file() and not is_link_like(legacy_registry):
        try:
            legacy = read_shared_json_object(legacy_registry, label="legacy registry")
        except (OSError, UnicodeDecodeError, json.JSONDecodeError, ValueError):
            legacy = None
        if is_recognized_personal_ui_registry(legacy):
            digest = sha256_file(legacy_registry)
            if digest is not None:
                owned["registry.json"] = digest
    return validated_owned_files(
        context.package_root, owned, label="legacy ownership manifest"
    )


def safe_owned_paths(package_root: Path, value: dict[str, object]) -> dict[str, str]:
    owned = value.get("ownedFiles")
    if not isinstance(owned, dict):
        return {}
    return validated_owned_files(
        package_root,
        owned,
        label="install state ownedFiles",
    )


def classify_files(
    package_root: Path,
    desired: dict[Path, bytes],
    old_owned: dict[str, str],
    *,
    force: bool,
) -> tuple[list[Mutation], dict[str, list[dict[str, object]]], list[dict[str, object]]]:
    desired = validated_desired_files(package_root, desired)
    old_owned = validated_owned_files(
        package_root, old_owned, label="owned file inventory"
    )
    actions: dict[str, list[dict[str, object]]] = {
        "create": [], "update": [], "delete": [], "unchanged": []
    }
    conflicts: list[dict[str, object]] = []
    mutations: list[Mutation] = []
    desired_by_name = {path.as_posix(): content for path, content in desired.items()}
    for relative in sorted(desired_by_name):
        content = desired_by_name[relative]
        path = package_root / Path(relative)
        if is_link_like(path):
            conflicts.append(
                {"path": relative, "reason": "link-like-destination", "forceable": False}
            )
            continue
        current = sha256_file(path)
        wanted = sha256_bytes(content)
        expected = old_owned.get(relative)
        detail: dict[str, object] = {
            "path": relative,
            "beforeSha256": current,
            "afterSha256": wanted,
            "owner": "personal-ui",
        }
        if current == wanted:
            actions["unchanged"].append(detail)
        elif current is None and not path.exists():
            actions["create"].append(detail)
            mutations.append(Mutation(path, relative, None, content, "personal-ui"))
        elif expected is not None and current == expected:
            actions["update"].append(detail)
            mutations.append(Mutation(path, relative, current, content, "personal-ui"))
        elif expected is not None and force:
            detail["forced"] = True
            actions["update"].append(detail)
            mutations.append(Mutation(path, relative, current, content, "personal-ui"))
        else:
            conflicts.append(
                {
                    **detail,
                    "ownedSha256": expected,
                    "reason": "modified-owned-file" if expected else "unowned-collision",
                    "forceable": expected is not None,
                }
            )
    for relative in sorted(set(old_owned) - set(desired_by_name)):
        path = package_root / Path(relative)
        current = sha256_file(path)
        if current is None and not path.exists():
            continue
        expected = old_owned[relative]
        detail = {
            "path": relative,
            "beforeSha256": current,
            "afterSha256": None,
            "owner": "personal-ui",
        }
        if current == expected or force:
            if force and current != expected:
                detail["forced"] = True
            actions["delete"].append(detail)
            mutations.append(Mutation(path, relative, current, None, "personal-ui"))
        else:
            conflicts.append(
                {
                    **detail,
                    "ownedSha256": expected,
                    "reason": "modified-owned-file",
                    "forceable": True,
                }
            )
    return mutations, actions, conflicts


def find_unowned_source_files(
    context: InstallationContext,
    desired: dict[Path, bytes],
    old_owned: dict[str, str],
) -> list[dict[str, object]]:
    if not context.source_root.is_dir() or is_link_like(context.source_root):
        return []
    desired_names = {path.as_posix() for path in desired}
    conflicts: list[dict[str, object]] = []
    for path in sorted(context.source_root.rglob("*")):
        if not path.is_file() and not is_link_like(path):
            continue
        relative = relative_report_path(path, context.package_root)
        if relative in desired_names or relative in old_owned:
            continue
        conflicts.append(
            {
                "path": relative,
                "reason": "unowned-file-inside-managed-source",
                "forceable": False,
                "beforeSha256": sha256_file(path),
                "afterSha256": None,
            }
        )
    return conflicts


def make_state(
    context: InstallationContext,
    registry: dict[str, object],
    desired: dict[Path, bytes],
    package_state: dict[str, object],
    *,
    mode: str,
) -> dict[str, object]:
    return {
        "schemaVersion": STATE_SCHEMA_VERSION,
        "mode": mode,
        "version": registry["version"],
        "packageRoot": relative_report_path(context.package_root, context.project_root),
        "sourceRoot": context.source_relative.as_posix(),
        "packageManager": context.package_manager,
        "framework": context.framework,
        "manifestSha256": sha256_file(COMPONENT_MANIFEST_PATH),
        "ownedFiles": {
            relative.as_posix(): sha256_bytes(content)
            for relative, content in sorted(desired.items(), key=lambda item: item[0].as_posix())
        },
        "packageChanges": package_state,
    }


def plan_digest(plan: dict[str, object]) -> str:
    return sha256_bytes(
        json.dumps(plan, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    )


def operation_for(
    state: dict[str, object] | None,
    legacy_owned: dict[str, str],
    mutations: list[Mutation],
    state_changed: bool,
) -> str:
    if state is None and not legacy_owned:
        return "install"
    if not mutations and not state_changed:
        return "noop"
    return "upgrade"


def make_report(
    *,
    mode: str,
    context: InstallationContext,
    registry: dict[str, object],
    operation: str,
    actions: dict[str, list[dict[str, object]]],
    conflicts: list[dict[str, object]],
    dependency_plan: dict[str, object],
    gate_plan: dict[str, object],
    commands: dict[str, object],
    package_updated: bool,
    state_changed: bool,
) -> dict[str, object]:
    stable_context = context.report()
    stable_context["projectRoot"] = "."
    plan: dict[str, object] = {
        "schemaVersion": PLAN_SCHEMA_VERSION,
        "operation": operation,
        "context": stable_context,
        "files": actions,
        "create": [item["path"] for item in actions["create"]],
        "overwrite": [item["path"] for item in actions["update"]],
        "delete": [item["path"] for item in actions["delete"]],
        "conflicts": sorted(conflicts, key=lambda item: str(item.get("path"))),
        "dependencies": dependency_plan,
        "buildGate": gate_plan,
        "commands": commands,
        "packageUpdated": package_updated,
        "stateUpdated": state_changed,
    }
    plan["planDigest"] = plan_digest(plan)
    return {
        "mode": mode,
        "operation": operation,
        "version": registry["version"],
        "target": str(context.package_root),
        "projectRoot": str(context.project_root),
        "packageRoot": str(context.package_root),
        "sourceRoot": str(context.source_root),
        "manifest": str(context.source_root / "registry.json"),
        "files": sum(len(items) for items in actions.values()),
        "packageUpdated": package_updated,
        "plan": plan,
    }


def write_bytes_atomic(path: Path, value: bytes) -> None:
    temporary = path.with_name(f".{path.name}.{uuid.uuid4().hex}.tmp")
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary.write_bytes(value)
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)


def inject_failure(point: str, failure_point: str | None) -> None:
    if point == failure_point:
        raise RuntimeError(f"injected installer failure at {point}")


def execute_transaction(
    package_root: Path,
    mutations: list[Mutation],
    *,
    failure_point: str | None = None,
    validator: Callable[[], None] | None = None,
) -> None:
    if not mutations:
        return
    with PackageInstallLock(package_root):
        stage_parent = Path(
            tempfile.mkdtemp(
                prefix=".personal-ui-transaction-", dir=package_root.parent
            )
        )
        staged = stage_parent / "staged"
        backups = stage_parent / "backups"
        applied: list[tuple[Mutation, bytes | None]] = []
        created_directories: set[Path] = set()
        rollback_conflicts: list[str] = []
        try:
            for mutation in mutations:
                safe_relative, safe_destination = managed_destination(
                    package_root, mutation.relative, label="transaction destination"
                )
                if (
                    safe_relative.as_posix() != mutation.relative
                    or safe_destination != normalized_absolute(mutation.path)
                ):
                    raise ValueError(
                        "transaction mutation has an unsafe destination: "
                        + mutation.relative
                    )
                if mutation.desired is not None:
                    stage_path = staged / Path(mutation.relative)
                    stage_path.parent.mkdir(parents=True, exist_ok=True)
                    stage_path.write_bytes(mutation.desired)
                    if sha256_file(stage_path) != mutation.desired_hash:
                        raise OSError(
                            f"staged file hash mismatch: {mutation.relative}"
                        )
            inject_failure("copy", failure_point)
            inject_failure("dependencies", failure_point)
            for mutation in mutations:
                # A bulk precheck leaves later files exposed while earlier ones apply.
                # Keep both boundary and content checks adjacent to this mutation.
                _, safe_destination = managed_destination(
                    package_root, mutation.relative, label="transaction destination"
                )
                if safe_destination != normalized_absolute(mutation.path):
                    raise ValueError(
                        "transaction mutation changed destination: "
                        + mutation.relative
                    )
                if not matches_file_snapshot(
                    safe_destination, mutation.before_hash
                ):
                    raise RuntimeError(
                        "installation input changed after planning: "
                        + mutation.relative
                    )
                before = (
                    safe_destination.read_bytes()
                    if mutation.before_hash is not None
                    else None
                )
                if before is not None and sha256_bytes(before) != mutation.before_hash:
                    raise RuntimeError(
                        "installation input changed during apply: " + mutation.relative
                    )
                if before is not None:
                    backup = backups / Path(mutation.relative)
                    backup.parent.mkdir(parents=True, exist_ok=True)
                    backup.write_bytes(before)
                elif mutation.desired is not None:
                    parent = safe_destination.parent
                    while parent != package_root and is_within(parent, package_root):
                        if not parent.exists():
                            created_directories.add(parent)
                        parent = parent.parent
                if mutation.desired is not None:
                    safe_destination.parent.mkdir(parents=True, exist_ok=True)
                _, final_destination = managed_destination(
                    package_root, mutation.relative, label="transaction destination"
                )
                if (
                    final_destination != safe_destination
                    or not matches_file_snapshot(
                        final_destination, mutation.before_hash
                    )
                ):
                    raise RuntimeError(
                        "installation input changed during apply: "
                        + mutation.relative
                    )
                if mutation.desired is None:
                    final_destination.unlink(missing_ok=True)
                else:
                    write_bytes_atomic(final_destination, mutation.desired)
                applied.append((mutation, before))
                if mutation.owner == "package-json":
                    inject_failure("package", failure_point)
            if validator is not None:
                validator()
            inject_failure("verify", failure_point)
            inject_failure("commit", failure_point)
        except Exception as error:
            for mutation, before in reversed(applied):
                try:
                    _, safe_destination = managed_destination(
                        package_root,
                        mutation.relative,
                        label="rollback destination",
                    )
                    if safe_destination != normalized_absolute(mutation.path):
                        raise ValueError(
                            "rollback mutation changed destination: "
                            + mutation.relative
                        )
                    current = sha256_file(safe_destination)
                    expected = mutation.desired_hash
                    unchanged_since_apply = (
                        not safe_destination.exists()
                        and not is_link_like(safe_destination)
                        if mutation.desired is None
                        else current == expected
                    )
                    if not unchanged_since_apply:
                        rollback_conflicts.append(mutation.relative)
                        continue
                    if before is None:
                        safe_destination.unlink(missing_ok=True)
                    else:
                        write_bytes_atomic(safe_destination, before)
                except (OSError, RuntimeError, ValueError):
                    rollback_conflicts.append(mutation.relative)
            for parent in sorted(
                created_directories,
                key=lambda path: len(path.parts),
                reverse=True,
            ):
                try:
                    relative = parent.relative_to(package_root)
                    _, safe_parent = managed_destination(
                        package_root, relative, label="rollback directory"
                    )
                    safe_parent.rmdir()
                except (OSError, RuntimeError, ValueError):
                    continue
            if rollback_conflicts:
                raise RuntimeError(
                    f"{error}; rollback preserved concurrent changes in: "
                    + ", ".join(sorted(set(rollback_conflicts)))
                ) from error
            raise
        finally:
            shutil.rmtree(stage_parent, ignore_errors=True)


def validate_applied_payload(
    package_root: Path,
    desired: dict[Path, bytes],
    package_path: Path,
    package_bytes: bytes,
    state_path: Path,
    state_bytes: bytes,
) -> None:
    for relative, content in desired.items():
        if sha256_file(package_root / relative) != sha256_bytes(content):
            raise RuntimeError(f"installed file hash mismatch: {relative.as_posix()}")
    if sha256_file(package_path) != sha256_bytes(package_bytes):
        raise RuntimeError("installed package.json hash mismatch")
    if sha256_file(state_path) != sha256_bytes(state_bytes):
        raise RuntimeError("installed state hash mismatch")


def plan_integrated(
    context: InstallationContext,
    registry: dict[str, object],
    *,
    force: bool,
    allow_source_migration: bool = False,
) -> tuple[dict[str, object], list[Mutation], dict[Path, bytes], bytes, bytes]:
    validate_target_is_independent(context.project_root)
    validate_path_chain(context.project_root, context.package_root, label="package root")
    validate_path_chain(context.package_root, context.source_root, label="source root")
    package_path = context.package_root / "package.json"
    package, _ = read_json_object(package_path, label="package.json")
    desired = validated_desired_files(
        context.package_root, integrated_payload(context)
    )
    state, state_raw = load_install_state(context.package_root)
    legacy_owned = legacy_owned_files(context)
    old_owned = (
        validated_state_owned_files(
            context,
            state,
            mode="integrate",
            allow_source_migration=allow_source_migration,
        )
        if state
        else legacy_owned
    )
    required_dependencies = registry.get("dependencies")
    if not isinstance(required_dependencies, dict):
        raise ValueError("Personal UI registry dependencies must be an object")
    updated_package, dependency_plan = plan_dependencies(package, required_dependencies)
    updated_package, gate_plan, package_state = plan_build_gate(
        updated_package, context.source_relative, state
    )
    package_bytes = canonical_json(updated_package)
    current_package_bytes = package_path.read_bytes()
    package_updated = current_package_bytes != package_bytes
    file_mutations, actions, conflicts = classify_files(
        context.package_root, desired, old_owned, force=force
    )
    conflicts.extend(find_unowned_source_files(context, desired, old_owned))
    new_state = make_state(
        context, registry, desired, package_state, mode="integrate"
    )
    state_bytes = canonical_json(new_state)
    state_path = context.package_root / STATE_RELATIVE
    state_changed = state_raw != state_bytes
    if state_changed:
        file_mutations.append(
            Mutation(
                state_path,
                STATE_RELATIVE.as_posix(),
                sha256_file(state_path),
                state_bytes,
                "install-state",
            )
        )
        actions["create" if not state_path.exists() else "update"].append(
            {
                "path": STATE_RELATIVE.as_posix(),
                "beforeSha256": sha256_file(state_path),
                "afterSha256": sha256_bytes(state_bytes),
                "owner": "install-state",
            }
        )
    if package_updated:
        file_mutations.append(
            Mutation(
                package_path,
                "package.json",
                sha256_bytes(current_package_bytes),
                package_bytes,
                "package-json",
            )
        )
        actions["update"].append(
            {
                "path": "package.json",
                "beforeSha256": sha256_bytes(current_package_bytes),
                "afterSha256": sha256_bytes(package_bytes),
                "owner": "package-json",
            }
        )
    operation = operation_for(state, legacy_owned, file_mutations, state_changed)
    report = make_report(
        mode="integrate",
        context=context,
        registry=registry,
        operation=operation,
        actions=actions,
        conflicts=conflicts,
        dependency_plan=dependency_plan,
        gate_plan=gate_plan,
        commands=dependency_commands(context, updated_package),
        package_updated=package_updated,
        state_changed=state_changed,
    )
    return report, file_mutations, desired, package_bytes, state_bytes


def install_integrated(
    context: InstallationContext,
    *,
    registry: dict[str, object],
    force: bool,
    dry_run: bool,
    allow_source_migration: bool = False,
    failure_point: str | None = None,
) -> dict[str, object]:
    report, mutations, desired, package_bytes, state_bytes = plan_integrated(
        context,
        registry,
        force=force,
        allow_source_migration=allow_source_migration,
    )
    conflicts = report["plan"].get("conflicts", [])
    if conflicts:
        raise InstallationConflict(report)
    if dry_run or report["operation"] == "noop":
        return report
    package_path = context.package_root / "package.json"
    state_path = context.package_root / STATE_RELATIVE
    execute_transaction(
        context.package_root,
        mutations,
        failure_point=failure_point,
        validator=lambda: validate_applied_payload(
            context.package_root,
            desired,
            package_path,
            package_bytes,
            state_path,
            state_bytes,
        ),
    )
    return report


def starter_context(target: Path) -> InstallationContext:
    return InstallationContext(
        project_root=target,
        package_root=target,
        source_root=target / DEFAULT_SOURCE_ROOT,
        source_relative=DEFAULT_SOURCE_ROOT,
        package_manager="npm",
        framework="vite",
        lockfile=target / "package-lock.json",
        workspace=False,
        manager_evidence=("starter=npm",),
        framework_evidence=("starter=vite",),
    )


def install_starter(
    target: Path,
    *,
    registry: dict[str, object],
    force: bool,
    dry_run: bool,
    failure_point: str | None = None,
) -> dict[str, object]:
    validate_target_is_independent(target)
    if is_link_like(target):
        raise ValueError(f"starter target must not be a symbolic link or junction: {target}")
    if target.exists() and not target.is_dir():
        raise NotADirectoryError(f"starter target is not a directory: {target}")
    context = starter_context(target)
    payload = validated_desired_files(target, starter_payload())
    package = json.loads(payload[Path("package.json")].decode("utf-8"))
    if not isinstance(package, dict):
        raise ValueError("starter package.json must be an object")
    updated_package, dependency_plan = plan_dependencies(package, registry["dependencies"])
    updated_package, gate_plan, package_state = plan_build_gate(
        updated_package, DEFAULT_SOURCE_ROOT, None
    )
    package_bytes = canonical_json(updated_package)
    payload[Path("package.json")] = package_bytes
    state, state_raw = load_install_state(target) if target.exists() else (None, None)
    old_owned = (
        validated_state_owned_files(
            context,
            state,
            mode="starter",
            starter_allowlist={path.as_posix() for path in payload},
        )
        if state
        else legacy_owned_files(context)
    )
    if target.exists() and any(target.iterdir()) and not state and not old_owned:
        report = {
            "mode": "starter",
            "operation": "conflict",
            "version": registry["version"],
            "target": str(target),
            "plan": {
                "schemaVersion": PLAN_SCHEMA_VERSION,
                "conflicts": [
                    {
                        "path": ".",
                        "reason": "non-empty-unrecognized-starter-target",
                        "forceable": False,
                    }
                ],
            },
        }
        raise InstallationConflict(report)
    mutations, actions, conflicts = classify_files(target, payload, old_owned, force=force)
    new_state = make_state(
        context, registry, payload, package_state, mode="starter"
    )
    state_bytes = canonical_json(new_state)
    state_path = target / STATE_RELATIVE
    state_changed = state_raw != state_bytes
    if state_changed:
        mutations.append(
            Mutation(
                state_path,
                STATE_RELATIVE.as_posix(),
                sha256_file(state_path),
                state_bytes,
                "install-state",
            )
        )
        actions["create" if not state_path.exists() else "update"].append(
            {
                "path": STATE_RELATIVE.as_posix(),
                "beforeSha256": sha256_file(state_path),
                "afterSha256": sha256_bytes(state_bytes),
                "owner": "install-state",
            }
        )
    operation = operation_for(state, old_owned, mutations, state_changed)
    report = make_report(
        mode="starter",
        context=context,
        registry=registry,
        operation=operation,
        actions=actions,
        conflicts=conflicts,
        dependency_plan=dependency_plan,
        gate_plan=gate_plan,
        commands=dependency_commands(context, updated_package),
        package_updated=True,
        state_changed=state_changed,
    )
    if conflicts:
        raise InstallationConflict(report)
    if dry_run or operation == "noop":
        return report
    target.mkdir(parents=True, exist_ok=True)
    execute_transaction(
        target,
        mutations,
        failure_point=failure_point,
        validator=lambda: validate_applied_payload(
            target,
            payload,
            target / "package.json",
            package_bytes,
            state_path,
            state_bytes,
        ),
    )
    return report


def main() -> int:
    args = parse_args()
    try:
        registry = load_registry()
        if args.mode == "starter":
            if args.project_root is not None or args.package_root is not None:
                raise ValueError("starter mode accepts --target only")
            if args.source_root is not None:
                raise ValueError("starter mode uses the bundled src/personal-ui source root")
            if args.package_manager not in ("auto", "npm"):
                raise ValueError("starter mode uses npm; use integrate mode for another manager")
            if args.framework not in ("auto", "vite"):
                raise ValueError("starter mode uses Vite; use integrate mode for Next.js")
            target = normalized_absolute(args.target)
            result = install_starter(
                target, registry=registry, force=args.force, dry_run=args.dry_run
            )
        else:
            context = resolve_integrated_context(
                target=args.target,
                project_root=args.project_root,
                package_root=args.package_root,
                source_root=args.source_root,
                package_manager=args.package_manager,
                framework=args.framework,
            )
            result = install_integrated(
                context,
                registry=registry,
                force=args.force,
                dry_run=args.dry_run,
                allow_source_migration=args.source_root is not None,
            )
    except InstallationConflict as error:
        error.report["dryRun"] = args.dry_run
        print(json.dumps(error.report, ensure_ascii=False, indent=2))
        return 3
    except (
        FileExistsError,
        FileNotFoundError,
        NotADirectoryError,
        OSError,
        RuntimeError,
        ValueError,
    ) as error:
        print(f"error: {error}", file=sys.stderr)
        return 2
    result["dryRun"] = args.dry_run
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
