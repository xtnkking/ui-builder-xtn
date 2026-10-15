// @ui-coverage {"kind":"example","runner":"explorer","caseId":"pagination/overview","exports":["Pagination"]}
import { useEffect, useRef, useState } from "react";
import { DataTable, Pagination, type PaginationProps } from "../../../ui";
import { StatePreview } from "../state-preview";
import type { ExplorerCase } from "../types";

function PaginationExample() {
  const [page, setPage] = useState(3);
  const [pageSize, setPageSize] = useState(20);
  const [loadingPage, setLoadingPage] = useState<number>();
  const total = 231;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  return <Pagination page={page} pageCount={pageCount} total={total} pageSize={pageSize} loadingPage={loadingPage} onPageChange={(next) => {
    setLoadingPage(next); window.setTimeout(() => { setPage(next); setLoadingPage(undefined); }, 400);
  }} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />;
}

function CursorPaginationExample({ table = false }: { table?: boolean }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loadingPage, setLoadingPage] = useState<number>();
  const [loadingPageSize, setLoadingPageSize] = useState(false);
  const [requests, setRequests] = useState(0);
  const pending = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  // This mock consumer supplies availability; Pagination never infers a total or manages cursors.
  const pagination: PaginationProps = {
    mode: "cursor", page, hasPreviousPage: page > 1, hasNextPage: page < 3,
    pageSize, loadingPage, loadingPageSize,
    onPageChange: (next) => {
      if (pending.current) return;
      pending.current = true;
      setLoadingPage(next);
      setRequests((count) => count + 1);
      timer.current = window.setTimeout(() => {
        setPage(next); setLoadingPage(undefined); pending.current = false;
      }, 600);
    },
    onPageSizeChange: (size) => {
      if (pending.current) return;
      pending.current = true;
      setLoadingPageSize(true);
      setRequests((count) => count + 1);
      timer.current = window.setTimeout(() => {
        setPageSize(size); setPage(1); setLoadingPageSize(false); pending.current = false;
      }, 600);
    },
  };
  const rows = Array.from({ length: page === 3 ? 4 : pageSize }, (_, index) => ({
    id: `event-${page}-${index}`, name: `事件 ${page}-${index + 1}`, operator: `项目成员 ${index + 1}`,
  }));
  return <section aria-label={table ? "未知总数表格" : "未知总数分页"} style={{ minWidth: 0 }}>
    <h3>{table ? "未知总数的表格页脚" : "未知总数的前后翻页"}</h3>
    {table ? <DataTable ariaLabel="最近事件"
      columns={[
        { id: "name", header: "事件", cell: (row: typeof rows[number]) => row.name },
        { id: "operator", header: "操作人", cell: (row: typeof rows[number]) => row.operator },
      ]} rows={rows} rowKey={(row) => row.id} pagination={pagination}
    /> : <Pagination {...pagination} page={page} onPageChange={pagination.onPageChange} />}
    <p role="status">已发起 {requests} 次请求</p>
  </section>;
}
const explorerCase = {
  id: "pagination/overview", label: "分页与每页数量", summary: "已知总页数使用页码；未知总数使用前后翻页。逐例展示目标加载、表格页脚、零结果和窄容器。",
  states: ["default", "disabled", "controlled", "loading", "empty", "longContent", "keyboard", "mobile", "overlay", "dark", "locale"],
  content: <PaginationExample />,
  stateExamples: [
    { state: "default", exports: ["Pagination"], content: <PaginationExample /> },
    { state: "disabled", exports: ["Pagination"], content: <Pagination page={3} pageCount={12} total={231} pageSize={20} onPageChange={() => undefined} disabled /> },
    { state: "controlled", exports: ["Pagination"], instructions: "两个独立列表使用 cursor 模式；第几页仅作序号，消费者提供前后可用性。加载不改变页脚尺寸；更改每页数量后消费者重置列表。", content: <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 24, minWidth: 0 }}><CursorPaginationExample /><CursorPaginationExample table /></div> },
    { state: "loading", exports: ["Pagination"], instructions: "第4页请求进行中；目标页按钮显示加载且阻止重复请求。另一个实例展示每页数量加载。", content: <div className="demo-number-case__grid"><Pagination page={3} pageCount={12} loadingPage={4} loadingTarget="page" onPageChange={() => undefined} /><Pagination page={3} pageCount={12} pageSize={20} loadingPageSize onPageChange={() => undefined} onPageSizeChange={() => undefined} /></div> },
    { state: "empty", exports: ["Pagination"], content: <Pagination page={1} pageCount={1} total={0} pageSize={20} onPageChange={() => undefined} /> },
    { state: "longContent", exports: ["Pagination"], content: <Pagination page={1} pageCount={3} summary="当前筛选条件覆盖跨区域基础设施迁移项目的全部成员权限与安全策略审核记录" onPageChange={() => undefined} /> },
    { state: "keyboard", exports: ["Pagination"], instructions: "Tab 到页码、上一页/下一页以及每页数量；Enter/Space 请求翻页，加载期间不能重复激活。", content: <PaginationExample /> },
    { state: "mobile", exports: ["Pagination"], content: <StatePreview state="mobile"><PaginationExample /></StatePreview> },
    { state: "overlay", exports: ["Pagination"], content: <StatePreview state="overlay"><PaginationExample /></StatePreview> },
    { state: "dark", exports: ["Pagination"], content: <StatePreview state="dark"><div className="demo-number-case__grid"><PaginationExample /><CursorPaginationExample /></div></StatePreview> },
    { state: "locale", exports: ["Pagination"], content: <StatePreview state="locale"><div className="demo-number-case__grid"><PaginationExample /><CursorPaginationExample /></div></StatePreview> },
  ],
  code: '<Pagination page={page} pageCount={pageCount} total={total} pageSize={pageSize} onPageChange={loadPage} />\n<Pagination mode="cursor" page={page} hasPreviousPage={hasPreviousPage} hasNextPage={hasNextPage} loadingPage={loadingPage} onPageChange={requestDirection} />',
} satisfies ExplorerCase;
export default explorerCase;
