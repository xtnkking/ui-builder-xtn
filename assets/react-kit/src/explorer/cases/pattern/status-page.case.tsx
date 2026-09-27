// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"status-page/overview","exports":["StatusPage"]}
import { Button, Inline, StatusPage } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

function StatusPageExample() {
  return (
    <Inline gap="large" align="start" wrap>
      <StatusPage title="搜索结果" kind="empty" statusTitle="没有匹配结果" statusDescription="调整筛选条件后重试。" action={<Button>清除筛选</Button>} />
      <StatusPage title="同步状态" kind="error" statusTitle="加载失败" statusDescription="上次成功数据仍然保留。" onRetry={async () => undefined} />
    </Inline>
  );
}

const explorerCase: ExplorerCase = {
  id: "status-page/overview",
  label: "状态页面",
  summary: "空、错误、无权限和离线状态使用一致页面结构与可恢复操作。",
  states: ["default", "loading", "empty", "error", "validation", "longContent", "keyboard", "mobile", "overlay", "dark", "locale"],
  content: <StatusPageExample />,
  code: `import { StatusPage } from "./personal-ui";

<StatusPage title="同步状态" kind="error" statusTitle="加载失败" onRetry={retry} />`,
};

export default explorerCase;
