#!/usr/bin/env python3
"""Focused verifier and dry-run filesystem-boundary contracts."""

from __future__ import annotations

import contextlib
import io
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import install_personal_ui as installer
import verify_personal_ui as verifier
from personal_ui_installation import resolve_context


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")


def make_package(root: Path) -> None:
    write_json(
        root / "package.json",
        {
            "name": "path-boundary-fixture",
            "private": True,
            "scripts": {"build": "vite build"},
            "dependencies": {"vite": "6.4.3"},
        },
    )


def make_directory_link(link: Path, target: Path) -> None:
    try:
        link.symlink_to(target, target_is_directory=True)
        return
    except OSError as error:
        if os.name != "nt":
            raise unittest.SkipTest(f"directory symlinks are unavailable: {error}")
    result = subprocess.run(
        ["cmd", "/c", "mklink", "/J", str(link), str(target)],
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=False,
    )
    if result.returncode != 0:
        raise unittest.SkipTest(
            "directory links are unavailable: "
            + (result.stderr.strip() or result.stdout.strip())
        )


def remove_directory_link(link: Path) -> None:
    if not link.exists() and not link.is_symlink():
        return
    if link.is_symlink():
        link.unlink()
    else:
        link.rmdir()


@contextlib.contextmanager
def reject_external_file_io(outside: Path):
    outside_physical = outside.resolve(strict=True)
    original_read_text = Path.read_text
    original_read_bytes = Path.read_bytes
    original_write_text = Path.write_text
    original_write_bytes = Path.write_bytes

    def is_external(path: Path) -> bool:
        try:
            path.resolve(strict=False).relative_to(outside_physical)
            return True
        except ValueError:
            return False

    def guarded_read_text(path: Path, *args, **kwargs):
        if is_external(path):
            raise AssertionError(f"unexpected package-external read: {path}")
        return original_read_text(path, *args, **kwargs)

    def guarded_read_bytes(path: Path, *args, **kwargs):
        if is_external(path):
            raise AssertionError(f"unexpected package-external read: {path}")
        return original_read_bytes(path, *args, **kwargs)

    def guarded_write_text(path: Path, *args, **kwargs):
        if is_external(path):
            raise AssertionError(f"unexpected package-external write: {path}")
        return original_write_text(path, *args, **kwargs)

    def guarded_write_bytes(path: Path, *args, **kwargs):
        if is_external(path):
            raise AssertionError(f"unexpected package-external write: {path}")
        return original_write_bytes(path, *args, **kwargs)

    with (
        mock.patch.object(Path, "read_text", guarded_read_text),
        mock.patch.object(Path, "read_bytes", guarded_read_bytes),
        mock.patch.object(Path, "write_text", guarded_write_text),
        mock.patch.object(Path, "write_bytes", guarded_write_bytes),
    ):
        yield


class VerifierPathBoundaryContracts(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.registry = installer.load_registry()

    def test_verify_rejects_linked_tools_parent_before_external_file_io(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pui-verify-boundary-") as temporary:
            parent = Path(temporary)
            package = parent / "app"
            outside = parent / "outside-tools"
            make_package(package)
            outside.mkdir()
            write_json(
                outside / "personal-ui" / "install-state.json",
                {"sourceRoot": "../../outside-source"},
            )
            write_json(
                outside / "personal-ui" / "component-manifest.json",
                {"sourceIntegrity": {}},
            )
            (outside / "personal-ui" / "verify-provenance.mjs").write_text(
                "throw new Error('must not execute');\n", encoding="utf-8"
            )
            sentinel = outside / "sentinel.txt"
            sentinel.write_text("unchanged\n", encoding="utf-8")
            link = package / "tools"
            make_directory_link(link, outside)
            try:
                output = io.StringIO()
                with (
                    reject_external_file_io(outside),
                    mock.patch.object(
                        sys,
                        "argv",
                        [
                            str(verifier.__file__),
                            "--target",
                            str(package),
                            "--framework",
                            "vite",
                        ],
                    ),
                    contextlib.redirect_stdout(output),
                ):
                    result = verifier.main()
                report = json.loads(output.getvalue())
                self.assertEqual(result, 1, report)
                self.assertTrue(
                    any(
                        "Personal UI install state" in error
                        and (
                            "escapes the project boundary" in error
                            or "symbolic link or junction" in error
                        )
                        for error in report["errors"]
                    ),
                    report,
                )
                self.assertEqual(sentinel.read_text(encoding="utf-8"), "unchanged\n")
            finally:
                remove_directory_link(link)

    def test_dry_run_rejects_linked_tools_parent_for_force_modes(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pui-dry-run-boundary-") as temporary:
            parent = Path(temporary)
            package = parent / "app"
            outside = parent / "outside-tools"
            make_package(package)
            context = resolve_context(
                target=package,
                project_root=None,
                package_root=None,
                source_root=Path("src/personal-ui"),
                package_manager="auto",
                framework="vite",
            )
            outside.mkdir()
            sentinel = outside / "sentinel.txt"
            sentinel.write_text("unchanged\n", encoding="utf-8")
            link = package / "tools"
            make_directory_link(link, outside)
            try:
                for force in (False, True):
                    with self.subTest(force=force), reject_external_file_io(outside):
                        with self.assertRaisesRegex(
                            ValueError,
                            "(?:escapes the project boundary|symbolic link or junction)",
                        ):
                            installer.install_integrated(
                                context,
                                registry=self.registry,
                                force=force,
                                dry_run=True,
                            )
                self.assertEqual(sentinel.read_text(encoding="utf-8"), "unchanged\n")
            finally:
                remove_directory_link(link)


if __name__ == "__main__":
    unittest.main(verbosity=2)
