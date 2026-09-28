import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { analyzeCssGraph } from "./css-contract-core.mjs";

const root = path.resolve("css-contract-fixture");
const entry = path.join(root, "styles.css");
const baseConfig = {
  entry: "styles.css",
  canonicalFiles: ["styles.css"],
  layerOrder: ["pui.reset", "pui.tokens", "pui.base", "pui.components", "pui.utilities"],
  infrastructureAnchors: ["pui-root", "pui-portal", "pui-theme"],
  utilityAnchors: ["pui-sr-only"],
  maxClassSpecificity: 4,
};
const order = "@layer pui.reset, pui.tokens, pui.base, pui.components, pui.utilities;";
const tokens = '@layer pui.tokens { :root { --pui-primary: #1769d2; } }';

function analyze(css, options = {}) {
  return analyzeCssGraph({
    entryPath: entry,
    sources: options.sources ?? new Map([[entry, css]]),
    config: options.config ?? baseConfig,
    publicTokens: ["--pui-primary"],
    sourceRuntimeTokens: options.runtimeTokens ?? new Set(),
    relative: (file) => path.relative(root, file).replaceAll(path.sep, "/"),
  });
}

test("accepts layered registered Personal UI CSS", () => {
  const result = analyze(`${order}\n${tokens}\n@layer pui.components { .pui-button:hover { color: var(--pui-primary); } }`);
  assert.deepEqual(result.errors, []);
});

test("rejects an unlayered component rule", () => {
  const result = analyze(`${order}\n${tokens}\n.pui-button { color: var(--pui-primary); }`);
  assert.match(result.errors.join("\n"), /unlayered Personal UI selector/);
});

test("rejects an unknown layer", () => {
  const result = analyze(`${order}\n${tokens}\n@layer custom { .pui-button { color: var(--pui-primary); } }`);
  assert.match(result.errors.join("\n"), /unknown layer custom/);
});

test("rejects a selector owner split across files", () => {
  const first = path.join(root, "first.css");
  const second = path.join(root, "second.css");
  const config = { ...baseConfig, canonicalFiles: ["styles.css", "first.css", "second.css"] };
  const sources = new Map([
    [entry, `${order}\n@import "./first.css";\n@import "./second.css";\n${tokens}`],
    [first, "@layer pui.components { .pui-button { display: flex; } }"],
    [second, "@layer pui.components { .pui-button:hover { opacity: .9; } }"],
  ]);
  const result = analyze("", { config, sources });
  assert.match(result.errors.join("\n"), /selector owner \.pui-button is split/);
});

test("rejects excessive selector specificity", () => {
  const result = analyze(`${order}\n${tokens}\n@layer pui.components { .pui-field.is-a.is-b:hover:focus { color: var(--pui-primary); } }`);
  assert.match(result.errors.join("\n"), /exceeds specificity/);
});

test("rejects an unknown token", () => {
  const result = analyze(`${order}\n${tokens}\n@layer pui.components { .pui-button { color: var(--pui-typo); } }`);
  assert.match(result.errors.join("\n"), /unregistered CSS token use --pui-typo/);
});

test("rejects a component selector in utilities", () => {
  const result = analyze(`${order}\n${tokens}\n@layer pui.utilities { .pui-button { display: block; } }`);
  assert.match(result.errors.join("\n"), /non-utility selector/);
});

test("rejects raw colors outside the token layer", () => {
  const result = analyze(`${order}\n${tokens}\n@layer pui.components { .pui-button { color: #ffffff; } }`);
  assert.match(result.errors.join("\n"), /raw color outside pui.tokens/);
});
