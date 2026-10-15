import { useId, useState, type HTMLAttributes, type ReactNode } from "react";
import { AlertCircle, Ban, CircleCheck, CloudOff, Info, ShieldAlert, TriangleAlert } from "lucide-react";
import type { PublicControlProps } from "../foundation/contracts";
import { InternalButtonSlot } from "../internal/button-slots";
import { sanitizeFixedControlProps } from "../internal/fixed-control-props";
import { useUILocale } from "../foundation/locale";
import { Button, type ButtonProps } from "../foundation/primitives";
import { EmptyState, type FeedbackTone } from "./feedback";
import { InternalToastBoundary, useInternalOwnedToast } from "../internal/toast-boundary";
import { cx } from "../internal/utils";

const feedbackIcons = {
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  danger: AlertCircle,
} as const;

export type InlineMessageProps = PublicControlProps<Omit<
  HTMLAttributes<HTMLSpanElement>,
  "children" | "role"
>> & {
  tone?: FeedbackTone;
  children: ReactNode;
};

export function InlineMessage(rawProps: InlineMessageProps) {
  const safeProps = sanitizeFixedControlProps(rawProps, ["role"]);
  const { tone = "info", children, ...props } = safeProps;
  const Icon = feedbackIcons[tone];
  return (
    <span
      {...props}
      className={cx("ui-inline-message", `ui-inline-message--${tone}`)}
      role={tone === "danger" ? "alert" : "status"}
      data-ui-owner="InlineMessage"
    >
      <Icon aria-hidden="true" />
      <span>{children}</span>
    </span>
  );
}

export type BannerProps = PublicControlProps<Omit<
  HTMLAttributes<HTMLDivElement>,
  "children" | "title"
>> & {
  tone?: FeedbackTone;
  title?: ReactNode;
  children: ReactNode;
  action?: ReactNode;
  sticky?: boolean;
};

export function Banner(rawProps: BannerProps) {
  return <InternalToastBoundary><BannerContent rawProps={rawProps} /></InternalToastBoundary>;
}

function BannerContent({ rawProps }: { rawProps: BannerProps }) {
  const safeProps = sanitizeFixedControlProps(rawProps);
  const { tone = "info", title, children, action, sticky: _sticky, ...props } = safeProps;
  useInternalOwnedToast(true, {
    tone, title, duration: null,
    description: <>{children}{action != null ? <div className="ui-banner__action">{action}</div> : null}</>,
  });
  return (
    <div
      {...props}
      hidden
      className="ui-banner"
      data-ui-owner="Banner"
    />
  );
}

export interface ValidationIssue {
  id: string;
  message: ReactNode;
  fieldId?: string;
}

export type ValidationSummaryProps = PublicControlProps<Omit<
  HTMLAttributes<HTMLElement>,
  "aria-labelledby" | "children" | "role" | "title"
>> & {
  title?: ReactNode;
  issues: readonly ValidationIssue[];
};

export function ValidationSummary(rawProps: ValidationSummaryProps) {
  const { message } = useUILocale();
  const safeProps = sanitizeFixedControlProps(rawProps, ["aria-labelledby", "children", "role"]);
  const { title = message("validation.summary"), issues, ...props } = safeProps;
  const titleId = useId();
  if (!issues.length) return null;
  return (
    <section
      {...props}
      className="ui-validation-summary"
      aria-labelledby={titleId}
      role="alert"
      data-ui-owner="ValidationSummary"
    >
      <div className="ui-validation-summary__heading">
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

export type ErrorStateProps = PublicControlProps<Omit<
  HTMLAttributes<HTMLDivElement>,
  "children" | "title"
>> & {
  title?: ReactNode;
  description?: ReactNode;
  kind?: "error" | "permission" | "offline";
  onRetry?: () => void | Promise<void>;
  retryLabel?: ReactNode;
  retryLoading?: boolean;
  compact?: boolean;
};

export function ErrorState(rawProps: ErrorStateProps) {
  const { message } = useUILocale();
  const safeProps = sanitizeFixedControlProps(rawProps, ["children"]);
  const {
    title,
    description,
    kind = "error",
    onRetry,
    retryLabel = message("common.retry"),
    retryLoading,
    compact,
    ...props
  } = safeProps;
  const Icon = kind === "permission" ? ShieldAlert : kind === "offline" ? CloudOff : Ban;
  const resolvedTitle = title ?? (kind === "permission"
    ? message("error.permission")
    : kind === "offline" ? message("error.offline") : message("error.loadFailed"));
  return (
    <div {...props} data-ui-owner="ErrorState">
      <EmptyState
        compact={compact}
        icon={<Icon />}
        title={resolvedTitle}
        description={description}
        action={onRetry ? (
          <Button variant="primary" loading={retryLoading} loadingLabel={message("common.retrying")} onClick={onRetry}>
            {retryLabel}
          </Button>
        ) : undefined}
      />
    </div>
  );
}

export type NoResultsProps = PublicControlProps<Omit<
  HTMLAttributes<HTMLDivElement>,
  "children" | "title"
>> & {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
};

export function NoResults(rawProps: NoResultsProps) {
  const { message } = useUILocale();
  const safeProps = sanitizeFixedControlProps(rawProps, ["children"]);
  const {
    title = message("empty.noResultsTitle"),
    description = message("empty.noResultsDescription"),
    action,
    compact,
    ...props
  } = safeProps;
  return (
    <div {...props} data-ui-owner="NoResults">
      <EmptyState title={title} description={description} action={action} compact={compact} />
    </div>
  );
}

export type ProgressRingProps = PublicControlProps<Omit<
  HTMLAttributes<HTMLSpanElement>,
  "aria-label" | "aria-valuemax" | "aria-valuemin" | "aria-valuenow" | "children" | "role"
>> & {
  value?: number;
  label: string;
  size?: "small" | "medium" | "large";
  showValue?: boolean;
  indeterminate?: boolean;
};

export function ProgressRing(rawProps: ProgressRingProps) {
  const safeProps = sanitizeFixedControlProps(rawProps, [
    "aria-label",
    "aria-valuemax",
    "aria-valuemin",
    "aria-valuenow",
    "children",
    "role",
  ]);
  const {
    value = 0,
    label,
    size = "medium",
    showValue = true,
    indeterminate = false,
    ...props
  } = safeProps;
  const normalized = Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;
  return (
    <span
      {...props}
      className={cx("ui-progress-ring", `ui-progress-ring--${size}`, indeterminate && "is-indeterminate")}
      role="progressbar"
      aria-label={label}
      aria-valuemin={indeterminate ? undefined : 0}
      aria-valuemax={indeterminate ? undefined : 100}
      aria-valuenow={indeterminate ? undefined : normalized}
      style={{ "--ui-progress-value": `${normalized * 3.6}deg` } as React.CSSProperties}
      data-ui-owner="ProgressRing"
    >
      <span>{showValue && !indeterminate ? `${Math.round(normalized)}%` : null}</span>
    </span>
  );
}

export type AsyncActionProps = PublicControlProps<Omit<ButtonProps, "onClick">> & {
  onAction: () => void | Promise<void>;
  onActionError?: (error: unknown) => void;
};

export function AsyncAction(rawProps: AsyncActionProps) {
  const safeProps = sanitizeFixedControlProps(rawProps);
  const { onAction, onActionError, loading: externalLoading, ...props } = safeProps;
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
  return (
    <InternalButtonSlot name="async-action">
      <Button {...props} loading={loading} onClick={() => void run()} />
    </InternalButtonSlot>
  );
}
