import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  GripHorizontal,
  GripVertical,
  Pause,
  Play,
} from "lucide-react";
import { Button, IconButton, Spinner } from "./primitives";
import { assertUniqueIdentities, cx } from "./utils";

export interface VirtualListRenderMeta {
  index: number;
  style: CSSProperties;
}

export interface VirtualListProps<T> {
  items: readonly T[];
  itemKey: (item: T) => string;
  renderItem: (item: T, meta: VirtualListRenderMeta) => ReactNode;
  height: number;
  estimateSize?: number;
  overscan?: number;
  ariaLabel: string;
  onEndReached?: () => void | Promise<void>;
  onEndReachedError?: (error: unknown) => void;
  loadingMore?: boolean;
  empty?: ReactNode;
  className?: string;
}

export function VirtualList<T>({
  items,
  itemKey,
  renderItem,
  height,
  estimateSize = 48,
  overscan = 5,
  ariaLabel,
  onEndReached,
  onEndReachedError,
  loadingMore,
  empty,
  className,
}: VirtualListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const endRequestedRef = useRef(false);
  const keys = items.map(itemKey);
  assertUniqueIdentities("VirtualList", "itemKey", keys);
  const safeSize = Math.max(1, estimateSize);
  const visibleCount = Math.ceil(height / safeSize);
  const start = Math.max(0, Math.floor(scrollTop / safeSize) - overscan);
  const end = Math.min(items.length, start + visibleCount + overscan * 2);

  useEffect(() => {
    if (!onEndReached || loadingMore || end < items.length || endRequestedRef.current) return;
    endRequestedRef.current = true;
    Promise.resolve(onEndReached())
      .catch((error: unknown) => { onEndReachedError?.(error); })
      .finally(() => { endRequestedRef.current = false; });
  }, [end, items.length, loadingMore, onEndReached, onEndReachedError]);

  return (
    <div
      className={cx("pui-virtual-list", className)}
      style={{ height }}
      role="list"
      aria-label={ariaLabel}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      data-pui-owner="VirtualList"
    >
      {!items.length ? <div className="pui-virtual-list__empty">{empty}</div> : null}
      <div className="pui-virtual-list__spacer" style={{ height: items.length * safeSize }}>
        {items.slice(start, end).map((item, offset) => {
          const index = start + offset;
          const style: CSSProperties = { position: "absolute", insetInline: 0, top: index * safeSize, height: safeSize };
          return (
            <div key={keys[index]} role="listitem" aria-posinset={index + 1} aria-setsize={items.length} style={style}>
              {renderItem(item, { index, style })}
            </div>
          );
        })}
      </div>
      {loadingMore ? <div className="pui-virtual-list__loading"><Spinner label="正在加载更多内容" /></div> : null}
    </div>
  );
}

export interface TreeNode {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
  children?: readonly TreeNode[];
}

export interface TreeProps {
  nodes: readonly TreeNode[];
  ariaLabel: string;
  value?: string;
  expandedIds?: readonly string[];
  defaultExpandedIds?: readonly string[];
  onValueChange?: (id: string) => void;
  onExpandedChange?: (ids: string[]) => void;
  className?: string;
}

function collectTreeIds(nodes: readonly TreeNode[]): string[] {
  return nodes.flatMap((node) => [node.id, ...collectTreeIds(node.children ?? [])]);
}

export function Tree({
  nodes,
  ariaLabel,
  value,
  expandedIds,
  defaultExpandedIds = [],
  onValueChange,
  onExpandedChange,
  className,
}: TreeProps) {
  assertUniqueIdentities("Tree", "node.id", collectTreeIds(nodes));
  const [internalExpanded, setInternalExpanded] = useState(() => new Set(defaultExpandedIds));
  const expanded = new Set(expandedIds ?? Array.from(internalExpanded));
  const setExpanded = (next: Set<string>) => {
    if (expandedIds === undefined) setInternalExpanded(next);
    onExpandedChange?.(Array.from(next));
  };
  const renderNodes = (items: readonly TreeNode[], level: number): ReactNode => (
    <ul role={level === 1 ? "tree" : "group"} aria-label={level === 1 ? ariaLabel : undefined}>
      {items.map((node) => {
        const hasChildren = Boolean(node.children?.length);
        const isExpanded = expanded.has(node.id);
        return (
          <li key={node.id} role="treeitem" aria-level={level} aria-expanded={hasChildren ? isExpanded : undefined} aria-selected={value === node.id}>
            <div className="pui-tree__row" style={{ paddingInlineStart: `${(level - 1) * 20 + 6}px` }}>
              {hasChildren ? (
                <IconButton
                  aria-label={isExpanded ? `折叠 ${String(node.label)}` : `展开 ${String(node.label)}`}
                  icon={isExpanded ? <ChevronDown /> : <ChevronRight />}
                  onClick={() => {
                    const next = new Set(expanded);
                    if (isExpanded) next.delete(node.id); else next.add(node.id);
                    setExpanded(next);
                  }}
                />
              ) : <span className="pui-tree__spacer" />}
              <button type="button" disabled={node.disabled} aria-pressed={value === node.id} onClick={() => onValueChange?.(node.id)}>
                {node.icon != null ? <span aria-hidden="true">{node.icon}</span> : null}<span>{node.label}</span>
              </button>
            </div>
            {hasChildren && isExpanded ? renderNodes(node.children ?? [], level + 1) : null}
          </li>
        );
      })}
    </ul>
  );
  return <div className={cx("pui-tree", className)} data-pui-owner="Tree">{renderNodes(nodes, 1)}</div>;
}

export interface TreeTableColumn<T> {
  id: string;
  header: ReactNode;
  cell: (value: T) => ReactNode;
  width?: number | string;
}

export interface TreeTableNode<T> {
  id: string;
  value: T;
  children?: readonly TreeTableNode<T>[];
  loading?: boolean;
}

export interface TreeTableProps<T> {
  nodes: readonly TreeTableNode<T>[];
  columns: readonly TreeTableColumn<T>[];
  treeColumnId: string;
  ariaLabel: string;
  expandedIds?: readonly string[];
  defaultExpandedIds?: readonly string[];
  onExpandedChange?: (ids: string[]) => void;
  onRequestChildren?: (node: TreeTableNode<T>) => void | Promise<void>;
  empty?: ReactNode;
  className?: string;
}

interface FlatTreeRow<T> { node: TreeTableNode<T>; level: number; pos: number; setSize: number }

function flattenTreeRows<T>(nodes: readonly TreeTableNode<T>[], expanded: Set<string>, level = 1): FlatTreeRow<T>[] {
  return nodes.flatMap((node, index) => [
    { node, level, pos: index + 1, setSize: nodes.length },
    ...(expanded.has(node.id) ? flattenTreeRows(node.children ?? [], expanded, level + 1) : []),
  ]);
}

function collectTreeTableIds<T>(nodes: readonly TreeTableNode<T>[]): string[] {
  return nodes.flatMap((node) => [node.id, ...collectTreeTableIds(node.children ?? [])]);
}

export function TreeTable<T>({
  nodes,
  columns,
  treeColumnId,
  ariaLabel,
  expandedIds,
  defaultExpandedIds = [],
  onExpandedChange,
  onRequestChildren,
  empty = "暂无数据",
  className,
}: TreeTableProps<T>) {
  assertUniqueIdentities("TreeTable", "node.id", collectTreeTableIds(nodes));
  assertUniqueIdentities("TreeTable", "column.id", columns.map((column) => column.id));
  if (!columns.some((column) => column.id === treeColumnId)) throw new RangeError(`TreeTable cannot find treeColumnId ${JSON.stringify(treeColumnId)}.`);
  const [internalExpanded, setInternalExpanded] = useState(() => new Set(defaultExpandedIds));
  const expanded = new Set(expandedIds ?? Array.from(internalExpanded));
  const rows = flattenTreeRows(nodes, expanded);
  const toggle = async (node: TreeTableNode<T>) => {
    const next = new Set(expanded);
    if (next.has(node.id)) next.delete(node.id);
    else {
      next.add(node.id);
      if (!node.children?.length) await onRequestChildren?.(node);
    }
    if (expandedIds === undefined) setInternalExpanded(next);
    onExpandedChange?.(Array.from(next));
  };
  return (
    <div className={cx("pui-tree-table", className)} data-pui-owner="TreeTable">
      <table role="treegrid" aria-label={ariaLabel}>
        <thead><tr>{columns.map((column) => <th key={column.id} style={{ width: column.width }}>{column.header}</th>)}</tr></thead>
        <tbody>
          {!rows.length ? <tr><td colSpan={columns.length} className="pui-tree-table__empty">{empty}</td></tr> : null}
          {rows.map(({ node, level, pos, setSize }) => {
            const hasChildren = Boolean(node.children?.length || onRequestChildren);
            const isExpanded = expanded.has(node.id);
            return (
              <tr key={node.id} aria-level={level} aria-posinset={pos} aria-setsize={setSize} aria-expanded={hasChildren ? isExpanded : undefined}>
                {columns.map((column) => (
                  <td key={column.id}>
                    {column.id === treeColumnId ? (
                      <div className="pui-tree-table__tree-cell" style={{ paddingInlineStart: `${(level - 1) * 22}px` }}>
                        {hasChildren ? <IconButton aria-label={isExpanded ? "折叠行" : "展开行"} loading={node.loading} icon={isExpanded ? <ChevronDown /> : <ChevronRight />} onClick={() => void toggle(node)} /> : <span className="pui-tree__spacer" />}
                        <span>{column.cell(node.value)}</span>
                      </div>
                    ) : column.cell(node.value)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function startOfMonth(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function sameDay(left: Date, right: Date): boolean {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
}

function dayTimestamp(value: Date): number {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
}

function zonedDayKey(value: Date, timeZone?: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).formatToParts(value);
  const valueOf = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${valueOf("year")}-${valueOf("month")}-${valueOf("day")}`;
}

export interface CalendarProps {
  month: Date;
  onMonthChange?: (month: Date) => void;
  value?: Date;
  onValueChange?: (date: Date) => void;
  min?: Date;
  max?: Date;
  locale?: string;
  ariaLabel?: string;
  className?: string;
}

export function Calendar({ month, onMonthChange, value, onValueChange, min, max, locale = "zh-CN", ariaLabel = "日历", className }: CalendarProps) {
  const first = startOfMonth(month);
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - first.getDay());
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });
  const monthLabel = new Intl.DateTimeFormat(locale, { year: "numeric", month: "long" }).format(month);
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "short" });
  return (
    <section className={cx("pui-calendar", className)} aria-label={ariaLabel} data-pui-owner="Calendar">
      <header>
        <IconButton aria-label="上个月" icon={<ArrowLeft />} disabled={!onMonthChange} onClick={() => onMonthChange?.(new Date(month.getFullYear(), month.getMonth() - 1, 1))} />
        <strong>{monthLabel}</strong>
        <IconButton aria-label="下个月" icon={<ArrowRight />} disabled={!onMonthChange} onClick={() => onMonthChange?.(new Date(month.getFullYear(), month.getMonth() + 1, 1))} />
      </header>
      <div className="pui-calendar__grid" role="grid">
        {days.slice(0, 7).map((date) => <span key={`weekday-${date.getDay()}`} role="columnheader">{weekday.format(date)}</span>)}
        {days.map((date) => {
          const timestamp = dayTimestamp(date);
          const disabled = Boolean(!onValueChange || (min && timestamp < dayTimestamp(min)) || (max && timestamp > dayTimestamp(max)));
          return (
            <button
              key={date.toISOString()}
              type="button"
              disabled={disabled}
              data-outside={date.getMonth() !== month.getMonth() || undefined}
              aria-selected={value ? sameDay(date, value) : false}
              aria-label={new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(date)}
              onClick={() => onValueChange?.(date)}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export interface SchedulerEvent {
  id: string;
  title: ReactNode;
  textValue: string;
  start: Date;
  end: Date;
  color?: string;
  meta?: ReactNode;
}

export interface SchedulerProps {
  date: Date;
  events: readonly SchedulerEvent[];
  locale?: string;
  timeZone?: string;
  onEventPress?: (event: SchedulerEvent) => void;
  onDateChange?: (date: Date) => void;
  className?: string;
}

export function Scheduler({ date, events, locale = "zh-CN", timeZone, onEventPress, onDateChange, className }: SchedulerProps) {
  assertUniqueIdentities("Scheduler", "event.id", events.map((event) => event.id));
  const formatter = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone });
  const dateLabel = new Intl.DateTimeFormat(locale, { dateStyle: "full", timeZone }).format(date);
  const selectedDay = zonedDayKey(date, timeZone);
  const dayEvents = events.filter((event) => zonedDayKey(event.start, timeZone) === selectedDay).sort((left, right) => left.start.getTime() - right.start.getTime());
  return (
    <section className={cx("pui-scheduler", className)} data-pui-owner="Scheduler">
      <header>
        <IconButton aria-label="前一天" icon={<ArrowLeft />} disabled={!onDateChange} onClick={() => { const next = new Date(date); next.setDate(date.getDate() - 1); onDateChange?.(next); }} />
        <span><CalendarDays aria-hidden="true" /><strong>{dateLabel}</strong></span>
        <IconButton aria-label="后一天" icon={<ArrowRight />} disabled={!onDateChange} onClick={() => { const next = new Date(date); next.setDate(date.getDate() + 1); onDateChange?.(next); }} />
      </header>
      <ol className="pui-scheduler__agenda">
        {dayEvents.map((event) => (
          <li key={event.id} style={{ "--pui-event-color": event.color ?? "var(--pui-primary)" } as CSSProperties}>
            <time dateTime={event.start.toISOString()}>{formatter.format(event.start)}<span>{formatter.format(event.end)}</span></time>
            {onEventPress ? (
              <button type="button" aria-label={event.textValue} onClick={() => onEventPress(event)}><strong>{event.title}</strong>{event.meta != null ? <span>{event.meta}</span> : null}</button>
            ) : (
              <div className="pui-scheduler__event"><strong>{event.title}</strong>{event.meta != null ? <span>{event.meta}</span> : null}</div>
            )}
          </li>
        ))}
        {!dayEvents.length ? <li className="pui-scheduler__empty">当天没有日程</li> : null}
      </ol>
    </section>
  );
}

export interface ChartDatum {
  id: string;
  label: string;
  value: number;
  color?: string;
}

export interface BarChartProps {
  data: readonly ChartDatum[];
  ariaLabel: string;
  formatValue?: (value: number) => ReactNode;
  max?: number;
  className?: string;
}

export function BarChart({ data, ariaLabel, formatValue = String, max, className }: BarChartProps) {
  assertUniqueIdentities("BarChart", "datum.id", data.map((item) => item.id));
  const ceiling = Math.max(1, max ?? Math.max(0, ...data.map((item) => item.value)));
  return (
    <figure className={cx("pui-bar-chart", className)} aria-label={ariaLabel} data-pui-owner="BarChart">
      {data.map((item) => {
        const value = Number.isFinite(item.value) ? Math.max(0, item.value) : 0;
        return (
          <div key={item.id} className="pui-bar-chart__item">
            <span className="pui-bar-chart__value">{formatValue(value)}</span>
            <span className="pui-bar-chart__track"><span style={{ height: `${Math.min(100, value / ceiling * 100)}%`, background: item.color }} /></span>
            <span className="pui-bar-chart__label">{item.label}</span>
          </div>
        );
      })}
    </figure>
  );
}

export interface CarouselSlide {
  id: string;
  content: ReactNode;
  label: string;
}

export interface CarouselProps {
  slides: readonly CarouselSlide[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (id: string) => void;
  ariaLabel: string;
  loop?: boolean;
  autoplay?: boolean;
  interval?: number;
  className?: string;
}

export function Carousel({ slides, value, defaultValue, onValueChange, ariaLabel, loop = false, autoplay = false, interval = 5000, className }: CarouselProps) {
  assertUniqueIdentities("Carousel", "slide.id", slides.map((slide) => slide.id));
  const [internalValue, setInternalValue] = useState(defaultValue ?? slides[0]?.id ?? "");
  const [paused, setPaused] = useState(false);
  const current = value ?? internalValue;
  const selectedIndex = slides.findIndex((slide) => slide.id === current);
  if (slides.length && current && selectedIndex < 0) throw new RangeError(`Carousel cannot find value ${JSON.stringify(current)}.`);
  const currentIndex = Math.max(0, selectedIndex);
  const select = (index: number) => {
    if (!slides.length) return;
    const resolved = loop ? (index + slides.length) % slides.length : Math.max(0, Math.min(slides.length - 1, index));
    if (value === undefined) setInternalValue(slides[resolved].id);
    onValueChange?.(slides[resolved].id);
  };
  useEffect(() => {
    if (!autoplay || paused || slides.length < 2 || (!loop && currentIndex === slides.length - 1)) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) return;
    const timer = window.setInterval(() => select(currentIndex + 1), Math.max(1500, interval));
    return () => window.clearInterval(timer);
  }, [autoplay, currentIndex, interval, loop, onValueChange, paused, slides, value]);
  const slide = slides[currentIndex];
  return (
    <section className={cx("pui-carousel", className)} aria-label={ariaLabel} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocusCapture={() => setPaused(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false); }} data-pui-owner="Carousel">
      <div className="pui-carousel__stage" aria-live="polite">{slide?.content}</div>
      <div className="pui-carousel__controls">
        <IconButton aria-label="上一项" icon={<ArrowLeft />} disabled={!loop && currentIndex === 0} onClick={() => select(currentIndex - 1)} />
        <div className="pui-carousel__dots">{slides.map((item, index) => <button key={item.id} type="button" aria-label={`显示 ${item.label}`} aria-current={index === currentIndex} onClick={() => select(index)} />)}</div>
        <IconButton aria-label="下一项" icon={<ArrowRight />} disabled={!loop && currentIndex === slides.length - 1} onClick={() => select(currentIndex + 1)} />
        {autoplay ? <IconButton aria-label={paused ? "继续自动播放" : "暂停自动播放"} icon={paused ? <Play /> : <Pause />} onClick={() => setPaused((state) => !state)} /> : null}
      </div>
    </section>
  );
}

export interface ResizablePanelsProps {
  first: ReactNode;
  second: ReactNode;
  ariaLabel: string;
  orientation?: "horizontal" | "vertical";
  defaultSize?: number;
  minSize?: number;
  maxSize?: number;
  onSizeChange?: (percent: number) => void;
  className?: string;
}

export function ResizablePanels({ first, second, ariaLabel, orientation = "horizontal", defaultSize = 50, minSize = 20, maxSize = 80, onSizeChange, className }: ResizablePanelsProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const lowerBound = Math.min(minSize, maxSize);
  const upperBound = Math.max(minSize, maxSize);
  const [size, setSize] = useState(Math.min(upperBound, Math.max(lowerBound, defaultSize)));
  const update = (next: number) => {
    const resolved = Math.min(upperBound, Math.max(lowerBound, next));
    setSize(resolved);
    onSizeChange?.(resolved);
  };
  const move = (event: PointerEvent) => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return;
    update(orientation === "horizontal" ? (event.clientX - rect.left) / rect.width * 100 : (event.clientY - rect.top) / rect.height * 100);
  };
  const start = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const handleMove = (nativeEvent: PointerEvent) => move(nativeEvent);
    const stop = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", stop, { once: true });
    window.addEventListener("pointercancel", stop, { once: true });
  };
  return (
    <div ref={rootRef} className={cx("pui-resizable", `pui-resizable--${orientation}`, className)} style={{ "--pui-panel-size": `${size}%` } as CSSProperties} data-pui-owner="ResizablePanels">
      <div className="pui-resizable__panel">{first}</div>
      <div className="pui-resizable__handle" role="separator" aria-label={ariaLabel} aria-orientation={orientation} aria-valuemin={lowerBound} aria-valuemax={upperBound} aria-valuenow={Math.round(size)} tabIndex={0} onPointerDown={start} onKeyDown={(event) => {
        const decreaseKey = orientation === "horizontal" ? "ArrowLeft" : "ArrowUp";
        const increaseKey = orientation === "horizontal" ? "ArrowRight" : "ArrowDown";
        const next = event.key === "Home" ? lowerBound : event.key === "End" ? upperBound : event.key === decreaseKey ? size - 2 : event.key === increaseKey ? size + 2 : null;
        if (next !== null) { event.preventDefault(); update(next); }
      }}>{orientation === "horizontal" ? <GripVertical aria-hidden="true" /> : <GripHorizontal aria-hidden="true" />}</div>
      <div className="pui-resizable__panel">{second}</div>
    </div>
  );
}

export interface DragDropProps {
  children: ReactNode;
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  accept?: string;
  className?: string;
}

export function DragDrop({ children, onFiles, disabled, accept, className }: DragDropProps) {
  const [active, setActive] = useState(false);
  const readFiles = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setActive(false);
    if (!disabled) onFiles(Array.from(event.dataTransfer.files));
  };
  return (
    <div className={cx("pui-drag-drop", active && "is-active", className)} data-accept={accept} data-disabled={disabled || undefined} onDragEnter={(event) => { event.preventDefault(); if (!disabled) setActive(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setActive(false); }} onDrop={readFiles} data-pui-owner="DragDrop">
      {children}
    </div>
  );
}

export interface SortableItem<T> { id: string; value: T }
export interface SortableListProps<T> {
  items: readonly SortableItem<T>[];
  renderItem: (value: T) => ReactNode;
  onReorder: (items: SortableItem<T>[]) => void;
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
}

export function SortableList<T>({ items, renderItem, onReorder, ariaLabel, disabled, className }: SortableListProps<T>) {
  assertUniqueIdentities("SortableList", "item.id", items.map((item) => item.id));
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const moveItem = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    const next = items.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onReorder(next);
  };
  return (
    <ol className={cx("pui-sortable", className)} aria-label={ariaLabel} data-pui-owner="SortableList">
      {items.map((item, index) => (
        <li key={item.id} draggable={!disabled} data-dragging={draggedId === item.id || undefined} onDragStart={() => setDraggedId(item.id)} onDragEnd={() => setDraggedId(null)} onDragOver={(event) => event.preventDefault()} onDrop={() => {
          const from = items.findIndex((candidate) => candidate.id === draggedId);
          if (!disabled && from >= 0) moveItem(from, index);
          setDraggedId(null);
        }}>
          <GripVertical aria-hidden="true" />
          <div>{renderItem(item.value)}</div>
          <div className="pui-sortable__actions">
            <IconButton aria-label="上移" icon={<ArrowUp />} disabled={disabled || index === 0} onClick={() => moveItem(index, index - 1)} />
            <IconButton aria-label="下移" icon={<ArrowDown />} disabled={disabled || index === items.length - 1} onClick={() => moveItem(index, index + 1)} />
          </div>
        </li>
      ))}
    </ol>
  );
}

export interface ExpandableTextProps {
  children: string;
  collapsedLines?: number;
  expandLabel?: ReactNode;
  collapseLabel?: ReactNode;
  className?: string;
}

export function ExpandableText({ children, collapsedLines = 2, expandLabel = "展开", collapseLabel = "收起", className }: ExpandableTextProps) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={cx("pui-expandable-text", className)} data-expanded={expanded || undefined} data-pui-owner="ExpandableText">
      <p style={{ "--pui-clamp-lines": collapsedLines } as CSSProperties}>{children}</p>
      <Button size="small" variant="ghost" onClick={() => setExpanded((state) => !state)}>{expanded ? collapseLabel : expandLabel}</Button>
    </div>
  );
}
