// @personal-ui-coverage {"kind":"unit","runner":"components","exports":["DropdownMenu","HoverCard","OverflowText","Popover","Tooltip"]}
import { createElement, useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  DropdownMenu,
  HoverCard,
  OverflowText,
  Popover,
  Tooltip,
  type DropdownMenuProps,
  type PopoverProps,
  type TooltipProps,
} from "../../src/personal-ui";

function expectDevelopmentError(run: () => void, message: RegExp) {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
  try {
    expect(run).toThrow(message);
  } finally {
    consoleError.mockRestore();
  }
}

describe("overlay public and private composition contracts", () => {
  it("ignores forced escape props while preserving fixed owners", () => {
    render(
      <>
        {createElement(DropdownMenu, {
          label: "Actions",
          ariaLabel: "Actions",
          items: [{ id: "edit", label: "Edit", onSelect: () => undefined }],
          className: "foreign-menu",
          style: { color: "red" },
          "data-pui-owner": "Consumer",
        } as unknown as DropdownMenuProps)}
        {createElement(Tooltip, {
          content: "Details",
          children: <span>Info</span>,
          className: "foreign-tooltip",
          "data-pui-owner": "Consumer",
        } as unknown as TooltipProps)}
        {createElement(OverflowText, {
          children: "Long value",
          className: "foreign-overflow",
          "data-pui-owner": "Consumer",
        } as never)}
        {createElement(Popover, {
          triggerLabel: "Open popover",
          ariaLabel: "Sanitized popover",
          children: "Popover details",
          className: "foreign-popover",
          style: { color: "red" },
          "data-pui-owner": "Consumer",
        } as unknown as PopoverProps)}
        {createElement(HoverCard, {
          triggerLabel: "Open hover card",
          ariaLabel: "Sanitized hover card",
          children: "Hover card details",
          className: "foreign-hover-card",
          style: { color: "red" },
          dangerouslySetInnerHTML: { __html: "<b>unsafe hover card</b>" },
          "data-pui-owner": "Consumer",
          "data-pui-slot": "foreign",
          "data-pui-private": "foreign",
        } as never)}
      </>,
    );

    const menu = document.querySelector<HTMLElement>("[data-pui-owner='DropdownMenu']");
    const tooltip = document.querySelector<HTMLElement>("[data-pui-owner='Tooltip']");
    const overflow = document.querySelector<HTMLElement>("[data-pui-owner='OverflowText']");
    const popover = document.querySelector<HTMLElement>("[data-pui-owner='Popover']");
    const hoverCard = document.querySelector<HTMLElement>("[data-pui-owner='HoverCard']");
    expect(menu).not.toBeNull();
    expect(menu).not.toHaveClass("foreign-menu");
    expect(menu).not.toHaveAttribute("style");
    expect(tooltip).not.toBeNull();
    expect(tooltip).not.toHaveClass("foreign-tooltip");
    expect(overflow).not.toBeNull();
    expect(overflow?.querySelector(".pui-overflow-text")).not.toHaveClass("foreign-overflow");
    expect(popover).not.toBeNull();
    expect(popover).not.toHaveClass("foreign-popover");
    expect(popover).not.toHaveAttribute("style");
    expect(hoverCard).not.toBeNull();
    expect(hoverCard).not.toHaveClass("foreign-hover-card");
    expect(hoverCard).not.toHaveAttribute("style");
    expect(hoverCard).not.toHaveAttribute("data-pui-slot");
    expect(hoverCard).not.toHaveAttribute("data-pui-private");
    expect(hoverCard).not.toHaveTextContent("unsafe hover card");
    expect(document.querySelector("[data-pui-owner='Consumer']")).toBeNull();
  });

  it("keeps HoverCard's private class and owner without exposing public styling props", () => {
    render(<HoverCard triggerLabel="Preview" ariaLabel="Preview">Details</HoverCard>);

    const root = document.querySelector<HTMLElement>("[data-pui-owner='HoverCard']");
    expect(root).not.toBeNull();
    expect(root).toHaveClass("pui-popover", "pui-hover-card");
  });

  it("owns one plain-text trigger and rejects arbitrary trigger trees at runtime", () => {
    const popover = render(<Popover triggerLabel="Open" ariaLabel="Open details">Details</Popover>);
    const root = document.querySelector<HTMLElement>("[data-pui-owner='Popover']")!;
    expect(root.querySelectorAll("button")).toHaveLength(1);
    expect(root.querySelector("button button")).toBeNull();
    expect(screen.getByRole("button", { name: "Open details" })).toHaveAttribute("aria-haspopup", "dialog");
    popover.unmount();

    const hoverCard = render(<HoverCard triggerLabel="Preview" ariaLabel="Preview details">Details</HoverCard>);
    const hoverRoot = document.querySelector<HTMLElement>("[data-pui-owner='HoverCard']")!;
    expect(hoverRoot.querySelectorAll("button")).toHaveLength(1);
    expect(hoverRoot.querySelector("button button")).toBeNull();
    hoverCard.unmount();

    expectDevelopmentError(
      () => render(createElement(Popover, {
        triggerLabel: <button type="button">Nested</button>,
        ariaLabel: "Invalid trigger",
        children: "Details",
      } as unknown as PopoverProps)),
      /Popover requires triggerLabel to be a non-empty string/,
    );
    expectDevelopmentError(
      () => render(createElement(HoverCard, {
        triggerLabel: "   ",
        ariaLabel: "Invalid hover trigger",
        children: "Details",
      } as never)),
      /HoverCard requires triggerLabel to be a non-empty string/,
    );
  });

  it("owns uncontrolled state and reports each transition", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <Popover triggerLabel="Open details" ariaLabel="Details" onOpenChange={onOpenChange}>
        Content
      </Popover>,
    );

    const trigger = screen.getByRole("button", { name: "Details" });
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(await screen.findByRole("dialog", { name: "Details" })).toHaveTextContent("Content");
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(onOpenChange.mock.calls.map(([value]) => value)).toEqual([true, false]);
  });

  it("derives repeated controlled interactions from the rendered open value", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <Popover triggerLabel="Open controlled" ariaLabel="Controlled details" open={false} onOpenChange={onOpenChange}>
        Content
      </Popover>,
    );

    const trigger = screen.getByRole("button", { name: "Controlled details" });
    await user.click(trigger);
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(onOpenChange.mock.calls.map(([value]) => value)).toEqual([true, true]);
  });

  it("rejects contradictory runtime state props and mode switching", () => {
    expectDevelopmentError(
      () => render(createElement(Popover, {
        triggerLabel: "Open",
        ariaLabel: "Contradictory",
        children: "Content",
        open: false,
        defaultOpen: true,
        onOpenChange: () => undefined,
      } as unknown as PopoverProps)),
      /cannot receive both open and defaultOpen/,
    );

    function SwitchingPopover() {
      const [controlled, setControlled] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setControlled(true)}>switch</button>
          {controlled
            ? <Popover triggerLabel="Open" ariaLabel="Switch target" open={false} onOpenChange={() => undefined}>Content</Popover>
            : <Popover triggerLabel="Open" ariaLabel="Switch target" defaultOpen={false}>Content</Popover>}
        </>
      );
    }
    const { unmount } = render(<SwitchingPopover />);
    expectDevelopmentError(
      () => fireEvent.click(screen.getByRole("button", { name: "switch" })),
      /cannot switch from uncontrolled to controlled mode/,
    );
    unmount();
  });
});
