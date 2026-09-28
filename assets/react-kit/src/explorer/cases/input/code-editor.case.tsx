// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"code-editor/overview","exports":["CodeEditor"]}
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

const explorerCase = {
  id: "code-editor/overview",
  label: "代码文本编辑",
  summary: "默认 Tab 离开编辑器；显式缩进模式可通过 Control+M 退出，避免键盘陷阱。",
  states: ["default", "disabled", "readOnly", "controlled", "uncontrolled", "validation", "longContent", "keyboard", "overlay", "dark", "locale"] as const,
  content: <CodeEditorExample />,
  code: `<CodeEditor language="typescript" value={code} onValueChange={setCode} />\n<CodeEditor tabBehavior="indent" value={code} onValueChange={setCode} />`,
} satisfies ExplorerCase;

export default explorerCase;
