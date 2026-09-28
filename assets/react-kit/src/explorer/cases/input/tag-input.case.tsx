// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"tag-input/overview","exports":["TagInput"]}
import { useState } from "react";
import { Field, TagInput } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

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

const explorerCase = {
  id: "tag-input/overview",
  label: "标签录入",
  summary: "胶囊标签保持稳定尺寸，并覆盖建议、校验、数量限制与禁用状态。",
  states: ["default", "disabled", "readOnly", "controlled", "uncontrolled", "validation", "longContent", "keyboard", "overlay", "dark", "locale"] as const,
  content: <TagInputExample />,
  code: `<TagInput value={tags} onValueChange={setTags} inputValue={draft} onInputValueChange={setDraft} suggestions={suggestions} />`,
} satisfies ExplorerCase;

export default explorerCase;
