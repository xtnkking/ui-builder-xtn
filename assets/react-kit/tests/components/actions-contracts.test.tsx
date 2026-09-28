// @personal-ui-coverage {"kind":"unit","runner":"components","exports":["ButtonGroup","ClipboardButton","FilterBar","Link","SplitButton","ToggleButton","Toolbar"]}
import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  ButtonGroup,
  ClipboardButton,
  FilterBar,
  Link,
  SplitButton,
  ToggleButton,
  Toolbar,
  type ButtonGroupProps,
  type ClipboardButtonProps,
  type FilterBarProps,
  type LinkProps,
  type SplitButtonProps,
  type ToggleButtonProps,
  type ToolbarProps,
} from "../../src/personal-ui";

function escapedProps(testId: string, onMouseEnter: () => void) {
  return {
    className: "foreign-action",
    style: { color: "red", background: "magenta" },
    css: "foreign-css",
    sx: "foreign-sx",
    tw: "foreign-tw",
    dangerouslySetInnerHTML: { __html: "<b>unsafe</b>" },
    "data-pui-owner": "Consumer",
    "data-pui-slot": "foreign",
    "data-pui-private": "foreign",
    "data-testid": testId,
    "data-track": "preserved",
    "aria-describedby": "action-description",
    onMouseEnter,
  };
}

function expectEscapesRemoved(element: HTMLElement, owner: string) {
  expect(element).not.toHaveClass("foreign-action");
  expect(element).not.toHaveAttribute("style");
  expect(element).not.toHaveAttribute("css");
  expect(element).not.toHaveAttribute("sx");
  expect(element).not.toHaveAttribute("tw");
  expect(element).not.toHaveAttribute("data-pui-slot");
  expect(element).not.toHaveAttribute("data-pui-private");
  expect(element).toHaveAttribute("data-pui-owner", owner);
  expect(element).toHaveAttribute("data-track", "preserved");
  expect(element).toHaveAttribute("aria-describedby", "action-description");
  expect(element).not.toHaveTextContent("unsafe");
}

describe("action public-control contracts", () => {
  it("filters Link escape props while preserving anchor semantics and events", () => {
    const onMouseEnter = vi.fn();
    const rawProps = {
      ...escapedProps("account-link", onMouseEnter),
      href: "/accounts",
      rel: "author",
      newTab: true,
      external: true,
    };
    const originalProps = { ...rawProps };

    render(createElement(Link, rawProps as unknown as LinkProps, "Accounts"));

    const link = screen.getByTestId("account-link");
    expect(link).toHaveClass("pui-link", "pui-link--default");
    expect(link).toHaveAttribute("href", "/accounts");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("author"));
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(link).toHaveAttribute("rel", expect.stringContaining("noreferrer"));
    expectEscapesRemoved(link, "Link");
    fireEvent.mouseEnter(link);
    expect(onMouseEnter).toHaveBeenCalledTimes(1);
    expect(rawProps).toEqual(originalProps);
  });

  it("keeps ButtonGroup and Toolbar geometry internal while preserving public metadata", () => {
    const groupMouseEnter = vi.fn();
    const toolbarMouseEnter = vi.fn();
    const groupProps = {
      ...escapedProps("action-group", groupMouseEnter),
      ariaLabel: "Record actions",
      attached: true,
      orientation: "vertical" as const,
    };
    const toolbarProps = {
      ...escapedProps("action-toolbar", toolbarMouseEnter),
      ariaLabel: "List tools",
      wrap: false,
      start: <span>Start tools</span>,
      end: <span>End tools</span>,
    };
    const originalGroupProps = { ...groupProps };
    const originalToolbarProps = { ...toolbarProps };

    render(
      <>
        {createElement(ButtonGroup, groupProps as unknown as ButtonGroupProps, <span>Grouped action</span>)}
        {createElement(Toolbar, toolbarProps as unknown as ToolbarProps, <span>Main tools</span>)}
      </>,
    );

    const group = screen.getByTestId("action-group");
    expect(group).toHaveClass("pui-button-group", "pui-button-group--attached");
    expect(group).toHaveAttribute("role", "group");
    expect(group).toHaveAttribute("aria-label", "Record actions");
    expect(group).not.toHaveAttribute("aria-orientation");
    expect(group).toHaveAttribute("data-orientation", "vertical");
    expectEscapesRemoved(group, "ButtonGroup");

    const toolbar = screen.getByTestId("action-toolbar");
    expect(toolbar).toHaveClass("pui-toolbar");
    expect(toolbar).toHaveAttribute("role", "toolbar");
    expect(toolbar).toHaveAttribute("aria-label", "List tools");
    expect(toolbar).not.toHaveAttribute("data-wrap");
    expect(toolbar).toHaveTextContent("Start toolsMain toolsEnd tools");
    expectEscapesRemoved(toolbar, "Toolbar");

    fireEvent.mouseEnter(group);
    fireEvent.mouseEnter(toolbar);
    expect(groupMouseEnter).toHaveBeenCalledTimes(1);
    expect(toolbarMouseEnter).toHaveBeenCalledTimes(1);
    expect(groupProps).toEqual(originalGroupProps);
    expect(toolbarProps).toEqual(originalToolbarProps);
  });

  it("filters FilterBar escape props while preserving form and submit behavior", () => {
    const onMouseEnter = vi.fn();
    const onSubmit = vi.fn((event: React.FormEvent<HTMLFormElement>) => event.preventDefault());
    const rawProps = {
      ...escapedProps("account-filters", onMouseEnter),
      ariaLabel: "Account filters",
      children: <span>Filter fields</span>,
      actions: <span>Filter actions</span>,
      status: "12 results",
      method: "get",
      noValidate: true,
      onSubmit,
    };
    const originalProps = { ...rawProps };

    render(createElement(FilterBar, rawProps as unknown as FilterBarProps));

    const form = screen.getByTestId("account-filters");
    expect(form).toHaveClass("pui-filter-bar");
    expect(form).toHaveAttribute("aria-label", "Account filters");
    expect(form).toHaveAttribute("method", "get");
    expect(form).toHaveAttribute("novalidate");
    expect(form).toHaveTextContent("Filter fieldsFilter actions12 results");
    expectEscapesRemoved(form, "FilterBar");
    fireEvent.submit(form);
    fireEvent.mouseEnter(form);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onMouseEnter).toHaveBeenCalledTimes(1);
    expect(rawProps).toEqual(originalProps);
  });

  it("filters composite button escape props without losing button behavior", () => {
    const splitMouseEnter = vi.fn();
    const toggleMouseEnter = vi.fn();
    const clipboardMouseEnter = vi.fn();
    const onPressedChange = vi.fn();
    const splitProps = {
      ...escapedProps("split-action", splitMouseEnter),
      menuItems: [],
      menuAriaLabel: "More actions",
      name: "intent",
      value: "run",
      form: "report-form",
    };
    const toggleProps = {
      ...escapedProps("toggle-action", toggleMouseEnter),
      pressed: false,
      onPressedChange,
      name: "pinned",
    };
    const clipboardProps = {
      ...escapedProps("clipboard-action", clipboardMouseEnter),
      text: "copied value",
      label: "Copy value",
      name: "copy",
    };
    const originalSplitProps = { ...splitProps };
    const originalToggleProps = { ...toggleProps };
    const originalClipboardProps = { ...clipboardProps };

    render(
      <>
        {createElement(SplitButton, splitProps as unknown as SplitButtonProps, "Run report")}
        {createElement(ToggleButton, toggleProps as unknown as ToggleButtonProps, "Pin item")}
        {createElement(ClipboardButton, clipboardProps as unknown as ClipboardButtonProps)}
      </>,
    );

    const split = screen.getByTestId("split-action");
    expect(split).toHaveClass("pui-button", "pui-split-button__primary");
    expect(split).toHaveAttribute("name", "intent");
    expect(split).toHaveAttribute("value", "run");
    expect(split).toHaveAttribute("form", "report-form");
    expectEscapesRemoved(split, "Button");

    const toggle = screen.getByTestId("toggle-action");
    expect(toggle).toHaveClass("pui-button", "pui-toggle-button");
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expectEscapesRemoved(toggle, "ToggleButton");
    fireEvent.click(toggle);
    expect(onPressedChange).toHaveBeenCalledWith(true);

    const clipboard = screen.getByTestId("clipboard-action");
    expect(clipboard).toHaveClass("pui-button");
    expect(clipboard).toHaveAttribute("name", "copy");
    expectEscapesRemoved(clipboard, "Button");

    fireEvent.mouseEnter(split);
    fireEvent.mouseEnter(toggle);
    fireEvent.mouseEnter(clipboard);
    expect(splitMouseEnter).toHaveBeenCalledTimes(1);
    expect(toggleMouseEnter).toHaveBeenCalledTimes(1);
    expect(clipboardMouseEnter).toHaveBeenCalledTimes(1);
    expect(splitProps).toEqual(originalSplitProps);
    expect(toggleProps).toEqual(originalToggleProps);
    expect(clipboardProps).toEqual(originalClipboardProps);
  });

  it("owns ToggleButton state in uncontrolled mode", () => {
    const changes: boolean[] = [];
    render(
      <ToggleButton defaultPressed onPressedChange={(pressed) => changes.push(pressed)}>
        Favorite
      </ToggleButton>,
    );

    const toggle = screen.getByRole("button", { name: "Favorite" });
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(changes).toEqual([false]);
  });

  it("rejects contradictory ToggleButton state props at runtime", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      expect(() => render(createElement(ToggleButton, {
        pressed: true,
        defaultPressed: false,
        onPressedChange: () => undefined,
        children: "Pin",
      } as unknown as ToggleButtonProps))).toThrow(/cannot receive both pressed and defaultPressed/);
    } finally {
      consoleError.mockRestore();
    }
  });
});
