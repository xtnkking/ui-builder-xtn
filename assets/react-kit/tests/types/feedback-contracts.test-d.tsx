import { createRef } from "react";
import {
  Alert,
  AsyncAction,
  Banner,
  EmptyState,
  ErrorState,
  InlineMessage,
  NoResults,
  Progress,
  ProgressRing,
  RetryButton,
  ToastProvider,
  ValidationSummary,
  type AlertProps,
  type AsyncActionProps,
  type BannerProps,
  type EmptyStateProps,
  type ErrorStateProps,
  type InlineMessageProps,
  type NoResultsProps,
  type ProgressProps,
  type ProgressRingProps,
  type RetryButtonProps,
  type ToastProviderProps,
  type ValidationSummaryProps,
} from "../../src/personal-ui";

type EscapeHatch =
  | "className"
  | "style"
  | "css"
  | "sx"
  | "tw"
  | "ref"
  | "dangerouslySetInnerHTML"
  | "data-pui-owner"
  | "data-pui-slot"
  | "data-pui-private";

type EscapeValue<Props, Key extends PropertyKey> = Key extends keyof Props
  ? Exclude<Props[Key], undefined>
  : never;

type EscapeLeaks<Props> = {
  [Key in EscapeHatch]: [EscapeValue<Props, Key>] extends [never] ? never : Key;
}[EscapeHatch];

type AssertNever<Value extends never> = true;

type FeedbackContractAssertions = [
  AssertNever<EscapeLeaks<AlertProps>>,
  AssertNever<EscapeLeaks<EmptyStateProps>>,
  AssertNever<EscapeLeaks<ProgressProps>>,
  AssertNever<EscapeLeaks<ToastProviderProps>>,
  AssertNever<EscapeLeaks<RetryButtonProps>>,
  AssertNever<EscapeLeaks<InlineMessageProps>>,
  AssertNever<EscapeLeaks<BannerProps>>,
  AssertNever<EscapeLeaks<ValidationSummaryProps>>,
  AssertNever<EscapeLeaks<ErrorStateProps>>,
  AssertNever<EscapeLeaks<NoResultsProps>>,
  AssertNever<EscapeLeaks<ProgressRingProps>>,
  AssertNever<EscapeLeaks<AsyncActionProps>>,
];

const feedbackContractAssertions: FeedbackContractAssertions = [
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
];
void feedbackContractAssertions;

const allowedUsage = (
  <ToastProvider defaultPosition="bottom-right" defaultShape="pill">
    <Alert aria-live="polite" data-track="alert" onMouseEnter={() => undefined}>Notice</Alert>
    <EmptyState title="Nothing here" aria-describedby="empty-help" data-track="empty" />
    <Progress value={42} label="Uploading" aria-describedby="progress-help" data-track="progress" />
    <RetryButton onRetry={() => undefined} form="retry-form" data-track="retry" />
    <InlineMessage title="Hint" data-track="inline">Check this value</InlineMessage>
    <Banner aria-label="Maintenance" data-track="banner">Planned maintenance</Banner>
    <ValidationSummary issues={[]} aria-live="assertive" data-track="validation" />
    <ErrorState aria-describedby="error-help" data-track="error" />
    <NoResults onMouseEnter={() => undefined} data-track="no-results" />
    <ProgressRing value={42} label="Uploading" aria-describedby="ring-help" data-track="ring" />
    <AsyncAction onAction={() => undefined} name="intent" value="save" data-track="async">Save</AsyncAction>
  </ToastProvider>
);
void allowedUsage;

// @ts-expect-error Alert styling is owned by Personal UI
const alertClassName = <Alert className="foreign">Notice</Alert>;
// @ts-expect-error EmptyState does not expose inline styling
const emptyStyle = <EmptyState title="Empty" style={{ color: "red" }} />;
// @ts-expect-error Progress does not expose CSS-in-JS props
const progressCss = <Progress value={10} label="Loading" css={{ color: "red" }} />;
// @ts-expect-error ToastProvider uses only its documented provider configuration
const providerSx = <ToastProvider sx={{ color: "red" }}><span /></ToastProvider>;
// @ts-expect-error ToastProvider does not expose a raw ref
const providerRef = <ToastProvider ref={createRef<HTMLDivElement>()}><span /></ToastProvider>;
// @ts-expect-error RetryButton cannot accept utility classes
const retryTw = <RetryButton tw="text-red" onRetry={() => undefined} />;
// @ts-expect-error InlineMessage does not expose a raw DOM ref
const inlineRef = <InlineMessage ref={createRef<HTMLSpanElement>()}>Hint</InlineMessage>;
// @ts-expect-error Banner does not expose raw HTML injection
const bannerHtml = <Banner dangerouslySetInnerHTML={{ __html: "unsafe" }}>Notice</Banner>;
// @ts-expect-error ValidationSummary does not expose internal ownership markers
const validationOwner = <ValidationSummary issues={[]} data-pui-owner="Consumer" />;
// @ts-expect-error ErrorState styling is fixed
const errorClassName = <ErrorState className="foreign" />;
// @ts-expect-error NoResults styling is fixed
const noResultsStyle = <NoResults style={{ color: "red" }} />;
// @ts-expect-error ProgressRing does not expose internal slot markers
const ringSlot = <ProgressRing label="Loading" data-pui-slot="foreign" />;
// @ts-expect-error AsyncAction does not expose a raw DOM ref
const asyncRef = <AsyncAction ref={createRef<HTMLButtonElement>()} onAction={() => undefined}>Save</AsyncAction>;
// @ts-expect-error arbitrary data-pui attributes are rejected in Props objects
const privateAlertData: AlertProps = { children: "Notice", "data-pui-private": "foreign" };

void alertClassName;
void emptyStyle;
void progressCss;
void providerSx;
void providerRef;
void retryTw;
void inlineRef;
void bannerHtml;
void validationOwner;
void errorClassName;
void noResultsStyle;
void ringSlot;
void asyncRef;
void privateAlertData;
