// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"pagination/overview","exports":["Pagination"]}
import { useState } from "react";
import { Pagination } from "../../../personal-ui";
import { StatePreview } from "../state-preview";
import type { ExplorerCase } from "../types";

function PaginationExample() {
  const [page, setPage] = useState(3);
  const [pageSize, setPageSize] = useState(20);
  const [loadingPage, setLoadingPage] = useState<number>();
  return <Pagination page={page} pageCount={12} total={231} pageSize={pageSize} loadingPage={loadingPage} onPageChange={(next) => {
    setLoadingPage(next); window.setTimeout(() => { setPage(next); setLoadingPage(undefined); }, 400);
  }} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />;
}
const explorerCase = {
  id: "pagination/overview", label: "分页与每页数量", summary: "公开接口为受控页码；逐例展示禁用、目标按钮加载、零结果、长摘要和窄容器。",
  states: ["default", "disabled", "controlled", "loading", "empty", "longContent", "keyboard", "mobile", "overlay", "dark", "locale"],
  content: <PaginationExample />,
  stateExamples: [
    { state: "default", exports: ["Pagination"], content: <PaginationExample /> },
    { state: "disabled", exports: ["Pagination"], content: <Pagination page={3} pageCount={12} total={231} pageSize={20} onPageChange={() => undefined} disabled /> },
    { state: "controlled", exports: ["Pagination"], content: <PaginationExample /> },
    { state: "loading", exports: ["Pagination"], instructions: "第4页请求进行中；目标页按钮显示加载且阻止重复请求。另一个实例展示每页数量加载。", content: <div className="demo-number-case__grid"><Pagination page={3} pageCount={12} loadingPage={4} loadingTarget="page" onPageChange={() => undefined} /><Pagination page={3} pageCount={12} pageSize={20} loadingPageSize onPageChange={() => undefined} onPageSizeChange={() => undefined} /></div> },
    { state: "empty", exports: ["Pagination"], content: <Pagination page={1} pageCount={1} total={0} pageSize={20} onPageChange={() => undefined} /> },
    { state: "longContent", exports: ["Pagination"], content: <Pagination page={1} pageCount={3} summary="当前筛选条件覆盖跨区域基础设施迁移项目的全部成员权限与安全策略审核记录" onPageChange={() => undefined} /> },
    { state: "keyboard", exports: ["Pagination"], instructions: "Tab 到页码、上一页/下一页以及每页数量；Enter/Space 请求翻页，加载期间不能重复激活。", content: <PaginationExample /> },
    { state: "mobile", exports: ["Pagination"], content: <StatePreview state="mobile"><PaginationExample /></StatePreview> },
    { state: "overlay", exports: ["Pagination"], content: <StatePreview state="overlay"><PaginationExample /></StatePreview> },
    { state: "dark", exports: ["Pagination"], content: <StatePreview state="dark"><PaginationExample /></StatePreview> },
    { state: "locale", exports: ["Pagination"], content: <StatePreview state="locale"><PaginationExample /></StatePreview> },
  ],
  code: '<Pagination page={page} pageCount={pageCount} total={total} pageSize={pageSize} loadingPage={loadingPage} onPageChange={loadPage} onPageSizeChange={setPageSize} />',
} satisfies ExplorerCase;
export default explorerCase;
