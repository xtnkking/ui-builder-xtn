import {
  useCallback,
  useImperativeHandle,
  useRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { LoaderCircle, X } from "lucide-react";
import type { ControlHandle, ControlRef, PublicControlProps } from "./contracts";
import {
  InternalControlSlotBoundary,
  useInternalButtonSlot,
  useInternalIconButtonSlot,
  type InternalButtonSlotName,
  type InternalIconButtonSlotName,
} from "../internal/button-slots";
import { assignElementRef } from "../internal/control-handles";
import { sanitizeFixedControlProps } from "../internal/fixed-control-props";
import { usePersonalUILocale } from "./locale";
import { cx, getTabStops, isVisibleElement } from "../internal/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "small" | "medium" | "field";

export type ButtonProps = PublicControlProps<ButtonHTMLAttributes<HTMLButtonElement>> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  trailingIcon?: ReactNode;
  loading?: boolean;
  loadingLabel?: ReactNode;
  controlRef?: ControlRef<ControlHandle>;
};

type ButtonOwner = "Button" | "ToggleButton" | "RetryButton" | "AsyncAction";

interface ButtonSlotConfig {
  className?: string;
  owner: ButtonOwner;
}

const DEFAULT_BUTTON_SLOT: ButtonSlotConfig = { owner: "Button" };
const BUTTON_SLOT_CONFIG: Record<InternalButtonSlotName, ButtonSlotConfig> = {
  "split-primary": { className: "pui-split-button__primary", owner: "Button" },
  toggle: { className: "pui-toggle-button", owner: "ToggleButton" },
  retry: { owner: "RetryButton" },
  "async-action": { owner: "AsyncAction" },
  "dropdown-trigger": { owner: "Button" },
};

interface IconButtonSlotConfig {
  className?: string;
}

const DEFAULT_ICON_BUTTON_SLOT: IconButtonSlotConfig = {};
const ICON_BUTTON_SLOT_CONFIG: Record<InternalIconButtonSlotName, IconButtonSlotConfig> = {
  "lightbox-close": { className: "pui-lightbox__close" },
  "lightbox-previous": { className: "pui-lightbox__previous" },
  "lightbox-next": { className: "pui-lightbox__next" },
};

export function Button(rawProps: ButtonProps) {
  const { message } = usePersonalUILocale();
  const safeProps = sanitizeFixedControlProps(rawProps);
  const {
    variant = "secondary",
    size = "medium",
    icon,
    trailingIcon,
    loading = false,
    loadingLabel = message("common.processing"),
    disabled,
    "aria-disabled": ariaDisabled,
    onClick,
    children,
    type = "button",
    controlRef,
    ...props
  } = safeProps;
  const internalSlot = useInternalButtonSlot();
  const { className: slotClassName, owner } = internalSlot
    ? BUTTON_SLOT_CONFIG[internalSlot.name]
    : DEFAULT_BUTTON_SLOT;
  const elementRef = useRef<HTMLButtonElement | null>(null);
  useImperativeHandle(controlRef, () => ({
    focus(options?: FocusOptions) {
      elementRef.current?.focus(options);
    },
  }) as ControlHandle, []);
  const mergedRef = useCallback((element: HTMLButtonElement | null) => {
    elementRef.current = element;
    assignElementRef(internalSlot?.elementRef, element);
  }, [internalSlot?.elementRef]);
  const explicitlyAriaDisabled = ariaDisabled === true || ariaDisabled === "true";
  const interactionDisabled = Boolean(disabled || loading || explicitlyAriaDisabled);
  return (
    <button
      ref={mergedRef}
      {...props}
      type={type}
      className={cx("pui-button", `pui-button--${variant}`, `pui-button--${size}`, slotClassName)}
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
      <InternalControlSlotBoundary>
        <span className="pui-button__content" aria-hidden={loading || undefined}>
          {icon ? <span className="pui-button__icon" aria-hidden="true">{icon}</span> : null}
          <span className="pui-button__label">{children}</span>
          {trailingIcon ? <span className="pui-button__trailing" aria-hidden="true">{trailingIcon}</span> : null}
        </span>
        <span className="pui-button__loading" aria-hidden={!loading}>
          <LoaderCircle className="pui-spinner" aria-hidden="true" />
          <span>{loadingLabel}</span>
        </span>
      </InternalControlSlotBoundary>
    </button>
  );
}

export type IconButtonProps = PublicControlProps<Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">> & {
  "aria-label": string;
  icon: ReactNode;
  loading?: boolean;
  variant?: "secondary" | "ghost" | "danger";
  controlRef?: ControlRef<ControlHandle>;
};

export function IconButton(rawProps: IconButtonProps) {
  const safeProps = sanitizeFixedControlProps(rawProps, ["children"]);
  const {
    icon,
    loading = false,
    variant = "ghost",
    disabled,
    type = "button",
    "aria-disabled": ariaDisabled,
    onClick,
    controlRef,
    ...props
  } = safeProps;
  const internalSlot = useInternalIconButtonSlot();
  const slotConfig = internalSlot ? ICON_BUTTON_SLOT_CONFIG[internalSlot] : DEFAULT_ICON_BUTTON_SLOT;
  const elementRef = useRef<HTMLButtonElement>(null);
  useImperativeHandle(controlRef, () => ({
    focus(options?: FocusOptions) {
      elementRef.current?.focus(options);
    },
  }) as ControlHandle, []);
  const explicitlyAriaDisabled = ariaDisabled === true || ariaDisabled === "true";
  const interactionDisabled = Boolean(disabled || loading || explicitlyAriaDisabled);
  return (
    <button
      ref={elementRef}
      {...props}
      type={type}
      className={cx("pui-icon-button", `pui-icon-button--${variant}`, slotConfig.className)}
      disabled={disabled}
      aria-disabled={loading || explicitlyAriaDisabled || undefined}
      aria-busy={loading || undefined}
      data-loading={loading || undefined}
      data-pui-owner="IconButton"
      onClick={(event) => {
        if (interactionDisabled) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        onClick?.(event);
      }}
    >
      <InternalControlSlotBoundary>
        <span className="pui-icon-button__icon" aria-hidden="true">
          {loading ? <LoaderCircle className="pui-spinner" /> : icon}
        </span>
      </InternalControlSlotBoundary>
    </button>
  );
}

export type SpinnerProps = PublicControlProps<
  Omit<HTMLAttributes<HTMLSpanElement>, "children" | "role">
> & {
  label?: string;
};

export function Spinner({ label, ...props }: SpinnerProps) {
  const { message } = usePersonalUILocale();
  const rootProps = sanitizeFixedControlProps(props, ["children", "role"]);
  return (
    <span {...rootProps} className="pui-spinner-wrap" role="status" data-pui-owner="Spinner">
      <LoaderCircle className="pui-spinner" aria-hidden="true" />
      <span className="pui-sr-only">{label ?? message("common.loading")}</span>
    </span>
  );
}

export type SkeletonProps = PublicControlProps<
  Omit<HTMLAttributes<HTMLSpanElement>, "aria-hidden" | "children">
> & {
  width?: string | number;
};

export function Skeleton({ width, ...props }: SkeletonProps) {
  const rootProps = sanitizeFixedControlProps(props, ["aria-hidden", "children"]);
  const resolvedStyle = width === undefined ? undefined : { width: "100%", maxWidth: width };

  return (
    <span
      {...rootProps}
      className="pui-skeleton"
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

export type TagProps = PublicControlProps<Omit<HTMLAttributes<HTMLSpanElement>, "onClick">> & {
  tone?: TagTone;
  leading?: ReactNode;
  selected?: boolean;
  onRemove?: () => void;
  removeLabel?: string;
};

export function Tag({
  tone = "neutral",
  leading,
  selected = false,
  onRemove,
  removeLabel,
  title,
  children,
  ...props
}: TagProps) {
  const { message } = usePersonalUILocale();
  const rootProps = sanitizeFixedControlProps(props);
  const contentTitle = title ?? (
    typeof children === "string" || typeof children === "number"
      ? String(children)
      : undefined
  );
  const resolvedRemoveLabel = removeLabel ?? (
    typeof children === "string" || typeof children === "number"
      ? message("tag.removeNamed", { name: String(children) })
      : message("tag.remove")
  );
  return (
    <span
      {...rootProps}
      title={contentTitle}
      className={cx("pui-tag", `pui-tag--${tone}`, selected && "is-selected")}
      data-selected={selected || undefined}
      data-pui-owner="Tag"
    >
      {leading ? <span className="pui-tag__leading" aria-hidden="true">{leading}</span> : null}
      <span className="pui-tag__label">{children}</span>
      {selected ? <span className="pui-sr-only">{message("tag.selected")}</span> : null}
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
