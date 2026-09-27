import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const validator = fileURLToPath(new URL("./validate-module-boundaries.mjs", import.meta.url));

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pui-modules-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, "src/personal-ui/foundation"), { recursive: true });
  fs.mkdirSync(path.join(root, "src/personal-ui/internal"), { recursive: true });
  fs.writeFileSync(path.join(root, "src/personal-ui/index.ts"), 'export * from "./foundation/a";\n');
  fs.writeFileSync(path.join(root, "src/personal-ui/foundation/a.ts"), "export const A = 1;\n");
  writeJson(path.join(root, "module-boundaries.json"), {
    schemaVersion: 1,
    publicBarrel: "src/personal-ui/index.ts",
    modules: [
      { id: "foundation", root: "src/personal-ui/foundation" },
      { id: "internal", root: "src/personal-ui/internal" },
    ],
  });
  writeJson(path.join(root, "component-manifest.json"), {
    kitVersion: "0.0.0",
    entries: [{
      id: "a",
      kind: "component",
      publicExports: ["A"],
      sourceFiles: ["src/personal-ui/foundation/a.ts"],
    }],
  });
  writeJson(path.join(root, "component-coverage.json"), {
    exports: [{
      name: "A",
      owner: { manifestEntry: "a" },
      source: ["src/personal-ui/foundation/a.ts"],
      documentation: {
        apiPage: { refs: ["references/component-api.md"] },
        example: { refs: ["src/explorer/a.tsx"] },
        keyboard: { refs: [] },
        aria: { refs: [] },
      },
    }],
  });
  return root;
}

function run(root, ...args) {
  return spawnSync(process.execPath, [validator, "--kit-root", root, ...args], {
    encoding: "utf8",
  });
}

test("writes and verifies a deterministic ownership report", (t) => {
  const root = fixture(t);
  const first = run(root, "--write");
  assert.equal(first.status, 0, first.stderr);
  const report = fs.readFileSync(path.join(root, "etc/personal-ui.module-ownership.json"), "utf8");
  const second = run(root);
  assert.equal(second.status, 0, second.stderr);
  assert.equal(fs.readFileSync(path.join(root, "etc/personal-ui.module-ownership.json"), "utf8"), report);
});

test("rejects an implementation outside the declared modules", (t) => {
  const root = fixture(t);
  fs.writeFileSync(path.join(root, "src/personal-ui/orphan.ts"), "export const Orphan = true;\n");
  const result = run(root, "--write");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must belong to exactly one module/);
});

test("rejects an internal import from the public barrel", (t) => {
  const root = fixture(t);
  fs.writeFileSync(path.join(root, "src/personal-ui/internal/b.ts"), 'import { A } from "../index";\nexport const B = A;\n');
  const result = run(root, "--write");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must not import the public barrel/);
});

test("rejects a runtime source cycle", (t) => {
  const root = fixture(t);
  fs.writeFileSync(path.join(root, "src/personal-ui/foundation/a.ts"), 'import { B } from "../internal/b";\nexport const A = B;\n');
  fs.writeFileSync(path.join(root, "src/personal-ui/internal/b.ts"), 'import { A } from "../foundation/a";\nexport const B = A;\n');
  const result = run(root, "--write");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /runtime source cycle/);
});

test("rejects stale Manifest-to-coverage source ownership", (t) => {
  const root = fixture(t);
  const coveragePath = path.join(root, "component-coverage.json");
  const coverage = JSON.parse(fs.readFileSync(coveragePath, "utf8"));
  coverage.exports[0].source = ["src/personal-ui/internal/a.ts"];
  writeJson(coveragePath, coverage);
  const result = run(root, "--write");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /coverage source list for A is stale/);
});
