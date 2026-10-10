// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"tag-input/overview","exports":["TagInput"]}
import { useState } from "react";
import { Field, TagInput } from "../../../personal-ui";
import type { ExplorerCase } from "../types";
import { StatePreview } from "../state-preview";

const suggestions = [
  { value: "frontend", label: "前端" },
  { value: "backend", label: "后端" },
  { value: "operations", label: "运维" },
  { value: "archived", label: "已过期", disabled: true },
];

function TagInputExample() {
  const [tags, setTags] = useState<string[]>(["frontend", "backend"]);
  const [draft, setDraft] = useState("");
  return (
    <div className="demo-number-case__grid">
      <Field label="技能标签" htmlFor="explorer-tag-input" hint="最多 5 个，输入后按 Enter。"><TagInput id="explorer-tag-input" ariaLabel="技能标签" value={tags} onValueChange={setTags} inputValue={draft} onInputValueChange={setDraft} suggestions={suggestions} maxTags={5} validateValue={(value) => value.length < 2 ? "标签至少两个字符" : undefined} /></Field>
      <Field label="禁用标签" htmlFor="explorer-tag-disabled"><TagInput id="explorer-tag-disabled" ariaLabel="禁用标签" defaultValue={["frontend"]} suggestions={suggestions} disabled /></Field>
    </div>
  );
}

function LongTagInputExample() {
  return <Field label="长标签与完整值" htmlFor="explorer-tag-long" hint="悬停省略文字查看全文，Tab 聚焦可由辅助技术读取完整文字；删除按钮始终保留，提交值不截断。">
    <TagInput id="explorer-tag-long" ariaLabel="长标签" name="labels" defaultValue={[
      "enterprise-platform-subscription-security-operations-and-international-settlement-reporting",
      "跨区域企业工作区的身份认证、访问权限、结算与安全策略审核标签，保留完整值用于提交",
    ]} />
  </Field>;
}

const explorerCase = {
  id: "tag-input/overview",
  label: "标签录入",
  summary: "胶囊标签在控件内换行，长文本省略并可悬停查看全文、通过键盘访问完整文字，原始值和删除按钮保持完整。覆盖建议、校验、数量限制与禁用状态。",
  states: ["default", "disabled", "controlled", "uncontrolled", "validation", "longContent", "keyboard", "overlay", "dark", "locale"] as const,
  content: <TagInputExample />,
  stateExamples: [
    { state: "default", exports: ["TagInput"], content: <TagInputExample /> },
    { state: "disabled", exports: ["TagInput"], content: <TagInputExample /> },
    { state: "controlled", exports: ["TagInput"], content: <TagInputExample /> },
    { state: "uncontrolled", exports: ["TagInput"], content: <Field label="内部管理技能标签" htmlFor="explorer-tag-default"><TagInput id="explorer-tag-default" ariaLabel="技能标签" defaultValue={["frontend"]} suggestions={suggestions} /></Field> },
    { state: "validation", exports: ["TagInput"], content: <Field label="标签校验" htmlFor="explorer-tag-invalid" error="标签至少需要两个字符。"><TagInput id="explorer-tag-invalid" ariaLabel="标签校验" defaultInputValue="x" validateValue={(value) => value.trim().length < 2 ? "标签至少需要两个字符" : undefined} /></Field> },
    { state: "longContent", exports: ["TagInput"], content: <LongTagInputExample />, instructions: "悬停省略文字查看原生全文提示；Tab 聚焦后辅助技术可读取完整文字，再访问删除按钮。原始 labels 值不因视觉省略改变。" },
    { state: "keyboard", exports: ["TagInput"], content: <TagInputExample />, instructions: "Tab 聚焦输入框，输入标签后 Enter 添加；用方向键选建议，Backspace 删除空输入框前的标签，Esc 关闭建议。" },
    { state: "overlay", exports: ["TagInput"], content: <StatePreview state="overlay"><TagInputExample /></StatePreview> },
    { state: "dark", exports: ["TagInput"], content: <StatePreview state="dark"><TagInputExample /></StatePreview> },
    { state: "locale", exports: ["TagInput"], content: <StatePreview state="locale"><TagInputExample /></StatePreview> },
  ],
  code: `<TagInput value={tags} onValueChange={setTags} inputValue={draft} onInputValueChange={setDraft} suggestions={suggestions} />`,
} satisfies ExplorerCase;

export default explorerCase;
