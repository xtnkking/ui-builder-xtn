// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"pagination/overview","exports":["Pagination"]}
import { useState } from "react";
import { Pagination } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

function PaginationExample() {
  const [page, setPage] = useState(3);
  const [pageSize, setPageSize] = useState(20);
  const [loadingPage, setLoadingPage] = useState<number>();
  const changePage = (nextPage: number) => {
    setLoadingPage(nextPage);
    window.setTimeout(() => { setPage(nextPage); setLoadingPage(undefined); }, 300);
  };
  return <Pagination page={page} pageCount={12} total={231} pageSize={pageSize} pageSizeOptions={[10, 20, 50]} loadingPage={loadingPage} onPageChange={changePage} onPageSizeChange={(nextSize) => { setPageSize(nextSize); setPage(1); }} />;
}

const explorerCase = {
  id: "pagination/overview",
  label: "分页与每页数量",
  summary: "展示受控页码、加载目标、总数摘要、每页数量和紧凑移动布局。",
  states: ["default", "disabled", "readOnly", "controlled", "validation", "keyboard", "overlay", "dark", "locale"] as const,
  content: <PaginationExample />,
  code: `<Pagination page={page} pageCount={12} total={231} pageSize={20} loadingPage={loadingPage} onPageChange={loadPage} onPageSizeChange={setPageSize} />`,
} satisfies ExplorerCase;

export default explorerCase;
