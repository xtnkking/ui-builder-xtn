#!/usr/bin/env node

import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import process from "node:process";

const SCRIPT_EXTENSIONS = new Set([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts", ".mdx"]);
const HTML_EXTENSIONS = new Set([".html", ".htm"]);
const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".cache",
  ".next",
  ".nuxt",
  ".output",
  ".turbo",
  ".vercel",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "out",
]);
const INTERACTIVE_ATTRIBUTES = new Set([
  "contenteditable",
  "onblur",
  "onchange",
  "oncontextmenu",
  "onclick",
  "ondoubleclick",
  "ondrag",
  "ondragend",
  "ondragover",
  "ondragstart",
  "ondrop",
  "onfocus",
  "oninput",
  "onkeydown",
  "onkeypress",
  "onkeyup",
  "onmousedown",
  "onmouseenter",
  "onmouseleave",
  "onmouseup",
  "onpointercancel",
  "onpointerdown",
  "onpointermove",
  "onpointerup",
  "onsubmit",
  "ontouchstart",
  "onwheel",
  "tabindex",
]);
const BUILTIN_EXTERNAL_JSX_PACKAGES = new Set(["react", "react-dom", "react/jsx-runtime"]);
const LEGACY_PUBLIC_ROOT_CLASSES = new Set(["pui-root"]);

function parseArguments(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith("--")) throw new Error(`unexpected argument: ${argument}`);
    const name = argument.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`missing value for --${name}`);
    result[name] = value;
    index += 1;
  }
  for (const required of ["target", "source-root", "manifest"]) {
    if (!result[required]) throw new Error(`missing required --${required}`);
  }
  return result;
}

function readObject(file, label) {
  const value = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must contain a JSON object: ${file}`);
  }
  return value;
}

function normalize(file) {
  return path.resolve(file).replaceAll("\\", "/").toLowerCase();
}

function isInside(file, parent) {
  const relative = path.relative(parent, file);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function packageRoot(specifier) {
  if (specifier.startsWith("@")) return specifier.split("/").slice(0, 2).join("/");
  return specifier.split("/")[0];
}

function pascalCase(value) {
  return value
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("");
}

function stripComments(source) {
  const output = source.split("");
  let quote = null;
  let escaped = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'" || character === "`") {
      quote = character;
      continue;
    }
    if (character === "/" && next === "/") {
      output[index] = " ";
      output[index + 1] = " ";
      index += 2;
      while (index < source.length && source[index] !== "\n") {
        output[index] = " ";
        index += 1;
      }
      index -= 1;
    } else if (character === "/" && next === "*") {
      output[index] = " ";
      output[index + 1] = " ";
      index += 2;
      while (index < source.length && !(source[index] === "*" && source[index + 1] === "/")) {
        if (source[index] !== "\n") output[index] = " ";
        index += 1;
      }
      if (index < source.length) {
        output[index] = " ";
        output[index + 1] = " ";
        index += 1;
      }
    }
  }
  return output.join("");
}

function codeOnly(source) {
  const output = source.split("");
  let state = "code";
  let escaped = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];
    if (state === "line-comment") {
      if (character === "\n") state = "code";
      else output[index] = " ";
      continue;
    }
    if (state === "block-comment") {
      if (character === "*" && next === "/") {
        output[index] = output[index + 1] = " ";
        index += 1;
        state = "code";
      } else if (character !== "\n") output[index] = " ";
      continue;
    }
    if (state !== "code") {
      if (character !== "\n") output[index] = " ";
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === state) state = "code";
      continue;
    }
    if (character === "/" && next === "/") {
      output[index] = output[index + 1] = " ";
      index += 1;
      state = "line-comment";
    } else if (character === "/" && next === "*") {
      output[index] = output[index + 1] = " ";
      index += 1;
      state = "block-comment";
    } else if (character === '"' || character === "'" || character === "`") {
      output[index] = " ";
      state = character;
    }
  }
  return output.join("");
}

function lineNumber(source, offset) {
  let line = 1;
  for (let index = 0; index < offset; index += 1) if (source[index] === "\n") line += 1;
  return line;
}

function findOpeningTagEnd(source, start) {
  let quote = null;
  let escaped = false;
  let braceDepth = 0;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'" || character === "`") quote = character;
    else if (character === "{") braceDepth += 1;
    else if (character === "}") braceDepth = Math.max(0, braceDepth - 1);
    else if (character === ">" && braceDepth === 0) return index;
  }
  return source.length - 1;
}

function jsxAttributeNames(openingTag) {
  const names = new Set();
  const syntaxOnly = codeOnly(openingTag);
  const pattern = /(?:\s|^)\b([A-Za-z_:][\w:.-]*)\s*(?==|\s|\/?>)/g;
  for (const match of syntaxOnly.matchAll(pattern)) names.add(match[1].toLowerCase());
  return names;
}

function literalAttribute(openingTag, attribute) {
  const escaped = attribute.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = openingTag.match(
    new RegExp(`\\b${escaped}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|\\{\\s*["']([^"']*)["']\\s*\\}|([^\\s>]+))`, "i"),
  );
  return match ? (match[1] ?? match[2] ?? match[3] ?? match[4] ?? "") : null;
}

function importRecords(source) {
  const records = [];
  const clean = stripComments(source);
  const pattern = /(?:^|[;\n])\s*import\s+(?!type\b)([\s\S]*?)\s+from\s+["']([^"']+)["']/gm;
  for (const match of clean.matchAll(pattern)) {
    records.push({ clause: match[1].trim(), specifier: match[2], offset: match.index ?? 0 });
  }
  return records;
}

function reexportRecords(source) {
  const records = [];
  const clean = stripComments(source);
  const pattern = /(?:^|[;\n])\s*export\s+(?!type\b)(?:\*|\{[\s\S]*?\})\s+from\s+["']([^"']+)["']/gm;
  for (const match of clean.matchAll(pattern)) {
    records.push({ specifier: match[1], offset: match.index ?? 0 });
  }
  return records;
}

function namedImports(clause) {
  const result = [];
  const match = clause.match(/\{([\s\S]*?)\}/);
  if (!match) return result;
  for (const raw of match[1].split(",")) {
    const item = raw.trim();
    if (!item || item.startsWith("type ")) continue;
    const parts = item.split(/\s+as\s+/);
    result.push({ imported: parts[0].trim(), local: parts.at(-1).trim() });
  }
  return result;
}

function namespaceImport(clause) {
  return clause.match(/\*\s+as\s+([A-Za-z_$][\w$]*)/)?.[1] ?? null;
}

function defaultImport(clause) {
  const beforeNamed = clause.split(/[,{*]/, 1)[0].trim();
  return /^[A-Za-z_$][\w$]*$/.test(beforeNamed) ? beforeNamed : null;
}

function classifyPersonalUiImport(importer, specifier, managedRoot) {
  const normalizedSpecifier = specifier.replaceAll("\\", "/").replace(/\.(?:[cm]?[jt]sx?)$/, "");
  if (normalizedSpecifier.endsWith("/styles.css") || normalizedSpecifier === "personal-ui/styles.css") {
    return "style";
  }
  if (specifier.startsWith(".")) {
    const resolved = normalize(path.resolve(path.dirname(importer), specifier));
    const root = normalize(managedRoot);
    if (resolved === root || resolved === `${root}/index`) return "barrel";
    if (resolved.startsWith(`${root}/`)) return "deep";
    return "other";
  }
  if (normalizedSpecifier === "personal-ui" || normalizedSpecifier.endsWith("/personal-ui")) return "barrel";
  if (normalizedSpecifier.startsWith("personal-ui/") || normalizedSpecifier.includes("/personal-ui/")) return "deep";
  return "other";
}

function walkFiles(root, output) {
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) return;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) continue;
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) walkFiles(absolute, output);
    else if (entry.isFile()) {
      const extension = path.extname(entry.name).toLowerCase();
      if (SCRIPT_EXTENSIONS.has(extension) || HTML_EXTENSIONS.has(extension)) {
        output.add(path.resolve(absolute));
      }
    }
  }
}

function verifyManagedSource(target, managedRoot, integrityValue) {
  const issues = [];
  const actual = new Map();
  const expected = new Map();
  const relativeFile = (relative) => path.relative(target, path.join(managedRoot, relative)).replaceAll("\\", "/");
  const addIssue = (code, relative, message) => {
    issues.push({ code, file: relativeFile(relative), line: 1, message });
  };

  if (!integrityValue || typeof integrityValue !== "object" || Array.isArray(integrityValue)) {
    addIssue("PUI_INVALID_MANIFEST", "", "component manifest has no valid sourceIntegrity map");
  } else {
    for (const [relative, digest] of Object.entries(integrityValue)) {
      const normalized = path.posix.normalize(relative);
      if (
        !relative
        || relative.includes("\\")
        || normalized !== relative
        || normalized === ".."
        || normalized.startsWith("../")
        || path.posix.isAbsolute(relative)
        || typeof digest !== "string"
        || !/^[0-9a-f]{64}$/.test(digest)
      ) {
        addIssue("PUI_INVALID_MANIFEST", relative, `invalid sourceIntegrity entry ${JSON.stringify(relative)}`);
      } else expected.set(relative, digest);
    }
  }

  const walk = (directory, prefix = "") => {
    let entries;
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch (error) {
      addIssue("PUI_MANAGED_MISSING", prefix, `cannot read managed source directory: ${error.message}`);
      return;
    }
    for (const entry of entries) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (relative === "registry.json") continue;
      const absolute = path.join(directory, entry.name);
      let stats;
      try {
        stats = fs.lstatSync(absolute);
      } catch (error) {
        addIssue("PUI_MANAGED_MISSING", relative, `cannot inspect managed source path: ${error.message}`);
        continue;
      }
      if (stats.isSymbolicLink()) {
        addIssue("PUI_MANAGED_LINK", relative, "managed Personal UI source must not contain symbolic links or junctions");
      } else if (stats.isDirectory()) walk(absolute, relative);
      else if (stats.isFile()) actual.set(relative, absolute);
      else addIssue("PUI_MANAGED_EXTRA", relative, "managed Personal UI source contains an unsupported filesystem entry");
    }
  };

  try {
    const rootStats = fs.lstatSync(managedRoot);
    if (rootStats.isSymbolicLink() || !rootStats.isDirectory()) {
      addIssue("PUI_MANAGED_LINK", "", "managed Personal UI source root must be a real directory");
    } else walk(managedRoot);
  } catch (error) {
    addIssue("PUI_MANAGED_MISSING", "", `managed Personal UI source root is missing: ${error.message}`);
  }

  for (const relative of expected.keys()) {
    if (!actual.has(relative)) {
      addIssue("PUI_MANAGED_MISSING", relative, "managed Personal UI source file is missing");
    }
  }
  for (const [relative, absolute] of actual) {
    if (!expected.has(relative)) {
      addIssue("PUI_MANAGED_EXTRA", relative, "unregistered file exists inside managed Personal UI source");
      continue;
    }
    const digest = crypto.createHash("sha256").update(fs.readFileSync(absolute)).digest("hex");
    if (digest !== expected.get(relative)) {
      addIssue("PUI_MANAGED_CHANGED", relative, "managed Personal UI source differs from its canonical SHA-256");
    }
  }
  return {
    valid: issues.length === 0,
    expectedFiles: expected.size,
    actualFiles: actual.size,
    issues,
  };
}

function propagateAliases(code, aliases) {
  let changed = true;
  while (changed) {
    changed = false;
    const assignment = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([A-Za-z_$][\w$]*)\b/g;
    for (const match of code.matchAll(assignment)) {
      if (!aliases.has(match[1]) && aliases.has(match[2])) {
        aliases.set(match[1], aliases.get(match[2]));
        changed = true;
      }
    }
  }
}

function stringTagAliases(source, forbiddenTags) {
  const aliases = new Map();
  const clean = stripComments(source);
  const literal = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(["'`])([a-z][\w-]*)\2/g;
  for (const match of clean.matchAll(literal)) {
    const tag = match[3].toLowerCase();
    if (forbiddenTags.has(tag)) aliases.set(match[1], tag);
  }
  const computed = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([^;\n]{1,400})/g;
  for (const match of clean.matchAll(computed)) {
    for (const tag of forbiddenTags) {
      const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (new RegExp(`[\"'\u0060]${escaped}[\"'\u0060]`, "i").test(match[2])) {
        aliases.set(match[1], tag);
        break;
      }
    }
  }
  const arrayDestructure = /\b(?:const|let|var)\s*\[\s*([A-Za-z_$][\w$]*)[^\]]*\]\s*=\s*\[\s*(["'`])([a-z][\w-]*)\2/g;
  for (const match of clean.matchAll(arrayDestructure)) {
    const tag = match[3].toLowerCase();
    if (forbiddenTags.has(tag)) aliases.set(match[1], tag);
  }
  propagateAliases(codeOnly(source), aliases);
  return aliases;
}

function recordExternalLoaderAliases(source, externalAliases) {
  const clean = stripComments(source);
  const patterns = [
    /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?import\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*require\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of clean.matchAll(pattern)) {
      if (!match[2].startsWith(".") && !match[2].startsWith("/")) {
        externalAliases.set(match[1], packageRoot(match[2]));
      }
    }
  }
  const destructured = /\b(?:const|let|var)\s*\{([\s\S]*?)\}\s*=\s*(?:await\s+)?(?:import|require)\s*\(\s*["']([^"']+)["']\s*\)/g;
  for (const match of clean.matchAll(destructured)) {
    if (match[2].startsWith(".") || match[2].startsWith("/")) continue;
    const packageName = packageRoot(match[2]);
    for (const raw of match[1].split(",")) {
      const local = raw.trim().split(/\s*:\s*|\s+as\s+/).at(-1)?.trim();
      if (/^[A-Za-z_$][\w$]*$/.test(local ?? "")) externalAliases.set(local, packageName);
    }
  }
  const lazy = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:React\s*\.\s*)?lazy\s*\([\s\S]{0,500}?\bimport\s*\(\s*["']([^"']+)["']/g;
  for (const match of clean.matchAll(lazy)) {
    if (!match[2].startsWith(".") && !match[2].startsWith("/")) {
      externalAliases.set(match[1], packageRoot(match[2]));
    }
  }
}

function propagateExternalAliases(code, externalAliases) {
  propagateAliases(code, externalAliases);
  let changed = true;
  while (changed) {
    changed = false;
    const memberAssignment = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([A-Za-z_$][\w$]*)\s*\.\s*[A-Za-z_$][\w$]*/g;
    for (const match of code.matchAll(memberAssignment)) {
      if (!externalAliases.has(match[1]) && externalAliases.has(match[2])) {
        externalAliases.set(match[1], externalAliases.get(match[2]));
        changed = true;
      }
    }
    const destructured = /\b(?:const|let|var)\s*\{([\s\S]*?)\}\s*=\s*([A-Za-z_$][\w$]*)\b/g;
    for (const match of code.matchAll(destructured)) {
      if (!externalAliases.has(match[2])) continue;
      for (const raw of match[1].split(",")) {
        const local = raw.trim().split(/\s*:\s*/).at(-1)?.trim();
        if (/^[A-Za-z_$][\w$]*$/.test(local ?? "") && !externalAliases.has(local)) {
          externalAliases.set(local, externalAliases.get(match[2]));
          changed = true;
        }
      }
    }
    const containers = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*|\[[^\]]+\]|\{[^}]+\})\s*=\s*([^;\n]{1,500})/g;
    for (const match of code.matchAll(containers)) {
      const sourceAlias = [...externalAliases].find(([alias]) =>
        new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(match[2]),
      );
      if (!sourceAlias) continue;
      const names = match[1].match(/[A-Za-z_$][\w$]*/g) ?? [];
      for (const name of names) {
        if (!externalAliases.has(name)) {
          externalAliases.set(name, sourceAlias[1]);
          changed = true;
        }
      }
    }
  }
}

function localComponentDeclarations(code) {
  const names = new Set();
  const patterns = [
    /\b(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g,
    /\b(?:export\s+)?class\s+([A-Za-z_$][\w$]*)\b/g,
    /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\b|\([^;\n]*?\)\s*=>|[A-Za-z_$][\w$]*\s*=>|(?:React\s*\.\s*)?(?:memo|forwardRef)\s*\()/g,
  ];
  for (const pattern of patterns) {
    for (const match of code.matchAll(pattern)) names.add(match[1]);
  }
  return names;
}

function propagateFactoryAliases(code, factories) {
  let changed = true;
  while (changed) {
    changed = false;
    const assignment = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([A-Za-z_$][\w$]*)\b/g;
    for (const match of code.matchAll(assignment)) {
      if (!factories.has(match[1]) && factories.has(match[2])) {
        factories.add(match[1]);
        changed = true;
      }
    }
  }
}

function looksLikeUiRuntime(name, packageName) {
  return /(?:ui|mui|material|antd|chakra|mantine|radix|headless|bootstrap|semantic|fluent|carbon|prime|nextui|heroui|shadcn)/i.test(packageName)
    || /(?:render|create|make|mount|show|open).*(?:button|input|select|menu|dialog|toast|table|form|card|badge|tag|tab|drawer|alert|widget|control)/i.test(name)
    || /^[A-Z]/.test(name);
}

function scanScript(file, source, context) {
  const issues = [];
  const issueKeys = new Set();
  const used = new Set();
  const publicAliases = new Map();
  const publicNamespaces = new Set();
  const localAliases = new Set();
  const localNamespaces = new Set();
  const externalAliases = new Map();
  const runtimeFactories = new Set();
  const runtimeNamespaces = new Set();
  const elementFactories = new Set();

  const addIssue = (code, message, offset = 0) => {
    const key = `${code}:${offset}:${message}`;
    if (issueKeys.has(key)) return;
    issueKeys.add(key);
    issues.push({ code, file: path.relative(context.target, file).replaceAll("\\", "/"), line: lineNumber(source, offset), message });
  };

  const commentFreeSource = stripComments(source);
  for (const match of commentFreeSource.matchAll(/\bdata-pui[\w-]*/gi)) {
    addIssue("PUI_RESERVED_MARKER", `${match[0]} is reserved for bundled Personal UI source`, match.index ?? 0);
  }
  for (const match of commentFreeSource.matchAll(/\bpui-[\w-]+/g)) {
    if (!LEGACY_PUBLIC_ROOT_CLASSES.has(match[0])) {
      addIssue("PUI_PRIVATE_CLASS", `Personal UI internal class token is forbidden: ${match[0]}`, match.index ?? 0);
    }
  }

  for (const record of importRecords(source)) {
    const classification = classifyPersonalUiImport(file, record.specifier, context.managedRoot);
    if (classification === "deep") {
      addIssue("PUI_DEEP_IMPORT", `Personal UI must be imported through its public barrel, not ${JSON.stringify(record.specifier)}`, record.offset);
      continue;
    }
    if (classification === "barrel") {
      const defaultName = defaultImport(record.clause);
      if (defaultName) addIssue("PUI_DEFAULT_IMPORT", "Personal UI has no supported default runtime export", record.offset);
      for (const item of namedImports(record.clause)) {
        if (!context.publicExports.has(item.imported)) {
          addIssue("PUI_PRIVATE_EXPORT", `${item.imported} is not a bundled public runtime export`, record.offset);
        } else publicAliases.set(item.local, item.imported);
      }
      const namespace = namespaceImport(record.clause);
      if (namespace) publicNamespaces.add(namespace);
      continue;
    }
    if (classification === "style") continue;
    if (record.specifier.startsWith(".") || record.specifier.startsWith("/")) {
      for (const item of namedImports(record.clause)) localAliases.add(item.local);
      const localDefault = defaultImport(record.clause);
      if (localDefault) localAliases.add(localDefault);
      const localNamespace = namespaceImport(record.clause);
      if (localNamespace) localNamespaces.add(localNamespace);
      continue;
    }
    const packageName = packageRoot(record.specifier);
    if (packageName === "react") {
      for (const item of namedImports(record.clause)) {
        if (item.imported === "createElement") elementFactories.add(item.local);
      }
    }
    if (record.specifier === "react/jsx-runtime" || record.specifier === "react/jsx-dev-runtime") {
      for (const item of namedImports(record.clause)) {
        if (["jsx", "jsxs", "jsxDEV"].includes(item.imported)) runtimeFactories.add(item.local);
      }
      const namespace = namespaceImport(record.clause);
      if (namespace) runtimeNamespaces.add(namespace);
    }
    for (const item of namedImports(record.clause)) externalAliases.set(item.local, packageName);
    const defaultName = defaultImport(record.clause);
    if (defaultName) externalAliases.set(defaultName, packageName);
    const namespace = namespaceImport(record.clause);
    if (namespace) externalAliases.set(namespace, packageName);
  }

  for (const record of reexportRecords(source)) {
    const classification = classifyPersonalUiImport(file, record.specifier, context.managedRoot);
    if (classification === "barrel" || classification === "deep") {
      addIssue("PUI_COMPONENT_REEXPORT", "Personal UI runtime exports must be consumed directly from the public barrel, not re-exported", record.offset);
    } else if (
      classification === "other"
      && !record.specifier.startsWith(".")
      && !record.specifier.startsWith("/")
      && !context.allowedExternalPackages.has(packageRoot(record.specifier))
    ) {
      addIssue("PUI_EXTERNAL_REEXPORT", `external package ${JSON.stringify(packageRoot(record.specifier))} cannot be re-exported into application JSX`, record.offset);
    }
  }

  const loaders = /\b(import|require)\s*\(\s*([^)]{0,500})\)/g;
  for (const match of commentFreeSource.matchAll(loaders)) {
    const argument = match[2].trim();
    const literal = argument.match(/^(["'])([^"']+)\1$/);
    if (!literal) {
      addIssue("PUI_UNINSPECTABLE_IMPORT", `computed ${match[1]} specifier cannot prove that Personal UI is consumed through its public barrel`, match.index ?? 0);
      continue;
    }
    const classification = classifyPersonalUiImport(file, literal[2], context.managedRoot);
    if (classification === "deep") {
      addIssue("PUI_DEEP_IMPORT", `Personal UI must be imported through its public barrel, not ${JSON.stringify(literal[2])}`, match.index ?? 0);
    } else if (classification === "barrel") {
      addIssue("PUI_UNSUPPORTED_IMPORT", `Personal UI public exports require a static ESM import, not ${match[1]}()`, match.index ?? 0);
    }
  }

  recordExternalLoaderAliases(source, externalAliases);
  const requiredRuntime = /\b(?:const|let|var)\s+(\{[\s\S]*?\}|[A-Za-z_$][\w$]*)\s*=\s*require\s*\(\s*["']react\/jsx(?:-dev)?-runtime["']\s*\)/g;
  for (const match of commentFreeSource.matchAll(requiredRuntime)) {
    if (match[1].startsWith("{")) {
      for (const raw of match[1].slice(1, -1).split(",")) {
        const parts = raw.trim().split(/\s*:\s*/);
        if (["jsx", "jsxs", "jsxDEV"].includes(parts[0])) {
          runtimeFactories.add(parts.at(-1));
        }
      }
    } else runtimeNamespaces.add(match[1]);
  }
  const requiredCreateElement = /\b(?:const|let|var)\s*\{([\s\S]*?)\}\s*=\s*require\s*\(\s*["']react["']\s*\)/g;
  for (const match of commentFreeSource.matchAll(requiredCreateElement)) {
    for (const raw of match[1].split(",")) {
      const parts = raw.trim().split(/\s*:\s*/);
      if (parts[0] === "createElement") elementFactories.add(parts.at(-1));
    }
  }
  const code = codeOnly(source);
  propagateAliases(code, publicAliases);
  propagateExternalAliases(code, externalAliases);
  for (const match of code.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*React\s*\.\s*createElement\b/g)) {
    elementFactories.add(match[1]);
  }
  for (const match of commentFreeSource.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*React\s*\[\s*["']createElement["']\s*\]/g)) {
    elementFactories.add(match[1]);
  }
  for (const match of code.matchAll(/\b(?:const|let|var)\s*\{([\s\S]*?)\}\s*=\s*React\b/g)) {
    for (const raw of match[1].split(",")) {
      const parts = raw.trim().split(/\s*:\s*/);
      if (parts[0] === "createElement") elementFactories.add(parts.at(-1));
    }
  }
  propagateFactoryAliases(code, runtimeFactories);
  propagateFactoryAliases(code, elementFactories);
  const intrinsicAliases = stringTagAliases(source, context.forbiddenTags);
  const localComponents = localComponentDeclarations(code);

  for (const name of localComponents) {
    if (!/^[A-Z]/.test(name)) continue;
    const collision = [...context.reservedComponentNames]
      .filter((reserved) => reserved.length >= 3 && name.endsWith(reserved))
      .sort((left, right) => right.length - left.length)[0];
    if (collision) {
      const match = new RegExp(`\\b(?:function|class|const|let|var)\\s+${name}\\b`).exec(code);
      addIssue("PUI_COMPONENT_SHADOW", `local component ${name} conflicts with registered Personal UI family name ${collision}`, match?.index ?? 0);
    }
  }

  const commonJsReexport = /\b(?:module\s*\.\s*exports|exports\s*\.\s*[A-Za-z_$][\w$]*)\s*=\s*require\s*\(\s*["']([^"']+)["']/g;
  for (const match of commentFreeSource.matchAll(commonJsReexport)) {
    const classification = classifyPersonalUiImport(file, match[1], context.managedRoot);
    if (classification === "barrel" || classification === "deep") {
      addIssue("PUI_COMPONENT_REEXPORT", "Personal UI runtime exports must not be hidden behind a CommonJS shim", match.index ?? 0);
    } else if (
      classification === "other"
      && !match[1].startsWith(".")
      && !match[1].startsWith("/")
      && !context.allowedExternalPackages.has(packageRoot(match[1]))
    ) {
      addIssue("PUI_EXTERNAL_REEXPORT", `external package ${JSON.stringify(packageRoot(match[1]))} cannot be exposed through a CommonJS shim`, match.index ?? 0);
    }
  }

  for (const [local] of publicAliases) {
    const escaped = local.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const named = new RegExp(`\\bexport\\s*\\{[^}]*\\b${escaped}\\b[^}]*\\}`, "m");
    const declared = new RegExp(`\\bexport\\s+(?:default\\s+)?(?:const|let|var)\\s+${escaped}\\b|\\bexport\\s+default\\s+${escaped}\\b`);
    if (named.test(code) || declared.test(code)) {
      addIssue("PUI_COMPONENT_REEXPORT", `${local} aliases a Personal UI export and must not be re-exported`, code.search(named.test(code) ? named : declared));
    }
  }

  const reportExternal = (packageName, offset, syntax) => {
    if (!context.allowedExternalPackages.has(packageName)) {
      addIssue("PUI_EXTERNAL_JSX", `${syntax} from external package ${JSON.stringify(packageName)} is forbidden; use Personal UI`, offset);
    }
  };

  const processElementReference = (reference, offset, syntax, failUnknown = false) => {
    const compact = reference.replaceAll(/\s+/g, "");
    const literal = compact.match(/^["'`]([a-z][\w-]*)["'`]$/);
    if (literal) {
      const tag = literal[1].toLowerCase();
      if (context.forbiddenTags.has(tag) || tag.includes("-")) {
        addIssue("PUI_RAW_CONTROL", `${syntax}(${JSON.stringify(tag)}) is forbidden; use Personal UI`, offset);
      }
      return;
    }
    const [base, member] = compact.split(".");
    if (intrinsicAliases.has(base)) {
      addIssue("PUI_RAW_CONTROL", `${syntax}(${base}) resolves to raw ${JSON.stringify(intrinsicAliases.get(base))}`, offset);
    } else if (publicAliases.has(base) && !member) {
      used.add(publicAliases.get(base));
    } else if (publicNamespaces.has(base) && member) {
      if (context.publicExports.has(member)) used.add(member);
      else addIssue("PUI_PRIVATE_EXPORT", `${member} is not a bundled public runtime export`, offset);
    } else if (externalAliases.has(base)) {
      reportExternal(externalAliases.get(base), offset, syntax);
    } else if (!member && (localComponents.has(base) || localAliases.has(base))) {
      return;
    } else if (member && localNamespaces.has(base)) {
      return;
    } else if (failUnknown) {
      addIssue("PUI_UNINSPECTABLE_ELEMENT", `${syntax}(${compact}) cannot prove component ownership`, offset);
    }
  };

  const openingPattern = /(?<![\w$])<\s*([A-Za-z][\w.-]*(?:\s*\.\s*[A-Za-z_$][\w$]*)?)(?=[\s/>])/g;
  for (const match of code.matchAll(openingPattern)) {
    const offset = match.index ?? 0;
    const rawTag = match[1].replaceAll(/\s+/g, "");
    const end = findOpeningTagEnd(source, offset);
    const openingTag = source.slice(offset, end + 1);
    const componentProp = /\b([A-Za-z_$][\w$]*)\s*=\s*\{\s*([A-Za-z_$][\w$]*(?:\s*\.\s*[A-Za-z_$][\w$]*)?)\s*\}/g;
    for (const attribute of openingTag.matchAll(componentProp)) {
      const propName = attribute[1];
      const reference = attribute[2].replaceAll(/\s+/g, "");
      const [base, member] = reference.split(".");
      if (externalAliases.has(base)) {
        reportExternal(externalAliases.get(base), offset + (attribute.index ?? 0), `JSX prop ${propName}`);
        continue;
      }
      const componentLikeProp = /^(?:as|component|control|element|icon|render|slot|trigger)/i.test(propName)
        || /^[A-Z]/.test(propName);
      const proven = publicAliases.has(base)
        || (publicNamespaces.has(base) && Boolean(member))
        || localComponents.has(base)
        || localAliases.has(base)
        || (localNamespaces.has(base) && Boolean(member));
      if (componentLikeProp && /^[A-Z]/.test(base) && !proven) {
        addIssue("PUI_UNINSPECTABLE_ELEMENT", `JSX prop ${propName} receives ${reference}, whose component ownership cannot be proven`, offset + (attribute.index ?? 0));
      }
    }
    if (!rawTag.includes(".") && /^[a-z]/.test(rawTag)) {
      const tag = rawTag.toLowerCase();
      const attributes = jsxAttributeNames(openingTag);
      if (tag.includes("-") || context.forbiddenTags.has(tag)) {
        addIssue("PUI_RAW_CONTROL", `raw <${tag}> is forbidden; use a bundled Personal UI public export`, offset);
      }
      if (/\{\s*\.\.\./.test(openingTag)) {
        addIssue("PUI_UNINSPECTABLE_PROPS", `spread props on raw <${tag}> cannot prove that role and interaction stay component-owned`, offset);
      }
      const role = literalAttribute(openingTag, "role");
      if (attributes.has("role") && role === null) {
        addIssue("PUI_DYNAMIC_ROLE", `dynamic role on <${tag}> cannot prove Personal UI ownership`, offset);
      } else if (role && context.forbiddenRoles.has(role.toLowerCase())) {
        addIssue("PUI_INTERACTIVE_ROLE", `role=${JSON.stringify(role)} on raw <${tag}> is forbidden`, offset);
      }
      for (const attribute of attributes) {
        if (INTERACTIVE_ATTRIBUTES.has(attribute) && !context.forbiddenTags.has(tag)) {
          addIssue("PUI_RAW_INTERACTION", `${attribute} on raw <${tag}> must be owned by a bundled component`, offset);
        }
      }
      continue;
    }
    processElementReference(rawTag, offset, "JSX", true);
  }

  for (const [local, exported] of publicAliases) {
    const escaped = local.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${escaped}\\s*\\(`).test(code)) used.add(exported);
  }
  for (const namespace of publicNamespaces) {
    const escaped = namespace.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`\\b${escaped}\\s*\\.\\s*([A-Za-z_$][\\w$]*)\\s*\\(`, "g");
    for (const match of code.matchAll(pattern)) {
      if (context.publicExports.has(match[1])) used.add(match[1]);
      else addIssue("PUI_PRIVATE_EXPORT", `${match[1]} is not a bundled public runtime export`, match.index ?? 0);
    }
  }

  const factoryIdentifier = /(?:\bReact\s*\.\s*)?\bcreateElement\s*\(\s*([A-Za-z_$][\w$]*(?:\s*\.\s*[A-Za-z_$][\w$]*)?)/g;
  for (const match of code.matchAll(factoryIdentifier)) {
    const prefix = code.slice(Math.max(0, (match.index ?? 0) - 12), match.index ?? 0);
    if (/document\s*\.\s*$/.test(prefix)) continue;
    processElementReference(match[1], match.index ?? 0, "createElement", true);
  }
  const factoryLiteral = /(?:\bReact\s*\.\s*)?\bcreateElement\s*\(\s*(["'`][a-z][\w-]*["'`])/g;
  for (const match of commentFreeSource.matchAll(factoryLiteral)) {
    processElementReference(match[1], match.index ?? 0, "createElement", true);
  }
  const documentFactory = /\bdocument\s*\.\s*createElement\s*\(\s*(["'`][a-z][\w-]*["'`]|[A-Za-z_$][\w$]*)/g;
  for (const match of commentFreeSource.matchAll(documentFactory)) {
    processElementReference(match[1], match.index ?? 0, "document.createElement", true);
  }

  const bracketFactory = /\bReact\s*\[\s*["']createElement["']\s*\]\s*\(\s*([A-Za-z_$][\w$]*(?:\s*\.\s*[A-Za-z_$][\w$]*)?|["'`][a-z][\w-]*["'`])/g;
  for (const match of commentFreeSource.matchAll(bracketFactory)) {
    processElementReference(match[1], match.index ?? 0, "React[createElement]", true);
  }
  for (const factory of elementFactories) {
    const escaped = factory.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const identifier = new RegExp(`\\b${escaped}\\s*\\(\\s*([A-Za-z_$][\\w$]*(?:\\s*\\.\\s*[A-Za-z_$][\\w$]*)?)`, "g");
    const literal = new RegExp(`\\b${escaped}\\s*\\(\\s*([\"'\u0060][a-z][\\w-]*[\"'\u0060])`, "g");
    for (const match of code.matchAll(identifier)) processElementReference(match[1], match.index ?? 0, factory, true);
    for (const match of commentFreeSource.matchAll(literal)) processElementReference(match[1], match.index ?? 0, factory, true);
  }

  for (const factory of runtimeFactories) {
    const escaped = factory.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const identifier = new RegExp(`\\b${escaped}\\s*\\(\\s*([A-Za-z_$][\\w$]*(?:\\s*\\.\\s*[A-Za-z_$][\\w$]*)?)`, "g");
    const literal = new RegExp(`\\b${escaped}\\s*\\(\\s*([\"'\u0060][a-z][\\w-]*[\"'\u0060])`, "g");
    for (const match of code.matchAll(identifier)) processElementReference(match[1], match.index ?? 0, factory, true);
    for (const match of commentFreeSource.matchAll(literal)) processElementReference(match[1], match.index ?? 0, factory, true);
  }
  for (const namespace of runtimeNamespaces) {
    const escaped = namespace.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`\\b${escaped}\\s*\\.\\s*(?:jsx|jsxs|jsxDEV)\\s*\\(\\s*([A-Za-z_$][\\w$]*|[\"'\u0060][a-z][\\w-]*[\"'\u0060])`, "g");
    for (const match of commentFreeSource.matchAll(pattern)) processElementReference(match[1], match.index ?? 0, `${namespace}.jsx`, true);
  }

  for (const [local, packageName] of externalAliases) {
    if (context.allowedExternalPackages.has(packageName) || !looksLikeUiRuntime(local, packageName)) continue;
    const escaped = local.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const call = new RegExp(`\\b${escaped}\\s*(?:\\.\\s*[A-Za-z_$][\\w$]*\\s*)?\\(`, "g");
    for (const match of code.matchAll(call)) {
      reportExternal(packageName, match.index ?? 0, `runtime UI call ${local}`);
    }
  }
  const commonJsAliasExport = /\b(?:module\s*\.\s*exports|exports\s*\.\s*[A-Za-z_$][\w$]*)\s*=\s*([A-Za-z_$][\w$]*)/g;
  for (const match of code.matchAll(commonJsAliasExport)) {
    if (externalAliases.has(match[1])) {
      reportExternal(externalAliases.get(match[1]), match.index ?? 0, "CommonJS export");
    }
  }

  const unsafeMarkup = [
    /\bdangerouslySetInnerHTML\b/g,
    /(?:\.|\[\s*["'])innerHTML(?:["']\s*\])?/g,
    /(?:\.|\[\s*["'])outerHTML(?:["']\s*\])?/g,
    /\binsertAdjacentHTML\s*\(/g,
    /\bcreateContextualFragment\s*\(/g,
    /\bnew\s+DOMParser\s*\(/g,
    /\bdocument\s*\.\s*(?:write|writeln)\s*\(/g,
  ];
  for (const pattern of unsafeMarkup) {
    for (const match of code.matchAll(pattern)) {
      addIssue("PUI_UNINSPECTABLE_MARKUP", `${match[0]} can bypass component provenance and is forbidden`, match.index ?? 0);
    }
  }
  const listener = /\baddEventListener\s*\(\s*["'](?:click|dblclick|keydown|keypress|keyup|pointerdown|pointerup|submit|change|input)["']/g;
  for (const match of commentFreeSource.matchAll(listener)) {
    addIssue("PUI_RAW_INTERACTION", `${match[0]} bypasses component-owned interaction`, match.index ?? 0);
  }
  const domProperty = /(?:\.|\[\s*["'])(contenteditable|tabindex|on(?:blur|change|click|contextmenu|dblclick|drag|dragend|dragover|dragstart|drop|focus|input|keydown|keypress|keyup|mousedown|mouseenter|mouseleave|mouseup|pointercancel|pointerdown|pointermove|pointerup|submit|touchstart|wheel))(?:["']\s*\])?\s*=/gi;
  for (const match of commentFreeSource.matchAll(domProperty)) {
    addIssue("PUI_RAW_INTERACTION", `DOM property ${match[1]} bypasses component-owned interaction`, match.index ?? 0);
  }
  const setAttribute = /\bsetAttribute\s*\(\s*["']([^"']+)["']\s*,\s*([^,)]+)/gi;
  for (const match of commentFreeSource.matchAll(setAttribute)) {
    const attribute = match[1].toLowerCase();
    const rawValue = match[2].trim();
    const literal = rawValue.match(/^(["'])([^"']*)\1$/)?.[2] ?? null;
    if (attribute === "role") {
      if (literal === null) {
        addIssue("PUI_DYNAMIC_ROLE", "dynamic DOM role cannot prove Personal UI ownership", match.index ?? 0);
      } else if (context.forbiddenRoles.has(literal.toLowerCase())) {
        addIssue("PUI_INTERACTIVE_ROLE", `setAttribute role=${JSON.stringify(literal)} on raw DOM is forbidden`, match.index ?? 0);
      }
    } else if (INTERACTIVE_ATTRIBUTES.has(attribute)) {
      addIssue("PUI_RAW_INTERACTION", `setAttribute(${JSON.stringify(attribute)}) bypasses component-owned interaction`, match.index ?? 0);
    }
  }
  const dynamicSetAttribute = /\bsetAttribute\s*\(\s*(?!["'])/g;
  for (const match of commentFreeSource.matchAll(dynamicSetAttribute)) {
    addIssue("PUI_UNINSPECTABLE_PROPS", "dynamic setAttribute name cannot prove component ownership", match.index ?? 0);
  }
  const dynamicCode = /\b(?:eval|Function)\s*\(/g;
  for (const match of code.matchAll(dynamicCode)) {
    addIssue("PUI_UNINSPECTABLE_CODE", `${match[0]} can construct controls outside provenance analysis`, match.index ?? 0);
  }
  const concatenatedConstant = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*((?:["'][^"']*["']\s*\+\s*)+["'][^"']*["'])/g;
  for (const match of commentFreeSource.matchAll(concatenatedConstant)) {
    const folded = [...match[2].matchAll(/["']([^"']*)["']/g)].map((part) => part[1]).join("");
    if (!["innerHTML", "outerHTML", "insertAdjacentHTML", "createContextualFragment"].includes(folded)) continue;
    const escaped = match[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\[\\s*${escaped}\\s*\\]`).test(code)) {
      addIssue("PUI_UNINSPECTABLE_MARKUP", `computed DOM method ${folded} can bypass component provenance`, match.index ?? 0);
    }
  }
  return { issues, used };
}

function scanHtml(file, source, context) {
  const issues = [];
  const addIssue = (code, message, offset = 0) => {
    issues.push({
      code,
      file: path.relative(context.target, file).replaceAll("\\", "/"),
      line: lineNumber(source, offset),
      message,
    });
  };
  const clean = source.replace(/<!--[\s\S]*?-->/g, (value) => value.replace(/[^\n]/g, " "));
  for (const match of clean.matchAll(/\bdata-pui[\w-]*/gi)) {
    addIssue("PUI_RESERVED_MARKER", `${match[0]} is reserved for bundled Personal UI source`, match.index ?? 0);
  }
  for (const match of clean.matchAll(/\bpui-[\w-]+/g)) {
    if (!LEGACY_PUBLIC_ROOT_CLASSES.has(match[0])) {
      addIssue("PUI_PRIVATE_CLASS", `Personal UI internal class token is forbidden: ${match[0]}`, match.index ?? 0);
    }
  }
  const pattern = /<\s*([a-z][\w-]*)(?=[\s>])/gi;
  for (const match of clean.matchAll(pattern)) {
    const tag = match[1].toLowerCase();
    const offset = match.index ?? 0;
    const end = clean.indexOf(">", offset);
    const opening = clean.slice(offset, end < 0 ? clean.length : end + 1);
    const attributes = jsxAttributeNames(opening);
    if (tag.includes("-") || context.forbiddenTags.has(tag)) {
      addIssue("PUI_RAW_CONTROL", `raw <${tag}> is forbidden; use a bundled Personal UI public export`, offset);
    }
    const role = literalAttribute(opening, "role");
    if (attributes.has("role") && role === null) {
      addIssue("PUI_DYNAMIC_ROLE", `dynamic role on <${tag}> cannot prove Personal UI ownership`, offset);
    } else if (role && context.forbiddenRoles.has(role.toLowerCase())) {
      addIssue("PUI_INTERACTIVE_ROLE", `role=${JSON.stringify(role)} on raw <${tag}> is forbidden`, offset);
    }
    for (const attribute of attributes) {
      if (INTERACTIVE_ATTRIBUTES.has(attribute) && !context.forbiddenTags.has(tag)) {
        addIssue("PUI_RAW_INTERACTION", `${attribute} on raw <${tag}> must be owned by a bundled component`, offset);
      }
    }
  }
  return issues;
}

function main() {
  let args;
  try {
    args = parseArguments(process.argv.slice(2));
    const target = path.resolve(args.target);
    const managedRoot = path.resolve(target, args["source-root"]);
    const manifestPath = path.resolve(args.manifest);
    const manifest = readObject(manifestPath, "component manifest");
    const entries = Array.isArray(manifest.entries) ? manifest.entries : [];
    const policy = manifest.policy && typeof manifest.policy === "object" ? manifest.policy : {};
    const publicExports = new Set(entries.flatMap((entry) => Array.isArray(entry.publicExports) ? entry.publicExports : []));
    const reservedComponentNames = new Set([
      ...publicExports,
      ...entries.flatMap((entry) => Array.isArray(entry.aliases) ? entry.aliases.map(pascalCase) : []),
    ]);
    const forbiddenTags = new Set((policy.forbiddenIntrinsicTags ?? []).map((value) => String(value).toLowerCase()));
    const forbiddenRoles = new Set((policy.forbiddenRoles ?? []).map((value) => String(value).toLowerCase()));
    const allowedExternalPackages = new Set([
      ...BUILTIN_EXTERNAL_JSX_PACKAGES,
      ...(policy.allowedExternalJsxPackages ?? []).map(String),
    ]);
    const files = new Set();
    walkFiles(target, files);
    const managedSource = verifyManagedSource(target, managedRoot, manifest.sourceIntegrity);
    const issues = [...managedSource.issues];
    const used = new Set();
    let scannedFiles = 0;
    const context = { target, managedRoot, publicExports, reservedComponentNames, forbiddenTags, forbiddenRoles, allowedExternalPackages };
    for (const file of [...files].sort()) {
      const installedToolRoot = path.join(target, "tools", "personal-ui");
      if (isInside(file, managedRoot) || isInside(file, installedToolRoot)) continue;
      scannedFiles += 1;
      const source = fs.readFileSync(file, "utf8");
      if (HTML_EXTENSIONS.has(path.extname(file).toLowerCase())) issues.push(...scanHtml(file, source, context));
      else {
        const result = scanScript(file, source, context);
        issues.push(...result.issues);
        for (const component of result.used) used.add(component);
      }
    }
    const report = {
      valid: issues.length === 0,
      target,
      manifest: manifestPath,
      scannedFiles,
      usedPublicExports: [...used].sort(),
      managedSource,
      issues,
      errors: issues.map((issue) => `${issue.file}:${issue.line} [${issue.code}] ${issue.message}`),
    };
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    process.exitCode = report.valid ? 0 : 1;
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ valid: false, errors: [String(error?.message ?? error)], issues: [] }, null, 2)}\n`);
    process.exitCode = 2;
  }
}

main();
