// @ui-coverage {"kind":"unit","runner":"components","exports":["ToastProvider","useToast"]}
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider, useToast, type ToastApi, type ToastProviderProps } from "../../src/ui";

function mountToasts(initialProps: Omit<ToastProviderProps, "children"> = {}) {
  let currentApi: ToastApi;
  function Probe() {
    currentApi = useToast();
    return <button type="button">Outside notification</button>;
  }
  const view = render(<ToastProvider {...initialProps}><Probe /></ToastProvider>);
  return {
    ...view,
    api: () => currentApi!,
    configure: (props: Omit<ToastProviderProps, "children">) => {
      view.rerender(<ToastProvider {...props}><Probe /></ToastProvider>);
    },
  };
}

function advance(milliseconds: number) {
  act(() => { vi.advanceTimersByTime(milliseconds); });
}

function visibleCopies() {
  return [...screen.queryAllByRole("status"), ...screen.queryAllByRole("alert")]
    .map((element) => element.querySelector(".ui-toast__copy")?.textContent);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(performance, "now").mockImplementation(() => Date.now());
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("Toast bounded capacity and lifecycle", () => {
  it("limits a synchronous multi-position burst to three cards and promotes in FIFO order", () => {
    const harness = mountToasts();
    const ids: string[] = [];
    act(() => {
      for (let index = 1; index <= 6; index += 1) {
        ids.push(harness.api().toast({
          description: `Message ${index}`,
          duration: null,
          position: index % 2 === 0 ? "bottom-right" : "top-right",
        }));
      }
    });
    expect(new Set(ids).size).toBe(6);
    expect(visibleCopies()).toHaveLength(3);
    expect(visibleCopies()).toEqual(expect.arrayContaining(["Message 1", "Message 2", "Message 3"]));
    expect(screen.queryByText("Message 4")).toBeNull();

    act(() => { harness.api().dismiss(ids[1]); });
    expect(visibleCopies()).toHaveLength(3);
    expect(screen.getByText("Message 4")).toBeInTheDocument();
    expect(screen.queryByText("Message 5")).toBeNull();
    act(() => { harness.api().dismiss(ids[0]); });
    expect(screen.getByText("Message 5")).toBeInTheDocument();
    expect(screen.queryByText("Message 6")).toBeNull();
  });

  it("bounds the waiting queue and drops the newest overflow without evicting existing cards", () => {
    const harness = mountToasts({ maxVisible: 1, maxQueue: 2 });
    const ids: string[] = [];
    act(() => {
      for (let index = 1; index <= 5; index += 1) {
        ids.push(harness.api().toast({ description: `Bounded ${index}`, duration: null }));
      }
    });
    expect(visibleCopies()).toEqual(["Bounded 1"]);
    act(() => { harness.api().dismiss(ids[4]); });
    expect(visibleCopies()).toEqual(["Bounded 1"]);
    act(() => { harness.api().dismiss(ids[0]); });
    expect(visibleCopies()).toEqual(["Bounded 2"]);
    act(() => { harness.api().dismiss(ids[1]); });
    expect(visibleCopies()).toEqual(["Bounded 3"]);
    act(() => { harness.api().dismiss(ids[2]); });
    expect(visibleCopies()).toEqual([]);
  });

  it("supports a zero queue while retaining the mounted notification", () => {
    const harness = mountToasts({ maxVisible: 1, maxQueue: 0 });
    let firstId = "";
    act(() => {
      firstId = harness.api().toast({ description: "Keep visible", duration: null });
      harness.api().toast({ description: "Drop overflow", duration: null });
    });
    expect(visibleCopies()).toEqual(["Keep visible"]);
    act(() => { harness.api().dismiss(firstId); });
    expect(visibleCopies()).toEqual([]);
  });

  it("deduplicates visible and queued calls synchronously without resetting text or lifetime", () => {
    const harness = mountToasts({ maxVisible: 1 });
    let activeId = "";
    let queuedId = "";
    const duplicates: string[] = [];
    act(() => {
      activeId = harness.api().toast({ description: "Original active", duration: 5000, dedupeKey: "active" });
      queuedId = harness.api().toast({ description: "Original waiting", duration: 1000, dedupeKey: "waiting" });
      duplicates.push(harness.api().toast({ description: "Changed waiting", duration: 9000, dedupeKey: "waiting" }));
    });
    advance(3000);
    act(() => {
      duplicates.push(harness.api().toast({ description: "Changed active", duration: 9000, dedupeKey: "active" }));
    });
    expect(duplicates).toEqual([queuedId, activeId]);
    expect(visibleCopies()).toEqual(["Original active"]);
    advance(1999);
    expect(screen.getByText("Original active")).toBeInTheDocument();
    advance(1);
    expect(visibleCopies()).toEqual(["Original waiting"]);
    advance(999);
    expect(screen.getByText("Original waiting")).toBeInTheDocument();
    advance(1);
    expect(visibleCopies()).toEqual([]);
  });

  it("starts a queued duration only when the notification is mounted", () => {
    const harness = mountToasts({ maxVisible: 1 });
    let anchorId = "";
    act(() => {
      anchorId = harness.api().toast({ description: "Persistent anchor", duration: null });
      harness.api().toast({ description: "Short queued message", duration: 500 });
    });
    advance(60_000);
    expect(visibleCopies()).toEqual(["Persistent anchor"]);
    act(() => { harness.api().dismiss(anchorId); });
    expect(visibleCopies()).toEqual(["Short queued message"]);
    advance(499);
    expect(screen.getByText("Short queued message")).toBeInTheDocument();
    advance(1);
    expect(visibleCopies()).toEqual([]);
  });

  it("removes dismissed waiting messages and permits a fresh call with their dedupe key", () => {
    const harness = mountToasts({ maxVisible: 1 });
    let anchorId = "";
    let removedId = "";
    let replacementId = "";
    act(() => {
      anchorId = harness.api().toast({ description: "Anchor", duration: null });
      removedId = harness.api().toast({ description: "Removed waiting", duration: null, dedupeKey: "request" });
      harness.api().dismiss(removedId);
      replacementId = harness.api().toast({ description: "Replacement waiting", duration: null, dedupeKey: "request" });
    });
    expect(replacementId).not.toBe(removedId);
    act(() => { harness.api().dismiss(anchorId); });
    expect(visibleCopies()).toEqual(["Replacement waiting"]);
    expect(screen.queryByText("Removed waiting")).toBeNull();
  });

  it("does not evict mounted cards when lowering capacity and promotes when increasing it", () => {
    const harness = mountToasts({ maxVisible: 3 });
    const ids: string[] = [];
    act(() => {
      for (let index = 1; index <= 5; index += 1) {
        ids.push(harness.api().toast({ description: `Resize ${index}`, duration: null }));
      }
    });
    harness.configure({ maxVisible: 1 });
    expect(visibleCopies()).toHaveLength(3);
    act(() => { harness.api().dismiss(ids[0]); });
    expect(visibleCopies()).toHaveLength(2);
    expect(screen.queryByText("Resize 4")).toBeNull();
    act(() => { harness.api().dismiss(ids[1]); });
    expect(visibleCopies()).toEqual(["Resize 3"]);
    harness.configure({ maxVisible: 2 });
    expect(visibleCopies()).toEqual(expect.arrayContaining(["Resize 3", "Resize 4"]));
    expect(visibleCopies()).toHaveLength(2);
    expect(screen.queryByText("Resize 5")).toBeNull();
  });

  it("dismisses both mounted and queued messages and clears dedupe state and timers", () => {
    const harness = mountToasts({ maxVisible: 1 });
    let firstId = "";
    let freshId = "";
    act(() => {
      firstId = harness.api().toast({ description: "Before clear", duration: 1000, showSeconds: true, dedupeKey: "clear" });
      harness.api().toast({ description: "Waiting before clear", duration: 1000 });
      harness.api().dismissAll();
    });
    expect(visibleCopies()).toEqual([]);
    advance(20_000);
    expect(visibleCopies()).toEqual([]);
    act(() => {
      freshId = harness.api().toast({ description: "After clear", duration: 1000, dedupeKey: "clear" });
    });
    expect(freshId).not.toBe(firstId);
    expect(visibleCopies()).toEqual(["After clear"]);
    harness.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps numeric seconds independent of the progress bar and pauses until all interactions end", () => {
    const harness = mountToasts();
    act(() => {
      harness.api().toast({ description: "Seconds only", duration: 5000, showSeconds: true, countdown: false });
    });
    const card = screen.getByRole("status");
    const seconds = card.querySelector(".ui-toast__seconds");
    expect(seconds).not.toBeNull();
    expect(seconds).toHaveTextContent("5");
    expect(seconds).toHaveAttribute("aria-hidden", "true");
    expect(card.querySelector(".ui-toast__countdown")).toBeNull();
    advance(1100);
    expect(seconds).toHaveTextContent("4");
    const close = within(card).getByRole("button", { name: /Seconds only/ });
    fireEvent.mouseEnter(card);
    fireEvent.focus(close);
    advance(10_000);
    expect(seconds).toHaveTextContent("4");
    fireEvent.mouseLeave(card);
    advance(10_000);
    expect(screen.getByText("Seconds only")).toBeInTheDocument();
    expect(seconds).toHaveTextContent("4");
    fireEvent.blur(close, { relatedTarget: screen.getByRole("button", { name: "Outside notification" }) });
    advance(3900);
    expect(visibleCopies()).toEqual([]);
  });

  it("offers progress without seconds and a default automatic message without either decoration", () => {
    const harness = mountToasts();
    act(() => {
      harness.api().toast({ description: "Progress only", duration: 5000, countdown: true });
      harness.api().toast({ description: "Plain automatic" });
    });
    const progressCard = screen.getByText("Progress only").closest(".ui-toast")!;
    const plainCard = screen.getByText("Plain automatic").closest(".ui-toast")!;
    expect(progressCard.querySelector(".ui-toast__countdown")).not.toBeNull();
    expect(progressCard.querySelector(".ui-toast__seconds")).toBeNull();
    expect(plainCard.querySelector(".ui-toast__countdown")).toBeNull();
    expect(plainCard.querySelector(".ui-toast__seconds")).toBeNull();
    advance(5000);
    expect(visibleCopies()).toEqual([]);
  });

  it("pauses the remaining clock while the document is hidden and resumes without extending its duration", () => {
    const hidden = vi.spyOn(document, "hidden", "get");
    const harness = mountToasts();
    act(() => { harness.api().toast({ description: "Background-safe", duration: 2000 }); });
    advance(750);
    hidden.mockReturnValue(true);
    fireEvent(document, new Event("visibilitychange"));
    advance(30_000);
    expect(screen.getByText("Background-safe")).toBeInTheDocument();
    hidden.mockReturnValue(false);
    fireEvent(document, new Event("visibilitychange"));
    advance(1249);
    expect(screen.getByText("Background-safe")).toBeInTheDocument();
    advance(1);
    expect(visibleCopies()).toEqual([]);
  });

  it("keeps persistent messages dismissible and hides time decorations without a deadline", () => {
    const harness = mountToasts();
    act(() => {
      harness.api().toast({ description: "Needs manual dismissal", duration: null, closable: false, countdown: true, showSeconds: true });
    });
    const card = screen.getByRole("status");
    expect(card.querySelector(".ui-toast__countdown")).toBeNull();
    expect(card.querySelector(".ui-toast__seconds")).toBeNull();
    advance(60_000);
    fireEvent.click(within(card).getByRole("button", { name: /Needs manual dismissal/ }));
    expect(visibleCopies()).toEqual([]);
  });

  it("makes only overflowing long descriptions a named keyboard region without discarding content", () => {
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(40);
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockImplementation(function (this: HTMLElement) {
      return this.textContent?.includes("Long detail") ? 200 : 20;
    });
    const harness = mountToasts();
    const description = "Long detail: ".repeat(100);
    act(() => {
      harness.api().toast({ description, duration: 1000 });
      harness.api().toast({ description: "Short detail", duration: null });
    });
    const longCard = screen.getByText(description.trim()).closest(".ui-toast")!;
    const shortCard = screen.getByText("Short detail").closest(".ui-toast")!;
    const detail = within(longCard as HTMLElement).getByRole("region");
    expect(detail).toHaveAttribute("tabindex", "0");
    expect(detail).toHaveAccessibleName();
    expect(detail.textContent).toBe(description);
    expect(within(shortCard as HTMLElement).queryByRole("region")).toBeNull();
    fireEvent.focus(detail);
    advance(5000);
    expect(detail).toBeInTheDocument();
    fireEvent.blur(detail, { relatedTarget: screen.getByRole("button", { name: "Outside notification" }) });
    advance(1000);
    expect(detail).not.toBeInTheDocument();
  });

  it("retains a pending action, blocks rapid duplicate execution, and promotes its successor after success", async () => {
    const harness = mountToasts({ maxVisible: 1 });
    let finish!: () => void;
    const onClick = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    act(() => {
      harness.api().toast({
        description: "Undo removal",
        duration: 1000,
        closable: false,
        action: { label: "Undo", loadingLabel: "Undoing", onClick },
      });
      harness.api().toast({ description: "Next notification", duration: null });
    });
    advance(300);
    const action = screen.getByRole("button", { name: "Undo" });
    fireEvent.click(action);
    fireEvent.click(action);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(action).toHaveAttribute("aria-busy", "true");
    expect(action).toHaveAccessibleName("Undoing");
    advance(20_000);
    expect(screen.getByText("Undo removal")).toBeInTheDocument();
    expect(screen.queryByText("Next notification")).toBeNull();
    await act(async () => { finish(); await Promise.resolve(); });
    expect(visibleCopies()).toEqual(["Next notification"]);
  });

  it("retains an action failure through its asynchronous error handler, then resumes the remaining clock", async () => {
    const harness = mountToasts();
    let rejectAction!: (error: Error) => void;
    let finishHandler!: () => void;
    const failure = new Error("Server rejected undo");
    const onClick = vi.fn(() => new Promise<void>((_, reject) => { rejectAction = reject; }));
    const onError = vi.fn(() => new Promise<void>((resolve) => { finishHandler = resolve; }));
    act(() => {
      harness.api().toast({ description: "Retain on failure", duration: 1000, action: { label: "Retry action", onClick, onError } });
    });
    advance(300);
    const action = screen.getByRole("button", { name: "Retry action" });
    fireEvent.click(action);
    await act(async () => { rejectAction(failure); await Promise.resolve(); });
    expect(onError).toHaveBeenCalledWith(failure);
    advance(20_000);
    expect(screen.getByText("Retain on failure")).toBeInTheDocument();
    expect(action).toHaveAttribute("aria-busy", "true");
    await act(async () => { finishHandler(); await Promise.resolve(); });
    expect(action).not.toHaveAttribute("aria-busy", "true");
    advance(699);
    expect(screen.getByText("Retain on failure")).toBeInTheDocument();
    advance(1);
    expect(visibleCopies()).toEqual([]);
  });
});
