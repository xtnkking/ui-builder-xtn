import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { Flag, LoaderCircle, X } from "lucide-react";
import type { ControlHandle, ControlRef, PublicControlProps } from "./contracts";
import {
  InternalControlSlotBoundary,
  useInternalButtonSlot,
  useInternalFilterAction,
  useInternalIconButtonSlot,
  type InternalButtonSlotName,
  type InternalIconButtonSlotName,
} from "../internal/button-slots";
import { assignElementRef } from "../internal/control-handles";
import { sanitizeFixedControlProps } from "../internal/fixed-control-props";
import { recordLayerActivation } from "../internal/layer-activation";
import { observeComputedStyleChanges } from "../internal/portal-tokens";
import { useUILocale } from "./locale";
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
  "split-primary": { className: "ui-split-button__primary", owner: "Button" },
  toggle: { className: "ui-toggle-button", owner: "ToggleButton" },
  retry: { owner: "RetryButton" },
  "async-action": { owner: "AsyncAction" },
  "dropdown-trigger": { owner: "Button" },
};

interface IconButtonSlotConfig {
  className?: string;
}

const DEFAULT_ICON_BUTTON_SLOT: IconButtonSlotConfig = {};
const ICON_BUTTON_SLOT_CONFIG: Record<InternalIconButtonSlotName, IconButtonSlotConfig> = {
  "lightbox-close": { className: "ui-lightbox__close" },
  "lightbox-previous": { className: "ui-lightbox__previous" },
  "lightbox-next": { className: "ui-lightbox__next" },
};

export function Button(rawProps: ButtonProps) {
  const { message } = useUILocale();
  const filterAction = useInternalFilterAction();
  const safeProps = sanitizeFixedControlProps(rawProps);
  const {
    variant = "secondary",
    size = "medium",
    icon,
    trailingIcon,
    loading = false,
    children,
    loadingLabel = filterAction && (typeof children === "string" || typeof children === "number") ? children : message("common.processing"),
    disabled,
    "aria-disabled": ariaDisabled,
    onClick,
    onClickCapture,
    onPointerDownCapture,
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
      className={cx("ui-button", `ui-button--${variant}`, `ui-button--${size}`, slotClassName)}
      disabled={disabled}
      aria-disabled={loading || explicitlyAriaDisabled || undefined}
      aria-busy={loading || undefined}
      data-loading={loading || undefined}
      data-ui-owner={owner}
      onPointerDownCapture={(event) => {
        if (!interactionDisabled) recordLayerActivation(event.currentTarget.ownerDocument, event.currentTarget, event.nativeEvent);
        onPointerDownCapture?.(event);
      }}
      onClickCapture={(event) => {
        if (!interactionDisabled) recordLayerActivation(event.currentTarget.ownerDocument, event.currentTarget, event.nativeEvent);
        onClickCapture?.(event);
      }}
      onClick={(event) => {
        if (interactionDisabled) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        recordLayerActivation(event.currentTarget.ownerDocument, event.currentTarget, event.nativeEvent);
        onClick?.(event);
      }}
    >
      <InternalControlSlotBoundary>
        <span className="ui-button__content" aria-hidden={loading || undefined}>
          {icon ? <span className="ui-button__icon" aria-hidden="true">{icon}</span> : null}
          <span className="ui-button__label">{children}</span>
          {trailingIcon ? <span className="ui-button__trailing" aria-hidden="true">{trailingIcon}</span> : null}
        </span>
        <span className="ui-button__loading" aria-hidden={!loading}>
          <LoaderCircle className="ui-spinner" aria-hidden="true" />
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
    onClickCapture,
    onPointerDownCapture,
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
      className={cx("ui-icon-button", `ui-icon-button--${variant}`, slotConfig.className)}
      disabled={disabled}
      aria-disabled={loading || explicitlyAriaDisabled || undefined}
      aria-busy={loading || undefined}
      data-loading={loading || undefined}
      data-ui-owner="IconButton"
      onPointerDownCapture={(event) => {
        if (!interactionDisabled) recordLayerActivation(event.currentTarget.ownerDocument, event.currentTarget, event.nativeEvent);
        onPointerDownCapture?.(event);
      }}
      onClickCapture={(event) => {
        if (!interactionDisabled) recordLayerActivation(event.currentTarget.ownerDocument, event.currentTarget, event.nativeEvent);
        onClickCapture?.(event);
      }}
      onClick={(event) => {
        if (interactionDisabled) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        recordLayerActivation(event.currentTarget.ownerDocument, event.currentTarget, event.nativeEvent);
        onClick?.(event);
      }}
    >
      <InternalControlSlotBoundary>
        <span className="ui-icon-button__icon" aria-hidden="true">
          {loading ? <LoaderCircle className="ui-spinner" /> : icon}
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
  const { message } = useUILocale();
  const rootProps = sanitizeFixedControlProps(props, ["children", "role"]);
  return (
    <span {...rootProps} className="ui-spinner-wrap" role="status" data-ui-owner="Spinner">
      <LoaderCircle className="ui-spinner" aria-hidden="true" />
      <span className="ui-sr-only">{label ?? message("common.loading")}</span>
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
      className="ui-skeleton"
      style={resolvedStyle}
      aria-hidden="true"
      data-ui-owner="Skeleton"
    />
  );
}

export type TagTone = "neutral" | "blue" | "success" | "warning" | "danger";

function captureTagRemovalFocus(removeButton: HTMLButtonElement): (() => void) | null {
  const ownerDocument = removeButton.ownerDocument;
  if (ownerDocument.activeElement !== removeButton) return null;
  const tag = removeButton.closest<HTMLElement>(".ui-tag");
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

export interface CountryTagData {
  /** ISO 3166-1 alpha-2 code; rendered uppercase. */
  code: string;
  /** Consumer-owned country/territory name; only this segment truncates. */
  name: string;
  /** Optional consumer-owned dialing code, e.g. +44 or +1 684. */
  callingCode?: string;
  /** Defaults to https://flagcdn.com/w40/{lowercase code}.png. */
  flagSrc?: string;
}

export type TagProps = PublicControlProps<Omit<HTMLAttributes<HTMLSpanElement>, "onClick" | "children">> & {
  tone?: TagTone;
  /** Small business-status tags keep readable text in dense table rows. */
  size?: "small" | "medium";
  selected?: boolean;
  onRemove?: () => void;
  removeLabel?: string;
} & (
  | { country: CountryTagData; children?: never; leading?: never }
  | { country?: never; children?: ReactNode; leading?: ReactNode }
);

function CountryTagFlag({ src }: { src: string }) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  return (
    <span className="ui-tag__flag" aria-hidden="true" data-flag-state={status}>
      {status !== "loaded" ? <Flag /> : null}
      <img
        src={src}
        alt=""
        draggable={false}
        hidden={status !== "loaded"}
        onLoad={() => setStatus("loaded")}
        onError={() => setStatus("error")}
      />
    </span>
  );
}

export function Tag({
  tone = "neutral",
  size = "medium",
  leading,
  selected = false,
  onRemove,
  removeLabel,
  title,
  children,
  country,
  ...props
}: TagProps) {
  const { message } = useUILocale();
  const rootProps = sanitizeFixedControlProps(props);
  const labelRef = useRef<HTMLSpanElement>(null);
  const countryNameRef = useRef<HTMLSpanElement>(null);
  const [labelOverflowing, setLabelOverflowing] = useState(false);
  const code = country?.code.trim().toUpperCase();
  if (country && (!code || !/^[A-Z]{2}$/.test(code) || !country.name.trim())) {
    throw new Error("Tag country requires a two-letter country code and a non-empty name.");
  }
  if (country && (children !== undefined || leading !== undefined)) {
    throw new Error("Tag country cannot be combined with children or leading.");
  }
  const flagSrc = country?.flagSrc ?? (code ? `https://flagcdn.com/w40/${code.toLowerCase()}.png` : "");
  const textLabel = country
    ? [code, country.name, country.callingCode].filter(Boolean).join(" ")
    : typeof children === "string" || typeof children === "number"
    ? String(children)
    : undefined;
  useEffect(() => {
    const element = countryNameRef.current ?? labelRef.current;
    if (!element) return;
    const measure = () => {
      const overflowing = textLabel !== undefined && element.scrollWidth > element.clientWidth + 1;
      setLabelOverflowing((current) => current === overflowing ? current : overflowing);
    };
    measure();
    return observeComputedStyleChanges(element, measure, { observeAncestors: false });
  }, [textLabel]);
  const contentTitle = title ?? textLabel;
  const resolvedRemoveLabel = removeLabel ?? (
    textLabel !== undefined
      ? message("tag.removeNamed", { name: textLabel })
      : message("tag.remove")
  );
  return (
    <span
      {...rootProps}
      title={contentTitle}
      className={cx("ui-tag", `ui-tag--${tone}`, size === "small" && "ui-tag--small", country && "ui-tag--country", selected && "is-selected")}
      data-selected={selected || undefined}
      data-ui-owner="Tag"
    >
      {leading ? <span className="ui-tag__leading" aria-hidden="true">{leading}</span> : null}
      {country ? <CountryTagFlag key={flagSrc} src={flagSrc} /> : null}
      <span
        ref={labelRef}
        className={cx("ui-tag__label", country && "ui-tag__country")}
        tabIndex={labelOverflowing ? 0 : undefined}
        role={labelOverflowing ? "group" : undefined}
        aria-label={labelOverflowing ? textLabel : undefined}
      >
        {country ? (
          <>
            <span className="ui-tag__country-code">{code}</span>
            <span ref={countryNameRef} className="ui-tag__country-name">{country.name}</span>
            {country.callingCode ? <span className="ui-tag__calling-code">{country.callingCode}</span> : null}
          </>
        ) : children}
      </span>
      {selected ? <span className="ui-sr-only">{message("tag.selected")}</span> : null}
      {onRemove ? (
        <button
          type="button"
          className="ui-tag__remove"
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
