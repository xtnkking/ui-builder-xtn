// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"load-more/overview","exports":["LoadMore"]}
import { useState } from "react";
import { LoadMore } from "../../../personal-ui";
import { StatePreview } from "../state-preview";
import type { ExplorerCase } from "../types";

function LoadMoreExample() {
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  return <LoadMore loading={loading} hasMore={hasMore} onLoadMore={async () => {
    setLoading(true); await new Promise<void>((resolve) => window.setTimeout(resolve, 700)); setLoading(false); setHasMore(false);
  }} />;
}
const explorerCase = {
  id: "load-more/overview", label: "显式加载更多", summary: "请求与 loading/hasMore 由调用方协调；组件有禁用与加载状态，结束状态不等于空数据，失败消息由页面处理。",
  states: ["default", "disabled", "loading", "longContent", "keyboard", "overlay", "dark", "locale"],
  content: <LoadMoreExample />,
  stateExamples: [
    { state: "default", exports: ["LoadMore"], content: <LoadMoreExample /> },
    { state: "disabled", exports: ["LoadMore"], content: <LoadMore hasMore disabled onLoadMore={() => undefined} /> },
    { state: "loading", exports: ["LoadMore"], content: <LoadMore hasMore loading onLoadMore={() => undefined} loadingLabel="正在加载下一页" /> },
    { state: "longContent", exports: ["LoadMore"], content: <LoadMore hasMore label="加载跨区域基础设施迁移项目的全部成员权限与安全策略审核记录的下一页数据" onLoadMore={() => undefined} /> },
    { state: "keyboard", exports: ["LoadMore"], instructions: "Tab 聚焦按钮，Enter/Space 加载；加载完成后切换为结束文字，不再提供重复请求按钮。", content: <LoadMoreExample /> },
    { state: "overlay", exports: ["LoadMore"], content: <StatePreview state="overlay"><LoadMoreExample /></StatePreview> },
    { state: "dark", exports: ["LoadMore"], content: <StatePreview state="dark"><LoadMoreExample /></StatePreview> },
    { state: "locale", exports: ["LoadMore"], content: <StatePreview state="locale"><LoadMoreExample /></StatePreview> },
  ],
  code: '<LoadMore loading={loading} hasMore={hasMore} onLoadMore={loadNextPage} />',
} satisfies ExplorerCase;
export default explorerCase;
