#!/usr/bin/env python3
"""Shared project/package/source discovery for Personal UI tooling."""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


STATE_RELATIVE = Path("tools") / "personal-ui" / "install-state.json"
DEFAULT_SOURCE_ROOT = Path("src") / "personal-ui"
SUPPORTED_MANAGERS = {"npm", "pnpm", "yarn"}
SUPPORTED_FRAMEWORKS = {"vite", "next"}
LOCKFILES = {
    "npm": ("package-lock.json", "npm-shrinkwrap.json"),
    "pnpm": ("pnpm-lock.yaml",),
    "yarn": ("yarn.lock",),
}


@dataclass(frozen=True)
class InstallationContext:
    project_root: Path
    package_root: Path
    source_root: Path
    source_relative: Path
    package_manager: str
    framework: str
    lockfile: Path | None
    workspace: bool
    manager_evidence: tuple[str, ...]
    framework_evidence: tuple[str, ...]

    def report(self) -> dict[str, object]:
        return {
            "projectRoot": str(self.project_root),
            "packageRoot": relative_report_path(
                self.package_root, self.project_root
            ),
            "sourceRoot": self.source_relative.as_posix(),
            "packageManager": self.package_manager,
            "framework": self.framework,
            "workspace": self.workspace,
            "lockfile": (
                relative_report_path(self.lockfile, self.project_root)
                if self.lockfile is not None
                else None
            ),
            "managerEvidence": list(self.manager_evidence),
            "frameworkEvidence": list(self.framework_evidence),
        }


def read_json_object(path: Path, *, label: str) -> dict[str, object]:
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


def normalized_absolute(path: Path, *, base: Path | None = None) -> Path:
    value = path if path.is_absolute() else (base or Path.cwd()) / path
    return Path(os.path.abspath(value))


def validated_relative_path(value: Path, *, label: str) -> Path:
    if value.is_absolute() or value.drive or value.root:
        raise ValueError(f"{label} must be relative to the package root: {value}")
    normalized = Path(*[part for part in value.parts if part not in ("", ".")])
    if not normalized.parts or any(part == ".." for part in normalized.parts):
        raise ValueError(
            f"{label} must be a non-empty path that does not escape the package root: {value}"
        )
    return normalized


def relative_report_path(path: Path, root: Path) -> str:
    try:
        relative = path.relative_to(root)
    except ValueError:
        return str(path)
    return "." if not relative.parts else relative.as_posix()


def validate_path_chain(boundary: Path, path: Path, *, label: str) -> None:
    boundary_physical = boundary.resolve(strict=True)
    path_physical = path.resolve(strict=False)
    if not is_within(path_physical, boundary_physical):
        raise ValueError(f"{label} escapes the project boundary: {path}")
    current = boundary
    if is_link_like(current):
        raise ValueError(f"project root must not be a symbolic link or junction: {current}")
    for part in path.relative_to(boundary).parts:
        current /= part
        if is_link_like(current):
            raise ValueError(f"{label} contains a symbolic link or junction: {current}")


def workspace_patterns(project_root: Path) -> list[str]:
    patterns: list[str] = []
    package_path = project_root / "package.json"
    if package_path.is_file():
        package = read_json_object(package_path, label="workspace package.json")
        raw = package.get("workspaces")
        if isinstance(raw, list):
            patterns.extend(item for item in raw if isinstance(item, str))
        elif isinstance(raw, dict):
            packages = raw.get("packages")
            if isinstance(packages, list):
                patterns.extend(item for item in packages if isinstance(item, str))

    pnpm_workspace = project_root / "pnpm-workspace.yaml"
    if pnpm_workspace.is_file():
        in_packages = False
        for raw_line in pnpm_workspace.read_text(encoding="utf-8").splitlines():
            line = raw_line.split("#", 1)[0].rstrip()
            if not line.strip():
                continue
            if re.fullmatch(r"packages\s*:\s*", line.strip()):
                in_packages = True
                continue
            if in_packages:
                match = re.fullmatch(r"\s*-\s*['\"]?([^'\"]+)['\"]?\s*", line)
                if match:
                    patterns.append(match.group(1).strip())
                    continue
                if not line.startswith((" ", "\t")):
                    in_packages = False
    return sorted(set(patterns))


def workspace_package_roots(project_root: Path) -> list[Path]:
    roots: set[Path] = set()
    for pattern in workspace_patterns(project_root):
        if pattern.startswith("!"):
            continue
        for candidate in project_root.glob(pattern):
            if candidate.is_dir() and (candidate / "package.json").is_file():
                if "node_modules" not in candidate.relative_to(project_root).parts:
                    roots.add(normalized_absolute(candidate))
    return sorted(roots)


def nearest_workspace_root(package_root: Path) -> Path | None:
    for candidate in (package_root, *package_root.parents):
        if workspace_patterns(candidate):
            packages = workspace_package_roots(candidate)
            if package_root in packages or package_root == candidate:
                return candidate
    return None


def package_looks_like_application(package: dict[str, object]) -> bool:
    scripts = package.get("scripts")
    dependencies = package.get("dependencies")
    development = package.get("devDependencies")
    text = " ".join(
        str(value)
        for mapping in (scripts, dependencies, development)
        if isinstance(mapping, dict)
        for value in (*mapping.keys(), *mapping.values())
    ).lower()
    return bool(re.search(r"(?:^|\s|[/@-])(vite|next)(?:\s|$|[/@-])", text))


def choose_package_root(project_root: Path, explicit: Path | None) -> Path:
    if explicit is not None:
        package_root = normalized_absolute(explicit, base=project_root)
        if not is_within(package_root, project_root):
            raise ValueError(
                f"package root must be inside the project root: {package_root}"
            )
        if not (package_root / "package.json").is_file():
            raise FileNotFoundError(
                f"package root does not contain package.json: {package_root}"
            )
        candidates = workspace_package_roots(project_root)
        if candidates and package_root != project_root and package_root not in candidates:
            raise ValueError(
                "package root is not declared by the workspace: "
                f"{relative_report_path(package_root, project_root)}"
            )
        return package_root

    candidates = workspace_package_roots(project_root)
    application_candidates: list[Path] = []
    for candidate in candidates:
        package = read_json_object(
            candidate / "package.json", label="workspace package.json"
        )
        if package_looks_like_application(package):
            application_candidates.append(candidate)
    if len(application_candidates) == 1:
        return application_candidates[0]
    if len(application_candidates) > 1:
        choices = ", ".join(
            relative_report_path(path, project_root)
            for path in application_candidates
        )
        raise ValueError(
            "multiple application packages are possible; pass --package-root: "
            + choices
        )
    if (project_root / "package.json").is_file():
        return project_root
    if len(candidates) == 1:
        return candidates[0]
    if candidates:
        choices = ", ".join(
            relative_report_path(path, project_root) for path in candidates
        )
        raise ValueError(
            "multiple workspace packages are possible; pass --package-root: "
            + choices
        )
    raise FileNotFoundError(
        f"project does not contain a package.json or declared workspace package: {project_root}"
    )


def package_manager_declaration(package: dict[str, object]) -> tuple[str, str] | None:
    value = package.get("packageManager")
    if not isinstance(value, str) or "@" not in value:
        return None
    name, version = value.rsplit("@", 1)
    if name in SUPPORTED_MANAGERS and version:
        return name, version
    return None


def detect_package_manager(
    project_root: Path,
    package_root: Path,
    explicit: str,
) -> tuple[str, Path | None, tuple[str, ...]]:
    evidence: list[str] = []
    candidates: set[str] = set()
    declared_versions: dict[str, str] = {}
    for root, label in ((project_root, "project"), (package_root, "package")):
        package_path = root / "package.json"
        if not package_path.is_file():
            continue
        package = read_json_object(package_path, label=f"{label} package.json")
        declaration = package_manager_declaration(package)
        if declaration is not None:
            name, version = declaration
            candidates.add(name)
            declared_versions[name] = version
            evidence.append(f"{label}:packageManager={name}@{version}")

    lockfiles: dict[str, Path] = {}
    for manager, names in LOCKFILES.items():
        matches = [project_root / name for name in names if (project_root / name).is_file()]
        if len(matches) > 1:
            raise ValueError(
                f"multiple {manager} lockfiles exist at the project root: "
                + ", ".join(path.name for path in matches)
            )
        if matches:
            candidates.add(manager)
            lockfiles[manager] = matches[0]
            evidence.append(f"project:lockfile={matches[0].name}")

    if package_root != project_root:
        nested = [
            package_root / name
            for names in LOCKFILES.values()
            for name in names
            if (package_root / name).is_file()
        ]
        if nested:
            raise ValueError(
                "workspace package must not own a nested lockfile: "
                + ", ".join(path.name for path in nested)
            )

    if explicit != "auto":
        if candidates and candidates != {explicit}:
            raise ValueError(
                f"--package-manager {explicit} conflicts with detected manager(s): "
                + ", ".join(sorted(candidates))
            )
        manager = explicit
        evidence.append(f"explicit={explicit}")
    elif not candidates:
        manager = "npm"
        evidence.append("fallback=npm")
    elif len(candidates) == 1:
        manager = next(iter(candidates))
    else:
        raise ValueError(
            "multiple package managers are detected; remove conflicting metadata or pass a consistent --package-manager: "
            + ", ".join(sorted(candidates))
        )

    if manager == "yarn":
        version = declared_versions.get("yarn")
        if version is not None:
            match = re.match(r"(\d+)", version)
            if match and int(match.group(1)) < 2:
                raise ValueError("Yarn Classic is not supported; use Yarn 4")
        elif (project_root / ".yarnrc").is_file() and not (
            project_root / ".yarnrc.yml"
        ).is_file():
            raise ValueError("Yarn Classic is not supported; use Yarn 4")
    return manager, lockfiles.get(manager), tuple(sorted(evidence))


def detect_framework(
    package: dict[str, object], explicit: str
) -> tuple[str, tuple[str, ...]]:
    evidence: list[str] = []
    candidates: set[str] = set()
    for section_name in ("dependencies", "devDependencies"):
        section = package.get(section_name)
        if not isinstance(section, dict):
            continue
        for framework in SUPPORTED_FRAMEWORKS:
            if framework in section:
                candidates.add(framework)
                evidence.append(f"{section_name}:{framework}")
    scripts = package.get("scripts")
    if isinstance(scripts, dict):
        for name, value in scripts.items():
            if not isinstance(value, str):
                continue
            for framework in SUPPORTED_FRAMEWORKS:
                if re.search(rf"(?:^|\s){re.escape(framework)}(?:\s|$)", value):
                    candidates.add(framework)
                    evidence.append(f"scripts.{name}:{framework}")
    if explicit != "auto":
        if candidates and explicit not in candidates:
            raise ValueError(
                f"--framework {explicit} conflicts with detected framework(s): "
                + ", ".join(sorted(candidates))
            )
        framework = explicit
        evidence.append(f"explicit={explicit}")
    elif len(candidates) == 1:
        framework = next(iter(candidates))
    elif not candidates:
        raise ValueError(
            "cannot infer Vite or Next.js from package.json; pass --framework"
        )
    else:
        raise ValueError(
            "both Vite and Next.js are detected; pass --framework after resolving the ambiguous build contract"
        )
    return framework, tuple(sorted(set(evidence)))


def resolve_context(
    *,
    target: Path | None,
    project_root: Path | None,
    package_root: Path | None,
    source_root: Path | None,
    package_manager: str,
    framework: str,
) -> InstallationContext:
    if target is not None and project_root is not None:
        raise ValueError("use either --target or --project-root, not both")
    anchor = normalized_absolute(project_root or target or Path.cwd())
    if not anchor.is_dir():
        raise FileNotFoundError(f"project root is not a directory: {anchor}")

    explicit_package = package_root
    if project_root is None and target is not None and (anchor / "package.json").is_file():
        workspace_root = nearest_workspace_root(anchor)
        if workspace_root is not None and workspace_root != anchor:
            resolved_project = workspace_root
            explicit_package = anchor if package_root is None else package_root
        else:
            resolved_project = anchor
    else:
        resolved_project = anchor

    resolved_package = choose_package_root(resolved_project, explicit_package)
    source_relative = validated_relative_path(
        source_root or DEFAULT_SOURCE_ROOT, label="source root"
    )
    resolved_source = normalized_absolute(source_relative, base=resolved_package)
    validate_path_chain(resolved_project, resolved_package, label="package root")
    validate_path_chain(resolved_package, resolved_source, label="source root")

    package = read_json_object(
        resolved_package / "package.json", label="package.json"
    )
    manager, lockfile, manager_evidence = detect_package_manager(
        resolved_project, resolved_package, package_manager
    )
    detected_framework, framework_evidence = detect_framework(package, framework)
    return InstallationContext(
        project_root=resolved_project,
        package_root=resolved_package,
        source_root=resolved_source,
        source_relative=source_relative,
        package_manager=manager,
        framework=detected_framework,
        lockfile=lockfile,
        workspace=resolved_project != resolved_package,
        manager_evidence=manager_evidence,
        framework_evidence=framework_evidence,
    )


def iter_files(root: Path, *, ignored_parts: Iterable[str] = ()) -> list[Path]:
    ignored = set(ignored_parts)
    return [
        path
        for path in sorted(root.rglob("*"))
        if path.is_file() and not any(part in ignored for part in path.relative_to(root).parts)
    ]
