// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"text-input/overview","exports":["Input","PasswordInput"]}
import { useState } from "react";
import { Field, Input, PasswordInput } from "../../../personal-ui";
import { StatePreview } from "../state-preview";
import type { ExplorerCase } from "../types";

function TextInputExample() {
  const [account, setAccount] = useState("xtn@example.com");
  const [password, setPassword] = useState("correct-horse");
  return (
    <div className="demo-number-case__grid">
      <Field label="账号" htmlFor="explorer-account">
        <Input id="explorer-account" value={account} onChange={(event) => setAccount(event.currentTarget.value)} />
      </Field>
      <Field label="密码" htmlFor="explorer-password">
        <PasswordInput id="explorer-password" value={password} onChange={(event) => setPassword(event.currentTarget.value)} />
      </Field>
      <Field label="只读编号" htmlFor="explorer-readonly-input">
        <Input id="explorer-readonly-input" defaultValue="ORG-2026-09" readOnly />
      </Field>
      <Field label="禁用字段" htmlFor="explorer-disabled-input">
        <Input id="explorer-disabled-input" defaultValue="不可编辑" disabled />
      </Field>
    </div>
  );
}

function DisabledInputs() {
  return <div className="demo-number-case__grid">
    <Field label="禁用账号" htmlFor="explorer-state-disabled-input"><Input id="explorer-state-disabled-input" defaultValue="locked@example.com" disabled /></Field>
    <Field label="禁用密码" htmlFor="explorer-state-disabled-password"><PasswordInput id="explorer-state-disabled-password" defaultValue="locked-password" disabled /></Field>
  </div>;
}

function ReadOnlyInputs() {
  return <div className="demo-number-case__grid">
    <Field label="只读账号" htmlFor="explorer-state-readonly-input"><Input id="explorer-state-readonly-input" defaultValue="readonly@example.com" readOnly /></Field>
    <Field label="只读密码" htmlFor="explorer-state-readonly-password"><PasswordInput id="explorer-state-readonly-password" defaultValue="readonly-password" readOnly /></Field>
  </div>;
}

function UncontrolledInputs() {
  return <div className="demo-number-case__grid">
    <Field label="默认账号（内部管理输入值）" htmlFor="explorer-state-default-input"><Input id="explorer-state-default-input" defaultValue="default@example.com" /></Field>
    <Field label="默认密码（内部管理输入值）" htmlFor="explorer-state-default-password"><PasswordInput id="explorer-state-default-password" defaultValue="default-password" /></Field>
  </div>;
}

function InvalidInputs() {
  return <div className="demo-number-case__grid">
    <Field label="账号校验失败" htmlFor="explorer-state-invalid-input" error="请输入有效的邮箱地址。"><Input id="explorer-state-invalid-input" defaultValue="invalid" invalid /></Field>
    <Field label="密码校验失败" htmlFor="explorer-state-invalid-password" error="密码至少需要八个字符。"><PasswordInput id="explorer-state-invalid-password" defaultValue="short" invalid /></Field>
  </div>;
}

function LongInputs() {
  return <div className="demo-number-case__grid">
    <Field label="长账号：拖动插入点检查内容横向滚动" htmlFor="explorer-state-long-input"><Input id="explorer-state-long-input" defaultValue="enterprise-platform-account-with-a-very-long-identifier-for-overflow-review@example.com" /></Field>
    <Field label="长密码：切换可见性时控件宽度保持稳定" htmlFor="explorer-state-long-password"><PasswordInput id="explorer-state-long-password" defaultValue="long-password-for-visible-content-overflow-review-and-stable-eye-button-position-2026" /></Field>
  </div>;
}

const explorerCase = {
  id: "text-input/overview",
  label: "文本与密码输入",
  summary: "真实演示文本与密码的受控、非受控、只读、禁用、校验和长内容，并可切换环境案例。",
  states: ["default", "disabled", "readOnly", "controlled", "uncontrolled", "validation", "longContent", "keyboard", "overlay", "dark", "locale"] as const,
  content: <TextInputExample />,
  stateExamples: [
    { state: "default", exports: ["Input", "PasswordInput"], content: <TextInputExample /> },
    { state: "controlled", exports: ["Input", "PasswordInput"], content: <TextInputExample /> },
    { state: "disabled", exports: ["Input", "PasswordInput"], content: <DisabledInputs /> },
    { state: "readOnly", exports: ["Input", "PasswordInput"], content: <ReadOnlyInputs /> },
    { state: "uncontrolled", exports: ["Input", "PasswordInput"], content: <UncontrolledInputs /> },
    { state: "validation", exports: ["Input", "PasswordInput"], content: <InvalidInputs /> },
    { state: "longContent", exports: ["Input", "PasswordInput"], content: <LongInputs /> },
    { state: "keyboard", exports: ["Input", "PasswordInput"], content: <TextInputExample />, instructions: "按 Tab 依次聚焦输入框和密码可见性按钮；输入文字，再按 Space 或 Enter 切换密码可见性。这里只展示可操作案例，自动键盘验收另有证据。" },
    { state: "overlay", exports: ["Input", "PasswordInput"], content: <StatePreview state="overlay">{<TextInputExample />}</StatePreview> },
    { state: "dark", exports: ["Input", "PasswordInput"], content: <StatePreview state="dark">{<TextInputExample />}</StatePreview> },
    { state: "locale", exports: ["Input", "PasswordInput"], content: <StatePreview state="locale">{<TextInputExample />}</StatePreview> },
  ],
  code: `<Input value={account} onChange={handleAccountChange} />\n<PasswordInput value={password} onChange={handlePasswordChange} />`,
} satisfies ExplorerCase;

export default explorerCase;
