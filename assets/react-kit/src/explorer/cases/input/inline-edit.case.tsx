// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"inline-edit/overview","exports":["InlineEdit"]}
import { StatePreview } from "../state-preview";
import { useState } from "react";
import { Field, InlineEdit } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

function InlineEditExample() {
  const [name, setName] = useState("平台工程组");
  return (
    <div className="demo-number-case__grid">
      <Field label="团队名称" group required><InlineEdit value={name} onCommit={async (nextValue) => setName(nextValue)} validate={(value) => value.trim().length < 2 ? "至少输入两个字符" : undefined} required /></Field>
      <Field label="锁定标识" group><InlineEdit value="TEAM-PLATFORM" onCommit={() => undefined} disabled /></Field>
    </div>
  );
}

function InlineValidationExample() {
  const [name, setName] = useState("x");
  return <Field label="团队名称" group error="团队名称至少需要两个字符。"><InlineEdit value={name} onCommit={async (nextValue) => setName(nextValue)} validate={(value) => value.trim().length < 2 ? "至少输入两个字符" : undefined} /></Field>;
}

function LongInlineEditExample() {
  const [name, setName] = useState("International subscription platform security operations and cross-region settlement engineering team");
  return <Field label="跨区域结算平台的组织团队完整名称，需要保留业务领域、所属区域和负责的运营任务信息以便管理员确认团队身份" group><InlineEdit value={name} onCommit={async (nextValue) => setName(nextValue)} /></Field>;
}

function SavingInlineEditExample() {
  const [name, setName] = useState("平台工程组");
  return <Field label="异步保存团队名称" group><InlineEdit value={name} onCommit={async (nextValue) => { await new Promise<void>((resolve) => setTimeout(resolve, 600)); setName(nextValue); }} /></Field>;
}

function EmptyInlineEditExample() {
  const [name, setName] = useState("");
  return <Field label="未填写的团队名称" group>{name
    ? <InlineEdit value={name} onCommit={setName} />
    : <InlineEdit value="" onCommit={setName} emptyLabel="尚未填写团队名称" />}</Field>;
}

const explorerCase = {
  id: "inline-edit/overview",
  label: "行内编辑",
  summary: "展示只在保存后更新的受控值、异步保存、校验、取消和禁用状态。",
  states: ["default", "disabled", "controlled", "loading", "empty", "error", "validation", "longContent", "keyboard", "overlay", "dark", "locale"] as const,
  stateExamples: [
    { state: "loading", exports: ["InlineEdit"], content: <SavingInlineEditExample />, instructions: "点击编辑并修改名称后保存；示例保存等待 600 毫秒，在此期间可观察保存按钮 loading 状态。" },
    { state: "empty", exports: ["InlineEdit"], content: <EmptyInlineEditExample /> },
    { state: "error", exports: ["InlineEdit"], content: <Field label="保存失败的团队名称" group><InlineEdit value="平台工程组" onCommit={async () => { throw new Error("保存失败，请稍后重试。"); }} /></Field>, instructions: "点击编辑、修改名称后保存，实际被拒绝的提交回调会展示错误并保留输入内容。" },
    { state: "controlled", exports: ["InlineEdit"], content: <InlineEditExample /> },
    { state: "validation", exports: ["InlineEdit"], content: <InlineValidationExample />, instructions: "点击编辑按钮，输入单字符后保存，观察实际 validate 回调的校验错误。" },
    { state: "longContent", exports: ["InlineEdit"], content: <LongInlineEditExample /> },
    { state: "default", exports: ["InlineEdit"], content: <InlineEditExample /> },
    { state: "disabled", exports: ["InlineEdit"], content: <InlineEditExample /> },
    { state: "keyboard", exports: ["InlineEdit"], content: <InlineEditExample />, instructions: "用 Tab 访问本例可用控件，使用 Enter、Space 和组件文档中的方向键操作。此项为人工操作案例，不是自动行为验收证书。" },
    { state: "overlay", exports: ["InlineEdit"], content: <StatePreview state="overlay">{<InlineEditExample />}</StatePreview> },
    { state: "dark", exports: ["InlineEdit"], content: <StatePreview state="dark">{<InlineEditExample />}</StatePreview> },
    { state: "locale", exports: ["InlineEdit"], content: <StatePreview state="locale">{<InlineEditExample />}</StatePreview> },
  ],
  content: <InlineEditExample />,
  code: `<InlineEdit value={name} onCommit={saveName} validate={(value) => value.trim() ? undefined : "请输入名称"} />`,
} satisfies ExplorerCase;

export default explorerCase;
