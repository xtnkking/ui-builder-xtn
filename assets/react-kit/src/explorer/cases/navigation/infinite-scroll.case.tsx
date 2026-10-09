// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"infinite-scroll/overview","exports":["InfiniteScroll"]}
import { useState } from "react";
import { InfiniteScroll, LoadMore, Stack } from "../../../personal-ui";
import { StatePreview } from "../state-preview";
import type { ExplorerCase } from "../types";

function InfiniteScrollExample() {
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const load = async () => {
    if (loading || !hasMore) return;
    setLoading(true); await new Promise<void>((resolve) => window.setTimeout(resolve, 700));
    setPage((current) => current + 1); setLoading(false); setHasMore(false);
  };
  return <Stack><InfiniteScroll hasMore={hasMore} loadKey={page} loading={loading} onLoadMore={load}><p>已加载 {page * 20} 条记录。</p></InfiniteScroll><LoadMore hasMore={hasMore} loading={loading} onLoadMore={load} label="手动加载下一页" /></Stack>;
}
const explorerCase = {
  id: "infinite-scroll/overview", label: "连续加载与键盘替代入口", summary: "保留官方 InfiniteScroll + LoadMore 组合；组件只管理观察器、请求哨兵和结束文案，不声明表单值模式或独立错误/空列表呈现。",
  states: ["default", "disabled", "loading", "longContent", "keyboard", "overlay", "dark", "locale"],
  content: <InfiniteScrollExample />,
  stateExamples: [
    { state: "default", exports: ["InfiniteScroll"], content: <InfiniteScrollExample /> },
    { state: "disabled", exports: ["InfiniteScroll"], instructions: "disabled 禁止观察器发起加载；本例同时禁用配套的手动按钮。", content: <Stack><InfiniteScroll hasMore disabled loadKey="disabled" onLoadMore={() => undefined}><p>已有记录。</p></InfiniteScroll><LoadMore hasMore disabled onLoadMore={() => undefined} /></Stack> },
    { state: "loading", exports: ["InfiniteScroll"], content: <InfiniteScroll hasMore loading loadKey="pending" onLoadMore={() => undefined}><p>当前记录仍保留；下方哨兵显示加载。</p></InfiniteScroll> },
    { state: "longContent", exports: ["InfiniteScroll"], content: <InfiniteScroll hasMore={false} loadKey="long" onLoadMore={() => undefined}><p>跨区域基础设施迁移项目的全部成员权限、数据访问范围与安全策略审核记录需要完整显示，并保留容器中的滚动和换行布局。</p></InfiniteScroll> },
    { state: "keyboard", exports: ["InfiniteScroll"], instructions: "InfiniteScroll 的观察器本身没有键盘激活动作；Tab 到官方配套 LoadMore，再用 Enter/Space 请求下一页。此例不改变 M5 的组合使用契约。", content: <InfiniteScrollExample /> },
    { state: "overlay", exports: ["InfiniteScroll"], content: <StatePreview state="overlay"><InfiniteScrollExample /></StatePreview> },
    { state: "dark", exports: ["InfiniteScroll"], content: <StatePreview state="dark"><InfiniteScrollExample /></StatePreview> },
    { state: "locale", exports: ["InfiniteScroll"], content: <StatePreview state="locale"><InfiniteScrollExample /></StatePreview> },
  ],
  code: '<InfiniteScroll hasMore={hasMore} loadKey={cursor} loading={loading} onLoadMore={loadNext} onLoadError={reportError}>{items}</InfiniteScroll>\n<LoadMore hasMore={hasMore} loading={loading} onLoadMore={loadNext} />',
} satisfies ExplorerCase;
export default explorerCase;
