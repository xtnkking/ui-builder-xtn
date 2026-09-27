import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import ts from "typescript";

function option(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a value`);
  return value;
}

const kitRoot = path.resolve(option("--kit-root") ?? process.cwd());
const sourceRoot = path.join(kitRoot, "src/personal-ui");
const configPath = path.join(kitRoot, "module-boundaries.json");
const manifestPath = path.join(kitRoot, "component-manifest.json");
const coveragePath = path.join(kitRoot, "component-coverage.json");
const reportPath = path.join(kitRoot, "etc/personal-ui.module-ownership.json");
const write = process.argv.includes("--write");

const normalize = (value) => value.replaceAll(path.sep, "/");
const relativeToKit = (value) => normalize(path.relative(kitRoot, value));
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
}

function isScript(file) {
  return /\.[cm]?[jt]sx?$/.test(file);
}

function resolveRelativeImport(source, specifier, sourceFiles) {
  if (!specifier.startsWith(".")) return null;
  const base = path.resolve(path.dirname(source), specifier);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.mts`,
    `${base}.cts`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
  ];
  return candidates.find((candidate) => sourceFiles.has(path.resolve(candidate))) ?? null;
}

function importIsTypeOnly(node) {
  if (ts.isImportDeclaration(node)) {
    if (node.importClause?.isTypeOnly) return true;
    const bindings = node.importClause?.namedBindings;
    return Boolean(
      node.importClause
      && !node.importClause.name
      && bindings
      && ts.isNamedImports(bindings)
      && bindings.elements.length > 0
      && bindings.elements.every((element) => element.isTypeOnly),
    );
  }
  return ts.isExportDeclaration(node) && node.isTypeOnly;
}

function findCycle(graph) {
  const visiting = new Set();
  const visited = new Set();
  const stack = [];

  function visit(node) {
    if (visiting.has(node)) {
      const start = stack.indexOf(node);
      return [...stack.slice(start), node];
    }
    if (visited.has(node)) return null;
    visiting.add(node);
    stack.push(node);
    for (const dependency of graph.get(node) ?? []) {
      const cycle = visit(dependency);
      if (cycle) return cycle;
    }
    stack.pop();
    visiting.delete(node);
    visited.add(node);
    return null;
  }

  for (const node of [...graph.keys()].sort()) {
    const cycle = visit(node);
    if (cycle) return cycle;
  }
  return null;
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(
      ([key, child]) => [key, stable(child)],
    ));
  }
  return value;
}

const config = readJson(configPath);
const manifest = readJson(manifestPath);
const coverage = readJson(coveragePath);
const errors = [];

if (config.schemaVersion !== 1 || !Array.isArray(config.modules) || config.modules.length === 0) {
  errors.push("module-boundaries.json must use schemaVersion 1 and declare modules");
}

const publicBarrel = path.resolve(kitRoot, config.publicBarrel ?? "");
if (publicBarrel !== path.join(sourceRoot, "index.ts")) {
  errors.push("publicBarrel must be src/personal-ui/index.ts");
}

const modules = (config.modules ?? []).map((entry) => ({
  id: entry.id,
  root: path.resolve(kitRoot, entry.root ?? ""),
  rootRelative: entry.root,
}));
const duplicateModuleIds = modules.filter((entry, index) => modules.findIndex((item) => item.id === entry.id) !== index);
if (duplicateModuleIds.length > 0) errors.push(`duplicate module id(s): ${duplicateModuleIds.map(({ id }) => id).join(", ")}`);

const allScriptFiles = walk(sourceRoot).filter(isScript).map((file) => path.resolve(file)).sort();
const sourceFiles = new Set(allScriptFiles);
const implementationFiles = allScriptFiles.filter((file) => file !== publicBarrel);
const ownerByFile = new Map();

for (const file of implementationFiles) {
  const owners = modules.filter(({ root }) => file === root || file.startsWith(`${root}${path.sep}`));
  if (owners.length !== 1) {
    errors.push(`${relativeToKit(file)} must belong to exactly one module; found ${owners.length}`);
    continue;
  }
  ownerByFile.set(file, owners[0].id);
}

const graph = new Map(allScriptFiles.map((file) => [file, new Set()]));
for (const file of allScriptFiles) {
  const text = fs.readFileSync(file, "utf8");
  const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  for (const statement of sourceFile.statements) {
    if (!(ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement))) continue;
    if (!statement.moduleSpecifier || !ts.isStringLiteral(statement.moduleSpecifier) || importIsTypeOnly(statement)) continue;
    const specifier = statement.moduleSpecifier.text;
    const target = resolveRelativeImport(file, specifier, sourceFiles);
    if (specifier.startsWith(".") && !target) {
      errors.push(`${relativeToKit(file)} has unresolved relative import ${JSON.stringify(specifier)}`);
      continue;
    }
    if (!target) continue;
    if (file !== publicBarrel && target === publicBarrel) {
      errors.push(`${relativeToKit(file)} must not import the public barrel`);
    }
    graph.get(file).add(target);
  }
}

const cycle = findCycle(graph);
if (cycle) errors.push(`runtime source cycle: ${cycle.map(relativeToKit).join(" -> ")}`);

const coverageByExport = new Map((coverage.exports ?? []).map((entry) => [entry.name, entry]));
const ownership = [];
for (const entry of manifest.entries ?? []) {
  const scriptSources = (entry.sourceFiles ?? []).filter(isScript);
  const sourceModules = [...new Set(scriptSources.map((source) => ownerByFile.get(path.resolve(kitRoot, source))).filter(Boolean))].sort();
  for (const source of scriptSources) {
    if (!ownerByFile.has(path.resolve(kitRoot, source))) errors.push(`manifest entry ${entry.id} has unowned source ${source}`);
  }

  const exports = [];
  for (const exportName of entry.publicExports ?? []) {
    const evidence = coverageByExport.get(exportName);
    if (!evidence) {
      errors.push(`manifest export ${exportName} has no component coverage record`);
      continue;
    }
    if (evidence.owner?.manifestEntry !== entry.id) {
      errors.push(`coverage owner for ${exportName} does not match manifest entry ${entry.id}`);
    }
    const manifestSources = [...(entry.sourceFiles ?? [])].sort();
    const coverageSources = [...(evidence.source ?? [])].sort();
    if (JSON.stringify(manifestSources) !== JSON.stringify(coverageSources)) {
      errors.push(`coverage source list for ${exportName} is stale`);
    }
    exports.push({
      name: exportName,
      api: evidence.documentation?.apiPage?.refs ?? evidence.api ?? [],
      examples: evidence.documentation?.example?.refs ?? [],
      keyboard: evidence.documentation?.keyboard?.refs ?? [],
      aria: evidence.documentation?.aria?.refs ?? [],
    });
  }
  ownership.push({
    id: entry.id,
    kind: entry.kind,
    modules: sourceModules,
    sourceFiles: entry.sourceFiles ?? [],
    exports,
  });
}

const moduleReport = modules.map(({ id, rootRelative, root }) => {
  const files = [...ownerByFile.entries()].filter(([, owner]) => owner === id).map(([file]) => relativeToKit(file)).sort();
  const dependencies = new Set();
  for (const [source, targets] of graph) {
    if (ownerByFile.get(source) !== id) continue;
    for (const target of targets) {
      const dependency = ownerByFile.get(target);
      if (dependency && dependency !== id) dependencies.add(dependency);
    }
  }
  return { id, root: rootRelative, files, dependencies: [...dependencies].sort() };
});

const report = stable({
  schemaVersion: 1,
  kitVersion: manifest.kitVersion,
  publicBarrel: config.publicBarrel,
  modules: moduleReport,
  componentOwnership: ownership,
});
const serialized = `${JSON.stringify(report, null, 2)}\n`;

if (errors.length === 0) {
  if (write) {
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, serialized);
  } else if (!fs.existsSync(reportPath) || fs.readFileSync(reportPath, "utf8") !== serialized) {
    errors.push("module ownership report is stale; run npm run modules:report");
  }
}

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log(`Module boundaries valid: ${moduleReport.length} modules, ${implementationFiles.length} source files, ${ownership.length} families.`);
