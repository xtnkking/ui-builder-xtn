// @personal-ui-coverage {"kind":"unit","runner":"components","exports":["Accordion","Collapse","KeyboardShortcut"]}
import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  Accordion,
  Collapse,
  KeyboardShortcut,
  type AccordionProps,
  type CollapseProps,
  type KeyboardShortcutProps,
} from "../../src/personal-ui";

const accordionItems = [
  { id: "profile", title: "Profile", content: "Profile content" },
  { id: "security", title: "Security", content: "Security content" },
];

function escapedProps(testId: string) {
  return {
    className: "foreign-control",
    internalClassName: "foreign-internal",
    style: { color: "red" },
    css: "foreign-css",
    sx: "foreign-sx",
    tw: "foreign-tw",
    dangerouslySetInnerHTML: { __html: "<b>unsafe</b>" },
    "data-pui-owner": "Consumer",
    "data-pui-slot": "foreign",
    "data-testid": testId,
    "data-track": "preserved",
  };
}

function expectClosedRoot(element: HTMLElement, owner: string) {
  expect(element).not.toHaveClass("foreign-control", "foreign-internal");
  expect(element).not.toHaveAttribute("style");
  expect(element).not.toHaveAttribute("css");
  expect(element).not.toHaveAttribute("sx");
  expect(element).not.toHaveAttribute("tw");
  expect(element).not.toHaveAttribute("data-pui-slot");
  expect(element).toHaveAttribute("data-pui-owner", owner);
  expect(element).toHaveAttribute("data-track", "preserved");
}

function expectDevelopmentError(run: () => void, message: RegExp) {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
  try {
    expect(run).toThrow(message);
  } finally {
    consoleError.mockRestore();
  }
}

describe("disclosure contracts", () => {
  it("filters escape props while preserving Accordion's private Collapse slot", () => {
    render(createElement(Collapse, {
      ...escapedProps("collapse"),
      title: "Details",
      defaultOpen: true,
      children: "Visible details",
    } as unknown as CollapseProps));
    render(createElement(Accordion, {
      ...escapedProps("accordion"),
      items: accordionItems,
      defaultValue: ["profile"],
    } as unknown as AccordionProps));
    render(createElement(KeyboardShortcut, {
      ...escapedProps("shortcut"),
      keys: ["Ctrl", "K"],
    } as unknown as KeyboardShortcutProps));

    expectClosedRoot(screen.getByTestId("collapse"), "Collapse");
    expectClosedRoot(screen.getByTestId("accordion"), "Accordion");
    expectClosedRoot(screen.getByTestId("shortcut"), "KeyboardShortcut");
    expect(screen.getByTestId("accordion").querySelector(".pui-accordion__item")).not.toBeNull();
  });

  it("owns Collapse state in uncontrolled mode", async () => {
    const user = userEvent.setup();
    const changes: boolean[] = [];
    render(
      <Collapse title="Details" onOpenChange={(open) => changes.push(open)}>
        Visible details
      </Collapse>,
    );

    const trigger = screen.getByRole("button", { name: "Details" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await user.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("region", { name: "Details" })).toHaveTextContent("Visible details");
    expect(changes).toEqual([true]);
  });

  it("owns Accordion state in uncontrolled mode", async () => {
    const user = userEvent.setup();
    const changes: string[][] = [];
    render(
      <Accordion
        items={accordionItems}
        type="single"
        defaultValue={["profile"]}
        onValueChange={(value) => changes.push(value)}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Security" }));

    expect(screen.getByRole("button", { name: "Profile" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "Security" })).toHaveAttribute("aria-expanded", "true");
    expect(changes).toEqual([["security"]]);
  });

  it("prunes an expanded item removed from an uncontrolled Accordion", async () => {
    const user = userEvent.setup();
    const changes: string[][] = [];
    const view = render(
      <Accordion items={accordionItems} defaultValue={["profile"]} onValueChange={(ids) => changes.push(ids)} />,
    );

    view.rerender(
      <Accordion items={accordionItems.slice(1)} defaultValue={["profile"]} onValueChange={(ids) => changes.push(ids)} />,
    );
    expect(screen.queryByRole("button", { name: "Profile" })).toBeNull();
    expect(changes).toEqual([[]]);

    await user.click(screen.getByRole("button", { name: "Security" }));
    expect(changes).toEqual([[], ["security"]]);
    view.rerender(
      <Accordion items={accordionItems} defaultValue={["profile"]} onValueChange={(ids) => changes.push(ids)} />,
    );
    expect(screen.getByRole("button", { name: "Profile" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "Security" })).toHaveAttribute("aria-expanded", "true");
  });

  it("keeps controlled ownership when an expanded item is removed", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const view = render(
      <Accordion items={accordionItems} type="single" value={["profile"]} onValueChange={onValueChange} />,
    );

    view.rerender(
      <Accordion items={accordionItems.slice(1)} type="single" value={["profile"]} onValueChange={onValueChange} />,
    );
    expect(screen.getByRole("button", { name: "Security" })).toHaveAttribute("aria-expanded", "false");
    expect(onValueChange).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Security" }));
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith(["security"]);
    view.rerender(
      <Accordion items={accordionItems} type="single" value={["profile"]} onValueChange={onValueChange} />,
    );
    expect(screen.getByRole("button", { name: "Profile" })).toHaveAttribute("aria-expanded", "true");
  });

  it("still rejects an initially unknown Accordion value", () => {
    expectDevelopmentError(
      () => render(<Accordion items={accordionItems} defaultValue={["missing"]} />),
      /Accordion received unknown defaultValue "missing"/,
    );
  });

  it("rejects contradictory controlled and default disclosure props", () => {
    expectDevelopmentError(
      () => render(createElement(Collapse, {
        title: "Details",
        open: true,
        defaultOpen: false,
        onOpenChange: () => undefined,
      } as unknown as CollapseProps)),
      /cannot receive both open and defaultOpen/,
    );
    expectDevelopmentError(
      () => render(createElement(Accordion, {
        items: accordionItems,
        value: ["profile"],
        defaultValue: ["security"],
        onValueChange: () => undefined,
      } as unknown as AccordionProps)),
      /cannot receive both value and defaultValue/,
    );
  });
});
