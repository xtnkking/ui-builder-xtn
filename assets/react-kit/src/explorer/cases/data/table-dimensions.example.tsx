// @ui-coverage {"kind":"example","runner":"explorer","caseId":"data-table/dimensions","exports":["DataTable"]}
import { useState } from "react";
import { Button, Checkbox, DataTable, Inline, Select, TableCellText, type DataColumn, type DataTableState } from "../../../ui";
import type { ExplorerCase } from "../types";

type Result = "sparse" | "many" | "loading" | "empty" | "error" | "retained-error" | "long";
type Entry = { id: string; event: string };
const resultOptions: { value: Result; label: string }[] = [
  { value: "sparse", label: "1 条记录" },
  { value: "many", label: "20 条记录" },
  { value: "loading", label: "加载状态" },
  { value: "empty", label: "空状态" },
  { value: "error", label: "首次错误" },
  { value: "retained-error", label: "保留数据错误" },
  { value: "long", label: "长内容" },
];

export function TableDimensionsExample() {
  const [result, setResult] = useState<Result>("sparse");
  const [paginated, setPaginated] = useState(true);
  const [mobileCards, setMobileCards] = useState(false);
  const [capacity, setCapacity] = useState("default");
  const [page, setPage] = useState(1);
  const entries: Entry[] = Array.from({ length: 20 }, (_, index) => ({
    id: `event-${page}-${index + 1}`,
    event: result === "long"
      ? "请求记录包含需要完整查看的较长说明，单元格按公开换行属性显示全部内容。".repeat(12)
      : `同步任务 ${index + 1} 已完成。`,
  }));
  const rows = result === "empty" || result === "error" ? [] : result === "sparse" ? entries.slice(0, 1) : entries;
  const state: DataTableState = result === "loading" ? "loading"
    : result === "empty" ? "empty"
    : result === "error" || result === "retained-error" ? "error" : "ready";
  const columns: DataColumn<Entry>[] = [
    { id: "id", header: "记录编号", width: 160, cell: (entry) => entry.id },
    { id: "event", header: "事件说明", minWidth: 340, cell: (entry) => <TableCellText wrap={result === "long"}>{entry.event}</TableCellText> },
  ];
  const pagination = paginated ? { page, pageCount: 2, pageSize: 20, total: 40, onPageChange: setPage } : undefined;
  return <div style={{ display: "grid", gap: 16, minWidth: 0 }}>
    <Inline gap="small" wrap>
      <Select ariaLabel="表格结果状态" value={result} options={resultOptions} onValueChange={(value) => setResult(value as Result)} />
      <Select ariaLabel="表格高度方式" value={capacity} onValueChange={setCapacity} options={[
        { value: "default", label: "默认高度" }, { value: "three", label: "固定 3 行单位" }, { value: "auto", label: "随内容高度" },
      ]} />
      <Checkbox label="显示分页" checked={paginated} onChange={(event) => setPaginated(event.currentTarget.checked)} />
      <Checkbox label="移动卡片" checked={mobileCards} onChange={(event) => setMobileCards(event.currentTarget.checked)} />
    </Inline>
    <DataTable ariaLabel="表格高度对照" columns={columns} rows={rows} rowKey={(entry) => entry.id}
      state={state} pagination={pagination} viewportRows={capacity === "auto" ? "auto" : capacity === "three" ? 3 : undefined}
      mobileRow={mobileCards ? (entry) => <TableCellText wrap={result === "long"} secondary={entry.event}>{entry.id}</TableCellText> : undefined}
      emptyTitle="没有匹配记录" emptyDescription="调整条件后重新查询。"
      emptyAction={<Button size="small" onClick={() => setResult("sparse")}>恢复记录</Button>}
      errorTitle="记录加载失败" errorDescription="请重试，已有记录仍可查看。" onRetry={() => setResult("sparse")} />
  </div>;
}

const explorerCase = {
  id: "data-table/dimensions",
  label: "表格高度与滚动",
  summary: "分页和无分页表格默认预留五个标准行高单位；少量结果、加载、空状态和错误保持同一表面。短屏自动限制默认高度，长行完整显示并在表格内滚动。",
  states: ["default"],
  content: <TableDimensionsExample />,
  stateExamples: [{ state: "default", exports: ["DataTable"], content: <TableDimensionsExample />,
    instructions: "切换结果与分页对照高度；切换高度方式查看显式三行容量和随内容高度。窄屏横向滚动留在表格内，移动卡片可单独启用。" }],
  code: `<DataTable ariaLabel="事件记录" columns={columns} rows={rows}
  rowKey={(row) => row.id} state={state} pagination={pagination} />
// 默认容量为五个标准行高单位，短屏限制高度；长行在内部滚动。
// 分页在各请求状态持续传入，保持同一个表内分页区。
// viewportRows={3} 为显式容量；viewportRows="auto" 随内容高度。`,
} satisfies ExplorerCase;

export default explorerCase;
