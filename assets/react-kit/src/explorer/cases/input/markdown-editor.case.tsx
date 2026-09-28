// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"markdown-editor/overview","exports":["MarkdownEditor","RichTextEditor"]}
import { useState } from "react";
import { Field, MarkdownEditor, RichTextEditor } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

function MarkdownEditorExample() {
  const [value, setValue] = useState("# 发布说明\n\n- 新增组件 Explorer\n- 完善键盘合同");
  const [legacy, setLegacy] = useState("**兼容入口**仍编辑 Markdown 源码。");
  return (
    <div className="demo-number-case__grid">
      <Field label="Markdown 内容" htmlFor="explorer-markdown"><MarkdownEditor id="explorer-markdown" rows={7} value={value} onValueChange={setValue} /></Field>
      <Field label="旧名称兼容示例" htmlFor="explorer-rich-text"><RichTextEditor id="explorer-rich-text" rows={7} value={legacy} onValueChange={setLegacy} /></Field>
    </div>
  );
}

const explorerCase = {
  id: "markdown-editor/overview",
  label: "Markdown 源码编辑",
  summary: "MarkdownEditor 提供格式工具栏；RichTextEditor 仅作为已弃用的兼容别名展示。",
  states: ["default", "disabled", "readOnly", "controlled", "uncontrolled", "validation", "longContent", "keyboard", "overlay", "dark", "locale"] as const,
  content: <MarkdownEditorExample />,
  code: `<MarkdownEditor value={markdown} onValueChange={setMarkdown} rows={8} />`,
} satisfies ExplorerCase;

export default explorerCase;
