import {
  forwardRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { LoaderCircle, X } from "lucide-react";
import { cx, getTabStops, isVisibleElement } from "./utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "small" | "medium";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  trailingIcon?: ReactNode;
  loading?: boolean;
  loadingLabel?: ReactNode;
  "data-pui-owner"?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "secondary",
    size = "medium",
    icon,
    trailingIcon,
    loading = false,
    loadingLabel = "处理中",
    disabled,
    "aria-disabled": ariaDisabled,
    onClick,
    className,
    children,
    type = "button",
    "data-pui-owner": owner = "Button",
    ...props
  },
  ref,
) {
  const explicitlyAriaDisabled = ariaDisabled === true || ariaDisabled === "true";
  const interactionDisabled = Boolean(disabled || loading || explicitlyAriaDisabled);
  return (
    <button
      ref={ref}
      {...props}
      type={type}
      className={cx("pui-button", `pui-button--${variant}`, `pui-button--${size}`, className)}
      disabled={disabled}
      aria-disabled={loading || explicitlyAriaDisabled || undefined}
      aria-busy={loading || undefined}
      data-loading={loading || undefined}
      data-pui-owner={owner}
      onClick={(event) => {
        if (interactionDisabled) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        onClick?.(event);
      }}
    >
      <span className="pui-button__content" aria-hidden={loading || undefined}>
        {icon ? <span className="pui-button__icon" aria-hidden="true">{icon}</span> : null}
        <span className="pui-button__label">{children}</span>
        {trailingIcon ? <span className="pui-button__trailing" aria-hidden="true">{trailingIcon}</span> : null}
      </span>
      <span className="pui-button__loading" aria-hidden={!loading}>
        <LoaderCircle className="pui-spinner" aria-hidden="true" />
        <span>{loadingLabel}</span>
      </span>
    </button>
  );
});

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  "aria-label": string;
  icon: ReactNode;
  loading?: boolean;
  variant?: "secondary" | "ghost" | "danger";
  "data-pui-owner"?: string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  {
    icon,
    loading = false,
    variant = "ghost",
    className,
    disabled,
    type = "button",
    "aria-disabled": ariaDisabled,
    "data-pui-owner": owner = "IconButton",
    onClick,
    ...props
  },
  ref,
) {
  const explicitlyAriaDisabled = ariaDisabled === true || ariaDisabled === "true";
  const interactionDisabled = Boolean(disabled || loading || explicitlyAriaDisabled);
  return (
    <button
      ref={ref}
      {...props}
      type={type}
      className={cx("pui-icon-button", `pui-icon-button--${variant}`, className)}
      disabled={disabled}
      aria-disabled={loading || explicitlyAriaDisabled || undefined}
      aria-busy={loading || undefined}
      data-loading={loading || undefined}
      data-pui-owner={owner}
      onClick={(event) => {
        if (interactionDisabled) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        onClick?.(event);
      }}
    >
      <span className="pui-icon-button__icon" aria-hidden="true">
        {loading ? <LoaderCircle className="pui-spinner" /> : icon}
      </span>
    </button>
  );
});

export function Spinner({ label = "正在加载", className }: { label?: string; className?: string }) {
  return (
    <span className={cx("pui-spinner-wrap", className)} role="status" data-pui-owner="Spinner">
      <LoaderCircle className="pui-spinner" aria-hidden="true" />
      <span className="pui-sr-only">{label}</span>
    </span>
  );
}

export interface SkeletonProps extends HTMLAttributes<HTMLSpanElement> {
  width?: string | number;
}

export function Skeleton({ width, className, style, ...props }: SkeletonProps) {
  const resolvedStyle = width !== undefined && style?.width === undefined && style?.maxWidth === undefined
    ? { ...style, width: "100%", maxWidth: width }
    : { width, ...style };

  return (
    <span
      {...props}
      className={cx("pui-skeleton", className)}
      style={resolvedStyle}
      aria-hidden="true"
      data-pui-owner="Skeleton"
    />
  );
}

export type TagTone = "neutral" | "blue" | "success" | "warning" | "danger";

function captureTagRemovalFocus(removeButton: HTMLButtonElement): (() => void) | null {
  const ownerDocument = removeButton.ownerDocument;
  if (ownerDocument.activeElement !== removeButton) return null;
  const tag = removeButton.closest<HTMLElement>(".pui-tag");
  const modalBoundary = removeButton.closest<HTMLElement>("[role='dialog'][aria-modal='true']");
  const documentFocusable = getTabStops(modalBoundary ?? ownerDocument);
  const currentIndex = documentFocusable.indexOf(removeButton);
  const following = currentIndex >= 0
    ? documentFocusable.slice(currentIndex + 1).filter((element) => !tag?.contains(element))
    : documentFocusable.filter((element) => !tag?.contains(element));
  const preceding = currentIndex >= 0
    ? documentFocusable.slice(0, currentIndex).filter((element) => !tag?.contains(element)).reverse()
    : [];
  return () => {
    queueMicrotask(() => {
      if (removeButton.isConnected) return;
      const activeElement = ownerDocument.activeElement;
      if (
        activeElement instanceof HTMLElement
        && activeElement !== ownerDocument.body
        && activeElement !== ownerDocument.documentElement
        && activeElement !== removeButton
      ) return;
      const target = [...following, ...preceding].find((element) => (
        element.isConnected
        && !element.matches(":disabled")
        && !element.closest("[inert], [aria-hidden='true']")
        && isVisibleElement(element)
      ));
      (target ?? modalBoundary)?.focus({ preventScroll: true });
    });
  };
}

export interface TagProps extends Omit<HTMLAttributes<HTMLSpanElement>, "onClick"> {
  tone?: TagTone;
  leading?: ReactNode;
  selected?: boolean;
  onRemove?: () => void;
  removeLabel?: string;
}

export function Tag({
  tone = "neutral",
  leading,
  selected = false,
  onRemove,
  removeLabel,
  title,
  className,
  children,
  ...props
}: TagProps) {
  const contentTitle = title ?? (
    typeof children === "string" || typeof children === "number"
      ? String(children)
      : undefined
  );
  const resolvedRemoveLabel = removeLabel ?? (
    typeof children === "string" || typeof children === "number"
      ? `移除 ${children}`
      : "移除标签"
  );
  return (
    <span
      {...props}
      title={contentTitle}
      className={cx("pui-tag", `pui-tag--${tone}`, selected && "is-selected", className)}
      data-selected={selected || undefined}
      data-pui-owner="Tag"
    >
      {leading ? <span className="pui-tag__leading" aria-hidden="true">{leading}</span> : null}
      <span className="pui-tag__label">{children}</span>
      {selected ? <span className="pui-sr-only">（已选择）</span> : null}
      {onRemove ? (
        <button
          type="button"
          className="pui-tag__remove"
          aria-label={resolvedRemoveLabel}
          onClick={(event) => {
            event.stopPropagation();
            const restoreFocus = captureTagRemovalFocus(event.currentTarget);
            onRemove();
            restoreFocus?.();
          }}
        >
          <X aria-hidden="true" />
        </button>
      ) : null}
    </span>
  );
}
