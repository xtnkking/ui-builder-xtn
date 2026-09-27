// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"otp/overview","exports":["OtpInput"]}
import { useState } from "react";
import { Field, OtpInput } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

function OtpExample() {
  const [value, setValue] = useState("26");
  return (
    <div className="demo-number-case__grid">
      <Field label="六位验证码" htmlFor="explorer-otp" required hint="支持逐位输入和整段粘贴。"><OtpInput id="explorer-otp" value={value} onValueChange={setValue} required /></Field>
      <Field label="已停用验证码" htmlFor="explorer-otp-disabled"><OtpInput id="explorer-otp-disabled" defaultValue="123456" disabled /></Field>
    </div>
  );
}

const explorerCase = {
  id: "otp/overview",
  label: "一次性验证码",
  summary: "展示受控输入、粘贴、方向键、必填与禁用状态。",
  states: ["default", "disabled", "readOnly", "controlled", "uncontrolled", "validation", "longContent", "keyboard", "overlay", "dark", "locale"] as const,
  content: <OtpExample />,
  code: `<OtpInput value={value} onValueChange={setValue} length={6} required />`,
} satisfies ExplorerCase;

export default explorerCase;
