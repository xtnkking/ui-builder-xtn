#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { validateExplorerCases } from "./validate-explorer-cases.mjs";

const COVERAGE_DIRECTIVE = /^\s*\/\/\s*@personal-ui-coverage\s+(?<payload>\{.*\})\s*$/;
const EVIDENCE_KINDS = {
  keyboard: {
    directory: ["tests", "browser"],
    register: "registerKeyboardEvidence",
    runner: "browser",
  },
  a11y: {
    directory: ["tests", "a11y"],
    register: "registerAriaEvidence",
    runner: "a11y",
  },
};
const SCRIPT_NAME = /\.(?:spec|test)\.(?:ts|tsx|js|jsx|mjs|cjs)$/;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function toPosix(filePath) {
  return filePath.split(path.sep).join("/");
}

function sameSequence(left, right) {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function duplicates(values) {
  return [...new Set(values.filter((value, index) => values.indexOf(value) !== index))].sort();
}

function unwrapExpression(node) {
  let current = node;
  while (
    current
    && (
      ts.isParenthesizedExpression(current)
      || ts.isAsExpression(current)
      || ts.isSatisfiesExpression(current)
      || ts.isNonNullExpression(current)
    )
  ) {
    current = current.expression;
  }
  return current;
}

function literalText(node) {
  const value = node && unwrapExpression(node);
  if (value && (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value))) return value.text;
  return undefined;
}

function propertyName(node) {
  if (!node?.name) return undefined;
  if (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) return node.name.text;
  return undefined;
}

function listTestFiles(root) {
  if (!fs.existsSync(root)) return [];
  const files = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const resolved = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(resolved);
      else if (entry.isFile() && SCRIPT_NAME.test(entry.name)) files.push(resolved);
    }
  };
  visit(root);
  return files.sort();
}

function topLevelVariables(sourceFile) {
  const variables = new Map();
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    const isConst = (statement.declarationList.flags & ts.NodeFlags.Const) !== 0;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name)) variables.set(declaration.name.text, { declaration, isConst });
    }
  }
  return variables;
}

function resolveArray(expression, variables) {
  let value = unwrapExpression(expression);
  if (ts.isIdentifier(value)) {
    const binding = variables.get(value.text);
    if (!binding?.isConst || !binding.declaration.initializer) return undefined;
    value = unwrapExpression(binding.declaration.initializer);
  }
  return ts.isArrayLiteralExpression(value) ? value : undefined;
}

function evidenceImports(sourceFile) {
  const imports = new Map();
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    if (!/(?:^|\/)support\/m6-evidence$/.test(statement.moduleSpecifier.text.replaceAll("\\", "/"))) continue;
    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const specifier of bindings.elements) {
      if (specifier.isTypeOnly || statement.importClause?.isTypeOnly) continue;
      const imported = specifier.propertyName?.text ?? specifier.name.text;
      if (Object.values(EVIDENCE_KINDS).some((config) => config.register === imported)) {
        imports.set(specifier.name.text, imported);
      }
    }
  }
  return imports;
}

function registrationCalls(sourceFile, imports) {
  const calls = [];
  const visit = (node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const registeredName = imports.get(node.expression.text);
      if (registeredName) calls.push({ node, registeredName });
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return calls;
}

function parseDirectives(sourceText, repositoryPath, errors) {
  const directives = [];
  sourceText.replace(/^\uFEFF/, "").split(/\r?\n/).forEach((line, index) => {
    if (!line.includes("@personal-ui-coverage")) return;
    const match = COVERAGE_DIRECTIVE.exec(line);
    if (!match) {
      errors.push(`${repositoryPath}:${index + 1}: invalid @personal-ui-coverage syntax`);
      return;
    }
    try {
      const payload = JSON.parse(match.groups.payload);
      if (payload?.kind === "keyboard" || payload?.kind === "a11y") {
        directives.push({ line: index + 1, payload });
      }
    } catch (error) {
      errors.push(`${repositoryPath}:${index + 1}: invalid coverage JSON (${error.message})`);
    }
  });
  return directives;
}

function objectProperties(node, label, errors) {
  const properties = new Map();
  for (const member of node.properties) {
    if (ts.isSpreadAssignment(member)) {
      errors.push(`${label}: evidence cases cannot use spread properties`);
      continue;
    }
    const name = propertyName(member);
    if (!name || !ts.isPropertyAssignment(member)) {
      errors.push(`${label}: evidence case properties must use explicit assignments`);
      continue;
    }
    if (properties.has(name)) errors.push(`${label}: duplicate ${name} property`);
    properties.set(name, member.initializer);
  }
  return properties;
}

function registeredCases({ call, variables, kind, repositoryPath, errors }) {
  if (call.node.arguments.length !== 1) {
    errors.push(`${repositoryPath}: ${call.registeredName} must receive exactly one static case array`);
    return [];
  }
  const array = resolveArray(call.node.arguments[0], variables);
  if (!array) {
    errors.push(`${repositoryPath}: ${call.registeredName} must receive a top-level const array literal`);
    return [];
  }
  const cases = [];
  array.elements.forEach((element, index) => {
    const value = unwrapExpression(element);
    const label = `${repositoryPath}: ${call.registeredName} case ${index + 1}`;
    if (!ts.isObjectLiteralExpression(value)) {
      errors.push(`${label} must be an object literal`);
      return;
    }
    const properties = objectProperties(value, label, errors);
    const record = {
      exportName: literalText(properties.get("exportName")),
      family: literalText(properties.get("family")),
      category: literalText(properties.get("category")),
      strategy: literalText(properties.get("strategy")),
    };
    for (const required of ["exportName", "family", "category"]) {
      if (!record[required]) errors.push(`${label}: ${required} must be a non-empty static string`);
    }
    if (kind === "keyboard" && !record.strategy) {
      errors.push(`${label}: strategy must be a non-empty static string`);
    }
    cases.push(record);
  });
  return cases;
}

function documentationOwner(documentation, exportName, kind) {
  const record = documentation.exports?.[exportName];
  const profile = record && documentation.profiles?.[record.profile];
  return record?.overrides?.[kind] ?? profile?.[kind];
}

function metadataMaps({ manifest, documentation, registry, errors }) {
  const runtimeExports = new Set(registry.exports ?? []);
  const familyByExport = new Map();
  const categoryByFamily = new Map();
  for (const [family, metadata] of Object.entries(documentation.families ?? {})) {
    if (typeof metadata?.category === "string") categoryByFamily.set(family, metadata.category);
  }
  for (const entry of manifest.entries ?? []) {
    for (const exportName of entry.publicExports ?? []) {
      if (familyByExport.has(exportName)) errors.push(`${exportName} belongs to more than one Manifest family`);
      familyByExport.set(exportName, entry.id);
    }
  }
  for (const exportName of runtimeExports) {
    if (!familyByExport.has(exportName)) errors.push(`${exportName} has no Manifest family`);
    if (!documentation.exports?.[exportName]) errors.push(`${exportName} has no component documentation metadata`);
  }
  return { runtimeExports, familyByExport, categoryByFamily };
}

function expectedOwners(documentation, registry, kind, errors) {
  const expected = new Set();
  for (const exportName of registry.exports ?? []) {
    const owner = documentationOwner(documentation, exportName, kind === "a11y" ? "aria" : kind);
    if (!owner || typeof owner.mode !== "string") {
      errors.push(`${exportName} has no ${kind} owner mode`);
      continue;
    }
    if (owner.mode !== "none") expected.add(exportName);
  }
  return expected;
}

function validateEvidenceFile({
  filePath,
  kind,
  kitRoot,
  skillRoot,
  metadata,
  explorer,
  evidence,
  files,
  errors,
}) {
  const config = EVIDENCE_KINDS[kind];
  const repositoryPath = toPosix(path.relative(skillRoot, filePath));
  const sourceText = fs.readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  if (sourceFile.parseDiagnostics?.length) {
    for (const diagnostic of sourceFile.parseDiagnostics) {
      errors.push(`${repositoryPath}: TypeScript parse error ${ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")}`);
    }
    return;
  }
  const directives = parseDirectives(sourceText, repositoryPath, errors).filter((item) => item.payload.kind === kind);
  const imports = evidenceImports(sourceFile);
  const calls = registrationCalls(sourceFile, imports).filter((item) => item.registeredName === config.register);
  if (!directives.length && !calls.length) return;
  if (directives.length !== 1) {
    errors.push(`${repositoryPath}: ${kind} evidence requires exactly one coverage directive`);
  }
  if (calls.length !== 1) {
    errors.push(`${repositoryPath}: ${kind} evidence requires exactly one ${config.register}(...) call imported from m6-evidence`);
  }
  if (directives.length !== 1 || calls.length !== 1) return;

  const { payload } = directives[0];
  const expectedKeys = ["exports", "kind", "runner"];
  if (!sameSequence(Object.keys(payload).sort(), expectedKeys)) {
    errors.push(`${repositoryPath}: ${kind} directive must contain only kind, runner, and exports`);
  }
  if (payload.runner !== config.runner) {
    errors.push(`${repositoryPath}: ${kind} directive runner must be ${config.runner}`);
  }
  if (!Array.isArray(payload.exports) || payload.exports.some((name) => typeof name !== "string" || !name)) {
    errors.push(`${repositoryPath}: ${kind} directive exports must be a non-empty string array`);
    return;
  }
  if (!payload.exports.length) {
    errors.push(`${repositoryPath}: ${kind} directive exports must not be empty`);
    return;
  }
  const directiveDuplicates = duplicates(payload.exports);
  if (directiveDuplicates.length) {
    errors.push(`${repositoryPath}: ${kind} directive contains duplicate export(s): ${directiveDuplicates.join(", ")}`);
  }

  const cases = registeredCases({
    call: calls[0],
    variables: topLevelVariables(sourceFile),
    kind,
    repositoryPath,
    errors,
  });
  const caseExports = cases.map((record) => record.exportName).filter(Boolean);
  const caseDuplicates = duplicates(caseExports);
  if (caseDuplicates.length) {
    errors.push(`${repositoryPath}: ${kind} case array contains duplicate export(s): ${caseDuplicates.join(", ")}`);
  }
  if (!sameSequence(payload.exports, caseExports)) {
    errors.push(`${repositoryPath}: ${kind} directive exports must exactly match the registered case array in order`);
  }

  for (const record of cases) {
    if (!record.exportName || !record.family || !record.category) continue;
    const exportName = record.exportName;
    if (!metadata.runtimeExports.has(exportName)) {
      errors.push(`${repositoryPath}: ${kind} case references unknown export ${exportName}`);
      continue;
    }
    const expectedFamily = metadata.familyByExport.get(exportName);
    if (record.family !== expectedFamily) {
      errors.push(`${repositoryPath}: ${exportName} family must be ${expectedFamily}, received ${record.family}`);
    }
    const expectedCategory = metadata.categoryByFamily.get(expectedFamily);
    if (record.category !== expectedCategory) {
      errors.push(`${repositoryPath}: ${exportName} category must be ${expectedCategory}, received ${record.category}`);
    }
    const explorerRefs = explorer.evidence?.[exportName] ?? [];
    if (explorerRefs.length !== 1) {
      errors.push(`${repositoryPath}: ${exportName} needs exactly one AST-verified Explorer case before it can own ${kind} evidence`);
      continue;
    }
    if (evidence[exportName].length) {
      errors.push(`${repositoryPath}: ${exportName} has duplicate ${kind} evidence ownership`);
      continue;
    }
    evidence[exportName].push(repositoryPath);
  }
  files.push({ kind, file: repositoryPath, exports: caseExports });
}

export function validateTestEvidence({ kitRoot = process.cwd(), explorerResult } = {}) {
  const resolvedKitRoot = path.resolve(kitRoot);
  const skillRoot = path.resolve(resolvedKitRoot, "../..");
  const manifest = readJson(path.join(resolvedKitRoot, "component-manifest.json"));
  const documentation = readJson(path.join(resolvedKitRoot, "component-docs.json"));
  const registry = readJson(path.join(resolvedKitRoot, "registry.json"));
  const errors = [];
  const metadata = metadataMaps({ manifest, documentation, registry, errors });
  const explorer = explorerResult ?? validateExplorerCases({ kitRoot: resolvedKitRoot });
  if (!explorer.ok) {
    errors.push(...explorer.errors.map((error) => `Explorer evidence: ${error}`));
  }
  const evidence = Object.fromEntries(Object.keys(EVIDENCE_KINDS).map((kind) => [
    kind,
    Object.fromEntries((registry.exports ?? []).map((exportName) => [exportName, []])),
  ]));
  const files = [];

  for (const kind of Object.keys(EVIDENCE_KINDS)) {
    const config = EVIDENCE_KINDS[kind];
    const directory = path.join(resolvedKitRoot, ...config.directory);
    for (const filePath of listTestFiles(directory)) {
      validateEvidenceFile({
        filePath,
        kind,
        kitRoot: resolvedKitRoot,
        skillRoot,
        metadata,
        explorer,
        evidence: evidence[kind],
        files,
        errors,
      });
    }
    const expected = expectedOwners(documentation, registry, kind, errors);
    const actual = new Set(Object.entries(evidence[kind]).filter(([, refs]) => refs.length).map(([name]) => name));
    const missing = [...expected].filter((name) => !actual.has(name)).sort();
    const unexpected = [...actual].filter((name) => !expected.has(name)).sort();
    if (missing.length) errors.push(`${kind} evidence is missing export(s): ${missing.join(", ")}`);
    if (unexpected.length) errors.push(`${kind} evidence includes owner-mode none export(s): ${unexpected.join(", ")}`);
  }

  return {
    ok: errors.length === 0,
    errors,
    evidence,
    files: files.sort((left, right) => left.file.localeCompare(right.file)),
    expectedCounts: Object.fromEntries(Object.keys(EVIDENCE_KINDS).map((kind) => [
      kind,
      expectedOwners(documentation, registry, kind, []).size,
    ])),
    verifiedCounts: Object.fromEntries(Object.keys(EVIDENCE_KINDS).map((kind) => [
      kind,
      Object.values(evidence[kind]).filter((refs) => refs.length).length,
    ])),
  };
}

function parseArguments(argv) {
  const options = { kitRoot: process.cwd(), json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--json") options.json = true;
    else if (argument === "--kit-root") options.kitRoot = argv[++index];
    else throw new Error(`Unknown argument: ${argument}`);
  }
  return options;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  let options;
  try {
    options = parseArguments(process.argv.slice(2));
    const result = validateTestEvidence({ kitRoot: options.kitRoot });
    if (options.json) process.stdout.write(`${JSON.stringify(result)}\n`);
    else if (result.ok) {
      process.stdout.write(
        `Test evidence verified: ${result.verifiedCounts.keyboard}/${result.expectedCounts.keyboard} keyboard, `
        + `${result.verifiedCounts.a11y}/${result.expectedCounts.a11y} a11y\n`,
      );
    } else {
      process.stderr.write(`Test evidence validation failed with ${result.errors.length} error(s):\n`);
      for (const error of result.errors) process.stderr.write(`- ${error}\n`);
    }
    process.exitCode = result.ok ? 0 : 1;
  } catch (error) {
    if (options?.json) process.stdout.write(`${JSON.stringify({ ok: false, errors: [error.message], evidence: {} })}\n`);
    else process.stderr.write(`${error.stack ?? error.message}\n`);
    process.exitCode = 1;
  }
}
