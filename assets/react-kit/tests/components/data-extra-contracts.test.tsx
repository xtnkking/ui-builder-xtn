// @personal-ui-coverage {"kind":"unit","runner":"components","exports":["BarChart","Calendar","Carousel","DragDrop","ExpandableText","ResizablePanels","Scheduler","SortableList","Tree","TreeTable","VirtualList"]}
import { createElement } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  BarChart,
  Calendar,
  Carousel,
  DragDrop,
  ExpandableText,
  ResizablePanels,
  Scheduler,
  SortableList,
  Tree,
  TreeTable,
  VirtualList,
  type BarChartProps,
  type CalendarProps,
  type CarouselProps,
  type DragDropProps,
  type ExpandableTextProps,
  type ResizablePanelsProps,
  type SchedulerProps,
  type SortableListProps,
  type TreeProps,
  type TreeTableProps,
  type VirtualListProps,
} from "../../src/personal-ui";

const treeNodes = [
  {
    id: "account",
    label: "Account",
    children: [{ id: "profile", label: "Profile" }],
  },
];
const treeTableNodes = [
  {
    id: "account",
    value: { name: "Account" },
    children: [{ id: "profile", value: { name: "Profile" } }],
  },
];
const treeTableColumns = [
  { id: "name", header: "Name", cell: (value: { name: string }) => value.name },
];
const slides = [
  { id: "overview", label: "Overview", content: "Overview content" },
  { id: "security", label: "Security", content: "Security content" },
];
const month = new Date(2026, 8, 1);

function escapedProps(testId: string, onMouseEnter = vi.fn()) {
  return {
    className: "foreign-control",
    style: { color: "red", background: "magenta" },
    css: "foreign-css",
    sx: "foreign-sx",
    tw: "foreign-tw",
    dangerouslySetInnerHTML: { __html: "<b>unsafe</b>" },
    "data-pui-owner": "Consumer",
    "data-pui-slot": "foreign",
    "data-testid": testId,
    "data-track": "preserved",
    onMouseEnter,
  };
}

function expectClosedRoot(element: HTMLElement, owner: string) {
  expect(element).not.toHaveClass("foreign-control");
  expect(element).not.toHaveStyle({ color: "red", background: "magenta" });
  expect(element).not.toHaveAttribute("css");
  expect(element).not.toHaveAttribute("sx");
  expect(element).not.toHaveAttribute("tw");
  expect(element).not.toHaveAttribute("data-pui-slot");
  expect(element).toHaveAttribute("data-pui-owner", owner);
  expect(element).toHaveAttribute("data-track", "preserved");
  expect(element.querySelector("b")).toBeNull();
}

function expectDevelopmentError(run: () => void, message: RegExp) {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
  try {
    expect(run).toThrow(message);
  } finally {
    consoleError.mockRestore();
  }
}

describe("data-extra fixed-control contracts", () => {
  it("filters escape props while preserving reviewed root semantics", () => {
    const onMouseEnter = vi.fn();
    const escaped = (testId: string) => escapedProps(testId, onMouseEnter);

    render(<VirtualList {...({ ...escaped("virtual-list"), items: [{ id: "one" }], itemKey: (item: { id: string }) => item.id, renderItem: (item: { id: string }) => item.id, height: 120, ariaLabel: "Accounts" } as unknown as VirtualListProps<{ id: string }>)} />);
    render(<Tree {...({ ...escaped("tree"), nodes: treeNodes, ariaLabel: "Account tree" } as unknown as TreeProps)} />);
    render(<TreeTable {...({ ...escaped("tree-table"), nodes: treeTableNodes, columns: treeTableColumns, treeColumnId: "name", ariaLabel: "Account rows" } as unknown as TreeTableProps<{ name: string }>)} />);
    render(<Calendar {...({ ...escaped("calendar"), month } as unknown as CalendarProps)} />);
    render(<Scheduler {...({ ...escaped("scheduler"), date: month, events: [] } as unknown as SchedulerProps)} />);
    render(<BarChart {...({ ...escaped("chart"), data: [{ id: "active", label: "Active", value: 4 }], ariaLabel: "Accounts" } as unknown as BarChartProps)} />);
    render(<Carousel {...({ ...escaped("carousel"), slides, ariaLabel: "Highlights" } as unknown as CarouselProps)} />);
    render(<ResizablePanels {...({ ...escaped("panels"), first: "One", second: "Two", ariaLabel: "Resize panels" } as unknown as ResizablePanelsProps)} />);
    render(<DragDrop {...({ ...escaped("drop-zone"), children: "Drop files", onFiles: () => undefined } as unknown as DragDropProps)} />);
    render(<SortableList {...({ ...escaped("sortable"), items: [{ id: "one", value: "One" }], renderItem: (value: string) => value, onReorder: () => undefined, ariaLabel: "Priority" } as unknown as SortableListProps<string>)} />);
    render(<ExpandableText {...({ ...escaped("expandable"), children: "Long description" } as unknown as ExpandableTextProps)} />);

    const owners = [
      ["virtual-list", "VirtualList"],
      ["tree", "Tree"],
      ["tree-table", "TreeTable"],
      ["calendar", "Calendar"],
      ["scheduler", "Scheduler"],
      ["chart", "BarChart"],
      ["carousel", "Carousel"],
      ["panels", "ResizablePanels"],
      ["drop-zone", "DragDrop"],
      ["sortable", "SortableList"],
      ["expandable", "ExpandableText"],
    ] as const;

    owners.forEach(([testId, owner]) => {
      const root = screen.getByTestId(testId);
      expectClosedRoot(root, owner);
      fireEvent.mouseEnter(root);
    });
    expect(onMouseEnter).toHaveBeenCalledTimes(owners.length);
  });

  it("owns Tree selection and expansion in uncontrolled mode", async () => {
    const user = userEvent.setup();
    const valueChanges: string[] = [];
    const expandedChanges: string[][] = [];
    render(
      <Tree
        nodes={treeNodes}
        ariaLabel="Account tree"
        onValueChange={(value) => valueChanges.push(value)}
        onExpandedChange={(ids) => expandedChanges.push(ids)}
      />,
    );

    const account = screen.getByRole("button", { name: "Account", exact: true });
    await user.click(account);
    expect(account).toHaveAttribute("aria-pressed", "true");
    expect(valueChanges).toEqual(["account"]);

    await user.click(screen.getByRole("button", { name: "展开 Account" }));
    expect(screen.getByRole("button", { name: "Profile", exact: true })).toBeVisible();
    expect(expandedChanges).toEqual([["account"]]);
  });

  it("owns TreeTable expansion in uncontrolled mode", async () => {
    const user = userEvent.setup();
    const changes: string[][] = [];
    render(
      <TreeTable
        nodes={treeTableNodes}
        columns={treeTableColumns}
        treeColumnId="name"
        ariaLabel="Account rows"
        getRowLabel={(node) => node.value.name}
        onExpandedChange={(ids) => changes.push(ids)}
      />,
    );

    await user.click(screen.getByRole("button", { name: "展开 Account" }));

    expect(screen.getByText("Profile")).toBeVisible();
    expect(changes).toEqual([["account"]]);
  });

  it("owns Calendar selection in uncontrolled mode", async () => {
    const user = userEvent.setup();
    const changes: Date[] = [];
    render(
      <Calendar
        month={month}
        locale="en-US"
        onValueChange={(date) => changes.push(date)}
      />,
    );

    const day = screen.getByRole("button", { name: "September 15, 2026" });
    await user.click(day);

    expect(day.closest("[role='gridcell']")).toHaveAttribute("aria-selected", "true");
    expect(changes).toHaveLength(1);
    expect(changes[0].getFullYear()).toBe(2026);
    expect(changes[0].getMonth()).toBe(8);
    expect(changes[0].getDate()).toBe(15);
    expect(changes[0].getHours()).toBe(0);
  });

  it("owns Carousel selection in uncontrolled mode", async () => {
    const user = userEvent.setup();
    const changes: string[] = [];
    render(
      <Carousel
        slides={slides}
        ariaLabel="Highlights"
        defaultValue="overview"
        onValueChange={(value) => changes.push(value)}
      />,
    );

    const carousel = screen.getByRole("region", { name: "Highlights" });
    expect(within(carousel).getByText("Overview content")).toBeVisible();
    await user.click(within(carousel).getByRole("button", { name: "下一项" }));

    expect(within(carousel).getByText("Security content")).toBeVisible();
    expect(changes).toEqual(["security"]);
  });

  it("reports controlled changes without mutating controlled state", async () => {
    const user = userEvent.setup();
    const treeValueChange = vi.fn();
    const treeExpandedChange = vi.fn();
    const carouselChange = vi.fn();
    render(
      <>
        <Tree
          nodes={treeNodes}
          ariaLabel="Controlled account tree"
          value="profile"
          onValueChange={treeValueChange}
          expandedIds={[]}
          onExpandedChange={treeExpandedChange}
        />
        <Carousel
          slides={slides}
          ariaLabel="Controlled highlights"
          value="overview"
          onValueChange={carouselChange}
        />
      </>,
    );

    const tree = screen.getByRole("tree", { name: "Controlled account tree" });
    await user.click(within(tree).getByRole("button", { name: "Account", exact: true }));
    await user.click(within(tree).getByRole("button", { name: "展开 Account" }));
    expect(within(tree).getByRole("button", { name: "Account", exact: true })).toHaveAttribute("aria-pressed", "false");
    expect(within(tree).queryByRole("button", { name: "Profile", exact: true })).toBeNull();
    expect(treeValueChange).toHaveBeenCalledWith("account");
    expect(treeExpandedChange).toHaveBeenCalledWith(["account"]);

    const carousel = screen.getByRole("region", { name: "Controlled highlights" });
    await user.click(within(carousel).getByRole("button", { name: "下一项" }));
    expect(within(carousel).getByText("Overview content")).toBeVisible();
    expect(carouselChange).toHaveBeenCalledWith("security");
  });

  it("rejects contradictory state props for every migrated state family", () => {
    expectDevelopmentError(
      () => render(createElement(Tree, {
        nodes: treeNodes,
        ariaLabel: "Account tree",
        value: "account",
        defaultValue: "profile",
        onValueChange: () => undefined,
      } as unknown as TreeProps)),
      /Tree cannot receive both value and defaultValue/,
    );
    expectDevelopmentError(
      () => render(createElement(Tree, {
        nodes: treeNodes,
        ariaLabel: "Account tree",
        expandedIds: ["account"],
        defaultExpandedIds: [],
        onExpandedChange: () => undefined,
      } as unknown as TreeProps)),
      /Tree cannot receive both expandedIds and defaultExpandedIds/,
    );
    expectDevelopmentError(
      () => render(createElement(TreeTable, {
        nodes: treeTableNodes,
        columns: treeTableColumns,
        treeColumnId: "name",
        ariaLabel: "Account rows",
        expandedIds: ["account"],
        defaultExpandedIds: [],
        onExpandedChange: () => undefined,
      } as unknown as TreeTableProps<{ name: string }>)),
      /TreeTable cannot receive both expandedIds and defaultExpandedIds/,
    );
    expectDevelopmentError(
      () => render(createElement(Calendar, {
        month,
        value: new Date(2026, 8, 15),
        defaultValue: new Date(2026, 8, 16),
        onValueChange: () => undefined,
      } as unknown as CalendarProps)),
      /Calendar cannot receive both value and defaultValue/,
    );
    expectDevelopmentError(
      () => render(createElement(Carousel, {
        slides,
        ariaLabel: "Highlights",
        value: "overview",
        defaultValue: "security",
        onValueChange: () => undefined,
      } as unknown as CarouselProps)),
      /Carousel cannot receive both value and defaultValue/,
    );
  });

  it("requires callbacks for controlled expanded state", () => {
    expectDevelopmentError(
      () => render(createElement(Tree, {
        nodes: treeNodes,
        ariaLabel: "Account tree",
        expandedIds: ["account"],
      } as unknown as TreeProps)),
      /Tree requires onExpandedChange when expandedIds is controlled/,
    );
    expectDevelopmentError(
      () => render(createElement(TreeTable, {
        nodes: treeTableNodes,
        columns: treeTableColumns,
        treeColumnId: "name",
        ariaLabel: "Account rows",
        expandedIds: ["account"],
      } as unknown as TreeTableProps<{ name: string }>)),
      /TreeTable requires onExpandedChange when expandedIds is controlled/,
    );
  });
});
