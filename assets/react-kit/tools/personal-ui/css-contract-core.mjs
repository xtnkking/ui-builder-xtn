import fs from "node:fs";
import path from "node:path";
import postcss from "postcss";
import selectorParser from "postcss-selector-parser";
import { selectorSpecificity } from "@csstools/selector-specificity";

const PUI_SELECTOR = /\.pui-[a-z0-9_-]+/i;
const TOKEN = /--(?:_?pui)-[a-z0-9-]+/gi;
const TOKEN_USE = /var\(\s*(--(?:_?pui)-[a-z0-9-]+)/gi;
const RAW_COLOR = /#[0-9a-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\s*\(/i;

const normalize = (value) => value.replaceAll(path.sep, "/");

function walk(directory, predicate) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute, predicate) : (predicate(absolute) ? [absolute] : []);
  });
}

function layerFor(node) {
  let current = node.parent;
  while (current) {
    if (current.type === "atrule" && current.name.toLowerCase() === "layer" && current.nodes) {
      return current.params.trim();
    }
    current = current.parent;
  }
  return null;
}

function importPath(params) {
  return params.match(/^\s*["']([^"']+\.css)["']/)?.[1] ?? null;
}

function leadingAnchors(selectorText, infrastructureAnchors) {
  const anchors = new Set();
  const infrastructure = new Set(infrastructureAnchors);
  const ast = selectorParser().astSync(selectorText);

  function collectCompound(nodes) {
    const found = new Set();
    for (const node of nodes) {
      if (node.type === "combinator") break;
      if (node.type === "class" && node.value.startsWith("pui-")) found.add(node.value);
      if (node.type === "pseudo" && [":is", ":where"].includes(node.value) && node.nodes) {
        for (const nestedSelector of node.nodes) {
          for (const nested of collectLeading(nestedSelector.nodes)) found.add(nested);
        }
      }
    }
    return found;
  }

  function collectLeading(nodes) {
    let compound = [];
    for (const node of nodes) {
      if (node.type !== "combinator") {
        compound.push(node);
        continue;
      }
      const found = [...collectCompound(compound)].filter((value) => !infrastructure.has(value));
      if (found.length > 0) return found;
      compound = [];
    }
    return [...collectCompound(compound)].filter((value) => !infrastructure.has(value));
  }

  for (const selector of ast.nodes) {
    for (const anchor of collectLeading(selector.nodes)) anchors.add(anchor);
  }
  return [...anchors].sort();
}

function publicThemeTokens(themeContractSource) {
  const block = themeContractSource.match(/PUBLIC_THEME_TOKEN_NAMES\s*=\s*\[([\s\S]*?)\]\s*as const/);
  if (!block) return [];
  return [...block[1].matchAll(/["'](--pui-[a-z0-9-]+)["']/gi)].map((match) => match[1]).sort();
}

function runtimeTokens(sourceTexts) {
  const values = new Set();
  for (const source of sourceTexts) {
    for (const match of source.matchAll(/["'](--(?:_?pui)-[a-z0-9-]+)["']/gi)) values.add(match[1]);
  }
  return values;
}

export function analyzeCssGraph({
  entryPath,
  sources,
  config,
  publicTokens,
  sourceRuntimeTokens = new Set(),
  relative = (value) => normalize(value),
}) {
  const errors = [];
  const parsed = new Map();
  const visited = new Set();
  const visiting = new Set();
  const importOrder = [];

  function parseFile(file) {
    if (parsed.has(file)) return parsed.get(file);
    const source = sources.get(file);
    if (source === undefined) throw new Error(`Missing CSS source ${file}`);
    const root = postcss.parse(source, { from: file });
    parsed.set(file, root);
    return root;
  }

  function visit(file) {
    if (visiting.has(file)) {
      errors.push(`CSS import cycle includes ${relative(file)}`);
      return;
    }
    if (visited.has(file)) return;
    visiting.add(file);
    const root = parseFile(file);
    root.nodes.filter((node) => node.type === "atrule" && node.name.toLowerCase() === "import").forEach((rule) => {
      const specifier = importPath(rule.params);
      if (!specifier) return;
      const target = path.resolve(path.dirname(file), specifier);
      if (!sources.has(target)) errors.push(`${relative(file)} imports missing CSS ${specifier}`);
      else visit(target);
    });
    visiting.delete(file);
    visited.add(file);
    importOrder.push(file);
  }

  visit(entryPath);
  const expectedFiles = new Set(config.canonicalFiles.map((file) => path.resolve(path.dirname(entryPath), path.relative(path.dirname(config.entry), file))));
  const actualFiles = new Set(visited);
  for (const file of expectedFiles) if (!actualFiles.has(file)) errors.push(`canonical CSS is not reachable from the entry: ${relative(file)}`);
  for (const file of actualFiles) if (!expectedFiles.has(file)) errors.push(`CSS entry imports unregistered canonical file: ${relative(file)}`);

  const entryRoot = parseFile(entryPath);
  const orderRules = entryRoot.nodes.filter((node) => node.type === "atrule" && node.name.toLowerCase() === "layer" && !node.nodes);
  const expectedLayerOrder = config.layerOrder.join(", ");
  if (orderRules.length !== 1 || orderRules[0].params.split(",").map((value) => value.trim()).join(", ") !== expectedLayerOrder) {
    errors.push(`${relative(entryPath)} must declare the exact layer order ${expectedLayerOrder}`);
  }

  const allowedLayers = new Set(config.layerOrder);
  const utilityAnchors = new Set(config.utilityAnchors);
  const ownerFiles = new Map();
  const tokenDeclarations = new Map();
  const tokenUses = new Set();
  const selectors = [];

  for (const [file, root] of parsed) {
    root.walkRules((rule) => {
      if (!PUI_SELECTOR.test(rule.selector)) return;
      const layer = layerFor(rule);
      if (!layer) errors.push(`${relative(file)}:${rule.source.start.line} has an unlayered Personal UI selector: ${rule.selector}`);
      else if (!allowedLayers.has(layer)) errors.push(`${relative(file)}:${rule.source.start.line} uses unknown layer ${layer}`);

      let selectorAst;
      try {
        selectorAst = selectorParser().astSync(rule.selector);
      } catch (error) {
        errors.push(`${relative(file)}:${rule.source.start.line} has an invalid selector: ${error.message}`);
        return;
      }
      for (const selector of selectorAst.nodes) {
        const specificity = selectorSpecificity(selector);
        if (specificity.a > 0 || specificity.b > config.maxClassSpecificity) {
          errors.push(`${relative(file)}:${rule.source.start.line} exceeds specificity 0,${config.maxClassSpecificity},*: ${rule.selector} (${specificity.a},${specificity.b},${specificity.c})`);
        }
      }

      const anchors = leadingAnchors(rule.selector, config.infrastructureAnchors);
      if (layer === "pui.utilities" && anchors.some((anchor) => !utilityAnchors.has(anchor))) {
        errors.push(`${relative(file)}:${rule.source.start.line} puts non-utility selector in pui.utilities: ${rule.selector}`);
      }
      if (layer === "pui.components") {
        for (const anchor of anchors) {
          const previous = ownerFiles.get(anchor);
          if (previous && previous !== file) errors.push(`selector owner .${anchor} is split between ${relative(previous)} and ${relative(file)}`);
          ownerFiles.set(anchor, file);
        }
      }
      selectors.push({ file: relative(file), layer, selector: rule.selector, anchors });
    });

    root.walkDecls((declaration) => {
      const layer = layerFor(declaration);
      if (RAW_COLOR.test(declaration.value) && layer !== "pui.tokens") {
        errors.push(`${relative(file)}:${declaration.source.start.line} contains a raw color outside pui.tokens`);
      }
      if (/^--(?:_?pui)-[a-z0-9-]+$/i.test(declaration.prop)) {
        const token = declaration.prop;
        const records = tokenDeclarations.get(token) ?? [];
        records.push({ file: relative(file), layer, line: declaration.source.start.line });
        tokenDeclarations.set(token, records);
      }
      for (const match of declaration.value.matchAll(TOKEN_USE)) tokenUses.add(match[1]);
    });
  }

  const publicTokenSet = new Set(publicTokens);
  for (const token of publicTokenSet) {
    const declarations = tokenDeclarations.get(token) ?? [];
    if (declarations.length === 0) errors.push(`public semantic token ${token} has no CSS declaration`);
    if (declarations.some(({ layer }) => layer !== "pui.tokens")) errors.push(`public semantic token ${token} must only be declared in pui.tokens`);
  }
  for (const token of tokenUses) {
    if (!publicTokenSet.has(token) && !tokenDeclarations.has(token) && !sourceRuntimeTokens.has(token)) {
      errors.push(`unregistered CSS token use ${token}`);
    }
  }

  const tokenRegistry = [...new Set([...tokenDeclarations.keys(), ...sourceRuntimeTokens])].sort().map((token) => {
    let kind = "internal-component";
    if (publicTokenSet.has(token)) kind = "public-semantic";
    else if (sourceRuntimeTokens.has(token) && !tokenDeclarations.has(token)) kind = "internal-runtime";
    else if (token.startsWith("--_pui-") && (tokenDeclarations.get(token) ?? []).some(({ layer }) => layer === "pui.tokens")) kind = "internal-theme";
    else if ((tokenDeclarations.get(token) ?? []).some(({ layer }) => layer === "pui.tokens")) kind = "internal-geometry";
    return { token, kind, declarations: tokenDeclarations.get(token) ?? [] };
  });

  return {
    errors: [...new Set(errors)].sort(),
    report: {
      schemaVersion: 1,
      layerOrder: config.layerOrder,
      files: [...actualFiles].map(relative).sort(),
      selectorOwners: [...ownerFiles.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([selector, file]) => ({ selector: `.${selector}`, file: relative(file) })),
      tokens: tokenRegistry,
      selectorCount: selectors.length,
    },
  };
}

export function analyzeCssContract(kitRoot) {
  const config = JSON.parse(fs.readFileSync(path.join(kitRoot, "css-contract.json"), "utf8"));
  const entryPath = path.resolve(kitRoot, config.entry);
  const sourceFiles = config.canonicalFiles.map((file) => path.resolve(kitRoot, file));
  const sources = new Map(sourceFiles.map((file) => [file, fs.readFileSync(file, "utf8")]));
  const themeContractPath = path.join(kitRoot, "src/personal-ui/internal/theme-contract.ts");
  const scriptSources = walk(path.join(kitRoot, "src/personal-ui"), (file) => /\.[cm]?[jt]sx?$/.test(file)).map((file) => fs.readFileSync(file, "utf8"));
  return analyzeCssGraph({
    entryPath,
    sources,
    config,
    publicTokens: publicThemeTokens(fs.readFileSync(themeContractPath, "utf8")),
    sourceRuntimeTokens: runtimeTokens(scriptSources),
    relative: (file) => normalize(path.relative(kitRoot, file)),
  });
}

export function checkBuiltCss(cssFile, layerOrder) {
  const errors = [];
  const root = postcss.parse(fs.readFileSync(cssFile, "utf8"), { from: cssFile });
  const expected = layerOrder.join(",");
  const declarations = root.nodes.filter((node) => node.type === "atrule" && node.name === "layer" && !node.nodes);
  if (!declarations.some((node) => node.params.replace(/\s+/g, "") === expected)) errors.push(`${cssFile} is missing the canonical layer order`);
  root.walkRules((rule) => {
    if (PUI_SELECTOR.test(rule.selector) && !layerFor(rule)) errors.push(`${cssFile}:${rule.source.start.line} contains an unlayered Personal UI selector`);
  });
  return errors;
}
