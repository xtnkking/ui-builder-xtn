#!/usr/bin/env node
/** One-time mechanical migration: bind existing scenes, leave missing states as gaps. */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import ts from "typescript";
import { validateExplorerCases } from "./validate-explorer-cases.mjs";

const kitRoot = path.resolve(process.cwd());
const reportPath = process.argv[2];
const excludedFamilies = new Set((process.argv[3] ?? "").split(",").filter(Boolean));
const repairContexts = process.argv[4] === "--repair-context";
if (!reportPath) throw new Error("Provide a migration report path.");
const read = (name) => JSON.parse(fs.readFileSync(path.join(kitRoot, name), "utf8"));
const manifest = read("component-manifest.json");
const documentation = read("component-docs.json");
const sha = (text) => crypto.createHash("sha256").update(text).digest("hex");
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "pui-state-binding-"));
const changes = [];
const skipped = [];
const unwrap = (node) => {
  while (node && (ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isParenthesizedExpression(node))) node = node.expression;
  return node;
};
const propName = (node) => node.name && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) ? node.name.text : undefined;

try {
  for (const entry of manifest.entries) {
    const names = entry.publicExports ?? [];
    if (!names.length) continue;
    const category = documentation.families[entry.id].category;
    const relative = `src/explorer/cases/${category}/${entry.id}.case.tsx`;
    const file = path.join(kitRoot, relative);
    if (excludedFamilies.has(entry.id)) { skipped.push(relative); continue; }
    const before = fs.readFileSync(file, "utf8");
    const source = ts.createSourceFile(file, before, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let object;
    for (const statement of source.statements) {
      if (!ts.isVariableStatement(statement)) continue;
      for (const declaration of statement.declarationList.declarations) {
        const value = unwrap(declaration.initializer);
        if (value && ts.isObjectLiteralExpression(value) && value.properties.some((p) => propName(p) === "states")) object = value;
      }
    }
    if (!object) throw new Error(`No static case object: ${relative}`);
    const properties = new Map(object.properties.map((p) => [propName(p), p]));
    if (properties.has("stateExamples")) {
      if (repairContexts) {
        const replacements = [];
        const array = unwrap(properties.get("stateExamples").initializer);
        for (const element of array?.elements ?? []) {
          const fixture = unwrap(element);
          const fixtureContent = fixture?.properties?.find((p) => propName(p) === "content")?.initializer;
          const jsx = unwrap(fixtureContent);
          if (!jsx || !ts.isJsxElement(jsx) || jsx.openingElement.tagName.getText(source) !== "StatePreview") continue;
          if (jsx.children.length === 1 && ts.isJsxExpression(jsx.children[0])) continue;
          const start = jsx.openingElement.end;
          const end = jsx.closingElement.getStart(source);
          replacements.push({ start, end, text: `{${before.slice(start, end)}}` });
        }
        if (replacements.length) {
          let after = before;
          for (const replacement of replacements.sort((a, b) => b.start - a.start)) after = after.slice(0, replacement.start) + replacement.text + after.slice(replacement.end);
          fs.writeFileSync(file, after);
          changes.push({ family: entry.id, file: relative, beforeSha256: sha(before), afterSha256: sha(after), bound: [], repairedContexts: replacements.length,
            policy: "Preserve original component expression as a JSX expression inside the context; remove accidental visible parentheses. State claims unchanged." });
        } else skipped.push(relative);
      } else skipped.push(relative);
      continue;
    }
    if (repairContexts) { skipped.push(relative); continue; }
    const states = unwrap(properties.get("states")?.initializer);
    const content = properties.get("content");
    if (!states || !ts.isArrayLiteralExpression(states) || !content?.initializer) throw new Error(`No inline states/content: ${relative}`);
    const contentText = content.initializer.getText(source);
    const candidates = states.elements.map((stateNode) => {
      const state = unwrap(stateNode)?.text;
      if (!state) throw new Error(`Nonliteral state: ${relative}`);
      return { state, names, content: ["dark", "locale", "mobile", "overlay"].includes(state)
        ? `<StatePreview state="${state}">{${contentText}}</StatePreview>` : contentText };
    });
    const serialize = (records) => records.map((record) => (
      `    { state: ${JSON.stringify(record.state)}, exports: ${JSON.stringify(record.names)}, content: ${record.content}${record.state === "keyboard" ? ', instructions: "用 Tab 访问本例可用控件，使用 Enter、Space 和组件文档中的方向键操作。此项为人工操作案例，不是自动行为验收证书。"' : ""} },`
    )).join("\n");
    const insert = (records) => {
      const at = content.getStart(source);
      const text = `${before.slice(0, at)}stateExamples: [\n${serialize(records)}\n  ],\n  ${before.slice(at)}`;
      return text.replace(/^(\/\/ @personal-ui-coverage [^\r\n]+)(\r?\n)/, '$1$2import { StatePreview } from "../state-preview";\n');
    };
    const fixtureRoot = path.join(temporary, entry.id);
    const fixtureFile = path.join(fixtureRoot, relative);
    fs.mkdirSync(path.dirname(fixtureFile), { recursive: true });
    fs.writeFileSync(path.join(fixtureRoot, "component-manifest.json"), JSON.stringify({ entries: [entry] }));
    fs.writeFileSync(path.join(fixtureRoot, "component-docs.json"), JSON.stringify(documentation));
    fs.writeFileSync(path.join(fixtureRoot, "registry.json"), JSON.stringify({ exports: names }));
    fs.writeFileSync(fixtureFile, insert(candidates));
    const inspected = validateExplorerCases({ kitRoot: fixtureRoot, requireStateExamples: false });
    if (!inspected.ok) throw new Error(`Invalid preexisting case ${relative}: ${inspected.errors.join("; ")}`);
    const realized = candidates.map((candidate) => ({ ...candidate, names: candidate.names.filter((name) =>
      inspected.stateCoverage.evidence[name]?.some((record) => record.state === candidate.state)) })).filter((record) => record.names.length);
    const after = insert(realized);
    fs.writeFileSync(file, after);
    changes.push({ family: entry.id, file: relative, beforeSha256: sha(before), afterSha256: sha(after),
      bound: realized.map(({ state, names: exports }) => ({ state, exports })),
      remaining: inspected.stateCoverage.gaps,
      policy: "Only existing reachable state-specific scene evidence and actual StatePreview contexts were bound; missing states unchanged." });
  }
  const report = { schemaVersion: 1, kind: "personal-ui-existing-state-binding", kitRoot, changes, skipped,
    changedFamilyCount: changes.length, boundExportStateCount: changes.reduce((sum, change) => sum + change.bound.reduce((n, item) => n + item.exports.length, 0), 0),
    note: "Mechanical runnable source binding, not browser, accessibility, or whole-M6 acceptance. Remaining original applicability claims still require review." };
  fs.writeFileSync(path.resolve(reportPath), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(repairContexts ? `Repaired context expression rendering in ${changes.length} generated families; state claims unchanged.\n`
    : `Bound ${report.boundExportStateCount} existing export-state scenes in ${changes.length} families; preserved ${skipped.length} hand-maintained families.\n`);
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
