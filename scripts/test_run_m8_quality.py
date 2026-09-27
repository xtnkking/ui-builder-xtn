#!/usr/bin/env python3
"""Focused contracts for the strict M8 consumer quality evidence runner."""

from __future__ import annotations

import binascii
import copy
import hashlib
import json
import struct
import tempfile
import unittest
import zlib
from pathlib import Path
from unittest import mock

import run_m8_quality as quality
import validate_m8_evidence as validator


TIMESTAMP_START = "2026-09-27T10:00:00Z"
TIMESTAMP_RECORDED = "2026-09-27T10:30:00Z"
TIMESTAMP_END = "2026-09-27T11:00:00Z"
BROWSER_VERSIONS = {
    "chromium": "140.0.7339.16",
    "firefox": "141.0",
    "webkit": "26.0",
}
USER_AGENTS = {
    "chromium": "Mozilla/5.0 HeadlessChrome/140.0.7339.16 Safari/537.36",
    "firefox": "Mozilla/5.0 Gecko/20100101 Firefox/141.0",
    "webkit": "Mozilla/5.0 AppleWebKit/605.1.15 Version/18.5 Safari/605.1.15",
}
ROOT = Path(__file__).resolve().parents[1]
FIXTURE_CATALOG = json.loads(
    (ROOT / "references/support-fixtures.json").read_text(encoding="utf-8")
)
HOSTED_REPOSITORY = "xtnkking/ui-builder-xtn"
HOSTED_RUN_ID = 123456789
HOSTED_RUN_ATTEMPT = 2


def write_bytes(path: Path, content: bytes) -> dict[str, object]:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)
    return {
        "path": path.as_posix(),
        "size": len(content),
        "sha256": quality.sha256_bytes(content),
    }


def write_workspace_bytes(workspace: Path, relative: str, content: bytes) -> dict[str, object]:
    descriptor = write_bytes(workspace.joinpath(*relative.split("/")), content)
    descriptor["path"] = relative
    return descriptor


def write_workspace_json(workspace: Path, relative: str, value: object) -> dict[str, object]:
    return write_workspace_bytes(workspace, relative, quality.canonical_json(value))


def png_chunk(name: bytes, content: bytes) -> bytes:
    return (
        struct.pack(">I", len(content))
        + name
        + content
        + struct.pack(">I", binascii.crc32(name + content) & 0xFFFFFFFF)
    )


def screenshot_png(width: int, height: int = 240, *, placeholder: bool = False) -> bytes:
    palette = tuple(
        bytes(((index * 37) % 256, (index * 73) % 256, (index * 109) % 256))
        for index in range(16)
    )
    rows = []
    for row in range(height):
        if placeholder:
            pixels = (b"\x00\x00\x00" + b"\xff\xff\xff" * (width - 1)) if row == 0 else b"\xff\xff\xff" * width
        else:
            band = max(1, width // len(palette))
            pixels = b"".join(
                palette[((column // band) + (row // 30)) % len(palette)]
                for column in range(width)
            )
        rows.append(b"\x00" + pixels)
    header = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    return (
        quality.PNG_SIGNATURE
        + png_chunk(b"IHDR", header)
        + png_chunk(b"IDAT", zlib.compress(b"".join(rows), level=9))
        + png_chunk(b"IEND", b"")
    )


def candidate_binding() -> dict[str, object]:
    return {
        "version": "0.3.0-rc.1",
        "planDigest": "a" * 64,
        "sourceCommit": "b" * 40,
        "sourceContentDigest": "c" * 64,
        "sourceDateEpoch": 1_795_000_000,
        "candidateContentDigest": "d" * 64,
        "archive": {
            "path": "artifacts/ui-builder-xtn-0.3.0-rc.1.zip",
            "size": 321,
            "sha256": "e" * 64,
        },
    }


def candidate_summary(binding: dict[str, object]) -> dict[str, object]:
    archive = binding["archive"]
    assert isinstance(archive, dict)
    return {
        "version": binding["version"],
        "planDigest": binding["planDigest"],
        "sourceCommit": binding["sourceCommit"],
        "archiveSha256": archive["sha256"],
        "candidateContentDigest": binding["candidateContentDigest"],
    }


def make_workspace(
    root: Path,
    scenario_id: str,
    binding: dict[str, object],
    sequence: int,
) -> tuple[Path, Path]:
    workspace = root / f"workspace-{scenario_id}"
    (workspace / "consumer").mkdir(parents=True)
    (workspace / "evidence/final").mkdir(parents=True)
    run_id = f"m8-{scenario_id}-00000000-0000-4000-8000-{sequence:012d}"
    request = write_workspace_bytes(
        workspace, "request.md", f"Build {scenario_id}.\n".encode("utf-8")
    )
    manifest = {
        "schemaVersion": 1,
        "kind": "personal-ui-m8-evaluator-inputs",
        "official": True,
        "run": {"id": run_id, "createdAt": TIMESTAMP_START},
        "candidate": binding,
        "scenario": {"id": scenario_id, "supportFixtureId": f"fixture-{scenario_id}"},
        "request": request,
        "bundleLayout": {"consumerRoot": "consumer", "evidenceRoot": "evidence"},
        "acceptanceEvidence": {"eligible": True, "generated": False},
    }
    visible = write_workspace_json(workspace, "visible-inputs.json", manifest)
    run_start = {
        "schemaVersion": 1,
        "kind": "personal-ui-m8-run-start",
        "runId": run_id,
        "scenarioId": scenario_id,
        "startedAt": TIMESTAMP_START,
        "candidate": binding,
        "visibleInputs": visible,
        "request": request,
    }
    write_workspace_json(workspace, "evidence/run-start.json", run_start)
    source_files = {
        "src/App.tsx": f"export const scenario = {scenario_id!r};\n".encode("utf-8")
    }
    write_workspace_bytes(
        workspace,
        "consumer/src/App.tsx",
        source_files["src/App.tsx"],
    )
    source_archive = write_workspace_bytes(
        workspace,
        "evidence/final/source.zip",
        quality.release.deterministic_zip_bytes(
            source_files,
            epoch=int(binding["sourceDateEpoch"]),
        ),
    )
    source_inventory = write_workspace_json(
        workspace,
        "evidence/final/source-inventory.json",
        {
            "schemaVersion": 1,
            "kind": "personal-ui-m8-source-inventory",
            "contentDigest": quality.release.digest_file_map(source_files),
            "files": quality.release.file_inventory(source_files),
        },
    )
    recorded_stdout = write_workspace_bytes(
        workspace, "evidence/commands/0001.stdout.log", b"verified\n"
    )
    recorded_stderr = write_workspace_bytes(
        workspace, "evidence/commands/0001.stderr.log", b""
    )
    recorded_command = write_workspace_json(
        workspace,
        "evidence/commands/0001.json",
        {
            "schemaVersion": 1,
            "kind": "personal-ui-m8-command",
            "runId": run_id,
            "sequence": 1,
            "argv": ["npm", "run", "verify"],
            "cwd": "consumer",
            "exitCode": 0,
            "startedAt": TIMESTAMP_START,
            "endedAt": TIMESTAMP_END,
            "stdout": recorded_stdout,
            "stderr": recorded_stderr,
        },
    )
    write_workspace_json(
        workspace,
        "evidence/command-index.json",
        {
            "schemaVersion": 1,
            "kind": "personal-ui-m8-command-index",
            "runId": run_id,
            "commands": [recorded_command],
        },
    )
    verification = write_workspace_json(
        workspace,
        "evidence/final/verification.json",
        {
            "schemaVersion": 1,
            "kind": "personal-ui-m8-quality-verification",
            "runId": run_id,
            "candidate": binding,
            "result": "passed",
            "checks": {name: "passed" for name in quality.FINAL_CHECKS},
            "commands": [recorded_command],
        },
    )
    write_workspace_json(
        workspace,
        "evidence/final/result.json",
        {
            "schemaVersion": 1,
            "kind": "personal-ui-m8-final-result",
            "runId": run_id,
            "result": "passed",
            "frozenAt": TIMESTAMP_END,
            "checks": {name: "passed" for name in quality.FINAL_CHECKS},
            "sourceArchive": source_archive,
            "sourceInventory": source_inventory,
            "verification": verification,
        },
    )

    commands = []
    for purpose in ("typecheck", "build", "verifier", "browser-quality"):
        stdout = write_workspace_bytes(
            workspace,
            f"quality/logs/{purpose}.stdout.log",
            f"{purpose} passed\n".encode("utf-8"),
        )
        stderr = write_workspace_bytes(
            workspace, f"quality/logs/{purpose}.stderr.log", b""
        )
        commands.append(
            {
                "purpose": purpose,
                "argv": ["npm", "run", purpose],
                "cwd": "consumer",
                "exitCode": 0,
                "startedAt": TIMESTAMP_START,
                "endedAt": TIMESTAMP_END,
                "stdout": stdout,
                "stderr": stderr,
            }
        )

    browser_products = {
        "chromium": "Playwright Chromium",
        "firefox": "Playwright Firefox",
        "webkit": "Playwright WebKit",
    }
    browsers = []
    for engine in validator.REQUIRED_ENGINES:
        browsers.append(
            {
                "project": engine,
                "product": browser_products[engine],
                "version": BROWSER_VERSIONS[engine],
                "evidenceKind": "playwright-browser",
                "realSafari": False,
                "safariEvidence": False,
            }
        )
    browser_report = write_workspace_json(
        workspace,
        "quality/browser-versions.raw.json",
        {
            "schemaVersion": 1,
            "evidenceKind": "playwright-browser-version-inventory",
            "recordedAt": TIMESTAMP_RECORDED,
            "environment": {
                "node": "22.12.0",
                "platform": "win32",
                "architecture": "x64",
                "playwright": "1.55.1",
            },
            "browsers": browsers,
            "safari": {"acceptedFromThisReport": False},
        },
    )

    measurements = []
    for engine in validator.REQUIRED_ENGINES:
        for width in validator.REQUIRED_WIDTHS:
            stem = f"quality/raw/{engine}-{width}"
            behavior = write_workspace_json(
                workspace,
                f"{stem}-behavior.json",
                {
                    "schemaVersion": 1,
                    "kind": quality.BEHAVIOR_KIND,
                    "scenarioId": scenario_id,
                    "engine": engine,
                    "width": width,
                    "result": "passed",
                    "assertions": [
                        {"name": "primary workflow completes", "result": "passed"},
                        {"name": "keyboard workflow completes", "result": "passed"},
                        {"name": "failure state recovers", "result": "passed"},
                    ],
                },
            )
            url = f"http://127.0.0.1:4173/{scenario_id}"
            axe = write_workspace_json(
                workspace,
                f"{stem}-axe.json",
                {
                    "testEngine": {"name": "axe-core", "version": "4.10.3"},
                    "testRunner": {"name": "axe"},
                    "timestamp": TIMESTAMP_RECORDED,
                    "url": url,
                    "passes": [
                        {"id": rule_id, "impact": "serious"}
                        for rule_id in (
                            "document-title",
                            "html-has-lang",
                            "landmark-one-main",
                            "page-has-heading-one",
                            "region",
                        )
                    ],
                    "incomplete": [],
                    "violations": [],
                },
            )
            responsive = write_workspace_json(
                workspace,
                f"{stem}-responsive.json",
                {
                    "schemaVersion": 1,
                    "kind": quality.RESPONSIVE_KIND,
                    "scenarioId": scenario_id,
                    "engine": engine,
                    "width": width,
                    "result": "passed",
                    "viewport": {"width": width, "height": 240},
                    "document": {
                        "documentElementClientWidth": width,
                        "documentElementScrollWidth": width,
                        "bodyClientWidth": width,
                        "bodyScrollWidth": width,
                    },
                    "pageHorizontalOverflow": False,
                    "assertions": [
                        {"name": "content remains reachable", "result": "passed"},
                        {"name": "controls remain visible", "result": "passed"},
                        {"name": "page has no overflow", "result": "passed"},
                    ],
                },
            )
            screenshot = write_workspace_bytes(
                workspace, f"{stem}.png", screenshot_png(width)
            )
            measurements.append(
                {
                    "engine": engine,
                    "width": width,
                    "result": "passed",
                    "recordedAt": TIMESTAMP_RECORDED,
                    "browserVersion": BROWSER_VERSIONS[engine],
                    "userAgent": USER_AGENTS[engine],
                    "url": url,
                    "deviceScaleFactor": 1,
                    "checks": {name: "passed" for name in quality.CHECKS},
                    "behavior": {
                        "result": "passed",
                        "assertionCount": 3,
                        "artifact": behavior,
                    },
                    "axe": {
                        "result": "passed",
                        "critical": 0,
                        "serious": 0,
                        "artifact": axe,
                    },
                    "responsive": {
                        "result": "passed",
                        "pageHorizontalOverflow": False,
                        "artifact": responsive,
                    },
                    "screenshot": screenshot,
                }
            )

    report = {
        "schemaVersion": 1,
        "kind": quality.SCENARIO_REPORT_KIND,
        "result": "passed",
        "scenarioId": scenario_id,
        "runId": run_id,
        "candidate": binding,
        "workspaceRoot": ".",
        "projectRoot": "consumer",
        "commands": commands,
        "browserVersions": browser_report,
        "measurements": measurements,
    }
    report_path = workspace / "quality/scenario-report.json"
    write_workspace_json(workspace, "quality/scenario-report.json", report)
    return workspace, report_path


def raw_safari_record(*, kind: str) -> dict[str, object]:
    return {
        "schemaVersion": 1,
        "kind": kind,
        "result": "passed",
        "safari": {
            "product": "Safari",
            "browserName": "safari",
            "version": "18.6",
            "majorVersion": 18,
            "capabilityVersion": "18.6",
            "userAgent": "Mozilla/5.0 Version/18.6 Safari/605.1.15",
            "driver": "safaridriver",
            "realSafari": True,
        },
        "checks": {name: "passed" for name in quality.SAFARI_CHECKS},
        "actualTools": {
            "node": "22.12.0",
            "npm": "10.9.3",
            "python": "3.13.7",
            "safaridriver": "Included with Safari 18.6",
        },
    }


def hosted_common(binding: dict[str, object], job_id: str) -> dict[str, object]:
    return {
        "jobId": job_id,
        "sourceCommit": binding["sourceCommit"],
        "repository": HOSTED_REPOSITORY,
        "runId": HOSTED_RUN_ID,
        "runAttempt": HOSTED_RUN_ATTEMPT,
        "workflowRef": (
            f"{HOSTED_REPOSITORY}/.github/workflows/quality.yml@refs/heads/main"
        ),
        "event": "push",
        "runUrl": (
            f"https://github.com/{HOSTED_REPOSITORY}/actions/runs/{HOSTED_RUN_ID}"
        ),
        "runner": {"hosted": True, "os": "Linux", "architecture": "X64"},
        "result": "passed",
    }


def make_safari(root: Path, binding: dict[str, object]) -> Path:
    bundle_root = root / "hosted-safari-bundle"
    artifact_root = bundle_root / "artifacts"
    artifact_root.mkdir(parents=True)
    records: list[tuple[str, str, dict[str, object]]] = []
    for fixture in FIXTURE_CATALOG["fixtures"]:
        environment = fixture["environment"]
        ci = fixture["ci"]
        assert isinstance(environment, dict)
        assert isinstance(ci, dict)
        records.append(
            (
                "fixture",
                str(fixture["id"]),
                {
                    "schemaVersion": 1,
                    "kind": quality.hosted_validator.FIXTURE_KIND,
                    **hosted_common(binding, str(ci["job"])),
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
                    "fixtureReportSha256": "f" * 64,
                },
            )
        )
    records.append(
        (
            "browser",
            "browser-quality",
            {
                "schemaVersion": 1,
                "kind": quality.hosted_validator.BROWSER_KIND,
                **hosted_common(binding, "browser-quality"),
                "executedOperations": quality.hosted_validator.REQUIRED_BROWSER_OPERATIONS,
                "actualTools": {
                    "node": "22.12.0",
                    "npm": "10.9.3",
                    "python": "3.13.7",
                    "playwright": "1.55.1",
                },
                "browsers": [
                    {
                        "project": project,
                        "product": f"Playwright {project.title()}",
                        "version": BROWSER_VERSIONS[project],
                        "realSafari": False,
                    }
                    for project in validator.REQUIRED_ENGINES
                ],
            },
        )
    )
    hosted_safari = {
        **raw_safari_record(kind=quality.hosted_validator.SAFARI_KIND),
        **hosted_common(binding, "safari-quality"),
        "schemaVersion": 1,
        "kind": quality.hosted_validator.SAFARI_KIND,
        "runner": {"hosted": True, "os": "macOS", "architecture": "ARM64"},
    }
    records.append(("safari", "safari-quality", hosted_safari))

    descriptors = []
    for role, artifact_id, record in records:
        relative = f"artifacts/{role}-{artifact_id}.json"
        content = quality.canonical_json(record)
        (bundle_root / relative).write_bytes(content)
        descriptors.append(
            {
                "role": role,
                "id": artifact_id,
                "path": relative,
                "size": len(content),
                "sha256": hashlib.sha256(content).hexdigest(),
            }
        )
    archive = binding["archive"]
    assert isinstance(archive, dict)
    bundle = {
        "schemaVersion": 1,
        "kind": quality.hosted_validator.EVIDENCE_KIND,
        "type": quality.hosted_validator.EVIDENCE_TYPE,
        "planDigest": binding["planDigest"],
        "sourceCommit": binding["sourceCommit"],
        "archiveSha256": archive["sha256"],
        "workflow": {
            "repository": HOSTED_REPOSITORY,
            "ref": (
                f"{HOSTED_REPOSITORY}/.github/workflows/quality.yml@refs/heads/main"
            ),
            "runId": HOSTED_RUN_ID,
            "runAttempt": HOSTED_RUN_ATTEMPT,
            "runUrl": (
                f"https://github.com/{HOSTED_REPOSITORY}/actions/runs/{HOSTED_RUN_ID}"
            ),
            "event": "push",
            "sourceCommit": binding["sourceCommit"],
        },
        "artifacts": descriptors,
        "result": "passed",
    }
    path = bundle_root / "hosted-ci.json"
    path.write_bytes(quality.canonical_json(bundle))
    return path


def mutate_hosted_safari(bundle_path: Path, changes: dict[str, object]) -> None:
    bundle = json.loads(bundle_path.read_text("utf-8"))
    descriptor = next(
        item for item in bundle["artifacts"] if item["role"] == "safari"
    )
    record_path = bundle_path.parent.joinpath(*descriptor["path"].split("/"))
    record = json.loads(record_path.read_text("utf-8"))
    record["safari"].update(changes)
    content = quality.canonical_json(record)
    record_path.write_bytes(content)
    descriptor["size"] = len(content)
    descriptor["sha256"] = hashlib.sha256(content).hexdigest()
    bundle_path.write_bytes(quality.canonical_json(bundle))


class M8QualityContracts(unittest.TestCase):
    def test_near_blank_placeholder_screenshot_is_rejected(self) -> None:
        with self.assertRaisesRegex(quality.M8QualityError, "near-blank placeholder"):
            quality._png_dimensions(
                screenshot_png(320, placeholder=True),
                label="placeholder screenshot",
            )

    def setup_fixture(
        self, root: Path
    ) -> tuple[dict[str, object], Path, Path, list[tuple[Path, Path]], Path]:
        binding = candidate_binding()
        candidate = root / "candidate"
        repository = root / "repository"
        candidate.mkdir()
        repository.mkdir()
        pairs = [
            make_workspace(root, scenario_id, binding, index)
            for index, scenario_id in enumerate(validator.M8_SCENARIOS, start=1)
        ]
        return binding, candidate, repository, pairs, make_safari(root, binding)

    def run_bundle(
        self,
        *,
        binding: dict[str, object],
        candidate: Path,
        repository: Path,
        pairs: list[tuple[Path, Path]],
        safari: Path,
        output: Path,
    ) -> dict[str, object]:
        with (
            mock.patch.object(
                quality,
                "load_verified_candidate",
                return_value=(candidate, binding, candidate_summary(binding)),
            ),
            mock.patch.object(
                quality,
                "_candidate_fixture_catalog",
                return_value=FIXTURE_CATALOG,
            ),
        ):
            return quality.build_quality_bundle(
                candidate_path=candidate,
                workspace_report_pairs=pairs,
                safari_report_path=safari,
                output_path=output,
                repository=repository,
            )

    def test_complete_raw_evidence_builds_a_validator_accepted_fragment(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pui-m8-quality-") as temporary:
            root = Path(temporary)
            binding, candidate, repository, pairs, safari = self.setup_fixture(root)
            output = root / "quality-bundle"
            fragment = self.run_bundle(
                binding=binding,
                candidate=candidate,
                repository=repository,
                pairs=pairs,
                safari=safari,
                output=output,
            )
            result = validator._validate_quality(
                {"qualityMatrix": fragment}, binding, output
            )
            self.assertEqual(result, [])
            inventory = json.loads(
                (output / "quality/raw-artifact-inventory.json").read_text("utf-8")
            )
            self.assertEqual(inventory["artifactCount"], len(inventory["artifacts"]))
            self.assertGreater(inventory["artifactCount"], 400)
            self.assertTrue((output / "quality/raw/family-login/workspace/request.md").is_file())
            safari_record = json.loads(
                (output / "quality/safari.json").read_text("utf-8")
            )
            self.assertEqual(
                safari_record["hostedEvidence"]["planDigest"],
                binding["planDigest"],
            )
            self.assertEqual(
                safari_record["hostedEvidence"]["runUrl"],
                f"https://github.com/{HOSTED_REPOSITORY}/actions/runs/{HOSTED_RUN_ID}",
            )
            hosted_bundle = json.loads(safari.read_text("utf-8"))
            hosted_descriptor = next(
                item
                for item in hosted_bundle["artifacts"]
                if item["role"] == "safari"
            )
            hosted_record_path = safari.parent.joinpath(
                *hosted_descriptor["path"].split("/")
            )
            direct_record, _ = quality._validate_safari_report(
                hosted_record_path,
                candidate_summary=candidate_summary(binding),
                fixture_catalog=FIXTURE_CATALOG,
            )
            self.assertEqual(
                direct_record["hostedEvidence"]["recordSha256"],
                hosted_descriptor["sha256"],
            )

    def test_missing_measurement_is_rejected_without_partial_output(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pui-m8-quality-missing-") as temporary:
            root = Path(temporary)
            binding, candidate, repository, pairs, safari = self.setup_fixture(root)
            report_path = pairs[0][1]
            report = json.loads(report_path.read_text("utf-8"))
            report["measurements"].pop()
            report_path.write_bytes(quality.canonical_json(report))
            output = root / "quality-bundle"
            with self.assertRaisesRegex(quality.M8QualityError, "every engine/width"):
                self.run_bundle(
                    binding=binding,
                    candidate=candidate,
                    repository=repository,
                    pairs=pairs,
                    safari=safari,
                    output=output,
                )
            self.assertFalse(output.exists())

    def test_tampered_artifact_and_webkit_safari_are_rejected(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pui-m8-quality-tamper-") as temporary:
            root = Path(temporary)
            binding, candidate, repository, pairs, safari = self.setup_fixture(root)
            report = json.loads(pairs[0][1].read_text("utf-8"))
            descriptor = report["measurements"][0]["behavior"]["artifact"]
            artifact_path = pairs[0][0].joinpath(*descriptor["path"].split("/"))
            artifact_path.write_text("tampered\n", encoding="utf-8")
            with self.assertRaisesRegex(quality.M8QualityError, "retained bytes"):
                self.run_bundle(
                    binding=binding,
                    candidate=candidate,
                    repository=repository,
                    pairs=pairs,
                    safari=safari,
                    output=root / "tampered-output",
                )

            mutate_hosted_safari(
                safari,
                {
                    "product": "Playwright WebKit",
                    "browserName": "webkit",
                    "driver": "playwright",
                    "realSafari": False,
                },
            )
            with self.assertRaisesRegex(quality.M8QualityError, "Playwright WebKit"):
                quality._validate_safari_report(
                    safari,
                    candidate_summary=candidate_summary(binding),
                    fixture_catalog=FIXTURE_CATALOG,
                )

    def test_raw_or_unbound_hosted_safari_evidence_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pui-m8-quality-safari-") as temporary:
            root = Path(temporary)
            binding = candidate_binding()
            raw = root / "self-reported-safari.json"
            raw.write_bytes(
                quality.canonical_json(
                    raw_safari_record(kind=quality.SAFARI_WRAPPER_KIND)
                )
            )
            with self.assertRaisesRegex(quality.M8QualityError, "self-reported"):
                quality._validate_safari_report(
                    raw,
                    candidate_summary=candidate_summary(binding),
                    fixture_catalog=FIXTURE_CATALOG,
                )

            wrong_plan = make_safari(root / "wrong-plan", binding)
            bundle = json.loads(wrong_plan.read_text("utf-8"))
            bundle["planDigest"] = "0" * 64
            wrong_plan.write_bytes(quality.canonical_json(bundle))
            with self.assertRaisesRegex(quality.M8QualityError, "planDigest"):
                quality._validate_safari_report(
                    wrong_plan,
                    candidate_summary=candidate_summary(binding),
                    fixture_catalog=FIXTURE_CATALOG,
                )

            wrong_run = make_safari(root / "wrong-run", binding)
            bundle = json.loads(wrong_run.read_text("utf-8"))
            bundle["workflow"]["runUrl"] = (
                f"https://github.com/{HOSTED_REPOSITORY}/actions/runs/999"
            )
            wrong_run.write_bytes(quality.canonical_json(bundle))
            with self.assertRaisesRegex(quality.M8QualityError, "runUrl"):
                quality._validate_safari_report(
                    wrong_run,
                    candidate_summary=candidate_summary(binding),
                    fixture_catalog=FIXTURE_CATALOG,
                )

    def test_candidate_mismatch_and_linked_artifact_are_rejected(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pui-m8-quality-boundary-") as temporary:
            root = Path(temporary)
            binding, candidate, repository, pairs, safari = self.setup_fixture(root)
            report = json.loads(pairs[0][1].read_text("utf-8"))
            report["candidate"] = copy.deepcopy(binding)
            report["candidate"]["planDigest"] = "f" * 64
            pairs[0][1].write_bytes(quality.canonical_json(report))
            with self.assertRaisesRegex(quality.M8QualityError, "unbound"):
                self.run_bundle(
                    binding=binding,
                    candidate=candidate,
                    repository=repository,
                    pairs=pairs,
                    safari=safari,
                    output=root / "mismatch-output",
                )

            target = pairs[1][0] / "quality/browser-versions.raw.json"
            linked = pairs[1][0] / "quality/linked-browser-versions.json"
            try:
                linked.symlink_to(target)
            except OSError as error:
                self.skipTest(f"file symlinks are unavailable: {error}")
            second = json.loads(pairs[1][1].read_text("utf-8"))
            second["browserVersions"]["path"] = "quality/linked-browser-versions.json"
            pairs[1][1].write_bytes(quality.canonical_json(second))
            with self.assertRaisesRegex(quality.M8QualityError, "link or junction"):
                quality.validate_scenario_report(
                    pairs[1][0], pairs[1][1], candidate_binding=binding
                )


if __name__ == "__main__":
    unittest.main()
