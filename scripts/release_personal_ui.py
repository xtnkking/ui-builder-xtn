#!/usr/bin/env python3
"""Prepare, verify, and explicitly publish Personal UI release candidates.

Publication defaults to a read-only preflight. Git, GitHub, and generated-copy
mutations are reachable only through the explicit ``publish --execute`` path
after the candidate, evidence, and exact plan-digest authorization pass.
"""

from __future__ import annotations

import argparse
import copy
import dataclasses
import datetime as dt
import hashlib
import io
import json
import os
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
import zipfile
from functools import total_ordering
from pathlib import Path, PurePosixPath
from typing import Callable, Iterable, Mapping, Protocol, Sequence

try:
    from .validate_m8_evidence import validate_m8_evidence_file
    from .validate_hosted_ci_evidence import validate_hosted_ci_evidence_file
    from .validate_skill import FRONTMATTER, parse_frontmatter
except ImportError:
    from validate_m8_evidence import validate_m8_evidence_file
    from validate_hosted_ci_evidence import validate_hosted_ci_evidence_file
    from validate_skill import FRONTMATTER, parse_frontmatter


SKILL_ROOT = Path(__file__).resolve().parent.parent
SCHEMA_VERSION = 1
ARCHIVE_PREFIX = "ui-builder-xtn"
PLAN_NAME = "release-plan.json"
JOURNAL_NAME = "release-journal.json"
MANIFEST_NAME = "release-manifest.json"
CHECKSUMS_NAME = "SHA256SUMS"
NOTES_NAME = "RELEASE_NOTES.md"

SEMVER_PATTERN = re.compile(
    r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)"
    r"(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?"
    r"(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$"
)
LICENSE_FILES = ("LICENSE", "LICENSE.md", "LICENSE.txt", "COPYING")
EXPECTED_LICENSE_IDENTIFIER = "MIT"
EXPECTED_LICENSE_TEXT = """MIT License

Copyright (c) 2026 xtnkking

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
"""
STRUCTURED_NOTICE_FILE = "THIRD_PARTY_NOTICES.json"
NOTICE_FILES = (
    "THIRD_PARTY_NOTICES",
    "THIRD_PARTY_NOTICES.md",
    STRUCTURED_NOTICE_FILE,
    "NOTICE",
)
INCLUDED_ROOT_FILES = {
    ".gitattributes",
    ".gitignore",
    "CHANGELOG.md",
    "README.md",
    "SKILL.md",
    *LICENSE_FILES,
    *NOTICE_FILES,
}
INCLUDED_ROOT_DIRECTORIES = {
    ".github",
    "agents",
    "assets",
    "docs",
    "evaluation",
    "references",
    "scripts",
}
EXCLUDED_DIRECTORY_NAMES = {
    ".api-temp",
    ".git",
    ".vite",
    "__pycache__",
    "coverage",
    "dist",
    "node_modules",
    "playwright-report",
}
EXCLUDED_SUFFIXES = {".log", ".pyc", ".pyo"}
VERSION_PATHS = {
    "package": "assets/react-kit/package.json",
    "lock": "assets/react-kit/package-lock.json",
    "registry": "assets/react-kit/registry.json",
    "manifest": "assets/react-kit/component-manifest.json",
    "policy": "assets/react-kit/api-version-policy.json",
    "compatibility": "assets/react-kit/etc/personal-ui.api-compatibility.json",
    "coverage": "assets/react-kit/component-coverage.json",
    "ownership": "assets/react-kit/etc/personal-ui.module-ownership.json",
}
COMPONENT_API_PATH = "references/component-api.md"
COMPONENT_CATALOG_PATH = "references/component-catalog.md"
CHANGELOG_PATH = "CHANGELOG.md"
PROMOTION_KIND = "personal-ui-release-promotion"
PROMOTION_METADATA_PATHS = frozenset(
    {
        CHANGELOG_PATH,
        VERSION_PATHS["package"],
        VERSION_PATHS["lock"],
        VERSION_PATHS["registry"],
        VERSION_PATHS["manifest"],
        VERSION_PATHS["compatibility"],
        VERSION_PATHS["coverage"],
        VERSION_PATHS["ownership"],
        COMPONENT_API_PATH,
        COMPONENT_CATALOG_PATH,
    }
)
REQUIRED_MIGRATION_HEADINGS = (
    "## Public control customization boundaries",
    "## Controlled state, refs, and form adapters",
    "## Semantic theme tokens and Portal inheritance",
    "## Composite forms and modal layer ownership",
    "## Locale provider and built-in messages",
    "## Installation, upgrade, and rollback",
)
DEFAULT_VERIFICATION_COMMANDS = (
    {"cwd": "assets/react-kit", "argv": ["npm", "ci"]},
    {"cwd": ".", "argv": ["python", "scripts/test_release_personal_ui.py"]},
    {"cwd": "assets/react-kit", "argv": ["npm", "run", "release:check"]},
)
PUBLISH_STEPS = (
    "freeze-release-commit",
    "create-immutable-tag",
    "push-release-source-and-tag",
    "create-draft-github-release",
    "upload-artifacts-and-checksums",
    "verify-remote-identity",
    "publish-github-release",
    "sync-explicit-generated-copies",
)


class ReleaseError(RuntimeError):
    """A release contract failed without changing canonical or remote state."""


def _is_formal_verification_plan(value: object) -> bool:
    if not isinstance(value, Sequence) or isinstance(value, (str, bytes)):
        return False
    try:
        commands = [dict(command) for command in value]
    except (TypeError, ValueError):
        return False
    return commands == [dict(command) for command in DEFAULT_VERIFICATION_COMMANDS]


@total_ordering
@dataclasses.dataclass(frozen=True)
class SemVer:
    major: int
    minor: int
    patch: int
    prerelease: tuple[str, ...] = ()
    build: tuple[str, ...] = ()

    @classmethod
    def parse(cls, value: str) -> "SemVer":
        match = SEMVER_PATTERN.fullmatch(value) if isinstance(value, str) else None
        if match is None:
            raise ReleaseError(f"invalid semantic version: {value!r}")
        prerelease = tuple(match.group(4).split(".")) if match.group(4) else ()
        build = tuple(match.group(5).split(".")) if match.group(5) else ()
        for identifier in prerelease:
            if identifier.isdigit() and len(identifier) > 1 and identifier.startswith("0"):
                raise ReleaseError(
                    f"numeric prerelease identifiers must not contain leading zeros: {value}"
                )
        return cls(
            int(match.group(1)),
            int(match.group(2)),
            int(match.group(3)),
            prerelease,
            build,
        )

    @property
    def core(self) -> tuple[int, int, int]:
        return self.major, self.minor, self.patch

    @property
    def rc_number(self) -> int | None:
        if (
            len(self.prerelease) == 2
            and self.prerelease[0] == "rc"
            and self.prerelease[1].isdigit()
            and int(self.prerelease[1]) > 0
        ):
            return int(self.prerelease[1])
        return None

    def __str__(self) -> str:
        value = f"{self.major}.{self.minor}.{self.patch}"
        if self.prerelease:
            value += "-" + ".".join(self.prerelease)
        if self.build:
            value += "+" + ".".join(self.build)
        return value

    def _compare(self, other: "SemVer") -> int:
        if self.core != other.core:
            return -1 if self.core < other.core else 1
        if not self.prerelease and not other.prerelease:
            return 0
        if not self.prerelease:
            return 1
        if not other.prerelease:
            return -1
        limit = max(len(self.prerelease), len(other.prerelease))
        for index in range(limit):
            if index >= len(self.prerelease):
                return -1
            if index >= len(other.prerelease):
                return 1
            left = self.prerelease[index]
            right = other.prerelease[index]
            if left == right:
                continue
            if left.isdigit() and right.isdigit():
                return -1 if int(left) < int(right) else 1
            if left.isdigit() != right.isdigit():
                return -1 if left.isdigit() else 1
            return -1 if left < right else 1
        return 0

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, SemVer):
            return NotImplemented
        return self._compare(other) == 0

    def __lt__(self, other: object) -> bool:
        if not isinstance(other, SemVer):
            return NotImplemented
        return self._compare(other) < 0


@dataclasses.dataclass(frozen=True)
class SourceSnapshot:
    mode: str
    ref: str
    commit: str
    tree: str | None
    epoch: int
    dirty: bool
    dirty_entries: tuple[str, ...]
    files: Mapping[str, bytes]

    @property
    def content_digest(self) -> str:
        return digest_file_map(self.files)


class PublishAdapter(Protocol):
    def execute(
        self,
        step: str,
        plan: Mapping[str, object],
        candidate: Path,
    ) -> Mapping[str, object] | None:
        """Execute one idempotent publication step and return journal-safe facts."""


CommandRunner = Callable[[Sequence[str], Path], int]


def sha256_bytes(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def canonical_json_bytes(value: object) -> bytes:
    return (
        json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        + "\n"
    ).encode("utf-8")


def pretty_json_bytes(value: object) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def plan_digest(plan: Mapping[str, object]) -> str:
    unsigned = dict(plan)
    unsigned.pop("planDigest", None)
    return sha256_bytes(canonical_json_bytes(unsigned))


def attach_plan_digest(plan: Mapping[str, object]) -> dict[str, object]:
    result = copy.deepcopy(dict(plan))
    result["planDigest"] = plan_digest(result)
    return result


def assert_plan_digest(plan: Mapping[str, object]) -> None:
    actual = plan.get("planDigest")
    expected = plan_digest(plan)
    if actual != expected:
        raise ReleaseError(
            f"release plan digest mismatch: expected {expected}, found {actual!r}"
        )


def digest_file_map(files: Mapping[str, bytes]) -> str:
    digest = hashlib.sha256()
    for relative in sorted(files):
        content = files[relative]
        digest.update(relative.encode("utf-8"))
        digest.update(b"\0")
        digest.update(str(len(content)).encode("ascii"))
        digest.update(b"\0")
        digest.update(hashlib.sha256(content).digest())
    return digest.hexdigest()


def file_inventory(files: Mapping[str, bytes]) -> list[dict[str, object]]:
    return [
        {
            "path": relative,
            "size": len(files[relative]),
            "sha256": sha256_bytes(files[relative]),
        }
        for relative in sorted(files)
    ]


def validate_relative_path(relative: str) -> PurePosixPath:
    if "\\" in relative:
        raise ReleaseError(f"release paths must use forward slashes: {relative!r}")
    path = PurePosixPath(relative)
    if path.is_absolute() or not path.parts or any(part in {"", ".", ".."} for part in path.parts):
        raise ReleaseError(f"unsafe release path: {relative!r}")
    return path


def should_include(relative: str, excluded_prefixes: Iterable[str] = ()) -> bool:
    path = validate_relative_path(relative)
    parts = path.parts
    if parts[0] not in INCLUDED_ROOT_FILES and parts[0] not in INCLUDED_ROOT_DIRECTORIES:
        return False
    if any(part in EXCLUDED_DIRECTORY_NAMES or part.startswith("test-results") for part in parts):
        return False
    if path.suffix.lower() in EXCLUDED_SUFFIXES:
        return False
    if path.name == ".env" or (path.name.startswith(".env.") and path.name != ".env.example"):
        return False
    for prefix in excluded_prefixes:
        prefix_path = PurePosixPath(prefix)
        if path == prefix_path or prefix_path in path.parents:
            return False
    return True


def collect_worktree_files(
    root: Path,
    *,
    excluded_prefixes: Iterable[str] = (),
) -> dict[str, bytes]:
    result: dict[str, bytes] = {}
    for path in sorted(root.rglob("*"), key=lambda item: item.as_posix()):
        relative = path.relative_to(root).as_posix()
        if path.is_symlink():
            if should_include(relative, excluded_prefixes):
                raise ReleaseError(f"release input must not contain symbolic links: {relative}")
            continue
        if not path.is_file() or not should_include(relative, excluded_prefixes):
            continue
        key = relative.casefold()
        collision = next((name for name in result if name.casefold() == key), None)
        if collision is not None:
            raise ReleaseError(
                f"case-insensitive release path collision: {collision!r} and {relative!r}"
            )
        result[relative] = path.read_bytes()
    if "SKILL.md" not in result or VERSION_PATHS["package"] not in result:
        raise ReleaseError("release input does not contain the required Skill and React kit")
    return result


def _git(root: Path, *args: str, binary: bool = False) -> bytes | str:
    process = subprocess.run(
        ["git", *args],
        cwd=root,
        capture_output=True,
        check=False,
    )
    if process.returncode != 0:
        message = process.stderr.decode("utf-8", errors="replace").strip()
        raise ReleaseError(f"git {' '.join(args)} failed: {message or process.returncode}")
    if binary:
        return process.stdout
    return process.stdout.decode("utf-8", errors="strict").strip()


def collect_commit_files(root: Path, commit: str) -> dict[str, bytes]:
    archive = _git(root, "archive", "--format=tar", commit, binary=True)
    assert isinstance(archive, bytes)
    result: dict[str, bytes] = {}
    with tarfile.open(fileobj=io.BytesIO(archive), mode="r:") as bundle:
        for member in bundle.getmembers():
            if member.isdir():
                continue
            if not member.isfile():
                raise ReleaseError(f"release commit contains a link or special file: {member.name}")
            relative = PurePosixPath(member.name).as_posix()
            if not should_include(relative):
                continue
            extracted = bundle.extractfile(member)
            if extracted is None:
                raise ReleaseError(f"unable to read archived source file: {relative}")
            result[relative] = extracted.read()
    if "SKILL.md" not in result or VERSION_PATHS["package"] not in result:
        raise ReleaseError("release commit does not contain the required Skill and React kit")
    return result


def load_source_snapshot(
    root: Path,
    *,
    source_mode: str,
    source_ref: str,
    allow_dirty_local: bool,
    output: Path | None = None,
) -> SourceSnapshot:
    root = root.resolve()
    commit = str(_git(root, "rev-parse", "--verify", f"{source_ref}^{{commit}}"))
    tree = str(_git(root, "rev-parse", "--verify", f"{commit}^{{tree}}"))
    epoch_text = str(_git(root, "show", "-s", "--format=%ct", commit))
    epoch = int(epoch_text)

    if source_mode == "commit":
        files = collect_commit_files(root, commit)
        dirty = False
        dirty_entries: tuple[str, ...] = ()
    elif source_mode == "worktree":
        head = str(_git(root, "rev-parse", "--verify", "HEAD^{commit}"))
        status_text = str(_git(root, "status", "--porcelain=v1", "--untracked-files=all"))
        dirty_entries = tuple(sorted(line for line in status_text.splitlines() if line))
        if commit != head:
            raise ReleaseError("worktree snapshots require --source-ref to resolve to HEAD")
        if dirty_entries and not allow_dirty_local:
            raise ReleaseError(
                "working tree is dirty; pass --allow-dirty-local only for a non-publishable local candidate"
            )
        files = collect_worktree_files(root)
        dirty = bool(dirty_entries)
    else:
        raise ReleaseError(f"unsupported source mode: {source_mode}")

    return SourceSnapshot(
        mode=source_mode,
        ref=source_ref,
        commit=commit,
        tree=tree if source_mode == "commit" else None,
        epoch=epoch,
        dirty=dirty,
        dirty_entries=dirty_entries,
        files=files,
    )


def _read_json(files: Mapping[str, bytes], relative: str) -> dict[str, object]:
    try:
        value = json.loads(files[relative].decode("utf-8"))
    except KeyError as error:
        raise ReleaseError(f"required release file is missing: {relative}") from error
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ReleaseError(f"invalid JSON in {relative}: {error}") from error
    if not isinstance(value, dict):
        raise ReleaseError(f"release JSON must contain an object: {relative}")
    return value


def _write_json(files: dict[str, bytes], relative: str, value: object) -> None:
    files[relative] = pretty_json_bytes(value)


def _replace_exact_marker(
    files: dict[str, bytes],
    relative: str,
    *,
    expected: str,
    replacement: str,
) -> None:
    try:
        text = files[relative].decode("utf-8")
    except KeyError as error:
        raise ReleaseError(f"required release file is missing: {relative}") from error
    except UnicodeDecodeError as error:
        raise ReleaseError(f"release text must be UTF-8: {relative}") from error
    occurrences = text.count(expected)
    if occurrences != 1:
        raise ReleaseError(
            f"expected exactly one version marker {expected!r} in {relative}; "
            f"found {occurrences}"
        )
    files[relative] = text.replace(expected, replacement).encode("utf-8")


def _validate_exact_json_version_field(
    files: Mapping[str, bytes], relative: str, *, field: str, expected: str
) -> None:
    try:
        text = files[relative].decode("utf-8")
    except KeyError as error:
        raise ReleaseError(f"required release file is missing: {relative}") from error
    except UnicodeDecodeError as error:
        raise ReleaseError(f"release JSON must be UTF-8: {relative}") from error
    field_matches = re.findall(rf'"{re.escape(field)}"\s*:', text)
    expected_matches = re.findall(
        rf'"{re.escape(field)}"\s*:\s*"{re.escape(expected)}"', text
    )
    if len(field_matches) != 1 or len(expected_matches) != 1:
        raise ReleaseError(
            f"expected exactly one {field}={expected!r} field in {relative}; "
            f"found {len(field_matches)} field(s) and {len(expected_matches)} expected value(s)"
        )


def validate_target_version(
    *,
    baseline_value: str,
    release_target_value: str,
    candidate_value: str,
    classification: str,
    existing_versions: Iterable[str] = (),
    promotion_from: str | None = None,
) -> None:
    baseline = SemVer.parse(baseline_value)
    release_target = SemVer.parse(release_target_value)
    candidate = SemVer.parse(candidate_value)
    if release_target.prerelease or release_target.build:
        raise ReleaseError("releaseTarget must be a stable semantic version")
    if candidate.build:
        raise ReleaseError("release candidates must not use build metadata")
    if candidate.core != release_target.core:
        raise ReleaseError(
            f"candidate {candidate} is outside the planned {release_target} release line"
        )
    if candidate.prerelease and candidate.rc_number is None:
        raise ReleaseError("the only supported prerelease form is rc.N with N greater than zero")
    if candidate <= baseline:
        raise ReleaseError(f"candidate {candidate} must be newer than baseline {baseline}")
    if classification not in {"none", "additive", "breaking"}:
        raise ReleaseError(f"unknown API compatibility classification: {classification!r}")

    if classification == "breaking":
        valid_bump = (
            candidate.major > baseline.major
            if baseline.major > 0
            else candidate.major > baseline.major or candidate.minor > baseline.minor
        )
        if not valid_bump:
            required = "major" if baseline.major > 0 else "minor"
            raise ReleaseError(f"breaking API changes require a {required} version line")
    elif classification == "additive":
        valid_bump = (
            candidate.major > baseline.major
            or candidate.minor > baseline.minor
            if baseline.major > 0
            else candidate > baseline
        )
        if not valid_bump:
            required = "minor" if baseline.major > 0 else "patch"
            raise ReleaseError(f"additive API changes require at least a {required} bump")

    existing: list[SemVer] = []
    for raw in existing_versions:
        value = raw[1:] if raw.startswith("v") else raw
        try:
            existing.append(SemVer.parse(value))
        except ReleaseError:
            continue
    if any(version == candidate and version.build == candidate.build for version in existing):
        raise ReleaseError(f"candidate version already exists: {candidate}")
    if candidate.rc_number is not None:
        if promotion_from is not None:
            raise ReleaseError("RC preparation must not specify promotion-from")
        prior_rcs = [
            version.rc_number
            for version in existing
            if version.core == candidate.core and version.rc_number is not None
        ]
        if prior_rcs and candidate.rc_number <= max(prior_rcs):
            raise ReleaseError(
                f"candidate rc.{candidate.rc_number} must follow existing rc.{max(prior_rcs)}"
            )
    else:
        if promotion_from is None:
            raise ReleaseError(
                "stable release preparation requires --promotion-from pointing to a verified RC candidate"
            )
        promoted_value = (
            promotion_from[1:] if promotion_from.startswith("v") else promotion_from
        )
        promoted = SemVer.parse(promoted_value)
        if promoted.rc_number is None or promoted.core != candidate.core:
            raise ReleaseError(
                "promotion-from must identify an rc.N candidate on the same release line"
            )


def _validate_source_integrity(files: Mapping[str, bytes], manifest: Mapping[str, object]) -> None:
    integrity = manifest.get("sourceIntegrity")
    if not isinstance(integrity, dict):
        raise ReleaseError("component manifest sourceIntegrity is missing")
    prefix = "assets/react-kit/src/personal-ui/"
    actual = {
        relative[len(prefix) :]: sha256_bytes(content)
        for relative, content in files.items()
        if relative.startswith(prefix)
    }
    expected = {str(key): value for key, value in integrity.items()}
    if actual != expected:
        missing = sorted(set(expected) - set(actual))
        extra = sorted(set(actual) - set(expected))
        changed = sorted(
            key for key in set(actual) & set(expected) if actual[key] != expected[key]
        )
        raise ReleaseError(
            "component source integrity is stale "
            f"(missing={missing[:3]}, extra={extra[:3]}, changed={changed[:3]})"
        )


def transform_candidate_files(
    source_files: Mapping[str, bytes],
    *,
    candidate_version: str,
    existing_versions: Iterable[str] = (),
    promotion_from: str | None = None,
) -> tuple[dict[str, bytes], dict[str, object]]:
    files = dict(source_files)
    package = _read_json(files, VERSION_PATHS["package"])
    lock = _read_json(files, VERSION_PATHS["lock"])
    registry = _read_json(files, VERSION_PATHS["registry"])
    manifest = _read_json(files, VERSION_PATHS["manifest"])
    policy = _read_json(files, VERSION_PATHS["policy"])
    compatibility = _read_json(files, VERSION_PATHS["compatibility"])
    coverage = _read_json(files, VERSION_PATHS["coverage"])
    ownership = _read_json(files, VERSION_PATHS["ownership"])

    lock_packages = lock.get("packages")
    lock_root = lock_packages.get("") if isinstance(lock_packages, dict) else None
    current_report = compatibility.get("current")
    version_policy = compatibility.get("versionPolicy")
    if not isinstance(lock_root, dict):
        raise ReleaseError("package-lock.json packages[''] metadata is missing")
    if not isinstance(current_report, dict) or not isinstance(version_policy, dict):
        raise ReleaseError("API compatibility report has incomplete version metadata")

    versions = {
        "package.json": package.get("version"),
        "package-lock.json": lock.get("version"),
        "package-lock.json packages['']": lock_root.get("version"),
        "registry.json": registry.get("version"),
        "component-manifest.json": manifest.get("kitVersion"),
        "API compatibility current": current_report.get("version"),
        "API compatibility package": version_policy.get("packageVersion"),
        "component coverage": coverage.get("kitVersion"),
        "module ownership": ownership.get("kitVersion"),
    }
    if any(not isinstance(value, str) for value in versions.values()):
        raise ReleaseError(f"invalid version source: {versions}")
    if len(set(versions.values())) != 1:
        raise ReleaseError(f"version sources disagree: {versions}")
    baseline = policy.get("baselineVersion")
    release_target = policy.get("releaseTarget")
    classification = compatibility.get("classification")
    if not isinstance(baseline, str) or not isinstance(release_target, str):
        raise ReleaseError("API version policy is missing baselineVersion or releaseTarget")
    if versions["package.json"] != baseline:
        raise ReleaseError(
            f"canonical source must remain at baseline {baseline} before isolated preparation; "
            f"found {versions['package.json']}"
        )
    if not isinstance(classification, str):
        raise ReleaseError("API compatibility report classification is missing")
    _validate_exact_json_version_field(
        files,
        VERSION_PATHS["coverage"],
        field="kitVersion",
        expected=baseline,
    )
    _validate_exact_json_version_field(
        files,
        VERSION_PATHS["ownership"],
        field="kitVersion",
        expected=baseline,
    )
    validate_target_version(
        baseline_value=baseline,
        release_target_value=release_target,
        candidate_value=candidate_version,
        classification=classification,
        existing_versions=existing_versions,
        promotion_from=promotion_from,
    )
    _validate_source_integrity(files, manifest)

    package["version"] = candidate_version
    lock["version"] = candidate_version
    lock_root["version"] = candidate_version
    registry["version"] = candidate_version
    manifest["kitVersion"] = candidate_version
    current_report["version"] = candidate_version
    version_policy["packageVersion"] = candidate_version
    coverage["kitVersion"] = candidate_version
    ownership["kitVersion"] = candidate_version
    _write_json(files, VERSION_PATHS["package"], package)
    _write_json(files, VERSION_PATHS["lock"], lock)
    _write_json(files, VERSION_PATHS["registry"], registry)
    _write_json(files, VERSION_PATHS["manifest"], manifest)
    _write_json(files, VERSION_PATHS["compatibility"], compatibility)
    _write_json(files, VERSION_PATHS["coverage"], coverage)
    _write_json(files, VERSION_PATHS["ownership"], ownership)
    _replace_exact_marker(
        files,
        COMPONENT_API_PATH,
        expected=f"Personal UI {baseline}",
        replacement=f"Personal UI {candidate_version}",
    )
    _replace_exact_marker(
        files,
        COMPONENT_CATALOG_PATH,
        expected=f"- Version: `{baseline}`",
        replacement=f"- Version: `{candidate_version}`",
    )
    return files, {
        "baselineVersion": baseline,
        "releaseTarget": release_target,
        "candidateVersion": candidate_version,
        "classification": classification,
        "sourceVersion": versions["package.json"],
    }


def _skill_license_identifier(skill_bytes: bytes) -> str | None:
    skill = skill_bytes.decode("utf-8", errors="replace").replace("\r\n", "\n")
    match = FRONTMATTER.match(skill)
    if match is None:
        return None
    frontmatter, errors = parse_frontmatter(match.group("body"))
    value = frontmatter.get("license")
    return value.strip() if not errors and isinstance(value, str) and value.strip() else None


def inspect_license(files: Mapping[str, bytes]) -> dict[str, object]:
    license_files = [name for name in LICENSE_FILES if name in files]
    notice_files = [name for name in NOTICE_FILES if name in files]
    package = _read_json(files, VERSION_PATHS["package"])
    package_license = package.get("license")
    skill_license = _skill_license_identifier(files.get("SKILL.md", b""))
    lock = _read_json(files, VERSION_PATHS["lock"])
    lock_packages = lock.get("packages")
    lock_root = lock_packages.get("") if isinstance(lock_packages, dict) else None
    lock_license = lock_root.get("license") if isinstance(lock_root, dict) else None
    blockers: list[str] = []
    if "LICENSE" not in files:
        blockers.append("license-file-missing")
    else:
        normalized_license = files["LICENSE"].replace(b"\r\n", b"\n")
        if not normalized_license.strip():
            blockers.append("license-file-empty:LICENSE")
        elif normalized_license != EXPECTED_LICENSE_TEXT.encode("utf-8"):
            blockers.append("license-file-content-mismatch:LICENSE")
    if not isinstance(package_license, str) or not package_license.strip():
        blockers.append("package-license-missing")
    if not skill_license:
        blockers.append("skill-license-missing")
    if not isinstance(lock_license, str) or not lock_license.strip():
        blockers.append("lock-license-missing")
    present_identifiers = (
        package_license if isinstance(package_license, str) and package_license.strip() else None,
        skill_license,
        lock_license if isinstance(lock_license, str) and lock_license.strip() else None,
    )
    if any(
        identifier is not None and identifier != EXPECTED_LICENSE_IDENTIFIER
        for identifier in present_identifiers
    ):
        blockers.append("license-metadata-mismatch")
    if STRUCTURED_NOTICE_FILE not in files:
        blockers.append("third-party-notices-missing")
    else:
        try:
            notice = json.loads(files[STRUCTURED_NOTICE_FILE].decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            notice = None
        valid_notice = _validate_third_party_notice(notice, lock)
        if not valid_notice:
            blockers.append("third-party-notices-invalid")
    return {
        "selected": not blockers,
        "licenseFiles": license_files,
        "noticeFiles": notice_files,
        "packageLicense": package_license if isinstance(package_license, str) else None,
        "skillLicense": skill_license,
        "lockLicense": lock_license if isinstance(lock_license, str) else None,
        "blockers": sorted(set(blockers)),
    }


NOTICE_STRING_FIELDS = (
    "name",
    "version",
    "license",
    "source",
    "resolved",
    "dependencyType",
)


def _package_name_from_lock_path(package_path: str) -> str | None:
    parts = PurePosixPath(package_path).parts
    node_modules_indexes = [
        index for index, part in enumerate(parts) if part == "node_modules"
    ]
    if not node_modules_indexes:
        return None
    tail = parts[node_modules_indexes[-1] + 1 :]
    if len(tail) == 1 and tail[0] and not tail[0].startswith("@"):
        return tail[0]
    if (
        len(tail) == 2
        and tail[0].startswith("@")
        and len(tail[0]) > 1
        and tail[1]
    ):
        return f"{tail[0]}/{tail[1]}"
    return None


def _notice_dependency_type(
    package_path: str,
    name: str,
    package: Mapping[str, object],
    lock_root: Mapping[str, object],
) -> str:
    direct_path = f"node_modules/{name}"
    if package_path == direct_path:
        runtime_dependencies = lock_root.get("dependencies", {})
        optional_dependencies = lock_root.get("optionalDependencies", {})
        dev_dependencies = lock_root.get("devDependencies", {})
        if (
            isinstance(runtime_dependencies, dict)
            and name in runtime_dependencies
        ) or (
            isinstance(optional_dependencies, dict)
            and name in optional_dependencies
        ):
            return "runtime-direct"
        if isinstance(dev_dependencies, dict) and name in dev_dependencies:
            return "dev-direct"
    return "dev-transitive" if package.get("dev") is True else "runtime-transitive"


def _locked_notice_inventory(
    lock: Mapping[str, object],
) -> dict[tuple[str, str], dict[str, object]] | None:
    packages = lock.get("packages")
    if not isinstance(packages, dict):
        return None
    lock_root = packages.get("")
    if not isinstance(lock_root, dict):
        return None

    inventory: dict[tuple[str, str], dict[str, object]] = {}
    for package_path, package in packages.items():
        if package_path == "":
            continue
        if not isinstance(package_path, str) or not isinstance(package, dict):
            return None
        name = _package_name_from_lock_path(package_path)
        version = package.get("version")
        license_name = package.get("license")
        resolved = package.get("resolved")
        if name is None or not all(
            isinstance(value, str) and bool(value.strip())
            for value in (version, license_name, resolved)
        ):
            return None
        assert isinstance(version, str)
        key = (name, version)
        if key in inventory:
            return None
        inventory[key] = {
            "license": license_name,
            "resolved": resolved,
            "dependencyType": _notice_dependency_type(
                package_path, name, package, lock_root
            ),
            "optional": package.get("optional") is True,
        }
    return inventory


def _validate_third_party_notice(
    notice: object, lock: Mapping[str, object]
) -> bool:
    expected = _locked_notice_inventory(lock)
    if (
        expected is None
        or not expected
        or not isinstance(notice, dict)
        or notice.get("schemaVersion") != SCHEMA_VERSION
        or notice.get("kind") != "personal-ui-third-party-notices"
        or notice.get("generatedFrom") != VERSION_PATHS["lock"]
        or type(notice.get("dependencyCount")) is not int
        or notice["dependencyCount"] != len(expected)
        or not isinstance(notice.get("items"), list)
        or not notice["items"]
    ):
        return False

    actual: dict[tuple[str, str], Mapping[str, object]] = {}
    for item in notice["items"]:
        if not isinstance(item, dict) or not all(
            isinstance(item.get(field), str) and bool(item[field].strip())
            for field in NOTICE_STRING_FIELDS
        ):
            return False
        if not isinstance(item.get("optional"), bool):
            return False
        key = (item["name"], item["version"])
        if key in actual:
            return False
        actual[key] = item

    if actual.keys() != expected.keys():
        return False
    return all(
        item["license"] == expected[key]["license"]
        and item["source"] == expected[key]["resolved"]
        and item["resolved"] == expected[key]["resolved"]
        and item["dependencyType"] == expected[key]["dependencyType"]
        and item["optional"] is expected[key]["optional"]
        for key, item in actual.items()
    )


def inspect_release_documentation(files: Mapping[str, bytes]) -> dict[str, object]:
    blockers: list[str] = []
    changelog = files.get("CHANGELOG.md", b"").decode("utf-8", errors="replace")
    migrations = files.get("references/v0.3.0-migrations.md", b"").decode(
        "utf-8", errors="replace"
    )
    release_process = files.get("references/release-process.md")
    if "## [Unreleased]" not in changelog:
        blockers.append("changelog-unreleased-section-missing")
    for heading in REQUIRED_MIGRATION_HEADINGS:
        if heading not in migrations:
            blockers.append(f"migration-section-missing:{heading[3:]}")
    if release_process is None:
        blockers.append("release-process-document-missing")
    return {"valid": not blockers, "blockers": blockers}


def _changelog_section(changelog: str, heading: str) -> str | None:
    match = re.search(
        rf"(?ms)^## \[{re.escape(heading)}\](?:\s+-\s+\d{{4}}-\d{{2}}-\d{{2}})?"
        r"\s*\n(?P<body>.*?)(?=^## (?!#)|\Z)",
        changelog,
    )
    return match.group("body").strip() if match is not None else None


def promote_changelog(
    content: bytes,
    *,
    candidate_version: str,
    source_epoch: int,
    promotion: Mapping[str, object],
) -> bytes:
    changelog = content.decode("utf-8", errors="strict")
    if re.search(rf"(?m)^## \[{re.escape(candidate_version)}\](?:\s|$)", changelog):
        raise ReleaseError(f"CHANGELOG already contains release {candidate_version}")
    matches = list(
        re.finditer(
            r"(?ms)^## \[Unreleased\](?:\s+-\s+\d{4}-\d{2}-\d{2})?"
            r"\s*\n(?P<body>.*?)(?=^## (?!#)|\Z)",
            changelog,
        )
    )
    if len(matches) != 1:
        raise ReleaseError("stable promotion requires exactly one Unreleased changelog section")
    match = matches[0]
    if not match.group("body").strip():
        raise ReleaseError("stable promotion requires non-empty Unreleased changelog notes")
    body = match.group("body").strip()
    statuses = list(
        re.finditer(
            r"(?ms)^### Release status\s*\n(?P<body>.*?)(?=^### |\Z)", body
        )
    )
    if len(statuses) != 1:
        raise ReleaseError(
            "stable promotion requires exactly one structured CHANGELOG Release status section"
        )
    status = statuses[0]
    from_version = promotion.get("fromVersion")
    plan_digest = promotion.get("planDigest")
    if not isinstance(from_version, str) or not isinstance(plan_digest, str):
        raise ReleaseError("stable promotion changelog binding is incomplete")
    stable_status = (
        "### Release status\n\n"
        f"- Promoted from verified `{from_version}` with reviewed RC plan "
        f"`{plan_digest}`.\n"
        "- Public availability is established only after exact stable-plan authorization, "
        "immutable tag verification, GitHub Release publication, and public reinstall checks."
    )
    body_parts = (body[: status.start()].strip(), stable_status, body[status.end() :].strip())
    body = "\n\n".join(part for part in body_parts if part)
    release_date = dt.datetime.fromtimestamp(source_epoch, tz=dt.timezone.utc).date()
    replacement = (
        "## [Unreleased]\n\n"
        f"## [{candidate_version}] - {release_date.isoformat()}\n\n"
        f"{body}\n\n"
    )
    return (changelog[: match.start()] + replacement + changelog[match.end() :]).encode(
        "utf-8"
    )


def extract_release_notes(
    files: Mapping[str, bytes],
    candidate_version: str,
    *,
    promotion: Mapping[str, object] | None = None,
) -> bytes:
    changelog = files.get(CHANGELOG_PATH, b"").decode("utf-8", errors="strict")
    version = SemVer.parse(candidate_version)
    section = "Unreleased" if version.prerelease else candidate_version
    body = _changelog_section(changelog, section)
    if not body:
        body = "Release notes are pending; this candidate is not publishable."
    if version.prerelease:
        status = "Local release candidate. This file does not announce a public release."
    else:
        if not isinstance(promotion, Mapping):
            raise ReleaseError("stable release notes require a verified promotion binding")
        from_version = promotion.get("fromVersion")
        plan_digest = promotion.get("planDigest")
        if not isinstance(from_version, str) or not isinstance(plan_digest, str):
            raise ReleaseError("stable release notes promotion binding is incomplete")
        status = (
            f"Stable release prepared from verified `{from_version}`. Publication still "
            f"requires authorization for this stable plan.\n\n"
            f"Reviewed RC plan digest: `{plan_digest}`."
        )
    return (
        f"# ui-builder-xtn {candidate_version}\n\n"
        f"{status}\n\n"
        f"{body}\n"
    ).encode("utf-8")


def extract_unreleased_notes(files: Mapping[str, bytes], candidate_version: str) -> bytes:
    """Compatibility wrapper for callers that prepare an RC."""
    return extract_release_notes(files, candidate_version)


def _zip_timestamp(epoch: int) -> tuple[int, int, int, int, int, int]:
    instant = dt.datetime.fromtimestamp(epoch, tz=dt.timezone.utc)
    if instant.year < 1980:
        instant = dt.datetime(1980, 1, 1, tzinfo=dt.timezone.utc)
    if instant.year > 2107:
        instant = dt.datetime(2107, 12, 31, 23, 59, 58, tzinfo=dt.timezone.utc)
    return (
        instant.year,
        instant.month,
        instant.day,
        instant.hour,
        instant.minute,
        instant.second - instant.second % 2,
    )


def deterministic_zip_bytes(
    files: Mapping[str, bytes],
    *,
    epoch: int,
    prefix: str = ARCHIVE_PREFIX,
) -> bytes:
    buffer = io.BytesIO()
    seen_casefold: dict[str, str] = {}
    with zipfile.ZipFile(buffer, mode="w", compression=zipfile.ZIP_STORED) as archive:
        for relative in sorted(files):
            validate_relative_path(relative)
            folded = relative.casefold()
            if folded in seen_casefold:
                raise ReleaseError(
                    f"case-insensitive archive collision: {seen_casefold[folded]} and {relative}"
                )
            seen_casefold[folded] = relative
            info = zipfile.ZipInfo(f"{prefix}/{relative}", date_time=_zip_timestamp(epoch))
            info.create_system = 3
            info.external_attr = 0o100644 << 16
            info.compress_type = zipfile.ZIP_STORED
            archive.writestr(info, files[relative])
    return buffer.getvalue()


def verify_zip_bytes(
    archive_bytes: bytes,
    expected_files: Mapping[str, bytes],
    *,
    prefix: str = ARCHIVE_PREFIX,
) -> None:
    expected_names = [f"{prefix}/{name}" for name in sorted(expected_files)]
    with zipfile.ZipFile(io.BytesIO(archive_bytes), mode="r") as archive:
        names = archive.namelist()
        if names != expected_names:
            raise ReleaseError("archive file list or ordering does not match the release plan")
        for name in names:
            path = PurePosixPath(name)
            if path.is_absolute() or ".." in path.parts or "\\" in name:
                raise ReleaseError(f"unsafe archive member: {name}")
            mode = archive.getinfo(name).external_attr >> 16
            if mode and (mode & 0o170000) not in {0, 0o100000}:
                raise ReleaseError(f"archive member is not a regular file: {name}")
            relative = PurePosixPath(*path.parts[1:]).as_posix()
            if archive.read(name) != expected_files[relative]:
                raise ReleaseError(f"archive content mismatch: {relative}")


def _candidate_blockers(
    source: SourceSnapshot,
    license_report: Mapping[str, object],
    docs_report: Mapping[str, object],
) -> list[str]:
    blockers: list[str] = []
    if source.mode != "commit":
        blockers.append("source-is-not-an-immutable-commit")
    if source.dirty:
        blockers.append("source-worktree-is-dirty")
    blockers.extend(str(value) for value in license_report.get("blockers", []))
    blockers.extend(str(value) for value in docs_report.get("blockers", []))
    return sorted(set(blockers))


def _promotion_delta(
    source_files: Mapping[str, bytes],
    target_files: Mapping[str, bytes],
    *,
    source_content_digest: object,
    target_content_digest: str,
) -> dict[str, object]:
    if set(source_files) != set(target_files):
        missing = sorted(set(source_files) - set(target_files))
        extra = sorted(set(target_files) - set(source_files))
        raise ReleaseError(
            "stable promotion must preserve the RC file set "
            f"(missing={missing[:3]}, extra={extra[:3]})"
        )
    changed = sorted(
        path for path in source_files if source_files[path] != target_files[path]
    )
    if set(changed) != set(PROMOTION_METADATA_PATHS):
        unexpected = sorted(set(changed) - set(PROMOTION_METADATA_PATHS))
        missing = sorted(set(PROMOTION_METADATA_PATHS) - set(changed))
        raise ReleaseError(
            "stable promotion differs from the RC outside the exact release metadata set "
            f"(unexpected={unexpected[:3]}, missing={missing[:3]})"
        )
    entries = [
        {
            "path": path,
            "before": {
                "size": len(source_files[path]),
                "sha256": sha256_bytes(source_files[path]),
            },
            "after": {
                "size": len(target_files[path]),
                "sha256": sha256_bytes(target_files[path]),
            },
        }
        for path in changed
    ]
    return {
        "allowedPaths": sorted(PROMOTION_METADATA_PATHS),
        "changedPaths": changed,
        "sourceCandidateContentDigest": source_content_digest,
        "targetCandidateContentDigest": target_content_digest,
        "entries": entries,
    }


def build_release_plan(
    source: SourceSnapshot,
    *,
    candidate_version: str,
    existing_versions: Iterable[str] = (),
    promotion_from: str | None = None,
    promotion: Mapping[str, object] | None = None,
    promotion_files: Mapping[str, bytes] | None = None,
    verification_commands: Sequence[Mapping[str, object]] = DEFAULT_VERIFICATION_COMMANDS,
) -> tuple[dict[str, object], dict[str, bytes], bytes, bytes]:
    candidate = SemVer.parse(candidate_version)
    if candidate.prerelease:
        if promotion is not None or promotion_files is not None:
            raise ReleaseError("RC preparation must not include stable promotion material")
    elif promotion is None or promotion_files is None:
        raise ReleaseError(
            "stable release preparation requires --promotion-from pointing to a verified RC candidate"
        )
    if not candidate.prerelease and not _is_formal_verification_plan(
        verification_commands
    ):
        raise ReleaseError("stable promotion requires the frozen formal verification plan")
    candidate_files, version_report = transform_candidate_files(
        source.files,
        candidate_version=candidate_version,
        existing_versions=existing_versions,
        promotion_from=promotion_from,
    )
    promotion_record: dict[str, object] | None = None
    if not candidate.prerelease:
        assert promotion is not None and promotion_files is not None
        promotion_record = copy.deepcopy(dict(promotion))
        candidate_files[CHANGELOG_PATH] = promote_changelog(
            candidate_files[CHANGELOG_PATH],
            candidate_version=candidate_version,
            source_epoch=source.epoch,
            promotion=promotion_record,
        )
        target_digest = digest_file_map(candidate_files)
        promotion_record["fileDelta"] = _promotion_delta(
            promotion_files,
            candidate_files,
            source_content_digest=promotion_record.get("candidateContentDigest"),
            target_content_digest=target_digest,
        )
        version_report["promotionFrom"] = promotion_record.get("fromVersion")
    license_report = inspect_license(candidate_files)
    docs_report = inspect_release_documentation(candidate_files)
    blockers = _candidate_blockers(source, license_report, docs_report)
    archive_bytes = deterministic_zip_bytes(candidate_files, epoch=source.epoch)
    release_notes = extract_release_notes(
        candidate_files,
        candidate_version,
        promotion=promotion_record,
    )
    archive_name = f"{ARCHIVE_PREFIX}-{candidate_version}.zip"
    archive_meta = {
        "path": f"artifacts/{archive_name}",
        "sha256": sha256_bytes(archive_bytes),
        "size": len(archive_bytes),
    }
    release_notes_meta = {
        "path": f"artifacts/{NOTES_NAME}",
        "sha256": sha256_bytes(release_notes),
        "size": len(release_notes),
    }
    plan: dict[str, object] = {
        "schemaVersion": SCHEMA_VERSION,
        "kind": "personal-ui-release-plan",
        "candidateVersion": candidate_version,
        "source": {
            "mode": source.mode,
            "ref": source.ref,
            "commit": source.commit,
            "tree": source.tree,
            "sourceDateEpoch": source.epoch,
            "dirty": source.dirty,
            "dirtyEntries": list(source.dirty_entries),
            "contentDigest": source.content_digest,
        },
        "versionPolicy": version_report,
        "license": license_report,
        "documentation": docs_report,
        "publishable": not blockers,
        "publicationBlockers": blockers,
        "candidateContentDigest": digest_file_map(candidate_files),
        "candidateFiles": file_inventory(candidate_files),
        "artifacts": {
            "archive": archive_meta,
            "releaseNotes": release_notes_meta,
        },
        "verificationCommands": [copy.deepcopy(dict(command)) for command in verification_commands],
        "publishSteps": list(PUBLISH_STEPS),
        "remoteExecutionImplemented": True,
    }
    if promotion_record is not None:
        plan["promotion"] = promotion_record
    manifest_bytes = pretty_json_bytes(_release_manifest(plan, archive_bytes, release_notes))
    plan_artifacts = plan["artifacts"]
    assert isinstance(plan_artifacts, dict)
    plan_artifacts["manifest"] = {
        "path": f"artifacts/{MANIFEST_NAME}",
        "sha256": sha256_bytes(manifest_bytes),
        "size": len(manifest_bytes),
    }
    checksums_bytes = _checksums(
        {
            archive_name: archive_bytes,
            MANIFEST_NAME: manifest_bytes,
            NOTES_NAME: release_notes,
        }
    )
    plan_artifacts["checksums"] = {
        "path": f"artifacts/{CHECKSUMS_NAME}",
        "sha256": sha256_bytes(checksums_bytes),
        "size": len(checksums_bytes),
    }
    return attach_plan_digest(plan), candidate_files, archive_bytes, release_notes


def _journal(plan: Mapping[str, object]) -> dict[str, object]:
    return {
        "schemaVersion": SCHEMA_VERSION,
        "kind": "personal-ui-release-journal",
        "planDigest": plan["planDigest"],
        "status": "prepared",
        "steps": {
            "prepare": {"status": "complete"},
            "verify": {"status": "pending"},
            **{step: {"status": "pending"} for step in PUBLISH_STEPS},
        },
    }


def _release_manifest(
    plan: Mapping[str, object],
    archive_bytes: bytes,
    release_notes: bytes,
) -> dict[str, object]:
    archive = plan["artifacts"]["archive"]  # type: ignore[index]
    manifest: dict[str, object] = {
        "schemaVersion": SCHEMA_VERSION,
        "kind": "personal-ui-release-manifest",
        "version": plan["candidateVersion"],
        "publishable": plan["publishable"],
        "publicationBlockers": plan["publicationBlockers"],
        "source": plan["source"],
        "candidateContentDigest": plan["candidateContentDigest"],
        "archive": {
            "file": PurePosixPath(str(archive["path"])).name,
            "sha256": sha256_bytes(archive_bytes),
            "size": len(archive_bytes),
        },
        "releaseNotes": {
            "file": NOTES_NAME,
            "sha256": sha256_bytes(release_notes),
            "size": len(release_notes),
        },
    }
    promotion = plan.get("promotion")
    if promotion is not None:
        manifest["promotion"] = copy.deepcopy(promotion)
    return manifest


def _checksums(entries: Mapping[str, bytes]) -> bytes:
    return "".join(
        f"{sha256_bytes(content)}  {name}\n" for name, content in sorted(entries.items())
    ).encode("ascii")


def _write_files(root: Path, files: Mapping[str, bytes]) -> None:
    for relative, content in sorted(files.items()):
        target = root.joinpath(*PurePosixPath(relative).parts)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)


def _safe_output_target(root: Path, output: Path) -> Path:
    root = root.resolve()
    output = output.resolve()
    if output == root or output in root.parents or root in output.parents:
        raise ReleaseError(
            "release output must be outside the repository and must not contain it"
        )
    if output.exists():
        raise ReleaseError(f"release output already exists: {output}")
    return output


def _load_verified_promotion(
    candidate: Path,
    *,
    source: SourceSnapshot,
    target_version: str,
) -> tuple[dict[str, object], dict[str, bytes]]:
    target = SemVer.parse(target_version)
    if target.prerelease or target.build:
        raise ReleaseError("promotion target must be a stable semantic version")
    plan, journal = load_candidate(candidate)
    from_value = plan.get("candidateVersion")
    if not isinstance(from_value, str):
        raise ReleaseError("promotion-from release plan has no candidateVersion")
    promoted = SemVer.parse(from_value)
    if promoted.rc_number is None or promoted.core != target.core:
        raise ReleaseError(
            "promotion-from must point to an rc.N candidate on the same release line"
        )
    if plan.get("promotion") is not None:
        raise ReleaseError("promotion-from must be an RC candidate, not another promotion")
    if plan.get("publishable") is not True:
        raise ReleaseError("promotion-from RC candidate is not publishable")

    files = collect_staged_files(candidate.resolve())
    verify_candidate_files(plan, files)
    verify_artifact_bundle(candidate.resolve(), plan, files)
    verification_blockers = _verification_journal_blockers(plan, journal)
    if verification_blockers:
        raise ReleaseError(
            "promotion-from must point to a verified RC candidate: "
            + ", ".join(verification_blockers)
        )
    if not _is_formal_verification_plan(plan.get("verificationCommands")):
        raise ReleaseError(
            "promotion-from RC candidate lacks the frozen formal verification plan"
        )

    source_plan = plan.get("source")
    if not isinstance(source_plan, Mapping):
        raise ReleaseError("promotion-from RC source binding is invalid")
    expected_source = {
        "mode": "commit",
        "commit": source.commit,
        "tree": source.tree,
        "sourceDateEpoch": source.epoch,
        "dirty": False,
        "contentDigest": source.content_digest,
    }
    if source.mode != "commit" or source.dirty or any(
        source_plan.get(key) != value for key, value in expected_source.items()
    ):
        raise ReleaseError(
            "stable promotion and its RC must use the same immutable source snapshot"
        )
    version_policy = plan.get("versionPolicy")
    if (
        not isinstance(version_policy, Mapping)
        or version_policy.get("releaseTarget") != target_version
    ):
        raise ReleaseError("promotion-from RC targets a different stable release")
    artifacts = plan.get("artifacts")
    archive = artifacts.get("archive") if isinstance(artifacts, Mapping) else None
    if not isinstance(archive, Mapping):
        raise ReleaseError("promotion-from RC archive binding is invalid")
    verify_step = journal["steps"]["verify"]  # type: ignore[index]
    assert isinstance(verify_step, Mapping)
    candidate_inventory = plan.get("candidateFiles")
    if not isinstance(candidate_inventory, list):
        raise ReleaseError("promotion-from RC candidate inventory is invalid")
    record: dict[str, object] = {
        "schemaVersion": SCHEMA_VERSION,
        "kind": PROMOTION_KIND,
        "fromVersion": from_value,
        "planDigest": plan.get("planDigest"),
        "sourceCommit": source_plan.get("commit"),
        "sourceTree": source_plan.get("tree"),
        "sourceContentDigest": source_plan.get("contentDigest"),
        "sourceDateEpoch": source_plan.get("sourceDateEpoch"),
        "candidateContentDigest": plan.get("candidateContentDigest"),
        "candidateFilesDigest": sha256_bytes(canonical_json_bytes(candidate_inventory)),
        "archiveSha256": archive.get("sha256"),
        "archiveSize": archive.get("size"),
        "reviewedChangelog": files[CHANGELOG_PATH].decode("utf-8", errors="strict"),
        "reviewedPlan": copy.deepcopy(plan),
        "verificationRecord": copy.deepcopy(dict(verify_step)),
        "verificationRecordSha256": sha256_bytes(
            canonical_json_bytes(dict(verify_step))
        ),
    }
    return record, files


def prepare_release(
    root: Path,
    output: Path,
    *,
    candidate_version: str,
    source_mode: str = "worktree",
    source_ref: str = "HEAD",
    allow_dirty_local: bool = False,
    promotion_from: str | None = None,
    dry_run: bool = False,
    verification_commands: Sequence[Mapping[str, object]] = DEFAULT_VERIFICATION_COMMANDS,
    source_snapshot: SourceSnapshot | None = None,
    existing_versions: Iterable[str] | None = None,
) -> dict[str, object]:
    root = root.resolve()
    output = _safe_output_target(root, output)
    source = source_snapshot or load_source_snapshot(
        root,
        source_mode=source_mode,
        source_ref=source_ref,
        allow_dirty_local=allow_dirty_local,
        output=output,
    )
    if existing_versions is None:
        tags = str(_git(root, "tag", "--list")).splitlines()
        existing_versions = tags
    candidate = SemVer.parse(candidate_version)
    promotion_record: dict[str, object] | None = None
    promotion_files: dict[str, bytes] | None = None
    promotion_version: str | None = None
    if candidate.prerelease:
        if promotion_from is not None:
            raise ReleaseError("RC preparation must not specify --promotion-from")
    else:
        if promotion_from is None:
            raise ReleaseError(
                "stable release preparation requires --promotion-from pointing to a verified RC candidate"
            )
        promotion_path = Path(promotion_from)
        promotion_record, promotion_files = _load_verified_promotion(
            promotion_path,
            source=source,
            target_version=candidate_version,
        )
        promotion_version = str(promotion_record["fromVersion"])
    plan, candidate_files, archive_bytes, release_notes = build_release_plan(
        source,
        candidate_version=candidate_version,
        existing_versions=existing_versions,
        promotion_from=promotion_version,
        promotion=promotion_record,
        promotion_files=promotion_files,
        verification_commands=verification_commands,
    )
    if dry_run:
        return plan

    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = Path(tempfile.mkdtemp(prefix=f".{output.name}-", dir=output.parent))
    try:
        staging = temporary / "staging" / ARCHIVE_PREFIX
        artifacts = temporary / "artifacts"
        staging.mkdir(parents=True)
        artifacts.mkdir(parents=True)
        _write_files(staging, candidate_files)
        archive_name = PurePosixPath(
            str(plan["artifacts"]["archive"]["path"])  # type: ignore[index]
        ).name
        (artifacts / archive_name).write_bytes(archive_bytes)
        (artifacts / NOTES_NAME).write_bytes(release_notes)
        manifest_bytes = pretty_json_bytes(
            _release_manifest(plan, archive_bytes, release_notes)
        )
        (artifacts / MANIFEST_NAME).write_bytes(manifest_bytes)
        (artifacts / CHECKSUMS_NAME).write_bytes(
            _checksums(
                {
                    archive_name: archive_bytes,
                    MANIFEST_NAME: manifest_bytes,
                    NOTES_NAME: release_notes,
                }
            )
        )
        (temporary / PLAN_NAME).write_bytes(pretty_json_bytes(plan))
        (temporary / JOURNAL_NAME).write_bytes(pretty_json_bytes(_journal(plan)))
        temporary.replace(output)
    except Exception:
        shutil.rmtree(temporary, ignore_errors=True)
        raise
    return plan


def _load_json_file(path: Path, label: str) -> dict[str, object]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ReleaseError(f"unable to read {label} at {path}: {error}") from error
    if not isinstance(value, dict):
        raise ReleaseError(f"{label} must contain a JSON object")
    return value


def load_candidate(candidate: Path) -> tuple[dict[str, object], dict[str, object]]:
    candidate = candidate.resolve()
    plan = _load_json_file(candidate / PLAN_NAME, "release plan")
    assert_plan_digest(plan)
    if (
        plan.get("schemaVersion") != SCHEMA_VERSION
        or plan.get("kind") != "personal-ui-release-plan"
    ):
        raise ReleaseError("release plan schema or kind is unsupported")
    journal = _load_json_file(candidate / JOURNAL_NAME, "release journal")
    if (
        journal.get("schemaVersion") != SCHEMA_VERSION
        or journal.get("kind") != "personal-ui-release-journal"
    ):
        raise ReleaseError("release journal schema or kind is unsupported")
    if journal.get("planDigest") != plan.get("planDigest"):
        raise ReleaseError("release journal does not belong to the release plan")
    steps = journal.get("steps")
    if not isinstance(steps, dict):
        raise ReleaseError("release journal steps are missing or invalid")
    required_steps = ("prepare", "verify", *PUBLISH_STEPS)
    if any(not isinstance(steps.get(step), dict) for step in required_steps):
        raise ReleaseError("release journal is missing a required step record")
    if steps["prepare"].get("status") != "complete":
        raise ReleaseError("release journal prepare step is not complete")
    return plan, journal


def _expected_file_hashes(plan: Mapping[str, object]) -> dict[str, tuple[int, str]]:
    entries = plan.get("candidateFiles")
    if not isinstance(entries, list):
        raise ReleaseError("release plan candidateFiles is invalid")
    result: dict[str, tuple[int, str]] = {}
    for entry in entries:
        if not isinstance(entry, dict):
            raise ReleaseError("release plan candidate file entry is invalid")
        path = entry.get("path")
        size = entry.get("size")
        digest = entry.get("sha256")
        if (
            not isinstance(path, str)
            or not isinstance(size, int)
            or isinstance(size, bool)
            or size < 0
            or not isinstance(digest, str)
            or re.fullmatch(r"[0-9a-f]{64}", digest) is None
            or path in result
        ):
            raise ReleaseError("release plan candidate file metadata is invalid")
        validate_relative_path(path)
        result[path] = (size, digest)
    return result


def _content_digest_from_inventory(files: Mapping[str, tuple[int, str]]) -> str:
    digest = hashlib.sha256()
    for relative in sorted(files):
        size, content_digest = files[relative]
        digest.update(relative.encode("utf-8"))
        digest.update(b"\0")
        digest.update(str(size).encode("ascii"))
        digest.update(b"\0")
        digest.update(bytes.fromhex(content_digest))
    return digest.hexdigest()


def collect_staged_files(candidate: Path) -> dict[str, bytes]:
    staging = candidate / "staging" / ARCHIVE_PREFIX
    if not staging.is_dir():
        raise ReleaseError(f"release staging directory is missing: {staging}")
    return collect_worktree_files(staging)


def _reconstruct_reviewed_promotion_metadata(
    files: Mapping[str, bytes],
    *,
    candidate_version: str,
    from_version: str,
    source_epoch: int,
    promotion: Mapping[str, object],
    reviewed_changelog: str,
) -> dict[str, bytes]:
    package = _read_json(files, VERSION_PATHS["package"])
    lock = _read_json(files, VERSION_PATHS["lock"])
    registry = _read_json(files, VERSION_PATHS["registry"])
    manifest = _read_json(files, VERSION_PATHS["manifest"])
    compatibility = _read_json(files, VERSION_PATHS["compatibility"])
    coverage = _read_json(files, VERSION_PATHS["coverage"])
    ownership = _read_json(files, VERSION_PATHS["ownership"])
    documents = {
        VERSION_PATHS["package"]: package,
        VERSION_PATHS["lock"]: lock,
        VERSION_PATHS["registry"]: registry,
        VERSION_PATHS["manifest"]: manifest,
        VERSION_PATHS["compatibility"]: compatibility,
        VERSION_PATHS["coverage"]: coverage,
        VERSION_PATHS["ownership"]: ownership,
    }
    if any(files.get(path) != pretty_json_bytes(value) for path, value in documents.items()):
        raise ReleaseError("stable promotion metadata JSON is not canonical")

    lock_packages = lock.get("packages")
    lock_root = lock_packages.get("") if isinstance(lock_packages, dict) else None
    current_report = compatibility.get("current")
    version_policy = compatibility.get("versionPolicy")
    if (
        not isinstance(lock_root, dict)
        or not isinstance(current_report, dict)
        or not isinstance(version_policy, dict)
    ):
        raise ReleaseError("stable promotion metadata version fields are incomplete")
    target_versions = (
        package.get("version"),
        lock.get("version"),
        lock_root.get("version"),
        registry.get("version"),
        manifest.get("kitVersion"),
        current_report.get("version"),
        version_policy.get("packageVersion"),
        coverage.get("kitVersion"),
        ownership.get("kitVersion"),
    )
    if any(value != candidate_version for value in target_versions):
        raise ReleaseError("stable promotion metadata is not bound to the stable version")

    package["version"] = from_version
    lock["version"] = from_version
    lock_root["version"] = from_version
    registry["version"] = from_version
    manifest["kitVersion"] = from_version
    current_report["version"] = from_version
    version_policy["packageVersion"] = from_version
    coverage["kitVersion"] = from_version
    ownership["kitVersion"] = from_version
    reconstructed = {
        path: pretty_json_bytes(value) for path, value in documents.items()
    }

    documentation = {
        COMPONENT_API_PATH: files[COMPONENT_API_PATH],
        COMPONENT_CATALOG_PATH: files[COMPONENT_CATALOG_PATH],
    }
    _replace_exact_marker(
        documentation,
        COMPONENT_API_PATH,
        expected=f"Personal UI {candidate_version}",
        replacement=f"Personal UI {from_version}",
    )
    _replace_exact_marker(
        documentation,
        COMPONENT_CATALOG_PATH,
        expected=f"- Version: `{candidate_version}`",
        replacement=f"- Version: `{from_version}`",
    )
    reconstructed.update(documentation)

    reviewed_changelog_bytes = reviewed_changelog.encode("utf-8")
    expected_changelog = promote_changelog(
        reviewed_changelog_bytes,
        candidate_version=candidate_version,
        source_epoch=source_epoch,
        promotion=promotion,
    )
    if files.get(CHANGELOG_PATH) != expected_changelog:
        raise ReleaseError("stable CHANGELOG does not match the reviewed RC transformation")
    reconstructed[CHANGELOG_PATH] = reviewed_changelog_bytes
    return reconstructed


def _validated_promotion(
    plan: Mapping[str, object],
    files: Mapping[str, bytes] | None = None,
) -> Mapping[str, object] | None:
    candidate_value = plan.get("candidateVersion")
    if not isinstance(candidate_value, str):
        raise ReleaseError("release plan candidateVersion is invalid")
    candidate = SemVer.parse(candidate_value)
    promotion = plan.get("promotion")
    if candidate.prerelease:
        if promotion is not None:
            raise ReleaseError("RC release plan must not contain a promotion binding")
        return None
    if not isinstance(promotion, Mapping):
        raise ReleaseError("stable release plan is missing its RC promotion binding")
    if (
        promotion.get("schemaVersion") != SCHEMA_VERSION
        or promotion.get("kind") != PROMOTION_KIND
    ):
        raise ReleaseError("stable release promotion binding is invalid")
    from_value = promotion.get("fromVersion")
    if not isinstance(from_value, str):
        raise ReleaseError("stable release promotion version is invalid")
    promoted = SemVer.parse(from_value)
    if promoted.rc_number is None or promoted.core != candidate.core:
        raise ReleaseError("stable release promotion is not bound to a same-line RC")

    digest_fields = (
        "planDigest",
        "sourceContentDigest",
        "candidateContentDigest",
        "candidateFilesDigest",
        "archiveSha256",
        "verificationRecordSha256",
    )
    if any(
        not isinstance(promotion.get(field), str)
        or re.fullmatch(r"[0-9a-f]{64}", str(promotion.get(field))) is None
        for field in digest_fields
    ):
        raise ReleaseError("stable release promotion digest binding is invalid")
    if (
        not isinstance(promotion.get("sourceCommit"), str)
        or re.fullmatch(r"[0-9a-f]{40}", str(promotion.get("sourceCommit"))) is None
        or not isinstance(promotion.get("sourceTree"), str)
        or re.fullmatch(r"[0-9a-f]{40}", str(promotion.get("sourceTree"))) is None
        or not isinstance(promotion.get("sourceDateEpoch"), int)
        or isinstance(promotion.get("sourceDateEpoch"), bool)
        or not isinstance(promotion.get("archiveSize"), int)
        or isinstance(promotion.get("archiveSize"), bool)
        or int(promotion.get("archiveSize", -1)) < 0
    ):
        raise ReleaseError("stable release promotion source or archive binding is invalid")
    source = plan.get("source")
    if not isinstance(source, Mapping) or any(
        promotion.get(promoted_key) != source.get(source_key)
        for promoted_key, source_key in (
            ("sourceCommit", "commit"),
            ("sourceTree", "tree"),
            ("sourceContentDigest", "contentDigest"),
            ("sourceDateEpoch", "sourceDateEpoch"),
        )
    ):
        raise ReleaseError("stable release and promoted RC source bindings differ")
    version_policy = plan.get("versionPolicy")
    if (
        not isinstance(version_policy, Mapping)
        or version_policy.get("promotionFrom") != from_value
    ):
        raise ReleaseError("stable release version policy lacks its promotion source")

    reviewed_plan = promotion.get("reviewedPlan")
    verification_record = promotion.get("verificationRecord")
    if not isinstance(reviewed_plan, Mapping) or not isinstance(
        verification_record, Mapping
    ):
        raise ReleaseError("stable release promotion lacks its reviewed RC records")
    try:
        assert_plan_digest(reviewed_plan)
    except ReleaseError as error:
        raise ReleaseError("stable release promotion reviewed RC plan is invalid") from error
    if (
        reviewed_plan.get("schemaVersion") != SCHEMA_VERSION
        or reviewed_plan.get("kind") != "personal-ui-release-plan"
        or reviewed_plan.get("candidateVersion") != from_value
        or reviewed_plan.get("promotion") is not None
        or reviewed_plan.get("publishable") is not True
        or reviewed_plan.get("publicationBlockers") != []
        or not _is_formal_verification_plan(reviewed_plan.get("verificationCommands"))
        or reviewed_plan.get("planDigest") != promotion.get("planDigest")
        or reviewed_plan.get("candidateContentDigest")
        != promotion.get("candidateContentDigest")
    ):
        raise ReleaseError("stable release promotion reviewed RC plan binding is invalid")
    reviewed_source = reviewed_plan.get("source")
    if not isinstance(reviewed_source, Mapping) or any(
        reviewed_source.get(source_key) != promotion.get(promoted_key)
        for source_key, promoted_key in (
            ("commit", "sourceCommit"),
            ("tree", "sourceTree"),
            ("contentDigest", "sourceContentDigest"),
            ("sourceDateEpoch", "sourceDateEpoch"),
        )
    ):
        raise ReleaseError("stable release promotion reviewed RC source binding is invalid")
    if reviewed_source.get("mode") != "commit" or reviewed_source.get("dirty") is not False:
        raise ReleaseError("stable release promotion reviewed RC source is not immutable")
    reviewed_artifacts = reviewed_plan.get("artifacts")
    reviewed_archive = (
        reviewed_artifacts.get("archive")
        if isinstance(reviewed_artifacts, Mapping)
        else None
    )
    if (
        not isinstance(reviewed_archive, Mapping)
        or reviewed_archive.get("sha256") != promotion.get("archiveSha256")
        or reviewed_archive.get("size") != promotion.get("archiveSize")
    ):
        raise ReleaseError("stable release promotion reviewed RC archive binding is invalid")
    reviewed_entries = reviewed_plan.get("candidateFiles")
    if (
        not isinstance(reviewed_entries, list)
        or sha256_bytes(canonical_json_bytes(reviewed_entries))
        != promotion.get("candidateFilesDigest")
    ):
        raise ReleaseError("stable release promotion reviewed RC inventory binding is invalid")
    if (
        sha256_bytes(canonical_json_bytes(dict(verification_record)))
        != promotion.get("verificationRecordSha256")
    ):
        raise ReleaseError("stable release promotion verification record binding is invalid")
    reviewed_journal = {
        "status": "verified",
        "steps": {"verify": dict(verification_record)},
    }
    if _verification_journal_blockers(reviewed_plan, reviewed_journal):
        raise ReleaseError("stable release promotion verification record is invalid")

    reviewed_inventory = _expected_file_hashes(reviewed_plan)
    target_inventory = _expected_file_hashes(plan)
    if (
        _content_digest_from_inventory(reviewed_inventory)
        != reviewed_plan.get("candidateContentDigest")
        or _content_digest_from_inventory(target_inventory)
        != plan.get("candidateContentDigest")
    ):
        raise ReleaseError("stable release promotion candidate inventory digest is invalid")
    if set(reviewed_inventory) != set(target_inventory):
        raise ReleaseError("stable release promotion changed the RC file set")
    reviewed_changelog = promotion.get("reviewedChangelog")
    if not isinstance(reviewed_changelog, str):
        raise ReleaseError("stable release promotion reviewed CHANGELOG is missing")
    reviewed_changelog_bytes = reviewed_changelog.encode("utf-8")
    if reviewed_inventory.get(CHANGELOG_PATH) != (
        len(reviewed_changelog_bytes),
        sha256_bytes(reviewed_changelog_bytes),
    ):
        raise ReleaseError("stable release promotion reviewed CHANGELOG binding is invalid")
    actual_changed_paths = sorted(
        path
        for path in reviewed_inventory
        if reviewed_inventory[path] != target_inventory[path]
    )

    delta = promotion.get("fileDelta")
    if not isinstance(delta, Mapping):
        raise ReleaseError("stable release promotion file delta is missing")
    expected_paths = sorted(PROMOTION_METADATA_PATHS)
    if (
        delta.get("allowedPaths") != expected_paths
        or delta.get("changedPaths") != expected_paths
        or actual_changed_paths != expected_paths
        or delta.get("sourceCandidateContentDigest")
        != reviewed_plan.get("candidateContentDigest")
        or delta.get("targetCandidateContentDigest")
        != plan.get("candidateContentDigest")
    ):
        raise ReleaseError("stable release promotion file delta binding is invalid")
    entries = delta.get("entries")
    if not isinstance(entries, list) or len(entries) != len(expected_paths):
        raise ReleaseError("stable release promotion file delta entries are invalid")
    seen: set[str] = set()
    for entry in entries:
        if not isinstance(entry, Mapping):
            raise ReleaseError("stable release promotion file delta entry is invalid")
        path = entry.get("path")
        before = entry.get("before")
        after = entry.get("after")
        if (
            not isinstance(path, str)
            or path not in PROMOTION_METADATA_PATHS
            or path in seen
            or not isinstance(before, Mapping)
            or not isinstance(after, Mapping)
        ):
            raise ReleaseError("stable release promotion file delta entry is invalid")
        seen.add(path)
        for label, metadata in (("before", before), ("after", after)):
            if (
                not isinstance(metadata.get("size"), int)
                or isinstance(metadata.get("size"), bool)
                or int(metadata.get("size", -1)) < 0
                or not isinstance(metadata.get("sha256"), str)
                or re.fullmatch(r"[0-9a-f]{64}", str(metadata.get("sha256")))
                is None
            ):
                raise ReleaseError(
                    f"stable release promotion {label} file binding is invalid"
                )
        expected_before = {
            "size": reviewed_inventory[path][0],
            "sha256": reviewed_inventory[path][1],
        }
        expected_after = {
            "size": target_inventory[path][0],
            "sha256": target_inventory[path][1],
        }
        if dict(before) != expected_before or dict(after) != expected_after:
            raise ReleaseError("stable release promotion file delta differs from the reviewed RC")
        if files is not None:
            content = files.get(path)
            if content is None or expected_after != {
                "size": len(content),
                "sha256": sha256_bytes(content),
            }:
                raise ReleaseError(
                    "stable release promotion target metadata differs from staged files"
                )
    if seen != set(PROMOTION_METADATA_PATHS):
        raise ReleaseError("stable release promotion file delta is incomplete")
    if files is not None:
        reconstructed = _reconstruct_reviewed_promotion_metadata(
            files,
            candidate_version=candidate_value,
            from_version=from_value,
            source_epoch=int(promotion["sourceDateEpoch"]),
            promotion=promotion,
            reviewed_changelog=reviewed_changelog,
        )
        reconstructed_inventory = {
            path: (len(content), sha256_bytes(content))
            for path, content in reconstructed.items()
        }
        if reconstructed_inventory != {
            path: reviewed_inventory[path] for path in PROMOTION_METADATA_PATHS
        }:
            raise ReleaseError(
                "stable promotion metadata differs beyond the deterministic version transform"
            )
    return promotion


def verify_candidate_files(plan: Mapping[str, object], files: Mapping[str, bytes]) -> None:
    expected = _expected_file_hashes(plan)
    actual = {
        relative: (len(content), sha256_bytes(content))
        for relative, content in files.items()
    }
    if actual != expected:
        missing = sorted(set(expected) - set(actual))
        extra = sorted(set(actual) - set(expected))
        changed = sorted(
            path for path in set(expected) & set(actual) if expected[path] != actual[path]
        )
        raise ReleaseError(
            "staged candidate differs from its plan "
            f"(missing={missing[:3]}, extra={extra[:3]}, changed={changed[:3]})"
        )
    if digest_file_map(files) != plan.get("candidateContentDigest"):
        raise ReleaseError("staged candidate content digest does not match its plan")
    _validated_promotion(plan, files)


def parse_checksums(content: bytes) -> dict[str, str]:
    result: dict[str, str] = {}
    try:
        lines = content.decode("ascii").splitlines()
    except UnicodeDecodeError as error:
        raise ReleaseError("SHA256SUMS must be ASCII") from error
    for line in lines:
        match = re.fullmatch(r"([0-9a-f]{64})  ([^/\\]+)", line)
        if match is None or match.group(2) in result:
            raise ReleaseError(f"invalid SHA256SUMS entry: {line!r}")
        result[match.group(2)] = match.group(1)
    return result


def verify_artifact_bundle(
    candidate: Path,
    plan: Mapping[str, object],
    files: Mapping[str, bytes],
) -> None:
    artifact_entries = plan.get("artifacts")
    if not isinstance(artifact_entries, dict):
        raise ReleaseError("release plan artifacts are invalid")

    def read_bound_artifact(key: str, expected_name: str) -> bytes:
        metadata = artifact_entries.get(key)
        if not isinstance(metadata, dict):
            raise ReleaseError(f"release artifact metadata is invalid: {key}")
        relative = metadata.get("path")
        digest = metadata.get("sha256")
        size = metadata.get("size")
        if (
            not isinstance(relative, str)
            or not isinstance(digest, str)
            or re.fullmatch(r"[0-9a-f]{64}", digest) is None
            or not isinstance(size, int)
            or isinstance(size, bool)
            or size < 0
        ):
            raise ReleaseError(f"release artifact metadata is invalid: {key}")
        path = validate_relative_path(relative)
        if path.parts != ("artifacts", expected_name):
            raise ReleaseError(f"release artifact path is invalid: {key}")
        content = candidate.joinpath(*path.parts).read_bytes()
        if len(content) != size or sha256_bytes(content) != digest:
            raise ReleaseError(f"release artifact does not match its plan: {key}")
        return content

    candidate_version = plan.get("candidateVersion")
    if not isinstance(candidate_version, str):
        raise ReleaseError("release plan candidateVersion is invalid")
    archive_name = f"{ARCHIVE_PREFIX}-{candidate_version}.zip"
    archive_bytes = read_bound_artifact("archive", archive_name)
    manifest_bytes = read_bound_artifact("manifest", MANIFEST_NAME)
    notes_bytes = read_bound_artifact("releaseNotes", NOTES_NAME)
    checksums_bytes = read_bound_artifact("checksums", CHECKSUMS_NAME)
    verify_zip_bytes(archive_bytes, files)
    expected_notes = extract_release_notes(
        files,
        candidate_version,
        promotion=_validated_promotion(plan, files),
    )
    if notes_bytes != expected_notes:
        raise ReleaseError("release notes do not exactly match the staged changelog and plan")

    try:
        manifest = json.loads(manifest_bytes.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ReleaseError(f"release manifest is invalid: {error}") from error
    expected_manifest = _release_manifest(plan, archive_bytes, notes_bytes)
    if manifest != expected_manifest:
        raise ReleaseError("release manifest does not exactly match its plan")
    expected_checksums = _checksums(
        {
            archive_name: archive_bytes,
            MANIFEST_NAME: manifest_bytes,
            NOTES_NAME: notes_bytes,
        }
    )
    if checksums_bytes != expected_checksums:
        raise ReleaseError("SHA256SUMS does not match the prepared artifacts")


def _atomic_write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.tmp-{os.getpid()}")
    temporary.write_bytes(pretty_json_bytes(value))
    os.replace(temporary, path)


def default_command_runner(argv: Sequence[str], cwd: Path) -> int:
    executable = shutil.which(argv[0])
    if executable is None:
        raise ReleaseError(f"verification executable was not found: {argv[0]}")
    process = subprocess.run([executable, *argv[1:]], cwd=cwd, check=False)
    return process.returncode


def verify_release(
    candidate: Path,
    *,
    command_runner: CommandRunner = default_command_runner,
) -> dict[str, object]:
    candidate = candidate.resolve()
    plan, journal = load_candidate(candidate)
    steps = journal.get("steps")
    verify_step = steps.get("verify") if isinstance(steps, Mapping) else None
    if (
        journal.get("status") != "prepared"
        or not isinstance(verify_step, Mapping)
        or verify_step.get("status") != "pending"
    ):
        raise ReleaseError(
            "release candidate verification may run only once from the prepared state"
        )
    files = collect_staged_files(candidate)
    verify_candidate_files(plan, files)
    verify_artifact_bundle(candidate, plan, files)
    journal["status"] = "verifying"
    journal["steps"]["verify"] = {"status": "running"}  # type: ignore[index]
    _atomic_write_json(candidate / JOURNAL_NAME, journal)
    executed: list[dict[str, object]] = []
    try:
        commands = plan.get("verificationCommands")
        if not isinstance(commands, list):
            raise ReleaseError("release plan verificationCommands is invalid")
        staging = candidate / "staging" / ARCHIVE_PREFIX
        for command in commands:
            if not isinstance(command, dict):
                raise ReleaseError("release verification command is invalid")
            cwd_value = command.get("cwd")
            argv = command.get("argv")
            if not isinstance(cwd_value, str) or not isinstance(argv, list) or not all(
                isinstance(value, str) and value for value in argv
            ):
                raise ReleaseError("release verification command metadata is invalid")
            validate_relative_path(cwd_value) if cwd_value != "." else None
            cwd = staging if cwd_value == "." else staging.joinpath(*PurePosixPath(cwd_value).parts)
            if not cwd.is_dir():
                raise ReleaseError(f"verification working directory is missing: {cwd_value}")
            exit_code = command_runner(argv, cwd)
            executed.append({"cwd": cwd_value, "argv": argv, "exitCode": exit_code})
            if exit_code != 0:
                raise ReleaseError(
                    f"verification command failed with {exit_code}: {' '.join(argv)}"
                )
        files_after = collect_staged_files(candidate)
        verify_candidate_files(plan, files_after)
        rebuilt = deterministic_zip_bytes(
            files_after,
            epoch=int(plan["source"]["sourceDateEpoch"]),  # type: ignore[index]
        )
        if sha256_bytes(rebuilt) != plan["artifacts"]["archive"]["sha256"]:  # type: ignore[index]
            raise ReleaseError("a second deterministic archive build produced a different checksum")
        verify_artifact_bundle(candidate, plan, files_after)
    except Exception as error:
        journal["status"] = "verify-failed"
        journal["steps"]["verify"] = {  # type: ignore[index]
            "status": "failed",
            "commands": executed,
            "error": str(error),
        }
        _atomic_write_json(candidate / JOURNAL_NAME, journal)
        raise
    journal["status"] = "verified"
    journal["steps"]["verify"] = {  # type: ignore[index]
        "status": "complete",
        "commands": executed,
        "archiveSha256": plan["artifacts"]["archive"]["sha256"],  # type: ignore[index]
    }
    _atomic_write_json(candidate / JOURNAL_NAME, journal)
    return journal


def _verification_journal_blockers(
    plan: Mapping[str, object], journal: Mapping[str, object]
) -> list[str]:
    blockers: list[str] = []
    if journal.get("status") not in {
        "verified",
        "publishing",
        "publish-interrupted",
        "published",
    }:
        blockers.append("candidate-has-not-passed-verify")
    steps = journal["steps"]
    assert isinstance(steps, dict)
    verify_step = steps["verify"]
    assert isinstance(verify_step, dict)
    if verify_step.get("status") != "complete":
        blockers.append("candidate-verify-step-incomplete")
        return blockers

    artifacts = plan.get("artifacts")
    archive = artifacts.get("archive") if isinstance(artifacts, dict) else None
    archive_digest = archive.get("sha256") if isinstance(archive, dict) else None
    if verify_step.get("archiveSha256") != archive_digest:
        blockers.append("candidate-verify-archive-evidence-mismatch")

    planned = plan.get("verificationCommands")
    recorded = verify_step.get("commands")
    if not isinstance(planned, list) or not isinstance(recorded, list):
        blockers.append("candidate-verify-command-evidence-mismatch")
        return blockers
    if len(planned) != len(recorded):
        blockers.append("candidate-verify-command-evidence-mismatch")
        return blockers
    for expected, actual in zip(planned, recorded):
        if not isinstance(expected, dict) or not isinstance(actual, dict):
            blockers.append("candidate-verify-command-evidence-mismatch")
            break
        if actual.get("cwd") != expected.get("cwd") or actual.get("argv") != expected.get(
            "argv"
        ):
            blockers.append("candidate-verify-command-evidence-mismatch")
            break
        exit_code = actual.get("exitCode")
        if not isinstance(exit_code, int) or isinstance(exit_code, bool):
            blockers.append("candidate-verify-command-evidence-mismatch")
            break
        if exit_code != 0:
            blockers.append("candidate-verify-command-evidence-nonzero")
    return blockers


def _reviewed_evidence_bindings(plan: Mapping[str, object]) -> dict[str, object]:
    promotion = _validated_promotion(plan)
    if promotion is not None:
        return {
            "planDigest": promotion.get("planDigest"),
            "sourceCommit": promotion.get("sourceCommit"),
            "archiveSha256": promotion.get("archiveSha256"),
        }
    source = plan.get("source")
    artifacts = plan.get("artifacts")
    archive = artifacts.get("archive") if isinstance(artifacts, Mapping) else None
    return {
        "planDigest": plan.get("planDigest"),
        "sourceCommit": source.get("commit") if isinstance(source, Mapping) else None,
        "archiveSha256": archive.get("sha256") if isinstance(archive, Mapping) else None,
    }


def _m8_release_evidence_blocker(
    path: Path | None,
    *,
    plan: Mapping[str, object],
) -> str | None:
    if path is None or not path.is_file():
        return "m8-acceptance-evidence-missing"
    try:
        bindings = _reviewed_evidence_bindings(plan)
    except ReleaseError:
        return "m8-acceptance-evidence-promotion-invalid"
    result = validate_m8_evidence_file(
        path,
        expected_bindings=bindings,
    )
    if result.accepted:
        return None
    return f"m8-acceptance-evidence-{result.category}"


def _hosted_release_evidence_blocker(
    path: Path | None,
    *,
    plan: Mapping[str, object],
    candidate: Path,
) -> str | None:
    if path is None or not path.is_file():
        return "hosted-ci-evidence-missing"
    fixture_catalog = (
        candidate.resolve()
        / "staging"
        / ARCHIVE_PREFIX
        / "references"
        / "support-fixtures.json"
    )
    if not fixture_catalog.is_file():
        return "hosted-ci-evidence-candidate-fixtures-missing"
    try:
        bindings = _reviewed_evidence_bindings(plan)
    except ReleaseError:
        return "hosted-ci-evidence-promotion-invalid"
    result = validate_hosted_ci_evidence_file(
        path,
        fixture_catalog=fixture_catalog,
        expected_bindings=bindings,
    )
    if result.accepted:
        return None
    return f"hosted-ci-evidence-{result.category}"


def _local_release_state_blockers(
    repository_root: Path,
    plan: Mapping[str, object],
    journal: Mapping[str, object],
) -> list[str]:
    blockers: list[str] = []
    try:
        package = json.loads(
            (repository_root.resolve() / VERSION_PATHS["package"]).read_text(encoding="utf-8")
        )
        version_policy = plan.get("versionPolicy")
        expected_version = (
            version_policy.get("sourceVersion") if isinstance(version_policy, dict) else None
        )
        steps = journal.get("steps")
        freeze_step = steps.get("freeze-release-commit") if isinstance(steps, dict) else None
        tag_step = steps.get("create-immutable-tag") if isinstance(steps, dict) else None
        allowed_versions: set[str] = set()
        if isinstance(expected_version, str):
            allowed_versions.add(expected_version)
        if isinstance(freeze_step, dict) and freeze_step.get("status") in {
            "running",
            "failed",
            "complete",
        }:
            candidate = plan.get("candidateVersion")
            if isinstance(candidate, str):
                allowed_versions.add(candidate)
        if not isinstance(package, dict) or package.get("version") not in allowed_versions:
            blockers.append("local-source-version-conflict")
        tags = str(_git(repository_root.resolve(), "tag", "--list")).splitlines()
        candidate_version = plan.get("candidateVersion")
        tag_exists = isinstance(candidate_version, str) and any(
            (tag[1:] if tag.startswith("v") else tag) == candidate_version for tag in tags
        )
        resumable_tag_states = {"running", "failed", "complete"}
        if tag_exists and not (
            isinstance(tag_step, dict)
            and tag_step.get("status") in resumable_tag_states
        ):
            blockers.append("local-tag-conflict")
        if (
            isinstance(tag_step, dict)
            and tag_step.get("status") == "complete"
            and not tag_exists
        ):
            blockers.append("local-completed-tag-missing")
    except (OSError, UnicodeDecodeError, json.JSONDecodeError, ReleaseError):
        blockers.append("local-release-state-unavailable")
    return blockers


def publish_preflight(
    candidate: Path,
    *,
    authorization: str | None,
    m8_evidence: Path | None,
    ci_evidence: Path | None,
    remote_adapter_configured: bool,
    repository_root: Path = SKILL_ROOT,
    adapter: PublishAdapter | None = None,
) -> list[str]:
    plan, journal = load_candidate(candidate)
    blockers = [str(value) for value in plan.get("publicationBlockers", [])]
    if plan.get("publishable") is not True:
        blockers.append("candidate-is-marked-non-publishable")
    blockers.extend(_verification_journal_blockers(plan, journal))
    if authorization != plan.get("planDigest"):
        blockers.append("explicit-publication-authorization-missing")
    m8_blocker = _m8_release_evidence_blocker(m8_evidence, plan=plan)
    if m8_blocker:
        blockers.append(m8_blocker)
    ci_blocker = _hosted_release_evidence_blocker(
        ci_evidence,
        plan=plan,
        candidate=candidate,
    )
    if ci_blocker:
        blockers.append(ci_blocker)
    if not remote_adapter_configured and adapter is None:
        blockers.append("remote-publisher-not-configured")
    blockers.extend(_local_release_state_blockers(repository_root, plan, journal))
    try:
        files = collect_staged_files(candidate)
        verify_candidate_files(plan, files)
        verify_artifact_bundle(candidate, plan, files)
    except (OSError, ValueError, ReleaseError) as error:
        blockers.append(f"candidate-integrity-failed:{error}")
    preflight = getattr(adapter, "preflight", None)
    if callable(preflight):
        try:
            adapter_blockers = preflight(plan, candidate, journal)
            if not isinstance(adapter_blockers, Sequence) or isinstance(
                adapter_blockers, (str, bytes)
            ):
                blockers.append("publisher-preflight-returned-invalid-result")
            else:
                blockers.extend(str(blocker) for blocker in adapter_blockers)
        except Exception as error:
            blockers.append(f"publisher-preflight-failed:{type(error).__name__}")
    return sorted(set(blockers))


_SENSITIVE_JOURNAL_KEYS = re.compile(
    r"(?:authorization|credential|password|secret|token)", re.IGNORECASE
)


def _journal_step_result(value: Mapping[str, object] | None) -> dict[str, object]:
    if value is None:
        return {}
    if not isinstance(value, Mapping):
        raise ReleaseError("publication adapter returned a non-object step result")

    def normalize(item: object, *, key: str | None = None) -> object:
        if key is not None and _SENSITIVE_JOURNAL_KEYS.search(key):
            raise ReleaseError(
                f"publication adapter result contains a sensitive key: {key}"
            )
        if item is None or isinstance(item, (str, bool, int)):
            return item
        if isinstance(item, Mapping):
            result: dict[str, object] = {}
            for nested_key, nested_value in item.items():
                if not isinstance(nested_key, str):
                    raise ReleaseError(
                        "publication adapter result keys must be strings"
                    )
                result[nested_key] = normalize(nested_value, key=nested_key)
            return result
        if isinstance(item, Sequence) and not isinstance(item, (str, bytes)):
            return [normalize(nested) for nested in item]
        raise ReleaseError(
            "publication adapter result contains a non-JSON-safe value"
        )

    normalized = normalize(value)
    assert isinstance(normalized, dict)
    return normalized


def publish_with_adapter(
    candidate: Path,
    *,
    authorization: str,
    m8_evidence: Path,
    ci_evidence: Path,
    adapter: PublishAdapter,
    repository_root: Path = SKILL_ROOT,
) -> dict[str, object]:
    candidate = candidate.resolve()
    blockers = publish_preflight(
        candidate,
        authorization=authorization,
        m8_evidence=m8_evidence,
        ci_evidence=ci_evidence,
        remote_adapter_configured=True,
        repository_root=repository_root,
        adapter=adapter,
    )
    if blockers:
        raise ReleaseError("publication blocked: " + ", ".join(blockers))
    plan, journal = load_candidate(candidate)
    journal["status"] = "publishing"
    _atomic_write_json(candidate / JOURNAL_NAME, journal)
    for step in PUBLISH_STEPS:
        step_state = journal["steps"][step]  # type: ignore[index]
        if isinstance(step_state, dict) and step_state.get("status") == "complete":
            continue
        prior_attempt = (
            step_state.get("attempt", 0) if isinstance(step_state, dict) else 0
        )
        attempt = prior_attempt + 1 if isinstance(prior_attempt, int) else 1
        journal["steps"][step] = {  # type: ignore[index]
            "status": "running",
            "attempt": attempt,
        }
        _atomic_write_json(candidate / JOURNAL_NAME, journal)
        try:
            result = _journal_step_result(adapter.execute(step, plan, candidate))
        except Exception as error:
            journal["status"] = "publish-interrupted"
            journal["steps"][step] = {  # type: ignore[index]
                "status": "failed",
                "attempt": attempt,
                "error": str(error),
                "errorType": type(error).__name__,
                "recovery": "resume; never move or delete a public tag automatically",
            }
            _atomic_write_json(candidate / JOURNAL_NAME, journal)
            raise
        journal["steps"][step] = {  # type: ignore[index]
            "status": "complete",
            "attempt": attempt,
            "result": result,
        }
        _atomic_write_json(candidate / JOURNAL_NAME, journal)
    journal["status"] = "published"
    _atomic_write_json(candidate / JOURNAL_NAME, journal)
    return journal


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="phase", required=True)

    prepare = subparsers.add_parser("prepare", help="Create an isolated local candidate")
    prepare.add_argument("--root", type=Path, default=SKILL_ROOT)
    prepare.add_argument("--output", type=Path, required=True)
    prepare.add_argument("--version", required=True)
    prepare.add_argument("--source-mode", choices=("commit", "worktree"), default="worktree")
    prepare.add_argument("--source-ref", default="HEAD")
    prepare.add_argument("--allow-dirty-local", action="store_true")
    prepare.add_argument(
        "--promotion-from",
        help="Path to the already verified RC candidate required for stable promotion",
    )
    prepare.add_argument("--dry-run", action="store_true")

    verify = subparsers.add_parser("verify", help="Run the frozen candidate verification plan")
    verify.add_argument("--candidate", type=Path, required=True)

    publish = subparsers.add_parser(
        "publish",
        help="Preflight publication or execute it with exact digest authorization",
    )
    publish.add_argument("--candidate", type=Path, required=True)
    publish.add_argument("--authorization")
    publish.add_argument("--m8-evidence", type=Path)
    publish.add_argument("--ci-evidence", type=Path)
    publication_mode = publish.add_mutually_exclusive_group()
    publication_mode.add_argument("--execute", action="store_true")
    publication_mode.add_argument("--dry-run", action="store_true")
    publish.add_argument("--remote", default="origin")
    publish.add_argument("--repository")
    publish.add_argument(
        "--generated-copy-target",
        action="append",
        type=Path,
        default=[],
        help="Explicit absolute generated-copy destination; may be repeated",
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    try:
        if args.phase == "prepare":
            plan = prepare_release(
                args.root,
                args.output,
                candidate_version=args.version,
                source_mode=args.source_mode,
                source_ref=args.source_ref,
                allow_dirty_local=args.allow_dirty_local,
                promotion_from=args.promotion_from,
                dry_run=args.dry_run,
            )
            print(json.dumps(plan, ensure_ascii=False, indent=2))
            return 0
        if args.phase == "verify":
            journal = verify_release(args.candidate)
            print(json.dumps(journal, ensure_ascii=False, indent=2))
            return 0

        try:
            from .release_publish_adapter import GitHubPublishAdapter
        except ImportError:
            from release_publish_adapter import GitHubPublishAdapter

        adapter = GitHubPublishAdapter(
            repository_root=SKILL_ROOT,
            remote=args.remote,
            repository=args.repository,
            generated_copy_targets=tuple(args.generated_copy_target),
        )
        blockers = publish_preflight(
            args.candidate,
            authorization=args.authorization,
            m8_evidence=args.m8_evidence,
            ci_evidence=args.ci_evidence,
            remote_adapter_configured=True,
            adapter=adapter,
        )
        if args.execute and not blockers:
            assert args.authorization is not None
            assert args.m8_evidence is not None
            assert args.ci_evidence is not None
            journal = publish_with_adapter(
                args.candidate,
                authorization=args.authorization,
                m8_evidence=args.m8_evidence,
                ci_evidence=args.ci_evidence,
                adapter=adapter,
            )
            print(json.dumps(journal, ensure_ascii=False, indent=2))
            return 0
        result = {
            "phase": "publish",
            "dryRun": True,
            "executionRequested": args.execute,
            "allowed": not blockers,
            "blockers": blockers,
            "remoteActionsExecuted": False,
        }
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0 if not blockers else 2
    except (OSError, ReleaseError, ValueError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
