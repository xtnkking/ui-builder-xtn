// @ui-coverage {"kind":"unit","runner":"components","exports":["DropdownMenu","GuidedTour","HoverCard","MultiSelect","OverflowText","Popover","Select","Tooltip"]}
import { createElement, useState } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  DropdownMenu,
  GuidedTour,
  HoverCard,
  MultiSelect,
  OverflowText,
  Popover,
  Select,
  Tooltip,
  type DropdownMenuProps,
  type PopoverProps,
  type TooltipProps,
} from "../../src/ui";

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
          "data-ui-owner": "Consumer",
        } as unknown as DropdownMenuProps)}
        {createElement(Tooltip, {
          content: "Details",
          children: <span>Info</span>,
          className: "foreign-tooltip",
          "data-ui-owner": "Consumer",
        } as unknown as TooltipProps)}
        {createElement(OverflowText, {
          children: "Long value",
          className: "foreign-overflow",
          "data-ui-owner": "Consumer",
        } as never)}
        {createElement(Popover, {
          triggerLabel: "Open popover",
          ariaLabel: "Sanitized popover",
          children: "Popover details",
          className: "foreign-popover",
          style: { color: "red" },
          "data-ui-owner": "Consumer",
        } as unknown as PopoverProps)}
        {createElement(HoverCard, {
          triggerLabel: "Open hover card",
          ariaLabel: "Sanitized hover card",
          children: "Hover card details",
          className: "foreign-hover-card",
          style: { color: "red" },
          dangerouslySetInnerHTML: { __html: "<b>unsafe hover card</b>" },
          "data-ui-owner": "Consumer",
          "data-ui-slot": "foreign",
          "data-ui-private": "foreign",
        } as never)}
      </>,
    );

    const menu = document.querySelector<HTMLElement>("[data-ui-owner='DropdownMenu']");
    const tooltip = document.querySelector<HTMLElement>("[data-ui-owner='Tooltip']");
    const overflow = document.querySelector<HTMLElement>("[data-ui-owner='OverflowText']");
    const popover = document.querySelector<HTMLElement>("[data-ui-owner='Popover']");
    const hoverCard = document.querySelector<HTMLElement>("[data-ui-owner='HoverCard']");
    expect(menu).not.toBeNull();
    expect(menu).not.toHaveClass("foreign-menu");
    expect(menu).not.toHaveAttribute("style");
    expect(tooltip).not.toBeNull();
    expect(tooltip).not.toHaveClass("foreign-tooltip");
    expect(overflow).not.toBeNull();
    expect(overflow?.querySelector(".ui-overflow-text")).not.toHaveClass("foreign-overflow");
    expect(popover).not.toBeNull();
    expect(popover).not.toHaveClass("foreign-popover");
    expect(popover).not.toHaveAttribute("style");
    expect(hoverCard).not.toBeNull();
    expect(hoverCard).not.toHaveClass("foreign-hover-card");
    expect(hoverCard).not.toHaveAttribute("style");
    expect(hoverCard).not.toHaveAttribute("data-ui-slot");
    expect(hoverCard).not.toHaveAttribute("data-ui-private");
    expect(hoverCard).not.toHaveTextContent("unsafe hover card");
    expect(document.querySelector("[data-ui-owner='Consumer']")).toBeNull();
  });

  it("keeps HoverCard's private class and owner without exposing public styling props", () => {
    render(<HoverCard triggerLabel="Preview" ariaLabel="Preview">Details</HoverCard>);

    const root = document.querySelector<HTMLElement>("[data-ui-owner='HoverCard']");
    expect(root).not.toBeNull();
    expect(root).toHaveClass("ui-popover", "ui-hover-card");
  });

  it("owns one plain-text trigger and rejects arbitrary trigger trees at runtime", () => {
    const popover = render(<Popover triggerLabel="Open" ariaLabel="Open details">Details</Popover>);
    const root = document.querySelector<HTMLElement>("[data-ui-owner='Popover']")!;
    expect(root.querySelectorAll("button")).toHaveLength(1);
    expect(root.querySelector("button button")).toBeNull();
    expect(screen.getByRole("button", { name: "Open details" })).toHaveAttribute("aria-haspopup", "dialog");
    popover.unmount();

    const hoverCard = render(<HoverCard triggerLabel="Preview" ariaLabel="Preview details">Details</HoverCard>);
    const hoverRoot = document.querySelector<HTMLElement>("[data-ui-owner='HoverCard']")!;
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

  it("keeps a Select's owned portal inside a Popover's dismissal branch", async () => {
    const user = userEvent.setup();
    function RegionSelect() {
      const [region, setRegion] = useState("gb");
      return <Select ariaLabel="Region" value={region} onValueChange={setRegion} options={[{ value: "gb", label: "United Kingdom" }, { value: "cn", label: "China" }]} />;
    }
    render(<><Popover triggerLabel="Open filters" ariaLabel="Filters">
      <RegionSelect />
    </Popover><button type="button">Outside</button></>);
    await user.click(screen.getByRole("button", { name: "Filters" }));
    await user.click(screen.getByRole("combobox", { name: /^Region/ }));
    await user.click(screen.getByRole("option", { name: "China" }));
    expect(screen.getByRole("dialog", { name: "Filters" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /^Region/ })).toHaveTextContent("China");
    await user.click(screen.getByRole("button", { name: "Outside" }));
    expect(screen.getByRole("button", { name: "Filters" })).toHaveAttribute("aria-expanded", "false");
  });

  it("selects from nested MultiSelect and closes only the innermost layer per Escape", async () => {
    const user = userEvent.setup();
    render(<Popover triggerLabel="Open filters" ariaLabel="Filters"><MultiSelect ariaLabel="Members" options={[{ value: "lin", label: "Lin" }]} /></Popover>);
    const trigger = screen.getByRole("button", { name: "Filters" });
    await user.click(trigger);
    await user.click(screen.getByRole("combobox", { name: /Members/ }));
    await user.click(screen.getByRole("option", { name: "Lin" }));
    expect(screen.getByRole("option", { name: "Lin" })).toHaveAttribute("aria-selected", "true");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{Escape}");
    expect(screen.getByRole("combobox", { name: /Members/ })).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{Escape}");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
  });

  it("closes an inner Popover before its parent and respects a child's handled Escape", async () => {
    const user = userEvent.setup();
    render(<Popover triggerLabel="Open outer" ariaLabel="Outer"><Popover triggerLabel="Open inner" ariaLabel="Inner">
      <input aria-label="Draft" onKeyDown={(event) => { if (event.key === "Escape") event.preventDefault(); }} />
    </Popover></Popover>);
    const outer = screen.getByRole("button", { name: "Outer" });
    await user.click(outer);
    const inner = screen.getByRole("button", { name: "Inner" });
    await user.click(inner);
    await user.click(screen.getByRole("textbox", { name: "Draft" }));
    await user.keyboard("{Escape}");
    expect(inner).toHaveAttribute("aria-expanded", "true");
    fireEvent.keyDown(inner, { key: "Escape" });
    expect(inner).toHaveAttribute("aria-expanded", "false");
    expect(outer).toHaveAttribute("aria-expanded", "true");
  });

  it("keeps HoverCard focus through its panel and owned portal then closes after focus leaves", async () => {
    const user = userEvent.setup();
    render(<><HoverCard triggerLabel="Member" ariaLabel="Member card"><MultiSelect ariaLabel="Teams" options={[{ value: "support", label: "Support" }]} /></HoverCard><button type="button">Outside</button></>);
    const trigger = screen.getByRole("button", { name: "Member card" });
    await user.tab();
    expect(trigger).toHaveFocus();
    await user.click(screen.getByRole("combobox", { name: /Teams/ }));
    await user.click(screen.getByRole("option", { name: "Support" }));
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{Escape}");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    // Once neither pointer nor keyboard focus belongs to the branch, close it.
    fireEvent.mouseLeave(screen.getByRole("dialog", { name: "Member card" }));
    act(() => screen.getByRole("button", { name: "Outside" }).focus());
    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "false"));
  });

  it("does not reopen a keyboard HoverCard when Escape restores trigger focus", async () => {
    const user = userEvent.setup();
    render(<><HoverCard triggerLabel="Member" ariaLabel="Member card"><button type="button">Details</button></HoverCard><button type="button">Outside</button></>);
    const trigger = screen.getByRole("button", { name: "Member card" });
    await user.tab();
    fireEvent.mouseEnter(screen.getByRole("dialog", { name: "Member card" }));
    act(() => screen.getByRole("button", { name: "Details" }).focus());
    await user.keyboard("{Escape}");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Member card" })).not.toBeInTheDocument());
    // The pointer can leave while the closed portal is absent: its previous hover must not survive.
    act(() => screen.getByRole("button", { name: "Outside" }).focus());
    act(() => trigger.focus());
    act(() => screen.getByRole("button", { name: "Details" }).focus());
    act(() => screen.getByRole("button", { name: "Outside" }).focus());
    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "false"));
  });

  it("keeps full tour content in its scroll region and commands in a separate footer", async () => {
    const user = userEvent.setup();
    const description = "Keep every configuration requirement visible. ".repeat(30);
    function Tour() {
      const [open, setOpen] = useState(true);
      const [currentId, setCurrentId] = useState("details");
      return <GuidedTour open={open} onOpenChange={setOpen} currentId={currentId} onCurrentChange={setCurrentId} steps={[
        { id: "details", title: "Configuration", description },
        { id: "finish", title: "Done", description: "All details reviewed." },
      ]} />;
    }
    render(<Tour />);
    const dialog = screen.getByRole("dialog");
    const body = within(dialog).getByRole("region");
    expect(body.textContent).toContain(description);
    const next = within(dialog).getByRole("button", { name: "下一步" });
    expect(body).not.toContainElement(next);
    await user.click(next);
    expect(within(body).getByRole("heading", { name: "Done" })).toBeInTheDocument();
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
