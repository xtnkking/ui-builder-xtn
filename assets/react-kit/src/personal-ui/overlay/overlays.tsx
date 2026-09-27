import {
  Children,
  Fragment,
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown, X } from "lucide-react";
import type { ControlledOpenProps, PublicControlProps } from "../foundation/contracts";
import { useControllableState } from "../internal/controllable-state";
import { floatingPortalTarget, usePopoverPosition } from "../internal/floating-position";
import { InternalButtonSlot } from "../internal/button-slots";
import { sanitizeFixedControlProps } from "../internal/fixed-control-props";
import {
  LayerParentProvider,
  useLayerKernel,
  useLayerPortalReady,
  useLayerPortalTarget,
} from "../internal/layer-kernel";
import {
  InternalOverlaySlotBoundary,
  InternalTooltipSlot,
  useInternalDropdownMenuSlot,
  useInternalTooltipSlot,
} from "../internal/overlay-slots";
import { observeComputedStyleChanges, usePersonalUiPortalTokens } from "../internal/portal-tokens";
import { usePersonalUILocale } from "../foundation/locale";
import { Button, IconButton } from "../foundation/primitives";
import { assertUniqueIdentities, cx, getTabStops, isVisibleElement } from "../internal/utils";

const useClientLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

function dialogInitialFocus(panel: HTMLElement): HTMLElement {
  const footer = panel.querySelector<HTMLElement>(".pui-dialog__footer, .pui-drawer__footer");
  return (footer && getTabStops(footer)[0]) || panel;
}

type DialogBaseProps = PublicControlProps<{
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  closable?: boolean;
  closeOnBackdropClick?: boolean;
  width?: "small" | "medium" | "large";
}>;

export type DialogProps = DialogBaseProps & ControlledOpenProps;

export function Dialog(rawProps: DialogProps) {
  const { message } = usePersonalUILocale();
  const safeProps = sanitizeFixedControlProps(rawProps);
  const { title, description, children, footer, closable = true, closeOnBackdropClick = true, width = "medium" } = safeProps;
  const [open, setOpen] = useControllableState({
    componentName: "Dialog",
    controlled: rawProps.open !== undefined,
    controlledOnly: true,
    value: safeProps.open,
    defaultValue: false,
    defaultValueProvided: rawProps.defaultOpen !== undefined,
    onChange: safeProps.onOpenChange,
    valuePropName: "open",
    defaultValuePropName: "defaultOpen",
    changePropName: "onOpenChange",
  });
  const titleId = useId();
  const descriptionId = useId();
  const hasBody = Children.toArray(children).length > 0;
  const sourceRef = useRef<HTMLSpanElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const portalReady = useLayerPortalReady();
  const portalTarget = useLayerPortalTarget(portalReady, sourceRef);
  const layer = useLayerKernel({
    active: open && portalTarget !== null,
    sourceRef,
    portalRef,
    panelRef,
    dismissPolicy: {
      backdrop: closable && closeOnBackdropClick,
      closeControl: closable,
      escape: closable,
    },
    initialFocus: dialogInitialFocus,
    onDismiss: () => setOpen(false),
  });
  return (
    <LayerParentProvider id={layer.id}>
      <span ref={sourceRef} hidden aria-hidden="true" data-pui-portal-source="dialog" />
      {open && portalTarget ? createPortal(
        <div ref={portalRef} className="pui-overlay pui-portal" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && layer.isTopLayer()) {
            event.preventDefault();
            layer.dismiss("backdrop");
          }
        }}>
          <div
            ref={panelRef}
            className={cx("pui-dialog", `pui-dialog--${width}`, !hasBody && "pui-dialog--no-body")}
            role="dialog"
            tabIndex={-1}
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description != null ? descriptionId : undefined}
            data-pui-owner="Dialog"
            onFocusCapture={layer.captureRestoreFocus}
          >
            <header className="pui-dialog__header">
              <div>
                <h2 id={titleId} title={typeof title === "string" || typeof title === "number" ? String(title) : undefined}>{title}</h2>
                {description != null ? <p id={descriptionId}>{description}</p> : null}
              </div>
              {closable ? <IconButton aria-label={message("dialog.close")} icon={<X aria-hidden="true" />} onClick={() => layer.dismiss("close-control")} /> : null}
            </header>
            {hasBody ? <div className="pui-dialog__body">{children}</div> : null}
            {footer != null ? <footer className="pui-dialog__footer">{footer}</footer> : null}
          </div>
        </div>,
        portalTarget,
      ) : null}
    </LayerParentProvider>
  );
}

type DrawerBaseProps = PublicControlProps<{
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  closable?: boolean;
  closeOnBackdropClick?: boolean;
  width?: "medium" | "large";
  variant?: "inset" | "edge";
}>;

export type DrawerProps = DrawerBaseProps & ControlledOpenProps;

export function Drawer(rawProps: DrawerProps) {
  const { message } = usePersonalUILocale();
  const safeProps = sanitizeFixedControlProps(rawProps);
  const { title, description, children, footer, closable = true, closeOnBackdropClick = true, width = "medium", variant = "edge" } = safeProps;
  const [open, setOpen] = useControllableState({
    componentName: "Drawer",
    controlled: rawProps.open !== undefined,
    controlledOnly: true,
    value: safeProps.open,
    defaultValue: false,
    defaultValueProvided: rawProps.defaultOpen !== undefined,
    onChange: safeProps.onOpenChange,
    valuePropName: "open",
    defaultValuePropName: "defaultOpen",
    changePropName: "onOpenChange",
  });
  const titleId = useId();
  const descriptionId = useId();
  const sourceRef = useRef<HTMLSpanElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const portalReady = useLayerPortalReady();
  const portalTarget = useLayerPortalTarget(portalReady, sourceRef);
  const layer = useLayerKernel({
    active: open && portalTarget !== null,
    sourceRef,
    portalRef,
    panelRef,
    dismissPolicy: {
      backdrop: closable && closeOnBackdropClick,
      closeControl: closable,
      escape: closable,
    },
    initialFocus: dialogInitialFocus,
    onDismiss: () => setOpen(false),
  });
  return (
    <LayerParentProvider id={layer.id}>
      <span ref={sourceRef} hidden aria-hidden="true" data-pui-portal-source="drawer" />
      {open && portalTarget ? createPortal(
        <div ref={portalRef} className={cx("pui-overlay", "pui-overlay--drawer", `pui-overlay--drawer-${variant}`, "pui-portal")} role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && layer.isTopLayer()) {
            event.preventDefault();
            layer.dismiss("backdrop");
          }
        }}>
          <aside
            ref={panelRef}
            className={cx("pui-drawer", `pui-drawer--${width}`, `pui-drawer--${variant}`)}
            role="dialog"
            tabIndex={-1}
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description != null ? descriptionId : undefined}
            data-pui-owner="Drawer"
            onFocusCapture={layer.captureRestoreFocus}
          >
            <header className="pui-drawer__header">
              <div>
                <h2 id={titleId} title={typeof title === "string" || typeof title === "number" ? String(title) : undefined}>{title}</h2>
                {description != null ? <p id={descriptionId}>{description}</p> : null}
              </div>
              {closable ? <IconButton aria-label={message("drawer.close")} icon={<X aria-hidden="true" />} onClick={() => layer.dismiss("close-control")} /> : null}
            </header>
            <div className="pui-drawer__body">{children}</div>
            {footer != null ? <footer className="pui-drawer__footer">{footer}</footer> : null}
          </aside>
        </div>,
        portalTarget,
      ) : null}
    </LayerParentProvider>
  );
}

export interface MenuItem {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  danger?: boolean;
}

export type DropdownMenuProps = PublicControlProps<{
  label: ReactNode;
  ariaLabel: string;
  items: MenuItem[];
  icon?: ReactNode;
  align?: "start" | "end";
}>;

const DROPDOWN_MENU_SLOT_CLASS = {
  "split-menu": "pui-split-button__menu",
} as const;

export function DropdownMenu(rawProps: DropdownMenuProps) {
  const safeProps = sanitizeFixedControlProps(rawProps);
  const { label, ariaLabel, items, icon, align = "end" } = safeProps;
  assertUniqueIdentities("DropdownMenu", "item.id", items.map((item) => item.id));
  const id = useId();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const typeaheadRef = useRef("");
  const typeaheadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openingEdgeRef = useRef<"first" | "last">("first");
  const internalSlot = useInternalDropdownMenuSlot();
  const slotClassName = internalSlot ? DROPDOWN_MENU_SLOT_CLASS[internalSlot] : undefined;
  const hasItemIcons = items.some((item) => item.icon != null);
  const hasEnabledItems = items.some((item) => !item.disabled);
  usePopoverPosition(open, "bottom", rootRef, menuRef, align);

  useEffect(() => { setPortalTarget(floatingPortalTarget(rootRef.current)); }, []);

  const enabledItems = () => Array.from(
    menuRef.current?.querySelectorAll<HTMLButtonElement>(".pui-dropdown__item:not(:disabled)") ?? [],
  );

  const resetTypeahead = () => {
    typeaheadRef.current = "";
    if (typeaheadTimerRef.current) {
      clearTimeout(typeaheadTimerRef.current);
      typeaheadTimerRef.current = null;
    }
  };

  const openMenu = (edge: "first" | "last" = "first") => {
    if (!hasEnabledItems) return;
    resetTypeahead();
    openingEdgeRef.current = edge;
    setOpen(true);
  };

  const closeMenu = (restoreFocus = false) => {
    resetTypeahead();
    if (restoreFocus) triggerRef.current?.focus({ preventScroll: true });
    setOpen(false);
  };

  useEffect(() => {
    if (!hasEnabledItems) setOpen(false);
  }, [hasEnabledItems]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | FocusEvent) => {
      if (!rootRef.current?.contains(event.target as Node) && !menuRef.current?.contains(event.target as Node)) closeMenu();
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("focusin", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("focusin", close);
    };
  }, [open]);

  useClientLayoutEffect(() => {
    if (!open) return;
    const available = enabledItems();
    if (!available.length) {
      triggerRef.current?.focus({ preventScroll: true });
      return;
    }
    if (available.includes(document.activeElement as HTMLButtonElement)) return;
    available[openingEdgeRef.current === "first" ? 0 : available.length - 1]?.focus({ preventScroll: true });
  }, [items, open]);

  useEffect(() => () => {
    if (typeaheadTimerRef.current) clearTimeout(typeaheadTimerRef.current);
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      if (!open) return;
      event.preventDefault();
      closeMenu(true);
      return;
    }
    const target = event.target as HTMLElement;
    if (target === triggerRef.current && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault();
      openMenu(event.key === "ArrowDown" ? "first" : "last");
      return;
    }
    if (!open) return;
    if (event.key === "Tab") {
      // Menu items use roving focus and are intentionally absent from the
      // document tab order. Re-anchor focus before the browser resolves the
      // next sequential target, including inside a modal focus trap.
      closeMenu(true);
      return;
    }
    const available = enabledItems();
    if (!available.length) return;
    const currentIndex = available.indexOf(target as HTMLButtonElement);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      const next = currentIndex < 0 ? (direction === 1 ? 0 : available.length - 1) : (currentIndex + direction + available.length) % available.length;
      available[next]?.focus({ preventScroll: true });
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      available[event.key === "Home" ? 0 : available.length - 1]?.focus({ preventScroll: true });
      return;
    }
    if (event.nativeEvent.isComposing || event.key.length !== 1 || event.altKey || event.ctrlKey || event.metaKey) return;
    typeaheadRef.current += event.key.toLocaleLowerCase();
    if (typeaheadTimerRef.current) clearTimeout(typeaheadTimerRef.current);
    typeaheadTimerRef.current = setTimeout(() => { typeaheadRef.current = ""; }, 500);
    const match = available.find((item) => item.textContent?.trim().toLocaleLowerCase().startsWith(typeaheadRef.current));
    if (match) {
      event.preventDefault();
      match.focus({ preventScroll: true });
    }
  };

  return (
    <div ref={rootRef} className={cx("pui-dropdown", slotClassName)} data-pui-owner="DropdownMenu" onKeyDown={handleKeyDown}>
      <InternalOverlaySlotBoundary>
        <InternalButtonSlot name="dropdown-trigger" elementRef={triggerRef}>
          <Button
            icon={icon}
            trailingIcon={<ChevronDown aria-hidden="true" />}
            aria-label={ariaLabel}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-controls={open ? id : undefined}
            disabled={!hasEnabledItems}
            onClick={() => open ? closeMenu() : openMenu()}
          >
            <span
              className="pui-dropdown__trigger-label"
              title={typeof label === "string" || typeof label === "number" ? String(label) : undefined}
            >
              {label}
            </span>
          </Button>
        </InternalButtonSlot>
        {open && portalTarget ? createPortal(
          <div
            ref={menuRef}
            id={id}
            className={cx("pui-dropdown__menu", `pui-dropdown__menu--${align}`, "pui-portal")}
            role="menu"
            aria-label={ariaLabel}
            data-pui-floating-root="true"
          >
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                tabIndex={-1}
                className={cx("pui-dropdown__item", item.danger && "is-danger")}
                disabled={item.disabled}
                onClick={() => {
                  closeMenu(true);
                  item.onSelect();
                }}
              >
                {hasItemIcons ? <span className="pui-dropdown__item-icon" aria-hidden="true">{item.icon}</span> : null}
                <span
                  className="pui-dropdown__item-label"
                  title={typeof item.label === "string" || typeof item.label === "number" ? String(item.label) : undefined}
                >
                  {item.label}
                </span>
              </button>
            ))}
          </div>, portalTarget) : null}
      </InternalOverlaySlotBoundary>
    </div>
  );
}

export type TooltipProps = PublicControlProps<{
  content: ReactNode;
  children: ReactNode;
  placement?: "top" | "right" | "bottom" | "left";
  disabled?: boolean;
  ariaLabel?: string;
  fill?: boolean;
}>;

const TOOLTIP_SLOT_OWNER = {
  "overflow-text": "OverflowText",
} as const;

interface TooltipChildProps {
  "aria-describedby"?: string;
  contentEditable?: boolean | "true" | "false" | "plaintext-only";
  controls?: boolean;
  disabled?: boolean;
  href?: string;
  tabIndex?: number;
  type?: string;
}

const tooltipFocusTargetSelector = [
  "a[href]",
  "area[href]",
  "button:not(:disabled)",
  "input:not(:disabled):not([type='hidden'])",
  "select:not(:disabled)",
  "textarea:not(:disabled)",
  "summary",
  "iframe",
  "object",
  "embed",
  "audio[controls]",
  "video[controls]",
  "[contenteditable='true']",
  "[contenteditable='plaintext-only']",
  "[tabindex]",
].join(",");

function tooltipDescriptionTargets(trigger: HTMLElement): HTMLElement[] {
  return Array.from(trigger.querySelectorAll<HTMLElement>(tooltipFocusTargetSelector)).filter((element) => (
    !element.matches(":disabled")
    && !element.closest("[inert], [aria-hidden='true']")
    && isVisibleElement(element)
  ));
}

function tooltipNativeChildIsKeyboardReachable(child: ReactNode): child is ReactElement<TooltipChildProps> {
  if (!isValidElement<TooltipChildProps>(child) || child.type === Fragment || child.props.disabled) return false;
  // Custom components may ignore aria-describedby or render a completely
  // different focus target. Their actual DOM is inspected after mount.
  if (typeof child.type !== "string") return false;
  if (typeof child.props.tabIndex === "number") return child.props.tabIndex >= 0;
  if (
    child.props.contentEditable === true
    || child.props.contentEditable === "true"
    || child.props.contentEditable === "plaintext-only"
  ) return true;
  const elementName = child.type.toLocaleLowerCase();
  if (["button", "select", "textarea", "summary", "iframe", "object", "embed"].includes(elementName)) return true;
  if (elementName === "input") return child.props.type?.toLocaleLowerCase() !== "hidden";
  if (elementName === "a" || elementName === "area") return Boolean(child.props.href);
  if (elementName === "audio" || elementName === "video") return Boolean(child.props.controls);
  return false;
}

export function Tooltip(rawProps: TooltipProps) {
  const { message } = usePersonalUILocale();
  const safeProps = sanitizeFixedControlProps(rawProps);
  const { content, children, placement = "top", disabled, ariaLabel, fill } = safeProps;
  const id = useId();
  const [open, setOpen] = useState(false);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const rootRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const bubbleRef = useRef<HTMLSpanElement>(null);
  usePersonalUiPortalTokens(!disabled && open && portalTarget !== null, rootRef, bubbleRef);
  const describedTargetsRef = useRef<Set<HTMLElement>>(new Set());
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const internalSlot = useInternalTooltipSlot();
  const owner = internalSlot ? TOOLTIP_SLOT_OWNER[internalSlot] : "Tooltip";
  const nativeChildIsKeyboardReachable = tooltipNativeChildIsKeyboardReachable(children);
  const [hasFocusableDescendant, setHasFocusableDescendant] = useState(nativeChildIsKeyboardReachable);
  useEffect(() => {
    setPortalTarget(floatingPortalTarget(rootRef.current));
  }, []);
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);
  const cancelScheduledClose = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
  };
  const scheduleClose = () => {
    cancelScheduledClose();
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      setOpen(false);
    }, 100);
  };
  useEffect(() => {
    if (!open) return;
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      cancelScheduledClose();
      setOpen(false);
    };
    document.addEventListener("keydown", handleEscape, true);
    return () => document.removeEventListener("keydown", handleEscape, true);
  }, [open]);
  useEffect(() => () => cancelScheduledClose(), []);
  useClientLayoutEffect(() => {
    const bubble = bubbleRef.current;
    const trigger = triggerRef.current;
    if (!open || disabled || !bubble || !trigger) return;
    let animationFrame = 0;
    const keepInsideViewport = () => {
      bubble.removeAttribute("data-positioned");
      const triggerRect = trigger.getBoundingClientRect();
      const bubbleRect = bubble.getBoundingClientRect();
      const viewportWidth = document.documentElement.clientWidth;
      const viewportHeight = document.documentElement.clientHeight;
      const margin = 12;
      const gap = 7;
      const opposite = { top: "bottom", right: "left", bottom: "top", left: "right" } as const;
      const calculate = (side: TooltipProps["placement"]) => {
        if (side === "right") {
          return { left: triggerRect.right + gap, top: triggerRect.top + (triggerRect.height - bubbleRect.height) / 2 };
        }
        if (side === "bottom") {
          return { left: triggerRect.left + (triggerRect.width - bubbleRect.width) / 2, top: triggerRect.bottom + gap };
        }
        if (side === "left") {
          return { left: triggerRect.left - gap - bubbleRect.width, top: triggerRect.top + (triggerRect.height - bubbleRect.height) / 2 };
        }
        return { left: triggerRect.left + (triggerRect.width - bubbleRect.width) / 2, top: triggerRect.top - gap - bubbleRect.height };
      };
      const fitsMainAxis = (side: TooltipProps["placement"], position: { left: number; top: number }) => (
        side === "top" ? position.top >= margin
          : side === "right" ? position.left + bubbleRect.width <= viewportWidth - margin
            : side === "bottom" ? position.top + bubbleRect.height <= viewportHeight - margin
              : position.left >= margin
      );
      let resolvedPlacement = placement;
      let position = calculate(resolvedPlacement);
      if (!fitsMainAxis(resolvedPlacement, position)) {
        const alternate = opposite[resolvedPlacement];
        const alternatePosition = calculate(alternate);
        if (fitsMainAxis(alternate, alternatePosition)) {
          resolvedPlacement = alternate;
          position = alternatePosition;
        }
      }
      const maxLeft = Math.max(margin, viewportWidth - margin - bubbleRect.width);
      const maxTop = Math.max(margin, viewportHeight - margin - bubbleRect.height);
      const left = Math.min(Math.max(position.left, margin), maxLeft);
      const top = Math.min(Math.max(position.top, margin), maxTop);
      bubble.style.left = `${Math.round(left * 100) / 100}px`;
      bubble.style.top = `${Math.round(top * 100) / 100}px`;
      bubble.dataset.placement = resolvedPlacement;
      bubble.dataset.positioned = "true";
    };
    const scheduleUpdate = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(keepInsideViewport);
    };
    keepInsideViewport();
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("scroll", scheduleUpdate, true);
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(scheduleUpdate) : null;
    observer?.observe(bubble);
    observer?.observe(trigger);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("scroll", scheduleUpdate, true);
      observer?.disconnect();
      bubble.removeAttribute("data-positioned");
    };
  }, [content, disabled, open, placement, portalTarget]);
  useClientLayoutEffect(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const removeDescription = (element: HTMLElement) => {
      const remaining = (element.getAttribute("aria-describedby") ?? "")
        .trim()
        .split(/\s+/)
        .filter((token) => token && token !== id);
      if (remaining.length) element.setAttribute("aria-describedby", [...new Set(remaining)].join(" "));
      else element.removeAttribute("aria-describedby");
    };
    const syncTargets = () => {
      const currentTrigger = triggerRef.current;
      if (!currentTrigger) return;
      const nextTargets = new Set(tooltipDescriptionTargets(currentTrigger));
      const hasTabStop = getTabStops(currentTrigger).length > 0;
      setHasFocusableDescendant((current) => current === hasTabStop ? current : hasTabStop);
      describedTargetsRef.current.forEach((element) => {
        if (disabled || !nextTargets.has(element)) removeDescription(element);
      });
      if (!disabled) {
        nextTargets.forEach((element) => {
          const tokens = (element.getAttribute("aria-describedby") ?? "")
            .trim()
            .split(/\s+/)
            .filter(Boolean);
          element.setAttribute("aria-describedby", [...new Set([...tokens, id])].join(" "));
        });
      }
      describedTargetsRef.current = disabled ? new Set() : nextTargets;
    };
    syncTargets();

    const observer = typeof MutationObserver === "function"
      ? new MutationObserver(syncTargets)
      : null;
    observer?.observe(trigger, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: [
        "disabled",
        "hidden",
        "href",
        "tabindex",
        "contenteditable",
        "aria-hidden",
        "inert",
        "controls",
        "type",
        "class",
        "style",
      ],
    });
    return () => observer?.disconnect();
  }, [disabled, id, nativeChildIsKeyboardReachable]);
  useEffect(() => () => {
    describedTargetsRef.current.forEach((element) => {
      const remaining = (element.getAttribute("aria-describedby") ?? "")
        .trim()
        .split(/\s+/)
        .filter((token) => token && token !== id);
      if (remaining.length) element.setAttribute("aria-describedby", [...new Set(remaining)].join(" "));
      else element.removeAttribute("aria-describedby");
    });
    describedTargetsRef.current.clear();
  }, [id]);
  const childCanOwnDescription = isValidElement<TooltipChildProps>(children)
    && children.type !== Fragment
    && typeof children.type === "string";
  const existingDescription = childCanOwnDescription
    ? (children as ReactElement<{ "aria-describedby"?: string }>).props["aria-describedby"]
    : undefined;
  const describedBy = disabled
    ? existingDescription
    : [...new Set(
        [existingDescription, id]
          .filter((value): value is string => Boolean(value))
          .flatMap((value) => value.trim().split(/\s+/))
          .filter(Boolean),
      )].join(" ") || undefined;
  const fallbackTriggerLabel = ariaLabel ?? (
    typeof content === "string" || typeof content === "number"
      ? String(content)
      : message("tooltip.moreInformation")
  );
  const child = nativeChildIsKeyboardReachable
    ? cloneElement(children as ReactElement<{ "aria-describedby"?: string }>, {
        "aria-describedby": describedBy,
      })
    : children;
  return (
    <span
      ref={rootRef}
      className={cx("pui-tooltip", fill && "pui-tooltip--fill")}
      data-placement={placement}
      data-open={!disabled && open || undefined}
      data-pui-owner={owner}
      onMouseEnter={() => {
        cancelScheduledClose();
        if (!disabled) setOpen(true);
      }}
      onMouseLeave={scheduleClose}
      onFocusCapture={() => {
        cancelScheduledClose();
        if (!disabled) setOpen(true);
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
      onKeyDownCapture={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          setOpen(false);
        }
      }}
    >
      <InternalOverlaySlotBoundary>
        <span
          ref={triggerRef}
          className="pui-tooltip__trigger"
          tabIndex={!hasFocusableDescendant && !disabled ? 0 : undefined}
          aria-describedby={!hasFocusableDescendant && !disabled ? describedBy : undefined}
          aria-label={!hasFocusableDescendant && !disabled ? fallbackTriggerLabel : undefined}
        >
          {child}
        </span>
        {!disabled ? (
          portalTarget
            ? createPortal(
                <span
                  ref={bubbleRef}
                  id={id}
                  className="pui-tooltip__bubble pui-portal"
                  role="tooltip"
                  data-open={open || undefined}
                  data-placement={placement}
                  onMouseEnter={cancelScheduledClose}
                  onMouseLeave={scheduleClose}
                >
                  {content}
                </span>,
                portalTarget,
              )
            : (
                <span
                  ref={bubbleRef}
                  id={id}
                  className="pui-tooltip__bubble pui-portal"
                  role="tooltip"
                  data-open={open || undefined}
                  data-placement={placement}
                  onMouseEnter={cancelScheduledClose}
                  onMouseLeave={scheduleClose}
                >
                  {content}
                </span>
              )
        ) : null}
      </InternalOverlaySlotBoundary>
    </span>
  );
}

export type OverflowTextProps = PublicControlProps<{
  children: string;
  placement?: TooltipProps["placement"];
}>;

export function OverflowText(rawProps: OverflowTextProps) {
  const safeProps = sanitizeFixedControlProps(rawProps);
  const { children, placement } = safeProps;
  const textRef = useRef<HTMLSpanElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  useClientLayoutEffect(() => {
    const element = textRef.current;
    if (!element) return;
    const measure = () => {
      const nextOverflowing = element.scrollWidth > element.clientWidth + 1;
      setOverflowing((current) => current === nextOverflowing ? current : nextOverflowing);
    };
    measure();
    return observeComputedStyleChanges(element, measure, { observeAncestors: false });
  }, [children]);
  return (
    <InternalTooltipSlot name="overflow-text">
      <Tooltip content={children} placement={placement} disabled={!overflowing}>
        <span ref={textRef} className="pui-overflow-text" tabIndex={overflowing ? 0 : undefined}>{children}</span>
      </Tooltip>
    </InternalTooltipSlot>
  );
}
