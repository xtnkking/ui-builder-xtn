// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"result/overview","exports":["EmptyState","ErrorState","NoResults","RetryButton","AsyncAction"]}
import { AsyncAction, EmptyState, ErrorState, NoResults, RetryButton } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const wait = () => new Promise<void>((resolve) => window.setTimeout(resolve, 450));

const explorerCase = {
  id: "result/overview",
  label: "结果与重试状态",
  summary: "空白、无搜索结果、错误、同步重试和异步操作都使用稳定尺寸与统一加载反馈。",
  states: ["default", "disabled", "controlled", "uncontrolled", "loading", "empty", "error", "validation", "longContent", "keyboard", "overlay", "dark", "locale"],
  content: (
    <div style={{ display: "grid", gap: 20 }}>
      <EmptyState compact title="还没有成员" description="邀请第一位成员后，权限和活动记录会显示在这里。" />
      <NoResults compact title="没有匹配结果" description="调整关键词或清除筛选条件后重试。" />
      <ErrorState compact kind="offline" title="暂时无法连接" description="现有数据会保留，恢复网络后可以重试。" onRetry={wait} />
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <RetryButton onRetry={() => undefined} label="重新载入" />
        <AsyncAction onAction={wait}>保存更改</AsyncAction>
      </div>
    </div>
  ),
  code: `<ErrorState kind="offline" onRetry={reload} />\n<RetryButton onRetry={reload} />\n<AsyncAction onAction={save}>保存更改</AsyncAction>`,
} satisfies ExplorerCase;

export default explorerCase;
