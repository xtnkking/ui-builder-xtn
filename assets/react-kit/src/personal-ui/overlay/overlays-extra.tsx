import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, CircleAlert, X } from "lucide-react";
import type {
  ControllableOpenProps,
  ControlledOpenProps,
  ControlledValueProps,
  PublicControlProps,
} from "../foundation/contracts";
import { useControllableState } from "../internal/controllable-state";
import { Alert } from "../feedback/feedback";
import { floatingPortalTarget } from "../internal/floating-position";
import { InternalIconButtonSlot } from "../internal/button-slots";
import { sanitizeFixedControlProps } from "../internal/fixed-control-props";
import {
  LayerParentProvider,
  useLayerKernel,
  useLayerPortalReady,
  useLayerPortalTarget,
} from "../internal/layer-kernel";
import {
  InternalOverlaySlotBoundary,
  InternalPopoverSlot,
  useInternalPopoverSlot,
} from "../internal/overlay-slots";
import { Button, IconButton } from "../foundation/primitives";
import { Dialog, type MenuItem } from "./overlays";
import { usePersonalUiPortalTokens } from "../internal/portal-tokens";
import { usePersonalUILocale } from "../foundation/locale";
import { assertUniqueIdentities, cx, getTabStops, isVisibleElement } from "../internal/utils";

type FloatingPlacement = "top" | "bottom" | "left" | "right";
type FloatingAlign = "start" | "center" | "end";
const useClientLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

function requireTriggerLabel(componentName: string, value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(
      `${componentName} requires triggerLabel to be a non-empty string. `
      + "Interactive React nodes are not accepted because the component owns the trigger button.",
    );
  }
  return value;
}

function useFloatingPosition(
  open: boolean,
  triggerRef: React.RefObject<HTMLElement | null>,
  panelRef: React.RefObject<HTMLElement | null>,
  placement: FloatingPlacement,
  align: FloatingAlign,
) {
  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return;
    const update = () => {
      const anchor = trigger.getBoundingClientRect();
      const surface = panel.getBoundingClientRect();
      const gutter = 12;
      const gap = 8;
      const viewportWidth = document.documentElement.clientWidth;
      const viewportHeight = document.documentElement.clientHeight;
      let resolvedPlacement = placement;
      if (placement === "bottom" && anchor.bottom + gap + surface.height > viewportHeight - gutter && anchor.top - gap - surface.height >= gutter) resolvedPlacement = "top";
      if (placement === "top" && anchor.top - gap - surface.height < gutter && anchor.bottom + gap + surface.height <= viewportHeight - gutter) resolvedPlacement = "bottom";
      if (placement === "right" && anchor.right + gap + surface.width > viewportWidth - gutter && anchor.left - gap - surface.width >= gutter) resolvedPlacement = "left";
      if (placement === "left" && anchor.left - gap - surface.width < gutter && anchor.right + gap + surface.width <= viewportWidth - gutter) resolvedPlacement = "right";
      const horizontal = resolvedPlacement === "top" || resolvedPlacement === "bottom";
      let left = horizontal
        ? align === "start" ? anchor.left : align === "end" ? anchor.right - surface.width : anchor.left + (anchor.width - surface.width) / 2
        : resolvedPlacement === "right" ? anchor.right + gap : anchor.left - surface.width - gap;
      let top = horizontal
        ? resolvedPlacement === "bottom" ? anchor.bottom + gap : anchor.top - surface.height - gap
        : align === "start" ? anchor.top : align === "end" ? anchor.bottom - surface.height : anchor.top + (anchor.height - surface.height) / 2;
      left = Math.max(gutter, Math.min(left, viewportWidth - surface.width - gutter));
      top = Math.max(gutter, Math.min(top, viewportHeight - surface.height - gutter));
      panel.style.left = `${Math.round(left)}px`;
      panel.style.top = `${Math.round(top)}px`;
      panel.dataset.placement = resolvedPlacement;
      panel.dataset.positioned = "true";
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(trigger);
    observer?.observe(panel);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      observer?.disconnect();
    };
  }, [align, open, panelRef, placement, triggerRef]);
}

type PopoverBaseProps = PublicControlProps<{
  triggerLabel: string;
  children: ReactNode;
  ariaLabel: string;
  placement?: FloatingPlacement;
  align?: FloatingAlign;
  interaction?: "click" | "hover";
  disabled?: boolean;
  matchTriggerWidth?: boolean;
}>;

type WrappedOverlayControlProps<Props extends object> = PublicControlProps<Props> & {
  "data-pui-owner"?: never;
  "data-pui-slot"?: never;
};

export type PopoverProps = PopoverBaseProps & ControllableOpenProps;
type PopoverRootProps = PopoverProps;

const POPOVER_SLOT_CONFIG = {
  "hover-card": {
    className: "pui-hover-card",
    owner: "HoverCard",
    interaction: "hover",
  },
} as const;

function PopoverRoot(rawProps: PopoverRootProps) {
  const controlled = rawProps.open !== undefined;
  const defaultOpenProvided = rawProps.defaultOpen !== undefined;
  const {
  triggerLabel: rawTriggerLabel,
  children,
  ariaLabel,
  open,
  defaultOpen = false,
  onOpenChange,
  placement = "bottom",
  align = "start",
  interaction = "click",
  disabled,
  matchTriggerWidth,
  } = rawProps;
  const internalSlot = useInternalPopoverSlot();
  const slotConfig = internalSlot ? POPOVER_SLOT_CONFIG[internalSlot] : null;
  const owner = slotConfig?.owner ?? "Popover";
  const triggerLabel = requireTriggerLabel(owner, rawTriggerLabel);
  const resolvedInteraction = slotConfig?.interaction ?? interaction;
  const [openState, setOpenState] = useControllableState({
    componentName: owner,
    controlled,
    value: open,
    defaultValue: defaultOpen,
    defaultValueProvided: defaultOpenProvided,
    onChange: onOpenChange,
    valuePropName: "open",
    defaultValuePropName: "defaultOpen",
    changePropName: "onOpenChange",
  });
  const id = useId();
  const sourceRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const isOpen = !disabled && openState;
  const setOpen = (next: boolean, restoreFocus = false) => {
    if (disabled) return;
    setOpenState(next);
    if (!next && restoreFocus) queueMicrotask(() => triggerRef.current?.focus({ preventScroll: true }));
  };
  const cancelClose = () => {
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimerRef.current = window.setTimeout(() => setOpen(false), 120);
  };
  useFloatingPosition(isOpen && portalTarget !== null, triggerRef, panelRef, placement, align);
  usePersonalUiPortalTokens(isOpen && portalTarget !== null, sourceRef, panelRef);

  useEffect(() => { setPortalTarget(floatingPortalTarget(sourceRef.current)); }, []);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !panelRef.current?.contains(target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false, true);
      }
    };
    document.addEventListener("pointerdown", closeOnPointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnPointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  useEffect(() => () => cancelClose(), []);

  const hoverHandlers = resolvedInteraction === "hover" ? {
    onMouseEnter: () => { cancelClose(); setOpen(true); },
    onMouseLeave: scheduleClose,
    onFocus: () => { cancelClose(); setOpen(true); },
    onBlur: (event: React.FocusEvent<HTMLButtonElement>) => {
      if (!panelRef.current?.contains(event.relatedTarget as Node | null)) scheduleClose();
    },
  } : {};

  return (
    <span ref={sourceRef} className={cx("pui-popover", slotConfig?.className)} data-pui-owner={owner}>
      <InternalOverlaySlotBoundary>
        <button
          ref={triggerRef}
          type="button"
          className="pui-popover__trigger"
          aria-label={ariaLabel}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          aria-controls={isOpen ? id : undefined}
          disabled={disabled}
          onClick={resolvedInteraction === "click" ? () => setOpen(!isOpen) : undefined}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              if (isOpen) {
                event.preventDefault();
                event.stopPropagation();
                setOpen(false, true);
              }
            }
          }}
          {...hoverHandlers}
        >
          {triggerLabel}
        </button>
        {isOpen && portalTarget ? createPortal(
          <div
            ref={panelRef}
            id={id}
            className="pui-popover__surface pui-portal"
            data-pui-floating-root="true"
            role="dialog"
            aria-label={ariaLabel}
            style={matchTriggerWidth ? { minWidth: triggerRef.current?.getBoundingClientRect().width } : undefined}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                setOpen(false, true);
              }
            }}
            onMouseEnter={resolvedInteraction === "hover" ? cancelClose : undefined}
            onMouseLeave={resolvedInteraction === "hover" ? scheduleClose : undefined}
          >
            {children}
          </div>,
          portalTarget,
        ) : null}
      </InternalOverlaySlotBoundary>
    </span>
  );
}

export function Popover(rawProps: PopoverProps) {
  const safeProps = sanitizeFixedControlProps(rawProps);
  return <PopoverRoot {...safeProps} />;
}

export type HoverCardProps = WrappedOverlayControlProps<Omit<
  PopoverBaseProps,
  "interaction"
>> & ControllableOpenProps;

export function HoverCard(rawProps: HoverCardProps) {
  const safeProps = sanitizeFixedControlProps(rawProps);
  return (
    <InternalPopoverSlot name="hover-card">
      <PopoverRoot {...safeProps} />
    </InternalPopoverSlot>
  );
}

type ConfirmDialogBaseProps = PublicControlProps<{
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: ReactNode;
  cancelLabel?: ReactNode;
  tone?: "primary" | "danger";
  closeOnBackdropClick?: boolean;
  onConfirm: () => void | Promise<void>;
  errorMessage?: ReactNode;
}>;

export type ConfirmDialogProps = ConfirmDialogBaseProps & ControlledOpenProps;

export function ConfirmDialog(rawProps: ConfirmDialogProps) {
  const { message } = usePersonalUILocale();
  const safeProps = sanitizeFixedControlProps(rawProps);
  const {
    title,
    description,
    confirmLabel = message("common.confirm"),
    cancelLabel = message("common.cancel"),
    tone = "primary",
    closeOnBackdropClick = true,
    onConfirm,
    errorMessage = message("confirm.failed"),
  } = safeProps;
  const [open, setOpen] = useControllableState({
    componentName: "ConfirmDialog",
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
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!open) setFailed(false);
  }, [open]);
  const confirm = async () => {
    if (pending) return;
    setPending(true);
    setFailed(false);
    try {
      await onConfirm();
      setOpen(false);
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  };
  return (
    <div data-pui-owner="ConfirmDialog">
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => { if (!pending) setOpen(nextOpen); }}
        title={title}
        description={description}
        width="small"
        closable={!pending}
        closeOnBackdropClick={closeOnBackdropClick}
        footer={<div className="pui-confirm-actions"><Button autoFocus disabled={pending} onClick={() => setOpen(false)}>{cancelLabel}</Button><Button variant={tone} loading={pending} loadingLabel={message("common.processing")} onClick={() => void confirm()}>{confirmLabel}</Button></div>}
      >
        {failed ? <Alert tone="danger">{errorMessage}</Alert> : null}
      </Dialog>
    </div>
  );
}

export type PopconfirmProps = PublicControlProps<{
  triggerLabel: string;
  ariaLabel: string;
  placement?: FloatingPlacement;
  disabled?: boolean;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: ReactNode;
  cancelLabel?: ReactNode;
  tone?: "primary" | "danger";
  onConfirm: () => void | Promise<void>;
  errorMessage?: ReactNode;
}>;

export function Popconfirm(rawProps: PopconfirmProps) {
  const { message } = usePersonalUILocale();
  const safeProps = sanitizeFixedControlProps(rawProps);
  const { triggerLabel: rawTriggerLabel, ariaLabel, placement, disabled, title, description, confirmLabel = message("common.confirm"), cancelLabel = message("common.cancel"), tone = "danger", onConfirm, errorMessage = message("confirm.failed") } = safeProps;
  const triggerLabel = requireTriggerLabel("Popconfirm", rawTriggerLabel);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const confirm = async () => {
    if (pending) return;
    setPending(true);
    setFailed(false);
    try { await onConfirm(); setOpen(false); } catch { setFailed(true); } finally { setPending(false); }
  };
  return (
    <Popover triggerLabel={triggerLabel} ariaLabel={ariaLabel} placement={placement} open={open} onOpenChange={(next) => { if (!pending) setOpen(next); }} disabled={disabled}>
      <div className="pui-popconfirm" data-pui-owner="Popconfirm">
        <div className="pui-popconfirm__heading"><CircleAlert aria-hidden="true" /><div><strong>{title}</strong>{description != null ? <p>{description}</p> : null}</div></div>
        {failed ? <Alert tone="danger">{errorMessage}</Alert> : null}
        <div className="pui-confirm-actions"><Button size="small" disabled={pending} onClick={() => setOpen(false)}>{cancelLabel}</Button><Button size="small" variant={tone} loading={pending} loadingLabel={message("common.processing")} onClick={() => void confirm()}>{confirmLabel}</Button></div>
      </div>
    </Popover>
  );
}

export type ContextMenuProps = PublicControlProps<{
  children: ReactNode;
  items: readonly MenuItem[];
  ariaLabel: string;
}>;

export function ContextMenu(rawProps: ContextMenuProps) {
  const safeProps = sanitizeFixedControlProps(rawProps);
  const { children, items, ariaLabel } = safeProps;
  assertUniqueIdentities("ContextMenu", "item.id", items.map((item) => item.id));
  const id = useId();
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [rootTabIndex, setRootTabIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const clickedTriggerRef = useRef<HTMLElement | null>(null);
  const typeaheadRef = useRef({ value: "", at: 0 });
  const enabledItems = items.filter((item) => !item.disabled);
  usePersonalUiPortalTokens(point !== null, rootRef, menuRef);

  useClientLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const updateTabIndex = () => {
      const tabbableChild = Array.from(root.querySelectorAll<HTMLElement>(
        "a[href], area[href], button, input, select, textarea, [tabindex]",
      )).some((element) => element.tabIndex >= 0 && !element.matches(":disabled") && !element.closest("[hidden], [inert], [aria-hidden='true']"));
      setRootTabIndex(tabbableChild ? -1 : 0);
    };
    updateTabIndex();
    const observer = typeof MutationObserver === "undefined" ? null : new MutationObserver(updateTabIndex);
    observer?.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ["disabled", "href", "tabindex", "hidden", "inert", "aria-hidden"] });
    return () => observer?.disconnect();
  }, []);

  const itemElement = (itemId: string) => Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>("[role='menuitem']") ?? [])
    .find((button) => button.dataset.itemId === itemId);
  const focusItem = (itemId: string) => {
    setActiveId(itemId);
    itemElement(itemId)?.focus({ preventScroll: true });
  };
  const openMenu = (position: { x: number; y: number }, origin: HTMLElement) => {
    restoreFocusRef.current = origin;
    clickedTriggerRef.current = null;
    typeaheadRef.current = { value: "", at: 0 };
    setActiveId(enabledItems[0]?.id ?? null);
    setPoint(position);
  };
  const closeMenu = (restoreFocus = false, restoreBeforeAction = false) => {
    setPoint(null);
    setActiveId(null);
    typeaheadRef.current = { value: "", at: 0 };
    const previous = restoreFocusRef.current;
    restoreFocusRef.current = null;
    if (!restoreFocus) return;
    const restore = () => {
      const root = rootRef.current;
      if (!root?.isConnected || root.closest("[inert], [aria-hidden='true']")) return;
      const modal = root.closest<HTMLElement>("[role='dialog'][aria-modal='true']");
      const validPrevious = previous?.isConnected
        && !previous.matches(":disabled")
        && !previous.closest("[inert], [aria-hidden='true']")
        && isVisibleElement(previous)
        && (!modal || modal.contains(previous));
      (validPrevious ? previous : root).focus({ preventScroll: true });
    };
    if (restoreBeforeAction) restore();
    else queueMicrotask(restore);
  };

  const keyboardAnchor = (target: HTMLElement) => {
    const bounds = target.getBoundingClientRect();
    return { x: bounds.left, y: bounds.bottom };
  };
  const menuOrigin = (target: EventTarget | null) => {
    const root = rootRef.current!;
    if (!(target instanceof HTMLElement) || !root.contains(target)) return root;
    return target.closest<HTMLElement>("a[href], button, input, select, textarea, [tabindex]") ?? root;
  };

  useEffect(() => {
    if (!point) return;
    const ownerDocument = rootRef.current?.ownerDocument;
    if (!ownerDocument) return;
    const closeOnPointer = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || menuRef.current?.contains(target)) return;
      closeMenu();
      clickedTriggerRef.current = target instanceof HTMLElement && rootRef.current?.contains(target)
        ? menuOrigin(target) : null;
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      closeMenu(true);
    };
    ownerDocument.addEventListener("pointerdown", closeOnPointer, true);
    ownerDocument.addEventListener("keydown", escape, true);
    return () => {
      ownerDocument.removeEventListener("pointerdown", closeOnPointer, true);
      ownerDocument.removeEventListener("keydown", escape, true);
    };
  }, [point]);

  useClientLayoutEffect(() => {
    const menu = menuRef.current;
    if (!point || !menu) return;
    const ownerDocument = menu.ownerDocument;
    const updatePosition = () => {
      const rect = menu.getBoundingClientRect();
      const left = Math.max(12, Math.min(point.x, ownerDocument.documentElement.clientWidth - rect.width - 12));
      const top = Math.max(12, Math.min(point.y, ownerDocument.documentElement.clientHeight - rect.height - 12));
      menu.style.left = `${left}px`;
      menu.style.top = `${top}px`;
      menu.dataset.positioned = "true";
    };
    updatePosition();
    const ownerWindow = ownerDocument.defaultView;
    ownerWindow?.addEventListener("resize", updatePosition);
    ownerWindow?.addEventListener("scroll", updatePosition, true);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updatePosition);
    observer?.observe(menu);
    return () => {
      ownerWindow?.removeEventListener("resize", updatePosition);
      ownerWindow?.removeEventListener("scroll", updatePosition, true);
      observer?.disconnect();
    };
  }, [point]);

  useClientLayoutEffect(() => {
    if (!point) return;
    const first = enabledItems[0]?.id;
    if (first) itemElement(first)?.focus({ preventScroll: true });
    else menuRef.current?.focus({ preventScroll: true });
  }, [point]);

  useClientLayoutEffect(() => {
    if (!point || activeId === null || enabledItems.some((item) => item.id === activeId)) return;
    const next = enabledItems[0]?.id ?? null;
    setActiveId(next);
    if (menuRef.current?.contains(menuRef.current.ownerDocument.activeElement)) {
      if (next) itemElement(next)?.focus({ preventScroll: true });
      else menuRef.current.focus({ preventScroll: true });
    }
  }, [activeId, items, point]);

  const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const ids = enabledItems.map((item) => item.id);
    const current = event.target instanceof HTMLElement
      ? event.target.closest<HTMLButtonElement>("[role='menuitem']")?.dataset.itemId ?? activeId
      : activeId;
    const currentIndex = ids.indexOf(current ?? "");
    if (event.key === "Tab") {
      event.preventDefault();
      event.stopPropagation();
      const root = rootRef.current;
      const modal = root?.closest<HTMLElement>("[role='dialog'][aria-modal='true']");
      const stops = getTabStops(event.currentTarget.ownerDocument, (element) => (
        !menuRef.current?.contains(element) && (!modal || modal.contains(element))
      ));
      const originIndex = stops.indexOf(restoreFocusRef.current ?? root!);
      const nextIndex = event.shiftKey ? originIndex - 1 : originIndex + 1;
      const next = stops[(nextIndex + stops.length) % stops.length];
      closeMenu();
      queueMicrotask(() => (next ?? root)?.focus({ preventScroll: true }));
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Home" || event.key === "End") {
      event.preventDefault();
      event.stopPropagation();
      if (!ids.length) return;
      const nextIndex = event.key === "Home" ? 0
        : event.key === "End" ? ids.length - 1
          : event.key === "ArrowDown" ? (currentIndex + 1) % ids.length
            : currentIndex === -1 ? ids.length - 1 : (currentIndex - 1 + ids.length) % ids.length;
      focusItem(ids[nextIndex]);
      typeaheadRef.current = { value: "", at: 0 };
      return;
    }
    if (event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey && event.key !== " ") {
      const now = Date.now();
      const previous = typeaheadRef.current;
      const typed = now - previous.at > 700 ? event.key : previous.value + event.key;
      typeaheadRef.current = { value: typed, at: now };
      const query = [...typed].every((letter) => letter.toLocaleLowerCase() === typed[0].toLocaleLowerCase())
        ? typed[0].toLocaleLowerCase() : typed.toLocaleLowerCase();
      const match = [...ids.slice(currentIndex + 1), ...ids.slice(0, currentIndex + 1)]
        .find((itemId) => itemElement(itemId)?.querySelector(".pui-context-menu__label")?.textContent?.trim().toLocaleLowerCase().startsWith(query));
      if (match) {
        event.preventDefault();
        event.stopPropagation();
        focusItem(match);
      }
    }
  };

  return (
    <div
      ref={rootRef}
      tabIndex={rootTabIndex}
      className="pui-context-menu"
      role={rootTabIndex === 0 ? "button" : "group"}
      aria-haspopup={rootTabIndex === 0 ? "menu" : undefined}
      aria-expanded={rootTabIndex === 0 ? point !== null : undefined}
      aria-controls={point ? id : undefined}
      aria-label={ariaLabel}
      onContextMenu={(event) => {
        if (event.defaultPrevented) return;
        event.preventDefault();
        event.stopPropagation();
        const origin = menuOrigin(event.target);
        const position = event.detail === 0 ? keyboardAnchor(origin) : { x: event.clientX, y: event.clientY };
        openMenu(position, origin);
      }}
      onKeyDown={(event) => {
        const staticTriggerActivation = rootTabIndex === 0
          && event.target === event.currentTarget
          && (event.key === "Enter" || event.key === " ");
        if (event.defaultPrevented || !(event.key === "ContextMenu" || (event.shiftKey && event.key === "F10") || staticTriggerActivation)) return;
        event.preventDefault();
        event.stopPropagation();
        const origin = menuOrigin(event.target);
        openMenu(keyboardAnchor(origin), origin);
      }}
      onClickCapture={(event) => {
        const origin = clickedTriggerRef.current;
        clickedTriggerRef.current = null;
        if (origin?.isConnected && origin.contains(event.target as Node)) origin.focus({ preventScroll: true });
      }}
      data-pui-owner="ContextMenu"
    >
      {children}
      {point ? createPortal(
        <div
          ref={menuRef}
          id={id}
          className="pui-context-menu__surface pui-portal"
          data-pui-floating-root="true"
          role="menu"
          aria-label={ariaLabel}
          tabIndex={-1}
          style={{ left: point.x, top: point.y }}
          onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); }}
          onKeyDown={handleMenuKeyDown}
        >
          {items.map((item) => (
            <button
              key={item.id}
              id={`${id}-item-${encodeURIComponent(item.id)}`}
              data-item-id={item.id}
              type="button"
              role="menuitem"
              tabIndex={!item.disabled && activeId === item.id ? 0 : -1}
              disabled={item.disabled}
              className={item.danger ? "is-danger" : undefined}
              onPointerEnter={() => { if (!item.disabled) focusItem(item.id); }}
              onFocus={() => { if (!item.disabled) setActiveId(item.id); }}
              onClick={() => { closeMenu(true, true); item.onSelect(); }}
            >
              {item.icon != null ? <span aria-hidden="true">{item.icon}</span> : null}
              <span className="pui-context-menu__label">{item.label}</span>
            </button>
          ))}
        </div>, floatingPortalTarget(rootRef.current),
      ) : null}
    </div>
  );
}

export interface LightboxItem {
  id: string;
  src: string;
  alt: string;
  caption?: ReactNode;
}

type LightboxBaseProps = PublicControlProps<{
  items: readonly LightboxItem[];
}>;

export type LightboxProps = LightboxBaseProps & ControlledOpenProps & ControlledValueProps<string>;

export function Lightbox(rawProps: LightboxProps) {
  const { message } = usePersonalUILocale();
  const safeProps = sanitizeFixedControlProps(rawProps);
  const { items } = safeProps;
  const [open, setOpen] = useControllableState({
    componentName: "Lightbox",
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
  const [value, setValue] = useControllableState({
    componentName: "Lightbox",
    controlled: rawProps.value !== undefined,
    controlledOnly: true,
    value: safeProps.value,
    defaultValue: items[0]?.id ?? "",
    defaultValueProvided: rawProps.defaultValue !== undefined,
    onChange: safeProps.onValueChange,
  });
  assertUniqueIdentities("Lightbox", "item.id", items.map((item) => item.id));
  const sourceRef = useRef<HTMLSpanElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const portalReady = useLayerPortalReady();
  const portalTarget = useLayerPortalTarget(portalReady, sourceRef);
  const currentIndex = items.findIndex((item) => item.id === value);
  const resolvedIndex = currentIndex >= 0 ? currentIndex : 0;
  const current = items[resolvedIndex];
  const [failedImageKey, setFailedImageKey] = useState<string | null>(null);
  const currentImageKey = current ? `${current.id}\u0000${current.src}` : null;
  useEffect(() => {
    setFailedImageKey(null);
  }, [currentImageKey, open]);
  const layer = useLayerKernel({
    active: open && current !== undefined && portalTarget !== null,
    sourceRef,
    portalRef,
    panelRef,
    dismissPolicy: { backdrop: true, closeControl: true, escape: true },
    initialFocus: "panel",
    onDismiss: () => setOpen(false),
  });
  const moveTo = (nextIndex: number) => {
    if (items.length <= 1) return;
    const next = items[(nextIndex + items.length) % items.length];
    if (next && next.id !== current?.id) setValue(next.id);
  };
  const handleKeyboardNavigation = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    let nextIndex: number | null = null;
    if (event.key === "ArrowLeft") nextIndex = resolvedIndex - 1;
    else if (event.key === "ArrowRight") nextIndex = resolvedIndex + 1;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = items.length - 1;
    if (nextIndex === null || items.length <= 1) return;
    event.preventDefault();
    moveTo(nextIndex);
  };
  return (
    <LayerParentProvider id={layer.id}>
      <span ref={sourceRef} className="pui-portal-source" hidden aria-hidden="true" data-pui-portal-source="lightbox" />
      {open && current && portalTarget ? createPortal(
        <div ref={portalRef} className="pui-portal">
          <div
            ref={panelRef}
            className="pui-lightbox"
            role="dialog"
            tabIndex={-1}
            aria-modal="true"
            aria-label={message("lightbox.label")}
            onFocusCapture={layer.captureRestoreFocus}
            onKeyDown={handleKeyboardNavigation}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && layer.isTopLayer()) {
                event.preventDefault();
                layer.dismiss("backdrop");
              }
            }}
            data-pui-owner="Lightbox"
          >
            <InternalIconButtonSlot name="lightbox-close">
              <IconButton aria-label={message("lightbox.close")} icon={<X />} onClick={() => layer.dismiss("close-control")} />
            </InternalIconButtonSlot>
            {items.length > 1 ? (
              <InternalIconButtonSlot name="lightbox-previous">
                <IconButton aria-label={message("lightbox.previous")} icon={<ChevronLeft />} onClick={() => moveTo(resolvedIndex - 1)} />
              </InternalIconButtonSlot>
            ) : null}
            <figure>
              {failedImageKey === currentImageKey ? (
                <div className="pui-lightbox__image-error" role="status">{message("lightbox.imageError", { alt: current.alt })}</div>
              ) : (
                <img
                  src={current.src}
                  alt={current.alt}
                  onError={() => setFailedImageKey(currentImageKey)}
                  onLoad={() => setFailedImageKey((failed) => failed === currentImageKey ? null : failed)}
                />
              )}
              <figcaption>
                {current.caption != null ? <span>{current.caption}</span> : null}
                <span className="pui-lightbox__position" aria-live="polite" aria-atomic="true">
                  {resolvedIndex + 1} / {items.length}
                </span>
              </figcaption>
            </figure>
            {items.length > 1 ? (
              <InternalIconButtonSlot name="lightbox-next">
                <IconButton aria-label={message("lightbox.next")} icon={<ChevronRight />} onClick={() => moveTo(resolvedIndex + 1)} />
              </InternalIconButtonSlot>
            ) : null}
          </div>
        </div>, portalTarget,
      ) : null}
    </LayerParentProvider>
  );
}

interface GuidedTourTargetLayout {
  placement: FloatingPlacement;
  cardStyle: CSSProperties;
  spotlightStyle: CSSProperties;
}

function sameTourTargetLayout(
  current: GuidedTourTargetLayout | null,
  next: GuidedTourTargetLayout | null,
): boolean {
  if (current === next) return true;
  if (!current || !next || current.placement !== next.placement) return false;
  const keys: Array<keyof CSSProperties> = ["left", "top", "width", "height"];
  return keys.every((key) => current.cardStyle[key] === next.cardStyle[key])
    && keys.every((key) => current.spotlightStyle[key] === next.spotlightStyle[key]);
}

function resolveTourTarget(
  ownerDocument: Document,
  selector: string,
  portal: HTMLElement,
): HTMLElement | null {
  let candidate: Element | null = null;
  try {
    candidate = ownerDocument.querySelector(selector);
  } catch {
    return null;
  }
  const ElementConstructor = ownerDocument.defaultView?.HTMLElement;
  if (!ElementConstructor || !(candidate instanceof ElementConstructor) || portal.contains(candidate)) return null;
  const rect = candidate.getBoundingClientRect();
  const viewportWidth = ownerDocument.documentElement.clientWidth;
  const viewportHeight = ownerDocument.documentElement.clientHeight;
  const intersectsViewport = rect.width > 0
    && rect.height > 0
    && rect.right > 0
    && rect.bottom > 0
    && rect.left < viewportWidth
    && rect.top < viewportHeight;
  return intersectsViewport && isVisibleElement(candidate) ? candidate : null;
}

function calculateTourTargetLayout(
  target: HTMLElement,
  card: HTMLElement,
): GuidedTourTargetLayout | null {
  const ownerDocument = target.ownerDocument;
  const viewportWidth = ownerDocument.documentElement.clientWidth;
  const viewportHeight = ownerDocument.documentElement.clientHeight;
  const targetRect = target.getBoundingClientRect();
  const cardRect = card.getBoundingClientRect();
  if (viewportWidth <= 0 || viewportHeight <= 0 || cardRect.width <= 0 || cardRect.height <= 0) return null;
  const edge = 12;
  const gap = 12;
  const spotlightGap = 7;
  const spotlightLeft = Math.max(4, targetRect.left - spotlightGap);
  const spotlightTop = Math.max(4, targetRect.top - spotlightGap);
  const spotlightRight = Math.min(viewportWidth - 4, targetRect.right + spotlightGap);
  const spotlightBottom = Math.min(viewportHeight - 4, targetRect.bottom + spotlightGap);
  const centeredLeft = targetRect.left + (targetRect.width - cardRect.width) / 2;
  const centeredTop = targetRect.top + (targetRect.height - cardRect.height) / 2;
  const candidates: Array<{ placement: FloatingPlacement; left: number; top: number }> = [
    { placement: "bottom", left: centeredLeft, top: spotlightBottom + gap },
    { placement: "top", left: centeredLeft, top: spotlightTop - gap - cardRect.height },
    { placement: "right", left: spotlightRight + gap, top: centeredTop },
    { placement: "left", left: spotlightLeft - gap - cardRect.width, top: centeredTop },
  ];
  const fits = ({ left, top }: { left: number; top: number }) => (
    left >= edge
    && top >= edge
    && left + cardRect.width <= viewportWidth - edge
    && top + cardRect.height <= viewportHeight - edge
  );
  const candidate = candidates.find(fits) ?? candidates[0];
  const maxLeft = Math.max(edge, viewportWidth - edge - cardRect.width);
  const maxTop = Math.max(edge, viewportHeight - edge - cardRect.height);
  return {
    placement: candidate.placement,
    cardStyle: {
      left: Math.round(Math.min(Math.max(candidate.left, edge), maxLeft)),
      top: Math.round(Math.min(Math.max(candidate.top, edge), maxTop)),
    },
    spotlightStyle: {
      left: Math.round(spotlightLeft),
      top: Math.round(spotlightTop),
      width: Math.max(1, Math.round(spotlightRight - spotlightLeft)),
      height: Math.max(1, Math.round(spotlightBottom - spotlightTop)),
    },
  };
}

export interface TourStep {
  id: string;
  title: ReactNode;
  description: ReactNode;
  target?: string;
}

type GuidedTourBaseProps = PublicControlProps<{
  steps: readonly TourStep[];
  currentId: string;
  onCurrentChange: (id: string) => void;
  nextLabel?: ReactNode;
  previousLabel?: ReactNode;
  finishLabel?: ReactNode;
}>;

export type GuidedTourProps = GuidedTourBaseProps & ControlledOpenProps;

export function GuidedTour(rawProps: GuidedTourProps) {
  const { message } = usePersonalUILocale();
  const safeProps = sanitizeFixedControlProps(rawProps);
  const { steps, nextLabel = message("tour.next"), previousLabel = message("tour.previous"), finishLabel = message("tour.finish") } = safeProps;
  const [open, setOpen] = useControllableState({
    componentName: "GuidedTour",
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
  const [currentId, setCurrentId] = useControllableState({
    componentName: "GuidedTour",
    controlled: rawProps.currentId !== undefined,
    controlledOnly: true,
    value: safeProps.currentId,
    defaultValue: steps[0]?.id ?? "",
    defaultValueProvided: (rawProps as { defaultCurrentId?: unknown }).defaultCurrentId !== undefined,
    onChange: safeProps.onCurrentChange,
    valuePropName: "currentId",
    defaultValuePropName: "defaultCurrentId",
    changePropName: "onCurrentChange",
  });
  assertUniqueIdentities("GuidedTour", "step.id", steps.map((step) => step.id));
  const sourceRef = useRef<HTMLSpanElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const portalReady = useLayerPortalReady();
  const portalTarget = useLayerPortalTarget(portalReady, sourceRef);
  const index = steps.findIndex((step) => step.id === currentId);
  const step = steps[index];
  const [targetLayout, setTargetLayout] = useState<GuidedTourTargetLayout | null>(null);
  const layer = useLayerKernel({
    active: open && step !== undefined && portalTarget !== null,
    sourceRef,
    portalRef,
    panelRef,
    dismissPolicy: { backdrop: false, closeControl: false, escape: true },
    initialFocus: "panel",
    onDismiss: () => setOpen(false),
  });

  useClientLayoutEffect(() => {
    const portal = portalRef.current;
    const card = cardRef.current;
    const ownerDocument = sourceRef.current?.ownerDocument;
    const ownerWindow = ownerDocument?.defaultView;
    const selector = step?.target?.trim();
    if (!open || !portalTarget || !portal || !card || !ownerDocument || !ownerWindow || !selector) {
      setTargetLayout((current) => current === null ? current : null);
      return;
    }

    let animationFrame = 0;
    let observedTarget: HTMLElement | null = null;
    const resizeObserver = typeof ownerWindow.ResizeObserver === "function"
      ? new ownerWindow.ResizeObserver(() => scheduleUpdate())
      : null;
    const update = () => {
      animationFrame = 0;
      const target = resolveTourTarget(ownerDocument, selector, portal);
      if (target !== observedTarget) {
        if (observedTarget) resizeObserver?.unobserve(observedTarget);
        if (target) resizeObserver?.observe(target);
        observedTarget = target;
      }
      const next = target ? calculateTourTargetLayout(target, card) : null;
      setTargetLayout((current) => sameTourTargetLayout(current, next) ? current : next);
    };
    const scheduleUpdate = () => {
      if (animationFrame) ownerWindow.cancelAnimationFrame(animationFrame);
      animationFrame = ownerWindow.requestAnimationFrame(update);
    };
    resizeObserver?.observe(card);
    update();
    ownerWindow.addEventListener("resize", scheduleUpdate);
    ownerWindow.addEventListener("scroll", scheduleUpdate, true);
    ownerWindow.visualViewport?.addEventListener("resize", scheduleUpdate);
    ownerWindow.visualViewport?.addEventListener("scroll", scheduleUpdate);
    const mutationObserver = typeof ownerWindow.MutationObserver === "function"
      ? new ownerWindow.MutationObserver((records) => {
          if (records.every((record) => portal.contains(record.target))) return;
          scheduleUpdate();
        })
      : null;
    mutationObserver?.observe(ownerDocument.documentElement, {
      attributes: true,
      attributeFilter: ["class", "hidden", "style"],
      childList: true,
      subtree: true,
    });
    return () => {
      if (animationFrame) ownerWindow.cancelAnimationFrame(animationFrame);
      ownerWindow.removeEventListener("resize", scheduleUpdate);
      ownerWindow.removeEventListener("scroll", scheduleUpdate, true);
      ownerWindow.visualViewport?.removeEventListener("resize", scheduleUpdate);
      ownerWindow.visualViewport?.removeEventListener("scroll", scheduleUpdate);
      mutationObserver?.disconnect();
      resizeObserver?.disconnect();
    };
  }, [open, portalTarget, step?.id, step?.target]);

  return (
    <LayerParentProvider id={layer.id}>
      <span ref={sourceRef} className="pui-portal-source" hidden aria-hidden="true" data-pui-portal-source="guided-tour" />
      {open && step && portalTarget ? createPortal(
        <div ref={portalRef} className="pui-portal">
          <div
            ref={panelRef}
            className="pui-tour"
            role="dialog"
            tabIndex={-1}
            aria-modal="true"
            aria-label={message("tour.label")}
            onFocusCapture={layer.captureRestoreFocus}
            data-pui-owner="GuidedTour"
          >
            {targetLayout ? (
              <div className="pui-tour__spotlight" style={targetLayout.spotlightStyle} aria-hidden="true" />
            ) : (
              <div className="pui-tour__scrim" aria-hidden="true" />
            )}
            <section
              ref={cardRef}
              className="pui-tour__card"
              style={targetLayout?.cardStyle}
              data-placement={targetLayout?.placement}
            >
              <div className="pui-tour__count" aria-live="polite" aria-atomic="true">{index + 1} / {steps.length}</div>
              <h2>{step.title}</h2>
              <div>{step.description}</div>
              <footer>
                <Button disabled={index === 0} onClick={() => setCurrentId(steps[index - 1].id)}>{previousLabel}</Button>
                <Button variant="primary" onClick={() => index === steps.length - 1 ? setOpen(false) : setCurrentId(steps[index + 1].id)}>{index === steps.length - 1 ? finishLabel : nextLabel}</Button>
              </footer>
            </section>
          </div>
        </div>, portalTarget,
      ) : null}
    </LayerParentProvider>
  );
}
