import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  CheckCircle2,
  CircleAlert,
  Info,
  LoaderCircle,
  TriangleAlert,
  X,
  type LucideIcon,
} from "lucide-react";
import type { PublicControlProps } from "../foundation/contracts";
import { InternalButtonSlot } from "../internal/button-slots";
import { sanitizeFixedControlProps } from "../internal/fixed-control-props";
import { useUILocale, type UILocaleContext } from "../foundation/locale";
import { Button, type ButtonProps } from "../foundation/primitives";
import { useUIPortalTokens } from "../internal/portal-tokens";
import { useMotionPresence, usePrefersReducedMotion } from "../internal/motion";
import { cx, type CSSVariableProperties } from "../internal/utils";

const useClientLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

const subscribeToClient = () => () => undefined;

function usePortalReady(): boolean {
  return useSyncExternalStore(subscribeToClient, () => true, () => false);
}

export type FeedbackTone = "info" | "success" | "warning" | "danger";

const toneIcons: Record<FeedbackTone, LucideIcon> = {
  info: Info,
  success: CheckCircle2,
  warning: TriangleAlert,
  danger: CircleAlert,
};

export type AlertProps = PublicControlProps<Omit<
  HTMLAttributes<HTMLDivElement>,
  "children" | "role" | "title"
>> & {
  tone?: FeedbackTone;
  title?: ReactNode;
  children: ReactNode;
  action?: ReactNode;
};

export function Alert(rawProps: AlertProps) {
  const safeProps = sanitizeFixedControlProps(rawProps, ["role"]);
  const { tone = "info", title, children, action, ...props } = safeProps;
  const Icon = toneIcons[tone];
  return (
    <div
      {...props}
      className={cx("ui-alert", `ui-alert--${tone}`)}
      role={tone === "danger" ? "alert" : "status"}
      data-ui-owner="Alert"
    >
      <span className="ui-alert__icon" aria-hidden="true"><Icon /></span>
      <div className="ui-alert__copy">
        {title != null ? (
          <strong title={typeof title === "string" || typeof title === "number" ? String(title) : undefined}>{title}</strong>
        ) : null}
        <div>{children}</div>
      </div>
      {action != null ? <div className="ui-alert__action">{action}</div> : null}
    </div>
  );
}

export type EmptyStateProps = PublicControlProps<Omit<
  HTMLAttributes<HTMLDivElement>,
  "children" | "role" | "title"
>> & {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
};

export function EmptyState(rawProps: EmptyStateProps) {
  const safeProps = sanitizeFixedControlProps(rawProps, ["children", "role"]);
  const { icon, title, description, action, compact, ...props } = safeProps;
  return (
    <div
      {...props}
      className={cx("ui-empty", compact && "ui-empty--compact")}
      role="status"
      data-ui-owner="EmptyState"
    >
      {icon != null ? <span className="ui-empty__icon" aria-hidden="true">{icon}</span> : null}
      <strong title={typeof title === "string" || typeof title === "number" ? String(title) : undefined}>{title}</strong>
      {description != null ? <p>{description}</p> : null}
      {action != null ? <div className="ui-empty__action">{action}</div> : null}
    </div>
  );
}

export type ProgressProps = PublicControlProps<Omit<
  HTMLAttributes<HTMLDivElement>,
  "children"
>> & {
  value: number;
  label: string;
  showValue?: boolean;
};

export function Progress(rawProps: ProgressProps) {
  const safeProps = sanitizeFixedControlProps(rawProps, ["children"]);
  const { value, label, showValue, ...props } = safeProps;
  const normalized = Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;
  return (
    <div {...props} className="ui-progress-group" data-ui-owner="Progress">
      <div className="ui-progress-group__label">
        <span>{label}</span>
        {showValue ? <span>{Math.round(normalized)}%</span> : null}
      </div>
      <div className="ui-progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={normalized}>
        <span style={{ width: `${normalized}%` }} />
      </div>
    </div>
  );
}

export type ToastPosition = "top-center" | "top-right" | "bottom-right";
export type ToastShape = "rounded" | "pill";

export interface ToastAction {
  label: string;
  loadingLabel?: string;
  onClick: () => void | Promise<void>;
  onError?: (error: unknown) => void | Promise<void>;
  dismiss?: boolean;
}

export interface ToastOptions {
  title?: ReactNode;
  description: ReactNode;
  tone?: FeedbackTone;
  position?: ToastPosition;
  shape?: ToastShape;
  duration?: number | null;
  /** Decorative progress bar, independent of numeric seconds. Hidden for persistent messages. */
  countdown?: boolean;
  /** Remaining seconds use the same pause-aware clock as automatic dismissal. */
  showSeconds?: boolean;
  /** Reuse an active or queued message with this key without resetting its content or timer. */
  dedupeKey?: string;
  closable?: boolean;
  closeLabel?: string;
  action?: ToastAction;
}

interface ToastRecord extends ToastOptions {
  id: string;
  tone: FeedbackTone;
  position: ToastPosition;
  shape: ToastShape;
  duration: number | null;
  countdown: boolean;
  closable: boolean;
  paused: boolean;
  localeContext: UILocaleContext;
  exiting?: boolean;
}

type ToastPauseReason = "hover" | "press" | "focus" | "document" | "action";

interface ToastTimer {
  timeoutId?: number;
  startedAt?: number;
  remaining: number;
  pauseReasons: Set<ToastPauseReason>;
  mounted: boolean;
}

const DEFAULT_TOAST_DURATION = 5000;
const MAX_TOAST_DURATION = 2_147_483_647;

function timerNow(): number {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

function normalizeToastDuration(duration: ToastOptions["duration"], hasAction: boolean): number | null {
  if (duration === null) return null;
  if (duration === undefined) return hasAction ? null : DEFAULT_TOAST_DURATION;
  if (!Number.isFinite(duration) || duration <= 0) return DEFAULT_TOAST_DURATION;
  return Math.min(MAX_TOAST_DURATION, Math.max(1, Math.round(duration)));
}

interface ToastProviderContextValue {
  toast: (options: ToastOptions, localeContext: UILocaleContext) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

export interface ToastApi {
  toast: (options: ToastOptions) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

const ToastContext = createContext<ToastProviderContextValue | null>(null);

export type ToastProviderProps = PublicControlProps<{
  children: ReactNode;
  defaultPosition?: ToastPosition;
  defaultShape?: ToastShape;
  /** Global visible limit across all positions. Default3; integer1..8. Lowering never evicts mounted cards. */
  maxVisible?: number;
  /** FIFO waiting capacity. Default20; integer0..100. Full queues ignore new messages. */
  maxQueue?: number;
}>;

function normalizeToastLimit(value: number | undefined, fallback: number, min: number, max: number): number {
  return value === undefined || !Number.isFinite(value) ? fallback : Math.min(max, Math.max(min, Math.floor(value)));
}

export function ToastProvider(rawProps: ToastProviderProps) {
  const providerLocale = useUILocale();
  const safeProps = sanitizeFixedControlProps(rawProps);
  const { children, defaultPosition = "top-right", defaultShape = "rounded", maxVisible, maxQueue } = safeProps;
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  // Synchronous admission also covers bursts within one React batch.
  const records = useRef<{ visible: ToastRecord[]; queued: ToastRecord[] }>({ visible: [], queued: [] });
  const limits = useRef({ visible: 3, queued: 20 });
  limits.current = { visible: normalizeToastLimit(maxVisible, 3, 1, 8), queued: normalizeToastLimit(maxQueue, 20, 0, 100) };
  const portalReady = usePortalReady() && typeof document !== "undefined";
  const sourceRef = useRef<HTMLSpanElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const centerViewportRef = useRef<HTMLDivElement>(null);
  const [centerHeight, setCenterHeight] = useState(0);
  const timers = useRef(new Map<string, ToastTimer>());
  const mountedIds = useRef(new Set<string>());
  const sequence = useRef(0);
  useUIPortalTokens(portalReady && toasts.length > 0, sourceRef, portalRef);

  const publish = useCallback(() => setToasts([...records.current.visible]), []);
  const promote = useCallback(() => {
    const current = records.current;
    while (current.queued.length && current.visible.length < limits.current.visible) {
      current.visible.push(current.queued.shift()!);
    }
  }, []);

  const finishExit = useCallback((id: string) => {
    mountedIds.current.delete(id);
    records.current.visible = records.current.visible.filter((item) => item.id !== id);
    promote();
    publish();
  }, [promote, publish]);

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer?.timeoutId !== undefined && typeof window !== "undefined") {
      window.clearTimeout(timer.timeoutId);
    }
    timers.current.delete(id);
    const visible = records.current.visible.find((item) => item.id === id);
    if (visible && mountedIds.current.has(id)) visible.exiting = true;
    else records.current.visible = records.current.visible.filter((item) => item.id !== id);
    records.current.queued = records.current.queued.filter((item) => item.id !== id);
    promote();
    publish();
  }, [promote, publish]);

  const dismissAll = useCallback(() => {
    timers.current.forEach((timer) => {
      if (timer.timeoutId !== undefined) window.clearTimeout(timer.timeoutId);
    });
    timers.current.clear();
    records.current.queued = [];
    records.current.visible = records.current.visible.filter((item) => mountedIds.current.has(item.id));
    records.current.visible.forEach((item) => { item.exiting = true; });
    publish();
  }, [publish]);

  useEffect(() => {
    // Lowering a limit never remounts or evicts an actionable notification.
    promote();
    publish();
  }, [maxVisible, promote, publish]);

  const startTimer = useCallback((id: string, timer: ToastTimer) => {
    if (typeof window === "undefined" || timer.timeoutId !== undefined || timer.pauseReasons.size) return;
    if (timer.remaining <= 0) {
      dismiss(id);
      return;
    }
    if (!timer.mounted) return;
    timer.startedAt = timerNow();
    timer.timeoutId = window.setTimeout(() => {
      timer.timeoutId = undefined;
      timer.startedAt = undefined;
      dismiss(id);
    }, timer.remaining);
  }, [dismiss]);

  const pauseTimer = useCallback((id: string, reason: ToastPauseReason) => {
    const timer = timers.current.get(id);
    if (!timer || timer.pauseReasons.has(reason)) return;
    timer.pauseReasons.add(reason);
    if (timer.timeoutId !== undefined) {
      window.clearTimeout(timer.timeoutId);
      const elapsed = timer.startedAt === undefined ? 0 : Math.max(0, timerNow() - timer.startedAt);
      timer.remaining = Math.max(0, timer.remaining - elapsed);
      timer.timeoutId = undefined;
      timer.startedAt = undefined;
    }
    const record = [...records.current.visible, ...records.current.queued].find((item) => item.id === id);
    if (record) record.paused = true;
    publish();
  }, [publish]);

  const resumeTimer = useCallback((id: string, reason: ToastPauseReason) => {
    const timer = timers.current.get(id);
    if (!timer || !timer.pauseReasons.delete(reason) || timer.pauseReasons.size) return;
    const record = [...records.current.visible, ...records.current.queued].find((item) => item.id === id);
    if (record) record.paused = false;
    publish();
    startTimer(id, timer);
  }, [startTimer, publish]);

  const remainingTime = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (!timer) return 0;
    return Math.max(0, timer.remaining - (timer.startedAt === undefined ? 0 : timerNow() - timer.startedAt));
  }, []);

  const mountTimer = useCallback((id: string) => {
    mountedIds.current.add(id);
    const timer = timers.current.get(id);
    if (!timer) return;
    timer.mounted = true;
    startTimer(id, timer);
  }, [startTimer]);

  const toast = useCallback((options: ToastOptions, localeContext: UILocaleContext = providerLocale) => {
    if (options.dedupeKey) {
      const existing = [...records.current.visible, ...records.current.queued].find((item) => item.dedupeKey === options.dedupeKey);
      if (existing) return existing.id;
    }
    sequence.current += 1;
    const id = `ui-toast-${Date.now()}-${sequence.current}`;
    const current = records.current;
    const canShow = current.visible.length < limits.current.visible && !current.queued.length;
    if (!canShow && current.queued.length >= limits.current.queued) return id;
    const duration = normalizeToastDuration(options.duration, Boolean(options.action));
    const requestedClosable = options.closable ?? true;
    const actionDismisses = Boolean(options.action && options.action.dismiss !== false);
    const paused = typeof document !== "undefined" && document.hidden;
    const record: ToastRecord = {
      ...options,
      id,
      tone: options.tone ?? "info",
      position: options.position ?? defaultPosition,
      shape: options.shape ?? defaultShape,
      duration,
      countdown: options.countdown ?? false,
      closable: duration === null && !requestedClosable && !actionDismisses ? true : requestedClosable,
      paused,
      localeContext,
    };
    if (canShow) current.visible.push(record);
    else current.queued.push(record);
    if (record.duration !== null && typeof window !== "undefined") {
      const timer: ToastTimer = {
        remaining: record.duration,
        pauseReasons: new Set(paused ? ["document"] : []),
        mounted: false,
      };
      timers.current.set(id, timer);
    }
    publish();
    return id;
  }, [defaultPosition, defaultShape, providerLocale, publish]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      timers.current.forEach((_, id) => {
        if (document.hidden) pauseTimer(id, "document");
        else resumeTimer(id, "document");
      });
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    handleVisibilityChange();
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [pauseTimer, resumeTimer]);

  useEffect(() => () => {
    timers.current.forEach((timer) => {
      if (timer.timeoutId !== undefined) window.clearTimeout(timer.timeoutId);
    });
    timers.current.clear();
  }, []);

  const context = useMemo(() => ({ toast, dismiss, dismissAll }), [toast, dismiss, dismissAll]);
  const viewportGroups = (["top-center", "top-right", "bottom-right"] as const).map((id) => ({
    id, items: toasts.filter((item) => item.position === id),
  }));
  const hasCenter = viewportGroups[0].items.length > 0;
  const hasRight = viewportGroups[1].items.length > 0;
  const hasBottom = viewportGroups[2].items.length > 0;
  useClientLayoutEffect(() => {
    const center = centerViewportRef.current;
    if (!center) { setCenterHeight(0); return; }
    const measure = () => setCenterHeight(center.getBoundingClientRect().height);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(center);
    return () => observer.disconnect();
  }, [hasCenter, hasBottom, hasRight, portalReady]);

  return (
    <ToastContext.Provider value={context}>
      {portalReady ? <span ref={sourceRef} hidden aria-hidden="true" data-ui-portal-source="toast" /> : null}
      {children}
      {portalReady && toasts.length ? createPortal(
        <div ref={portalRef} className="ui-portal" data-ui-toast-portal-root="true" data-ui-owner="ToastProvider" style={{ display: "contents", "--_ui-toast-center-height": `${centerHeight}px` } as CSSVariableProperties}>
          {viewportGroups.map(({ id, items }) => {
            if (!items.length) return null;
            return (
              <ToastViewport key={id} position={id} centerRef={id === "top-center" ? centerViewportRef : undefined} topPair={hasCenter && hasRight} bottomPair={hasBottom && (hasCenter || hasRight)}>
                {items.map((item) => (
                  <ToastItem
                    key={item.id}
                    item={item}
                    onDismiss={dismiss}
                    onExited={finishExit}
                    onMount={mountTimer}
                    onPause={pauseTimer}
                    onResume={resumeTimer}
                    remainingTime={remainingTime}
                  />
                ))}
              </ToastViewport>
            );
          })}
        </div>,
        document.body,
      ) : null}
    </ToastContext.Provider>
  );
}

function ToastViewport({ position, centerRef, topPair, bottomPair, children }: {
  position: ToastPosition;
  centerRef?: { current: HTMLDivElement | null };
  topPair: boolean;
  bottomPair: boolean;
  children: ReactNode;
}) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const previousHeight = useRef(0);
  const hold = useRef<Animation | null>(null);
  const reducedMotion = usePrefersReducedMotion(viewportRef);
  const setViewport = useCallback((node: HTMLDivElement | null) => {
    viewportRef.current = node;
    if (centerRef) centerRef.current = node;
  }, [centerRef]);
  useClientLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const oldHeight = viewport.getBoundingClientRect().height;
    hold.current?.cancel();
    const naturalHeight = viewport.getBoundingClientRect().height;
    const slots = Array.from(viewport.children) as HTMLElement[];
    const animations = slots.flatMap((slot) => slot.getAnimations?.() ?? []).filter((animation) => animation.playState === "running");
    const style = viewport.ownerDocument.defaultView!.getComputedStyle(viewport);
    const padding = parseFloat(style.paddingBottom) || 0;
    const visualHeight = Math.max(0, ...slots.map((slot) => {
      const transform = viewport.ownerDocument.defaultView!.getComputedStyle(slot).transform;
      const shift = !transform || transform === "none" ? 0 : new DOMMatrixReadOnly(transform).m42;
      return slot.offsetTop + slot.offsetHeight + shift + padding;
    }));
    const neededHeight = Math.max(oldHeight, previousHeight.current, visualHeight);
    previousHeight.current = naturalHeight;
    // The viewport owns this resource: dismissing a moving item must not
    // cancel the scroll boundary that still protects its surviving siblings.
    if (!reducedMotion && animations.length && neededHeight > naturalHeight) {
      const duration = Math.max(0, ...animations.map((animation) => Number(animation.effect?.getTiming().duration) - Number(animation.currentTime ?? 0)));
      const minHeight = `min(${neededHeight}px, var(--_ui-toast-viewport-limit, var(--_ui-toast-area-height)))`;
      hold.current = viewport.animate([{ minHeight }, { minHeight }], { duration });
    }
  });
  useEffect(() => () => hold.current?.cancel(), []);
  return <div ref={setViewport} className={cx("ui-portal", "ui-toast-viewport", `ui-toast-viewport--${position}`)} data-top-pair={topPair || undefined} data-bottom-pair={bottomPair || undefined}>{children}</div>;
}

function ToastItem({
  item,
  onDismiss,
  onExited,
  onMount,
  onPause,
  onResume,
  remainingTime,
}: {
  item: ToastRecord;
  onDismiss: (id: string) => void;
  onExited: (id: string) => void;
  onMount: (id: string) => void;
  onPause: (id: string, reason: ToastPauseReason) => void;
  onResume: (id: string, reason: ToastPauseReason) => void;
  remainingTime: (id: string) => number;
}) {
  const { message } = item.localeContext;
  const Icon = toneIcons[item.tone];
  const actionRunning = useRef(false);
  const pressedPointers = useRef(new Set<number>());
  const [actionPending, setActionPending] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const toastRef = useRef<HTMLDivElement>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion(toastRef);
  const motion = useMotionPresence(!item.exiting, toastRef, "standard", () => onExited(item.id));
  const previousTop = useRef<number | null>(null);
  const movement = useRef<Animation | null>(null);
  useClientLayoutEffect(() => {
    const slot = slotRef.current;
    const viewport = slot?.parentElement;
    if (!slot || !viewport) return;
    // Unscrolled screen coordinates account for the bottom-anchored reverse
    // stack without treating user scrolling or an active transform as layout.
    const top = viewport.getBoundingClientRect().top + slot.offsetTop;
    const delta = previousTop.current === null ? 0 : previousTop.current - top;
    previousTop.current = top;
    if (reducedMotion) {
      movement.current?.cancel();
    }
    if (delta && !reducedMotion && slot.animate) {
      const style = slot.ownerDocument.defaultView!.getComputedStyle(slot);
      const currentOffset = movement.current?.playState === "running"
        && style.transform && style.transform !== "none" ? new DOMMatrixReadOnly(style.transform).m42
        : 0;
      movement.current?.cancel();
      const duration = parseFloat(style.getPropertyValue("--ui-motion-standard-enter")) || 0;
      movement.current = slot.animate([{ transform: `translateY(${delta + currentOffset}px)` }, { transform: "translateY(0)" }], {
        duration, easing: style.getPropertyValue("--ui-motion-ease-enter").trim() || "ease-out",
      });
    }
  });
  useEffect(() => () => movement.current?.cancel(), []);
  const [bodyScrollable, setBodyScrollable] = useState(false);
  const [seconds, setSeconds] = useState(() => Math.ceil((item.duration ?? 0) / 1000));
  const [remaining, setRemaining] = useState(item.duration ?? 0);
  useClientLayoutEffect(() => onMount(item.id), [item.id, onMount]);
  useEffect(() => {
    if (item.exiting || (!item.showSeconds && !(item.countdown && reducedMotion)) || item.duration === null) return;
    const update = () => { const time = remainingTime(item.id); setSeconds(Math.ceil(time / 1000)); setRemaining(time); };
    update();
    if (item.paused) return;
    const interval = window.setInterval(update, 100);
    return () => window.clearInterval(interval);
  }, [item.id, item.showSeconds, item.countdown, item.duration, item.paused, item.exiting, reducedMotion, remainingTime]);
  useClientLayoutEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const measure = () => setBodyScrollable(body.scrollHeight > body.clientHeight + 1);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(body);
    return () => observer.disconnect();
  }, [item.description]);
  useEffect(() => {
    const releasePointer = (event: PointerEvent) => {
      if (!pressedPointers.current.delete(event.pointerId)) return;
      if (!pressedPointers.current.size) onResume(item.id, "press");
    };
    const releaseAllPointers = () => {
      if (!pressedPointers.current.size) return;
      pressedPointers.current.clear();
      onResume(item.id, "press");
    };
    window.addEventListener("pointerup", releasePointer);
    window.addEventListener("pointercancel", releasePointer);
    window.addEventListener("blur", releaseAllPointers);
    return () => {
      window.removeEventListener("pointerup", releasePointer);
      window.removeEventListener("pointercancel", releasePointer);
      window.removeEventListener("blur", releaseAllPointers);
    };
  }, [item.id, onResume]);
  const progressStyle: CSSVariableProperties | undefined = item.duration !== null
    ? { "--ui-toast-duration": `${item.duration}ms`, "--_ui-toast-remaining": String(Math.max(0, remaining / item.duration)) }
    : undefined;
  const closeLabel = item.closeLabel ?? (
    typeof item.title === "string" || typeof item.title === "number"
      ? message("toast.closeTitle", { title: String(item.title) })
      : typeof item.description === "string" || typeof item.description === "number"
        ? message("toast.closeTitle", { title: String(item.description) })
        : message("toast.close")
  );
  const runAction = async () => {
    const action = item.action;
    if (!action || actionRunning.current || item.exiting) return;
    actionRunning.current = true;
    setActionPending(true);
    onPause(item.id, "action");
    let succeeded = false;
    try {
      await action.onClick();
      succeeded = true;
      if (action.dismiss !== false) onDismiss(item.id);
    } catch (error) {
      if (!item.exiting && action.onError) {
        try {
          await action.onError(error);
        } catch (handlerError) {
          console.error("Toast action error handler failed.", handlerError);
        }
      } else {
        console.error("Toast action failed.", error);
      }
    } finally {
      actionRunning.current = false;
      setActionPending(false);
      if (!succeeded || action.dismiss === false) onResume(item.id, "action");
    }
  };
  return (
    <div ref={slotRef} className="ui-toast-slot">
    <div
      ref={toastRef}
      className={cx("ui-toast", `ui-toast--${item.tone}`, `ui-toast--${item.shape}`)}
      data-ui-motion={motion.state}
      data-exiting={item.exiting || undefined}
      onClickCapture={(event) => { if (item.exiting) { event.preventDefault(); event.stopPropagation(); } }}
      data-countdown={item.countdown && item.duration !== null || undefined}
      data-closable={item.closable || undefined}
      data-paused={item.paused || undefined}
      data-position={item.position}
      data-shape={item.shape}
      role={item.tone === "danger" ? "alert" : "status"}
      aria-atomic="true"
      style={progressStyle}
      onMouseEnter={() => onPause(item.id, "hover")}
      onMouseLeave={() => onResume(item.id, "hover")}
      onPointerDown={(event) => {
        if (!pressedPointers.current.size) onPause(item.id, "press");
        pressedPointers.current.add(event.pointerId);
      }}
      onFocus={() => onPause(item.id, "focus")}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onResume(item.id, "focus");
      }}
    >
      <div className="ui-toast__main">
        <span className="ui-toast__icon" aria-hidden="true"><Icon /></span>
        <div className="ui-toast__copy">
          {item.title != null ? (
            <strong title={typeof item.title === "string" || typeof item.title === "number" ? String(item.title) : undefined}>
              {item.title}
            </strong>
          ) : null}
          <div ref={bodyRef} className="ui-toast__description" tabIndex={bodyScrollable ? 0 : undefined} role={bodyScrollable ? "region" : undefined} aria-label={bodyScrollable ? message("toast.details") : undefined}>{item.description}</div>
        </div>
      </div>
      {item.action || item.closable || item.showSeconds && item.duration !== null ? (
        <div className="ui-toast__actions">
          {item.showSeconds && item.duration !== null ? <span className="ui-toast__seconds" aria-hidden="true" style={{ minWidth: `${String(Math.ceil(item.duration / 1000)).length + 2}ch` }}>{message("toast.seconds", { seconds })}</span> : null}
          {item.action ? (
            <button
              type="button"
              className="ui-toast__action"
              aria-disabled={actionPending || item.exiting || undefined}
              aria-busy={actionPending || undefined}
              data-loading={actionPending || undefined}
              title={typeof item.action.label === "string" || typeof item.action.label === "number" ? String(item.action.label) : undefined}
              onClick={(event) => {
                if (actionPending) {
                  event.preventDefault();
                  return;
                }
                void runAction();
              }}
            >
              <span className="ui-toast__action-content" aria-hidden={actionPending || undefined}>
                <span>{item.action.label}</span>
              </span>
              <span className="ui-toast__action-loading" aria-hidden={!actionPending}>
                <LoaderCircle className="ui-spinner" aria-hidden="true" />
                <span>{item.action.loadingLabel ?? message("common.processing")}</span>
              </span>
            </button>
          ) : null}
          {item.closable ? (
            <button type="button" className="ui-toast__close" aria-label={closeLabel} onClick={() => onDismiss(item.id)}>
              <X aria-hidden="true" />
            </button>
          ) : null}
        </div>
      ) : null}
      {item.countdown && item.duration !== null ? (
        <span className="ui-toast__countdown" aria-hidden="true">
          <span style={{ animationPlayState: item.paused ? "paused" : "running" }} />
        </span>
      ) : null}
    </div>
    </div>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  const localeContext = useUILocale();
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return useMemo(() => ({
    dismiss: context.dismiss,
    dismissAll: context.dismissAll,
    toast: (options: ToastOptions) => context.toast(options, localeContext),
  }), [context, localeContext]);
}

export type RetryButtonProps = PublicControlProps<Omit<ButtonProps, "children" | "onClick">> & {
  onRetry: () => void;
  label?: string;
};

export function RetryButton(rawProps: RetryButtonProps) {
  const { message } = useUILocale();
  const safeProps = sanitizeFixedControlProps(rawProps);
  const { onRetry, label = message("common.retry"), ...props } = safeProps;
  return (
    <InternalButtonSlot name="retry">
      <Button {...props} onClick={onRetry}>{label}</Button>
    </InternalButtonSlot>
  );
}
