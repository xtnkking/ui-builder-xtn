import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const toolDirectory = path.dirname(fileURLToPath(import.meta.url));
export const defaultProjectDirectory = path.resolve(toolDirectory, "../..");

const compareNames = (left, right) => (left < right ? -1 : left > right ? 1 : 0);
const normalizePath = (value) => path.resolve(value).replaceAll("\\", "/");
const normalizeText = (value) => (
  value.replaceAll("\r\n", "\n").replace(/[ \t]+$/gm, "").trim()
);

function readJson(filePath, description) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Unable to read ${description} at ${filePath}: ${error.message}`);
  }
}

function formatDiagnostics(diagnostics, projectDirectory) {
  const host = {
    getCanonicalFileName: (fileName) => fileName,
    getCurrentDirectory: () => projectDirectory,
    getNewLine: () => "\n",
  };
  return ts.formatDiagnosticsWithColorAndContext(diagnostics, host);
}

function loadProgram(projectDirectory) {
  const configPath = path.join(projectDirectory, "tsconfig.api.json");
  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
  if (configFile.error) {
    throw new Error(formatDiagnostics([configFile.error], projectDirectory));
  }

  const parsed = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    projectDirectory,
    undefined,
    configPath,
  );
  if (parsed.errors.length > 0) {
    throw new Error(formatDiagnostics(parsed.errors, projectDirectory));
  }

  const program = ts.createProgram(parsed.fileNames, parsed.options);
  const diagnostics = ts.getPreEmitDiagnostics(program);
  if (diagnostics.length > 0) {
    throw new Error(formatDiagnostics(diagnostics, projectDirectory));
  }

  return { program, compilerOptions: parsed.options };
}

function collectPublicExports(program, entryPointPath) {
  const entryPoint = program.getSourceFile(entryPointPath);
  if (!entryPoint) {
    throw new Error(`TypeScript did not load the public entry point ${entryPointPath}`);
  }

  const checker = program.getTypeChecker();
  const moduleSymbol = checker.getSymbolAtLocation(entryPoint);
  if (!moduleSymbol) {
    throw new Error("The public entry point does not have a module symbol");
  }

  const runtimeExports = [];
  const typeOnlyExports = [];
  const publicSymbols = [];
  for (const exportedSymbol of checker.getExportsOfModule(moduleSymbol)) {
    const symbol = exportedSymbol.flags & ts.SymbolFlags.Alias
      ? checker.getAliasedSymbol(exportedSymbol)
      : exportedSymbol;
    const kind = symbol.flags & ts.SymbolFlags.Value ? "runtime" : "type";
    const destination = kind === "runtime"
      ? runtimeExports
      : typeOnlyExports;
    destination.push(exportedSymbol.getName());
    publicSymbols.push({
      name: exportedSymbol.getName(),
      kind,
      symbol,
    });
  }

  runtimeExports.sort(compareNames);
  typeOnlyExports.sort(compareNames);
  publicSymbols.sort((left, right) => compareNames(left.name, right.name));
  return { entryPoint, runtimeExports, typeOnlyExports, publicSymbols };
}

function validateRuntimeExports(registry, actualRuntimeExports) {
  if (!Array.isArray(registry.exports) || registry.exports.some((name) => typeof name !== "string")) {
    throw new Error("registry.json must define exports as an array of strings");
  }

  const expected = [...registry.exports].sort(compareNames);
  const duplicates = expected.filter((name, index) => expected[index - 1] === name);
  if (duplicates.length > 0) {
    throw new Error(`registry.json contains duplicate exports: ${[...new Set(duplicates)].join(", ")}`);
  }

  const actualSet = new Set(actualRuntimeExports);
  const expectedSet = new Set(expected);
  const missing = expected.filter((name) => !actualSet.has(name));
  const unexpected = actualRuntimeExports.filter((name) => !expectedSet.has(name));
  if (missing.length > 0 || unexpected.length > 0) {
    const details = [];
    if (missing.length > 0) details.push(`missing from the barrel: ${missing.join(", ")}`);
    if (unexpected.length > 0) details.push(`not registered: ${unexpected.join(", ")}`);
    throw new Error(`Runtime export mismatch (${details.join("; ")})`);
  }

  return expected;
}

function directBarrelModules(entryPoint) {
  const modules = [];
  for (const statement of entryPoint.statements) {
    if (
      ts.isExportDeclaration(statement)
      && !statement.exportClause
      && statement.moduleSpecifier
      && ts.isStringLiteral(statement.moduleSpecifier)
      && statement.moduleSpecifier.text.startsWith(".")
    ) {
      modules.push(statement.moduleSpecifier.text);
    }
  }
  if (modules.length === 0) {
    throw new Error("The public barrel does not contain any direct export declarations");
  }
  return modules;
}

function emitDeclarations(program, projectDirectory) {
  const declarationBySource = new Map();
  const emitResult = program.emit(
    undefined,
    (fileName, data, _writeByteOrderMark, _onError, sourceFiles) => {
      if (!fileName.endsWith(".d.ts") || !sourceFiles) return;
      for (const sourceFile of sourceFiles) {
        declarationBySource.set(normalizePath(sourceFile.fileName), normalizeText(data));
      }
    },
    undefined,
    true,
  );
  if (emitResult.emitSkipped || emitResult.diagnostics.length > 0) {
    throw new Error(formatDiagnostics(emitResult.diagnostics, projectDirectory));
  }
  return declarationBySource;
}

function bindingNames(name, destination) {
  if (ts.isIdentifier(name)) {
    destination.push(name.text);
    return;
  }
  for (const element of name.elements) {
    if (ts.isOmittedExpression(element)) continue;
    bindingNames(element.name, destination);
  }
}

function statementNames(statement) {
  if (ts.isVariableStatement(statement)) {
    const names = [];
    for (const declaration of statement.declarationList.declarations) {
      bindingNames(declaration.name, names);
    }
    return names;
  }
  if (ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
    return statement.exportClause.elements.map((element) => element.name.text);
  }
  if (
    (ts.isClassDeclaration(statement)
      || ts.isEnumDeclaration(statement)
      || ts.isFunctionDeclaration(statement)
      || ts.isInterfaceDeclaration(statement)
      || ts.isModuleDeclaration(statement)
      || ts.isTypeAliasDeclaration(statement))
    && statement.name
  ) {
    return [statement.name.text];
  }
  return [];
}

function declarationRecords(moduleName, declarationText) {
  const sourceFile = ts.createSourceFile(
    `${moduleName.replaceAll("/", "-")}.d.ts`,
    declarationText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const grouped = new Map();

  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement) || ts.isImportEqualsDeclaration(statement)) continue;
    const text = normalizeText(statement.getText(sourceFile));
    if (!text) continue;
    const names = statementNames(statement);
    const kind = ts.SyntaxKind[statement.kind];
    const anonymousKey = createHash("sha256").update(text).digest("hex").slice(0, 16);
    const id = `${kind}:${names.length > 0 ? names.join(",") : `anonymous-${anonymousKey}`}`;
    const identifiers = new Set();
    const visit = (node) => {
      if (ts.isIdentifier(node)) identifiers.add(node.text);
      ts.forEachChild(node, visit);
    };
    visit(statement);
    const existing = grouped.get(id) ?? { id, names: new Set(), identifiers: new Set(), declarations: [] };
    for (const name of names) existing.names.add(name);
    for (const identifier of identifiers) existing.identifiers.add(identifier);
    existing.declarations.push(text);
    grouped.set(id, existing);
  }

  return [...grouped.values()]
    .map((record) => ({
      id: record.id,
      names: [...record.names].sort(compareNames),
      identifiers: [...record.identifiers].sort(compareNames),
      declaration: record.declarations.join("\n"),
    }))
    .sort((left, right) => compareNames(left.id, right.id));
}

function publicSignature(publicSymbol, recordsBySource) {
  const declarationSourcePaths = (publicSymbol.symbol.getDeclarations() ?? [])
    .map((declaration) => normalizePath(declaration.getSourceFile().fileName));
  const sourcePath = declarationSourcePaths.find((candidate) => recordsBySource.has(candidate));
  if (!sourcePath) {
    throw new Error(`Unable to locate emitted declaration source for public export ${publicSymbol.name}`);
  }

  const records = recordsBySource.get(sourcePath);
  const recordsByName = new Map();
  for (const record of records) {
    for (const name of record.names) {
      const namedRecords = recordsByName.get(name) ?? [];
      namedRecords.push(record);
      recordsByName.set(name, namedRecords);
    }
  }

  const targetName = publicSymbol.symbol.getName();
  const queue = [targetName];
  if (targetName !== publicSymbol.name) queue.push(publicSymbol.name);
  const selected = new Map();
  const visitedNames = new Set();
  let foundRoot = false;
  while (queue.length > 0) {
    const name = queue.shift();
    if (visitedNames.has(name)) continue;
    visitedNames.add(name);
    const matchingRecords = recordsByName.get(name) ?? [];
    if (name === targetName && matchingRecords.length > 0) foundRoot = true;
    for (const record of matchingRecords) {
      if (selected.has(record.id)) continue;
      selected.set(record.id, record);
      for (const identifier of record.identifiers) {
        if (recordsByName.has(identifier) && !visitedNames.has(identifier)) queue.push(identifier);
      }
    }
  }
  if (!foundRoot) {
    throw new Error(
      `Unable to resolve a declaration for public export ${publicSymbol.name} (target ${targetName})`,
    );
  }

  return [...selected.values()]
    .sort((left, right) => compareNames(left.id, right.id))
    .map((record) => record.declaration)
    .join("\n");
}

function resolveBarrelModule(moduleName, entryPointPath, compilerOptions) {
  const resolution = ts.resolveModuleName(
    moduleName,
    entryPointPath,
    compilerOptions,
    ts.sys,
  ).resolvedModule;
  if (!resolution) {
    throw new Error(`Unable to resolve public barrel module ${moduleName}`);
  }
  return normalizePath(resolution.resolvedFileName);
}

export function apiDigest(snapshot) {
  const publicApi = {
    entryPoint: snapshot.entryPoint,
    runtimeExports: snapshot.runtimeExports,
    typeOnlyExports: snapshot.typeOnlyExports,
    modules: snapshot.modules,
  };
  return createHash("sha256").update(JSON.stringify(publicApi)).digest("hex");
}

export function compatibilityDigest(snapshot) {
  const publicApi = {
    entryPoint: snapshot.entryPoint,
    runtimeExports: snapshot.runtimeExports,
    typeOnlyExports: snapshot.typeOnlyExports,
    signatures: snapshot.signatures,
  };
  return createHash("sha256").update(JSON.stringify(publicApi)).digest("hex");
}

export function buildCurrentApiSnapshot(projectDirectory = defaultProjectDirectory) {
  const entryPointPath = path.join(projectDirectory, "src/personal-ui/index.ts");
  const registry = readJson(path.join(projectDirectory, "registry.json"), "Personal UI registry");
  const { program, compilerOptions } = loadProgram(projectDirectory);
  const {
    entryPoint,
    runtimeExports: actualRuntime,
    typeOnlyExports,
    publicSymbols,
  } = collectPublicExports(
    program,
    entryPointPath,
  );
  const runtimeExports = validateRuntimeExports(registry, actualRuntime);
  const moduleNames = directBarrelModules(entryPoint);
  const declarations = emitDeclarations(program, projectDirectory);
  const recordsBySource = new Map();
  for (const [sourcePath, declaration] of declarations) {
    recordsBySource.set(sourcePath, declarationRecords(sourcePath, declaration));
  }
  const signatures = publicSymbols.map((publicSymbol) => ({
    name: publicSymbol.name,
    kind: publicSymbol.kind,
    declaration: publicSignature(publicSymbol, recordsBySource),
  }));
  const modules = moduleNames.map((moduleName) => {
    const sourcePath = resolveBarrelModule(moduleName, entryPointPath, compilerOptions);
    const declaration = declarations.get(sourcePath);
    if (!declaration) {
      throw new Error(`Declaration emit did not produce output for ${moduleName} (${sourcePath})`);
    }
    return {
      name: moduleName,
      signatures: recordsBySource.get(sourcePath).map(({ id, declaration: text }) => ({
        id,
        declaration: text,
      })),
    };
  });

  const snapshot = {
    schemaVersion: 1,
    kind: "personal-ui-public-api-snapshot",
    packageName: registry.name,
    version: registry.version,
    entryPoint: "src/personal-ui/index.ts",
    runtimeExports,
    typeOnlyExports,
    signatures,
    modules,
  };
  return {
    ...snapshot,
    apiDigest: apiDigest(snapshot),
    compatibilityDigest: compatibilityDigest(snapshot),
  };
}
