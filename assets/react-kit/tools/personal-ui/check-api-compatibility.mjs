import fs from "node:fs";
import path from "node:path";

import {
  apiDigest,
  buildCurrentApiSnapshot,
  compatibilityDigest,
  defaultProjectDirectory,
} from "./api-snapshot.mjs";
import {
  assertPinnedBaselineIdentity,
  buildCompatibilityReport,
  isReleaseTargetVersion,
  parseSemver,
} from "./api-compatibility-core.mjs";

const BASELINE_VERSION = "0.2.19";
const BASELINE_TAG = "v0.2.19";
const BASELINE_COMMIT = "0587d4b08c1a70efff80c228b332f4064a7db6d1";
const BASELINE_API_DIGEST = "709a8d1a64a9b5ab4a6ad7574a5d66c1a4a62c1b2d06cf4b0b6e072c099a7b35";
const ROADMAP_TARGET_VERSION = "0.3.0";
const baselinePath = path.join(
  defaultProjectDirectory,
  `etc/personal-ui.api-baseline.v${BASELINE_VERSION}.json`,
);
const reportPath = path.join(defaultProjectDirectory, "etc/personal-ui.api-compatibility.json");
const packagePath = path.join(defaultProjectDirectory, "package.json");
const registryPath = path.join(defaultProjectDirectory, "registry.json");
const manifestPath = path.join(defaultProjectDirectory, "component-manifest.json");
const policyPath = path.join(defaultProjectDirectory, "api-version-policy.json");

function fail(message) {
  console.error(`[personal-ui-api-compat] ${message}`);
  process.exitCode = 1;
}

function readJson(filePath, description) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Unable to read ${description} at ${filePath}: ${error.message}`);
  }
}

function serializeJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function validateSortedUniqueStrings(values, label) {
  if (!Array.isArray(values) || values.some((value) => typeof value !== "string" || !value)) {
    throw new Error(`${label} must be an array of non-empty strings`);
  }
  const expected = [...new Set(values)].sort();
  if (JSON.stringify(values) !== JSON.stringify(expected)) {
    throw new Error(`${label} must be sorted and contain no duplicates`);
  }
}

function validateSnapshotShape(snapshot, label) {
  if (!snapshot || snapshot.schemaVersion !== 1) {
    throw new Error(`${label} must use schemaVersion 1`);
  }
  if (typeof snapshot.packageName !== "string" || !snapshot.packageName) {
    throw new Error(`${label} packageName must be a non-empty string`);
  }
  parseSemver(snapshot.version);
  validateSortedUniqueStrings(snapshot.runtimeExports, `${label} runtimeExports`);
  validateSortedUniqueStrings(snapshot.typeOnlyExports, `${label} typeOnlyExports`);
  if (!Array.isArray(snapshot.modules) || snapshot.modules.length === 0) {
    throw new Error(`${label} modules must be a non-empty array`);
  }
  const moduleNames = snapshot.modules.map((module) => module.name);
  if (new Set(moduleNames).size !== moduleNames.length) {
    throw new Error(`${label} contains duplicate declaration modules`);
  }
  for (const module of snapshot.modules) {
    if (typeof module.name !== "string" || !Array.isArray(module.signatures)) {
      throw new Error(`${label} contains an invalid declaration module`);
    }
    const ids = module.signatures.map((signature) => signature.id);
    if (new Set(ids).size !== ids.length) {
      throw new Error(`${label} module ${module.name} contains duplicate declaration ids`);
    }
    for (const signature of module.signatures) {
      if (typeof signature.id !== "string" || typeof signature.declaration !== "string") {
        throw new Error(`${label} module ${module.name} contains an invalid declaration`);
      }
    }
  }
  if (!Array.isArray(snapshot.signatures) || snapshot.signatures.length === 0) {
    throw new Error(`${label} signatures must be a non-empty array`);
  }
  const signatureNames = snapshot.signatures.map((signature) => signature.name);
  if (new Set(signatureNames).size !== signatureNames.length) {
    throw new Error(`${label} contains duplicate public signature names`);
  }
  const expectedNames = [...snapshot.runtimeExports, ...snapshot.typeOnlyExports].sort();
  if (JSON.stringify(signatureNames) !== JSON.stringify(expectedNames)) {
    throw new Error(`${label} must contain exactly one sorted signature for every public export`);
  }
  for (const signature of snapshot.signatures) {
    if (
      typeof signature.name !== "string"
      || !["runtime", "type"].includes(signature.kind)
      || typeof signature.declaration !== "string"
      || !signature.declaration
    ) {
      throw new Error(`${label} contains an invalid public signature`);
    }
  }
  const expectedDigest = apiDigest(snapshot);
  if (snapshot.apiDigest !== expectedDigest) {
    throw new Error(`${label} apiDigest is stale; expected ${expectedDigest}, found ${snapshot.apiDigest}`);
  }
  const expectedCompatibilityDigest = compatibilityDigest(snapshot);
  if (snapshot.compatibilityDigest !== expectedCompatibilityDigest) {
    throw new Error(
      `${label} compatibilityDigest is stale; expected ${expectedCompatibilityDigest}, found ${snapshot.compatibilityDigest}`,
    );
  }
}

function validateBaseline(baseline) {
  validateSnapshotShape(baseline, "API baseline");
  if (baseline.kind !== "personal-ui-public-api-baseline") {
    throw new Error("API baseline kind is invalid");
  }
  assertPinnedBaselineIdentity(
    baseline,
    {
      version: BASELINE_VERSION,
      gitTag: BASELINE_TAG,
      gitCommit: BASELINE_COMMIT,
      apiDigest: BASELINE_API_DIGEST,
    },
    apiDigest(baseline),
  );
}

function validateVersionSources(current) {
  const packageJson = readJson(packagePath, "package metadata");
  const registry = readJson(registryPath, "Personal UI registry");
  const manifest = readJson(manifestPath, "component manifest");
  const versions = {
    "package.json": packageJson.version,
    "registry.json": registry.version,
    "component-manifest.json": manifest.kitVersion,
    "current API snapshot": current.version,
  };
  for (const [source, version] of Object.entries(versions)) parseSemver(version);
  const uniqueVersions = new Set(Object.values(versions));
  if (uniqueVersions.size !== 1) {
    throw new Error(
      `Version sources disagree: ${Object.entries(versions).map(([source, version]) => `${source}=${version}`).join(", ")}`,
    );
  }
  return current.version;
}

function readVersionPolicy(packageVersion) {
  const policy = readJson(policyPath, "API version policy");
  if (policy.schemaVersion !== 1 || policy.baselineVersion !== BASELINE_VERSION) {
    throw new Error(`API version policy must identify baseline ${BASELINE_VERSION} with schemaVersion 1`);
  }
  parseSemver(policy.releaseTarget);
  if (policy.releaseTarget !== ROADMAP_TARGET_VERSION) {
    throw new Error(`API version policy releaseTarget must remain ${ROADMAP_TARGET_VERSION} during this hardening cycle`);
  }
  if (
    packageVersion !== BASELINE_VERSION
    && !isReleaseTargetVersion(packageVersion, policy.releaseTarget)
  ) {
    throw new Error(
      `Package metadata must remain at unreleased baseline ${BASELINE_VERSION}, `
      + `release target ${policy.releaseTarget}, or its rc.N prerelease; found ${packageVersion}`,
    );
  }
  return policy;
}

function firstDifference(expected, actual) {
  const expectedLines = expected.split("\n");
  const actualLines = actual.split("\n");
  const limit = Math.max(expectedLines.length, actualLines.length);
  for (let index = 0; index < limit; index += 1) {
    if (expectedLines[index] !== actualLines[index]) {
      return {
        line: index + 1,
        expected: expectedLines[index] ?? "<end of file>",
        actual: actualLines[index] ?? "<end of file>",
      };
    }
  }
  return null;
}

function captureBaseline() {
  if (fs.existsSync(baselinePath)) {
    throw new Error(`Refusing to replace immutable baseline ${path.relative(defaultProjectDirectory, baselinePath)}`);
  }
  const current = buildCurrentApiSnapshot();
  if (current.version !== BASELINE_VERSION) {
    throw new Error(`Baseline capture requires current version ${BASELINE_VERSION}; found ${current.version}`);
  }
  const baseline = {
    ...current,
    kind: "personal-ui-public-api-baseline",
    source: { gitTag: BASELINE_TAG, gitCommit: BASELINE_COMMIT },
  };
  fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
  fs.writeFileSync(baselinePath, serializeJson(baseline), "utf8");
  console.log(
    `[personal-ui-api-compat] captured ${path.relative(defaultProjectDirectory, baselinePath)} `
    + `(${baseline.runtimeExports.length} runtime exports, ${baseline.typeOnlyExports.length} type-only exports)`,
  );
}

function main() {
  const modes = new Set(process.argv.slice(2));
  if (modes.size !== 1 || !["--capture-baseline", "--write", "--check"].some((mode) => modes.has(mode))) {
    throw new Error("Usage: check-api-compatibility.mjs --capture-baseline | --write | --check");
  }
  if (modes.has("--capture-baseline")) {
    captureBaseline();
    return;
  }
  if (!fs.existsSync(baselinePath)) {
    throw new Error(`Missing immutable API baseline ${path.relative(defaultProjectDirectory, baselinePath)}`);
  }

  const baseline = readJson(baselinePath, "immutable API baseline");
  validateBaseline(baseline);
  const current = buildCurrentApiSnapshot();
  validateSnapshotShape(current, "Current API snapshot");
  const packageVersion = validateVersionSources(current);
  const policy = readVersionPolicy(packageVersion);
  const report = buildCompatibilityReport(baseline, current, policy.releaseTarget);
  const serializedReport = serializeJson(report);

  if (modes.has("--write")) {
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, serializedReport, "utf8");
    console.log(
      `[personal-ui-api-compat] wrote ${path.relative(defaultProjectDirectory, reportPath)} `
      + `(${report.classification}; version policy ${report.versionPolicy.valid ? "passed" : "failed"})`,
    );
  } else {
    if (!fs.existsSync(reportPath)) {
      throw new Error(
        `Missing compatibility report ${path.relative(defaultProjectDirectory, reportPath)}; run npm run api:compat:report`,
      );
    }
    const committedReport = fs.readFileSync(reportPath, "utf8").replaceAll("\r\n", "\n");
    if (committedReport !== serializedReport) {
      const difference = firstDifference(committedReport, serializedReport);
      throw new Error(
        `Compatibility report is stale at line ${difference?.line ?? "unknown"}. `
        + `Expected ${JSON.stringify(difference?.expected)}, received ${JSON.stringify(difference?.actual)}. `
        + "Review the API change and run npm run api:compat:report.",
      );
    }
    console.log(
      `[personal-ui-api-compat] valid (${report.classification}; ${current.runtimeExports.length} runtime exports, `
      + `${current.typeOnlyExports.length} type-only exports, version ${current.version})`,
    );
  }

  if (!report.versionPolicy.valid) {
    throw new Error(report.versionPolicy.message);
  }
}

try {
  main();
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
