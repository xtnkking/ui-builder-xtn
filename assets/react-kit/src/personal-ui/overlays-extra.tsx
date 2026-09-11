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
import { Alert } from "./feedback";
import { Button, IconButton } from "./primitives";
import { Dialog, type MenuItem } from "./overlays";
import { usePersonalUiPortalTokens } from "./portal-tokens";
import { assertUniqueIdentities, cx } from "./utils";

type FloatingPlacement = "top" | "bottom" | "left" | "right";
type FloatingAlign = "start" | "center" | "end";

function useFloatingPosition(
  open: boolean,
  triggerRef: React.RefObject<HTMLElement>,
  panelRef: React.RefObject<HTMLElement>,
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

export interface PopoverProps {
  trigger: ReactNode;
  children: ReactNode;
  ariaLabel: string;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  placement?: FloatingPlacement;
  align?: FloatingAlign;
  interaction?: "click" | "hover";
  disabled?: boolean;
  matchTriggerWidth?: boolean;
  className?: string;
}

type PopoverRootProps = PopoverProps & {
  owner: "Popover" | "HoverCard";
};

function PopoverRoot({
  trigger,
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
  className,
  owner,
}: PopoverRootProps) {
  const id = useId();
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const sourceRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const isOpen = !disabled && (open ?? internalOpen);
  const setOpen = (next: boolean, restoreFocus = false) => {
    if (disabled) return;
    if (open === undefined) setInternalOpen(next);
    onOpenChange?.(next);
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
  useFloatingPosition(isOpen, triggerRef, panelRef, placement, align);
  usePersonalUiPortalTokens(isOpen, sourceRef, panelRef);

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

  const hoverHandlers = interaction === "hover" ? {
    onMouseEnter: () => { cancelClose(); setOpen(true); },
    onMouseLeave: scheduleClose,
    onFocus: () => { cancelClose(); setOpen(true); },
    onBlur: (event: React.FocusEvent<HTMLButtonElement>) => {
      if (!panelRef.current?.contains(event.relatedTarget as Node | null)) scheduleClose();
    },
  } : {};

  return (
    <span ref={sourceRef} className={cx("pui-popover", className)} data-pui-owner={owner}>
      <button
        ref={triggerRef}
        type="button"
        className="pui-popover__trigger"
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        aria-controls={isOpen ? id : undefined}
        disabled={disabled}
        onClick={interaction === "click" ? () => setOpen(!isOpen) : undefined}
        {...hoverHandlers}
      >
        {trigger}
      </button>
      {isOpen ? createPortal(
        <div
          ref={panelRef}
          id={id}
          className="pui-popover__surface pui-portal"
          role="dialog"
          aria-label={ariaLabel}
          style={matchTriggerWidth ? { minWidth: triggerRef.current?.getBoundingClientRect().width } : undefined}
          onMouseEnter={interaction === "hover" ? cancelClose : undefined}
          onMouseLeave={interaction === "hover" ? scheduleClose : undefined}
        >
          {children}
        </div>,
        document.body,
      ) : null}
    </span>
  );
}

export function Popover(props: PopoverProps) {
  return <PopoverRoot {...props} owner="Popover" />;
}

export type HoverCardProps = Omit<PopoverProps, "interaction">;

export function HoverCard(props: HoverCardProps) {
  return <PopoverRoot {...props} interaction="hover" className={cx("pui-hover-card", props.className)} owner="HoverCard" />;
}

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: ReactNode;
  cancelLabel?: ReactNode;
  tone?: "primary" | "danger";
  onConfirm: () => void | Promise<void>;
  errorMessage?: ReactNode;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "确认",
  cancelLabel = "取消",
  tone = "primary",
  onConfirm,
  errorMessage = "操作失败，请稍后重试。",
}: ConfirmDialogProps) {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const confirm = async () => {
    if (pending) return;
    setPending(true);
    setFailed(false);
    try {
      await onConfirm();
      onOpenChange(false);
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
        onClose={() => { if (!pending) onOpenChange(false); }}
        title={title}
        description={description}
        width="small"
        closable={!pending}
        footer={<div className="pui-confirm-actions"><Button disabled={pending} onClick={() => onOpenChange(false)}>{cancelLabel}</Button><Button variant={tone} loading={pending} loadingLabel="处理中" onClick={() => void confirm()}>{confirmLabel}</Button></div>}
      >
        {failed ? <Alert tone="danger">{errorMessage}</Alert> : null}
      </Dialog>
    </div>
  );
}

export interface PopconfirmProps extends Omit<ConfirmDialogProps, "open" | "onOpenChange"> {
  trigger: ReactNode;
  ariaLabel: string;
  placement?: FloatingPlacement;
  disabled?: boolean;
}

export function Popconfirm({ trigger, ariaLabel, placement, disabled, title, description, confirmLabel = "确认", cancelLabel = "取消", tone = "danger", onConfirm, errorMessage = "操作失败，请稍后重试。" }: PopconfirmProps) {
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
    <Popover trigger={trigger} ariaLabel={ariaLabel} placement={placement} open={open} onOpenChange={(next) => { if (!pending) setOpen(next); }} disabled={disabled}>
      <div className="pui-popconfirm" data-pui-owner="Popconfirm">
        <div className="pui-popconfirm__heading"><CircleAlert aria-hidden="true" /><div><strong>{title}</strong>{description != null ? <p>{description}</p> : null}</div></div>
        {failed ? <Alert tone="danger">{errorMessage}</Alert> : null}
        <div className="pui-confirm-actions"><Button size="small" disabled={pending} onClick={() => setOpen(false)}>{cancelLabel}</Button><Button size="small" variant={tone} loading={pending} loadingLabel="处理中" onClick={() => void confirm()}>{confirmLabel}</Button></div>
      </div>
    </Popover>
  );
}

export interface ContextMenuProps {
  children: ReactNode;
  items: readonly MenuItem[];
  ariaLabel: string;
  className?: string;
}

export function ContextMenu({ children, items, ariaLabel, className }: ContextMenuProps) {
  assertUniqueIdentities("ContextMenu", "item.id", items.map((item) => item.id));
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!point) return;
    const close = () => setPoint(null);
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    queueMicrotask(() => menuRef.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus());
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, [point]);
  return (
    <div className={cx("pui-context-menu", className)} onContextMenu={(event) => { event.preventDefault(); setPoint({ x: event.clientX, y: event.clientY }); }} data-pui-owner="ContextMenu">
      {children}
      {point ? createPortal(
        <div ref={menuRef} className="pui-context-menu__surface pui-portal" role="menu" aria-label={ariaLabel} style={{ left: point.x, top: point.y }} onPointerDown={(event) => event.stopPropagation()}>
          {items.map((item) => <button key={item.id} type="button" role="menuitem" disabled={item.disabled} className={item.danger ? "is-danger" : undefined} onClick={() => { item.onSelect(); setPoint(null); }}>{item.icon != null ? <span aria-hidden="true">{item.icon}</span> : null}<span>{item.label}</span></button>)}
        </div>, document.body,
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

export interface LightboxProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: readonly LightboxItem[];
  value: string;
  onValueChange: (id: string) => void;
}

export function Lightbox({ open, onOpenChange, items, value, onValueChange }: LightboxProps) {
  assertUniqueIdentities("Lightbox", "item.id", items.map((item) => item.id));
  const index = items.findIndex((item) => item.id === value);
  const current = items[index] ?? items[0];
  if (!open || !current) return null;
  const move = (delta: number) => onValueChange(items[(Math.max(0, index) + delta + items.length) % items.length].id);
  return createPortal(
    <div className="pui-lightbox pui-portal" role="dialog" aria-modal="true" aria-label="图片预览" onMouseDown={(event) => { if (event.target === event.currentTarget) onOpenChange(false); }} data-pui-owner="Lightbox">
      <IconButton className="pui-lightbox__close" aria-label="关闭预览" icon={<X />} onClick={() => onOpenChange(false)} />
      {items.length > 1 ? <IconButton className="pui-lightbox__previous" aria-label="上一张" icon={<ChevronLeft />} onClick={() => move(-1)} /> : null}
      <figure><img src={current.src} alt={current.alt} />{current.caption != null ? <figcaption>{current.caption}</figcaption> : null}</figure>
      {items.length > 1 ? <IconButton className="pui-lightbox__next" aria-label="下一张" icon={<ChevronRight />} onClick={() => move(1)} /> : null}
    </div>, document.body,
  );
}

export interface TourStep {
  id: string;
  title: ReactNode;
  description: ReactNode;
  target?: string;
}

export interface GuidedTourProps {
  open: boolean;
  steps: readonly TourStep[];
  currentId: string;
  onCurrentChange: (id: string) => void;
  onClose: () => void;
  nextLabel?: ReactNode;
  previousLabel?: ReactNode;
  finishLabel?: ReactNode;
}

export function GuidedTour({ open, steps, currentId, onCurrentChange, onClose, nextLabel = "下一步", previousLabel = "上一步", finishLabel = "完成" }: GuidedTourProps) {
  assertUniqueIdentities("GuidedTour", "step.id", steps.map((step) => step.id));
  const index = steps.findIndex((step) => step.id === currentId);
  const step = steps[index];
  if (!open || !step) return null;
  return createPortal(
    <div className="pui-tour pui-portal" role="dialog" aria-modal="true" aria-label="功能引导" data-pui-owner="GuidedTour">
      <div className="pui-tour__scrim" />
      <section className="pui-tour__card">
        <div className="pui-tour__count">{index + 1} / {steps.length}</div>
        <h2>{step.title}</h2>
        <div>{step.description}</div>
        <footer>
          <Button disabled={index === 0} onClick={() => onCurrentChange(steps[index - 1].id)}>{previousLabel}</Button>
          <Button variant="primary" onClick={() => index === steps.length - 1 ? onClose() : onCurrentChange(steps[index + 1].id)}>{index === steps.length - 1 ? finishLabel : nextLabel}</Button>
        </footer>
      </section>
    </div>, document.body,
  );
}
