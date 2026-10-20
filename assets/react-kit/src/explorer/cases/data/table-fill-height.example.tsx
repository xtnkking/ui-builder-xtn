// @ui-coverage {"kind":"example","runner":"explorer","caseId":"data-table/fill-height","exports":["DataTableProvider","DataTable"]}
import { useState } from "react";
import { Search } from "lucide-react";
import {
  Button,
  Checkbox,
  DataTable,
  DataTableProvider,
  FilterBar,
  FilterField,
  Inline,
  Input,
  SearchInput,
  Select,
  StatusIndicator,
  TableCellText,
  type DataColumn,
  type DataTableState,
} from "../../../ui";
import type { ExplorerCase } from "../types";

type Result = "sparse" | "many" | "loading" | "empty" | "error" | "retained-error" | "long";
interface Resource { id: string; name: string; owner: string; region: string; enabled: boolean }
const resources: Resource[] = Array.from({ length: 72 }, (_, index) => ({
  id: `resource-${String(index + 1).padStart(3, "0")}`,
  name: `${index % 2 ? "生产" : "测试"}代理节点 ${index + 1}`,
  owner: index % 2 ? "林晓" : "陈屿",
  region: index % 2 ? "华东" : "华南",
  enabled: index % 3 !== 0,
}));
const resultOptions: { value: Result; label: string }[] = [
  { value: "sparse", label: "1 条记录" },
  { value: "many", label: "多条记录" },
  { value: "loading", label: "加载状态" },
  { value: "empty", label: "空状态" },
  { value: "error", label: "首次错误" },
  { value: "retained-error", label: "保留数据错误" },
  { value: "long", label: "长内容" },
];
const initialFilters = { query: "", status: "all", owner: "", region: "all" };
const pageSize = 12;

/** The page owns its available space; the Provider owns the table's fill policy. */
export function TableFillHeightExample() {
  const [result, setResult] = useState<Result>("many");
  const [canvas, setCanvas] = useState("normal");
  const [expandedFilters, setExpandedFilters] = useState(false);
  const [expandedToolbar, setExpandedToolbar] = useState(false);
  const [mobileCards, setMobileCards] = useState(true);
  const [paginated, setPaginated] = useState(true);
  const [draft, setDraft] = useState(initialFilters);
  const [applied, setApplied] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const changeResult = (next: string) => { setResult(next as Result); setPage(1); };
  const updateDraft = (key: keyof typeof initialFilters, value: string) => setDraft((current) => ({ ...current, [key]: value }));
  const matching = resources.filter((row) => (
    `${row.id} ${row.name} ${row.owner}`.includes(applied.query.trim())
    && (applied.status === "all" || row.enabled === (applied.status === "enabled"))
    && row.owner.includes(applied.owner.trim())
    && (applied.region === "all" || row.region === applied.region)
  ));
  const resultRows = result === "sparse" ? matching.slice(0, 1)
    : result === "empty" || result === "error" ? [] : matching;
  const state: DataTableState = result === "loading" ? "loading"
    : result === "error" || result === "retained-error" ? "error"
    : resultRows.length ? "ready" : "empty";
  const pageCount = Math.max(1, Math.ceil(resultRows.length / pageSize));
  const rows = paginated ? resultRows.slice((page - 1) * pageSize, page * pageSize) : resultRows;
  const columns: DataColumn<Resource>[] = [
    { id: "name", header: "资源名称", minWidth: 280, cell: (row) => <TableCellText
      wrap={result === "long"}
      secondary={row.id}
    >{result === "long" ? `${row.name} · 跨区域业务专用连接，包含需要完整阅读的配置说明。`.repeat(8) : row.name}</TableCellText> },
    { id: "owner", header: "负责人", width: 120, cell: (row) => row.owner },
    { id: "region", header: "区域", width: 100, cell: (row) => row.region },
    { id: "status", header: "状态", width: 120, cell: (row) => <StatusIndicator tone={row.enabled ? "success" : "warning"} label={row.enabled ? "已启用" : "待复核"} /> },
  ];
  const reset = () => { setDraft(initialFilters); setApplied(initialFilters); setPage(1); };

  return <div style={{ display: "grid", gap: 16, minWidth: 0 }}>
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, padding: "20px 20px 0" }}>
      <div style={{ width: 160, maxWidth: "100%" }}><Select ariaLabel="自适应表格结果" value={result} options={resultOptions} onValueChange={changeResult} /></div>
      <div style={{ width: 160, maxWidth: "100%" }}><Select ariaLabel="自适应页面可用高度" value={canvas} onValueChange={setCanvas}
        options={[{ value: "normal", label: "较高父容器" }, { value: "short", label: "较短父容器" }, { value: "auto", label: "未指定高度（回退）" }]} /></div>
      <Checkbox label="展开更多筛选" checked={expandedFilters} onChange={(event) => setExpandedFilters(event.currentTarget.checked)} />
      <Checkbox label="双行工具栏" checked={expandedToolbar} onChange={(event) => setExpandedToolbar(event.currentTarget.checked)} />
      <Checkbox label="移动卡片" checked={mobileCards} onChange={(event) => setMobileCards(event.currentTarget.checked)} />
      <Checkbox label="显示表格分页" checked={paginated} onChange={(event) => setPaginated(event.currentTarget.checked)} />
    </div>
    <p style={{ margin: 0, padding: "0 20px", lineHeight: 1.65 }}>
      改变窗口高度、父容器或上方内容，表格填满剩余空间，分页距画布底部始终为 24px。手机及极短窗口允许外层页面滚动，保留可操作的数据区。
    </p>
    <DataTableProvider heightMode="fill">
      <section aria-label="资源管理自适应页面" style={{
        boxSizing: "border-box",
        height: canvas === "auto" ? undefined : canvas === "short" ? "clamp(620px, 64dvh, 860px)" : "clamp(720px, 84dvh, 1080px)",
        display: "grid",
        gridTemplateRows: "auto auto auto minmax(260px, 1fr)",
        gap: 16,
        minWidth: 0,
        minHeight: "min-content",
        padding: "20px 20px 24px",
      }}>
        <header style={{ minWidth: 0 }}>
          <h3 style={{ margin: 0 }}>资源管理</h3>
          <p style={{ margin: "6px 0 0" }}>统一底边，不用按记录数量计算高度。</p>
        </header>
        <FilterBar ariaLabel="自适应资源筛选" onSubmit={(event) => {
          event.preventDefault(); setApplied(draft); setPage(1);
        }} actions={<><Button type="submit" size="field" variant="primary" icon={<Search aria-hidden="true" />}>查询</Button><Button type="button" size="field" variant="secondary" onClick={reset}>重置</Button></>}>
          <FilterField><SearchInput aria-label="资源名称或编号" placeholder="名称或编号" value={draft.query}
            onChange={(event) => updateDraft("query", event.currentTarget.value)} onClear={() => updateDraft("query", "")} /></FilterField>
          <FilterField width="short"><Select ariaLabel="资源状态" value={draft.status} onValueChange={(value) => updateDraft("status", value)} options={[
            { value: "all", label: "全部状态" }, { value: "enabled", label: "已启用" }, { value: "review", label: "待复核" },
          ]} /></FilterField>
          {expandedFilters ? <>
            <FilterField width="short"><Input aria-label="资源负责人" placeholder="负责人" value={draft.owner} onChange={(event) => updateDraft("owner", event.currentTarget.value)} /></FilterField>
            <FilterField width="short"><Select ariaLabel="资源区域" value={draft.region} onValueChange={(value) => updateDraft("region", value)} options={[
              { value: "all", label: "全部区域" }, { value: "华东", label: "华东" }, { value: "华南", label: "华南" },
            ]} /></FilterField>
          </> : null}
        </FilterBar>
        <div style={{ display: "grid", gap: 8, minWidth: 0 }}>
          <Inline gap="small" wrap>
            <Button size="small" onClick={() => setExpandedFilters((current) => !current)}>{expandedFilters ? "收起筛选" : "更多筛选"}</Button>
            <Button size="small" onClick={() => setExpandedToolbar((current) => !current)}>{expandedToolbar ? "收起使用说明" : "显示使用说明"}</Button>
          </Inline>
          {expandedToolbar ? <p style={{ margin: 0, lineHeight: 1.65 }}>工具栏增加一行时，数据区自动让出空间；结果总数与分页仍由表格统一显示。</p> : null}
        </div>
        <div style={{ display: "grid", minWidth: 0, minHeight: 0 }}>
          <DataTable ariaLabel="剩余空间资源列表" columns={columns} rows={rows} rowKey={(row) => row.id} state={state}
            emptyTitle="没有匹配资源" emptyDescription="调整筛选条件后重新查询，表格仍保留可用空间。"
            emptyAction={<Button size="small" onClick={() => { reset(); changeResult("many"); }}>恢复记录</Button>}
            errorTitle="资源加载失败" errorDescription="请重试，已加载的记录仍可查看。" onRetry={() => changeResult("many")}
            mobileRow={mobileCards ? (row) => <TableCellText wrap={result === "long"}
              secondary={`${row.owner} · ${row.region} · ${row.enabled ? "已启用" : "待复核"}`}
            >{result === "long" ? `${row.name} · 需要完整阅读的跨区域连接说明。`.repeat(8) : row.name}</TableCellText> : undefined}
            pagination={paginated ? { page, pageCount, total: resultRows.length, pageSize, onPageChange: setPage } : undefined} />
        </div>
      </section>
    </DataTableProvider>
  </div>;
}

const explorerCase = {
  id: "data-table/fill-height",
  label: "页面自适应表格",
  summary: "页面提供有界空间，表格填满页头、筛选与工具栏之后的剩余高度；底部留白由页面统一设为 24px，分页留在表格内，记录数量不决定高度。",
  previewLayout: "page",
  states: ["default"],
  content: <TableFillHeightExample />,
  stateExamples: [{ state: "default", exports: ["DataTableProvider", "DataTable"], content: <TableFillHeightExample />,
    instructions: "切换 1 条、多条、加载、空、首次错误、保留数据错误与长内容；切换父容器高度、展开筛选/工具栏并改变窗口大小。分页与底部保留 24px，只有数据区滚动。窄屏可切换移动卡片与横向表格。" }],
  code: `import { useState } from "react";
import { Search } from "lucide-react";
import {
  Button, DataTable, DataTableProvider, FilterBar, FilterField,
  SearchInput, type DataColumn,
} from "./ui";

type Row = { id: string; name: string };
const records: Row[] = Array.from({ length: 72 }, (_, index) => ({
  id: String(index + 1), name: "资源 " + (index + 1),
}));
const columns: DataColumn<Row>[] = [
  { id: "name", header: "资源名称", minWidth: 240, cell: (row) => row.name },
];

function ResourcePage() {
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const filtered = records.filter((row) => row.name.includes(query));
  const pageSize = 20;
  return <main style={{
    display: "grid", gridTemplateRows: "auto auto minmax(260px, 1fr)",
    minWidth: 0, minHeight: "min-content", gap: 16, padding: "24px 24px 24px",
  }}>
    <header><h1>资源管理</h1></header>
    <FilterBar ariaLabel="资源筛选" onSubmit={(event) => {
      event.preventDefault(); setQuery(draft.trim()); setPage(1);
    }} actions={<Button type="submit" size="field" variant="primary" icon={<Search aria-hidden="true" />}>查询</Button>}>
      <FilterField><SearchInput aria-label="资源名称" value={draft}
        onChange={(event) => setDraft(event.currentTarget.value)}
        onClear={() => setDraft("")} /></FilterField>
    </FilterBar>
    <div style={{ display: "grid", minWidth: 0, minHeight: 0 }}>
      <DataTable ariaLabel="资源列表" columns={columns}
        rows={filtered.slice((page - 1) * pageSize, page * pageSize)}
        rowKey={(row) => row.id} state={filtered.length ? "ready" : "empty"}
        pagination={{ page, pageCount: Math.max(1, Math.ceil(filtered.length / pageSize)),
          total: filtered.length, pageSize, onPageChange: setPage }} />
    </div>
  </main>;
}

export default function App() {
  // 路由外统一选择 fill；每个列表页提供自己的有界剩余空间。
  return <DataTableProvider heightMode="fill">
    <div style={{
      height: "100dvh", display: "grid", gridTemplateRows: "auto minmax(0, 1fr)",
      minWidth: 0, minHeight: 0,
    }}>
      <header style={{ padding: 16 }}>业务工作台</header>
      <ResourcePage />
    </div>
  </DataTableProvider>;
}
// 中间伸缩容器需 minHeight: 0；页面为表格保留260px，空间不足时外层滚动。
// 底部 24px 由页面 padding 控制，不由 DataTable 猜测窗口或其他组件高度。
// 手机/软键盘导致空间不足时，应用应保留内容最小可用高度并允许外层页面滚动。
// 局部卡片可用独立的 DataTableProvider heightMode="rows" 保留固定容量。`,
} satisfies ExplorerCase;

export default explorerCase;
