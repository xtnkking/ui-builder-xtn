// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"textarea/overview","exports":["Textarea"]}
import { useState } from "react";
import { Field, Textarea } from "../../../personal-ui";
import { StatePreview } from "../state-preview";
import type { ExplorerCase } from "../types";

function TextareaExample() {
  const [value, setValue] = useState("记录本次变更的原因、影响范围和回滚方式。");
  return (
    <div className="demo-number-case__grid" style={{ alignItems: "start" }}>
      <Field label="变更说明" htmlFor="explorer-textarea" hint={`${value.length}/300`}>
        <Textarea id="explorer-textarea" rows={4} maxLength={300} value={value} onChange={(event) => setValue(event.currentTarget.value)} />
      </Field>
      <Field label="已归档说明" htmlFor="explorer-textarea-readonly">
        <Textarea id="explorer-textarea-readonly" rows={4} defaultValue="这是一段只读的历史记录。" readOnly />
      </Field>
    </div>
  );
}

const explorerCase = {
  id: "textarea/overview",
  label: "多行文本",
  summary: "展示受控长文本、字符限制以及只读内容。",
  states: ["default", "disabled", "readOnly", "controlled", "uncontrolled", "validation", "longContent", "keyboard", "overlay", "dark", "locale"] as const,
  content: <TextareaExample />,
  stateExamples: [
    { state: "default", exports: ["Textarea"], content: <TextareaExample /> },
    { state: "disabled", exports: ["Textarea"], content: <Textarea aria-label="禁用说明" disabled defaultValue="已归档，不可编辑。" /> },
    { state: "readOnly", exports: ["Textarea"], content: <Textarea aria-label="只读说明" readOnly defaultValue="已审核的说明，允许选择复制。" /> },
    { state: "controlled", exports: ["Textarea"], content: <TextareaExample /> },
    { state: "uncontrolled", exports: ["Textarea"], content: <Textarea aria-label="非受控说明" defaultValue="编辑此值由控件内部管理。" /> },
    { state: "validation", exports: ["Textarea"], content: <Field label="校验失败的说明" htmlFor="explorer-invalid-textarea" error="请补充变更原因。"><Textarea id="explorer-invalid-textarea" aria-label="校验失败的说明" aria-invalid="true" defaultValue="" /></Field> },
    { state: "longContent", exports: ["Textarea"], content: <Textarea aria-label="长说明" rows={4} defaultValue="本次变更涉及多个区域的访问权限、通知偏好和审核流程。请记录每项变更的责任人、影响范围、回滚条件与审批记录，验证多行内容溢出后的滚动、选择和编辑行为。" /> },
    { state: "keyboard", exports: ["Textarea"], instructions: "Tab 聚焦后输入并选择文本；再次按 Tab 离开，多行编辑不会拦截 Tab。", content: <TextareaExample /> },
    { state: "overlay", exports: ["Textarea"], content: <StatePreview state="overlay">{<Textarea aria-label="浮层内的说明" defaultValue="测试编辑与焦点返回。" />}</StatePreview> },
    { state: "dark", exports: ["Textarea"], content: <StatePreview state="dark">{<Textarea aria-label="深色说明" defaultValue="深色模式下的文本与占位内容。" />}</StatePreview> },
    { state: "locale", exports: ["Textarea"], content: <StatePreview state="locale">{<Textarea aria-label="Change notes" defaultValue="Review permissions, notification settings, and rollback conditions." />}</StatePreview> },
  ],
  code: `<Textarea rows={4} value={value} onChange={(event) => setValue(event.currentTarget.value)} />`,
} satisfies ExplorerCase;

export default explorerCase;
