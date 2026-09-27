#!/usr/bin/env python3
"""Focused M7 installer, upgrade, dry-run, and rollback contracts."""

from __future__ import annotations

import hashlib
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import install_personal_ui as installer
from personal_ui_installation import STATE_RELATIVE, resolve_context


SCRIPT_ROOT = Path(__file__).resolve().parent
VERIFIER = SCRIPT_ROOT / "verify_personal_ui.py"


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")


def snapshot(root: Path) -> dict[str, str]:
    if not root.exists():
        return {}
    return {
        path.relative_to(root).as_posix(): hashlib.sha256(path.read_bytes()).hexdigest()
        for path in sorted(root.rglob("*"))
        if path.is_file()
    }


def make_package(root: Path, *, framework: str = "vite", name: str = "fixture") -> None:
    command = "vite build" if framework == "vite" else "next build"
    dependencies = {framework: "1.0.0"}
    write_json(
        root / "package.json",
        {
            "name": name,
            "private": True,
            "scripts": {"prebuild": "node existing.mjs", "build": command},
            "dependencies": dependencies,
        },
    )


def context_for(root: Path, *, source: str = "src/personal-ui", framework: str = "vite"):
    return resolve_context(
        target=root,
        project_root=None,
        package_root=None,
        source_root=Path(source),
        package_manager="auto",
        framework=framework,
    )


class InstallerContracts(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.registry = installer.load_registry()

    def test_workspace_manager_discovery(self) -> None:
        profiles = (
            ("npm", {"workspaces": ["packages/*"], "packageManager": "npm@11.0.0"}, "package-lock.json"),
            ("pnpm", {"packageManager": "pnpm@10.0.0"}, "pnpm-lock.yaml"),
            ("yarn", {"workspaces": ["packages/*"], "packageManager": "yarn@4.5.0"}, "yarn.lock"),
        )
        for manager, root_fields, lockfile in profiles:
            with self.subTest(manager=manager), tempfile.TemporaryDirectory(
                prefix=f"pui-{manager}-workspace-"
            ) as temporary:
                root = Path(temporary)
                root_package = {"name": "workspace", "private": True, **root_fields}
                write_json(root / "package.json", root_package)
                (root / lockfile).write_text("", encoding="utf-8")
                if manager == "pnpm":
                    (root / "pnpm-workspace.yaml").write_text(
                        "packages:\n  - 'packages/*'\n", encoding="utf-8"
                    )
                package = root / "packages" / "web"
                make_package(package, name=f"@fixture/{manager}")
                context = resolve_context(
                    target=None,
                    project_root=root,
                    package_root=Path("packages/web"),
                    source_root=Path("ui/personal-ui"),
                    package_manager="auto",
                    framework="auto",
                )
                self.assertEqual(context.package_manager, manager)
                self.assertTrue(context.workspace)
                self.assertEqual(context.source_relative.as_posix(), "ui/personal-ui")
                self.assertEqual(context.lockfile, root / lockfile)

    def test_source_root_escape_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pui-path-contract-") as temporary:
            root = Path(temporary)
            make_package(root)
            with self.assertRaisesRegex(ValueError, "does not escape"):
                context_for(root, source="../outside")

    def test_dry_run_is_deterministic_and_does_not_write(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pui-dry-run-") as temporary:
            root = Path(temporary)
            make_package(root)
            lock_path = installer.package_lock_path(root)
            lock_path.unlink(missing_ok=True)
            before = snapshot(root)
            context = context_for(root)
            first = installer.install_integrated(
                context, registry=self.registry, force=False, dry_run=True
            )
            middle = snapshot(root)
            second = installer.install_integrated(
                context, registry=self.registry, force=False, dry_run=True
            )
            self.assertEqual(before, middle)
            self.assertEqual(middle, snapshot(root))
            self.assertEqual(first["plan"], second["plan"])
            self.assertEqual(first["plan"]["planDigest"], second["plan"]["planDigest"])
            self.assertFalse(lock_path.exists())

    def test_install_then_noop_and_modified_source_conflict(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pui-install-noop-") as temporary:
            root = Path(temporary)
            make_package(root)
            context = context_for(root)
            installed = installer.install_integrated(
                context, registry=self.registry, force=False, dry_run=False
            )
            self.assertEqual(installed["operation"], "install")
            package = json.loads((root / "package.json").read_text(encoding="utf-8"))
            self.assertTrue(package["scripts"]["build"].startswith(package["scripts"]["verify:personal-ui"] + " && "))
            self.assertEqual(package["scripts"]["prebuild"], "node existing.mjs")
            self.assertTrue((root / STATE_RELATIVE).is_file())
            repeated = installer.install_integrated(
                context, registry=self.registry, force=False, dry_run=False
            )
            self.assertEqual(repeated["operation"], "noop")

            managed = context.source_root / "index.ts"
            managed.write_text(managed.read_text(encoding="utf-8") + "\n", encoding="utf-8")
            with self.assertRaises(installer.InstallationConflict) as raised:
                installer.install_integrated(
                    context, registry=self.registry, force=False, dry_run=True
                )
            conflicts = raised.exception.report["plan"]["conflicts"]
            self.assertTrue(any(item["reason"] == "modified-owned-file" for item in conflicts))
            local = context.source_root / "local-extension.ts"
            local.write_text("export const local = true;\n", encoding="utf-8")
            with self.assertRaises(installer.InstallationConflict) as forced:
                installer.install_integrated(
                    context, registry=self.registry, force=True, dry_run=True
                )
            self.assertTrue(
                any(
                    item["reason"] == "unowned-file-inside-managed-source"
                    and item["forceable"] is False
                    for item in forced.exception.report["plan"]["conflicts"]
                )
            )

    def test_legacy_manifest_upgrades_without_clearing_unowned_paths(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pui-legacy-upgrade-") as temporary:
            root = Path(temporary)
            make_package(root)
            context = context_for(root)
            legacy_source = context.source_root
            legacy_source.mkdir(parents=True)
            legacy_bytes = b"export const legacy = true;\n"
            (legacy_source / "legacy.ts").write_bytes(legacy_bytes)
            (legacy_source / "registry.json").write_bytes(installer.REGISTRY_PATH.read_bytes())
            manifest = {
                "sourceIntegrity": {
                    "legacy.ts": hashlib.sha256(legacy_bytes).hexdigest()
                }
            }
            write_json(root / "tools/personal-ui/component-manifest.json", manifest)
            (root / "tools/personal-ui/verify-provenance.mjs").write_text(
                "export {};\n", encoding="utf-8"
            )
            report = installer.install_integrated(
                context, registry=self.registry, force=False, dry_run=False
            )
            self.assertEqual(report["operation"], "upgrade")
            self.assertFalse((legacy_source / "legacy.ts").exists())
            self.assertTrue((legacy_source / "index.ts").is_file())

    def test_legacy_manifest_escape_cannot_delete_external_file(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pui-legacy-escape-") as temporary:
            parent = Path(temporary)
            root = parent / "app"
            make_package(root)
            context = context_for(root)
            context.source_root.mkdir(parents=True)
            (context.source_root / "registry.json").write_bytes(
                installer.REGISTRY_PATH.read_bytes()
            )
            sentinel = parent / "outside-file"
            sentinel_bytes = b"must remain outside the package\n"
            sentinel.write_bytes(sentinel_bytes)
            (root / "tools/personal-ui").mkdir(parents=True)
            (root / "tools/personal-ui/verify-provenance.mjs").write_text(
                "export {};\n", encoding="utf-8"
            )

            for force in (False, True):
                digest = (
                    "0" * 64
                    if force
                    else hashlib.sha256(sentinel_bytes).hexdigest()
                )
                write_json(
                    root / "tools/personal-ui/component-manifest.json",
                    {"sourceIntegrity": {"../../../outside-file": digest}},
                )
                with self.subTest(force=force), self.assertRaisesRegex(
                    ValueError, "legacy sourceIntegrity path"
                ):
                    installer.install_integrated(
                        context,
                        registry=self.registry,
                        force=force,
                        dry_run=False,
                    )
                self.assertEqual(sentinel.read_bytes(), sentinel_bytes)

    def test_legacy_manifest_rejects_noncanonical_paths_and_digests(self) -> None:
        invalid_entries = (
            ("/absolute.ts", "0" * 64),
            ("C:/outside.ts", "0" * 64),
            ("folder\\outside.ts", "0" * 64),
            ("folder//outside.ts", "0" * 64),
            ("folder/./outside.ts", "0" * 64),
            ("folder/../outside.ts", "0" * 64),
            ("valid.ts", "not-a-sha256"),
        )
        for relative, digest in invalid_entries:
            with self.subTest(relative=relative), tempfile.TemporaryDirectory(
                prefix="pui-legacy-invalid-"
            ) as temporary:
                root = Path(temporary)
                make_package(root)
                context = context_for(root)
                context.source_root.mkdir(parents=True)
                (context.source_root / "registry.json").write_bytes(
                    installer.REGISTRY_PATH.read_bytes()
                )
                write_json(
                    root / "tools/personal-ui/component-manifest.json",
                    {"sourceIntegrity": {relative: digest}},
                )
                with self.assertRaises(ValueError):
                    installer.legacy_owned_files(context)

    def test_tool_parent_link_is_rejected_before_external_write(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pui-tool-link-") as temporary:
            parent = Path(temporary)
            root = parent / "app"
            outside = parent / "outside-tools"
            make_package(root)
            outside.mkdir()
            try:
                (root / "tools").symlink_to(outside, target_is_directory=True)
            except OSError as error:
                if sys.platform != "win32":
                    self.skipTest(f"directory symlinks are unavailable: {error}")
                junction = subprocess.run(
                    ["cmd", "/c", "mklink", "/J", str(root / "tools"), str(outside)],
                    capture_output=True,
                    text=True,
                    encoding="utf-8",
                    check=False,
                )
                if junction.returncode != 0:
                    self.skipTest(
                        "directory links are unavailable: "
                        + (junction.stderr.strip() or junction.stdout.strip())
                    )
            sentinel = outside / "sentinel.txt"
            sentinel.write_text("unchanged\n", encoding="utf-8")

            with self.assertRaisesRegex(
                ValueError, "(?:escapes the project boundary|symbolic link or junction)"
            ):
                installer.install_integrated(
                    context_for(root),
                    registry=self.registry,
                    force=True,
                    dry_run=False,
                )
            self.assertEqual(sentinel.read_text(encoding="utf-8"), "unchanged\n")
            self.assertFalse((outside / "personal-ui").exists())

    def test_all_failure_points_restore_file_and_directory_inventory(self) -> None:
        for failure_point in ("copy", "dependencies", "package", "verify", "commit"):
            with self.subTest(failure_point=failure_point), tempfile.TemporaryDirectory(
                prefix=f"pui-rollback-{failure_point}-"
            ) as temporary:
                root = Path(temporary)
                make_package(root)
                before_files = snapshot(root)
                before_dirs = sorted(
                    path.relative_to(root).as_posix()
                    for path in root.rglob("*")
                    if path.is_dir()
                )
                with self.assertRaisesRegex(RuntimeError, "injected installer failure"):
                    installer.install_integrated(
                        context_for(root),
                        registry=self.registry,
                        force=False,
                        dry_run=False,
                        failure_point=failure_point,
                    )
                self.assertEqual(snapshot(root), before_files)
                self.assertEqual(
                    sorted(
                        path.relative_to(root).as_posix()
                        for path in root.rglob("*")
                        if path.is_dir()
                    ),
                    before_dirs,
                )

    def test_package_lock_rejects_active_recovers_stale_and_cleans_exception(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pui-package-lock-") as temporary:
            root = Path(temporary)
            lock_path = installer.package_lock_path(root)
            lock_path.unlink(missing_ok=True)
            try:
                with installer.PackageInstallLock(root):
                    with self.assertRaisesRegex(RuntimeError, "installation is active"):
                        with installer.PackageInstallLock(root):
                            self.fail("a second installer acquired an active package lock")

                lock_path.write_bytes(
                    b"\0"
                    + installer.canonical_json(
                        {"schemaVersion": 1, "pid": 999999, "token": "stale"}
                    )
                )
                with installer.PackageInstallLock(root) as recovered:
                    self.assertTrue(recovered.recovered_stale_record)

                with self.assertRaisesRegex(RuntimeError, "lock cleanup fixture"):
                    with installer.PackageInstallLock(root):
                        raise RuntimeError("lock cleanup fixture")
                with installer.PackageInstallLock(root) as clean:
                    self.assertFalse(clean.recovered_stale_record)
            finally:
                lock_path.unlink(missing_ok=True)

    def test_later_concurrent_change_is_not_overwritten_and_prior_write_rolls_back(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pui-transaction-race-") as temporary:
            root = Path(temporary)
            first = root / "first.txt"
            later = root / "later.txt"
            first.write_bytes(b"first-before")
            later.write_bytes(b"later-before")
            mutations = [
                installer.Mutation(
                    first,
                    "first.txt",
                    installer.sha256_file(first),
                    b"first-after",
                    "fixture",
                ),
                installer.Mutation(
                    later,
                    "later.txt",
                    installer.sha256_file(later),
                    b"later-after",
                    "fixture",
                ),
            ]
            original_write = installer.write_bytes_atomic
            raced = False

            def write_with_race(path: Path, value: bytes) -> None:
                nonlocal raced
                original_write(path, value)
                if path == first and not raced:
                    raced = True
                    later.write_bytes(b"concurrent-user-change")

            with mock.patch.object(
                installer, "write_bytes_atomic", side_effect=write_with_race
            ):
                with self.assertRaisesRegex(
                    RuntimeError, "installation input changed after planning: later.txt"
                ):
                    installer.execute_transaction(root, mutations)

            self.assertTrue(raced)
            self.assertEqual(first.read_bytes(), b"first-before")
            self.assertEqual(later.read_bytes(), b"concurrent-user-change")

    def test_next_root_app_is_reachable_with_custom_source_root(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pui-next-root-app-") as temporary:
            root = Path(temporary)
            make_package(root, framework="next", name="next-fixture")
            app = root / "app"
            app.mkdir()
            (app / "layout.tsx").write_text(
                "import '../ui/personal-ui/styles.css';\n"
                "export default function Layout({children}:{children:React.ReactNode}){return <html><body>{children}</body></html>;}\n",
                encoding="utf-8",
            )
            (app / "page.tsx").write_text(
                "'use client';\n"
                "import {Button} from '../ui/personal-ui';\n"
                "export default function Page(){return <Button>Run</Button>;}\n",
                encoding="utf-8",
            )
            context = context_for(root, source="ui/personal-ui", framework="next")
            installer.install_integrated(
                context, registry=self.registry, force=False, dry_run=False
            )
            result = subprocess.run(
                [
                    sys.executable,
                    str(VERIFIER),
                    "--target",
                    str(root),
                ],
                capture_output=True,
                text=True,
                encoding="utf-8",
                check=False,
            )
            report = json.loads(result.stdout)
            self.assertEqual(result.returncode, 0, report)
            self.assertTrue(report["upToDate"], report)
            self.assertEqual(report["framework"], "next")
            self.assertEqual(report["sourceRoot"], str(root / "ui/personal-ui"))

    def test_integrate_state_cannot_claim_application_files(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pui-state-ownership-") as temporary:
            root = Path(temporary)
            make_package(root)
            app = root / "src/App.tsx"
            readme = root / "README.md"
            app.parent.mkdir()
            app.write_text("export default function App() { return null; }\n", encoding="utf-8")
            readme.write_text("consumer documentation\n", encoding="utf-8")
            context = context_for(root)
            installer.install_integrated(
                context, registry=self.registry, force=False, dry_run=False
            )
            state_path = root / STATE_RELATIVE
            clean_state = json.loads(state_path.read_text(encoding="utf-8"))

            for relative in ("src/App.tsx", "README.md"):
                for digest_kind in ("actual", "forged"):
                    for force in (False, True):
                        with self.subTest(
                            relative=relative,
                            digest_kind=digest_kind,
                            force=force,
                        ):
                            path = root / relative
                            before = path.read_bytes()
                            state = json.loads(json.dumps(clean_state))
                            state["ownedFiles"][relative] = (
                                installer.sha256_file(path)
                                if digest_kind == "actual"
                                else "0" * 64
                            )
                            write_json(state_path, state)
                            with self.assertRaisesRegex(
                                ValueError, "outside the integrate ownership allowlist"
                            ):
                                installer.install_integrated(
                                    context,
                                    registry=self.registry,
                                    force=force,
                                    dry_run=True,
                                )
                            self.assertEqual(path.read_bytes(), before)
            write_json(state_path, clean_state)

    def test_install_state_context_fields_must_match(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pui-state-context-") as temporary:
            root = Path(temporary)
            make_package(root)
            context = context_for(root)
            installer.install_integrated(
                context, registry=self.registry, force=False, dry_run=False
            )
            state_path = root / STATE_RELATIVE
            clean_state = json.loads(state_path.read_text(encoding="utf-8"))
            invalid_values = {
                "packageRoot": "apps/other",
                "sourceRoot": "ui/other",
                "packageManager": "pnpm",
                "framework": "next",
            }
            for field, value in invalid_values.items():
                with self.subTest(field=field):
                    state = json.loads(json.dumps(clean_state))
                    state[field] = value
                    write_json(state_path, state)
                    with self.assertRaisesRegex(ValueError, f"install state {field}"):
                        installer.install_integrated(
                            context,
                            registry=self.registry,
                            force=True,
                            dry_run=True,
                        )
            write_json(state_path, clean_state)

    def test_custom_source_root_is_restored_and_build_gate_reads_state(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pui-state-source-root-") as temporary:
            root = Path(temporary)
            make_package(root)
            custom_source = "ui/personal & custom"
            initial = context_for(root, source=custom_source)
            installer.install_integrated(
                initial, registry=self.registry, force=False, dry_run=False
            )

            package = json.loads((root / "package.json").read_text(encoding="utf-8"))
            verify_command = package["scripts"]["verify:personal-ui"]
            self.assertEqual(verify_command, installer.PROVENANCE_SCRIPT_COMMAND)
            self.assertNotIn("--source-root", verify_command)
            self.assertNotIn(custom_source, package["scripts"]["build"])

            restored = installer.resolve_integrated_context(
                target=root,
                project_root=None,
                package_root=None,
                source_root=None,
                package_manager="auto",
                framework="auto",
            )
            self.assertEqual(restored.source_relative.as_posix(), custom_source)
            repeated = installer.install_integrated(
                restored, registry=self.registry, force=False, dry_run=False
            )
            self.assertEqual(repeated["operation"], "noop")
            self.assertFalse((root / "src/personal-ui").exists())

            provenance = subprocess.run(
                [
                    "node",
                    "tools/personal-ui/verify-provenance.mjs",
                    "--target",
                    ".",
                    "--manifest",
                    "tools/personal-ui/component-manifest.json",
                ],
                cwd=root,
                capture_output=True,
                text=True,
                encoding="utf-8",
                check=False,
            )
            self.assertEqual(provenance.returncode, 0, provenance.stdout + provenance.stderr)

    def test_starter_state_uses_explicit_owned_file_allowlist(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pui-starter-state-") as temporary:
            root = Path(temporary)
            installer.install_starter(
                root, registry=self.registry, force=False, dry_run=False
            )
            state_path = root / STATE_RELATIVE
            state = json.loads(state_path.read_text(encoding="utf-8"))
            readme = root / "README.md"
            readme.write_text("consumer documentation\n", encoding="utf-8")
            state["ownedFiles"]["README.md"] = installer.sha256_file(readme)
            write_json(state_path, state)
            with self.assertRaisesRegex(
                ValueError, "outside the starter ownership allowlist"
            ):
                installer.install_starter(
                    root, registry=self.registry, force=True, dry_run=True
                )
            self.assertEqual(readme.read_text(encoding="utf-8"), "consumer documentation\n")

    def test_starter_payload_is_allowlisted(self) -> None:
        paths = {path.as_posix() for path in installer.starter_payload()}
        self.assertFalse(any("test-results" in path for path in paths))
        self.assertFalse(any(path.startswith("tests/") for path in paths))
        self.assertIn("component-manifest.json", paths)
        self.assertIn("tools/personal-ui/component-manifest.json", paths)


if __name__ == "__main__":
    unittest.main(verbosity=2)
