// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"tabs/overview","exports":["Tabs"]}
import { useState } from "react";
import { Tabs } from "../../../personal-ui";
import { StatePreview } from "../state-preview";
import type { ExplorerCase } from "../types";

const items = [
  { id: "details", label: "详情", content: <p>项目资料。</p> },
  { id: "activity", label: "活动记录", content: <p>最近操作。</p> },
  { id: "archive", label: "已过期", content: <p>归档。</p>, disabled: true },
];
function TabsExample() {
  const [value, setValue] = useState("details");
  return <Tabs ariaLabel="项目信息" value={value} onValueChange={setValue} items={items} fill />;
}
const explorerCase = {
  id: "tabs/overview", label: "标签页", summary: "独立演示受控和非受控值、禁用项、长标题与窄屏布局。",
  states: ["default", "disabled", "controlled", "uncontrolled", "longContent", "keyboard", "mobile", "overlay", "dark", "locale"],
  content: <TabsExample />,
  stateExamples: [
    { state: "default", exports: ["Tabs"], content: <TabsExample /> },
    { state: "disabled", exports: ["Tabs"], instructions: "“已过期”项不可点击，也不参加方向键焦点导航。", content: <Tabs ariaLabel="禁用标签" defaultValue="details" items={items} /> },
    { state: "controlled", exports: ["Tabs"], content: <TabsExample /> },
    { state: "uncontrolled", exports: ["Tabs"], content: <Tabs ariaLabel="内部维护选中值" defaultValue="activity" items={items} /> },
    { state: "longContent", exports: ["Tabs"], content: <Tabs ariaLabel="长标题" defaultValue="long" items={[{ id: "long", label: "跨区域基础设施迁移项目的全部成员权限与安全策略审核记录", content: <p>完整内容由页面提供。</p> }, { id: "short", label: "概览", content: <p>概览。</p> }]} /> },
    { state: "keyboard", exports: ["Tabs"], instructions: "Tab 进入当前标签；方向键、Home、End 切换可用标签，禁用项会被跳过。", content: <TabsExample /> },
    { state: "mobile", exports: ["Tabs"], content: <StatePreview state="mobile"><TabsExample /></StatePreview> },
    { state: "overlay", exports: ["Tabs"], content: <StatePreview state="overlay"><TabsExample /></StatePreview> },
    { state: "dark", exports: ["Tabs"], content: <StatePreview state="dark"><TabsExample /></StatePreview> },
    { state: "locale", exports: ["Tabs"], content: <StatePreview state="locale"><Tabs ariaLabel="Project tabs" defaultValue="details" items={[{ id: "details", label: "Details", content: <p>Project details.</p> }, { id: "activity", label: "Activity", content: <p>Recent activity.</p> }]} /></StatePreview> },
  ],
  code: '<Tabs value={value} onValueChange={setValue} items={items} ariaLabel="项目信息" />\n<Tabs defaultValue="details" items={items} ariaLabel="内部状态" />',
} satisfies ExplorerCase;
export default explorerCase;
