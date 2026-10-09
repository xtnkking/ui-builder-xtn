// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"checkbox/overview","exports":["Checkbox"]}
import { useState } from "react";
import { Checkbox, Field } from "../../../personal-ui";
import type { ExplorerCase } from "../types";
import { StatePreview } from "../state-preview";

function CheckboxExample() {
  const [checked, setChecked] = useState(true);
  return (
    <Field label="通知渠道" group>
      <Checkbox label="产品更新" checked={checked} onChange={(event) => setChecked(event.currentTarget.checked)} />
      <Checkbox label="安全告警（不可关闭）" defaultChecked disabled />
    </Field>
  );
}

const explorerCase = {
  id: "checkbox/overview",
  label: "复选项",
  summary: "同时展示受控、非受控与禁用选择状态。",
  states: ["default", "disabled", "controlled", "uncontrolled", "validation", "longContent", "keyboard", "overlay", "dark", "locale"] as const,
  content: <CheckboxExample />,
  stateExamples: [
    { state: "default", exports: ["Checkbox"], content: <CheckboxExample /> },
    { state: "disabled", exports: ["Checkbox"], content: <CheckboxExample /> },
    { state: "controlled", exports: ["Checkbox"], content: <CheckboxExample /> },
    { state: "uncontrolled", exports: ["Checkbox"], content: <Checkbox label="内部管理的消息订阅选项" defaultChecked /> },
    { state: "validation", exports: ["Checkbox"], content: <Field label="服务协议" group error="需要同意服务协议才能继续。"><Checkbox label="我已阅读并同意服务协议" defaultChecked={false} required aria-invalid /></Field> },
    { state: "longContent", exports: ["Checkbox"], content: <Checkbox label="同时接收跨区域企业账户的账单变更、安全告警、产品更新和协作空间成员访问权限变更通知，并保留完整通知说明以便管理员了解订阅范围" defaultChecked /> },
    { state: "keyboard", exports: ["Checkbox"], content: <CheckboxExample />, instructions: "Tab 聚焦可用复选项，Space 切换选中；禁用选项不能修改。" },
    { state: "overlay", exports: ["Checkbox"], content: <StatePreview state="overlay"><CheckboxExample /></StatePreview> },
    { state: "dark", exports: ["Checkbox"], content: <StatePreview state="dark"><CheckboxExample /></StatePreview> },
    { state: "locale", exports: ["Checkbox"], content: <StatePreview state="locale"><CheckboxExample /></StatePreview> },
  ],
  code: `<Checkbox label="产品更新" checked={checked} onChange={handleChange} />`,
} satisfies ExplorerCase;

export default explorerCase;
