// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"text-input/overview","exports":["Input","PasswordInput"]}
import { useState } from "react";
import { Field, Input, PasswordInput } from "../../../personal-ui";
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

const explorerCase = {
  id: "text-input/overview",
  label: "文本与密码输入",
  summary: "受控文本、密码可见性、只读和禁用状态共享稳定的输入框几何。",
  states: ["default", "disabled", "readOnly", "controlled", "uncontrolled", "validation", "longContent", "keyboard", "overlay", "dark", "locale"] as const,
  content: <TextInputExample />,
  code: `<Input value={account} onChange={handleAccountChange} />\n<PasswordInput value={password} onChange={handlePasswordChange} />`,
} satisfies ExplorerCase;

export default explorerCase;
