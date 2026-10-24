import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Eye, FolderCog, ListPlus, LogIn, LogOut, Pencil, Plus, RefreshCw, Search, UsersRound } from "lucide-react";
import {
  Avatar, Button, Card, Checkbox, ClipboardButton, Collapse, ConfirmDialog, DescriptionList,
  Drawer, EmptyState, FilterBar, FilterField, IconButton, Inline,
  ListManagementPage, Media, OverflowText, Pagination, ScrollArea, SearchInput, Select,
  Skeleton, Stack, StickyHeaderActionBar, Tag, Tooltip, useToast,
} from "../../../ui";
import { allRoles, artRoot, type Role } from "./roles";
import {
  createAccount, createSeedAccounts, filterAccounts, mockRolesForAccount,
  normalizeLogin, validateAccount, validateGroupName, renameAccountGroup, deleteAccountGroup, type AccountDraft, type AccountFilters,
  type ImportRow, type ManagedAccount,
} from "./account-model";
import { AccountEditor, ImportAccounts } from "./AccountDrawers";
import { GroupManager } from "./GroupManager";
import { SelectedRoles } from "./SelectedRoles";
import "./accounts.css";

const initialFilters: AccountFilters = { query: "", server: "all", school: "all", group: "all", status: "all" };
const servers = ["西栅老街", "紫禁城", "钓鱼岛"];
const schools = [...new Set(allRoles.map(role => role.school))];
const hasFilters = (filters: AccountFilters) => Boolean(filters.query.trim()
  || filters.server !== "all" || filters.school !== "all" || filters.group !== "all" || filters.status !== "all");
function matchText(text: string, query: string) {
  const keyword = query.trim();
  if (!keyword) return text;
  const index = text.toLocaleLowerCase().indexOf(keyword.toLocaleLowerCase());
  if (index < 0) return text;
  return <>{text.slice(0, index)}<mark className="demo-accounts-query-match">{text.slice(index, index + keyword.length)}</mark>{text.slice(index + keyword.length)}</>;
}

export function AccountWorkspace({ previewTools }: { previewTools?: ReactNode }) {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState(() => createSeedAccounts(240));
  const [groupNames, setGroupNames] = useState(["未分组", "主力队伍", "日常任务", "收藏备用"]);
  const currentAccounts = useRef(accounts);
  currentAccounts.current = accounts;
  const [draft, setDraft] = useState<AccountFilters>(initialFilters);
  const [applied, setApplied] = useState<AccountFilters>(initialFilters);
  const [querying, setQuerying] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [paging, setPaging] = useState<number>();
  const browsePage = useRef(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState(() => new Set(["main", "daily", "demo-004"]));
  const [loaded, setLoaded] = useState(() => new Set(["main", "daily"]));
  const [loading, setLoading] = useState<Set<string>>(new Set());
  const loadingRef = useRef(new Set<string>());
  const [refreshing, setRefreshing] = useState<Set<string>>(new Set());
  const refreshRef = useRef(new Set<string>());
  const [synced, setSynced] = useState<Record<string, string>>({});
  const [detail, setDetail] = useState<Role | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [selectionOpen, setSelectionOpen] = useState(false);
  const [loginId, setLoginId] = useState<string | null>(null);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const queryVersion = useRef(0);
  const listStart = useRef<HTMLDivElement>(null);
  const scrollAfterChange = useRef(false);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  function later(callback: () => void, delay = 350) {
    const timer = setTimeout(() => { timers.current.delete(timer); callback(); }, delay);
    timers.current.add(timer);
  }
  const wait = () => new Promise<void>(resolve => later(resolve, 450));
  const filtered = useMemo(() => filterAccounts(accounts, applied), [accounts, applied]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const groups = useMemo(() => filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize), [filtered, currentPage, pageSize]);
  const roles = useMemo(() => accounts.flatMap(account => account.roles), [accounts]);
  const pageRoles = groups.filter(({ account }) => loaded.has(account.id)).flatMap(group => group.roles);
  const selectedOnPage = pageRoles.filter(role => selected.has(role.id)).length;
  const editingAccount = accounts.find(account => account.id === editingId) ?? null;
  const loginAccount = accounts.find(account => account.id === loginId) ?? null;
  const detailAccount = accounts.find(account => account.roles.some(role => role.id === detail?.id));
  const selectionText = roles.filter(role => selected.has(role.id)).map(role => {
    const owner = accounts.find(account => account.roles.some(item => item.id === role.id));
    return `${owner?.name} / ${role.name} / ${role.level}级 ${role.school} / ${role.server} / ID ${role.id}`;
  }).join("\n");

  // Metadata is searchable globally; expanded role views hydrate once per ID.
  useEffect(() => {
    for (const { account } of groups) {
      if (account.session !== "online" || !expanded.has(account.id) || loaded.has(account.id) || loadingRef.current.has(account.id)) continue;
      loadingRef.current.add(account.id);
      setLoading(previous => new Set(previous).add(account.id));
      later(() => {
        loadingRef.current.delete(account.id);
        setLoaded(previous => new Set(previous).add(account.id));
        setLoading(previous => { const next = new Set(previous); next.delete(account.id); return next; });
      });
    }
  }, [groups, expanded, loaded]);
  useEffect(() => {
    if (!scrollAfterChange.current) return;
    scrollAfterChange.current = false;
    listStart.current?.scrollIntoView({ block: "start", behavior: "auto" });
  }, [currentPage, pageSize, applied]);

  function toggle(ids: string[], checked: boolean) {
    setSelected(previous => { const next = new Set(previous); ids.forEach(id => checked ? next.add(id) : next.delete(id)); return next; });
  }
  function query(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (querying) return;
    const version = ++queryVersion.current;
    if (!hasFilters(applied)) browsePage.current = currentPage;
    const filters = { ...draft };
    setQuerying(true); setPaging(undefined);
    later(() => {
      if (version !== queryVersion.current) return;
      scrollAfterChange.current = true;
      setApplied(filters); setPage(1); setQuerying(false);
      if (hasFilters(filters)) {
        const matches = filterAccounts(currentAccounts.current, filters).slice(0, pageSize);
        setExpanded(previous => new Set([...previous, ...matches.map(({ account }) => account.id)]));
      }
    }, 300);
  }
  function reset() {
    queryVersion.current += 1;
    setDraft(initialFilters); setApplied(initialFilters); setQuerying(false);
    scrollAfterChange.current = true;
    setPaging(undefined); setPage(browsePage.current);
  }
  function changePage(nextPage: number) {
    if (paging !== undefined || querying) return;
    const version = ++queryVersion.current;
    setPaging(nextPage);
    later(() => {
      if (version !== queryVersion.current) return;
      scrollAfterChange.current = true;
      setPage(nextPage); setPaging(undefined);
      if (!hasFilters(applied)) browsePage.current = nextPage;
      else setExpanded(previous => new Set([...previous, ...filtered.slice((nextPage - 1) * pageSize, nextPage * pageSize).map(({ account }) => account.id)]));
    }, 180);
  }
  function refresh(account: ManagedAccount) {
    if (refreshRef.current.has(account.id) || account.session !== "online") return;
    refreshRef.current.add(account.id);
    setRefreshing(previous => new Set(previous).add(account.id));
    later(() => {
      setAccounts(previous => previous.map(item => item.id === account.id && item.session === "online" ? { ...item, roles: mockRolesForAccount(item) } : item));
      refreshRef.current.delete(account.id);
      setRefreshing(previous => { const next = new Set(previous); next.delete(account.id); return next; });
      setLoaded(previous => new Set(previous).add(account.id));
      setExpanded(previous => new Set(previous).add(account.id));
      setSynced(previous => ({ ...previous, [account.id]: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) }));
      toast({ description: `${account.name}的角色资料已同步`, tone: "success", duration: 2500, dedupeKey: `refresh-${account.id}` });
    }, 650);
  }
  function openEditor(account?: ManagedAccount) { setEditingId(account?.id ?? null); setEditorOpen(true); }
  async function signIn() {
    if (!loginId) return;
    const id = loginId;
    await wait();
    const account = currentAccounts.current.find(item => item.id === id);
    if (!account?.enabled) throw new Error("请先启用账号再登录。");
    const next = { ...account, session: "online" as const, roles: mockRolesForAccount(account) };
    setAccounts(previous => previous.map(item => item.id === id ? next : item));
    setLoaded(previous => new Set(previous).add(id));
    setExpanded(previous => new Set(previous).add(id));
    setSynced(previous => ({ ...previous, [id]: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) }));
    toast({ description: `${account.name}已模拟登录，角色资料已加载`, tone: "success", duration: 2500 });
  }
  function signOut(account: ManagedAccount) {
    if (refreshRef.current.has(account.id)) return;
    const ids = new Set(account.roles.map(role => role.id));
    setAccounts(previous => previous.map(item => item.id === account.id ? { ...item, session: "offline", roles: [] } : item));
    setSelected(previous => new Set([...previous].filter(id => !ids.has(id))));
    setLoaded(previous => { const next = new Set(previous); next.delete(account.id); return next; });
    setSynced(previous => { const next = { ...previous }; delete next[account.id]; return next; });
    if (detail && ids.has(detail.id)) setDrawerOpen(false);
    toast({ description: `${account.name}已退出登录`, duration: 2500 });
  }
  async function createGroup(name: string) {
    const error = validateGroupName(name, groupNames);
    if (error) throw new Error(error);
    await wait(); setGroupNames(previous => [...previous, name.trim()]);
    toast({ description: "分组已新增", tone: "success", duration: 2500 });
  }
  async function renameGroup(from: string, to: string) {
    const error = validateGroupName(to, groupNames, from);
    if (error) throw new Error(error);
    if (from === "未分组") throw new Error("未分组不能重命名。");
    await wait(); const name = to.trim();
    setGroupNames(previous => previous.map(group => group === from ? name : group));
    setAccounts(previous => renameAccountGroup(previous, from, name));
    setDraft(previous => previous.group === from ? { ...previous, group: name } : previous);
    setApplied(previous => previous.group === from ? { ...previous, group: name } : previous);
    toast({ description: "分组名称已更新", tone: "success", duration: 2500 });
  }
  async function deleteGroup(name: string) {
    if (name === "未分组") throw new Error("未分组不能删除。");
    await wait();
    setGroupNames(previous => previous.filter(group => group !== name));
    setAccounts(previous => deleteAccountGroup(previous, name));
    setDraft(previous => previous.group === name ? { ...previous, group: "未分组" } : previous);
    setApplied(previous => previous.group === name ? { ...previous, group: "未分组" } : previous);
    toast({ description: "分组已删除，所属账号已移至未分组", tone: "success", duration: 2500 });
  }
  function locateNew(ids: string[]) {
    queryVersion.current += 1;
    setQuerying(false); setPaging(undefined); setApplied(initialFilters); setDraft(initialFilters);
    setPage(1); browsePage.current = 1;
    setExpanded(previous => new Set([...previous, ...ids.slice(0, pageSize)]));
  }
  async function saveAccount(value: AccountDraft, accountId?: string) {
    await wait();
    const latest = currentAccounts.current;
    const error = Object.values(validateAccount(value, latest, accountId)).find(Boolean);
    if (error) throw new Error(error);
    if (accountId) {
      const original = latest.find(account => account.id === accountId);
      if (!original) throw new Error("该账号已不存在，请重新打开列表。");
      const sameLogin = normalizeLogin(value.login) === original.login;
      const updated = { ...createAccount(value, accountId), session: sameLogin ? original.session : "offline" as const, roles: sameLogin ? original.roles : [] };
      setAccounts(latest.map(account => account.id === accountId ? updated : account));
      if (!sameLogin) {
        toggle(original.roles.map(role => role.id), false);
        setLoaded(previous => { const next = new Set(previous); next.delete(accountId); return next; });
        setSynced(previous => { const next = { ...previous }; delete next[accountId]; return next; });
      }
    } else {
      const created = createAccount(value, `account-${crypto.randomUUID()}`);
      setAccounts([created, ...latest]); locateNew([created.id]);
    }
    setEditorOpen(false);
    toast({ description: accountId ? "账号资料已保存" : "账号已新增，请登录后加载角色", tone: "success", duration: 2500 });
  }
  async function importAccounts(rows: ImportRow[]) {
    await wait();
    const latest = currentAccounts.current;
    const seen = new Set(latest.map(account => normalizeLogin(account.login)));
    const created: ManagedAccount[] = [];
    for (const row of rows) {
      if (row.status !== "valid" || seen.has(normalizeLogin(row.login))) continue;
      const value = { login: row.login, name: row.name, group: row.group, note: "", enabled: true };
      const error = Object.values(validateAccount(value, [])).find(Boolean);
      if (error) throw new Error(`第 ${row.line} 行：${error}，请重新解析文本。`);
      seen.add(normalizeLogin(row.login));
      created.push(createAccount(value, `account-${crypto.randomUUID()}`));
    }
    if (!created.length) throw new Error("没有可新增的账号，请重新解析文本。");
    setGroupNames(previous => [...new Set([...previous, ...created.map(account => account.group)])]);
    setAccounts([...created, ...latest]); locateNew(created.map(account => account.id)); setImportOpen(false);
    toast({ description: `已新增 ${created.length} 个账号，重复与错误行未导入`, tone: "success", duration: 3000 });
  }

  return <div className="demo-accounts-workspace">
    <div className="demo-accounts-workspace-topbar">
      <div className="demo-accounts-workspace-identity"><span className="demo-accounts-identity-symbol"><UsersRound size={20} aria-hidden="true" /></span><span>梦幻西游角色管理</span></div>
      <Inline gap="small"><Tag>交互预览 · 模拟数据</Tag>{previewTools}</Inline>
    </div>
    <div className="demo-accounts-page-inset">
      <ListManagementPage title="账号与角色" layoutWidth="wide"
        actions={<Inline gap="small"><Button icon={<FolderCog aria-hidden="true" />} onClick={() => setGroupsOpen(true)}>分组管理</Button><Button icon={<ListPlus aria-hidden="true" />} onClick={() => setImportOpen(true)}>批量新增</Button><Button variant="primary" icon={<Plus aria-hidden="true" />} onClick={() => openEditor()}>新增账号</Button></Inline>}
        filters={<FilterBar ariaLabel="账号与角色筛选" onSubmit={query} actions={<Inline gap="small">
          <Button type="submit" variant="primary" size="field" icon={<Search aria-hidden="true" />} loading={querying} loadingLabel="查询">查询</Button>
          <Button size="field" onClick={reset}>重置</Button>
        </Inline>}>
          <FilterField width="medium"><SearchInput aria-label="搜索账号或角色" placeholder="账号、备注名、角色名或 ID" value={draft.query} onChange={event => setDraft({ ...draft, query: event.target.value })} onClear={() => setDraft({ ...draft, query: "" })} /></FilterField>
          <FilterField width={145}><Select ariaLabel="按分组筛选" value={draft.group} onValueChange={group => setDraft({ ...draft, group })} options={[{ value: "all", label: "全部分组" }, ...groupNames.map(group => ({ value: group, label: group }))]} /></FilterField>
          <FilterField width={145}><Select ariaLabel="按服务器筛选" value={draft.server} onValueChange={server => setDraft({ ...draft, server })} options={[{ value: "all", label: "全部服务器" }, ...servers.map(server => ({ value: server, label: server }))]} /></FilterField>
          <FilterField width={140}><Select ariaLabel="按门派筛选" value={draft.school} onValueChange={school => setDraft({ ...draft, school })} options={[{ value: "all", label: "全部门派" }, ...schools.map(school => ({ value: school, label: school }))]} /></FilterField>
          <FilterField width={120}><Select ariaLabel="按账号状态筛选" value={draft.status} onValueChange={status => setDraft({ ...draft, status: status as AccountFilters["status"] })} options={[{ value: "all", label: "全部状态" }, { value: "enabled", label: "已启用" }, { value: "disabled", label: "已停用" }]} /></FilterField>
        </FilterBar>}>
        <div className={applied.query.trim() ? "demo-accounts-result-toolbar" : "demo-accounts-list-start"} ref={listStart}>
          {applied.query.trim() && <span className="demo-accounts-active-query">匹配关键词：<mark className="demo-accounts-query-match">{applied.query.trim()}</mark></span>}
        </div>
        <Stack gap="medium">
          {groups.map(({ account, roles: visible }) => {
            const groupSelected = visible.filter(role => selected.has(role.id)).length;
            const ready = loaded.has(account.id);
            return <section key={account.id} className="demo-accounts-account-section"><Card aria-label={`账号：${account.name}`}
              heading={<div className="demo-accounts-account-heading"><span className="demo-accounts-account-name"><OverflowText>{account.name}</OverflowText></span><Tag size="small">{account.group}</Tag><Tag size="small" tone={account.session === "online" ? "success" : "neutral"}>{account.session === "online" ? "已登录" : "未登录"}</Tag>{!account.enabled && <Tag size="small" tone="warning">已停用</Tag>}</div>}
              description={<span className="demo-accounts-account-description"><span>{matchText(account.login, applied.query)}</span>{synced[account.id] && <span>{synced[account.id]} 已同步</span>}</span>}
              header={<div className="demo-accounts-account-actions">
                <Checkbox label={groupSelected && groupSelected !== visible.length ? `全选（${groupSelected}/${visible.length}）` : "全选"} aria-label={`全选${account.name}的角色`} checked={visible.length > 0 && groupSelected === visible.length} disabled={!ready || !visible.length} onChange={event => toggle(visible.map(role => role.id), event.target.checked)} />
                <Inline gap="small" wrap={false}>
                  <Tooltip content="编辑账号"><IconButton icon={<Pencil aria-hidden="true" />} aria-label={`编辑账号：${account.name}`} onClick={() => openEditor(account)} /></Tooltip>
                  {account.session === "online" ? <>
                    <Tooltip content="同步角色"><IconButton icon={<RefreshCw aria-hidden="true" />} loading={refreshing.has(account.id)} aria-label={`同步角色：${account.name}`} onClick={() => refresh(account)} /></Tooltip>
                    <Tooltip content="退出登录"><IconButton icon={<LogOut aria-hidden="true" />} disabled={refreshing.has(account.id)} aria-label={`退出登录：${account.name}`} onClick={() => signOut(account)} /></Tooltip>
                  </> : <Button variant="primary" size="small" icon={<LogIn aria-hidden="true" />} disabled={!account.enabled} aria-label={`登录账号：${account.name}`} onClick={() => setLoginId(account.id)}>登录</Button>}
                </Inline>
              </div>} padding="small">
              <Collapse bordered={false} title={hasFilters(applied) ? `匹配 ${visible.length} 位 / 共 ${account.roles.length} 位角色` : `角色 ${account.roles.length} 位`} headingLevel={3} open={expanded.has(account.id)} onOpenChange={open => setExpanded(previous => { const next = new Set(previous); open ? next.add(account.id) : next.delete(account.id); return next; })}>
                <div className="demo-accounts-account-grid">
                  {account.session !== "online" ? <p className="demo-accounts-account-empty">登录后加载角色资料。</p> : !ready ? <div className="demo-accounts-role-loading" role="status"><span>{loading.has(account.id) ? "正在加载角色资料…" : "准备加载角色资料…"}</span><Skeleton /><Skeleton /></div> : !visible.length ? <p className="demo-accounts-account-empty">暂无角色，可通过同步按钮重新获取。</p> :
                    <ScrollArea ariaLabel={`角色列表：${account.name}`} orientation="horizontal" maxWidth="100%">
                      <div className="demo-accounts-account-role-rail">
                      {visible.map(role => <div className={selected.has(role.id) ? "demo-accounts-role-tile demo-accounts-role-tile--selected" : "demo-accounts-role-tile"} key={role.id}><Card aria-label={`角色：${role.name}`} padding="small">
                        <div className="demo-accounts-role-topline"><Checkbox label="选择" aria-label={`选择角色：${role.name}`} checked={selected.has(role.id)} onChange={event => toggle([role.id], event.target.checked)} /><Tooltip content="角色详情"><IconButton icon={<Eye aria-hidden="true" />} aria-label={`查看${role.name}详情`} onClick={() => { setDetail(role); setDrawerOpen(true); }} /></Tooltip></div>
                        <div className="demo-accounts-role-content">
                          <div className={`demo-accounts-role-art demo-accounts-role-art--${role.race}`}><Media src={artRoot + role.art} alt={`${role.character}角色立绘`} aspectRatio="1 / 1.2" objectFit="contain" imageProps={{ loading: "lazy" }} /></div>
                          <div className="demo-accounts-role-copy"><h3 className="demo-accounts-role-name"><OverflowText>{role.name}</OverflowText></h3><div className="demo-accounts-role-identity"><strong>{role.level}<span>级</span></strong><span>{role.school}</span></div><p className="demo-accounts-role-server">{role.character} · {role.server}</p><p className="demo-accounts-role-id"><OverflowText>{role.id}</OverflowText></p></div>
                        </div>
                      </Card></div>)}
                      </div>
                    </ScrollArea>}
                </div>
              </Collapse>
            </Card></section>;
          })}
          {!groups.length && <EmptyState title="没有匹配账号" description="搜索覆盖全部账号和角色，试试其他关键词或重置筛选。" action={<Button onClick={reset}>重置筛选</Button>} />}
        </Stack>
        <div className="demo-accounts-account-pagination"><Pagination page={currentPage} pageCount={pageCount} total={filtered.length} pageSize={pageSize} pageSizeOptions={[10, 20]} disabled={querying || paging !== undefined} loadingPage={paging} onPageChange={changePage}
          onPageSizeChange={size => { queryVersion.current += 1; scrollAfterChange.current = true; setPaging(undefined); setPageSize(size); setPage(1); browsePage.current = 1; }}
          summary={`共 ${filtered.length} 个账号 · 第 ${currentPage} / ${pageCount} 页`} /></div>
        <p className="demo-accounts-preview-note">账号与角色均为模拟数据，页面刷新后重置；图片来自梦幻西游官网，未连接游戏或交易服务。</p>
      </ListManagementPage>
    </div>
    {selected.size > 0 && <div className="demo-accounts-selection-dock"><StickyHeaderActionBar position="bottom" heading={`已选择 ${selected.size} 个角色`} description={selected.size > selectedOnPage ? `含 ${selected.size - selectedOnPage} 个当前页外的角色` : "选择跨页保留，仅主动取消才清除"} actions={<Inline gap="small">
      <Button size="small" onClick={() => setSelectionOpen(true)}>查看已选</Button><Button size="small" onClick={() => setSelected(new Set())}>取消选择</Button><ClipboardButton size="small" label="复制所选" text={selectionText} />
    </Inline>} /></div>}
    <AccountEditor open={editorOpen} account={editingAccount} accounts={accounts} groups={groupNames} onOpenChange={setEditorOpen} onSave={saveAccount} />
    <ImportAccounts open={importOpen} accounts={accounts} onOpenChange={setImportOpen} onImport={importAccounts} />
    <GroupManager open={groupsOpen} groups={groupNames} accounts={accounts} onOpenChange={setGroupsOpen} onCreate={createGroup} onRename={renameGroup} onDelete={deleteGroup} />
    <SelectedRoles open={selectionOpen} accounts={accounts} selected={selected} onOpenChange={setSelectionOpen} onRemove={id => toggle([id], false)} busy={false} />
    <ConfirmDialog open={loginId !== null} onOpenChange={open => { if (!open) setLoginId(null); }} title="登录账号" description={`为 ${loginAccount?.name ?? "账号"} 模拟授权登录，成功后加载角色。本地演示不采集真实密码、不连接游戏服务。`} confirmLabel="模拟登录" onConfirm={signIn} errorMessage="登录未完成，请确认账号已启用后重试。" />
    <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} title="角色详情" description={detailAccount?.name} width="large" footer={<Inline justify="between"><Button onClick={() => setDrawerOpen(false)}>关闭</Button>{detail && <Checkbox label="选择此角色" checked={selected.has(detail.id)} onChange={event => toggle([detail.id], event.target.checked)} />}</Inline>}>
      {detail && <Stack gap="large">
        <div className="demo-accounts-detail-identity"><Avatar name={detail.character} src={artRoot + detail.avatar} size="xlarge" /><div><h2 className="demo-accounts-detail-name">{detail.name}</h2><p className="demo-accounts-detail-subtitle">{detail.level} 级 · {detail.school} · {detail.character}</p></div></div>
        <div className={`demo-accounts-role-art demo-accounts-role-art--${detail.race}`}><Media src={artRoot + detail.art} alt={`${detail.character}完整立绘`} aspectRatio="16 / 9" objectFit="contain" /></div>
        <DescriptionList columns={2} items={[
          { id: "account", term: "所属账号", description: detailAccount?.name }, { id: "login", term: "账号", description: detailAccount?.login },
          { id: "id", term: "角色 ID", description: detail.id }, { id: "server", term: "服务器", description: `${detail.region} · ${detail.server}` },
          { id: "race", term: "种族", description: { human: "人族", fairy: "仙族", demon: "魔族" }[detail.race] }, { id: "school", term: "门派", description: detail.school },
          { id: "level", term: "等级 / 修炼", description: `${detail.level} 级 / ${detail.training}` }, { id: "skill", term: "主要技能", description: detail.skill },
          { id: "pet", term: "常用召唤兽", description: detail.pet },
        ]} />
        <div className="demo-accounts-detail-note"><h3>角色备注</h3><p>{detail.notes}</p></div>
      </Stack>}
    </Drawer>
  </div>;
}
