import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, LoaderCircle, RotateCw, SearchX } from "lucide-react";
import type { PublicControlProps } from "../foundation/contracts";
import { EmptyState, useToast } from "../feedback/feedback";
import { InternalToastBoundary } from "../internal/toast-boundary";
import { sanitizeFixedControlProps } from "../internal/fixed-control-props";
import { useUILocale } from "../foundation/locale";
import { Pagination, type PaginationProps } from "../navigation/navigation";
import { Button } from "../foundation/primitives";
import { assertUniqueIdentities, cx } from "../internal/utils";
import { TableCellText } from "./table-cell-text";

export type DataTableState = "loading" | "ready" | "empty" | "error";
export type SortDirection = "ascending" | "descending";

export interface DataSort {
  columnId: string;
  direction: SortDirection;
}

export interface DataColumn<T> {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** Marks a checkbox selection column. When it is the first visible column, the first two visible columns pin to the start by default. */
  kind?: "selection";
  width?: number;
  minWidth?: number;
  sortable?: boolean;
  /** Explicit pinning wins over selection defaults. Use false to opt a column out of automatic pinning. */
  pin?: "start" | "end" | false;
  hidden?: boolean;
  align?: "start" | "center" | "end";
}

export type DataTableProps<T> = PublicControlProps<Omit<HTMLAttributes<HTMLDivElement>, "children">> & {
  columns: DataColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  state?: DataTableState;
  sort?: DataSort;
  onSort?: (sort: DataSort) => void;
  loadingSortColumnId?: string;
  loadingRows?: number;
  /** Fixed viewport size in standard row-height units. Paginated tables default to five units; use "auto" for content height. Fixed viewports are keyboard-scrollable and reset vertically for new results. */
  viewportRows?: number | "auto";
  ariaLabel: string;
  emptyTitle?: ReactNode;
  emptyDescription?: ReactNode;
  emptyAction?: ReactNode;
  errorTitle?: ReactNode;
  errorDescription?: ReactNode;
  onRetry?: () => void;
  retrying?: boolean;
  mobileRow?: (row: T) => ReactNode;
  pagination?: Omit<PaginationProps, "className">;
};

interface ColumnMetrics<T> {
  column: DataColumn<T>;
  style: CSSProperties;
  colStyle: CSSProperties;
  pinnedClass?: string;
}

interface ColumnLayout<T> {
  metrics: ColumnMetrics<T>[];
  minimumTableWidth: number;
  tableWidth: number;
}

const DEFAULT_COLUMN_WIDTH = 160;
const MAX_COLUMN_WIDTH = 10_000;
const MAX_LOADING_ROWS = 100;
const DEFAULT_VIEWPORT_ROWS = 5;
const TABLE_HEADER_HEIGHT = 42;
const TABLE_ROW_HEIGHT = 58;
const MOBILE_ROW_HEIGHT = 76;
const useClientLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

function normalizedColumnWidth(value: number | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return undefined;
  return Math.min(value, MAX_COLUMN_WIDTH);
}

function preferredColumnWidth<T>(column: DataColumn<T>): number {
  return normalizedColumnWidth(column.width)
    ?? normalizedColumnWidth(column.minWidth)
    ?? DEFAULT_COLUMN_WIDTH;
}

function normalizedViewportRows(value: DataTableProps<unknown>["viewportRows"], paginated: boolean): number | undefined {
  if (value === "auto") return undefined;
  if (value === undefined) return paginated ? DEFAULT_VIEWPORT_ROWS : undefined;
  if (!Number.isFinite(value)) return paginated ? DEFAULT_VIEWPORT_ROWS : undefined;
  return Math.min(MAX_LOADING_ROWS, Math.max(1, Math.trunc(value)));
}

function columnLayout<T>(columns: DataColumn<T>[], availableWidth: number): ColumnLayout<T> {
  const visibleColumns = columns.filter((column) => !column.hidden);
  const autoPinSelectionPair = visibleColumns[0]?.kind === "selection"
    && visibleColumns[0].pin !== false
    && visibleColumns[0].pin !== "end";
  const resolvedColumns = visibleColumns.map((column, index) => ({
    column,
    pin: column.pin === false
      ? undefined
      : column.pin ?? (autoPinSelectionPair && index < 2 ? "start" : undefined),
  }));
  const visible = [
    ...resolvedColumns.filter(({ pin }) => pin === "start"),
    ...resolvedColumns.filter(({ pin }) => !pin),
    ...resolvedColumns.filter(({ pin }) => pin === "end"),
  ];
  const widths = visible.map(({ column }) => preferredColumnWidth(column));
  const flexibleIndexes = visible.flatMap(({ column }, index) => (
    normalizedColumnWidth(column.width) === undefined ? [index] : []
  ));
  const minimumTableWidth = widths.reduce((total, width) => total + width, 0);
  const tableWidth = flexibleIndexes.length
    ? Math.max(minimumTableWidth, availableWidth)
    : minimumTableWidth;
  const extraWidth = flexibleIndexes.length ? (tableWidth - minimumTableWidth) / flexibleIndexes.length : 0;
  flexibleIndexes.forEach((index) => {
    widths[index] += extraWidth;
  });

  const pinnedStartWidth = visible.reduce((total, { pin }, index) => (
    pin === "start" ? total + widths[index] : total
  ), 0);
  const pinnedEndWidth = visible.reduce((total, { pin }, index) => (
    pin === "end" ? total + widths[index] : total
  ), 0);
  const pinningFits = availableWidth <= 0 || pinnedStartWidth + pinnedEndWidth < availableWidth;
  const starts = new Map<string, number>();
  const ends = new Map<string, number>();
  let startOffset = 0;
  visible.forEach(({ column, pin }, index) => {
    if (!pinningFits || pin !== "start") return;
    starts.set(column.id, startOffset);
    startOffset += widths[index];
  });
  let endOffset = 0;
  visible.slice().reverse().forEach(({ column, pin }, reverseIndex) => {
    if (!pinningFits || pin !== "end") return;
    const index = visible.length - reverseIndex - 1;
    ends.set(column.id, endOffset);
    endOffset += widths[index];
  });
  const metrics = visible.map(({ column, pin }, index) => {
    const width = widths[index];
    const appliedPin = pinningFits ? pin : undefined;
    const style: CSSProperties = {
      left: starts.get(column.id),
      right: ends.get(column.id),
      width,
      minWidth: width,
      maxWidth: width,
    };
    return {
      column,
      style,
      colStyle: { width },
      pinnedClass: appliedPin ? `ui-data-table__cell--pin-${appliedPin}` : undefined,
    };
  });
  return { metrics, minimumTableWidth, tableWidth };
}

function SortIcon({ active, direction }: { active: boolean; direction?: SortDirection }) {
  if (!active) return <ArrowUpDown aria-hidden="true" />;
  return direction === "ascending" ? <ArrowUp aria-hidden="true" /> : <ArrowDown aria-hidden="true" />;
}

function isTextContent(content: ReactNode): content is string | number {
  return typeof content === "string" || typeof content === "number";
}

export function DataTable<T>(rawProps: DataTableProps<T>) {
  return <InternalToastBoundary><DataTableContent rawProps={rawProps} /></InternalToastBoundary>;
}

function DataTableContent<T>({ rawProps }: { rawProps: DataTableProps<T> }) {
  const { message } = useUILocale();
  const { toast, dismiss } = useToast();
  const safeProps = sanitizeFixedControlProps(rawProps, ["children"]);
  const {
    columns,
    rows,
    rowKey,
    state = "ready",
    sort,
    onSort,
    loadingSortColumnId,
    loadingRows,
    viewportRows,
    ariaLabel,
    emptyTitle = message("table.emptyTitle"),
    emptyDescription = message("table.emptyDescription"),
    emptyAction,
    errorTitle = message("table.errorTitle"),
    errorDescription = rows.length > 0 ? message("table.errorDescription") : message("table.errorNoDataDescription"),
    onRetry,
    retrying,
    mobileRow,
    pagination,
    ...rootProps
  } = safeProps;
  assertUniqueIdentities("DataTable", "column.id", columns.map((column) => column.id));
  if (!columns.some((column) => !column.hidden)) {
    throw new Error("DataTable requires at least one visible column. Developer-hidden columns cannot hide the entire table.");
  }
  const rowKeys = rows.map(rowKey);
  assertUniqueIdentities("DataTable", "rowKey result", rowKeys);
  const rowIdentityKey = JSON.stringify(rowKeys);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const mobileListRef = useRef<HTMLDivElement>(null);
  const readyScrollerHeightRef = useRef(0);
  const readyMobileHeightRef = useRef(0);
  const loadingScrollerHeightRef = useRef(0);
  const loadingMobileHeightRef = useRef(0);
  const failureEpisode = useRef<{ notified: boolean; toastId?: string }>({ notified: false });
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [localRetrying, setLocalRetrying] = useState(false);
  const [availableWidth, setAvailableWidth] = useState(0);
  const loading = state === "loading";
  const hasMobileRows = Boolean(mobileRow);
  const empty = state === "empty" || (!loading && state !== "error" && rows.length === 0);
  const showRows = !loading && !empty && rows.length > 0;
  const { metrics, minimumTableWidth, tableWidth } = columnLayout(columns, availableWidth);
  const activeLoadingSortColumnId = onSort && loadingSortColumnId !== undefined
    && metrics.some(({ column }) => column.id === loadingSortColumnId && column.sortable)
    ? loadingSortColumnId
    : undefined;
  const activeRetrying = state === "error" && Boolean(onRetry) && (Boolean(retrying) || localRetrying);
  const hasErrorFooter = state === "error" && !pagination && (rows.length > 0 || Boolean(onRetry));
  const busy = loading || activeRetrying || activeLoadingSortColumnId !== undefined;
  const fixedViewportRows = normalizedViewportRows(viewportRows, Boolean(pagination));
  const viewportHasSlack = fixedViewportRows !== undefined
    && showRows
    && rows.length < fixedViewportRows;
  const desktopScrollable = fixedViewportRows !== undefined
    || (availableWidth > 0 && minimumTableWidth > availableWidth + 0.5);
  const paginationPage = pagination?.page;
  const paginationPageSize = pagination?.pageSize;
  const requestedLoadingRows = loadingRows ?? fixedViewportRows ?? DEFAULT_VIEWPORT_ROWS;
  const normalizedLoadingRows = Number.isFinite(requestedLoadingRows)
    ? Math.min(MAX_LOADING_ROWS, Math.max(1, Math.trunc(requestedLoadingRows)))
    : DEFAULT_VIEWPORT_ROWS;
  const loadingRowSlots = Math.min(MAX_LOADING_ROWS, Math.max(normalizedLoadingRows, rows.length));
  const skeletonRows = Array.from({ length: loadingRowSlots }, (_, index) => index);
  const retainedScrollerHeight = readyScrollerHeightRef.current || loadingScrollerHeightRef.current;
  const retainedMobileHeight = readyMobileHeightRef.current || loadingMobileHeightRef.current;
  const lockedScrollerHeight = fixedViewportRows === undefined && (loading || state === "error") && retainedScrollerHeight > 0
    ? retainedScrollerHeight
    : undefined;
  const lockedMobileHeight = fixedViewportRows === undefined && (loading || state === "error") && retainedMobileHeight > 0
    ? retainedMobileHeight
    : undefined;
  const frameClassName = cx(
    "ui-data-table__frame",
    pagination && "ui-data-table__frame--paginated",
    hasErrorFooter && "ui-data-table__frame--error-footer",
    fixedViewportRows !== undefined && "ui-data-table__frame--fixed-viewport",
    viewportHasSlack && "ui-data-table__frame--viewport-slack",
  );
  const frameStyle = ({
    ...(fixedViewportRows === undefined ? {} : {
      "--ui-data-table-desktop-viewport-height": `${TABLE_HEADER_HEIGHT + (fixedViewportRows * TABLE_ROW_HEIGHT)}px`,
      "--ui-data-table-mobile-viewport-height": `${fixedViewportRows * MOBILE_ROW_HEIGHT}px`,
    }),
    ...(hasErrorFooter ? {
      "--_ui-data-table-error-desktop-height": `${retainedScrollerHeight || TABLE_HEADER_HEIGHT + (Math.max(3, rows.length) * TABLE_ROW_HEIGHT)}px`,
      "--_ui-data-table-error-mobile-height": `${retainedMobileHeight || Math.max(3, rows.length) * MOBILE_ROW_HEIGHT}px`,
    } : {}),
  } as CSSProperties);
  const handleRetry = () => {
    if (!onRetry || activeRetrying) return;
    if (failureEpisode.current.toastId) dismiss(failureEpisode.current.toastId);
    failureEpisode.current = { notified: false };
    setRetryAttempt((attempt) => attempt + 1);
    setLocalRetrying(true);
    try {
      // The consumer's retrying prop owns network work; returned promises stay pending until settled.
      void Promise.resolve(onRetry()).catch(() => undefined).finally(() => setLocalRetrying(false));
    } catch {
      // The current error remains recoverable even if a consumer retry throws synchronously.
      setLocalRetrying(false);
    }
  };
  const errorStatus = state === "error" ? (
    <span className="ui-data-table__error-status">
      {rows.length > 0 ? <span className="ui-data-table__error-status-text" title={message("table.errorStatus")}>{message("table.errorStatus")}</span> : null}
      {onRetry ? (
        <Button size="small" icon={<RotateCw aria-hidden="true" />} loading={activeRetrying}
          loadingLabel={message("common.retrying")} onClick={handleRetry}>
          {message("common.retry")}
        </Button>
      ) : null}
    </span>
  ) : undefined;
  const paginationSummary = state === "error"
    ? errorStatus
    : pagination?.summary !== undefined
      ? pagination.summary
    : loading && rows.length === 0
      ? message("table.loading")
      : undefined;

  useEffect(() => {
    const episode = failureEpisode.current;
    if (state !== "error" || activeRetrying) {
      if (episode.toastId) dismiss(episode.toastId);
      failureEpisode.current = { notified: false };
      return;
    }
    if (episode.notified) return;
    episode.notified = true;
    let cancelled = false;
    // Enter the queue after effect replay so a parent provider's StrictMode cleanup
    // cannot clear the new message's clock before its final setup.
    void Promise.resolve().then(() => {
      if (cancelled || failureEpisode.current !== episode) return;
      episode.toastId = toast({
        title: <>{ariaLabel}：{errorTitle}</>,
        description: errorDescription,
        tone: "danger",
        duration: 5000,
      });
    });
    return () => {
      cancelled = true;
      if (failureEpisode.current === episode && !episode.toastId) episode.notified = false;
    };
    // Rich ReactNode identity and locale/API changes must not repeat the same failure.
  }, [activeRetrying, ariaLabel, dismiss, errorDescription, errorTitle, retryAttempt, state, toast]);

  useClientLayoutEffect(() => {
    if (fixedViewportRows === undefined) return;
    if (scrollerRef.current) scrollerRef.current.scrollTop = 0;
    if (mobileListRef.current) mobileListRef.current.scrollTop = 0;
  }, [fixedViewportRows, loading, paginationPage, paginationPageSize, rowIdentityKey]);

  useClientLayoutEffect(() => {
    if (empty) {
      readyScrollerHeightRef.current = 0;
      readyMobileHeightRef.current = 0;
      loadingScrollerHeightRef.current = 0;
      loadingMobileHeightRef.current = 0;
      return;
    }
    const scrollerHeight = scrollerRef.current?.getBoundingClientRect().height ?? 0;
    const mobileHeight = mobileListRef.current?.getBoundingClientRect().height ?? 0;
    if (loading) {
      loadingScrollerHeightRef.current = scrollerHeight;
      loadingMobileHeightRef.current = mobileHeight;
      return;
    }
    if (state === "error") return;
    readyScrollerHeightRef.current = scrollerHeight > 0 ? scrollerHeight : 0;
    readyMobileHeightRef.current = mobileHeight > 0 ? mobileHeight : 0;
  });

  useClientLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const mobileList = mobileListRef.current;
    const measure = () => {
      const nextWidth = scroller.clientWidth;
      setAvailableWidth((currentWidth) => currentWidth === nextWidth ? currentWidth : nextWidth);
      if (!loading && state !== "error") {
        const scrollerHeight = scroller.getBoundingClientRect().height;
        const mobileHeight = mobileList?.getBoundingClientRect().height ?? 0;
        readyScrollerHeightRef.current = scrollerHeight > 0 ? scrollerHeight : 0;
        readyMobileHeightRef.current = mobileHeight > 0 ? mobileHeight : 0;
      }
    };
    measure();
    if (typeof ResizeObserver !== "function") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    if (mobileList) observer.observe(mobileList);
    return () => observer.disconnect();
  }, [empty, hasMobileRows, loading, state]);

  if (empty) {
    return (
      <div
        {...rootProps}
        className={cx("ui-data-table", "ui-data-table--empty", mobileRow && "ui-data-table--has-mobile")}
        data-state="empty"
        data-ui-owner="DataTable"
      >
        <div className={frameClassName} style={frameStyle}>
          <div
            className="ui-data-table__empty-scroller"
            role={fixedViewportRows !== undefined ? "region" : undefined}
            aria-label={fixedViewportRows !== undefined ? message("table.emptyScrollRegion", { label: ariaLabel }) : undefined}
            tabIndex={fixedViewportRows !== undefined ? 0 : undefined}
          >
            <EmptyState
              icon={<SearchX aria-hidden="true" />}
              title={emptyTitle}
              description={emptyDescription}
              action={emptyAction}
            />
          </div>
          {pagination ? <div className="ui-data-table__pagination"><Pagination {...pagination} summary={paginationSummary} /></div> : null}
        </div>
      </div>
    );
  }

  return (
    <div
      {...rootProps}
      className={cx("ui-data-table", mobileRow && "ui-data-table--has-mobile")}
      data-state={state}
      aria-busy={busy || undefined}
      data-ui-owner="DataTable"
    >
      <div className={frameClassName} style={frameStyle}>
      <div
        ref={scrollerRef}
        className="ui-data-table__scroller"
        role={desktopScrollable ? "region" : undefined}
        aria-label={desktopScrollable ? message("table.scrollRegion", { label: ariaLabel }) : undefined}
        tabIndex={desktopScrollable ? 0 : undefined}
        style={lockedScrollerHeight !== undefined ? {
          height: hasErrorFooter ? undefined : lockedScrollerHeight,
          overflowY: loading ? "hidden" : "auto",
        } : undefined}
      >
        <table aria-label={ariaLabel} style={{ width: tableWidth, minWidth: minimumTableWidth }}>
          <colgroup>
            {metrics.map(({ column, colStyle }) => <col key={column.id} style={colStyle} />)}
          </colgroup>
          <thead>
            <tr>
              {metrics.map(({ column, style, pinnedClass }) => {
                const active = sort?.columnId === column.id;
                const sorting = activeLoadingSortColumnId === column.id;
                const sortDisabled = state !== "ready" || busy;
                const ariaSort = column.sortable ? (active ? sort?.direction : "none") : undefined;
                const headerIsText = isTextContent(column.header);
                return (
                  <th
                    key={column.id}
                    scope="col"
                    className={cx(pinnedClass, `ui-align-${column.align ?? "start"}`)}
                    style={style}
                    aria-sort={ariaSort}
                  >
                    {column.sortable && onSort ? (
                      <button
                        type="button"
                        className={cx("ui-data-table__sort", active && "is-active")}
                        title={typeof column.header === "string" || typeof column.header === "number" ? String(column.header) : undefined}
                        aria-disabled={sortDisabled || undefined}
                        aria-busy={sorting || undefined}
                        onClick={() => {
                          if (sortDisabled) return;
                          onSort({
                            columnId: column.id,
                            direction: active && sort?.direction === "ascending" ? "descending" : "ascending",
                          });
                        }}
                      >
                        <span className="ui-data-table__sort-label">{column.header}</span>
                        {sorting
                          ? <LoaderCircle className="ui-spinner" aria-hidden="true" />
                          : <SortIcon active={active} direction={sort?.direction} />}
                      </button>
                    ) : (
                      <div
                        className={cx("ui-data-table__header-content", headerIsText && "ui-data-table__header-content--text")}
                        title={headerIsText ? String(column.header) : undefined}
                      >
                        {column.header}
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {state === "error" && rows.length === 0 ? (
              <tr><td colSpan={metrics.length} className="ui-data-table__error-empty">{message("table.errorNoDataStatus")}</td></tr>
            ) : null}
            {loading ? skeletonRows.map((rowIndex) => (
              <tr key={`skeleton-${rowIndex}`} aria-hidden="true">
                {metrics.map(({ column, style, pinnedClass }, columnIndex) => (
                  <td key={column.id} className={cx(pinnedClass)} style={style}>
                    <span className={cx("ui-skeleton", columnIndex % 3 === 2 && "ui-skeleton--short")} aria-hidden="true" />
                  </td>
                ))}
              </tr>
            )) : null}
            {showRows ? rows.map((row, rowIndex) => (
              <tr key={rowKeys[rowIndex]}>
                {metrics.map(({ column, style, pinnedClass }) => {
                  const content = column.cell(row);
                  const contentIsText = isTextContent(content);
                  return (
                    <td key={column.id} className={cx(pinnedClass, `ui-align-${column.align ?? "start"}`)} style={style}>
                      <div
                        className={cx("ui-data-table__cell-content", contentIsText && "ui-data-table__cell-content--text")}
                        title={contentIsText ? String(content) : undefined}
                      >
                        {contentIsText ? <TableCellText>{content}</TableCellText> : content}
                      </div>
                    </td>
                  );
                })}
              </tr>
            )) : null}
          </tbody>
        </table>
      </div>
      {mobileRow ? (
        <div
          ref={mobileListRef}
          className="ui-data-table__mobile"
          role="list"
          aria-label={message("table.mobile", { label: ariaLabel })}
          aria-busy={busy || undefined}
          tabIndex={fixedViewportRows !== undefined ? 0 : undefined}
          style={lockedMobileHeight !== undefined ? {
            height: hasErrorFooter ? undefined : lockedMobileHeight,
            overflow: loading ? "hidden" : "auto",
          } : undefined}
        >
          {state === "error" && rows.length === 0 ? <div className="ui-data-table__error-empty">{message("table.errorNoDataStatus")}</div> : null}
          {loading ? skeletonRows.map((rowIndex) => (
            <div className="ui-mobile-data-row ui-mobile-data-row--loading" role="listitem" aria-hidden="true" key={`mobile-skeleton-${rowIndex}`}>
              <span className="ui-skeleton ui-skeleton--avatar" aria-hidden="true" />
              <span className="ui-mobile-data-row__copy" aria-hidden="true"><span className="ui-skeleton" /><span className="ui-skeleton ui-skeleton--short" /></span>
            </div>
          )) : rows.map((row, rowIndex) => <div className="ui-mobile-data-row" role="listitem" key={rowKeys[rowIndex]}>{mobileRow(row)}</div>)}
        </div>
      ) : null}
      {hasErrorFooter ? <div className="ui-data-table__error-footer">{errorStatus}</div> : null}
      {pagination ? <div className="ui-data-table__pagination"><Pagination {...pagination} summary={paginationSummary} /></div> : null}
      </div>
    </div>
  );
}
