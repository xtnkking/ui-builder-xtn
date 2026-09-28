// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"textarea/overview","exports":["Textarea"]}
import { useState } from "react";
import { Field, Textarea } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

function TextareaExample() {
  const [value, setValue] = useState("记录本次变更的原因、影响范围和回滚方式。");
  return (
    <div className="demo-number-case__grid">
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
  code: `<Textarea rows={4} value={value} onChange={(event) => setValue(event.currentTarget.value)} />`,
} satisfies ExplorerCase;

export default explorerCase;
