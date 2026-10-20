// @ui-coverage {"kind":"example","runner":"explorer","caseId":"list-filter/overview","exports":["PageHeading","ListManagementPage","SearchFilterPage","MemberManagementPage"]}
import { StatePreview } from "../state-preview";
import { Box, Button, DataTable, EmptyState, FilterBar, Inline, ListManagementPage, MemberManagementPage, PageHeading, SearchFilterPage, SearchInput, Tabs, useUILocale } from "../../../ui";
import { useRef, useState } from "react";
import { Search } from "lucide-react";
import type { MemberQuery, MemberResult } from "../../../ui";
import type { ExplorerCase } from "../types";

// 同一项目的同类列表共享宽度；需要宽屏时统一把这一处改为 "wide"。
const projectListWidth = "readable" as const;

const result: MemberResult = {
  items: [{ id: "m1", name: "林夏", email: "lin.xia@example.com", team: "客户成功", role: "编辑者", status: "已加入", joinedAt: "2026-09-20" }],
  total: 1,
};

async function fetchFixtureMembers(query: MemberQuery): Promise<MemberResult> {
  const filtered = result.items.filter((member) => `${member.name} ${member.email}`.toLocaleLowerCase().includes(query.search.toLocaleLowerCase()) && (!query.role || member.role === query.role) && (!query.status || member.status === query.status));
  const sorted = filtered.slice().sort((left, right) => left[query.sortBy].localeCompare(right[query.sortBy]) * (query.sortDirection === "ascending" ? 1 : -1));
  const start = (query.page - 1) * query.pageSize;
  return { items: sorted.slice(start, start + query.pageSize), total: sorted.length };
}

const longDescription = "此页面管理全部产品中的角色配置、数据访问权限、通知偏好和账户安全设置，请确认所有关联配置均符合团队的实际使用要求后执行操作。";

function LongListPages() {
  return <Box padding="medium"><Tabs ariaLabel="长内容列表页面案例" defaultValue="heading" items={[
    { id: "heading", label: "页头", content: <PageHeading title="完整成员说明" description={longDescription} /> },
    { id: "management", label: "列表管理", content: <ListManagementPage title="项目" layoutWidth={projectListWidth} description={longDescription}><p>项目列表</p></ListManagementPage> },
    { id: "search", label: "搜索筛选", content: <SearchFilterPage title="审计" layoutWidth={projectListWidth} description={longDescription}><p>查询结果</p></SearchFilterPage> },
    { id: "members", label: "成员工作流", content: <MemberManagementPage title={longDescription} layoutWidth={projectListWidth} fetchMembers={async () => ({ items: [{ id: "long", name: "此成员负责全部产品中的角色配置、数据访问权限、通知偏好和账户安全设置，请确认所有关联配置均符合团队的实际使用要求。", email: "long@example.com", team: "平台", role: "editor", status: "joined", joinedAt: "2026-09-20" }], total: 1 })} /> },
  ]} /></Box>;
}

function KeyboardListPages() {
  const [feedback, setFeedback] = useState("尚未执行返回");
  return <Box padding="medium"><Tabs ariaLabel="键盘操作列表页面案例" defaultValue="heading" items={[
    { id: "heading", label: "页头", content: <><PageHeading title="成员" onBack={() => setFeedback("页头返回已触发")} /><p role="status">{feedback}</p></> },
    { id: "management", label: "列表管理", content: <><ListManagementPage title="项目" layoutWidth={projectListWidth} onBack={() => setFeedback("列表页返回已触发")}><p>项目列表</p></ListManagementPage><p role="status">{feedback}</p></> },
    { id: "search", label: "搜索筛选", content: <><SearchFilterPage title="审计" layoutWidth={projectListWidth} onBack={() => setFeedback("搜索页返回已触发")}><p>查询结果</p></SearchFilterPage><p role="status">{feedback}</p></> },
    { id: "members", label: "成员工作流", content: <MemberManagementPage layoutWidth={projectListWidth} fetchMembers={fetchFixtureMembers} roles={["编辑者"]} statuses={["已加入"]} /> },
  ]} /></Box>;
}

function DraftListPage({ kind }: { kind: "management" | "search" }) {
  const [draft, setDraft] = useState(kind === "search" ? "林" : "");
  const [query, setQuery] = useState("");
  const [submissions, setSubmissions] = useState(0);
  const rows = kind === "management" ? ["文档协作项目", "数据平台项目", "林夏的客户项目"] : ["林夏：更新角色权限", "陈屿：导出审计记录", "林夏：创建工作区"];
  const matched = rows.filter((row) => row.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const filters = <FilterBar ariaLabel={kind === "management" ? "项目筛选" : "审计筛选"} onSubmit={(event) => { event.preventDefault(); setQuery(draft.trim()); setSubmissions((count) => count + 1); }} actions={<Button type="submit" size="field" variant="primary" icon={<Search aria-hidden="true" />} loadingLabel={kind === "management" ? "查询" : "搜索"}>{kind === "management" ? "查询" : "搜索"}</Button>} status={submissions ? `第 ${submissions} 次查询：${matched.length} 条结果` : "输入仅更新草稿；提交后更新结果"}><SearchInput aria-label={kind === "management" ? "项目名称" : "操作者"} placeholder={kind === "management" ? "搜索项目名称" : "搜索操作者"} value={draft} onChange={(event) => setDraft(event.currentTarget.value)} /></FilterBar>;
  const content = matched.length ? <ul>{matched.map((row) => <li key={row}>{row}</li>)}</ul> : <EmptyState compact title="没有匹配结果" description="修改搜索条件并再次提交。" />;
  return kind === "management" ? <ListManagementPage title="项目" layoutWidth={projectListWidth} description="显式查询并保持结果区域稳定。" filters={filters}>{content}</ListManagementPage> : <SearchFilterPage title="审计记录" layoutWidth={projectListWidth} filters={filters}>{content}</SearchFilterPage>;
}

const scopedTasks = [
  { id: "task-001", name: "同步商品库存", status: "运行中" },
  { id: "task-002", name: "核对订单金额", status: "已完成" },
  { id: "task-003", name: "生成配送清单", status: "待处理" },
];

// One complete page; independent service and list requests own their own status.
export function ScopedListExample() {
  const { formatDate } = useUILocale();
  const [draft, setDraft] = useState("");
  const [rows, setRows] = useState(scopedTasks);
  const [page, setPage] = useState(1);
  const [querying, setQuerying] = useState(false);
  const [checkingService, setCheckingService] = useState(false);
  const [listUpdatedAt, setListUpdatedAt] = useState<Date | null>(null);
  const [serviceUpdatedAt, setServiceUpdatedAt] = useState<Date | null>(null);
  const listBusy = useRef(false);
  const serviceBusy = useRef(false);
  const time = (value: Date) => formatDate(value, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const queryTasks = async () => {
    if (listBusy.current) return;
    listBusy.current = true;
    setQuerying(true);
    const search = draft.trim();
    await new Promise<void>((resolve) => setTimeout(resolve, 300));
    setRows(scopedTasks.filter((task) => task.name.includes(search)));
    setPage(1);
    setListUpdatedAt(new Date());
    listBusy.current = false;
    setQuerying(false);
  };
  const checkService = async () => {
    if (serviceBusy.current) return;
    serviceBusy.current = true;
    setCheckingService(true);
    await new Promise<void>((resolve) => setTimeout(resolve, 300));
    setServiceUpdatedAt(new Date());
    serviceBusy.current = false;
    setCheckingService(false);
  };
  return (
    <ListManagementPage
      title="任务档案"
      layoutWidth={projectListWidth}
      filters={(
        <FilterBar
          ariaLabel="任务列表筛选"
          onSubmit={(event) => { event.preventDefault(); void queryTasks(); }}
          actions={<Button type="submit" size="field" variant="primary" icon={<Search aria-hidden="true" />} loading={querying} loadingLabel="查询任务">查询任务</Button>}
          status={querying ? "任务列表查询中" : listUpdatedAt ? `任务列表更新于 ${time(listUpdatedAt)}` : "任务列表：演示初始数据"}
        >
          <SearchInput aria-label="任务名称" placeholder="输入任务名称" value={draft} readOnly={querying} onChange={(event) => setDraft(event.currentTarget.value)} onClear={() => setDraft("")} />
        </FilterBar>
      )}
    >
      <section aria-label="服务状态">
        <Inline gap="small">
          <Button size="small" loading={checkingService} loadingLabel="检查服务状态" onClick={checkService}>检查服务状态</Button>
          <span role="status">{checkingService ? "服务状态检查中" : serviceUpdatedAt ? `服务正常 · 服务状态更新于 ${time(serviceUpdatedAt)}` : "服务状态尚未检查"}</span>
        </Inline>
      </section>
      <DataTable
        ariaLabel="任务列表"
        columns={[
          { id: "name", header: "任务名称", cell: (task) => task.name },
          { id: "status", header: "状态", width: 120, cell: (task) => task.status },
        ]}
        rows={rows.slice((page - 1) * 2, page * 2)}
        rowKey={(task) => task.id}
        state={querying ? "loading" : rows.length ? "ready" : "empty"}
        pagination={{ page, pageCount: Math.max(1, Math.ceil(rows.length / 2)), pageSize: 2, total: rows.length, disabled: querying, onPageChange: setPage }}
      />
    </ListManagementPage>
  );
}

function ListFilterExample() {
  const [feedback, setFeedback] = useState("");
  return (
    <Box padding="medium"><Tabs
      ariaLabel="列表页面模式案例"
      defaultValue="management"
      items={[
        { id: "heading", label: "页头", content: <><PageHeading title="成员" description="统一页面标题、返回和操作区。" actions={<Button variant="primary" onClick={() => setFeedback("邀请成员操作已触发")}>邀请成员</Button>} /><p role="status">{feedback}</p></> },
        {
          id: "management",
          label: "列表管理",
          content: <DraftListPage kind="management" />,
        },
        {
          id: "search",
          label: "搜索筛选",
          content: <DraftListPage kind="search" />,
        },
        {
          id: "scoped",
          label: "作用域分离",
          content: <ScopedListExample />,
        },
        {
          id: "members",
          label: "成员工作流",
          content: <MemberManagementPage layoutWidth={projectListWidth} fetchMembers={fetchFixtureMembers} roles={["编辑者"]} statuses={["已加入"]} />,
        },
      ]}
    /></Box>
  );
}

const explorerCase: ExplorerCase = {
  id: "list-filter/overview",
  label: "列表、筛选与成员管理",
  summary: "覆盖标准页头、显式查询、加载/空/错误边界以及完整成员管理工作流。",
  states: ["default", "loading", "empty", "error", "longContent", "keyboard", "mobile", "overlay", "dark", "locale"],
  stateExamples: [
    { state: "loading", exports: ["MemberManagementPage"], instructions: "初次查询延迟 1.8 秒；在搜索框输入条件后点击查询会再次显示实际加载态。", content: <MemberManagementPage layoutWidth={projectListWidth} fetchMembers={async () => { await new Promise<void>((resolve) => setTimeout(resolve, 1800)); return result; }} /> },
    { state: "empty", exports: ["MemberManagementPage"], content: <MemberManagementPage layoutWidth={projectListWidth} fetchMembers={async () => ({ items: [], total: 0 })} /> },
    { state: "error", exports: ["MemberManagementPage"], instructions: "初次查询失败后显示错误；重试再次执行同一拒绝回调，演示组件的恢复入口。", content: <MemberManagementPage layoutWidth={projectListWidth} fetchMembers={async () => { throw new Error("模拟成员查询失败"); }} /> },
    { state: "longContent", exports: ["PageHeading", "ListManagementPage", "SearchFilterPage", "MemberManagementPage"], content: <LongListPages /> },
    { state: "default", exports: ["PageHeading","ListManagementPage","SearchFilterPage","MemberManagementPage"], content: <ListFilterExample /> },
    { state: "keyboard", exports: ["PageHeading","ListManagementPage","SearchFilterPage","MemberManagementPage"], content: <KeyboardListPages />, instructions: "Tab 聚焦前三种页头的返回按钮，Enter 更新反馈；在成员页用 Tab 访问筛选和查询，Enter 提交，行操作打开成员详情。" },
    { state: "mobile", exports: ["PageHeading","ListManagementPage","SearchFilterPage","MemberManagementPage"], content: <StatePreview state="mobile">{<ListFilterExample />}</StatePreview> },
    { state: "overlay", exports: ["PageHeading","ListManagementPage","SearchFilterPage","MemberManagementPage"], content: <StatePreview state="overlay">{<ListFilterExample />}</StatePreview> },
    { state: "dark", exports: ["PageHeading","ListManagementPage","SearchFilterPage","MemberManagementPage"], content: <StatePreview state="dark">{<ListFilterExample />}</StatePreview> },
    { state: "locale", exports: ["PageHeading","ListManagementPage","SearchFilterPage","MemberManagementPage"], content: <StatePreview state="locale">{<ListFilterExample />}</StatePreview> },
  ],
  content: <ListFilterExample />,
  previewLayout: "page",
  code: `import { MemberManagementPage } from "./ui";

// 同类列表共用这一配置；选择宽屏布局时统一改为 "wide"。
const projectListWidth = "readable" as const;

<MemberManagementPage layoutWidth={projectListWidth} fetchMembers={fetchMembers} />`,
};

export default explorerCase;
