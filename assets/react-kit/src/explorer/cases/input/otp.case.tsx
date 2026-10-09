// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"otp/overview","exports":["OtpInput"]}
import { useState } from "react";
import { Field, OtpInput } from "../../../personal-ui";
import type { ExplorerCase } from "../types";
import { StatePreview } from "../state-preview";

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
  states: ["default", "disabled", "controlled", "uncontrolled", "validation", "longContent", "keyboard", "overlay", "dark", "locale"] as const,
  content: <OtpExample />,
  stateExamples: [
    { state: "default", exports: ["OtpInput"], content: <OtpExample /> },
    { state: "disabled", exports: ["OtpInput"], content: <OtpExample /> },
    { state: "controlled", exports: ["OtpInput"], content: <OtpExample /> },
    { state: "uncontrolled", exports: ["OtpInput"], content: <Field label="内部管理验证码" htmlFor="explorer-otp-default"><OtpInput id="explorer-otp-default" defaultValue="123" length={6} /></Field> },
    { state: "validation", exports: ["OtpInput"], content: <Field label="不完整验证码" htmlFor="explorer-otp-invalid" error="请输入完整的六位验证码。"><OtpInput id="explorer-otp-invalid" defaultValue="12" length={6} required invalid /></Field> },
    { state: "longContent", exports: ["OtpInput"], content: <Field label="请输入发送至您的跨区域企业账户备用认证地址的一次性验证码，账户验证信息包含很长的地址时标签也应保持完整可读" htmlFor="explorer-otp-long"><OtpInput id="explorer-otp-long" defaultValue="123456" length={6} /></Field> },
    { state: "keyboard", exports: ["OtpInput"], content: <OtpExample />, instructions: "Tab 聚焦每位验证码；输入或粘贴 123456，使用左右方向键、Backspace 检查逐位导航。" },
    { state: "overlay", exports: ["OtpInput"], content: <StatePreview state="overlay"><OtpExample /></StatePreview> },
    { state: "dark", exports: ["OtpInput"], content: <StatePreview state="dark"><OtpExample /></StatePreview> },
    { state: "locale", exports: ["OtpInput"], content: <StatePreview state="locale"><OtpExample /></StatePreview> },
  ],
  code: `<OtpInput value={value} onValueChange={setValue} length={6} required />`,
} satisfies ExplorerCase;

export default explorerCase;
