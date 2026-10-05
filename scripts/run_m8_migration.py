#!/usr/bin/env python3
"""Run the official M8 v0.2.19 consumer migration against one frozen RC.

The runner deliberately works outside the repository. It exports the immutable
baseline tag, installs that Skill into a realistic consumer, records the
pre-upgrade result, upgrades with the installer from the verified candidate,
applies the documented consumer migration, and writes hash-bound evidence.
"""

from __future__ import annotations

import argparse
import difflib
import hashlib
import io
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import tarfile
import time
import zipfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from typing import Any, Iterable, Mapping, Sequence

import release_personal_ui as release


SCHEMA_VERSION = 1
REPORT_KIND = "personal-ui-m8-migration-report"
INVENTORY_KIND = "personal-ui-m8-migration-artifact-inventory"
TEMPLATE_KIND = "personal-ui-m8-migration-template"
TEMPLATE_RELATIVE = PurePosixPath("evaluation/m8/migration-v0.2.19-consumer")
ARCHIVE_PREFIX = "consumer"
FAILURE_EXIT_CODE = 8
CANONICAL_BASELINE_VERSION = "0.2.19"
CANONICAL_BASELINE_TAG = "v0.2.19"
CANONICAL_BASELINE_TAG_OBJECT = "69bd8b85f2f38aacadcc671d4eefe6cb6db6241d"
CANONICAL_BASELINE_COMMIT = "0587d4b08c1a70efff80c228b332f4064a7db6d1"
SHA256_PATTERN = re.compile(r"^[0-9a-f]{64}$")
SAFE_LABEL = re.compile(r"[^a-z0-9-]+")
PROJECT_IGNORED_PARTS = {
    ".git",
    ".next",
    ".vite",
    "dist",
    "node_modules",
    "playwright-report",
    "test-results",
}


class MigrationError(RuntimeError):
    """The migration run is invalid or failed an acceptance check."""


def canonical_json(value: object) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: Path) -> str:
    return sha256_bytes(path.read_bytes())


def read_json_object(path: Path, *, label: str) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise MigrationError(f"unable to read {label}: {error}") from error
    if not isinstance(value, dict):
        raise MigrationError(f"{label} must contain a JSON object")
    return value


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(canonical_json(value))


def is_link_like(path: Path) -> bool:
    is_junction = getattr(path, "is_junction", None)
    return path.is_symlink() or bool(is_junction and is_junction())


def is_within(path: Path, parent: Path) -> bool:
    try:
        path.relative_to(parent)
        return True
    except ValueError:
        return False


def normalized_new_output(output: Path, *, repository: Path, candidate: Path) -> Path:
    absolute = output.resolve()
    repository = repository.resolve()
    candidate = candidate.resolve()
    if output == Path() or str(output).strip() in {"", "."}:
        raise MigrationError("output must be an explicit new directory")
    for occupied, label in ((repository, "repository"), (candidate, "candidate")):
        if absolute == occupied or is_within(absolute, occupied) or is_within(occupied, absolute):
            raise MigrationError(f"output must not overlap the {label}")
    if absolute.exists() or is_link_like(absolute):
        raise MigrationError(f"output already exists: {absolute}")
    return absolute


def safe_relative(value: str, *, label: str) -> PurePosixPath:
    if not isinstance(value, str) or not value or "\\" in value:
        raise MigrationError(f"{label} must be a non-empty POSIX relative path")
    path = PurePosixPath(value)
    if path.is_absolute() or ".." in path.parts or "." in path.parts:
        raise MigrationError(f"{label} is unsafe: {value!r}")
    return path


def git(repository: Path, *arguments: str, text: bool = True) -> str | bytes:
    result = subprocess.run(
        ["git", *arguments],
        cwd=repository,
        capture_output=True,
        text=text,
        encoding="utf-8" if text else None,
        check=False,
    )
    if result.returncode != 0:
        stderr = result.stderr.strip() if text else result.stderr.decode("utf-8", "replace").strip()
        raise MigrationError(f"git {' '.join(arguments)} failed: {stderr}")
    return result.stdout.strip() if text else result.stdout


def _candidate_bindings(plan: Mapping[str, object]) -> dict[str, str]:
    source = plan.get("source")
    artifacts = plan.get("artifacts")
    archive = artifacts.get("archive") if isinstance(artifacts, dict) else None
    bindings = {
        "version": plan.get("candidateVersion"),
        "planDigest": plan.get("planDigest"),
        "sourceCommit": source.get("commit") if isinstance(source, dict) else None,
        "archiveSha256": archive.get("sha256") if isinstance(archive, dict) else None,
        "candidateContentDigest": plan.get("candidateContentDigest"),
    }
    for field, value in bindings.items():
        if not isinstance(value, str) or not value:
            raise MigrationError(f"candidate binding is invalid: {field}")
    for field in ("planDigest", "archiveSha256", "candidateContentDigest"):
        if SHA256_PATTERN.fullmatch(str(bindings[field])) is None:
            raise MigrationError(f"candidate binding is not a SHA-256: {field}")
    return {key: str(value) for key, value in bindings.items()}


def load_verified_candidate(candidate: Path) -> tuple[dict[str, object], dict[str, bytes], Path]:
    candidate = candidate.resolve()
    if not candidate.is_dir() or is_link_like(candidate):
        raise MigrationError(f"candidate must be a regular directory: {candidate}")
    plan, journal = release.load_candidate(candidate)
    files = release.collect_staged_files(candidate)
    release.verify_candidate_files(plan, files)
    release.verify_artifact_bundle(candidate, plan, files)
    source = plan.get("source")
    blockers: list[str] = []
    if not isinstance(source, dict):
        blockers.append("candidate-source-invalid")
    else:
        if source.get("mode") != "commit":
            blockers.append("source-is-not-an-immutable-commit")
        if source.get("dirty") is not False:
            blockers.append("source-worktree-is-dirty")
        if not isinstance(source.get("tree"), str) or not source.get("tree"):
            blockers.append("source-tree-is-missing")
    if plan.get("publishable") is not True:
        blockers.append("candidate-is-not-publishable")
    blockers.extend(release._verification_journal_blockers(plan, journal))
    if blockers:
        raise MigrationError("official migration candidate is blocked: " + ", ".join(sorted(set(blockers))))
    staging = candidate / "staging" / release.ARCHIVE_PREFIX
    for relative in (
        "scripts/install_personal_ui.py",
        "scripts/verify_personal_ui.py",
        "scripts/run_m8_migration_failure_case.py",
        TEMPLATE_RELATIVE.as_posix() + "/template.json",
    ):
        if relative not in files or not staging.joinpath(*PurePosixPath(relative).parts).is_file():
            raise MigrationError(f"candidate is missing M8 migration input: {relative}")
    _candidate_bindings(plan)
    return plan, files, staging


def resolve_baseline(repository: Path, candidate_files: Mapping[str, bytes]) -> dict[str, str]:
    relative = "references/support-matrix.json"
    if relative not in candidate_files:
        raise MigrationError("candidate is missing the support matrix")
    try:
        matrix = json.loads(candidate_files[relative].decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise MigrationError(f"candidate support matrix is invalid: {error}") from error
    baseline = matrix.get("baseline") if isinstance(matrix, dict) else None
    if not isinstance(baseline, dict):
        raise MigrationError("candidate support matrix has no baseline binding")
    version = baseline.get("version")
    tag = baseline.get("tag")
    expected_commit = baseline.get("commit")
    if (
        version != CANONICAL_BASELINE_VERSION
        or tag != CANONICAL_BASELINE_TAG
        or expected_commit != CANONICAL_BASELINE_COMMIT
    ):
        raise MigrationError(
            "M8 migration requires canonical annotated baseline "
            f"{CANONICAL_BASELINE_TAG}/{CANONICAL_BASELINE_COMMIT}"
        )
    tag_ref = f"refs/tags/{tag}"
    tag_type = str(git(repository, "cat-file", "-t", tag_ref))
    if tag_type != "tag":
        raise MigrationError("v0.2.19 must be an annotated immutable tag")
    tag_object = str(git(repository, "rev-parse", tag_ref))
    commit = str(git(repository, "rev-parse", f"{tag_ref}^{{commit}}"))
    tree = str(git(repository, "rev-parse", f"{commit}^{{tree}}"))
    if tag_object != CANONICAL_BASELINE_TAG_OBJECT:
        raise MigrationError(
            "v0.2.19 annotated tag object moved: "
            f"expected {CANONICAL_BASELINE_TAG_OBJECT}, found {tag_object}"
        )
    if commit != CANONICAL_BASELINE_COMMIT:
        raise MigrationError(
            f"v0.2.19 tag moved: expected {CANONICAL_BASELINE_COMMIT}, found {commit}"
        )
    return {
        "version": version,
        "tag": tag,
        "tagObject": tag_object,
        "commit": commit,
        "tree": tree,
    }


def export_baseline(repository: Path, baseline: Mapping[str, str], destination: Path, archive_path: Path) -> dict[str, object]:
    archive_bytes = git(repository, "archive", "--format=tar", baseline["commit"], text=False)
    assert isinstance(archive_bytes, bytes)
    archive_path.parent.mkdir(parents=True, exist_ok=True)
    archive_path.write_bytes(archive_bytes)
    seen: dict[str, str] = {}
    inventory: list[dict[str, object]] = []
    destination.mkdir(parents=True, exist_ok=False)
    with tarfile.open(fileobj=io.BytesIO(archive_bytes), mode="r:") as archive:
        for member in archive.getmembers():
            relative = safe_relative(member.name.rstrip("/"), label="baseline archive member")
            folded = relative.as_posix().casefold()
            if folded in seen:
                raise MigrationError(
                    f"case-insensitive baseline archive collision: {seen[folded]} and {relative}"
                )
            seen[folded] = relative.as_posix()
            target = destination.joinpath(*relative.parts)
            if member.isdir():
                target.mkdir(parents=True, exist_ok=True)
                continue
            if not member.isfile() or member.issym() or member.islnk():
                raise MigrationError(f"baseline archive contains a non-regular entry: {relative}")
            source = archive.extractfile(member)
            if source is None:
                raise MigrationError(f"unable to read baseline archive member: {relative}")
            content = source.read()
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(content)
            inventory.append(
                {
                    "path": relative.as_posix(),
                    "size": len(content),
                    "sha256": sha256_bytes(content),
                }
            )
    package = read_json_object(destination / "assets/react-kit/package.json", label="baseline package")
    registry = read_json_object(destination / "assets/react-kit/registry.json", label="baseline registry")
    if package.get("version") != baseline["version"] or registry.get("version") != baseline["version"]:
        raise MigrationError("exported baseline version does not match v0.2.19")
    return {
        "archiveSha256": sha256_bytes(archive_bytes),
        "archiveSize": len(archive_bytes),
        "fileCount": len(inventory),
        "contentDigest": release.digest_file_map(
            {
                str(item["path"]): destination.joinpath(
                    *PurePosixPath(str(item["path"])).parts
                ).read_bytes()
                for item in inventory
            }
        ),
        "files": inventory,
    }


def load_template(staging: Path) -> tuple[Path, dict[str, Any]]:
    root = staging.joinpath(*TEMPLATE_RELATIVE.parts)
    if not root.is_dir() or is_link_like(root):
        raise MigrationError("candidate migration template is missing or linked")
    template = read_json_object(root / "template.json", label="migration template")
    if template.get("schemaVersion") != SCHEMA_VERSION or template.get("kind") != TEMPLATE_KIND:
        raise MigrationError("migration template schema or kind is invalid")
    if template.get("baselineVersion") != "0.2.19":
        raise MigrationError("migration template targets the wrong baseline")
    required_exports = template.get("requiredExports")
    preserve_paths = template.get("preservePaths")
    migration_paths = template.get("migrationPaths")
    for value, label in (
        (required_exports, "requiredExports"),
        (preserve_paths, "preservePaths"),
        (migration_paths, "migrationPaths"),
    ):
        if not isinstance(value, list) or not value or not all(
            isinstance(item, str) and item for item in value
        ):
            raise MigrationError(f"migration template {label} must be a non-empty string array")
    for value in [*preserve_paths, *migration_paths]:
        safe_relative(value, label="migration template path")
    before = root / "before/src/App.tsx"
    after = root / "after/src/App.tsx"
    overrides = root / "package-overrides.json"
    if not before.is_file() or not after.is_file() or not overrides.is_file():
        raise MigrationError("migration template is missing before/after/package inputs")
    before_text = before.read_text(encoding="utf-8")
    after_text = after.read_text(encoding="utf-8")
    if "trigger={<Button" not in before_text or "triggerLabel=" in before_text:
        raise MigrationError("baseline fixture must exercise the v0.2.19 Popover trigger API")
    if "triggerLabel=" not in after_text or "trigger={<Button" in after_text:
        raise MigrationError("migrated fixture must use Popover.triggerLabel")
    return root, template


def copy_regular_tree(source: Path, destination: Path) -> None:
    for path in sorted(source.rglob("*")):
        relative = path.relative_to(source)
        if is_link_like(path):
            raise MigrationError(f"template contains a link: {relative.as_posix()}")
        target = destination / relative
        if path.is_dir():
            target.mkdir(parents=True, exist_ok=True)
        elif path.is_file():
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(path.read_bytes())


def configure_consumer(consumer: Path, template_root: Path) -> None:
    copy_regular_tree(template_root / "shared", consumer)
    app = consumer / "src/App.tsx"
    app.write_bytes((template_root / "before/src/App.tsx").read_bytes())
    package_path = consumer / "package.json"
    package = read_json_object(package_path, label="baseline consumer package")
    overrides = read_json_object(template_root / "package-overrides.json", label="package overrides")
    for key, value in overrides.items():
        if key in {"scripts", "dependencies", "devDependencies"}:
            if not isinstance(value, dict):
                raise MigrationError(f"package override {key} must be an object")
            current = package.get(key, {})
            if not isinstance(current, dict):
                raise MigrationError(f"baseline package {key} must be an object")
            package[key] = {**current, **value}
        else:
            package[key] = value
    package_path.write_bytes(canonical_json(package))


def project_file_map(root: Path) -> dict[str, bytes]:
    files: dict[str, bytes] = {}
    for path in sorted(root.rglob("*")):
        relative = path.relative_to(root)
        if any(part in PROJECT_IGNORED_PARTS for part in relative.parts):
            continue
        if is_link_like(path):
            raise MigrationError(f"consumer contains a linked path: {relative.as_posix()}")
        if path.is_file():
            files[relative.as_posix()] = path.read_bytes()
    return files


def file_inventory(files: Mapping[str, bytes]) -> list[dict[str, object]]:
    return [
        {"path": path, "size": len(content), "sha256": sha256_bytes(content)}
        for path, content in sorted(files.items())
    ]


def write_deterministic_zip(path: Path, files: Mapping[str, bytes]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_STORED) as archive:
        for relative, content in sorted(files.items()):
            safe_relative(relative, label="consumer source archive path")
            info = zipfile.ZipInfo(f"{ARCHIVE_PREFIX}/{relative}", (2026, 1, 1, 0, 0, 0))
            info.create_system = 3
            info.external_attr = 0o100644 << 16
            info.compress_type = zipfile.ZIP_STORED
            archive.writestr(info, content)


def materialize_file_map(files: Mapping[str, bytes], destination: Path) -> None:
    destination.mkdir(parents=True, exist_ok=False)
    for relative, content in sorted(files.items()):
        safe = safe_relative(relative, label="consumer snapshot path")
        target = destination.joinpath(*safe.parts)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)


def collected_regular_files(root: Path, *, label: str) -> dict[str, bytes]:
    files: dict[str, bytes] = {}
    for path in sorted(root.rglob("*")):
        relative = path.relative_to(root)
        if is_link_like(path):
            raise MigrationError(f"{label} contains a linked path: {relative.as_posix()}")
        if path.is_file():
            files[relative.as_posix()] = path.read_bytes()
    return files


def verify_materialized_file_map(
    root: Path, expected: Mapping[str, bytes], *, label: str
) -> dict[str, bytes]:
    actual = collected_regular_files(root, label=label)
    if actual != dict(expected):
        missing = sorted(set(expected) - set(actual))
        extra = sorted(set(actual) - set(expected))
        changed = sorted(
            path for path in set(expected) & set(actual) if expected[path] != actual[path]
        )
        raise MigrationError(
            f"{label} differs from its verified bytes "
            f"(missing={missing[:3]}, extra={extra[:3]}, changed={changed[:3]})"
        )
    return actual


def materialize_verified_file_map(
    files: Mapping[str, bytes], destination: Path, *, label: str
) -> dict[str, bytes]:
    materialize_file_map(files, destination)
    return verify_materialized_file_map(destination, files, label=label)


def scrub_text(value: str, replacements: Sequence[tuple[Path, str]]) -> str:
    result = value
    for path, replacement in sorted(replacements, key=lambda item: len(str(item[0])), reverse=True):
        raw = str(path.resolve())
        result = result.replace(raw, replacement).replace(raw.replace("\\", "/"), replacement)
    return result


@dataclass(frozen=True)
class RecordedCommand:
    label: str
    returncode: int
    stdout: str
    stderr: str
    record_path: str


def executable_argv(argv: Sequence[str], *, platform: str = os.name) -> list[str]:
    if platform == "nt" and argv and argv[0] == "npm":
        return ["npm.cmd", *argv[1:]]
    return list(argv)


class CommandRecorder:
    def __init__(self, artifact_root: Path, replacements: Sequence[tuple[Path, str]]):
        self.root = artifact_root / "commands"
        self.root.mkdir(parents=True, exist_ok=True)
        self.replacements = tuple(replacements)
        self.sequence = 0
        self.records: list[str] = []

    def run(
        self,
        label: str,
        argv: Sequence[str],
        *,
        cwd: Path,
        expected_codes: Iterable[int] = (0,),
        environment: Mapping[str, str] | None = None,
    ) -> RecordedCommand:
        self.sequence += 1
        safe_label = SAFE_LABEL.sub("-", label.lower()).strip("-")
        stem = f"{self.sequence:02d}-{safe_label}"
        started = time.monotonic()
        executed_argv = executable_argv(argv)
        process = subprocess.run(
            executed_argv,
            cwd=cwd,
            env=dict(environment) if environment is not None else None,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            check=False,
        )
        duration = round(time.monotonic() - started, 3)
        stdout = scrub_text(process.stdout, self.replacements)
        stderr = scrub_text(process.stderr, self.replacements)
        stdout_path = self.root / f"{stem}.stdout.log"
        stderr_path = self.root / f"{stem}.stderr.log"
        stdout_bytes = stdout.encode("utf-8")
        stderr_bytes = stderr.encode("utf-8")
        stdout_path.write_bytes(stdout_bytes)
        stderr_path.write_bytes(stderr_bytes)
        record_path = self.root / f"{stem}.json"
        record = {
            "schemaVersion": SCHEMA_VERSION,
            "kind": "personal-ui-m8-migration-command",
            "label": label,
            "argv": [scrub_text(str(value), self.replacements) for value in executed_argv],
            "cwd": scrub_text(str(cwd.resolve()), self.replacements),
            "returnCode": process.returncode,
            "durationSeconds": duration,
            "stdout": {
                "path": stdout_path.relative_to(self.root.parent.parent).as_posix(),
                "sha256": sha256_bytes(stdout_bytes),
            },
            "stderr": {
                "path": stderr_path.relative_to(self.root.parent.parent).as_posix(),
                "sha256": sha256_bytes(stderr_bytes),
            },
        }
        write_json(record_path, record)
        relative_record = record_path.relative_to(self.root.parent.parent).as_posix()
        self.records.append(relative_record)
        if process.returncode not in set(expected_codes):
            raise MigrationError(
                f"command {label!r} returned {process.returncode}; see {relative_record}"
            )
        return RecordedCommand(label, process.returncode, stdout, stderr, relative_record)


def parse_command_json(command: RecordedCommand, *, label: str) -> dict[str, Any]:
    try:
        value = json.loads(command.stdout)
    except json.JSONDecodeError as error:
        raise MigrationError(f"{label} did not produce JSON: {error}") from error
    if not isinstance(value, dict):
        raise MigrationError(f"{label} JSON must be an object")
    return value


def validate_breaking_api_diagnostic(diagnostic: str) -> None:
    for export_name, former_prop in (("Drawer", "onClose"), ("Popover", "trigger")):
        if export_name not in diagnostic or former_prop not in diagnostic:
            raise MigrationError(
                f"pre-migration build did not expose the announced {export_name} API break"
            )


def command_environment() -> dict[str, str]:
    environment = dict(os.environ)
    environment.update(
        {
            "CI": "1",
            "NEXT_TELEMETRY_DISABLED": "1",
            "COREPACK_ENABLE_DOWNLOAD_PROMPT": "0",
            "PYTHONDONTWRITEBYTECODE": "1",
        }
    )
    return environment


def free_port() -> int:
    with socket.socket() as reservation:
        reservation.bind(("127.0.0.1", 0))
        return int(reservation.getsockname()[1])


def behavior_environment(base: Mapping[str, str], *, screenshot: Path) -> dict[str, str]:
    environment = dict(base)
    environment["M8_MIGRATION_PORT"] = str(free_port())
    environment["M8_MIGRATION_SCREENSHOT"] = str(screenshot.resolve())
    return environment


def required_hashes(root: Path, paths: Sequence[str]) -> dict[str, str]:
    result: dict[str, str] = {}
    for value in paths:
        relative = safe_relative(value, label="preserved business path")
        path = root.joinpath(*relative.parts)
        if not path.is_file() or is_link_like(path):
            raise MigrationError(f"preserved business path is missing: {value}")
        result[value] = sha256_file(path)
    return result


def assert_preserved(before: Mapping[str, str], after: Mapping[str, str]) -> None:
    changed = sorted(path for path in before if after.get(path) != before[path])
    if changed:
        raise MigrationError("candidate installer changed consumer-owned paths: " + ", ".join(changed))


def cleanup_generated(root: Path) -> None:
    for relative in ("node_modules", "dist", "test-results", "playwright-report"):
        path = root / relative
        if path.is_dir() and not is_link_like(path):
            shutil.rmtree(path)


def create_artifact_inventory(
    output: Path,
    *,
    candidate: Mapping[str, str],
    baseline: Mapping[str, str],
) -> dict[str, object]:
    files: list[Path] = [output / "migration-report.json"]
    files.extend(path for path in sorted((output / "artifacts").rglob("*")) if path.is_file())
    items: list[dict[str, object]] = []
    for path in files:
        if is_link_like(path):
            raise MigrationError(f"evidence artifact is linked: {path}")
        relative = path.relative_to(output).as_posix()
        safe_relative(relative, label="evidence artifact path")
        content = path.read_bytes()
        items.append(
            {
                "path": relative,
                "size": len(content),
                "sha256": sha256_bytes(content),
            }
        )
    inventory: dict[str, object] = {
        "schemaVersion": SCHEMA_VERSION,
        "kind": INVENTORY_KIND,
        "result": "passed",
        "candidate": dict(candidate),
        "baseline": dict(baseline),
        "artifactCount": len(items),
        "artifactDigest": sha256_bytes(canonical_json(items)),
        "artifacts": items,
    }
    write_json(output / "artifact-inventory.json", inventory)
    return inventory


def validate_artifact_inventory(path: Path) -> dict[str, Any]:
    inventory = read_json_object(path, label="migration artifact inventory")
    if (
        inventory.get("schemaVersion") != SCHEMA_VERSION
        or inventory.get("kind") != INVENTORY_KIND
        or inventory.get("result") != "passed"
    ):
        raise MigrationError("migration artifact inventory schema, kind, or result is invalid")
    items = inventory.get("artifacts")
    if not isinstance(items, list) or inventory.get("artifactCount") != len(items):
        raise MigrationError("migration artifact inventory count is invalid")
    seen: set[str] = set()
    normalized: list[dict[str, object]] = []
    root = path.parent
    for index, item in enumerate(items):
        if not isinstance(item, dict):
            raise MigrationError(f"migration artifact {index} must be an object")
        relative_value = item.get("path")
        if not isinstance(relative_value, str):
            raise MigrationError(f"migration artifact {index} has no path")
        relative = safe_relative(relative_value, label="migration artifact path")
        if relative_value in seen:
            raise MigrationError(f"duplicate migration artifact: {relative_value}")
        seen.add(relative_value)
        target = root.joinpath(*relative.parts)
        size = item.get("size")
        digest = item.get("sha256")
        if not target.is_file() or is_link_like(target):
            raise MigrationError(f"migration artifact is missing: {relative_value}")
        content = target.read_bytes()
        if size != len(content) or digest != sha256_bytes(content):
            raise MigrationError(f"migration artifact hash mismatch: {relative_value}")
        normalized.append({"path": relative_value, "size": size, "sha256": digest})
    if inventory.get("artifactDigest") != sha256_bytes(canonical_json(normalized)):
        raise MigrationError("migration artifact digest mismatch")
    report = read_json_object(root / "migration-report.json", label="migration report")
    if inventory.get("candidate") != report.get("candidate"):
        raise MigrationError("migration artifact inventory candidate binding mismatch")
    if inventory.get("baseline") != report.get("baseline"):
        raise MigrationError("migration artifact inventory baseline binding mismatch")
    expected = {"migration-report.json"}
    expected.update(
        path.relative_to(root).as_posix()
        for path in (root / "artifacts").rglob("*")
        if path.is_file()
    )
    if seen != expected:
        raise MigrationError("migration artifact inventory does not exactly cover the review artifacts")
    return inventory


def build_execution_plan(
    *, candidate: Mapping[str, str], baseline: Mapping[str, str], template: Mapping[str, Any]
) -> dict[str, object]:
    return {
        "schemaVersion": SCHEMA_VERSION,
        "kind": "personal-ui-m8-migration-plan",
        "candidate": dict(candidate),
        "baseline": dict(baseline),
        "template": TEMPLATE_RELATIVE.as_posix(),
        "requiredExports": list(template["requiredExports"]),
        "steps": [
            "export-immutable-baseline",
            "install-v0.2.19-starter",
            "configure-realistic-consumer",
            "baseline-install-build-verify-behavior",
            "candidate-upgrade-dry-run-and-apply",
            "confirm-announced-breaking-diagnostic",
            "apply-documented-consumer-migration",
            "post-upgrade-install-build-verify-behavior",
            "modified-owned-file-conflict",
            "injected-failure-rollback",
            "hash-evidence-artifacts",
        ],
        "externalCommands": ["git", "node", "npm", "python"],
        "networkMayBeRequired": True,
        "browser": "Chromium via the consumer's exact @playwright/test dependency",
    }


def execute_migration(
    *, repository: Path, candidate: Path, output: Path
) -> dict[str, object]:
    repository = repository.resolve()
    if not (repository / ".git").exists():
        raise MigrationError(f"repository is not a Git checkout: {repository}")
    plan, candidate_files, _ = load_verified_candidate(candidate)
    candidate_bindings = _candidate_bindings(plan)
    baseline = resolve_baseline(repository, candidate_files)
    output = normalized_new_output(output, repository=repository, candidate=candidate)
    output.mkdir(parents=True, exist_ok=False)
    artifacts = output / "artifacts"
    artifacts.mkdir()
    inputs = output / "inputs"
    inputs.mkdir()
    workspaces = output / "workspaces"
    workspaces.mkdir()
    staging = inputs / "verified-candidate"
    frozen_candidate_files = materialize_verified_file_map(
        candidate_files,
        staging,
        label="materialized candidate",
    )
    frozen_candidate_digest = release.digest_file_map(frozen_candidate_files)
    if frozen_candidate_digest != candidate_bindings["candidateContentDigest"]:
        raise MigrationError("materialized candidate content digest mismatch")
    write_json(
        artifacts / "candidate-input-inventory.json",
        {
            "schemaVersion": SCHEMA_VERSION,
            "kind": "personal-ui-m8-migration-candidate-input",
            "candidate": candidate_bindings,
            "fileCount": len(frozen_candidate_files),
            "contentDigest": frozen_candidate_digest,
            "files": file_inventory(frozen_candidate_files),
        },
    )
    template_root, template = load_template(staging)
    replacements = (
        (staging, "$FROZEN_CANDIDATE"),
        (output, "$M8_MIGRATION_ROOT"),
        (candidate.resolve(), "$CANDIDATE"),
        (repository, "$REPOSITORY"),
    )
    recorder = CommandRecorder(artifacts, replacements)
    environment = command_environment()

    baseline_skill = inputs / "baseline-skill"
    baseline_export = export_baseline(
        repository,
        baseline,
        baseline_skill,
        artifacts / "v0.2.19-skill.tar",
    )
    write_json(artifacts / "baseline-skill-inventory.json", baseline_export)

    consumer = workspaces / "consumer"
    baseline_installer = baseline_skill / "scripts/install_personal_ui.py"
    install_command = recorder.run(
        "baseline-installer",
        [sys.executable, str(baseline_installer), "--mode", "starter", "--target", str(consumer)],
        cwd=baseline_skill,
        environment=environment,
    )
    baseline_install = parse_command_json(install_command, label="baseline installer")
    if baseline_install.get("version") != baseline["version"]:
        raise MigrationError("baseline installer did not install v0.2.19")
    write_json(artifacts / "baseline-install.json", baseline_install)
    configure_consumer(consumer, template_root)

    recorder.run(
        "baseline-lockfile",
        ["npm", "install", "--package-lock-only", "--ignore-scripts", "--no-audit", "--no-fund"],
        cwd=consumer,
        environment=environment,
    )
    recorder.run(
        "baseline-clean-install",
        ["npm", "ci", "--no-audit", "--no-fund"],
        cwd=consumer,
        environment=environment,
    )
    recorder.run(
        "install-chromium",
        ["npm", "exec", "--", "playwright", "install", "chromium"],
        cwd=consumer,
        environment=environment,
    )
    node_version = recorder.run("node-version", ["node", "--version"], cwd=consumer, environment=environment)
    npm_version = recorder.run("npm-version", ["npm", "--version"], cwd=consumer, environment=environment)
    playwright_version = recorder.run(
        "playwright-version",
        ["npm", "exec", "--", "playwright", "--version"],
        cwd=consumer,
        environment=environment,
    )
    recorder.run(
        "baseline-verifier",
        ["npm", "run", "verify:personal-ui"],
        cwd=consumer,
        environment=environment,
    )
    recorder.run("baseline-build", ["npm", "run", "build"], cwd=consumer, environment=environment)
    baseline_screenshot = artifacts / "screenshots/baseline.png"
    baseline_screenshot.parent.mkdir(parents=True, exist_ok=True)
    recorder.run(
        "baseline-workflow",
        ["npm", "run", "test:migration"],
        cwd=consumer,
        environment=behavior_environment(environment, screenshot=baseline_screenshot),
    )

    baseline_files = project_file_map(consumer)
    write_deterministic_zip(artifacts / "baseline-consumer-source.zip", baseline_files)
    write_json(
        artifacts / "baseline-consumer-source.json",
        {
            "schemaVersion": SCHEMA_VERSION,
            "kind": "personal-ui-m8-consumer-source-inventory",
            "phase": "before-upgrade",
            "fileCount": len(baseline_files),
            "contentDigest": release.digest_file_map(baseline_files),
            "files": file_inventory(baseline_files),
        },
    )
    preserve_paths = list(template["preservePaths"])
    preserved_before = required_hashes(consumer, preserve_paths)

    cases = workspaces / "cases"
    cases.mkdir()
    conflict = cases / "conflict"
    recovery = cases / "recovery"
    materialize_file_map(baseline_files, conflict)
    materialize_file_map(baseline_files, recovery)

    candidate_installer = staging / "scripts/install_personal_ui.py"
    upgrade_args = [
        sys.executable,
        str(candidate_installer),
        "--mode",
        "integrate",
        "--target",
        str(consumer),
    ]
    dry_run = recorder.run(
        "upgrade-dry-run",
        [*upgrade_args, "--dry-run"],
        cwd=staging,
        environment=environment,
    )
    dry_run_report = parse_command_json(dry_run, label="candidate upgrade dry-run")
    if dry_run_report.get("operation") != "upgrade" or dry_run_report.get("version") != candidate_bindings["version"]:
        raise MigrationError("candidate dry-run did not plan the expected upgrade")
    write_json(artifacts / "upgrade-dry-run.json", dry_run_report)
    applied = recorder.run(
        "upgrade-apply",
        upgrade_args,
        cwd=staging,
        environment=environment,
    )
    applied_report = parse_command_json(applied, label="candidate upgrade")
    if applied_report.get("operation") != "upgrade" or applied_report.get("version") != candidate_bindings["version"]:
        raise MigrationError("candidate installer did not apply the expected upgrade")
    write_json(artifacts / "upgrade-apply.json", applied_report)
    preserved_after_installer = required_hashes(consumer, preserve_paths)
    assert_preserved(preserved_before, preserved_after_installer)

    incompatible = recorder.run(
        "pre-migration-build",
        ["npm", "run", "build"],
        cwd=consumer,
        expected_codes=range(1, 256),
        environment=environment,
    )
    diagnostic = incompatible.stdout + "\n" + incompatible.stderr
    validate_breaking_api_diagnostic(diagnostic)
    write_json(
        artifacts / "breaking-api-diagnostic.json",
        {
            "schemaVersion": SCHEMA_VERSION,
            "kind": "personal-ui-m8-migration-diagnostic",
            "breaks": [
                {
                    "export": "Drawer",
                    "formerProp": "onClose",
                    "replacementProp": "onOpenChange",
                },
                {
                    "export": "Popover",
                    "formerProp": "trigger",
                    "replacementProp": "triggerLabel",
                },
            ],
            "commandRecord": incompatible.record_path,
            "result": "expected-failure-observed",
        },
    )

    app_path = consumer / "src/App.tsx"
    before_app = (template_root / "before/src/App.tsx").read_bytes()
    after_app = (template_root / "after/src/App.tsx").read_bytes()
    if app_path.read_bytes() != before_app:
        raise MigrationError("consumer App.tsx changed before the documented migration was applied")
    diff = "".join(
        difflib.unified_diff(
            before_app.decode("utf-8").splitlines(keepends=True),
            after_app.decode("utf-8").splitlines(keepends=True),
            fromfile="v0.2.19/src/App.tsx",
            tofile=f"{candidate_bindings['version']}/src/App.tsx",
        )
    )
    (artifacts / "migration-diff.patch").write_text(diff, encoding="utf-8")
    app_path.write_bytes(after_app)
    write_json(
        artifacts / "consumer-migration.json",
        {
            "schemaVersion": SCHEMA_VERSION,
            "kind": "personal-ui-m8-consumer-migration",
            "paths": list(template["migrationPaths"]),
            "changes": [
                {
                    "export": "Drawer",
                    "former": "onClose={() => setOpen(false)}",
                    "replacement": "onOpenChange={setOpen}",
                    "reference": "references/v0.3.0-migrations.md#controlled-state-refs-and-form-adapters",
                },
                {
                    "export": "Popover",
                    "former": "trigger={<Button>...</Button>}",
                    "replacement": "triggerLabel=\"...\"",
                    "reference": "references/v0.3.0-migrations.md#popover-family-trigger-ownership",
                }
            ],
        },
    )

    recorder.run(
        "post-upgrade-clean-install",
        ["npm", "ci", "--no-audit", "--no-fund"],
        cwd=consumer,
        environment=environment,
    )
    recorder.run(
        "post-upgrade-npm-verifier",
        ["npm", "run", "verify:personal-ui"],
        cwd=consumer,
        environment=environment,
    )
    candidate_verifier = staging / "scripts/verify_personal_ui.py"
    verifier_args = [sys.executable, str(candidate_verifier), "--target", str(consumer)]
    for component in template["requiredExports"]:
        verifier_args.extend(["--require-component", str(component)])
    recorder.run(
        "post-upgrade-strict-verifier",
        verifier_args,
        cwd=staging,
        environment=environment,
    )
    recorder.run("post-upgrade-build", ["npm", "run", "build"], cwd=consumer, environment=environment)
    final_screenshot = artifacts / "screenshots/upgraded.png"
    recorder.run(
        "post-upgrade-workflow",
        ["npm", "run", "test:migration"],
        cwd=consumer,
        environment=behavior_environment(environment, screenshot=final_screenshot),
    )
    final_registry = read_json_object(consumer / "src/personal-ui/registry.json", label="upgraded registry")
    if final_registry.get("version") != candidate_bindings["version"]:
        raise MigrationError("upgraded consumer registry does not match the candidate version")
    preserved_final = required_hashes(consumer, preserve_paths)
    migration_paths = set(template["migrationPaths"])
    assert_preserved(
        {path: digest for path, digest in preserved_before.items() if path not in migration_paths},
        {path: digest for path, digest in preserved_final.items() if path not in migration_paths},
    )
    if preserved_final.get("src/App.tsx") != sha256_bytes(after_app):
        raise MigrationError("the final consumer does not contain the reviewed App.tsx migration")
    write_json(
        artifacts / "preservation.json",
        {
            "schemaVersion": SCHEMA_VERSION,
            "kind": "personal-ui-m8-migration-preservation",
            "result": "passed",
            "before": preserved_before,
            "afterInstaller": preserved_after_installer,
            "afterMigration": preserved_final,
            "allowedMigrationPaths": sorted(migration_paths),
        },
    )

    conflict_index = conflict / "src/personal-ui/index.ts"
    conflict_index.write_bytes(conflict_index.read_bytes() + b"\n// consumer conflict fixture\n")
    conflict_before = project_file_map(conflict)
    conflict_command = recorder.run(
        "modified-owned-file-conflict",
        [
            sys.executable,
            str(candidate_installer),
            "--mode",
            "integrate",
            "--target",
            str(conflict),
            "--dry-run",
        ],
        cwd=staging,
        expected_codes=(3,),
        environment=environment,
    )
    conflict_report = parse_command_json(conflict_command, label="modified owned file conflict")
    conflicts = conflict_report.get("plan", {}).get("conflicts", []) if isinstance(conflict_report.get("plan"), dict) else []
    if not any(
        isinstance(item, dict)
        and item.get("path") == "src/personal-ui/index.ts"
        and item.get("reason") == "modified-owned-file"
        and item.get("forceable") is True
        for item in conflicts
    ):
        raise MigrationError("candidate installer did not report the expected modified-owned-file conflict")
    if project_file_map(conflict) != conflict_before:
        raise MigrationError("conflicting dry-run changed the consumer")
    write_json(artifacts / "conflict-report.json", conflict_report)

    recovery_before = project_file_map(recovery)
    failure_helper = staging / "scripts/run_m8_migration_failure_case.py"
    recovery_command = recorder.run(
        "injected-failure-rollback",
        [
            sys.executable,
            str(failure_helper),
            "--target",
            str(recovery),
            "--failure-point",
            "commit",
        ],
        cwd=staging,
        expected_codes=(FAILURE_EXIT_CODE,),
        environment=environment,
    )
    recovery_report = parse_command_json(recovery_command, label="injected failure rollback")
    if recovery_report.get("result") != "expected-failure" or recovery_report.get("failurePoint") != "commit":
        raise MigrationError("rollback helper did not observe the expected injected failure")
    if project_file_map(recovery) != recovery_before:
        raise MigrationError("candidate installer did not restore the failed upgrade")
    recovery_report["restoredExactProjectSnapshot"] = True
    write_json(artifacts / "rollback-report.json", recovery_report)

    verify_materialized_file_map(
        staging,
        candidate_files,
        label="materialized candidate after migration run",
    )

    final_files = project_file_map(consumer)
    write_deterministic_zip(artifacts / "upgraded-consumer-source.zip", final_files)
    write_json(
        artifacts / "upgraded-consumer-source.json",
        {
            "schemaVersion": SCHEMA_VERSION,
            "kind": "personal-ui-m8-consumer-source-inventory",
            "phase": "after-upgrade",
            "fileCount": len(final_files),
            "contentDigest": release.digest_file_map(final_files),
            "files": file_inventory(final_files),
        },
    )
    write_json(
        artifacts / "versions.json",
        {
            "schemaVersion": SCHEMA_VERSION,
            "kind": "personal-ui-m8-migration-versions",
            "baselineKit": baseline["version"],
            "candidateKit": candidate_bindings["version"],
            "node": node_version.stdout.strip(),
            "npm": npm_version.stdout.strip(),
            "playwright": playwright_version.stdout.strip(),
        },
    )

    report: dict[str, object] = {
        "schemaVersion": SCHEMA_VERSION,
        "kind": REPORT_KIND,
        "result": "passed",
        "recordedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "candidate": candidate_bindings,
        "baseline": baseline,
        "template": {
            "path": TEMPLATE_RELATIVE.as_posix(),
            "requiredExports": list(template["requiredExports"]),
        },
        "checks": {
            "baselineSource": "passed",
            "baselineInstall": "passed",
            "baselineBuild": "passed",
            "baselineVerifier": "passed",
            "baselineBehavior": "passed",
            "upgradeDryRun": "passed",
            "upgradeApply": "passed",
            "documentedApiMigration": "passed",
            "businessFilesPreserved": "passed",
            "postUpgradeInstall": "passed",
            "postUpgradeBuild": "passed",
            "postUpgradeVerifier": "passed",
            "postUpgradeBehavior": "passed",
            "conflictReport": "passed",
            "failureRecovery": "passed",
        },
        "source": {
            "beforeArchive": "artifacts/baseline-consumer-source.zip",
            "afterArchive": "artifacts/upgraded-consumer-source.zip",
            "diff": "artifacts/migration-diff.patch",
        },
        "commands": recorder.records,
        "artifactInventory": "artifact-inventory.json",
    }
    write_json(output / "migration-report.json", report)
    create_artifact_inventory(
        output,
        candidate=candidate_bindings,
        baseline=baseline,
    )
    validate_artifact_inventory(output / "artifact-inventory.json")
    cleanup_generated(consumer)
    shutil.rmtree(cases)
    return report


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repository", type=Path, default=release.SKILL_ROOT)
    parser.add_argument("--candidate", type=Path, required=True)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--print-plan", action="store_true")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    try:
        repository = args.repository.resolve()
        plan, candidate_files, staging = load_verified_candidate(args.candidate)
        baseline = resolve_baseline(repository, candidate_files)
        _, template = load_template(staging)
        execution_plan = build_execution_plan(
            candidate=_candidate_bindings(plan), baseline=baseline, template=template
        )
        if args.print_plan:
            print(json.dumps(execution_plan, ensure_ascii=False, indent=2))
            return 0
        if args.output is None:
            raise MigrationError("--output is required unless --print-plan is used")
        report = execute_migration(
            repository=repository,
            candidate=args.candidate,
            output=args.output,
        )
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 0
    except (MigrationError, OSError, ValueError, release.ReleaseError) as error:
        if args.output is not None and args.output.exists() and args.output.is_dir():
            try:
                write_json(
                    args.output / "migration-failure.json",
                    {
                        "schemaVersion": SCHEMA_VERSION,
                        "kind": REPORT_KIND,
                        "result": "failed",
                        "error": str(error),
                    },
                )
            except OSError:
                pass
        print(f"error: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
