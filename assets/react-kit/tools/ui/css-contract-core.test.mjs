import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { analyzeCssGraph } from "./css-contract-core.mjs";

const root = path.resolve("css-contract-fixture");
const entry = path.join(root, "styles.css");
const baseConfig = {
  entry: "styles.css",
  canonicalFiles: ["styles.css"],
  layerOrder: ["ui.reset", "ui.tokens", "ui.base", "ui.components", "ui.utilities"],
  infrastructureAnchors: ["ui-root", "ui-portal", "ui-theme"],
  utilityAnchors: ["ui-sr-only"],
  maxClassSpecificity: 4,
};
const order = "@layer ui.reset, ui.tokens, ui.base, ui.components, ui.utilities;";
const tokens = '@layer ui.tokens { :root { --ui-primary: #1769d2; } }';

function analyze(css, options = {}) {
  return analyzeCssGraph({
    entryPath: entry,
    sources: options.sources ?? new Map([[entry, css]]),
    config: options.config ?? baseConfig,
    publicTokens: ["--ui-primary"],
    sourceRuntimeTokens: options.runtimeTokens ?? new Set(),
    relative: (file) => path.relative(root, file).replaceAll(path.sep, "/"),
  });
}

test("accepts layered registered UI CSS", () => {
  const result = analyze(`${order}\n${tokens}\n@layer ui.components { .ui-button:hover { color: var(--ui-primary); } }`);
  assert.deepEqual(result.errors, []);
});

test("rejects an unlayered component rule", () => {
  const result = analyze(`${order}\n${tokens}\n.ui-button { color: var(--ui-primary); }`);
  assert.match(result.errors.join("\n"), /unlayered UI selector/);
});

test("rejects an unknown layer", () => {
  const result = analyze(`${order}\n${tokens}\n@layer custom { .ui-button { color: var(--ui-primary); } }`);
  assert.match(result.errors.join("\n"), /unknown layer custom/);
});

test("rejects a selector owner split across files", () => {
  const first = path.join(root, "first.css");
  const second = path.join(root, "second.css");
  const config = { ...baseConfig, canonicalFiles: ["styles.css", "first.css", "second.css"] };
  const sources = new Map([
    [entry, `${order}\n@import "./first.css";\n@import "./second.css";\n${tokens}`],
    [first, "@layer ui.components { .ui-button { display: flex; } }"],
    [second, "@layer ui.components { .ui-button:hover { opacity: .9; } }"],
  ]);
  const result = analyze("", { config, sources });
  assert.match(result.errors.join("\n"), /selector owner \.ui-button is split/);
});

test("rejects excessive selector specificity", () => {
  const result = analyze(`${order}\n${tokens}\n@layer ui.components { .ui-field.is-a.is-b:hover:focus { color: var(--ui-primary); } }`);
  assert.match(result.errors.join("\n"), /exceeds specificity/);
});

test("rejects an unknown token", () => {
  const result = analyze(`${order}\n${tokens}\n@layer ui.components { .ui-button { color: var(--ui-typo); } }`);
  assert.match(result.errors.join("\n"), /unregistered CSS token use --ui-typo/);
});

test("rejects a component selector in utilities", () => {
  const result = analyze(`${order}\n${tokens}\n@layer ui.utilities { .ui-button { display: block; } }`);
  assert.match(result.errors.join("\n"), /non-utility selector/);
});

test("rejects raw colors outside the token layer", () => {
  const result = analyze(`${order}\n${tokens}\n@layer ui.components { .ui-button { color: #ffffff; } }`);
  assert.match(result.errors.join("\n"), /raw color outside ui.tokens/);
});
