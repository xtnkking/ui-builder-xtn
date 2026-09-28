import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const toolDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(toolDirectory, "../..");
const configPath = path.join(projectDirectory, "tsconfig.api.json");
const entryPointPath = path.join(projectDirectory, "src/personal-ui/index.ts");
const registryPath = path.join(projectDirectory, "registry.json");
const reportPath = path.join(projectDirectory, "etc/personal-ui.api.md");

const normalizePath = (value) => path.resolve(value).replaceAll("\\", "/");
const normalizeText = (value) =>
  value.replaceAll("\r\n", "\n").replace(/[ \t]+$/gm, "").trimEnd() + "\n";
const compareExportNames = (left, right) => (left < right ? -1 : left > right ? 1 : 0);

function fail(message) {
  console.error(`[personal-ui-api] ${message}`);
  process.exitCode = 1;
}

function readJson(filePath, description) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Unable to read ${description} at ${filePath}: ${error.message}`);
  }
}

function formatDiagnostics(diagnostics) {
  const host = {
    getCanonicalFileName: (fileName) => fileName,
    getCurrentDirectory: () => projectDirectory,
    getNewLine: () => "\n",
  };
  return ts.formatDiagnosticsWithColorAndContext(diagnostics, host);
}

function loadProgram() {
  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
  if (configFile.error) {
    throw new Error(formatDiagnostics([configFile.error]));
  }

  const parsed = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    projectDirectory,
    undefined,
    configPath,
  );
  if (parsed.errors.length > 0) {
    throw new Error(formatDiagnostics(parsed.errors));
  }

  const program = ts.createProgram(parsed.fileNames, parsed.options);
  const diagnostics = ts.getPreEmitDiagnostics(program);
  if (diagnostics.length > 0) {
    throw new Error(formatDiagnostics(diagnostics));
  }

  return program;
}

function collectPublicExports(program) {
  const entryPoint = program.getSourceFile(entryPointPath);
  if (!entryPoint) {
    throw new Error(`TypeScript did not load the public entry point ${entryPointPath}`);
  }

  const checker = program.getTypeChecker();
  const moduleSymbol = checker.getSymbolAtLocation(entryPoint);
  if (!moduleSymbol) {
    throw new Error("The public entry point does not have a module symbol");
  }

  const runtime = [];
  const typeOnly = [];
  for (const exportedSymbol of checker.getExportsOfModule(moduleSymbol)) {
    const symbol = exportedSymbol.flags & ts.SymbolFlags.Alias
      ? checker.getAliasedSymbol(exportedSymbol)
      : exportedSymbol;
    const destination = symbol.flags & ts.SymbolFlags.Value ? runtime : typeOnly;
    destination.push(exportedSymbol.getName());
  }

  runtime.sort(compareExportNames);
  typeOnly.sort(compareExportNames);
  return { entryPoint, runtime, typeOnly };
}

function validateRuntimeExports(actualRuntimeExports) {
  const registry = readJson(registryPath, "Personal UI registry");
  if (!Array.isArray(registry.exports) || registry.exports.some((name) => typeof name !== "string")) {
    throw new Error("registry.json must define exports as an array of strings");
  }

  const expected = [...registry.exports].sort(compareExportNames);
  const duplicateExpected = expected.filter((name, index) => expected[index - 1] === name);
  if (duplicateExpected.length > 0) {
    throw new Error(`registry.json contains duplicate exports: ${[...new Set(duplicateExpected)].join(", ")}`);
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

function emitDeclarations(program) {
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
    throw new Error(formatDiagnostics(emitResult.diagnostics));
  }
  return declarationBySource;
}

function resolveBarrelModule(moduleName) {
  const resolution = ts.resolveModuleName(
    moduleName,
    entryPointPath,
    { moduleResolution: ts.ModuleResolutionKind.Bundler, jsx: ts.JsxEmit.ReactJSX },
    ts.sys,
  ).resolvedModule;
  if (!resolution) {
    throw new Error(`Unable to resolve public barrel module ${moduleName}`);
  }
  return normalizePath(resolution.resolvedFileName);
}

function listLine(values) {
  return values.map((value) => `\`${value}\``).join(", ");
}

function createReport(runtimeExports, typeOnlyExports, modules, declarations) {
  const sections = modules.map((moduleName) => {
    const sourcePath = resolveBarrelModule(moduleName);
    const declaration = declarations.get(sourcePath);
    if (!declaration) {
      throw new Error(`Declaration emit did not produce output for ${moduleName} (${sourcePath})`);
    }
    return `## \`${moduleName}\`\n\n\`\`\`ts\n${declaration}\`\`\``;
  });

  return normalizeText(`<!-- This file is generated by npm run api:report. Do not edit it directly. -->
# Personal UI public API report

- Entry point: \`src/personal-ui/index.ts\`
- Runtime exports: ${runtimeExports.length}
- Type-only exports: ${typeOnlyExports.length}
- Declaration modules: ${modules.length}

## Runtime export inventory

${listLine(runtimeExports)}

## Type-only export inventory

${listLine(typeOnlyExports)}

${sections.join("\n\n")}
`);
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

function main() {
  const modes = new Set(process.argv.slice(2));
  if (modes.size !== 1 || (!["--write", "--check"].some((mode) => modes.has(mode)))) {
    throw new Error("Usage: generate-api-report.mjs --write | --check");
  }

  const program = loadProgram();
  const { entryPoint, runtime, typeOnly } = collectPublicExports(program);
  const runtimeExports = validateRuntimeExports(runtime);
  const modules = directBarrelModules(entryPoint);
  const declarations = emitDeclarations(program);
  const report = createReport(runtimeExports, typeOnly, modules, declarations);

  if (modes.has("--write")) {
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, report, "utf8");
    console.log(
      `[personal-ui-api] wrote ${path.relative(projectDirectory, reportPath)} `
      + `(${runtimeExports.length} runtime exports, ${typeOnly.length} type-only exports, ${modules.length} modules)`,
    );
    return;
  }

  if (!fs.existsSync(reportPath)) {
    fail(`Missing API baseline ${path.relative(projectDirectory, reportPath)}; run npm run api:report`);
    return;
  }
  const baseline = normalizeText(fs.readFileSync(reportPath, "utf8"));
  if (baseline !== report) {
    const difference = firstDifference(baseline, report);
    fail(
      `API baseline is stale at line ${difference?.line ?? "unknown"}. `
      + `Expected ${JSON.stringify(difference?.expected)}, received ${JSON.stringify(difference?.actual)}. `
      + "Review the public API change, then run npm run api:report.",
    );
    return;
  }

  console.log(
    `[personal-ui-api] valid (${runtimeExports.length} runtime exports, `
    + `${typeOnly.length} type-only exports, ${modules.length} modules)`,
  );
}

try {
  main();
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
