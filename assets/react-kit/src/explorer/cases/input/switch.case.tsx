// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"switch/overview","exports":["Switch"]}
import { useState } from "react";
import { Field, Switch } from "../../../personal-ui";
import type { ExplorerCase } from "../types";
import { StatePreview } from "../state-preview";

function SwitchExample() {
  const [enabled, setEnabled] = useState(true);
  return (
    <div className="demo-number-case__grid">
      <Switch label="自动保存" checked={enabled} onChange={(event) => setEnabled(event.currentTarget.checked)} />
      <Switch label="受策略管理" checked disabled onChange={() => undefined} />
    </div>
  );
}

const explorerCase = {
  id: "switch/overview",
  label: "二元设置",
  summary: "展示受控开关和由系统策略锁定的禁用状态。",
  states: ["default", "disabled", "controlled", "uncontrolled", "validation", "longContent", "keyboard", "overlay", "dark", "locale"] as const,
  content: <SwitchExample />,
  stateExamples: [
    { state: "default", exports: ["Switch"], content: <SwitchExample /> },
    { state: "disabled", exports: ["Switch"], content: <SwitchExample /> },
    { state: "controlled", exports: ["Switch"], content: <SwitchExample /> },
    { state: "uncontrolled", exports: ["Switch"], content: <Switch label="内部管理自动保存状态" defaultChecked /> },
    { state: "validation", exports: ["Switch"], content: <Field label="安全策略" group error="生产环境必须开启安全审计。"><Switch label="启用安全审计" defaultChecked={false} required aria-invalid /></Field> },
    { state: "longContent", exports: ["Switch"], content: <Switch label="为所有跨区域企业账户自动保存批量编辑过程中的未提交变更，并在网络连接恢复时提示管理员确认需要同步的设置和业务信息" defaultChecked /> },
    { state: "keyboard", exports: ["Switch"], content: <SwitchExample />, instructions: "Tab 聚焦开关，Space 切换；检查策略锁定项无法修改。" },
    { state: "overlay", exports: ["Switch"], content: <StatePreview state="overlay"><SwitchExample /></StatePreview> },
    { state: "dark", exports: ["Switch"], content: <StatePreview state="dark"><SwitchExample /></StatePreview> },
    { state: "locale", exports: ["Switch"], content: <StatePreview state="locale"><SwitchExample /></StatePreview> },
  ],
  code: `<Switch label="自动保存" checked={enabled} onChange={handleChange} />`,
} satisfies ExplorerCase;

export default explorerCase;
