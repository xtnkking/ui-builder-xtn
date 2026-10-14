// @ui-coverage {"kind":"unit","runner":"components","exports":["Dialog","Drawer","ToastProvider","useToast"]}
import { useState, type Dispatch, type SetStateAction } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Button, Dialog, Drawer, ToastProvider, useToast, type ToastApi } from "../../src/ui";

let timingStyles: HTMLStyleElement;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => window.setTimeout(() => callback(performance.now()), 16));
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => window.clearTimeout(id));
  // jsdom does not import the production stylesheet. Explicit times exercise the real presence path.
  timingStyles = document.createElement("style");
  timingStyles.textContent = `
    .ui-overlay, .ui-lightbox, .ui-tour, .ui-toast {
      --ui-motion-enter: 180ms;
      --ui-motion-exit: 140ms;
    }
  `;
  document.head.append(timingStyles);
});

afterEach(() => {
  cleanup();
  timingStyles.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function advance(milliseconds: number) {
  act(() => vi.advanceTimersByTime(milliseconds));
}

function mountToasts(maxVisible = 2) {
  let current: ToastApi;
  function Probe() {
    current = useToast();
    return <button type="button">通知外部操作</button>;
  }
  const view = render(<ToastProvider maxVisible={maxVisible} maxQueue={8}><Probe /></ToastProvider>);
  return { ...view, api: () => current! };
}

function toastCard(copy: string) {
  const card = screen.getByText(copy).closest<HTMLElement>(".ui-toast");
  if (!card) throw new Error(`Missing Toast card: ${copy}`);
  return card;
}

describe("modal motion ownership", () => {
  it.each(["Dialog", "Drawer"] as const)("%s retains focus ownership/scroll lock and suppresses repeated dismissal during an interrupted exit", (kind) => {
    const dismissed = vi.fn();
    const businessAction = vi.fn();
    let changeOpen: Dispatch<SetStateAction<boolean>>;
    function Harness() {
      const [open, setOpen] = useState(false);
      changeOpen = setOpen;
      const onOpenChange = (next: boolean) => { dismissed(next); setOpen(next); };
      const content = <Button onClick={businessAction}>业务操作</Button>;
      return <>
        <button type="button" onClick={() => setOpen(true)}>打开浮层</button>
        {kind === "Dialog"
          ? <Dialog open={open} onOpenChange={onOpenChange} title="生命周期浮层">{content}</Dialog>
          : <Drawer open={open} onOpenChange={onOpenChange} title="生命周期浮层">{content}</Drawer>}
      </>;
    }
    const originalOverflow = document.body.style.overflow;
    const view = render(<Harness />);
    const opener = screen.getByRole("button", { name: "打开浮层" });
    opener.focus();
    fireEvent.click(opener);
    const panel = screen.getByRole("dialog", { name: "生命周期浮层" });
    const backdrop = panel.parentElement!;
    expect(panel).toHaveFocus();
    expect(view.container).toHaveAttribute("inert");
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.keyDown(panel, { key: "Escape" });
    expect(dismissed).toHaveBeenCalledTimes(1);
    expect(backdrop).toHaveAttribute("data-ui-motion", "exiting");
    expect(panel).toHaveFocus();
    expect(view.container).toHaveAttribute("inert");
    fireEvent.keyDown(panel, { key: "Escape" });
    fireEvent.mouseDown(backdrop);
    fireEvent.click(within(panel).getByRole("button", { name: "业务操作" }));
    expect(dismissed).toHaveBeenCalledTimes(1);
    expect(businessAction).not.toHaveBeenCalled();

    advance(100);
    act(() => changeOpen(true));
    expect(screen.getByRole("dialog", { name: "生命周期浮层" })).toBe(panel);
    expect(document.body.style.overflow).toBe("hidden");
    advance(230);
    expect(backdrop).toHaveAttribute("data-ui-motion", "open");
    expect(panel).toHaveFocus();
    expect(dismissed).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(panel, { key: "Escape" });
    advance(189);
    expect(screen.getByRole("dialog", { name: "生命周期浮层" })).toBe(panel);
    advance(1);
    expect(screen.queryByRole("dialog", { name: "生命周期浮层" })).toBeNull();
    expect(document.body.style.overflow).toBe(originalOverflow);
    expect(view.container).not.toHaveAttribute("inert");
    advance(16);
    expect(opener).toHaveFocus();
  });

  it("consumes a second Escape in the exiting child instead of dismissing its parent", () => {
    const outerDismiss = vi.fn();
    const childDismiss = vi.fn();
    function Harness() {
      const [outer, setOuter] = useState(false);
      const [child, setChild] = useState(false);
      return <>
        <button type="button" onClick={() => setOuter(true)}>打开父层</button>
        <Dialog open={outer} onOpenChange={(next) => { outerDismiss(next); setOuter(next); }} title="父层">
          <Button onClick={() => setChild(true)}>打开子层</Button>
          <Dialog open={child} onOpenChange={(next) => { childDismiss(next); setChild(next); }} title="子层">子层内容</Dialog>
        </Dialog>
      </>;
    }
    const originalOverflow = document.body.style.overflow;
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "打开父层" }));
    const childOpener = screen.getByRole("button", { name: "打开子层" });
    childOpener.focus();
    fireEvent.click(childOpener);
    const child = screen.getByRole("dialog", { name: "子层" });
    fireEvent.keyDown(child, { key: "Escape" });
    fireEvent.keyDown(document, { key: "Escape" });
    expect(childDismiss).toHaveBeenCalledTimes(1);
    expect(outerDismiss).not.toHaveBeenCalled();
    advance(190);
    advance(16);
    expect(screen.queryByRole("dialog", { name: "子层" })).toBeNull();
    const parent = screen.getByRole("dialog", { name: "父层" });
    expect(document.body.style.overflow).toBe("hidden");
    expect(childOpener).toHaveFocus();
    fireEvent.keyDown(parent, { key: "Escape" });
    advance(190);
    advance(16);
    expect(screen.queryByRole("dialog", { name: "父层" })).toBeNull();
    expect(document.body.style.overflow).toBe(originalOverflow);
  });

  it("keeps a controlled modal open when the consumer rejects its close request", () => {
    const request = vi.fn();
    const { unmount } = render(<Dialog open onOpenChange={request} title="拒绝关闭">内容</Dialog>);
    const panel = screen.getByRole("dialog", { name: "拒绝关闭" });
    fireEvent.keyDown(panel, { key: "Escape" });
    advance(500);
    expect(request).toHaveBeenCalledExactlyOnceWith(false);
    expect(screen.getByRole("dialog", { name: "拒绝关闭" })).toBe(panel);
    expect(panel.parentElement).toHaveAttribute("data-ui-motion", "open");
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
  });
});

describe("Toast exit admission", () => {
  it("retains exiting capacity and dedupe keys, promotes FIFO, and keeps surviving DOM identities", () => {
    const harness = mountToasts();
    const ids: string[] = [];
    act(() => {
      ids.push(harness.api().toast({ description: "通知一", duration: null, dedupeKey: "first" }));
      ids.push(harness.api().toast({ description: "通知二", duration: null }));
      ids.push(harness.api().toast({ description: "通知三", duration: null }));
      ids.push(harness.api().toast({ description: "通知四", duration: null }));
    });
    const first = toastCard("通知一");
    const second = toastCard("通知二");
    let duplicate = "";
    act(() => {
      harness.api().dismiss(ids[0]);
      harness.api().dismiss(ids[0]);
      duplicate = harness.api().toast({ description: "重复内容", duration: null, dedupeKey: "first" });
    });
    expect(duplicate).toBe(ids[0]);
    expect(first).toHaveAttribute("data-ui-motion", "exiting");
    expect(screen.queryByText("通知三")).toBeNull();
    expect(screen.queryByText("重复内容")).toBeNull();
    advance(189);
    expect(first).toBeInTheDocument();
    advance(1);
    expect(first).not.toBeInTheDocument();
    expect(toastCard("通知二")).toBe(second);
    const third = toastCard("通知三");
    expect(screen.queryByText("通知四")).toBeNull();
    act(() => harness.api().dismiss(ids[1]));
    advance(190);
    expect(toastCard("通知三")).toBe(third);
    expect(toastCard("通知四")).toBeInTheDocument();
    expect(screen.getAllByRole("status")).toHaveLength(2);
  });

  it("clears the waiting queue before displayed exits finish and does not promote cleared messages", () => {
    const harness = mountToasts(1);
    act(() => {
      harness.api().toast({ description: "清空前显示", duration: 1000, dedupeKey: "clear" });
      harness.api().toast({ description: "清空前等待", duration: 1000 });
    });
    act(() => harness.api().dismissAll());
    expect(toastCard("清空前显示")).toHaveAttribute("data-ui-motion", "exiting");
    expect(screen.queryByText("清空前等待")).toBeNull();
    advance(190);
    expect(screen.queryAllByRole("status")).toHaveLength(0);
    advance(5000);
    expect(screen.queryAllByRole("status")).toHaveLength(0);
    act(() => harness.api().toast({ description: "清空后新通知", duration: null, dedupeKey: "clear" }));
    expect(toastCard("清空后新通知")).toBeInTheDocument();
  });

  it("removes never-displayed records dismissed in their admission batch", () => {
    const harness = mountToasts(1);
    let original = "";
    act(() => {
      original = harness.api().toast({ description: "未显示即关闭", duration: null, dedupeKey: "immediate" });
      harness.api().dismiss(original);
      harness.api().toast({ description: "未显示即清空", duration: null });
      harness.api().dismissAll();
    });
    expect(screen.queryAllByRole("status")).toHaveLength(0);
    let replacement = "";
    act(() => { replacement = harness.api().toast({ description: "重新入队", duration: null, dedupeKey: "immediate" }); });
    expect(replacement).not.toBe(original);
    expect(toastCard("重新入队")).toBeInTheDocument();
    advance(1000);
    expect(screen.queryByText("未显示即关闭")).toBeNull();
    expect(screen.queryByText("未显示即清空")).toBeNull();
  });

  it("counts entrance in visible duration and starts a queued timer only after its slot is released", () => {
    const harness = mountToasts(1);
    act(() => {
      harness.api().toast({ description: "定时首条", duration: 500 });
      harness.api().toast({ description: "定时等待", duration: 500 });
    });
    advance(499);
    expect(toastCard("定时首条")).toHaveAttribute("data-ui-motion", "open");
    advance(1);
    expect(toastCard("定时首条")).toHaveAttribute("data-ui-motion", "exiting");
    expect(screen.queryByText("定时等待")).toBeNull();
    advance(190);
    expect(screen.queryByText("定时首条")).toBeNull();
    expect(toastCard("定时等待")).toHaveAttribute("data-ui-motion", "entering");
    advance(499);
    expect(toastCard("定时等待")).toHaveAttribute("data-ui-motion", "open");
    advance(1);
    expect(toastCard("定时等待")).toHaveAttribute("data-ui-motion", "exiting");
    advance(190);
    expect(screen.queryAllByRole("status")).toHaveLength(0);
  });
});
