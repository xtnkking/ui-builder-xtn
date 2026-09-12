#!/usr/bin/env node

import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import process from "node:process";

const SCRIPT_EXTENSIONS = new Set([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts", ".mdx"]);
const HTML_EXTENSIONS = new Set([".html", ".htm"]);
const STYLE_EXTENSIONS = new Set([".css", ".pcss", ".postcss", ".scss", ".sass", ".less"]);
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
const CSS_IN_JS_RUNTIME_PACKAGES = new Set([
  "styled-components",
  "@emotion/css",
  "@emotion/native",
  "@emotion/react",
  "@emotion/styled",
]);
const LEGACY_PUBLIC_ROOT_CLASSES = new Set(["pui-root"]);
const PROTECTED_COMPONENT_ESCAPE_PROPS = new Set(["classname", "style", "css", "sx", "tw", "ref"]);
const STYLE_OVERRIDE_LAYOUT_ENTRY_IDS = new Set([
  "aspect",
  "collapse",
  "color",
  "divider",
  "focus-trap",
  "layout",
  "portal",
  "resizable",
  "responsive",
  "responsive-visibility",
  "scroll",
  "sticky",
  "visually-hidden",
]);
const CSS_CLASS_SCOPABLE_MEDIA_TAGS = new Set(["audio", "svg", "video"]);
const CSS_ADDITIONAL_PROTECTED_TAGS = new Set(["tbody", "td", "tfoot", "th", "thead", "tr"]);
const CSS_SENSITIVE_ATTRIBUTES = new Set([
  "aria-busy",
  "aria-checked",
  "aria-current",
  "aria-disabled",
  "aria-expanded",
  "aria-invalid",
  "aria-pressed",
  "aria-selected",
  "autocomplete",
  "checked",
  "class",
  "contenteditable",
  "data-active",
  "data-current",
  "data-disabled",
  "data-empty",
  "data-invalid",
  "data-loading",
  "data-open",
  "data-partial",
  "data-position",
  "data-positioned",
  "data-selected",
  "data-state",
  "data-tone",
  "disabled",
  "href",
  "multiple",
  "name",
  "placeholder",
  "readonly",
  "required",
  "role",
  "selected",
  "style",
  "tabindex",
  "type",
  "value",
]);
const CSS_CONTROL_STATE_PSEUDO_CLASSES = new Set([
  "any-link",
  "autofill",
  "checked",
  "disabled",
  "enabled",
  "indeterminate",
  "invalid",
  "optional",
  "placeholder-shown",
  "read-only",
  "read-write",
  "required",
  "user-invalid",
  "user-valid",
  "valid",
]);
const CSS_SAFE_INHERITED_FONT_PROPERTIES = new Set([
  "font",
  "font-family",
  "font-feature-settings",
  "font-kerning",
  "font-language-override",
  "font-optical-sizing",
  "font-palette",
  "font-size",
  "font-size-adjust",
  "font-stretch",
  "font-style",
  "font-synthesis",
  "font-variant",
  "font-variation-settings",
  "font-weight",
  "line-height",
]);

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

function styleSpecifierPath(specifier) {
  return specifier.trim().replaceAll("\\", "/").split(/[?#]/, 1)[0];
}

function isStyleSpecifier(specifier) {
  return STYLE_EXTENSIONS.has(path.posix.extname(styleSpecifierPath(specifier)).toLowerCase());
}

function isLocalStyleSpecifier(specifier) {
  const value = specifier.trim().replaceAll("\\", "/");
  return value.startsWith(".")
    || value.startsWith("/")
    || value.startsWith("@/")
    || value.startsWith("~/")
    || value.startsWith("src/");
}

function isRemoteStyleSpecifier(specifier) {
  return /^(?:https?:)?\/\//i.test(specifier.trim()) || /^(?:data|javascript):/i.test(specifier.trim());
}

function isCssInJsRuntimeSpecifier(specifier) {
  return CSS_IN_JS_RUNTIME_PACKAGES.has(packageRoot(specifier.trim()));
}

function decodeCssIdentifierEscapes(value) {
  return value.replace(/\\([0-9a-fA-F]{1,6})(?:\r\n|[\t\n\f\r ])?|\\([^\r\n])/g, (_whole, hex, escaped) => {
    if (hex) {
      const point = Number.parseInt(hex, 16);
      return point === 0 || point > 0x10ffff ? "\uFFFD" : String.fromCodePoint(point);
    }
    return escaped ?? "";
  });
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

function callArgumentRanges(code, openingParenthesis) {
  if (code[openingParenthesis] !== "(") return [];
  const ranges = [];
  let start = openingParenthesis + 1;
  let parentheses = 1;
  let braces = 0;
  let brackets = 0;
  for (let index = start; index < code.length; index += 1) {
    const character = code[index];
    if (character === "(") parentheses += 1;
    else if (character === ")") {
      parentheses -= 1;
      if (parentheses === 0) {
        if (code.slice(start, index).trim() || ranges.length) ranges.push({ start, end: index });
        return ranges;
      }
    } else if (character === "{") braces += 1;
    else if (character === "}") braces = Math.max(0, braces - 1);
    else if (character === "[") brackets += 1;
    else if (character === "]") brackets = Math.max(0, brackets - 1);
    else if (character === "," && parentheses === 1 && braces === 0 && brackets === 0) {
      ranges.push({ start, end: index });
      start = index + 1;
    }
  }
  return [];
}

function protectedPropsOverride(source, code, range) {
  if (!range) return null;
  const raw = source.slice(range.start, range.end).trim();
  const syntax = code.slice(range.start, range.end).trim();
  if (!syntax || /^(?:null|undefined|void\s+0)$/.test(syntax)) return null;
  if (!syntax.startsWith("{")) return "an opaque props expression";

  let braces = 0;
  let parentheses = 0;
  let brackets = 0;
  let segmentStart = 1;
  let closing = -1;
  const segments = [];
  for (let index = 0; index < syntax.length; index += 1) {
    const character = syntax[index];
    if (character === "{") braces += 1;
    else if (character === "}") {
      braces -= 1;
      if (braces === 0) {
        segments.push({ start: segmentStart, end: index });
        closing = index;
        break;
      }
    } else if (character === "(") parentheses += 1;
    else if (character === ")") parentheses = Math.max(0, parentheses - 1);
    else if (character === "[") brackets += 1;
    else if (character === "]") brackets = Math.max(0, brackets - 1);
    else if (character === "," && braces === 1 && parentheses === 0 && brackets === 0) {
      segments.push({ start: segmentStart, end: index });
      segmentStart = index + 1;
    }
  }
  if (closing < 0 || syntax.slice(closing + 1).trim()) return "an opaque props expression";
  const rawOffset = raw.indexOf("{");
  for (const segment of segments) {
    const item = syntax.slice(segment.start, segment.end).trim();
    if (!item) continue;
    if (item.startsWith("...")) return "spread props";
    if (item.startsWith("[")) return "a computed props key";
    if (/^(?:(?:get|set|async)\s+)?(?:className|style|css|sx|tw|ref)\b/.test(item)) {
      return `${item.match(/(?:className|style|css|sx|tw|ref)/)?.[0] ?? "style"} prop`;
    }
    const rawItem = stripComments(raw.slice(rawOffset + segment.start, rawOffset + segment.end)).trim();
    const quoted = rawItem.match(/^(?:get\s+|set\s+|async\s+)?["'](className|style|css|sx|tw|ref)["']\s*(?::|\()/);
    if (quoted) return `${quoted[1]} prop`;
  }
  return null;
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
      if (SCRIPT_EXTENSIONS.has(extension) || HTML_EXTENSIONS.has(extension) || STYLE_EXTENSIONS.has(extension)) {
        output.add(path.resolve(absolute));
      }
    }
  }
}

function maskCssSyntax(source, { lineComments = false, strings = true } = {}) {
  const output = source.split("");
  let state = "code";
  let quote = null;
  let escaped = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];
    if (state === "block-comment") {
      if (character === "*" && next === "/") {
        output[index] = output[index + 1] = " ";
        index += 1;
        state = "code";
      } else if (character !== "\n") output[index] = " ";
      continue;
    }
    if (state === "line-comment") {
      if (character === "\n") state = "code";
      else output[index] = " ";
      continue;
    }
    if (state === "string") {
      if (strings && character !== "\n") output[index] = " ";
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) state = "code";
      continue;
    }
    if (character === "/" && next === "*") {
      output[index] = output[index + 1] = " ";
      index += 1;
      state = "block-comment";
    } else if (
      lineComments
      && character === "/"
      && next === "/"
      && source[index - 1] !== ":"
      && !/\burl\(\s*$/i.test(source.slice(Math.max(0, source.lastIndexOf("\n", index - 1) + 1), index))
    ) {
      output[index] = output[index + 1] = " ";
      index += 1;
      state = "line-comment";
    } else if (character === '"' || character === "'") {
      if (strings) output[index] = " ";
      state = "string";
      quote = character;
    }
  }
  return output.join("");
}

function cssFragment(source, lineComments = false) {
  return maskCssSyntax(source, { lineComments, strings: false });
}

function cssDeclaration(statement, lineComments = false) {
  const clean = cssFragment(statement, lineComments).trim();
  const match = clean.match(/^((?:--|[-_A-Za-z])[-_A-Za-z0-9]*)\s*:\s*([\s\S]+)$/);
  if (!match) return null;
  return { property: match[1].toLowerCase(), value: match[2].trim() };
}

function collectBraceStyleRules(source, lineComments = false) {
  const structure = maskCssSyntax(source, { lineComments, strings: true });
  const root = { kind: "root", segmentStart: 0, ancestors: [], declarations: [], injections: [], ownerRule: null };
  const stack = [root];
  const rules = [];
  let parentheses = 0;
  let brackets = 0;
  let interpolation = 0;
  for (let index = 0; index < structure.length; index += 1) {
    const character = structure[index];
    if (interpolation) {
      if (character === "{") interpolation += 1;
      else if (character === "}") interpolation -= 1;
      continue;
    }
    if (character === "{" && structure[index - 1] === "#") {
      interpolation = 1;
      continue;
    }
    if (character === "(") parentheses += 1;
    else if (character === ")") parentheses = Math.max(0, parentheses - 1);
    else if (character === "[") brackets += 1;
    else if (character === "]") brackets = Math.max(0, brackets - 1);
    if (parentheses || brackets) continue;

    const current = stack.at(-1);
    if (character === ";") {
      const rawStatement = source.slice(current.segmentStart, index);
      const declaration = cssDeclaration(rawStatement, lineComments);
      const owner = current.kind === "rule" ? current : current.ownerRule;
      if (declaration) owner?.declarations.push(declaration);
      else {
        const statement = cssFragment(rawStatement, lineComments);
        const leading = statement.search(/\S/);
        if (owner && leading >= 0) {
          owner.injections.push({ text: statement.slice(leading).trim(), offset: current.segmentStart + leading });
        }
      }
      current.segmentStart = index + 1;
      continue;
    }
    if (character === "{") {
      const fragment = cssFragment(source.slice(current.segmentStart, index), lineComments);
      const leading = fragment.search(/\S/);
      const prelude = leading < 0 ? "" : fragment.slice(leading).trim();
      const isAtRule = prelude.startsWith("@");
      const isPropertyBlock = /^(?:--|\$|[-_A-Za-z])[-_A-Za-z0-9]*\s*:\s*$/.test(prelude);
      const ancestors = current.kind === "rule"
        ? [...current.ancestors, current.selector]
        : [...current.ancestors];
      const ownerRule = current.kind === "rule" ? current : current.ownerRule;
      if (ownerRule && /^@(?:include|extend|apply)\b/i.test(prelude)) {
        ownerRule.injections.push({ text: prelude, offset: current.segmentStart + Math.max(0, leading) });
      }
      stack.push({
        kind: !prelude || isAtRule || isPropertyBlock ? "container" : "rule",
        selector: prelude,
        offset: current.segmentStart + Math.max(0, leading),
        segmentStart: index + 1,
        ancestors,
        declarations: [],
        injections: [],
        ownerRule,
      });
      continue;
    }
    if (character === "}" && stack.length > 1) {
      const block = stack.pop();
      const rawStatement = source.slice(block.segmentStart, index);
      const declaration = cssDeclaration(rawStatement, lineComments);
      const owner = block.kind === "rule" ? block : block.ownerRule;
      if (declaration) owner?.declarations.push(declaration);
      else {
        const statement = cssFragment(rawStatement, lineComments);
        const leading = statement.search(/\S/);
        if (owner && leading >= 0) {
          owner.injections.push({ text: statement.slice(leading).trim(), offset: block.segmentStart + leading });
        }
      }
      if (block.kind === "rule") rules.push(block);
      stack.at(-1).segmentStart = index + 1;
    }
  }
  return rules;
}

function collectIndentedSassRules(source) {
  const clean = cssFragment(source, true);
  const rules = [];
  const stack = [];
  let offset = 0;
  for (const rawLine of clean.split(/(?<=\n)/)) {
    const withoutNewline = rawLine.replace(/[\r\n]+$/, "");
    const text = withoutNewline.trim();
    const indentText = withoutNewline.slice(0, withoutNewline.length - withoutNewline.trimStart().length);
    const indent = [...indentText].reduce((total, character) => total + (character === "\t" ? 4 : 1), 0);
    if (!text) {
      offset += rawLine.length;
      continue;
    }
    while (stack.length && stack.at(-1).indent >= indent) stack.pop();
    const declaration = cssDeclaration(text, true);
    if (declaration) {
      const owner = [...stack].reverse().find((entry) => entry.kind === "rule");
      if (owner) owner.declarations.push(declaration);
    } else {
      const owner = [...stack].reverse().find((entry) => entry.kind === "rule");
      if (
        owner
        && (
          /^@(?:include|extend|apply)\b/i.test(text)
          || /^\+[-_A-Za-z][-_A-Za-z0-9]*(?:\s*\([^)]*\))?\s*$/.test(text)
          || /^(?:[.#][-_A-Za-z][-_A-Za-z0-9]*\s*>\s*)*[.#][-_A-Za-z][-_A-Za-z0-9]*\s*\([^)]*\)\s*$/.test(text)
        )
      ) {
        owner.injections.push({ text, offset: offset + indentText.length });
      }
      const parentRules = stack.filter((entry) => entry.kind === "rule").map((entry) => entry.selector);
      const entry = {
        kind: text.startsWith("@") || text.startsWith("$") || /^(?:--|[-_A-Za-z])[-_A-Za-z0-9]*\s*:\s*$/.test(text)
          ? "container"
          : "rule",
        selector: text,
        offset: offset + indentText.length,
        indent,
        ancestors: parentRules,
        declarations: [],
        injections: [],
      };
      stack.push(entry);
      if (entry.kind === "rule") rules.push(entry);
    }
    offset += rawLine.length;
  }
  return rules;
}

function maskSelectorConditions(selector) {
  const output = maskCssSyntax(selector, { strings: true }).split("");
  const syntax = output.join("");
  for (const match of syntax.matchAll(/:(?:has|not)\s*\(/gi)) {
    let depth = 1;
    for (let cursor = (match.index ?? 0) + match[0].length; cursor < output.length && depth; cursor += 1) {
      if (output[cursor] === "(") depth += 1;
      else if (output[cursor] === ")") depth -= 1;
      if (depth) output[cursor] = " ";
    }
  }
  return output.join("");
}

function maskSelectorNonTargets(selector) {
  const output = maskSelectorConditions(selector).split("");
  for (let index = 0; index < output.length; index += 1) {
    if (output[index] === "[") {
      let depth = 1;
      for (let cursor = index + 1; cursor < output.length && depth; cursor += 1) {
        if (output[cursor] === "[") depth += 1;
        else if (output[cursor] === "]") depth -= 1;
        if (depth || cursor !== index) output[cursor] = " ";
      }
      output[index] = " ";
    }
  }
  return output.join("");
}

function reservedStyleSelector(selector) {
  const clean = decodeCssIdentifierEscapes(cssFragment(selector));
  for (const match of clean.matchAll(/\.((?:pui)-[-_A-Za-z0-9]+)/gi)) {
    if (!LEGACY_PUBLIC_ROOT_CLASSES.has(match[1].toLowerCase())) {
      return { code: "PUI_PRIVATE_CLASS", token: `.${match[1]}` };
    }
  }
  const marker = clean.match(/\[\s*(data-pui[-_A-Za-z0-9]*)\b/i);
  if (marker) return { code: "PUI_RESERVED_MARKER", token: marker[1] };
  const classReach = clean.match(/\[\s*class\s*[*^$|~]?=\s*(?:["'][^"']*pui-|[^\]\s]*pui-)/i);
  if (classReach) return { code: "PUI_PRIVATE_CLASS", token: "class selector containing pui-" };
  return null;
}

function universalStyleSelector(selector) {
  return /(^|[\s>+~,(])\*(?=$|[\s>+~.#:[,)])/i.test(
    maskSelectorNonTargets(decodeCssIdentifierEscapes(selector)),
  );
}

function protectedStyleSelector(selector, forbiddenTags, inherited = false) {
  if (inherited) return "nested protected selector";
  const decoded = decodeCssIdentifierEscapes(selector);
  const syntax = maskSelectorNonTargets(decoded);
  const tokenPattern = /(^|[\s>+~,(|])([A-Za-z][-_A-Za-z0-9]*)/g;
  for (const match of syntax.matchAll(tokenPattern)) {
    const tag = match[2].toLowerCase();
    if (!forbiddenTags.has(tag) && !CSS_ADDITIONAL_PROTECTED_TAGS.has(tag) && !CSS_CLASS_SCOPABLE_MEDIA_TAGS.has(tag)) continue;
    if (CSS_CLASS_SCOPABLE_MEDIA_TAGS.has(tag)) {
      const tagStart = (match.index ?? 0) + match[1].length;
      const tail = syntax.slice(tagStart + match[2].length);
      const boundary = tail.search(/[\s>+~,)]+/);
      const compoundTail = boundary < 0 ? tail : tail.slice(0, boundary);
      if (/[.#][-_A-Za-z][-_A-Za-z0-9]*/.test(compoundTail)) continue;
    }
    return `<${tag}>`;
  }
  const conditions = maskSelectorConditions(decoded);
  for (const match of conditions.matchAll(/\[\s*([-_A-Za-z][-_A-Za-z0-9]*)/g)) {
    const attribute = match[1].toLowerCase();
    if (attribute.startsWith("aria-") || CSS_SENSITIVE_ATTRIBUTES.has(attribute)) {
      return attribute === "role" ? "interactive role selector" : `[${attribute}] selector`;
    }
  }
  const pseudoPattern = /(?<!:):(?:-webkit-)?([-_A-Za-z][-_A-Za-z0-9]*)/g;
  for (const match of syntax.matchAll(pseudoPattern)) {
    if (CSS_CONTROL_STATE_PSEUDO_CLASSES.has(match[1].toLowerCase())) {
      return `:${match[1].toLowerCase()} state selector`;
    }
  }
  if (universalStyleSelector(decoded)) return "universal selector";
  return null;
}

function safeControlResetDeclaration(declaration) {
  const value = declaration.value.replace(/\s*!important\s*$/i, "").trim().toLowerCase();
  if (/!important/i.test(declaration.value)) return false;
  if (declaration.property.startsWith("--") && !declaration.property.startsWith("--pui-")) return true;
  if (["box-sizing", "-moz-box-sizing", "-webkit-box-sizing"].includes(declaration.property)) {
    return value === "border-box" || value === "inherit";
  }
  return CSS_SAFE_INHERITED_FONT_PROPERTIES.has(declaration.property) && value === "inherit";
}

function scanStyle(file, source, context, options = {}) {
  const issues = [];
  const issueKeys = new Set();
  const extension = path.extname(file).toLowerCase();
  const baseOffset = options.baseOffset ?? 0;
  const lineSource = options.lineSource ?? source;
  const lineComments = options.lineComments
    ?? (extension === ".scss" || extension === ".sass" || extension === ".less");
  const rules = extension === ".sass" && !maskCssSyntax(source, { lineComments: true }).includes("{")
    ? collectIndentedSassRules(source)
    : collectBraceStyleRules(source, lineComments);
  const addIssue = (code, message, offset = 0) => {
    const key = `${code}:${offset}:${message}`;
    if (issueKeys.has(key)) return;
    issueKeys.add(key);
    issues.push({
      code,
      file: path.relative(context.target, file).replaceAll("\\", "/"),
      line: lineNumber(lineSource, baseOffset + offset),
      message,
    });
  };

  const directives = cssFragment(source, lineComments);
  const externalDirective = /(^|[;{}\n])\s*@(import|use|forward)\s+(?:url\(\s*)?(?:"([^"]+)"|'([^']+)'|([^\s;)]+))/gim;
  for (const match of directives.matchAll(externalDirective)) {
    const specifier = match[3] ?? match[4] ?? match[5] ?? "";
    if (specifier && !isLocalStyleSpecifier(specifier)) {
      const directiveOffset = (match.index ?? 0) + match[0].indexOf("@");
      addIssue(
        "PUI_EXTERNAL_STYLE",
        `external @${match[2].toLowerCase()} ${JSON.stringify(specifier)} is forbidden; keep application styles local and inspectable`,
        directiveOffset,
      );
    }
  }

  for (const rule of rules) {
    const reserved = reservedStyleSelector(rule.selector);
    if (reserved) {
      addIssue(
        reserved.code,
        `${reserved.token} is reserved for bundled Personal UI source and cannot be selected by application styles`,
        rule.offset,
      );
    }
    const ancestorProtected = rule.ancestors.some((selector) =>
      Boolean(protectedStyleSelector(selector, context.forbiddenTags)),
    );
    const protectedTarget = protectedStyleSelector(
      rule.selector,
      context.forbiddenTags,
      ancestorProtected,
    );
    const injection = rule.injections?.[0];
    if (protectedTarget && injection) {
      addIssue(
        "PUI_GENERIC_STYLE_OVERRIDE",
        `selector ${JSON.stringify(rule.selector)} can alter ${protectedTarget} through uninspectable style statement ${JSON.stringify(injection.text)}`,
        injection.offset,
      );
      continue;
    }
    const unsafe = rule.declarations.find((declaration) => !safeControlResetDeclaration(declaration));
    if (protectedTarget && unsafe) {
      addIssue(
        "PUI_GENERIC_STYLE_OVERRIDE",
        `selector ${JSON.stringify(rule.selector)} can alter ${protectedTarget} with ${unsafe.property}; use Personal UI props or theme tokens instead`,
        rule.offset,
      );
    }
  }
  return issues;
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

function looksLikeDomReference(name) {
  return /^(?:document|el|elem|element|node|root|target|currentTarget|dom|control|input|button|link|styleElement|shadowRoot)$/i.test(name)
    || /(?:Element|Node|Root|Target|Control|Input|Button|Link|El|Ref)$/i.test(name);
}

function collectImperativeStyleReferences(code) {
  const dom = new Set(["document"]);
  const sheets = new Set();
  let changed = true;
  while (changed) {
    changed = false;
    const assignment = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?:\?\s*)?=\s*([^;\n]{1,500})/g;
    for (const match of code.matchAll(assignment)) {
      const local = match[1];
      const value = match[2];
      const source = value.match(/^\s*([A-Za-z_$][\w$]*)\b/)?.[1];
      const domSource = /\b(?:document|window\s*\.\s*document)\s*(?:\.\s*(?:body|head|documentElement|activeElement)|\.\s*(?:querySelector(?:All)?|getElementById|getElementsBy(?:ClassName|Name|TagName)|createElement)\s*\()/i.test(value)
        || /\.\s*(?:querySelector|closest)\s*\(/.test(value)
        || /\.\s*(?:current|currentTarget|target)\b/.test(value)
        || Boolean(source && (dom.has(source) || looksLikeDomReference(source)));
      if (domSource && !dom.has(local)) {
        dom.add(local);
        changed = true;
      }
      const sheetSource = /\bnew\s+CSSStyleSheet\b|\.\s*(?:styleSheets|styleSheet|sheet|cssRules)\b/.test(value)
        || Boolean(source && sheets.has(source));
      if (sheetSource && !sheets.has(local)) {
        sheets.add(local);
        changed = true;
      }
    }
  }
  return { dom, sheets };
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
  const cloneElementFactories = new Set();
  const componentWrapperFactories = new Set();
  const reactObjects = new Set(["React"]);

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

  const sideEffectStyleImport = /(?:^|[;\n])\s*import\s*["']([^"']+)["']/gm;
  for (const match of commentFreeSource.matchAll(sideEffectStyleImport)) {
    if (isCssInJsRuntimeSpecifier(match[1])) {
      addIssue(
        "PUI_EXTERNAL_STYLE",
        `CSS-in-JS runtime import ${JSON.stringify(packageRoot(match[1]))} is forbidden; use Personal UI components and local layout styles`,
        match.index ?? 0,
      );
    } else if (isStyleSpecifier(match[1]) && !isLocalStyleSpecifier(match[1])) {
      addIssue(
        "PUI_EXTERNAL_STYLE",
        `external stylesheet import ${JSON.stringify(match[1])} is forbidden; copy reviewed styles into the application`,
        match.index ?? 0,
      );
    }
  }

  for (const record of importRecords(source)) {
    if (isStyleSpecifier(record.specifier) && !isLocalStyleSpecifier(record.specifier)) {
      addIssue(
        "PUI_EXTERNAL_STYLE",
        `external stylesheet import ${JSON.stringify(record.specifier)} is forbidden; copy reviewed styles into the application`,
        record.offset,
      );
    }
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
    if (isCssInJsRuntimeSpecifier(record.specifier)) {
      addIssue(
        "PUI_EXTERNAL_STYLE",
        `CSS-in-JS runtime import ${JSON.stringify(packageName)} is forbidden; use Personal UI components and local layout styles`,
        record.offset,
      );
    }
    if (packageName === "react") {
      for (const item of namedImports(record.clause)) {
        if (item.imported === "createElement") elementFactories.add(item.local);
        if (item.imported === "cloneElement") {
          cloneElementFactories.add(item.local);
          addIssue(
            "PUI_UNINSPECTABLE_PROPS",
            `React.cloneElement alias ${item.local} is forbidden because cloned component props cannot preserve Personal UI ownership`,
            record.offset,
          );
        }
        if (["memo", "forwardRef"].includes(item.imported)) componentWrapperFactories.add(item.local);
      }
      const reactDefault = defaultImport(record.clause);
      if (reactDefault) reactObjects.add(reactDefault);
      const reactNamespace = namespaceImport(record.clause);
      if (reactNamespace) reactObjects.add(reactNamespace);
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
    if (isCssInJsRuntimeSpecifier(literal[2])) {
      addIssue(
        "PUI_EXTERNAL_STYLE",
        `CSS-in-JS runtime ${match[1]} ${JSON.stringify(packageRoot(literal[2]))} is forbidden; use Personal UI components and local layout styles`,
        match.index ?? 0,
      );
    } else if (isStyleSpecifier(literal[2]) && !isLocalStyleSpecifier(literal[2])) {
      addIssue(
        "PUI_EXTERNAL_STYLE",
        `external stylesheet ${match[1]} ${JSON.stringify(literal[2])} is forbidden; copy reviewed styles into the application`,
        match.index ?? 0,
      );
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
      if (parts[0] === "cloneElement") {
        cloneElementFactories.add(parts.at(-1));
        addIssue(
          "PUI_UNINSPECTABLE_PROPS",
          `React.cloneElement alias ${parts.at(-1)} is forbidden because cloned component props cannot preserve Personal UI ownership`,
          match.index ?? 0,
        );
      }
      if (["memo", "forwardRef"].includes(parts[0])) componentWrapperFactories.add(parts.at(-1));
    }
  }
  for (const match of commentFreeSource.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*require\s*\(\s*["']react["']\s*\)(?:\s*\.\s*default)?/g)) {
    reactObjects.add(match[1]);
  }
  const code = codeOnly(source);
  propagateAliases(code, publicAliases);
  propagateExternalAliases(code, externalAliases);
  propagateFactoryAliases(code, reactObjects);
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
      if (parts[0] === "cloneElement") {
        cloneElementFactories.add(parts.at(-1));
        addIssue(
          "PUI_UNINSPECTABLE_PROPS",
          `React.cloneElement alias ${parts.at(-1)} is forbidden because cloned component props cannot preserve Personal UI ownership`,
          match.index ?? 0,
        );
      }
      if (["memo", "forwardRef"].includes(parts[0])) componentWrapperFactories.add(parts.at(-1));
    }
  }
  for (const reactObject of reactObjects) {
    const escaped = reactObject.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const memberAlias = new RegExp(`\\b(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*${escaped}\\s*(?:\\.\\s*(?:memo|forwardRef)|\\[\\s*["'](?:memo|forwardRef)["']\\s*\\])`, "g");
    for (const match of commentFreeSource.matchAll(memberAlias)) componentWrapperFactories.add(match[1]);
  }
  propagateFactoryAliases(code, runtimeFactories);
  propagateFactoryAliases(code, elementFactories);
  propagateFactoryAliases(code, cloneElementFactories);
  propagateFactoryAliases(code, componentWrapperFactories);

  const reportCloneElement = (offset, syntax) => {
    addIssue(
      "PUI_UNINSPECTABLE_PROPS",
      `${syntax} is forbidden because cloned component props cannot preserve Personal UI ownership`,
      offset,
    );
  };
  for (const reactObject of reactObjects) {
    const escaped = reactObject.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const member = new RegExp(`\\b${escaped}\\s*(?:\\.\\s*cloneElement|\\[\\s*["']cloneElement["']\\s*\\])`, "g");
    for (const match of commentFreeSource.matchAll(member)) {
      if (code[match.index ?? 0]?.trim()) reportCloneElement(match.index ?? 0, `${reactObject}.cloneElement`);
    }
    const destructured = new RegExp(`\\b(?:const|let|var)\\s*\\{[^}]*\\bcloneElement\\b[^}]*\\}\\s*=\\s*${escaped}\\b`, "g");
    for (const match of code.matchAll(destructured)) reportCloneElement(match.index ?? 0, `cloneElement destructured from ${reactObject}`);
  }
  const requiredCloneElement = /\brequire\s*\(\s*["']react["']\s*\)\s*(?:\.\s*default\s*)?(?:\.\s*cloneElement|\[\s*["']cloneElement["']\s*\])/g;
  for (const match of commentFreeSource.matchAll(requiredCloneElement)) {
    if (code[match.index ?? 0]?.trim()) reportCloneElement(match.index ?? 0, "require(react).cloneElement");
  }

  const resolvePublicExport = (reference) => {
    const compact = reference.replaceAll(/\s+/g, "");
    const [base, member] = compact.split(".");
    if (publicAliases.has(base) && !member) return publicAliases.get(base);
    if (publicNamespaces.has(base) && member && context.publicExports.has(member)) return member;
    return null;
  };
  let wrappedAliasChanged = true;
  while (wrappedAliasChanged) {
    wrappedAliasChanged = false;
    const addWrappedAlias = (local, reference) => {
      const exported = resolvePublicExport(reference);
      if (exported && !publicAliases.has(local)) {
        publicAliases.set(local, exported);
        wrappedAliasChanged = true;
      }
    };
    for (const factory of componentWrapperFactories) {
      const escaped = factory.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const wrapper = new RegExp(`\\b(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*${escaped}\\s*\\(\\s*([A-Za-z_$][\\w$]*(?:\\s*\\.\\s*[A-Za-z_$][\\w$]*)?)`, "g");
      for (const match of code.matchAll(wrapper)) addWrappedAlias(match[1], match[2]);
    }
    for (const reactObject of reactObjects) {
      const escaped = reactObject.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const wrapper = new RegExp(`\\b(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*${escaped}\\s*(?:\\.\\s*(?:memo|forwardRef)|\\[\\s*["'](?:memo|forwardRef)["']\\s*\\])\\s*\\(\\s*([A-Za-z_$][\\w$]*(?:\\s*\\.\\s*[A-Za-z_$][\\w$]*)?)`, "g");
      for (const match of commentFreeSource.matchAll(wrapper)) addWrappedAlias(match[1], match[2]);
    }
    if (wrappedAliasChanged) propagateAliases(code, publicAliases);
  }
  const intrinsicAliases = stringTagAliases(source, new Set([...context.forbiddenTags, "style"]));
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
      if (tag === "style") {
        addIssue("PUI_UNINSPECTABLE_STYLE", `${syntax}("style") can inject unverified application CSS and is forbidden`, offset);
      } else if (context.forbiddenTags.has(tag) || tag.includes("-")) {
        addIssue("PUI_RAW_CONTROL", `${syntax}(${JSON.stringify(tag)}) is forbidden; use Personal UI`, offset);
      }
      return;
    }
    const [base, member] = compact.split(".");
    if (intrinsicAliases.has(base)) {
      const tag = intrinsicAliases.get(base);
      if (tag === "style") {
        addIssue("PUI_UNINSPECTABLE_STYLE", `${syntax}(${base}) resolves to a raw style element and is forbidden`, offset);
      } else {
        addIssue("PUI_RAW_CONTROL", `${syntax}(${base}) resolves to raw ${JSON.stringify(tag)}`, offset);
      }
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

  const inspectedComponentProps = new Set();
  const inspectProtectedInvocation = (reference, openingParenthesis, propsIndex, syntax) => {
    const exported = resolvePublicExport(reference);
    if (!exported || !context.styleProtectedExports.has(exported)) return;
    const range = callArgumentRanges(code, openingParenthesis)[propsIndex];
    const reason = protectedPropsOverride(source, code, range);
    if (!reason) return;
    const key = `${exported}:${range?.start ?? openingParenthesis}`;
    if (inspectedComponentProps.has(key)) return;
    inspectedComponentProps.add(key);
    addIssue(
      "PUI_COMPONENT_STYLE_OVERRIDE",
      `${syntax} for Personal UI component ${exported} uses ${reason}, which can override component styling or obtain its imperative ref`,
      range?.start ?? openingParenthesis,
    );
  };

  const openingPattern = /(?<![\w$])<\s*([A-Za-z][\w.-]*(?:\s*\.\s*[A-Za-z_$][\w$]*)?)(?=[\s/>])/g;
  for (const match of code.matchAll(openingPattern)) {
    const offset = match.index ?? 0;
    const rawTag = match[1].replaceAll(/\s+/g, "");
    const end = findOpeningTagEnd(source, offset);
    const openingTag = source.slice(offset, end + 1);
    const openingAttributes = jsxAttributeNames(openingTag);
    const [openingBase, openingMember] = rawTag.split(".");
    const publicComponentExport = publicAliases.has(openingBase) && !openingMember
      ? publicAliases.get(openingBase)
      : publicNamespaces.has(openingBase) && openingMember
        ? openingMember
        : null;
    const publicComponent = publicComponentExport && context.styleProtectedExports.has(publicComponentExport);
    if (publicComponent) {
      if (/\{\s*\.\.\./.test(openingTag)) {
        addIssue(
          "PUI_COMPONENT_STYLE_OVERRIDE",
          `spread props on Personal UI component ${rawTag} can inject styling or an imperative ref; pass explicit public props instead`,
          offset,
        );
      }
      for (const attribute of PROTECTED_COMPONENT_ESCAPE_PROPS) {
        if (openingAttributes.has(attribute)) {
          addIssue(
            "PUI_COMPONENT_STYLE_OVERRIDE",
            `${attribute === "classname" ? "className" : attribute} on Personal UI component ${rawTag} is forbidden; use public props or a surrounding layout element`,
            offset,
          );
        }
      }
    }
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
      if (tag === "style") {
        addIssue("PUI_UNINSPECTABLE_STYLE", "raw JSX <style> can inject unverified application CSS and is forbidden", offset);
      } else if (tag === "link") {
        const rel = literalAttribute(openingTag, "rel")?.toLowerCase().split(/\s+/) ?? [];
        const as = literalAttribute(openingTag, "as")?.toLowerCase() ?? "";
        const href = literalAttribute(openingTag, "href");
        if ((rel.includes("stylesheet") || as === "style") && href && isRemoteStyleSpecifier(href)) {
          addIssue(
            "PUI_EXTERNAL_STYLE",
            `remote JSX stylesheet link ${JSON.stringify(href)} is forbidden; keep application styles local and inspectable`,
            offset,
          );
        }
      } else if (tag.includes("-") || context.forbiddenTags.has(tag)) {
        addIssue("PUI_RAW_CONTROL", `raw <${tag}> is forbidden; use a bundled Personal UI public export`, offset);
      }
      if (/\{\s*\.\.\./.test(openingTag)) {
        addIssue("PUI_UNINSPECTABLE_PROPS", `spread props on raw <${tag}> cannot prove that role and interaction stay component-owned`, offset);
      }
      const role = literalAttribute(openingTag, "role");
      if (openingAttributes.has("role") && role === null) {
        addIssue("PUI_DYNAMIC_ROLE", `dynamic role on <${tag}> cannot prove Personal UI ownership`, offset);
      } else if (role && context.forbiddenRoles.has(role.toLowerCase())) {
        addIssue("PUI_INTERACTIVE_ROLE", `role=${JSON.stringify(role)} on raw <${tag}> is forbidden`, offset);
      }
      for (const attribute of openingAttributes) {
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
    const call = new RegExp(`(?<![\\w$.])${escaped}\\s*\\(`, "g");
    for (const match of code.matchAll(call)) {
      used.add(exported);
      const opening = (match.index ?? 0) + match[0].lastIndexOf("(");
      inspectProtectedInvocation(local, opening, 0, `direct call ${local}`);
    }
  }
  for (const namespace of publicNamespaces) {
    const escaped = namespace.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`\\b${escaped}\\s*\\.\\s*([A-Za-z_$][\\w$]*)\\s*\\(`, "g");
    for (const match of code.matchAll(pattern)) {
      if (context.publicExports.has(match[1])) {
        used.add(match[1]);
        const opening = (match.index ?? 0) + match[0].lastIndexOf("(");
        inspectProtectedInvocation(`${namespace}.${match[1]}`, opening, 0, `direct call ${namespace}.${match[1]}`);
      }
      else addIssue("PUI_PRIVATE_EXPORT", `${match[1]} is not a bundled public runtime export`, match.index ?? 0);
    }
  }

  const factoryIdentifier = /(?:\bReact\s*\.\s*)?\bcreateElement\s*\(\s*([A-Za-z_$][\w$]*(?:\s*\.\s*[A-Za-z_$][\w$]*)?)/g;
  for (const match of code.matchAll(factoryIdentifier)) {
    const prefix = code.slice(Math.max(0, (match.index ?? 0) - 12), match.index ?? 0);
    if (/document\s*\.\s*$/.test(prefix)) continue;
    processElementReference(match[1], match.index ?? 0, "createElement", true);
    inspectProtectedInvocation(
      match[1],
      (match.index ?? 0) + match[0].lastIndexOf("("),
      1,
      "createElement props",
    );
  }
  const factoryLiteral = /(?:\bReact\s*\.\s*)?\bcreateElement\s*\(\s*(["'`][a-z][\w-]*["'`])/g;
  for (const match of commentFreeSource.matchAll(factoryLiteral)) {
    processElementReference(match[1], match.index ?? 0, "createElement", true);
  }
  const documentFactory = /\bdocument\s*\.\s*createElement\s*\(\s*(["'`][a-z][\w-]*["'`]|[A-Za-z_$][\w$]*)/g;
  for (const match of commentFreeSource.matchAll(documentFactory)) {
    if (!code[match.index ?? 0]?.trim()) continue;
    const literal = match[1].match(/^["'`]([a-z][\w-]*)["'`]$/)?.[1]?.toLowerCase();
    if (literal === "style" || literal === "link") {
      addIssue(
        "PUI_DYNAMIC_STYLE",
        `document.createElement(${JSON.stringify(literal)}) can inject styles outside Personal UI ownership and is forbidden`,
        match.index ?? 0,
      );
    } else processElementReference(match[1], match.index ?? 0, "document.createElement", true);
  }

  const bracketFactory = /\bReact\s*\[\s*["']createElement["']\s*\]\s*\(\s*([A-Za-z_$][\w$]*(?:\s*\.\s*[A-Za-z_$][\w$]*)?|["'`][a-z][\w-]*["'`])/g;
  for (const match of commentFreeSource.matchAll(bracketFactory)) {
    processElementReference(match[1], match.index ?? 0, "React[createElement]", true);
    inspectProtectedInvocation(
      match[1],
      (match.index ?? 0) + match[0].lastIndexOf("("),
      1,
      "React[createElement] props",
    );
  }
  for (const factory of elementFactories) {
    const escaped = factory.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const identifier = new RegExp(`\\b${escaped}\\s*\\(\\s*([A-Za-z_$][\\w$]*(?:\\s*\\.\\s*[A-Za-z_$][\\w$]*)?)`, "g");
    const literal = new RegExp(`\\b${escaped}\\s*\\(\\s*([\"'\u0060][a-z][\\w-]*[\"'\u0060])`, "g");
    for (const match of code.matchAll(identifier)) {
      processElementReference(match[1], match.index ?? 0, factory, true);
      inspectProtectedInvocation(
        match[1],
        (match.index ?? 0) + match[0].lastIndexOf("("),
        1,
        `${factory} props`,
      );
    }
    for (const match of commentFreeSource.matchAll(literal)) processElementReference(match[1], match.index ?? 0, factory, true);
  }

  for (const factory of runtimeFactories) {
    const escaped = factory.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const identifier = new RegExp(`\\b${escaped}\\s*\\(\\s*([A-Za-z_$][\\w$]*(?:\\s*\\.\\s*[A-Za-z_$][\\w$]*)?)`, "g");
    const literal = new RegExp(`\\b${escaped}\\s*\\(\\s*([\"'\u0060][a-z][\\w-]*[\"'\u0060])`, "g");
    for (const match of code.matchAll(identifier)) {
      processElementReference(match[1], match.index ?? 0, factory, true);
      inspectProtectedInvocation(
        match[1],
        (match.index ?? 0) + match[0].lastIndexOf("("),
        1,
        `${factory} props`,
      );
    }
    for (const match of commentFreeSource.matchAll(literal)) processElementReference(match[1], match.index ?? 0, factory, true);
  }
  for (const namespace of runtimeNamespaces) {
    const escaped = namespace.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`\\b${escaped}\\s*\\.\\s*(?:jsx|jsxs|jsxDEV)\\s*\\(\\s*([A-Za-z_$][\\w$]*(?:\\s*\\.\\s*[A-Za-z_$][\\w$]*)?|[\"'\u0060][a-z][\\w-]*[\"'\u0060])`, "g");
    for (const match of commentFreeSource.matchAll(pattern)) {
      processElementReference(match[1], match.index ?? 0, `${namespace}.jsx`, true);
      inspectProtectedInvocation(
        match[1],
        (match.index ?? 0) + match[0].lastIndexOf("("),
        1,
        `${namespace}.jsx props`,
      );
    }
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

  const imperativeReferences = collectImperativeStyleReferences(code);
  const reportDynamicStyle = (offset, syntax) => {
    addIssue(
      "PUI_DYNAMIC_STYLE",
      `${syntax} mutates DOM or CSSOM appearance outside Personal UI ownership and is forbidden`,
      offset,
    );
  };
  const domChainIsProven = (base, chain) => imperativeReferences.dom.has(base)
    || looksLikeDomReference(base)
    || /\b(?:current|currentTarget|target|document|documentElement|body|head|activeElement)\b/.test(chain);
  const domChain = String.raw`((?:\s*(?:\?\.|\.)\s*(?:current|currentTarget|target|document|documentElement|body|head|activeElement))*)`;
  const assignmentOperator = String.raw`(?:&&=|\|\|=|\?\?=|[+\-*/%&|^]?=(?!=))`;
  const directDomCall = String.raw`\b(?:document|[A-Za-z_$][\w$]*)(?:\s*(?:\?\.|\.)\s*(?:document|documentElement|body|head|shadowRoot|current))*\s*(?:\?\.|\.)\s*(?:querySelector(?:All)?|closest|getElementById|getElementsBy(?:ClassName|Name|TagName)|createElement)(?:\s*<[^;{}\n>]+>)?\s*\([^();{}\n]*\)(?:\s*\[[^\]\n]+\])?\s*!?`;
  const directDomStyleAssignment = new RegExp(
    String.raw`${directDomCall}\s*(?:\?\.|\.)\s*style\s*(?:\?\.|\.)\s*[A-Za-z_$][\w$]*\s*${assignmentOperator}`,
    "g",
  );
  for (const match of code.matchAll(directDomStyleAssignment)) {
    reportDynamicStyle(match.index ?? 0, "DOM query/factory result style assignment");
  }
  const directDomStyleMethod = new RegExp(
    String.raw`${directDomCall}\s*(?:\?\.|\.)\s*style\s*(?:\?\.|\.)\s*(?:setProperty|removeProperty)\s*\(`,
    "g",
  );
  for (const match of code.matchAll(directDomStyleMethod)) {
    reportDynamicStyle(match.index ?? 0, "DOM query/factory result style mutation");
  }
  const directDomClassName = new RegExp(
    String.raw`${directDomCall}\s*(?:\?\.|\.)\s*className\s*${assignmentOperator}`,
    "g",
  );
  for (const match of code.matchAll(directDomClassName)) {
    reportDynamicStyle(match.index ?? 0, "DOM query/factory result className assignment");
  }
  const directDomClassList = new RegExp(
    String.raw`${directDomCall}\s*(?:\?\.|\.)\s*classList\s*(?:\?\.|\.)\s*(?:add|remove|toggle|replace)\s*\(`,
    "g",
  );
  for (const match of code.matchAll(directDomClassList)) {
    reportDynamicStyle(match.index ?? 0, "DOM query/factory result classList mutation");
  }
  const styleAssignment = new RegExp(
    String.raw`\b([A-Za-z_$][\w$]*)${domChain}\s*(?:\?\.|\.)\s*style\s*(?:\?\.|\.)\s*([A-Za-z_$][\w$]*)\s*${assignmentOperator}`,
    "g",
  );
  for (const match of code.matchAll(styleAssignment)) {
    if (domChainIsProven(match[1], match[2])) reportDynamicStyle(match.index ?? 0, `${match[1]}.style.${match[3]} assignment`);
  }
  const styleMethod = new RegExp(
    String.raw`\b([A-Za-z_$][\w$]*)${domChain}\s*(?:\?\.|\.)\s*style\s*(?:\?\.|\.)\s*(setProperty|removeProperty)\s*\(`,
    "g",
  );
  for (const match of code.matchAll(styleMethod)) {
    if (domChainIsProven(match[1], match[2])) reportDynamicStyle(match.index ?? 0, `${match[1]}.style.${match[3]}()`);
  }
  const directStyleMethod = /\b([A-Za-z_$][\w$]*)\s*(?:\?\.|\.)\s*(setProperty|removeProperty)\s*\(/g;
  for (const match of code.matchAll(directStyleMethod)) {
    if (imperativeReferences.dom.has(match[1])) reportDynamicStyle(match.index ?? 0, `${match[1]}.${match[2]}()`);
  }
  const classNameAssignment = new RegExp(
    String.raw`\b([A-Za-z_$][\w$]*)${domChain}\s*(?:\?\.|\.)\s*className\s*${assignmentOperator}`,
    "g",
  );
  for (const match of code.matchAll(classNameAssignment)) {
    if (domChainIsProven(match[1], match[2])) reportDynamicStyle(match.index ?? 0, `${match[1]}.className assignment`);
  }
  const classListMutation = new RegExp(
    String.raw`\b([A-Za-z_$][\w$]*)${domChain}\s*(?:\?\.|\.)\s*classList\s*(?:\?\.|\.)\s*(add|remove|toggle|replace)\s*\(`,
    "g",
  );
  for (const match of code.matchAll(classListMutation)) {
    if (domChainIsProven(match[1], match[2])) reportDynamicStyle(match.index ?? 0, `${match[1]}.classList.${match[3]}()`);
  }
  for (const match of code.matchAll(/\bnew\s+CSSStyleSheet\s*\(/g)) {
    reportDynamicStyle(match.index ?? 0, "new CSSStyleSheet()");
  }
  const cssomMethod = /\b([A-Za-z_$][\w$]*)((?:\s*(?:\?\.|\.)\s*[A-Za-z_$][\w$]*|\s*\[[^\]\n]+\])*)\s*(?:\?\.|\.)\s*(insertRule|deleteRule|replaceSync|replace)\s*\(/g;
  for (const match of code.matchAll(cssomMethod)) {
    if (
      imperativeReferences.sheets.has(match[1])
      || /sheet$/i.test(match[1])
      || /\b(?:styleSheets|styleSheet|cssRules|sheet)\b/.test(match[2])
    ) {
      reportDynamicStyle(match.index ?? 0, `${match[1]}.${match[3]}()`);
    }
  }
  const adoptedSheets = /\b([A-Za-z_$][\w$]*)((?:\s*(?:\?\.|\.)\s*(?:current|shadowRoot|document|documentElement))*)\s*(?:\?\.|\.)\s*adoptedStyleSheets\s*(?:&&=|\|\|=|\?\?=|=(?!=))/g;
  for (const match of code.matchAll(adoptedSheets)) {
    if (domChainIsProven(match[1], match[2]) || /shadowRoot/i.test(match[1])) {
      reportDynamicStyle(match.index ?? 0, `${match[1]}.adoptedStyleSheets assignment`);
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
    if (["class", "classname", "style"].includes(attribute)) {
      addIssue(
        "PUI_DYNAMIC_STYLE",
        `setAttribute(${JSON.stringify(match[1])}) mutates DOM appearance outside Personal UI ownership`,
        match.index ?? 0,
      );
    } else if (attribute === "role") {
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
  const styleBlocks = [];
  const markup = clean.replace(
    /(<style\b[^>]*>)([\s\S]*?)(<\/style\s*>)/gi,
    (whole, opening, body, closing, offset) => {
      styleBlocks.push({ body, offset: offset + opening.length });
      return `${opening}${body.replace(/[^\n]/g, " ")}${closing}`;
    },
  );
  for (const block of styleBlocks) {
    issues.push(...scanStyle(file, block.body, context, { baseOffset: block.offset, lineSource: source }));
  }
  const stylesheetLink = /<\s*link\b[^>]*>/gi;
  for (const match of markup.matchAll(stylesheetLink)) {
    const opening = match[0];
    const rel = literalAttribute(opening, "rel")?.toLowerCase().split(/\s+/) ?? [];
    const as = literalAttribute(opening, "as")?.toLowerCase() ?? "";
    const href = literalAttribute(opening, "href");
    if ((rel.includes("stylesheet") || as === "style") && href && isRemoteStyleSpecifier(href)) {
      addIssue(
        "PUI_EXTERNAL_STYLE",
        `remote stylesheet link ${JSON.stringify(href)} is forbidden; keep application styles local and inspectable`,
        match.index ?? 0,
      );
    }
  }
  for (const match of markup.matchAll(/\bdata-pui[\w-]*/gi)) {
    addIssue("PUI_RESERVED_MARKER", `${match[0]} is reserved for bundled Personal UI source`, match.index ?? 0);
  }
  for (const match of markup.matchAll(/\bpui-[\w-]+/g)) {
    if (!LEGACY_PUBLIC_ROOT_CLASSES.has(match[0])) {
      addIssue("PUI_PRIVATE_CLASS", `Personal UI internal class token is forbidden: ${match[0]}`, match.index ?? 0);
    }
  }
  const pattern = /<\s*([a-z][\w-]*)(?=[\s>])/gi;
  for (const match of markup.matchAll(pattern)) {
    const tag = match[1].toLowerCase();
    const offset = match.index ?? 0;
    const end = markup.indexOf(">", offset);
    const opening = markup.slice(offset, end < 0 ? markup.length : end + 1);
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
    const styleProtectedExports = new Set(entries.flatMap((entry) => {
      if (!["component", "pattern"].includes(entry.kind) || STYLE_OVERRIDE_LAYOUT_ENTRY_IDS.has(entry.id)) return [];
      const nonVisual = new Set(Array.isArray(entry.nonVisualExports) ? entry.nonVisualExports : []);
      return (Array.isArray(entry.publicExports) ? entry.publicExports : []).filter((name) => !nonVisual.has(name));
    }));
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
    const context = {
      target,
      managedRoot,
      publicExports,
      styleProtectedExports,
      reservedComponentNames,
      forbiddenTags,
      forbiddenRoles,
      allowedExternalPackages,
    };
    for (const file of [...files].sort()) {
      const installedToolRoot = path.join(target, "tools", "personal-ui");
      if (isInside(file, managedRoot) || isInside(file, installedToolRoot)) continue;
      scannedFiles += 1;
      const source = fs.readFileSync(file, "utf8");
      const extension = path.extname(file).toLowerCase();
      if (STYLE_EXTENSIONS.has(extension)) issues.push(...scanStyle(file, source, context));
      else if (HTML_EXTENSIONS.has(extension)) issues.push(...scanHtml(file, source, context));
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
