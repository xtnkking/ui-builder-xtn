import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const forbidden = new Set(["classname", "style", "css", "sx", "tw", "ref", "dangerouslysetinnerhtml", "internalclassname"]);
const knownMarkers = new Set(["data-pui-owner", "data-pui-floating-root", "data-pui-form-bridge", "data-pui-portal-source", "data-pui-toast-portal-root", "data-pui-slot"]);

// Both provenance entry points use this compiler-backed implementation. Never
// evaluate application code to discover a spread's properties.
export function createTypedUsageInspector(target, files, overrides = new Map()) {
  let ts;
  try { ts = createRequire(path.join(target, "package.json"))("typescript"); }
  catch { ts = createRequire(import.meta.url)("typescript"); }
  const config = ts.findConfigFile(target, ts.sys.fileExists, "tsconfig.json");
  const parsed = config ? ts.getParsedCommandLineOfConfigFile(config, {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic() {} }) : null;
  const options = {
    target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler, jsx: ts.JsxEmit.ReactJSX,
    strict: true, esModuleInterop: true, skipLibCheck: true,
    ...parsed?.options, noEmit: true, allowJs: true, checkJs: true,
  };
  const host = ts.createCompilerHost(options);
  const readFile = host.readFile.bind(host);
  const fileExists = host.fileExists.bind(host);
  const getSourceFile = host.getSourceFile.bind(host);
  const key = (file) => path.resolve(file).replaceAll("\\", "/").toLowerCase();
  const virtual = new Map([...overrides].map(([file, source]) => [key(file), source]));
  // React owns `key` through JSX.IntrinsicAttributes, not the component's
  // ButtonProps/InputProps parameter. Resolve that actual installed contract
  // instead of inventing a key whitelist or weakening component prop checks.
  const intrinsicFile = path.join(target, "node_modules", ".personal-ui-verifier-types", "attributes.ts");
  virtual.set(key(intrinsicFile), 'import type { JSX } from "react"; type PUIReactIntrinsicAttributes = JSX.IntrinsicAttributes;');
  host.readFile = (file) => virtual.get(key(file)) ?? readFile(file);
  host.fileExists = (file) => virtual.has(key(file)) || fileExists(file);
  host.getSourceFile = (file, languageVersion, onError, shouldCreateNewSourceFile) => virtual.has(key(file))
    ? ts.createSourceFile(file, virtual.get(key(file)), languageVersion, true)
    : getSourceFile(file, languageVersion, onError, shouldCreateNewSourceFile);
  host.resolveModuleNames = (names, containingFile) => names.map((name) => {
    const local = ts.resolveModuleName(name, containingFile, options, host).resolvedModule;
    if (local || name.startsWith(".") || name.startsWith("/")) return local;
    // The verifier is also run from the source kit in installer contract tests.
    // Its own dependencies are valid compiler dependencies; no ambient stubs.
    return ts.resolveModuleName(name, fileURLToPath(import.meta.url), options, host).resolvedModule;
  });
  const program = ts.createProgram([...new Set([...files, ...overrides.keys(), intrinsicFile])], options, host);
  const checker = program.getTypeChecker();
  const intrinsicAlias = program.getSourceFile(intrinsicFile)?.statements.find(ts.isTypeAliasDeclaration);
  const intrinsicAttributes = intrinsicAlias ? checker.getTypeFromTypeNode(intrinsicAlias.type) : undefined;
  const intrinsicKey = intrinsicAttributes && checker.getPropertyOfType(intrinsicAttributes, "key");
  const intrinsicKeyType = intrinsicKey ? checker.getTypeOfSymbolAtLocation(intrinsicKey, intrinsicAlias) : undefined;
  const diagnostics = new Map();
  const nodes = new Map();
  const calls = new Map();
  function sourceAndNode(file, offset) {
    const source = program.getSourceFile(file) ?? program.getSourceFiles().find((item) => key(item.fileName) === key(file));
    if (!source) return [null, null];
    if (!nodes.has(source)) {
      const map = new Map();
      const callMap = new Map();
      const visit = (node) => {
        if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) map.set(node.getStart(source), node);
        if (ts.isCallExpression(node)) callMap.set(node.arguments.pos - 1, node);
        ts.forEachChild(node, visit);
      };
      visit(source); nodes.set(source, map); calls.set(source, callMap);
    }
    return [source, nodes.get(source).get(offset)];
  }
  function fileDiagnostics(source) {
    if (!diagnostics.has(source)) diagnostics.set(source, [...program.getSyntacticDiagnostics(source), ...program.getSemanticDiagnostics(source)]);
    return diagnostics.get(source);
  }
  function typeProblem(type, at, expected, seen = new Set()) {
    if (seen.has(type)) return null;
    seen.add(type);
    if (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) return "an any/unknown spread cannot prove public prop ownership";
    if (type.flags & ts.TypeFlags.TypeParameter) {
      const constraint = checker.getBaseConstraintOfType(type);
      return constraint ? typeProblem(constraint, at, expected, seen) : "an unconstrained generic spread cannot prove public prop ownership";
    }
    if (type.isUnion()) {
      for (const part of type.types) { const reason = typeProblem(part, at, expected, seen); if (reason) return reason; }
      return null;
    }
    if (type.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Null | ts.TypeFlags.Never | ts.TypeFlags.BooleanLiteral)) return null;
    if (!(type.flags & ts.TypeFlags.Object) && !type.isIntersection()) return "a non-object spread cannot prove public props";
    for (const index of checker.getIndexInfosOfType(type)) {
      if (!(index.keyType.flags & ts.TypeFlags.TemplateLiteral) || !checker.typeToString(index.keyType).includes("data-pui-")) return "an open index signature cannot prove public prop ownership";
      if (!(index.type.flags & (ts.TypeFlags.Never | ts.TypeFlags.Undefined))) return "a reserved ownership index signature is forbidden";
    }
    for (const property of checker.getPropertiesOfType(type)) {
      const name = property.getName();
      const lower = name.toLowerCase();
      const value = checker.getTypeOfSymbolAtLocation(property, at);
      if (forbidden.has(lower)) return `${name} prop hidden in spread`;
      if (name === "key") {
        if (!intrinsicKeyType || intrinsicKeyType.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) return "React intrinsic key contract could not be resolved";
        if (!checker.isTypeAssignableTo(value, intrinsicKeyType)) return "invalid React intrinsic key type hidden in spread";
        continue;
      }
      if (lower.startsWith("data-pui-") && !(knownMarkers.has(lower) && (value.flags & (ts.TypeFlags.Never | ts.TypeFlags.Undefined)))) return `${name} ownership prop hidden in spread`;
      if (expected && !checker.getPropertyOfType(expected, name) && !/^data-(?!pui-)/i.test(name)) return `unknown public prop ${name} hidden in spread`;
    }
    return null;
  }
  function originProblem(expression, expected, seen = new Set()) {
    if (seen.has(expression)) return null;
    seen.add(expression);
    const reason = typeProblem(checker.getTypeAtLocation(expression), expression, expected);
    if (reason) return reason;
    if (ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression) || ts.isParenthesizedExpression(expression) || ts.isSatisfiesExpression(expression)) return originProblem(expression.expression, expected, seen);
    if (ts.isConditionalExpression(expression)) return originProblem(expression.whenTrue, expected, seen) ?? originProblem(expression.whenFalse, expected, seen);
    if (ts.isObjectLiteralExpression(expression)) {
      for (const property of expression.properties) {
        if (ts.isSpreadAssignment(property)) {
          const issue = originProblem(property.expression, expected, seen); if (issue) return issue;
        } else if (property.name && ts.isComputedPropertyName(property.name)) {
          const nameType = checker.getTypeAtLocation(property.name.expression);
          if (!(nameType.flags & (ts.TypeFlags.StringLiteral | ts.TypeFlags.NumberLiteral))) return "an opaque computed props key cannot prove public ownership";
        }
      }
    }
    if (ts.isIdentifier(expression) || ts.isPropertyAccessExpression(expression)) {
      let symbol = checker.getSymbolAtLocation(ts.isPropertyAccessExpression(expression) ? expression.name : expression);
      if (symbol?.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
      for (const declaration of symbol?.declarations ?? []) {
        if (declaration.initializer) {
          const issue = originProblem(declaration.initializer, expected, seen); if (issue) return issue;
          const errors = fileDiagnostics(declaration.getSourceFile()).filter((item) => item.start >= declaration.getStart() && item.start < declaration.end);
          if (errors.length) return `ill-typed spread source: ${ts.flattenDiagnosticMessageText(errors[0].messageText, " ")}`;
        }
      }
    }
    if (ts.isCallExpression(expression)) {
      const declaration = checker.getResolvedSignature(expression)?.declaration;
      if (declaration?.body && !declaration.getSourceFile().isDeclarationFile) {
        const returns = [];
        const visit = (node) => {
          if (ts.isReturnStatement(node) && node.expression) returns.push(node.expression);
          else if (node === declaration.body || !ts.isFunctionLike(node)) ts.forEachChild(node, visit);
        };
        if (ts.isBlock(declaration.body)) visit(declaration.body); else returns.push(declaration.body);
        for (const value of returns) { const issue = originProblem(value, expected, seen); if (issue) return issue; }
      }
    }
    return null;
  }
  return {
    inspectCalls(file) {
      const [source] = sourceAndNode(file, -1);
      const results = {};
      if (!source) return results;
      for (const [offset, call] of calls.get(source)) {
        for (const propsIndex of [0, 1]) {
          const component = propsIndex ? call.arguments[0] : call.expression;
          if (!component) continue;
          const signature = checker.getTypeAtLocation(component).getCallSignatures()[0];
          const declaration = signature?.declaration;
          const parameter = signature?.getParameters()[0];
          const expected = parameter ? checker.getTypeOfSymbolAtLocation(parameter, call) : undefined;
          // Avoid walking business callback/object origins. Public source
          // ownership remains decided by the entry points' import analysis.
          if (!declaration || (!/[/\\]personal-ui[/\\]/i.test(declaration.getSourceFile().fileName)
            && !(expected && checker.getPropertyOfType(expected, "data-pui-owner")))) continue;
          const props = call.arguments[propsIndex];
          const spread = props ? originProblem(props, expected) : null;
          const types = fileDiagnostics(source).filter((item) => item.start >= call.getStart(source) && item.start < call.end)
            .map((item) => ts.flattenDiagnosticMessageText(item.messageText, " "));
          if (spread?.startsWith("invalid React intrinsic key type")) types.push("Props do not satisfy React JSX.IntrinsicAttributes.key");
          // jsx-runtime's own factory overload accepts any. Check the public
          // component's props even when the enclosing runtime has a loose type.
          const propsType = props && checker.getTypeAtLocation(props);
          const intrinsicOnly = propsIndex === 1 && propsType && intrinsicAttributes && expected
            && checker.isTypeAssignableTo(propsType, intrinsicAttributes)
            && checker.getPropertiesOfType(propsType).every((property) => checker.getPropertyOfType(intrinsicAttributes, property.getName()) || /^data-(?!pui-)/i.test(property.getName()))
            && checker.getPropertiesOfType(expected).every((property) => property.flags & ts.SymbolFlags.Optional);
          if (props && expected && !intrinsicOnly && !checker.isTypeAssignableTo(propsType, expected)
            && !(checker.getTypeAtLocation(props).flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined))) {
            types.push(`Props are not assignable to ${checker.typeToString(expected)}`);
          }
          results[`${offset}:${propsIndex}`] = {spread, types};
        }
      }
      return results;
    },
    localComponents(file) {
      const source = program.getSourceFile(file);
      const names = new Set();
      if (!source) return names;
      const visit = (node) => {
        if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) && node.name) names.add(node.name.text);
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer
          && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) names.add(node.name.text);
        ts.forEachChild(node, visit);
      };
      visit(source);
      return names;
    },
    inspect(file, offset) {
      const [source, node] = sourceAndNode(file, offset);
      if (!node) return { spread: "TypeScript could not resolve this JSX usage", types: [] };
      const whole = ts.isJsxOpeningElement(node) ? node.parent : node;
      const types = fileDiagnostics(source).filter((item) => {
        if (!(item.start >= node.getStart(source) && item.start < whole.end)) return false;
        // A nested control owns its own diagnostics, not the surrounding slot.
        for (const child of nodes.get(source).values()) {
          if (child === node || child.getStart(source) <= node.getStart(source)) continue;
          const childWhole = ts.isJsxOpeningElement(child) ? child.parent : child;
          if (item.start >= child.getStart(source) && item.start < childWhole.end) return false;
        }
        return true;
      }).map((item) => ts.flattenDiagnosticMessageText(item.messageText, " "));
      const signature = checker.getResolvedSignature(node);
      const parameter = signature?.getParameters()[0];
      const expected = parameter ? checker.getTypeOfSymbolAtLocation(parameter, node) : undefined;
      let spread = null;
      for (const property of node.attributes.properties) {
        if (ts.isJsxSpreadAttribute(property)) {
          spread = originProblem(property.expression, expected);
          if (spread) break;
        }
      }
      return { spread, types };
    },
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const request = JSON.parse(fs.readFileSync(0, "utf8"));
    const requests = request.requests ?? [request];
    const inspector = createTypedUsageInspector(request.target, requests.map((item) => item.file), new Map(requests.map((item) => [item.file, item.source])));
    const results = requests.map((item) => {
      const jsx = item.offsets.map((offset) => inspector.inspect(item.file, offset));
      return request.allCalls ? {jsx, calls: inspector.inspectCalls(item.file)} : jsx;
    });
    process.stdout.write(JSON.stringify(request.requests ? results : results[0]));
  } catch (error) {
    process.stdout.write(JSON.stringify({ error: String(error.message ?? error) }));
    process.exitCode = 1;
  }
}
