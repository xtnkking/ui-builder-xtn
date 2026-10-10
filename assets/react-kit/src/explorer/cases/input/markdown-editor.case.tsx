// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"markdown-editor/overview","exports":["MarkdownEditor","RichTextEditor"]}
import { StatePreview } from "../state-preview";
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

function MarkdownValidationExample() {
  const [markdown, setMarkdown] = useState("");
  const [legacy, setLegacy] = useState("");
  return <div className="demo-number-case__grid">
    <Field label="发布说明" htmlFor="explorer-markdown-invalid" error="请输入发布说明。"><MarkdownEditor id="explorer-markdown-invalid" value={markdown} onValueChange={setMarkdown} aria-invalid /></Field>
    <Field label="兼容入口发布说明" htmlFor="explorer-rich-invalid" error="请输入发布说明。"><RichTextEditor id="explorer-rich-invalid" value={legacy} onValueChange={setLegacy} aria-invalid /></Field>
  </div>;
}

const explorerCase = {
  id: "markdown-editor/overview",
  label: "源码编辑（Markdown）",
  summary: "MarkdownEditor 提供格式工具栏；RichTextEditor 仅作为已弃用的兼容别名展示。",
  states: ["default", "disabled", "readOnly", "controlled", "validation", "longContent", "keyboard", "overlay", "dark", "locale"] as const,
  stateExamples: [
    { state: "disabled", exports: ["MarkdownEditor", "RichTextEditor"], content: <div className="demo-number-case__grid"><Field label="禁用源码" htmlFor="explorer-markdown-disabled"><MarkdownEditor id="explorer-markdown-disabled" value="# 锁定的发布说明" onValueChange={() => undefined} disabled /></Field><Field label="禁用兼容入口" htmlFor="explorer-rich-disabled"><RichTextEditor id="explorer-rich-disabled" value="# 锁定的发布说明" onValueChange={() => undefined} disabled /></Field></div> },
    { state: "readOnly", exports: ["MarkdownEditor", "RichTextEditor"], content: <div className="demo-number-case__grid"><Field label="只读源码" htmlFor="explorer-markdown-readonly"><MarkdownEditor id="explorer-markdown-readonly" value="# 已发布的说明" onValueChange={() => undefined} readOnly /></Field><Field label="只读兼容入口" htmlFor="explorer-rich-readonly"><RichTextEditor id="explorer-rich-readonly" value="# 已发布的说明" onValueChange={() => undefined} readOnly /></Field></div> },
    { state: "validation", exports: ["MarkdownEditor", "RichTextEditor"], content: <MarkdownValidationExample /> },
    { state: "longContent", exports: ["MarkdownEditor", "RichTextEditor"], content: <div className="demo-number-case__grid"><Field label="长发布说明" htmlFor="explorer-markdown-long"><MarkdownEditor id="explorer-markdown-long" value={"# International subscription platform release notes\n\nThis deliberately long paragraph records security, billing, collaboration and cross-region settlement changes."} onValueChange={() => undefined} readOnly rows={5} /></Field><Field label="兼容入口长发布说明" htmlFor="explorer-rich-long"><RichTextEditor id="explorer-rich-long" value={"# International subscription platform release notes\n\nThis deliberately long paragraph records security, billing, collaboration and cross-region settlement changes."} onValueChange={() => undefined} readOnly rows={5} /></Field></div> },
    { state: "default", exports: ["MarkdownEditor","RichTextEditor"], content: <MarkdownEditorExample /> },
    { state: "controlled", exports: ["MarkdownEditor","RichTextEditor"], content: <MarkdownEditorExample /> },
    { state: "keyboard", exports: ["MarkdownEditor","RichTextEditor"], content: <MarkdownEditorExample />, instructions: "用 Tab 访问本例可用控件，使用 Enter、Space 和组件文档中的方向键操作。此项为人工操作案例，不是自动行为验收证书。" },
    { state: "overlay", exports: ["MarkdownEditor","RichTextEditor"], content: <StatePreview state="overlay">{<MarkdownEditorExample />}</StatePreview> },
    { state: "dark", exports: ["MarkdownEditor","RichTextEditor"], content: <StatePreview state="dark">{<MarkdownEditorExample />}</StatePreview> },
    { state: "locale", exports: ["MarkdownEditor","RichTextEditor"], content: <StatePreview state="locale">{<MarkdownEditorExample />}</StatePreview> },
  ],
  content: <MarkdownEditorExample />,
  code: `<MarkdownEditor value={markdown} onValueChange={setMarkdown} rows={8} />`,
} satisfies ExplorerCase;

export default explorerCase;
