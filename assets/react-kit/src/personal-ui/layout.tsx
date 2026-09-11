import {
  createElement,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { usePersonalUiPortalTokens } from "./portal-tokens";
import { cx, getTabStops, isVisibleElement, type CSSVariableProperties } from "./utils";

export type ThemeMode = "inherit" | "light" | "dark" | "system";
export type ThemeTokens = Partial<Record<`--pui-${string}`, string | number>>;

export interface ThemeProviderProps extends HTMLAttributes<HTMLDivElement> {
  mode?: ThemeMode;
  tokens?: ThemeTokens;
}

export function ThemeProvider({
  mode = "inherit",
  tokens,
  className,
  style,
  children,
  ...props
}: ThemeProviderProps) {
  Object.keys(tokens ?? {}).forEach((token) => {
    if (!token.startsWith("--pui-")) {
      throw new Error(`ThemeProvider received an unsupported token ${JSON.stringify(token)}.`);
    }
  });
  const resolvedStyle = { ...tokens, ...style } as CSSVariableProperties;
  return (
    <div
      {...props}
      data-pui-owner="ThemeProvider"
      className={cx("pui-theme", "pui-root", className)}
      data-color-scheme={mode === "inherit" ? undefined : mode}
      style={resolvedStyle}
    >
      {children}
    </div>
  );
}

export type LayoutSpace = "none" | "xsmall" | "small" | "medium" | "large" | "xlarge";
export type BoxSurface = "transparent" | "default" | "subtle" | "raised";

export interface BoxProps extends HTMLAttributes<HTMLDivElement> {
  padding?: LayoutSpace;
  surface?: BoxSurface;
}

export function Box({
  padding = "none",
  surface = "transparent",
  className,
  children,
  ...props
}: BoxProps) {
  return (
    <div
      {...props}
      data-pui-owner="Box"
      className={cx("pui-box", `pui-box--pad-${padding}`, `pui-box--${surface}`, className)}
    >
      {children}
    </div>
  );
}

export interface StackProps extends HTMLAttributes<HTMLDivElement> {
  gap?: LayoutSpace;
  align?: "stretch" | "start" | "center" | "end";
}

export function Stack({ gap = "medium", align = "stretch", className, children, ...props }: StackProps) {
  return (
    <div {...props} data-pui-owner="Stack" className={cx("pui-stack", className)} data-gap={gap} data-align={align}>
      {children}
    </div>
  );
}

export interface InlineProps extends HTMLAttributes<HTMLDivElement> {
  gap?: LayoutSpace;
  align?: "start" | "center" | "end" | "baseline" | "stretch";
  justify?: "start" | "center" | "end" | "between";
  wrap?: boolean;
}

export function Inline({
  gap = "small",
  align = "center",
  justify = "start",
  wrap = true,
  className,
  children,
  ...props
}: InlineProps) {
  return (
    <div
      {...props}
      data-pui-owner="Inline"
      className={cx("pui-inline", className)}
      data-gap={gap}
      data-align={align}
      data-justify={justify}
      data-wrap={wrap || undefined}
    >
      {children}
    </div>
  );
}

export interface GridProps extends HTMLAttributes<HTMLDivElement> {
  gap?: LayoutSpace;
  columns?: 1 | 2 | 3 | 4 | 5 | 6;
  minItemWidth?: CSSProperties["width"];
}

export function Grid({
  gap = "medium",
  columns,
  minItemWidth = "220px",
  className,
  style,
  children,
  ...props
}: GridProps) {
  const resolvedStyle = {
    "--pui-grid-columns": columns,
    "--pui-grid-min": typeof minItemWidth === "number" ? `${minItemWidth}px` : minItemWidth,
    ...style,
  } as CSSVariableProperties;
  return (
    <div
      {...props}
      data-pui-owner="Grid"
      className={cx("pui-grid", columns && "pui-grid--fixed", className)}
      data-gap={gap}
      style={resolvedStyle}
    >
      {children}
    </div>
  );
}

export interface DividerProps extends HTMLAttributes<HTMLDivElement> {
  orientation?: "horizontal" | "vertical";
  decorative?: boolean;
}

export function Divider({ orientation = "horizontal", decorative = false, className, ...props }: DividerProps) {
  return (
    <div
      {...props}
      data-pui-owner="Divider"
      className={cx("pui-divider", `pui-divider--${orientation}`, className)}
      role={decorative ? "presentation" : "separator"}
      aria-hidden={decorative || undefined}
      aria-orientation={decorative ? undefined : orientation}
    />
  );
}

export interface ScrollAreaProps extends HTMLAttributes<HTMLDivElement> {
  ariaLabel?: string;
  orientation?: "vertical" | "horizontal" | "both";
  maxHeight?: CSSProperties["maxHeight"];
  maxWidth?: CSSProperties["maxWidth"];
}

export function ScrollArea({
  ariaLabel,
  orientation = "vertical",
  maxHeight,
  maxWidth,
  className,
  style,
  tabIndex,
  children,
  ...props
}: ScrollAreaProps) {
  return (
    <div
      {...props}
      data-pui-owner="ScrollArea"
      className={cx("pui-scroll-area", `pui-scroll-area--${orientation}`, className)}
      style={{ maxHeight, maxWidth, ...style }}
      role={ariaLabel ? "region" : undefined}
      aria-label={ariaLabel}
      tabIndex={tabIndex ?? (ariaLabel ? 0 : undefined)}
    >
      {children}
    </div>
  );
}

export interface StickyHeaderActionBarProps extends HTMLAttributes<HTMLElement> {
  heading?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  position?: "top" | "bottom";
}

export function StickyHeaderActionBar({
  heading,
  description,
  actions,
  position = "top",
  className,
  children,
  ...props
}: StickyHeaderActionBarProps) {
  return (
    <header {...props} data-pui-owner="StickyHeaderActionBar" className={cx("pui-sticky-action-bar", className)} data-position={position}>
      <div className="pui-sticky-action-bar__copy">
        {heading != null ? <strong>{heading}</strong> : null}
        {description != null ? <span>{description}</span> : null}
        {children}
      </div>
      {actions != null ? <div className="pui-sticky-action-bar__actions">{actions}</div> : null}
    </header>
  );
}

export interface CollapseProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title: ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
  headingLevel?: 2 | 3 | 4 | 5 | 6;
  unmountOnExit?: boolean;
}

export function Collapse({
  title,
  open,
  defaultOpen = false,
  onOpenChange,
  disabled = false,
  headingLevel = 3,
  unmountOnExit = false,
  className,
  children,
  ...props
}: CollapseProps) {
  const generatedId = useId();
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const controlled = open !== undefined;
  const expanded = controlled ? open : internalOpen;
  const triggerId = `${generatedId}-trigger`;
  const panelId = `${generatedId}-panel`;
  const Heading = `h${headingLevel}` as "h2" | "h3" | "h4" | "h5" | "h6";
  const toggle = () => {
    if (disabled) return;
    const next = !expanded;
    if (!controlled) setInternalOpen(next);
    onOpenChange?.(next);
  };
  return (
    <div {...props} data-pui-owner="Collapse" className={cx("pui-collapse", className)} data-open={expanded || undefined}>
      <Heading className="pui-collapse__heading">
        <button
          id={triggerId}
          type="button"
          className="pui-collapse__trigger"
          aria-expanded={expanded}
          aria-controls={panelId}
          disabled={disabled}
          onClick={toggle}
        >
          <span>{title}</span>
          <ChevronDown aria-hidden="true" />
        </button>
      </Heading>
      {!unmountOnExit || expanded ? (
        <div id={panelId} className="pui-collapse__panel" role="region" aria-labelledby={triggerId} hidden={!expanded}>
          <div className="pui-collapse__content">{children}</div>
        </div>
      ) : null}
    </div>
  );
}

export interface AspectRatioProps extends HTMLAttributes<HTMLDivElement> {
  ratio?: number | string;
}

export function AspectRatio({ ratio = "16 / 9", className, style, children, ...props }: AspectRatioProps) {
  if (typeof ratio === "number" && (!Number.isFinite(ratio) || ratio <= 0)) {
    throw new RangeError("AspectRatio requires a finite ratio greater than zero.");
  }
  const resolvedRatio = typeof ratio === "number" ? String(ratio) : ratio;
  return (
    <div {...props} data-pui-owner="AspectRatio" className={cx("pui-aspect-ratio", className)} style={{ aspectRatio: resolvedRatio, ...style }}>
      {children}
    </div>
  );
}

export type ResponsiveVisibilityMode = "all" | "mobile" | "tablet" | "desktop";

export interface ResponsiveVisibilityProps extends HTMLAttributes<HTMLElement> {
  as?: "div" | "span";
  visibleOn?: ResponsiveVisibilityMode;
}

export function ResponsiveVisibility({
  as = "div",
  visibleOn = "all",
  className,
  children,
  ...props
}: ResponsiveVisibilityProps) {
  return createElement(
    as,
    {
      ...props,
      "data-pui-owner": "ResponsiveVisibility",
      className: cx("pui-responsive-visibility", className),
      "data-visible-on": visibleOn,
    },
    children,
  );
}

export interface VisuallyHiddenProps extends HTMLAttributes<HTMLSpanElement> {
  focusable?: boolean;
}

export function VisuallyHidden({ focusable = false, className, children, ...props }: VisuallyHiddenProps) {
  return (
    <span {...props} data-pui-owner="VisuallyHidden" className={cx("pui-visually-hidden", focusable && "is-focusable", className)}>
      {children}
    </span>
  );
}

export interface KeyboardShortcutProps extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  keys: string | readonly string[];
  label?: string;
}

export function KeyboardShortcut({ keys, label, className, ...props }: KeyboardShortcutProps) {
  const values = typeof keys === "string" ? [keys] : keys;
  const readableLabel = label ?? values.join(" + ");
  return (
    <kbd {...props} data-pui-owner="KeyboardShortcut" className={cx("pui-keyboard-shortcut", className)} aria-label={readableLabel}>
      {values.map((key, index) => (
        <span key={`${key}-${index}`}>
          {index > 0 ? <span className="pui-keyboard-shortcut__separator" aria-hidden="true">+</span> : null}
          <span>{key}</span>
        </span>
      ))}
    </kbd>
  );
}

export interface PortalProps {
  children: ReactNode;
  container?: Element | DocumentFragment;
  disabled?: boolean;
  className?: string;
}

export function Portal({ children, container, disabled = false, className }: PortalProps) {
  const [defaultContainer, setDefaultContainer] = useState<HTMLElement | null>(null);
  const sourceRef = useRef<HTMLSpanElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setDefaultContainer(document.body);
  }, []);
  const target = container ?? defaultContainer;
  usePersonalUiPortalTokens(!disabled && target !== null, sourceRef, portalRef);
  if (disabled) {
    return (
      <div className={cx("pui-portal", "pui-layout-portal", className)} data-pui-owner="Portal">
        {children}
      </div>
    );
  }
  return (
    <>
      <span ref={sourceRef} className="pui-portal-source" hidden aria-hidden="true" />
      {target
        ? createPortal(
            <div
              ref={portalRef}
              className={cx("pui-portal", "pui-layout-portal", className)}
              data-pui-owner="Portal"
            >
              {children}
            </div>,
            target,
          )
        : null}
    </>
  );
}

const focusTrapStack: symbol[] = [];

function removeTrap(id: symbol): boolean {
  const index = focusTrapStack.lastIndexOf(id);
  const wasTop = index === focusTrapStack.length - 1;
  if (index >= 0) focusTrapStack.splice(index, 1);
  return wasTop;
}

export interface FocusTrapProps extends HTMLAttributes<HTMLDivElement> {
  active?: boolean;
  autoFocus?: boolean;
  restoreFocus?: boolean;
  initialFocusRef?: RefObject<HTMLElement>;
  additionalContainers?: readonly RefObject<HTMLElement>[];
}

export function FocusTrap({
  active = true,
  autoFocus = true,
  restoreFocus = true,
  initialFocusRef,
  additionalContainers = [],
  className,
  children,
  tabIndex,
  ...props
}: FocusTrapProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const trapIdRef = useRef(Symbol("personal-ui-focus-trap"));
  const latestContainersRef = useRef(additionalContainers);
  const lastFocusedRef = useRef<HTMLElement | null>(null);
  latestContainersRef.current = additionalContainers;

  useEffect(() => {
    if (!active) return;
    const root = rootRef.current;
    if (!root) return;
    const id = trapIdRef.current;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    focusTrapStack.push(id);

    const isTopTrap = () => focusTrapStack[focusTrapStack.length - 1] === id;
    const containers = () => [
      root,
      ...latestContainersRef.current.flatMap((candidate) => candidate.current ? [candidate.current] : []),
    ];
    const contains = (element: HTMLElement) => containers().some((container) => container.contains(element));
    const focusable = () => getTabStops(document, contains);
    const focusInside = (backwards = false) => {
      const preferred = initialFocusRef?.current;
      const candidates = focusable();
      const target = preferred && contains(preferred) && isVisibleElement(preferred)
        ? preferred
        : backwards ? candidates[candidates.length - 1] : candidates[0];
      (target ?? root).focus({ preventScroll: true });
      lastFocusedRef.current = target ?? root;
    };

    const handleFocus = (event: FocusEvent) => {
      if (!isTopTrap() || !(event.target instanceof HTMLElement)) return;
      if (contains(event.target)) {
        lastFocusedRef.current = event.target;
        return;
      }
      event.stopPropagation();
      const fallback = lastFocusedRef.current;
      if (fallback?.isConnected && contains(fallback) && isVisibleElement(fallback)) {
        fallback.focus({ preventScroll: true });
      } else {
        focusInside();
      }
    };

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (!isTopTrap() || event.key !== "Tab") return;
      const candidates = focusable();
      if (!candidates.length) {
        event.preventDefault();
        root.focus({ preventScroll: true });
        return;
      }
      const current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const currentIndex = current ? candidates.indexOf(current) : -1;
      if (event.shiftKey && currentIndex <= 0) {
        event.preventDefault();
        candidates[candidates.length - 1].focus({ preventScroll: true });
      } else if (!event.shiftKey && (currentIndex < 0 || currentIndex === candidates.length - 1)) {
        event.preventDefault();
        candidates[0].focus({ preventScroll: true });
      }
    };

    document.addEventListener("focusin", handleFocus, true);
    document.addEventListener("keydown", handleKeyDown, true);
    if (autoFocus) queueMicrotask(() => { if (isTopTrap()) focusInside(); });

    return () => {
      document.removeEventListener("focusin", handleFocus, true);
      document.removeEventListener("keydown", handleKeyDown, true);
      const wasTop = removeTrap(id);
      if (
        wasTop
        && restoreFocus
        && previouslyFocused?.isConnected
        && !previouslyFocused.matches(":disabled")
        && !previouslyFocused.closest("[inert], [aria-hidden='true']")
        && isVisibleElement(previouslyFocused)
      ) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [active, autoFocus, initialFocusRef, restoreFocus]);

  return (
    <div
      {...props}
      data-pui-owner="FocusTrap"
      ref={rootRef}
      className={cx("pui-focus-trap", className)}
      tabIndex={tabIndex ?? -1}
      data-active={active || undefined}
    >
      {children}
    </div>
  );
}
