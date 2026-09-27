// @personal-ui-coverage {"kind":"unit","runner":"components","exports":["ConfirmDialog","ContextMenu","Dialog","Drawer","GuidedTour","Lightbox","Popconfirm"]}
import { createElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  ConfirmDialog,
  ContextMenu,
  Dialog,
  Drawer,
  GuidedTour,
  Lightbox,
  Popconfirm,
  type ConfirmDialogProps,
  type ContextMenuProps,
  type DialogProps,
  type DrawerProps,
  type GuidedTourProps,
  type LightboxProps,
  type PopconfirmProps,
} from "../../src/personal-ui";

const menuItems = [{ id: "edit", label: "Edit", onSelect: () => undefined }];
const lightboxItems = [
  { id: "first", src: "/first.png", alt: "First" },
  { id: "second", src: "/second.png", alt: "Second" },
];
const tourSteps = [
  { id: "intro", title: "Intro", description: "Welcome" },
  { id: "finish", title: "Finish", description: "Done" },
];

function forcedEscapeProps() {
  return {
    className: "foreign-overlay",
    style: { color: "red", background: "magenta" },
    css: "foreign-css",
    sx: "foreign-sx",
    tw: "foreign-tw",
    dangerouslySetInnerHTML: { __html: "<b>unsafe overlay</b>" },
    "data-pui-owner": "Consumer",
    "data-pui-slot": "foreign",
    "data-pui-private": "foreign",
  };
}

function expectEscapesRemoved(element: HTMLElement, owner: string) {
  expect(element).toHaveAttribute("data-pui-owner", owner);
  expect(element).not.toHaveClass("foreign-overlay");
  expect(element.style.color).not.toBe("red");
  expect(element.style.background).not.toBe("magenta");
  expect(element).not.toHaveAttribute("css");
  expect(element).not.toHaveAttribute("sx");
  expect(element).not.toHaveAttribute("tw");
  expect(element).not.toHaveAttribute("data-pui-slot");
  expect(element).not.toHaveAttribute("data-pui-private");
  expect(element).not.toHaveTextContent("unsafe overlay");
}

function expectDevelopmentError(run: () => void, message: RegExp) {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
  try {
    expect(run).toThrow(message);
  } finally {
    consoleError.mockRestore();
  }
}

describe("modal overlay public contracts", () => {
  it("filters forced runtime escape props from every fixed overlay", async () => {
    const user = userEvent.setup();
    const escaped = forcedEscapeProps();

    const dialog = render(createElement(Dialog, {
      ...escaped,
      open: true,
      onOpenChange: () => undefined,
      title: "Dialog",
      children: "Dialog content",
    } as unknown as DialogProps));
    expectEscapesRemoved(screen.getByRole("dialog", { name: "Dialog" }), "Dialog");
    dialog.unmount();

    const drawer = render(createElement(Drawer, {
      ...escaped,
      open: true,
      onOpenChange: () => undefined,
      title: "Drawer",
      children: "Drawer content",
    } as unknown as DrawerProps));
    expectEscapesRemoved(screen.getByRole("dialog", { name: "Drawer" }), "Drawer");
    drawer.unmount();

    const confirm = render(createElement(ConfirmDialog, {
      ...escaped,
      open: true,
      onOpenChange: () => undefined,
      title: "Confirm",
      onConfirm: () => undefined,
    } as unknown as ConfirmDialogProps));
    expectEscapesRemoved(document.querySelector<HTMLElement>("[data-pui-owner='ConfirmDialog']")!, "ConfirmDialog");
    confirm.unmount();

    const popconfirm = render(createElement(Popconfirm, {
      ...escaped,
      triggerLabel: "Delete",
      ariaLabel: "Delete record",
      title: "Delete?",
      onConfirm: () => undefined,
    } as unknown as PopconfirmProps));
    await user.click(screen.getByRole("button", { name: "Delete record" }));
    expectEscapesRemoved(document.querySelector<HTMLElement>("[data-pui-owner='Popconfirm']")!, "Popconfirm");
    popconfirm.unmount();

    const contextMenu = render(createElement(ContextMenu, {
      ...escaped,
      ariaLabel: "Record actions",
      items: menuItems,
      children: <span>Record</span>,
    } as unknown as ContextMenuProps));
    expectEscapesRemoved(document.querySelector<HTMLElement>("[data-pui-owner='ContextMenu']")!, "ContextMenu");
    contextMenu.unmount();

    const lightbox = render(createElement(Lightbox, {
      ...escaped,
      open: true,
      onOpenChange: () => undefined,
      items: lightboxItems,
      value: "first",
      onValueChange: () => undefined,
    } as unknown as LightboxProps));
    expectEscapesRemoved(screen.getByRole("dialog", { name: "图片预览" }), "Lightbox");
    lightbox.unmount();

    const tour = render(createElement(GuidedTour, {
      ...escaped,
      open: true,
      onOpenChange: () => undefined,
      steps: tourSteps,
      currentId: "intro",
      onCurrentChange: () => undefined,
    } as unknown as GuidedTourProps));
    expectEscapesRemoved(screen.getByRole("dialog", { name: "功能引导" }), "GuidedTour");
    tour.unmount();

    expect(document.querySelector("[data-pui-owner='Consumer']")).toBeNull();
  });

  it("reports controlled Dialog and Drawer dismiss actions through onOpenChange", async () => {
    const user = userEvent.setup();
    const onDialogOpenChange = vi.fn();
    const dialog = render(
      <Dialog open onOpenChange={onDialogOpenChange} title="Dialog">Content</Dialog>,
    );
    const dialogPanel = screen.getByRole("dialog", { name: "Dialog" });
    await user.click(screen.getByRole("button", { name: "关闭对话框" }));
    fireEvent.mouseDown(dialogPanel.parentElement!);
    await user.keyboard("{Escape}");
    expect(onDialogOpenChange.mock.calls.map(([open]) => open)).toEqual([false, false, false]);
    dialog.unmount();

    const onDrawerOpenChange = vi.fn();
    render(<Drawer open onOpenChange={onDrawerOpenChange} title="Drawer">Content</Drawer>);
    const drawerPanel = screen.getByRole("dialog", { name: "Drawer" });
    fireEvent.mouseDown(drawerPanel.parentElement!);
    await user.keyboard("{Escape}");
    expect(onDrawerOpenChange.mock.calls.map(([open]) => open)).toEqual([false, false]);
  });

  it("preserves ConfirmDialog, Popconfirm, ContextMenu, Lightbox, and GuidedTour dismiss behavior", async () => {
    const user = userEvent.setup();
    const onConfirmOpenChange = vi.fn();
    const confirm = render(
      <ConfirmDialog open onOpenChange={onConfirmOpenChange} title="Confirm" onConfirm={() => undefined} />,
    );
    await user.click(screen.getByRole("button", { name: "取消" }));
    expect(onConfirmOpenChange).toHaveBeenCalledWith(false);
    confirm.unmount();

    const popconfirm = render(
      <Popconfirm triggerLabel="Delete" ariaLabel="Delete record" title="Delete?" onConfirm={() => undefined} />,
    );
    await user.click(screen.getByRole("button", { name: "Delete record" }));
    expect(document.querySelector("[data-pui-owner='Popconfirm']")).not.toBeNull();
    expect(document.querySelector("button button")).toBeNull();
    await user.click(screen.getByRole("button", { name: "取消" }));
    expect(document.querySelector("[data-pui-owner='Popconfirm']")).toBeNull();
    popconfirm.unmount();

    const contextMenu = render(
      <ContextMenu ariaLabel="Record actions" items={menuItems}><span>Record</span></ContextMenu>,
    );
    fireEvent.contextMenu(document.querySelector("[data-pui-owner='ContextMenu']")!, { clientX: 20, clientY: 20 });
    expect(await screen.findByRole("menu", { name: "Record actions" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu", { name: "Record actions" })).not.toBeInTheDocument();
    contextMenu.unmount();

    const onLightboxOpenChange = vi.fn();
    const onValueChange = vi.fn();
    const lightbox = render(
      <Lightbox open onOpenChange={onLightboxOpenChange} items={lightboxItems} value="first" onValueChange={onValueChange} />,
    );
    await user.click(screen.getByRole("button", { name: "下一张" }));
    expect(onValueChange).toHaveBeenCalledWith("second");
    fireEvent.mouseDown(screen.getByRole("dialog", { name: "图片预览" }));
    expect(onLightboxOpenChange).toHaveBeenCalledWith(false);
    lightbox.unmount();

    const onTourOpenChange = vi.fn();
    const onCurrentChange = vi.fn();
    const tour = render(
      <GuidedTour open onOpenChange={onTourOpenChange} steps={tourSteps} currentId="intro" onCurrentChange={onCurrentChange} />,
    );
    await user.click(screen.getByRole("button", { name: "下一步" }));
    expect(onCurrentChange).toHaveBeenCalledWith("finish");
    tour.rerender(
      <GuidedTour open onOpenChange={onTourOpenChange} steps={tourSteps} currentId="finish" onCurrentChange={onCurrentChange} />,
    );
    await user.click(screen.getByRole("button", { name: "完成" }));
    expect(onTourOpenChange).toHaveBeenCalledWith(false);
  });

  it("operates Lightbox from the keyboard, announces position, and handles image failure", async () => {
    const onOpenChange = vi.fn();
    const onValueChange = vi.fn();
    const lightbox = render(
      <Lightbox
        open
        onOpenChange={onOpenChange}
        items={lightboxItems}
        value="first"
        onValueChange={onValueChange}
      />,
    );
    const dialog = screen.getByRole("dialog", { name: "图片预览" });
    expect(screen.getByText("1 / 2")).toHaveAttribute("aria-live", "polite");

    fireEvent.keyDown(dialog, { key: "ArrowRight" });
    expect(onValueChange).toHaveBeenLastCalledWith("second");
    lightbox.rerender(
      <Lightbox open onOpenChange={onOpenChange} items={lightboxItems} value="second" onValueChange={onValueChange} />,
    );
    expect(screen.getByText("2 / 2")).toBeInTheDocument();
    fireEvent.keyDown(dialog, { key: "ArrowLeft" });
    expect(onValueChange).toHaveBeenLastCalledWith("first");
    fireEvent.keyDown(dialog, { key: "Home" });
    expect(onValueChange).toHaveBeenLastCalledWith("first");
    lightbox.rerender(
      <Lightbox open onOpenChange={onOpenChange} items={lightboxItems} value="first" onValueChange={onValueChange} />,
    );
    fireEvent.keyDown(dialog, { key: "End" });
    expect(onValueChange).toHaveBeenLastCalledWith("second");
    lightbox.rerender(
      <Lightbox open onOpenChange={onOpenChange} items={lightboxItems} value="second" onValueChange={onValueChange} />,
    );

    fireEvent.error(screen.getByRole("img", { name: "Second" }));
    expect(screen.getByRole("status")).toHaveTextContent("无法加载图片：Second");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("positions GuidedTour by a CSS target and falls back when the target disappears", async () => {
    vi.spyOn(document.documentElement, "clientWidth", "get").mockReturnValue(1000);
    vi.spyOn(document.documentElement, "clientHeight", "get").mockReturnValue(700);
    let targetTop = 100;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function bounds() {
      if (this.id === "tour-target") return new DOMRect(120, targetTop, 180, 44);
      if (this.classList.contains("pui-tour__card")) return new DOMRect(0, 0, 380, 220);
      return new DOMRect(0, 0, 1, 1);
    });
    const target = document.createElement("button");
    target.id = "tour-target";
    target.textContent = "Target";
    document.body.append(target);
    const positionedSteps = [
      { id: "intro", title: "Intro", description: "Welcome", target: "#tour-target" },
    ];
    const onOpenChange = vi.fn();
    render(
      <GuidedTour
        open
        onOpenChange={onOpenChange}
        steps={positionedSteps}
        currentId="intro"
        onCurrentChange={() => undefined}
      />,
    );

    const card = document.querySelector<HTMLElement>(".pui-tour__card")!;
    await waitFor(() => expect(card).toHaveAttribute("data-placement", "bottom"));
    expect(document.querySelector(".pui-tour__spotlight")).not.toBeNull();
    const firstTop = card.style.top;
    targetTop = 180;
    fireEvent.scroll(window);
    await waitFor(() => expect(card.style.top).not.toBe(firstTop));

    target.remove();
    await waitFor(() => expect(card).not.toHaveAttribute("data-placement"));
    expect(document.querySelector(".pui-tour__scrim")).not.toBeNull();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("keeps GuidedTour open with a centered fallback for invalid or missing selectors", () => {
    const invalidSteps = [
      { id: "invalid", title: "Invalid", description: "Fallback", target: "[" },
      { id: "missing", title: "Missing", description: "Fallback", target: "#not-present" },
    ];
    const tour = render(
      <GuidedTour open onOpenChange={() => undefined} steps={invalidSteps} currentId="invalid" onCurrentChange={() => undefined} />,
    );
    expect(screen.getByRole("dialog", { name: "功能引导" })).toBeInTheDocument();
    expect(document.querySelector(".pui-tour__card")).not.toHaveAttribute("data-placement");
    expect(document.querySelector(".pui-tour__scrim")).not.toBeNull();
    tour.rerender(
      <GuidedTour open onOpenChange={() => undefined} steps={invalidSteps} currentId="missing" onCurrentChange={() => undefined} />,
    );
    expect(document.querySelector(".pui-tour__card")).not.toHaveAttribute("data-placement");
  });

  it("rejects invalid controlled-only JavaScript combinations before rendering", () => {
    expectDevelopmentError(
      () => render(createElement(Dialog, {
        onOpenChange: () => undefined,
        title: "Dialog",
        children: "Content",
      } as unknown as DialogProps)),
      /Dialog requires open; uncontrolled mode is not supported/,
    );
    expectDevelopmentError(
      () => render(createElement(Drawer, {
        open: true,
        title: "Drawer",
        children: "Content",
      } as unknown as DrawerProps)),
      /Drawer requires onOpenChange when open is controlled/,
    );
    expectDevelopmentError(
      () => render(createElement(ConfirmDialog, {
        open: true,
        defaultOpen: false,
        onOpenChange: () => undefined,
        title: "Confirm",
        onConfirm: () => undefined,
      } as unknown as ConfirmDialogProps)),
      /ConfirmDialog cannot receive both open and defaultOpen/,
    );
    expectDevelopmentError(
      () => render(createElement(Lightbox, {
        open: false,
        onOpenChange: () => undefined,
        items: lightboxItems,
        onValueChange: () => undefined,
      } as unknown as LightboxProps)),
      /Lightbox requires value; uncontrolled mode is not supported/,
    );
    expectDevelopmentError(
      () => render(createElement(GuidedTour, {
        open: false,
        onOpenChange: () => undefined,
        steps: tourSteps,
        currentId: "intro",
      } as unknown as GuidedTourProps)),
      /GuidedTour requires onCurrentChange when currentId is controlled/,
    );
    expectDevelopmentError(
      () => render(createElement(Popconfirm, {
        triggerLabel: <button type="button">Nested</button>,
        ariaLabel: "Delete record",
        title: "Delete?",
        onConfirm: () => undefined,
      } as unknown as PopconfirmProps)),
      /Popconfirm requires triggerLabel to be a non-empty string/,
    );
  });
});
