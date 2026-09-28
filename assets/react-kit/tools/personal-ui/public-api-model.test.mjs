import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import ts from "typescript";

import {
  buildPublicApiModel,
  defaultKitRoot,
  defaultSkillRoot,
  exportAnchor,
  parseMigrationDocument,
} from "./public-api-model.mjs";
import {
  checkComponentDocuments,
  generateComponentDocuments,
  writeComponentDocuments,
} from "./generate-component-docs.mjs";

let model;

test.before(() => {
  model = buildPublicApiModel();
});

test("builds one complete API record per registered runtime export without coverage input", () => {
  const registry = JSON.parse(fs.readFileSync(path.join(defaultKitRoot, "registry.json"), "utf8"));
  const source = fs.readFileSync(new URL("./public-api-model.mjs", import.meta.url), "utf8");
  assert.equal(source.includes("component-coverage.json"), false);
  assert.equal(model.runtimeExportCount, registry.exports.length);
  assert.deepEqual(model.exports.map((record) => record.name), [...registry.exports].sort());
  for (const record of model.exports) {
    assert.ok(record.signature.includes(record.name), `${record.name} has a TypeScript signature`);
    assert.ok(record.source?.file && record.source.line > 0, `${record.name} has implementation provenance`);
    assert.ok(record.example.code.includes("./personal-ui"), `${record.name} has a public-barrel example`);
    assert.ok(record.example.ref.endsWith(".case.tsx"), `${record.name} has compiled case evidence`);
    assert.match(record.anchor, /^export-[a-z0-9-]+$/);
    assert.deepEqual(record.apiPage, {
      status: "documented",
      source: "generated-component-api",
      id: record.anchor,
      refs: ["references/component-api.md"],
    });
    assert.ok(record.restrictions.length > 0, `${record.name} has explicit limits`);
    for (const [kind, contract] of [["keyboard", record.keyboard], ["ARIA", record.aria]]) {
      if (contract.mode === "none") continue;
      assert.equal(contract.status, "documented", `${record.name} has documented ${kind} ownership`);
      assert.equal(contract.source, "test-evidence", `${record.name} ${kind} ownership comes from the test validator`);
      assert.equal(contract.refs.length, 1, `${record.name} has one ${kind} owner`);
    }
  }
});

test("derives runtime prop initializers and token sources instead of copying a defaults JSON", () => {
  const button = model.exports.find((record) => record.name === "Button");
  assert.ok(button.defaults.some((record) => record.prop === "variant" && record.value === '"secondary"'));
  assert.ok(button.defaults.some((record) => record.prop === "type" && record.value === '"button"'));
  for (const record of model.exports) {
    for (const runtimeDefault of record.defaults) {
      const sourcePath = path.join(defaultSkillRoot, runtimeDefault.source);
      assert.equal(fs.existsSync(sourcePath), true);
      assert.ok(runtimeDefault.line > 0);
    }
    if (record.interaction !== "non-visual") {
      assert.equal(record.semanticTokens.source, "manifest-css");
    }
  }
});

test("associates migration sections with exports and type evidence through machine markers", () => {
  const migrations = parseMigrationDocument({
    skillRoot: defaultSkillRoot,
    registryExports: model.exports.map((record) => record.name),
  });
  assert.equal(migrations.get("RichTextEditor").replacement, "MarkdownEditor");
  assert.ok(migrations.get("Popover").typeEvidence[0].endsWith("overlay-contracts.test-d.tsx"));
  assert.ok(migrations.get("VirtualList").codeBlocks.some((code) => code.includes("itemSize")));
  assert.equal(model.exports.find((record) => record.name === "RichTextEditor").migration.status, "documented");
});

test("renders deterministic API and catalog pages with an API anchor for every export", () => {
  const first = generateComponentDocuments({ model });
  const second = generateComponentDocuments({ model });
  assert.equal(first.api, second.api);
  assert.equal(first.catalog, second.catalog);
  for (const record of model.exports) {
    assert.ok(first.api.includes(`<a id="${exportAnchor(record.name)}"></a>`));
    assert.ok(first.catalog.includes(`component-api.md#${exportAnchor(record.name)}`));
  }
  for (const family of model.families) {
    assert.ok(first.catalog.includes(`\`${family.id}\``));
    assert.ok(first.catalog.includes(family.explorerRoute));
  }
  assert.match(first.api, /Keyboard \| custom: \[assets\/react-kit\/tests\/browser\/m6-keyboard-ownership\.spec\.ts\]/);
  assert.match(first.api, /ARIA \| owned: \[assets\/react-kit\/tests\/a11y\/m6-export-ownership\.spec\.ts\]/);
});

test("keeps every transformed compiled family example as valid TSX", () => {
  const examples = new Map(model.exports.map((record) => [record.example.ref, record.example.code]));
  for (const [reference, code] of examples) {
    const source = ts.createSourceFile(reference, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    assert.deepEqual(
      source.parseDiagnostics.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")),
      [],
      reference,
    );
  }
});

test("write/check mode reports a focused stale generated document", () => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "personal-ui-docs-"));
  try {
    const documents = generateComponentDocuments({
      model,
      apiPath: path.join(temporaryRoot, "component-api.md"),
      catalogPath: path.join(temporaryRoot, "component-catalog.md"),
    });
    writeComponentDocuments(documents);
    assert.deepEqual(checkComponentDocuments(documents), []);
    fs.appendFileSync(documents.apiPath, "stale\n", "utf8");
    const stale = checkComponentDocuments(documents);
    assert.equal(stale.length, 1);
    assert.match(stale[0], /component API is stale/);
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});
