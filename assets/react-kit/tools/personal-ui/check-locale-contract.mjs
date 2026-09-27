import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url));
const KIT_ROOT = path.resolve(TOOL_DIR, "../..");
const SOURCE_ROOT = path.join(KIT_ROOT, "src", "personal-ui");
const LOCALE_SOURCE = path.join(SOURCE_ROOT, "foundation", "locale.tsx");
const EXCEPTIONS_FILE = path.join(KIT_ROOT, "locale-hardcoded-exceptions.json");
const USER_FACING_ATTRIBUTES = new Set([
  "alt",
  "aria-description",
  "aria-label",
  "ariaLabel",
  "emptyDescription",
  "emptyTitle",
  "errorDescription",
  "errorTitle",
  "label",
  "loadingLabel",
  "placeholder",
  "title",
]);
const USER_FACING_PROPERTIES = new Set([
  "ariaLabel",
  "description",
  "emptyDescription",
  "emptyTitle",
  "errorDescription",
  "errorTitle",
  "label",
  "loadingLabel",
  "placeholder",
  "title",
]);
const HAN_TEXT = /[\u3400-\u9fff\uf900-\ufaff]/u;
const CJK_PUNCTUATION_TEXT = /[\u3000-\u303f\uff01-\uff0f\uff1a-\uff20\uff3b-\uff40\uff5b-\uff65]/u;
const LETTER_TEXT = /\p{L}/u;
const PLACEHOLDER = /\{([A-Za-z][A-Za-z0-9]*)\}/gu;

function normalizePath(file) {
  return file.split(path.sep).join("/");
}

function unwrapExpression(node) {
  let current = node;
  while (
    ts.isAsExpression(current)
    || ts.isSatisfiesExpression(current)
    || ts.isParenthesizedExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function propertyName(node, sourceFile) {
  if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)) return node.text;
  return node.getText(sourceFile);
}

function objectVariable(sourceFile, name) {
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== name || !declaration.initializer) continue;
      const initializer = unwrapExpression(declaration.initializer);
      if (ts.isObjectLiteralExpression(initializer)) return initializer;
    }
  }
  throw new Error(`Locale source is missing the ${name} object literal.`);
}

function stringMap(sourceFile, name) {
  const result = new Map();
  for (const property of objectVariable(sourceFile, name).properties) {
    if (!ts.isPropertyAssignment(property)) throw new Error(`${name} may contain only explicit properties.`);
    const value = unwrapExpression(property.initializer);
    if (!ts.isStringLiteral(value) && !ts.isNoSubstitutionTemplateLiteral(value)) {
      throw new Error(`${name}.${propertyName(property.name, sourceFile)} must be a static string.`);
    }
    result.set(propertyName(property.name, sourceFile), value.text);
  }
  return result;
}

function pluralMap(sourceFile, name) {
  const result = new Map();
  for (const property of objectVariable(sourceFile, name).properties) {
    if (!ts.isPropertyAssignment(property)) throw new Error(`${name} may contain only explicit properties.`);
    const formsNode = unwrapExpression(property.initializer);
    if (!ts.isObjectLiteralExpression(formsNode)) {
      throw new Error(`${name}.${propertyName(property.name, sourceFile)} must contain plural forms.`);
    }
    const forms = new Map();
    for (const form of formsNode.properties) {
      if (!ts.isPropertyAssignment(form)) throw new Error(`${name} plural forms must be explicit properties.`);
      const value = unwrapExpression(form.initializer);
      if (!ts.isStringLiteral(value) && !ts.isNoSubstitutionTemplateLiteral(value)) {
        throw new Error(`${name}.${propertyName(property.name, sourceFile)}.${propertyName(form.name, sourceFile)} must be a static string.`);
      }
      forms.set(propertyName(form.name, sourceFile), value.text);
    }
    result.set(propertyName(property.name, sourceFile), forms);
  }
  return result;
}

function placeholders(value) {
  return [...value.matchAll(PLACEHOLDER)].map((match) => match[1]).sort();
}

function sameValues(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function compareKeys(left, right, label, errors) {
  const leftKeys = [...left.keys()].sort();
  const rightKeys = [...right.keys()].sort();
  if (!sameValues(leftKeys, rightKeys)) {
    errors.push(`${label} keys differ: zh-CN=${leftKeys.join(", ")} en-US=${rightKeys.join(", ")}`);
  }
}

export function validateLocaleDictionaries(sourceText = fs.readFileSync(LOCALE_SOURCE, "utf8")) {
  const sourceFile = ts.createSourceFile(LOCALE_SOURCE, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const zhMessages = stringMap(sourceFile, "ZH_CN_MESSAGES");
  const enMessages = stringMap(sourceFile, "EN_US_MESSAGES");
  const zhPlurals = pluralMap(sourceFile, "ZH_CN_PLURALS");
  const enPlurals = pluralMap(sourceFile, "EN_US_PLURALS");
  const errors = [];

  compareKeys(zhMessages, enMessages, "Message", errors);
  compareKeys(zhPlurals, enPlurals, "Plural", errors);
  for (const [key, zhValue] of zhMessages) {
    const enValue = enMessages.get(key);
    if (enValue !== undefined && !sameValues(placeholders(zhValue), placeholders(enValue))) {
      errors.push(`Message ${key} uses different placeholders in zh-CN and en-US.`);
    }
  }
  for (const [key, zhForms] of zhPlurals) {
    const enForms = enPlurals.get(key);
    if (!zhForms.has("other")) errors.push(`Plural ${key} is missing zh-CN.other.`);
    if (!enForms?.has("other")) errors.push(`Plural ${key} is missing en-US.other.`);
    const expected = placeholders(zhForms.get("other") ?? "");
    for (const [locale, forms] of [["zh-CN", zhForms], ["en-US", enForms]] ) {
      if (!forms) continue;
      for (const [form, value] of forms) {
        if (!sameValues(expected, placeholders(value))) {
          errors.push(`Plural ${key}.${form} uses different placeholders in ${locale}.`);
        }
      }
    }
  }
  return errors;
}

function loadExceptions() {
  const document = JSON.parse(fs.readFileSync(EXCEPTIONS_FILE, "utf8"));
  if (document.schemaVersion !== 1 || !Array.isArray(document.exceptions)) {
    throw new Error("locale-hardcoded-exceptions.json must use schemaVersion 1 and an exceptions array.");
  }
  return document.exceptions.map((exception, index) => {
    for (const field of ["file", "kind", "value", "owner", "reason"]) {
      if (typeof exception[field] !== "string" || !exception[field].trim()) {
        throw new Error(`Locale exception ${index} has an invalid ${field}.`);
      }
    }
    return { ...exception, used: false };
  });
}

function exceptionMatches(exception, finding) {
  return exception.file === finding.file
    && exception.kind === finding.kind
    && exception.value === finding.value
    && (exception.attribute ?? null) === (finding.attribute ?? null);
}

function sourceFiles(root) {
  const files = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...sourceFiles(absolute));
    else if (/\.(?:ts|tsx)$/u.test(entry.name) && absolute !== LOCALE_SOURCE) files.push(absolute);
  }
  return files.sort();
}

export function collectHardcodedLocaleFindings(sourceText, relativeFile = "fixture.tsx") {
  const findings = [];
  const sourceFile = ts.createSourceFile(
    relativeFile,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    relativeFile.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const addFinding = (node, kind, value, attribute) => {
    findings.push({
      file: relativeFile,
      line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
      kind,
      value,
      ...(attribute ? { attribute } : {}),
    });
  };
  const visit = (node) => {
    const isTemplateFragment = node.kind === ts.SyntaxKind.TemplateHead
      || node.kind === ts.SyntaxKind.TemplateMiddle
      || node.kind === ts.SyntaxKind.TemplateTail;
    if (
      (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || isTemplateFragment)
      && (HAN_TEXT.test(node.text) || CJK_PUNCTUATION_TEXT.test(node.text))
    ) {
      addFinding(node, "language-string", node.text);
    }
    if (ts.isJsxText(node)) {
      const value = node.text.trim().replace(/\s+/gu, " ");
      if (value && LETTER_TEXT.test(value)) addFinding(node, "jsx-text", value);
    }
    if (ts.isJsxAttribute(node) && USER_FACING_ATTRIBUTES.has(node.name.text)) {
      const initializer = node.initializer;
      if (initializer && ts.isStringLiteral(initializer) && initializer.text) {
        addFinding(node, "attribute", initializer.text, node.name.text);
      }
    }
    if (ts.isPropertyAssignment(node)) {
      const name = propertyName(node.name, sourceFile);
      const initializer = unwrapExpression(node.initializer);
      if (
        USER_FACING_PROPERTIES.has(name)
        && (ts.isStringLiteral(initializer) || ts.isNoSubstitutionTemplateLiteral(initializer))
        && initializer.text
      ) {
        addFinding(node, "property", initializer.text, name);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return findings;
}

export function validateHardcodedLocaleOwnership() {
  const exceptions = loadExceptions();
  const findings = [];
  for (const file of sourceFiles(SOURCE_ROOT)) {
    const sourceText = fs.readFileSync(file, "utf8");
    const relativeFile = normalizePath(path.relative(KIT_ROOT, file));
    for (const finding of collectHardcodedLocaleFindings(sourceText, relativeFile)) {
      const exception = exceptions.find((candidate) => !candidate.used && exceptionMatches(candidate, finding));
      if (exception) exception.used = true;
      else findings.push(finding);
    }
  }

  for (const exception of exceptions.filter((candidate) => !candidate.used)) {
    findings.push({
      file: exception.file,
      line: 0,
      kind: "unused-exception",
      value: `${exception.owner}: ${exception.reason}`,
    });
  }
  return findings;
}

export function checkLocaleContract() {
  const errors = validateLocaleDictionaries();
  for (const finding of validateHardcodedLocaleOwnership()) {
    errors.push(`${finding.file}:${finding.line} ${finding.kind} ${JSON.stringify(finding.value)} is not locale-owned.`);
  }
  return errors;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = checkLocaleContract();
  if (errors.length) {
    console.error(`Locale contract failed (${errors.length}):`);
    errors.forEach((error) => console.error(`- ${error}`));
    process.exitCode = 1;
  } else {
    console.log("Locale contract verified: dictionaries and public source ownership are complete.");
  }
}
