// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"code-editor/overview","exports":["CodeEditor"]}
import { StatePreview } from "../state-preview";
import { useState } from "react";
import { CodeEditor, Field } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

function CodeEditorExample() {
  const [focusCode, setFocusCode] = useState("export const ready = true;");
  const [indentCode, setIndentCode] = useState("function save() {\n  return true;\n}");
  return (
    <div className="demo-number-case__grid">
      <Field label="默认焦点导航" htmlFor="explorer-code-focus"><CodeEditor id="explorer-code-focus" rows={6} language="typescript" value={focusCode} onValueChange={setFocusCode} /></Field>
      <Field label="可退出的 Tab 缩进" htmlFor="explorer-code-indent" hint="Control+M 在缩进和焦点导航之间切换。"><CodeEditor id="explorer-code-indent" rows={6} language="typescript" tabBehavior="indent" value={indentCode} onValueChange={setIndentCode} /></Field>
    </div>
  );
}

function CodeValidationExample() {
  const [code, setCode] = useState("");
  return <Field label="配置源码" htmlFor="explorer-code-invalid" error="配置源码不能为空。"><CodeEditor id="explorer-code-invalid" value={code} onValueChange={setCode} aria-invalid language="typescript" /></Field>;
}

const explorerCase = {
  id: "code-editor/overview",
  label: "代码文本编辑",
  summary: "默认 Tab 离开编辑器；显式缩进模式可通过 Control+M 退出，避免键盘陷阱。",
  states: ["default", "disabled", "readOnly", "controlled", "validation", "longContent", "keyboard", "overlay", "dark", "locale"] as const,
  stateExamples: [
    { state: "disabled", exports: ["CodeEditor"], content: <Field label="禁用源码" htmlFor="explorer-code-disabled"><CodeEditor id="explorer-code-disabled" value="export const locked = true;" onValueChange={() => undefined} disabled /></Field> },
    { state: "readOnly", exports: ["CodeEditor"], content: <Field label="只读源码" htmlFor="explorer-code-readonly"><CodeEditor id="explorer-code-readonly" value="export const published = true;" onValueChange={() => undefined} readOnly /></Field> },
    { state: "validation", exports: ["CodeEditor"], content: <CodeValidationExample /> },
    { state: "longContent", exports: ["CodeEditor"], content: <Field label="长源码与横向滚动" htmlFor="explorer-code-long"><CodeEditor id="explorer-code-long" value="export const internationalSubscriptionPlatformSecurityAndCrossRegionSettlementConfiguration = { enabled: true, audit: true, billing: true };" onValueChange={() => undefined} readOnly rows={4} /></Field> },
    { state: "default", exports: ["CodeEditor"], content: <CodeEditorExample /> },
    { state: "controlled", exports: ["CodeEditor"], content: <CodeEditorExample /> },
    { state: "keyboard", exports: ["CodeEditor"], content: <CodeEditorExample />, instructions: "用 Tab 访问本例可用控件，使用 Enter、Space 和组件文档中的方向键操作。此项为人工操作案例，不是自动行为验收证书。" },
    { state: "overlay", exports: ["CodeEditor"], content: <StatePreview state="overlay">{<CodeEditorExample />}</StatePreview> },
    { state: "dark", exports: ["CodeEditor"], content: <StatePreview state="dark">{<CodeEditorExample />}</StatePreview> },
    { state: "locale", exports: ["CodeEditor"], content: <StatePreview state="locale">{<CodeEditorExample />}</StatePreview> },
  ],
  content: <CodeEditorExample />,
  code: `<CodeEditor language="typescript" value={code} onValueChange={setCode} />\n<CodeEditor tabBehavior="indent" value={code} onValueChange={setCode} />`,
} satisfies ExplorerCase;

export default explorerCase;
