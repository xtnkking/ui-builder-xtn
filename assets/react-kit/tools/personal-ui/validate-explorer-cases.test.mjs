import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { inspectExplorerContentStates, validateExplorerCases as validateExplorerCasesStrict } from "./validate-explorer-cases.mjs";

// These original contracts test export/source reachability only. Strict state
// coverage has separate contracts below and is never inferred from their success.
function validateExplorerCases(options) {
  return validateExplorerCasesStrict({ ...options, requireStateExamples: false });
}

function createKit({
  family = "button",
  category = "actions",
  exportName = "Button",
  exportNames = [exportName],
  stateMode = "controlled-uncontrolled",
  states = ["default", "disabled", "keyboard"],
  source,
}) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "personal-ui-explorer-"));
  const kitRoot = path.join(temporary, "assets", "react-kit");
  const casesRoot = path.join(kitRoot, "src", "explorer", "cases", category);
  fs.mkdirSync(casesRoot, { recursive: true });
  fs.writeFileSync(path.join(kitRoot, "component-manifest.json"), JSON.stringify({
    entries: [{ id: family, publicExports: exportNames }],
  }));
  fs.writeFileSync(path.join(kitRoot, "registry.json"), JSON.stringify({ exports: exportNames }));
  fs.writeFileSync(path.join(kitRoot, "component-docs.json"), JSON.stringify({
    profiles: {
      fixture: {
        stateMode,
        applicableStates: states,
      },
    },
    families: { [family]: { category } },
    exports: Object.fromEntries(exportNames.map((name) => [name, { profile: "fixture" }])),
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

function strictCase({ states, content = "<PrimaryButton>保存</PrimaryButton>", examples, declarations = "" }) {
  return componentCase(`${declarations}
const explorerCase = { id: "button/overview", label: "按钮", summary: "状态实例", states: ${JSON.stringify(states)},
content: ${content}, ${examples === undefined ? "" : `stateExamples: ${examples},`} code: "<Button />" } satisfies ExplorerCase;
export default explorerCase;`);
}

test("strict state coverage rejects adding labels to unchanged JSX", () => {
  const fixture = createKit({ source: strictCase({ states: ["default", "disabled", "keyboard"] }) });
  try {
    const result = validateExplorerCasesStrict({ kitRoot: fixture.kitRoot });
    assert.equal(result.ok, false);
    assert.equal(result.stateCoverage.complete, false);
    assert.match(result.errors.join("\n"), /state labels are not coverage/);
    assert.deepEqual(result.stateCoverage.gaps.map((gap) => gap.state), ["default", "disabled", "keyboard"]);
    const inventory = validateExplorerCases({ kitRoot: fixture.kitRoot });
    assert.equal(inventory.ok, true);
    assert.equal(inventory.stateCoverage.complete, false);
    assert.equal(inventory.cases[0].stateCoverageComplete, false);
  } finally { fixture.cleanup(); }
});

test("state maps require concrete disabled props and manual keyboard instructions", () => {
  const fixture = createKit({ source: strictCase({
    states: ["default", "disabled", "keyboard"],
    examples: `[
      { state: "default", exports: ["Button"], content: <PrimaryButton>保存</PrimaryButton> },
      { state: "disabled", exports: ["Button"], content: <PrimaryButton disabled={false}>禁用</PrimaryButton> },
      { state: "keyboard", exports: ["Button"], content: <PrimaryButton>键盘</PrimaryButton> }
    ]`,
  }) });
  try {
    const result = validateExplorerCasesStrict({ kitRoot: fixture.kitRoot });
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /Button:disabled needs reachable state-specific/);
    assert.match(result.errors.join("\n"), /Button:keyboard needs reachable state-specific/);
    assert.deepEqual(result.stateCoverage.evidence.Button.map((item) => item.state), ["default"]);
  } finally { fixture.cleanup(); }
});

test("accepts state-specific JSX in a reachable helper and identifies manual fixtures", () => {
  const fixture = createKit({ source: strictCase({
    states: ["default", "disabled", "keyboard"],
    declarations: "function DisabledExample() { return <PrimaryButton disabled>禁用</PrimaryButton>; }",
    examples: `[
      { state: "default", exports: ["Button"], content: <PrimaryButton>保存</PrimaryButton> },
      { state: "disabled", exports: ["Button"], content: <DisabledExample /> },
      { state: "keyboard", exports: ["Button"], instructions: "按 Tab 聚焦后用 Enter 或空格触发", content: <PrimaryButton onClick={() => undefined}>保存</PrimaryButton> }
    ]`,
  }) });
  try {
    const result = validateExplorerCasesStrict({ kitRoot: fixture.kitRoot });
    assert.deepEqual(result.errors, []);
    assert.equal(result.stateCoverage.complete, true);
    assert.equal(result.stateCoverage.evidence.Button[2].verification, "manual-interaction-fixture");
  } finally { fixture.cleanup(); }
});

test("each export in a family must realize its own state", () => {
  const fixture = createKit({
    family: "text-input", category: "input", exportNames: ["Input", "PasswordInput"], states: ["disabled"],
    source: `// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"text-input/overview","exports":["Input","PasswordInput"]}
import { Input, PasswordInput } from "../../../personal-ui";
const example = { id: "text-input/overview", label: "输入", summary: "逐导出状态", states: ["disabled"],
content: <><Input /><PasswordInput /></>, code: "<Input />",
stateExamples: [{ state: "disabled", exports: ["Input", "PasswordInput"], content: <><Input disabled /><PasswordInput /></> }] };
export default example;`,
  });
  try {
    const result = validateExplorerCasesStrict({ kitRoot: fixture.kitRoot });
    assert.equal(result.ok, false);
    assert.deepEqual(result.stateCoverage.evidence.Input.map((item) => item.state), ["disabled"]);
    assert.deepEqual(result.stateCoverage.evidence.PasswordInput, []);
    assert.match(result.errors.join("\n"), /PasswordInput:disabled needs reachable state-specific/);
  } finally { fixture.cleanup(); }
});

test("state content cannot borrow a disabled component from an unreachable helper", () => {
  const fixture = createKit({ states: ["disabled"], source: strictCase({
    states: ["disabled"], declarations: "function Unused() { return <PrimaryButton disabled />; }",
    examples: '[{ state: "disabled", exports: ["Button"], content: <PrimaryButton>disabled</PrimaryButton> }]',
  }) });
  try {
    const result = validateExplorerCasesStrict({ kitRoot: fixture.kitRoot });
    assert.equal(result.ok, false);
    assert.deepEqual(result.stateCoverage.evidence.Button, []);
  } finally { fixture.cleanup(); }
});

test("long-content proof must be an actual target prop or child, not a label", () => {
  const long = "内容".repeat(30);
  const fixture = createKit({ states: ["longContent"], source: strictCase({
    states: ["longContent"],
    examples: `[{ state: "longContent", exports: ["Button"], instructions: "${long}", content: <div><span>${long}</span><PrimaryButton>保存</PrimaryButton></div> }]`,
  }) });
  try {
    const result = validateExplorerCasesStrict({ kitRoot: fixture.kitRoot });
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /Button:longContent needs reachable state-specific/);
  } finally { fixture.cleanup(); }
});

test("accepts target long props resolved from a declaration", () => {
  const fixture = createKit({ states: ["longContent"], source: strictCase({
    states: ["longContent"], declarations: 'const longText = "内容".repeat(30);',
    examples: '[{ state: "longContent", exports: ["Button"], content: <PrimaryButton>{longText}</PrimaryButton> }]',
  }) });
  try { assert.deepEqual(validateExplorerCasesStrict({ kitRoot: fixture.kitRoot }).errors, []); }
  finally { fixture.cleanup(); }
});

test("environment state is bound to its real wrapper around a reachable helper", () => {
  const fixture = createKit({ states: ["dark"], source: strictCase({
    states: ["dark"], declarations: 'import { StatePreview } from "../state-preview"; function Example() { return <PrimaryButton>保存</PrimaryButton>; }',
    examples: '[{ state: "dark", exports: ["Button"], content: <StatePreview state="dark"><Example /></StatePreview> }]',
  }) });
  try { assert.deepEqual(validateExplorerCasesStrict({ kitRoot: fixture.kitRoot }).errors, []); }
  finally { fixture.cleanup(); }
});

test("an unrelated or sibling context wrapper cannot prove a target environment", () => {
  const fixture = createKit({ states: ["dark"], source: strictCase({
    states: ["dark"], declarations: 'import { StatePreview } from "../state-preview";',
    examples: '[{ state: "dark", exports: ["Button"], content: <><StatePreview state="dark"><span>预览</span></StatePreview><PrimaryButton>保存</PrimaryButton></> }]',
  }) });
  try {
    const result = validateExplorerCasesStrict({ kitRoot: fixture.kitRoot });
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /Button:dark needs reachable state-specific/);
  } finally { fixture.cleanup(); }
});

test("error fixture can use the actual lazy-tree rejection callback", () => {
  const fixture = createKit({ family: "tree-table", category: "data", exportName: "TreeTable", states: ["error"],
    source: `// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"tree-table/overview","exports":["TreeTable"]}
import { TreeTable } from "../../../personal-ui";
const nodes = [{ id: "lazy", value: { name: "未加载" }, hasChildren: true }];
const columns = [{ id: "name", header: "名称", cell: (row) => row.name }];
function Example() { return <TreeTable nodes={nodes} columns={columns} treeColumnId="name" ariaLabel="目录" onRequestChildren={async () => { throw new Error("离线"); }} />; }
const example = { id: "tree-table/overview", label: "树表格", summary: "延迟加载错误", states: ["error"], content: <Example />, code: "<TreeTable />",
stateExamples: [{ state: "error", exports: ["TreeTable"], instructions: "展开加载失败节点", content: <Example /> }] };
export default example;`,
  });
  try { assert.deepEqual(validateExplorerCasesStrict({ kitRoot: fixture.kitRoot }).errors, []); }
  finally { fixture.cleanup(); }
});

test("rejects duplicate and non-applicable per-export mappings", () => {
  const fixture = createKit({ states: ["default"], source: strictCase({
    states: ["default"], examples: `[
      { state: "default", exports: ["Button"], content: <PrimaryButton>保存</PrimaryButton> },
      { state: "default", exports: ["Button"], content: <PrimaryButton>保存</PrimaryButton> },
      { state: "disabled", exports: ["Button"], content: <PrimaryButton disabled>保存</PrimaryButton> }
    ]`,
  }) });
  try {
    const result = validateExplorerCasesStrict({ kitRoot: fixture.kitRoot });
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /duplicates Button:default/);
    assert.match(result.errors.join("\n"), /Button:disabled is not applicable/);
  } finally { fixture.cleanup(); }
});

test("validation is bound to the enclosing Field, not a sibling error", () => {
  const fixture = createKit({ family: "input", category: "input", exportName: "Input", states: ["validation"],
    source: `// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"input/overview","exports":["Input"]}
import { Input, Field } from "../../../personal-ui";
const example = { id: "input/overview", label: "输入", summary: "输入校验", states: ["validation"], content: <Input />, code: "<Input />",
stateExamples: [{ state: "validation", exports: ["Input"], content: <><Field label="另一个字段" error="错误"><span>内容</span></Field><Input /></> }] };
export default example;`,
  });
  try {
    const result = validateExplorerCasesStrict({ kitRoot: fixture.kitRoot });
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /Input:validation needs reachable state-specific/);
  } finally { fixture.cleanup(); }
});

test("controlled and uncontrolled input fixtures use distinct supported value contracts", () => {
  const fixture = createKit({ family: "input", category: "input", exportName: "Input", states: ["controlled", "uncontrolled"],
    source: `// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"input/overview","exports":["Input"]}
import { useState } from "react";
import { Input } from "../../../personal-ui";
function Controlled() { const [value, setValue] = useState("账号"); return <Input value={value} onChange={(event) => setValue(event.currentTarget.value)} />; }
const example = { id: "input/overview", label: "输入", summary: "输入模式", states: ["controlled", "uncontrolled"], content: <Controlled />, code: "<Input />",
stateExamples: [
{ state: "controlled", exports: ["Input"], content: <Controlled /> },
{ state: "uncontrolled", exports: ["Input"], content: <Input defaultValue="初始值" /> }
] };
export default example;`,
  });
  try { assert.deepEqual(validateExplorerCasesStrict({ kitRoot: fixture.kitRoot }).errors, []); }
  finally { fixture.cleanup(); }
});

test("controlled and uncontrolled checkable fields preserve native submission value", () => {
  const source = `// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"radio/overview","exports":["Radio"]}
import { Radio } from "../../../personal-ui";
const example = { id: "radio/overview", label: "单选", summary: "提交值与选中状态", states: ["controlled", "uncontrolled"], content: <Radio label="个人" value="personal" />, code: "<Radio />",
stateExamples: [
{ state: "controlled", exports: ["Radio"], content: <Radio label="个人" value="personal" checked={true} onChange={() => undefined} /> },
{ state: "uncontrolled", exports: ["Radio"], content: <Radio label="团队" value="team" defaultChecked /> }
] };
export default example;`;
  const fixture = createKit({ family: "radio", category: "input", exportName: "Radio", states: ["controlled", "uncontrolled"], source });
  try {
    assert.deepEqual(validateExplorerCasesStrict({ kitRoot: fixture.kitRoot }).errors, []);
    fs.writeFileSync(path.join(fixture.kitRoot, "src/explorer/cases/input/radio.case.tsx"), source.replace("checked={true} ", ""));
    const nativeValueOnly = validateExplorerCasesStrict({ kitRoot: fixture.kitRoot });
    assert.equal(nativeValueOnly.ok, false);
    assert.match(nativeValueOnly.errors.join("\n"), /Radio:controlled needs reachable state-specific/);
  } finally { fixture.cleanup(); }
});

test("disabled source cannot masquerade as the default fixture", () => {
  const fixture = createKit({ states: ["default"], source: strictCase({ states: ["default"],
    examples: '[{ state: "default", exports: ["Button"], content: <PrimaryButton disabled>保存</PrimaryButton> }]',
  }) });
  try {
    assert.equal(validateExplorerCasesStrict({ kitRoot: fixture.kitRoot }).ok, false);
  } finally { fixture.cleanup(); }
});

test("family focus reports its source binding and rejects unknown family ids", () => {
  const fixture = createKit({ states: ["default"], source: strictCase({ states: ["default"],
    examples: '[{ state: "default", exports: ["Button"], content: <PrimaryButton>保存</PrimaryButton> }]',
  }) });
  try {
    const result = validateExplorerCasesStrict({ kitRoot: fixture.kitRoot, familyIds: ["button"] });
    assert.equal(result.ok, true);
    assert.equal(result.verifiedCaseCount, 1);
    assert.deepEqual(result.selectedFamilies, ["button"]);
    assert.match(result.sourceHashes["src/explorer/cases/actions/button.case.tsx"], /^[a-f0-9]{64}$/);
    const invalid = validateExplorerCasesStrict({ kitRoot: fixture.kitRoot, familyIds: ["absent"] });
    assert.equal(invalid.ok, false);
    assert.match(invalid.errors.join("\n"), /unknown Explorer family: absent/);
  } finally { fixture.cleanup(); }
});

test("inventory helper binds only existing target state source", () => {
  const result = inspectExplorerContentStates({
    sourceText: strictCase({ states: ["default", "disabled", "validation"], content: "<PrimaryButton disabled>保存</PrimaryButton>" }),
    statesByExport: { Button: ["default", "disabled", "validation"] },
    stateModes: { Button: "stateless" },
  });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.realizedStates.Button, ["disabled"]);
  assert.equal(result.contentExpression, "<PrimaryButton disabled>保存</PrimaryButton>");
});

test("an actual long Field label proves associated label layout without invalid numeric data", () => {
  const longLabel = "这是实际显示在控件旁的很长的标签文本用于检查窄屏下数字字段和关联标签的布局";
  const fixture = createKit({ family: "number-input", category: "input", exportName: "NumberInput", states: ["longContent"],
    source: `// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"number-input/overview","exports":["NumberInput"]}
import { NumberInput, Field } from "../../../personal-ui";
const example = { id: "number-input/overview", label: "数字", summary: "关联标签", states: ["longContent"], content: <NumberInput value={1} onChange={() => undefined} />, code: "<NumberInput />",
stateExamples: [{ state: "longContent", exports: ["NumberInput"], content: <Field label="${longLabel}"><NumberInput value={1} onChange={() => undefined} /></Field> }] };
export default example;`,
  });
  try { assert.deepEqual(validateExplorerCasesStrict({ kitRoot: fixture.kitRoot }).errors, []); }
  finally { fixture.cleanup(); }
});

test("confirmation loading fixture requires an actual awaited delay and action instructions", () => {
  const fixture = createKit({ family: "confirm-dialog", category: "overlay", exportName: "ConfirmDialog", states: ["loading"],
    source: `// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"confirm-dialog/overview","exports":["ConfirmDialog"]}
import { ConfirmDialog } from "../../../personal-ui";
function Pending() { return <ConfirmDialog open onOpenChange={() => undefined} title="保存" onConfirm={async () => { await new Promise((resolve) => setTimeout(resolve, 1800)); }} />; }
const example = { id: "confirm-dialog/overview", label: "确认", summary: "提交等待", states: ["loading"], content: <Pending />, code: "<ConfirmDialog />",
stateExamples: [{ state: "loading", exports: ["ConfirmDialog"], instructions: "点击确认后观察按钮加载", content: <Pending /> }] };
export default example;`,
  });
  try { assert.deepEqual(validateExplorerCasesStrict({ kitRoot: fixture.kitRoot }).errors, []); }
  finally { fixture.cleanup(); }
});

test("lexical state constants ignore unreachable helper declarations", () => {
  const input = createKit({ family: "input", category: "input", exportName: "Input", states: ["longContent"],
    source: `// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"input/overview","exports":["Input"]}
import { Input } from "../../../personal-ui";
function Short() { const value = "短内容"; return <Input defaultValue={value} />; }
function Unreachable() { const value = "不可达长文本".repeat(30); return <Input defaultValue={value} />; }
const example = { id: "input/overview", label: "输入", summary: "词法作用域", states: ["longContent"], content: <Short />, code: "<Input />",
stateExamples: [{ state: "longContent", exports: ["Input"], content: <Short /> }] };
export default example;`,
  });
  const table = createKit({ family: "data-table", category: "data", exportName: "DataTable", states: ["empty", "longContent"],
    source: `// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"data-table/overview","exports":["DataTable"]}
import { DataTable } from "../../../personal-ui";
function Populated() { const rows = [{ id: "1", name: "正常", debugUnused: "不显示的调试文字".repeat(30) }]; const columns = [{ id: "name", header: "名称", cell: (row) => row.name }]; return <DataTable rows={rows} columns={columns} rowKey={(row) => row.id} ariaLabel="列表" />; }
function Unreachable() { const rows = []; return <div>{rows.length}</div>; }
const example = { id: "data-table/overview", label: "表格", summary: "词法作用域", states: ["empty", "longContent"], content: <Populated />, code: "<DataTable />",
stateExamples: [
{ state: "empty", exports: ["DataTable"], content: <Populated /> },
{ state: "longContent", exports: ["DataTable"], content: <Populated /> }
] };
export default example;`,
  });
  try {
    const inputResult = validateExplorerCasesStrict({ kitRoot: input.kitRoot });
    assert.equal(inputResult.ok, false);
    assert.deepEqual(inputResult.stateCoverage.evidence.Input, []);
    const tableResult = validateExplorerCasesStrict({ kitRoot: table.kitRoot });
    assert.equal(tableResult.ok, false);
    assert.deepEqual(tableResult.stateCoverage.evidence.DataTable, []);
    const destructive = inspectExplorerContentStates({
      sourceText: `// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"dialog/overview","exports":["ConfirmDialog"]}
import { ConfirmDialog } from "../../../personal-ui";
const example = { id: "dialog/overview", label: "确认", summary: "危险操作", states: ["default", "error"], content: <ConfirmDialog open onOpenChange={() => undefined} title="删除" tone="danger" onConfirm={() => undefined} />, code: "<ConfirmDialog />" }; export default example;`,
      statesByExport: { ConfirmDialog: ["default", "error"] }, stateModes: { ConfirmDialog: "controlled-only" },
    });
    assert.deepEqual(destructive.realizedStates.ConfirmDialog, ["default"]);
  } finally { input.cleanup(); table.cleanup(); }
});

test("literal false branches cannot prove runtime exports or component states", () => {
  const variants = [
    { declarations: "function Example() { if (false) return <PrimaryButton disabled>不可达</PrimaryButton>; return <div>实际内容</div>; }", content: "<Example />", runtime: false },
    { declarations: "function Example() { if (false) return <PrimaryButton disabled>不可达</PrimaryButton>; return <PrimaryButton>普通按钮</PrimaryButton>; }", content: "<Example />", runtime: true },
    { declarations: "", content: "false ? <PrimaryButton disabled /> : <div>实际内容</div>", runtime: false },
    { declarations: "", content: "false && <PrimaryButton disabled />", runtime: false },
    { declarations: "", content: "true || <PrimaryButton disabled />", runtime: false },
    { declarations: "function Example() { const hidden = false; if (hidden) return <PrimaryButton disabled />; return <div>实际内容</div>; }", content: "<Example />", runtime: false },
  ];
  for (const variant of variants) {
    const fixture = createKit({ states: ["disabled"], source: strictCase({
      states: ["disabled"], declarations: variant.declarations, content: variant.content,
      examples: `[{ state: "disabled", exports: ["Button"], content: ${variant.content} }]`,
    }) });
    try {
      const result = validateExplorerCasesStrict({ kitRoot: fixture.kitRoot });
      assert.equal(result.ok, false, variant.content);
      assert.deepEqual(result.stateCoverage.evidence.Button, [], variant.content);
      assert.equal(result.evidence.Button.length > 0, variant.runtime, variant.content);
    } finally { fixture.cleanup(); }
  }
});

function inspectSingleState(exportName, state, attributes, instructions = "") {
  return inspectExplorerContentStates({
    sourceText: `import { ${exportName} } from "../../../personal-ui";
const example = { id: "fixture/overview", label: "真实组件", summary: "公开状态合同", states: ["${state}"],
content: <${exportName} ${attributes} />, code: "<${exportName} />" }; export default example;`,
    statesByExport: { [exportName]: [state] }, stateModes: { [exportName]: "controlled-uncontrolled" }, instructions,
  }).realizedStates[exportName].includes(state);
}

test("recognizes component-specific public state contracts without borrowing another API", () => {
  const long = "实际显示的详细内容用于检验关联布局与换行能力".repeat(3);
  const contracts = [
    ["Calendar", "disabled", "isDateDisabled={() => true}", true],
    ["Calendar", "disabled", "isDateDisabled={() => false}", false],
    ["Input", "disabled", "isDateDisabled={() => true}", false],
    ["Form", "loading", "busy", true],
    ["Form", "loading", "busy={false}", false],
    ["Input", "loading", "busy", false],
    ["Attachment", "loading", "downloading", true],
    ["Input", "loading", "downloading", false],
    ["Scheduler", "controlled", 'date={new Date("2026-10-09")} onDateChange={() => undefined} events={[]}', true],
    ["SortableList", "controlled", "items={[]} onReorder={() => undefined}", true],
    ["Gallery", "controlled", 'selectedId="one" onSelect={() => undefined}', true],
    ["Input", "controlled", 'selectedId="one" onSelect={() => undefined}', false],
    ["Stepper", "controlled", 'currentId="first" onStepChange={() => undefined}', true],
    ["Stepper", "readOnly", 'currentId="first" steps={[{ id: "first", label: "步骤" }]}', true],
    ["Stepper", "readOnly", 'currentId="first" onStepChange={() => undefined}', false],
    ["Stepper", "error", 'currentId="first" steps={[{ id: "first", label: "步骤", status: "error" }]}', true],
    ["AnchorNavigation", "controlled", 'activeId="first" onNavigate={() => undefined}', true],
    ["Input", "controlled", 'activeId="first" onNavigate={() => undefined}', false],
    ["CommandPalette", "empty", 'commands={[]}', true],
    ["Input", "empty", 'commands={[]}', false],
    ["Pagination", "loading", 'page={1} pageCount={3} loadingPage={2}', true],
    ["Pagination", "loading", 'page={1} pageCount={3} loadingPage={4}', false],
    ["Pagination", "loading", 'page={1} pageCount={3} loadingPageSize onPageSizeChange={() => undefined}', true],
    ["Pagination", "loading", 'page={1} pageCount={3} loadingPageSize', false],
    ["Pagination", "empty", 'page={1} pageCount={1} total={0}', true],
    ["Pagination", "longContent", `summary="${long}"`, true],
    ["ResizablePanels", "longContent", `first={<p>${long}</p>} second={<p>另一栏</p>}`, true],
    ["Input", "longContent", `first={<p>${long}</p>}`, false],
    ["Badge", "error", 'tone="danger"', true],
    ["Tag", "error", 'tone="danger"', true],
    ["ConfirmDialog", "error", 'tone="danger"', false],
    ["CreateEditPage", "disabled", 'submitDisabled', true],
    ["CreateEditPage", "loading", 'submitting', true],
    ["WizardFlow", "disabled", 'nextDisabled', true],
    ["WizardFlow", "loading", 'nextLoading', true],
    ["WizardFlow", "controlled", 'currentId="first" onStepChange={() => undefined}', true],
    ["SettingsPage", "controlled", 'currentId="first" onCurrentChange={() => undefined}', true],
    ["SettingsPage", "empty", 'sections={[]}', true],
    ["DetailPage", "empty", 'sections={[]}', true],
    ["MasterDetail", "empty", 'detailOpen={false} emptyDetail={<p>请选择</p>}', true],
    ["MasterDetail", "empty", 'detailOpen emptyDetail={<p>请选择</p>}', false],
    ["ImportExportPage", "loading", 'importing onImport={() => undefined}', true],
    ["ImportExportPage", "loading", 'importing', false],
    ["StatusPage", "empty", 'kind="empty"', true],
    ["StatusPage", "error", 'kind="offline"', true],
    ["Avatar", "error", 'src="data:image/png;base64,aW52YWxpZA=="', true],
    ["Input", "error", 'src="data:image/png;base64,aW52YWxpZA=="', false],
    ["AvatarGroup", "empty", "", true],
    ["Input", "empty", "", false],
    ["Badge", "empty", "count={0} showZero={false}", true],
    ["Badge", "empty", "count={0} showZero", false],
    ["Badge", "empty", "count={0} showZero={false} dot", false],
    ["Carousel", "empty", "slides={[]}", true],
    ["Carousel", "longContent", `slides={[{ id: "one", label: "页面", content: <p>${long}</p> }]}`, true],
    ["DescriptionList", "longContent", `items={[{ label: "说明", value: "${long}" }]}`, true],
    ["Attachment", "longContent", `name="${long}"`, true],
    ["Input", "longContent", `name="${long}"`, false],
    ["Media", "longContent", `caption="${long}"`, true],
    ["Input", "longContent", `caption="${long}"`, false],
  ];
  for (const [name, state, attributes, expected] of contracts) {
    assert.equal(inspectSingleState(name, state, attributes), expected, `${name}:${state} ${attributes}`);
  }
});

test("recognizes upload and commit asynchronous fixtures only on owning exports", () => {
  const delayedCommit = 'value="名称" onCommit={async () => { await new Promise((resolve) => setTimeout(resolve, 1800)); }}';
  const contracts = [
    ["FileUpload", "loading", 'items={[{ id: "one", name: "data.csv", status: "uploading" }]} onFiles={() => undefined}', true],
    ["Gallery", "loading", 'items={[{ id: "one", name: "data.csv", status: "uploading" }]}', false],
    ["FileUpload", "error", 'items={[{ id: "one", name: "data.csv", status: "error" }]} onFiles={() => undefined}', true],
    ["Gallery", "error", 'items={[{ id: "one", name: "data.csv", status: "error" }]}', false],
    ["FileUpload", "controlled", "items={[]} onFiles={() => undefined}", true],
    ["Input", "controlled", "items={[]} onFiles={() => undefined}", false],
    ["InlineEdit", "controlled", 'value="名称" onCommit={() => undefined}', true],
    ["Input", "controlled", 'value="名称" onCommit={() => undefined}', false],
    ["InlineEdit", "loading", delayedCommit, true],
    ["Input", "loading", delayedCommit, false],
    ["InlineEdit", "loading", 'value="名称" onCommit={async () => { await Promise.resolve(); }}', false],
    ["InlineEdit", "error", 'value="名称" onCommit={async () => { throw new Error("离线"); }}', true],
    ["Input", "error", 'value="名称" onCommit={async () => { throw new Error("离线"); }}', false],
    ["InlineEdit", "loading", 'value="名称" onCommit={async () => { await new Promise((resolve) => window.setTimeout(resolve, 1800)); }}', true],
    ["FamilyLoginPage", "loading", 'products={[{ id: "one", name: "产品" }]} onSubmit={async () => { await new Promise((resolve) => setTimeout(resolve, 1800)); }}', true],
    ["Input", "loading", 'onSubmit={async () => { await new Promise((resolve) => setTimeout(resolve, 1800)); }}', false],
    ["FamilyLoginPage", "error", 'onSubmit={async () => { throw new Error("不可用"); }}', true],
    ["FamilyLoginPage", "validation", 'products={[{ id: "one", name: "产品" }]} onSubmit={() => undefined}', true],
    ["MemberManagementPage", "loading", 'fetchMembers={async () => { await new Promise((resolve) => setTimeout(resolve, 1800)); return { items: [], total: 0 }; }}', true],
    ["MemberManagementPage", "empty", 'fetchMembers={async () => ({ items: [], total: 0 })}', true],
    ["MemberManagementPage", "empty", 'fetchMembers={async () => ({ items: [{ id: "one", name: "成员" }], total: 1 })}', false],
    ["MemberManagementPage", "error", 'fetchMembers={async () => { throw new Error("不可用"); }}', true],
  ];
  for (const [name, state, attributes, expected] of contracts) {
    assert.equal(inspectSingleState(name, state, attributes, "点击保存并观察处理中或失败提示"), expected, `${name}:${state} ${attributes}`);
  }
});

test("InfiniteScroll error fixture requires its reachable rejecting load callback", () => {
  const rejecting = 'loadKey="one" onLoadMore={async () => { throw new Error("offline"); }}';
  assert.equal(inspectSingleState("InfiniteScroll", "error", `hasMore ${rejecting}`, "加载后观察错误并重试"), true);
  assert.equal(inspectSingleState("InfiniteScroll", "error", 'hasMore loadKey="one" onLoadMore={async () => undefined}', "加载后观察错误并重试"), false);
  assert.equal(inspectSingleState("InfiniteScroll", "error", `hasMore disabled ${rejecting}`, "加载后观察错误并重试"), false);
  assert.equal(inspectSingleState("InfiniteScroll", "error", `hasMore loading ${rejecting}`, "加载后观察错误并重试"), false);
  assert.equal(inspectSingleState("InfiniteScroll", "error", `hasMore={false} ${rejecting}`, "加载后观察错误并重试"), false);
  assert.equal(inspectSingleState("Input", "error", `hasMore ${rejecting}`, "加载后观察错误并重试"), false);
  assert.equal(inspectSingleState("InfiniteScroll", "error", `hasMore ${rejecting}`), false);
});

test("feedback state proof belongs to the actual owner and enabled toast trigger", () => {
  const long = "实际显示的详细通知内容用于检验换行和操作布局".repeat(3);
  const cases = [
    ["ValidationSummary", "empty", "issues={[]}", true],
    ["ValidationSummary", "validation", 'issues={[{ id: "one", message: "必填" }]}', true],
    ["ValidationSummary", "error", 'issues={[{ id: "one", message: "必填" }]}', true],
    ["ValidationSummary", "error", "issues={[]}", false],
    ["EmptyState", "empty", "", true],
    ["NoResults", "empty", "", true],
    ["ErrorState", "error", 'kind="offline"', true],
    ["ErrorState", "loading", "retryLoading onRetry={() => undefined}", true],
    ["ErrorState", "loading", "retryLoading", false],
    ["AsyncAction", "loading", 'onAction={async () => { await new Promise((resolve) => setTimeout(resolve, 1200)); }}', true],
    ["AsyncAction", "error", 'onAction={async () => { throw new Error("失败"); }}', true],
    ["Input", "loading", 'onAction={async () => { await new Promise((resolve) => setTimeout(resolve, 1200)); }}', false],
    // RetryButton does not own pending state; delayed caller work alone proves no spinner.
    ["RetryButton", "loading", 'onRetry={async () => { await new Promise((resolve) => setTimeout(resolve, 1200)); }}', false],
  ];
  for (const [name, state, attributes, expected] of cases) {
    assert.equal(inspectSingleState(name, state, attributes, "点击实际操作并观察状态"), expected, `${name}:${state}`);
  }
  function inspectToast({ disabled = false, outside = false, shadowWindow = false } = {}) {
    return inspectExplorerContentStates({
      sourceText: `import { Button, ToastProvider, useToast } from "../../../personal-ui";
function Commands() { const { toast } = useToast(); ${shadowWindow ? "const window = { setTimeout: () => undefined };" : ""}
return <Button ${disabled ? "disabled" : ""} onClick={() => toast({ tone: "danger", description: "${long}",
action: { label: "撤销", onClick: async () => { await new Promise((resolve) => window.setTimeout(resolve, 1200)); } } })}>发送</Button>; }
const example = { id: "toast/overview", label: "通知", summary: "实际调用", states: ["loading", "error", "longContent"],
content: ${outside ? "<><ToastProvider><p>无通知操作</p></ToastProvider><Commands /></>" : "<ToastProvider><Commands /></ToastProvider>"}, code: "toast(options)" }; export default example;`,
      statesByExport: { ToastProvider: ["loading", "error", "longContent"] }, stateModes: { ToastProvider: "stateless" },
      instructions: "点击发送，然后操作通知内的撤销按钮。",
    }).realizedStates.ToastProvider;
  }
  assert.deepEqual(inspectToast(), ["loading", "error", "longContent"]);
  assert.deepEqual(inspectToast({ disabled: true }), []);
  assert.deepEqual(inspectToast({ outside: true }), []);
  assert.deepEqual(inspectToast({ shadowWindow: true }), ["error", "longContent"]);
});

test("visible gallery captions shortcut keys and rendered sortable values prove only owning long content", () => {
  const long = "实际显示的长说明用于检查成员权限与账户安全配置的完整本地化内容".repeat(3);
  const contracts = [
    ["Gallery", `items={[{ id: "one", src: "image.png", caption: "${long}" }]}`, true],
    ["Lightbox", `items={[{ id: "one", src: "image.png", caption: "${long}" }]}`, true],
    ["Gallery", `items={[{ id: "one", src: "image.png", debugUnused: "${long}" }]}`, false],
    ["Lightbox", `items={[{ id: "one", src: "image.png", debugUnused: "${long}" }]}`, false],
    ["Input", `items={[{ caption: "${long}" }]}`, false],
    ["KeyboardShortcut", `keys={["Control", "${long}"]}`, true],
    ["Input", `keys={["${long}"]}`, false],
    ["SortableList", `items={[{ id: "one", value: "${long}" }]} renderItem={(value) => value}`, true],
    ["SortableList", `items={[{ id: "one", value: "${long}" }]} renderItem={(value) => { return value; }}`, true],
    ["SortableList", `items={[{ id: "one", value: "${long}" }]} renderItem={() => null}`, false],
    ["SortableList", `items={[{ id: "one", value: "${long}" }]} renderItem={() => "短文本"}`, false],
    ["SortableList", `items={[{ id: "one", value: "短文本", debugUnused: "${long}" }]} renderItem={(value) => value}`, false],
    ["SortableList", `items={[{ id: "one", value: "短文本", label: "${long}" }]} renderItem={() => null}`, false],
    ["Input", `items={[{ id: "one", value: "${long}" }]} renderItem={(value) => value}`, false],
  ];
  for (const [name, attributes, expected] of contracts) {
    assert.equal(inspectSingleState(name, "longContent", attributes), expected, `${name} ${attributes}`);
  }
});
