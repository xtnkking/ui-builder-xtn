import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCompatibilityReport,
  compareSemver,
  diffApiSnapshots,
  evaluateVersionPolicy,
  assertPinnedBaselineIdentity,
  isReleaseTargetVersion,
  parseSemver,
  validateReleaseVersionPolicy,
} from "./api-compatibility-core.mjs";

function snapshot(version = "0.2.19") {
  return {
    packageName: "personal-ui",
    version,
    source: { gitTag: "v0.2.19", gitCommit: "baseline" },
    apiDigest: `digest-${version}`,
    runtimeExports: ["Button"],
    typeOnlyExports: ["ButtonProps"],
    signatures: [
      { name: "Button", kind: "runtime", declaration: "export declare const Button: Component<ButtonProps>;" },
      { name: "ButtonProps", kind: "type", declaration: "export interface ButtonProps {}" },
    ],
    modules: [],
  };
}

test("semantic versions support prereleases and ignore build metadata for ordering", () => {
  assert.equal(compareSemver("0.3.0-rc.1", "0.2.19"), 1);
  assert.equal(compareSemver("0.3.0-rc.2", "0.3.0-rc.1"), 1);
  assert.equal(compareSemver("0.3.0", "0.3.0-rc.2"), 1);
  assert.equal(compareSemver("0.2.19+build.2", "0.2.19+build.1"), 0);
  assert.throws(() => parseSemver("v0.2.19"), /Invalid semantic version/);
  assert.throws(() => parseSemver("0.3.0-rc.01"), /Invalid semantic version/);
});

test("release target metadata accepts only the stable target or its rc.N line", () => {
  assert.equal(isReleaseTargetVersion("0.3.0", "0.3.0"), true);
  assert.equal(isReleaseTargetVersion("0.3.0-rc.1", "0.3.0"), true);
  assert.equal(isReleaseTargetVersion("0.3.0-rc.12", "0.3.0"), true);
  assert.equal(isReleaseTargetVersion("0.3.0-rc.0", "0.3.0"), false);
  assert.equal(isReleaseTargetVersion("0.3.0-beta.1", "0.3.0"), false);
  assert.equal(isReleaseTargetVersion("0.3.1-rc.1", "0.3.0"), false);
});

test("configured stable release targets preserve immutable baseline and package version constraints", () => {
  const baseline = snapshot();
  const policy = Object.freeze({ schemaVersion: 1, baselineVersion: "0.2.19", releaseTarget: "0.3.1" });
  for (const packageVersion of ["0.2.19", "0.3.1", "0.3.1-rc.1", "0.3.1-rc.12"]) {
    const validated = validateReleaseVersionPolicy(policy, packageVersion, baseline.version);
    assert.equal(validated, policy);
    const current = snapshot(packageVersion);
    current.signatures[1].declaration = "export interface ButtonProps { className?: never; }";
    const report = buildCompatibilityReport(baseline, current, validated.releaseTarget);
    assert.equal(report.baseline.version, "0.2.19");
    assert.equal(report.baseline.gitTag, "v0.2.19");
    assert.equal(report.classification, "breaking");
    assert.equal(report.versionPolicy.packageVersion, packageVersion);
    assert.equal(report.versionPolicy.releaseTarget, "0.3.1");
    assert.equal(report.versionPolicy.requiredBump, "minor");
    assert.equal(report.versionPolicy.valid, true);
  }
  for (const invalidPolicy of [
    null,
    { ...policy, schemaVersion: 2 },
    { ...policy, baselineVersion: "0.3.0" },
    ...["invalid", "0.3.1-rc.1", "0.3.1+build.1", "0.2.19", "0.2.18"]
      .map((releaseTarget) => ({ ...policy, releaseTarget })),
  ]) {
    assert.throws(() => validateReleaseVersionPolicy(invalidPolicy, "0.2.19", baseline.version));
  }
  for (const packageVersion of [
    "invalid", "0.3.0", "0.3.0-rc.1", "0.3.2", "0.3.1-beta.1", "0.3.1-rc.0",
    "0.3.1-rc.01", "0.3.1-rc.1.extra", "0.3.1+build.1", "0.3.1-rc.1+build.1", "0.2.19+build.1",
  ]) {
    assert.throws(() => validateReleaseVersionPolicy(policy, packageVersion, baseline.version));
  }
  const insufficientTarget = validateReleaseVersionPolicy({ ...policy, releaseTarget: "0.2.20" }, "0.2.19", baseline.version);
  const changed = snapshot();
  changed.signatures[1].declaration = "export interface ButtonProps { className?: never; }";
  assert.equal(buildCompatibilityReport(baseline, changed, insufficientTarget.releaseTarget).versionPolicy.valid, false);
});

test("an unchanged snapshot has no compatibility changes", () => {
  const baseline = snapshot();
  const current = structuredClone(baseline);
  current.source = undefined;
  const result = diffApiSnapshots(baseline, current);
  assert.equal(result.classification, "none");
  assert.deepEqual(result.changes.signatures, { added: [], removed: [], changed: [] });
  assert.equal(evaluateVersionPolicy("0.2.19", "0.2.19", result.classification).valid, true);
});

test("new exports and declarations are additive", () => {
  const baseline = snapshot();
  const current = snapshot("0.2.20");
  current.runtimeExports.push("IconButton");
  current.typeOnlyExports.push("IconButtonProps");
  current.signatures.push({
    name: "IconButton",
    kind: "runtime",
    declaration: "export declare const IconButton: Component<IconButtonProps>;",
  });
  current.signatures.push({
    name: "IconButtonProps",
    kind: "type",
    declaration: "export interface IconButtonProps {}",
  });
  const result = diffApiSnapshots(baseline, current);
  assert.equal(result.classification, "additive");
  assert.deepEqual(result.changes.runtimeExports.added, ["IconButton"]);
  assert.equal(evaluateVersionPolicy("0.2.19", "0.2.19", "additive").valid, false);
  assert.equal(evaluateVersionPolicy("0.2.19", "0.2.20", "additive").valid, true);
});

test("removed and changed declarations are breaking", () => {
  const baseline = snapshot();
  const current = snapshot("0.3.0");
  current.runtimeExports = [];
  current.signatures.find((signature) => signature.name === "ButtonProps").declaration = (
    "export interface ButtonProps { disabled: boolean; }"
  );
  const result = diffApiSnapshots(baseline, current);
  assert.equal(result.classification, "breaking");
  assert.deepEqual(result.changes.runtimeExports.removed, ["Button"]);
  assert.equal(result.changes.signatures.changed.length, 1);
  assert.equal(evaluateVersionPolicy("0.2.19", "0.2.20", "breaking").valid, false);
  assert.equal(evaluateVersionPolicy("0.2.19", "0.3.0-rc.1", "breaking").valid, true);
});

test("stable releases require minor additions and major breaking changes", () => {
  assert.equal(evaluateVersionPolicy("1.4.2", "1.4.3", "additive").valid, false);
  assert.equal(evaluateVersionPolicy("1.4.2", "1.5.0", "additive").valid, true);
  assert.equal(evaluateVersionPolicy("1.4.2", "1.5.0", "breaking").valid, false);
  assert.equal(evaluateVersionPolicy("1.4.2", "2.0.0-rc.1", "breaking").valid, true);
  assert.equal(evaluateVersionPolicy("1.4.2", "1.4.1", "none").valid, false);
});

test("the planned 0.3.0 target authorizes breaking M2 work while package metadata stays 0.2.19", () => {
  const baseline = snapshot();
  const current = snapshot("0.2.19");
  current.signatures.find((signature) => signature.name === "ButtonProps").declaration = (
    "export interface ButtonProps { className?: never; }"
  );
  const report = buildCompatibilityReport(baseline, current, "0.3.0");
  assert.equal(report.classification, "breaking");
  assert.equal(report.versionPolicy.packageVersion, "0.2.19");
  assert.equal(report.versionPolicy.releaseTarget, "0.3.0");
  assert.equal(report.versionPolicy.requiredBump, "minor");
  assert.equal(report.versionPolicy.valid, true);
});

test("the compatibility report records immutable baseline identity and policy", () => {
  const baseline = snapshot();
  const current = snapshot();
  const report = buildCompatibilityReport(baseline, current, "0.3.0");
  assert.equal(report.kind, "personal-ui-api-compatibility-report");
  assert.equal(report.baseline.gitTag, "v0.2.19");
  assert.equal(report.classification, "none");
  assert.equal(report.versionPolicy.valid, true);
  assert.equal(report.versionPolicy.releaseTarget, "0.3.0");
});

test("moving internal declaration modules does not change the public API", () => {
  const baseline = snapshot();
  const current = structuredClone(baseline);
  baseline.declarationModules = ["./primitives"];
  current.declarationModules = ["./foundation/buttons"];
  assert.equal(diffApiSnapshots(baseline, current).classification, "none");
});

test("a runtime-to-type namespace change is breaking", () => {
  const baseline = snapshot();
  const current = structuredClone(baseline);
  current.runtimeExports = [];
  current.typeOnlyExports = ["Button", "ButtonProps"];
  current.signatures.find((signature) => signature.name === "Button").kind = "type";
  assert.equal(diffApiSnapshots(baseline, current).classification, "breaking");
});


test("snapshots from different packages cannot be compared", () => {
  const baseline = snapshot();
  const current = snapshot();
  current.packageName = "another-package";
  assert.throws(() => buildCompatibilityReport(baseline, current), /does not match current package/);
});

test("a baseline edit cannot be hidden by refreshing its embedded digest", () => {
  const baseline = snapshot();
  baseline.apiDigest = "known-digest";
  const expected = {
    version: "0.2.19",
    gitTag: "v0.2.19",
    gitCommit: "baseline",
    apiDigest: "known-digest",
  };
  assert.doesNotThrow(() => assertPinnedBaselineIdentity(baseline, expected, "known-digest"));

  baseline.signatures[0].declaration = "tampered";
  baseline.apiDigest = "refreshed-tampered-digest";
  assert.throws(
    () => assertPinnedBaselineIdentity(baseline, expected, "refreshed-tampered-digest"),
    /does not match pinned/,
  );
});
