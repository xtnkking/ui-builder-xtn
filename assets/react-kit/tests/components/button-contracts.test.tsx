// @personal-ui-coverage {"kind":"unit","runner":"components","exports":["AsyncAction","Button","DropdownMenu","IconButton","Lightbox","RetryButton","SplitButton","ToggleButton"]}
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
} from "../../src/personal-ui";

function escapedButtonProps(testId: string) {
  return {
    className: "foreign-button",
    style: { color: "red", background: "magenta" },
    css: "foreign-css",
    sx: "foreign-sx",
    tw: "foreign-tw",
    dangerouslySetInnerHTML: { __html: "<b>unsafe</b>" },
    "data-pui-owner": "Consumer",
    "data-pui-slot": "foreign",
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
  expect(button).not.toHaveAttribute("data-pui-slot");
  expect(button).toHaveAttribute("data-pui-owner", owner);
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
    expect(button).toHaveClass("pui-button", "pui-button--secondary", "pui-button--medium");
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
    expect(button).toHaveClass("pui-icon-button", "pui-icon-button--ghost");
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

    expect(screen.getByRole("button", { name: "Run report" })).toHaveClass("pui-split-button__primary");
    expect(screen.getByRole("button", { name: "Run report" })).toHaveAttribute("data-pui-owner", "Button");
    expect(screen.getByRole("button", { name: "Pin item" })).toHaveClass("pui-toggle-button");
    expect(screen.getByRole("button", { name: "Pin item" })).toHaveAttribute("data-pui-owner", "ToggleButton");
    expect(screen.getByRole("button", { name: "重试" })).toHaveAttribute("data-pui-owner", "RetryButton");
    expect(screen.getByRole("button", { name: "Save async" })).toHaveAttribute("data-pui-owner", "AsyncAction");
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

    expect(screen.getByRole("button", { name: "关闭预览" })).toHaveClass("pui-lightbox__close");
    expect(screen.getByRole("button", { name: "上一张" })).toHaveClass("pui-lightbox__previous");
    expect(screen.getByRole("button", { name: "下一张" })).toHaveClass("pui-lightbox__next");
  });
});
