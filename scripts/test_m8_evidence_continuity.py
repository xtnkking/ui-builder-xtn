#!/usr/bin/env python3
"""Focused synthetic contracts for the independent M8 continuity proof."""

from __future__ import annotations

import copy
import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import m8_evidence_continuity as continuity
import release_personal_ui as release
import test_release_personal_ui as release_fixture
import test_validate_m8_evidence as m8_fixture


ALLOWED_PATHS = {
    "scripts/assemble_m8_acceptance.py",
    "scripts/test_assemble_m8_acceptance.py",
    "CHANGELOG.md",
}


class ContinuityContracts(unittest.TestCase):
    """Use genuine temporary plans and archives; never run fixture commands."""

    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory(prefix="pui-m8-continuity-")
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.repository = self.root / "repository"
        self.repository.mkdir()
        self.sequence = 0
        self.origin_commit = "1" * 40
        self.target_commit = "2" * 40
        self.origin_files = release_fixture.fixture_files(licensed=True)
        self.origin_files["scripts/assemble_m8_acceptance.py"] = b"# Original fixture assembler.\n"
        self.origin_files["scripts/test_assemble_m8_acceptance.py"] = b"# Original fixture test.\n"
        self.target_files = dict(self.origin_files)
        self.target_files["scripts/assemble_m8_acceptance.py"] += b"# Fixture diagnostic fix.\n"
        self.target_files["scripts/test_assemble_m8_acceptance.py"] += b"# Fixture regression.\n"
        self.target_files["CHANGELOG.md"] = self.target_files["CHANGELOG.md"].replace(
            b"- Local hardening changes.\n",
            b"- Local hardening changes.\n- Fixture assembler diagnostics corrected.\n",
        )
        self.sources: dict[str, release.SourceSnapshot] = {}
        self.origin_candidate, self.origin_plan = self._prepare_candidate(
            self.origin_files,
            commit=self.origin_commit,
            tree="a" * 40,
            epoch=1_800_000_001,
            version="0.3.0-rc.1",
        )
        self.target_candidate, self.target_plan = self._prepare_candidate(
            self.target_files,
            commit=self.target_commit,
            tree="b" * 40,
            epoch=1_800_000_003,
            version="0.3.0-rc.2",
        )

        # Only immutable Git reads are synthetic. All release contracts, plans,
        # verification journals, archives, and M8 evidence remain real fixtures.
        collect_patch = mock.patch.object(
            release, "collect_commit_files", side_effect=self._collect_commit_files
        )
        git_patch = mock.patch.object(release, "_git", side_effect=self._git_identity)
        collect_patch.start()
        git_patch.start()
        self.addCleanup(collect_patch.stop)
        self.addCleanup(git_patch.stop)

        acceptance_root = self.root / "origin-m8"
        acceptance_root.mkdir()
        self.origin_acceptance = acceptance_root / "m8-acceptance.json"
        archive = self.origin_plan["artifacts"]["archive"]
        source = self.origin_plan["source"]
        binding = {
            "version": self.origin_plan["candidateVersion"],
            "planDigest": self.origin_plan["planDigest"],
            "sourceCommit": source["commit"],
            "sourceContentDigest": source["contentDigest"],
            "sourceDateEpoch": source["sourceDateEpoch"],
            "candidateContentDigest": self.origin_plan["candidateContentDigest"],
            "archive": copy.deepcopy(archive),
        }
        evidence = m8_fixture.valid_evidence(
            acceptance_root,
            candidate_binding=binding,
            archive_bytes=self.origin_candidate.joinpath(*Path(archive["path"]).parts).read_bytes(),
        )
        self.origin_acceptance.write_bytes(release.pretty_json_bytes(evidence))
        self.maintenance_review = self.root / "maintenance-review.md"
        self.maintenance_review.write_bytes(
            b"# Synthetic fixture maintenance review\n\n"
            b"Only the assembler, its regression fixture, and CHANGELOG differ.\n"
            b"Consumer evidence remains bound to the original immutable source.\n"
            b"This fixture review grants no publication or hosted CI inheritance.\n"
        )

    def _prepare_candidate(
        self,
        files: dict[str, bytes],
        *,
        commit: str,
        tree: str,
        epoch: int,
        version: str,
        verification_commands: object = release.DEFAULT_VERIFICATION_COMMANDS,
        verified: bool = True,
    ) -> tuple[Path, dict[str, object]]:
        self.sequence += 1
        candidate = self.root / f"candidate-{self.sequence}"
        snapshot = release.SourceSnapshot(
            mode="commit",
            ref=commit,
            commit=commit,
            tree=tree,
            epoch=epoch,
            dirty=False,
            dirty_entries=(),
            files=dict(files),
        )
        self.sources[commit] = snapshot
        plan = release.prepare_release(
            self.repository,
            candidate,
            candidate_version=version,
            source_snapshot=snapshot,
            existing_versions=[],
            verification_commands=verification_commands,
        )
        if verified:
            release.verify_release(candidate, command_runner=lambda _argv, _cwd: 0)
        return candidate, plan

    def _collect_commit_files(self, repository: Path, commit: str) -> dict[str, bytes]:
        self.assertEqual(repository.resolve(), self.repository.resolve())
        return dict(self.sources[commit].files)

    def _git_identity(self, repository: Path, *args: str, **kwargs: object) -> str:
        self.assertEqual(repository.resolve(), self.repository.resolve())
        self.assertFalse(kwargs.get("binary", False))
        if len(args) == 2 and args[0] == "rev-parse" and args[1].endswith("^{tree}"):
            commit = args[1].removesuffix("^{tree}")
            return str(self.sources[commit].tree)
        if len(args) == 4 and args[:3] == ("show", "-s", "--format=%ct"):
            return str(self.sources[args[3]].epoch)
        raise AssertionError(f"Unexpected Git query in continuity fixture: {args!r}")

    def _new_target(
        self,
        files: dict[str, bytes] | None = None,
        *,
        verification_commands: object = release.DEFAULT_VERIFICATION_COMMANDS,
        verified: bool = True,
    ) -> None:
        self.target_candidate, self.target_plan = self._prepare_candidate(
            files if files is not None else self.target_files,
            commit=self.target_commit,
            tree="b" * 40,
            epoch=1_800_000_003,
            version="0.3.0-rc.2",
            verification_commands=verification_commands,
            verified=verified,
        )

    def _create(self, **overrides: object) -> tuple[Path, dict[str, object]]:
        self.sequence += 1
        output = self.root / f"continuity-{self.sequence}.json"
        arguments = {
            "repository": self.repository,
            "origin_candidate": self.origin_candidate,
            "target_candidate": self.target_candidate,
            "origin_acceptance": self.origin_acceptance,
            "maintenance_review": self.maintenance_review,
            "output": output,
        }
        arguments.update(overrides)
        result = continuity.create_continuity(**arguments)
        return Path(arguments["output"]), result

    def _assert_record_rejected(self, path: Path, record: dict[str, object]) -> None:
        path.write_bytes(release.pretty_json_bytes(record))
        self.assertFalse(
            continuity.validate_continuity_file(path, expected_plan=self.target_plan).accepted
        )

    def test_valid_continuity_preserves_origin(self) -> None:
        original_bytes = self.origin_acceptance.read_bytes()
        path, record = self._create()
        self.assertTrue(
            continuity.validate_continuity_file(path, expected_plan=self.target_plan).accepted
        )
        self.assertEqual(self.origin_acceptance.read_bytes(), original_bytes)
        self.assertEqual(record["kind"], "personal-ui-m8-evidence-continuity")
        self.assertEqual(record["schemaVersion"], 1)
        self.assertEqual(record["policy"], "assembler-only-v1")
        self.assertEqual(record["consumerRunsSourceCommit"], self.origin_commit)
        self.assertIs(record["hostedCIInherited"], False)
        self.assertEqual(
            record["reuseScope"],
            ["consumers", "migration", "quality", "origin-system-safari"],
        )
        self.assertEqual(record["candidate"]["sourceCommit"], self.target_commit)
        self.assertEqual(record["candidate"]["planDigest"], self.target_plan["planDigest"])
        self.assertEqual({entry["path"] for entry in record["sourceDelta"]}, ALLOWED_PATHS)
        self.assertEqual(
            record["sourceDelta"],
            continuity.compare_source_delta(self.origin_files, self.target_files),
        )
        self.assertIsNone(release._m8_release_evidence_blocker(path, plan=self.target_plan))

    def test_product_and_file_set_changes_rejected(self) -> None:
        for changed_path in (
            "assets/react-kit/src/personal-ui/index.ts",
            "scripts/release_personal_ui.py",
            "evaluation/m8/acceptance-rules.json",
        ):
            with self.subTest(path=changed_path):
                changed = dict(self.target_files)
                changed[changed_path] += b"\nunauthorized fixture change\n"
                with self.assertRaises(release.ReleaseError):
                    continuity.compare_source_delta(self.origin_files, changed)
        added = dict(self.target_files)
        added["scripts/extra-assembler-helper.py"] = b"# Added file.\n"
        removed = dict(self.target_files)
        removed.pop("scripts/test_assemble_m8_acceptance.py")
        for files in (added, removed):
            with self.subTest(file_set=sorted(files)):
                with self.assertRaises(release.ReleaseError):
                    continuity.compare_source_delta(self.origin_files, files)
        changed = dict(self.target_files)
        changed["README.md"] += b"Unrelated source change.\n"
        self._new_target(changed)
        with self.assertRaises(release.ReleaseError):
            self._create()

    def test_metadata_changes_rejected(self) -> None:
        for changed_path in (
            "assets/react-kit/package-lock.json",
            "assets/react-kit/component-manifest.json",
            "assets/react-kit/api-version-policy.json",
            "references/support-matrix.json",
            "references/support-fixtures.json",
            "LICENSE",
        ):
            with self.subTest(path=changed_path):
                changed = dict(self.target_files)
                changed[changed_path] += b"\n"
                with self.assertRaises(release.ReleaseError):
                    continuity.compare_source_delta(self.origin_files, changed)
        changed = dict(self.target_files)
        changed["references/support-fixtures.json"] += b"\n"
        self._new_target(changed)
        with self.assertRaises(release.ReleaseError):
            self._create()
        # A declared immutable tree or epoch must also match its Git identity.
        self._new_target()
        original = self.sources[self.target_commit]
        self.sources[self.target_commit] = release.SourceSnapshot(
            mode=original.mode,
            ref=original.ref,
            commit=original.commit,
            tree="c" * 40,
            epoch=original.epoch,
            dirty=original.dirty,
            dirty_entries=original.dirty_entries,
            files=original.files,
        )
        with self.assertRaises(release.ReleaseError):
            self._create()

    def test_artifact_and_binding_tampering_rejected(self) -> None:
        path, record = self._create()
        tampered = copy.deepcopy(record)
        tampered["candidate"]["planDigest"] = "0" * 64
        self._assert_record_rejected(path, tampered)
        tampered = copy.deepcopy(record)
        tampered["consumerRunsSourceCommit"] = self.target_commit
        self._assert_record_rejected(path, tampered)
        tampered = copy.deepcopy(record)
        tampered["sourceDelta"][0]["after"]["sha256"] = "0" * 64
        self._assert_record_rejected(path, tampered)
        tampered = copy.deepcopy(record)
        tampered["originAcceptance"]["sha256"] = "0" * 64
        self._assert_record_rejected(path, tampered)
        wrong_plan = copy.deepcopy(self.target_plan)
        wrong_plan["source"]["commit"] = "3" * 40
        wrong_plan = release.attach_plan_digest(wrong_plan)
        path.write_bytes(release.pretty_json_bytes(record))
        self.assertFalse(
            continuity.validate_continuity_file(path, expected_plan=wrong_plan).accepted
        )
        archive_path = path.parent.joinpath(*Path(record["target"]["archive"]["path"]).parts)
        original_archive = archive_path.read_bytes()
        archive_path.write_bytes(original_archive + b"tampered trailing bytes")
        self.assertFalse(
            continuity.validate_continuity_file(path, expected_plan=self.target_plan).accepted
        )
        archive_path.write_bytes(original_archive)
        acceptance = json.loads(self.origin_acceptance.read_text(encoding="utf-8"))
        acceptance["result"] = "failed"
        self.origin_acceptance.write_bytes(release.pretty_json_bytes(acceptance))
        with self.assertRaises(release.ReleaseError):
            self._create()

    def test_formal_verification_required(self) -> None:
        self._new_target(verified=False)
        with self.assertRaises(release.ReleaseError):
            self._create()
        self._new_target(verification_commands=())
        with self.assertRaises(release.ReleaseError):
            self._create()
        self._new_target()
        journal_path = self.target_candidate / release.JOURNAL_NAME
        journal = json.loads(journal_path.read_text(encoding="utf-8"))
        journal["steps"]["verify"]["commands"][0]["exitCode"] = 1
        journal_path.write_bytes(release.pretty_json_bytes(journal))
        with self.assertRaises(release.ReleaseError):
            self._create()

        self._new_target()
        path, record = self._create()
        journal_descriptor = record["target"]["journal"]
        retained_journal = json.loads(
            self.root.joinpath(*Path(journal_descriptor["path"]).parts).read_text("utf-8")
        )
        retained_journal["steps"]["verify"] = []
        m8_fixture.rewrite_artifact(self.root, journal_descriptor, retained_journal)
        self._assert_record_rejected(path, record)
        self.assertIsNotNone(release._m8_release_evidence_blocker(path, plan=self.target_plan))

    def test_chained_origin_rejected(self) -> None:
        path, _record = self._create()
        with self.assertRaises(release.ReleaseError):
            self._create(origin_acceptance=path)

    def test_stable_uses_reviewed_rc(self) -> None:
        path, record = self._create()
        stable_candidate = self.root / "candidate-stable"
        stable_plan = release.prepare_release(
            self.repository,
            stable_candidate,
            candidate_version="0.3.0",
            source_snapshot=self.sources[self.target_commit],
            existing_versions=[],
            promotion_from=str(self.target_candidate),
        )
        self.assertEqual(stable_plan["promotion"]["reviewedPlan"], self.target_plan)
        self.assertIsNone(release._m8_release_evidence_blocker(path, plan=stable_plan))
        self.assertEqual(record["candidate"]["version"], "0.3.0-rc.2")
        self.assertEqual(record["candidate"]["planDigest"], self.target_plan["planDigest"])
        tampered = copy.deepcopy(stable_plan)
        tampered["promotion"]["fromVersion"] = "0.3.0-rc.1"
        self.assertIsNotNone(release._m8_release_evidence_blocker(path, plan=tampered))
        tampered = copy.deepcopy(record)
        tampered["candidate"]["planDigest"] = self.origin_plan["planDigest"]
        path.write_bytes(release.pretty_json_bytes(tampered))
        self.assertIsNotNone(release._m8_release_evidence_blocker(path, plan=stable_plan))

    def test_old_hosted_ci_not_inherited(self) -> None:
        path, record = self._create()
        old_ci = self.root / "origin-hosted-ci.json"
        release_fixture.write_hosted_evidence(old_ci, self.origin_plan)
        self.assertIsNone(release._m8_release_evidence_blocker(path, plan=self.target_plan))
        self.assertIsNotNone(
            release._hosted_release_evidence_blocker(
                old_ci,
                plan=self.target_plan,
                candidate=self.target_candidate,
            )
        )
        tampered = copy.deepcopy(record)
        tampered["hostedCIInherited"] = True
        self._assert_record_rejected(path, tampered)


if __name__ == "__main__":
    unittest.main()
