// @personal-ui-coverage {"kind":"unit","runner":"components","exports":["ConfirmDialog","Dialog","Drawer","GuidedTour","Lightbox","ToastProvider","useToast"]}
import { StrictMode, useState } from "react";
import { renderToString } from "react-dom/server";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button, ConfirmDialog, Dialog, Drawer, GuidedTour, Input, Lightbox, ToastProvider, useToast } from "../../src/personal-ui";

afterEach(() => {
  document.querySelectorAll("[data-layer-test-background]").forEach((element) => element.remove());
});

describe("modal layer kernel contracts", () => {
  it("keeps the background inert and body locked until the final nested modal closes", async () => {
    const user = userEvent.setup();
    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;
    const preservedInert = document.createElement("aside");
    const ordinaryBackground = document.createElement("aside");
    preservedInert.dataset.layerTestBackground = "true";
    ordinaryBackground.dataset.layerTestBackground = "true";
    preservedInert.setAttribute("inert", "");
    document.body.append(preservedInert, ordinaryBackground);

    function Harness() {
      const [dialogOpen, setDialogOpen] = useState(true);
      const [confirmOpen, setConfirmOpen] = useState(false);
      return (
        <>
          <Dialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            title="编辑账户"
            footer={<Button onClick={() => setDialogOpen(false)}>完成编辑</Button>}
          >
            <Input aria-label="账户名称" />
            <Button onClick={() => setConfirmOpen(true)}>打开确认</Button>
            <ConfirmDialog
              open={confirmOpen}
              onOpenChange={setConfirmOpen}
              title="确认保存"
              onConfirm={() => setConfirmOpen(false)}
            />
          </Dialog>
        </>
      );
    }

    const view = render(<StrictMode><Harness /></StrictMode>);
    expect(ordinaryBackground).toHaveAttribute("inert");
    expect(preservedInert).toHaveAttribute("inert");
    expect(document.body.style.overflow).toBe("hidden");

    await user.click(screen.getByRole("button", { name: "打开确认" }));
    const parent = screen.getByText("编辑账户").closest<HTMLElement>("[role='dialog']")!;
    const child = screen.getByRole("dialog", { name: "确认保存" });
    expect(parent).toHaveAttribute("inert");
    expect(parent).toHaveAttribute("aria-hidden", "true");
    expect(child).not.toHaveAttribute("inert");

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "确认保存" })).not.toBeInTheDocument());
    expect(screen.getByRole("dialog", { name: "编辑账户" })).not.toHaveAttribute("inert");
    expect(document.body.style.overflow).toBe("hidden");

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "编辑账户" })).not.toBeInTheDocument());
    expect(ordinaryBackground).not.toHaveAttribute("inert");
    expect(preservedInert).toHaveAttribute("inert");
    expect(document.body.style.overflow).toBe(originalOverflow);
    expect(document.body.style.paddingRight).toBe(originalPaddingRight);

    view.unmount();
    preservedInert.remove();
    ordinaryBackground.remove();
  });

  it("traps focus in the top modal and keeps a rejected controlled dismissal active", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const background = document.createElement("button");
    background.textContent = "页面操作";
    background.dataset.layerTestBackground = "true";
    document.body.append(background);

    const view = render(
      <Dialog
        open
        onOpenChange={onOpenChange}
        closeOnBackdropClick={false}
        title="受控弹窗"
        footer={<><Button>取消</Button><Button variant="primary">保存</Button></>}
      >
        <Input aria-label="名称" />
      </Dialog>,
    );

    const dialog = screen.getByRole("dialog", { name: "受控弹窗" });
    const cancel = within(dialog).getByRole("button", { name: "取消" });
    const save = within(dialog).getByRole("button", { name: "保存" });
    const close = within(dialog).getByRole("button", { name: "关闭对话框" });
    expect(cancel).toHaveFocus();
    save.focus();
    fireEvent.keyDown(save, { key: "Tab" });
    expect(close).toHaveFocus();
    fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
    expect(save).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    expect(dialog).toBeInTheDocument();
    expect(background).toHaveAttribute("inert");

    view.rerender(
      <Dialog open={false} onOpenChange={onOpenChange} closeOnBackdropClick={false} title="受控弹窗">
        <Input aria-label="名称" />
      </Dialog>,
    );
    await waitFor(() => expect(background).not.toHaveAttribute("inert"));
    background.remove();
  });

  it("restores focus when an opener survives and falls back when it is removed", async () => {
    const user = userEvent.setup();

    function Harness() {
      const [dialogOpen, setDialogOpen] = useState(false);
      const [drawerOpen, setDrawerOpen] = useState(false);
      const [showDialogOpener, setShowDialogOpener] = useState(true);
      return (
        <>
          {showDialogOpener ? <Button onClick={() => setDialogOpen(true)}>打开弹窗</Button> : null}
          <Button onClick={() => setDrawerOpen(true)}>打开抽屉</Button>
          <Button>焦点回退</Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen} title="临时弹窗">
            <Button onClick={() => setShowDialogOpener(false)}>移除触发器</Button>
          </Dialog>
          <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} title="设置抽屉">
            <Input aria-label="抽屉字段" />
          </Drawer>
        </>
      );
    }

    render(<Harness />);
    const drawerOpener = screen.getByRole("button", { name: "打开抽屉" });
    await user.click(drawerOpener);
    await user.keyboard("{Escape}");
    await waitFor(() => expect(drawerOpener).toHaveFocus());

    await user.click(screen.getByRole("button", { name: "打开弹窗" }));
    await user.click(screen.getByRole("button", { name: "移除触发器" }));
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "临时弹窗" })).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole("button", { name: "打开抽屉" })).toHaveFocus());
  });

  it("captures a pointer opener before its mousedown handler opens the modal", async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <Button>先前焦点</Button>
          <Button onMouseDown={() => setOpen(true)}>按下打开</Button>
          <Dialog open={open} onOpenChange={setOpen} title="按下打开的弹窗">
            <Input aria-label="弹窗字段" />
          </Dialog>
        </>
      );
    }

    render(<Harness />);
    const previous = screen.getByRole("button", { name: "先前焦点" });
    const opener = screen.getByRole("button", { name: "按下打开" });
    previous.focus();

    fireEvent.pointerDown(opener);
    fireEvent.mouseDown(opener);
    expect(screen.getByRole("dialog", { name: "按下打开的弹窗" })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "按下打开的弹窗" })).not.toBeInTheDocument());
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it("keeps a registered toast portal interactive without releasing the modal background", async () => {
    const user = userEvent.setup();

    function Harness() {
      const [open, setOpen] = useState(true);
      const { toast } = useToast();
      return (
        <Dialog open={open} onOpenChange={setOpen} title="通知弹窗">
          <Button onClick={() => toast({ description: "保存完成", duration: null })}>显示通知</Button>
        </Dialog>
      );
    }

    render(<ToastProvider><Harness /></ToastProvider>);
    await user.click(screen.getByRole("button", { name: "显示通知" }));
    const toastPortal = document.querySelector<HTMLElement>("[data-pui-toast-portal-root='true']")!;
    expect(toastPortal).not.toHaveAttribute("inert");
    expect(screen.getByRole("status")).toHaveTextContent("保存完成");

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "通知弹窗" })).not.toBeInTheDocument());
    expect(toastPortal).not.toHaveAttribute("inert");
  });

  it("renders modal components through the server path without touching a client portal", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      expect(() => renderToString(
        <Dialog open onOpenChange={() => undefined} title="服务端弹窗">内容</Dialog>,
      )).not.toThrow();
      expect(() => renderToString(
        <Drawer open onOpenChange={() => undefined} title="服务端抽屉">内容</Drawer>,
      )).not.toThrow();
      expect(() => renderToString(
        <Lightbox
          open
          onOpenChange={() => undefined}
          items={[{ id: "hero", src: "hero.png", alt: "Hero" }]}
          value="hero"
          onValueChange={() => undefined}
        />,
      )).not.toThrow();
      expect(() => renderToString(
        <GuidedTour
          open
          onOpenChange={() => undefined}
          steps={[{ id: "intro", title: "Intro", description: "Details", target: "#target" }]}
          currentId="intro"
          onCurrentChange={() => undefined}
        />,
      )).not.toThrow();
    } finally {
      consoleError.mockRestore();
    }
  });
});
