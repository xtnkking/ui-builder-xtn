import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { ChevronLeft, ChevronRight, LoaderCircle } from "lucide-react";
import { IconButton } from "./primitives";
import { Select } from "./forms";
import { assertUniqueIdentities, cx } from "./utils";

function domIdToken(value: string): string {
  return Array.from(value, (character) => character.codePointAt(0)!.toString(16)).join("-") || "empty";
}

const useClientLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

function nextAvailableTabValue(items: readonly TabItem[], value: string): string | undefined {
  const currentIndex = items.findIndex((item) => item.id === value);
  if (currentIndex < 0) return items.find((item) => !item.disabled)?.id;
  if (!items[currentIndex].disabled) return value;

  for (let offset = 1; offset < items.length; offset += 1) {
    const candidate = items[(currentIndex + offset) % items.length];
    if (!candidate.disabled) return candidate.id;
  }
  return undefined;
}

export interface TabItem {
  id: string;
  label: ReactNode;
  content: ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  value: string;
  onValueChange: (value: string) => void;
  ariaLabel: string;
  fill?: boolean;
  className?: string;
}

export function Tabs({ items, value, onValueChange, ariaLabel, fill, className }: TabsProps) {
  assertUniqueIdentities("Tabs", "item.id", items.map((item) => item.id));
  const instanceId = useId();
  const tabListRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());
  const lastFocusedTabIdRef = useRef<string | null>(null);
  const lastReconciledValueRef = useRef<{ from: string; to: string } | null>(null);
  const enabledItems = items.filter((item) => !item.disabled);
  const enabledIdsRef = useRef(new Set(enabledItems.map((item) => item.id)));
  enabledIdsRef.current = new Set(enabledItems.map((item) => item.id));
  const selectedValue = nextAvailableTabValue(items, value);

  useEffect(() => {
    if (!selectedValue || selectedValue === value) {
      lastReconciledValueRef.current = null;
      return;
    }
    const previous = lastReconciledValueRef.current;
    if (previous?.from === value && previous.to === selectedValue) return;
    lastReconciledValueRef.current = { from: value, to: selectedValue };
    onValueChange(selectedValue);
  }, [onValueChange, selectedValue, value]);

  useClientLayoutEffect(() => {
    const previouslyFocusedId = lastFocusedTabIdRef.current;
    if (!previouslyFocusedId || enabledIdsRef.current.has(previouslyFocusedId)) return;

    const activeElement = document.activeElement;
    if (
      activeElement
      && activeElement !== document.body
      && !tabListRef.current?.contains(activeElement)
    ) {
      lastFocusedTabIdRef.current = null;
      return;
    }

    const nextTab = selectedValue ? tabRefs.current.get(selectedValue) : undefined;
    if (nextTab) {
      nextTab.focus();
      lastFocusedTabIdRef.current = selectedValue ?? null;
    } else {
      lastFocusedTabIdRef.current = null;
    }
  }, [items, selectedValue]);

  const handleBlur = (event: FocusEvent<HTMLButtonElement>, itemId: string) => {
    const relatedTarget = event.relatedTarget;
    if (
      relatedTarget instanceof HTMLElement
      && relatedTarget !== document.body
      && !tabListRef.current?.contains(relatedTarget)
    ) {
      lastFocusedTabIdRef.current = null;
      return;
    }

    queueMicrotask(() => {
      if (lastFocusedTabIdRef.current !== itemId) return;
      const activeElement = document.activeElement;
      if (activeElement && tabListRef.current?.contains(activeElement)) return;
      if (enabledIdsRef.current.has(itemId)) lastFocusedTabIdRef.current = null;
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, itemId: string) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key) || !enabledItems.length) return;
    event.preventDefault();

    const currentIndex = enabledItems.findIndex((item) => item.id === itemId);
    let nextIndex: number;
    if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = enabledItems.length - 1;
    } else {
      const direction = event.key === "ArrowRight" ? 1 : -1;
      const startingIndex = currentIndex >= 0 ? currentIndex : 0;
      nextIndex = (startingIndex + direction + enabledItems.length) % enabledItems.length;
    }

    const nextItem = enabledItems[nextIndex];
    tabRefs.current.get(nextItem.id)?.focus();
    if (nextItem.id !== selectedValue) onValueChange(nextItem.id);
  };

  return (
    <div className={cx("pui-tabs", fill && "pui-tabs--fill", className)}>
      <div ref={tabListRef} className="pui-tabs__list" role="tablist" aria-label={ariaLabel}>
        {items.map((item) => (
          <button
            id={`${instanceId}-tab-${domIdToken(item.id)}`}
            key={item.id}
            type="button"
            role="tab"
            aria-selected={item.id === selectedValue}
            aria-controls={`${instanceId}-panel-${domIdToken(item.id)}`}
            disabled={item.disabled}
            tabIndex={item.id === selectedValue ? 0 : -1}
            ref={(node) => {
              if (node) tabRefs.current.set(item.id, node);
              else tabRefs.current.delete(item.id);
            }}
            onKeyDown={(event) => handleKeyDown(event, item.id)}
            onFocus={() => { lastFocusedTabIdRef.current = item.id; }}
            onBlur={(event) => handleBlur(event, item.id)}
            onClick={() => {
              if (item.id !== selectedValue) onValueChange(item.id);
            }}
            title={typeof item.label === "string" || typeof item.label === "number" ? String(item.label) : undefined}
          >
            {item.label}
          </button>
        ))}
      </div>
      {items.map((item) => (
        <div
          id={`${instanceId}-panel-${domIdToken(item.id)}`}
          key={item.id}
          role="tabpanel"
          aria-labelledby={`${instanceId}-tab-${domIdToken(item.id)}`}
          hidden={item.id !== selectedValue}
          className="pui-tabs__panel"
        >
          {item.content}
        </div>
      ))}
    </div>
  );
}

export interface BreadcrumbItem {
  id: string;
  label: ReactNode;
  href?: string;
  onClick?: () => void;
}

export function Breadcrumbs({ items, ariaLabel = "面包屑" }: { items: BreadcrumbItem[]; ariaLabel?: string }) {
  assertUniqueIdentities("Breadcrumbs", "item.id", items.map((item) => item.id));
  return (
    <nav className="pui-breadcrumbs" aria-label={ariaLabel}>
      <ol>
        {items.map((item, index) => {
          const current = index === items.length - 1;
          const title = typeof item.label === "string" || typeof item.label === "number" ? String(item.label) : undefined;
          return (
            <li key={item.id}>
              {item.href && !current ? <a href={item.href} title={title}>{item.label}</a> : item.onClick && !current ? (
                <button type="button" title={title} onClick={item.onClick}>{item.label}</button>
              ) : <span title={title} aria-current={current ? "page" : undefined}>{item.label}</span>}
              {!current ? <span aria-hidden="true">/</span> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

type PageToken = number | "ellipsis-start" | "ellipsis-end";

function pageTokens(page: number, pageCount: number): PageToken[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1);

  const pages = Array.from(new Set([1, page - 1, page, page + 1, pageCount]))
    .filter((candidate) => candidate >= 1 && candidate <= pageCount)
    .sort((left, right) => left - right);
  const tokens: PageToken[] = [];
  pages.forEach((current, index) => {
    const previous = pages[index - 1];
    const gap = index ? current - previous : 0;
    if (gap === 2) tokens.push(previous + 1);
    else if (gap > 2) tokens.push(current < page ? "ellipsis-start" : "ellipsis-end");
    tokens.push(current);
  });
  return tokens;
}

function finiteInteger(value: number, fallback: number, minimum: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Number.MAX_SAFE_INTEGER, Math.max(minimum, Math.trunc(value)));
}

function normalizePage(value: number, pageCount: number, fallback = 1) {
  return Math.min(pageCount, finiteInteger(value, fallback, 1));
}

export interface PaginationProps {
  page: number;
  pageCount: number;
  onPageChange: (page: number, trigger: PaginationPageTrigger) => void;
  disabled?: boolean;
  loadingPage?: number;
  loadingTarget?: PaginationLoadingTarget;
  loadingPageSize?: boolean;
  total?: number;
  pageSize?: number;
  pageSizeOptions?: number[];
  onPageSizeChange?: (pageSize: number) => void;
  className?: string;
}

export type PaginationPageTrigger = "page" | "previous" | "next";
export type PaginationLoadingTarget = PaginationPageTrigger | "auto";

export function Pagination({
  page,
  pageCount,
  onPageChange,
  disabled,
  loadingPage,
  loadingTarget = "auto",
  loadingPageSize,
  total,
  pageSize,
  pageSizeOptions = [10, 20, 50],
  onPageSizeChange,
  className,
}: PaginationProps) {
  const rootRef = useRef<HTMLElement>(null);
  const [availableWidth, setAvailableWidth] = useState(0);
  const normalizedCount = finiteInteger(pageCount, 1, 1);
  const normalizedPage = normalizePage(page, normalizedCount);
  const changingPage = typeof loadingPage === "number"
    && Number.isInteger(loadingPage)
    && loadingPage >= 1
    && loadingPage <= normalizedCount;
  const normalizedLoadingPage = changingPage
    ? normalizePage(loadingPage, normalizedCount, normalizedPage)
    : undefined;
  const hasPageSizeControl = typeof pageSize === "number"
    && Number.isFinite(pageSize)
    && pageSize > 0
    && typeof onPageSizeChange === "function";
  const changingPageSize = Boolean(loadingPageSize && hasPageSizeControl);
  const paginationBusy = changingPage || changingPageSize;
  const compact = availableWidth > 0 && availableWidth <= 600;
  const resolvedLoadingTarget: PaginationPageTrigger = loadingTarget === "previous"
    && normalizedLoadingPage === normalizedPage - 1
    ? "previous"
    : loadingTarget === "next" && normalizedLoadingPage === normalizedPage + 1
      ? "next"
      : loadingTarget === "auto" && compact && normalizedLoadingPage === normalizedPage - 1
        ? "previous"
        : loadingTarget === "auto" && compact && normalizedLoadingPage === normalizedPage + 1
          ? "next"
          : "page";
  const tokens = useMemo(
    () => pageTokens(normalizedPage, normalizedCount),
    [normalizedPage, normalizedCount],
  );
  const normalizedTotal = typeof total === "number" && Number.isFinite(total)
    ? finiteInteger(total, 0, 0)
    : undefined;
  const normalizedPageSize = typeof pageSize === "number" && Number.isFinite(pageSize) && pageSize > 0
    ? finiteInteger(pageSize, 1, 1)
    : undefined;
  const normalizedPageSizeOptions = Array.from(new Set(
    [normalizedPageSize, ...(Array.isArray(pageSizeOptions) ? pageSizeOptions : [])]
      .filter((option): option is number => option !== undefined)
      .filter((option) => Number.isFinite(option) && option > 0)
      .map((option) => finiteInteger(option, 1, 1)),
  )).sort((left, right) => left - right);
  const start = normalizedTotal && normalizedPageSize
    ? Math.min((normalizedPage - 1) * normalizedPageSize + 1, normalizedTotal)
    : 0;
  const end = normalizedTotal && normalizedPageSize
    ? Math.min(normalizedPage * normalizedPageSize, normalizedTotal)
    : 0;

  useClientLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const measure = () => {
      const nextWidth = root.clientWidth;
      setAvailableWidth((currentWidth) => currentWidth === nextWidth ? currentWidth : nextWidth);
    };
    measure();
    if (typeof ResizeObserver !== "function") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  return (
    <nav ref={rootRef} className={cx("pui-pagination", className)} aria-label="数据分页" aria-busy={paginationBusy || undefined}>
      <span className="pui-pagination__summary">
        {normalizedTotal !== undefined && normalizedPageSize
          ? (normalizedTotal ? `${start}-${end} / 共 ${normalizedTotal} 条` : "0 条结果")
          : `${normalizedPage} / ${normalizedCount} 页`}
      </span>
      <div className="pui-pagination__controls">
        {normalizedPageSize && onPageSizeChange ? (
          <Select
            ariaLabel="每页数量"
            value={String(normalizedPageSize)}
            disabled={disabled}
            aria-disabled={paginationBusy || undefined}
            loading={changingPageSize}
            loadingLabel="正在更新每页数量"
            placement="top"
            options={normalizedPageSizeOptions.map((option) => ({ value: String(option), label: `${option} 条` }))}
            onValueChange={(value) => {
              if (!paginationBusy) onPageSizeChange(Number(value));
            }}
          />
        ) : null}
        <IconButton
          aria-label="上一页"
          icon={<ChevronLeft aria-hidden="true" />}
          loading={changingPage && resolvedLoadingTarget === "previous" && normalizedLoadingPage === normalizedPage - 1}
          disabled={disabled || normalizedPage <= 1}
          aria-disabled={paginationBusy || undefined}
          onClick={() => {
            if (!paginationBusy) onPageChange(normalizedPage - 1, "previous");
          }}
        />
        <div className="pui-pagination__pages">
          {tokens.map((token) => typeof token === "number" ? (
            <button
              key={token}
              type="button"
              className="pui-page-button"
              aria-current={token === normalizedPage ? "page" : undefined}
              aria-label={resolvedLoadingTarget === "page" && token === normalizedLoadingPage ? `正在加载第 ${token} 页` : `第 ${token} 页`}
              aria-busy={resolvedLoadingTarget === "page" && token === normalizedLoadingPage || undefined}
              data-loading={resolvedLoadingTarget === "page" && token === normalizedLoadingPage || undefined}
              disabled={disabled}
              aria-disabled={paginationBusy || undefined}
              onClick={() => {
                if (!paginationBusy && token !== normalizedPage) onPageChange(token, "page");
              }}
            >
              {resolvedLoadingTarget === "page" && token === normalizedLoadingPage
                ? <LoaderCircle className="pui-spinner" aria-hidden="true" />
                : <span className="pui-page-button__label" title={String(token)}>{token}</span>}
            </button>
          ) : <span key={token} className="pui-pagination__ellipsis" aria-hidden="true">...</span>)}
        </div>
        <span className="pui-pagination__mobile-label" title={`${normalizedPage} / ${normalizedCount} 页`}>
          {normalizedPage} / {normalizedCount} 页
        </span>
        <IconButton
          aria-label="下一页"
          icon={<ChevronRight aria-hidden="true" />}
          loading={changingPage && resolvedLoadingTarget === "next" && normalizedLoadingPage === normalizedPage + 1}
          disabled={disabled || normalizedPage >= normalizedCount}
          aria-disabled={paginationBusy || undefined}
          onClick={() => {
            if (!paginationBusy) onPageChange(normalizedPage + 1, "next");
          }}
        />
      </div>
    </nav>
  );
}
