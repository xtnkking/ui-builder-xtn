// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"number/overview","exports":["NumberInput"]}
import { useState } from "react";
import { Field, NumberInput } from "../../../personal-ui";
import type { ExplorerCase } from "../types";
import { StatePreview } from "../state-preview";

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

function ControlledNumberExample() {
  const [value, setValue] = useState<number | "">(30);
  return <Field label="超时时间（秒）" htmlFor="explorer-number-controlled"><NumberInput id="explorer-number-controlled" value={value} onValueChange={setValue} min={0} max={180} step={10} /></Field>;
}

function InvalidNumberExample() {
  const [value, setValue] = useState<number | "">(200);
  return <Field label="超时时间" htmlFor="explorer-number-invalid" error="超时时间必须在 0 至 180 秒之间。"><NumberInput id="explorer-number-invalid" value={value} onValueChange={setValue} min={0} max={180} invalid /></Field>;
}

function LongNumberExample() {
  const [value, setValue] = useState<number | "">(30);
  return <Field label="等待跨区域结算服务响应所允许的最长超时时间，需要在弱网络情况下为批量任务保留充足的处理时间" htmlFor="explorer-number-long"><NumberInput id="explorer-number-long" value={value} onValueChange={setValue} min={0} max={180} /></Field>;
}

const explorerCase = {
  id: "number/overview",
  label: "数字步进输入",
  summary: "覆盖受控、边界、只读与禁用数字输入。",
  states: ["default", "disabled", "readOnly", "controlled", "validation", "longContent", "keyboard", "overlay", "dark", "locale"] as const,
  content: <NumberExample />,
  stateExamples: [
    { state: "default", exports: ["NumberInput"], content: <ControlledNumberExample /> },
    { state: "disabled", exports: ["NumberInput"], content: <Field label="禁用重试次数" htmlFor="explorer-number-disabled"><NumberInput id="explorer-number-disabled" value={3} onValueChange={() => undefined} disabled /></Field> },
    { state: "readOnly", exports: ["NumberInput"], content: <Field label="只读配额" htmlFor="explorer-number-readonly"><NumberInput id="explorer-number-readonly" value={100} onValueChange={() => undefined} readOnly /></Field> },
    { state: "controlled", exports: ["NumberInput"], content: <ControlledNumberExample /> },
    { state: "validation", exports: ["NumberInput"], content: <InvalidNumberExample /> },
    { state: "longContent", exports: ["NumberInput"], content: <LongNumberExample /> },
    { state: "keyboard", exports: ["NumberInput"], content: <NumberExample />, instructions: "Tab 聚焦数值与步进按钮，输入数值或按 Enter/Space 使用加减按钮，检查边界禁止继续递增。" },
    { state: "overlay", exports: ["NumberInput"], content: <StatePreview state="overlay"><NumberExample /></StatePreview> },
    { state: "dark", exports: ["NumberInput"], content: <StatePreview state="dark"><NumberExample /></StatePreview> },
    { state: "locale", exports: ["NumberInput"], content: <StatePreview state="locale"><NumberExample /></StatePreview> },
  ],
  code: `<NumberInput value={value} onValueChange={setValue} min={0} max={180} step={10} />`,
} satisfies ExplorerCase;

export default explorerCase;
