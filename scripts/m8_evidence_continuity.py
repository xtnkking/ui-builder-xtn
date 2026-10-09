#!/usr/bin/env python3
"""Prove limited M8 evidence continuity without relabelling or rerunning consumers."""

from __future__ import annotations

import argparse
import io
import json
import re
import sys
import zipfile
from pathlib import Path
from typing import Mapping, Sequence

if __package__:
    from . import release_personal_ui as release
    from . import validate_m8_evidence as m8
else:
    import release_personal_ui as release
    import validate_m8_evidence as m8


KIND = "personal-ui-m8-evidence-continuity"
POLICY = "assembler-only-v1"
ALLOWED_SOURCE_PATHS = frozenset({
    "scripts/assemble_m8_acceptance.py",
    "scripts/test_assemble_m8_acceptance.py",
    "CHANGELOG.md",
})
REUSE_SCOPE = ["consumers", "migration", "quality", "origin-system-safari"]


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise release.ReleaseError(message)


def _delta(origin: Mapping[str, bytes], target: Mapping[str, bytes]) -> list[dict]:
    _require(set(origin) == set(target), "continuity cannot add or remove source files")
    return [
        {"path": path,
         "before": {"size": len(origin[path]), "sha256": release.sha256_bytes(origin[path])},
         "after": {"size": len(target[path]), "sha256": release.sha256_bytes(target[path])}}
        for path in sorted(origin) if origin[path] != target[path]
    ]


def compare_source_delta(
    origin: Mapping[str, bytes], target: Mapping[str, bytes]
) -> list[dict]:
    # Compare canonical bytes before any version transform can overwrite a field.
    delta = _delta(origin, target)
    forbidden = [item["path"] for item in delta if item["path"] not in ALLOWED_SOURCE_PATHS]
    _require(not forbidden, f"non-maintenance source changes require fresh M8 evidence: {forbidden}")
    return delta


def _binding(plan: Mapping) -> dict:
    return {
        "version": plan["candidateVersion"], "planDigest": plan["planDigest"],
        "sourceCommit": plan["source"]["commit"],
        "archiveSha256": plan["artifacts"]["archive"]["sha256"],
        "candidateContentDigest": plan["candidateContentDigest"],
    }


def _verified_rc(plan: dict, journal: dict) -> None:
    release.assert_plan_digest(plan)
    _require(plan.get("schemaVersion") == 1 and plan.get("kind") == "personal-ui-release-plan",
             "unsupported candidate plan")
    version = release.SemVer.parse(plan["candidateVersion"])
    _require(version.rc_number is not None and plan.get("promotion") is None,
             "continuity endpoints must be original RC candidates")
    source = plan["source"]
    _require(source.get("mode") == "commit" and source.get("dirty") is False
             and re.fullmatch(r"[0-9a-f]{40}", str(source.get("commit"))) is not None
             and re.fullmatch(r"[0-9a-f]{40}", str(source.get("tree"))) is not None
             and isinstance(source.get("sourceDateEpoch"), int)
             and not isinstance(source.get("sourceDateEpoch"), bool),
             "continuity requires immutable source commits")
    _require(plan.get("publishable") is True and plan.get("publicationBlockers") == [],
             "continuity requires publishable candidate inputs")
    _require(release._is_formal_verification_plan(plan.get("verificationCommands")),
             "continuity requires the frozen three formal verification commands")
    steps = journal.get("steps")
    _require(isinstance(steps, dict)
             and all(isinstance(steps.get(key), dict) for key in ("prepare", "verify")),
             "candidate journal prepare/verify records must be objects")
    _require(journal.get("schemaVersion") == 1
             and journal.get("kind") == "personal-ui-release-journal"
             and journal.get("planDigest") == plan["planDigest"]
             and journal["steps"]["prepare"].get("status") == "complete",
             "candidate journal is not bound to the prepared plan")
    blockers = release._verification_journal_blockers(plan, journal)
    _require(not blockers, f"candidate formal verification is incomplete: {blockers}")


def _artifact(value: object, root: Path, label: str) -> Path:
    errors: list[str] = []
    path = m8._artifact_file(value, label, errors, root)
    _require(path is not None and not errors, "; ".join(errors) or f"missing {label}")
    assert path is not None
    return path


def _json_artifact(value: object, root: Path, label: str) -> dict:
    document = json.loads(_artifact(value, root, label).read_text(encoding="utf-8"))
    _require(isinstance(document, dict), f"{label} must contain a JSON object")
    return document


def _archive_files(path: Path) -> dict[str, bytes]:
    files: dict[str, bytes] = {}
    seen: set[str] = set()
    with zipfile.ZipFile(io.BytesIO(path.read_bytes())) as archive:
        for info in archive.infolist():
            prefix = release.ARCHIVE_PREFIX + "/"
            _require(info.filename.startswith(prefix), "archive has an unexpected root")
            relative = info.filename[len(prefix):]
            release.validate_relative_path(relative)
            _require(relative.casefold() not in seen, "duplicate archive member")
            mode = info.external_attr >> 16
            _require(not info.is_dir() and (mode & 0o170000) in {0, 0o100000},
                     "archive member is not a regular file")
            seen.add(relative.casefold())
            files[relative] = archive.read(info)
    return files


def _native_files(plan: dict, canonical: Mapping[str, bytes], archive: Path) -> dict[str, bytes]:
    _require(release.digest_file_map(canonical) == plan["source"]["contentDigest"],
             "canonical source digest does not match its plan")
    transformed, policy = release.transform_candidate_files(
        canonical, candidate_version=plan["candidateVersion"], existing_versions=())
    _require(policy == plan["versionPolicy"], "candidate version policy does not match canonical source")
    release.verify_candidate_files(plan, transformed)
    actual = archive.read_bytes()
    metadata = plan["artifacts"]["archive"]
    _require(len(actual) == metadata["size"] and release.sha256_bytes(actual) == metadata["sha256"],
             "candidate archive is not bound to its plan")
    expected = release.deterministic_zip_bytes(transformed, epoch=plan["source"]["sourceDateEpoch"])
    _require(actual == expected, "candidate ZIP differs from its deterministic canonical transformation")
    return transformed


def _reviewed_plan(plan: Mapping) -> Mapping:
    promotion = release._validated_promotion(plan)
    return promotion["reviewedPlan"] if promotion is not None else plan


def validate_continuity(
    evidence: object, *, expected_plan: Mapping, bundle_root: Path
) -> m8.M8EvidenceValidation:
    try:
        _require(isinstance(evidence, dict), "continuity evidence must be an object")
        assert isinstance(evidence, dict)
        _require(evidence.get("schemaVersion") == 1 and evidence.get("kind") == KIND
                 and evidence.get("policy") == POLICY, "unsupported continuity policy")
        _require(evidence.get("result") == "passed" and evidence.get("hostedCIInherited") is False
                 and evidence.get("reuseScope") == REUSE_SCOPE,
                 "continuity must not claim new runs or inherit hosted CI")
        _require(not m8._traverses_link(bundle_root), "continuity root must not traverse a link")
        root = bundle_root.resolve(strict=True)
        origin_path = _artifact(evidence["originAcceptance"], root, "originAcceptance")
        original = json.loads(origin_path.read_text(encoding="utf-8"))
        _require(isinstance(original, dict) and original.get("kind") == m8.EVIDENCE_KIND
                 and original.get("type") == m8.EVIDENCE_TYPE,
                 "origin must be original full M8 acceptance; chained continuity is forbidden")
        plans, sources, journals = {}, {}, {}
        for label in ("origin", "target"):
            proof = evidence[label]
            plans[label] = _json_artifact(proof["plan"], root, label + ".plan")
            journals[label] = _json_artifact(proof["journal"], root, label + ".journal")
            _verified_rc(plans[label], journals[label])
            sources[label] = _archive_files(_artifact(proof["sourceArchive"], root, label + ".sourceArchive"))
        origin, target = plans["origin"], plans["target"]
        trusted = _reviewed_plan(expected_plan)
        _require(target == trusted, "target plan does not match the trusted reviewed RC")
        _require(evidence.get("candidate") == _binding(target), "continuity target binding mismatch")
        before, after = release.SemVer.parse(origin["candidateVersion"]), release.SemVer.parse(target["candidateVersion"])
        _require(before.core == after.core and before < after, "continuity must advance on the same RC line")
        _require(origin["source"]["commit"] != target["source"]["commit"], "continuity needs distinct source commits")
        _require(evidence.get("consumerRunsSourceCommit") == origin["source"]["commit"],
                 "original consumer identities must be retained")
        source_delta = compare_source_delta(sources["origin"], sources["target"])
        _require(source_delta and evidence.get("sourceDelta") == source_delta,
                 "continuity source delta is incomplete or differs from actual bytes")
        origin_archive = _artifact(original["reviewBundle"]["artifacts"]["candidateArchive"],
                                   origin_path.parent, "original candidateArchive")
        target_archive = _artifact(evidence["target"]["archive"], root, "target.archive")
        native_origin = _native_files(origin, sources["origin"], origin_archive)
        native_target = _native_files(target, sources["target"], target_archive)
        _require(evidence.get("candidateDelta") == _delta(native_origin, native_target),
                 "candidate delta is incomplete or differs from native archive bytes")
        review = _artifact(evidence["maintenanceReview"], root, "maintenanceReview").read_text(encoding="utf-8")
        _require(bool(review.strip()), "maintenance review must retain the actual rationale and limitations")
        tool_revision = evidence["toolRevision"]
        _require(tool_revision.get("basedOnCommit") == target["source"]["commit"], "tool revision base mismatch")
        tool_files = tool_revision["files"]
        _require(isinstance(tool_files, list) and [item["sourcePath"] for item in tool_files] == [
            "scripts/m8_evidence_continuity.py", "scripts/release_personal_ui.py", "scripts/validate_m8_evidence.py"
        ], "tool revision inventory is incomplete")
        for item in tool_files:
            _artifact(item["artifact"], root, "toolRevision." + item["sourcePath"])
        original_binding = _binding(origin)
        result = m8.validate_m8_evidence_file(origin_path, expected_bindings=original_binding)
        _require(result.accepted, "original M8 acceptance failed: " + "; ".join(result.errors))
        original_candidate = original["candidate"]
        for key, value in original_binding.items():
            actual = original_candidate["archive"]["sha256"] if key == "archiveSha256" else original_candidate.get(key)
            _require(actual == value, f"origin M8 candidate {key} differs from its original plan")
        _require(original_candidate["sourceContentDigest"] == origin["source"]["contentDigest"]
                 and original_candidate["sourceDateEpoch"] == origin["source"]["sourceDateEpoch"],
                 "origin M8 canonical source binding mismatch")
        return m8.M8EvidenceValidation("accepted", ())
    except (release.ReleaseError, OSError, ValueError, KeyError, TypeError, AttributeError,
            zipfile.BadZipFile, UnicodeError) as error:
        return m8.M8EvidenceValidation("invalid", (str(error),))


def validate_continuity_file(path: Path, *, expected_plan: Mapping) -> m8.M8EvidenceValidation:
    try:
        _require(not m8._traverses_link(path), "continuity file must not traverse a link")
        document = json.loads(path.read_text(encoding="utf-8"))
        return validate_continuity(document, expected_plan=expected_plan, bundle_root=path.parent)
    except (release.ReleaseError, OSError, ValueError, UnicodeError) as error:
        return m8.M8EvidenceValidation("invalid", (str(error),))


def _descriptor(path: Path, root: Path) -> dict:
    _require(not m8._traverses_link(path), "proof artifact must not traverse a link")
    relative = path.resolve(strict=True).relative_to(root.resolve(strict=True)).as_posix()
    content = path.read_bytes()
    return {"path": relative, "size": len(content), "sha256": release.sha256_bytes(content)}


def create_continuity(
    *, repository: Path, origin_candidate: Path, target_candidate: Path,
    origin_acceptance: Path, maintenance_review: Path, output: Path
) -> dict:
    _require(not output.exists(), "continuity output already exists; preserve the original record")
    _require(output.parent.is_dir() and not m8._traverses_link(output.parent),
             "continuity output needs an existing parent without links")
    original = json.loads(origin_acceptance.read_text(encoding="utf-8"))
    _require(isinstance(original, dict) and original.get("kind") == m8.EVIDENCE_KIND
             and original.get("type") == m8.EVIDENCE_TYPE, "origin must be full M8 acceptance, never a bridge")
    plans, journals, sources, natives = {}, {}, {}, {}
    for label, candidate in (("origin", origin_candidate), ("target", target_candidate)):
        plan, journal = release.load_candidate(candidate)
        _verified_rc(plan, journal)
        files = release.collect_staged_files(candidate)
        release.verify_candidate_files(plan, files)
        release.verify_artifact_bundle(candidate, plan, files)
        source = plan["source"]
        commit = source["commit"]
        _require(release._git(repository, "rev-parse", commit + "^{tree}") == source["tree"],
                 "source Git tree differs from the frozen plan")
        _require(int(release._git(repository, "show", "-s", "--format=%ct", commit)) == source["sourceDateEpoch"],
                 "source Git epoch differs from the frozen plan")
        sources[label] = release.collect_commit_files(repository, commit)
        archive = candidate / plan["artifacts"]["archive"]["path"]
        natives[label] = _native_files(plan, sources[label], archive)
        plans[label], journals[label] = plan, journal
    source_delta = compare_source_delta(sources["origin"], sources["target"])
    root = output.parent.resolve(strict=True)
    origin_descriptor = _descriptor(origin_acceptance, root)
    assets = root / (output.stem + "-artifacts")
    _require(not assets.exists(), "proof assets already exist; preserve and classify the earlier attempt")
    assets.mkdir()

    def retain(name: str, content: bytes) -> dict:
        path = assets / name
        with path.open("xb") as handle:
            handle.write(content)
        return _descriptor(path, root)

    document = {
        "schemaVersion": 1, "kind": KIND, "policy": POLICY, "result": "passed",
        "candidate": _binding(plans["target"]), "originAcceptance": origin_descriptor,
        "consumerRunsSourceCommit": plans["origin"]["source"]["commit"],
        "hostedCIInherited": False, "reuseScope": REUSE_SCOPE,
        "sourceDelta": source_delta, "candidateDelta": _delta(natives["origin"], natives["target"]),
        "maintenanceReview": retain("maintenance-review.md", maintenance_review.read_bytes()),
        "toolRevision": {
            "basedOnCommit": plans["target"]["source"]["commit"],
            "note": "Separately hashed working-tree tools; not candidate source or consumer evidence.",
            "files": [
                {"sourcePath": "scripts/" + path.name,
                 "artifact": retain("tool-" + path.name, path.read_bytes())}
                for path in (Path(__file__), Path(release.__file__), Path(m8.__file__))
            ],
        },
    }
    for label, candidate in (("origin", origin_candidate), ("target", target_candidate)):
        document[label] = {
            "plan": retain(label + "-plan.json", (candidate / release.PLAN_NAME).read_bytes()),
            "journal": retain(label + "-journal.json", (candidate / release.JOURNAL_NAME).read_bytes()),
            "sourceArchive": retain(label + "-source.zip", release.deterministic_zip_bytes(
                sources[label], epoch=plans[label]["source"]["sourceDateEpoch"])),
        }
    target_archive = target_candidate / plans["target"]["artifacts"]["archive"]["path"]
    document["target"]["archive"] = retain("target-candidate.zip", target_archive.read_bytes())
    validation = validate_continuity(document, expected_plan=plans["target"], bundle_root=root)
    _require(validation.accepted, "; ".join(validation.errors))
    with output.open("xb") as handle:
        handle.write(release.pretty_json_bytes(document))
    return document


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    create = commands.add_parser("create")
    for name in ("repository", "origin-candidate", "target-candidate", "origin-acceptance", "maintenance-review", "output"):
        create.add_argument("--" + name, type=Path, required=True)
    validate = commands.add_parser("validate")
    validate.add_argument("report", type=Path)
    validate.add_argument("--target-plan", type=Path, required=True)
    args = parser.parse_args(argv)
    try:
        if args.command == "create":
            document = create_continuity(**{key: value for key, value in vars(args).items() if key != "command"})
            print(json.dumps({"result": document["result"], "candidate": document["candidate"],
                              "sourceChangedPaths": [item["path"] for item in document["sourceDelta"]],
                              "consumerRunsSourceCommit": document["consumerRunsSourceCommit"],
                              "hostedCIInherited": False}, indent=2))
            return 0
        plan = json.loads(args.target_plan.read_text(encoding="utf-8"))
        result = validate_continuity_file(args.report, expected_plan=plan)
        print(json.dumps(result.as_dict(), indent=2))
        return 0 if result.accepted else 2
    except (release.ReleaseError, OSError, ValueError, UnicodeError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
