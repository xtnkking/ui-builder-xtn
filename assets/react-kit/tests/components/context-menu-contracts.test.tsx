// @personal-ui-coverage {"kind":"unit","runner":"components","exports":["ContextMenu"]}
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ContextMenu } from "../../src/personal-ui";

describe("ContextMenu keyboard contract", () => {
  it("opens from a static trigger and roves by enabled identity, typeahead, and action", async () => {
    const user = userEvent.setup();
    const selected = vi.fn();
    render(
      <ContextMenu ariaLabel="Record actions" items={[
        { id: "alpha", label: "Alpha", onSelect: () => selected("alpha") },
        { id: "blocked", label: "Blocked", disabled: true, onSelect: () => selected("blocked") },
        { id: "bravo", label: "Bravo", onSelect: () => selected("bravo") },
        { id: "charlie", label: "Charlie", onSelect: () => selected("charlie") },
      ]}>
        <span>Record</span>
      </ContextMenu>,
    );
    const trigger = document.querySelector<HTMLElement>("[data-pui-owner='ContextMenu']")!;
    expect(trigger).toHaveAttribute("tabindex", "0");
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "F10", shiftKey: true });
    const menu = screen.getByRole("menu", { name: "Record actions" });
    const alpha = screen.getByRole("menuitem", { name: "Alpha" });
    const blocked = screen.getByRole("menuitem", { name: "Blocked" });
    const bravo = screen.getByRole("menuitem", { name: "Bravo" });
    const charlie = screen.getByRole("menuitem", { name: "Charlie" });
    expect(alpha).toHaveFocus();
    expect(blocked).toHaveAttribute("tabindex", "-1");
    expect(alpha.id).toContain("alpha");

    fireEvent.keyDown(alpha, { key: "ArrowDown" });
    expect(bravo).toHaveFocus();
    expect(bravo).toHaveAttribute("tabindex", "0");
    fireEvent.keyDown(bravo, { key: "End" });
    expect(charlie).toHaveFocus();
    fireEvent.keyDown(charlie, { key: "Home" });
    expect(alpha).toHaveFocus();
    fireEvent.keyDown(alpha, { key: "c" });
    expect(charlie).toHaveFocus();
    fireEvent.keyDown(charlie, { key: "ArrowUp" });
    expect(bravo).toHaveFocus();
    await user.keyboard(" ");
    expect(selected).toHaveBeenCalledExactlyOnceWith("bravo");
    expect(menu).not.toBeInTheDocument();
    await Promise.resolve();
    expect(trigger).toHaveFocus();

    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(screen.getByRole("menu", { name: "Record actions" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.keyDown(trigger, { key: " " });
    expect(screen.getByRole("menu", { name: "Record actions" })).toBeInTheDocument();
  });

  it("uses the child trigger without adding another Tab stop, and Escape cancels", async () => {
    render(
      <ContextMenu ariaLabel="Actions" items={[
        { id: "disabled", label: "Disabled", disabled: true, onSelect: () => undefined },
        { id: "enabled", label: "Enabled", onSelect: () => undefined },
      ]}>
        <button type="button">Record button</button>
      </ContextMenu>,
    );
    const root = document.querySelector<HTMLElement>("[data-pui-owner='ContextMenu']")!;
    const trigger = screen.getByRole("button", { name: "Record button" });
    expect(root).toHaveAttribute("tabindex", "-1");
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "ContextMenu" });
    expect(screen.getByRole("menuitem", { name: "Enabled" })).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("dismisses on a primary click of its own button without swallowing the button action or focus", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const onSelect = vi.fn();
    render(
      <ContextMenu ariaLabel="Actions" items={[{ id: "inspect", label: "Inspect", onSelect }]}>
        <button type="button" onClick={onClick}>Record button</button>
      </ContextMenu>,
    );
    const trigger = screen.getByRole("button", { name: "Record button" });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "ContextMenu" });
    expect(screen.getByRole("menu", { name: "Actions" })).toBeInTheDocument();

    await user.click(trigger);
    expect(screen.queryByRole("menu", { name: "Actions" })).not.toBeInTheDocument();
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(trigger).toHaveFocus();

    fireEvent.keyDown(trigger, { key: "ContextMenu" });
    await user.click(screen.getByRole("menuitem", { name: "Inspect" }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
