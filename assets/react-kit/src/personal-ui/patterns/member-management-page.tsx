import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Ellipsis, Search, UserPlus } from "lucide-react";
import { DataTable, type DataColumn, type DataSort, type DataTableState } from "../data-table";
import { DescriptionList } from "../display";
import { Field, SearchInput, Select } from "../forms";
import type { PaginationPageTrigger } from "../navigation";
import { Drawer, OverflowText } from "../overlays";
import { Button, IconButton, Tag, type TagTone } from "../primitives";

export interface MemberRecord {
  id: string;
  name: string;
  email: string;
  team: string;
  role: string;
  status: string;
  joinedAt: string;
}

export interface MemberFilters {
  search: string;
  role: string;
  status: string;
}

export interface MemberQuery extends MemberFilters {
  page: number;
  pageSize: number;
  sortBy: "name" | "joinedAt";
  sortDirection: "ascending" | "descending";
}

export interface MemberResult {
  items: MemberRecord[];
  total: number;
}

export interface MemberManagementPageProps {
  fetchMembers: (query: MemberQuery, signal: AbortSignal) => Promise<MemberResult>;
  title?: string;
  roles?: string[];
  statuses?: string[];
  initialPageSize?: number;
  pageSizeOptions?: number[];
  onInvite?: () => void;
  onOpenMember?: (member: MemberRecord) => void;
  onEditMember?: (member: MemberRecord) => void;
}

type RequestAction = "initial" | "query" | "empty-reset" | "retry" | "page" | "sort" | "page-size";

const emptyFilters: MemberFilters = { search: "", role: "", status: "" };
const DEFAULT_PAGE_SIZE = 5;

function finiteInteger(value: unknown, fallback: number, minimum: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(Number.MAX_SAFE_INTEGER, Math.max(minimum, Math.trunc(value)));
}

function normalizeMemberQuery(query: MemberQuery): MemberQuery {
  const pageSize = finiteInteger(query.pageSize, DEFAULT_PAGE_SIZE, 1);
  const maximumSafePage = Math.floor((Number.MAX_SAFE_INTEGER - 1) / pageSize) + 1;
  return {
    ...query,
    page: Math.min(finiteInteger(query.page, 1, 1), maximumSafePage),
    pageSize,
  };
}

function normalizeMemberResult(value: unknown, query: MemberQuery): MemberResult {
  if (!value || typeof value !== "object") {
    throw new TypeError("Member result must be an object.");
  }
  const candidate = value as { items?: unknown; total?: unknown };
  if (!Array.isArray(candidate.items)) {
    throw new TypeError("Member result items must be an array.");
  }
  if (
    typeof candidate.total !== "number"
    || !Number.isSafeInteger(candidate.total)
    || candidate.total < 0
  ) {
    throw new TypeError("Member result total must be a non-negative safe integer.");
  }

  const memberFields = ["id", "name", "email", "team", "role", "status", "joinedAt"] as const;
  const seenIds = new Set<string>();
  const validatedItems = candidate.items.map((item, index): MemberRecord => {
    if (!item || typeof item !== "object") {
      throw new TypeError(`Member result item ${index} must be an object.`);
    }
    const record = item as Record<string, unknown>;
    for (const field of memberFields) {
      if (typeof record[field] !== "string") {
        throw new TypeError(`Member result item ${index}.${field} must be a string.`);
      }
    }
    const id = (record.id as string).trim();
    if (!id) throw new TypeError(`Member result item ${index}.id must not be blank.`);
    if (seenIds.has(id)) throw new TypeError(`Member result contains duplicate id "${id}".`);
    seenIds.add(id);
    return {
      id,
      name: record.name as string,
      email: record.email as string,
      team: record.team as string,
      role: record.role as string,
      status: record.status as string,
      joinedAt: record.joinedAt as string,
    };
  });
  if (validatedItems.length > query.pageSize) {
    throw new RangeError("Member result returned more items than the requested page size.");
  }
  const items = validatedItems;
  const reportedTotal = candidate.total;
  const offset = (query.page - 1) * query.pageSize;
  if (items.length && (offset >= reportedTotal || items.length > reportedTotal - offset)) {
    throw new RangeError("Member result items exceed the reported total for the requested page.");
  }
  return { items, total: reportedTotal };
}

function sameFilters(left: MemberFilters, right: MemberFilters): boolean {
  return left.search === right.search && left.role === right.role && left.status === right.status;
}

function statusTone(status: string): TagTone {
  if (status === "已加入" || status === "正常") return "success";
  if (status === "待确认" || status === "即将过期") return "warning";
  if (status === "已停用" || status === "已过期") return "danger";
  return "neutral";
}

function uniqueFilterValues(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  return values.reduce<string[]>((result, value) => {
    if (typeof value !== "string") return result;
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) return result;
    seen.add(normalized);
    result.push(normalized);
    return result;
  }, []);
}

function memberInitial(name: string): string {
  return Array.from(name.trim())[0] ?? "?";
}

export function MemberManagementPage({
  fetchMembers,
  title = "成员",
  roles = ["管理员", "编辑者", "查看者"],
  statuses = ["已加入", "待确认", "已停用"],
  initialPageSize = DEFAULT_PAGE_SIZE,
  pageSizeOptions = [5, 10, 20, 50],
  onInvite,
  onOpenMember,
  onEditMember,
}: MemberManagementPageProps) {
  const titleId = useId();
  const initialPageSizeRef = useRef(finiteInteger(initialPageSize, DEFAULT_PAGE_SIZE, 1));
  const stableInitialPageSize = initialPageSizeRef.current;
  const [draft, setDraft] = useState<MemberFilters>(emptyFilters);
  const [applied, setApplied] = useState<MemberFilters>(emptyFilters);
  const [queryMeta, setQueryMeta] = useState<Pick<MemberQuery, "page" | "pageSize" | "sortBy" | "sortDirection">>({
    page: 1,
    pageSize: stableInitialPageSize,
    sortBy: "joinedAt",
    sortDirection: "descending",
  });
  const [result, setResult] = useState<MemberResult>({ items: [], total: 0 });
  const [tableState, setTableState] = useState<DataTableState>("loading");
  const [requesting, setRequesting] = useState(true);
  const [requestAction, setRequestAction] = useState<RequestAction>("initial");
  const [failedQuery, setFailedQuery] = useState<MemberQuery | null>(null);
  const [updatedLabel, setUpdatedLabel] = useState("首次加载");
  const [selectedMember, setSelectedMember] = useState<MemberRecord | null>(null);
  const [loadingPage, setLoadingPage] = useState<number | undefined>();
  const [loadingPageTarget, setLoadingPageTarget] = useState<PaginationPageTrigger | undefined>();
  const [loadingSortColumnId, setLoadingSortColumnId] = useState<string | undefined>();
  const [loadingRowCount, setLoadingRowCount] = useState(stableInitialPageSize);
  const fetchRef = useRef(fetchMembers);
  const resultRef = useRef(result);
  const requestVersion = useRef(0);
  const requestController = useRef<AbortController | null>(null);
  const requestingRef = useRef(true);
  const initialQuery = useRef<MemberQuery>({
    ...emptyFilters,
    page: 1,
    pageSize: stableInitialPageSize,
    sortBy: "joinedAt",
    sortDirection: "descending",
  });

  useEffect(() => {
    fetchRef.current = fetchMembers;
  }, [fetchMembers]);

  useEffect(() => {
    resultRef.current = result;
  }, [result]);

  const execute = useCallback(async (query: MemberQuery, action: RequestAction) => {
    let requestQuery = normalizeMemberQuery(query);
    const version = ++requestVersion.current;
    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;
    requestingRef.current = true;
    setRequesting(true);
    setRequestAction(action);
    setLoadingPage(action === "page" ? requestQuery.page : undefined);
    if (action !== "page") setLoadingPageTarget(undefined);
    setLoadingSortColumnId(action === "sort" ? requestQuery.sortBy : undefined);
    const remainingRows = resultRef.current.total - ((requestQuery.page - 1) * requestQuery.pageSize);
    const canPredictRowCount = action !== "initial" && action !== "query";
    setLoadingRowCount(canPredictRowCount && remainingRows > 0
      ? Math.min(requestQuery.pageSize, remainingRows)
      : requestQuery.pageSize);
    if (action !== "retry" && action !== "empty-reset") setTableState("loading");
    try {
      let nextResult = normalizeMemberResult(
        await fetchRef.current(requestQuery, controller.signal),
        requestQuery,
      );
      if (controller.signal.aborted || version !== requestVersion.current) return;
      if (nextResult.total > 0 && nextResult.items.length === 0) {
        const lastPage = Math.max(1, Math.ceil(nextResult.total / requestQuery.pageSize));
        if (requestQuery.page <= lastPage) {
          throw new Error("Member result reported rows but returned an empty in-range page.");
        }
        requestQuery = { ...requestQuery, page: lastPage };
        const correctedRemainingRows = nextResult.total - ((lastPage - 1) * requestQuery.pageSize);
        setLoadingRowCount(Math.max(1, Math.min(requestQuery.pageSize, correctedRemainingRows)));
        nextResult = normalizeMemberResult(
          await fetchRef.current(requestQuery, controller.signal),
          requestQuery,
        );
        if (controller.signal.aborted || version !== requestVersion.current) return;
        if (nextResult.total > 0 && nextResult.items.length === 0) {
          throw new Error("Member result returned an empty page after page correction.");
        }
      }
      if (nextResult.total === 0 && requestQuery.page !== 1) {
        requestQuery = { ...requestQuery, page: 1 };
      }
      resultRef.current = nextResult;
      setResult(nextResult);
      setApplied({ search: requestQuery.search, role: requestQuery.role, status: requestQuery.status });
      setQueryMeta({
        page: requestQuery.page,
        pageSize: requestQuery.pageSize,
        sortBy: requestQuery.sortBy,
        sortDirection: requestQuery.sortDirection,
      });
      setFailedQuery(null);
      setTableState(nextResult.total === 0 && nextResult.items.length === 0 ? "empty" : "ready");
      setUpdatedLabel(action === "initial" ? "首次加载完成" : "刚刚更新");
    } catch (error) {
      if (controller.signal.aborted || version !== requestVersion.current) return;
      setFailedQuery(requestQuery);
      setTableState("error");
      setUpdatedLabel("等待重试");
    } finally {
      if (version === requestVersion.current) {
        requestingRef.current = false;
        setRequesting(false);
        setLoadingPage(undefined);
        setLoadingPageTarget(undefined);
        setLoadingSortColumnId(undefined);
        requestController.current = null;
      }
    }
  }, []);

  useEffect(() => {
    void execute(initialQuery.current, "initial");
    return () => {
      requestVersion.current += 1;
      requestController.current?.abort();
    };
  }, [execute]);

  const currentQuery = useCallback((filters: MemberFilters = applied): MemberQuery => ({ ...filters, ...queryMeta }), [applied, queryMeta]);
  const submitDraft = () => {
    if (requestingRef.current) return;
    void execute({ ...draft, ...queryMeta, page: 1 }, "query");
  };
  const pending = !sameFilters(draft, applied);
  const paginationOwnsBusyState = requestAction === "page" || requestAction === "page-size";
  const paginationDisabled = tableState === "error" || (requesting && !paginationOwnsBusyState);
  const pageCount = Math.max(1, Math.ceil(result.total / queryMeta.pageSize));
  const availablePageSizes = useMemo(
    () => Array.from(new Set([
      queryMeta.pageSize,
      ...(Array.isArray(pageSizeOptions) ? pageSizeOptions : [])
        .filter((pageSize) => Number.isFinite(pageSize) && pageSize > 0)
        .map((pageSize) => finiteInteger(pageSize, DEFAULT_PAGE_SIZE, 1)),
    ])).sort((left, right) => left - right),
    [pageSizeOptions, queryMeta.pageSize],
  );
  const roleOptions = useMemo(() => [
    { value: "", label: "全部角色" },
    ...uniqueFilterValues(roles).map((role) => ({ value: role, label: role })),
  ], [roles]);
  const statusOptions = useMemo(() => [
    { value: "", label: "全部状态" },
    ...uniqueFilterValues(statuses).map((status) => ({ value: status, label: status })),
  ], [statuses]);
  const sort: DataSort = { columnId: queryMeta.sortBy, direction: queryMeta.sortDirection };

  const openMember = (member: MemberRecord) => {
    if (onOpenMember) onOpenMember(member);
    else setSelectedMember(member);
  };

  const columns = useMemo<DataColumn<MemberRecord>[]>(() => [
    {
      id: "name",
      header: "成员",
      minWidth: 224,
      sortable: true,
      pin: "start",
      cell: (member) => (
        <div className="pui-member-cell">
          <span className="pui-avatar" aria-hidden="true">{memberInitial(member.name)}</span>
          <span>
            <strong>{member.name}</strong>
            <OverflowText>{member.email}</OverflowText>
          </span>
        </div>
      ),
    },
    { id: "team", header: "团队", minWidth: 108, cell: (member) => member.team },
    { id: "role", header: "角色", width: 132, cell: (member) => member.role },
    {
      id: "status",
      header: "状态",
      width: 132,
      cell: (member) => <Tag tone={statusTone(member.status)}>{member.status}</Tag>,
    },
    { id: "joinedAt", header: "加入时间", width: 160, sortable: true, cell: (member) => member.joinedAt },
    {
      id: "actions",
      header: <span className="pui-sr-only">行操作</span>,
      width: 72,
      pin: "end",
      align: "center",
      cell: (member) => (
        <IconButton
          aria-label={`${member.name}的更多操作`}
          icon={<Ellipsis aria-hidden="true" />}
          disabled={requesting}
          onClick={() => openMember(member)}
        />
      ),
    },
  ], [onOpenMember, requesting]);

  const appliedTags = [
    applied.search ? `搜索：${applied.search}` : "",
    applied.role ? `角色：${applied.role}` : "",
    applied.status ? `状态：${applied.status}` : "",
  ].filter(Boolean);

  const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitDraft();
  };

  return (
    <section
      className="pui-data-page pui-root"
      aria-labelledby={titleId}
      aria-busy={requesting || undefined}
      data-request-action={requesting ? requestAction : undefined}
      data-pui-owner="MemberManagementPage"
    >
      <header className="pui-page-header">
        <div>
          <h1 id={titleId} title={title}>{title}</h1>
          <span>{tableState === "loading" && requestAction === "initial" ? "正在加载" : `${result.total} 位成员`}</span>
        </div>
        {onInvite ? (
          <Button variant="primary" icon={<UserPlus aria-hidden="true" />} onClick={onInvite}>邀请成员</Button>
        ) : null}
      </header>

      <form className="pui-query-toolbar" onSubmit={handleFormSubmit}>
        <SearchInput
          aria-label="搜索姓名或邮箱"
          placeholder="搜索姓名或邮箱"
          value={draft.search}
          readOnly={requesting}
          aria-disabled={requesting || undefined}
          onChange={(event) => setDraft((current) => ({ ...current, search: event.target.value }))}
          onClear={() => setDraft((current) => ({ ...current, search: "" }))}
        />
        <Select
          ariaLabel="按角色筛选"
          value={draft.role}
          aria-disabled={requesting || undefined}
          options={roleOptions}
          onValueChange={(role) => setDraft((current) => ({ ...current, role }))}
        />
        <Select
          ariaLabel="按状态筛选"
          value={draft.status}
          aria-disabled={requesting || undefined}
          options={statusOptions}
          onValueChange={(status) => setDraft((current) => ({ ...current, status }))}
        />
        <div className="pui-query-toolbar__actions">
          <Button
            size="field"
            disabled={sameFilters(draft, emptyFilters)}
            aria-disabled={requesting || undefined}
            onClick={() => setDraft(emptyFilters)}
          >
            重置
          </Button>
          <Button
            size="field"
            type="submit"
            variant="primary"
            icon={<Search aria-hidden="true" />}
            loading={requesting && requestAction === "query"}
            loadingLabel="查询中"
            aria-disabled={requesting || undefined}
            data-pending={pending || undefined}
          >
            查询
          </Button>
        </div>
      </form>

      <div className="pui-query-state" aria-live="polite">
        <span className={pending ? "is-pending" : undefined}>
          {pending ? "条件已修改，点击查询后更新数据" : "当前条件已应用"}
        </span>
        {appliedTags.length ? (
          <div className="pui-applied-tags"><span>已应用</span>{appliedTags.map((tag) => <Tag key={tag} tone="blue">{tag}</Tag>)}</div>
        ) : null}
      </div>

      <div className="pui-result-summary" aria-live="polite">
        <span>{tableState === "loading"
          ? "正在加载成员数据"
          : tableState === "error"
            ? result.items.length ? "查询失败，仍显示上一次结果" : "查询失败，暂无可显示结果"
            : `已加载，共 ${result.total} 条成员数据`}</span>
        <span>{updatedLabel}</span>
      </div>

      <DataTable
        columns={columns}
        rows={result.items}
        rowKey={(member) => member.id}
        state={tableState}
        sort={sort}
        loadingRows={loadingRowCount}
        loadingSortColumnId={loadingSortColumnId}
        ariaLabel="成员数据"
        errorTitle="查询失败"
        errorDescription={result.items.length ? "仍显示上一次查询结果，筛选条件没有丢失。" : "服务器暂时无法响应，请稍后重试。"}
        retrying={requesting && requestAction === "retry"}
        onRetry={failedQuery ? () => {
          if (!requestingRef.current) void execute(failedQuery, "retry");
        } : undefined}
        emptyTitle="没有匹配成员"
        emptyDescription="没有找到符合当前条件的成员。"
        emptyAction={(
          <Button
            variant="primary"
            loading={requesting && requestAction === "empty-reset"}
            loadingLabel="查询中"
            aria-disabled={requesting || undefined}
            onClick={() => {
              if (requestingRef.current) return;
              setDraft(emptyFilters);
              void execute({ ...emptyFilters, ...queryMeta, page: 1 }, "empty-reset");
            }}
          >
            查看全部成员
          </Button>
        )}
        onSort={(nextSort) => {
          if (requestingRef.current || tableState !== "ready") return;
          void execute({ ...currentQuery(), page: 1, sortBy: nextSort.columnId as MemberQuery["sortBy"], sortDirection: nextSort.direction }, "sort");
        }}
        mobileRow={(member) => (
          <div className="pui-member-mobile-row">
            <span className="pui-avatar" aria-hidden="true">{memberInitial(member.name)}</span>
            <span className="pui-member-mobile-row__copy">
              <strong>{member.name}</strong>
              <OverflowText>{member.email}</OverflowText>
              <span>{member.role} · {member.status}</span>
            </span>
            <IconButton aria-label={`${member.name}的更多操作`} icon={<Ellipsis aria-hidden="true" />} aria-disabled={requesting || undefined} onClick={() => openMember(member)} />
          </div>
        )}
        pagination={{
          page: queryMeta.page,
          pageCount,
          total: result.total,
          pageSize: queryMeta.pageSize,
          pageSizeOptions: availablePageSizes,
          disabled: paginationDisabled,
          loadingPage,
          loadingTarget: loadingPageTarget,
          loadingPageSize: requesting && requestAction === "page-size",
          onPageChange: (page, trigger) => {
            if (requestingRef.current || tableState === "loading" || page === queryMeta.page) return;
            setLoadingPageTarget(trigger);
            void execute({ ...currentQuery(), page }, "page");
          },
          onPageSizeChange: (pageSize) => {
            if (requestingRef.current || tableState === "loading" || pageSize === queryMeta.pageSize) return;
            void execute({ ...currentQuery(), page: 1, pageSize }, "page-size");
          },
        }}
      />

      <Drawer
        open={Boolean(selectedMember)}
        onClose={() => setSelectedMember(null)}
        title={selectedMember?.name ?? "成员详情"}
        description={selectedMember?.email}
        footer={(
          <>
            <Button onClick={() => setSelectedMember(null)}>关闭</Button>
            {selectedMember && onEditMember ? (
              <Button variant="primary" onClick={() => onEditMember(selectedMember)}>编辑成员</Button>
            ) : null}
          </>
        )}
      >
        {selectedMember ? (
          <DescriptionList
            items={[
              { id: "team", term: "团队", description: selectedMember.team },
              { id: "role", term: "角色", description: selectedMember.role },
              { id: "status", term: "状态", description: <Tag tone={statusTone(selectedMember.status)}>{selectedMember.status}</Tag> },
              { id: "joinedAt", term: "加入时间", description: selectedMember.joinedAt },
            ]}
          />
        ) : null}
      </Drawer>
    </section>
  );
}
