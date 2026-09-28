// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"tabs/overview","exports":["Tabs"]}
import { useState } from "react";
import { Tabs } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const items = [
  { id: "details", label: "详情", content: <p>项目的基础信息与负责人。</p> },
  { id: "activity", label: "活动记录", content: <p>最近 30 天的操作历史。</p> },
  { id: "archive", label: "已过期", content: <p>归档内容。</p>, disabled: true },
];

function TabsExample() {
  const [value, setValue] = useState("details");
  return (
    <div className="demo-number-case__grid">
      <Tabs ariaLabel="项目信息" value={value} onValueChange={setValue} items={items} fill />
      <Tabs ariaLabel="默认标签页" defaultValue="activity" items={items} />
    </div>
  );
}

const explorerCase = {
  id: "tabs/overview",
  label: "受控与非受控标签页",
  summary: "展示稳定的当前态、禁用标签、方向键 roving focus 和两种状态模式。",
  states: ["default", "disabled", "readOnly", "controlled", "uncontrolled", "validation", "longContent", "keyboard", "overlay", "dark", "locale"] as const,
  content: <TabsExample />,
  code: `<Tabs ariaLabel="项目信息" value={value} onValueChange={setValue} items={items} />`,
} satisfies ExplorerCase;

export default explorerCase;
