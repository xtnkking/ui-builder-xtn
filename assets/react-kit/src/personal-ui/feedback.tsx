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
import { Button, type ButtonProps } from "./primitives";
import { usePersonalUiPortalTokens } from "./portal-tokens";
import { cx, type CSSVariableProperties } from "./utils";

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

export interface AlertProps {
  tone?: FeedbackTone;
  title?: ReactNode;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function Alert({ tone = "info", title, children, action, className }: AlertProps) {
  const Icon = toneIcons[tone];
  return (
    <div className={cx("pui-alert", `pui-alert--${tone}`, className)} role={tone === "danger" ? "alert" : "status"}>
      <span className="pui-alert__icon" aria-hidden="true"><Icon /></span>
      <div className="pui-alert__copy">
        {title != null ? (
          <strong title={typeof title === "string" || typeof title === "number" ? String(title) : undefined}>{title}</strong>
        ) : null}
        <div>{children}</div>
      </div>
      {action != null ? <div className="pui-alert__action">{action}</div> : null}
    </div>
  );
}

export interface EmptyStateProps {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}

export function EmptyState({ icon, title, description, action, compact, className }: EmptyStateProps) {
  return (
    <div className={cx("pui-empty", compact && "pui-empty--compact", className)} role="status">
      {icon != null ? <span className="pui-empty__icon" aria-hidden="true">{icon}</span> : null}
      <strong title={typeof title === "string" || typeof title === "number" ? String(title) : undefined}>{title}</strong>
      {description != null ? <p>{description}</p> : null}
      {action != null ? <div className="pui-empty__action">{action}</div> : null}
    </div>
  );
}

export interface ProgressProps {
  value: number;
  label: string;
  showValue?: boolean;
  className?: string;
}

export function Progress({ value, label, showValue, className }: ProgressProps) {
  const normalized = Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;
  return (
    <div className={cx("pui-progress-group", className)}>
      <div className="pui-progress-group__label">
        <span>{label}</span>
        {showValue ? <span>{Math.round(normalized)}%</span> : null}
      </div>
      <div className="pui-progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={normalized}>
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
  countdown?: boolean;
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

interface ToastContextValue {
  toast: (options: ToastOptions) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export interface ToastProviderProps {
  children: ReactNode;
  defaultPosition?: ToastPosition;
  defaultShape?: ToastShape;
}

export function ToastProvider({ children, defaultPosition = "top-right", defaultShape = "rounded" }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const portalReady = usePortalReady() && typeof document !== "undefined";
  const sourceRef = useRef<HTMLSpanElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const timers = useRef(new Map<string, ToastTimer>());
  const sequence = useRef(0);
  usePersonalUiPortalTokens(portalReady && toasts.length > 0, sourceRef, portalRef);

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer?.timeoutId !== undefined && typeof window !== "undefined") {
      window.clearTimeout(timer.timeoutId);
    }
    timers.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

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
    setToasts((current) => current.map((toast) => (
      toast.id === id && !toast.paused ? { ...toast, paused: true } : toast
    )));
  }, []);

  const resumeTimer = useCallback((id: string, reason: ToastPauseReason) => {
    const timer = timers.current.get(id);
    if (!timer || !timer.pauseReasons.delete(reason) || timer.pauseReasons.size) return;
    setToasts((current) => current.map((toast) => (
      toast.id === id && toast.paused ? { ...toast, paused: false } : toast
    )));
    startTimer(id, timer);
  }, [startTimer]);

  const mountTimer = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (!timer) return;
    timer.mounted = true;
    startTimer(id, timer);
  }, [startTimer]);

  const toast = useCallback((options: ToastOptions) => {
    sequence.current += 1;
    const id = `pui-toast-${Date.now()}-${sequence.current}`;
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
    };
    setToasts((current) => [record, ...current]);
    if (record.duration !== null && typeof window !== "undefined") {
      const timer: ToastTimer = {
        remaining: record.duration,
        pauseReasons: new Set(paused ? ["document"] : []),
        mounted: false,
      };
      timers.current.set(id, timer);
    }
    return id;
  }, [defaultPosition, defaultShape]);

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

  const context = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);
  const viewportGroups = [
    { id: "top", items: toasts.filter((item) => item.position !== "bottom-right") },
    { id: "bottom-right", items: toasts.filter((item) => item.position === "bottom-right") },
  ];

  return (
    <ToastContext.Provider value={context}>
      {portalReady ? <span ref={sourceRef} hidden aria-hidden="true" data-pui-portal-source="toast" /> : null}
      {children}
      {portalReady && toasts.length ? createPortal(
        <div ref={portalRef} className="pui-portal" data-pui-toast-portal-root="true" style={{ display: "contents" }}>
          {viewportGroups.map(({ id, items }) => {
            if (!items.length) return null;
            return (
              <div key={id} className={cx("pui-portal", "pui-toast-viewport", `pui-toast-viewport--${id}`)}>
                {items.map((item) => (
                  <ToastItem
                    key={item.id}
                    item={item}
                    onDismiss={dismiss}
                    onMount={mountTimer}
                    onPause={pauseTimer}
                    onResume={resumeTimer}
                  />
                ))}
              </div>
            );
          })}
        </div>,
        document.body,
      ) : null}
    </ToastContext.Provider>
  );
}

function ToastItem({
  item,
  onDismiss,
  onMount,
  onPause,
  onResume,
}: {
  item: ToastRecord;
  onDismiss: (id: string) => void;
  onMount: (id: string) => void;
  onPause: (id: string, reason: ToastPauseReason) => void;
  onResume: (id: string, reason: ToastPauseReason) => void;
}) {
  const Icon = toneIcons[item.tone];
  const actionRunning = useRef(false);
  const pressedPointers = useRef(new Set<number>());
  const [actionPending, setActionPending] = useState(false);
  useClientLayoutEffect(() => onMount(item.id), [item.id, onMount]);
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
    ? { "--pui-toast-duration": `${item.duration}ms` }
    : undefined;
  const closeLabel = item.closeLabel ?? (
    typeof item.title === "string" || typeof item.title === "number"
      ? `关闭通知：${item.title}`
      : typeof item.description === "string" || typeof item.description === "number"
        ? `关闭通知：${item.description}`
        : "关闭通知"
  );
  const runAction = async () => {
    const action = item.action;
    if (!action || actionRunning.current) return;
    actionRunning.current = true;
    setActionPending(true);
    onPause(item.id, "action");
    let succeeded = false;
    try {
      await action.onClick();
      succeeded = true;
      if (action.dismiss !== false) onDismiss(item.id);
    } catch (error) {
      if (action.onError) {
        try {
          await action.onError(error);
        } catch (handlerError) {
          console.error("Personal UI Toast action error handler failed.", handlerError);
        }
      } else {
        console.error("Personal UI Toast action failed.", error);
      }
    } finally {
      actionRunning.current = false;
      setActionPending(false);
      if (!succeeded || action.dismiss === false) onResume(item.id, "action");
    }
  };
  return (
    <div
      className={cx("pui-toast", `pui-toast--${item.tone}`, `pui-toast--${item.shape}`)}
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
      <div className="pui-toast__main">
        <span className="pui-toast__icon" aria-hidden="true"><Icon /></span>
        <div className="pui-toast__copy">
          {item.title != null ? (
            <strong title={typeof item.title === "string" || typeof item.title === "number" ? String(item.title) : undefined}>
              {item.title}
            </strong>
          ) : null}
          <div>{item.description}</div>
        </div>
      </div>
      {item.action || item.closable ? (
        <div className="pui-toast__actions">
          {item.action ? (
            <button
              type="button"
              className="pui-toast__action"
              aria-disabled={actionPending || undefined}
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
              <span className="pui-toast__action-content" aria-hidden={actionPending || undefined}>
                <span>{item.action.label}</span>
              </span>
              <span className="pui-toast__action-loading" aria-hidden={!actionPending}>
                <LoaderCircle className="pui-spinner" aria-hidden="true" />
                <span>{item.action.loadingLabel ?? "处理中"}</span>
              </span>
            </button>
          ) : null}
          {item.closable ? (
            <button type="button" className="pui-toast__close" aria-label={closeLabel} onClick={() => onDismiss(item.id)}>
              <X aria-hidden="true" />
            </button>
          ) : null}
        </div>
      ) : null}
      {item.countdown && item.duration !== null ? (
        <span className="pui-toast__countdown" aria-hidden="true">
          <span style={{ animationPlayState: item.paused ? "paused" : "running" }} />
        </span>
      ) : null}
    </div>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}

export interface RetryButtonProps extends Omit<ButtonProps, "children" | "onClick"> {
  onRetry: () => void;
  label?: string;
}

export function RetryButton({ onRetry, label = "重试", ...props }: RetryButtonProps) {
  return <Button {...props} onClick={onRetry}>{label}</Button>;
}
