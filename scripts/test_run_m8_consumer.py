#!/usr/bin/env python3
"""Focused contracts for the M8 evaluator-input workspace runner."""

from __future__ import annotations

import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path

import release_personal_ui as release
import run_m8_consumer as m8


FIXTURE_ID = "npm10-vite-node22-react18-ts59-single"
SCENARIO_ID = "family-login"


def json_bytes(value: object) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def source_files(
    *,
    licensed: bool,
    request_text: str = "Build a family login experience.\n",
) -> dict[str, bytes]:
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
        "references/m8-evaluation-protocol.md": b"organizer protocol\n",
        "references/v0.3.0-roadmap.md": b"internal roadmap\n",
        "references/v0.3.0-m4-m8-execution-plan.md": b"internal component mapping\n",
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
        "references/support-fixtures.json": json_bytes(
            {
                "schemaVersion": 1,
                "fixtures": [
                    {
                        "id": FIXTURE_ID,
                        "environment": {
                            "node": "22.12.0",
                            "react": "18.3.1",
                            "reactDom": "18.3.1",
                            "typescript": "5.9.3",
                            "packageManager": {"name": "npm", "version": "10.9.3"},
                            "framework": {"name": "vite", "version": "6.4.3"},
                        },
                        "project": {
                            "layout": "single-package",
                            "packageRoot": ".",
                            "sourceRoot": "src/personal-ui",
                        },
                    }
                ],
            }
        ),
        "evaluation/m8/scenarios.json": json_bytes(
            {
                "schemaVersion": 1,
                "kind": "personal-ui-m8-scenarios",
                "scenarios": [
                    {
                        "id": SCENARIO_ID,
                        "request": {
                            "path": f"evaluation/m8/requests/{SCENARIO_ID}.md",
                            "sha256": release.sha256_bytes(request_text.encode("utf-8")),
                        },
                        "supportFixtureId": FIXTURE_ID,
                        "allowedDeliverables": [
                            "consumer-project",
                            "run-instructions",
                            "verification-record",
                        ],
                    }
                ],
            }
        ),
        "evaluation/m8/acceptance-rules.json": json_bytes(
            {
                "schemaVersion": 1,
                "kind": "personal-ui-m8-acceptance-rules",
                "visibility": "organizer-only",
                "attributionEnum": ["consumer-omission"],
                "scenarioRules": [{"id": SCENARIO_ID, "checks": {}}],
            }
        ),
        f"evaluation/m8/requests/{SCENARIO_ID}.md": request_text.encode("utf-8"),
        "assets/react-kit/src/personal-ui/index.ts": source,
        "scripts/release_personal_ui.py": b"# fixture tool\n",
    }
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


def snapshot(
    *,
    licensed: bool,
    immutable: bool,
    request_text: str = "Build a family login experience.\n",
) -> release.SourceSnapshot:
    return release.SourceSnapshot(
        mode="commit" if immutable else "worktree",
        ref="fixture",
        commit="a" * 40,
        tree="b" * 40 if immutable else None,
        epoch=1_800_000_001,
        dirty=not immutable,
        dirty_entries=() if immutable else (" M fixture",),
        files=source_files(licensed=licensed, request_text=request_text),
    )


def mark_verified(candidate: Path, plan: dict[str, object]) -> None:
    journal_path = candidate / release.JOURNAL_NAME
    journal = json.loads(journal_path.read_text(encoding="utf-8"))
    journal["status"] = "verified"
    journal["steps"]["verify"] = {
        "status": "complete",
        "commands": [
            {"cwd": command["cwd"], "argv": command["argv"], "exitCode": 0}
            for command in plan["verificationCommands"]
        ],
        "archiveSha256": plan["artifacts"]["archive"]["sha256"],
    }
    journal_path.write_bytes(release.pretty_json_bytes(journal))


def make_candidate(
    root: Path,
    *,
    official: bool,
    request_text: str = "Build a family login experience.\n",
) -> tuple[Path, dict[str, object]]:
    candidate = root / "candidate"
    plan = release.prepare_release(
        Path(__file__).resolve().parents[1],
        candidate,
        candidate_version="0.3.0-rc.1",
        source_snapshot=snapshot(
            licensed=official,
            immutable=official,
            request_text=request_text,
        ),
        verification_commands=(
            {"cwd": ".", "argv": ["python", "focused-check.py"]},
        ),
    )
    mark_verified(candidate, plan)
    return candidate, plan


def make_catalog(
    root: Path,
    request_text: str,
    *,
    name: str = "catalog",
    expected_request_hash: str | None = None,
) -> tuple[Path, Path]:
    catalog_root = root / name
    request = catalog_root / "evaluation" / "m8" / "requests" / f"{SCENARIO_ID}.md"
    request.parent.mkdir(parents=True)
    request.write_bytes(request_text.encode("utf-8"))
    request_digest = expected_request_hash or release.sha256_bytes(request.read_bytes())
    catalog = {
        "schemaVersion": 1,
        "kind": "personal-ui-m8-scenarios",
        "scenarios": [
            {
                "id": SCENARIO_ID,
                "request": {
                    "path": f"evaluation/m8/requests/{SCENARIO_ID}.md",
                    "sha256": request_digest,
                },
                "supportFixtureId": FIXTURE_ID,
                "allowedDeliverables": [
                    "consumer-project",
                    "run-instructions",
                    "verification-record",
                ],
            }
        ],
    }
    (catalog_root / m8.SCENARIO_CATALOG_PATH).write_bytes(json_bytes(catalog))
    return catalog_root, request


def make_directory_link(link: Path, target: Path) -> None:
    try:
        link.symlink_to(target, target_is_directory=True)
        return
    except OSError as error:
        if os.name != "nt":
            raise unittest.SkipTest(f"directory links are unavailable: {error}")
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


class M8ConsumerWorkspaceContracts(unittest.TestCase):
    def test_candidate_materials_are_complete_and_cross_checked(self) -> None:
        files = source_files(licensed=True)
        m8._validate_candidate_materials(files)

        mismatched_rules = dict(files)
        rules = json.loads(mismatched_rules["evaluation/m8/acceptance-rules.json"])
        rules["scenarioRules"][0]["id"] = "different-scenario"
        mismatched_rules["evaluation/m8/acceptance-rules.json"] = json_bytes(rules)
        with self.assertRaisesRegex(m8.M8ConsumerError, "do not match"):
            m8._validate_candidate_materials(mismatched_rules)

        bad_request = dict(files)
        bad_request[f"evaluation/m8/requests/{SCENARIO_ID}.md"] = b"changed\n"
        with self.assertRaisesRegex(m8.M8ConsumerError, "hash mismatch"):
            m8._validate_candidate_materials(bad_request)

    def test_official_projection_is_deterministic_and_excludes_organizer_inputs(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pui-m8-") as temporary:
            root = Path(temporary)
            candidate, plan = make_candidate(root, official=True)
            catalog_root, request = make_catalog(
                root, "Build a family login experience.\n"
            )

            first = m8.create_evaluator_workspace(
                candidate=candidate,
                scenario_id=SCENARIO_ID,
                output=root / "evaluator-a",
                catalog_root=catalog_root,
            )
            second = m8.create_evaluator_workspace(
                candidate=candidate,
                scenario_id=SCENARIO_ID,
                output=root / "evaluator-b",
                catalog_root=catalog_root,
            )

            self.assertNotEqual(first["run"]["id"], second["run"]["id"])
            self.assertRegex(first["run"]["id"], m8.RUN_ID_PATTERN)
            self.assertTrue(first["official"])
            self.assertEqual(first["candidate"]["planDigest"], plan["planDigest"])
            self.assertEqual(
                first["candidate"]["archive"]["sha256"],
                plan["artifacts"]["archive"]["sha256"],
            )
            self.assertEqual(
                first["candidate"]["sourceContentDigest"],
                plan["source"]["contentDigest"],
            )
            self.assertEqual(
                first["candidate"]["candidateContentDigest"],
                plan["candidateContentDigest"],
            )
            self.assertEqual(
                first["candidate"]["archive"]["size"],
                plan["artifacts"]["archive"]["size"],
            )
            self.assertEqual(first["environment"]["status"], "not-executed")
            self.assertIsNone(first["environment"]["actual"])
            self.assertEqual(first["scenario"]["id"], SCENARIO_ID)
            self.assertEqual(first["scenario"]["supportFixtureId"], FIXTURE_ID)
            self.assertEqual(
                first["scenario"]["catalogSha256"],
                release.sha256_bytes(
                    (catalog_root / m8.SCENARIO_CATALOG_PATH).read_bytes()
                ),
            )
            self.assertEqual(first["inputPolicy"]["commandsExecuted"], [])
            self.assertTrue(first["inputPolicy"]["readOnly"])
            self.assertTrue(first["inputPolicy"]["postWriteVerified"])
            self.assertFalse(first["acceptanceEvidence"]["generated"])
            self.assertEqual(
                (root / "evaluator-a" / m8.REQUEST_NAME).read_bytes(),
                request.read_bytes(),
            )
            for forbidden in m8.FORBIDDEN_PROJECTION_PATHS:
                self.assertFalse(
                    (root / "evaluator-a" / m8.PROJECTION_ROOT / forbidden).exists(),
                    forbidden,
                )
            self.assertFalse(
                (root / "evaluator-a" / m8.PROJECTION_ROOT / "evaluation").exists()
            )
            self.assertTrue(
                (root / "evaluator-a" / m8.PROJECTION_ROOT / "SKILL.md").is_file()
            )
            self.assertTrue((root / "evaluator-a" / m8.CONSUMER_ROOT).is_dir())
            self.assertTrue((root / "evaluator-a" / m8.EVIDENCE_ROOT).is_dir())

    def test_existing_output_preserves_first_inputs(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pui-m8-") as temporary:
            root = Path(temporary)
            candidate, _ = make_candidate(
                root,
                official=True,
                request_text="Initial requirement.\n",
            )
            catalog_root, request = make_catalog(root, "Initial requirement.\n")
            output = root / "evaluator"
            m8.create_evaluator_workspace(
                candidate=candidate,
                scenario_id=SCENARIO_ID,
                output=output,
                catalog_root=catalog_root,
            )
            frozen = (output / m8.MANIFEST_NAME).read_bytes()
            with self.assertRaisesRegex(m8.M8ConsumerError, "new path"):
                m8.create_evaluator_workspace(
                    candidate=candidate,
                    scenario_id=SCENARIO_ID,
                    output=output,
                    catalog_root=catalog_root,
                )
            self.assertEqual((output / m8.MANIFEST_NAME).read_bytes(), frozen)
            request.write_text("Changed requirement.\n", encoding="utf-8")
            with self.assertRaisesRegex(m8.M8ConsumerError, "differs from the frozen candidate"):
                m8.create_evaluator_workspace(
                    candidate=candidate,
                    scenario_id=SCENARIO_ID,
                    output=root / "changed-request",
                    catalog_root=catalog_root,
                )
            self.assertFalse((root / "changed-request").exists())

    def test_rehearsal_allows_dirty_nonpublishable_candidate_but_is_not_evidence(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pui-m8-") as temporary:
            root = Path(temporary)
            candidate, _ = make_candidate(
                root,
                official=False,
                request_text="Rehearse one consumer request.\n",
            )
            catalog_root, _ = make_catalog(root, "Rehearse one consumer request.\n")
            with self.assertRaisesRegex(m8.M8ConsumerError, "official evaluator workspace"):
                m8.create_evaluator_workspace(
                    candidate=candidate,
                    scenario_id=SCENARIO_ID,
                    output=root / "strict",
                    catalog_root=catalog_root,
                )

            manifest = m8.create_evaluator_workspace(
                candidate=candidate,
                scenario_id=SCENARIO_ID,
                output=root / "rehearsal",
                rehearsal=True,
                catalog_root=catalog_root,
            )
            self.assertFalse(manifest["official"])
            self.assertFalse(manifest["acceptanceEvidence"]["eligible"])
            self.assertFalse(manifest["acceptanceEvidence"]["generated"])
            self.assertTrue(manifest["rehearsal"]["waivedOfficialBlockers"])
            self.assertFalse((root / "rehearsal" / "m8-acceptance.json").exists())

    def test_unverified_and_tampered_candidates_are_rejected_without_output(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pui-m8-") as temporary:
            root = Path(temporary)
            candidate = root / "candidate"
            release.prepare_release(
                Path(__file__).resolve().parents[1],
                candidate,
                candidate_version="0.3.0-rc.1",
                source_snapshot=snapshot(
                    licensed=True,
                    immutable=True,
                    request_text="Evaluate the candidate.\n",
                ),
                verification_commands=(
                    {"cwd": ".", "argv": ["python", "focused-check.py"]},
                ),
            )
            catalog_root, _ = make_catalog(root, "Evaluate the candidate.\n")
            with self.assertRaisesRegex(m8.M8ConsumerError, "verification gate"):
                m8.create_evaluator_workspace(
                    candidate=candidate,
                    scenario_id=SCENARIO_ID,
                    output=root / "unverified-output",
                    rehearsal=True,
                    catalog_root=catalog_root,
                )
            self.assertFalse((root / "unverified-output").exists())

            plan = json.loads((candidate / release.PLAN_NAME).read_text(encoding="utf-8"))
            mark_verified(candidate, plan)
            staged_readme = candidate / "staging" / release.ARCHIVE_PREFIX / "README.md"
            staged_readme.write_text("tampered\n", encoding="utf-8")
            with self.assertRaisesRegex(release.ReleaseError, "differs from its plan"):
                m8.create_evaluator_workspace(
                    candidate=candidate,
                    scenario_id=SCENARIO_ID,
                    output=root / "tampered-output",
                    rehearsal=True,
                    catalog_root=catalog_root,
                )
            self.assertFalse((root / "tampered-output").exists())

    def test_output_boundaries_and_parent_traversal_are_rejected(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pui-m8-") as temporary:
            root = Path(temporary)
            repository = root / "repository"
            repository.mkdir()
            candidate, _ = make_candidate(
                root,
                official=True,
                request_text="Boundary request.\n",
            )
            catalog_root, _ = make_catalog(root, "Boundary request.\n")

            with self.assertRaisesRegex(m8.M8ConsumerError, "disjoint directories"):
                m8.create_evaluator_workspace(
                    candidate=candidate,
                    scenario_id=SCENARIO_ID,
                    output=repository / "evaluation-output",
                    catalog_root=catalog_root,
                    repository_root=repository,
                )
            traversal = root / "new-parent" / ".." / "escaped-output"
            with self.assertRaisesRegex(m8.M8ConsumerError, "parent traversal"):
                m8.create_evaluator_workspace(
                    candidate=candidate,
                    scenario_id=SCENARIO_ID,
                    output=traversal,
                    catalog_root=catalog_root,
                    repository_root=repository,
                )

    def test_linked_request_and_plan_path_traversal_are_rejected(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pui-m8-") as temporary:
            root = Path(temporary)
            candidate, _ = make_candidate(
                root,
                official=True,
                request_text="Linked request target.\n",
            )
            request_source = root / "request-source"
            request_source.mkdir()
            request = request_source / f"{SCENARIO_ID}.md"
            request.write_text("Linked request target.\n", encoding="utf-8")
            linked_catalog = root / "linked-catalog"
            linked_parent = linked_catalog / "evaluation" / "m8"
            linked_parent.mkdir(parents=True)
            linked_directory = linked_parent / "requests"
            make_directory_link(linked_directory, request_source)
            linked_catalog_document = {
                "schemaVersion": 1,
                "kind": "personal-ui-m8-scenarios",
                "scenarios": [
                    {
                        "id": SCENARIO_ID,
                        "request": {
                            "path": f"evaluation/m8/requests/{SCENARIO_ID}.md",
                            "sha256": release.sha256_bytes(request.read_bytes()),
                        },
                        "supportFixtureId": FIXTURE_ID,
                        "allowedDeliverables": ["consumer-project"],
                    }
                ],
            }
            (linked_catalog / m8.SCENARIO_CATALOG_PATH).write_bytes(
                json_bytes(linked_catalog_document)
            )
            try:
                with self.assertRaisesRegex(m8.M8ConsumerError, "symbolic link or junction"):
                    m8.create_evaluator_workspace(
                        candidate=candidate,
                        scenario_id=SCENARIO_ID,
                        output=root / "linked-output",
                        catalog_root=linked_catalog,
                    )
            finally:
                remove_directory_link(linked_directory)

            catalog_root, _ = make_catalog(
                root,
                "Linked request target.\n",
                name="normal-catalog",
            )

            plan_path = candidate / release.PLAN_NAME
            journal_path = candidate / release.JOURNAL_NAME
            plan = json.loads(plan_path.read_text(encoding="utf-8"))
            plan["artifacts"]["archive"]["path"] = "../escaped.zip"
            plan = release.attach_plan_digest(plan)
            plan_path.write_bytes(release.pretty_json_bytes(plan))
            journal = json.loads(journal_path.read_text(encoding="utf-8"))
            journal["planDigest"] = plan["planDigest"]
            journal_path.write_bytes(release.pretty_json_bytes(journal))
            with self.assertRaisesRegex(release.ReleaseError, "unsafe release path"):
                m8.create_evaluator_workspace(
                    candidate=candidate,
                    scenario_id=SCENARIO_ID,
                    output=root / "traversal-output",
                    catalog_root=catalog_root,
                )
            self.assertFalse((root / "traversal-output").exists())


if __name__ == "__main__":
    unittest.main()
