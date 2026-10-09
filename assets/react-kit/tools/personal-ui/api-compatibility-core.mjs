import { createHash } from "node:crypto";

const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
const compareNames = (left, right) => (left < right ? -1 : left > right ? 1 : 0);

export function parseSemver(value) {
  const match = typeof value === "string" ? SEMVER.exec(value) : null;
  if (!match) throw new Error(`Invalid semantic version ${JSON.stringify(value)}`);
  const prerelease = match[4]?.split(".") ?? [];
  if (prerelease.some((identifier) => /^0\d+$/.test(identifier))) {
    throw new Error(`Invalid semantic version ${JSON.stringify(value)}`);
  }
  return {
    raw: value,
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease,
  };
}

export function isReleaseTargetVersion(candidateValue, releaseTargetValue) {
  const candidate = parseSemver(candidateValue);
  const releaseTarget = parseSemver(releaseTargetValue);
  if (releaseTarget.prerelease.length > 0) return false;
  if (
    candidate.major !== releaseTarget.major
    || candidate.minor !== releaseTarget.minor
    || candidate.patch !== releaseTarget.patch
  ) {
    return false;
  }
  if (candidate.prerelease.length === 0) return true;
  return candidate.prerelease.length === 2
    && candidate.prerelease[0] === "rc"
    && /^[1-9]\d*$/.test(candidate.prerelease[1]);
}

function comparePrerelease(left, right) {
  if (left.length === 0 && right.length === 0) return 0;
  if (left.length === 0) return 1;
  if (right.length === 0) return -1;
  const limit = Math.max(left.length, right.length);
  for (let index = 0; index < limit; index += 1) {
    if (left[index] === undefined) return -1;
    if (right[index] === undefined) return 1;
    const leftNumeric = /^\d+$/.test(left[index]);
    const rightNumeric = /^\d+$/.test(right[index]);
    if (leftNumeric && rightNumeric) {
      const difference = Number(left[index]) - Number(right[index]);
      if (difference !== 0) return Math.sign(difference);
      continue;
    }
    if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
    const difference = compareNames(left[index], right[index]);
    if (difference !== 0) return difference;
  }
  return 0;
}

export function compareSemver(leftValue, rightValue) {
  const left = typeof leftValue === "string" ? parseSemver(leftValue) : leftValue;
  const right = typeof rightValue === "string" ? parseSemver(rightValue) : rightValue;
  for (const field of ["major", "minor", "patch"]) {
    if (left[field] !== right[field]) return Math.sign(left[field] - right[field]);
  }
  return comparePrerelease(left.prerelease, right.prerelease);
}

export function validateReleaseVersionPolicy(policy, packageVersion, baselineVersion) {
  if (!policy || policy.schemaVersion !== 1 || policy.baselineVersion !== baselineVersion) {
    throw new Error(`API version policy must identify baseline ${baselineVersion} with schemaVersion 1`);
  }
  const releaseTarget = parseSemver(policy.releaseTarget);
  if (releaseTarget.prerelease.length > 0 || releaseTarget.raw.includes("+")) {
    throw new Error("API version policy releaseTarget must be a stable version without build metadata");
  }
  if (compareSemver(releaseTarget, baselineVersion) <= 0) {
    throw new Error(`API version policy releaseTarget must be newer than baseline ${baselineVersion}`);
  }
  const candidate = parseSemver(packageVersion);
  if (
    candidate.raw.includes("+")
    || (packageVersion !== baselineVersion && !isReleaseTargetVersion(packageVersion, policy.releaseTarget))
  ) {
    throw new Error(
      `Package metadata must identify baseline ${baselineVersion}, `
      + `release target ${policy.releaseTarget}, or its rc.N prerelease; found ${packageVersion}`,
    );
  }
  return policy;
}

function difference(left, right) {
  const rightSet = new Set(right);
  return left.filter((value) => !rightSet.has(value)).sort(compareNames);
}

function signatureMap(snapshot) {
  return new Map(snapshot.signatures.map((signature) => [signature.name, signature]));
}

function declarationHash(declaration) {
  return createHash("sha256").update(declaration).digest("hex");
}

export function diffApiSnapshots(baseline, current) {
  const baselineSignatures = signatureMap(baseline);
  const currentSignatures = signatureMap(current);
  const addedSignatureIds = difference([...currentSignatures.keys()], [...baselineSignatures.keys()]);
  const removedSignatureIds = difference([...baselineSignatures.keys()], [...currentSignatures.keys()]);
  const changedSignatures = [...baselineSignatures.keys()]
    .filter((id) => {
      const before = baselineSignatures.get(id);
      const after = currentSignatures.get(id);
      return currentSignatures.has(id)
        && (before.kind !== after.kind || before.declaration !== after.declaration);
    })
    .sort(compareNames)
    .map((id) => ({
      id,
      baselineKind: baselineSignatures.get(id).kind,
      currentKind: currentSignatures.get(id).kind,
      baselineHash: declarationHash(baselineSignatures.get(id).declaration),
      currentHash: declarationHash(currentSignatures.get(id).declaration),
    }));

  const changes = {
    runtimeExports: {
      added: difference(current.runtimeExports, baseline.runtimeExports),
      removed: difference(baseline.runtimeExports, current.runtimeExports),
    },
    typeOnlyExports: {
      added: difference(current.typeOnlyExports, baseline.typeOnlyExports),
      removed: difference(baseline.typeOnlyExports, current.typeOnlyExports),
    },
    signatures: {
      added: addedSignatureIds,
      removed: removedSignatureIds,
      changed: changedSignatures,
    },
  };

  const hasBreakingChange = (
    changes.runtimeExports.removed.length > 0
    || changes.typeOnlyExports.removed.length > 0
    || changes.signatures.removed.length > 0
    || changes.signatures.changed.length > 0
  );
  const hasAdditiveChange = (
    changes.runtimeExports.added.length > 0
    || changes.typeOnlyExports.added.length > 0
    || changes.signatures.added.length > 0
  );

  return {
    classification: hasBreakingChange ? "breaking" : hasAdditiveChange ? "additive" : "none",
    changes,
  };
}

export function evaluateVersionPolicy(baselineValue, currentValue, classification) {
  const baseline = parseSemver(baselineValue);
  const current = parseSemver(currentValue);
  const comparison = compareSemver(current, baseline);
  if (comparison < 0) {
    return {
      valid: false,
      requiredBump: classification === "breaking" ? (baseline.major === 0 ? "minor" : "major") : "none",
      minimumVersion: baseline.raw,
      message: `Current version ${current.raw} is older than API baseline ${baseline.raw}.`,
    };
  }

  if (classification === "none") {
    return {
      valid: true,
      requiredBump: "none",
      minimumVersion: baseline.raw,
      message: "No public signature change requires a version increment.",
    };
  }

  if (classification === "breaking") {
    const valid = baseline.major === 0
      ? current.major > baseline.major || current.minor > baseline.minor
      : current.major > baseline.major;
    const minimumVersion = baseline.major === 0
      ? `${baseline.major}.${baseline.minor + 1}.0`
      : `${baseline.major + 1}.0.0`;
    return {
      valid,
      requiredBump: baseline.major === 0 ? "minor" : "major",
      minimumVersion,
      message: valid
        ? `Breaking API changes are covered by version ${current.raw}.`
        : `Breaking API changes since ${baseline.raw} require ${minimumVersion} or a later release line; found ${current.raw}.`,
    };
  }

  const valid = baseline.major === 0
    ? comparison > 0
    : current.major > baseline.major || (current.major === baseline.major && current.minor > baseline.minor);
  const minimumVersion = baseline.major === 0
    ? `${baseline.major}.${baseline.minor}.${baseline.patch + 1}`
    : `${baseline.major}.${baseline.minor + 1}.0`;
  return {
    valid,
    requiredBump: baseline.major === 0 ? "patch" : "minor",
    minimumVersion,
    message: valid
      ? `Additive API changes are covered by version ${current.raw}.`
      : `Additive API changes since ${baseline.raw} require ${minimumVersion} or a later compatible release line; found ${current.raw}.`,
  };
}

export function assertPinnedBaselineIdentity(baseline, expected, recomputedDigest) {
  if (
    baseline.version !== expected.version
    || baseline.source?.gitTag !== expected.gitTag
    || baseline.source?.gitCommit !== expected.gitCommit
  ) {
    throw new Error(
      `API baseline must identify immutable ${expected.gitTag} at ${expected.gitCommit}`,
    );
  }
  if (baseline.apiDigest !== recomputedDigest) {
    throw new Error(
      `API baseline apiDigest is stale; expected ${recomputedDigest}, found ${baseline.apiDigest}`,
    );
  }
  if (baseline.apiDigest !== expected.apiDigest) {
    throw new Error(
      `API baseline content does not match pinned ${expected.gitTag} digest ${expected.apiDigest}`,
    );
  }
}

export function buildCompatibilityReport(baseline, current, releaseTarget = current.version) {
  if (baseline.packageName !== current.packageName) {
    throw new Error(
      `API baseline package ${JSON.stringify(baseline.packageName)} does not match current package ${JSON.stringify(current.packageName)}`,
    );
  }
  const { classification, changes } = diffApiSnapshots(baseline, current);
  const versionPolicy = {
    releaseTarget,
    packageVersion: current.version,
    ...evaluateVersionPolicy(baseline.version, releaseTarget, classification),
  };
  return {
    schemaVersion: 1,
    kind: "personal-ui-api-compatibility-report",
    baseline: {
      packageName: baseline.packageName,
      version: baseline.version,
      gitTag: baseline.source.gitTag,
      gitCommit: baseline.source.gitCommit,
      apiDigest: baseline.apiDigest,
      compatibilityDigest: baseline.compatibilityDigest,
      runtimeExports: baseline.runtimeExports.length,
      typeOnlyExports: baseline.typeOnlyExports.length,
      publicSignatures: baseline.signatures.length,
    },
    current: {
      packageName: current.packageName,
      version: current.version,
      apiDigest: current.apiDigest,
      compatibilityDigest: current.compatibilityDigest,
      runtimeExports: current.runtimeExports.length,
      typeOnlyExports: current.typeOnlyExports.length,
      publicSignatures: current.signatures.length,
    },
    classification,
    versionPolicy,
    changes,
  };
}
