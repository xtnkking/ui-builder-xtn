import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, LoaderCircle, RotateCw, SearchX } from "lucide-react";
import { Alert, EmptyState } from "./feedback";
import { Pagination, type PaginationProps } from "./navigation";
import { Button } from "./primitives";
import { assertUniqueIdentities, cx } from "./utils";

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

export interface DataTableProps<T> {
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
  className?: string;
}

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
      pinnedClass: appliedPin ? `pui-data-table__cell--pin-${appliedPin}` : undefined,
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

export function DataTable<T>({
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
  emptyTitle = "没有匹配数据",
  emptyDescription = "调整条件后重新查询。",
  emptyAction,
  errorTitle = "加载失败",
  errorDescription = "仍显示上一次成功的数据。",
  onRetry,
  retrying,
  mobileRow,
  pagination,
  className,
}: DataTableProps<T>) {
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
  const activeRetrying = state === "error" && Boolean(onRetry) && Boolean(retrying);
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
  const lockedScrollerHeight = fixedViewportRows === undefined && loading && readyScrollerHeightRef.current > 0
    ? readyScrollerHeightRef.current
    : undefined;
  const lockedMobileHeight = fixedViewportRows === undefined && loading && readyMobileHeightRef.current > 0
    ? readyMobileHeightRef.current
    : undefined;
  const frameClassName = cx(
    "pui-data-table__frame",
    pagination && "pui-data-table__frame--paginated",
    fixedViewportRows !== undefined && "pui-data-table__frame--fixed-viewport",
    viewportHasSlack && "pui-data-table__frame--viewport-slack",
  );
  const frameStyle = fixedViewportRows === undefined ? undefined : ({
    "--pui-data-table-desktop-viewport-height": `${TABLE_HEADER_HEIGHT + (fixedViewportRows * TABLE_ROW_HEIGHT)}px`,
    "--pui-data-table-mobile-viewport-height": `${fixedViewportRows * MOBILE_ROW_HEIGHT}px`,
  } as CSSProperties);
  const paginationSummary = pagination?.summary !== undefined
    ? pagination.summary
    : loading && rows.length === 0
      ? "正在加载数据"
      : state === "error" && rows.length === 0
        ? "暂无缓存数据"
        : undefined;

  useClientLayoutEffect(() => {
    if (fixedViewportRows === undefined) return;
    if (scrollerRef.current) scrollerRef.current.scrollTop = 0;
    if (mobileListRef.current) mobileListRef.current.scrollTop = 0;
  }, [fixedViewportRows, loading, paginationPage, paginationPageSize, rowIdentityKey]);

  useClientLayoutEffect(() => {
    if (empty) {
      readyScrollerHeightRef.current = 0;
      readyMobileHeightRef.current = 0;
      return;
    }
    if (loading) return;
    const scrollerHeight = scrollerRef.current?.getBoundingClientRect().height ?? 0;
    const mobileHeight = mobileListRef.current?.getBoundingClientRect().height ?? 0;
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
      if (!loading) {
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
  }, [empty, hasMobileRows, loading]);

  if (empty) {
    return (
      <div className={cx("pui-data-table", "pui-data-table--empty", mobileRow && "pui-data-table--has-mobile", className)} data-state="empty" data-pui-owner="DataTable">
        <div className={frameClassName} style={frameStyle}>
          <div
            className="pui-data-table__empty-scroller"
            role={fixedViewportRows !== undefined ? "region" : undefined}
            aria-label={fixedViewportRows !== undefined ? `${ariaLabel}空状态滚动区域` : undefined}
            tabIndex={fixedViewportRows !== undefined ? 0 : undefined}
          >
            <EmptyState
              icon={<SearchX aria-hidden="true" />}
              title={emptyTitle}
              description={emptyDescription}
              action={emptyAction}
            />
          </div>
          {pagination ? <div className="pui-data-table__pagination"><Pagination {...pagination} summary={paginationSummary} /></div> : null}
        </div>
      </div>
    );
  }

  return (
    <div className={cx("pui-data-table", mobileRow && "pui-data-table--has-mobile", className)} data-state={state} aria-busy={busy || undefined} data-pui-owner="DataTable">
      {state === "error" ? (
        <Alert
          tone="danger"
          title={errorTitle}
          action={onRetry ? (
            <Button
              size="small"
              icon={<RotateCw aria-hidden="true" />}
              loading={activeRetrying}
              loadingLabel="重试中"
              onClick={onRetry}
            >
              重试
            </Button>
          ) : undefined}
        >
          {errorDescription}
        </Alert>
      ) : null}
      <div className={frameClassName} style={frameStyle}>
      <div
        ref={scrollerRef}
        className="pui-data-table__scroller"
        role={desktopScrollable ? "region" : undefined}
        aria-label={desktopScrollable ? `${ariaLabel}滚动区域` : undefined}
        tabIndex={desktopScrollable ? 0 : undefined}
        style={lockedScrollerHeight !== undefined ? {
          height: lockedScrollerHeight,
          overflowY: "hidden",
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
                    className={cx(pinnedClass, `pui-align-${column.align ?? "start"}`)}
                    style={style}
                    aria-sort={ariaSort}
                  >
                    {column.sortable && onSort ? (
                      <button
                        type="button"
                        className={cx("pui-data-table__sort", active && "is-active")}
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
                        <span className="pui-data-table__sort-label">{column.header}</span>
                        {sorting
                          ? <LoaderCircle className="pui-spinner" aria-hidden="true" />
                          : <SortIcon active={active} direction={sort?.direction} />}
                      </button>
                    ) : (
                      <div
                        className={cx("pui-data-table__header-content", headerIsText && "pui-data-table__header-content--text")}
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
            {loading ? skeletonRows.map((rowIndex) => (
              <tr key={`skeleton-${rowIndex}`} aria-hidden="true">
                {metrics.map(({ column, style, pinnedClass }, columnIndex) => (
                  <td key={column.id} className={cx(pinnedClass)} style={style}>
                    <span className={cx("pui-skeleton", columnIndex % 3 === 2 && "pui-skeleton--short")} aria-hidden="true" />
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
                    <td key={column.id} className={cx(pinnedClass, `pui-align-${column.align ?? "start"}`)} style={style}>
                      <div
                        className={cx("pui-data-table__cell-content", contentIsText && "pui-data-table__cell-content--text")}
                        title={contentIsText ? String(content) : undefined}
                      >
                        {content}
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
          className="pui-data-table__mobile"
          role="list"
          aria-label={`${ariaLabel}移动版`}
          aria-busy={busy || undefined}
          tabIndex={fixedViewportRows !== undefined ? 0 : undefined}
          style={lockedMobileHeight !== undefined ? {
            height: lockedMobileHeight,
            overflow: "hidden",
          } : undefined}
        >
          {loading ? skeletonRows.map((rowIndex) => (
            <div className="pui-mobile-data-row pui-mobile-data-row--loading" role="listitem" aria-hidden="true" key={`mobile-skeleton-${rowIndex}`}>
              <span className="pui-skeleton pui-skeleton--avatar" aria-hidden="true" />
              <span className="pui-mobile-data-row__copy" aria-hidden="true"><span className="pui-skeleton" /><span className="pui-skeleton pui-skeleton--short" /></span>
            </div>
          )) : rows.map((row, rowIndex) => <div className="pui-mobile-data-row" role="listitem" key={rowKeys[rowIndex]}>{mobileRow(row)}</div>)}
        </div>
      ) : null}
      {pagination ? <div className="pui-data-table__pagination"><Pagination {...pagination} summary={paginationSummary} /></div> : null}
      </div>
    </div>
  );
}
