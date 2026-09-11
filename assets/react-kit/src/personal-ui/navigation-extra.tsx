import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { ChevronRight, LoaderCircle, Search } from "lucide-react";
import { Button } from "./primitives";
import { SearchInput } from "./forms";
import { Dialog } from "./overlays";
import { assertUniqueIdentities, cx } from "./utils";

export interface NavigationItem {
  id: string;
  label: ReactNode;
  href?: string;
  icon?: ReactNode;
  active?: boolean;
  disabled?: boolean;
  badge?: ReactNode;
  onSelect?: () => void;
}

export interface AppNavigationProps extends Omit<HTMLAttributes<HTMLElement>, "onSelect"> {
  items: readonly NavigationItem[];
  ariaLabel: string;
  variant?: "top" | "side" | "bottom";
  brand?: ReactNode;
  actions?: ReactNode;
}

type AppNavigationRootProps = AppNavigationProps & {
  owner: "AppNavigation" | "TopNavigation" | "SideNavigation" | "BottomNavigation" | "Menu";
};

function AppNavigationRoot({
  items,
  ariaLabel,
  variant = "top",
  brand,
  actions,
  className,
  owner,
  ...props
}: AppNavigationRootProps) {
  assertUniqueIdentities("AppNavigation", "item.id", items.map((item) => item.id));
  return (
    <nav
      {...props}
      className={cx("pui-app-nav", `pui-app-nav--${variant}`, className)}
      aria-label={ariaLabel}
      data-pui-owner={owner}
      data-variant={variant}
    >
      {brand != null ? <div className="pui-app-nav__brand">{brand}</div> : null}
      <div className="pui-app-nav__items">
        {items.map((item) => {
          const content = (
            <>
              {item.icon != null ? <span className="pui-app-nav__icon" aria-hidden="true">{item.icon}</span> : null}
              <span className="pui-app-nav__label">{item.label}</span>
              {item.badge != null ? <span className="pui-app-nav__badge">{item.badge}</span> : null}
            </>
          );
          return item.href && !item.disabled ? (
            <a
              key={item.id}
              href={item.href}
              className="pui-app-nav__item"
              aria-current={item.active ? "page" : undefined}
              onClick={() => item.onSelect?.()}
            >
              {content}
            </a>
          ) : (
            <button
              key={item.id}
              type="button"
              className="pui-app-nav__item"
              aria-current={item.active ? "page" : undefined}
              aria-pressed={item.href ? undefined : item.active}
              disabled={item.disabled}
              onClick={item.onSelect}
            >
              {content}
            </button>
          );
        })}
      </div>
      {actions != null ? <div className="pui-app-nav__actions">{actions}</div> : null}
    </nav>
  );
}

export function AppNavigation(props: AppNavigationProps) {
  return <AppNavigationRoot {...props} owner="AppNavigation" />;
}

export type NavigationVariantProps = Omit<AppNavigationProps, "variant">;

export function TopNavigation(props: NavigationVariantProps) {
  return <AppNavigationRoot {...props} variant="top" owner="TopNavigation" />;
}

export function SideNavigation(props: NavigationVariantProps) {
  return <AppNavigationRoot {...props} variant="side" owner="SideNavigation" />;
}

export function BottomNavigation(props: NavigationVariantProps) {
  return <AppNavigationRoot {...props} variant="bottom" owner="BottomNavigation" />;
}

export interface MenuProps extends Omit<AppNavigationProps, "variant" | "brand" | "actions"> {
  orientation?: "horizontal" | "vertical";
}

export function Menu({ orientation = "vertical", ...props }: MenuProps) {
  return (
    <AppNavigationRoot
      {...props}
      variant={orientation === "horizontal" ? "top" : "side"}
      className={cx("pui-menu", props.className)}
      owner="Menu"
    />
  );
}

export interface LoadMoreProps {
  onLoadMore: () => void | Promise<void>;
  loading?: boolean;
  disabled?: boolean;
  hasMore?: boolean;
  label?: ReactNode;
  loadingLabel?: ReactNode;
  className?: string;
}

export function LoadMore({
  onLoadMore,
  loading,
  disabled,
  hasMore = true,
  label = "加载更多",
  loadingLabel = "正在加载",
  className,
}: LoadMoreProps) {
  if (!hasMore) return <p className={cx("pui-load-more__end", className)} data-pui-owner="LoadMore">没有更多内容</p>;
  return (
    <div className={cx("pui-load-more", className)} data-pui-owner="LoadMore">
      <Button loading={loading} loadingLabel={loadingLabel} disabled={disabled} onClick={onLoadMore}>{label}</Button>
    </div>
  );
}

export interface InfiniteScrollProps {
  children: ReactNode;
  onLoadMore: () => void | Promise<void>;
  onLoadError?: (error: unknown) => void;
  hasMore: boolean;
  loading?: boolean;
  disabled?: boolean;
  rootMargin?: string;
  loadingLabel?: ReactNode;
  endLabel?: ReactNode;
  className?: string;
}

export function InfiniteScroll({
  children,
  onLoadMore,
  onLoadError,
  hasMore,
  loading = false,
  disabled = false,
  rootMargin = "160px",
  loadingLabel = "正在加载更多内容",
  endLabel = "已经到底了",
  className,
}: InfiniteScrollProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef(false);

  useEffect(() => {
    const target = sentinelRef.current;
    if (!target || !hasMore || loading || disabled || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting) || requestRef.current) return;
      requestRef.current = true;
      Promise.resolve(onLoadMore())
        .catch((error: unknown) => { onLoadError?.(error); })
        .finally(() => { requestRef.current = false; });
    }, { rootMargin });
    observer.observe(target);
    return () => observer.disconnect();
  }, [disabled, hasMore, loading, onLoadError, onLoadMore, rootMargin]);

  return (
    <div className={cx("pui-infinite-scroll", className)} data-pui-owner="InfiniteScroll">
      {children}
      <div ref={sentinelRef} className="pui-infinite-scroll__sentinel" aria-live="polite">
        {loading ? <><LoaderCircle className="pui-spinner" aria-hidden="true" /><span>{loadingLabel}</span></> : null}
        {!hasMore ? <span>{endLabel}</span> : null}
      </div>
    </div>
  );
}

export type StepStatus = "complete" | "current" | "upcoming" | "error";

export interface StepperItem {
  id: string;
  label: ReactNode;
  description?: ReactNode;
  status?: StepStatus;
  disabled?: boolean;
}

export interface StepperProps {
  steps: readonly StepperItem[];
  currentId: string;
  ariaLabel: string;
  orientation?: "horizontal" | "vertical" | "responsive";
  linear?: boolean;
  onStepChange?: (id: string) => void;
  className?: string;
}

export function Stepper({
  steps,
  currentId,
  ariaLabel,
  orientation = "responsive",
  linear = true,
  onStepChange,
  className,
}: StepperProps) {
  assertUniqueIdentities("Stepper", "step.id", steps.map((step) => step.id));
  const currentIndex = steps.findIndex((step) => step.id === currentId);
  if (steps.length && currentIndex < 0) throw new RangeError(`Stepper cannot find currentId ${JSON.stringify(currentId)}.`);
  return (
    <nav className={cx("pui-stepper", `pui-stepper--${orientation}`, className)} aria-label={ariaLabel} data-pui-owner="Stepper">
      <ol>
        {steps.map((step, index) => {
          const status = step.status ?? (index < currentIndex ? "complete" : index === currentIndex ? "current" : "upcoming");
          const canSelect = Boolean(onStepChange && !step.disabled && (!linear || index <= currentIndex));
          const copy = (
            <>
              <span className="pui-stepper__indicator" aria-hidden="true">{status === "complete" ? "✓" : index + 1}</span>
              <span className="pui-stepper__copy"><strong>{step.label}</strong>{step.description != null ? <span>{step.description}</span> : null}</span>
            </>
          );
          return (
            <li key={step.id} data-status={status} aria-current={status === "current" ? "step" : undefined}>
              {canSelect ? <button type="button" onClick={() => onStepChange?.(step.id)}>{copy}</button> : <div>{copy}</div>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export interface CommandItem {
  id: string;
  label: ReactNode;
  textValue: string;
  description?: ReactNode;
  keywords?: string[];
  icon?: ReactNode;
  shortcut?: ReactNode;
  disabled?: boolean;
  onSelect: () => void | Promise<void>;
}

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commands: readonly CommandItem[];
  title?: ReactNode;
  query?: string;
  onQueryChange?: (query: string) => void;
  loading?: boolean;
  onCommandError?: (error: unknown, command: CommandItem) => void;
  emptyText?: ReactNode;
  placeholder?: string;
}

export function CommandPalette({
  open,
  onOpenChange,
  commands,
  title = "命令面板",
  query,
  onQueryChange,
  loading = false,
  onCommandError,
  emptyText = "没有匹配命令",
  placeholder = "搜索命令",
}: CommandPaletteProps) {
  assertUniqueIdentities("CommandPalette", "command.id", commands.map((command) => command.id));
  const [internalQuery, setInternalQuery] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const listboxId = useId();
  const resolvedQuery = query ?? internalQuery;
  const setQuery = onQueryChange ?? setInternalQuery;
  const filtered = useMemo(() => {
    const needle = resolvedQuery.trim().toLocaleLowerCase();
    if (!needle) return commands;
    return commands.filter((command) => `${command.textValue} ${(command.keywords ?? []).join(" ")}`.toLocaleLowerCase().includes(needle));
  }, [commands, resolvedQuery]);

  const enabledCommands = useMemo(() => filtered.filter((command) => !command.disabled), [filtered]);
  const activeIndex = filtered.findIndex((command) => command.id === activeId);

  useEffect(() => {
    if (activeId && enabledCommands.some((command) => command.id === activeId)) return;
    setActiveId(enabledCommands[0]?.id ?? null);
  }, [activeId, enabledCommands]);

  useEffect(() => {
    if (!open || activeIndex < 0 || typeof document === "undefined") return;
    document.getElementById(`${listboxId}-option-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, listboxId, open]);

  const moveActive = (direction: 1 | -1 | "first" | "last") => {
    if (!enabledCommands.length) return;
    if (direction === "first" || direction === "last") {
      setActiveId(enabledCommands[direction === "first" ? 0 : enabledCommands.length - 1].id);
      return;
    }
    const currentIndex = enabledCommands.findIndex((command) => command.id === activeId);
    const startIndex = currentIndex < 0 ? (direction === 1 ? -1 : 0) : currentIndex;
    setActiveId(enabledCommands[(startIndex + direction + enabledCommands.length) % enabledCommands.length].id);
  };

  const selectCommand = async (command: CommandItem) => {
    if (command.disabled || pendingId || loading) return;
    setPendingId(command.id);
    try {
      await command.onSelect();
      onOpenChange(false);
    } catch (error) {
      onCommandError?.(error, command);
    } finally {
      setPendingId(null);
    }
  };

  const handleSearchKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      moveActive(event.key === "ArrowDown" ? 1 : -1);
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      moveActive(event.key === "Home" ? "first" : "last");
      return;
    }
    if (event.key === "Enter") {
      const command = enabledCommands.find((candidate) => candidate.id === activeId) ?? enabledCommands[0];
      if (command) {
        event.preventDefault();
        void selectCommand(command);
      }
    }
  };

  return (
    <Dialog open={open} onClose={() => onOpenChange(false)} title={title} width="medium">
      <div className="pui-command" data-pui-owner="CommandPalette">
        <SearchInput
          value={resolvedQuery}
          placeholder={placeholder}
          aria-label={placeholder}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded="true"
          aria-controls={listboxId}
          aria-activedescendant={activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
          onChange={(event) => setQuery(event.target.value)}
          onClear={resolvedQuery ? () => setQuery("") : undefined}
          onKeyDown={handleSearchKeyDown}
        />
        <div id={listboxId} className="pui-command__results" role="listbox" aria-label={typeof title === "string" ? title : "命令"} aria-busy={loading || undefined}>
          {loading ? <div className="pui-command__status"><LoaderCircle className="pui-spinner" aria-hidden="true" />正在加载</div> : null}
          {!loading && !filtered.length ? <div className="pui-command__status">{emptyText}</div> : null}
          {!loading ? filtered.map((command) => (
            <button
              key={command.id}
              id={`${listboxId}-option-${filtered.findIndex((candidate) => candidate.id === command.id)}`}
              type="button"
              role="option"
              aria-selected={command.id === activeId}
              disabled={command.disabled || Boolean(pendingId)}
              onMouseMove={() => setActiveId(command.id)}
              onClick={() => void selectCommand(command)}
            >
              <span className="pui-command__icon" aria-hidden="true">{pendingId === command.id ? <LoaderCircle className="pui-spinner" /> : command.icon ?? <Search />}</span>
              <span className="pui-command__copy"><strong>{command.label}</strong>{command.description != null ? <span>{command.description}</span> : null}</span>
              {command.shortcut != null ? <span className="pui-command__shortcut">{command.shortcut}</span> : null}
            </button>
          )) : null}
        </div>
      </div>
    </Dialog>
  );
}

export interface CommandPaletteShortcutOptions {
  enabled?: boolean;
  key?: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  onOpen: () => void;
}

export function useCommandPaletteShortcut({ enabled = true, key = "k", metaKey = true, ctrlKey = true, onOpen }: CommandPaletteShortcutOptions) {
  useEffect(() => {
    if (!enabled) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLocaleLowerCase() !== key.toLocaleLowerCase()) return;
      if (!(metaKey && event.metaKey) && !(ctrlKey && event.ctrlKey)) return;
      event.preventDefault();
      onOpen();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [ctrlKey, enabled, key, metaKey, onOpen]);
}

export interface AnchorItem {
  id: string;
  label: ReactNode;
  href: `#${string}`;
}

export interface AnchorNavigationProps {
  items: readonly AnchorItem[];
  ariaLabel?: string;
  activeId?: string;
  onNavigate?: (id: string) => void;
  className?: string;
}

export function AnchorNavigation({ items, ariaLabel = "页面目录", activeId, onNavigate, className }: AnchorNavigationProps) {
  assertUniqueIdentities("AnchorNavigation", "item.id", items.map((item) => item.id));
  return (
    <nav className={cx("pui-anchor-nav", className)} aria-label={ariaLabel} data-pui-owner="AnchorNavigation">
      {items.map((item) => (
        <a key={item.id} href={item.href} aria-current={activeId === item.id ? "location" : undefined} onClick={() => onNavigate?.(item.id)}>
          <span>{item.label}</span><ChevronRight aria-hidden="true" />
        </a>
      ))}
    </nav>
  );
}
