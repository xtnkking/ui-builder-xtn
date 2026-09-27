// @personal-ui-coverage {"kind":"unit","runner":"components","exports":["Breadcrumbs","Pagination","Tabs"]}
import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  Breadcrumbs,
  Pagination,
  Tabs,
  type BreadcrumbsProps,
  type PaginationProps,
  type TabsProps,
} from "../../src/personal-ui";

const tabItems = [
  { id: "overview", label: "Overview", content: "Overview content" },
  { id: "security", label: "Security", content: "Security content" },
];

function escapedProps(testId: string) {
  return {
    className: "foreign-control",
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
  expect(element).not.toHaveClass("foreign-control");
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

describe("navigation public contracts", () => {
  it("filters escape props at every fixed navigation root", () => {
    render(createElement(Tabs, {
      ...escapedProps("tabs"),
      items: tabItems,
      ariaLabel: "Account sections",
      defaultValue: "overview",
    } as unknown as TabsProps));
    render(createElement(Breadcrumbs, {
      ...escapedProps("breadcrumbs"),
      items: [{ id: "home", label: "Home", href: "/" }],
    } as unknown as BreadcrumbsProps));
    render(createElement(Pagination, {
      ...escapedProps("pagination"),
      page: 1,
      pageCount: 3,
      onPageChange: () => undefined,
    } as unknown as PaginationProps));

    expectClosedRoot(screen.getByTestId("tabs"), "Tabs");
    expectClosedRoot(screen.getByTestId("breadcrumbs"), "Breadcrumbs");
    expectClosedRoot(screen.getByTestId("pagination"), "Pagination");
  });

  it("owns Tabs state in uncontrolled mode and still reports changes", async () => {
    const user = userEvent.setup();
    const changes: string[] = [];
    render(
      <Tabs
        items={tabItems}
        ariaLabel="Account sections"
        defaultValue="overview"
        onValueChange={(value) => changes.push(value)}
      />,
    );

    await user.click(screen.getByRole("tab", { name: "Security" }));

    expect(screen.getByRole("tab", { name: "Security" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel", { name: "Security" })).toHaveTextContent("Security content");
    expect(changes).toEqual(["security"]);
  });

  it("rejects contradictory Tabs state props at runtime", () => {
    expectDevelopmentError(
      () => render(createElement(Tabs, {
        items: tabItems,
        ariaLabel: "Account sections",
        value: "overview",
        defaultValue: "security",
        onValueChange: () => undefined,
      } as unknown as TabsProps)),
      /cannot receive both value and defaultValue/,
    );
  });

  it("requires Pagination's controlled page callback at runtime", () => {
    expectDevelopmentError(
      () => render(createElement(Pagination, {
        page: 1,
        pageCount: 3,
      } as unknown as PaginationProps)),
      /requires onPageChange when page is controlled/,
    );
  });

  it("preserves reviewed root event handlers", () => {
    const onMouseEnter = vi.fn();
    render(
      <Breadcrumbs
        items={[{ id: "home", label: "Home", href: "/" }]}
        data-testid="breadcrumbs-event"
        onMouseEnter={onMouseEnter}
      />,
    );

    fireEvent.mouseEnter(screen.getByTestId("breadcrumbs-event"));
    expect(onMouseEnter).toHaveBeenCalledTimes(1);
  });
});
