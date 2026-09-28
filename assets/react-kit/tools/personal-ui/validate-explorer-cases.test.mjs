import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { validateExplorerCases } from "./validate-explorer-cases.mjs";

function createKit({
  family = "button",
  category = "actions",
  exportName = "Button",
  stateMode = "controlled-uncontrolled",
  states = ["default", "disabled", "keyboard"],
  source,
}) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "personal-ui-explorer-"));
  const kitRoot = path.join(temporary, "assets", "react-kit");
  const casesRoot = path.join(kitRoot, "src", "explorer", "cases", category);
  fs.mkdirSync(casesRoot, { recursive: true });
  fs.writeFileSync(path.join(kitRoot, "component-manifest.json"), JSON.stringify({
    entries: [{ id: family, publicExports: [exportName] }],
  }));
  fs.writeFileSync(path.join(kitRoot, "registry.json"), JSON.stringify({ exports: [exportName] }));
  fs.writeFileSync(path.join(kitRoot, "component-docs.json"), JSON.stringify({
    profiles: {
      fixture: {
        stateMode,
        applicableStates: states,
      },
    },
    families: { [family]: { category } },
    exports: { [exportName]: { profile: "fixture" } },
  }));
  fs.writeFileSync(path.join(casesRoot, `${family}.case.tsx`), source);
  return {
    kitRoot,
    cleanup: () => fs.rmSync(temporary, { recursive: true, force: true }),
  };
}

function componentCase(body) {
  return `// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"button/overview","exports":["Button"]}
import { Button as PrimaryButton } from "../../../personal-ui";
import type { ExplorerCase } from "../types";
${body}
`;
}

test("accepts an aliased public-barrel component used by reachable JSX", () => {
  const fixture = createKit({
    source: componentCase(`const content = <PrimaryButton disabled>保存</PrimaryButton>;
const explorerCase = { id: "button/overview", label: "按钮", summary: "按钮状态", states: ["default", "disabled", "keyboard"], content, code: "<Button />" } satisfies ExplorerCase;
export default explorerCase;`),
  });
  try {
    const result = validateExplorerCases({ kitRoot: fixture.kitRoot });
    assert.deepEqual(result.errors, []);
    assert.equal(result.ok, true);
    assert.deepEqual(result.evidence.Button, ["assets/react-kit/src/explorer/cases/actions/button.case.tsx"]);
  } finally {
    fixture.cleanup();
  }
});

test("rejects names that occur only in an import, comment, and string", () => {
  const fixture = createKit({
    source: componentCase(`// PrimaryButton is intentionally not rendered.
const explorerCase = { id: "button/overview", label: "按钮", summary: "PrimaryButton", states: ["default", "disabled", "keyboard"], content: <div>PrimaryButton</div>, code: "<PrimaryButton />" } satisfies ExplorerCase;
export default explorerCase;`),
  });
  try {
    const result = validateExplorerCases({ kitRoot: fixture.kitRoot });
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /Button needs reachable JSX/);
    assert.deepEqual(result.evidence.Button, []);
  } finally {
    fixture.cleanup();
  }
});

test("rejects real JSX hidden in an unreachable helper", () => {
  const fixture = createKit({
    source: componentCase(`function UnusedExample() { return <PrimaryButton>不会展示</PrimaryButton>; }
const explorerCase = { id: "button/overview", label: "按钮", summary: "未引用 helper", states: ["default", "disabled", "keyboard"], content: <div>没有按钮</div>, code: "<Button />" } satisfies ExplorerCase;
export default explorerCase;`),
  });
  try {
    const result = validateExplorerCases({ kitRoot: fixture.kitRoot });
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /Button needs reachable JSX/);
  } finally {
    fixture.cleanup();
  }
});

test("rejects directive exports that do not exactly match the manifest family", () => {
  const fixture = createKit({
    source: componentCase(`const explorerCase = { id: "button/overview", label: "按钮", summary: "错误归属", states: ["default", "disabled", "keyboard"], content: <PrimaryButton>保存</PrimaryButton>, code: "<Button />" } satisfies ExplorerCase;
export default explorerCase;`).replace('"exports":["Button"]', '"exports":["Button","Input"]'),
  });
  try {
    const result = validateExplorerCases({ kitRoot: fixture.kitRoot });
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /directive exports must exactly match family button/);
  } finally {
    fixture.cleanup();
  }
});

test("rejects a default ExplorerCase id that differs from its directive", () => {
  const fixture = createKit({
    source: componentCase(`const explorerCase = { id: "button/other", label: "按钮", summary: "错误 ID", states: ["default", "disabled", "keyboard"], content: <PrimaryButton>保存</PrimaryButton>, code: "<Button />" } satisfies ExplorerCase;
export default explorerCase;`),
  });
  try {
    const result = validateExplorerCases({ kitRoot: fixture.kitRoot });
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /ExplorerCase id must be button\/overview/);
  } finally {
    fixture.cleanup();
  }
});

test("requires a reachable hook CallExpression", () => {
  const family = "toast-hook";
  const exportName = "useToast";
  const directive = `// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"${family}/overview","exports":["${exportName}"]}`;
  const fixture = createKit({
    family,
    category: "feedback",
    exportName,
    stateMode: "hook",
    states: ["default", "usage"],
    source: `${directive}
import { useToast } from "../../../personal-ui";
import type { ExplorerCase } from "../types";
function Example() { void useToast; return <div>Toast</div>; }
const explorerCase = { id: "${family}/overview", label: "Toast", summary: "Hook", states: ["default", "usage"], content: <Example />, code: "useToast()" } satisfies ExplorerCase;
export default explorerCase;
`,
  });
  try {
    const result = validateExplorerCases({ kitRoot: fixture.kitRoot });
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /useToast needs a reachable CallExpression/);
  } finally {
    fixture.cleanup();
  }
});

test("accepts a hook call inside a component reachable from content", () => {
  const family = "toast-hook";
  const exportName = "useToast";
  const fixture = createKit({
    family,
    category: "feedback",
    exportName,
    stateMode: "hook",
    states: ["default", "usage"],
    source: `// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"${family}/overview","exports":["${exportName}"]}
import { useToast } from "../../../personal-ui";
import type { ExplorerCase } from "../types";
function Example() { const toast = useToast(); return <button onClick={() => toast({ description: "完成" })}>Toast</button>; }
const explorerCase = { id: "${family}/overview", label: "Toast", summary: "Hook", states: ["default", "usage"], content: <Example />, code: "useToast()" } satisfies ExplorerCase;
export default explorerCase;
`,
  });
  try {
    assert.deepEqual(validateExplorerCases({ kitRoot: fixture.kitRoot }).errors, []);
  } finally {
    fixture.cleanup();
  }
});

test("does not count void-only constant references as runtime evidence", () => {
  const family = "timezone-options";
  const exportName = "DEFAULT_TIMEZONE_OPTIONS";
  const fixture = createKit({
    family,
    category: "input",
    exportName,
    stateMode: "constant",
    states: ["default", "usage"],
    source: `// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"${family}/overview","exports":["${exportName}"]}
import { DEFAULT_TIMEZONE_OPTIONS } from "../../../personal-ui";
import type { ExplorerCase } from "../types";
const explorerCase = { id: "${family}/overview", label: "时区", summary: "常量", states: ["default", "usage"], content: <div>{void DEFAULT_TIMEZONE_OPTIONS}</div>, code: "DEFAULT_TIMEZONE_OPTIONS" } satisfies ExplorerCase;
export default explorerCase;
`,
  });
  try {
    const result = validateExplorerCases({ kitRoot: fixture.kitRoot });
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /DEFAULT_TIMEZONE_OPTIONS needs a reachable runtime expression or prop/);
  } finally {
    fixture.cleanup();
  }
});

test("accepts a constant used by a reachable JSX prop expression", () => {
  const family = "timezone-options";
  const exportName = "DEFAULT_TIMEZONE_OPTIONS";
  const fixture = createKit({
    family,
    category: "input",
    exportName,
    stateMode: "constant",
    states: ["default", "usage"],
    source: `// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"${family}/overview","exports":["${exportName}"]}
import { DEFAULT_TIMEZONE_OPTIONS } from "../../../personal-ui";
import type { ExplorerCase } from "../types";
const explorerCase = { id: "${family}/overview", label: "时区", summary: "常量", states: ["default", "usage"], content: <div data-count={DEFAULT_TIMEZONE_OPTIONS.length}>时区</div>, code: "DEFAULT_TIMEZONE_OPTIONS" } satisfies ExplorerCase;
export default explorerCase;
`,
  });
  try {
    assert.deepEqual(validateExplorerCases({ kitRoot: fixture.kitRoot }).errors, []);
  } finally {
    fixture.cleanup();
  }
});

test("rejects missing and non-applicable states", () => {
  const fixture = createKit({
    source: componentCase(`const explorerCase = { id: "button/overview", label: "按钮", summary: "按钮状态", states: ["default", "loading"], content: <PrimaryButton>保存</PrimaryButton>, code: "<Button />" } satisfies ExplorerCase;
export default explorerCase;`),
  });
  try {
    const result = validateExplorerCases({ kitRoot: fixture.kitRoot });
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /missing applicable state\(s\): disabled, keyboard/);
    assert.match(result.errors.join("\n"), /non-applicable state\(s\): loading/);
  } finally {
    fixture.cleanup();
  }
});

test("rejects applicable state names outside the shared protocol", () => {
  const fixture = createKit({
    states: ["default", "hovering"],
    source: componentCase(`const explorerCase = { id: "button/overview", label: "按钮", summary: "错误状态协议", states: ["default"], content: <PrimaryButton>保存</PrimaryButton>, code: "<Button />" } satisfies ExplorerCase;
export default explorerCase;`),
  });
  try {
    const result = validateExplorerCases({ kitRoot: fixture.kitRoot });
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /unsupported applicable state\(s\): hovering/);
  } finally {
    fixture.cleanup();
  }
});
