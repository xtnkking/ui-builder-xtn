// @ui-coverage {"kind":"unit","runner":"components","exports":["Select","Combobox","Autocomplete","AsyncSelect","MultiSelect","TreeSelect","SearchableSelect"]}
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AsyncSelect,
  Autocomplete,
  Combobox,
  MultiSelect,
  SearchableSelect,
  Select,
  TreeSelect,
} from "../../src/ui";

const options = [{ value: "gb", label: "英国" }, { value: "us", label: "美国" }];
let motionStyles: HTMLStyleElement;

beforeEach(() => {
  vi.useFakeTimers();
  // Component tests exercise real presence with CSS-owned time, without a browser animation engine.
  motionStyles = document.createElement("style");
  motionStyles.textContent = '[data-ui-motion-profile="menu"] { --ui-motion-enter: 120ms; --ui-motion-exit: 100ms; }';
  document.head.append(motionStyles);
});

afterEach(() => {
  motionStyles.remove();
  vi.useRealTimers();
});

describe("input menu motion contracts", () => {
  it.each(["Select", "Combobox", "Autocomplete", "AsyncSelect", "MultiSelect", "TreeSelect", "SearchableSelect"])(
    "%s retains an inert exit, rejects late selection, and reuses the node when reopened",
    (component) => {
      const onValueChange = vi.fn();
      const common = { options, ariaLabel: "国家", onValueChange };
      const element = component === "Select" ? <Select {...common} value="" />
        : component === "Combobox" ? <Combobox {...common} value="" />
        : component === "Autocomplete" ? <Autocomplete {...common} value="" />
        : component === "AsyncSelect" ? <AsyncSelect {...common} value="" />
        : component === "MultiSelect" ? <MultiSelect {...common} value={[]} />
        : component === "TreeSelect" ? <TreeSelect {...common} value="" />
        : <SearchableSelect {...common} value="" />;
      render(element);
      const trigger = screen.getByRole("combobox", { name: /国家/ });
      const open = () => {
        if (component === "Autocomplete") fireEvent.focus(trigger);
        else fireEvent.click(trigger);
      };
      const close = () => {
        if (component === "Autocomplete") fireEvent.keyDown(trigger, { key: "Escape" });
        else fireEvent.click(trigger);
      };
      open();
      const panel = document.querySelector<HTMLElement>('[data-ui-motion-profile="menu"]')!;
      expect(panel).not.toBeNull();
      expect(panel).toHaveAttribute("data-positioned", "true");
      close();
      expect(panel).toHaveAttribute("data-ui-motion", "exiting");
      expect(panel).toHaveAttribute("inert");
      expect(panel).toHaveAttribute("aria-hidden", "true");
      expect(panel).toHaveAttribute("data-positioned", "true");
      expect(trigger).toHaveAttribute("aria-expanded", "false");
      expect(trigger).not.toHaveAttribute("aria-controls");
      expect(trigger).not.toHaveAttribute("aria-activedescendant");
      panel.querySelectorAll('[aria-activedescendant], [aria-controls]').forEach((control) => {
        expect(control).not.toHaveAttribute("aria-activedescendant");
        expect(control).not.toHaveAttribute("aria-controls");
      });
      fireEvent.click(panel.querySelector("[role='option'], [role='treeitem']")!);
      expect(onValueChange).not.toHaveBeenCalled();
      open();
      expect(document.querySelector('[data-ui-motion-profile="menu"]')).toBe(panel);
      expect(panel).not.toHaveAttribute("inert");
      expect(panel).not.toHaveAttribute("aria-hidden");
      expect(trigger).toHaveAttribute("aria-expanded", "true");
      act(() => vi.advanceTimersByTime(200));
      expect(panel).toBeInTheDocument();
      close();
      act(() => vi.advanceTimersByTime(150));
      expect(panel).not.toBeInTheDocument();
    },
  );

  it("does not steal focus back from an external destination while a searchable menu exits", () => {
    render(<><Combobox options={options} value="" onValueChange={() => undefined} ariaLabel="国家" /><button type="button">外部操作</button></>);
    const trigger = screen.getByRole("combobox", { name: /国家/ });
    fireEvent.click(trigger);
    const external = screen.getByRole("button", { name: "外部操作" });
    act(() => external.focus());
    fireEvent.mouseDown(external);
    expect(external).toHaveFocus();
    expect(document.querySelector('[data-ui-motion-profile="menu"]')).toHaveAttribute("inert");
    act(() => vi.advanceTimersByTime(150));
    expect(external).toHaveFocus();
  });

  it("returns Autocomplete popup focus without its input onFocus reopening the closed menu", () => {
    render(<Autocomplete options={options} value="" onValueChange={() => undefined} ariaLabel="国家" />);
    const input = screen.getByRole("combobox", { name: "国家" });
    act(() => input.focus());
    const option = screen.getByRole("option", { name: "英国" });
    act(() => option.focus());
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute("aria-expanded", "false");
    const panel = document.querySelector('[data-ui-motion-profile="menu"]');
    expect(panel).toHaveAttribute("inert");
    act(() => vi.advanceTimersByTime(150));
    expect(panel).not.toBeInTheDocument();
  });
});
