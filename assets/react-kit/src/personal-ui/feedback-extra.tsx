import { useId, useState, type ReactNode } from "react";
import { AlertCircle, Ban, CircleCheck, CloudOff, Info, ShieldAlert, TriangleAlert } from "lucide-react";
import { Button, type ButtonProps } from "./primitives";
import { Alert, EmptyState, type FeedbackTone } from "./feedback";
import { cx } from "./utils";

const feedbackIcons = {
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  danger: AlertCircle,
} as const;

export interface InlineMessageProps {
  tone?: FeedbackTone;
  children: ReactNode;
  className?: string;
}

export function InlineMessage({ tone = "info", children, className }: InlineMessageProps) {
  const Icon = feedbackIcons[tone];
  return (
    <span
      className={cx("pui-inline-message", `pui-inline-message--${tone}`, className)}
      role={tone === "danger" ? "alert" : "status"}
      data-pui-owner="InlineMessage"
    >
      <Icon aria-hidden="true" />
      <span>{children}</span>
    </span>
  );
}

export interface BannerProps {
  tone?: FeedbackTone;
  title?: ReactNode;
  children: ReactNode;
  action?: ReactNode;
  sticky?: boolean;
  className?: string;
}

export function Banner({ tone = "info", title, children, action, sticky, className }: BannerProps) {
  return (
    <div
      className={cx("pui-banner", sticky && "pui-banner--sticky", className)}
      data-pui-owner="Banner"
    >
      <Alert tone={tone} title={title} action={action}>{children}</Alert>
    </div>
  );
}

export interface ValidationIssue {
  id: string;
  message: ReactNode;
  fieldId?: string;
}

export interface ValidationSummaryProps {
  title?: ReactNode;
  issues: readonly ValidationIssue[];
  className?: string;
}

export function ValidationSummary({ title = "请检查以下内容", issues, className }: ValidationSummaryProps) {
  const titleId = useId();
  if (!issues.length) return null;
  return (
    <section
      className={cx("pui-validation-summary", className)}
      aria-labelledby={titleId}
      role="alert"
      data-pui-owner="ValidationSummary"
    >
      <div className="pui-validation-summary__heading">
        <AlertCircle aria-hidden="true" />
        <strong id={titleId}>{title}</strong>
      </div>
      <ul>
        {issues.map((issue) => (
          <li key={issue.id}>
            {issue.fieldId ? (
              <button
                type="button"
                onClick={() => document.getElementById(issue.fieldId ?? "")?.focus({ preventScroll: false })}
              >
                {issue.message}
              </button>
            ) : issue.message}
          </li>
        ))}
      </ul>
    </section>
  );
}

export interface ErrorStateProps {
  title?: ReactNode;
  description?: ReactNode;
  kind?: "error" | "permission" | "offline";
  onRetry?: () => void | Promise<void>;
  retryLabel?: ReactNode;
  retryLoading?: boolean;
  compact?: boolean;
  className?: string;
}

export function ErrorState({
  title,
  description,
  kind = "error",
  onRetry,
  retryLabel = "重试",
  retryLoading,
  compact,
  className,
}: ErrorStateProps) {
  const Icon = kind === "permission" ? ShieldAlert : kind === "offline" ? CloudOff : Ban;
  const resolvedTitle = title ?? (kind === "permission" ? "没有访问权限" : kind === "offline" ? "当前处于离线状态" : "加载失败");
  return (
    <div data-pui-owner="ErrorState">
      <EmptyState
        className={className}
        compact={compact}
        icon={<Icon />}
        title={resolvedTitle}
        description={description}
        action={onRetry ? (
          <Button variant="primary" loading={retryLoading} loadingLabel="重试中" onClick={onRetry}>
            {retryLabel}
          </Button>
        ) : undefined}
      />
    </div>
  );
}

export interface NoResultsProps {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}

export function NoResults({
  title = "没有匹配结果",
  description = "调整条件后重新查询。",
  action,
  compact,
  className,
}: NoResultsProps) {
  return (
    <div data-pui-owner="NoResults">
      <EmptyState title={title} description={description} action={action} compact={compact} className={className} />
    </div>
  );
}

export interface ProgressRingProps {
  value?: number;
  label: string;
  size?: "small" | "medium" | "large";
  showValue?: boolean;
  indeterminate?: boolean;
  className?: string;
}

export function ProgressRing({
  value = 0,
  label,
  size = "medium",
  showValue = true,
  indeterminate = false,
  className,
}: ProgressRingProps) {
  const normalized = Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;
  return (
    <span
      className={cx("pui-progress-ring", `pui-progress-ring--${size}`, indeterminate && "is-indeterminate", className)}
      role="progressbar"
      aria-label={label}
      aria-valuemin={indeterminate ? undefined : 0}
      aria-valuemax={indeterminate ? undefined : 100}
      aria-valuenow={indeterminate ? undefined : normalized}
      style={{ "--pui-progress-value": `${normalized * 3.6}deg` } as React.CSSProperties}
      data-pui-owner="ProgressRing"
    >
      <span>{showValue && !indeterminate ? `${Math.round(normalized)}%` : null}</span>
    </span>
  );
}

export interface AsyncActionProps extends Omit<ButtonProps, "onClick"> {
  onAction: () => void | Promise<void>;
  onActionError?: (error: unknown) => void;
}

export function AsyncAction({ onAction, onActionError, loading: externalLoading, ...props }: AsyncActionProps) {
  const [pending, setPending] = useState(false);
  const loading = Boolean(externalLoading || pending);
  const run = async () => {
    if (loading) return;
    setPending(true);
    try {
      await onAction();
    } catch (error) {
      onActionError?.(error);
    } finally {
      setPending(false);
    }
  };
  return <Button {...props} loading={loading} onClick={() => void run()} data-pui-owner="AsyncAction" />;
}
