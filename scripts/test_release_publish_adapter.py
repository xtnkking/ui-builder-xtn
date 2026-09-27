#!/usr/bin/env python3
"""Focused contracts for the explicit M8 publication adapter."""

from __future__ import annotations

import json
import contextlib
import io
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import release_personal_ui as release
import release_publish_adapter as publisher
import test_release_personal_ui as fixtures


def run_git(root: Path, *args: str) -> str:
    process = subprocess.run(
        ["git", *args], cwd=root, capture_output=True, check=True, text=True
    )
    return process.stdout.strip()


def prepare_real_candidate(temporary: str) -> tuple[Path, Path, dict[str, object]]:
    root = Path(temporary) / "repository"
    root.mkdir()
    fixtures.write_fixture(root, fixtures.fixture_files(licensed=True))
    run_git(root, "init", "-b", "main")
    run_git(root, "config", "user.name", "Release Contract")
    run_git(root, "config", "user.email", "release-contract@example.invalid")
    run_git(root, "remote", "add", "origin", "https://github.com/example/ui-builder-xtn.git")
    run_git(root, "add", "--all")
    run_git(root, "commit", "-m", "fixture baseline")
    candidate = Path(temporary) / "candidate"
    plan = release.prepare_release(
        root,
        candidate,
        candidate_version="0.3.0-rc.1",
        source_mode="commit",
        source_ref="HEAD",
        existing_versions=[],
        verification_commands=(),
    )
    release.verify_release(candidate, command_runner=lambda _argv, _cwd: 0)
    return root, candidate, plan


def record_step(candidate: Path, step: str, result: dict[str, object]) -> None:
    path = candidate / release.JOURNAL_NAME
    journal = json.loads(path.read_text("utf-8"))
    journal["status"] = "publishing"
    journal["steps"][step] = {
        "status": "complete",
        "attempt": 1,
        "result": result,
    }
    path.write_bytes(release.pretty_json_bytes(journal))


class ResultAdapter:
    def __init__(self) -> None:
        self.calls: list[str] = []

    def execute(
        self, step: str, _plan: object, _candidate: Path
    ) -> dict[str, object]:
        self.calls.append(step)
        return {"step": step, "releaseCommit": "c" * 40}


class JournalContracts(unittest.TestCase):
    def test_adapter_results_are_recorded_and_sensitive_keys_are_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary) / "repo"
            root.mkdir()
            output = Path(temporary) / "candidate"
            files = fixtures.fixture_files(licensed=True)
            fixtures.write_fixture(root, files)
            plan = release.prepare_release(
                root,
                output,
                candidate_version="0.3.0-rc.1",
                source_snapshot=fixtures.snapshot(files, publishable_source=True),
                existing_versions=[],
                verification_commands=(),
            )
            release.verify_release(output, command_runner=lambda _argv, _cwd: 0)
            m8 = Path(temporary) / "m8.json"
            ci = Path(temporary) / "ci.json"
            fixtures.write_evidence(m8, plan, "m8-acceptance")
            fixtures.write_evidence(ci, plan, "hosted-ci")
            adapter = ResultAdapter()
            with mock.patch.object(release, "_git", return_value=""):
                journal = release.publish_with_adapter(
                    output,
                    authorization=str(plan["planDigest"]),
                    m8_evidence=m8,
                    ci_evidence=ci,
                    adapter=adapter,
                    repository_root=root,
                )
            self.assertEqual(journal["status"], "published")
            for step in release.PUBLISH_STEPS:
                state = journal["steps"][step]
                self.assertEqual(state["status"], "complete")
                self.assertEqual(state["attempt"], 1)
                self.assertEqual(state["result"]["step"], step)
            with self.assertRaises(release.ReleaseError):
                release._journal_step_result({"accessToken": "must-not-be-recorded"})

    def test_cli_requires_the_explicit_execute_switch(self) -> None:
        parser = release._parser()
        default = parser.parse_args(["publish", "--candidate", "candidate"])
        explicit = parser.parse_args(
            ["publish", "--candidate", "candidate", "--execute"]
        )
        self.assertFalse(default.execute)
        self.assertTrue(explicit.execute)
        with contextlib.redirect_stderr(io.StringIO()):
            with self.assertRaises(SystemExit):
                parser.parse_args(
                    [
                        "publish",
                        "--candidate",
                        "candidate",
                        "--execute",
                        "--dry-run",
                    ]
                )


class GitAndTagContracts(unittest.TestCase):
    def test_freeze_uses_the_verified_candidate_and_tag_is_immutable(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root, candidate, plan = prepare_real_candidate(temporary)
            adapter = publisher.GitHubPublishAdapter(repository_root=root)
            result = adapter.execute("freeze-release-commit", plan, candidate)
            commit = result["releaseCommit"]
            self.assertEqual(run_git(root, "rev-parse", "HEAD"), commit)
            self.assertEqual(
                release.digest_file_map(release.collect_worktree_files(root)),
                plan["candidateContentDigest"],
            )
            self.assertIn(
                f"{publisher.PLAN_MARKER_PREFIX}{plan['planDigest']}",
                run_git(root, "show", "-s", "--format=%B", str(commit)),
            )
            record_step(candidate, "freeze-release-commit", dict(result))
            tag_result = adapter.execute("create-immutable-tag", plan, candidate)
            self.assertEqual(tag_result["tag"], "v0.3.0-rc.1")
            self.assertEqual(
                run_git(root, "rev-parse", "v0.3.0-rc.1^{}"), commit
            )
            self.assertEqual(
                adapter.execute("create-immutable-tag", plan, candidate), tag_result
            )

    def test_existing_tag_is_never_moved_or_deleted(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root, candidate, plan = prepare_real_candidate(temporary)
            source = run_git(root, "rev-parse", "HEAD")
            adapter = publisher.GitHubPublishAdapter(repository_root=root)
            freeze = adapter.execute("freeze-release-commit", plan, candidate)
            record_step(candidate, "freeze-release-commit", dict(freeze))
            run_git(root, "tag", "-a", "v0.3.0-rc.1", source, "-m", "unrelated")
            with self.assertRaisesRegex(release.ReleaseError, "tag-conflict"):
                adapter.execute("create-immutable-tag", plan, candidate)
            self.assertEqual(
                run_git(root, "rev-parse", "v0.3.0-rc.1^{}"), source
            )

    def test_remote_tag_must_be_the_exact_owned_annotated_tag(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root, candidate, plan = prepare_real_candidate(temporary)
            adapter = publisher.GitHubPublishAdapter(repository_root=root)
            freeze = adapter.execute("freeze-release-commit", plan, candidate)
            record_step(candidate, "freeze-release-commit", dict(freeze))
            tag = adapter.execute("create-immutable-tag", plan, candidate)
            record_step(candidate, "create-immutable-tag", dict(tag))
            commit = str(freeze["releaseCommit"])
            with (
                mock.patch.object(
                    adapter,
                    "_remote_refs",
                    return_value=(commit, commit, commit),
                ),
                mock.patch.object(adapter, "_git", wraps=adapter._git) as git,
            ):
                with self.assertRaisesRegex(
                    release.ReleaseError, "public-tag-conflict"
                ):
                    adapter.execute("push-release-source-and-tag", plan, candidate)
            self.assertFalse(
                any(call.args and call.args[0] == "push" for call in git.call_args_list)
            )


class GeneratedCopyContracts(unittest.TestCase):
    def test_sync_is_explicit_idempotent_and_preserves_unmanaged_files(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root, candidate, plan = prepare_real_candidate(temporary)
            target = Path(temporary).resolve() / "installed" / "ui-builder-xtn"
            target.mkdir(parents=True)
            (target / "user-note.txt").write_text("preserve me", encoding="utf-8")
            adapter = publisher.GitHubPublishAdapter(
                repository_root=root,
                generated_copy_targets=(target,),
            )
            freeze = adapter.execute("freeze-release-commit", plan, candidate)
            record_step(candidate, "freeze-release-commit", dict(freeze))
            first = adapter.execute("sync-explicit-generated-copies", plan, candidate)
            second = adapter.execute("sync-explicit-generated-copies", plan, candidate)
            self.assertEqual(first, second)
            self.assertEqual(
                (target / "user-note.txt").read_text("utf-8"), "preserve me"
            )
            manifest = json.loads(
                (target / publisher.GENERATED_COPY_MANIFEST).read_text("utf-8")
            )
            self.assertEqual(manifest["planDigest"], plan["planDigest"])
            self.assertEqual(manifest["releaseCommit"], freeze["releaseCommit"])
            self.assertEqual(
                len(manifest["managedFiles"]), len(plan["candidateFiles"])
            )

    def test_modified_managed_file_blocks_every_target_before_writes(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root, candidate, plan = prepare_real_candidate(temporary)
            first_target = Path(temporary).resolve() / "copy-a"
            second_target = Path(temporary).resolve() / "copy-b"
            adapter = publisher.GitHubPublishAdapter(
                repository_root=root,
                generated_copy_targets=(first_target,),
            )
            freeze = adapter.execute("freeze-release-commit", plan, candidate)
            record_step(candidate, "freeze-release-commit", dict(freeze))
            adapter.execute("sync-explicit-generated-copies", plan, candidate)
            (first_target / "README.md").write_text("local edit", encoding="utf-8")
            guarded = publisher.GitHubPublishAdapter(
                repository_root=root,
                generated_copy_targets=(first_target, second_target),
            )
            with self.assertRaisesRegex(release.ReleaseError, "managed-file-modified"):
                guarded.execute("sync-explicit-generated-copies", plan, candidate)
            self.assertFalse(second_target.exists())

    def test_unmanaged_candidate_path_blocks_every_target_before_writes(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root, candidate, plan = prepare_real_candidate(temporary)
            first_target = Path(temporary).resolve() / "copy-a"
            second_target = Path(temporary).resolve() / "copy-b"
            first_target.mkdir()
            user_content = b"caller-owned readme\n"
            (first_target / "README.md").write_bytes(user_content)
            adapter = publisher.GitHubPublishAdapter(
                repository_root=root,
                generated_copy_targets=(first_target, second_target),
            )
            freeze = adapter.execute("freeze-release-commit", plan, candidate)
            record_step(candidate, "freeze-release-commit", dict(freeze))
            with self.assertRaisesRegex(
                release.ReleaseError, "unmanaged-file-conflict:README.md"
            ):
                adapter.execute("sync-explicit-generated-copies", plan, candidate)
            self.assertEqual((first_target / "README.md").read_bytes(), user_content)
            self.assertFalse(second_target.exists())

    def test_relative_or_overlapping_targets_are_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root, candidate, plan = prepare_real_candidate(temporary)
            relative = publisher.GitHubPublishAdapter(
                repository_root=root,
                generated_copy_targets=(Path("relative-copy"),),
            )
            blockers = relative.preflight(plan, candidate, release.load_candidate(candidate)[1])
            self.assertIn("publisher-generated-target-must-be-absolute", blockers)
            overlapping = publisher.GitHubPublishAdapter(
                repository_root=root,
                generated_copy_targets=(root / "backup",),
            )
            blockers = overlapping.preflight(
                plan, candidate, release.load_candidate(candidate)[1]
            )
            self.assertIn("publisher-generated-target-overlaps-release-data", blockers)


class CredentialContracts(unittest.TestCase):
    def test_credential_is_process_memory_only_and_not_retrieved_twice(self) -> None:
        adapter = publisher.GitHubPublishAdapter(
            repository_root=Path.cwd().resolve(), repository="example/repository"
        )
        response = (
            b"protocol=https\nhost=github.com\nusername=x-access-token\n"
            b"password=secret-value\n\n"
        )
        with mock.patch.object(adapter, "_git", return_value=response) as git:
            self.assertEqual(adapter._github_token(), "secret-value")
            self.assertEqual(adapter._github_token(), "secret-value")
        self.assertEqual(git.call_count, 1)
        self.assertNotIn("secret-value", repr(adapter))


class GitHubContracts(unittest.TestCase):
    def test_draft_release_is_plan_owned_and_idempotent(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root, candidate, plan = prepare_real_candidate(temporary)
            adapter = publisher.GitHubPublishAdapter(
                repository_root=root, repository="example/ui-builder-xtn"
            )
            marker = f"<!-- {publisher.PLAN_MARKER_PREFIX}{plan['planDigest']} -->"
            created = {
                "id": 42,
                "tag_name": "v0.3.0-rc.1",
                "body": f"{marker}\n\nnotes",
                "draft": True,
                "html_url": "https://github.com/example/ui-builder-xtn/releases/tag/v0.3.0-rc.1",
            }
            with (
                mock.patch.object(adapter, "_release_by_tag", return_value=None),
                mock.patch.object(adapter, "_release_commit", return_value="c" * 40),
                mock.patch.object(adapter, "_api_json", return_value=created) as api,
            ):
                result = adapter._create_draft_github_release(plan, candidate)
            self.assertEqual(result["releaseId"], 42)
            self.assertTrue(result["draft"])
            payload = api.call_args.kwargs["payload"]
            self.assertEqual(payload["target_commitish"], "c" * 40)
            self.assertIn(str(plan["planDigest"]), payload["body"])

            foreign = dict(created, body="unrelated release")
            with mock.patch.object(adapter, "_release_by_tag", return_value=foreign):
                with self.assertRaisesRegex(release.ReleaseError, "release-conflict"):
                    adapter._create_draft_github_release(plan, candidate)

    def test_uploaded_assets_are_downloaded_and_hashed_before_completion(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root, candidate, plan = prepare_real_candidate(temporary)
            adapter = publisher.GitHubPublishAdapter(
                repository_root=root, repository="example/ui-builder-xtn"
            )
            record_step(
                candidate,
                "create-draft-github-release",
                {"releaseId": 42, "draft": True},
            )
            expected = adapter._artifact_files(plan, candidate)
            assets = [
                {"id": index + 1, "name": name}
                for index, name in enumerate(sorted(expected))
            ]
            content_by_id = {
                index + 1: expected[name]
                for index, name in enumerate(sorted(expected))
            }
            with (
                mock.patch.object(adapter, "_release_assets", side_effect=[[], assets]),
                mock.patch.object(adapter, "_http", return_value=(201, b"{}")) as http,
                mock.patch.object(
                    adapter,
                    "_download_asset",
                    side_effect=lambda asset_id: content_by_id[asset_id],
                ),
            ):
                result = adapter._upload_artifacts(plan, candidate)
            self.assertEqual(http.call_count, 4)
            self.assertEqual(len(result["assetHashes"]), 4)
            self.assertEqual(
                {item["name"]: item["sha256"] for item in result["assetHashes"]},
                {
                    name: release.sha256_bytes(content)
                    for name, content in expected.items()
                },
            )


if __name__ == "__main__":
    unittest.main()
