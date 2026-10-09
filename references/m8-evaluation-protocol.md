# M8 Independent Evaluation Protocol

Status: M8-01 evaluation-material contract. This protocol does not declare M7 complete, create a release candidate, authorize publication, or record a passing M8 result.

## Purpose

M8 evaluates whether an independent consumer can use one frozen candidate to satisfy realistic product requests. It does not ask an evaluator to reproduce the canonical demo or confirm an implementation answer supplied by the maintainer.

The coordinator owns candidate verification, environment preparation, evidence capture, and final attribution. The evaluator owns the first consumer implementation and receives only the permitted visible projection described below.

## Candidate Binding

Every evaluation run must bind to one already prepared candidate with all of these values copied exactly from its verified release plan:

- `candidateVersion`;
- `planDigest`;
- `source.commit` and `source.contentDigest`;
- `candidateContentDigest`;
- archive path, SHA-256, and byte size.

`scripts/run_m8_consumer.py` reads `evaluation/m8/scenarios.json` and the selected request from the verified candidate staging inventory. A coordinator checkout may be supplied only as a consistency check; it is never the source of dispatched bytes. The resulting manifest records the source commit and content digest, source date epoch, candidate content digest, and complete archive metadata in addition to the plan digest.

The coordinator verifies the release plan, journal, archive bytes, and checksum before creating any evaluator workspace. A request hash comes from `evaluation/m8/scenarios.json` and is checked against the exact UTF-8 request bytes before dispatch. The run record also freezes the selected support fixture id, actual operating system, architecture, Node, package-manager, browser, Python, and installer command versions.

Changing candidate bytes, request bytes, support fixture, or installation command creates a new run id. Results from different bindings cannot be merged into one passing record. The assembler-only continuity record defined below can preserve eligible origin evidence without creating or relabeling a target consumer run.

## Visible Projection

For one scenario, the evaluator may receive only:

1. a byte-identical projection of the frozen candidate needed to invoke and use the Skill;
2. the one request file named by that scenario;
3. the empty isolated consumer workspace and its declared toolchain;
4. the allowed deliverable names for that scenario.

Every file in the projection must match a path and SHA-256 in the candidate inventory. The full candidate stays coordinator-owned and read-only. Installation must use the frozen candidate, never the canonical working tree or an installed developer copy.

The projection must not expose:

- any file under `evaluation/`; the coordinator supplies only the selected request as a separately hashed `request.md`;
- the hardening roadmap or M4-M8 execution plan;
- release review notes, suspected defects, expected component mappings, or maintainer analysis;
- another scenario's request or results;
- prior evaluator attempts, repair suggestions, or consumer implementations;
- the archived HTML preview, canonical demo pages as a task solution, or answers from the development agent.

The candidate's normal public API, catalog, component documentation, runnable component examples, integration instructions, and task-routed contracts remain permitted Skill material. They are product documentation, not a prebuilt answer to the evaluator's consumer request.

## Scenario And Organizer Separation

`evaluation/m8/scenarios.json` is the coordinator index. Each entry contains only a stable id, request path and hash, representative support fixture id, and allowed deliverables. It must not contain component mappings, suspected problems, evaluation hints, or acceptance answers.

The six files under `evaluation/m8/requests/` are evaluator-only realistic requests. Dispatch their bytes unchanged. Do not prepend an intended solution, recommended component list, or known failure.

`evaluation/m8/acceptance-rules.json` is organizer-only. It defines the behavior, source, accessibility, and responsive checks applied after the first result is frozen. It must never be mounted in the evaluator workspace or quoted in the evaluator prompt.

## Immutable First Result

Create a new append-only run directory for every scenario attempt. Before organizer review, freeze at least:

- the exact dispatched request and its SHA-256;
- the visible projection inventory;
- the initial consumer source inventory and source archive hash;
- the evaluator identity available to the coordinator, start/end timestamps, and tool versions;
- every command executed, exit code, and retained stdout/stderr artifact;
- the first typecheck, build, verifier, behavior, accessibility, and responsive results that were actually attempted;
- screenshots or traces named in the scenario's allowed deliverables;
- an explicit first-result state of `passed`, `failed`, or `blocked`.

The initial directory becomes read-only in process terms after hashing. Never replace an initial failure with a later passing file, edit its logs, or rerun a command and label it as the first result. A missing required check remains missing in the initial record.

Each evaluator workspace has one UUID-backed run id and three ownership areas:

- `skill/ui-builder-xtn`, `request.md`, and `visible-inputs.json` are coordinator-owned, write-verified inputs made read-only before dispatch;
- `consumer/` is the evaluator-owned writable project area;
- `evidence/` is the coordinator-owned append-only record area.

Use `scripts/m8_evidence.py` in this order: `start`, one or more `record-command` calls, `freeze-initial`, `record-review`, zero or more `record-repair` calls, the final producer command records, `build-quality-verification`, `freeze-final`, then `scenario-fragment`. Every record is created once, read back after writing, and made read-only. Command records retain argv, workspace-relative cwd, timestamps, exit code, and file-backed stdout/stderr. Source freezes create a deterministic ZIP and inventory while excluding dependency caches and generated build output.

Coordinator input shapes for the actual environment, command record, six checks, widths, and engines are in `evaluation/m8/evidence-record-templates.json`. They are templates only; copied placeholder values are not evidence.

## Scenario Quality Producer

Run `scripts/run_m8_scenario_quality.py` inside each official evaluator workspace after the consumer has supplied its project and browser scenario. The producer accepts an existing workspace, a plan stored inside the consumer project, and a new output directory inside the workspace but outside the project source:

```text
python scripts/run_m8_scenario_quality.py \
  --workspace <evaluator-workspace> \
  --plan consumer/project/m8-quality-plan.json \
  --output quality
```

The plan has `schemaVersion: 1`, kind `personal-ui-m8-scenario-quality-plan`, a workspace-relative `projectRoot`, direct argv arrays for `typecheck`, `build`, and `verifier`, and this browser object:

```json
{
  "nodeArgv": ["node"],
  "serverArgv": ["npm", "run", "dev", "--", "--host", "127.0.0.1", "--port", "4173"],
  "readyUrl": "http://127.0.0.1:4173/",
  "url": "http://127.0.0.1:4173/scenario",
  "behaviorModule": "consumer/project/tests/m8-quality.mjs",
  "viewportHeight": 900,
  "serverTimeoutSeconds": 120,
  "actionTimeoutMs": 30000
}
```

Both URLs must address the same explicit loopback HTTP server. The behavior module must be a real file inside `projectRoot` and export `runScenario({ page, expect, check, engine, width, url })`. It owns the consumer-specific workflow and must execute at least one named assertion through `await check(name, async () => { ... })` for every engine and width. A returned `result`, including `result: "passed"`, is ignored and cannot replace executed assertions.

The producer directly executes typecheck, build, verifier, and its Node browser worker without a shell. The worker starts the declared server and uses the consumer project's installed Playwright and axe dependencies. It creates a fresh browser context and page for every Chromium, Firefox, and WebKit measurement at 2560, 1440, 1024, 736, 360, and 320 CSS px. It retains the actual browser version, user agent, URL, axe result, DOM width measurements, viewport PNG, and timestamps. Critical or serious axe violations or incomplete results, page-level horizontal overflow, blank screenshots, missing assertions, missing artifacts, or any failed command prevent creation of a passed report.

Successful output ends with `scenario-report.json`. The four files under `command-captures/`, in numbered order, are also valid `m8_evidence.py record-command --record` inputs: they retain argv, workspace-relative cwd, exit code, timestamps, and workspace-relative stdout/stderr paths. Register them before the applicable `freeze-initial` or `freeze-final` operation. After organizer review and the final four captures are registered, run `m8_evidence.py build-quality-verification --workspace <workspace> --scenario-report quality/scenario-report.json`; this deterministically binds the producer report to the append-only command records and writes `evidence/quality-verification.json`. Pass that generated file to `freeze-final --verification`; a handwritten passed verification or any command appended after generation is rejected. The producer normally runs before `freeze-final`; after final evidence is frozen, `scripts/run_m8_quality.py` revalidates the unchanged scenario report, all raw artifacts, command logs, final source snapshot, and candidate binding. On any producer failure, only `failure.json` and available diagnostic artifacts are retained; `scenario-report.json` is not written.

## Review, Attribution, And Repair Trail

Only after the first result is frozen may the organizer apply `acceptance-rules.json`. Every failed or blocked check receives exactly one primary attribution from its fixed `attributionEnum`, a concise observation, and links to the immutable artifacts that support it. Secondary context may be recorded, but it does not replace the primary attribution.

Repairs are append-only, monotonically numbered steps. Each step records:

- who changed which consumer or canonical files;
- the reason and primary attribution;
- a diff or before/after file inventory;
- the exact focused verification commands and results;
- whether the candidate changed.

A consumer-only repair stays in the same run history. A canonical Skill change invalidates the candidate binding: prepare a new candidate and start a new blind run in a fresh evaluator context for affected scenarios. Only the assembler-only continuity policy below permits reuse after its complete source and candidate comparison proves the change is within that policy. A prompted retry is remediation evidence, not another first-pass independent result.

## Isolation And Retention

Evaluator workspaces must be outside the canonical repository and any installed Skill or backup directory. The candidate and visible projection are read-only inputs; generated projects, dependency caches, browser output, and evidence use scenario-specific writable directories. A failed setup removes only its newly created workspace and never alters candidate or canonical files.

Retain the raw request, initial result, organizer review, repair trail, final result, and all hashes needed to reconstruct the decision. Secrets, machine credentials, environment files, dependency caches, and unrelated user data are never evidence artifacts.

An artifact reference is always a bundle-relative POSIX path plus exact byte size and lowercase SHA-256. `scripts/validate_m8_evidence.py` resolves every required reference under the evidence bundle root, rejects traversal and links, and verifies the actual bytes. A syntactically valid digest without a retained file is not evidence.

## Acceptance Bundle Gates

A passing `m8-acceptance` bundle contains more than the six consumer summaries:

- six unique scenario runs bound to the same candidate, with actual environment, retained commands, immutable first result, organizer review, repair trail, final result, and all six checks passed;
- one migration from immutable `v0.2.19`, including baseline, upgrade, conflict, rollback, final type/build, verifier, source, diff, and verification artifacts;
- a quality matrix for all six scenarios at 2560, 1440, 1024, 736, 360, and 320 CSS px, with Chromium, Firefox, and WebKit evidence, zero critical/serious axe findings, and separately retained real Safari 18+ evidence where `playwrightWebKit` is false;
- a local RC review bundle containing the candidate archive, checksums, migration guide, changelog, support matrix, independent-consumer report, known limitations, preview instructions, and release checklist.

The validator rejects a missing section, a non-passed check, a candidate-changing repair retained under the old binding, a fake Safari/WebKit substitution, an archive that differs from the candidate binding, or any missing/tampered artifact. Hosted CI remains a separate release evidence type and is not inferred from this bundle.

## Assembler-Only Evidence Continuity

`scripts/m8_evidence_continuity.py` produces and validates a separate `personal-ui-m8-evidence-continuity` record under policy `assembler-only-v1`. It records a narrow reuse decision between two already verified, publishable RC candidates. It does not convert the origin bundle into a target `m8-acceptance` bundle, execute a new consumer or browser run, or declare M8 or publication complete.

The origin must be a complete, passed M8 acceptance bundle that validates against the origin RC, including its six consumers, migration, quality matrix, retained review, and actual system-Safari evidence. A continuity record cannot be used as another continuity record's origin. Both RC plans, source identities, journals, inventories, and archive bytes are revalidated; a version string or previously recorded summary alone is insufficient.

The producer reads the complete canonical source file sets at both immutable commits and verifies their content digests. Both path sets must be identical, and only these files may differ in source bytes:

- `scripts/assemble_m8_acceptance.py`;
- `scripts/test_assemble_m8_acceptance.py`;
- `CHANGELOG.md`.

It independently applies the release orchestrator's deterministic version transforms to each complete source set and requires exact agreement with each candidate ZIP inventory. Version-bearing JSON files are compared in full; they are not ignored or reduced to version fields. Component or CSS changes, dependency or lockfile changes, installer changes, evaluation-rule changes, workflows, and templates are outside this policy and require their own affected acceptance evidence.

An actual maintenance review is retained with its path, byte length, and SHA-256. The continuity report retains separately hashed origin and target proof material and an `originAcceptance` reference to the unchanged full origin record. The output's evidence root must contain that origin reference so bundle-relative references can be verified without traversal. Create a new output file and then validate it against the target RC plan:

```text
python scripts/m8_evidence_continuity.py create \
  --repository <canonical-repository> \
  --origin-candidate <verified-origin-rc-directory> \
  --target-candidate <verified-target-rc-directory> \
  --origin-acceptance <original-full-m8-acceptance.json> \
  --maintenance-review <actual-maintenance-review.md> \
  --output <new-continuity-report.json>

python scripts/m8_evidence_continuity.py validate <continuity-report.json> \
  --target-plan <verified-target-rc-directory>/release-plan.json
```

Validation reopens the retained files and recomputes `sourceDelta` and `candidateDelta`; it does not trust a handwritten allowlist or passed summary. `consumerRunsSourceCommit` remains the origin commit, and `reuseScope` is limited to `consumers`, `migration`, `quality`, and `origin-system-safari`. Original run identities, first-result history, attribution, historical recording deviations, and known limitations remain unchanged. The target summary identifies the reviewed RC whose eligible source changes are covered by this reuse decision.

`hostedCIInherited` is always `false`. Origin system-Safari evidence remains part of the origin quality record; it is not target-source hosted CI. Release preflight still requires a separately validated hosted-CI bundle from the target RC's exact source. A same-source stable promotion references this reviewed target RC and must pass its own formal verification independently. The continuity helper and its documentation are maintained working tools; changing them does not create another RC or change either frozen candidate's source identity.

## Completion Boundary

This material layer is ready when both JSON files parse, all six request hashes match, scenario ids match organizer rule ids one-to-one, every support fixture id exists in the declared support fixture catalog, and no evaluator request contains an organizer acceptance answer.

The original M8-01 hardening target was `v0.3.0-rc.1`. For each subsequent release, use the configured `api-version-policy.json.releaseTarget` and its positive `rc.N` candidate; the current target is `0.3.1`. The same M7, clean immutable source, formal verification, isolated environment and binding prerequisites apply. Preserve the immutable `0.2.19` migration baseline and installed copies. A prior release's evidence cannot certify new source outside the defined continuity policy.
