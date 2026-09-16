import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Grid2X2, Hash, Pencil, RefreshCw, ShieldCheck, Table2, Users } from "lucide-react";
import {
  Autocomplete,
  AsyncSelect,
  Button,
  Checkbox,
  ConfirmDialog,
  ContextMenu,
  DataTable,
  Dialog,
  Drawer,
  DropdownMenu,
  Field,
  FamilyLoginPage,
  IconButton,
  Inline,
  ListManagementPage,
  MemberManagementPage,
  MultiSelect,
  NumberInput,
  SegmentedControl,
  Select,
  Tag,
  TagInput,
  Tabs,
  ToastProvider,
  TreeSelect,
  VisuallyHidden,
  useToast,
  type DataColumn,
  type LoginProduct,
  type MemberQuery,
  type MemberRecord,
  type MemberResult,
} from "./personal-ui";

type Scenario = "success" | "empty" | "error";

const members: MemberRecord[] = [
  { id: "u01", name: "陈沐", email: "chen.mu@example.com", team: "平台", role: "管理员", status: "已加入", joinedAt: "2026-09-08" },
  { id: "u02", name: "陆宁", email: "lu.ning@example.com", team: "增长", role: "查看者", status: "待确认", joinedAt: "2026-09-07" },
  { id: "u03", name: "许澄", email: "xu.cheng@example.com", team: "产品", role: "编辑者", status: "已加入", joinedAt: "2026-08-29" },
  { id: "u04", name: "林夏", email: "lin.xia@example.com", team: "客户成功", role: "查看者", status: "已加入", joinedAt: "2026-08-24" },
  { id: "u05", name: "顾言", email: "gu.yan@example.com", team: "财务", role: "管理员", status: "待确认", joinedAt: "2026-08-18" },
  { id: "u06", name: "周清", email: "zhou.qing@example.com", team: "平台", role: "管理员", status: "已加入", joinedAt: "2026-08-12" },
  { id: "u07", name: "沈意", email: "shen.yi@example.com", team: "设计", role: "编辑者", status: "已加入", joinedAt: "2026-08-04" },
  { id: "u08", name: "江遥", email: "jiang.yao@example.com", team: "平台", role: "管理员", status: "已加入", joinedAt: "2026-07-22" },
  { id: "u09", name: "叶舟", email: "ye.zhou@example.com", team: "设计", role: "编辑者", status: "已加入", joinedAt: "2026-07-16" },
  { id: "u10", name: "温岚", email: "wen.lan@example.com", team: "客户成功", role: "查看者", status: "待确认", joinedAt: "2026-07-09" },
  { id: "u11", name: "秦川", email: "qin.chuan@example.com", team: "增长", role: "编辑者", status: "已加入", joinedAt: "2026-06-28" },
  { id: "u12", name: "夏禾", email: "xia.he@example.com", team: "运营", role: "查看者", status: "已加入", joinedAt: "2026-06-11" },
  { id: "u13", name: "程越", email: "cheng.yue@example.com", team: "平台", role: "管理员", status: "已加入", joinedAt: "2026-05-26" },
  { id: "u14", name: "苏晚", email: "su.wan@example.com", team: "设计", role: "编辑者", status: "待确认", joinedAt: "2026-05-18" },
  { id: "u15", name: "贺川", email: "he.chuan@example.com", team: "客户成功", role: "查看者", status: "已加入", joinedAt: "2026-04-30" },
  { id: "u16", name: "黎安", email: "li.an@example.com", team: "运营", role: "编辑者", status: "已停用", joinedAt: "2026-04-14" },
  { id: "u17", name: "楚宁", email: "chu.ning@example.com", team: "财务", role: "管理员", status: "已加入", joinedAt: "2026-03-27" },
  { id: "u18", name: "白榆", email: "bai.yu@example.com", team: "产品", role: "查看者", status: "已加入", joinedAt: "2026-03-08" },
  { id: "u19", name: "乔木", email: "qiao.mu@example.com", team: "增长", role: "编辑者", status: "待确认", joinedAt: "2026-02-19" },
  { id: "u20", name: "季衡", email: "ji.heng@example.com", team: "客户成功", role: "查看者", status: "已加入", joinedAt: "2026-01-12" },
  { id: "u21", name: "唐梨", email: "tang.li@example.com", team: "运营", role: "编辑者", status: "已停用", joinedAt: "2025-12-20" },
  { id: "u22", name: "宋知", email: "song.zhi@example.com", team: "产品", role: "查看者", status: "已加入", joinedAt: "2025-11-16" },
  { id: "u23", name: "闻溪", email: "wen.xi@example.com", team: "设计", role: "编辑者", status: "已加入", joinedAt: "2025-10-04" },
];

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      window.clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    }, { once: true });
  });
}

function ProductScene({ type }: { type: "docs" | "analysis" }) {
  return (
    <div className={`demo-product-scene demo-product-scene--${type}`} aria-hidden="true">
      <div className="demo-product-scene__rail">
        <span /><span /><span /><span />
      </div>
      <div className="demo-product-scene__canvas">
        <span className="demo-product-scene__topline" />
        {type === "docs" ? (
          <><strong>Project brief</strong><span /><span /><span className="is-short" /><span /><span className="is-short" /></>
        ) : (
          <><strong>Weekly activity</strong><div className="demo-bars"><span /><span /><span /><span /><span /></div><span /><span className="is-short" /></>
        )}
      </div>
    </div>
  );
}

const loginProducts: LoginProduct[] = [
  {
    id: "docs",
    name: "文档协作",
    accent: "#1769d2",
    eyebrow: "Workspace Docs",
    headline: "让团队内容始终清楚、有序",
    description: "从计划到交付，共享同一份准确上下文。",
    visual: <ProductScene type="docs" />,
  },
  {
    id: "analysis",
    name: "数据分析",
    accent: "#188766",
    eyebrow: "Workspace Analytics",
    headline: "把复杂数据变成可执行判断",
    description: "统一指标、查询和团队决策记录。",
    visual: <ProductScene type="analysis" />,
  },
];

const roleOptions = [
  { value: "basic", label: "普通用户 · 等级 0" },
  { value: "operations", label: "运营成员 · 等级 1" },
  { value: "reviewer", label: "审核员 · 等级 2" },
  { value: "editor", label: "内容编辑 · 等级 3" },
  { value: "support", label: "客户支持 · 等级 4" },
  { value: "analyst", label: "数据分析 · 等级 5" },
  { value: "manager", label: "部门主管 · 等级 6" },
  { value: "admin", label: "管理员 · 等级 7" },
];

const countryOptions = [
  { value: "cn", label: "中国", description: "CN · +86", leading: "🇨🇳" },
  { value: "us", label: "美国", description: "US · +1", leading: "🇺🇸" },
  { value: "gb", label: "英国", description: "GB · +44", leading: "🇬🇧" },
  { value: "jp", label: "日本", description: "JP · +81", leading: "🇯🇵" },
  { value: "kr", label: "韩国", description: "KR · +82", leading: "🇰🇷" },
  { value: "fr", label: "法国", description: "FR · +33", leading: "🇫🇷" },
  { value: "de", label: "德国", description: "DE · +49", leading: "🇩🇪" },
  { value: "ca", label: "加拿大", description: "CA · +1", leading: "🇨🇦" },
  { value: "au", label: "澳大利亚", description: "AU · +61", leading: "🇦🇺" },
  { value: "sg", label: "新加坡", description: "SG · +65", leading: "🇸🇬" },
  { value: "it", label: "意大利", description: "IT · +39", leading: "🇮🇹" },
  { value: "es", label: "西班牙", description: "ES · +34", leading: "🇪🇸" },
];

function CountryChoiceDemo({ id, label, initialValue = "", selectedOption, externalSwitch = false }: { id: string; label: string; initialValue?: string; selectedOption?: (typeof countryOptions)[number]; externalSwitch?: boolean }) {
  const [query, setQuery] = useState("");
  const [value, setValue] = useState(initialValue);
  const [options, setOptions] = useState(countryOptions.slice(0, 6));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [hasMore, setHasMore] = useState(true);
  useEffect(() => {
    if (!query) {
      setOptions(countryOptions.slice(0, 6));
      setHasMore(true);
      setError(undefined);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(undefined);
    setOptions([]);
    const timer = window.setTimeout(() => {
      if (query === "异常") {
        setError("国家目录加载失败");
      } else {
        const matching = countryOptions.filter((country) => `${country.label} ${country.description}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
        setOptions(matching.slice(0, 6));
        setHasMore(matching.length > 6);
      }
      setLoading(false);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [query]);
  return (
    <>
      <Field label={label} htmlFor={id}>
        <AsyncSelect
          id={id}
          ariaLabel={label}
          value={value}
          selectedOption={selectedOption}
          onValueChange={setValue}
          query={query}
          onQueryChange={setQuery}
          options={options}
          loading={loading}
          error={error}
          onRetry={async () => {
            await new Promise((resolve) => window.setTimeout(resolve, 400));
            setQuery("");
          }}
          hasMore={hasMore}
          onLoadMore={async () => {
            await new Promise((resolve) => window.setTimeout(resolve, 400));
            const matching = countryOptions.filter((country) => `${country.label} ${country.description}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
            setOptions(matching);
            setHasMore(false);
          }}
          placeholder="选择国家或地区"
          searchPlaceholder="搜索国家、代码或区号"
        />
      </Field>
      {externalSwitch ? <Button onClick={() => setValue("external-missing")}>切换外部国家值</Button> : null}
    </>
  );
}

function DemoContent() {
  const [tab, setTab] = useState("data");
  const [scenario, setScenario] = useState<Scenario>("success");
  const [numberValue, setNumberValue] = useState<number | "">(120);
  const [emptyNumberValue, setEmptyNumberValue] = useState<number | "">("");
  const [listPage, setListPage] = useState(1);
  const [listView, setListView] = useState<"paged" | "all">("paged");
  const [listViewport, setListViewport] = useState<"fixed" | "auto">("fixed");
  const [listEntries, setListEntries] = useState(members);
  const [selectedListIds, setSelectedListIds] = useState<string[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [loadingPage, setLoadingPage] = useState<number | undefined>();
  const [editingMember, setEditingMember] = useState<MemberRecord | null>(null);
  const [draftRole, setDraftRole] = useState("");
  const [draftStatus, setDraftStatus] = useState("");
  const [savingMember, setSavingMember] = useState(false);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [nestedDialogOpen, setNestedDialogOpen] = useState(false);
  const [floatingDialogOpen, setFloatingDialogOpen] = useState(false);
  const [teamQuery, setTeamQuery] = useState("");
  const [teamValue, setTeamValue] = useState("");
  const [tagQuery, setTagQuery] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [treeValue, setTreeValue] = useState("");
  const [assignedRoles, setAssignedRoles] = useState<string[]>(["basic"]);
  const [draftRoles, setDraftRoles] = useState<string[]>(["basic"]);
  const [savingRoles, setSavingRoles] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmScenario, setConfirmScenario] = useState<"success" | "error">("success");
  const [disabledUser, setDisabledUser] = useState(false);
  const scenarioRef = useRef(scenario);
  const { toast } = useToast();

  useEffect(() => {
    scenarioRef.current = scenario;
  }, [scenario]);

  const fetchMembers = useCallback(async (query: MemberQuery, signal: AbortSignal): Promise<MemberResult> => {
    await wait(650, signal);
    if (scenarioRef.current === "error") throw new Error("模拟请求失败");
    if (scenarioRef.current === "empty") return { items: [], total: 0 };
    const needle = query.search.trim().toLocaleLowerCase();
    const filtered = members.filter((member) => (
      (!needle || `${member.name} ${member.email}`.toLocaleLowerCase().includes(needle))
      && (!query.role || member.role === query.role)
      && (!query.status || member.status === query.status)
    ));
    const direction = query.sortDirection === "ascending" ? 1 : -1;
    const sorted = filtered.slice().sort((left, right) => (
      left[query.sortBy].localeCompare(right[query.sortBy], "zh-CN") * direction
    ));
    const start = (query.page - 1) * query.pageSize;
    return { items: sorted.slice(start, start + query.pageSize), total: sorted.length };
  }, []);

  const dataPage = (
    <div className="demo-case">
      <div className="demo-scenario-bar">
        <span>下一次响应</span>
        <SegmentedControl
          value={scenario}
          fill="mobile"
          ariaLabel="选择下一次查询响应"
          options={[
            { value: "success", label: "正常返回" },
            { value: "empty", label: "空结果" },
            { value: "error", label: "请求失败" },
          ]}
          onValueChange={setScenario}
        />
      </div>
      <MemberManagementPage
        fetchMembers={fetchMembers}
        onInvite={() => toast({
          tone: "success",
          title: "邀请已创建",
          description: "邀请链接已复制到剪贴板。",
          countdown: true,
        })}
      />
    </div>
  );

  const loginPage = (
    <div className="demo-auth-frame">
      <FamilyLoginPage
        companyName="Northstar"
        companyMark={<Grid2X2 aria-hidden="true" />}
        products={loginProducts}
        onForgotPassword={() => toast({ tone: "info", description: "密码重置入口已打开", duration: 2600 })}
        onCreateAccount={() => toast({ tone: "info", description: "账户注册入口已打开", duration: 2600 })}
        onSubmit={async () => {
          const controller = new AbortController();
          await wait(900, controller.signal);
          toast({
            tone: "success",
            position: "top-center",
            shape: "pill",
            description: "登录成功，正在进入工作区",
            closable: false,
            duration: 3200,
          });
        }}
      />
    </div>
  );

  const numberCase = (
    <section className="demo-number-case">
      <h2>数字输入</h2>
      <div className="demo-number-case__grid">
        <Field label="自检周期（分钟）" htmlFor="number-demo-period">
          <NumberInput id="number-demo-period" value={numberValue} onValueChange={setNumberValue} min={0} max={180} step={10} />
        </Field>
        <Field label="空值起点" htmlFor="number-demo-empty">
          <NumberInput id="number-demo-empty" value={emptyNumberValue} onValueChange={setEmptyNumberValue} min={10} max={30} />
        </Field>
        <Field label="只读周期" htmlFor="number-demo-readonly">
          <NumberInput id="number-demo-readonly" value={60} onValueChange={() => undefined} readOnly />
        </Field>
        <Field label="禁用周期" htmlFor="number-demo-disabled">
          <NumberInput id="number-demo-disabled" value={30} onValueChange={() => undefined} disabled />
        </Field>
      </div>
    </section>
  );

  const openListEditor = (member: MemberRecord) => {
    setEditingMember(member);
    setDraftRole(member.role);
    setDraftStatus(member.status);
  };
  const saveListMember = async () => {
    if (!editingMember || savingMember) return;
    const name = editingMember.name;
    setSavingMember(true);
    await new Promise((resolve) => window.setTimeout(resolve, 650));
    setListEntries((entries) => entries.map((member) => member.id === editingMember.id
      ? { ...member, role: draftRole, status: draftStatus }
      : member));
    setSavingMember(false);
    setEditingMember(null);
    toast({ tone: "success", description: `${name}的权限已更新` });
  };
  const visibleListEntries = listView === "paged"
    ? listEntries.slice((listPage - 1) * 5, listPage * 5)
    : listEntries;
  const visibleListIds = visibleListEntries.map((member) => member.id);
  const allVisibleListEntriesSelected = visibleListIds.length > 0
    && visibleListIds.every((id) => selectedListIds.includes(id));
  const setVisibleListSelection = (checked: boolean) => {
    setSelectedListIds((current) => {
      const next = new Set(current);
      visibleListIds.forEach((id) => checked ? next.add(id) : next.delete(id));
      return [...next];
    });
  };
  const setListEntrySelection = (id: string, checked: boolean) => {
    setSelectedListIds((current) => checked
      ? current.includes(id) ? current : [...current, id]
      : current.filter((currentId) => currentId !== id));
  };
  const listColumns: DataColumn<MemberRecord>[] = [
    {
      id: "selection",
      kind: "selection",
      header: (
        <Checkbox
          label={<VisuallyHidden>选择当前页全部用户</VisuallyHidden>}
          checked={allVisibleListEntriesSelected}
          disabled={listLoading}
          onChange={(event) => setVisibleListSelection(event.currentTarget.checked)}
        />
      ),
      width: 52,
      align: "center",
      cell: (member) => (
        <Checkbox
          label={<VisuallyHidden>选择{member.name}</VisuallyHidden>}
          checked={selectedListIds.includes(member.id)}
          onChange={(event) => setListEntrySelection(member.id, event.currentTarget.checked)}
        />
      ),
    },
    { id: "name", header: "用户", minWidth: 224, cell: (member) => (
      <div className="demo-list-user"><strong>{member.name}</strong><span>{member.email}</span></div>
    ) },
    { id: "role", header: "角色", width: 142, cell: (member) => member.role },
    { id: "status", header: "状态", width: 132, cell: (member) => <Tag tone={member.status === "已加入" ? "success" : member.status === "已停用" ? "neutral" : "warning"}>{member.status}</Tag> },
    { id: "team", header: "团队", minWidth: 148, cell: (member) => member.team },
    { id: "joinedAt", header: "加入时间", width: 160, cell: (member) => member.joinedAt },
    { id: "actions", header: "操作", width: 80, pin: "end", align: "center", cell: (member) => (
      <IconButton aria-label={`编辑${member.name}`} icon={<Pencil aria-hidden="true" />} onClick={() => openListEditor(member)} />
    ) },
  ];
  const renderListMobileRow = (member: MemberRecord) => (
    <div className="demo-list-mobile-row">
      <span className="demo-list-mobile-row__identity"><Checkbox label={<VisuallyHidden>选择{member.name}</VisuallyHidden>} checked={selectedListIds.includes(member.id)} onChange={(event) => setListEntrySelection(member.id, event.currentTarget.checked)} /><strong>{member.name}</strong></span><Tag tone={member.status === "已加入" ? "success" : member.status === "已停用" ? "neutral" : "warning"}>{member.status}</Tag>
      <span className="demo-list-mobile-row__email">{member.email}</span>
      <span className="demo-list-mobile-row__details"><span>{member.team} · {member.role}</span><span>加入 {member.joinedAt}</span></span>
      <span className="demo-list-mobile-row__action"><IconButton aria-label={`编辑${member.name}`} icon={<Pencil aria-hidden="true" />} onClick={() => openListEditor(member)} /></span>
    </div>
  );
  const listPageCase = (
    <div className="demo-list-frame">
      <ListManagementPage
        title="用户权限"
        description="查看用户状态与角色分配。"
        filters={(
          <Inline gap="small">
            <SegmentedControl
              value={listView}
              fill="mobile"
              ariaLabel="表格视图"
              disabled={listLoading}
              options={[{ value: "paged", label: "分页" }, { value: "all", label: "全部" }]}
              onValueChange={(view) => { setListView(view); setListPage(1); }}
            />
            <SegmentedControl
              value={listViewport}
              fill="mobile"
              ariaLabel="表格高度"
              disabled={listLoading}
              options={[{ value: "fixed", label: "固定高度" }, { value: "auto", label: "跟随内容" }]}
              onValueChange={setListViewport}
            />
          </Inline>
        )}
        actions={(
          <Button
            icon={<RefreshCw aria-hidden="true" />}
            loading={listLoading && loadingPage === undefined}
            loadingLabel="刷新中"
            aria-disabled={listLoading || undefined}
            onClick={async () => {
              setListLoading(true);
              await new Promise((resolve) => window.setTimeout(resolve, 650));
              setListLoading(false);
            }}
          >刷新</Button>
        )}
      >
        <DataTable
          ariaLabel="用户权限表"
          columns={listColumns}
          rows={visibleListEntries}
          rowKey={(member) => member.id}
          state={listLoading ? "loading" : "ready"}
          loadingRows={listView === "paged" ? 5 : listEntries.length}
          viewportRows={listViewport === "fixed" ? 4 : "auto"}
          mobileRow={renderListMobileRow}
          pagination={listView === "paged" ? {
            page: listPage,
            pageCount: Math.ceil(listEntries.length / 5),
            total: listEntries.length,
            pageSize: 5,
            loadingPage,
            onPageChange: async (nextPage) => {
              setLoadingPage(nextPage);
              setListLoading(true);
              await new Promise((resolve) => window.setTimeout(resolve, 650));
              setListPage(nextPage);
              setLoadingPage(undefined);
              setListLoading(false);
            },
          } : undefined}
        />
      </ListManagementPage>
      <Drawer
        open={Boolean(editingMember)}
        onClose={() => { if (!savingMember) setEditingMember(null); }}
        closable={!savingMember}
        closeOnBackdropClick={false}
        title={`编辑${editingMember?.name ?? "用户"}的权限`}
        description={editingMember?.email}
        footer={<><Button disabled={savingMember} onClick={() => setEditingMember(null)}>取消</Button><Button variant="primary" loading={savingMember} loadingLabel="保存中" onClick={() => void saveListMember()}>保存</Button></>}
      >
        <div className="demo-list-editor">
          <Field label="角色" htmlFor="demo-list-role"><Select id="demo-list-role" ariaLabel="角色" value={draftRole} onValueChange={setDraftRole} disabled={savingMember} options={[{ value: "管理员", label: "管理员" }, { value: "编辑者", label: "编辑者" }, { value: "查看者", label: "查看者" }]} /></Field>
          <Field label="状态" htmlFor="demo-list-status"><Select id="demo-list-status" ariaLabel="状态" value={draftStatus} onValueChange={setDraftStatus} disabled={savingMember} options={[{ value: "已加入", label: "已加入" }, { value: "待确认", label: "待确认" }, { value: "已停用", label: "已停用" }]} /></Field>
          <CountryChoiceDemo id="demo-list-country" label="所属国家或地区" />
        </div>
      </Drawer>
    </div>
  );

  const dialogCase = (
    <section className="demo-dialog-case">
      <div className="demo-dialog-case__heading">
        <div><h2>用户管理</h2><p>xtn · {disabledUser ? "已停用" : "正常"}</p></div>
        <div className="demo-dialog-case__actions">
          <Button onClick={() => { setDraftRoles(assignedRoles); setRoleDialogOpen(true); }}>分配角色</Button>
          <Button onClick={() => setFloatingDialogOpen(true)}>更多选择器</Button>
          <Button variant={disabledUser ? "primary" : "danger"} onClick={() => setConfirmOpen(true)}>{disabledUser ? "启用用户" : "停用用户"}</Button>
        </div>
      </div>
      <div className="demo-dialog-case__roles">
        <span>当前角色</span>
        {assignedRoles.map((value) => <Tag key={value}>{roleOptions.find((option) => option.value === value)?.label ?? value}</Tag>)}
      </div>
      <div className="demo-dialog-case__scenario">
        <span>下一次操作</span>
        <SegmentedControl value={confirmScenario} ariaLabel="选择确认操作响应" options={[{ value: "success", label: "正常返回" }, { value: "error", label: "请求失败" }]} onValueChange={setConfirmScenario} />
      </div>
      <Dialog
        open={roleDialogOpen}
        onClose={() => { if (!savingRoles) setRoleDialogOpen(false); }}
        closable={!savingRoles}
        closeOnBackdropClick={false}
        title="分配角色 · xtn"
        description="新增和移除角色需要分两次保存。"
        footer={<><Button disabled={savingRoles} onClick={() => setRoleDialogOpen(false)}>取消</Button><Button variant="primary" loading={savingRoles} loadingLabel="保存中" onClick={async () => { if (savingRoles) return; setSavingRoles(true); await new Promise((resolve) => window.setTimeout(resolve, 500)); setAssignedRoles(draftRoles); setSavingRoles(false); setRoleDialogOpen(false); toast({ tone: "success", description: "角色已保存" }); }}>保存</Button></>}
      >
        <div className="demo-dialog-form">
          <Field label="角色" htmlFor="demo-role-multi" required>
            <MultiSelect id="demo-role-multi" ariaLabel="角色" options={roleOptions} value={draftRoles} onValueChange={setDraftRoles} required />
          </Field>
          <CountryChoiceDemo id="demo-role-country" label="国家或地区" />
          <div className="demo-overlay-actions">
            <DropdownMenu label="角色操作" ariaLabel="角色操作菜单" items={[{ id: "audit", label: "查看角色记录", onSelect: () => toast({ tone: "info", description: "角色记录已打开" }) }, { id: "export", label: "导出角色列表", onSelect: () => toast({ tone: "success", description: "角色列表已导出" }) }]} />
            <ContextMenu ariaLabel="角色右键菜单" items={[{ id: "details", label: "查看权限详情", onSelect: () => toast({ tone: "info", description: "权限详情已打开" }) }]}>
              <span className="demo-context-target">右键查看权限</span>
            </ContextMenu>
            <Button onClick={() => setNestedDialogOpen(true)}>上层确认</Button>
          </div>
        </div>
      </Dialog>
      <ConfirmDialog
        open={nestedDialogOpen}
        onOpenChange={setNestedDialogOpen}
        closeOnBackdropClick={false}
        title="确认国家范围"
        description="此确认层位于角色分配之上。"
        confirmLabel="完成"
        onConfirm={() => setNestedDialogOpen(false)}
      />
      <Dialog
        open={floatingDialogOpen}
        onClose={() => setFloatingDialogOpen(false)}
        closeOnBackdropClick={false}
        title="更多选择器"
        description="团队、标签和组织节点。"
        footer={<Button variant="primary" onClick={() => setFloatingDialogOpen(false)}>完成</Button>}
      >
        <div className="demo-list-editor">
          <Field label="团队搜索" htmlFor="demo-autocomplete">
            <Autocomplete id="demo-autocomplete" ariaLabel="团队搜索" placeholder="搜索团队" query={teamQuery} onQueryChange={setTeamQuery} value={teamValue} onValueChange={setTeamValue} options={[{ value: "platform", label: "平台工程" }, { value: "operations", label: "运营中心" }, { value: "support", label: "客户支持" }]} />
          </Field>
          <Field label="权限标签" htmlFor="demo-tags">
            <TagInput id="demo-tags" ariaLabel="权限标签" value={tags} onValueChange={setTags} inputValue={tagQuery} onInputValueChange={setTagQuery} suggestions={[{ value: "平台" }, { value: "产品" }, { value: "运营" }]} />
          </Field>
          <Field label="组织节点" htmlFor="demo-tree">
            <TreeSelect id="demo-tree" ariaLabel="组织节点" value={treeValue} onValueChange={setTreeValue} options={[{ value: "company", label: "总部", children: [{ value: "product", label: "产品组" }, { value: "platform", label: "平台组" }] }, { value: "regional", label: "区域团队", children: [{ value: "support", label: "客户支持" }] }]} />
          </Field>
          <CountryChoiceDemo id="demo-external-country" label="外部选中项" initialValue="it" selectedOption={countryOptions[10]} externalSwitch />
        </div>
      </Dialog>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={disabledUser ? "启用用户" : "停用用户"}
        description={`确定${disabledUser ? "启用" : "停用"}“xtn”吗？`}
        confirmLabel={disabledUser ? "启用" : "停用"}
        tone={disabledUser ? "primary" : "danger"}
        onConfirm={async () => {
          await new Promise((resolve) => window.setTimeout(resolve, 500));
          if (confirmScenario === "error") throw new Error("模拟请求失败");
          setDisabledUser((current) => !current);
          toast({ tone: "success", description: "用户状态已更新" });
        }}
      />
    </section>
  );

  return (
    <div className="demo-shell pui-root">
      <header className="demo-topbar">
        <div className="demo-brand"><span><Grid2X2 className="demo-brand__icon" aria-hidden="true" /></span><strong>Personal UI</strong></div>
        <span>React source kit</span>
      </header>
      <main className="demo-main">
        <div className="demo-titlebar">
          <div><h1>页面实例</h1><p>相同控件源码，按产品和业务组合。</p></div>
        </div>
        <div className="demo-tabs-scope">
          <Tabs
            value={tab}
            onValueChange={setTab}
            ariaLabel="页面实例"
            items={[
              { id: "data", label: <><Users aria-hidden="true" />成员管理</>, content: dataPage },
              { id: "login", label: <><FileText aria-hidden="true" />品牌家族登录</>, content: loginPage },
              { id: "number", label: <><Hash aria-hidden="true" />数字输入</>, content: numberCase },
              { id: "list", label: <><Table2 aria-hidden="true" />用户权限</>, content: listPageCase },
              { id: "dialog", label: <><ShieldCheck aria-hidden="true" />弹窗</>, content: dialogCase },
            ]}
          />
        </div>
      </main>
    </div>
  );
}

export function App() {
  return <ToastProvider><DemoContent /></ToastProvider>;
}
