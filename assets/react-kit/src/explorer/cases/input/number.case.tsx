// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"number/overview","exports":["NumberInput"]}
import { useState } from "react";
import { Field, NumberInput } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

function NumberExample() {
  const [value, setValue] = useState<number | "">(30);
  return (
    <div className="demo-number-case__grid">
      <Field label="超时时间（秒）" htmlFor="explorer-number"><NumberInput id="explorer-number" value={value} onValueChange={setValue} min={0} max={180} step={10} /></Field>
      <Field label="只读配额" htmlFor="explorer-number-readonly"><NumberInput id="explorer-number-readonly" value={100} onValueChange={() => undefined} readOnly /></Field>
      <Field label="禁用重试次数" htmlFor="explorer-number-disabled"><NumberInput id="explorer-number-disabled" value={3} onValueChange={() => undefined} disabled /></Field>
    </div>
  );
}

const explorerCase = {
  id: "number/overview",
  label: "数字步进输入",
  summary: "覆盖受控、边界、只读与禁用数字输入。",
  states: ["default", "disabled", "readOnly", "controlled", "uncontrolled", "validation", "longContent", "keyboard", "overlay", "dark", "locale"] as const,
  content: <NumberExample />,
  code: `<NumberInput value={value} onValueChange={setValue} min={0} max={180} step={10} />`,
} satisfies ExplorerCase;

export default explorerCase;
