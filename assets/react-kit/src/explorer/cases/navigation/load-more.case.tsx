// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"load-more/overview","exports":["LoadMore"]}
import { useState } from "react";
import { LoadMore } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

function LoadMoreExample() {
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const load = async () => {
    setLoading(true);
    await new Promise((resolve) => window.setTimeout(resolve, 300));
    setLoading(false);
    setHasMore(false);
  };
  return (
    <div className="demo-number-case__grid">
      <LoadMore loading={loading} hasMore={hasMore} onLoadMore={load} loadingLabel="正在加载下一页" />
      <LoadMore hasMore={false} onLoadMore={() => undefined} />
    </div>
  );
}

const explorerCase = {
  id: "load-more/overview",
  label: "显式加载更多",
  summary: "按钮在异步加载期间保持尺寸并阻止重复请求，末页切换为完成文案。",
  states: ["default", "disabled", "controlled", "uncontrolled", "loading", "empty", "error", "validation", "longContent", "keyboard", "overlay", "dark", "locale"] as const,
  content: <LoadMoreExample />,
  code: `<LoadMore loading={loading} hasMore={hasMore} onLoadMore={loadNextPage} />`,
} satisfies ExplorerCase;

export default explorerCase;
