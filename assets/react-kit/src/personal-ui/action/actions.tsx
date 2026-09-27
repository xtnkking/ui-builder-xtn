import {
  useEffect,
  useRef,
  useState,
  type AnchorHTMLAttributes,
  type FormHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { AlertCircle, Check, Copy, ExternalLink } from "lucide-react";
import type { PublicControlProps } from "../foundation/contracts";
import { useControllableState } from "../internal/controllable-state";
import { InternalButtonSlot } from "../internal/button-slots";
import { sanitizeFixedControlProps } from "../internal/fixed-control-props";
import { InternalDropdownMenuSlot } from "../internal/overlay-slots";
import { usePersonalUILocale } from "../foundation/locale";
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
      data-pui-owner="Link"
      className={cx("pui-link", `pui-link--${variant}`)}
      target={resolvedTarget}
      rel={relParts.size ? Array.from(relParts).join(" ") : undefined}
    >
      {icon != null ? <span className="pui-link__icon" aria-hidden="true">{icon}</span> : null}
      <span className="pui-link__label">{children}</span>
      {resolvedTrailingIcon != null ? (
        <span className="pui-link__trailing" aria-hidden="true">{resolvedTrailingIcon}</span>
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
  return (
    <div
      {...props}
      data-pui-owner="ButtonGroup"
      className={cx("pui-button-group", attached && "pui-button-group--attached")}
      role="group"
      aria-label={ariaLabel}
      data-orientation={orientation}
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
      data-pui-owner="Toolbar"
      className="pui-toolbar"
      role="toolbar"
      aria-label={ariaLabel}
      data-wrap={wrap || undefined}
    >
      {start != null ? <div className="pui-toolbar__start">{start}</div> : null}
      {children != null ? <div className="pui-toolbar__main">{children}</div> : null}
      {end != null ? <div className="pui-toolbar__end">{end}</div> : null}
    </div>
  );
}

export type FilterBarProps = PublicControlProps<Omit<FormHTMLAttributes<HTMLFormElement>, "children">> & {
  ariaLabel: string;
  children: ReactNode;
  actions: ReactNode;
  activeFilters?: ReactNode;
  status?: ReactNode;
};

export function FilterBar(rawProps: FilterBarProps) {
  const safeProps = sanitizeFixedControlProps(rawProps);
  const {
    ariaLabel,
    children,
    actions,
    activeFilters,
    status,
    ...props
  } = safeProps;
  return (
    <form {...props} data-pui-owner="FilterBar" className="pui-filter-bar" aria-label={ariaLabel}>
      <div className="pui-filter-bar__fields">{children}</div>
      <div className="pui-filter-bar__actions">{actions}</div>
      {activeFilters != null ? <div className="pui-filter-bar__active">{activeFilters}</div> : null}
      {status != null ? <div className="pui-filter-bar__status" role="status" aria-live="polite">{status}</div> : null}
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
    <div className="pui-split-button" data-pui-owner="SplitButton">
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
  const { message } = usePersonalUILocale();
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
      <span className="pui-clipboard-button" data-pui-owner="ClipboardButton">
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
    <span className="pui-clipboard-button" data-pui-owner="ClipboardButton">
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
