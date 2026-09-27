# Personal UI Release Process

Status: local M7 release tooling plus M8 evaluation and evidence infrastructure, with one failed hosted run from initial commit `eb32c87`. The exposed issues are fixed in the current working tree, but the corrected head has not passed hosted CI. The repository version remains `0.2.19`. This document does not authorize a commit, tag, installed-copy synchronization, GitHub Release, or public distribution, and no formal release candidate exists yet.

## One orchestrator

From `assets/react-kit`, use the wired package-script entry:

```text
npm run release -- prepare ...
npm run release -- verify ...
npm run release -- publish ...
```

The same repository-owned orchestrator can be invoked from the repository root:

```text
python scripts/release_personal_ui.py prepare ...
python scripts/release_personal_ui.py verify ...
python scripts/release_personal_ui.py publish ...
```

`prepare`, `verify`, and `publish` are phases of the same orchestrator. `release:check` remains a validation command and must not be described as a release command.

## Prepare

Prepare takes an explicit source ref, source mode, target version, and new output directory. It reads the canonical checkout, updates version-bearing files only in `staging/ui-builder-xtn`, and creates:

- a deterministic, uncompressed ZIP whose paths, order, permissions, and timestamps are normalized;
- `release-plan.json` with a SHA-256 plan digest and a per-file inventory;
- `release-manifest.json`, `RELEASE_NOTES.md`, and sorted `SHA256SUMS`;
- `release-journal.json`, initially recording only local preparation.

`--dry-run` calculates and prints the same plan without creating the output directory, staging tree, artifact, journal, Git ref, or generated copy. The output must be outside the canonical repository, an existing output directory is never overwritten, and a temporary preparation failure is removed before the command returns.

A dirty worktree is rejected unless `--allow-dirty-local` is explicit. That option creates a content-addressed local snapshot but permanently marks the candidate non-publishable. It is useful for testing M7 itself, not for a release review. A publishable candidate must come from an immutable commit snapshot.

## Verify

Verify first validates the plan digest, staged file inventory, archive members, and every artifact hash and size. The plan binds the ZIP, manifest, release notes, and checksum file; the manifest must exactly equal the deterministic projection of the plan, and `SHA256SUMS` must exactly equal the deterministic checksum projection. It then executes the frozen verification command list in staging: clean dependency installation, the focused release-orchestrator contracts, and the existing complete release gate. Build output, dependencies, caches, logs, test results, environment files, and secrets are excluded from the archive.

After the commands finish, verify inventories staging again and independently rebuilds the archive. Any source mutation or checksum difference fails verification. Success is recorded in the journal; it is not a tag or release.

## Publish

The current CLI implements publication preflight but intentionally has no real remote adapter. It cannot commit, tag, push, call GitHub, synchronize installed copies, or publish an npm package. The React starter is private, so `npm publish` is not part of this release model.

Publication remains blocked unless all of the following are true:

- the source is an immutable clean commit and all prepared bytes still match the reviewed plan;
- the canonical `LICENSE` is the selected MIT text, package/lockfile/Skill metadata all equal `MIT`, and a valid `THIRD_PARTY_NOTICES.json` inventory exists;
- verify completed successfully for the exact plan digest;
- M8 acceptance evidence and hosted CI evidence are valid structured records bound to the plan digest, source commit, archive SHA-256, evidence type, and a `passed` result;
- explicit authorization equals the reviewed plan digest;
- no existing version or tag would be reused;
- a separately authorized remote adapter has been implemented.

`THIRD_PARTY_NOTICES.json` uses schema version `1`, kind `personal-ui-third-party-notices`, `generatedFrom: assets/react-kit/package-lock.json`, the exact integer `dependencyCount`, and a non-empty `items` array. Every item records non-empty `name`, `version`, `license`, `source`, `resolved`, and `dependencyType` strings plus a boolean `optional` value. `source` and `resolved` both identify the exact locked tarball; the release preflight derives the expected inventory from the lockfile and rejects duplicate, missing, extra, source, license, resolution, dependency-type, optional, count, or generator metadata mismatches. Refresh with `python scripts/generate_third_party_notices.py --write` and verify with `--check`. M8 and CI evidence are JSON objects with schema version `1`, kind `personal-ui-release-evidence`, their respective `type` (`m8-acceptance` or `hosted-ci`), the exact `planDigest`, `sourceCommit`, and `archiveSha256`, plus `result: passed`. M8 acceptance additionally requires all six unique consumer scenarios, immutable request/input/initial/final artifact hashes, fresh-context and forbidden-input assertions, a fixed attribution, and passed typecheck, build, verifier, behavior, accessibility, and responsive checks. `scripts/validate_m8_evidence.py` enforces that structure; a binding-only JSON record is rejected.

The adapter contract is journaled as idempotent steps: freeze the release commit, create an immutable tag, push source and tag, create a draft GitHub Release, upload artifacts and checksums, verify downloaded identity, publish the Release, then synchronize only explicitly named generated copies. A local failure before remote work leaves no version or tag. After any remote side effect, recovery resumes from the journal; automation must never move or delete a public tag to simulate rollback.

## Hosted CI evidence

Hosted CI is a file-backed release bundle, not a workflow badge or a binding-only `result: passed` object. The `hosted-evidence` workflow job downloads and reopens exactly ten successful job records: all eight support fixtures, one Playwright browser-quality record, and one system-Safari record. Every descriptor stores the relative artifact path, exact byte length, and SHA-256. Every record must agree on repository, source commit, workflow ref, event, run URL, run id, and run attempt.

The fixture records include the exact Node, Python, package-manager, React, React DOM, TypeScript, and framework versions observed by `run_support_fixture.py`, plus the complete install/render/typecheck/build/verify/upgrade/rollback operation list declared by the frozen fixture catalog. The browser record retains the actual Chromium, Firefox, and WebKit versions and the successful behavior, accessibility, visual, and version-inventory operations. The Safari record must come from system Safari 18 or newer driven by Apple's `safaridriver`; its capabilities, user agent, driver version, rendered root, and public-component interaction are retained. Playwright WebKit is useful engine coverage but is never accepted as real Safari evidence.

The first hosted run, [36315585577](https://github.com/xtnkking/ui-builder-xtn/actions/runs/36315585577) from commit `eb32c87`, failed and is not release evidence. It exposed a stale locale path, raw inline Explorer SVG, Corepack signature incompatibility, missing repository dependencies in integration jobs, React 19 nullable-ref typing, and a platform-incomplete Rollup lockfile. Candidate fixes exist locally, but only a successful rerun from the corrected immutable head and a subsequently validated ten-record bundle can close this gate.

The aggregator calculates `planDigest`, `sourceCommit`, and `archiveSha256` from the same deterministic release-plan logic used by `prepare`, then validates the completed bundle before upload. `scripts/validate_hosted_ci_evidence.py` independently reopens every referenced file and checks its bytes, release bindings, GitHub run identity, environments, operations, browser coverage, and Safari identity. A configured workflow, a triggered run, and a downloaded passing bundle are three different states; support entries may move from `target` to `verified` only after the last state is retained with its run URL and artifact SHA-256.

## Reproducibility

The candidate inventory is an allowlist rooted at the Skill, component assets, scripts, references, documentation, and workflow source. It rejects symbolic links, special files, path traversal, and case-insensitive path collisions. ZIP entries use stable lexical order, regular-file mode `0644`, `SOURCE_DATE_EPOCH` from the source commit, and no compressor-dependent output. Two isolated preparations of the same source and version must therefore have the same archive bytes and SHA-256.

Checksums prove byte identity, not publisher identity. Signing or provenance attestations require a separate user decision and must not be implied by SHA-256 alone.

## M8 evaluator workspace

The coordinator-owned scenario catalog and acceptance rules live under `evaluation/m8/` and remain in the full candidate so its M8 contracts are reproducible. `scripts/run_m8_consumer.py` takes one catalog scenario and one verified candidate, revalidates the candidate plan, journal, staged inventory, archive, manifest, and checksums, then creates a new evaluator workspace outside the repository. The evaluator-visible projection excludes the entire `evaluation/` tree, this protocol's internal maintenance material, the hardening roadmap, and the M4-M8 execution plan; it adds back only the selected request as a separately hashed `request.md`. See [M8 independent evaluation protocol](m8-evaluation-protocol.md).

Official evaluator workspaces require a clean immutable source commit, `publishable: true`, and a completed candidate verify step. `--rehearsal` may exercise the projection using a dirty or non-publishable candidate, but it remains `official: false`, is ineligible for acceptance evidence, and still requires candidate verification. It cannot substitute for the formal `v0.3.0-rc.1` freeze.

## M8 quality and local review bundle

M8 acceptance is separate from hosted CI. Its six scenario records prove independent consumer use; its migration record proves a real `v0.2.19` upgrade, conflict path, rollback, and final verification; and its quality matrix proves behavior, accessibility, and responsive results at 2560, 1440, 1024, 736, 360, and 320 CSS pixels across Chromium, Firefox, and WebKit. It also retains zero-critical/zero-serious axe evidence and a separate system-Safari 18+ smoke where `playwrightWebKit` is explicitly false.

The local review bundle retains the candidate archive, checksums, migration guide, changelog, support matrix, independent-consumer report, known limitations, preview instructions, and release checklist. Each item is an actual bundle-relative file with byte length and SHA-256; the candidate archive entry must match the frozen candidate binding exactly. `scripts/validate_m8_evidence.py` rejects a missing or tampered file, incomplete scenario or width/engine set, candidate-changing repair under an old binding, fake Safari record, failed migration check, or incomplete review bundle. Passing this local gate makes the RC reviewable; it does not authorize public release.

## Version policy

The immutable compatibility baseline is `0.2.19`; the current hardening release line is `0.3.0`.

- Before `1.0.0`, a breaking public API change requires the next minor line and an additive public API change requires at least a patch. At or after `1.0.0`, breaking changes require a major and additive changes require a minor.
- This cycle currently prepares only `0.3.0-rc.N`, where `N` is a positive integer without leading zeroes. Beta, arbitrary prerelease labels, build metadata, downgrades, other release lines, reused versions, and stable versions fail.
- RC numbers increase monotonically. Stable `0.3.0` remains hard-blocked until the orchestrator can load a real verified RC candidate, bind its evidence, and prove that only reviewed release metadata changed. A tag name or `--promotion-from` string alone is not promotion evidence.
- Package metadata may stay at `0.2.19` during development. Candidate version changes happen in isolated staging. The canonical checkout changes version only in a separately authorized release operation.

These rules are enforced by the release orchestrator and by the API compatibility gate; prose alone is not release evidence.

## Historical evidence

The early repository used package-version commits but did not create a tag for every version. The table records only facts recoverable from Git history. Missing numbers are not releases and must not be invented.

| Package version | Commit | Commit date | Evidence status |
| --- | --- | --- | --- |
| `0.1.0` | `11e8f90` | 2026-09-11 | Initial source-version commit; no tag found. |
| `0.2.0` | `91973f8` | 2026-09-11 | Source-version commit; no tag found. |
| `0.2.1` | `9d495b2` | 2026-09-13 | Source-version commit; no tag found. |
| `0.2.5` | `a24e11f` | 2026-09-13 | Source-version commit; no evidence for `0.2.2` through `0.2.4`. |
| `0.2.8` | `54b15d0` | 2026-09-13 | Source-version commit; no evidence for `0.2.6` or `0.2.7`. |
| `0.2.10` | `a920114` | 2026-09-13 | Source-version commit; no evidence for `0.2.9`. |
| `0.2.11` | `c591699` | 2026-09-13 | Source-version commit; no tag found. |
| `0.2.12` | `15b3511` | 2026-09-13 | Source-version commit; no tag found. |
| `0.2.14` | `a181164` | 2026-09-16 | Source-version commit; no evidence for `0.2.13`. |
| `0.2.15` | `b2cd98d` | 2026-09-16 | Source-version commit; no tag found. |
| `0.2.16` | `6bc7e2c` | 2026-09-16 | Source-version commit; no tag found. |
| `0.2.17` | `6eaa7e9` | 2026-09-17 | Source-version commit; no tag found. |
| `0.2.18` | `2f28312` | 2026-09-17 | Source-version commit; no tag found. |
| `0.2.19` | `0587d4b` | 2026-09-17 | Local annotated baseline tag `v0.2.19`; remote tag was absent at the M7 audit. |

Commit subjects and diffs may support changelog reconstruction, but they are not proof that a public GitHub Release existed. The current `v0.3.0` work stays under `[Unreleased]` until an authorized release operation converts it.

## License decision

The user selected the MIT License for this repository. The root `LICENSE`, package metadata, and Skill frontmatter record `MIT` consistently, with copyright attributed to 2026 xtnkking.

`THIRD_PARTY_NOTICES.json` now inventories all 226 unique dependency versions in the lockfile, including the MPL-2.0 development tools and CC-BY-4.0 metadata package. Preflight validates that inventory against the lockfile. Explorer media is a project-authored repository SVG asset rather than remote runtime media; bundled documentation and generated test screenshots are project-generated repository assets covered by the repository MIT License. License and notice blockers are therefore closed, while successful hosted CI for the corrected immutable head, candidate verification, and M8 evidence remain outstanding.
