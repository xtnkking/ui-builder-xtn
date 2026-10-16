import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type AnchorHTMLAttributes,
  type CSSProperties,
  type FormHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
  type RefObject,
} from "react";
import { AlertCircle, Check, Copy, ExternalLink } from "lucide-react";
import type { PublicControlProps } from "../foundation/contracts";
import { useControllableState } from "../internal/controllable-state";
import { InternalButtonSlot, InternalFilterActionBoundary } from "../internal/button-slots";
import { sanitizeFixedControlProps } from "../internal/fixed-control-props";
import { InternalDropdownMenuSlot } from "../internal/overlay-slots";
import { observeComputedStyleChanges } from "../internal/portal-tokens";
import { useUILocale } from "../foundation/locale";
import { Button, IconButton, type ButtonProps } from "../foundation/primitives";
import { DropdownMenu, Tooltip, type MenuItem } from "../overlay/overlays";
import { VisuallyHidden } from "../foundation/layout";
import { cx } from "../internal/utils";

export type LinkProps = PublicControlProps<AnchorHTMLAttributes<HTMLAnchorElement>> & {
  variant?: "default" | "muted" | "danger";
  icon?: ReactNode;
  trailingIcon?: ReactNode;
  external?: boolean;
  newTab?: boolean;
};

export function Link(rawProps: LinkProps) {
  const safeProps = sanitizeFixedControlProps(rawProps);
  const {
    variant = "default",
    icon,
    trailingIcon,
    external = false,
    newTab = false,
    children,
    target,
    rel,
    ...props
  } = safeProps;
  const resolvedTarget = newTab ? "_blank" : target;
  const relParts = new Set((rel ?? "").split(/\s+/).filter(Boolean));
  if (resolvedTarget === "_blank") {
    relParts.add("noopener");
    relParts.add("noreferrer");
  }
  const resolvedTrailingIcon = trailingIcon ?? (external ? <ExternalLink aria-hidden="true" /> : null);
  return (
    <a
      {...props}
      data-ui-owner="Link"
      className={cx("ui-link", `ui-link--${variant}`)}
      target={resolvedTarget}
      rel={relParts.size ? Array.from(relParts).join(" ") : undefined}
    >
      {icon != null ? <span className="ui-link__icon" aria-hidden="true">{icon}</span> : null}
      <span className="ui-link__label">{children}</span>
      {resolvedTrailingIcon != null ? (
        <span className="ui-link__trailing" aria-hidden="true">{resolvedTrailingIcon}</span>
      ) : null}
    </a>
  );
}

export type ButtonGroupProps = PublicControlProps<HTMLAttributes<HTMLDivElement>> & {
  ariaLabel: string;
  attached?: boolean;
  orientation?: "horizontal" | "vertical";
};

export function ButtonGroup(rawProps: ButtonGroupProps) {
  const safeProps = sanitizeFixedControlProps(rawProps);
  const {
    ariaLabel,
    attached = false,
    orientation = "horizontal",
    children,
    ...props
  } = safeProps;
  const groupRef = useRef<HTMLDivElement>(null);
  const [scrollable, setScrollable] = useState(false);
  const horizontalAttached = attached && orientation === "horizontal";
  useClientLayoutEffect(() => {
    const group = groupRef.current;
    if (!group || !horizontalAttached) {
      setScrollable(false);
      return;
    }
    const measure = () => {
      const nextScrollable = group.scrollWidth > group.clientWidth + 1;
      setScrollable((current) => current === nextScrollable ? current : nextScrollable);
    };
    measure();
    return observeComputedStyleChanges(group, measure);
  }, [children, horizontalAttached]);
  return (
    <div
      {...props}
      ref={groupRef}
      data-ui-owner="ButtonGroup"
      className={cx("ui-button-group", attached && "ui-button-group--attached")}
      role="group"
      aria-label={ariaLabel}
      data-orientation={orientation}
      tabIndex={props.tabIndex ?? (scrollable ? 0 : undefined)}
      onFocusCapture={(event) => {
        props.onFocusCapture?.(event);
        if (!horizontalAttached || event.target === event.currentTarget) return;
        const group = event.currentTarget;
        const groupBounds = group.getBoundingClientRect();
        const targetBounds = event.target.getBoundingClientRect();
        const left = groupBounds.left + group.clientLeft;
        const right = left + group.clientWidth;
        const physicalDelta = targetBounds.left < left
          ? targetBounds.left - left
          : targetBounds.right > right
            ? targetBounds.right - right
            : 0;
        if (physicalDelta) group.scrollLeft += physicalDelta;
      }}
    >
      {children}
    </div>
  );
}

export type ToolbarProps = PublicControlProps<HTMLAttributes<HTMLDivElement>> & {
  ariaLabel: string;
  start?: ReactNode;
  end?: ReactNode;
  wrap?: boolean;
};

export function Toolbar(rawProps: ToolbarProps) {
  const safeProps = sanitizeFixedControlProps(rawProps);
  const {
    ariaLabel,
    start,
    end,
    wrap = true,
    children,
    ...props
  } = safeProps;
  return (
    <div
      {...props}
      data-ui-owner="Toolbar"
      className="ui-toolbar"
      role="toolbar"
      aria-label={ariaLabel}
      data-wrap={wrap || undefined}
    >
      {start != null ? <div className="ui-toolbar__start">{start}</div> : null}
      {children != null ? <div className="ui-toolbar__main">{children}</div> : null}
      {end != null ? <div className="ui-toolbar__end">{end}</div> : null}
    </div>
  );
}

export type FilterBarProps = PublicControlProps<Omit<FormHTMLAttributes<HTMLFormElement>, "children">> & {
  ariaLabel: string;
  children: ReactNode;
  actions: ReactNode;
  density?: "compact" | "comfortable";
  activeFilters?: ReactNode;
  status?: ReactNode;
};

export type FilterFieldProps = PublicControlProps<Omit<HTMLAttributes<HTMLDivElement>, "children">> & {
  children: ReactNode;
  /** Presets fit input hints up to 360px; numeric widths remain explicit. Narrow containers stack fields. */
  width?: "short" | "medium" | "long" | number;
};

const FILTER_FIELD_WIDTHS = { short: 140, medium: 240, long: 320 } as const;
const useClientLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Fit only placeholder text, preserving a stable clear-button slot and typed-value width. */
function useFilterFieldHintWidth(fieldRef: RefObject<HTMLDivElement | null>, baseline: number, enabled: boolean) {
  useClientLayoutEffect(() => {
    const field = fieldRef.current;
    const document = field?.ownerDocument;
    const view = document?.defaultView;
    if (!enabled || !field || !document || !view || typeof view.CanvasRenderingContext2D !== "function") return;
    const context = document.createElement("canvas").getContext("2d");
    if (!context) return;
    let frame = 0;
    let disposed = false;
    const measure = () => {
      frame = 0;
      if (disposed) return;
      let width = baseline;
      const input = field.querySelector<HTMLInputElement>("input.ui-input[placeholder]");
      if (input?.placeholder && input.offsetWidth) {
        const style = view.getComputedStyle(input);
        context.font = style.font || `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        const spacing = Number.parseFloat(style.letterSpacing) || 0;
        const textWidth = context.measureText(input.placeholder).width
          + spacing * Math.max(0, Array.from(input.placeholder).length - 1);
        const paddingAndBorder = ["paddingLeft", "paddingRight", "borderLeftWidth", "borderRightWidth"] as const;
        let chromeWidth = paddingAndBorder.reduce((total, key) => total + (Number.parseFloat(style[key]) || 0), 0);
        const shell = input.closest<HTMLElement>(".ui-input-shell");
        // offsetWidth stays in CSS pixels even when a preview ancestor is transformed.
        if (shell && field.contains(shell)) chromeWidth += Math.max(0, shell.offsetWidth - input.offsetWidth);
        width = Math.min(360, Math.max(baseline, Math.ceil(textWidth + chromeWidth + 2)));
      }
      const value = `${width}px`;
      if (field.style.getPropertyValue("--_ui-filter-field-fit-width") !== value) {
        field.style.setProperty("--_ui-filter-field-fit-width", value);
      }
    };
    const schedule = () => {
      if (!disposed && !frame) frame = view.requestAnimationFrame(measure);
    };
    measure();
    // Reuse shared font, theme, stylesheet and resize subscriptions; ignore our own width write.
    const stopObservingStyle = observeComputedStyleChanges(field, schedule, { ignoredMutationRoot: field });
    const mutations = new view.MutationObserver((records) => {
      if (records.some((record) => record.target !== field || record.type === "childList")) schedule();
    });
    mutations.observe(field, { childList: true, attributes: true, subtree: true, attributeFilter: ["placeholder", "class", "style"] });
    return () => {
      disposed = true;
      view.cancelAnimationFrame(frame);
      mutations.disconnect();
      stopObservingStyle();
      field.style.removeProperty("--_ui-filter-field-fit-width");
    };
  }, [baseline, enabled, fieldRef]);
}

export function FilterField(rawProps: FilterFieldProps) {
  const { children, width = "medium", ...props } = sanitizeFixedControlProps(rawProps);
  const resolvedWidth = typeof width === "number"
    ? Number.isFinite(width) && width > 0 ? width : FILTER_FIELD_WIDTHS.medium
    : width === "short" || width === "long" ? FILTER_FIELD_WIDTHS[width] : FILTER_FIELD_WIDTHS.medium;
  const fieldRef = useRef<HTMLDivElement>(null);
  useFilterFieldHintWidth(fieldRef, resolvedWidth, typeof width !== "number");
  return (
    <div
      {...props}
      ref={fieldRef}
      className="ui-filter-field"
      data-ui-owner="FilterField"
      style={{ "--_ui-filter-field-width": `${resolvedWidth}px` } as CSSProperties}
    >
      {children}
    </div>
  );
}

const FILTER_CONTROL_ANCHOR = ".ui-input-shell, .ui-input:not(.ui-input--embedded), .ui-textarea-shell, .ui-select, .ui-combobox__trigger";

/** Align actual controls within each flex row without counting Field helper text. */
function useFilterBarAlignment(
  fieldsRef: RefObject<HTMLDivElement | null>,
  actionsRef: RefObject<HTMLDivElement | null>,
) {
  useClientLayoutEffect(() => {
    const fields = fieldsRef.current;
    const actions = actionsRef.current;
    const form = fields?.parentElement;
    const ownerWindow = fields?.ownerDocument.defaultView;
    if (!fields || !actions || !form || !ownerWindow) return;
    const offsets = new Map<HTMLElement, number>();
    const observed = new Set<Element>();
    let frame = 0;
    let disposed = false;
    const setOffset = (element: HTMLElement, name: string, offset: number) => {
      const value = `${Math.round(offset * 100) / 100}px`;
      if (element.style.getPropertyValue(name) !== value) element.style.setProperty(name, value);
    };
    const clearField = (element: HTMLElement) => {
      element.style.removeProperty("--_ui-filter-align-offset");
      element.removeAttribute("data-ui-filter-aligned");
      offsets.delete(element);
    };
    const measure = () => {
      frame = 0;
      if (disposed || form.getBoundingClientRect().width === 0) return;
      const current = new Set<HTMLElement>();
      const rows: Array<{ top: number; lead: number; items: Array<{ element: HTMLElement; lead: number }> }> = [];
      for (const child of Array.from(fields.children)) {
        if (!(child instanceof ownerWindow.HTMLElement)) continue;
        const control = child.matches(FILTER_CONTROL_ANCHOR)
          ? child
          : child.querySelector<HTMLElement>(FILTER_CONTROL_ANCHOR);
        if (!control) continue;
        const rect = child.getBoundingClientRect();
        const controlRect = control.getBoundingClientRect();
        if (!rect.width || !controlRect.height) continue;
        current.add(child);
        // Our margin moves the whole Field; subtract it to recover its flex-row origin.
        const top = rect.top - (offsets.get(child) ?? 0);
        const lead = Math.max(0, controlRect.top - rect.top);
        let row = rows.find((candidate) => Math.abs(candidate.top - top) <= 1);
        if (!row) {
          row = { top, lead, items: [] };
          rows.push(row);
        }
        row.lead = Math.max(row.lead, lead);
        row.items.push({ element: child, lead });
      }
      const actionMargin = Number.parseFloat(ownerWindow.getComputedStyle(actions).marginBlockStart) || 0;
      const actionRowTop = actions.getBoundingClientRect().top - actionMargin;
      const actionRow = rows.find((row) => Math.abs(actionRowTop - row.top) <= 1);
      for (const element of offsets.keys()) if (!current.has(element)) clearField(element);
      for (const row of rows) {
        for (const { element, lead } of row.items) {
          const offset = Math.max(0, row.lead - lead);
          if (!element.hasAttribute("data-ui-filter-aligned")) element.setAttribute("data-ui-filter-aligned", "true");
          offsets.set(element, Math.round(offset * 100) / 100);
          setOffset(element, "--_ui-filter-align-offset", offset);
        }
      }
      setOffset(actions, "--_ui-filter-action-offset", actionRow?.lead ?? 0);
    };
    const schedule = () => {
      if (!disposed && !frame) frame = ownerWindow.requestAnimationFrame(measure);
    };
    const resizeObserver = typeof ownerWindow.ResizeObserver === "function" ? new ownerWindow.ResizeObserver(schedule) : null;
    const refreshObserved = () => {
      const next = new Set<Element>([form, actions, ...fields.children, ...fields.querySelectorAll(".ui-label")]);
      for (const element of observed) {
        if (!next.has(element)) { resizeObserver?.unobserve(element); observed.delete(element); }
      }
      for (const element of next) {
        if (!observed.has(element)) { resizeObserver?.observe(element); observed.add(element); }
      }
    };
    const mutationObserver = new ownerWindow.MutationObserver(() => { refreshObserved(); schedule(); });
    mutationObserver.observe(fields, { childList: true, characterData: true, subtree: true });
    refreshObserved();
    measure();
    ownerWindow.addEventListener("resize", schedule);
    void fields.ownerDocument.fonts?.ready.then(schedule);
    return () => {
      disposed = true;
      ownerWindow.cancelAnimationFrame(frame);
      ownerWindow.removeEventListener("resize", schedule);
      resizeObserver?.disconnect();
      mutationObserver.disconnect();
      for (const element of offsets.keys()) clearField(element);
      actions.style.removeProperty("--_ui-filter-action-offset");
    };
  }, [fieldsRef, actionsRef]);
}

export function FilterBar(rawProps: FilterBarProps) {
  const safeProps = sanitizeFixedControlProps(rawProps);
  const {
    ariaLabel,
    children,
    actions,
    density = "compact",
    activeFilters,
    status,
    ...props
  } = safeProps;
  const fieldsRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  useFilterBarAlignment(fieldsRef, actionsRef);
  return (
    <form {...props} data-ui-owner="FilterBar" data-density={density} className="ui-filter-bar" aria-label={ariaLabel}>
      <div ref={fieldsRef} className="ui-filter-bar__fields">{children}</div>
      <div ref={actionsRef} className="ui-filter-bar__actions"><InternalFilterActionBoundary>{actions}</InternalFilterActionBoundary></div>
      {activeFilters != null ? <div className="ui-filter-bar__active">{activeFilters}</div> : null}
      {status != null ? <div className="ui-filter-bar__status" role="status" aria-live="polite">{status}</div> : null}
    </form>
  );
}

export type SplitButtonProps = PublicControlProps<Omit<ButtonProps, "trailingIcon">> & {
  menuItems: MenuItem[];
  menuAriaLabel: string;
  menuAlign?: "start" | "end";
};

export function SplitButton(rawProps: SplitButtonProps) {
  const safeProps = sanitizeFixedControlProps(rawProps);
  const {
    menuItems,
    menuAriaLabel,
    menuAlign = "end",
    disabled,
    loading,
    children,
    ...buttonProps
  } = safeProps;
  const menuDisabled = Boolean(disabled || loading);
  const resolvedItems = menuDisabled
    ? menuItems.map((item) => ({ ...item, disabled: true }))
    : menuItems;
  return (
    <div className="ui-split-button" data-ui-owner="SplitButton">
      <InternalButtonSlot name="split-primary">
        <Button {...buttonProps} disabled={disabled} loading={loading}>
          {children}
        </Button>
      </InternalButtonSlot>
      <InternalDropdownMenuSlot name="split-menu">
        <DropdownMenu
          label={<VisuallyHidden>{menuAriaLabel}</VisuallyHidden>}
          ariaLabel={menuAriaLabel}
          items={resolvedItems}
          align={menuAlign}
        />
      </InternalDropdownMenuSlot>
    </div>
  );
}

type ToggleButtonStateProps =
  | {
      pressed: boolean;
      defaultPressed?: never;
      onPressedChange: (pressed: boolean) => void;
    }
  | {
      pressed?: never;
      defaultPressed?: boolean;
      onPressedChange?: (pressed: boolean) => void;
    };

export type ToggleButtonProps = PublicControlProps<Omit<ButtonProps, "aria-pressed">>
  & ToggleButtonStateProps;

export function ToggleButton(rawProps: ToggleButtonProps) {
  const controlled = rawProps.pressed !== undefined;
  const defaultValueProvided = rawProps.defaultPressed !== undefined;
  const safeProps = sanitizeFixedControlProps(rawProps);
  const { pressed, defaultPressed, onPressedChange, onClick, ...props } = safeProps;
  const [resolvedPressed, setResolvedPressed] = useControllableState({
    componentName: "ToggleButton",
    controlled,
    value: pressed,
    defaultValue: defaultPressed ?? false,
    defaultValueProvided,
    onChange: onPressedChange,
    valuePropName: "pressed",
    defaultValuePropName: "defaultPressed",
    changePropName: "onPressedChange",
  });
  return (
    <InternalButtonSlot name="toggle">
      <Button
        {...props}
        aria-pressed={resolvedPressed}
        data-pressed={resolvedPressed || undefined}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented) setResolvedPressed((current) => !current);
        }}
      />
    </InternalButtonSlot>
  );
}

type ClipboardStatus = "idle" | "copying" | "copied" | "error";

function fallbackCopy(text: string): void {
  if (typeof document === "undefined") throw new Error("Clipboard access requires a browser document.");
  const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = typeof document.execCommand === "function" && document.execCommand("copy");
  textarea.remove();
  activeElement?.focus({ preventScroll: true });
  if (!copied) throw new Error("The browser rejected the clipboard operation.");
}

async function writeClipboard(text: string): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      fallbackCopy(text);
      return;
    }
  }
  fallbackCopy(text);
}

export type ClipboardButtonProps = PublicControlProps<Omit<
  ButtonProps,
  "children" | "icon" | "loading" | "loadingLabel" | "onClick" | "aria-label"
>> & {
  text: string | (() => string);
  label?: string;
  copyingLabel?: string;
  copiedLabel?: string;
  errorLabel?: string;
  iconOnly?: boolean;
  resetAfter?: number;
  onCopied?: (text: string) => void | Promise<void>;
  onError?: (error: unknown) => void | Promise<void>;
};

export function ClipboardButton(rawProps: ClipboardButtonProps) {
  const { message } = useUILocale();
  const safeProps = sanitizeFixedControlProps(rawProps);
  const {
    text,
    label = message("copy.copy"),
    copyingLabel = message("copy.copying"),
    copiedLabel = message("copy.copied"),
    errorLabel = message("copy.failed"),
    iconOnly = false,
    resetAfter = 1800,
    onCopied,
    onError,
    disabled,
    variant,
    size,
    ...props
  } = safeProps;
  const [status, setStatus] = useState<ClipboardStatus>("idle");
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
  }, []);

  const statusLabel = status === "copying"
    ? copyingLabel
    : status === "copied"
      ? copiedLabel
      : status === "error" ? errorLabel : label;
  const icon = status === "copied"
    ? <Check aria-hidden="true" />
    : status === "error" ? <AlertCircle aria-hidden="true" /> : <Copy aria-hidden="true" />;
  const scheduleReset = () => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => {
      resetTimerRef.current = null;
      setStatus("idle");
    }, Math.max(0, Number.isFinite(resetAfter) ? resetAfter : 1800));
  };
  const handleCopy = async () => {
    if (status === "copying") return;
    setStatus("copying");
    try {
      const resolvedText = typeof text === "function" ? text() : text;
      await writeClipboard(resolvedText);
      setStatus("copied");
      await onCopied?.(resolvedText);
    } catch (error) {
      setStatus("error");
      await onError?.(error);
    } finally {
      scheduleReset();
    }
  };

  const announcement = status === "idle" ? null : statusLabel;
  if (iconOnly) {
    return (
      <span className="ui-clipboard-button" data-ui-owner="ClipboardButton">
        <Tooltip content={statusLabel}>
          <IconButton
            {...props}
            aria-label={statusLabel}
            icon={icon}
            variant={variant === "primary" ? "secondary" : variant}
            loading={status === "copying"}
            disabled={disabled}
            onClick={() => { void handleCopy(); }}
          />
        </Tooltip>
        <VisuallyHidden aria-live="polite">{announcement}</VisuallyHidden>
      </span>
    );
  }
  return (
    <span className="ui-clipboard-button" data-ui-owner="ClipboardButton">
      <Button
        {...props}
        aria-label={statusLabel}
        icon={icon}
        variant={variant}
        size={size}
        loading={status === "copying"}
        loadingLabel={copyingLabel}
        disabled={disabled}
        onClick={() => { void handleCopy(); }}
      >
        {label}
      </Button>
      <VisuallyHidden aria-live="polite">{announcement}</VisuallyHidden>
    </span>
  );
}
