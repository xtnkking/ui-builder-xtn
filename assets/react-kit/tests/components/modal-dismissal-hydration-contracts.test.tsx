// @personal-ui-coverage {"kind":"unit","runner":"components","exports":["ConfirmDialog","Dialog","Drawer"]}
import { useState, type ReactElement, type ReactNode } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button, ConfirmDialog, Dialog, Drawer } from "../../src/personal-ui";

interface BackdropPolicyCase {
  name: string;
  title: string;
  closeLabel: string;
  renderOverlay: (props: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    closeOnBackdropClick: boolean;
  }) => ReactNode;
}

const backdropPolicyCases: BackdropPolicyCase[] = [
  {
    name: "Dialog",
    title: "编辑资料",
    closeLabel: "关闭对话框",
    renderOverlay: (props) => <Dialog {...props} title="编辑资料">表单内容</Dialog>,
  },
  {
    name: "Drawer",
    title: "编辑设置",
    closeLabel: "关闭抽屉",
    renderOverlay: (props) => <Drawer {...props} title="编辑设置">表单内容</Drawer>,
  },
  {
    name: "ConfirmDialog",
    title: "确认操作",
    closeLabel: "关闭对话框",
    renderOverlay: (props) => (
      <ConfirmDialog {...props} title="确认操作" onConfirm={() => undefined} />
    ),
  },
];

interface NonDismissibleCase {
  name: string;
  title: string;
  closeLabel: string;
  renderOverlay: (props: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onBusinessClose: () => void;
  }) => ReactNode;
}

const nonDismissibleCases: NonDismissibleCase[] = [
  {
    name: "Dialog",
    title: "不可关闭对话框",
    closeLabel: "关闭对话框",
    renderOverlay: ({ open, onOpenChange, onBusinessClose }) => (
      <Dialog open={open} onOpenChange={onOpenChange} closable={false} title="不可关闭对话框">
        <Button onClick={onBusinessClose}>完成流程</Button>
      </Dialog>
    ),
  },
  {
    name: "Drawer",
    title: "不可关闭抽屉",
    closeLabel: "关闭抽屉",
    renderOverlay: ({ open, onOpenChange, onBusinessClose }) => (
      <Drawer open={open} onOpenChange={onOpenChange} closable={false} title="不可关闭抽屉">
        <Button onClick={onBusinessClose}>完成流程</Button>
      </Drawer>
    ),
  },
];

interface HydrationCase {
  name: string;
  title: string;
  renderOverlay: () => ReactElement;
  expectedFocus: (panel: HTMLElement) => HTMLElement;
}

const ignoreOpenChange = () => undefined;

const hydrationCases: HydrationCase[] = [
  {
    name: "Dialog",
    title: "服务端对话框",
    renderOverlay: () => (
      <Dialog open onOpenChange={ignoreOpenChange} title="服务端对话框">服务端内容</Dialog>
    ),
    expectedFocus: (panel) => panel,
  },
  {
    name: "Drawer",
    title: "服务端抽屉",
    renderOverlay: () => (
      <Drawer open onOpenChange={ignoreOpenChange} title="服务端抽屉">服务端内容</Drawer>
    ),
    expectedFocus: (panel) => panel,
  },
  {
    name: "ConfirmDialog",
    title: "服务端确认",
    renderOverlay: () => (
      <ConfirmDialog open onOpenChange={ignoreOpenChange} title="服务端确认" onConfirm={() => undefined} />
    ),
    expectedFocus: (panel) => within(panel).getByRole("button", { name: "取消" }),
  },
];

function backdropFor(title: string): HTMLElement {
  const panel = screen.getByRole("dialog", { name: title });
  const backdrop = panel.parentElement;
  if (!backdrop) throw new Error(`Missing backdrop for ${title}`);
  return backdrop;
}

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe.each(backdropPolicyCases)("$name dismissal policy", ({ title, closeLabel, renderOverlay }) => {
  it("keeps backdrop, close control, and Escape independent across reopen cycles", async () => {
    const user = userEvent.setup();
    const closeRequests = vi.fn<(open: boolean) => void>();

    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <Button onClick={() => setOpen(true)}>打开{title}</Button>
          {renderOverlay({
            open,
            closeOnBackdropClick: false,
            onOpenChange: (nextOpen) => {
              closeRequests(nextOpen);
              setOpen(nextOpen);
            },
          })}
        </>
      );
    }

    render(<Harness />);
    const opener = screen.getByRole("button", { name: `打开${title}` });

    await user.click(opener);
    fireEvent.mouseDown(backdropFor(title));
    expect(screen.getByRole("dialog", { name: title })).toBeInTheDocument();
    expect(closeRequests).not.toHaveBeenCalled();

    await user.click(within(screen.getByRole("dialog", { name: title })).getByRole("button", { name: closeLabel }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: title })).not.toBeInTheDocument());
    expect(closeRequests).toHaveBeenCalledTimes(1);
    expect(closeRequests).toHaveBeenLastCalledWith(false);

    await user.click(opener);
    fireEvent.mouseDown(backdropFor(title));
    expect(screen.getByRole("dialog", { name: title })).toBeInTheDocument();
    expect(closeRequests).toHaveBeenCalledTimes(1);

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: title })).not.toBeInTheDocument());
    expect(closeRequests).toHaveBeenCalledTimes(2);
    expect(closeRequests).toHaveBeenLastCalledWith(false);

    await user.click(opener);
    fireEvent.mouseDown(backdropFor(title));
    expect(screen.getByRole("dialog", { name: title })).toBeInTheDocument();
    expect(closeRequests).toHaveBeenCalledTimes(2);
  });
});

describe.each(nonDismissibleCases)("$name closable=false", ({ title, closeLabel, renderOverlay }) => {
  it("remains fully non-dismissible after a business-controlled close and reopen", async () => {
    const user = userEvent.setup();
    const dismissRequests = vi.fn<(open: boolean) => void>();

    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <Button onClick={() => setOpen(true)}>打开{title}</Button>
          {renderOverlay({
            open,
            onOpenChange: dismissRequests,
            onBusinessClose: () => setOpen(false),
          })}
        </>
      );
    }

    render(<Harness />);
    const opener = screen.getByRole("button", { name: `打开${title}` });

    await user.click(opener);
    let panel = screen.getByRole("dialog", { name: title });
    expect(within(panel).queryByRole("button", { name: closeLabel })).not.toBeInTheDocument();
    fireEvent.mouseDown(backdropFor(title));
    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog", { name: title })).toBeInTheDocument();
    expect(dismissRequests).not.toHaveBeenCalled();

    await user.click(within(panel).getByRole("button", { name: "完成流程" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: title })).not.toBeInTheDocument());

    await user.click(opener);
    panel = screen.getByRole("dialog", { name: title });
    expect(within(panel).queryByRole("button", { name: closeLabel })).not.toBeInTheDocument();
    fireEvent.mouseDown(backdropFor(title));
    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog", { name: title })).toBeInTheDocument();
    expect(dismissRequests).not.toHaveBeenCalled();
  });
});

describe("ConfirmDialog pending dismissal policy", () => {
  it("blocks every dismissal while pending and restores the ordinary policy after reopening", async () => {
    const user = userEvent.setup();
    const completion = createDeferred();
    const closeRequests = vi.fn<(open: boolean) => void>();

    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <Button onClick={() => setOpen(true)}>打开异步确认</Button>
          <ConfirmDialog
            open={open}
            onOpenChange={(nextOpen) => {
              closeRequests(nextOpen);
              setOpen(nextOpen);
            }}
            title="异步确认"
            onConfirm={() => completion.promise}
          />
        </>
      );
    }

    render(<Harness />);
    const opener = screen.getByRole("button", { name: "打开异步确认" });
    await user.click(opener);
    await user.click(screen.getByRole("button", { name: "确认" }));

    const pendingPanel = screen.getByRole("dialog", { name: "异步确认" });
    expect(within(pendingPanel).getByRole("button", { name: "处理中" })).toHaveAttribute("aria-disabled", "true");
    expect(within(pendingPanel).queryByRole("button", { name: "关闭对话框" })).not.toBeInTheDocument();
    fireEvent.mouseDown(backdropFor("异步确认"));
    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog", { name: "异步确认" })).toBeInTheDocument();
    expect(closeRequests).not.toHaveBeenCalled();

    await act(async () => {
      completion.resolve();
      await completion.promise;
    });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "异步确认" })).not.toBeInTheDocument());
    expect(closeRequests).toHaveBeenCalledTimes(1);

    await user.click(opener);
    expect(within(screen.getByRole("dialog", { name: "异步确认" })).getByRole("button", { name: "关闭对话框" })).toBeInTheDocument();
    fireEvent.mouseDown(backdropFor("异步确认"));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "异步确认" })).not.toBeInTheDocument());
    expect(closeRequests).toHaveBeenCalledTimes(2);
  });
});

describe.each(hydrationCases)("$name SSR hydration", ({ title, renderOverlay, expectedFocus }) => {
  it("hydrates into a registered portal without a mismatch and restores document state", async () => {
    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;
    const background = document.createElement("main");
    const host = document.createElement("div");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const app = renderOverlay();
    const focusHistory: HTMLElement[] = [];
    const recoverableErrors: unknown[] = [];
    const captureFocus = (event: FocusEvent) => {
      if (event.target instanceof HTMLElement) focusHistory.push(event.target);
    };
    let root: ReturnType<typeof hydrateRoot> | undefined;

    background.dataset.hydrationBackground = "true";
    host.dataset.hydrationHost = "true";
    host.innerHTML = renderToString(app);
    document.body.append(background, host);
    document.addEventListener("focusin", captureFocus);

    try {
      await act(async () => {
        root = hydrateRoot(host, app, {
          onRecoverableError: (error) => recoverableErrors.push(error),
        });
      });

      const panel = await screen.findByRole("dialog", { name: title });
      await waitFor(() => expect(background).toHaveAttribute("inert"));
      await waitFor(() => expect(focusHistory.find((element) => panel.contains(element))).toBe(expectedFocus(panel)));
      expect(host.querySelector("[data-pui-portal-source]")).not.toBeNull();
      expect(host.contains(panel)).toBe(false);
      expect(panel.parentElement).toHaveClass("pui-overlay");
      expect(document.body.style.overflow).toBe("hidden");

      const hydrationErrors = consoleError.mock.calls
        .map((args) => args.map(String).join(" "))
        .filter((message) => /hydration|did not match|server html|hydration failed/i.test(message));
      expect(hydrationErrors).toEqual([]);
      expect(recoverableErrors).toEqual([]);

      await act(async () => {
        root?.unmount();
      });
      root = undefined;
      await waitFor(() => expect(background).not.toHaveAttribute("inert"));
      expect(host).not.toHaveAttribute("inert");
      expect(document.body.style.overflow).toBe(originalOverflow);
      expect(document.body.style.paddingRight).toBe(originalPaddingRight);
    } finally {
      if (root) {
        await act(async () => {
          root?.unmount();
        });
      }
      background.remove();
      host.remove();
      document.removeEventListener("focusin", captureFocus);
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
      consoleError.mockRestore();
    }
  });
});
