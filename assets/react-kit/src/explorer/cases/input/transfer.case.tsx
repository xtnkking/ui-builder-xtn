// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"transfer/overview","exports":["Transfer"]}
import { StatePreview } from "../state-preview";
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
  states: ["default", "disabled", "controlled", "uncontrolled", "validation", "longContent", "keyboard", "overlay", "dark", "locale"] as const,
  stateExamples: [
    { state: "uncontrolled", exports: ["Transfer"], content: <Transfer ariaLabel="内部管理成员列表" defaultValue={["bo"]} options={members} /> },
    { state: "validation", exports: ["Transfer"], content: <Field label="必选项目成员" group error="项目必须至少有一位成员。"><Transfer ariaLabel="必选项目成员" defaultValue={[]} options={members} required /></Field> },
    { state: "longContent", exports: ["Transfer"], content: <Transfer ariaLabel="长成员名称" defaultValue={["international"]} options={[{ value: "international", label: "International subscription platform security and cross-region settlement engineering operations team" }, ...members]} /> },
    { state: "default", exports: ["Transfer"], content: <TransferExample /> },
    { state: "disabled", exports: ["Transfer"], content: <TransferExample /> },
    { state: "controlled", exports: ["Transfer"], content: <TransferExample /> },
    { state: "keyboard", exports: ["Transfer"], content: <TransferExample />, instructions: "用 Tab 访问本例可用控件，使用 Enter、Space 和组件文档中的方向键操作。此项为人工操作案例，不是自动行为验收证书。" },
    { state: "overlay", exports: ["Transfer"], content: <StatePreview state="overlay">{<TransferExample />}</StatePreview> },
    { state: "dark", exports: ["Transfer"], content: <StatePreview state="dark">{<TransferExample />}</StatePreview> },
    { state: "locale", exports: ["Transfer"], content: <StatePreview state="locale">{<TransferExample />}</StatePreview> },
  ],
  content: <TransferExample />,
  code: `<Transfer ariaLabel="项目成员" value={value} onValueChange={setValue} options={members} />`,
} satisfies ExplorerCase;

export default explorerCase;
