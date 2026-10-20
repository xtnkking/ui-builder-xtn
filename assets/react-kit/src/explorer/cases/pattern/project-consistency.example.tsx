// @ui-coverage {"kind":"example","runner":"explorer","caseId":"list-filter/project-consistency","exports":["ListManagementPage","SearchFilterPage","MemberManagementPage"]}
import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import {
  Box, Button, DataTable, FilterBar, FilterField, Inline, ListManagementPage,
  MemberManagementPage, SearchFilterPage, SearchInput, Select, Stack, Tabs,
  ThemeProvider, TreeSelect, TreeTable,
  type DataColumn, type MemberQuery, type MemberResult, type ThemePreset,
} from "../../../ui";
import type { ExplorerCase } from "../types";

type RecordItem = { id: string; name: string; status: string };
type ProjectListWidth = "readable" | "wide";
const serverRows = [
  { id: "s1", name: "上海生产服务器", status: "运行中" },
  { id: "s2", name: "北京备份服务器", status: "运行中" },
];
const taskRows = [{ id: "t1", name: "每日文件备份", status: "已完成" }];
const fetchMembers = async (query: MemberQuery): Promise<MemberResult> => {
  const member = { id: "m1", name: "林夏", email: "lin@example.com", team: "平台工程", role: "管理员", status: "已加入", joinedAt: "2026-10-20" };
  const matched = `${member.name} ${member.email}`.includes(query.search)
    && (!query.role || query.role === member.role) && (!query.status || query.status === member.status);
  return { items: matched ? [member] : [], total: matched ? 1 : 0 };
};

function ResourceRouteExample({ kind, layoutWidth, fixedColumns }: {
  kind: "servers" | "tasks";
  layoutWidth: ProjectListWidth;
  fixedColumns: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [applied, setApplied] = useState("");
  const [loading, setLoading] = useState(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const requestLock = useRef(false);
  const source = kind === "servers" ? serverRows : taskRows;
  const rows = source.filter((row) => row.name.includes(applied));
  const query = async (value: string) => {
    if (requestLock.current) return;
    requestLock.current = true;
    setLoading(true);
    try {
      await new Promise<void>((resolve) => setTimeout(resolve, 250));
      if (!mounted.current) return;
      setApplied(value);
    } finally {
      requestLock.current = false;
      if (mounted.current) setLoading(false);
    }
  };
  const commands = <>
    <Button type="submit" size="field" variant="primary" icon={<Search aria-hidden="true" />}
      loading={loading} loadingLabel="查询">查询</Button>
    <Button type="button" size="field" variant="secondary" disabled={loading}
      onClick={() => { setDraft(""); void query(""); }}>重置</Button>
  </>;
  const filters = <FilterBar ariaLabel={kind === "servers" ? "服务器筛选" : "任务筛选"}
    onSubmit={(event) => { event.preventDefault(); void query(draft); }}
    actions={kind === "servers" ? commands : <Inline>{commands}</Inline>}>
    <FilterField width="medium"><SearchInput aria-label="名称" placeholder="输入名称" value={draft}
      disabled={loading} onChange={(event) => setDraft(event.currentTarget.value)} onClear={() => setDraft("")} /></FilterField>
  </FilterBar>;
  const columns: DataColumn<RecordItem>[] = [
    { id: "name", header: "名称", ...(fixedColumns ? { width: 240 } : { minWidth: 240 }), cell: (row) => row.name },
    { id: "status", header: "状态", width: 120, cell: (row) => row.status },
  ];
  const table = <DataTable ariaLabel={kind === "servers" ? "服务器数据" : "任务数据"}
    columns={columns} rows={rows} rowKey={(row) => row.id}
    state={loading ? "loading" : rows.length ? "ready" : "empty"}
    pagination={{ page: 1, pageCount: 1, pageSize: 5, total: rows.length, disabled: loading, onPageChange: () => undefined }} />;
  return kind === "servers"
    ? <ListManagementPage title="服务器" layoutWidth={layoutWidth} filters={filters}>{table}</ListManagementPage>
    : <SearchFilterPage title="任务中心" layoutWidth={layoutWidth} filters={filters}>{table}</SearchFilterPage>;
}

function ProjectConsistencyExample() {
  const [layoutWidth, setLayoutWidth] = useState<ProjectListWidth>("wide");
  const [preset, setPreset] = useState<ThemePreset>("default");
  const [fixedColumns, setFixedColumns] = useState(false);
  return <ThemeProvider preset={preset}>
    <Box padding="medium" surface="default"><Stack gap="large">
      <Inline>
        <Box style={{ width: 200, maxWidth: "100%" }}><Select ariaLabel="项目列表宽度" value={layoutWidth}
          options={[{ value: "wide", label: "全项目铺满" }, { value: "readable", label: "全项目限宽" }]}
          onValueChange={(value) => setLayoutWidth(value as ProjectListWidth)} /></Box>
        <Box style={{ width: 160, maxWidth: "100%" }}><Select ariaLabel="项目主题" value={preset}
          options={[{ value: "default", label: "默认" }, { value: "apple", label: "Apple" }, { value: "material", label: "Material" }]}
          onValueChange={(value) => setPreset(value as ThemePreset)} /></Box>
        <Box style={{ width: 200, maxWidth: "100%" }}><Select ariaLabel="表格列宽" value={fixedColumns ? "fixed" : "flexible"}
          options={[{ value: "flexible", label: "名称列承接剩余空间" }, { value: "fixed", label: "各列固定宽度" }]}
          onValueChange={(value) => setFixedColumns(value === "fixed")} /></Box>
      </Inline>
      <Tabs ariaLabel="项目列表导航" defaultValue="servers" items={[
        { id: "servers", label: "服务器", content: <ResourceRouteExample kind="servers" layoutWidth={layoutWidth} fixedColumns={fixedColumns} /> },
        { id: "tasks", label: "任务中心", content: <ResourceRouteExample kind="tasks" layoutWidth={layoutWidth} fixedColumns={fixedColumns} /> },
        { id: "members", label: "成员管理", content: <MemberManagementPage layoutWidth={layoutWidth} fetchMembers={fetchMembers} roles={["管理员"]} statuses={["已加入"]} /> },
      ]} />
      <section aria-label="同站表格与选择器">
        <Stack>
          <TreeTable ariaLabel="项目资源树表" treeColumnId="name" columns={[{ id: "name", header: "资源", cell: (value: { name: string }) => value.name }]}
            nodes={[{ id: "project", value: { name: "示例项目" } }]} />
          <Box style={{ width: 240, maxWidth: "100%" }}><TreeSelect ariaLabel="资源所属团队" defaultValue="platform"
            options={[{ value: "platform", label: "平台工程" }, { value: "support", label: "客户支持" }]} /></Box>
        </Stack>
      </section>
    </Stack></Box>
  </ThemeProvider>;
}

const example: ExplorerCase = {
  id: "list-filter/project-consistency",
  label: "同站列表一致性",
  summary: "服务器、任务与成员共用一个项目宽度；切换页面比较查询外观、空结果和表格边界，并对照列宽与主题。",
  states: ["default"],
  stateExamples: [{ state: "default", exports: ["ListManagementPage", "SearchFilterPage", "MemberManagementPage"], content: <ProjectConsistencyExample /> }],
  content: <ProjectConsistencyExample />,
  previewLayout: "page",
  code: `import { ListManagementPage, SearchFilterPage, MemberManagementPage } from "./ui";

// Place this shared choice in the application's configuration, then reuse across routes.
const projectListWidth = "wide" as const;

<ListManagementPage title="服务器" layoutWidth={projectListWidth} filters={serverFilters}>{serverTable}</ListManagementPage>;
<SearchFilterPage title="任务中心" layoutWidth={projectListWidth} filters={taskFilters}>{taskTable}</SearchFilterPage>;
<MemberManagementPage layoutWidth={projectListWidth} fetchMembers={fetchMembers} />;`,
};

export default example;
