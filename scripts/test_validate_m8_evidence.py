#!/usr/bin/env python3
"""Focused contracts for file-backed M8 acceptance evidence."""

from __future__ import annotations

import copy
import hashlib
import io
import json
import os
import tempfile
import unittest
import zipfile
from pathlib import Path

import validate_m8_evidence as validator


TIMESTAMP = "2026-09-27T10:00:00Z"


def json_bytes(value: object) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def artifact(root: Path, relative: str, content: bytes | str | object) -> dict[str, object]:
    path = root.joinpath(*relative.split("/"))
    path.parent.mkdir(parents=True, exist_ok=True)
    if isinstance(content, str):
        data = content.encode("utf-8")
    elif isinstance(content, bytes):
        data = content
    else:
        data = json_bytes(content)
    path.write_bytes(data)
    return {
        "path": relative,
        "size": len(data),
        "sha256": hashlib.sha256(data).hexdigest(),
    }


def rewrite_artifact(
    root: Path,
    descriptor: dict[str, object],
    content: bytes | str | object,
) -> None:
    if isinstance(content, str):
        data = content.encode("utf-8")
    elif isinstance(content, bytes):
        data = content
    else:
        data = json_bytes(content)
    root.joinpath(*str(descriptor["path"]).split("/")).write_bytes(data)
    descriptor["size"] = len(data)
    descriptor["sha256"] = hashlib.sha256(data).hexdigest()


def candidate_archive_bytes(files: dict[str, bytes]) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_STORED) as archive:
        for relative, content in sorted(files.items()):
            archive.writestr(f"ui-builder-xtn/{relative}", content)
    return buffer.getvalue()


def valid_evidence(
    root: Path,
    *,
    candidate_binding: dict[str, object] | None = None,
    archive_bytes: bytes | None = None,
) -> dict[str, object]:
    request_bytes = {
        scenario_id: f"Request for {scenario_id}.\n".encode("utf-8")
        for scenario_id in validator.M8_SCENARIOS
    }
    rules_document = {
        "schemaVersion": 1,
        "kind": "personal-ui-m8-acceptance-rules",
        "visibility": "organizer-only",
        "attributionEnum": list(validator.M8_ATTRIBUTIONS[1:]),
        "scenarioRules": [
            {
                "id": scenario_id,
                "checks": {
                    "behavior": ["Retained behavior review."],
                    "source": ["Retained source review."],
                    "accessibility": ["Retained accessibility review."],
                    "responsive": ["Retained responsive review."],
                },
            }
            for scenario_id in validator.M8_SCENARIOS
        ],
    }
    scenario_document = {
        "schemaVersion": 1,
        "kind": "personal-ui-m8-scenarios",
        "scenarios": [
            {
                "id": scenario_id,
                "request": {
                    "path": f"evaluation/m8/requests/{scenario_id}.md",
                    "sha256": hashlib.sha256(request_bytes[scenario_id]).hexdigest(),
                },
                "supportFixtureId": f"fixture-{index}",
                "allowedDeliverables": ["consumer-project", "verification-record"],
            }
            for index, scenario_id in enumerate(validator.M8_SCENARIOS, start=1)
        ],
    }
    rules_bytes = json_bytes(rules_document)
    changelog_bytes = b"# Changelog\n\n## 0.3.0-rc.1\n\n- Candidate review.\n"
    migration_guide_bytes = b"# v0.3.0 migration\n\nUpgrade from 0.2.19 to 0.3.0-rc.1.\n"
    support_matrix_bytes = json_bytes(
        {
            "schemaVersion": 1,
            "kind": "personal-ui-support-matrix",
            "baseline": {"version": "0.2.19"},
        }
    )
    candidate_files = {
        "evaluation/m8/scenarios.json": json_bytes(scenario_document),
        "evaluation/m8/acceptance-rules.json": rules_bytes,
        "CHANGELOG.md": changelog_bytes,
        "references/v0.3.0-migrations.md": migration_guide_bytes,
        "references/support-matrix.json": support_matrix_bytes,
    }
    candidate_files.update(
        {
            f"evaluation/m8/requests/{scenario_id}.md": content
            for scenario_id, content in request_bytes.items()
        }
    )
    if archive_bytes is not None:
        with zipfile.ZipFile(io.BytesIO(archive_bytes), "r") as archive_reader:
            candidate_files = {
                str(Path(name).as_posix()).removeprefix("ui-builder-xtn/"): archive_reader.read(name)
                for name in archive_reader.namelist()
            }
        scenario_document = json.loads(candidate_files["evaluation/m8/scenarios.json"])
        rules_bytes = candidate_files["evaluation/m8/acceptance-rules.json"]
        request_bytes = {
            item["id"]: candidate_files[item["request"]["path"]]
            for item in scenario_document["scenarios"]
        }
        changelog_bytes = candidate_files["CHANGELOG.md"]
        migration_guide_bytes = candidate_files["references/v0.3.0-migrations.md"]
        support_matrix_bytes = candidate_files["references/support-matrix.json"]
    archive_content = archive_bytes if archive_bytes is not None else candidate_archive_bytes(candidate_files)
    archive = artifact(root, "review/candidate.zip", archive_content)
    candidate = copy.deepcopy(candidate_binding) if candidate_binding is not None else {
        "version": "0.3.0-rc.1",
        "planDigest": "a" * 64,
        "sourceCommit": "b" * 40,
        "sourceContentDigest": "c" * 64,
        "sourceDateEpoch": 1_800_000_001,
        "candidateContentDigest": "d" * 64,
        "archive": {
            "path": "artifacts/ui-builder-xtn-0.3.0-rc.1.zip",
            "size": archive["size"],
            "sha256": archive["sha256"],
        },
    }
    scenarios: list[dict[str, object]] = []
    actual_environment = {
        "operatingSystem": "Windows 11",
        "architecture": "x64",
        "node": "22.12.0",
        "packageManager": "npm 10.9.3",
        "browser": "Chromium 140 / Firefox 142 / WebKit 26",
        "python": "3.13.7",
        "installerCommand": "python install_personal_ui.py install",
    }
    for index, scenario_id in enumerate(validator.M8_SCENARIOS, start=1):
        prefix = f"runs/{scenario_id}"
        run_id = f"m8-{scenario_id}-00000000-0000-4000-8000-{index:012d}"
        candidate_scenario = next(
            item for item in scenario_document["scenarios"] if item["id"] == scenario_id
        )
        fixture_id = candidate_scenario["supportFixtureId"]
        request = artifact(root, f"{prefix}/request.md", request_bytes[scenario_id])
        rules = artifact(
            root,
            f"{prefix}/evidence/review/acceptance-rules.json",
            rules_bytes,
        )
        visible = artifact(
            root,
            f"{prefix}/visible-inputs.json",
            {
                "schemaVersion": 1,
                "kind": "personal-ui-m8-evaluator-inputs",
                "official": True,
                "run": {"id": run_id, "createdAt": TIMESTAMP},
                "candidate": candidate,
                "scenario": {
                    "id": scenario_id,
                    "catalogSha256": hashlib.sha256(candidate_files["evaluation/m8/scenarios.json"]).hexdigest(),
                    "requestPath": f"evaluation/m8/requests/{scenario_id}.md",
                    "requestSha256": hashlib.sha256(request_bytes[scenario_id]).hexdigest(),
                    "supportFixtureId": fixture_id,
                    "allowedDeliverables": candidate_scenario["allowedDeliverables"],
                },
                "organizerBindings": {
                    "acceptanceRules": {
                        "path": "evaluation/m8/acceptance-rules.json",
                        "size": rules["size"],
                        "sha256": rules["sha256"],
                    }
                },
                "request": {
                    "path": "request.md",
                    "size": request["size"],
                    "sha256": request["sha256"],
                },
                "inputPolicy": {
                    "firstInputsFrozen": True,
                    "overwriteAllowed": False,
                    "readOnly": True,
                    "postWriteVerified": True,
                },
            },
        )
        stdout = artifact(root, f"{prefix}/evidence/logs/0001.stdout", "passed\n")
        stderr = artifact(root, f"{prefix}/evidence/logs/0001.stderr", b"")
        command = artifact(
            root,
            f"{prefix}/evidence/commands/0001.json",
            {
                "schemaVersion": 1,
                "kind": "personal-ui-m8-command",
                "runId": run_id,
                "sequence": 1,
                "argv": ["npm", "run", "build"],
                "cwd": "consumer/project",
                "exitCode": 0,
                "startedAt": TIMESTAMP,
                "endedAt": TIMESTAMP,
                "stdout": stdout,
                "stderr": stderr,
            },
        )
        run_start = artifact(
            root,
            f"{prefix}/evidence/run-start.json",
            {
                "schemaVersion": 1,
                "kind": "personal-ui-m8-run-start",
                "runId": run_id,
                "scenarioId": scenario_id,
                "startedAt": TIMESTAMP,
                "candidate": candidate,
                "fixtureId": fixture_id,
                "actualEnvironment": actual_environment,
                "visibleInputs": visible,
                "request": request,
            },
        )
        initial_source = artifact(root, f"{prefix}/evidence/initial/source.zip", b"initial")
        initial_inventory = artifact(
            root,
            f"{prefix}/evidence/initial/source-inventory.json",
            {
                "schemaVersion": 1,
                "kind": "personal-ui-m8-source-inventory",
                "contentDigest": "1" * 64,
                "files": [{"path": "src/App.tsx", "size": 1, "sha256": "2" * 64}],
            },
        )
        initial_verification = artifact(
            root,
            f"{prefix}/evidence/initial/verification.json",
            {"result": "passed", "checks": {name: "passed" for name in validator.M8_CHECKS}},
        )
        initial = artifact(
            root,
            f"{prefix}/evidence/initial/result.json",
            {
                "schemaVersion": 1,
                "kind": "personal-ui-m8-initial-result",
                "runId": run_id,
                "result": "passed",
                "frozenAt": TIMESTAMP,
                "checks": {name: "passed" for name in validator.M8_CHECKS},
                "sourceArchive": initial_source,
                "sourceInventory": initial_inventory,
                "verification": initial_verification,
            },
        )
        review = artifact(
            root,
            f"{prefix}/evidence/review/review.json",
            {
                "schemaVersion": 1,
                "kind": "personal-ui-m8-organizer-review",
                "runId": run_id,
                "result": "passed",
                "attribution": "none",
                "reviewedAt": TIMESTAMP,
                "observations": ["All organizer checks passed."],
                "acceptanceRules": rules,
                "initialResult": initial,
            },
        )
        command_index = artifact(
            root,
            f"{prefix}/evidence/command-index.json",
            {
                "schemaVersion": 1,
                "kind": "personal-ui-m8-command-index",
                "runId": run_id,
                "commands": [command],
            },
        )
        repair_trace = artifact(
            root,
            f"{prefix}/evidence/repair-trace.json",
            {
                "schemaVersion": 1,
                "kind": "personal-ui-m8-repair-trace",
                "runId": run_id,
                "repairs": [],
            },
        )
        final_source = artifact(root, f"{prefix}/evidence/final/source.zip", b"final")
        final_inventory = artifact(
            root,
            f"{prefix}/evidence/final/source-inventory.json",
            {
                "schemaVersion": 1,
                "kind": "personal-ui-m8-source-inventory",
                "contentDigest": "3" * 64,
                "files": [{"path": "src/App.tsx", "size": 1, "sha256": "4" * 64}],
            },
        )
        final_verification = artifact(
            root,
            f"{prefix}/evidence/final/verification.json",
            {"result": "passed", "checks": {name: "passed" for name in validator.M8_CHECKS}},
        )
        final = artifact(
            root,
            f"{prefix}/evidence/final/result.json",
            {
                "schemaVersion": 1,
                "kind": "personal-ui-m8-final-result",
                "runId": run_id,
                "result": "passed",
                "frozenAt": TIMESTAMP,
                "checks": {name: "passed" for name in validator.M8_CHECKS},
                "sourceArchive": final_source,
                "sourceInventory": final_inventory,
                "verification": final_verification,
            },
        )
        scenarios.append(
            {
                "id": scenario_id,
                "result": "passed",
                "run": {
                    "runId": run_id,
                    "summary": f"Independent first-pass evidence for {scenario_id}.",
                    "freshContext": True,
                    "forbiddenInputsAbsent": True,
                    "attribution": "none",
                    "startedAt": TIMESTAMP,
                    "endedAt": TIMESTAMP,
                    "environment": {
                        "fixtureId": fixture_id,
                        "actual": actual_environment,
                    },
                    "commands": [command],
                    "firstResult": {"status": "passed", "frozenAt": TIMESTAMP},
                    "review": {
                        "status": "passed",
                        "reviewedAt": TIMESTAMP,
                        "observations": ["All organizer checks passed."],
                    },
                    "repairs": [],
                    "finalResult": {"status": "passed", "frozenAt": TIMESTAMP},
                    "artifacts": {
                        "request": request,
                        "visible-inputs": visible,
                        "run-start": run_start,
                        "initial-source": initial_source,
                        "first-verification": initial,
                        "command-index": command_index,
                        "organizer-review": review,
                        "repair-trace": repair_trace,
                        "final-source": final_source,
                        "final-verification": final,
                    },
                    "checks": {name: "passed" for name in validator.M8_CHECKS},
                },
            }
        )

    migration_artifacts = {
        "baselineSource": artifact(root, "migration/artifacts/baseline-consumer-source.zip", b"baseline source"),
        "baselineVerification": artifact(root, "migration/artifacts/baseline-verification.json", {"result": "passed"}),
        "upgradeDiff": artifact(root, "migration/artifacts/migration-diff.patch", "diff --git a/src/App.tsx b/src/App.tsx\n"),
        "conflictReport": artifact(root, "migration/artifacts/conflict-report.json", {"result": "expected-conflict"}),
        "rollbackReport": artifact(root, "migration/artifacts/rollback-report.json", {"result": "expected-failure", "restoredExactProjectSnapshot": True}),
        "finalSource": artifact(root, "migration/artifacts/upgraded-consumer-source.zip", b"upgraded source"),
        "finalVerification": artifact(root, "migration/artifacts/final-verification.json", {"result": "passed"}),
    }
    migration_candidate = {
        "version": candidate["version"],
        "planDigest": candidate["planDigest"],
        "sourceCommit": candidate["sourceCommit"],
        "archiveSha256": candidate["archive"]["sha256"],
        "candidateContentDigest": candidate["candidateContentDigest"],
    }
    migration_baseline = {
        "version": "0.2.19",
        "tag": "v0.2.19",
        "commit": "e" * 40,
        "tree": "f" * 40,
    }
    migration_report = artifact(
        root,
        "migration/migration-report.json",
        {
            "schemaVersion": 1,
            "kind": "personal-ui-m8-migration-report",
            "result": "passed",
            "recordedAt": TIMESTAMP,
            "candidate": migration_candidate,
            "baseline": migration_baseline,
            "checks": {
                name: "passed"
                for name in validator.MIGRATION_REPORT_CHECKS
            },
            "source": {
                "beforeArchive": "artifacts/baseline-consumer-source.zip",
                "afterArchive": "artifacts/upgraded-consumer-source.zip",
                "diff": "artifacts/migration-diff.patch",
            },
            "commands": [{"label": "baseline-build"}, {"label": "post-upgrade-build"}],
            "artifactInventory": "artifact-inventory.json",
        },
    )
    migration_inventory_entries = [migration_report, *migration_artifacts.values()]
    migration_inventory = artifact(
        root,
        "migration/artifact-inventory.json",
        {
            "schemaVersion": 1,
            "kind": "personal-ui-m8-migration-artifact-inventory",
            "result": "passed",
            "candidate": migration_candidate,
            "baseline": migration_baseline,
            "artifactCount": len(migration_inventory_entries),
            "artifacts": [
                {
                    "path": str(item["path"]).removeprefix("migration/"),
                    "size": item["size"],
                    "sha256": item["sha256"],
                }
                for item in migration_inventory_entries
            ],
        },
    )
    quality_scenarios = [
        {
            "id": scenario_id,
            "widths": list(validator.REQUIRED_WIDTHS),
            "engines": list(validator.REQUIRED_ENGINES),
            "checks": {"behavior": "passed", "a11y": "passed", "responsive": "passed"},
            "artifact": artifact(
                root,
                f"quality/{scenario_id}.json",
                {
                    "schemaVersion": 1,
                    "kind": "personal-ui-m8-quality-scenario",
                    "scenarioId": scenario_id,
                    "result": "passed",
                    "candidate": migration_candidate,
                    "widths": list(validator.REQUIRED_WIDTHS),
                    "engines": list(validator.REQUIRED_ENGINES),
                    "checks": {"behavior": "passed", "a11y": "passed", "responsive": "passed"},
                    "measurements": [
                        {
                            "width": width,
                            "engine": engine,
                            "behavior": "passed",
                            "a11y": "passed",
                            "responsive": "passed",
                        }
                        for engine in validator.REQUIRED_ENGINES
                        for width in validator.REQUIRED_WIDTHS
                    ],
                },
            ),
        }
        for scenario_id in validator.M8_SCENARIOS
    ]
    quality_artifacts = {
        "matrix": artifact(
            root,
            "quality/matrix.json",
            {
                "schemaVersion": 1,
                "kind": "personal-ui-m8-quality-matrix",
                "result": "passed",
                "candidate": migration_candidate,
                "widths": list(validator.REQUIRED_WIDTHS),
                "engines": list(validator.REQUIRED_ENGINES),
                "scenarios": list(validator.M8_SCENARIOS),
            },
        ),
        "browserVersions": artifact(
            root,
            "quality/browserVersions.json",
            {
                "schemaVersion": 1,
                "kind": "personal-ui-m8-browser-versions",
                "candidate": migration_candidate,
                "browsers": [
                    {"project": engine, "version": f"{index}.0", "realSafari": False}
                    for index, engine in enumerate(validator.REQUIRED_ENGINES, start=1)
                ],
            },
        ),
        "responsiveReview": artifact(
            root,
            "quality/responsiveReview.json",
            {
                "schemaVersion": 1,
                "kind": "personal-ui-m8-responsive-review",
                "result": "passed",
                "candidate": migration_candidate,
                "widths": list(validator.REQUIRED_WIDTHS),
                "scenarios": list(validator.M8_SCENARIOS),
            },
        ),
    }
    safari = artifact(
        root,
        "quality/safari.json",
        {
            "schemaVersion": 1,
            "kind": "personal-ui-real-safari-smoke",
            "result": "passed",
            "safari": {
                "product": "Safari",
                "browserName": "safari",
                "version": "18.6",
                "majorVersion": 18,
                "capabilityVersion": "18.6",
                "userAgent": "Version/18.6 Safari/605.1.15",
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
    )
    axe = artifact(
        root,
        "quality/axe.json",
        {
            "schemaVersion": 1,
            "kind": "personal-ui-m8-axe-report",
            "result": "passed",
            "candidate": migration_candidate,
            "critical": 0,
            "serious": 0,
            "scenarios": [
                {"id": scenario_id, "critical": 0, "serious": 0}
                for scenario_id in validator.M8_SCENARIOS
            ],
        },
    )
    checksums = artifact(
        root,
        "review/SHA256SUMS",
        f"{candidate['archive']['sha256']}  ui-builder-xtn-0.3.0-rc.1.zip\n",
    )
    review_artifacts = {
        "candidateArchive": archive,
        "checksums": checksums,
        "migrationGuide": artifact(root, "review/v0.3.0-migrations.md", migration_guide_bytes),
        "changelog": artifact(root, "review/CHANGELOG.md", changelog_bytes),
        "supportMatrix": artifact(root, "review/support-matrix.json", support_matrix_bytes),
        "independentConsumerReport": artifact(
            root,
            "review/independent-consumer-report.json",
            {
                "schemaVersion": 1,
                "kind": "personal-ui-m8-independent-consumer-report",
                "result": "passed",
                "candidate": migration_candidate,
                "scenarios": list(validator.M8_SCENARIOS),
            },
        ),
        "knownLimitations": artifact(root, "review/known-limitations.md", "# Known limitations\n\nNone observed in the retained M8 scope.\n"),
        "previewInstructions": artifact(root, "review/preview-instructions.md", "# Preview\n\nRun the retained consumer projects locally.\n"),
        "releaseChecklist": artifact(
            root,
            "review/release-checklist.json",
            {
                "schemaVersion": 1,
                "kind": "personal-ui-m8-release-checklist",
                "result": "passed",
                "candidate": migration_candidate,
                "checks": ["candidate", "migration", "quality", "review"],
            },
        ),
    }
    return {
        "schemaVersion": 1,
        "kind": "personal-ui-release-evidence",
        "type": "m8-acceptance",
        "planDigest": candidate["planDigest"],
        "sourceCommit": candidate["sourceCommit"],
        "archiveSha256": candidate["archive"]["sha256"],
        "candidate": candidate,
        "result": "passed",
        "scenarios": scenarios,
        "migration": {
            "result": "passed",
            "fromVersion": "0.2.19",
            "toVersion": candidate["version"],
            "checks": {name: "passed" for name in validator.MIGRATION_CHECKS},
            "artifacts": {
                "report": migration_report,
                "inventory": migration_inventory,
                **migration_artifacts,
            },
        },
        "qualityMatrix": {
            "result": "passed",
            "candidate": migration_candidate,
            "widths": list(validator.REQUIRED_WIDTHS),
            "engines": list(validator.REQUIRED_ENGINES),
            "scenarios": quality_scenarios,
            "realSafari": {
                "result": "passed",
                "browser": "Safari",
                "version": "18.6",
                "playwrightWebKit": False,
                "artifact": safari,
            },
            "axe": {
                "result": "passed",
                "critical": 0,
                "serious": 0,
                "artifact": axe,
            },
            "artifacts": quality_artifacts,
        },
        "reviewBundle": {"result": "passed", "artifacts": review_artifacts},
    }


class M8EvidenceContracts(unittest.TestCase):
    def test_ids_and_attributions_match_evaluation_fact_sources(self) -> None:
        root = Path(__file__).resolve().parent.parent
        scenarios = json.loads((root / "evaluation/m8/scenarios.json").read_text("utf-8"))
        rules = json.loads((root / "evaluation/m8/acceptance-rules.json").read_text("utf-8"))
        self.assertEqual(validator.M8_SCENARIOS, tuple(item["id"] for item in scenarios["scenarios"]))
        self.assertEqual(validator.M8_SCENARIOS, tuple(item["id"] for item in rules["scenarioRules"]))
        self.assertEqual(validator.M8_ATTRIBUTIONS, ("none", *rules["attributionEnum"]))

    def test_complete_file_backed_evidence_is_accepted(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pui-m8-evidence-") as temporary:
            root = Path(temporary)
            evidence = valid_evidence(root)
            result = validator.validate_m8_evidence(
                evidence,
                expected_bindings={
                    "planDigest": evidence["planDigest"],
                    "sourceCommit": evidence["sourceCommit"],
                    "archiveSha256": evidence["archiveSha256"],
                },
                bundle_root=root,
            )
            self.assertTrue(result.accepted, result.errors)

    def test_artifact_bytes_are_verified(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pui-m8-evidence-") as temporary:
            root = Path(temporary)
            evidence = valid_evidence(root)
            request = evidence["scenarios"][0]["run"]["artifacts"]["request"]
            root.joinpath(*request["path"].split("/")).write_text("tampered", encoding="utf-8")
            result = validator.validate_m8_evidence(evidence, bundle_root=root)
            self.assertEqual(result.category, "invalid")
            self.assertTrue(any("does not match the artifact bytes" in error for error in result.errors))

    def test_evidence_file_rejects_a_linked_bundle_ancestor(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pui-m8-evidence-") as temporary:
            root = Path(temporary)
            bundle = root / "bundle"
            bundle.mkdir()
            evidence = valid_evidence(bundle)
            evidence_path = bundle / "m8.json"
            evidence_path.write_bytes(json_bytes(evidence))
            linked = root / "linked-bundle"
            try:
                os.symlink(bundle, linked, target_is_directory=True)
            except OSError as error:
                self.skipTest(f"directory symlinks are unavailable: {error}")
            result = validator.validate_m8_evidence_file(linked / "m8.json")
            self.assertEqual(result.category, "invalid")
            self.assertTrue(any("link or junction" in item for item in result.errors))

    def test_migration_quality_and_review_are_hard_gates(self) -> None:
        for section in ("migration", "qualityMatrix", "reviewBundle"):
            with self.subTest(section=section), tempfile.TemporaryDirectory(prefix="pui-m8-evidence-") as temporary:
                root = Path(temporary)
                evidence = valid_evidence(root)
                evidence.pop(section)
                result = validator.validate_m8_evidence(evidence, bundle_root=root)
                self.assertEqual(result.category, "invalid")
                self.assertTrue(any(section in error for error in result.errors))

    def test_webkit_cannot_claim_real_safari(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pui-m8-evidence-") as temporary:
            root = Path(temporary)
            evidence = valid_evidence(root)
            evidence["qualityMatrix"]["realSafari"]["playwrightWebKit"] = True
            result = validator.validate_m8_evidence(evidence, bundle_root=root)
            self.assertEqual(result.category, "invalid")
            self.assertTrue(any("real Safari 18+" in error for error in result.errors))

    def test_rehashed_request_cannot_replace_the_frozen_candidate_request(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pui-m8-evidence-") as temporary:
            root = Path(temporary)
            evidence = valid_evidence(root)
            run = evidence["scenarios"][0]["run"]
            request = run["artifacts"]["request"]
            rewrite_artifact(root, request, "Replacement request.\n")
            visible_descriptor = run["artifacts"]["visible-inputs"]
            visible_path = root.joinpath(*visible_descriptor["path"].split("/"))
            visible = json.loads(visible_path.read_text(encoding="utf-8"))
            visible["request"]["size"] = request["size"]
            visible["request"]["sha256"] = request["sha256"]
            visible["scenario"]["requestSha256"] = request["sha256"]
            rewrite_artifact(root, visible_descriptor, visible)

            result = validator.validate_m8_evidence(evidence, bundle_root=root)
            self.assertEqual(result.category, "invalid")
            self.assertTrue(any("frozen candidate request" in error for error in result.errors))

    def test_thin_quality_and_safari_claims_are_not_evidence(self) -> None:
        for selector in ("scenario", "safari", "axe"):
            with self.subTest(selector=selector), tempfile.TemporaryDirectory(prefix="pui-m8-evidence-") as temporary:
                root = Path(temporary)
                evidence = valid_evidence(root)
                quality = evidence["qualityMatrix"]
                descriptor = (
                    quality["scenarios"][0]["artifact"]
                    if selector == "scenario"
                    else quality["realSafari" if selector == "safari" else "axe"]["artifact"]
                )
                rewrite_artifact(root, descriptor, {"result": "passed"})
                result = validator.validate_m8_evidence(evidence, bundle_root=root)
                self.assertEqual(result.category, "invalid")
                self.assertTrue(
                    any(selector.lower() in error.lower() for error in result.errors),
                    result.errors,
                )

    def test_thin_migration_report_and_review_placeholders_are_rejected(self) -> None:
        for section, name in (("migration", "report"), ("reviewBundle", "migrationGuide")):
            with self.subTest(section=section), tempfile.TemporaryDirectory(prefix="pui-m8-evidence-") as temporary:
                root = Path(temporary)
                evidence = valid_evidence(root)
                descriptor = evidence[section]["artifacts"][name]
                rewrite_artifact(root, descriptor, {"result": "passed"})
                result = validator.validate_m8_evidence(evidence, bundle_root=root)
                self.assertEqual(result.category, "invalid")
                self.assertTrue(any(section in error for error in result.errors), result.errors)

    def test_first_result_cannot_claim_pass_with_failed_checks(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pui-m8-evidence-") as temporary:
            root = Path(temporary)
            evidence = valid_evidence(root)
            descriptor = evidence["scenarios"][0]["run"]["artifacts"]["first-verification"]
            path = root.joinpath(*descriptor["path"].split("/"))
            document = json.loads(path.read_text(encoding="utf-8"))
            document["checks"]["behavior"] = "failed"
            rewrite_artifact(root, descriptor, document)
            result = validator.validate_m8_evidence(evidence, bundle_root=root)
            self.assertEqual(result.category, "invalid")
            self.assertTrue(any("first-result checks" in error for error in result.errors))

    def test_scenarios_must_be_unique_and_complete(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pui-m8-evidence-") as temporary:
            root = Path(temporary)
            evidence = valid_evidence(root)
            evidence["scenarios"][-1] = copy.deepcopy(evidence["scenarios"][0])
            result = validator.validate_m8_evidence(evidence, bundle_root=root)
            self.assertEqual(result.category, "invalid")
            self.assertTrue(any("duplicate M8 scenario" in error for error in result.errors))
            self.assertTrue(any("missing M8 scenarios" in error for error in result.errors))

    def test_repaired_first_result_requires_attribution(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pui-m8-evidence-") as temporary:
            root = Path(temporary)
            evidence = valid_evidence(root)
            evidence["scenarios"][0]["run"]["firstResult"]["status"] = "failed"
            result = validator.validate_m8_evidence(evidence, bundle_root=root)
            self.assertEqual(result.category, "invalid")
            self.assertTrue(any("first-pass failure" in error for error in result.errors))

    def test_binding_mismatch_and_failed_result_remain_distinct(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pui-m8-evidence-") as temporary:
            root = Path(temporary)
            evidence = valid_evidence(root)
            mismatch = validator.validate_m8_evidence(
                evidence,
                expected_bindings={
                    "planDigest": "0" * 64,
                    "sourceCommit": evidence["sourceCommit"],
                    "archiveSha256": evidence["archiveSha256"],
                },
                bundle_root=root,
            )
            self.assertEqual(mismatch.category, "binding-mismatch")
            evidence["result"] = "failed"
            failed = validator.validate_m8_evidence(evidence, bundle_root=root)
            self.assertEqual(failed.category, "not-passed")


if __name__ == "__main__":
    unittest.main()
