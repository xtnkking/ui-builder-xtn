import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

import { buildCurrentApiSnapshot } from "./api-snapshot.mjs";
import { validateExplorerCases } from "./validate-explorer-cases.mjs";
import { validateTestEvidence } from "./validate-test-evidence.mjs";

const toolDirectory = path.dirname(fileURLToPath(import.meta.url));
export const defaultKitRoot = path.resolve(toolDirectory, "../..");
export const defaultSkillRoot = path.resolve(defaultKitRoot, "../..");

const CSS_CUSTOM_PROPERTY = /--pui-[a-z0-9-]+/g;
const MIGRATION_MARKER = /^<!-- @personal-ui-migration (?<payload>\{.*\}) -->$/gm;
const CATEGORY_ORDER = [
  "foundation",
  "actions",
  "input",
  "navigation",
  "data",
  "feedback",
  "overlay",
  "pattern",
];

function compareNames(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function readJson(filePath, description) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Unable to read ${description} at ${filePath}: ${error.message}`);
  }
}

function toPosix(filePath) {
  return filePath.split(path.sep).join("/");
}

function normalizeText(value) {
  return value.replaceAll("\r\n", "\n").replace(/[ \t]+$/gm, "").trim();
}

function formatDiagnostics(diagnostics, projectDirectory) {
  const host = {
    getCanonicalFileName: (fileName) => fileName,
    getCurrentDirectory: () => projectDirectory,
    getNewLine: () => "\n",
  };
  return ts.formatDiagnosticsWithColorAndContext(diagnostics, host);
}

function loadProgram(kitRoot) {
  const configPath = path.join(kitRoot, "tsconfig.api.json");
  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
  if (configFile.error) throw new Error(formatDiagnostics([configFile.error], kitRoot));
  const parsed = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    kitRoot,
    undefined,
    configPath,
  );
  if (parsed.errors.length) throw new Error(formatDiagnostics(parsed.errors, kitRoot));
  const program = ts.createProgram(parsed.fileNames, parsed.options);
  const diagnostics = ts.getPreEmitDiagnostics(program);
  if (diagnostics.length) throw new Error(formatDiagnostics(diagnostics, kitRoot));
  return program;
}

function unalias(checker, symbol) {
  return symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
}

function publicRuntimeSymbols(program, entryPointPath) {
  const entryPoint = program.getSourceFile(entryPointPath);
  if (!entryPoint) throw new Error(`TypeScript did not load ${entryPointPath}`);
  const checker = program.getTypeChecker();
  const moduleSymbol = checker.getSymbolAtLocation(entryPoint);
  if (!moduleSymbol) throw new Error("The public barrel does not have a module symbol");
  return new Map(
    checker.getExportsOfModule(moduleSymbol)
      .map((exportedSymbol) => [exportedSymbol.getName(), unalias(checker, exportedSymbol)])
      .filter(([, symbol]) => symbol.flags & ts.SymbolFlags.Value),
  );
}

function mergeDocumentation(documentation, exportName) {
  const exportRecord = documentation.exports?.[exportName];
  if (!exportRecord || typeof exportRecord.profile !== "string") {
    throw new Error(`${exportName} is missing a component-docs export profile`);
  }
  const profile = documentation.profiles?.[exportRecord.profile];
  if (!profile) throw new Error(`${exportName} references unknown documentation profile ${exportRecord.profile}`);
  return {
    profile: exportRecord.profile,
    ...profile,
    ...(exportRecord.overrides ?? {}),
  };
}

export function exportAnchor(exportName) {
  return `export-${exportName
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .replaceAll("_", "-")
    .toLowerCase()}`;
}

function explorerCategory(category) {
  return category === "actions" ? "foundation" : category;
}

function explorerRoute(familyId, category) {
  return `#/${explorerCategory(category) === "pattern" ? "patterns" : "components"}/${familyId}`;
}

function literalText(node) {
  let value = node;
  while (
    value
    && (ts.isAsExpression(value) || ts.isSatisfiesExpression(value) || ts.isParenthesizedExpression(value))
  ) value = value.expression;
  return ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value) ? value.text : undefined;
}

function propertyName(node) {
  if (!node?.name) return undefined;
  if (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) return node.name.text;
  return undefined;
}

function explorerCaseObject(sourceFile) {
  const declarations = new Map();
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name)) declarations.set(declaration.name.text, declaration.initializer);
    }
  }
  const assignment = sourceFile.statements.find(
    (statement) => ts.isExportAssignment(statement) && !statement.isExportEquals,
  );
  if (!assignment) return undefined;
  let expression = assignment.expression;
  while (ts.isAsExpression(expression) || ts.isSatisfiesExpression(expression) || ts.isParenthesizedExpression(expression)) {
    expression = expression.expression;
  }
  if (ts.isIdentifier(expression)) expression = declarations.get(expression.text);
  while (expression && (ts.isAsExpression(expression) || ts.isSatisfiesExpression(expression) || ts.isParenthesizedExpression(expression))) {
    expression = expression.expression;
  }
  return expression && ts.isObjectLiteralExpression(expression) ? expression : undefined;
}

function caseProperty(caseObject, name) {
  const property = caseObject.properties.find(
    (candidate) => ts.isPropertyAssignment(candidate) && propertyName(candidate) === name,
  );
  return property?.initializer;
}

function compiledExampleModule(filePath, expectedExports) {
  const sourceText = fs.readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  if (sourceFile.parseDiagnostics?.length) {
    throw new Error(`Unable to parse verified Explorer case ${filePath}`);
  }
  const caseObject = explorerCaseObject(sourceFile);
  if (!caseObject) throw new Error(`Verified Explorer case has no static default object: ${filePath}`);
  const caseId = literalText(caseProperty(caseObject, "id"));
  const curatedCode = literalText(caseProperty(caseObject, "code"));
  const content = caseProperty(caseObject, "content");
  if (!caseId || !curatedCode?.trim() || !content) {
    throw new Error(`Verified Explorer case has no static id/code: ${filePath}`);
  }

  let caseBinding;
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      let initializer = declaration.initializer;
      while (initializer && (ts.isAsExpression(initializer) || ts.isSatisfiesExpression(initializer) || ts.isParenthesizedExpression(initializer))) {
        initializer = initializer.expression;
      }
      if (initializer === caseObject && ts.isIdentifier(declaration.name)) caseBinding = declaration.name.text;
    }
  }

  const statements = [];
  for (const statement of sourceFile.statements) {
    if (ts.isExportAssignment(statement)) continue;
    if (
      caseBinding
      && ts.isVariableStatement(statement)
      && statement.declarationList.declarations.some(
        (declaration) => ts.isIdentifier(declaration.name) && declaration.name.text === caseBinding,
      )
    ) continue;
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      if (statement.moduleSpecifier.text.endsWith("/types")) continue;
      if (statement.moduleSpecifier.text === "../../../personal-ui") {
        statements.push(statement.getText(sourceFile).replace('"../../../personal-ui"', '"./personal-ui"'));
        continue;
      }
    }
    statements.push(statement.getText(sourceFile));
  }
  statements.push(`export function PersonalUiExample() {\n  return (${content.getText(sourceFile)});\n}`);
  const implementation = normalizeText(statements.join("\n\n"));
  for (const exportName of expectedExports) {
    if (!new RegExp(`\\b${exportName.replaceAll("$", "\\$")}\\b`).test(implementation)) {
      throw new Error(`Verified Explorer case module does not retain ${exportName}: ${filePath}`);
    }
  }
  return {
    caseId,
    curatedCode: normalizeText(curatedCode),
    code: implementation,
  };
}

function markerSectionEnd(text, markerEnd) {
  const nextMarker = text.slice(markerEnd).search(MIGRATION_MARKER);
  return nextMarker < 0 ? text.length : markerEnd + nextMarker;
}

export function parseMigrationDocument({ skillRoot, registryExports }) {
  const relativePath = "references/v0.3.0-migrations.md";
  const filePath = path.join(skillRoot, relativePath);
  const text = fs.readFileSync(filePath, "utf8").replaceAll("\r\n", "\n");
  const knownExports = new Set(registryExports);
  const byExport = new Map();
  const markers = [...text.matchAll(MIGRATION_MARKER)];
  for (const marker of markers) {
    let payload;
    try {
      payload = JSON.parse(marker.groups.payload);
    } catch (error) {
      throw new Error(`Invalid migration marker JSON at ${relativePath}:${text.slice(0, marker.index).split("\n").length}: ${error.message}`);
    }
    const allowedKeys = new Set(["exports", "replacement", "typeEvidence"]);
    const unexpected = Object.keys(payload).filter((key) => !allowedKeys.has(key));
    if (unexpected.length) throw new Error(`Migration marker has unsupported key(s): ${unexpected.join(", ")}`);
    if (!Array.isArray(payload.exports) || payload.exports.length === 0) {
      throw new Error("Migration marker exports must be a non-empty array");
    }
    const section = text.slice(marker.index + marker[0].length, markerSectionEnd(text, marker.index + marker[0].length));
    const heading = section.match(/^## (?<heading>.+)$/m)?.groups.heading?.trim();
    if (!heading) throw new Error(`Migration marker for ${payload.exports.join(", ")} has no following level-two heading`);
    const body = section.slice(section.indexOf(`## ${heading}`) + heading.length + 3).trim();
    const summary = body.split(/\n\s*\n/, 1)[0].replace(/\s+/g, " ").trim();
    const codeBlocks = [...body.matchAll(/```(?:tsx|ts)\n(?<code>[\s\S]*?)```/g)]
      .map((match) => normalizeText(match.groups.code));
    const typeEvidence = Array.isArray(payload.typeEvidence) ? payload.typeEvidence : [];
    for (const evidencePath of typeEvidence) {
      if (typeof evidencePath !== "string" || !fs.existsSync(path.join(skillRoot, evidencePath))) {
        throw new Error(`Migration ${heading} has missing type evidence ${JSON.stringify(evidencePath)}`);
      }
    }
    for (const exportName of payload.exports) {
      if (!knownExports.has(exportName)) throw new Error(`Migration marker references unknown export ${exportName}`);
      if (byExport.has(exportName)) throw new Error(`Migration marker duplicates export ${exportName}`);
      byExport.set(exportName, {
        heading,
        summary,
        replacement: payload.replacement,
        ref: `${relativePath}#${heading.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-")}`,
        typeEvidence,
        codeBlocks,
      });
    }
  }
  return byExport;
}

function nodeContainsIdentifier(node, aliases) {
  let found = false;
  const visit = (candidate) => {
    if (found) return;
    if (ts.isIdentifier(candidate) && aliases.has(candidate.text)) {
      found = true;
      return;
    }
    ts.forEachChild(candidate, visit);
  };
  visit(node);
  return found;
}

function bindingDefaults(binding, sourceFile, destination) {
  if (!ts.isObjectBindingPattern(binding)) return;
  for (const element of binding.elements) {
    if (!element.initializer || !ts.isIdentifier(element.name)) continue;
    const prop = element.propertyName && (ts.isIdentifier(element.propertyName) || ts.isStringLiteral(element.propertyName))
      ? element.propertyName.text
      : element.name.text;
    const position = sourceFile.getLineAndCharacterOfPosition(element.initializer.getStart(sourceFile));
    destination.push({
      prop,
      value: normalizeText(element.initializer.getText(sourceFile)),
      line: position.line + 1,
    });
  }
}

function topLevelFunctions(sourceFile) {
  const result = new Map();
  for (const statement of sourceFile.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name && statement.body) {
      result.set(statement.name.text, statement);
      continue;
    }
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (
        ts.isIdentifier(declaration.name)
        && declaration.initializer
        && (ts.isArrowFunction(declaration.initializer) || ts.isFunctionExpression(declaration.initializer))
      ) result.set(declaration.name.text, declaration.initializer);
    }
  }
  return result;
}

function implementationFunction(symbol) {
  for (const declaration of symbol.getDeclarations() ?? []) {
    if (ts.isFunctionDeclaration(declaration) && declaration.body) return declaration;
    if (
      ts.isVariableDeclaration(declaration)
      && declaration.initializer
      && (ts.isArrowFunction(declaration.initializer) || ts.isFunctionExpression(declaration.initializer))
    ) return declaration.initializer;
  }
  return undefined;
}

function runtimeDefaults(symbol, publicPropNames, skillRoot) {
  const initial = implementationFunction(symbol);
  if (!initial) return [];
  const defaults = [];
  const visited = new Set();

  const analyze = (callable, inheritedAliases = new Set()) => {
    const sourceFile = callable.getSourceFile();
    const aliases = new Set(inheritedAliases);
    const firstParameter = callable.parameters[0];
    if (firstParameter) {
      if (ts.isIdentifier(firstParameter.name)) aliases.add(firstParameter.name.text);
      else bindingDefaults(firstParameter.name, sourceFile, defaults);
    }
    const visitKey = `${sourceFile.fileName}:${callable.pos}:${[...aliases].sort().join(",")}`;
    if (visited.has(visitKey)) return;
    visited.add(visitKey);
    const localFunctions = topLevelFunctions(sourceFile);
    const body = callable.body;
    if (!body) return;

    let changed = true;
    while (changed) {
      changed = false;
      const discoverAliases = (node) => {
        if (ts.isVariableDeclaration(node) && node.initializer && nodeContainsIdentifier(node.initializer, aliases)) {
          if (ts.isIdentifier(node.name) && !aliases.has(node.name.text)) {
            aliases.add(node.name.text);
            changed = true;
          } else if (ts.isObjectBindingPattern(node.name)) {
            bindingDefaults(node.name, sourceFile, defaults);
          }
        }
        ts.forEachChild(node, discoverAliases);
      };
      discoverAliases(body);
    }

    const followHelpers = (node) => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
        const target = localFunctions.get(node.expression.text);
        if (target) {
          node.arguments.forEach((argument, index) => {
            if (!nodeContainsIdentifier(argument, aliases)) return;
            const parameter = target.parameters[index];
            if (parameter && ts.isIdentifier(parameter.name)) analyze(target, new Set([parameter.name.text]));
          });
        }
      }
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        if (ts.isIdentifier(node.tagName)) {
          const target = localFunctions.get(node.tagName.text);
          if (target) {
            for (const attribute of node.attributes.properties) {
              if (!ts.isJsxAttribute(attribute) || !attribute.initializer || !ts.isJsxExpression(attribute.initializer)) continue;
              if (!attribute.initializer.expression || !nodeContainsIdentifier(attribute.initializer.expression, aliases)) continue;
              analyze(target, new Set([attribute.name.text]));
            }
          }
        }
      }
      ts.forEachChild(node, followHelpers);
    };
    followHelpers(body);
  };
  analyze(initial);

  const seen = new Set();
  return defaults
    .filter((record) => publicPropNames.size === 0 || publicPropNames.has(record.prop))
    .map((record) => {
      const sourceFile = initial.getSourceFile();
      return {
        ...record,
        source: toPosix(path.relative(skillRoot, sourceFile.fileName)),
      };
    })
    .filter((record) => {
      const key = `${record.prop}:${record.value}:${record.source}:${record.line}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) => compareNames(left.prop, right.prop) || left.line - right.line);
}

function publicTypeDetails(program, symbol) {
  const checker = program.getTypeChecker();
  const declaration = symbol.valueDeclaration ?? symbol.getDeclarations()?.[0];
  if (!declaration) return { callable: false, parameterType: undefined, publicPropNames: new Set() };
  const type = checker.getTypeOfSymbolAtLocation(symbol, declaration);
  const signature = checker.getSignaturesOfType(type, ts.SignatureKind.Call)[0];
  if (!signature) return { callable: false, parameterType: undefined, publicPropNames: new Set() };
  const parameter = signature.getParameters()[0];
  if (!parameter) return { callable: true, parameterType: undefined, publicPropNames: new Set() };
  const parameterDeclaration = parameter.valueDeclaration ?? parameter.getDeclarations()?.[0] ?? declaration;
  const parameterType = checker.getTypeOfSymbolAtLocation(parameter, parameterDeclaration);
  return {
    callable: true,
    parameterType: checker.typeToString(
      parameterType,
      parameterDeclaration,
      ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope,
    ),
    publicPropNames: new Set(checker.getPropertiesOfType(parameterType).map((property) => property.getName())),
  };
}

function sourceLocation(symbol, skillRoot) {
  const declaration = symbol.valueDeclaration ?? symbol.getDeclarations()?.[0];
  if (!declaration) return undefined;
  const sourceFile = declaration.getSourceFile();
  const position = sourceFile.getLineAndCharacterOfPosition(declaration.getStart(sourceFile));
  return {
    file: toPosix(path.relative(skillRoot, sourceFile.fileName)),
    line: position.line + 1,
  };
}

function semanticTokens(family, kitRoot, interaction) {
  if (interaction === "non-visual") {
    return { status: "not-applicable", reason: "This export does not render a styled surface." };
  }
  const files = (family.sourceFiles ?? []).filter((source) => path.extname(source).toLowerCase() === ".css").sort(compareNames);
  const themeContract = fs.readFileSync(path.join(kitRoot, "src/personal-ui/internal/theme-contract.ts"), "utf8");
  const publicTokenBlock = themeContract.match(/PUBLIC_THEME_TOKEN_NAMES\s*=\s*\[([\s\S]*?)\]\s*as const/);
  const publicTokens = new Set(
    [...(publicTokenBlock?.[1] ?? "").matchAll(/["'](--pui-[a-z0-9-]+)["']/g)].map((match) => match[1]),
  );
  const tokens = new Set();
  for (const source of files) {
    const filePath = path.join(kitRoot, source);
    if (!fs.existsSync(filePath)) continue;
    for (const token of fs.readFileSync(filePath, "utf8").match(CSS_CUSTOM_PROPERTY) ?? []) {
      if (publicTokens.has(token)) tokens.add(token);
    }
  }
  return { status: "derived", source: "manifest-css", files, tokens: [...tokens].sort(compareNames) };
}

function restrictions(documentation, migration) {
  const result = [];
  if (documentation.interaction === "non-visual") {
    result.push("This API renders no standalone Personal UI surface.");
  } else {
    result.push("Use only public props and semantic tokens; consumer className, style, css, sx, tw, DOM ref, and spread escape hatches are not supported.");
  }
  if (documentation.stateMode === "dual") {
    result.push("Choose either controlled props or their default-value form; do not combine both modes.");
  } else if (documentation.stateMode === "controlled") {
    result.push("The caller owns the public value and matching change callback.");
  } else if (documentation.stateMode === "async") {
    result.push("The caller owns request state and side effects; keep loading/error identity stable and block duplicate commands.");
  } else if (documentation.stateMode === "composed") {
    result.push("This pattern delegates interaction to registered Personal UI children; do not replace them with local controls.");
  }
  if (migration) result.push(`Review the v0.3.0 migration: ${migration.heading}.`);
  return result;
}

function migrationConsistency(exportName, documentation, migration) {
  const metadata = documentation.migration;
  if (metadata?.status === "documented" && !migration) {
    throw new Error(`${exportName} declares migration documentation but has no @personal-ui-migration marker`);
  }
  if (
    migration
    && metadata?.status === "documented"
    && !metadata.refs?.includes("references/v0.3.0-migrations.md")
  ) {
    throw new Error(`${exportName} migration metadata must reference references/v0.3.0-migrations.md`);
  }
}

function documentedOwnerContract(exportName, contract, evidenceKind, evidence) {
  if (contract.mode === "none") return contract;
  if (contract.status !== "derived" || contract.source !== "test-evidence") {
    throw new Error(`${exportName} ${evidenceKind} ownership must be derived from validated test evidence`);
  }
  const refs = evidence[evidenceKind]?.[exportName] ?? [];
  if (refs.length !== 1) {
    throw new Error(`${exportName} must have exactly one validated ${evidenceKind} evidence owner`);
  }
  return {
    mode: contract.mode,
    status: "documented",
    source: "test-evidence",
    refs,
  };
}

function documentedApiPage(exportName, apiPage) {
  const anchor = exportAnchor(exportName);
  if (apiPage?.status === "derived" && apiPage.source === "generated-component-api") {
    return {
      status: "documented",
      source: "generated-component-api",
      id: anchor,
      refs: ["references/component-api.md"],
    };
  }
  if (
    apiPage?.status === "documented"
    && apiPage.id === anchor
    && apiPage.refs?.includes("references/component-api.md")
  ) return apiPage;
  throw new Error(
    `${exportName} apiPage must derive from generated-component-api or document ${anchor}`,
  );
}

function categoryIndex(category) {
  const index = CATEGORY_ORDER.indexOf(category);
  return index < 0 ? CATEGORY_ORDER.length : index;
}

export function buildPublicApiModel({ kitRoot = defaultKitRoot, skillRoot = path.resolve(kitRoot, "../..") } = {}) {
  const resolvedKitRoot = path.resolve(kitRoot);
  const resolvedSkillRoot = path.resolve(skillRoot);
  const manifest = readJson(path.join(resolvedKitRoot, "component-manifest.json"), "component manifest");
  const documentation = readJson(path.join(resolvedKitRoot, "component-docs.json"), "component documentation");
  const registry = readJson(path.join(resolvedKitRoot, "registry.json"), "component registry");
  const snapshot = buildCurrentApiSnapshot(resolvedKitRoot);
  const program = loadProgram(resolvedKitRoot);
  const entryPointPath = path.join(resolvedKitRoot, "src/personal-ui/index.ts");
  const runtimeSymbols = publicRuntimeSymbols(program, entryPointPath);
  const explorer = validateExplorerCases({ kitRoot: resolvedKitRoot });
  if (!explorer.ok) throw new Error(`Explorer AST validation failed:\n- ${explorer.errors.join("\n- ")}`);
  const testEvidence = validateTestEvidence({ kitRoot: resolvedKitRoot, explorerResult: explorer });
  if (!testEvidence.ok) {
    throw new Error(`Test evidence validation failed:\n- ${testEvidence.errors.join("\n- ")}`);
  }
  const migrations = parseMigrationDocument({ skillRoot: resolvedSkillRoot, registryExports: registry.exports });
  const signatures = new Map(snapshot.signatures.map((record) => [record.name, record.declaration]));
  const stability = new Map();
  for (const [kind, names] of Object.entries(registry.exportStability ?? {})) {
    for (const name of names) stability.set(name, kind);
  }

  const familyByExport = new Map();
  const families = manifest.entries.map((entry) => {
    const category = documentation.families?.[entry.id]?.category ?? (entry.kind === "foundation" ? "foundation" : undefined);
    if (!category) throw new Error(`Manifest family ${entry.id} is missing documentation category`);
    for (const exportName of entry.publicExports ?? []) {
      if (familyByExport.has(exportName)) throw new Error(`${exportName} belongs to more than one Manifest family`);
      familyByExport.set(exportName, entry);
    }
    return {
      id: entry.id,
      kind: entry.kind,
      category,
      explorerCategory: explorerCategory(category),
      explorerRoute: explorerRoute(entry.id, category),
      aliases: [...(entry.aliases ?? [])].sort(compareNames),
      publicExports: [...(entry.publicExports ?? [])].sort(compareNames),
      sourceFiles: [...(entry.sourceFiles ?? [])].sort(compareNames),
    };
  }).sort((left, right) => (
    categoryIndex(left.category) - categoryIndex(right.category)
    || compareNames(left.id, right.id)
  ));

  const registered = [...registry.exports].sort(compareNames);
  const actual = [...runtimeSymbols.keys()].sort(compareNames);
  if (JSON.stringify(registered) !== JSON.stringify(actual)) {
    throw new Error("Registry runtime exports do not match the TypeScript public barrel");
  }
  const docsExports = Object.keys(documentation.exports ?? {}).sort(compareNames);
  if (JSON.stringify(registered) !== JSON.stringify(docsExports)) {
    throw new Error("component-docs exports do not match registered runtime exports");
  }

  const exampleCache = new Map();
  const exports = registered.map((exportName) => {
    const symbol = runtimeSymbols.get(exportName);
    const familyEntry = familyByExport.get(exportName);
    if (!familyEntry) throw new Error(`${exportName} has no Manifest family`);
    const docs = mergeDocumentation(documentation, exportName);
    const migration = migrations.get(exportName);
    migrationConsistency(exportName, docs, migration);
    const exampleRefs = explorer.evidence[exportName] ?? [];
    if (exampleRefs.length !== 1) throw new Error(`${exportName} must have exactly one AST-verified Explorer case`);
    const examplePath = path.join(resolvedSkillRoot, exampleRefs[0]);
    const familyExpectedExports = familyEntry.publicExports ?? [];
    if (!exampleCache.has(examplePath)) {
      exampleCache.set(examplePath, compiledExampleModule(examplePath, familyExpectedExports));
    }
    const example = exampleCache.get(examplePath);
    const typeDetails = publicTypeDetails(program, symbol);
    const defaults = runtimeDefaults(symbol, typeDetails.publicPropNames, resolvedSkillRoot);
    const source = sourceLocation(symbol, resolvedSkillRoot);
    const signature = signatures.get(exportName);
    if (!signature) throw new Error(`${exportName} has no TypeScript signature`);
    return {
      name: exportName,
      anchor: exportAnchor(exportName),
      family: familyEntry.id,
      category: documentation.families?.[familyEntry.id]?.category ?? "foundation",
      kind: registry.exportClassifications?.["non-visual"]?.includes(exportName)
        ? "non-visual"
        : registry.exportClassifications?.pattern?.includes(exportName)
          ? "pattern"
          : registry.exportClassifications?.layout?.includes(exportName)
            ? "layout"
            : "component",
      stability: stability.get(exportName) ?? "unknown",
      profile: docs.profile,
      interaction: docs.interaction,
      stateMode: docs.stateMode,
      applicableStates: docs.applicableStates,
      parameterType: typeDetails.parameterType,
      signature,
      source,
      defaults,
      defaultSourceFiles: (familyEntry.sourceFiles ?? []).filter((file) => /\.[cm]?[jt]sx?$/.test(file)).sort(compareNames),
      apiPage: documentedApiPage(exportName, docs.apiPage),
      keyboard: documentedOwnerContract(exportName, docs.keyboard, "keyboard", testEvidence.evidence),
      aria: documentedOwnerContract(exportName, docs.aria, "a11y", testEvidence.evidence),
      semanticTokens: semanticTokens(familyEntry, resolvedKitRoot, docs.interaction),
      restrictions: restrictions(docs, migration),
      example: {
        id: example.caseId,
        ref: exampleRefs[0],
        route: explorerRoute(familyEntry.id, documentation.families?.[familyEntry.id]?.category ?? "foundation"),
        code: example.code,
        excerpt: example.curatedCode,
      },
      migration: migration
        ? { status: "documented", ...migration }
        : { status: "none", reason: docs.migration?.reason ?? "No migration is required for this export." },
    };
  });

  return {
    schemaVersion: 1,
    kind: "personal-ui-generated-api-model",
    packageName: registry.name,
    version: registry.version,
    entryPoint: snapshot.entryPoint,
    runtimeExportCount: exports.length,
    typeOnlyExportCount: snapshot.typeOnlyExports.length,
    familyCount: families.length,
    generatedFrom: [
      "assets/react-kit/src/personal-ui/index.ts",
      "assets/react-kit/component-manifest.json",
      "assets/react-kit/component-docs.json",
      "assets/react-kit/src/explorer/cases/**/*.case.tsx",
      "assets/react-kit/tests/browser/m6-keyboard-ownership.spec.ts",
      "assets/react-kit/tests/a11y/m6-export-ownership.spec.ts",
      "references/v0.3.0-migrations.md",
    ],
    families,
    exports,
  };
}
