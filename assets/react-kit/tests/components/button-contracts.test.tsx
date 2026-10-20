// @ui-coverage {"kind":"unit","runner":"components","exports":["AsyncAction","Button","DropdownMenu","IconButton","Lightbox","RetryButton","SplitButton","ToggleButton"]}
import { createElement, createRef } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  AsyncAction,
  Button,
  DropdownMenu,
  IconButton,
  Lightbox,
  RetryButton,
  SplitButton,
  ToggleButton,
  type ButtonProps,
  type ControlHandle,
  type IconButtonProps,
} from "../../src/ui";

function escapedButtonProps(testId: string) {
  return {
    className: "foreign-button",
    style: { color: "red", background: "magenta" },
    css: "foreign-css",
    sx: "foreign-sx",
    tw: "foreign-tw",
    dangerouslySetInnerHTML: { __html: "<b>unsafe</b>" },
    "data-ui-owner": "Consumer",
    "data-ui-slot": "foreign",
    "data-testid": testId,
    "data-track": "preserved",
    "data-pending": "queued",
  };
}

function expectButtonEscapesRemoved(button: HTMLButtonElement, owner: string) {
  expect(button).not.toHaveClass("foreign-button");
  expect(button).not.toHaveAttribute("style");
  expect(button).not.toHaveAttribute("css");
  expect(button).not.toHaveAttribute("sx");
  expect(button).not.toHaveAttribute("tw");
  expect(button).not.toHaveAttribute("data-ui-slot");
  expect(button).toHaveAttribute("data-ui-owner", owner);
  expect(button).toHaveAttribute("data-track", "preserved");
  expect(button).toHaveAttribute("data-pending", "queued");
}

describe("button public and private composition contracts", () => {
  it("filters Button escape props at runtime while preserving form, ARIA, data, and event props", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const rawProps = {
      ...escapedButtonProps("save-button"),
      form: "profile-form",
      name: "intent",
      value: "save",
      "aria-label": "Save profile",
      onClick,
    };
    const originalProps = { ...rawProps };

    render(createElement(Button, rawProps as unknown as ButtonProps, "Save"));

    const button = screen.getByTestId("save-button") as HTMLButtonElement;
    expect(button).toHaveClass("ui-button", "ui-button--secondary", "ui-button--medium");
    expect(button).toHaveAttribute("form", "profile-form");
    expect(button).toHaveAttribute("name", "intent");
    expect(button).toHaveValue("save");
    expect(button).toHaveAccessibleName("Save profile");
    expect(button).toHaveTextContent("Save");
    expect(button).not.toHaveTextContent("unsafe");
    expectButtonEscapesRemoved(button, "Button");

    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(rawProps).toEqual(originalProps);
  });

  it("filters IconButton escape props and keeps loading interaction inert", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const rawProps = {
      ...escapedButtonProps("refresh-button"),
      "aria-label": "Refresh data",
      icon: <span>R</span>,
      loading: true,
      onClick,
    };
    const originalProps = { ...rawProps };

    render(createElement(IconButton, rawProps as unknown as IconButtonProps));

    const button = screen.getByTestId("refresh-button") as HTMLButtonElement;
    expect(button).toHaveClass("ui-icon-button", "ui-icon-button--ghost");
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveAttribute("aria-disabled", "true");
    expectButtonEscapesRemoved(button, "IconButton");

    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
    expect(rawProps).toEqual(originalProps);
  });

  it("exposes only the limited focus handle and clears it on unmount", () => {
    const controlRef = createRef<ControlHandle>();
    const { unmount } = render(<Button controlRef={controlRef}>Focus target</Button>);
    const button = screen.getByRole("button", { name: "Focus target" });

    expect(controlRef.current).not.toBeNull();
    expect(Object.keys(controlRef.current ?? {})).toEqual(["focus"]);
    expect("style" in (controlRef.current ?? {})).toBe(false);
    controlRef.current?.focus();
    expect(button).toHaveFocus();

    unmount();
    expect(controlRef.current).toBeNull();
  });

  it("preserves the closed class and owner mappings for composite buttons", () => {
    render(
      <>
        <SplitButton menuItems={[]} menuAriaLabel="More actions">Run report</SplitButton>
        <ToggleButton pressed={false} onPressedChange={() => undefined}>Pin item</ToggleButton>
        <RetryButton onRetry={() => undefined} />
        <AsyncAction onAction={() => undefined}>Save async</AsyncAction>
      </>,
    );

    expect(screen.getByRole("button", { name: "Run report" })).toHaveClass("ui-split-button__primary");
    expect(screen.getByRole("button", { name: "Run report" })).toHaveAttribute("data-ui-owner", "Button");
    expect(screen.getByRole("button", { name: "Pin item" })).toHaveClass("ui-toggle-button");
    expect(screen.getByRole("button", { name: "Pin item" })).toHaveAttribute("data-ui-owner", "ToggleButton");
    expect(screen.getByRole("button", { name: "重试" })).toHaveAttribute("data-ui-owner", "RetryButton");
    expect(screen.getByRole("button", { name: "Save async" })).toHaveAttribute("data-ui-owner", "AsyncAction");
  });

  it("keeps DropdownMenu's private element ref for keyboard opening and focus restoration", async () => {
    render(
      <DropdownMenu
        label="Actions"
        ariaLabel="Account actions"
        items={[
          { id: "view", label: "View", onSelect: () => undefined },
          { id: "archive", label: "Archive", onSelect: () => undefined },
        ]}
      />,
    );
    const trigger = screen.getByRole("button", { name: "Account actions" });

    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    const firstItem = await screen.findByRole("menuitem", { name: "View" });
    await waitFor(() => expect(firstItem).toHaveFocus());

    fireEvent.keyDown(firstItem, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it("renders an icon DropdownMenu with one labelled icon and a focus tooltip instead of visible button text", async () => {
    const user = userEvent.setup();
    render(<DropdownMenu triggerAppearance="icon" label="更多操作" ariaLabel="更多操作：代理 A"
      items={[{ id: "view", label: "查看记录", onSelect: () => undefined }]} />);
    const trigger = screen.getByRole("button", { name: "更多操作：代理 A" });

    expect(trigger).toHaveClass("ui-icon-button", "ui-icon-button--ghost");
    expect(trigger).toHaveAttribute("data-ui-owner", "IconButton");
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).not.toHaveAttribute("aria-controls");
    expect(trigger).toHaveTextContent(/^$/);
    expect(trigger.querySelectorAll("svg")).toHaveLength(1);
    expect(trigger.querySelector(".lucide-ellipsis")).not.toBeNull();
    expect(trigger.querySelector(".lucide-chevron-down")).toBeNull();

    await user.tab();
    expect(trigger).toHaveFocus();
    expect(await screen.findByRole("tooltip", { name: "更多操作" })).toBeVisible();
    expect(trigger).toHaveAccessibleDescription("更多操作");
    await user.keyboard("{ArrowDown}");
    const menu = await screen.findByRole("menu", { name: "更多操作：代理 A" });
    expect(trigger).toHaveAttribute("aria-controls", menu.id);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("keeps icon DropdownMenu keyboard navigation, disabled skipping, Escape return, Tab exit and single selection", async () => {
    const user = userEvent.setup();
    const onView = vi.fn();
    const onDelete = vi.fn();
    render(<>
      <DropdownMenu triggerAppearance="icon" label="更多操作" ariaLabel="代理操作" items={[
        { id: "view", label: "查看记录", onSelect: onView },
        { id: "edit", label: "编辑", disabled: true, onSelect: vi.fn() },
        { id: "delete", label: "删除", onSelect: onDelete },
      ]} />
      <Button>下一项</Button>
    </>);
    const trigger = screen.getByRole("button", { name: "代理操作" });
    await user.tab();
    await user.keyboard("{ArrowDown}");
    const view = await screen.findByRole("menuitem", { name: "查看记录" });
    const remove = screen.getByRole("menuitem", { name: "删除" });
    await waitFor(() => expect(view).toHaveFocus());
    await user.keyboard("{ArrowDown}");
    expect(remove).toHaveFocus();
    await user.keyboard("{Home}");
    expect(view).toHaveFocus();
    await user.keyboard("{End}");
    expect(remove).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(trigger).toHaveFocus();
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());

    await user.keyboard("{ArrowUp}");
    await waitFor(() => expect(screen.getByRole("menuitem", { name: "删除" })).toHaveFocus());
    await user.keyboard("{Enter}");
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onView).not.toHaveBeenCalled();
    expect(trigger).toHaveFocus();
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());

    await user.keyboard("{ArrowDown}");
    await waitFor(() => expect(screen.getByRole("menuitem", { name: "查看记录" })).toHaveFocus());
    await user.tab();
    expect(screen.getByRole("button", { name: "下一项" })).toHaveFocus();
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("disables empty or fully disabled icon menus and closes when their last enabled command disappears", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const { rerender } = render(<DropdownMenu triggerAppearance="icon" label="更多操作" ariaLabel="代理操作" items={[]} />);
    const trigger = screen.getByRole("button", { name: "代理操作" });
    expect(trigger).toBeDisabled();
    await user.click(trigger);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    rerender(<DropdownMenu triggerAppearance="icon" label="更多操作" ariaLabel="代理操作"
      items={[{ id: "view", label: "查看记录", onSelect }]} />);
    await user.click(trigger);
    expect(await screen.findByRole("menuitem", { name: "查看记录" })).toBeEnabled();
    rerender(<DropdownMenu triggerAppearance="icon" label="更多操作" ariaLabel="代理操作"
      items={[{ id: "view", label: "查看记录", disabled: true, onSelect }]} />);
    expect(trigger).toBeDisabled();
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("keeps Lightbox positioning classes on the three icon buttons", () => {
    render(
      <Lightbox
        open
        onOpenChange={() => undefined}
        value="first"
        onValueChange={() => undefined}
        items={[
          { id: "first", src: "/first.png", alt: "First" },
          { id: "second", src: "/second.png", alt: "Second" },
        ]}
      />,
    );

    expect(screen.getByRole("button", { name: "关闭预览" })).toHaveClass("ui-lightbox__close");
    expect(screen.getByRole("button", { name: "上一张" })).toHaveClass("ui-lightbox__previous");
    expect(screen.getByRole("button", { name: "下一张" })).toHaveClass("ui-lightbox__next");
  });
});
