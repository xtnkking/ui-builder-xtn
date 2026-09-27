// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"infinite-scroll/overview","exports":["InfiniteScroll"]}
import { InfiniteScroll, LoadMore, Stack } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const explorerCase = {
  id: "infinite-scroll/overview",
  label: "观察器驱动的连续加载",
  summary: "调用方使用稳定 loadKey 协调请求，组件展示加载哨兵、错误回调和结束状态。",
  states: ["default", "disabled", "controlled", "uncontrolled", "loading", "empty", "error", "validation", "longContent", "keyboard", "overlay", "dark", "locale"] as const,
  content: (
    <Stack gap="medium">
      <InfiniteScroll hasMore loadKey="page-2" loading onLoadMore={() => undefined}><p>当前已加载 20 条记录。</p></InfiniteScroll>
      <InfiniteScroll hasMore={false} loadKey="complete" onLoadMore={() => undefined}><p>共 42 条记录。</p></InfiniteScroll>
      <LoadMore hasMore onLoadMore={() => undefined} label="手动加载下一页" />
    </Stack>
  ),
  code: `<InfiniteScroll hasMore={hasMore} loadKey={cursor} loading={loading} onLoadMore={loadNext} onLoadError={reportError}>\n  {items}\n</InfiniteScroll>\n<LoadMore hasMore={hasMore} onLoadMore={loadNext} />`,
} satisfies ExplorerCase;

export default explorerCase;
