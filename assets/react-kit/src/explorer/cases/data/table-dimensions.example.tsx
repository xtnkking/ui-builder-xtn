// @ui-coverage {"kind":"example","runner":"explorer","caseId":"data-table/dimensions","exports":["DataTable"]}
import { useState } from "react";
import { Button, Checkbox, DataTable, DataTableProvider, Grid, Inline, Select, TableCellText, type DataColumn, type DataTableState } from "../../../ui";
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

type ProjectEntry = { id: string; name: string };
const projectColumns: DataColumn<ProjectEntry>[] = [
  { id: "id", header: "记录编号", width: 160, cell: (entry) => entry.id },
  { id: "name", header: "名称", minWidth: 220, cell: (entry) => entry.name },
];
const proxyEntries: ProjectEntry[] = [{ id: "proxy-001", name: "香港代理节点" }];
const phoneEntries: ProjectEntry[] = Array.from({ length: 120 }, (_, index) => ({
  id: `phone-${String(index + 1).padStart(3, "0")}`,
  name: `混合号码资源 ${index + 1}`,
}));

export function ProjectTableHeightExample() {
  const [state, setState] = useState<DataTableState>("ready");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const rows = state === "empty" || state === "error" ? []
    : phoneEntries.slice((page - 1) * pageSize, page * pageSize);
  const changePageSize = (size: number) => { setPageSize(size); setPage(1); };
  return <div style={{ display: "grid", gap: 16, minWidth: 0 }}>
    <p style={{ margin: 0 }}>同一项目在共同入口使用 DataTableProvider：统一预留五个标准行高单位，不随记录数量、每页数量或请求状态变化；短屏统一缩小，内容在表格内滚动。</p>
    <Inline gap="small" wrap>
      <Select ariaLabel="混合号码池状态" value={state} onValueChange={(value) => setState(value as DataTableState)} options={[
        { value: "ready", label: "显示记录" }, { value: "loading", label: "加载状态" },
        { value: "empty", label: "空状态" }, { value: "error", label: "错误状态" },
      ]} />
    </Inline>
    <DataTableProvider>
      <Grid minItemWidth={360} gap="medium">
        <section aria-label="代理池高度示例" style={{ minWidth: 0 }}>
          <h3>代理池 · 1 条记录</h3>
          <DataTable ariaLabel="代理池统一高度" columns={projectColumns} rows={proxyEntries} rowKey={(entry) => entry.id}
            pagination={{ page: 1, pageCount: 1, total: proxyEntries.length, pageSize, pageSizeOptions: [5, 20, 50],
              onPageChange: () => undefined, onPageSizeChange: changePageSize }} />
        </section>
        <section aria-label="混合号码池高度示例" style={{ minWidth: 0 }}>
          <h3>混合号码池 · 共 120 条记录</h3>
          <DataTable ariaLabel="混合号码池统一高度" columns={projectColumns} rows={rows} rowKey={(entry) => entry.id}
            state={state} viewportRows={8}
            pagination={{ page, pageCount: Math.ceil(phoneEntries.length / pageSize), total: phoneEntries.length,
              pageSize, pageSizeOptions: [5, 20, 50], onPageChange: setPage, onPageSizeChange: changePageSize }}
            emptyTitle="没有匹配号码" emptyDescription="调整查询条件后重试，高度保持不变。"
            errorTitle="号码加载失败" errorDescription="重试后恢复记录，高度保持不变。" onRetry={() => setState("ready")} />
        </section>
      </Grid>
    </DataTableProvider>
    <p style={{ margin: 0 }}>右侧刻意传入 viewportRows=8 模拟页面误配，项目策略仍统一为五个行高单位；分页区始终保留。真实项目只在共同入口设置容量，页面无需重复指定。</p>
  </div>;
}

export const tableHeightPolicyCase = {
  id: "data-table/project-height",
  label: "项目统一表格高度",
  summary: "一个项目共用固定表格容量；记录数量不同、加载、空数据、错误、分页与每页数量都不改变同类列表的高度。项目策略优先于页面误传的局部容量。",
  states: ["default"],
  content: <ProjectTableHeightExample />,
  stateExamples: [{ state: "default", exports: ["DataTableProvider", "DataTable"], content: <ProjectTableHeightExample />,
    instructions: "对照左侧 1 条与右侧多条记录；切换右侧状态、每页数量和页码。两张表的可视区与分页始终同高，窄屏换行且仅在表格内滚动。" }],
  code: `// 在路由外的共同入口设置一次，项目列表统一为五个行高单位。
<DataTableProvider viewportRows={5}>
  <AppRoutes />
</DataTableProvider>

// 各业务页面保留自己的列、数据、状态与分页，无需重复配置高度。
<DataTable ariaLabel="代理池" columns={columns} rows={proxyRows}
  rowKey={(row) => row.id} pagination={proxyPagination} />
<DataTable ariaLabel="混合号码池" columns={columns} rows={phoneRows}
  rowKey={(row) => row.id} state={state} pagination={phonePagination} />
// 不按 rows.length 或 pageSize 计算高度。项目策略优先于局部 viewportRows。
// 加载/空/错误仍传入原分页配置；内容超出时只在表格内部滚动。`,
} satisfies ExplorerCase;

const explorerCase = {
  id: "data-table/dimensions",
  label: "表格高度与滚动",
  summary: "分页和无分页表格默认预留五个标准行高单位；少量结果、加载、空状态和错误保持同一表面。所有固定容量在短屏统一限高，长行完整显示并在表格内滚动。",
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
