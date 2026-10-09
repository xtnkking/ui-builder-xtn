// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"data-table/overview","exports":["DataTable","TreeTable"]}
import { useState } from "react";
import {
  Checkbox,
  Button,
  DataTable,
  Field,
  FilterBar,
  Inline,
  SearchInput,
  StatusIndicator,
  TreeTable,
  type DataColumn,
  type DataSort,
  type TreeTableColumn,
  type TreeTableNode,
} from "../../../personal-ui";
import { StatePreview } from "../state-preview";
import type { ExplorerCase } from "../types";

interface AccountRow {
  id: string;
  name: string;
  owner: string;
  status: "运行中" | "待复核";
}

const allRows: AccountRow[] = [
  { id: "acc-01", name: "亚太区结算主账户", owner: "林晓", status: "运行中" },
  { id: "acc-02", name: "英国市场推广账户", owner: "陈屿", status: "待复核" },
  { id: "acc-03", name: "北美订阅服务账户", owner: "王宁", status: "运行中" },
  { id: "acc-04", name: "欧洲客户成功账户", owner: "赵舒", status: "运行中" },
  { id: "acc-05", name: "全球数据分析只读账户", owner: "周远", status: "待复核" },
  { id: "acc-06", name: "内部自动化服务账户", owner: "许言", status: "运行中" },
];

interface FolderRow { name: string; kind: string; owner: string }
const treeNodes: TreeTableNode<FolderRow>[] = [
  { id: "workspace", value: { name: "产品工作区", kind: "目录", owner: "林晓" }, children: [
    { id: "design", value: { name: "设计资产", kind: "目录", owner: "陈屿" }, children: [
      { id: "tokens", value: { name: "主题令牌.json", kind: "文件", owner: "陈屿" } },
    ] },
    { id: "release", value: { name: "发布记录.md", kind: "文件", owner: "王宁" } },
  ] },
  { id: "archive", value: { name: "历史归档", kind: "目录", owner: "赵舒" } },
];

function DataTableExample() {
  const [selected, setSelected] = useState<string[]>(["acc-01"]);
  const [sort, setSort] = useState<DataSort>({ columnId: "name", direction: "ascending" });
  const [page, setPage] = useState(1);
  const [expandedIds, setExpandedIds] = useState<string[]>(["workspace"]);
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const filteredRows = allRows.filter((row) => `${row.name} ${row.owner} ${row.status}`.includes(appliedQuery));
  const sortedRows = filteredRows.slice().sort((left, right) => {
    const columnId = sort.columnId === "owner" ? "owner" : "name";
    const order = left[columnId].localeCompare(right[columnId], "zh-CN");
    return sort.direction === "ascending" ? order : -order;
  });
  const pageCount = Math.max(1, Math.ceil(sortedRows.length / 3));
  const pageRows = sortedRows.slice((page - 1) * 3, page * 3);
  const columns: DataColumn<AccountRow>[] = [
    {
      id: "selection",
      header: "选择",
      kind: "selection",
      width: 72,
      cell: (row) => (
        <Checkbox
          label={`选择 ${row.name}`}
          checked={selected.includes(row.id)}
          onChange={(event) => setSelected((current) => event.currentTarget.checked ? [...current, row.id] : current.filter((id) => id !== row.id))}
        />
      ),
    },
    { id: "name", header: "账户", cell: (row) => row.name, minWidth: 240, sortable: true },
    { id: "owner", header: "负责人", cell: (row) => row.owner, width: 120, sortable: true },
    { id: "status", header: "状态", cell: (row) => <StatusIndicator tone={row.status === "运行中" ? "success" : "warning"} label={row.status} />, width: 140 },
  ];
  const treeColumns: TreeTableColumn<FolderRow>[] = [
    { id: "name", header: "名称", cell: (row) => row.name, width: "55%" },
    { id: "kind", header: "类型", cell: (row) => row.kind, width: "20%" },
    { id: "owner", header: "负责人", cell: (row) => row.owner, width: "25%" },
  ];
  return (
    <div style={{ display: "grid", gap: 28 }}>
      <FilterBar ariaLabel="账户筛选" actions={<Button size="field" onClick={() => { setAppliedQuery(query.trim()); setPage(1); }}>搜索</Button>}>
        <Field label="账户、负责人或状态" htmlFor="explorer-table-search"><SearchInput id="explorer-table-search" value={query} onChange={(event) => setQuery(event.currentTarget.value)} onClear={() => setQuery("")} /></Field>
      </FilterBar>
      <DataTable
        ariaLabel="账户列表"
        columns={columns}
        rows={pageRows}
        rowKey={(row) => row.id}
        state={sortedRows.length ? "ready" : "empty"}
        sort={sort}
        onSort={(nextSort) => { setSort(nextSort); setPage(1); }}
        viewportRows={3}
        mobileRow={(row) => <Inline gap="small"><strong>{row.name}</strong><span>{row.owner}</span></Inline>}
        pagination={{ page, pageCount, total: sortedRows.length, pageSize: 3, onPageChange: (nextPage) => setPage(nextPage) }}
      />
      <TreeTable
        ariaLabel="文件目录"
        nodes={treeNodes}
        columns={treeColumns}
        treeColumnId="name"
        expandedIds={expandedIds}
        onExpandedChange={setExpandedIds}
        getRowLabel={(node) => node.value.name}
      />
    </div>
  );
}

const stateColumns: DataColumn<AccountRow>[] = [
  { id: "name", header: "账户", cell: (row) => row.name, minWidth: 240 },
  { id: "owner", header: "负责人", cell: (row) => row.owner, width: 120 },
];
const stateTreeColumns: TreeTableColumn<FolderRow>[] = [
  { id: "name", header: "文件", cell: (row) => row.name, width: "70%" },
  { id: "owner", header: "负责人", cell: (row) => row.owner, width: "30%" },
];
const loadingTreeNodes: TreeTableNode<FolderRow>[] = [
  { id: "loading-folder", value: { name: "正在加载文件目录", kind: "目录", owner: "林晓" }, hasChildren: true, loading: true },
];
const errorTreeNodes: TreeTableNode<FolderRow>[] = [
  { id: "error-folder", value: { name: "展开以模拟请求失败", kind: "目录", owner: "林晓" }, hasChildren: true },
];
const longRows: AccountRow[] = [
  { id: "long-account", name: "Enterprise settlement account for the international subscription platform with a deliberately long display name", owner: "Long account owner", status: "运行中" },
];
const longTreeNodes: TreeTableNode<FolderRow>[] = [
  { id: "long-file", value: { name: "International subscription platform release notes and operational reference with a deliberately long file name.md", kind: "文件", owner: "Long file owner" } },
];

function LoadingTables() {
  return <div style={{ display: "grid", gap: 28 }}>
    <DataTable ariaLabel="加载中的账户" columns={stateColumns} rows={[]} rowKey={(row) => row.id} state="loading" viewportRows={3} />
    <TreeTable ariaLabel="加载中的目录分支" nodes={loadingTreeNodes} columns={stateTreeColumns} treeColumnId="name" />
  </div>;
}

function EmptyTables() {
  return <div style={{ display: "grid", gap: 28 }}>
    <DataTable ariaLabel="空账户列表" columns={stateColumns} rows={[]} rowKey={(row) => row.id} state="empty" viewportRows={3} emptyTitle="没有匹配账户" />
    <TreeTable ariaLabel="空目录" nodes={[]} columns={stateTreeColumns} treeColumnId="name" empty="目录中暂时没有文件。" />
  </div>;
}

function ErrorTables() {
  const [recovered, setRecovered] = useState(false);
  return <div style={{ display: "grid", gap: 28 }}>
    {recovered
      ? <DataTable ariaLabel="重试后的账户" columns={stateColumns} rows={allRows} rowKey={(row) => row.id} state="ready" viewportRows={3} />
      : <DataTable ariaLabel="请求失败的账户" columns={stateColumns} rows={[]} rowKey={(row) => row.id} state="error" viewportRows={3} errorTitle="账户加载失败" onRetry={() => setRecovered(true)} />}
    <TreeTable ariaLabel="展开失败的目录" nodes={errorTreeNodes} columns={stateTreeColumns} treeColumnId="name" onRequestChildren={async () => { throw new Error("目录加载失败，请重试。"); }} />
  </div>;
}

function LongTables() {
  return <div style={{ display: "grid", gap: 28 }}>
    <DataTable ariaLabel="长内容账户" columns={stateColumns} rows={longRows} rowKey={(row) => row.id} viewportRows={3} />
    <TreeTable ariaLabel="长文件名目录" nodes={longTreeNodes} columns={stateTreeColumns} treeColumnId="name" />
  </div>;
}

const explorerCase = {
  id: "data-table/overview",
  label: "表格与树表格",
  summary: "显式搜索实际筛选数据，排序更新行顺序；另演示表格加载、空、错误重试与树分支加载。表格不拥有独立禁用、只读或字段校验状态。",
  states: ["default", "controlled", "uncontrolled", "loading", "empty", "error", "longContent", "keyboard", "mobile", "overlay", "dark", "locale"],
  content: <DataTableExample />,
  stateExamples: [
    { state: "default", exports: ["DataTable", "TreeTable"], content: <DataTableExample /> },
    { state: "controlled", exports: ["DataTable", "TreeTable"], content: <DataTableExample /> },
    { state: "uncontrolled", exports: ["TreeTable"], content: <TreeTable ariaLabel="内部管理展开状态的目录" nodes={treeNodes} columns={stateTreeColumns} treeColumnId="name" defaultExpandedIds={["workspace"]} /> },
    { state: "loading", exports: ["DataTable", "TreeTable"], content: <LoadingTables /> },
    { state: "empty", exports: ["DataTable", "TreeTable"], content: <EmptyTables /> },
    { state: "error", exports: ["DataTable", "TreeTable"], content: <ErrorTables />, instructions: "点击账户重试按钮恢复数据；展开树表的目录分支触发实际拒绝的 Promise，观察分支错误并再次重试。" },
    { state: "longContent", exports: ["DataTable", "TreeTable"], content: <LongTables /> },
    { state: "keyboard", exports: ["DataTable", "TreeTable"], content: <DataTableExample />, instructions: "使用 Tab 聚焦搜索、勾选、排序、分页和树展开按钮；Enter/Space 操作，聚焦表格滚动区域后用方向键滚动。这是操作入口案例，非自动验收结论。" },
    { state: "mobile", exports: ["DataTable", "TreeTable"], content: <StatePreview state="mobile">{<DataTableExample />}</StatePreview> },
    { state: "overlay", exports: ["DataTable", "TreeTable"], content: <StatePreview state="overlay">{<DataTableExample />}</StatePreview> },
    { state: "dark", exports: ["DataTable", "TreeTable"], content: <StatePreview state="dark">{<DataTableExample />}</StatePreview> },
    { state: "locale", exports: ["DataTable", "TreeTable"], content: <StatePreview state="locale">{<DataTableExample />}</StatePreview> },
  ],
  code: `<DataTable columns={columns} rows={rows} rowKey={(row) => row.id} sort={sort} onSort={setSort} viewportRows={5} pagination={pagination} ariaLabel="账户列表" />\n<TreeTable nodes={nodes} columns={treeColumns} treeColumnId="name" expandedIds={expanded} onExpandedChange={setExpanded} ariaLabel="文件目录" />`,
} satisfies ExplorerCase;

export default explorerCase;
