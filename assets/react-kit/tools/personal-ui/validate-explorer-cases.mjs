#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createHash } from "node:crypto";
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
  if (!value) return undefined;
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
    const declaration = lexicalDeclaration(node, declarations);
    if (declaration && !visitedDeclarations.has(declaration)) queuedDeclarations.push(declaration);
  }

  function visit(node) {
    if (visitSelectedBranch(node, declarations, visit)) return;
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      if (ts.isIdentifier(node.tagName)) {
        for (const [exportName, localName] of bindings) {
          if (localName === node.tagName.text && !lexicalDeclaration(node.tagName, declarations)
            && stateModes.get(exportName) !== "hook" && stateModes.get(exportName) !== "constant") {
            evidence.add(exportName);
          }
        }
      }
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      for (const [exportName, localName] of bindings) {
        if (localName === node.expression.text && !lexicalDeclaration(node.expression, declarations)
          && stateModes.get(exportName) === "hook") evidence.add(exportName);
      }
    }
    if (ts.isIdentifier(node) && isRuntimeConstantUse(node)) {
      for (const [exportName, localName] of bindings) {
        if (localName === node.text && !lexicalDeclaration(node, declarations)
          && stateModes.get(exportName) === "constant") evidence.add(exportName);
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

const UNKNOWN_VALUE = Symbol("unresolved expression");
const JSX_LONG_CONTENT = Symbol("long rendered JSX content");

function objectProperties(node) {
  const properties = new Map();
  for (const property of node.properties ?? []) {
    const name = propertyName(property);
    if (name && ts.isPropertyAssignment(property)) properties.set(name, property.initializer);
    else if (name && ts.isShorthandPropertyAssignment(property)) properties.set(name, property.name);
  }
  return properties;
}

function jsxProperties(node) {
  const properties = new Map();
  for (const attribute of node.attributes?.properties ?? []) {
    if (!ts.isJsxAttribute(attribute)) continue;
    const name = attribute.name.getText();
    properties.set(name, !attribute.initializer ? true
      : ts.isJsxExpression(attribute.initializer) ? attribute.initializer.expression : attribute.initializer);
  }
  return properties;
}

function bindingContainsName(node, name) {
  if (ts.isIdentifier(node)) return node.text === name;
  if (ts.isArrayBindingPattern(node) || ts.isObjectBindingPattern(node)) {
    return node.elements.some((element) => ts.isBindingElement(element) && bindingContainsName(element.name, name));
  }
  return false;
}

function lexicalDeclaration(identifier, declarations) {
  let scope = identifier.parent;
  while (scope) {
    if (ts.isFunctionLike(scope)) {
      const parameter = scope.parameters.find((item) => bindingContainsName(item.name, identifier.text));
      if (parameter) return parameter; // Runtime arguments are intentionally unresolved.
    }
    if (ts.isBlock(scope) || ts.isSourceFile(scope)) {
      for (const statement of scope.statements) {
        if (ts.isVariableStatement(statement)) {
          const declaration = statement.declarationList.declarations.find((item) => bindingContainsName(item.name, identifier.text));
          if (declaration) return declaration;
        }
        if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) && statement.name?.text === identifier.text) return statement;
      }
    }
    if (ts.isCatchClause(scope) && scope.variableDeclaration && bindingContainsName(scope.variableDeclaration.name, identifier.text)) return scope.variableDeclaration;
    scope = scope.parent;
  }
  return declarations.get(identifier.text);
}

function staticValue(node, declarations, visited = new Set()) {
  if (node === true) return true;
  const value = unwrapExpression(node);
  if (!value) return UNKNOWN_VALUE;
  if (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value)) return value.text;
  if (ts.isNumericLiteral(value)) return Number(value.text);
  if (value.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (value.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (value.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isJsxElement(value)) return { [JSX_LONG_CONTENT]: longRenderedChildren(value.openingElement, declarations) };
  if (ts.isArrayLiteralExpression(value)) return value.elements.map((element) => staticValue(element, declarations, visited));
  if (ts.isObjectLiteralExpression(value)) return Object.fromEntries(
    [...objectProperties(value)].map(([key, expression]) => [key, staticValue(expression, declarations, visited)]),
  );
  if (ts.isPrefixUnaryExpression(value) && value.operator === ts.SyntaxKind.ExclamationToken) {
    const operand = staticValue(value.operand, declarations, visited);
    if (operand !== UNKNOWN_VALUE) return !operand;
  }
  if (ts.isIdentifier(value)) {
    const declaration = lexicalDeclaration(value, declarations);
    if (declaration && !visited.has(declaration) && ts.isVariableDeclaration(declaration)
      && ts.isIdentifier(declaration.name) && declaration.initializer
      && (declaration.parent.flags & ts.NodeFlags.Const)) {
      return staticValue(declaration.initializer, declarations, new Set([...visited, declaration]));
    }
  }
  if (ts.isCallExpression(value) && ts.isPropertyAccessExpression(value.expression)
    && value.expression.name.text === "repeat") {
    const text = staticValue(value.expression.expression, declarations, visited);
    const count = staticValue(value.arguments[0], declarations, visited);
    if (typeof text === "string" && Number.isInteger(count) && count > 0 && count <= 1000) return text.repeat(count);
  }
  return UNKNOWN_VALUE;
}

function visitSelectedBranch(node, declarations, visit) {
  if (ts.isIfStatement(node) || ts.isConditionalExpression(node)) {
    const condition = ts.isIfStatement(node) ? node.expression : node.condition;
    const selected = staticValue(condition, declarations);
    if (selected === UNKNOWN_VALUE) return false;
    visit(condition);
    const branch = ts.isIfStatement(node)
      ? selected ? node.thenStatement : node.elseStatement
      : selected ? node.whenTrue : node.whenFalse;
    if (branch) visit(branch);
    return true;
  }
  if (ts.isBinaryExpression(node) && [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(node.operatorToken.kind)) {
    const left = staticValue(node.left, declarations);
    if (left === UNKNOWN_VALUE) return false;
    visit(node.left);
    const evaluateRight = node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ? Boolean(left)
      : node.operatorToken.kind === ts.SyntaxKind.BarBarToken ? !left : left === null;
    if (evaluateRight) visit(node.right);
    return true;
  }
  return false;
}

function containsValue(value, predicate) {
  if (predicate(value)) return true;
  if (Array.isArray(value)) return value.some((item) => containsValue(item, predicate));
  if (value && typeof value === "object") return Object.values(value).some((item) => containsValue(item, predicate));
  return false;
}

function isLongText(value) {
  if (typeof value !== "string") return false;
  // Approximate visible width: Chinese and other wide scripts need fewer
  // characters than Latin text to exercise the same layout constraint.
  return [...value.trim()].reduce((width, character) => width
    + (/[\u1100-\u11ff\u2e80-\ua4cf\uac00-\ud7af\uf900-\ufaff\uff01-\uff60]/.test(character) ? 2 : 1), 0) >= 48;
}

function hasLongVisibleData(value, exportName) {
  if (isLongText(value)) return true;
  if (Array.isArray(value)) return value.some((item) => hasLongVisibleData(item, exportName));
  if (!value || typeof value !== "object") return false;
  if (value[JSX_LONG_CONTENT]) return true;
  const visibleKeys = ["label", "name", "displayName", "title", "header", "description", "summary", "text", "message", "content", "owner", "status", "children"];
  if (exportName === "DescriptionList") visibleKeys.push("value");
  if (["Gallery", "Lightbox"].includes(exportName)) visibleKeys.push("caption");
  return Object.entries(value).some(([key, item]) =>
    (visibleKeys.includes(key) || (key === "value" && item && typeof item === "object")) && hasLongVisibleData(item, exportName));
}

function hasProblemProps(properties, declarations, exportName) {
  return ["error", "invalid", "aria-invalid"].some((name) => {
    const value = staticValue(properties.get(name), declarations);
    return value === true || (typeof value === "string" && Boolean(value.trim()) && value !== "false");
  }) || ["error", "invalid"].includes(staticValue(properties.get("state"), declarations))
    || (["Alert", "Banner", "Toast", "Snackbar", "InlineMessage", "StatusIndicator", "Result", "Notification", "Badge", "Tag"].includes(exportName)
      && ["danger", "error"].includes(staticValue(properties.get("tone"), declarations)));
}

function toastCommandFields(node, declarations, bindings) {
  if (!ts.isCallExpression(node) || !ts.isIdentifier(node.expression)) return undefined;
  const declaration = lexicalDeclaration(node.expression, declarations);
  if (!declaration || !ts.isVariableDeclaration(declaration) || !ts.isObjectBindingPattern(declaration.name)) return undefined;
  const member = declaration.name.elements.find((item) => ts.isIdentifier(item.name) && item.name.text === node.expression.text);
  if (!member || (member.propertyName?.getText() ?? member.name.text) !== "toast") return undefined;
  const hook = unwrapExpression(declaration.initializer);
  if (!hook || !ts.isCallExpression(hook) || !ts.isIdentifier(hook.expression)
    || hook.expression.text !== bindings.get("useToast") || lexicalDeclaration(hook.expression, declarations)) return undefined;
  let ancestor = node.parent;
  while (ancestor && !ts.isJsxAttribute(ancestor)) ancestor = ancestor.parent;
  if (!ancestor || ancestor.name.getText() !== "onClick") return undefined;
  const trigger = ancestor.parent.parent;
  if (!(ts.isJsxOpeningElement(trigger) || ts.isJsxSelfClosingElement(trigger)) || !ts.isIdentifier(trigger.tagName)
    || trigger.tagName.text !== bindings.get("Button") || lexicalDeclaration(trigger.tagName, declarations)) return undefined;
  const triggerProps = jsxProperties(trigger);
  if (triggerProps.has("disabled") && staticValue(triggerProps.get("disabled"), declarations) !== false) return undefined;
  const options = unwrapExpression(node.arguments[0]);
  return options && ts.isObjectLiteralExpression(options) ? objectProperties(options) : undefined;
}

/** Structural source evidence only: this does not certify browser behavior or accessibility. */
function reachableStateInstances({ sourceFile, content, bindings, stateModes }) {
  const declarations = collectTopLevelDeclarations(sourceFile);
  const topLevel = collectTopLevelDeclarations(sourceFile);
  const instances = new Map([...bindings.keys()].map((name) => [name, []]));
  const visited = new Map();
  let previewName;
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)
      || statement.moduleSpecifier.text !== "../state-preview") continue;
    const named = statement.importClause?.namedBindings;
    if (!named || !ts.isNamedImports(named) || statement.importClause.isTypeOnly) continue;
    for (const specifier of named.elements) {
      if (!specifier.isTypeOnly && (specifier.propertyName?.text ?? specifier.name.text) === "StatePreview") {
        previewName = specifier.name.text;
      }
    }
  }

  function visit(node, context) {
    if (visitSelectedBranch(node, declarations, (child) => visit(child, context))) return;
    if (ts.isJsxElement(node)) {
      visit(node.openingElement, context);
      const properties = jsxProperties(node.openingElement);
      const tag = ts.isIdentifier(node.openingElement.tagName) ? node.openingElement.tagName.text : undefined;
      const unshadowed = ts.isIdentifier(node.openingElement.tagName) && !lexicalDeclaration(node.openingElement.tagName, declarations);
      const state = previewName && tag === previewName && unshadowed ? staticValue(properties.get("state"), declarations) : undefined;
      const childContext = {
        environments: new Set(context.environments),
        validation: context.validation || (unshadowed && tag === bindings.get("Field") && hasProblemProps(properties, declarations)),
        longContent: context.longContent || (unshadowed && tag === bindings.get("Field")
          && ["label", "description", "hint"].some((name) => isLongText(staticValue(properties.get(name), declarations)))),
        toastOwners: [...context.toastOwners],
      };
      if (unshadowed && tag === bindings.get("ToastProvider")) {
        const owner = instances.get("ToastProvider").find((instance) => instance.node === node.openingElement);
        if (owner) childContext.toastOwners.push(owner);
      }
      if (["dark", "mobile", "locale", "overlay"].includes(state)) childContext.environments.add(state);
      for (const child of node.children) visit(child, childContext);
      return;
    }
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && ts.isIdentifier(node.tagName)) {
      for (const [exportName, localName] of bindings) {
        if (localName === node.tagName.text && !lexicalDeclaration(node.tagName, declarations)
          && !["hook", "constant"].includes(stateModes.get(exportName))) {
          instances.get(exportName).push({ node, context, exportName, properties: jsxProperties(node), toastCommands: [] });
        }
      }
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      if (context.toastOwners.length) {
        const command = toastCommandFields(node, declarations, bindings);
        if (command) for (const owner of context.toastOwners) owner.toastCommands.push(command);
      }
      for (const [exportName, localName] of bindings) {
        if (localName === node.expression.text && !lexicalDeclaration(node.expression, declarations)
          && stateModes.get(exportName) === "hook") {
          instances.get(exportName).push({ node, context, exportName, properties: new Map() });
        }
      }
    }
    if (ts.isIdentifier(node) && isRuntimeConstantUse(node)) {
      for (const [exportName, localName] of bindings) {
        if (localName === node.text && !lexicalDeclaration(node, declarations) && stateModes.get(exportName) === "constant") {
          instances.get(exportName).push({ node, context, exportName, properties: new Map() });
        }
      }
    }
    if (ts.isIdentifier(node) && !isDeclarationName(node) && !isTypePosition(node)) {
      const declaration = lexicalDeclaration(node, topLevel);
      const key = `${[...context.environments].sort().join(",")}:${context.validation}:${context.longContent}:${context.toastOwners.map((owner) => owner.node.pos).join(",")}`;
      const seen = visited.get(declaration) ?? new Set();
      if (declaration && !seen.has(key)) {
        seen.add(key);
        visited.set(declaration, seen);
        visit(declaration, context);
      }
    }
    ts.forEachChild(node, (child) => visit(child, context));
  }
  visit(content, { environments: new Set(), validation: false, longContent: false, toastOwners: [] });
  return { instances, declarations };
}

function callbackRejects(node, declarations) {
  let expression = unwrapExpression(node);
  if (expression && ts.isIdentifier(expression)) {
    const declaration = lexicalDeclaration(expression, declarations);
    expression = declaration && ts.isVariableDeclaration(declaration) ? declaration.initializer : declaration;
  }
  if (!expression) return false;
  let rejects = false;
  function visit(child) {
    if (child !== expression && ts.isFunctionLike(child)) return;
    if (visitSelectedBranch(child, declarations, visit)) return;
    if (ts.isThrowStatement(child)) rejects = true;
    if (ts.isCallExpression(child) && ts.isPropertyAccessExpression(child.expression)
      && child.expression.getText() === "Promise.reject"
      && !lexicalDeclaration(child.expression.expression, declarations)) rejects = true;
    ts.forEachChild(child, visit);
  }
  visit(expression);
  return rejects;
}

function callbackReturnsTrue(node, declarations) {
  let expression = unwrapExpression(node);
  if (expression && ts.isIdentifier(expression)) {
    const declaration = lexicalDeclaration(expression, declarations);
    expression = declaration && ts.isVariableDeclaration(declaration) ? declaration.initializer : declaration;
  }
  if (!expression || !ts.isFunctionLike(expression) || !expression.body) return false;
  if (!ts.isBlock(expression.body)) return staticValue(expression.body, declarations) === true;
  const statements = expression.body.statements;
  return statements.length === 1 && ts.isReturnStatement(statements[0])
    && staticValue(statements[0].expression, declarations) === true;
}

function callbackWaits(node, declarations) {
  let expression = unwrapExpression(node);
  if (expression && ts.isIdentifier(expression)) {
    const declaration = lexicalDeclaration(expression, declarations);
    expression = declaration && ts.isVariableDeclaration(declaration) ? declaration.initializer : declaration;
  }
  if (!expression) return false;
  let delay = false;
  function visitExecutor(child) {
    if (ts.isFunctionLike(child)) return;
    if (visitSelectedBranch(child, declarations, visitExecutor)) return;
    const timer = ts.isCallExpression(child) && ((ts.isIdentifier(child.expression) && child.expression.text === "setTimeout"
      && !lexicalDeclaration(child.expression, declarations)) || (ts.isPropertyAccessExpression(child.expression)
      && ts.isIdentifier(child.expression.expression) && child.expression.expression.text === "window"
      && child.expression.name.text === "setTimeout" && !lexicalDeclaration(child.expression.expression, declarations)));
    if (timer) {
      const duration = staticValue(child.arguments[1], declarations);
      if (typeof duration === "number" && duration >= 100) delay = true;
    }
    ts.forEachChild(child, visitExecutor);
  }
  function visit(child) {
    if (child !== expression && ts.isFunctionLike(child)) return;
    if (visitSelectedBranch(child, declarations, visit)) return;
    if (ts.isAwaitExpression(child)) {
      const awaited = unwrapExpression(child.expression);
      if (ts.isNewExpression(awaited) && ts.isIdentifier(awaited.expression) && awaited.expression.text === "Promise"
        && !lexicalDeclaration(awaited.expression, declarations)) {
        const executor = awaited.arguments?.[0];
        if (executor && (ts.isArrowFunction(executor) || ts.isFunctionExpression(executor))) visitExecutor(executor.body);
      }
    }
    ts.forEachChild(child, visit);
  }
  visit(expression);
  return delay;
}

function callbackStaticResults(node, declarations) {
  let expression = unwrapExpression(node);
  if (expression && ts.isIdentifier(expression)) {
    const declaration = lexicalDeclaration(expression, declarations);
    expression = declaration && ts.isVariableDeclaration(declaration) ? declaration.initializer : declaration;
  }
  if (!expression || !ts.isFunctionLike(expression) || !expression.body) return [];
  if (!ts.isBlock(expression.body)) return [staticValue(expression.body, declarations)];
  const results = [];
  function visit(child) {
    if (child !== expression && ts.isFunctionLike(child)) return;
    if (visitSelectedBranch(child, declarations, visit)) return;
    if (ts.isReturnStatement(child)) results.push(staticValue(child.expression, declarations));
    ts.forEachChild(child, visit);
  }
  visit(expression);
  return results;
}

function callbackReturnsFirstParameter(node, declarations) {
  let expression = unwrapExpression(node);
  if (expression && ts.isIdentifier(expression)) {
    const declaration = lexicalDeclaration(expression, declarations);
    expression = declaration && ts.isVariableDeclaration(declaration) ? declaration.initializer : declaration;
  }
  if (!expression || !ts.isFunctionLike(expression) || !expression.body
    || !expression.parameters[0] || !ts.isIdentifier(expression.parameters[0].name)) return false;
  const parameter = expression.parameters[0];
  let returned = expression.body;
  if (ts.isBlock(returned)) {
    if (returned.statements.length !== 1 || !ts.isReturnStatement(returned.statements[0])) return false;
    returned = returned.statements[0].expression;
  }
  returned = unwrapExpression(returned);
  return Boolean(returned && ts.isIdentifier(returned) && returned.text === parameter.name.text
    && lexicalDeclaration(returned, declarations) === parameter);
}

function longRenderedChildren(node, declarations) {
  if (!ts.isJsxOpeningElement(node)) return false;
  let long = false;
  function visit(child) {
    if (visitSelectedBranch(child, declarations, visit)) return;
    if (ts.isJsxText(child) && isLongText(child.text)) long = true;
    if (ts.isJsxExpression(child)) {
      const text = staticValue(child.expression, declarations);
      if (isLongText(text)) long = true;
    }
    ts.forEachChild(child, visit);
  }
  for (const child of node.parent.children) visit(child);
  return long;
}

function realizesState(state, instance, declarations, instructions) {
  const { properties, node, context, exportName } = instance;
  const value = (name) => staticValue(properties.get(name), declarations);
  const truthy = (name) => value(name) === true;
  const falseOrAbsent = (name) => !properties.has(name) || value(name) === false;
  const hasCallback = (name) => properties.has(name) && properties.get(name) !== undefined;
  const delayedAction = (name) => Boolean(instructions?.trim()) && callbackWaits(properties.get(name), declarations);
  const rejectedAction = (name) => Boolean(instructions?.trim()) && callbackRejects(properties.get(name), declarations);
  const issues = value("issues");
  const memberResults = exportName === "MemberManagementPage" ? callbackStaticResults(properties.get("fetchMembers"), declarations) : [];
  if (state === "usage") return true;
  if (state === "default") return !truthy("disabled") && !truthy("readOnly") && !truthy("loading")
    && !["loading", "empty", "error", "invalid"].includes(value("state"))
    && !hasProblemProps(properties, declarations, exportName) && !context.validation;
  if (["dark", "mobile", "locale", "overlay"].includes(state)) return context.environments.has(state);
  if (state === "keyboard") return Boolean(instructions?.trim());
  if (state === "disabled" || state === "readOnly") {
    return truthy(state) || (state === "disabled" && exportName === "Calendar"
      && callbackReturnsTrue(properties.get("isDateDisabled"), declarations))
      || (state === "disabled" && exportName === "CreateEditPage" && truthy("submitDisabled"))
      || (state === "disabled" && exportName === "WizardFlow" && truthy("nextDisabled"))
      || (state === "readOnly" && exportName === "Stepper" && !hasCallback("onStepChange"))
      || [...properties.values()].some((expression) => containsValue(
      staticValue(expression, declarations),
      (item) => Boolean(item && typeof item === "object" && item[state] === true),
    ));
  }
  if (state === "loading") return truthy("loading") || value("state") === "loading"
    || (exportName === "Form" && truthy("busy"))
    || (exportName === "Attachment" && truthy("downloading"))
    || (exportName === "ErrorState" && truthy("retryLoading") && hasCallback("onRetry"))
    || (exportName === "CreateEditPage" && truthy("submitting"))
    || (exportName === "WizardFlow" && truthy("nextLoading"))
    || (exportName === "ImportExportPage" && ((truthy("importing") && hasCallback("onImport")) || (truthy("exporting") && hasCallback("onExport"))))
    || (exportName === "Pagination" && ((Number.isInteger(value("loadingPage")) && value("loadingPage") >= 1
      && value("loadingPage") <= value("pageCount")) || (truthy("loadingPageSize") && hasCallback("onPageSizeChange"))))
    || (exportName === "AsyncAction" && delayedAction("onAction"))
    || (exportName === "FamilyLoginPage" && delayedAction("onSubmit"))
    || (exportName === "MemberManagementPage" && delayedAction("fetchMembers"))
    || (exportName === "ToastProvider" && Boolean(instructions?.trim()) && instance.toastCommands.some((command) => {
      const action = unwrapExpression(command.get("action"));
      return action && ts.isObjectLiteralExpression(action) && callbackWaits(objectProperties(action).get("onClick"), declarations);
    }))
    || (exportName === "FileUpload" && containsValue(value("items"),
      (item) => Boolean(item && typeof item === "object" && item.status === "uploading")))
    || (exportName === "InlineEdit" && Boolean(instructions?.trim()) && callbackWaits(properties.get("onCommit"), declarations))
    || (["ConfirmDialog", "Popconfirm"].includes(exportName) && Boolean(instructions?.trim())
      && callbackWaits(properties.get("onConfirm"), declarations))
    || [...properties.values()].some((expression) => containsValue(staticValue(expression, declarations),
      (item) => Boolean(item && typeof item === "object" && item.loading === true)));
  if (state === "validation") return hasProblemProps(properties, declarations) || context.validation
    || (exportName === "ValidationSummary" && Array.isArray(issues) && issues.length > 0)
    || (exportName === "FamilyLoginPage" && Boolean(instructions?.trim()) && hasCallback("onSubmit")
      && Array.isArray(value("products")) && value("products").length > 0);
  if (state === "error") return hasProblemProps(properties, declarations, exportName)
    || (exportName === "FileUpload" && containsValue(value("items"),
      (item) => Boolean(item && typeof item === "object" && item.status === "error")))
    || (exportName === "InlineEdit" && Boolean(instructions?.trim()) && callbackRejects(properties.get("onCommit"), declarations))
    || (exportName === "Avatar" && value("src") === "data:image/png;base64,aW52YWxpZA==")
    || exportName === "ErrorState"
    || (exportName === "ValidationSummary" && Array.isArray(issues) && issues.length > 0)
    || (exportName === "Stepper" && containsValue(value("steps"), (item) => item && typeof item === "object" && item.status === "error"))
    || (exportName === "StatusPage" && ["error", "permission", "offline"].includes(value("kind")))
    || (exportName === "AsyncAction" && rejectedAction("onAction"))
    || (exportName === "FamilyLoginPage" && rejectedAction("onSubmit"))
    || (exportName === "MemberManagementPage" && rejectedAction("fetchMembers"))
    || (exportName === "ToastProvider" && Boolean(instructions?.trim()) && instance.toastCommands.some((command) =>
      ["danger", "error"].includes(staticValue(command.get("tone"), declarations))))
    || (exportName === "TreeTable" && callbackRejects(properties.get("onRequestChildren"), declarations))
    || (["ConfirmDialog", "Popconfirm"].includes(exportName) && Boolean(instructions?.trim())
      && callbackRejects(properties.get("onConfirm"), declarations))
    || (exportName === "Lightbox" && containsValue(value("items"),
      (item) => Boolean(item && typeof item === "object" && item.src === "data:image/png;base64,aW52YWxpZA==")));
  if (state === "empty") return value("state") === "empty"
    || ["EmptyState", "NoResults"].includes(exportName)
    || (exportName === "StatusPage" && (!properties.has("kind") || value("kind") === "empty"))
    || (exportName === "Pagination" && value("total") === 0)
    || (exportName === "MasterDetail" && value("detailOpen") === false && properties.has("emptyDetail"))
    || (exportName === "MemberManagementPage" && memberResults.some((result) => result && Array.isArray(result.items) && result.items.length === 0 && result.total === 0))
    || (exportName === "InlineEdit" && value("value") === "")
    || (exportName === "Badge" && value("count") === 0 && falseOrAbsent("showZero") && falseOrAbsent("dot")
      && (!properties.has("content") || value("content") === null))
    || (["ButtonGroup", "AvatarGroup"].includes(exportName) && (ts.isJsxSelfClosingElement(node)
      || (ts.isJsxOpeningElement(node) && node.parent.children.every((child) => ts.isJsxText(child) && !child.text.trim()))))
    || ["rows", "nodes", "items", "events", "slides", "steps", "options", "data", "value", "files",
      ...(exportName === "CommandPalette" ? ["commands"] : []), ...(exportName === "ValidationSummary" ? ["issues"] : []),
      ...(exportName === "FamilyLoginPage" ? ["products"] : []), ...(["SettingsPage", "DetailPage"].includes(exportName) ? ["sections"] : [])].some((name) => {
      const candidate = value(name);
      return Array.isArray(candidate) && candidate.length === 0;
    });
  if (state === "uncontrolled") return [...properties.keys()].some((name) => /^default[A-Z]/.test(name))
    && !["value", "checked", "pressed", "open", "expandedIds", "sort", "page", "selectedIds", "selectedKeys", "activeId"]
      .filter((name) => name !== "value" || !["Checkbox", "Radio", "Switch"].includes(exportName))
      .some((name) => properties.has(name));
  if (state === "controlled") {
    const componentPairs = {
      FileUpload: ["items", "onFiles"], InlineEdit: ["value", "onCommit"],
      Scheduler: ["date", "onDateChange"], SortableList: ["items", "onReorder"], Gallery: ["selectedId", "onSelect"],
      Stepper: ["currentId", "onStepChange"], AnchorNavigation: ["activeId", "onNavigate"],
      WizardFlow: ["currentId", "onStepChange"], SettingsPage: ["currentId", "onCurrentChange"],
    };
    const pair = componentPairs[exportName];
    if (pair && properties.has(pair[0]) && properties.has(pair[1]) && properties.get(pair[1]) !== undefined) return true;
    const pairs = {
      value: ["onChange", "onValueChange"], checked: ["onChange", "onCheckedChange"],
      open: ["onOpenChange"], expandedIds: ["onExpandedChange"], sort: ["onSort"],
      pressed: ["onPressedChange"],
      page: ["onPageChange"], selectedIds: ["onSelectionChange"], selectedKeys: ["onSelectionChange"],
      activeId: ["onActiveChange"],
    };
    return Object.entries(pairs).filter(([name]) => name !== "value" || !["Checkbox", "Radio", "Switch"].includes(exportName))
      .some(([name, callbacks]) => properties.has(name)
      && callbacks.some((callback) => properties.has(callback) && properties.get(callback) !== undefined));
  }
  if (state === "longContent") {
    if (context.longContent) return true;
    const textProps = ["label", "value", "defaultValue", "title", "description", "items", "steps", "options", "rows", "nodes", "columns", "code", "content"];
    const ownTextProps = { Attachment: ["name"], Media: ["caption"], Carousel: ["slides"], Scheduler: ["events"], BarChart: ["data"],
      ResizablePanels: ["first", "second"], Pagination: ["summary"], ValidationSummary: ["issues"],
      CommandPalette: ["commands"], SettingsPage: ["sections"], DetailPage: ["sections"],
      StatusPage: ["statusTitle", "statusDescription"], FamilyLoginPage: ["products"], KeyboardShortcut: ["keys"] };
    textProps.push(...(ownTextProps[exportName] ?? []));
    if (exportName === "SortableList" && callbackReturnsFirstParameter(properties.get("renderItem"), declarations)) {
      const items = value("items");
      if (Array.isArray(items) && items.some((item) => item && hasLongVisibleData(item.value, exportName))) return true;
    }
    if (exportName === "MemberManagementPage" && memberResults.some((result) => result && hasLongVisibleData(result.items, exportName))) return true;
    if (exportName === "ToastProvider" && Boolean(instructions?.trim()) && instance.toastCommands.some((command) =>
      ["title", "description"].some((name) => hasLongVisibleData(staticValue(command.get(name), declarations), exportName)))) return true;
    if ([...properties].filter(([name]) => textProps.includes(name)
      && (exportName !== "SortableList" || name !== "items")
      && (!["Checkbox", "Radio", "Switch"].includes(exportName) || !["value", "defaultValue"].includes(name)))
      .some(([, expression]) => hasLongVisibleData(staticValue(expression, declarations), exportName))) return true;
    return longRenderedChildren(node, declarations);
  }
  return false;
}

function stateExamplesEvidence({ sourceFile, properties, expectation, bindings, repositoryPath }) {
  const errors = [];
  const evidence = Object.fromEntries(expectation.exports.map((name) => [name, []]));
  const examplesNode = unwrapExpression(properties.get("stateExamples"));
  if (!examplesNode || !ts.isArrayLiteralExpression(examplesNode)) {
    errors.push(`${repositoryPath}: stateExamples must be an inline array of runnable per-state/per-export fixtures; state labels are not coverage`);
  } else {
    const declared = new Set();
    for (const [index, element] of examplesNode.elements.entries()) {
      const example = unwrapExpression(element);
      const prefix = `${repositoryPath}: stateExamples[${index}]`;
      if (!ts.isObjectLiteralExpression(example)) {
        errors.push(`${prefix} must be an object literal`);
        continue;
      }
      const fields = objectProperties(example);
      const state = literalText(fields.get("state"));
      const namesNode = unwrapExpression(fields.get("exports"));
      const names = namesNode && ts.isArrayLiteralExpression(namesNode)
        ? namesNode.elements.map((name) => literalText(name)) : [];
      if (!VALID_STATES.includes(state)) errors.push(`${prefix} has an invalid state`);
      if (!namesNode || !ts.isArrayLiteralExpression(namesNode) || !names.length
        || names.some((name) => !expectation.exports.includes(name)) || unique(names).length !== names.length) {
        errors.push(`${prefix} exports must be a non-empty unique inline array from this family`);
        continue;
      }
      const content = fields.get("content");
      if (!content) { errors.push(`${prefix} is missing runnable content`); continue; }
      const instructions = literalText(fields.get("instructions"));
      const runtime = reachableStateInstances({ sourceFile, content, bindings, stateModes: expectation.stateModes });
      for (const exportName of names) {
        const key = `${exportName}:${state}`;
        if (declared.has(key)) errors.push(`${prefix} duplicates ${key}`);
        declared.add(key);
        if (!expectation.statesByExport.get(exportName)?.includes(state)) {
          errors.push(`${prefix}: ${key} is not applicable to this export`);
          continue;
        }
        const instances = runtime.instances.get(exportName) ?? [];
        if (!instances.some((instance) => realizesState(state, instance, runtime.declarations, instructions))) {
          errors.push(`${prefix}: ${key} needs reachable state-specific source evidence, not a label or unchanged JSX`);
        } else {
          evidence[exportName].push({ state, file: repositoryPath, exampleIndex: index,
            verification: state === "keyboard" ? "manual-interaction-fixture" : "runnable-source-fixture" });
        }
      }
    }
  }
  const gaps = [];
  for (const exportName of expectation.exports) {
    for (const state of expectation.statesByExport.get(exportName) ?? []) {
      if (!evidence[exportName].some((item) => item.state === state)) gaps.push({ export: exportName, state });
    }
  }
  if (gaps.length) errors.push(`${repositoryPath}: missing realized state(s): ${gaps.map((item) => `${item.export}:${item.state}`).join(", ")}`);
  return { evidence, errors, gaps };
}

/** Inventory helper for safely binding already existing scenes, without inventing states. */
export function inspectExplorerContentStates({ sourceText, filePath = "explorer.case.tsx", statesByExport, stateModes, instructions }) {
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const errors = [];
  if (sourceFile.parseDiagnostics?.length) {
    return { errors: ["Explorer source has TypeScript parse diagnostics"], realizedStates: {}, contentExpression: undefined };
  }
  const declarations = collectTopLevelDeclarations(sourceFile);
  const object = defaultCaseObject(sourceFile, declarations, errors, filePath);
  if (!object) return { errors, realizedStates: {}, contentExpression: undefined };
  const properties = caseProperties(object, errors, filePath);
  const content = properties.get("content");
  if (!content) return { errors, realizedStates: {}, contentExpression: undefined };
  const bindings = importedBindings(sourceFile, errors, filePath);
  const runtime = reachableStateInstances({ sourceFile, content, bindings, stateModes: new Map(Object.entries(stateModes)) });
  const realizedStates = {};
  for (const [exportName, states] of Object.entries(statesByExport)) {
    const instances = runtime.instances.get(exportName) ?? [];
    realizedStates[exportName] = states.filter((state) => instances.some((instance) =>
      realizesState(state, instance, runtime.declarations, instructions)));
  }
  return { errors, realizedStates, contentExpression: content.getText(sourceFile) };
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
    const statesByExport = new Map();
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
      statesByExport.set(exportName, metadata.applicableStates);
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
      statesByExport,
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

export function validateExplorerCases({ kitRoot = process.cwd(), requireStateExamples = true, familyIds = [] } = {}) {
  const resolvedKitRoot = path.resolve(kitRoot);
  const skillRoot = path.resolve(resolvedKitRoot, "../..");
  const casesRoot = path.join(resolvedKitRoot, "src", "explorer", "cases");
  const manifest = readJson(path.join(resolvedKitRoot, "component-manifest.json"));
  const documentation = readJson(path.join(resolvedKitRoot, "component-docs.json"));
  const registry = readJson(path.join(resolvedKitRoot, "registry.json"));
  const errors = [];
  const allExpected = expectedCases({ manifest, documentation, registry, errors });
  const selectedIds = new Set(familyIds);
  for (const familyId of selectedIds) {
    if (![...allExpected.values()].some((item) => item.familyId === familyId)) errors.push(`unknown Explorer family: ${familyId}`);
  }
  const expected = selectedIds.size ? new Map([...allExpected].filter(([, item]) => selectedIds.has(item.familyId))) : allExpected;
  const actualFiles = listCaseFiles(casesRoot).filter((filePath) =>
    !selectedIds.size || expected.has(toPosix(path.relative(casesRoot, filePath))));
  const actualRelative = new Set(actualFiles.map((filePath) => toPosix(path.relative(casesRoot, filePath))));

  for (const relativePath of expected.keys()) {
    if (!actualRelative.has(relativePath)) errors.push(`missing Explorer case: ${relativePath}`);
  }
  for (const relativePath of actualRelative) {
    if (!expected.has(relativePath)) errors.push(`unexpected Explorer case: ${relativePath}`);
  }

  const evidence = Object.fromEntries((registry.exports ?? []).map((exportName) => [exportName, []]));
  const cases = [];
  const stateCoverage = { complete: true, verificationKind: "structural-source-fixtures", behavioralVerification: false,
    contextRequiresIndependentReview: true, errors: [], gaps: [], evidence: {} };
  const sourceHashes = {};
  for (const relativePath of ["component-manifest.json", "component-docs.json", "registry.json", "src/explorer/cases/state-preview.tsx"]) {
    const filePath = path.join(resolvedKitRoot, relativePath);
    if (fs.existsSync(filePath)) sourceHashes[relativePath] = createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
  }
  for (const filePath of actualFiles) {
    const relativePath = toPosix(path.relative(casesRoot, filePath));
    const expectation = expected.get(relativePath);
    if (!expectation) continue;
    const repositoryPath = toPosix(path.relative(skillRoot, filePath));
    const sourceText = fs.readFileSync(filePath, "utf8");
    sourceHashes[toPosix(path.relative(resolvedKitRoot, filePath))] = createHash("sha256").update(sourceText).digest("hex");
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
    const realizedStates = stateExamplesEvidence({ sourceFile, properties, expectation, bindings, repositoryPath });
    stateCoverage.errors.push(...realizedStates.errors);
    stateCoverage.gaps.push(...realizedStates.gaps.map((gap) => ({ ...gap, family: expectation.familyId, file: repositoryPath })));
    Object.assign(stateCoverage.evidence, realizedStates.evidence);
    if (requireStateExamples) errors.push(...realizedStates.errors);
    for (const exportName of expectation.exports) {
      if (!runtimeEvidence.has(exportName)) {
        const mode = expectation.stateModes.get(exportName);
        const usage = mode === "hook" ? "a reachable CallExpression" : mode === "constant" ? "a reachable runtime expression or prop" : "reachable JSX";
        errors.push(`${repositoryPath}: ${exportName} needs ${usage}; import, comment, string, and void references are not evidence`);
      } else {
        evidence[exportName].push(repositoryPath);
      }
    }
    cases.push({ id: expectation.caseId, family: expectation.familyId, file: repositoryPath, applicableStates: states,
      stateCoverageComplete: realizedStates.errors.length === 0 });
  }

  stateCoverage.complete = stateCoverage.errors.length === 0 && errors.length === 0 && cases.length === expected.size;
  return {
    ok: errors.length === 0,
    errors,
    evidence,
    cases,
    stateCoverage,
    selectedFamilies: [...selectedIds],
    sourceHashes,
    expectedCaseCount: expected.size,
    verifiedCaseCount: cases.length,
  };
}

function parseArguments(argv) {
  const options = { kitRoot: process.cwd(), json: false, requireStateExamples: true, familyIds: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--json") options.json = true;
    else if (argument === "--inventory") options.requireStateExamples = false;
    else if (argument === "--family") {
      const familyId = argv[++index];
      if (!familyId || familyId.startsWith("--")) throw new Error("--family requires a family id");
      options.familyIds.push(...familyId.split(",").map((item) => item.trim()).filter(Boolean));
    }
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
    const result = validateExplorerCases({ kitRoot: options.kitRoot, requireStateExamples: options.requireStateExamples, familyIds: options.familyIds });
    if (options.json) process.stdout.write(`${JSON.stringify(result)}\n`);
    else if (result.ok) process.stdout.write(`Explorer cases verified: ${result.verifiedCaseCount}/${result.expectedCaseCount}; realized states ${result.stateCoverage.complete ? "complete" : `pending (${result.stateCoverage.gaps.length} gaps)`}\n`);
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
