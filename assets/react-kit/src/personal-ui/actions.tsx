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
import { Button, IconButton, type ButtonProps } from "./primitives";
import { DropdownMenu, Tooltip, type MenuItem } from "./overlays";
import { VisuallyHidden } from "./layout";
import { cx } from "./utils";

export interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: "default" | "muted" | "danger";
  icon?: ReactNode;
  trailingIcon?: ReactNode;
  external?: boolean;
  newTab?: boolean;
}

export function Link({
  variant = "default",
  icon,
  trailingIcon,
  external = false,
  newTab = false,
  className,
  children,
  target,
  rel,
  ...props
}: LinkProps) {
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
      className={cx("pui-link", `pui-link--${variant}`, className)}
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

export interface ButtonGroupProps extends HTMLAttributes<HTMLDivElement> {
  ariaLabel: string;
  attached?: boolean;
  orientation?: "horizontal" | "vertical";
}

export function ButtonGroup({
  ariaLabel,
  attached = false,
  orientation = "horizontal",
  className,
  children,
  ...props
}: ButtonGroupProps) {
  return (
    <div
      {...props}
      data-pui-owner="ButtonGroup"
      className={cx("pui-button-group", attached && "pui-button-group--attached", className)}
      role="group"
      aria-label={ariaLabel}
      aria-orientation={orientation}
      data-orientation={orientation}
    >
      {children}
    </div>
  );
}

export interface ToolbarProps extends HTMLAttributes<HTMLDivElement> {
  ariaLabel: string;
  start?: ReactNode;
  end?: ReactNode;
  wrap?: boolean;
}

export function Toolbar({
  ariaLabel,
  start,
  end,
  wrap = true,
  className,
  children,
  ...props
}: ToolbarProps) {
  return (
    <div
      {...props}
      data-pui-owner="Toolbar"
      className={cx("pui-toolbar", className)}
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

export interface FilterBarProps extends Omit<FormHTMLAttributes<HTMLFormElement>, "children"> {
  ariaLabel: string;
  children: ReactNode;
  actions: ReactNode;
  activeFilters?: ReactNode;
  status?: ReactNode;
}

export function FilterBar({
  ariaLabel,
  children,
  actions,
  activeFilters,
  status,
  className,
  ...props
}: FilterBarProps) {
  return (
    <form {...props} data-pui-owner="FilterBar" className={cx("pui-filter-bar", className)} aria-label={ariaLabel}>
      <div className="pui-filter-bar__fields">{children}</div>
      <div className="pui-filter-bar__actions">{actions}</div>
      {activeFilters != null ? <div className="pui-filter-bar__active">{activeFilters}</div> : null}
      {status != null ? <div className="pui-filter-bar__status" role="status" aria-live="polite">{status}</div> : null}
    </form>
  );
}

export interface SplitButtonProps extends Omit<ButtonProps, "trailingIcon"> {
  menuItems: MenuItem[];
  menuAriaLabel: string;
  menuAlign?: "start" | "end";
}

export function SplitButton({
  menuItems,
  menuAriaLabel,
  menuAlign = "end",
  disabled,
  loading,
  className,
  children,
  ...buttonProps
}: SplitButtonProps) {
  const menuDisabled = Boolean(disabled || loading);
  const resolvedItems = menuDisabled
    ? menuItems.map((item) => ({ ...item, disabled: true }))
    : menuItems;
  return (
    <div className={cx("pui-split-button", className)} data-pui-owner="SplitButton">
      <Button {...buttonProps} disabled={disabled} loading={loading} className="pui-split-button__primary">
        {children}
      </Button>
      <DropdownMenu
        className="pui-split-button__menu"
        label={<VisuallyHidden>{menuAriaLabel}</VisuallyHidden>}
        ariaLabel={menuAriaLabel}
        items={resolvedItems}
        align={menuAlign}
      />
    </div>
  );
}

export interface ToggleButtonProps extends Omit<ButtonProps, "aria-pressed"> {
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
}

export function ToggleButton({ pressed, onPressedChange, onClick, className, ...props }: ToggleButtonProps) {
  return (
    <Button
      {...props}
      data-pui-owner="ToggleButton"
      className={cx("pui-toggle-button", className)}
      aria-pressed={pressed}
      data-pressed={pressed || undefined}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) onPressedChange(!pressed);
      }}
    />
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

export interface ClipboardButtonProps extends Omit<
  ButtonProps,
  "children" | "icon" | "loading" | "loadingLabel" | "onClick" | "aria-label"
> {
  text: string | (() => string);
  label?: string;
  copyingLabel?: string;
  copiedLabel?: string;
  errorLabel?: string;
  iconOnly?: boolean;
  resetAfter?: number;
  onCopied?: (text: string) => void | Promise<void>;
  onError?: (error: unknown) => void | Promise<void>;
}

export function ClipboardButton({
  text,
  label = "复制",
  copyingLabel = "复制中",
  copiedLabel = "已复制",
  errorLabel = "复制失败",
  iconOnly = false,
  resetAfter = 1800,
  onCopied,
  onError,
  className,
  disabled,
  variant,
  size,
  ...props
}: ClipboardButtonProps) {
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
      <span className={cx("pui-clipboard-button", className)} data-pui-owner="ClipboardButton">
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
    <span className={cx("pui-clipboard-button", className)} data-pui-owner="ClipboardButton">
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
