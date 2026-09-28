// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"switch/overview","exports":["Switch"]}
import { useState } from "react";
import { Switch } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

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
  states: ["default", "disabled", "readOnly", "controlled", "uncontrolled", "validation", "longContent", "keyboard", "overlay", "dark", "locale"] as const,
  content: <SwitchExample />,
  code: `<Switch label="自动保存" checked={enabled} onChange={handleChange} />`,
} satisfies ExplorerCase;

export default explorerCase;
