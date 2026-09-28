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
import type { ControllableOpenProps, PublicControlProps } from "../foundation/contracts";
import { useControllableState } from "../internal/controllable-state";
import { Button } from "../foundation/primitives";
import { SearchInput } from "../input/forms";
import { Dialog } from "../overlay/overlays";
import { sanitizeFixedControlProps } from "../internal/fixed-control-props";
import { usePersonalUILocale } from "../foundation/locale";
import { assertUniqueIdentities, cx } from "../internal/utils";

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

type AppNavigationSharedProps = Omit<
  HTMLAttributes<HTMLElement>,
  "aria-label" | "children" | "onSelect"
> & {
  items: readonly NavigationItem[];
  ariaLabel: string;
  brand?: ReactNode;
  actions?: ReactNode;
};

export type AppNavigationProps = PublicControlProps<AppNavigationSharedProps & {
  variant?: "top" | "side" | "bottom";
}>;

type AppNavigationRootProps = AppNavigationProps & {
  className?: string;
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

export function AppNavigation(rawProps: AppNavigationProps) {
  const safeProps = sanitizeFixedControlProps(rawProps, ["aria-label", "children"]);
  return <AppNavigationRoot {...safeProps} owner="AppNavigation" />;
}

export type NavigationVariantProps = PublicControlProps<AppNavigationSharedProps>;

export function TopNavigation(rawProps: NavigationVariantProps) {
  const safeProps = sanitizeFixedControlProps(rawProps, ["aria-label", "children", "variant"]);
  return <AppNavigationRoot {...safeProps} variant="top" owner="TopNavigation" />;
}

export function SideNavigation(rawProps: NavigationVariantProps) {
  const safeProps = sanitizeFixedControlProps(rawProps, ["aria-label", "children", "variant"]);
  return <AppNavigationRoot {...safeProps} variant="side" owner="SideNavigation" />;
}

export function BottomNavigation(rawProps: NavigationVariantProps) {
  const safeProps = sanitizeFixedControlProps(rawProps, ["aria-label", "children", "variant"]);
  return <AppNavigationRoot {...safeProps} variant="bottom" owner="BottomNavigation" />;
}

export type MenuProps = PublicControlProps<Omit<AppNavigationSharedProps, "brand" | "actions"> & {
  orientation?: "horizontal" | "vertical";
}>;

export function Menu(rawProps: MenuProps) {
  const safeProps = sanitizeFixedControlProps(rawProps, ["actions", "aria-label", "brand", "children", "variant"]);
  const { orientation = "vertical", ...props } = safeProps;
  return (
    <AppNavigationRoot
      {...props}
      variant={orientation === "horizontal" ? "top" : "side"}
      className="pui-menu"
      owner="Menu"
    />
  );
}

export type LoadMoreProps = PublicControlProps<Omit<
  HTMLAttributes<HTMLElement>,
  "children"
>> & {
  onLoadMore: () => void | Promise<void>;
  loading?: boolean;
  disabled?: boolean;
  hasMore?: boolean;
  label?: ReactNode;
  loadingLabel?: ReactNode;
};

export function LoadMore(rawProps: LoadMoreProps) {
  const { message } = usePersonalUILocale();
  const safeProps = sanitizeFixedControlProps(rawProps, ["children"]);
  const {
    onLoadMore,
    loading,
    disabled,
    hasMore = true,
    label = message("loadMore.label"),
    loadingLabel = message("loadMore.loading"),
    ...rootProps
  } = safeProps;
  if (!hasMore) return <p {...rootProps} className="pui-load-more__end" data-pui-owner="LoadMore">{message("loadMore.end")}</p>;
  return (
    <div {...rootProps} className="pui-load-more" data-pui-owner="LoadMore">
      <Button loading={loading} loadingLabel={loadingLabel} disabled={disabled} onClick={onLoadMore}>{label}</Button>
    </div>
  );
}

export type InfiniteScrollProps = PublicControlProps<Omit<
  HTMLAttributes<HTMLDivElement>,
  "children"
>> & {
  children: ReactNode;
  onLoadMore: () => void | Promise<void>;
  onLoadError?: (error: unknown) => void;
  hasMore: boolean;
  loadKey: string | number;
  loading?: boolean;
  disabled?: boolean;
  rootMargin?: string;
  loadingLabel?: ReactNode;
  endLabel?: ReactNode;
};

export function InfiniteScroll(rawProps: InfiniteScrollProps) {
  const { message } = usePersonalUILocale();
  const safeProps = sanitizeFixedControlProps(rawProps);
  const {
    children,
    onLoadMore,
    onLoadError,
    hasMore,
    loadKey,
    loading = false,
    disabled = false,
    rootMargin = "160px",
    loadingLabel = message("loadMore.loadingContent"),
    endLabel = message("infiniteScroll.end"),
    ...rootProps
  } = safeProps;
  if (loadKey === undefined || loadKey === null) {
    throw new TypeError("InfiniteScroll requires loadKey; advance it when the caller's cursor changes.");
  }
  const sentinelRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef(false);
  const requestedKeyRef = useRef<{ value: string | number | undefined } | null>(null);
  const [requestPending, setRequestPending] = useState(false);

  useEffect(() => {
    const target = sentinelRef.current;
    if (!target || !hasMore || loading || disabled || requestPending || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting) || requestRef.current || (requestedKeyRef.current && Object.is(requestedKeyRef.current.value, loadKey))) return;
      requestedKeyRef.current = { value: loadKey };
      requestRef.current = true;
      setRequestPending(true);
      Promise.resolve().then(onLoadMore)
        .catch((error: unknown) => { onLoadError?.(error); })
        .finally(() => {
          requestRef.current = false;
          setRequestPending(false);
        });
    }, { rootMargin });
    observer.observe(target);
    return () => observer.disconnect();
  }, [disabled, hasMore, loadKey, loading, onLoadError, onLoadMore, requestPending, rootMargin]);

  return (
    <div {...rootProps} className="pui-infinite-scroll" data-pui-owner="InfiniteScroll">
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

export type StepperProps = PublicControlProps<Omit<
  HTMLAttributes<HTMLElement>,
  "aria-label" | "children"
>> & {
  steps: readonly StepperItem[];
  currentId: string;
  ariaLabel: string;
  orientation?: "horizontal" | "vertical" | "responsive";
  linear?: boolean;
  onStepChange?: (id: string) => void;
};

export function Stepper(rawProps: StepperProps) {
  const safeProps = sanitizeFixedControlProps(rawProps, ["aria-label", "children"]);
  const {
    steps,
    currentId,
    ariaLabel,
    orientation = "responsive",
    linear = true,
    onStepChange,
    ...rootProps
  } = safeProps;
  assertUniqueIdentities("Stepper", "step.id", steps.map((step) => step.id));
  const currentIndex = steps.findIndex((step) => step.id === currentId);
  if (steps.length && currentIndex < 0) throw new RangeError(`Stepper cannot find currentId ${JSON.stringify(currentId)}.`);
  return (
    <nav {...rootProps} className={cx("pui-stepper", `pui-stepper--${orientation}`)} aria-label={ariaLabel} data-pui-owner="Stepper">
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

type CommandPaletteBaseProps = PublicControlProps<{
  commands: readonly CommandItem[];
  title?: ReactNode;
  loading?: boolean;
  onCommandError?: (error: unknown, command: CommandItem) => void;
  emptyText?: ReactNode;
  placeholder?: string;
}>;

type CommandPaletteQueryProps =
  | {
      query: string;
      defaultQuery?: never;
      onQueryChange: (query: string) => void;
    }
  | {
      query?: never;
      defaultQuery?: string;
      onQueryChange?: (query: string) => void;
    };

export type CommandPaletteProps = CommandPaletteBaseProps
  & ControllableOpenProps
  & CommandPaletteQueryProps;

export function CommandPalette(rawProps: CommandPaletteProps) {
  const { message } = usePersonalUILocale();
  const controlledOpen = rawProps.open !== undefined;
  const defaultOpenProvided = rawProps.defaultOpen !== undefined;
  const controlledQuery = rawProps.query !== undefined;
  const defaultQueryProvided = rawProps.defaultQuery !== undefined;
  const safeProps = sanitizeFixedControlProps(rawProps);
  const {
    open: openProp,
    defaultOpen,
    onOpenChange,
    commands,
    title = message("command.title"),
    query,
    defaultQuery,
    onQueryChange,
    loading = false,
    onCommandError,
    emptyText = message("command.empty"),
    placeholder = message("command.search"),
  } = safeProps;
  const [open, setOpen] = useControllableState({
    componentName: "CommandPalette",
    controlled: controlledOpen,
    value: openProp,
    defaultValue: defaultOpen ?? false,
    defaultValueProvided: defaultOpenProvided,
    onChange: onOpenChange,
    valuePropName: "open",
    defaultValuePropName: "defaultOpen",
    changePropName: "onOpenChange",
  });
  const [resolvedQuery, setQuery] = useControllableState({
    componentName: "CommandPalette query",
    controlled: controlledQuery,
    value: query,
    defaultValue: defaultQuery ?? "",
    defaultValueProvided: defaultQueryProvided,
    onChange: onQueryChange,
    valuePropName: "query",
    defaultValuePropName: "defaultQuery",
    changePropName: "onQueryChange",
  });
  assertUniqueIdentities("CommandPalette", "command.id", commands.map((command) => command.id));
  const [pendingId, setPendingId] = useState<string | null>(null);
  const pendingRef = useRef(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const listboxId = useId();
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
    if (command.disabled || pendingRef.current || loading) return;
    pendingRef.current = true;
    setPendingId(command.id);
    try {
      await command.onSelect();
      setOpen(false);
    } catch (error) {
      onCommandError?.(error, command);
    } finally {
      pendingRef.current = false;
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
    <Dialog open={open} onOpenChange={setOpen} title={title} width="medium">
      <div className="pui-command" data-pui-owner="CommandPalette">
        <SearchInput
          value={resolvedQuery}
          autoFocus
          placeholder={placeholder}
          aria-label={placeholder}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded="true"
          aria-controls={listboxId}
          aria-activedescendant={!loading && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
          onChange={(event) => setQuery(event.target.value)}
          onClear={resolvedQuery ? () => setQuery("") : undefined}
          onKeyDown={handleSearchKeyDown}
        />
        <div id={listboxId} className="pui-command__results" role="listbox" aria-label={typeof title === "string" ? title : message("command.results")} aria-busy={loading || undefined}>
          {loading ? <div className="pui-command__status"><LoaderCircle className="pui-spinner" aria-hidden="true" />{message("common.loading")}</div> : null}
          {!loading && !filtered.length ? <div className="pui-command__status">{emptyText}</div> : null}
          {!loading ? filtered.map((command, index) => (
            <button
              key={command.id}
              id={`${listboxId}-option-${index}`}
              type="button"
              role="option"
              aria-selected={command.id === activeId}
              disabled={command.disabled || Boolean(pendingId)}
              onMouseMove={() => { if (!command.disabled) setActiveId(command.id); }}
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

export type AnchorNavigationProps = PublicControlProps<Omit<
  HTMLAttributes<HTMLElement>,
  "aria-label" | "children"
>> & {
  items: readonly AnchorItem[];
  ariaLabel?: string;
  activeId?: string;
  onNavigate?: (id: string) => void;
};

export function AnchorNavigation(rawProps: AnchorNavigationProps) {
  const { message } = usePersonalUILocale();
  const safeProps = sanitizeFixedControlProps(rawProps, ["aria-label", "children"]);
  const { items, ariaLabel = message("anchor.label"), activeId, onNavigate, ...rootProps } = safeProps;
  assertUniqueIdentities("AnchorNavigation", "item.id", items.map((item) => item.id));
  return (
    <nav {...rootProps} className="pui-anchor-nav" aria-label={ariaLabel} data-pui-owner="AnchorNavigation">
      {items.map((item) => (
        <a key={item.id} href={item.href} aria-current={activeId === item.id ? "location" : undefined} onClick={() => onNavigate?.(item.id)}>
          <span>{item.label}</span><ChevronRight aria-hidden="true" />
        </a>
      ))}
    </nav>
  );
}
