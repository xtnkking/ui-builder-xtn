#!/usr/bin/env python3
"""Focused contracts for the M8 v0.2.19 migration runner."""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import run_m8_migration as migration
import validate_component_manifest as manifest_validator


SKILL_ROOT = Path(__file__).resolve().parents[1]


def is_git_repository(path: Path) -> bool:
    return subprocess.run(
        ["git", "rev-parse", "--git-dir"],
        cwd=path,
        capture_output=True,
        check=False,
    ).returncode == 0


def run(command: list[str], *, cwd: Path) -> str:
    result = subprocess.run(
        command,
        cwd=cwd,
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=False,
    )
    if result.returncode != 0:
        raise AssertionError(
            f"command failed ({result.returncode}): {' '.join(command)}\n{result.stderr}"
        )
    return result.stdout.strip()


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")


class TemplateContracts(unittest.TestCase):
    def test_packaged_manifest_validation_does_not_need_build_dependencies(self) -> None:
        with mock.patch.object(
            manifest_validator,
            "build_coverage_matrix",
            side_effect=AssertionError("AST tooling must not run during consumer installation"),
        ):
            report = manifest_validator.validate_component_manifest(
                coverage_validation="packaged"
            )
        self.assertEqual(report["errors"], [])
        self.assertEqual(report["coverage"]["mode"], "packaged")
        self.assertTrue(report["coverage"]["valid"])

    def test_packaged_manifest_rejects_a_coverage_owner_mismatch(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pui-m8-coverage-tamper-") as temporary:
            coverage_path = Path(temporary) / "coverage.json"
            coverage = json.loads(
                (SKILL_ROOT / "assets/react-kit/component-coverage.json").read_text("utf-8")
            )
            coverage["exports"][0]["owner"]["manifestEntry"] = "wrong-owner"
            write_json(coverage_path, coverage)
            report = manifest_validator.validate_component_manifest(
                coverage_path=coverage_path,
                coverage_validation="packaged",
            )
        self.assertFalse(report["coverage"]["valid"])
        self.assertIn(
            "packaged component coverage matrix disagrees with the registry or manifest",
            report["errors"],
        )

    def test_template_exercises_one_documented_break_and_all_required_workflows(self) -> None:
        root, template = migration.load_template(SKILL_ROOT)
        before = (root / "before/src/App.tsx").read_text(encoding="utf-8")
        after = (root / "after/src/App.tsx").read_text(encoding="utf-8")

        self.assertIn('trigger={<Button>查看迁移帮助</Button>}', before)
        self.assertIn('triggerLabel="查看迁移帮助"', after)
        self.assertIn('onClose={() => setDrawerOpen(false)}', before)
        self.assertIn('onOpenChange={setDrawerOpen}', after)
        self.assertEqual(template["migrationPaths"], ["src/App.tsx"])
        for export_name in (
            "Input",
            "PasswordInput",
            "Select",
            "DataTable",
            "Drawer",
            "Form",
            "Popover",
        ):
            self.assertIn(export_name, template["requiredExports"])
            self.assertIn(export_name, before)
            self.assertIn(export_name, after)

    def test_before_and_after_differ_only_by_popover_trigger_contract(self) -> None:
        root, _ = migration.load_template(SKILL_ROOT)
        before = (root / "before/src/App.tsx").read_text(encoding="utf-8")
        after = (root / "after/src/App.tsx").read_text(encoding="utf-8")
        normalized_before = before.replace(
            'trigger={<Button>查看迁移帮助</Button>}',
            'triggerLabel="查看迁移帮助"',
        ).replace(
            'onClose={() => setDrawerOpen(false)}',
            'onOpenChange={setDrawerOpen}',
        )
        self.assertEqual(normalized_before, after)

    def test_execution_plan_is_explicit_about_external_work(self) -> None:
        _, template = migration.load_template(SKILL_ROOT)
        plan = migration.build_execution_plan(
            candidate={
                "version": "0.3.0-rc.1",
                "planDigest": "a" * 64,
                "sourceCommit": "b" * 40,
                "archiveSha256": "c" * 64,
                "candidateContentDigest": "d" * 64,
            },
            baseline={
                "version": "0.2.19",
                "tag": "v0.2.19",
                "tagObject": "e" * 40,
                "commit": "f" * 40,
                "tree": "1" * 40,
            },
            template=template,
        )
        self.assertTrue(plan["networkMayBeRequired"])
        self.assertIn("modified-owned-file-conflict", plan["steps"])
        self.assertIn("injected-failure-rollback", plan["steps"])


class BaselineContracts(unittest.TestCase):
    def make_repository(self, root: Path) -> tuple[Path, str, str]:
        repository = root / "repository"
        repository.mkdir()
        run(["git", "init", "--quiet"], cwd=repository)
        run(["git", "config", "user.name", "M8 fixture"], cwd=repository)
        run(["git", "config", "user.email", "m8@example.invalid"], cwd=repository)
        write_json(
            repository / "assets/react-kit/package.json",
            {"name": "fixture", "version": "0.2.19"},
        )
        write_json(
            repository / "assets/react-kit/registry.json",
            {"name": "personal-ui", "version": "0.2.19"},
        )
        (repository / "README.md").write_text("baseline\n", encoding="utf-8")
        run(["git", "add", "."], cwd=repository)
        run(["git", "commit", "--quiet", "-m", "baseline"], cwd=repository)
        commit = run(["git", "rev-parse", "HEAD"], cwd=repository)
        run(["git", "tag", "-a", "v0.2.19", "-m", "baseline"], cwd=repository)
        tag_object = run(["git", "rev-parse", "refs/tags/v0.2.19"], cwd=repository)
        return repository, commit, tag_object

    def candidate_files(self, commit: str) -> dict[str, bytes]:
        return {
            "references/support-matrix.json": migration.canonical_json(
                {
                    "baseline": {
                        "version": "0.2.19",
                        "tag": "v0.2.19",
                        "commit": commit,
                    }
                }
            )
        }

    def test_canonical_annotated_tag_is_bound_and_exported_by_exact_commit(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pui-m8-baseline-") as temporary:
            root = Path(temporary)
            repository, commit, tag_object = self.make_repository(root)
            with (
                mock.patch.object(migration, "CANONICAL_BASELINE_COMMIT", commit),
                mock.patch.object(migration, "CANONICAL_BASELINE_TAG_OBJECT", tag_object),
            ):
                baseline = migration.resolve_baseline(
                    repository,
                    self.candidate_files(commit),
                )
            destination = root / "export"
            archive = root / "artifacts/baseline.tar"
            report = migration.export_baseline(repository, baseline, destination, archive)

            self.assertEqual(baseline["commit"], commit)
            self.assertEqual(baseline["tagObject"], tag_object)
            package = json.loads(
                (destination / "assets/react-kit/package.json").read_text("utf-8")
            )
            self.assertEqual(package["version"], migration.CANONICAL_BASELINE_VERSION)
            self.assertEqual(report["archiveSha256"], migration.sha256_file(archive))
            self.assertGreater(report["fileCount"], 2)

    @unittest.skipUnless(
        is_git_repository(SKILL_ROOT),
        "requires the canonical Git checkout rather than a release staging tree",
    )
    def test_checked_out_repository_matches_the_frozen_baseline_identity(self) -> None:
        baseline = migration.resolve_baseline(
            SKILL_ROOT,
            self.candidate_files(migration.CANONICAL_BASELINE_COMMIT),
        )
        self.assertEqual(baseline["commit"], migration.CANONICAL_BASELINE_COMMIT)
        self.assertEqual(baseline["tagObject"], migration.CANONICAL_BASELINE_TAG_OBJECT)

    def test_lookalike_annotated_tag_is_not_accepted_as_the_baseline(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pui-m8-baseline-mismatch-") as temporary:
            repository, commit, _ = self.make_repository(Path(temporary))
            with self.assertRaisesRegex(
                migration.MigrationError, "canonical annotated baseline"
            ):
                migration.resolve_baseline(repository, self.candidate_files(commit))

    def test_lightweight_tag_is_rejected_even_when_the_commit_matches(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pui-m8-baseline-lightweight-") as temporary:
            repository, commit, _ = self.make_repository(Path(temporary))
            run(["git", "tag", "--delete", "v0.2.19"], cwd=repository)
            run(["git", "tag", "v0.2.19", commit], cwd=repository)
            with (
                mock.patch.object(migration, "CANONICAL_BASELINE_COMMIT", commit),
                self.assertRaisesRegex(
                    migration.MigrationError, "annotated immutable tag"
                ),
            ):
                migration.resolve_baseline(repository, self.candidate_files(commit))


class EvidenceContracts(unittest.TestCase):
    def test_npm_shim_resolution_records_the_executed_argv(self) -> None:
        self.assertEqual(
            migration.executable_argv(["npm", "ci"], platform="nt"),
            ["npm.cmd", "ci"],
        )
        self.assertEqual(
            migration.executable_argv(["npm", "ci"], platform="posix"),
            ["npm", "ci"],
        )
        self.assertEqual(
            migration.executable_argv(["node", "--version"], platform="nt"),
            ["node", "--version"],
        )
        with tempfile.TemporaryDirectory(prefix="pui-m8-npm-argv-") as temporary:
            root = Path(temporary)
            artifacts = root / "artifacts"
            artifacts.mkdir()
            recorder = migration.CommandRecorder(artifacts, ())
            with (
                mock.patch.object(migration, "executable_argv", return_value=["npm.cmd", "--version"]),
                mock.patch.object(migration.subprocess, "run") as run_process,
            ):
                run_process.return_value = subprocess.CompletedProcess(
                    ["npm.cmd", "--version"], 0, stdout="10.9.3\n", stderr=""
                )
                command = recorder.run("npm version", ["npm", "--version"], cwd=root)
            self.assertEqual(run_process.call_args.args[0], ["npm.cmd", "--version"])
            record = json.loads((root / command.record_path).read_text("utf-8"))
            self.assertEqual(record["argv"], ["npm.cmd", "--version"])

    def bindings(self) -> tuple[dict[str, str], dict[str, str]]:
        candidate = {
            "version": "0.3.0-rc.1",
            "planDigest": "a" * 64,
            "sourceCommit": "b" * 40,
            "archiveSha256": "c" * 64,
            "candidateContentDigest": "d" * 64,
        }
        baseline = {
            "version": "0.2.19",
            "tag": "v0.2.19",
            "tagObject": "e" * 40,
            "commit": "f" * 40,
            "tree": "1" * 40,
        }
        return candidate, baseline

    def make_evidence(self, root: Path) -> Path:
        (root / "artifacts").mkdir(parents=True)
        candidate, baseline = self.bindings()
        write_json(
            root / "migration-report.json",
            {"result": "passed", "candidate": candidate, "baseline": baseline},
        )
        (root / "artifacts/result.log").write_text("passed\n", encoding="utf-8")
        migration.create_artifact_inventory(
            root,
            candidate=candidate,
            baseline=baseline,
        )
        return root / "artifact-inventory.json"

    def test_inventory_exactly_binds_real_artifacts(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pui-m8-inventory-") as temporary:
            path = self.make_evidence(Path(temporary))
            inventory = migration.validate_artifact_inventory(path)
            self.assertEqual(inventory["artifactCount"], 2)

    def test_tampered_artifact_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pui-m8-inventory-tamper-") as temporary:
            root = Path(temporary)
            path = self.make_evidence(root)
            (root / "artifacts/result.log").write_text("changed\n", encoding="utf-8")
            with self.assertRaisesRegex(migration.MigrationError, "hash mismatch"):
                migration.validate_artifact_inventory(path)

    def test_uninventoried_artifact_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pui-m8-inventory-extra-") as temporary:
            root = Path(temporary)
            path = self.make_evidence(root)
            (root / "artifacts/extra.log").write_text("extra\n", encoding="utf-8")
            with self.assertRaisesRegex(migration.MigrationError, "does not exactly cover"):
                migration.validate_artifact_inventory(path)

    def test_inventory_candidate_binding_must_match_the_hashed_report(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pui-m8-inventory-binding-") as temporary:
            path = self.make_evidence(Path(temporary))
            inventory = json.loads(path.read_text("utf-8"))
            inventory["candidate"]["version"] = "0.3.0-rc.2"
            write_json(path, inventory)
            with self.assertRaisesRegex(migration.MigrationError, "candidate binding mismatch"):
                migration.validate_artifact_inventory(path)

    def test_command_records_nonzero_expected_result_and_scrubs_paths(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pui-m8-command-") as temporary:
            root = Path(temporary)
            artifacts = root / "artifacts"
            artifacts.mkdir()
            recorder = migration.CommandRecorder(artifacts, ((root, "$ROOT"),))
            command = recorder.run(
                "expected failure",
                [
                    sys.executable,
                    "-c",
                    "import os,sys; print(os.getcwd()); print('expected', file=sys.stderr); sys.exit(7)",
                ],
                cwd=root,
                expected_codes=(7,),
            )
            self.assertEqual(command.returncode, 7)
            record = json.loads((root / command.record_path).read_text("utf-8"))
            self.assertEqual(record["returnCode"], 7)
            self.assertNotIn(str(root), command.stdout)
            self.assertIn("$ROOT", command.stdout)
            self.assertEqual(
                record["stdout"]["sha256"],
                migration.sha256_file(root / record["stdout"]["path"]),
            )
            self.assertEqual(
                record["stderr"]["sha256"],
                migration.sha256_file(root / record["stderr"]["path"]),
            )

    def test_breaking_diagnostic_accepts_compiler_output_without_suggestions(self) -> None:
        migration.validate_breaking_api_diagnostic(
            "PopoverProps: Property 'trigger' does not exist.\n"
            "DrawerProps: Property 'onClose' does not exist."
        )

    def test_breaking_diagnostic_requires_every_reviewed_migration(self) -> None:
        with self.assertRaisesRegex(migration.MigrationError, "Drawer API break"):
            migration.validate_breaking_api_diagnostic(
                "PopoverProps: Property 'trigger' does not exist."
            )


class FilesystemBoundaryContracts(unittest.TestCase):
    def test_output_cannot_overlap_repository_or_candidate(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pui-m8-boundary-") as temporary:
            root = Path(temporary)
            repository = root / "repository"
            candidate = root / "candidate"
            repository.mkdir()
            candidate.mkdir()
            for output in (repository / "output", candidate / "output", root):
                with self.subTest(output=output), self.assertRaises(migration.MigrationError):
                    migration.normalized_new_output(
                        output,
                        repository=repository,
                        candidate=candidate,
                    )

    def test_project_snapshot_excludes_generated_dependencies_and_builds(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pui-m8-snapshot-") as temporary:
            root = Path(temporary)
            (root / "src").mkdir()
            (root / "src/App.tsx").write_text("export {};\n", encoding="utf-8")
            (root / "node_modules/pkg").mkdir(parents=True)
            (root / "node_modules/pkg/index.js").write_text("generated\n", encoding="utf-8")
            (root / "dist").mkdir()
            (root / "dist/index.js").write_text("built\n", encoding="utf-8")
            files = migration.project_file_map(root)
            self.assertEqual(set(files), {"src/App.tsx"})

    def test_materialized_candidate_uses_only_the_verified_file_map(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pui-m8-candidate-snapshot-") as temporary:
            root = Path(temporary) / "candidate"
            expected = {
                "SKILL.md": b"# Frozen candidate\n",
                "scripts/install_personal_ui.py": b"print('verified')\n",
            }
            actual = migration.materialize_verified_file_map(
                expected,
                root,
                label="test candidate",
            )
            self.assertEqual(actual, expected)

            (root / "scripts/install_personal_ui.py").write_bytes(b"print('changed')\n")
            with self.assertRaisesRegex(migration.MigrationError, "verified bytes"):
                migration.verify_materialized_file_map(
                    root,
                    expected,
                    label="test candidate",
                )


if __name__ == "__main__":
    unittest.main()
