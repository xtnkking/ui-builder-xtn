// @ui-coverage {"kind":"example","runner":"explorer","caseId":"pagination/consistent-style","exports":["DataTable"]}
import { useState } from "react";
import { DataTable } from "../../../ui";
import { StatePreview } from "../state-preview";
import type { ExplorerCase } from "../types";

export function PaginationConsistencyExample({ longOrdinal = false }: { longOrdinal?: boolean }) {
  const [numberedPage, setNumberedPage] = useState(1);
  const [cursorPage, setCursorPage] = useState(longOrdinal ? 123456789012345 : 1);
  const [numberedSize, setNumberedSize] = useState(20);
  const [cursorSize, setCursorSize] = useState(20);
  const columns = [{ id: "name", header: "项目", cell: (row: { id: string; name: string }) => row.name }];
  return <section aria-label="分页样式对照" style={{ display: "grid", gap: 24, minWidth: 0 }}>
    <section aria-label="已知总数列表" style={{ minWidth: 0 }}>
      <h3>已知总数：页码跳转</h3>
      <DataTable ariaLabel="项目列表" columns={columns} viewportRows={1}
        rows={[{ id: "project", name: `项目记录 · 第 ${numberedPage} 页` }]} rowKey={(row) => row.id}
        pagination={{ page: numberedPage, pageCount: Math.ceil(60 / numberedSize), total: 60,
          pageSize: numberedSize, onPageChange: setNumberedPage,
          onPageSizeChange: (size) => { setNumberedSize(size); setNumberedPage(1); } }} />
    </section>
    <section aria-label="未知总数列表" style={{ minWidth: 0 }}>
      <h3>未知总数：前后翻页</h3>
      <DataTable ariaLabel="事件列表" columns={columns} viewportRows={1}
        rows={[{ id: "event", name: "事件记录" }]} rowKey={(row) => row.id}
        pagination={{ mode: "cursor", page: cursorPage, hasPreviousPage: cursorPage > 1,
          hasNextPage: longOrdinal || cursorPage < 3, pageSize: cursorSize, onPageChange: setCursorPage,
          onPageSizeChange: (size) => { setCursorSize(size); setCursorPage(1); } }} />
    </section>
  </section>;
}

const explorerCase = {
  id: "pagination/consistent-style",
  label: "统一分页风格",
  summary: "同一项目复用 DataTable 自带分页。接口决定是否支持总数和页码跳转，当前页、箭头、每页数量使用同一套尺寸、字体、圆角和主题颜色。",
  previewLayout: "page",
  states: ["default", "dark", "longContent"],
  content: <PaginationConsistencyExample />,
  stateExamples: [
    { state: "default", exports: ["DataTable"], content: <PaginationConsistencyExample />,
      instructions: "两个表格共享项目主题，支持各自翻页和每页数量。缩小窗口到 320px 对照同一套当前页状态与触控尺寸；游标模式不虚构总数，也不把当前页序号做成按钮。" },
    { state: "dark", exports: ["DataTable"], content: <StatePreview state="dark"><PaginationConsistencyExample /></StatePreview> },
    { state: "longContent", exports: ["DataTable"], content: <PaginationConsistencyExample longOrdinal />,
      instructions: "较长序号在可用宽度内省略，完整序号保留在悬停标题中；不会挤出翻页箭头或撑宽页面。" },
  ],
  code: `// 复用同一个 DataTable 页脚，不额外手写分页区或覆盖分页样式。
<DataTable columns={columns} rows={rows} rowKey={(row) => row.id}
  pagination={{ page, pageCount, total, pageSize, onPageChange, onPageSizeChange }} />
// 总数未知时仅更换数据能力；外观仍沿用同一项目主题。
<DataTable columns={columns} rows={rows} rowKey={(row) => row.id}
  pagination={{ mode: "cursor", page, hasPreviousPage, hasNextPage,
    pageSize, onPageChange, onPageSizeChange }} />`,
} satisfies ExplorerCase;

export default explorerCase;
