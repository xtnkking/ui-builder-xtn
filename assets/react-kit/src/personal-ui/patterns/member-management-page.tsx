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
import { DataTable, type DataColumn, type DataSort, type DataTableState } from "../data/data-table";
import { Avatar, DescriptionList } from "../display/display";
import { SearchInput, Select } from "../input/forms";
import { usePersonalUILocale, type PersonalUILocaleContext } from "../foundation/locale";
import type { PaginationPageTrigger } from "../navigation/navigation";
import { Drawer, OverflowText } from "../overlay/overlays";
import { Button, IconButton, Tag, type TagTone } from "../foundation/primitives";

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
type UpdatedState = "initial" | "initial-complete" | "updated" | "retry";

const emptyFilters: MemberFilters = { search: "", role: "", status: "" };
const DEFAULT_PAGE_SIZE = 5;
const DEFAULT_ROLES = ["admin", "editor", "viewer"];
const DEFAULT_STATUSES = ["joined", "pending", "disabled"];

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

function roleLabel(role: string, message: PersonalUILocaleContext["message"]): string {
  if (role === "admin") return message("member.roleAdmin");
  if (role === "editor") return message("member.roleEditor");
  if (role === "viewer") return message("member.roleViewer");
  return role;
}

function statusLabel(status: string, message: PersonalUILocaleContext["message"]): string {
  if (status === "joined") return message("member.statusJoined");
  if (status === "pending") return message("member.statusPending");
  if (status === "disabled") return message("member.statusDisabled");
  if (status === "active") return message("member.statusNormal");
  if (status === "expiring") return message("member.statusExpiring");
  if (status === "expired") return message("member.statusExpired");
  return status;
}

function statusTone(status: string): TagTone {
  if (["joined", "active", "\u5df2\u52a0\u5165", "\u6b63\u5e38"].includes(status)) return "success";
  if (["pending", "expiring", "\u5f85\u786e\u8ba4", "\u5373\u5c06\u8fc7\u671f"].includes(status)) return "warning";
  if (["disabled", "expired", "\u5df2\u505c\u7528", "\u5df2\u8fc7\u671f"].includes(status)) return "danger";
  return "neutral";
}

function formatMemberDate(value: string, formatDate: PersonalUILocaleContext["formatDate"]): string {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (
      parsed.getUTCFullYear() === Number(year)
      && parsed.getUTCMonth() === Number(month) - 1
      && parsed.getUTCDate() === Number(day)
    ) {
      return formatDate(parsed, { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "UTC" });
    }
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : formatDate(parsed, { year: "numeric", month: "short", day: "numeric" });
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

export function MemberManagementPage({
  fetchMembers,
  title,
  roles = DEFAULT_ROLES,
  statuses = DEFAULT_STATUSES,
  initialPageSize = DEFAULT_PAGE_SIZE,
  pageSizeOptions = [5, 10, 20, 50],
  onInvite,
  onOpenMember,
  onEditMember,
}: MemberManagementPageProps) {
  const { formatDate, message, plural } = usePersonalUILocale();
  const resolvedTitle = title ?? message("member.title");
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
  const [updatedState, setUpdatedState] = useState<UpdatedState>("initial");
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
      setUpdatedState(action === "initial" ? "initial-complete" : "updated");
    } catch (error) {
      if (controller.signal.aborted || version !== requestVersion.current) return;
      setFailedQuery(requestQuery);
      setTableState("error");
      setUpdatedState("retry");
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
    { value: "", label: message("member.allRoles") },
    ...uniqueFilterValues(roles).map((role) => ({ value: role, label: roleLabel(role, message) })),
  ], [message, roles]);
  const statusOptions = useMemo(() => [
    { value: "", label: message("member.allStatuses") },
    ...uniqueFilterValues(statuses).map((status) => ({ value: status, label: statusLabel(status, message) })),
  ], [message, statuses]);
  const sort: DataSort = { columnId: queryMeta.sortBy, direction: queryMeta.sortDirection };

  const openMember = (member: MemberRecord) => {
    if (onOpenMember) onOpenMember(member);
    else setSelectedMember(member);
  };

  const columns = useMemo<DataColumn<MemberRecord>[]>(() => [
    {
      id: "name",
      header: message("member.columnMember"),
      minWidth: 224,
      sortable: true,
      pin: "start",
      cell: (member) => (
        <div className="pui-member-cell">
          <Avatar name={member.name} decorative />
          <span>
            <strong>{member.name}</strong>
            <OverflowText>{member.email}</OverflowText>
          </span>
        </div>
      ),
    },
    { id: "team", header: message("member.columnTeam"), minWidth: 108, cell: (member) => member.team },
    { id: "role", header: message("member.columnRole"), width: 132, cell: (member) => roleLabel(member.role, message) },
    {
      id: "status",
      header: message("member.columnStatus"),
      width: 132,
      cell: (member) => <Tag tone={statusTone(member.status)}>{statusLabel(member.status, message)}</Tag>,
    },
    { id: "joinedAt", header: message("member.columnJoined"), width: 160, sortable: true, cell: (member) => formatMemberDate(member.joinedAt, formatDate) },
    {
      id: "actions",
      header: <span className="pui-sr-only">{message("member.rowActions")}</span>,
      width: 72,
      pin: "end",
      align: "center",
      cell: (member) => (
        <IconButton
          aria-label={message("member.moreActions", { name: member.name })}
          icon={<Ellipsis aria-hidden="true" />}
          disabled={requesting}
          onClick={() => openMember(member)}
        />
      ),
    },
  ], [formatDate, message, onOpenMember, requesting]);

  const appliedTags = [
    applied.search ? message("member.appliedSearch", { value: applied.search }) : "",
    applied.role ? message("member.appliedRole", { value: roleLabel(applied.role, message) }) : "",
    applied.status ? message("member.appliedStatus", { value: statusLabel(applied.status, message) }) : "",
  ].filter(Boolean);

  const updatedLabel = updatedState === "initial"
    ? message("member.firstLoad")
    : updatedState === "initial-complete"
      ? message("member.firstLoadComplete")
      : updatedState === "updated"
        ? message("member.updatedNow")
        : message("member.waitingRetry");

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
          <h1 id={titleId} title={resolvedTitle}>{resolvedTitle}</h1>
          <span>{tableState === "loading" && requestAction === "initial"
            ? message("member.loading")
            : plural("member.count", result.total)}</span>
        </div>
        {onInvite ? (
          <Button variant="primary" icon={<UserPlus aria-hidden="true" />} onClick={onInvite}>{message("member.invite")}</Button>
        ) : null}
      </header>

      <form className="pui-query-toolbar" onSubmit={handleFormSubmit}>
        <SearchInput
          aria-label={message("member.search")}
          placeholder={message("member.search")}
          value={draft.search}
          readOnly={requesting}
          aria-disabled={requesting || undefined}
          onChange={(event) => setDraft((current) => ({ ...current, search: event.target.value }))}
          onClear={() => setDraft((current) => ({ ...current, search: "" }))}
        />
        <Select
          ariaLabel={message("member.filterRole")}
          value={draft.role}
          aria-disabled={requesting || undefined}
          options={roleOptions}
          onValueChange={(role) => setDraft((current) => ({ ...current, role }))}
        />
        <Select
          ariaLabel={message("member.filterStatus")}
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
            {message("member.reset")}
          </Button>
          <Button
            size="field"
            type="submit"
            variant="primary"
            icon={<Search aria-hidden="true" />}
            loading={requesting && requestAction === "query"}
            loadingLabel={message("member.querying")}
            aria-disabled={requesting || undefined}
            data-pending={pending || undefined}
          >
            {message("member.query")}
          </Button>
        </div>
      </form>

      <div className="pui-query-state" aria-live="polite">
        <span className={pending ? "is-pending" : undefined}>
          {pending ? message("member.filtersPending") : message("member.filtersApplied")}
        </span>
        {appliedTags.length ? (
          <div className="pui-applied-tags"><span>{message("member.applied")}</span>{appliedTags.map((tag) => <Tag key={tag} tone="blue">{tag}</Tag>)}</div>
        ) : null}
      </div>

      <div className="pui-result-summary" aria-live="polite">
        <span>{tableState === "loading"
          ? message("member.loadingData")
          : tableState === "error"
            ? result.items.length ? message("member.queryFailedCached") : message("member.queryFailedEmpty")
            : plural("member.dataRows", result.total)}</span>
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
        ariaLabel={message("member.dataLabel")}
        errorTitle={message("member.queryFailedTitle")}
        errorDescription={result.items.length ? message("member.errorCached") : message("member.errorEmpty")}
        retrying={requesting && requestAction === "retry"}
        onRetry={failedQuery ? () => {
          if (!requestingRef.current) void execute(failedQuery, "retry");
        } : undefined}
        emptyTitle={message("member.emptyTitle")}
        emptyDescription={message("member.emptyDescription")}
        emptyAction={(
          <Button
            variant="primary"
            loading={requesting && requestAction === "empty-reset"}
            loadingLabel={message("member.querying")}
            aria-disabled={requesting || undefined}
            onClick={() => {
              if (requestingRef.current) return;
              setDraft(emptyFilters);
              void execute({ ...emptyFilters, ...queryMeta, page: 1 }, "empty-reset");
            }}
          >
            {message("member.showAll")}
          </Button>
        )}
        onSort={(nextSort) => {
          if (requestingRef.current || tableState !== "ready") return;
          void execute({ ...currentQuery(), page: 1, sortBy: nextSort.columnId as MemberQuery["sortBy"], sortDirection: nextSort.direction }, "sort");
        }}
        mobileRow={(member) => (
          <div className="pui-member-mobile-row">
            <Avatar name={member.name} decorative />
            <span className="pui-member-mobile-row__copy">
              <strong>{member.name}</strong>
              <OverflowText>{member.email}</OverflowText>
              <span>{roleLabel(member.role, message)} · {statusLabel(member.status, message)}</span>
            </span>
            <IconButton aria-label={message("member.moreActions", { name: member.name })} icon={<Ellipsis aria-hidden="true" />} aria-disabled={requesting || undefined} onClick={() => openMember(member)} />
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
        onOpenChange={(nextOpen) => { if (!nextOpen) setSelectedMember(null); }}
        title={selectedMember?.name ?? message("member.details")}
        description={selectedMember?.email}
        footer={(
          <>
            <Button onClick={() => setSelectedMember(null)}>{message("common.close")}</Button>
            {selectedMember && onEditMember ? (
              <Button variant="primary" onClick={() => onEditMember(selectedMember)}>{message("member.edit")}</Button>
            ) : null}
          </>
        )}
      >
        {selectedMember ? (
          <DescriptionList
            items={[
              { id: "team", term: message("member.columnTeam"), description: selectedMember.team },
              { id: "role", term: message("member.columnRole"), description: roleLabel(selectedMember.role, message) },
              { id: "status", term: message("member.columnStatus"), description: <Tag tone={statusTone(selectedMember.status)}>{statusLabel(selectedMember.status, message)}</Tag> },
              { id: "joinedAt", term: message("member.columnJoined"), description: formatMemberDate(selectedMember.joinedAt, formatDate) },
            ]}
          />
        ) : null}
      </Drawer>
    </section>
  );
}
