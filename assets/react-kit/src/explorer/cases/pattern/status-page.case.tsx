// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"status-page/overview","exports":["StatusPage"]}
import { StatePreview } from "../state-preview";
import { Button, Inline, StatusPage } from "../../../personal-ui";
import { useState } from "react";
import type { ExplorerCase } from "../types";

function StatusPageExample() {
  const [feedback, setFeedback] = useState("上次成功数据仍然保留。");
  return (
    <Inline gap="large" align="start" wrap>
      <StatusPage title="搜索结果" kind="empty" statusTitle="没有匹配结果" statusDescription="调整筛选条件后重试。" action={<Button onClick={() => setFeedback("已清除筛选；本地示例恢复操作已触发。")}>清除筛选</Button>} />
      <StatusPage title="同步状态" kind="error" statusTitle="加载失败" statusDescription={feedback} onRetry={() => setFeedback("本地示例重试操作已触发。")} />
    </Inline>
  );
}

const explorerCase: ExplorerCase = {
  id: "status-page/overview",
  label: "状态页面",
  summary: "空、错误、无权限和离线状态使用一致页面结构与可恢复操作。",
  states: ["default", "empty", "error", "longContent", "keyboard", "mobile", "overlay", "dark", "locale"],
  stateExamples: [
    { state: "default", exports: ["StatusPage"], content: <StatusPage title="搜索结果" statusTitle="没有匹配结果" statusDescription="默认 kind 为 empty。" /> },
    { state: "empty", exports: ["StatusPage"], content: <StatusPage title="搜索结果" kind="empty" statusTitle="没有匹配结果" /> },
    { state: "error", exports: ["StatusPage"], content: <StatusPage title="同步状态" kind="error" statusTitle="加载失败" statusDescription="可以调整设置后重试。" /> },
    { state: "longContent", exports: ["StatusPage"], content: <StatusPage title="配置状态" statusTitle="没有匹配结果" statusDescription="此查询覆盖全部产品中的角色配置、数据访问权限、通知偏好和账户安全设置，请确认所有关联配置均符合团队的实际使用要求后调整筛选条件。" /> },
    { state: "keyboard", exports: ["StatusPage"], content: <StatusPageExample />, instructions: "用 Tab 访问本例可用控件，使用 Enter、Space 和组件文档中的方向键操作。此项为人工操作案例，不是自动行为验收证书。" },
    { state: "mobile", exports: ["StatusPage"], content: <StatePreview state="mobile">{<StatusPageExample />}</StatePreview> },
    { state: "overlay", exports: ["StatusPage"], content: <StatePreview state="overlay">{<StatusPageExample />}</StatePreview> },
    { state: "dark", exports: ["StatusPage"], content: <StatePreview state="dark">{<StatusPageExample />}</StatePreview> },
    { state: "locale", exports: ["StatusPage"], content: <StatePreview state="locale">{<StatusPageExample />}</StatePreview> },
  ],
  content: <StatusPageExample />,
  code: `import { StatusPage } from "./personal-ui";

<StatusPage title="同步状态" kind="error" statusTitle="加载失败" onRetry={retry} />`,
};

export default explorerCase;
