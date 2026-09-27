#!/usr/bin/env python3
"""Focused contracts for the production M8 acceptance assembler."""

from __future__ import annotations

import copy
import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import assemble_m8_acceptance as assembler
import release_personal_ui as release
import run_m8_migration as migration_runner
import test_validate_m8_evidence as evidence_fixture
import validate_m8_evidence as validator


SKILL_ROOT = Path(__file__).resolve().parent.parent


class M8AcceptanceAssemblerContracts(unittest.TestCase):
    candidate_temporary: tempfile.TemporaryDirectory[str]
    candidate_root: Path
    candidate: dict[str, object]
    candidate_files: dict[str, bytes]
    archive_bytes: bytes

    @classmethod
    def setUpClass(cls) -> None:
        cls.candidate_temporary = tempfile.TemporaryDirectory(prefix="pui-m8-assemble-candidate-")
        temporary = Path(cls.candidate_temporary.name)
        cls.candidate_root = temporary / "candidate"
        release.prepare_release(
            SKILL_ROOT,
            cls.candidate_root,
            candidate_version="0.3.0-rc.1",
            source_mode="commit",
            source_ref="HEAD",
            existing_versions=(),
        )
        release.verify_release(cls.candidate_root, command_runner=lambda argv, cwd: 0)
        plan, _ = release.load_candidate(cls.candidate_root)
        cls.candidate = assembler._candidate_binding(plan)
        cls.candidate_files = release.collect_staged_files(cls.candidate_root)
        archive = cls.candidate["archive"]
        assert isinstance(archive, dict)
        cls.archive_bytes = cls.candidate_root.joinpath(
            *Path(str(archive["path"])).parts
        ).read_bytes()

    @classmethod
    def tearDownClass(cls) -> None:
        cls.candidate_temporary.cleanup()

    def make_inputs(
        self, root: Path
    ) -> tuple[list[Path], Path, Path, dict[str, object]]:
        inputs = root / "inputs"
        inputs.mkdir()
        evidence = evidence_fixture.valid_evidence(
            inputs,
            candidate_binding=copy.deepcopy(self.candidate),
            archive_bytes=self.archive_bytes,
        )
        for scenario in evidence["scenarios"]:
            scenario_id = str(scenario["id"])
            run = scenario["run"]
            artifacts = run["artifacts"]
            prefix = Path(str(artifacts["visible-inputs"]["path"])).parent.as_posix()
            source_files = {
                "package.json": release.pretty_json_bytes(
                    {"name": f"m8-{scenario_id}", "scripts": {"dev": "vite"}}
                ),
                "src/App.tsx": f"export const scenario = {scenario_id!r};\n".encode("utf-8"),
            }
            source_zip = release.deterministic_zip_bytes(
                source_files, epoch=int(self.candidate["sourceDateEpoch"])
            )
            for stage, result_name, archive_name in (
                ("initial", "first-verification", "initial-source"),
                ("final", "final-verification", "final-source"),
            ):
                archive = evidence_fixture.artifact(
                    inputs, f"{prefix}/evidence/{stage}/source.zip", source_zip
                )
                inventory = evidence_fixture.artifact(
                    inputs,
                    f"{prefix}/evidence/{stage}/source-inventory.json",
                    {
                        "schemaVersion": 1,
                        "kind": "personal-ui-m8-source-inventory",
                        "contentDigest": release.digest_file_map(source_files),
                        "files": release.file_inventory(source_files),
                    },
                )
                result_path = inputs / str(artifacts[result_name]["path"])
                result = json.loads(result_path.read_text("utf-8"))
                result["sourceArchive"] = archive
                result["sourceInventory"] = inventory
                result_descriptor = evidence_fixture.artifact(
                    inputs, str(artifacts[result_name]["path"]), result
                )
                artifacts[archive_name] = archive
                artifacts[result_name] = result_descriptor
                if stage == "initial":
                    review_path = inputs / str(artifacts["organizer-review"]["path"])
                    review = json.loads(review_path.read_text("utf-8"))
                    review["initialResult"] = result_descriptor
                    artifacts["organizer-review"] = evidence_fixture.artifact(
                        inputs, str(artifacts["organizer-review"]["path"]), review
                    )
        fragments: list[Path] = []
        for scenario in evidence["scenarios"]:
            scenario_id = scenario["id"]
            path = inputs / "fragments" / f"{scenario_id}.json"
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(release.pretty_json_bytes(scenario))
            fragments.append(path)

        migration = inputs / "migration"
        baseline = {
            "version": "0.2.19",
            "tag": "v0.2.19",
            "commit": "e" * 40,
            "tree": "f" * 40,
        }
        source_files = {
            "package.json": release.pretty_json_bytes({"name": "migration-consumer"}),
            "src/App.tsx": b"export default function App() { return null; }\n",
        }
        for archive_name, inventory_name, phase in (
            ("baseline-consumer-source.zip", "baseline-consumer-source.json", "before-upgrade"),
            ("upgraded-consumer-source.zip", "upgraded-consumer-source.json", "after-upgrade"),
        ):
            (migration / "artifacts").mkdir(parents=True, exist_ok=True)
            migration_runner.write_deterministic_zip(
                migration / "artifacts" / archive_name, source_files
            )
            (migration / "artifacts" / inventory_name).write_bytes(
                release.pretty_json_bytes(
                    {
                        "schemaVersion": 1,
                        "kind": "personal-ui-m8-consumer-source-inventory",
                        "phase": phase,
                        "fileCount": len(source_files),
                        "contentDigest": release.digest_file_map(source_files),
                        "files": release.file_inventory(source_files),
                    }
                )
            )
        migration_candidate = validator._candidate_summary(self.candidate)
        (migration / "artifacts/candidate-input-inventory.json").write_bytes(
            release.pretty_json_bytes(
                {
                    "schemaVersion": 1,
                    "kind": "personal-ui-m8-migration-candidate-input",
                    "candidate": migration_candidate,
                    "fileCount": len(self.candidate_files),
                    "contentDigest": release.digest_file_map(self.candidate_files),
                    "files": release.file_inventory(self.candidate_files),
                }
            )
        )
        (migration / "artifacts/migration-diff.patch").write_text("diff --git a/src/App.tsx b/src/App.tsx\n", encoding="utf-8")
        (migration / "artifacts/conflict-report.json").write_bytes(
            release.pretty_json_bytes({"result": "expected-conflict"})
        )
        (migration / "artifacts/rollback-report.json").write_bytes(
            release.pretty_json_bytes(
                {"result": "expected-failure", "restoredExactProjectSnapshot": True}
            )
        )
        command_paths: list[str] = []
        for index, label in enumerate(assembler.MIGRATION_COMMAND_LABELS, start=1):
            stem = f"{index:02d}-{label}"
            stdout_relative = f"artifacts/commands/{stem}.stdout.log"
            stderr_relative = f"artifacts/commands/{stem}.stderr.log"
            stdout = b"passed\n"
            stderr = b""
            (migration / stdout_relative).parent.mkdir(parents=True, exist_ok=True)
            (migration / stdout_relative).write_bytes(stdout)
            (migration / stderr_relative).write_bytes(stderr)
            return_code = 0
            if label == "pre-migration-build":
                return_code = 1
            elif label == "modified-owned-file-conflict":
                return_code = 3
            elif label == "injected-failure-rollback":
                return_code = migration_runner.FAILURE_EXIT_CODE
            command_relative = f"artifacts/commands/{stem}.json"
            (migration / command_relative).write_bytes(
                release.pretty_json_bytes(
                    {
                        "schemaVersion": 1,
                        "kind": "personal-ui-m8-migration-command",
                        "label": label,
                        "argv": ["fixture", label],
                        "cwd": "$M8_MIGRATION_ROOT/workspaces/consumer",
                        "returnCode": return_code,
                        "durationSeconds": 0.1,
                        "stdout": {
                            "path": stdout_relative,
                            "sha256": release.sha256_bytes(stdout),
                        },
                        "stderr": {
                            "path": stderr_relative,
                            "sha256": release.sha256_bytes(stderr),
                        },
                    }
                )
            )
            command_paths.append(command_relative)
        report = {
            "schemaVersion": 1,
            "kind": migration_runner.REPORT_KIND,
            "result": "passed",
            "recordedAt": evidence_fixture.TIMESTAMP,
            "candidate": migration_candidate,
            "baseline": baseline,
            "checks": {name: "passed" for name in validator.MIGRATION_REPORT_CHECKS},
            "source": {
                "beforeArchive": "artifacts/baseline-consumer-source.zip",
                "afterArchive": "artifacts/upgraded-consumer-source.zip",
                "diff": "artifacts/migration-diff.patch",
            },
            "commands": command_paths,
            "artifactInventory": "artifact-inventory.json",
        }
        (migration / "migration-report.json").write_bytes(release.pretty_json_bytes(report))
        migration_runner.create_artifact_inventory(
            migration,
            candidate=migration_candidate,
            baseline=baseline,
        )
        raw_artifacts: list[dict[str, object]] = []
        scenario_evidence = {str(item["id"]): item for item in evidence["scenarios"]}

        def raw_artifact(
            scenario_id: str, role: str, content: bytes, *, source_path: str | None = None
        ) -> dict[str, object]:
            source = source_path or f"producer/{role}.bin"
            descriptor = evidence_fixture.artifact(
                inputs,
                f"quality/raw/{scenario_id}/workspace/{source}",
                content,
            )
            descriptor.update(
                {"scenarioId": scenario_id, "roles": [role], "sourcePath": source}
            )
            raw_artifacts.append(descriptor)
            return descriptor

        for quality_summary in evidence["qualityMatrix"]["scenarios"]:
            scenario_id = str(quality_summary["id"])
            run_artifacts = scenario_evidence[scenario_id]["run"]["artifacts"]
            visible_path = inputs / str(run_artifacts["visible-inputs"]["path"])
            raw_artifact(
                scenario_id,
                "visible-inputs",
                visible_path.read_bytes(),
                source_path="visible-inputs.json",
            )
            source_report = raw_artifact(
                scenario_id,
                "scenario-quality-report",
                release.pretty_json_bytes({"scenarioId": scenario_id, "result": "passed"}),
                source_path="quality-report.json",
            )
            for role in (
                "evaluator-run-start",
                "evaluator-request",
                "evaluator-final-result",
                "evaluator-final-sourceArchive",
                "evaluator-final-sourceInventory",
                "evaluator-final-verification",
                "browser-version-report",
            ):
                raw_artifact(scenario_id, role, f"{scenario_id}:{role}\n".encode("utf-8"))
            commands: list[dict[str, object]] = []
            for purpose in ("typecheck", "build", "verifier", "browser-quality"):
                stdout = raw_artifact(
                    scenario_id,
                    f"command-{purpose}-stdout",
                    f"{purpose} passed\n".encode("utf-8"),
                )
                stderr = raw_artifact(
                    scenario_id, f"command-{purpose}-stderr", b""
                )
                commands.append(
                    {
                        "purpose": purpose,
                        "argv": ["npm", "run", purpose],
                        "cwd": "consumer/project",
                        "exitCode": 0,
                        "startedAt": evidence_fixture.TIMESTAMP,
                        "endedAt": evidence_fixture.TIMESTAMP,
                        "stdoutSha256": stdout["sha256"],
                        "stderrSha256": stderr["sha256"],
                    }
                )
            record_path = inputs / str(quality_summary["artifact"]["path"])
            record = json.loads(record_path.read_text("utf-8"))
            record["sourceReportSha256"] = source_report["sha256"]
            record["commands"] = commands
            for measurement in record["measurements"]:
                engine = str(measurement["engine"])
                width = int(measurement["width"])
                role_prefix = f"{engine}-{width}"
                retained = {
                    role: raw_artifact(
                        scenario_id,
                        f"{role_prefix}-{role}",
                        f"{scenario_id}:{role_prefix}:{role}\n".encode("utf-8"),
                    )
                    for role in ("behavior", "axe", "responsive", "screenshot")
                }
                measurement["rawArtifactSha256"] = {
                    role: retained[role]["sha256"]
                    for role in ("behavior", "axe", "responsive")
                }
                measurement["screenshot"] = {"sha256": retained["screenshot"]["sha256"]}
            quality_summary["artifact"] = evidence_fixture.artifact(
                inputs, str(quality_summary["artifact"]["path"]), record
            )
        raw_inventory = evidence_fixture.artifact(
            inputs,
            "quality/raw-artifact-inventory.json",
            {
                "schemaVersion": 1,
                "kind": assembler.QUALITY_RAW_INVENTORY_KIND,
                "result": "passed",
                "candidate": validator._candidate_summary(self.candidate),
                "artifactCount": len(raw_artifacts),
                "artifacts": raw_artifacts,
            },
        )
        evidence["qualityMatrix"]["artifacts"]["rawEvidence"] = raw_inventory
        quality_fragment = inputs / assembler.FRAGMENT_NAME
        quality_fragment.write_bytes(release.pretty_json_bytes(evidence["qualityMatrix"]))
        review_inputs = {
            "schemaVersion": 1,
            "kind": assembler.REVIEW_INPUTS_KIND,
            "candidate": validator._candidate_summary(self.candidate),
            "knownLimitations": [
                {
                    "id": "public-release-pending",
                    "status": "accepted",
                    "summary": "The local RC is not an immutable public release.",
                    "evidence": ["M8-06 requires separate explicit authorization."],
                }
            ],
            "previews": [
                {
                    "id": scenario["id"],
                    "sourceArchiveSha256": scenario["run"]["artifacts"]["final-source"]["sha256"],
                    "installArgv": ["npm", "ci"],
                    "startArgv": ["npm", "run", "dev", "--", "--host", "127.0.0.1"],
                }
                for scenario in evidence["scenarios"]
            ],
        }
        (inputs / "review-inputs.json").write_bytes(release.pretty_json_bytes(review_inputs))
        return fragments, migration, quality_fragment, evidence

    def assemble(self, root: Path) -> tuple[Path, dict[str, object]]:
        fragments, migration, quality, source_evidence = self.make_inputs(root)
        output = root / "assembled"
        assembler.assemble(
            candidate_path=self.candidate_root,
            scenario_inputs=[(root / "inputs", path) for path in fragments],
            migration_bundle=migration,
            quality_bundle=quality,
            review_inputs=root / "inputs/review-inputs.json",
            output=output,
        )
        return output, source_evidence

    def test_complete_bundle_is_accepted_and_candidate_materials_are_exact(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pui-m8-assemble-") as temporary:
            root = Path(temporary)
            output, _ = self.assemble(root)
            result = validator.validate_m8_evidence_file(
                output / assembler.ACCEPTANCE_NAME,
                expected_bindings={
                    "planDigest": self.candidate["planDigest"],
                    "sourceCommit": self.candidate["sourceCommit"],
                    "archiveSha256": self.candidate["archive"]["sha256"],
                },
                bundle_root=output,
            )
            self.assertTrue(result.accepted, result.errors)
            archive_name = Path(str(self.candidate["archive"]["path"])).name
            self.assertEqual(
                (output / "review" / archive_name).read_bytes(), self.archive_bytes
            )
            self.assertEqual(
                (output / "review/CHANGELOG.md").read_bytes(),
                self.candidate_files["CHANGELOG.md"],
            )
            self.assertEqual(
                (output / "review/v0.3.0-migrations.md").read_bytes(),
                self.candidate_files["references/v0.3.0-migrations.md"],
            )
            self.assertEqual(
                (output / "review/support-matrix.json").read_bytes(),
                self.candidate_files["references/support-matrix.json"],
            )
            checksums = self.candidate_root / "artifacts/SHA256SUMS"
            self.assertEqual(
                (output / "review/SHA256SUMS").read_bytes(), checksums.read_bytes()
            )
            report = json.loads(
                (output / "review/independent-consumer-report.json").read_text("utf-8")
            )
            self.assertEqual(len(report["definitionOfDone"]), 10)
            self.assertEqual(
                [item["id"] for item in report["definitionOfDone"]],
                [
                    "runtime-exports",
                    "examples-and-usage-docs",
                    "interactive-keyboard-and-a11y-ownership",
                    "maintained-example-axe",
                    "typescript-verifier-policy",
                    "forms-modals-widgets-themes-portals",
                    "three-engines-six-widths",
                    "clean-clone-and-release-reproduction",
                    "source-license-release-identity",
                    "user-review-and-authorization",
                ],
            )
            self.assertEqual(report["definitionOfDone"][-1]["status"], "pending-explicit-authorization")
            limitations = (output / "review/known-limitations.md").read_text("utf-8")
            self.assertIn("The local RC is not an immutable public release.", limitations)
            preview = (output / "review/preview-instructions.md").read_text("utf-8")
            self.assertIn("python -m zipfile -e", preview)
            self.assertIn("npm ci", preview)
            self.assertIn("npm run dev", preview)

    def test_candidate_requires_the_exact_formal_verification_command_set(self) -> None:
        plan, _ = release.load_candidate(self.candidate_root)
        thin = copy.deepcopy(plan)
        thin["verificationCommands"] = []
        with mock.patch.object(
            assembler.migration_runner,
            "load_verified_candidate",
            return_value=(thin, self.candidate_files, self.candidate_root / "staging/ui-builder-xtn"),
        ):
            with self.assertRaisesRegex(assembler.AssemblyError, "frozen formal verification"):
                assembler._load_candidate(self.candidate_root)

    def test_explicit_scenario_root_never_searches_parent_directories(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pui-m8-root-boundary-") as temporary:
            parent = Path(temporary)
            explicit = parent / "workspace"
            explicit.mkdir()
            fragment = explicit / "fragment.json"
            fragment.write_text("{}\n", encoding="utf-8")
            retained = parent / "evidence/artifact.json"
            retained.parent.mkdir()
            retained.write_text("{}\n", encoding="utf-8")
            descriptor = {
                "path": "evidence/artifact.json",
                "size": retained.stat().st_size,
                "sha256": release.sha256_bytes(retained.read_bytes()),
            }
            with self.assertRaisesRegex(assembler.AssemblyError, "does not exist"):
                assembler._validate_artifact_root(
                    explicit, fragment, [descriptor], label="scenario fragment"
                )

    def test_scenario_source_zip_must_match_its_inventory(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pui-m8-source-freeze-") as temporary:
            root = Path(temporary)
            archive = evidence_fixture.artifact(
                root,
                "evidence/final/source.zip",
                release.deterministic_zip_bytes(
                    {"src/App.tsx": b"export default 1;\n"}, epoch=1_800_000_001
                ),
            )
            inventory = evidence_fixture.artifact(
                root,
                "evidence/final/source-inventory.json",
                {
                    "schemaVersion": 1,
                    "kind": "personal-ui-m8-source-inventory",
                    "contentDigest": release.digest_file_map({"src/App.tsx": b"different\n"}),
                    "files": release.file_inventory({"src/App.tsx": b"different\n"}),
                },
            )
            result = evidence_fixture.artifact(
                root,
                "evidence/final/result.json",
                {"sourceArchive": archive, "sourceInventory": inventory},
            )
            with self.assertRaisesRegex(assembler.AssemblyError, "does not match"):
                assembler._validate_scenario_source_freeze(
                    root, result, archive, label="scenario final"
                )

    def test_migration_command_cannot_fall_back_to_synthetic_verification(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pui-m8-command-fallback-") as temporary:
            root = Path(temporary)
            fallback = root / "artifacts/baseline-verification.json"
            fallback.parent.mkdir(parents=True)
            fallback.write_text('{"result":"passed"}\n', encoding="utf-8")
            with self.assertRaisesRegex(assembler.AssemblyError, "absent from the official inventory"):
                assembler._migration_command_artifact(
                    root,
                    "artifacts/commands/08-baseline-verifier.json",
                    expected_label="baseline-verifier",
                    inventory_entries={},
                )

    def test_placeholder_or_failed_scenario_is_rejected_atomically(self) -> None:
        for mutation, message in (
            (lambda value: value["run"].update(summary="TODO"), "placeholder"),
            (lambda value: value.update(result="failed"), "not passed"),
        ):
            with self.subTest(message=message), tempfile.TemporaryDirectory(
                prefix="pui-m8-assemble-scenario-"
            ) as temporary:
                root = Path(temporary)
                fragments, migration, quality, _ = self.make_inputs(root)
                value = json.loads(fragments[0].read_text("utf-8"))
                mutation(value)
                fragments[0].write_bytes(release.pretty_json_bytes(value))
                output = root / "assembled"
                with self.assertRaisesRegex(assembler.AssemblyError, message):
                    assembler.assemble(
                        candidate_path=self.candidate_root,
                        scenario_inputs=[(root / "inputs", path) for path in fragments],
                        migration_bundle=migration,
                        quality_bundle=quality,
                        review_inputs=root / "inputs/review-inputs.json",
                        output=output,
                    )
                self.assertFalse(output.exists())

    def test_quality_binding_mismatch_is_rejected_atomically(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pui-m8-assemble-quality-") as temporary:
            root = Path(temporary)
            fragments, migration, quality, _ = self.make_inputs(root)
            value = json.loads(quality.read_text("utf-8"))
            value["candidate"]["archiveSha256"] = "0" * 64
            quality.write_bytes(release.pretty_json_bytes(value))
            output = root / "assembled"
            with self.assertRaisesRegex(assembler.AssemblyError, "another candidate"):
                assembler.assemble(
                    candidate_path=self.candidate_root,
                    scenario_inputs=[(root / "inputs", path) for path in fragments],
                    migration_bundle=migration,
                    quality_bundle=quality,
                    review_inputs=root / "inputs/review-inputs.json",
                    output=output,
                )
            self.assertFalse(output.exists())

    def test_uninventoried_raw_quality_artifact_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pui-m8-assemble-raw-") as temporary:
            root = Path(temporary)
            fragments, migration, quality, _ = self.make_inputs(root)
            extra = root / "inputs/quality/raw/uninventoried.log"
            extra.write_text("not retained\n", encoding="utf-8")
            with self.assertRaisesRegex(assembler.AssemblyError, "does not exactly cover"):
                assembler.assemble(
                    candidate_path=self.candidate_root,
                    scenario_inputs=[(root / "inputs", path) for path in fragments],
                    migration_bundle=migration,
                    quality_bundle=quality,
                    review_inputs=root / "inputs/review-inputs.json",
                    output=root / "assembled",
                )

    def test_tampered_migration_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pui-m8-assemble-migration-") as temporary:
            root = Path(temporary)
            fragments, migration, quality, _ = self.make_inputs(root)
            (migration / "artifacts/migration-diff.patch").write_text(
                "tampered\n", encoding="utf-8"
            )
            with self.assertRaisesRegex(assembler.AssemblyError, "hash mismatch"):
                assembler.assemble(
                    candidate_path=self.candidate_root,
                    scenario_inputs=[(root / "inputs", path) for path in fragments],
                    migration_bundle=migration,
                    quality_bundle=quality,
                    review_inputs=root / "inputs/review-inputs.json",
                    output=root / "assembled",
                )

    def test_linked_fragment_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pui-m8-assemble-link-") as temporary:
            root = Path(temporary)
            fragments, migration, quality, _ = self.make_inputs(root)
            linked = root / "linked-fragment.json"
            linked.write_bytes(fragments[0].read_bytes())
            fragments[0] = linked
            original = assembler._traverses_link
            with mock.patch.object(
                assembler,
                "_traverses_link",
                side_effect=lambda path: Path(path).resolve() == linked.resolve()
                or original(Path(path)),
            ):
                with self.assertRaisesRegex(assembler.AssemblyError, "link or junction"):
                    assembler.assemble(
                        candidate_path=self.candidate_root,
                        scenario_inputs=[(root / "inputs", path) for path in fragments],
                        migration_bundle=migration,
                        quality_bundle=quality,
                        review_inputs=root / "inputs/review-inputs.json",
                        output=root / "assembled",
                    )


if __name__ == "__main__":
    unittest.main()
