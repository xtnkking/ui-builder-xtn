# Personal UI Release Process

This document describes the M7/M8 release contracts. The development checkout can retain `0.2.19` metadata while candidates are prepared in isolation. A public release exists only when its completed journal, immutable tag, GitHub Release, checksums, and generated copies identify the same plan. Hosted CI, M8 acceptance, and any eligible assembler-only continuity record are retained outside the candidate source after freeze; this document cannot attest to their outcome.

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

Preparing stable for the frozen `releaseTarget` is a separate promotion operation. `--promotion-from` must be the filesystem path of an already verified, publishable `<releaseTarget>-rc.N` candidate that ran the frozen formal verification command set; a tag name, version string, plan digest, thin verification plan, or unverified directory is insufficient. The stable candidate must retain that same formal command set. The RC and stable preparation must use the same immutable commit, tree, source content digest, and source timestamp. The stable plan hash-binds the RC plan, archive, candidate inventory, verification record, and source identity. It records the complete RC-to-stable file delta and rejects any change outside the fixed version-bearing metadata files plus `CHANGELOG.md`. The currently configured target is `0.3.1`; the already published `v0.3.0` tag and artifacts are never reused for these later changes.

```text
python scripts/release_personal_ui.py prepare \
  --output <new-stable-candidate-directory> \
  --version <configured-stable-version> \
  --source-mode commit \
  --source-ref <the-reviewed-source-commit> \
  --promotion-from <verified-rc-candidate-directory>
```

Promotion leaves an empty `[Unreleased]` section and moves its reviewed content into a dated section for the configured stable version. The structured `Release status` subsection is replaced with the RC binding and remaining publication conditions, so an old “unreleased” warning cannot be copied into the stable entry. Stable release notes identify the verified RC plan instead of claiming to be a local RC or an already published release.

## Verify

Verify first validates the plan digest, staged file inventory, archive members, and every artifact hash and size. The plan binds the ZIP, manifest, release notes, and checksum file; the manifest must exactly equal the deterministic projection of the plan, and `SHA256SUMS` must exactly equal the deterministic checksum projection. It then executes the frozen verification command list in staging: clean dependency installation, the focused release-orchestrator contracts, and the existing complete release gate. Build output, dependencies, caches, logs, test results, environment files, and secrets are excluded from the archive.

After the commands finish, verify inventories staging again and independently rebuilds the archive. Any source mutation or checksum difference fails verification. Success is recorded in the journal; it is not a tag or release.

## Publish

When resuming a draft already created by this plan, both remote verification and publication resolve the authenticated Release ID recorded in the completed draft journal. They validate the exact tag, plan ownership marker, target commit, ID and expected draft/public state. A missing or conflicting identity is rejected; recovery does not create another draft, move refs or repeat successful uploads. An already-public matching Release is verified read-only. These contracts are exercised with offline fixtures; that evidence does not itself constitute a new public release.

The CLI defaults to a read-only publication preflight. Remote and generated-copy mutations are reachable only through `publish --execute`, after the exact reviewed `planDigest`, valid M8 and hosted-CI evidence, and a verified immutable candidate all pass preflight. The React starter is private, so `npm publish` is not part of this release model.

Publication remains blocked unless all of the following are true:

- the source is an immutable clean commit and all prepared bytes still match the reviewed plan;
- the canonical `LICENSE` is the selected MIT text, package/lockfile/Skill metadata all equal `MIT`, and a valid `THIRD_PARTY_NOTICES.json` inventory exists;
- verify completed successfully for the exact plan digest;
- full M8 acceptance evidence, a valid `assembler-only-v1` continuity record, or the explicitly approved sampled-impact record below covers the reviewed RC, while separately validated hosted CI binds to that RC's exact plan digest, source commit, and archive SHA-256;
- explicit authorization equals the reviewed plan digest;
- no existing version or tag would be reused;
- the guarded Git/GitHub adapter passes its own safety preflight.

For an RC, a full M8 acceptance bundle and hosted-CI evidence bind directly to that candidate. The narrow continuity alternative below preserves the origin's complete M8 binding while recording eligible reuse for the target RC; hosted CI must still bind directly to the target. For a promoted stable candidate, preflight resolves the reviewed RC plan through the validated promotion binding and validates M8 evidence against that RC. Stable formal verification remains an independent requirement. Publication must not fabricate evidence with the stable archive hash. Final authorization must equal the promoted stable plan digest so the user approves the exact version metadata, changelog, release notes, archive, and checksums that will be published.

`THIRD_PARTY_NOTICES.json` uses schema version `1`, kind `personal-ui-third-party-notices`, `generatedFrom: assets/react-kit/package-lock.json`, the exact integer `dependencyCount`, and a non-empty `items` array. Every item records non-empty `name`, `version`, `license`, `source`, `resolved`, and `dependencyType` strings plus a boolean `optional` value. `source` and `resolved` both identify the exact locked tarball; the release preflight derives the expected inventory from the lockfile and rejects duplicate, missing, extra, source, license, resolution, dependency-type, optional, count, or generator metadata mismatches. Refresh with `python scripts/generate_third_party_notices.py --write` and verify with `--check`. Full M8 and CI evidence are JSON objects with schema version `1`, kind `personal-ui-release-evidence`, their respective `type` (`m8-acceptance` or `hosted-ci`), the exact `planDigest`, `sourceCommit`, and `archiveSha256`, plus `result: passed`. M8 acceptance additionally requires all six unique consumer scenarios, immutable request/input/initial/final artifact hashes, fresh-context and forbidden-input assertions, a fixed attribution, and passed typecheck, build, verifier, behavior, accessibility, and responsive checks. `scripts/validate_m8_evidence.py` enforces that structure; a binding-only JSON record is rejected. The distinct continuity kind is validated by `scripts/m8_evidence_continuity.py` against the reviewed RC plan through the same `--m8-evidence` release argument.

The adapter contract is journaled as idempotent steps: freeze the release commit in a temporary worktree, create an immutable annotated tag, atomically push source and tag without force/delete refspecs, create a draft GitHub Release, upload artifacts and checksums, download and verify their byte identity, publish the Release, then synchronize only explicitly named absolute generated-copy targets. Existing lightweight tags, different annotated tag objects, unmanaged destination collisions, or uncommitted destination changes block execution. Credentials are read through Git's credential helper into process memory and are never written to the journal or command arguments. A local failure before remote work leaves no version or tag. After any remote side effect, recovery resumes from the journal; automation must never move or delete a public tag to simulate rollback.

## Hosted CI evidence

Hosted CI is a file-backed release bundle, not a workflow badge or a binding-only `result: passed` object. The `hosted-evidence` workflow job downloads and reopens exactly ten successful job records: all eight support fixtures, one Playwright browser-quality record, and one system-Safari record. Every descriptor stores the relative artifact path, exact byte length, and SHA-256. Every record must agree on repository, source commit, workflow ref, event, run URL, run id, and run attempt.

The fixture records include the exact Node, Python, package-manager, React, React DOM, TypeScript, and framework versions observed by `run_support_fixture.py`, plus the complete install/render/typecheck/build/verify/upgrade/rollback operation list declared by the frozen fixture catalog. The browser record retains the actual Chromium, Firefox, and WebKit versions and the successful behavior, accessibility, visual, and version-inventory operations. The Safari record must come from system Safari 18 or newer driven by Apple's `safaridriver`; its capabilities, user agent, driver version, rendered root, and public-component interaction are retained. Playwright WebKit is useful engine coverage but is never accepted as real Safari evidence.

Earlier failed or cancelled hosted runs are diagnostic history. The hosted record accepted for an RC must come from its exact immutable source commit and pass ten-record bundle validation. The run URL, attempt, artifact SHA-256, and validation result belong in the retained post-freeze release ledger, not in the source commit whose hash that run must match.

The workflow derives its RC version from the frozen `api-version-policy.json` release target. The aggregator calculates `planDigest`, `sourceCommit`, and `archiveSha256` from the same deterministic release-plan logic used by `prepare`, validates the complete immutable RC plan and its formal command configuration, then validates the completed bundle before upload. This plan check does not execute or certify formal verification. `scripts/validate_hosted_ci_evidence.py` independently reopens every referenced file and checks its bytes, release bindings, GitHub run identity, environments, operations, browser coverage, and Safari identity. A configured workflow, a triggered run, and a downloaded passing bundle are three different states; support entries may move from `target` to `verified` only after the last state is retained with its run URL and artifact SHA-256.

The post-freeze ledger consists of the candidate `release-plan.json` and `release-journal.json`, the validated hosted evidence bundle, the M8 `m8-acceptance.json` with its retained review files or an eligible continuity record with that unchanged origin bundle, and, after publication, the immutable tag and GitHub Release. Compare the distinct origin and target source identities, reviewed RC plan digest, archive SHA-256, stable promotion binding, and publication steps before declaring M7/M8 complete. These records are retained outside the source commit so recording evidence cannot invalidate its exact-source binding. Continuity never makes an origin hosted-CI run valid for another source commit.

## Reproducibility

The candidate inventory is an allowlist rooted at the Skill, component assets, scripts, references, documentation, and workflow source. It rejects symbolic links, special files, path traversal, and case-insensitive path collisions. ZIP entries use stable lexical order, regular-file mode `0644`, `SOURCE_DATE_EPOCH` from the source commit, and no compressor-dependent output. Two isolated preparations of the same source and version must therefore have the same archive bytes and SHA-256.

Checksums prove byte identity, not publisher identity. Signing or provenance attestations require a separate user decision and must not be implied by SHA-256 alone.

## M8 evaluator workspace

The coordinator-owned scenario catalog and acceptance rules live under `evaluation/m8/` and remain in the full candidate so its M8 contracts are reproducible. `scripts/run_m8_consumer.py` takes one catalog scenario and one verified candidate, revalidates the candidate plan, journal, staged inventory, archive, manifest, and checksums, then creates a new evaluator workspace outside the repository. The evaluator-visible projection excludes the entire `evaluation/` tree, this protocol's internal maintenance material, the hardening roadmap, and the M4-M8 execution plan; it adds back only the selected request as a separately hashed `request.md`. See [M8 independent evaluation protocol](m8-evaluation-protocol.md).

Official evaluator workspaces require a clean immutable source commit, `publishable: true`, and a completed candidate verify step. `--rehearsal` may exercise the projection using a dirty or non-publishable candidate, but it remains `official: false`, is ineligible for acceptance evidence, and still requires candidate verification. It cannot substitute for the formal freeze on the configured release line. Historical `v0.3.0-rc.1` evidence retains its original candidate binding.

## M8 quality and local review bundle

M8 acceptance is separate from hosted CI. Its six scenario records prove independent consumer use; its migration record proves a real `v0.2.19` upgrade, conflict path, rollback, and final verification; and its quality matrix proves behavior, accessibility, and responsive results at 2560, 1440, 1024, 736, 360, and 320 CSS pixels across Chromium, Firefox, and WebKit. It also retains zero-critical/zero-serious axe evidence and a system-Safari 18+ record produced by the successful hosted macOS job and bound to the same candidate source commit and release plan. Playwright WebKit or a standalone hand-authored Safari-shaped JSON record is not accepted.

The local review bundle retains the candidate archive, checksums, migration guide, changelog, support matrix, independent-consumer report, known limitations, preview instructions, and release checklist. Assembly takes six explicit scenario root/fragment pairs rather than guessing an artifact root. It reopens the scenario source archives, the official migration producer inventory, and the quality raw-evidence inventory before copying anything. Organizer-supplied `review-inputs.json` provides the actual limitations and preview project metadata; generated preview instructions contain executable extract, install, and start commands bound to each final source archive. Each retained item is an actual bundle-relative file with byte length and SHA-256; the candidate archive entry must match the frozen candidate binding exactly. `scripts/validate_m8_evidence.py` rejects a missing or tampered file, incomplete scenario or width/engine set, candidate-changing repair under an old binding, fake Safari record, failed migration check, or incomplete review bundle. Passing this local gate makes the RC reviewable; it does not authorize public release.

## Assembler-only M8 continuity

`scripts/m8_evidence_continuity.py` provides a narrow alternative to a new M8 bundle when two already verified, publishable RCs differ only in assembler maintenance. Its record has kind `personal-ui-m8-evidence-continuity` and policy `assembler-only-v1`. The origin must be a complete passed M8 bundle, never another continuity record. The helper reopens retained origin and target plans, source archives, journals, candidate archive proofs, the original acceptance record, and an actual maintenance review.

The complete canonical source path sets must agree, and the source digest for each immutable commit must match its candidate plan. Only `scripts/assemble_m8_acceptance.py`, `scripts/test_assemble_m8_acceptance.py`, and `CHANGELOG.md` may differ in source bytes. Deterministic release version transforms must reproduce both complete candidate inventories and ZIP members exactly. Version-bearing JSON is not ignored wholesale. Components, CSS, dependencies, installers, evaluation rules, workflows, and templates cannot use this exception.

The producer command is `python scripts/m8_evidence_continuity.py create --repository <repository> --origin-candidate <verified-origin-rc> --target-candidate <verified-target-rc> --origin-acceptance <original-full-m8.json> --maintenance-review <actual-review.md> --output <new-report.json>`. Place the output under an evidence root containing the original acceptance reference. `python scripts/m8_evidence_continuity.py validate <report.json> --target-plan <target-rc>/release-plan.json` reopens the hash-bound proof material and recomputes both deltas. Release preflight accepts this record through `--m8-evidence` and validates its target against the reviewed RC; promoted stable resolves that RC from its validated promotion.

The report keeps `consumerRunsSourceCommit` at the origin and limits `reuseScope` to `consumers`, `migration`, `quality`, and `origin-system-safari`. The six consumer runs, migration, browser results, Safari identity, historical deviations, and limitations retain their original attribution; no new target run is asserted. `hostedCIInherited` remains `false`, so target-source hosted CI is still mandatory for publication. Stable must also retain and independently pass its own formal verification. This is a local reuse record, not a new public release or an M8 completion declaration. The helper and documentation are maintained working tools separate from the frozen candidates; a tool edit alone does not require creating another RC.

## Approved sampled-impact M8 acceptance

The user approved change-impact acceptance on 2026-10-10 for the remaining R3 work. `scripts/m8_impact_acceptance.py` validates the distinct kind `personal-ui-m8-impact-acceptance` with policy `r3-sampled-impact-2026-10-10-v1`. It does not broaden the full-bundle or `assembler-only-v1` validators. Release preflight accepts it through the existing `--m8-evidence` argument and binds its target to the reviewed RC.

This bounded policy permits only the two diagnosed managed-runtime changes in `display/display.tsx` and `internal/layer-kernel.tsx`, requires unchanged public API, retains the origin's complete family-login report and migration under their original identities, and requires actual target installation, typecheck, build, provenance, and browser evidence for five repaired consumers. Each uses Chromium, Firefox, and WebKit at two widths: member-crud/searchable-table at 1440 and 320; complex-form/detail-panel/nested-modal at 2560 and 320. The report lists the 30 new cells, 18 origin family cells, and 60 unproven cells explicitly. `fullMatrixProven` and `newBlindEvaluation` remain false; the origin migration is not represented as a target migration.

All candidate/source deltas, command captures, installed source, raw behavior/axe/responsive measurements, screenshots, and execution-ledger provenance must validate. The original failures remain retained. New exact-source hosted CI and stable formal verification remain independent release requirements; sampled acceptance is not a claim that the original 108-cell matrix passed.

## Version policy

The immutable historical compatibility and M8 migration baseline remains the annotated `v0.2.19` source. The current development `releaseTarget` is `0.3.1`, while public `v0.3.0` and its acceptance records remain unchanged. The compatibility report's `breaking` classification describes the historical comparison from `0.2.19`; it does not claim a new breaking change relative to published `0.3.0`. This patch prepares source-policy and tooling corrections without extending the public component API. A future change relative to the published API requires its own comparison and version decision; it must not silently replace the historical baseline.

- Before `1.0.0`, a breaking public API change requires the next minor line and an additive public API change requires at least a patch. At or after `1.0.0`, breaking changes require a major and additive changes require a minor.
- This cycle prepares `<releaseTarget>-rc.N`, currently `0.3.1-rc.N`, where `N` is a positive integer without leading zeroes, and permits the same-line stable version only through the verified promotion contract. Beta, arbitrary prerelease labels, build metadata, downgrades, other release lines, and reused versions fail.
- RC numbers increase monotonically. Stable is allowed only when `--promotion-from` resolves to a real verified RC candidate on the configured release line. The stable plan must prove the same immutable source, retain the RC evidence bindings, and show that only the fixed version/changelog metadata set changed. A tag name, version string, or digest alone is not promotion evidence.
- Package metadata may stay at `0.2.19` in the development source snapshot. Candidate version changes happen in isolated staging; the promoted stable metadata is frozen into the release tag by the authorized publication operation.

The assembler derives the RC identity from the digest-validated, formally verified plan rather than a fixed old version string. Its frozen API policy and compatibility report must agree with the plan's baseline, target, historical classification, and candidate version. M8 still performs one real migration from the immutable `v0.2.19` baseline; any additional upgrade fixture relative to public `v0.3.0` is separately identified and cannot overwrite that original migration path or its evidence.

These rules are enforced by the release orchestrator and by the API compatibility gate; prose alone is not release evidence. Preparing this next version does not declare its RC, CI, M8, stable verification, publication, or installed-copy synchronization complete.

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

Commit subjects and diffs may support changelog reconstruction, but they are not proof that a public GitHub Release existed. The source-cut changelog keeps the work under `[Unreleased]`; an authorized stable promotion converts that section in its isolated release candidate.

## License decision

The user selected the MIT License for this repository. The root `LICENSE`, package metadata, and Skill frontmatter record `MIT` consistently, with copyright attributed to 2026 xtnkking.

`THIRD_PARTY_NOTICES.json` inventories all 226 unique dependency versions in the lockfile, including the MPL-2.0 development tools and CC-BY-4.0 metadata package. Preflight validates that inventory against the lockfile. Explorer media is a project-authored repository SVG asset rather than remote runtime media; bundled documentation and generated test screenshots are project-generated repository assets covered by the repository MIT License. The exact-source hosted, candidate, M8, and publication outcomes must be read from the post-freeze ledger described above.
