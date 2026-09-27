#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const CASE_DIRECTIVE = /^\/\/ @personal-ui-coverage (?<payload>\{.*\})$/;
const VALID_STATES = [
  "default",
  "disabled",
  "readOnly",
  "controlled",
  "uncontrolled",
  "loading",
  "empty",
  "error",
  "validation",
  "longContent",
  "keyboard",
  "mobile",
  "overlay",
  "dark",
  "locale",
  "usage",
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function toPosix(filePath) {
  return filePath.split(path.sep).join("/");
}

function unique(values) {
  return [...new Set(values)];
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

function propertyName(node) {
  if (!node?.name) return undefined;
  if (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) return node.name.text;
  return undefined;
}

function literalText(node) {
  const value = unwrapExpression(node);
  if (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value)) return value.text;
  return undefined;
}

function collectTopLevelDeclarations(sourceFile) {
  const declarations = new Map();
  for (const statement of sourceFile.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name) {
      declarations.set(statement.name.text, statement);
      continue;
    }
    if (ts.isClassDeclaration(statement) && statement.name) {
      declarations.set(statement.name.text, statement);
      continue;
    }
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name)) declarations.set(declaration.name.text, declaration);
    }
  }
  return declarations;
}

function isDeclarationName(node) {
  const parent = node.parent;
  return Boolean(
    (ts.isVariableDeclaration(parent) && parent.name === node)
    || (ts.isFunctionDeclaration(parent) && parent.name === node)
    || (ts.isFunctionExpression(parent) && parent.name === node)
    || (ts.isClassDeclaration(parent) && parent.name === node)
    || (ts.isParameter(parent) && parent.name === node)
    || (ts.isBindingElement(parent) && parent.name === node)
  );
}

function isTypePosition(node) {
  let current = node.parent;
  while (current && !ts.isStatement(current) && !ts.isExpression(current)) {
    if (current.kind >= ts.SyntaxKind.FirstTypeNode && current.kind <= ts.SyntaxKind.LastTypeNode) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

function isRuntimeConstantUse(node) {
  if (isDeclarationName(node) || isTypePosition(node)) return false;
  const parent = node.parent;
  if (
    ts.isImportSpecifier(parent)
    || ts.isExportSpecifier(parent)
    || (ts.isPropertyAccessExpression(parent) && parent.name === node)
    || (ts.isPropertyAssignment(parent) && parent.name === node)
    || (ts.isMethodDeclaration(parent) && parent.name === node)
  ) {
    return false;
  }

  let expression = node;
  while (expression.parent && ts.isParenthesizedExpression(expression.parent)) {
    expression = expression.parent;
  }
  if (ts.isVoidExpression(expression.parent)) return false;
  if (ts.isExpressionStatement(expression.parent) && expression.parent.expression === expression) return false;
  return true;
}

function importedBindings(sourceFile, errors, relativePath) {
  const bindings = new Map();
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    if (statement.moduleSpecifier.text !== "../../../personal-ui") continue;
    const clause = statement.importClause;
    if (!clause?.namedBindings || !ts.isNamedImports(clause.namedBindings)) {
      errors.push(`${relativePath}: Personal UI must be consumed through named imports`);
      continue;
    }
    for (const specifier of clause.namedBindings.elements) {
      if (specifier.isTypeOnly || clause.isTypeOnly) continue;
      const imported = specifier.propertyName?.text ?? specifier.name.text;
      bindings.set(imported, specifier.name.text);
    }
  }
  return bindings;
}

function defaultCaseObject(sourceFile, declarations, errors, relativePath) {
  const assignments = sourceFile.statements.filter(
    (statement) => ts.isExportAssignment(statement) && !statement.isExportEquals,
  );
  if (assignments.length !== 1) {
    errors.push(`${relativePath}: case module must have exactly one default export`);
    return undefined;
  }
  let expression = unwrapExpression(assignments[0].expression);
  if (ts.isIdentifier(expression)) {
    const declaration = declarations.get(expression.text);
    expression = declaration && ts.isVariableDeclaration(declaration) && declaration.initializer
      ? unwrapExpression(declaration.initializer)
      : undefined;
  }
  if (!expression || !ts.isObjectLiteralExpression(expression)) {
    errors.push(`${relativePath}: default export must resolve to an ExplorerCase object literal`);
    return undefined;
  }
  return expression;
}

function caseProperties(caseObject, errors, relativePath) {
  const properties = new Map();
  for (const property of caseObject.properties) {
    const name = propertyName(property);
    if (name && ts.isPropertyAssignment(property)) properties.set(name, property.initializer);
    else if (name && ts.isShorthandPropertyAssignment(property)) properties.set(name, property.name);
  }
  for (const required of ["id", "label", "summary", "states", "content", "code"]) {
    if (!properties.has(required)) errors.push(`${relativePath}: ExplorerCase is missing ${required}`);
  }
  return properties;
}

function reachableRuntimeEvidence({ sourceFile, content, bindings, stateModes }) {
  const declarations = collectTopLevelDeclarations(sourceFile);
  const queuedDeclarations = [];
  const visitedDeclarations = new Set();
  const evidence = new Set();

  function queueReferencedDeclaration(node) {
    if (!ts.isIdentifier(node) || isDeclarationName(node)) return;
    const declaration = declarations.get(node.text);
    if (declaration && !visitedDeclarations.has(declaration)) queuedDeclarations.push(declaration);
  }

  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      if (ts.isIdentifier(node.tagName)) {
        for (const [exportName, localName] of bindings) {
          if (localName === node.tagName.text && stateModes.get(exportName) !== "hook" && stateModes.get(exportName) !== "constant") {
            evidence.add(exportName);
          }
        }
      }
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      for (const [exportName, localName] of bindings) {
        if (localName === node.expression.text && stateModes.get(exportName) === "hook") evidence.add(exportName);
      }
    }
    if (ts.isIdentifier(node) && isRuntimeConstantUse(node)) {
      for (const [exportName, localName] of bindings) {
        if (localName === node.text && stateModes.get(exportName) === "constant") evidence.add(exportName);
      }
    }
    queueReferencedDeclaration(node);
    ts.forEachChild(node, visit);
  }

  visit(content);
  while (queuedDeclarations.length) {
    const declaration = queuedDeclarations.shift();
    if (visitedDeclarations.has(declaration)) continue;
    visitedDeclarations.add(declaration);
    visit(declaration);
  }
  return evidence;
}

function resolvedExportMetadata(documentation, exportName) {
  const record = documentation.exports?.[exportName];
  const profile = record && documentation.profiles?.[record.profile];
  if (!record || !profile) return undefined;
  return {
    stateMode: record.overrides?.stateMode ?? profile.stateMode,
    applicableStates: record.overrides?.applicableStates ?? profile.applicableStates,
  };
}

function expectedCases({ manifest, documentation, registry, errors }) {
  const runtimeExports = new Set(registry.exports ?? []);
  const expected = new Map();
  for (const entry of manifest.entries ?? []) {
    const exports = entry.publicExports ?? [];
    if (!exports.length) continue;
    const docsFamily = documentation.families?.[entry.id];
    if (!docsFamily?.category) {
      errors.push(`manifest family ${entry.id} has no documentation category`);
      continue;
    }
    const states = [];
    const stateModes = new Map();
    for (const exportName of exports) {
      if (!runtimeExports.has(exportName)) {
        errors.push(`manifest family ${entry.id} references unknown runtime export ${exportName}`);
        continue;
      }
      const metadata = resolvedExportMetadata(documentation, exportName);
      if (!metadata) {
        errors.push(`runtime export ${exportName} has no documentation profile`);
        continue;
      }
      stateModes.set(exportName, metadata.stateMode);
      const unknownStates = metadata.applicableStates.filter((state) => !VALID_STATES.includes(state));
      if (unknownStates.length) {
        errors.push(`runtime export ${exportName} has unsupported applicable state(s): ${unique(unknownStates).join(", ")}`);
      }
      states.push(...metadata.applicableStates);
    }
    const orderedStates = VALID_STATES.filter((state) => states.includes(state));
    expected.set(`${docsFamily.category}/${entry.id}.case.tsx`, {
      familyId: entry.id,
      caseId: `${entry.id}/overview`,
      exports,
      states: orderedStates,
      stateModes,
    });
  }
  return expected;
}

function listCaseFiles(casesRoot) {
  if (!fs.existsSync(casesRoot)) return [];
  const files = [];
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const resolved = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(resolved);
      else if (entry.isFile() && entry.name.endsWith(".case.tsx")) files.push(resolved);
    }
  }
  visit(casesRoot);
  return files.sort();
}

function parseDirective(sourceText, relativePath, errors) {
  const firstLine = sourceText.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0];
  const match = CASE_DIRECTIVE.exec(firstLine);
  if (!match) {
    errors.push(`${relativePath}: first line must be a valid @personal-ui-coverage directive`);
    return undefined;
  }
  try {
    return JSON.parse(match.groups.payload);
  } catch (error) {
    errors.push(`${relativePath}: coverage directive is not valid JSON (${error.message})`);
    return undefined;
  }
}

function sameMembers(actual, expected) {
  return actual.length === expected.length && actual.every((item) => expected.includes(item));
}

export function validateExplorerCases({ kitRoot = process.cwd() } = {}) {
  const resolvedKitRoot = path.resolve(kitRoot);
  const skillRoot = path.resolve(resolvedKitRoot, "../..");
  const casesRoot = path.join(resolvedKitRoot, "src", "explorer", "cases");
  const manifest = readJson(path.join(resolvedKitRoot, "component-manifest.json"));
  const documentation = readJson(path.join(resolvedKitRoot, "component-docs.json"));
  const registry = readJson(path.join(resolvedKitRoot, "registry.json"));
  const errors = [];
  const expected = expectedCases({ manifest, documentation, registry, errors });
  const actualFiles = listCaseFiles(casesRoot);
  const actualRelative = new Set(actualFiles.map((filePath) => toPosix(path.relative(casesRoot, filePath))));

  for (const relativePath of expected.keys()) {
    if (!actualRelative.has(relativePath)) errors.push(`missing Explorer case: ${relativePath}`);
  }
  for (const relativePath of actualRelative) {
    if (!expected.has(relativePath)) errors.push(`unexpected Explorer case: ${relativePath}`);
  }

  const evidence = Object.fromEntries((registry.exports ?? []).map((exportName) => [exportName, []]));
  const cases = [];
  for (const filePath of actualFiles) {
    const relativePath = toPosix(path.relative(casesRoot, filePath));
    const expectation = expected.get(relativePath);
    if (!expectation) continue;
    const repositoryPath = toPosix(path.relative(skillRoot, filePath));
    const sourceText = fs.readFileSync(filePath, "utf8");
    const directive = parseDirective(sourceText, repositoryPath, errors);
    if (!directive) continue;
    const expectedDirectiveKeys = ["caseId", "exports", "kind", "runner"];
    if (!sameMembers(Object.keys(directive).sort(), expectedDirectiveKeys)) {
      errors.push(`${repositoryPath}: coverage directive must contain only kind, runner, caseId, and exports`);
    }
    if (directive.kind !== "example" || directive.runner !== "explorer") {
      errors.push(`${repositoryPath}: coverage directive must use kind=example and runner=explorer`);
    }
    if (directive.caseId !== expectation.caseId) {
      errors.push(`${repositoryPath}: caseId must be ${expectation.caseId}`);
    }
    if (!Array.isArray(directive.exports) || !sameMembers(directive.exports, expectation.exports)) {
      errors.push(`${repositoryPath}: directive exports must exactly match family ${expectation.familyId}`);
    }

    const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    if (sourceFile.parseDiagnostics?.length) {
      for (const diagnostic of sourceFile.parseDiagnostics) {
        errors.push(`${repositoryPath}: TypeScript parse error ${ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")}`);
      }
      continue;
    }
    const declarations = collectTopLevelDeclarations(sourceFile);
    const caseObject = defaultCaseObject(sourceFile, declarations, errors, repositoryPath);
    if (!caseObject) continue;
    const properties = caseProperties(caseObject, errors, repositoryPath);
    const id = properties.has("id") ? literalText(properties.get("id")) : undefined;
    if (id !== expectation.caseId) errors.push(`${repositoryPath}: ExplorerCase id must be ${expectation.caseId}`);
    for (const key of ["label", "summary", "code"]) {
      if (properties.has(key) && !literalText(properties.get(key))?.trim()) {
        errors.push(`${repositoryPath}: ExplorerCase ${key} must be a non-empty static string`);
      }
    }

    const statesNode = properties.has("states") ? unwrapExpression(properties.get("states")) : undefined;
    const states = statesNode && ts.isArrayLiteralExpression(statesNode)
      ? statesNode.elements.map((element) => literalText(element)).filter(Boolean)
      : [];
    if (!statesNode || !ts.isArrayLiteralExpression(statesNode) || states.length !== statesNode.elements.length) {
      errors.push(`${repositoryPath}: ExplorerCase states must be an inline string array`);
    } else {
      const duplicateStates = states.filter((state, index) => states.indexOf(state) !== index);
      if (duplicateStates.length) errors.push(`${repositoryPath}: ExplorerCase states contains duplicates: ${unique(duplicateStates).join(", ")}`);
      if (!sameMembers(states, expectation.states)) {
        const missingStates = expectation.states.filter((state) => !states.includes(state));
        const unsupportedStates = states.filter((state) => !expectation.states.includes(state));
        if (missingStates.length) {
          errors.push(`${repositoryPath}: ExplorerCase states is missing applicable state(s): ${missingStates.join(", ")}`);
        }
        if (unsupportedStates.length) {
          errors.push(`${repositoryPath}: ExplorerCase states contains non-applicable state(s): ${unique(unsupportedStates).join(", ")}`);
        }
      }
    }

    const bindings = importedBindings(sourceFile, errors, repositoryPath);
    for (const exportName of expectation.exports) {
      if (!bindings.has(exportName)) errors.push(`${repositoryPath}: ${exportName} must be a named import from ../../../personal-ui`);
    }
    const content = properties.get("content");
    if (!content) continue;
    const runtimeEvidence = reachableRuntimeEvidence({
      sourceFile,
      content,
      bindings,
      stateModes: expectation.stateModes,
    });
    for (const exportName of expectation.exports) {
      if (!runtimeEvidence.has(exportName)) {
        const mode = expectation.stateModes.get(exportName);
        const usage = mode === "hook" ? "a reachable CallExpression" : mode === "constant" ? "a reachable runtime expression or prop" : "reachable JSX";
        errors.push(`${repositoryPath}: ${exportName} needs ${usage}; import, comment, string, and void references are not evidence`);
      } else {
        evidence[exportName].push(repositoryPath);
      }
    }
    cases.push({ id: expectation.caseId, family: expectation.familyId, file: repositoryPath, states });
  }

  return {
    ok: errors.length === 0,
    errors,
    evidence,
    cases,
    expectedCaseCount: expected.size,
    verifiedCaseCount: cases.length,
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
    const result = validateExplorerCases({ kitRoot: options.kitRoot });
    if (options.json) process.stdout.write(`${JSON.stringify(result)}\n`);
    else if (result.ok) process.stdout.write(`Explorer cases verified: ${result.verifiedCaseCount}/${result.expectedCaseCount}\n`);
    else {
      process.stderr.write(`Explorer case validation failed with ${result.errors.length} error(s):\n`);
      for (const error of result.errors) process.stderr.write(`- ${error}\n`);
    }
    process.exitCode = result.ok ? 0 : 1;
  } catch (error) {
    if (options?.json) process.stdout.write(`${JSON.stringify({ ok: false, errors: [error.message], evidence: {}, cases: [] })}\n`);
    else process.stderr.write(`${error.stack ?? error.message}\n`);
    process.exitCode = 1;
  }
}
