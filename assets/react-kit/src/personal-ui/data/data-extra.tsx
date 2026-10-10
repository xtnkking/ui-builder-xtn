import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
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
import type { ControllableValueProps, PublicControlProps } from "../foundation/contracts";
import { useControllableState } from "../internal/controllable-state";
import { sanitizeFixedControlProps } from "../internal/fixed-control-props";
import { adjacentTreeKey, resolvedTreeKey, visibleTreeItems } from "../internal/tree-navigation";
import { assertPersonalUITimeZone, usePersonalUILocale } from "../foundation/locale";
import { Button, IconButton, Spinner } from "../foundation/primitives";
import { assertUniqueIdentities, cx, matchesFileAccept } from "../internal/utils";

const useClientLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export interface VirtualListRenderMeta {
  index: number;
  style: CSSProperties;
}

export type VirtualListProps<T> = PublicControlProps<Omit<
  HTMLAttributes<HTMLDivElement>,
  "aria-label" | "children" | "role"
>> & {
  items: readonly T[];
  itemKey: (item: T) => string;
  renderItem: (item: T, meta: VirtualListRenderMeta) => ReactNode;
  height: number;
  itemSize?: number;
  overscan?: number;
  ariaLabel: string;
  onEndReached?: () => void | Promise<void>;
  onEndReachedError?: (error: unknown) => void;
  loadingMore?: boolean;
  empty?: ReactNode;
};

export function VirtualList<T>(rawProps: VirtualListProps<T>) {
  const { message } = usePersonalUILocale();
  const safeProps = sanitizeFixedControlProps(rawProps, ["aria-label", "children", "role"]);
  const {
    items,
    itemKey,
    renderItem,
    height,
    itemSize = 48,
    overscan = 5,
    ariaLabel,
    onEndReached,
    onEndReachedError,
    loadingMore,
    empty,
    onScroll,
    ...rootProps
  } = safeProps;
  if (!Number.isFinite(height) || height <= 0 || !Number.isFinite(itemSize) || itemSize <= 0 || !Number.isInteger(overscan) || overscan < 0) {
    throw new RangeError("VirtualList requires positive height/itemSize and a nonnegative integer overscan.");
  }
  const rootRef = useRef<HTMLDivElement>(null);
  const focusedChildRef = useRef<HTMLElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const endRequestedRef = useRef<{ length: number; lastKey: string | undefined } | null>(null);
  const keys = items.map(itemKey);
  assertUniqueIdentities("VirtualList", "itemKey", keys);
  const totalHeight = items.length * itemSize;
  const boundedScrollTop = Math.min(scrollTop, Math.max(0, totalHeight - height));
  const start = Math.max(0, Math.floor(boundedScrollTop / itemSize) - overscan);
  const end = Math.min(items.length, Math.ceil((boundedScrollTop + height) / itemSize) + overscan);
  const lastKey = keys[keys.length - 1];

  useClientLayoutEffect(() => {
    const root = rootRef.current;
    if (root && root.scrollTop > boundedScrollTop) root.scrollTop = boundedScrollTop;
    if (scrollTop !== boundedScrollTop) setScrollTop(boundedScrollTop);
  }, [boundedScrollTop, scrollTop]);

  useClientLayoutEffect(() => {
    const root = rootRef.current;
    const focusedChild = focusedChildRef.current;
    if (root && focusedChild && !focusedChild.isConnected) {
      if (root.ownerDocument.activeElement === root.ownerDocument.body) root.focus({ preventScroll: true });
      focusedChildRef.current = null;
    }
  }, [start, end, items]);

  useEffect(() => {
    if (!onEndReached || loadingMore || end < items.length) return;
    if (endRequestedRef.current?.length === items.length && endRequestedRef.current.lastKey === lastKey) return;
    endRequestedRef.current = { length: items.length, lastKey };
    void Promise.resolve().then(onEndReached).catch((error: unknown) => { onEndReachedError?.(error); });
  }, [end, items.length, lastKey, loadingMore, onEndReached, onEndReachedError]);

  return (
    <div
      {...rootProps}
      ref={rootRef}
      className="pui-virtual-list"
      style={{ height }}
      role="list"
      aria-label={ariaLabel}
      tabIndex={totalHeight > height ? 0 : -1}
      onFocusCapture={(event) => {
        focusedChildRef.current = event.target === event.currentTarget ? null : event.target as HTMLElement;
        rootProps.onFocusCapture?.(event);
      }}
      onBlurCapture={(event) => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) focusedChildRef.current = null;
        rootProps.onBlurCapture?.(event);
      }}
      onScroll={(event) => {
        setScrollTop(event.currentTarget.scrollTop);
        onScroll?.(event);
      }}
      data-pui-owner="VirtualList"
    >
      {!items.length ? <div className="pui-virtual-list__empty">{empty}</div> : null}
      <div className="pui-virtual-list__spacer" style={{ height: totalHeight }}>
        {items.slice(start, end).map((item, offset) => {
          const index = start + offset;
          const style: CSSProperties = { position: "absolute", insetInline: 0, top: index * itemSize, height: itemSize };
          return (
            <div key={keys[index]} role="listitem" aria-posinset={index + 1} aria-setsize={items.length} style={style}>
              {renderItem(item, { index, style })}
            </div>
          );
        })}
      </div>
      {loadingMore ? <div className="pui-virtual-list__loading"><Spinner label={message("loadMore.loadingContent")} /></div> : null}
    </div>
  );
}

export interface TreeNode {
  id: string;
  label: ReactNode;
  textValue?: string;
  icon?: ReactNode;
  disabled?: boolean;
  children?: readonly TreeNode[];
}

type ControllableExpandedIdsProps =
  | {
    expandedIds: readonly string[];
    defaultExpandedIds?: never;
    onExpandedChange: (ids: string[]) => void;
  }
  | {
    expandedIds?: never;
    defaultExpandedIds?: readonly string[];
    onExpandedChange?: (ids: string[]) => void;
  };

type TreeBaseProps = PublicControlProps<Omit<
  HTMLAttributes<HTMLDivElement>,
  "aria-label" | "children" | "defaultValue" | "onChange"
>> & {
  nodes: readonly TreeNode[];
  ariaLabel: string;
};

export type TreeProps = TreeBaseProps
  & ControllableValueProps<string>
  & ControllableExpandedIdsProps;

function collectTreeIds(nodes: readonly TreeNode[]): string[] {
  return nodes.flatMap((node) => [node.id, ...collectTreeIds(node.children ?? [])]);
}

export function Tree(rawProps: TreeProps) {
  const { message } = usePersonalUILocale();
  const valueControlled = rawProps.value !== undefined;
  const defaultValueProvided = rawProps.defaultValue !== undefined;
  const expandedControlled = rawProps.expandedIds !== undefined;
  const defaultExpandedProvided = rawProps.defaultExpandedIds !== undefined;
  const safeProps = sanitizeFixedControlProps(rawProps, ["aria-label", "children"]);
  const {
    nodes,
    ariaLabel,
    value,
    defaultValue,
    onValueChange,
    expandedIds,
    defaultExpandedIds,
    onExpandedChange,
    ...rootProps
  } = safeProps;
  assertUniqueIdentities("Tree", "node.id", collectTreeIds(nodes));
  const [selectedValue, setSelectedValue] = useControllableState({
    componentName: "Tree",
    controlled: valueControlled,
    value,
    defaultValue: defaultValue ?? "",
    defaultValueProvided,
    onChange: onValueChange,
  });
  const [expandedState, setExpandedState] = useControllableState<readonly string[]>({
    componentName: "Tree",
    controlled: expandedControlled,
    value: expandedIds,
    defaultValue: defaultExpandedIds ?? [],
    defaultValueProvided: defaultExpandedProvided,
    onChange: onExpandedChange
      ? (nextIds) => onExpandedChange([...nextIds])
      : undefined,
    valuePropName: "expandedIds",
    defaultValuePropName: "defaultExpandedIds",
    changePropName: "onExpandedChange",
  });
  const expanded = new Set(expandedState);
  const visible = visibleTreeItems(nodes, expanded, (node) => node.id, (node) => node.children, (node) => Boolean(node.disabled));
  const [activeKey, setActiveKey] = useState<string | undefined>(() => (
    visible.find((item) => item.key === selectedValue && !item.disabled)?.key
    ?? visible.find((item) => !item.disabled)?.key
  ));
  const previousOrderRef = useRef<string[]>([]);
  const treeRef = useRef<HTMLUListElement>(null);
  const treeHasFocusRef = useRef(false);
  const focusKey = resolvedTreeKey(visible, activeKey, previousOrderRef.current);

  useEffect(() => {
    previousOrderRef.current = visible.map((item) => item.key);
    if (activeKey !== focusKey) setActiveKey(focusKey);
    if (!treeHasFocusRef.current) return;
    const target = focusKey
      ? Array.from(treeRef.current?.querySelectorAll<HTMLElement>("[role='treeitem'][data-tree-key]") ?? [])
        .find((item) => item.dataset.treeKey === focusKey)
      : treeRef.current;
    if (target && document.activeElement !== target) target.focus();
  });

  const setExpanded = (next: Set<string>) => {
    setExpandedState(Array.from(next));
  };
  const toggleExpanded = (key: string) => {
    const next = new Set(expanded);
    if (next.has(key)) {
      next.delete(key);
      let focused = visible.find((item) => item.key === focusKey);
      while (focused?.parentKey) {
        if (focused.parentKey === key) { setActiveKey(key); break; }
        focused = visible.find((item) => item.key === focused?.parentKey);
      }
    } else {
      next.add(key);
    }
    setExpanded(next);
  };
  const handleTreeKeyDown = (event: ReactKeyboardEvent<HTMLUListElement>) => {
    const itemElement = (event.target as HTMLElement).closest<HTMLElement>("[role='treeitem'][data-tree-key]");
    const current = visible.find((item) => item.key === itemElement?.dataset.treeKey);
    if (!current || current.disabled) return;
    let nextKey: string | undefined;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      nextKey = adjacentTreeKey(visible, current.key, event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "Home" || event.key === "End") {
      const enabled = visible.filter((item) => !item.disabled);
      nextKey = (event.key === "Home" ? enabled[0] : enabled[enabled.length - 1])?.key;
    } else if (event.key === "ArrowRight") {
      if (current.node.children?.length && !expanded.has(current.key)) toggleExpanded(current.key);
      else nextKey = visible.find((item) => item.parentKey === current.key && !item.disabled)?.key;
    } else if (event.key === "ArrowLeft") {
      if (current.node.children?.length && expanded.has(current.key)) toggleExpanded(current.key);
      else {
        let parent = visible.find((item) => item.key === current.parentKey);
        while (parent?.disabled) parent = visible.find((item) => item.key === parent?.parentKey);
        nextKey = parent?.key;
      }
    } else if (event.key === "Enter" || event.key === " ") {
      setSelectedValue(current.key);
    } else {
      return;
    }
    event.preventDefault();
    if (nextKey) setActiveKey(nextKey);
  };
  const renderNodes = (items: readonly TreeNode[], level: number): ReactNode => (
    <ul
      ref={level === 1 ? treeRef : undefined}
      role={level === 1 ? "tree" : "group"}
      aria-label={level === 1 ? ariaLabel : undefined}
      tabIndex={level === 1 && !focusKey ? 0 : undefined}
      onKeyDown={level === 1 ? handleTreeKeyDown : undefined}
      onFocusCapture={level === 1 ? () => { treeHasFocusRef.current = true; } : undefined}
      onBlurCapture={level === 1 ? (event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) treeHasFocusRef.current = false;
      } : undefined}
    >
      {items.map((node) => {
        const hasChildren = Boolean(node.children?.length);
        const isExpanded = expanded.has(node.id);
        const item = visible.find((candidate) => candidate.key === node.id);
        return (
          <li
            key={node.id}
            role="treeitem"
            data-tree-key={node.id}
            aria-label={node.textValue ?? (typeof node.label === "string" || typeof node.label === "number" ? String(node.label) : node.id)}
            aria-level={level}
            aria-posinset={item?.position}
            aria-setsize={item?.setSize}
            aria-expanded={hasChildren ? isExpanded : undefined}
            aria-selected={!node.disabled && selectedValue === node.id}
            aria-disabled={node.disabled || undefined}
            tabIndex={!node.disabled && focusKey === node.id ? 0 : -1}
            onFocus={(event) => { if (event.target === event.currentTarget && !node.disabled) setActiveKey(node.id); }}
          >
            <div className="pui-tree__row" style={{ paddingInlineStart: `${(level - 1) * 20 + 6}px` }}>
              {hasChildren ? (
                <IconButton
                  aria-label={message(isExpanded ? "tree.collapse" : "tree.expand", { label: node.textValue ?? String(node.label) })}
                  icon={isExpanded ? <ChevronDown /> : <ChevronRight />}
                  tabIndex={-1}
                  disabled={node.disabled}
                  onClick={() => {
                    toggleExpanded(node.id);
                    treeRef.current?.querySelectorAll<HTMLElement>("[role='treeitem'][data-tree-key]").forEach((itemElement) => {
                      if (itemElement.dataset.treeKey === node.id) itemElement.focus();
                    });
                  }}
                />
              ) : <span className="pui-tree__spacer" />}
              <button type="button" tabIndex={-1} disabled={node.disabled} aria-pressed={!node.disabled && selectedValue === node.id} onClick={() => {
                setSelectedValue(node.id);
                (document.activeElement as HTMLElement)?.closest<HTMLElement>("[role='treeitem']")?.focus();
              }}>
                {node.icon != null ? <span aria-hidden="true">{node.icon}</span> : null}<span>{node.label}</span>
              </button>
            </div>
            {hasChildren && isExpanded ? renderNodes(node.children ?? [], level + 1) : null}
          </li>
        );
      })}
    </ul>
  );
  return <div {...rootProps} className="pui-tree" data-pui-owner="Tree">{renderNodes(nodes, 1)}</div>;
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
  hasChildren?: boolean;
  loading?: boolean;
}

type TreeTableBaseProps<T> = PublicControlProps<Omit<
  HTMLAttributes<HTMLDivElement>,
  "aria-label" | "children"
>> & {
  nodes: readonly TreeTableNode<T>[];
  columns: readonly TreeTableColumn<T>[];
  treeColumnId: string;
  ariaLabel: string;
  getRowLabel?: (node: TreeTableNode<T>) => string;
  onRequestChildren?: (node: TreeTableNode<T>) => void | Promise<void>;
  empty?: ReactNode;
};

export type TreeTableProps<T> = TreeTableBaseProps<T> & ControllableExpandedIdsProps;

interface FlatTreeRow<T> { node: TreeTableNode<T>; level: number }

function flattenTreeRows<T>(nodes: readonly TreeTableNode<T>[], expanded: Set<string>, level = 1): FlatTreeRow<T>[] {
  return nodes.flatMap((node) => [
    { node, level },
    ...(expanded.has(node.id) ? flattenTreeRows(node.children ?? [], expanded, level + 1) : []),
  ]);
}

function collectTreeTableIds<T>(nodes: readonly TreeTableNode<T>[]): string[] {
  return nodes.flatMap((node) => [node.id, ...collectTreeTableIds(node.children ?? [])]);
}

export function TreeTable<T>(rawProps: TreeTableProps<T>) {
  const { message } = usePersonalUILocale();
  const expandedControlled = rawProps.expandedIds !== undefined;
  const defaultExpandedProvided = rawProps.defaultExpandedIds !== undefined;
  const safeProps = sanitizeFixedControlProps(rawProps, ["aria-label", "children"]);
  const {
    nodes,
    columns,
    treeColumnId,
    ariaLabel,
    getRowLabel = (node) => node.id,
    expandedIds,
    defaultExpandedIds,
    onExpandedChange,
    onRequestChildren,
    empty = message("tree.empty"),
    ...rootProps
  } = safeProps;
  assertUniqueIdentities("TreeTable", "node.id", collectTreeTableIds(nodes));
  assertUniqueIdentities("TreeTable", "column.id", columns.map((column) => column.id));
  if (!columns.some((column) => column.id === treeColumnId)) throw new RangeError(`TreeTable cannot find treeColumnId ${JSON.stringify(treeColumnId)}.`);
  const [expandedState, setExpandedState] = useControllableState<readonly string[]>({
    componentName: "TreeTable",
    controlled: expandedControlled,
    value: expandedIds,
    defaultValue: defaultExpandedIds ?? [],
    defaultValueProvided: defaultExpandedProvided,
    onChange: onExpandedChange
      ? (nextIds) => onExpandedChange([...nextIds])
      : undefined,
    valuePropName: "expandedIds",
    defaultValuePropName: "defaultExpandedIds",
    changePropName: "onExpandedChange",
  });
  const expanded = new Set(expandedState);
  const rows = flattenTreeRows(nodes, expanded);
  const [pendingIds, setPendingIds] = useState<readonly string[]>([]);
  const [requestErrors, setRequestErrors] = useState<Readonly<Record<string, true>>>({});
  const toggle = async (node: TreeTableNode<T>) => {
    if (node.loading || pendingIds.includes(node.id)) return;
    if (!expanded.has(node.id) && !node.children?.length && onRequestChildren) {
      setPendingIds((current) => [...current, node.id]);
      setRequestErrors((current) => { const next = { ...current }; delete next[node.id]; return next; });
      try {
        await onRequestChildren(node);
      } catch {
        setRequestErrors((current) => ({ ...current, [node.id]: true }));
        return;
      } finally {
        setPendingIds((current) => current.filter((id) => id !== node.id));
      }
    }
    setExpandedState((current) => {
      const next = new Set(current);
      if (next.has(node.id)) next.delete(node.id);
      else next.add(node.id);
      return Array.from(next);
    });
  };
  return (
    <div {...rootProps} className="pui-tree-table" data-pui-owner="TreeTable">
      <table aria-label={ariaLabel}>
        <thead><tr>{columns.map((column) => <th key={column.id} scope="col" style={{ width: column.width }}>{column.header}</th>)}</tr></thead>
        <tbody>
          {!rows.length ? <tr><td colSpan={columns.length} className="pui-tree-table__empty">{empty}</td></tr> : null}
          {rows.map(({ node, level }) => {
            const hasChildren = Boolean(node.children?.length || (node.hasChildren && onRequestChildren));
            const isExpanded = expanded.has(node.id);
            return (
              <tr key={node.id}>
                {columns.map((column) => (
                  <td key={column.id}>
                    {column.id === treeColumnId ? (
                      <div className="pui-tree-table__tree-cell" style={{ paddingInlineStart: `${(level - 1) * 22}px` }}>
                        {hasChildren ? <IconButton aria-label={requestErrors[node.id]
                          ? message("tree.retryLoad", { label: getRowLabel(node) })
                          : message(isExpanded ? "tree.collapse" : "tree.expand", { label: getRowLabel(node) })} aria-expanded={isExpanded} loading={node.loading || pendingIds.includes(node.id)} icon={isExpanded ? <ChevronDown /> : <ChevronRight />} onClick={() => void toggle(node)} /> : <span className="pui-tree__spacer" />}
                        <span>{column.cell(node.value)}</span>
                        {requestErrors[node.id] ? <span role="alert">{message("tree.loadFailed")}</span> : null}
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
  return calendarDayAtMidnight(calendarDate(value.getFullYear(), value.getMonth(), 1));
}

function calendarDate(year: number, month: number, day: number): Date {
  const date = new Date(0);
  date.setFullYear(year, month, day);
  date.setHours(12, 0, 0, 0);
  return date;
}

function calendarDayAtMidnight(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function addCalendarDays(date: Date, count: number): Date {
  return calendarDate(date.getFullYear(), date.getMonth(), date.getDate() + count);
}

function calendarDayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function calendarMonthKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}`;
}

function shiftCalendarMonth(date: Date, count: number): Date {
  const nextMonth = calendarDate(date.getFullYear(), date.getMonth() + count, 1);
  const lastDay = calendarDate(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate();
  return calendarDate(nextMonth.getFullYear(), nextMonth.getMonth(), Math.min(date.getDate(), lastDay));
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

function adjacentSchedulerDate(date: Date, direction: -1 | 1, timeZone?: string): Date {
  if (!timeZone) {
    const next = new Date(date);
    next.setDate(next.getDate() + direction);
    return next;
  }
  const [year, month, day] = zonedDayKey(date, timeZone).split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1, day + direction, 12));
  const targetDay = target.toISOString().slice(0, 10);
  let next = target;
  for (let attempt = 0; attempt < 2 && zonedDayKey(next, timeZone) !== targetDay; attempt += 1) {
    const observedDay = zonedDayKey(next, timeZone);
    const dayDifference = (Date.parse(`${targetDay}T00:00:00Z`) - Date.parse(`${observedDay}T00:00:00Z`)) / 86_400_000;
    next = new Date(next.getTime() + dayDifference * 86_400_000);
  }
  return next;
}

type CalendarBaseProps = PublicControlProps<Omit<
  HTMLAttributes<HTMLElement>,
  "aria-label" | "children" | "defaultValue" | "onChange"
>> & {
  month: Date;
  onMonthChange?: (month: Date) => void;
  min?: Date;
  max?: Date;
  isDateDisabled?: (date: Date) => boolean;
  locale?: string;
  ariaLabel?: string;
};

export type CalendarProps = CalendarBaseProps & ControllableValueProps<Date>;

export function Calendar(rawProps: CalendarProps) {
  const localeContext = usePersonalUILocale();
  const { message } = localeContext;
  const controlled = rawProps.value !== undefined;
  const defaultValueProvided = rawProps.defaultValue !== undefined;
  const safeProps = sanitizeFixedControlProps(rawProps, ["aria-label", "children"]);
  const {
    month,
    onMonthChange,
    value,
    defaultValue,
    onValueChange,
    min,
    max,
    isDateDisabled,
    locale: localeProp,
    ariaLabel = message("calendar.label"),
    ...rootProps
  } = safeProps;
  const locale = localeProp ?? localeContext.locale;
  const [selectedDate, setSelectedDate] = useControllableState<Date | undefined>({
    componentName: "Calendar",
    controlled,
    value,
    defaultValue,
    defaultValueProvided,
    onChange: onValueChange
      ? (nextDate) => {
        if (nextDate) onValueChange(nextDate);
      }
      : undefined,
  });
  const first = calendarDate(month.getFullYear(), month.getMonth(), 1);
  const gridStart = addCalendarDays(first, -first.getDay());
  const days = Array.from({ length: 42 }, (_, index) => addCalendarDays(gridStart, index));
  const isSelectable = (date: Date) => (
    (!min || dayTimestamp(date) >= dayTimestamp(min))
    && (!max || dayTimestamp(date) <= dayTimestamp(max))
    && !isDateDisabled?.(calendarDayAtMidnight(date))
  );
  const initialFocus = () => days.find((date) => (
    selectedDate && sameDay(date, selectedDate) && isSelectable(date) && calendarMonthKey(date) === calendarMonthKey(month)
  )) ?? days.find((date) => calendarMonthKey(date) === calendarMonthKey(month) && isSelectable(date))
    ?? days.find(isSelectable);
  const [focusedDate, setFocusedDate] = useState<Date | undefined>(initialFocus);
  const monthKey = calendarMonthKey(month);
  const selectedKey = selectedDate ? calendarDayKey(selectedDate) : "";
  const lastMonthRef = useRef(monthKey);
  const lastSelectedRef = useRef(selectedKey);
  const requestedMonthRef = useRef<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const gridHasFocusRef = useRef(false);
  const focusDay = days.find((date) => focusedDate && sameDay(date, focusedDate) && isSelectable(date)) ?? initialFocus();
  const focusKey = focusDay ? calendarDayKey(focusDay) : "";

  useEffect(() => {
    const monthChanged = lastMonthRef.current !== monthKey;
    const selectionChanged = lastSelectedRef.current !== selectedKey;
    lastMonthRef.current = monthKey;
    lastSelectedRef.current = selectedKey;
    if (monthChanged && requestedMonthRef.current === monthKey) {
      requestedMonthRef.current = null;
    } else if (monthChanged) {
      requestedMonthRef.current = null;
      setFocusedDate(initialFocus());
    } else if (selectionChanged && selectedDate && calendarMonthKey(selectedDate) === monthKey && isSelectable(selectedDate)) {
      setFocusedDate(selectedDate);
    }
  }, [monthKey, selectedKey]);

  useEffect(() => {
    if (!gridHasFocusRef.current) return;
    const target = focusKey
      ? Array.from(gridRef.current?.querySelectorAll<HTMLButtonElement>("[data-calendar-day] button") ?? [])
        .find((button) => button.dataset.calendarDay === focusKey)
      : gridRef.current;
    if (target && document.activeElement !== target) target.focus();
  });

  const moveFocus = (date: Date) => {
    setFocusedDate(date);
    const nextMonthKey = calendarMonthKey(date);
    if (nextMonthKey !== monthKey && onMonthChange) {
      requestedMonthRef.current = nextMonthKey;
      onMonthChange(startOfMonth(date));
    }
  };

  const findNextSelectable = (target: Date, direction: 1 | -1) => {
    for (let index = 0; index <= 42; index += 1) {
      const candidate = addCalendarDays(target, index * direction);
      if (!onMonthChange && (dayTimestamp(candidate) < dayTimestamp(days[0]) || dayTimestamp(candidate) > dayTimestamp(days[41]))) return;
      if (direction === 1 && max && dayTimestamp(candidate) > dayTimestamp(max)) return;
      if (direction === -1 && min && dayTimestamp(candidate) < dayTimestamp(min)) return;
      if (isSelectable(candidate)) return candidate;
    }
  };

  const handleDateKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, date: Date) => {
    const direction = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
    let target: Date | undefined;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight" || event.key === "ArrowUp" || event.key === "ArrowDown") {
      target = findNextSelectable(addCalendarDays(date, direction * (event.key === "ArrowDown" || event.key === "ArrowUp" ? 7 : 1)), direction);
    } else if (event.key === "Home" || event.key === "End") {
      const weekStart = addCalendarDays(date, -date.getDay());
      const fromEnd = event.key === "End";
      for (let index = 0; index < 7; index += 1) {
        const candidate = addCalendarDays(weekStart, fromEnd ? 6 - index : index);
        if (isSelectable(candidate)) { target = candidate; break; }
      }
    } else if (event.key === "PageUp" || event.key === "PageDown") {
      if (onMonthChange) {
        const change = (event.key === "PageDown" ? 1 : -1) * (event.shiftKey ? 12 : 1);
        const desired = shiftCalendarMonth(date, change);
        const targetMonth = calendarMonthKey(desired);
        for (let distance = 0; distance < 31; distance += 1) {
          const after = addCalendarDays(desired, distance);
          const before = addCalendarDays(desired, -distance);
          if (calendarMonthKey(after) === targetMonth && isSelectable(after)) { target = after; break; }
          if (calendarMonthKey(before) === targetMonth && isSelectable(before)) { target = before; break; }
        }
      }
    } else {
      return;
    }
    event.preventDefault();
    if (target) moveFocus(target);
  };

  const canShowMonth = (date: Date) => {
    const start = calendarDate(date.getFullYear(), date.getMonth(), 1);
    const end = calendarDate(date.getFullYear(), date.getMonth() + 1, 0);
    return (!min || dayTimestamp(end) >= dayTimestamp(min)) && (!max || dayTimestamp(start) <= dayTimestamp(max));
  };
  const previousMonth = calendarDate(first.getFullYear(), first.getMonth() - 1, 1);
  const nextMonth = calendarDate(first.getFullYear(), first.getMonth() + 1, 1);
  const monthLabel = new Intl.DateTimeFormat(locale, { year: "numeric", month: "long" }).format(month);
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "short" });
  const dayLabel = new Intl.DateTimeFormat(locale, { dateStyle: "long" });
  return (
    <section {...rootProps} className="pui-calendar" aria-label={ariaLabel} data-pui-owner="Calendar">
      <header>
        <IconButton aria-label={message("calendar.previousMonth")} icon={<ArrowLeft />} disabled={!onMonthChange || !canShowMonth(previousMonth)} onClick={() => onMonthChange?.(previousMonth)} />
        <strong aria-live="polite" aria-atomic="true">{monthLabel}</strong>
        <IconButton aria-label={message("calendar.nextMonth")} icon={<ArrowRight />} disabled={!onMonthChange || !canShowMonth(nextMonth)} onClick={() => onMonthChange?.(nextMonth)} />
      </header>
      <div
        ref={gridRef}
        className="pui-calendar__grid"
        role="grid"
        aria-label={message("calendar.monthLabel", { label: ariaLabel, month: monthLabel })}
        tabIndex={focusDay ? -1 : 0}
        onFocusCapture={() => { gridHasFocusRef.current = true; }}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) gridHasFocusRef.current = false;
        }}
      >
        <div role="row">
          {days.slice(0, 7).map((date) => <span key={`weekday-${date.getDay()}`} role="columnheader">{weekday.format(date)}</span>)}
        </div>
        {Array.from({ length: 6 }, (_, week) => (
          <div role="row" key={`week-${week}`}>
            {days.slice(week * 7, week * 7 + 7).map((date) => {
              const key = calendarDayKey(date);
              const disabled = !isSelectable(date);
              const label = dayLabel.format(date);
              return (
                <div
                  key={key}
                  role="gridcell"
                  aria-label={label}
                  aria-selected={!disabled && Boolean(selectedDate && sameDay(date, selectedDate))}
                  aria-disabled={disabled || undefined}
                  data-calendar-day={key}
                  data-outside={calendarMonthKey(date) !== monthKey || undefined}
                >
                  <button
                    type="button"
                    data-calendar-day={key}
                    tabIndex={!disabled && key === focusKey ? 0 : -1}
                    disabled={disabled}
                    aria-label={label}
                    onFocus={() => setFocusedDate(date)}
                    onKeyDown={(event) => handleDateKeyDown(event, date)}
                    onClick={() => { moveFocus(date); setSelectedDate(calendarDayAtMidnight(date)); }}
                  >
                    {date.getDate()}
                  </button>
                </div>
              );
            })}
          </div>
        ))}
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

export type SchedulerProps = PublicControlProps<Omit<
  HTMLAttributes<HTMLElement>,
  "children"
>> & {
  date: Date;
  events: readonly SchedulerEvent[];
  locale?: string;
  timeZone?: string;
  onEventPress?: (event: SchedulerEvent) => void;
  onDateChange?: (date: Date) => void;
};

export function Scheduler(rawProps: SchedulerProps) {
  const localeContext = usePersonalUILocale();
  const { message } = localeContext;
  const safeProps = sanitizeFixedControlProps(rawProps, ["children"]);
  const {
    date,
    events,
    locale: localeProp,
    timeZone: timeZoneProp,
    onEventPress,
    onDateChange,
    ...rootProps
  } = safeProps;
  const locale = localeProp ?? localeContext.locale;
  const timeZone = timeZoneProp === undefined
    ? localeContext.timeZone
    : assertPersonalUITimeZone(timeZoneProp, "Scheduler");
  assertUniqueIdentities("Scheduler", "event.id", events.map((event) => event.id));
  const formatter = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone });
  const dateLabel = new Intl.DateTimeFormat(locale, { dateStyle: "full", timeZone }).format(date);
  const selectedDay = zonedDayKey(date, timeZone);
  const dayEvents = events.filter((event) => zonedDayKey(event.start, timeZone) === selectedDay).sort((left, right) => left.start.getTime() - right.start.getTime());
  return (
    <section {...rootProps} className="pui-scheduler" data-pui-owner="Scheduler">
      <header>
        <IconButton aria-label={message("scheduler.previousDay")} icon={<ArrowLeft />} disabled={!onDateChange} onClick={() => onDateChange?.(adjacentSchedulerDate(date, -1, timeZone))} />
        <span><CalendarDays aria-hidden="true" /><strong>{dateLabel}</strong></span>
        <IconButton aria-label={message("scheduler.nextDay")} icon={<ArrowRight />} disabled={!onDateChange} onClick={() => onDateChange?.(adjacentSchedulerDate(date, 1, timeZone))} />
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
        {!dayEvents.length ? <li className="pui-scheduler__empty">{message("scheduler.empty")}</li> : null}
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

export type BarChartProps = PublicControlProps<Omit<
  HTMLAttributes<HTMLElement>,
  "aria-label" | "children"
>> & {
  data: readonly ChartDatum[];
  ariaLabel: string;
  formatValue?: (value: number) => ReactNode;
  max?: number;
};

export function BarChart(rawProps: BarChartProps) {
  const safeProps = sanitizeFixedControlProps(rawProps, ["aria-label", "children"]);
  const { data, ariaLabel, formatValue = String, max, ...rootProps } = safeProps;
  assertUniqueIdentities("BarChart", "datum.id", data.map((item) => item.id));
  const ceiling = Math.max(1, max ?? Math.max(0, ...data.map((item) => item.value)));
  return (
    <figure {...rootProps} className="pui-bar-chart" aria-label={ariaLabel} data-pui-owner="BarChart">
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

type CarouselBaseProps = PublicControlProps<Omit<
  HTMLAttributes<HTMLElement>,
  "aria-label" | "children" | "defaultValue" | "onChange"
>> & {
  slides: readonly CarouselSlide[];
  ariaLabel: string;
  loop?: boolean;
  autoplay?: boolean;
  interval?: number;
};

export type CarouselProps = CarouselBaseProps & ControllableValueProps<string>;

export function Carousel(rawProps: CarouselProps) {
  const { message } = usePersonalUILocale();
  const controlled = rawProps.value !== undefined;
  const defaultValueProvided = rawProps.defaultValue !== undefined;
  const safeProps = sanitizeFixedControlProps(rawProps, ["aria-label", "children"]);
  const {
    slides,
    value,
    defaultValue,
    onValueChange,
    ariaLabel,
    loop = false,
    autoplay = false,
    interval = 5000,
    onMouseEnter,
    onMouseLeave,
    onFocusCapture,
    onBlurCapture,
    ...rootProps
  } = safeProps;
  assertUniqueIdentities("Carousel", "slide.id", slides.map((slide) => slide.id));
  const [current, setCurrent] = useControllableState({
    componentName: "Carousel",
    controlled,
    value,
    defaultValue: defaultValue ?? slides[0]?.id ?? "",
    defaultValueProvided,
    onChange: onValueChange,
  });
  const [manualPaused, setManualPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const carouselRef = useRef<HTMLElement>(null);
  const [reducedMotion, setReducedMotion] = useState(() => (
    typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ));
  const selectedIndex = slides.findIndex((slide) => slide.id === current);
  if (slides.length && current && selectedIndex < 0) throw new RangeError(`Carousel cannot find value ${JSON.stringify(current)}.`);
  const currentIndex = Math.max(0, selectedIndex);
  const select = useCallback((index: number) => {
    if (!slides.length) return;
    const resolved = loop ? (index + slides.length) % slides.length : Math.max(0, Math.min(slides.length - 1, index));
    setCurrent(slides[resolved].id);
  }, [loop, setCurrent, slides]);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    const root = carouselRef.current;
    if (!root) return;
    const clearStaleHover = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.contains(event.target)) setHovered(false);
    };
    root.ownerDocument.addEventListener("pointermove", clearStaleHover, true);
    return () => root.ownerDocument.removeEventListener("pointermove", clearStaleHover, true);
  }, []);
  const automaticRotation = autoplay && !manualPaused && !hovered && !focused && !reducedMotion;
  useEffect(() => {
    if (!automaticRotation || slides.length < 2 || (!loop && currentIndex === slides.length - 1)) return;
    const timer = window.setInterval(() => select(currentIndex + 1), Number.isFinite(interval) ? Math.max(1500, interval) : 5000);
    return () => window.clearInterval(timer);
  }, [automaticRotation, currentIndex, interval, loop, select, slides.length]);
  const slide = slides[currentIndex];
  return (
    <section
      {...rootProps}
      ref={carouselRef}
      className="pui-carousel"
      aria-label={ariaLabel}
      onMouseEnter={(event) => {
        setHovered(true);
        onMouseEnter?.(event);
      }}
      onMouseLeave={(event) => {
        setHovered(false);
        onMouseLeave?.(event);
      }}
      onFocusCapture={(event) => {
        setFocused(true);
        onFocusCapture?.(event);
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
        onBlurCapture?.(event);
      }}
      data-pui-owner="Carousel"
    >
      <div
        className="pui-carousel__stage"
        role={slide ? "group" : undefined}
        aria-roledescription={slide ? "slide" : undefined}
        aria-label={slide ? `${currentIndex + 1} / ${slides.length}: ${slide.label}` : undefined}
        aria-live={automaticRotation ? "off" : "polite"}
        aria-atomic="true"
      >{slide?.content}</div>
      <div className="pui-carousel__controls">
        <IconButton aria-label={message("carousel.previous")} icon={<ArrowLeft />} disabled={!slides.length || (!loop && currentIndex === 0)} onClick={() => select(currentIndex - 1)} />
        <div className="pui-carousel__dots">{slides.map((item, index) => <button key={item.id} type="button" aria-label={message("carousel.show", { label: item.label })} aria-current={index === currentIndex} onClick={() => select(index)} />)}</div>
        <IconButton aria-label={message("carousel.next")} icon={<ArrowRight />} disabled={!slides.length || (!loop && currentIndex === slides.length - 1)} onClick={() => select(currentIndex + 1)} />
        {autoplay && slides.length > 1 ? (
          <IconButton
            aria-label={reducedMotion ? message("carousel.reducedMotionPaused") : manualPaused ? message("carousel.resume") : message("carousel.pause")}
            icon={manualPaused ? <Play /> : <Pause />}
            disabled={reducedMotion}
            onClick={() => setManualPaused((state) => !state)}
          />
        ) : null}
      </div>
    </section>
  );
}

export type ResizablePanelsProps = PublicControlProps<Omit<
  HTMLAttributes<HTMLDivElement>,
  "aria-label" | "children"
>> & {
  first: ReactNode;
  second: ReactNode;
  ariaLabel: string;
  orientation?: "horizontal" | "vertical";
  defaultSize?: number;
  minSize?: number;
  maxSize?: number;
  onSizeChange?: (percent: number) => void;
};

export function ResizablePanels(rawProps: ResizablePanelsProps) {
  const safeProps = sanitizeFixedControlProps(rawProps, ["aria-label", "children"]);
  const {
    first,
    second,
    ariaLabel,
    orientation = "horizontal",
    defaultSize = 50,
    minSize = 20,
    maxSize = 80,
    onSizeChange,
    ...rootProps
  } = safeProps;
  const rootRef = useRef<HTMLDivElement>(null);
  const firstPanelId = useId();
  const lowerBound = Math.max(0, Math.min(100, minSize, maxSize));
  const upperBound = Math.max(0, Math.min(100, Math.max(minSize, maxSize)));
  const [localSize, setSize] = useState(Math.min(upperBound, Math.max(lowerBound, defaultSize)));
  const size = Math.min(upperBound, Math.max(lowerBound, localSize));
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const cleanupRef = useRef<() => void>(() => undefined);
  useEffect(() => () => cleanupRef.current(), [orientation, lowerBound, upperBound]);
  const update = (next: number) => {
    const resolved = Math.min(upperBound, Math.max(lowerBound, next));
    if (resolved === sizeRef.current) return;
    sizeRef.current = resolved;
    setSize(resolved);
    onSizeChange?.(resolved);
  };
  const move = (event: PointerEvent) => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return;
    update(orientation === "horizontal" ? (event.clientX - rect.left) / rect.width * 100 : (event.clientY - rect.top) / rect.height * 100);
  };
  const start = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    cleanupRef.current();
    const pointerId = event.pointerId;
    const handle = event.currentTarget;
    event.currentTarget.setPointerCapture(event.pointerId);
    const handleMove = (nativeEvent: PointerEvent) => {
      if (nativeEvent.pointerId === pointerId) move(nativeEvent);
    };
    const handleStop = (nativeEvent: PointerEvent) => {
      if (nativeEvent.pointerId === pointerId) cleanupRef.current();
    };
    const stop = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleStop);
      window.removeEventListener("pointercancel", handleStop);
      if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
      cleanupRef.current = () => undefined;
    };
    cleanupRef.current = stop;
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleStop);
    window.addEventListener("pointercancel", handleStop);
  };
  return (
    <div {...rootProps} ref={rootRef} className={cx("pui-resizable", `pui-resizable--${orientation}`)} style={{ "--pui-panel-size": `${size}%` } as CSSProperties} data-pui-owner="ResizablePanels">
      <div id={firstPanelId} className="pui-resizable__panel">{first}</div>
      <div className="pui-resizable__handle" role="separator" aria-label={ariaLabel} aria-controls={firstPanelId} aria-orientation={orientation} aria-valuemin={lowerBound} aria-valuemax={upperBound} aria-valuenow={Math.round(size)} tabIndex={0} onPointerDown={start} onKeyDown={(event) => {
        const decreaseKey = orientation === "horizontal" ? "ArrowLeft" : "ArrowUp";
        const increaseKey = orientation === "horizontal" ? "ArrowRight" : "ArrowDown";
        const next = event.key === "Home" ? lowerBound : event.key === "End" ? upperBound : event.key === decreaseKey ? size - 2 : event.key === increaseKey ? size + 2 : null;
        if (next !== null) { event.preventDefault(); update(next); }
      }}>{orientation === "horizontal" ? <GripVertical aria-hidden="true" /> : <GripHorizontal aria-hidden="true" />}</div>
      <div className="pui-resizable__panel">{second}</div>
    </div>
  );
}

export type DragDropProps = PublicControlProps<Omit<
  HTMLAttributes<HTMLDivElement>,
  "children" | "aria-label" | "role"
>> & {
  children: ReactNode;
  onFiles: (files: File[]) => void;
  onRejected?: (files: File[]) => void;
  disabled?: boolean;
  accept?: string;
  multiple?: boolean;
  /** Disable only when a companion FileUpload owns the keyboard browse command. */
  showBrowseButton?: boolean;
  browseLabel?: ReactNode;
  ariaLabel?: string;
};

export function DragDrop(rawProps: DragDropProps) {
  const { message } = usePersonalUILocale();
  const safeProps = sanitizeFixedControlProps(rawProps);
  const {
    children,
    onFiles,
    onRejected,
    disabled,
    accept,
    multiple = true,
    showBrowseButton = true,
    browseLabel = message("upload.browse"),
    ariaLabel = message("dragDrop.label"),
    onDragEnter,
    onDragOver,
    onDragLeave,
    onDrop,
    ...rootProps
  } = safeProps;
  const [active, setActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectFiles = (incoming: File[]) => {
    if (disabled) return;
    const accepted: File[] = [];
    const rejected: File[] = [];
    incoming.forEach((file) => {
      if (!matchesFileAccept(file, accept) || (!multiple && accepted.length > 0)) rejected.push(file);
      else accepted.push(file);
    });
    if (accepted.length) onFiles(accepted);
    if (rejected.length) onRejected?.(rejected);
  };
  const readFiles = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setActive(false);
    selectFiles(Array.from(event.dataTransfer.files));
    onDrop?.(event);
  };
  return (
    <div
      {...rootProps}
      className={cx("pui-drag-drop", active && "is-active")}
      role="group"
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      data-accept={accept}
      data-disabled={disabled || undefined}
      onDragEnter={(event) => {
        event.preventDefault();
        if (!disabled) setActive(true);
        onDragEnter?.(event);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        onDragOver?.(event);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setActive(false);
        onDragLeave?.(event);
      }}
      onDrop={readFiles}
      data-pui-owner="DragDrop"
    >
      {children}
      {showBrowseButton ? <>
        <Button size="small" disabled={disabled} onClick={() => inputRef.current?.click()}>{browseLabel}</Button>
        <input ref={inputRef} className="pui-drag-drop__native" type="file" accept={accept} multiple={multiple} disabled={disabled} tabIndex={-1} aria-hidden="true" onChange={(event) => {
          selectFiles(Array.from(event.currentTarget.files ?? []));
          event.currentTarget.value = "";
        }} />
      </> : null}
    </div>
  );
}

export interface SortableItem<T> { id: string; value: T }
export type SortableListProps<T> = PublicControlProps<Omit<
  HTMLAttributes<HTMLOListElement>,
  "aria-label" | "children"
>> & {
  items: readonly SortableItem<T>[];
  renderItem: (value: T) => ReactNode;
  onReorder: (items: SortableItem<T>[]) => void;
  getItemLabel?: (item: SortableItem<T>) => string;
  ariaLabel: string;
  disabled?: boolean;
};

export function SortableList<T>(rawProps: SortableListProps<T>) {
  const { message } = usePersonalUILocale();
  const safeProps = sanitizeFixedControlProps(rawProps, ["aria-label", "children"]);
  const { items, renderItem, onReorder, getItemLabel = (item) => item.id, ariaLabel, disabled, ...rootProps } = safeProps;
  assertUniqueIdentities("SortableList", "item.id", items.map((item) => item.id));
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const moveItem = (from: number, to: number) => {
    if (disabled || to < 0 || to >= items.length || from === to) return;
    const next = items.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onReorder(next);
    setAnnouncement(message("sortable.moved", { label: getItemLabel(moved), position: to + 1 }));
  };
  return (
    <>
      <ol {...rootProps} className="pui-sortable" aria-label={ariaLabel} data-pui-owner="SortableList">
        {items.map((item, index) => {
          const label = getItemLabel(item);
          return (
            <li key={item.id} draggable={!disabled} data-dragging={draggedId === item.id || undefined} onDragStart={() => { if (!disabled) setDraggedId(item.id); }} onDragEnd={() => setDraggedId(null)} onDragOver={(event) => { if (!disabled) event.preventDefault(); }} onDrop={(event) => {
              event.preventDefault();
              const from = items.findIndex((candidate) => candidate.id === draggedId);
              if (from >= 0) moveItem(from, index);
              setDraggedId(null);
            }}>
              <GripVertical aria-hidden="true" />
              <div>{renderItem(item.value)}</div>
              <div className="pui-sortable__actions">
                <IconButton aria-label={message("sortable.moveUp", { label, position: index + 1, total: items.length })} icon={<ArrowUp />} disabled={disabled || index === 0} onClick={() => moveItem(index, index - 1)} />
                <IconButton aria-label={message("sortable.moveDown", { label, position: index + 1, total: items.length })} icon={<ArrowDown />} disabled={disabled || index === items.length - 1} onClick={() => moveItem(index, index + 1)} />
              </div>
            </li>
          );
        })}
      </ol>
      <span className="pui-sr-only" role="status" aria-live="polite">{announcement}</span>
    </>
  );
}

export type ExpandableTextProps = PublicControlProps<Omit<
  HTMLAttributes<HTMLDivElement>,
  "children"
>> & {
  children: string;
  collapsedLines?: number;
  expandLabel?: ReactNode;
  collapseLabel?: ReactNode;
};

export function ExpandableText(rawProps: ExpandableTextProps) {
  const { message } = usePersonalUILocale();
  const safeProps = sanitizeFixedControlProps(rawProps);
  const {
    children,
    collapsedLines = 2,
    expandLabel = message("expandable.expand"),
    collapseLabel = message("expandable.collapse"),
    ...rootProps
  } = safeProps;
  const [expanded, setExpanded] = useState(false);
  return (
    <div {...rootProps} className="pui-expandable-text" data-expanded={expanded || undefined} data-pui-owner="ExpandableText">
      <p style={{ "--pui-clamp-lines": collapsedLines } as CSSProperties}>{children}</p>
      <Button size="small" variant="ghost" onClick={() => setExpanded((state) => !state)}>{expanded ? collapseLabel : expandLabel}</Button>
    </div>
  );
}
