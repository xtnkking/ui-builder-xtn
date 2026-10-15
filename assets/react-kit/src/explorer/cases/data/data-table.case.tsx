// @ui-coverage {"kind":"example","runner":"explorer","caseId":"data-table/overview","exports":["DataTable","TreeTable"]}
import { useEffect, useId, useRef, useState } from "react";
import { FolderPlus, Plus, Pencil, Trash2 } from "lucide-react";
import {
  Checkbox,
  Button,
  DataTable,
  Dialog,
  DropdownMenu,
  Field,
  FilterBar,
  Inline,
  Input,
  SearchInput,
  StatusIndicator,
  TreeTable,
  VisuallyHidden,
  type DataColumn,
  type DataTableProps,
  type DataSort,
  type DataTableState,
  type TreeTableColumn,
  type TreeTableNode,
} from "../../../ui";
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
  { id: "workspace", value: { name: "产品工作区", kind: "目录", owner: "林晓" }, hasChildren: true, children: [
    { id: "design", value: { name: "设计资产", kind: "目录", owner: "陈屿" }, hasChildren: true, children: [
      { id: "tokens", value: { name: "主题令牌.json", kind: "文件", owner: "陈屿" } },
    ] },
    { id: "release", value: { name: "发布记录.md", kind: "文件", owner: "王宁" } },
  ] },
  { id: "archive", value: { name: "历史归档", kind: "目录", owner: "赵舒" }, hasChildren: true, children: [] },
];

function visitFolders(nodes: readonly TreeTableNode<FolderRow>[]): TreeTableNode<FolderRow>[] {
  return nodes.flatMap((node) => [node, ...visitFolders(node.children ?? [])]);
}

function updateFolder(nodes: readonly TreeTableNode<FolderRow>[], id: string, update: (node: TreeTableNode<FolderRow>) => TreeTableNode<FolderRow>): TreeTableNode<FolderRow>[] {
  return nodes.map((node) => node.id === id ? update(node) : node.children ? { ...node, children: updateFolder(node.children, id, update) } : node);
}

function removeFolder(nodes: readonly TreeTableNode<FolderRow>[], id: string): TreeTableNode<FolderRow>[] {
  return nodes.filter((node) => node.id !== id).map((node) => node.children ? { ...node, children: removeFolder(node.children, id) } : node);
}

function TreeTableActionsExample() {
  const [nodes, setNodes] = useState<TreeTableNode<FolderRow>[]>(treeNodes);
  const [expandedIds, setExpandedIds] = useState<string[]>(["workspace", "design"]);
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const pending = useRef(new Set<string>());
  const nextId = useRef(1);
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [notice, setNotice] = useState("");
  const nameInputId = useId();
  const entries = visitFolders(nodes);
  const folders = entries.filter((node) => node.value.kind === "目录");

  const addRoot = () => {
    const number = nextId.current++;
    const name = `新建目录 ${number}`;
    setNodes((current) => [...current, { id: `created-${number}`, value: { name, kind: "目录", owner: "我" }, hasChildren: true, children: [] }]);
    setNotice(`已新增根目录：${name}`);
  };
  const addChild = async (node: TreeTableNode<FolderRow>) => {
    // The synchronous latch blocks repeated activation before React renders loading.
    if (pending.current.has(node.id)) return;
    pending.current.add(node.id);
    setPendingIds((current) => [...current, node.id]);
    const number = nextId.current++;
    const name = `新建文件 ${number}.md`;
    try {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 800));
      setNodes((current) => updateFolder(current, node.id, (parent) => ({
        ...parent,
        children: [...(parent.children ?? []), { id: `created-${number}`, value: { name, kind: "文件", owner: "我" } }],
      })));
      setNotice(`已在 ${node.value.name} 下新增：${name}`);
    } finally {
      pending.current.delete(node.id);
      setPendingIds((current) => current.filter((id) => id !== node.id));
    }
  };
  const deleteNode = (node: TreeTableNode<FolderRow>) => {
    if (pending.current.size) return;
    const removedIds = new Set(visitFolders([node]).map((entry) => entry.id));
    setNodes((current) => removeFolder(current, node.id));
    setExpandedIds((current) => current.filter((id) => !removedIds.has(id)));
    setNotice(`已删除：${node.value.name}`);
  };
  const saveName = () => {
    if (!editing?.name.trim()) return;
    const name = editing.name.trim();
    setNodes((current) => updateFolder(current, editing.id, (node) => ({ ...node, value: { ...node.value, name } })));
    setNotice(`已更新名称：${name}`);
    setEditing(null);
  };
  const columns: TreeTableColumn<FolderRow>[] = [
    { id: "name", header: "名称", cell: (row) => row.name, width: "52%" },
    { id: "kind", header: "类型", cell: (row) => row.kind, width: 80 },
    { id: "owner", header: "负责人", cell: (row) => row.owner, width: 100 },
    { id: "actions", header: "操作", width: 112, cell: (row, { node }) => <DropdownMenu
      label="操作"
      ariaLabel={`操作 ${row.name}`}
      items={[
        { id: "edit", label: "编辑名称", icon: <Pencil />, onSelect: () => setEditing({ id: node.id, name: row.name }) },
        { id: "delete", label: node.value.kind === "目录" ? "删除目录及子项" : "删除文件", icon: <Trash2 />, danger: true, disabled: pendingIds.length > 0, onSelect: () => deleteNode(node) },
      ]}
    /> },
  ];
  return <>
    <TreeTable
      ariaLabel="文件目录"
      nodes={nodes}
      columns={columns}
      treeColumnId="name"
      expandedIds={expandedIds}
      onExpandedChange={setExpandedIds}
      getRowLabel={(node) => node.value.name}
      toolbar={<Inline role="group" aria-label="目录工具栏" gap="small">
        <Button size="small" variant="primary" icon={<FolderPlus />} onClick={addRoot}>新增根目录</Button>
        <Button size="small" onClick={() => setExpandedIds(folders.map((node) => node.id))}>全部展开</Button>
        <Button size="small" onClick={() => setExpandedIds([])}>全部收起</Button>
      </Inline>}
      renderBranchFooter={({ node }) => <Button
        size="small"
        variant="ghost"
        icon={<Plus />}
        aria-label={`在 ${node.value.name} 下新增子项`}
        loading={pendingIds.includes(node.id)}
        loadingLabel="新增子项"
        onClick={() => void addChild(node)}
      >新增子项</Button>}
      footer={<Inline justify="between" gap="small">
        <span role="status" aria-live="polite">共 {folders.length} 个目录 · {entries.length - folders.length} 个文件</span>
        {notice ? <span>{notice}</span> : null}
      </Inline>}
    />
    <Dialog
      open={editing !== null}
      onOpenChange={(open) => { if (!open) setEditing(null); }}
      title="编辑名称"
      footer={<><Button onClick={() => setEditing(null)}>取消</Button><Button variant="primary" disabled={!editing?.name.trim()} onClick={saveName}>保存</Button></>}
    >
      <Field label="名称" htmlFor={nameInputId}>
        <Input id={nameInputId} value={editing?.name ?? ""} onChange={(event) => {
          const name = event.currentTarget.value;
          setEditing((current) => current ? { ...current, name } : current);
        }} />
      </Field>
    </Dialog>
  </>;
}

function DataTableExample() {
  const [selected, setSelected] = useState<string[]>(["acc-01"]);
  const [sort, setSort] = useState<DataSort>({ columnId: "name", direction: "ascending" });
  const [page, setPage] = useState(1);
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
          label={<VisuallyHidden>{`选择 ${row.name}`}</VisuallyHidden>}
          checked={selected.includes(row.id)}
          onChange={(event) => setSelected((current) => event.currentTarget.checked ? [...current, row.id] : current.filter((id) => id !== row.id))}
        />
      ),
    },
    { id: "name", header: "账户", cell: (row) => row.name, minWidth: 240, sortable: true },
    { id: "owner", header: "负责人", cell: (row) => row.owner, width: 120, sortable: true },
    { id: "status", header: "状态", cell: (row) => <StatusIndicator tone={row.status === "运行中" ? "success" : "warning"} label={row.status} />, width: 140 },
  ];
  return (
    <div style={{ display: "grid", gap: 28 }}>
      <FilterBar ariaLabel="账户筛选" onSubmit={(event) => { event.preventDefault(); setAppliedQuery(query.trim()); setPage(1); }} actions={<Button size="field" type="submit">搜索</Button>}>
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
      <TreeTableActionsExample />
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

export function TableErrorFeedbackExample() {
  const [rows, setRows] = useState(allRows.slice(0, 3));
  const [state, setState] = useState<DataTableState>("ready");
  const [retrying, setRetrying] = useState(false);
  const pending = useRef(false);
  const revision = useRef(0);
  useEffect(() => () => { revision.current += 1; }, []);
  const simulateFailure = async (retained: boolean) => {
    if (pending.current) return;
    pending.current = true;
    const current = ++revision.current;
    setRows(retained ? allRows.slice(0, 3) : []);
    setState("loading");
    await new Promise<void>((resolve) => window.setTimeout(resolve, 500));
    if (current !== revision.current) return;
    setState("error");
    pending.current = false;
  };
  const retry = async () => {
    if (pending.current) return;
    pending.current = true;
    const current = ++revision.current;
    setRetrying(true);
    await new Promise<void>((resolve) => window.setTimeout(resolve, 500));
    if (current !== revision.current) return;
    setRows(allRows.slice(0, 3));
    setState("ready");
    setRetrying(false);
    pending.current = false;
  };
  const tableProps: Omit<DataTableProps<AccountRow>, "state"> = {
    ariaLabel: "账户错误反馈", columns: stateColumns, rows, rowKey: (row) => row.id,
    viewportRows: 3, retrying, onRetry: () => void retry(),
    errorTitle: "账户加载失败", errorDescription: "服务暂时不可用，请稍后重试。",
    mobileRow: (row) => <Inline gap="small"><strong>{row.name}</strong><span>{row.owner}</span></Inline>,
    pagination: { page: 1, pageCount: 1, total: rows.length, pageSize: 3, onPageChange: () => undefined },
  };
  return <div style={{ display: "grid", gap: 16 }}>
    <Inline wrap gap="small" aria-label="模拟账户请求">
      <Button size="small" disabled={state === "loading" || retrying} onClick={() => void simulateFailure(false)}>模拟首次加载失败</Button>
      <Button size="small" disabled={state === "loading" || retrying} onClick={() => void simulateFailure(true)}>模拟刷新失败</Button>
    </Inline>
    {state === "error"
      ? <DataTable {...tableProps} state="error" />
      : <DataTable {...tableProps} state={state} />}
  </div>;
}

function ErrorTables() {
  return <div style={{ display: "grid", gap: 28 }}>
    <TableErrorFeedbackExample />
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
  summary: "显式搜索与排序更新表格数据；树表演示顶部工具栏、每行操作、展开分支末尾新增子项与底部统计，另含加载、空、错误重试与长内容。表格不拥有独立禁用、只读或字段校验状态。",
  states: ["default", "controlled", "uncontrolled", "loading", "empty", "error", "longContent", "keyboard", "mobile", "overlay", "dark", "locale", "usage"],
  content: <DataTableExample />,
  stateExamples: [
    { state: "default", exports: ["DataTable", "TreeTable"], content: <DataTableExample /> },
    { state: "controlled", exports: ["DataTable", "TreeTable"], content: <DataTableExample /> },
    { state: "uncontrolled", exports: ["TreeTable"], content: <TreeTable ariaLabel="内部管理展开状态的目录" nodes={treeNodes} columns={stateTreeColumns} treeColumnId="name" defaultExpandedIds={["workspace"]} /> },
    { state: "loading", exports: ["DataTable", "TreeTable"], content: <LoadingTables /> },
    { state: "empty", exports: ["DataTable", "TreeTable"], content: <EmptyTables /> },
    { state: "error", exports: ["DataTable", "TreeTable"], content: <ErrorTables />, instructions: "分别模拟首次加载与保留数据的刷新失败：详细错误仅弹出去重轻提示，表格保持高度，在表内重试恢复。树表分支另有独立错误与重试。" },
    { state: "longContent", exports: ["DataTable", "TreeTable"], content: <LongTables /> },
    { state: "keyboard", exports: ["DataTable", "TreeTable"], content: <DataTableExample />, instructions: "使用 Tab 聚焦搜索、勾选、排序、分页和树展开按钮；Enter/Space 操作，聚焦表格滚动区域后用方向键滚动。这是操作入口案例，非自动验收结论。" },
    { state: "mobile", exports: ["DataTable", "TreeTable"], content: <StatePreview state="mobile">{<DataTableExample />}</StatePreview> },
    { state: "overlay", exports: ["DataTable", "TreeTable"], content: <StatePreview state="overlay">{<DataTableExample />}</StatePreview> },
    { state: "dark", exports: ["DataTable", "TreeTable"], content: <StatePreview state="dark">{<DataTableExample />}</StatePreview> },
    { state: "locale", exports: ["DataTable", "TreeTable"], content: <StatePreview state="locale">{<DataTableExample />}</StatePreview> },
    { state: "usage", exports: ["TreeTable"], content: <TreeTableActionsExample />, instructions: "顶部新增根目录或展开/收起全部分支；每行操作菜单可编辑和删除。展开目录后，在其整个子树末尾新增子项，按钮显示 800ms 加载并阻止重复提交；空目录也可展开添加。底部统计随数据变化。" },
  ],
  code: `const treeColumns = [\n  { id: "name", header: "名称", cell: (value) => value.name },\n  { id: "actions", header: "操作", cell: (value, { node }) =>\n    <Button onClick={() => editNode(node.id)}>编辑</Button> },\n];\n\n<TreeTable nodes={nodes} columns={treeColumns} treeColumnId="name"\n  expandedIds={expanded} onExpandedChange={setExpanded}\n  toolbar={<Button onClick={addRoot}>新增根目录</Button>}\n  renderBranchFooter={({ node }) => <Button loading={pendingId === node.id}\n    loadingLabel="新增子项" onClick={() => addChild(node.id)}>新增子项</Button>}\n  footer={<span>共 {total} 项</span>} ariaLabel="文件目录" />\n\n// 目录尚无子项时，使用 { hasChildren: true, children: [] } 保留展开入口。\n// toolbar/footer 独立于表格滚动；renderBranchFooter 仅在展开分支末尾显示。\n<DataTable columns={columns} rows={rows} rowKey={(row) => row.id}\n  sort={sort} onSort={setSort} viewportRows={5}\n  pagination={pagination} ariaLabel="账户列表" />`,
} satisfies ExplorerCase;

export default explorerCase;
