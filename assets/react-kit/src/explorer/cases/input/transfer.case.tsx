// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"transfer/overview","exports":["Transfer"]}
import { useState } from "react";
import { Field, Transfer } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const members = [
  { value: "ana", label: "Ana · Design" },
  { value: "bo", label: "Bo · Platform" },
  { value: "chen", label: "Chen · Operations" },
  { value: "dana", label: "Dana · Security", disabled: true },
];

function TransferExample() {
  const [value, setValue] = useState<string[]>(["bo"]);
  return <Field label="项目成员" group required><Transfer ariaLabel="项目成员" value={value} onValueChange={setValue} options={members} sourceTitle="可邀请成员" targetTitle="项目成员" required /></Field>;
}

const explorerCase = {
  id: "transfer/overview",
  label: "穿梭选择",
  summary: "在两个列表间移动多项，保留禁用项、键盘选择和必填表单语义。",
  states: ["default", "disabled", "readOnly", "controlled", "validation", "keyboard", "overlay", "dark", "locale"] as const,
  content: <TransferExample />,
  code: `<Transfer ariaLabel="项目成员" value={value} onValueChange={setValue} options={members} />`,
} satisfies ExplorerCase;

export default explorerCase;
