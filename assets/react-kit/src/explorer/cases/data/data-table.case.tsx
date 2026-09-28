// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"data-table/overview","exports":["DataTable","TreeTable"]}
import { useState } from "react";
import {
  Checkbox,
  DataTable,
  Inline,
  StatusIndicator,
  TreeTable,
  type DataColumn,
  type DataSort,
  type TreeTableColumn,
  type TreeTableNode,
} from "../../../personal-ui";
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
  const pageRows = allRows.slice((page - 1) * 3, page * 3);
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
      <DataTable
        ariaLabel="账户列表"
        columns={columns}
        rows={pageRows}
        rowKey={(row) => row.id}
        state="ready"
        sort={sort}
        onSort={setSort}
        viewportRows={3}
        mobileRow={(row) => <Inline gap="small"><strong>{row.name}</strong><span>{row.owner}</span></Inline>}
        pagination={{ page, pageCount: 2, total: allRows.length, pageSize: 3, onPageChange: (nextPage) => setPage(nextPage) }}
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

const explorerCase = {
  id: "data-table/overview",
  label: "表格与树表格",
  summary: "DataTable 演示勾选列自动冻结、排序、固定高度、移动渲染和内置分页；TreeTable 演示受控层级展开。",
  states: ["default", "disabled", "readOnly", "controlled", "validation", "keyboard", "overlay", "dark", "locale"],
  content: <DataTableExample />,
  code: `<DataTable columns={columns} rows={rows} rowKey={(row) => row.id} sort={sort} onSort={setSort} viewportRows={5} pagination={pagination} ariaLabel="账户列表" />\n<TreeTable nodes={nodes} columns={treeColumns} treeColumnId="name" expandedIds={expanded} onExpandedChange={setExpanded} ariaLabel="文件目录" />`,
} satisfies ExplorerCase;

export default explorerCase;
