#!/usr/bin/env python3
"""Focused contracts for the local-only Personal UI release orchestrator."""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import release_personal_ui as release
import test_validate_m8_evidence as m8_fixtures
import validate_hosted_ci_evidence as hosted_validator
import validate_m8_evidence as m8_validator


def json_bytes(value: object) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def fixture_files(*, licensed: bool) -> dict[str, bytes]:
    source = b'export const Button = "button";\n'
    package: dict[str, object] = {
        "name": "personal-ui-react-starter",
        "private": True,
        "version": "0.2.19",
        "devDependencies": {"fixture-dependency": "1.2.3"},
    }
    skill_frontmatter = "---\nname: ui-builder-xtn\ndescription: fixture"
    files: dict[str, bytes] = {
        ".gitattributes": b"* text=auto eol=lf\n",
        "README.md": b"# Fixture\n",
        "SKILL.md": b"",
        "CHANGELOG.md": (
            b"# Changelog\n\n## [Unreleased]\n\n"
            b"- Local hardening changes remain unreleased.\n\n"
            b"## 0.2.19 - 2026-09-17\n\n- Baseline.\n"
        ),
        "references/release-process.md": b"# Release Process\n",
        "references/support-fixtures.json": (
            release.SKILL_ROOT / "references" / "support-fixtures.json"
        ).read_bytes(),
        "references/support-matrix.json": (
            release.SKILL_ROOT / "references" / "support-matrix.json"
        ).read_bytes(),
        "references/v0.3.0-migrations.md": (
            "# Migrations\n\n"
            + "\n\n".join(release.REQUIRED_MIGRATION_HEADINGS)
            + "\n"
        ).encode("utf-8"),
        "assets/react-kit/package.json": b"",
        "assets/react-kit/package-lock.json": json_bytes(
            {
                "name": "personal-ui-react-starter",
                "version": "0.2.19",
                "lockfileVersion": 3,
                "packages": {
                    "": {
                        "name": "personal-ui-react-starter",
                        "version": "0.2.19",
                        "devDependencies": {"fixture-dependency": "1.2.3"},
                    },
                    "node_modules/fixture-dependency": {
                        "version": "1.2.3",
                        "resolved": "https://example.invalid/fixture-dependency-1.2.3.tgz",
                        "dev": True,
                        "license": "MIT",
                    },
                },
            }
        ),
        "assets/react-kit/registry.json": json_bytes(
            {"name": "personal-ui", "version": "0.2.19"}
        ),
        "assets/react-kit/component-manifest.json": json_bytes(
            {
                "schemaVersion": 2,
                "kitVersion": "0.2.19",
                "sourceIntegrity": {"index.ts": release.sha256_bytes(source)},
            }
        ),
        "assets/react-kit/api-version-policy.json": json_bytes(
            {
                "schemaVersion": 1,
                "baselineVersion": "0.2.19",
                "releaseTarget": "0.3.0",
            }
        ),
        "assets/react-kit/etc/personal-ui.api-compatibility.json": json_bytes(
            {
                "schemaVersion": 1,
                "classification": "breaking",
                "current": {"version": "0.2.19"},
                "versionPolicy": {
                    "releaseTarget": "0.3.0",
                    "packageVersion": "0.2.19",
                    "valid": True,
                },
            }
        ),
        "assets/react-kit/component-coverage.json": json_bytes(
            {"schemaVersion": 3, "kitVersion": "0.2.19"}
        ),
        "assets/react-kit/etc/personal-ui.module-ownership.json": json_bytes(
            {"schemaVersion": 1, "kitVersion": "0.2.19", "modules": []}
        ),
        "references/component-api.md": (
            b"# Personal UI Component API\n\nGenerated for Personal UI 0.2.19.\n"
        ),
        "references/component-catalog.md": (
            b"# Component Catalog\n\n- Version: `0.2.19`\n"
        ),
        "assets/react-kit/src/personal-ui/index.ts": source,
        "scripts/release_personal_ui.py": b"# fixture tool\n",
        "evaluation/m8/scenarios.json": (
            release.SKILL_ROOT / "evaluation" / "m8" / "scenarios.json"
        ).read_bytes(),
        "evaluation/m8/acceptance-rules.json": (
            release.SKILL_ROOT / "evaluation" / "m8" / "acceptance-rules.json"
        ).read_bytes(),
    }
    for request in (release.SKILL_ROOT / "evaluation" / "m8" / "requests").glob("*.md"):
        files[f"evaluation/m8/requests/{request.name}"] = request.read_bytes()
    if licensed:
        package["license"] = "MIT"
        skill_frontmatter += "\nlicense: MIT"
        lock = json.loads(files["assets/react-kit/package-lock.json"])
        lock["packages"][""]["license"] = "MIT"
        files["assets/react-kit/package-lock.json"] = json_bytes(lock)
        files["LICENSE"] = release.EXPECTED_LICENSE_TEXT.encode("utf-8")
        files[release.STRUCTURED_NOTICE_FILE] = json_bytes(
            {
                "schemaVersion": 1,
                "kind": "personal-ui-third-party-notices",
                "generatedFrom": "assets/react-kit/package-lock.json",
                "dependencyCount": 1,
                "items": [
                    {
                        "name": "fixture-dependency",
                        "version": "1.2.3",
                        "license": "MIT",
                        "source": "https://example.invalid/fixture-dependency-1.2.3.tgz",
                        "resolved": "https://example.invalid/fixture-dependency-1.2.3.tgz",
                        "dependencyType": "dev-direct",
                        "optional": False,
                    }
                ],
            }
        )
    files["SKILL.md"] = (skill_frontmatter + "\n---\n\n# Fixture\n").encode("utf-8")
    files["assets/react-kit/package.json"] = json_bytes(package)
    return files


def snapshot(files: dict[str, bytes], *, publishable_source: bool) -> release.SourceSnapshot:
    return release.SourceSnapshot(
        mode="commit" if publishable_source else "worktree",
        ref="fixture",
        commit="a" * 40,
        tree="b" * 40 if publishable_source else None,
        epoch=1_800_000_001,
        dirty=not publishable_source,
        dirty_entries=(" M fixture",) if not publishable_source else (),
        files=files,
    )


def write_fixture(root: Path, files: dict[str, bytes]) -> None:
    for relative, content in files.items():
        path = root.joinpath(*Path(relative).parts)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)


def write_evidence(path: Path, plan: dict[str, object], evidence_type: str) -> None:
    source = plan["source"]
    artifacts = plan["artifacts"]
    assert isinstance(source, dict)
    assert isinstance(artifacts, dict)
    archive = artifacts["archive"]
    assert isinstance(archive, dict)
    if evidence_type == "hosted-ci":
        write_hosted_evidence(path, plan)
        return
    if evidence_type == "m8-acceptance":
        candidate_root = path.parent / "candidate"
        archive_path = candidate_root.joinpath(*Path(str(archive["path"])).parts)
        candidate_binding = {
            "version": plan["candidateVersion"],
            "planDigest": plan["planDigest"],
            "sourceCommit": source["commit"],
            "sourceContentDigest": source["contentDigest"],
            "sourceDateEpoch": source["sourceDateEpoch"],
            "candidateContentDigest": plan["candidateContentDigest"],
            "archive": {
                "path": archive["path"],
                "size": archive["size"],
                "sha256": archive["sha256"],
            },
        }
        evidence = m8_fixtures.valid_evidence(
            path.parent,
            candidate_binding=candidate_binding,
            archive_bytes=archive_path.read_bytes(),
        )
        path.write_bytes(json_bytes(evidence))
        return
    evidence: dict[str, object] = {
        "schemaVersion": 1,
        "kind": "personal-ui-release-evidence",
        "type": evidence_type,
        "planDigest": plan["planDigest"],
        "sourceCommit": source["commit"],
        "archiveSha256": archive["sha256"],
        "result": "passed",
    }
    path.write_bytes(json_bytes(evidence))


def write_hosted_evidence(path: Path, plan: dict[str, object]) -> None:
    source = plan["source"]
    artifacts = plan["artifacts"]
    assert isinstance(source, dict)
    assert isinstance(artifacts, dict)
    archive = artifacts["archive"]
    assert isinstance(archive, dict)
    catalog = json.loads(
        (release.SKILL_ROOT / "references" / "support-fixtures.json").read_text(
            encoding="utf-8"
        )
    )
    run_id = 123456789
    common = {
        "sourceCommit": source["commit"],
        "repository": "xtnkking/ui-builder-xtn",
        "runId": run_id,
        "runAttempt": 1,
        "workflowRef": "xtnkking/ui-builder-xtn/.github/workflows/quality.yml@refs/heads/main",
        "event": "push",
        "runUrl": f"https://github.com/xtnkking/ui-builder-xtn/actions/runs/{run_id}",
        "runner": {"hosted": True, "os": "Linux", "architecture": "X64"},
        "result": "passed",
    }
    records: list[tuple[str, str, dict[str, object]]] = []
    for fixture in catalog["fixtures"]:
        environment = fixture["environment"]
        records.append(
            (
                "fixture",
                fixture["id"],
                {
                    "schemaVersion": 1,
                    "kind": hosted_validator.FIXTURE_KIND,
                    **common,
                    "jobId": fixture["ci"]["job"],
                    "fixtureId": fixture["id"],
                    "requiredOperations": fixture["operations"],
                    "executedOperations": fixture["operations"],
                    "actualEnvironment": {
                        "node": environment["node"],
                        "python": "3.13.7",
                        "packageManager": environment["packageManager"],
                        "react": environment["react"],
                        "reactDom": environment["reactDom"],
                        "typescript": environment["typescript"],
                        "framework": environment["framework"],
                    },
                    "fixtureReportSha256": "d" * 64,
                },
            )
        )
    records.extend(
        [
            (
                "browser",
                "browser-quality",
                {
                    "schemaVersion": 1,
                    "kind": hosted_validator.BROWSER_KIND,
                    **common,
                    "jobId": "browser-quality",
                    "executedOperations": hosted_validator.REQUIRED_BROWSER_OPERATIONS,
                    "actualTools": {
                        "node": "22.12.0",
                        "npm": "10.9.3",
                        "python": "3.13.7",
                        "playwright": "1.55.1",
                    },
                    "browsers": [
                        {"project": project, "version": "1.0", "realSafari": False}
                        for project in ("chromium", "firefox", "webkit")
                    ],
                },
            ),
            (
                "safari",
                "safari-quality",
                {
                    "schemaVersion": 1,
                    "kind": hosted_validator.SAFARI_KIND,
                    **common,
                    "jobId": "safari-quality",
                    "runner": {
                        "hosted": True,
                        "os": "macOS",
                        "architecture": "ARM64",
                    },
                    "safari": {
                        "product": "Safari",
                        "browserName": "safari",
                        "version": "18.6",
                        "majorVersion": 18,
                        "userAgent": "Mozilla/5.0 Version/18.6 Safari/605.1.15",
                        "driver": "safaridriver",
                        "realSafari": True,
                    },
                    "checks": {
                        "documentReady": "passed",
                        "rootRendered": "passed",
                        "componentInteraction": "passed",
                    },
                    "actualTools": {
                        "node": "22.12.0",
                        "npm": "10.9.3",
                        "python": "3.13.7",
                        "safaridriver": "Included with Safari 18.6",
                    },
                },
            ),
        ]
    )
    artifact_root = path.parent / "artifacts"
    artifact_root.mkdir(parents=True, exist_ok=True)
    descriptors: list[dict[str, object]] = []
    for role, artifact_id, record in records:
        relative = f"artifacts/{role}-{artifact_id}.json"
        content = json_bytes(record)
        (path.parent / relative).write_bytes(content)
        descriptors.append(
            {
                "role": role,
                "id": artifact_id,
                "path": relative,
                "size": len(content),
                "sha256": release.sha256_bytes(content),
            }
        )
    path.write_bytes(
        json_bytes(
            {
                "schemaVersion": 1,
                "kind": "personal-ui-release-evidence",
                "type": "hosted-ci",
                "planDigest": plan["planDigest"],
                "sourceCommit": source["commit"],
                "archiveSha256": archive["sha256"],
                "workflow": {
                    "repository": "xtnkking/ui-builder-xtn",
                    "ref": common["workflowRef"],
                    "runId": run_id,
                    "runAttempt": 1,
                    "runUrl": common["runUrl"],
                    "event": "push",
                    "sourceCommit": source["commit"],
                },
                "artifacts": descriptors,
                "result": "passed",
            }
        )
    )


class SemVerContracts(unittest.TestCase):
    def test_rc_is_allowed_but_stable_promotion_fails_closed(self) -> None:
        release.validate_target_version(
            baseline_value="0.2.19",
            release_target_value="0.3.0",
            candidate_value="0.3.0-rc.2",
            classification="breaking",
            existing_versions=["v0.3.0-rc.1"],
        )
        with self.assertRaisesRegex(release.ReleaseError, "stable release preparation is disabled"):
            release.validate_target_version(
                baseline_value="0.2.19",
                release_target_value="0.3.0",
                candidate_value="0.3.0",
                classification="breaking",
                promotion_from="v0.3.0-rc.2",
            )

    def test_wrong_line_duplicate_and_noncanonical_rc_are_rejected(self) -> None:
        cases = [
            {"candidate_value": "0.2.20", "existing_versions": []},
            {"candidate_value": "0.3.0-rc.1", "existing_versions": ["v0.3.0-rc.1"]},
            {"candidate_value": "0.3.0-rc.0", "existing_versions": []},
            {"candidate_value": "0.3.0-beta.1", "existing_versions": []},
        ]
        for case in cases:
            with self.subTest(case=case), self.assertRaises(release.ReleaseError):
                release.validate_target_version(
                    baseline_value="0.2.19",
                    release_target_value="0.3.0",
                    classification="breaking",
                    **case,
                )


class SourceSnapshotContracts(unittest.TestCase):
    def test_commit_snapshot_archives_resolved_commit_and_ignores_worktree_dirt(self) -> None:
        resolved = "1" * 40
        calls: list[tuple[str, ...]] = []

        def fake_git(_root: Path, *args: str, binary: bool = False) -> str:
            self.assertFalse(binary)
            calls.append(args)
            if args[:3] == ("rev-parse", "--verify", "moving^{commit}"):
                return resolved
            if args[:3] == ("rev-parse", "--verify", f"{resolved}^{{tree}}"):
                return "2" * 40
            if args[:3] == ("show", "-s", "--format=%ct"):
                return "1800000001"
            raise AssertionError(f"unexpected git call: {args}")

        files = fixture_files(licensed=False)
        with mock.patch.object(release, "_git", side_effect=fake_git), mock.patch.object(
            release, "collect_commit_files", return_value=files
        ) as collect:
            result = release.load_source_snapshot(
                Path("repo"),
                source_mode="commit",
                source_ref="moving",
                allow_dirty_local=False,
            )
        collect.assert_called_once_with(Path("repo").resolve(), resolved)
        self.assertFalse(result.dirty)
        self.assertEqual(result.dirty_entries, ())
        self.assertFalse(any(call and call[0] == "status" for call in calls))

    def test_output_inside_repository_is_rejected_even_for_dry_run(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary) / "repo"
            root.mkdir()
            with self.assertRaisesRegex(release.ReleaseError, "outside the repository"):
                release.prepare_release(
                    root,
                    root / "candidate",
                    candidate_version="0.3.0-rc.1",
                    dry_run=True,
                    source_snapshot=snapshot(
                        fixture_files(licensed=False), publishable_source=False
                    ),
                    existing_versions=[],
                    verification_commands=(),
                )


class LicenseContracts(unittest.TestCase):
    def test_valid_license_bundle_has_no_blockers(self) -> None:
        self.assertEqual(release.inspect_license(fixture_files(licensed=True))["blockers"], [])

    def test_each_license_failure_isolated_from_other_gates(self) -> None:
        cases: list[tuple[str, callable, str]] = [
            (
                "empty-license",
                lambda files: files.__setitem__("LICENSE", b" \n"),
                "license-file-empty:LICENSE",
            ),
            (
                "wrong-license-text",
                lambda files: files.__setitem__("LICENSE", b"Not the MIT license.\n"),
                "license-file-content-mismatch:LICENSE",
            ),
            (
                "metadata-mismatch",
                lambda files: files.__setitem__(
                    "SKILL.md", files["SKILL.md"].replace(b"license: MIT", b"license: Apache-2.0")
                ),
                "license-metadata-mismatch",
            ),
            (
                "invalid-notices",
                lambda files: files.__setitem__(release.STRUCTURED_NOTICE_FILE, b"{}\n"),
                "third-party-notices-invalid",
            ),
        ]
        for name, mutate, expected in cases:
            with self.subTest(name=name):
                files = fixture_files(licensed=True)
                mutate(files)
                self.assertEqual(release.inspect_license(files)["blockers"], [expected])

    def test_license_metadata_is_mit_bound_and_accepts_quoted_skill_scalar(self) -> None:
        quoted = fixture_files(licensed=True)
        quoted["SKILL.md"] = quoted["SKILL.md"].replace(b"license: MIT", b'license: "MIT"')
        self.assertEqual(release.inspect_license(quoted)["blockers"], [])

        lock_mismatch = fixture_files(licensed=True)
        lock = json.loads(lock_mismatch["assets/react-kit/package-lock.json"])
        lock["packages"][""]["license"] = "Apache-2.0"
        lock_mismatch["assets/react-kit/package-lock.json"] = json_bytes(lock)
        self.assertEqual(
            release.inspect_license(lock_mismatch)["blockers"],
            ["license-metadata-mismatch"],
        )

    def test_notice_inventory_rejects_duplicate_missing_extra_and_empty_items(self) -> None:
        def mutate_notice(files: dict[str, bytes], mutate: callable) -> None:
            notice = json.loads(files[release.STRUCTURED_NOTICE_FILE])
            mutate(notice["items"])
            files[release.STRUCTURED_NOTICE_FILE] = json_bytes(notice)

        cases: list[tuple[str, callable]] = [
            ("duplicate", lambda items: items.append(dict(items[0]))),
            ("missing", lambda items: items.clear()),
            (
                "extra",
                lambda items: items.append(
                    {
                        "name": "extra-dependency",
                        "version": "9.9.9",
                        "license": "MIT",
                        "source": "https://example.invalid/extra-dependency",
                        "resolved": "https://example.invalid/extra-dependency-9.9.9.tgz",
                        "dependencyType": "dev-transitive",
                        "optional": False,
                    }
                ),
            ),
            ("empty-version", lambda items: items[0].__setitem__("version", " ")),
            ("empty-license", lambda items: items[0].__setitem__("license", "")),
            ("empty-source", lambda items: items[0].__setitem__("source", "")),
            (
                "source-mismatch",
                lambda items: items[0].__setitem__(
                    "source", "https://example.invalid/wrong-source.tgz"
                ),
            ),
            ("empty-resolved", lambda items: items[0].__setitem__("resolved", "")),
            (
                "empty-dependency-type",
                lambda items: items[0].__setitem__("dependencyType", ""),
            ),
            ("non-boolean-optional", lambda items: items[0].__setitem__("optional", "false")),
        ]
        for name, mutate in cases:
            with self.subTest(name=name):
                files = fixture_files(licensed=True)
                mutate_notice(files, mutate)
                self.assertEqual(
                    release.inspect_license(files)["blockers"],
                    ["third-party-notices-invalid"],
                )

    def test_notice_inventory_top_level_metadata_is_bound(self) -> None:
        cases = {
            "generatedFrom": "wrong-lock.json",
            "dependencyCount": 2,
        }
        for field, value in cases.items():
            with self.subTest(field=field):
                files = fixture_files(licensed=True)
                notice = json.loads(files[release.STRUCTURED_NOTICE_FILE])
                notice[field] = value
                files[release.STRUCTURED_NOTICE_FILE] = json_bytes(notice)
                self.assertEqual(
                    release.inspect_license(files)["blockers"],
                    ["third-party-notices-invalid"],
                )

    def test_notice_inventory_must_match_locked_metadata(self) -> None:
        cases = {
            "license": "Apache-2.0",
            "resolved": "https://example.invalid/wrong.tgz",
            "dependencyType": "runtime-direct",
            "optional": True,
        }
        for field, value in cases.items():
            with self.subTest(field=field):
                files = fixture_files(licensed=True)
                notice = json.loads(files[release.STRUCTURED_NOTICE_FILE])
                notice["items"][0][field] = value
                files[release.STRUCTURED_NOTICE_FILE] = json_bytes(notice)
                self.assertEqual(
                    release.inspect_license(files)["blockers"],
                    ["third-party-notices-invalid"],
                )


class ArchiveContracts(unittest.TestCase):
    def test_archive_is_byte_identical_across_paths_and_file_timestamps(self) -> None:
        files = {"README.md": b"same\n", "scripts/tool.py": b"print('same')\n"}
        first = release.deterministic_zip_bytes(files, epoch=1_800_000_001)
        second = release.deterministic_zip_bytes(dict(reversed(list(files.items()))), epoch=1_800_000_001)
        self.assertEqual(first, second)
        self.assertEqual(release.sha256_bytes(first), release.sha256_bytes(second))
        release.verify_zip_bytes(first, files)

    def test_archive_rejects_parent_traversal(self) -> None:
        with self.assertRaises(release.ReleaseError):
            release.deterministic_zip_bytes({"../escape": b"bad"}, epoch=1_800_000_001)


class PrepareVerifyContracts(unittest.TestCase):
    def test_dry_run_is_stable_and_writes_nothing(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary) / "repo"
            root.mkdir()
            output = Path(temporary) / "candidate"
            source = snapshot(fixture_files(licensed=False), publishable_source=False)
            first = release.prepare_release(
                root,
                output,
                candidate_version="0.3.0-rc.1",
                dry_run=True,
                source_snapshot=source,
                existing_versions=[],
                verification_commands=(),
            )
            second = release.prepare_release(
                root,
                output,
                candidate_version="0.3.0-rc.1",
                dry_run=True,
                source_snapshot=source,
                existing_versions=[],
                verification_commands=(),
            )
            self.assertEqual(first, second)
            self.assertFalse(output.exists())

    def test_prepare_versions_only_the_staging_copy_and_blocks_publication_without_license(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary) / "repo"
            root.mkdir()
            original = fixture_files(licensed=False)
            write_fixture(root, original)
            output = Path(temporary) / "candidate"
            plan = release.prepare_release(
                root,
                output,
                candidate_version="0.3.0-rc.1",
                source_snapshot=snapshot(original, publishable_source=False),
                existing_versions=[],
                verification_commands=(),
            )
            canonical = json.loads((root / "assets/react-kit/package.json").read_text("utf-8"))
            staged = json.loads(
                (output / "staging/ui-builder-xtn/assets/react-kit/package.json").read_text("utf-8")
            )
            self.assertEqual(canonical["version"], "0.2.19")
            self.assertEqual(staged["version"], "0.3.0-rc.1")
            for relative in (
                "assets/react-kit/component-coverage.json",
                "assets/react-kit/etc/personal-ui.module-ownership.json",
            ):
                generated = json.loads(
                    (output / "staging" / release.ARCHIVE_PREFIX / relative).read_text("utf-8")
                )
                self.assertEqual(generated["kitVersion"], "0.3.0-rc.1")
            self.assertIn(
                "Personal UI 0.3.0-rc.1",
                (
                    output
                    / "staging"
                    / release.ARCHIVE_PREFIX
                    / "references/component-api.md"
                ).read_text("utf-8"),
            )
            self.assertIn(
                "- Version: `0.3.0-rc.1`",
                (
                    output
                    / "staging"
                    / release.ARCHIVE_PREFIX
                    / "references/component-catalog.md"
                ).read_text("utf-8"),
            )
            staged_policy = json.loads(
                (
                    output
                    / "staging"
                    / release.ARCHIVE_PREFIX
                    / "assets/react-kit/api-version-policy.json"
                ).read_text("utf-8")
            )
            self.assertEqual(staged_policy["baselineVersion"], "0.2.19")
            self.assertTrue(
                all(
                    set(metadata) == {"path", "sha256", "size"}
                    for metadata in plan["artifacts"].values()
                )
            )
            release_manifest = json.loads(
                (output / "artifacts" / release.MANIFEST_NAME).read_text("utf-8")
            )
            self.assertNotIn("planDigest", release_manifest)
            self.assertFalse(plan["publishable"])
            self.assertIn("license-file-missing", plan["publicationBlockers"])
            self.assertIn("source-worktree-is-dirty", plan["publicationBlockers"])
            journal = release.verify_release(output, command_runner=lambda _argv, _cwd: 0)
            self.assertEqual(journal["status"], "verified")

    def test_stale_generated_version_marker_aborts_before_output(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary) / "repo"
            root.mkdir()
            output = Path(temporary) / "candidate"
            files = fixture_files(licensed=False)
            files["references/component-api.md"] = files[
                "references/component-api.md"
            ].replace(b"0.2.19", b"0.2.18")
            with self.assertRaisesRegex(release.ReleaseError, "exactly one version marker"):
                release.prepare_release(
                    root,
                    output,
                    candidate_version="0.3.0-rc.1",
                    source_snapshot=snapshot(files, publishable_source=False),
                    existing_versions=[],
                    verification_commands=(),
                )
            self.assertFalse(output.exists())

    def test_tampering_is_detected_before_any_verification_command(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary) / "repo"
            root.mkdir()
            output = Path(temporary) / "candidate"
            release.prepare_release(
                root,
                output,
                candidate_version="0.3.0-rc.1",
                source_snapshot=snapshot(fixture_files(licensed=False), publishable_source=False),
                existing_versions=[],
                verification_commands=({"cwd": ".", "argv": ["never"]},),
            )
            (output / "staging/ui-builder-xtn/README.md").write_text("tampered\n", encoding="utf-8")
            calls: list[list[str]] = []
            with self.assertRaises(release.ReleaseError):
                release.verify_release(
                    output,
                    command_runner=lambda argv, _cwd: calls.append(list(argv)) or 0,
                )
            self.assertEqual(calls, [])

    def test_plan_digest_tampering_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary) / "repo"
            root.mkdir()
            output = Path(temporary) / "candidate"
            release.prepare_release(
                root,
                output,
                candidate_version="0.3.0-rc.1",
                source_snapshot=snapshot(fixture_files(licensed=False), publishable_source=False),
                existing_versions=[],
                verification_commands=(),
            )
            plan_path = output / release.PLAN_NAME
            plan = json.loads(plan_path.read_text("utf-8"))
            plan["candidateVersion"] = "9.9.9"
            plan_path.write_text(json.dumps(plan), encoding="utf-8")
            with self.assertRaises(release.ReleaseError):
                release.load_candidate(output)

    def test_journal_schema_steps_and_prepare_state_are_validated(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary) / "repo"
            root.mkdir()
            output = Path(temporary) / "candidate"
            release.prepare_release(
                root,
                output,
                candidate_version="0.3.0-rc.1",
                source_snapshot=snapshot(
                    fixture_files(licensed=False), publishable_source=False
                ),
                existing_versions=[],
                verification_commands=(),
            )
            journal_path = output / release.JOURNAL_NAME
            original = json.loads(journal_path.read_text("utf-8"))
            variants = []
            wrong_kind = json.loads(json.dumps(original))
            wrong_kind["kind"] = "other"
            variants.append(wrong_kind)
            missing_steps = json.loads(json.dumps(original))
            missing_steps["steps"] = None
            variants.append(missing_steps)
            incomplete_prepare = json.loads(json.dumps(original))
            incomplete_prepare["steps"]["prepare"]["status"] = "pending"
            variants.append(incomplete_prepare)
            for variant in variants:
                journal_path.write_bytes(json_bytes(variant))
                with self.assertRaises(release.ReleaseError):
                    release.load_candidate(output)

    def test_failed_prepare_leaves_no_output_directory(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary) / "repo"
            root.mkdir()
            output = Path(temporary) / "candidate"
            with self.assertRaises(release.ReleaseError):
                release.prepare_release(
                    root,
                    output,
                    candidate_version="0.2.20",
                    source_snapshot=snapshot(
                        fixture_files(licensed=False), publishable_source=False
                    ),
                    existing_versions=[],
                    verification_commands=(),
                )
            self.assertFalse(output.exists())

    def test_archive_tampering_is_detected(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary) / "repo"
            root.mkdir()
            output = Path(temporary) / "candidate"
            plan = release.prepare_release(
                root,
                output,
                candidate_version="0.3.0-rc.1",
                source_snapshot=snapshot(fixture_files(licensed=False), publishable_source=False),
                existing_versions=[],
                verification_commands=(),
            )
            archive_name = Path(plan["artifacts"]["archive"]["path"]).name
            archive_path = output / "artifacts" / archive_name
            archive_path.write_bytes(archive_path.read_bytes() + b"tampered")
            with self.assertRaises(release.ReleaseError):
                release.verify_release(output, command_runner=lambda _argv, _cwd: 0)

    def test_sidecar_tampering_cannot_be_hidden_by_rewriting_checksums(self) -> None:
        for target in (release.NOTES_NAME, release.MANIFEST_NAME):
            with self.subTest(target=target), tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary) / "repo"
                root.mkdir()
                output = Path(temporary) / "candidate"
                plan = release.prepare_release(
                    root,
                    output,
                    candidate_version="0.3.0-rc.1",
                    source_snapshot=snapshot(
                        fixture_files(licensed=False), publishable_source=False
                    ),
                    existing_versions=[],
                    verification_commands=(),
                )
                artifacts = output / "artifacts"
                target_path = artifacts / target
                if target == release.NOTES_NAME:
                    target_path.write_bytes(target_path.read_bytes() + b"tampered\n")
                else:
                    manifest = json.loads(target_path.read_text("utf-8"))
                    manifest["publishable"] = not manifest["publishable"]
                    target_path.write_bytes(json_bytes(manifest))
                archive_meta = plan["artifacts"]["archive"]
                archive_name = Path(archive_meta["path"]).name
                (artifacts / release.CHECKSUMS_NAME).write_bytes(
                    release._checksums(
                        {
                            archive_name: (artifacts / archive_name).read_bytes(),
                            release.MANIFEST_NAME: (
                                artifacts / release.MANIFEST_NAME
                            ).read_bytes(),
                            release.NOTES_NAME: (artifacts / release.NOTES_NAME).read_bytes(),
                        }
                    )
                )
                with self.assertRaises(release.ReleaseError):
                    release.verify_release(output, command_runner=lambda _argv, _cwd: 0)

    def test_failed_verification_is_journaled_without_publication(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary) / "repo"
            root.mkdir()
            output = Path(temporary) / "candidate"
            release.prepare_release(
                root,
                output,
                candidate_version="0.3.0-rc.1",
                source_snapshot=snapshot(fixture_files(licensed=False), publishable_source=False),
                existing_versions=[],
                verification_commands=({"cwd": ".", "argv": ["focused-failure"]},),
            )
            with self.assertRaises(release.ReleaseError):
                release.verify_release(output, command_runner=lambda _argv, _cwd: 7)
            journal = json.loads((output / release.JOURNAL_NAME).read_text("utf-8"))
            self.assertEqual(journal["status"], "verify-failed")
            self.assertTrue(
                all(
                    journal["steps"][step]["status"] == "pending"
                    for step in release.PUBLISH_STEPS
                )
            )


class RecordingAdapter:
    def __init__(self, fail_once: str | None = None) -> None:
        self.fail_once = fail_once
        self.calls: list[str] = []

    def execute(self, step: str, _plan: object, _candidate: Path) -> None:
        self.calls.append(step)
        if self.fail_once == step:
            self.fail_once = None
            raise RuntimeError("injected remote failure")


class PublishContracts(unittest.TestCase):
    def test_missing_license_blocks_before_adapter_execution(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary) / "repo"
            root.mkdir()
            output = Path(temporary) / "candidate"
            files = fixture_files(licensed=False)
            write_fixture(root, files)
            plan = release.prepare_release(
                root,
                output,
                candidate_version="0.3.0-rc.1",
                source_snapshot=snapshot(files, publishable_source=False),
                existing_versions=[],
                verification_commands=(),
            )
            release.verify_release(output, command_runner=lambda _argv, _cwd: 0)
            m8 = Path(temporary) / "m8.json"
            ci = Path(temporary) / "ci.json"
            write_evidence(m8, plan, "m8-acceptance")
            write_evidence(ci, plan, "hosted-ci")
            adapter = RecordingAdapter()
            with mock.patch.object(release, "_git", return_value=""):
                blockers = release.publish_preflight(
                    output,
                    authorization=str(plan["planDigest"]),
                    m8_evidence=m8,
                    ci_evidence=ci,
                    remote_adapter_configured=True,
                    repository_root=root,
                )
                self.assertIn("license-file-missing", blockers)
                self.assertFalse(any("evidence-" in blocker for blocker in blockers))
                with self.assertRaises(release.ReleaseError):
                    release.publish_with_adapter(
                        output,
                        authorization=str(plan["planDigest"]),
                        m8_evidence=m8,
                        ci_evidence=ci,
                        adapter=adapter,
                        repository_root=root,
                    )
            self.assertEqual(adapter.calls, [])

    def test_fake_publish_journal_resumes_without_repeating_completed_steps(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary) / "repo"
            root.mkdir()
            output = Path(temporary) / "candidate"
            files = fixture_files(licensed=True)
            write_fixture(root, files)
            plan = release.prepare_release(
                root,
                output,
                candidate_version="0.3.0-rc.1",
                source_snapshot=snapshot(files, publishable_source=True),
                existing_versions=[],
                verification_commands=(),
            )
            self.assertTrue(plan["publishable"])
            release.verify_release(output, command_runner=lambda _argv, _cwd: 0)
            m8 = Path(temporary) / "m8.json"
            ci = Path(temporary) / "ci.json"
            write_evidence(m8, plan, "m8-acceptance")
            write_evidence(ci, plan, "hosted-ci")
            first = RecordingAdapter(fail_once="create-draft-github-release")
            with mock.patch.object(release, "_git", return_value=""):
                with self.assertRaises(RuntimeError):
                    release.publish_with_adapter(
                        output,
                        authorization=str(plan["planDigest"]),
                        m8_evidence=m8,
                        ci_evidence=ci,
                        adapter=first,
                        repository_root=root,
                    )
            self.assertEqual(
                first.calls,
                list(release.PUBLISH_STEPS[:4]),
            )
            package_path = root / release.VERSION_PATHS["package"]
            package = json.loads(package_path.read_text("utf-8"))
            package["version"] = "0.3.0-rc.1"
            package_path.write_bytes(json_bytes(package))
            second = RecordingAdapter()
            with mock.patch.object(release, "_git", return_value="v0.3.0-rc.1"):
                journal = release.publish_with_adapter(
                    output,
                    authorization=str(plan["planDigest"]),
                    m8_evidence=m8,
                    ci_evidence=ci,
                    adapter=second,
                    repository_root=root,
                )
            self.assertEqual(second.calls, list(release.PUBLISH_STEPS[3:]))
            self.assertEqual(journal["status"], "published")

    def test_top_level_verified_status_cannot_bypass_pending_verify_step(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary) / "repo"
            root.mkdir()
            files = fixture_files(licensed=True)
            write_fixture(root, files)
            output = Path(temporary) / "candidate"
            plan = release.prepare_release(
                root,
                output,
                candidate_version="0.3.0-rc.1",
                source_snapshot=snapshot(files, publishable_source=True),
                existing_versions=[],
                verification_commands=(),
            )
            journal_path = output / release.JOURNAL_NAME
            journal = json.loads(journal_path.read_text("utf-8"))
            journal["status"] = "verified"
            journal_path.write_bytes(json_bytes(journal))
            m8 = Path(temporary) / "m8.json"
            ci = Path(temporary) / "ci.json"
            write_evidence(m8, plan, "m8-acceptance")
            write_evidence(ci, plan, "hosted-ci")
            adapter = RecordingAdapter()
            with mock.patch.object(release, "_git", return_value=""):
                blockers = release.publish_preflight(
                    output,
                    authorization=str(plan["planDigest"]),
                    m8_evidence=m8,
                    ci_evidence=ci,
                    remote_adapter_configured=True,
                    repository_root=root,
                )
                self.assertIn("candidate-verify-step-incomplete", blockers)
                with self.assertRaises(release.ReleaseError):
                    release.publish_with_adapter(
                        output,
                        authorization=str(plan["planDigest"]),
                        m8_evidence=m8,
                        ci_evidence=ci,
                        adapter=adapter,
                        repository_root=root,
                    )
            self.assertEqual(adapter.calls, [])

    def test_verify_evidence_must_match_planned_commands_and_archive(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary) / "repo"
            root.mkdir()
            files = fixture_files(licensed=True)
            write_fixture(root, files)
            output = Path(temporary) / "candidate"
            plan = release.prepare_release(
                root,
                output,
                candidate_version="0.3.0-rc.1",
                source_snapshot=snapshot(files, publishable_source=True),
                existing_versions=[],
                verification_commands=({"cwd": ".", "argv": ["focused"]},),
            )
            release.verify_release(output, command_runner=lambda _argv, _cwd: 0)
            journal_path = output / release.JOURNAL_NAME
            journal = json.loads(journal_path.read_text("utf-8"))
            journal["steps"]["verify"]["commands"][0]["argv"] = ["different"]
            journal["steps"]["verify"]["archiveSha256"] = "0" * 64
            journal_path.write_bytes(json_bytes(journal))
            m8 = Path(temporary) / "m8.json"
            ci = Path(temporary) / "ci.json"
            write_evidence(m8, plan, "m8-acceptance")
            write_evidence(ci, plan, "hosted-ci")
            with mock.patch.object(release, "_git", return_value=""):
                blockers = release.publish_preflight(
                    output,
                    authorization=str(plan["planDigest"]),
                    m8_evidence=m8,
                    ci_evidence=ci,
                    remote_adapter_configured=True,
                    repository_root=root,
                )
            self.assertIn("candidate-verify-command-evidence-mismatch", blockers)
            self.assertIn("candidate-verify-archive-evidence-mismatch", blockers)

    def test_evidence_is_structured_and_bound_to_the_candidate(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary) / "repo"
            root.mkdir()
            files = fixture_files(licensed=True)
            write_fixture(root, files)
            output = Path(temporary) / "candidate"
            plan = release.prepare_release(
                root,
                output,
                candidate_version="0.3.0-rc.1",
                source_snapshot=snapshot(files, publishable_source=True),
                existing_versions=[],
                verification_commands=(),
            )
            release.verify_release(output, command_runner=lambda _argv, _cwd: 0)
            m8 = Path(temporary) / "m8.json"
            ci = Path(temporary) / "ci.json"
            write_evidence(m8, plan, "m8-acceptance")
            write_evidence(ci, plan, "hosted-ci")
            tampered = json.loads(m8.read_text("utf-8"))
            tampered["planDigest"] = "0" * 64
            m8.write_bytes(json_bytes(tampered))
            with mock.patch.object(release, "_git", return_value=""):
                blockers = release.publish_preflight(
                    output,
                    authorization=str(plan["planDigest"]),
                    m8_evidence=m8,
                    ci_evidence=ci,
                    remote_adapter_configured=True,
                    repository_root=root,
                )
            self.assertIn("m8-acceptance-evidence-binding-mismatch", blockers)

    def test_thin_m8_evidence_cannot_pass_publish_preflight(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary) / "repo"
            root.mkdir()
            files = fixture_files(licensed=True)
            write_fixture(root, files)
            output = Path(temporary) / "candidate"
            plan = release.prepare_release(
                root,
                output,
                candidate_version="0.3.0-rc.1",
                source_snapshot=snapshot(files, publishable_source=True),
                existing_versions=[],
                verification_commands=(),
            )
            release.verify_release(output, command_runner=lambda _argv, _cwd: 0)
            source = plan["source"]
            artifacts = plan["artifacts"]
            assert isinstance(source, dict)
            assert isinstance(artifacts, dict)
            archive = artifacts["archive"]
            assert isinstance(archive, dict)
            m8 = Path(temporary) / "thin-m8.json"
            m8.write_bytes(
                json_bytes(
                    {
                        "schemaVersion": 1,
                        "kind": "personal-ui-release-evidence",
                        "type": "m8-acceptance",
                        "planDigest": plan["planDigest"],
                        "sourceCommit": source["commit"],
                        "archiveSha256": archive["sha256"],
                        "result": "passed",
                    }
                )
            )
            ci = Path(temporary) / "ci.json"
            write_evidence(ci, plan, "hosted-ci")
            with mock.patch.object(release, "_git", return_value=""):
                blockers = release.publish_preflight(
                    output,
                    authorization=str(plan["planDigest"]),
                    m8_evidence=m8,
                    ci_evidence=ci,
                    remote_adapter_configured=True,
                    repository_root=root,
                )
            self.assertIn("m8-acceptance-evidence-invalid", blockers)
            self.assertFalse(any(blocker.startswith("hosted-ci-") for blocker in blockers))

    def test_thin_or_tampered_hosted_evidence_cannot_pass_publish_preflight(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary) / "repo"
            root.mkdir()
            files = fixture_files(licensed=True)
            write_fixture(root, files)
            output = Path(temporary) / "candidate"
            plan = release.prepare_release(
                root,
                output,
                candidate_version="0.3.0-rc.1",
                source_snapshot=snapshot(files, publishable_source=True),
                existing_versions=[],
                verification_commands=(),
            )
            release.verify_release(output, command_runner=lambda _argv, _cwd: 0)
            m8 = Path(temporary) / "m8.json"
            write_evidence(m8, plan, "m8-acceptance")
            source = plan["source"]
            artifacts = plan["artifacts"]
            assert isinstance(source, dict)
            assert isinstance(artifacts, dict)
            archive = artifacts["archive"]
            assert isinstance(archive, dict)
            ci = Path(temporary) / "ci.json"
            ci.write_bytes(
                json_bytes(
                    {
                        "schemaVersion": 1,
                        "kind": "personal-ui-release-evidence",
                        "type": "hosted-ci",
                        "planDigest": plan["planDigest"],
                        "sourceCommit": source["commit"],
                        "archiveSha256": archive["sha256"],
                        "result": "passed",
                    }
                )
            )
            with mock.patch.object(release, "_git", return_value=""):
                blockers = release.publish_preflight(
                    output,
                    authorization=str(plan["planDigest"]),
                    m8_evidence=m8,
                    ci_evidence=ci,
                    remote_adapter_configured=True,
                    repository_root=root,
                )
            self.assertIn("hosted-ci-evidence-invalid", blockers)

            write_evidence(ci, plan, "hosted-ci")
            hosted = json.loads(ci.read_text(encoding="utf-8"))
            descriptor = hosted["artifacts"][0]
            (ci.parent / descriptor["path"]).write_text("{}\n", encoding="utf-8")
            with mock.patch.object(release, "_git", return_value=""):
                blockers = release.publish_preflight(
                    output,
                    authorization=str(plan["planDigest"]),
                    m8_evidence=m8,
                    ci_evidence=ci,
                    remote_adapter_configured=True,
                    repository_root=root,
                )
            self.assertIn("hosted-ci-evidence-artifact-mismatch", blockers)

    def test_local_version_and_tag_conflicts_are_rechecked(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary) / "repo"
            root.mkdir()
            files = fixture_files(licensed=True)
            write_fixture(root, files)
            output = Path(temporary) / "candidate"
            plan = release.prepare_release(
                root,
                output,
                candidate_version="0.3.0-rc.1",
                source_snapshot=snapshot(files, publishable_source=True),
                existing_versions=[],
                verification_commands=(),
            )
            release.verify_release(output, command_runner=lambda _argv, _cwd: 0)
            package_path = root / release.VERSION_PATHS["package"]
            package = json.loads(package_path.read_text("utf-8"))
            package["version"] = "0.3.0-rc.1"
            package_path.write_bytes(json_bytes(package))
            m8 = Path(temporary) / "m8.json"
            ci = Path(temporary) / "ci.json"
            write_evidence(m8, plan, "m8-acceptance")
            write_evidence(ci, plan, "hosted-ci")
            with mock.patch.object(release, "_git", return_value="v0.3.0-rc.1"):
                blockers = release.publish_preflight(
                    output,
                    authorization=str(plan["planDigest"]),
                    m8_evidence=m8,
                    ci_evidence=ci,
                    remote_adapter_configured=True,
                    repository_root=root,
                )
            self.assertIn("local-source-version-conflict", blockers)
            self.assertIn("local-tag-conflict", blockers)


class RepositoryDocumentationContracts(unittest.TestCase):
    def test_release_history_and_required_migration_topics_are_present(self) -> None:
        root = Path(__file__).resolve().parent.parent
        files = {
            "CHANGELOG.md": (root / "CHANGELOG.md").read_bytes(),
            "references/v0.3.0-migrations.md": (
                root / "references/v0.3.0-migrations.md"
            ).read_bytes(),
            "references/release-process.md": (
                root / "references/release-process.md"
            ).read_bytes(),
        }
        self.assertEqual(release.inspect_release_documentation(files)["blockers"], [])
        release_process = files["references/release-process.md"].decode("utf-8")
        for commit in (
            "11e8f90",
            "91973f8",
            "9d495b2",
            "a24e11f",
            "54b15d0",
            "a920114",
            "c591699",
            "15b3511",
            "a181164",
            "b2cd98d",
            "6bc7e2c",
            "6eaa7e9",
            "2f28312",
            "0587d4b",
        ):
            self.assertIn(commit, release_process)


if __name__ == "__main__":
    unittest.main()
