// @personal-ui-coverage {"kind":"unit","runner":"components","exports":["Alert","AsyncAction","Banner","EmptyState","ErrorState","InlineMessage","NoResults","Progress","ProgressRing","RetryButton","ToastProvider","ValidationSummary"]}
import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
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
  useToast,
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
  type ValidationSummaryProps,
} from "../../src/personal-ui";

function ToastProviderProbe() {
  const { toast } = useToast();
  return (
    <button
      type="button"
      onClick={() => toast({ description: "Provider defaults", duration: null })}
    >
      Show provider toast
    </button>
  );
}

function escapedProps(testId: string, onMouseEnter: () => void) {
  return {
    className: "foreign-feedback",
    style: { color: "red", background: "magenta" },
    css: "foreign-css",
    sx: "foreign-sx",
    tw: "foreign-tw",
    dangerouslySetInnerHTML: { __html: "<b>unsafe</b>" },
    "data-pui-owner": "Consumer",
    "data-pui-slot": "foreign",
    "data-pui-private": "foreign",
    "data-testid": testId,
    "data-track": "preserved",
    "aria-describedby": `${testId}-help`,
    onMouseEnter,
    children: "Injected child",
  };
}

function expectClosedRoot(element: HTMLElement, owner: string, expectedClass: string) {
  if (expectedClass) expect(element).toHaveClass(expectedClass);
  expect(element).not.toHaveClass("foreign-feedback");
  expect(element).not.toHaveAttribute("css");
  expect(element).not.toHaveAttribute("sx");
  expect(element).not.toHaveAttribute("tw");
  expect(element).not.toHaveAttribute("data-pui-slot");
  expect(element).not.toHaveAttribute("data-pui-private");
  expect(element).toHaveAttribute("data-pui-owner", owner);
  expect(element).toHaveAttribute("data-track", "preserved");
  expect(element).toHaveAttribute("aria-describedby", `${element.dataset.testid}-help`);
  expect(element).not.toHaveTextContent("unsafe");
}

describe("feedback public contracts", () => {
  it("keeps fixed feedback roots closed while preserving ARIA, data, and event props", () => {
    const callbacks = Array.from({ length: 9 }, () => vi.fn());

    render(
      <>
        {createElement(Alert, {
          ...escapedProps("alert", callbacks[0]),
          tone: "warning",
          title: "Warning",
        } as unknown as AlertProps, "Alert body")}
        {createElement(EmptyState, {
          ...escapedProps("empty", callbacks[1]),
          title: "Nothing here",
          description: "Try another view",
        } as unknown as EmptyStateProps)}
        {createElement(Progress, {
          ...escapedProps("progress", callbacks[2]),
          value: 42,
          label: "Uploading",
          showValue: true,
        } as unknown as ProgressProps)}
        {createElement(InlineMessage, {
          ...escapedProps("inline", callbacks[3]),
          tone: "success",
        } as unknown as InlineMessageProps, "Saved")}
        {createElement(Banner, {
          ...escapedProps("banner", callbacks[4]),
          sticky: true,
          title: "Maintenance",
        } as unknown as BannerProps, "Tonight")}
        {createElement(ValidationSummary, {
          ...escapedProps("validation", callbacks[5]),
          issues: [{ id: "email", message: "Email is required", fieldId: "email" }],
        } as unknown as ValidationSummaryProps)}
        {createElement(ErrorState, {
          ...escapedProps("error", callbacks[6]),
          title: "Could not load",
        } as unknown as ErrorStateProps)}
        {createElement(NoResults, {
          ...escapedProps("no-results", callbacks[7]),
          title: "No matches",
        } as unknown as NoResultsProps)}
        {createElement(ProgressRing, {
          ...escapedProps("ring", callbacks[8]),
          value: 42,
          label: "Uploading files",
        } as unknown as ProgressRingProps)}
      </>,
    );

    const expectations = [
      ["alert", "Alert", "pui-alert"],
      ["empty", "EmptyState", "pui-empty"],
      ["progress", "Progress", "pui-progress-group"],
      ["inline", "InlineMessage", "pui-inline-message"],
      ["banner", "Banner", "pui-banner"],
      ["validation", "ValidationSummary", "pui-validation-summary"],
      ["error", "ErrorState", ""],
      ["no-results", "NoResults", ""],
      ["ring", "ProgressRing", "pui-progress-ring"],
    ] as const;

    expectations.forEach(([testId, owner, expectedClass], index) => {
      const element = screen.getByTestId(testId);
      expectClosedRoot(element, owner, expectedClass);
      fireEvent.mouseEnter(element);
      expect(callbacks[index]).toHaveBeenCalledTimes(1);
      if (testId !== "ring") expect(element).not.toHaveAttribute("style");
    });

    expect(screen.getByTestId("alert")).toHaveClass("pui-alert--warning");
    expect(screen.getByTestId("empty")).not.toHaveTextContent("Injected child");
    expect(screen.getByTestId("progress")).toHaveTextContent("42%");
    expect(screen.getByTestId("inline")).toHaveTextContent("Saved");
    expect(screen.getByTestId("banner")).toHaveClass("pui-banner--sticky");
    expect(screen.getByTestId("validation")).toHaveTextContent("Email is required");
    expect(screen.getByTestId("error")).toHaveTextContent("Could not load");
    expect(screen.getByTestId("no-results")).toHaveTextContent("No matches");
    expect(screen.getByTestId("ring")).toHaveAttribute("aria-label", "Uploading files");
    expect(screen.getByTestId("ring").style.getPropertyValue("--pui-progress-value")).toMatch(/^151\.2\d*deg$/);
    expect(screen.getByTestId("ring").getAttribute("style")).not.toContain("color");
  });

  it("sanitizes composite feedback buttons and preserves their supported button behavior", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const onAction = vi.fn();
    const retryHover = vi.fn();
    const actionHover = vi.fn();

    render(
      <>
        {createElement(RetryButton, {
          ...escapedProps("retry", retryHover),
          label: "Try again",
          onRetry,
        } as unknown as RetryButtonProps)}
        {createElement(AsyncAction, {
          ...escapedProps("async", actionHover),
          onAction,
        } as unknown as AsyncActionProps, "Save")}
      </>,
    );

    const retry = screen.getByTestId("retry");
    const action = screen.getByTestId("async");
    expectClosedRoot(retry, "RetryButton", "pui-button");
    expectClosedRoot(action, "AsyncAction", "pui-button");

    fireEvent.mouseEnter(retry);
    fireEvent.mouseEnter(action);
    expect(retryHover).toHaveBeenCalledTimes(1);
    expect(actionHover).toHaveBeenCalledTimes(1);

    await user.click(retry);
    await user.click(action);

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("sanitizes ToastProvider injection while preserving its documented defaults", async () => {
    const user = userEvent.setup();
    const forbiddenRef = vi.fn();
    const refWarning = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(
      createElement(ToastProvider, {
        className: "foreign-feedback",
        style: { color: "red" },
        ref: forbiddenRef,
        dangerouslySetInnerHTML: { __html: "<b>unsafe provider</b>" },
        "data-pui-owner": "Consumer",
        "data-pui-slot": "foreign",
        "data-pui-private": "foreign",
        defaultPosition: "top-center",
        defaultShape: "pill",
        children: (
          <span data-testid="provider-child">
            Content
            <ToastProviderProbe />
          </span>
        ),
      } as unknown as React.ComponentProps<typeof ToastProvider>),
    );
    refWarning.mockRestore();

    const child = screen.getByTestId("provider-child");
    expect(child).toHaveTextContent("Content");
    expect(document.querySelector(".foreign-feedback")).toBeNull();
    expect(document.querySelector("[data-pui-owner='Consumer']")).toBeNull();
    expect(document.querySelector("[data-pui-slot='foreign']")).toBeNull();
    expect(document.querySelector("[data-pui-private='foreign']")).toBeNull();
    expect(document.body).not.toHaveTextContent("unsafe provider");
    expect(forbiddenRef).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Show provider toast" }));
    const toast = screen.getByRole("status");
    expect(toast).toHaveTextContent("Provider defaults");
    expect(toast).toHaveAttribute("data-position", "top-center");
    expect(toast).toHaveAttribute("data-shape", "pill");
  });
});
