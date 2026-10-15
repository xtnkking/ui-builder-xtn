// @ui-coverage {"kind":"unit","runner":"components","exports":["DataTable"]}
import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  DataTable,
  type DataColumn,
  type DataTableProps,
} from "../../src/ui";

type Row = {
  id: string;
  name: string;
};

const columns: DataColumn<Row>[] = [
  { id: "name", header: "Name", cell: (row) => row.name },
];

function escapedProps(testId: string, rows: Row[], onMouseEnter: () => void) {
  return {
    ariaLabel: "Accounts",
    columns,
    rows,
    rowKey: (row: Row) => row.id,
    className: "foreign-table",
    style: { color: "red", background: "magenta" },
    css: "foreign-css",
    sx: "foreign-sx",
    tw: "foreign-tw",
    dangerouslySetInnerHTML: { __html: "<b>unsafe</b>" },
    children: "Injected child",
    "data-ui-owner": "Consumer",
    "data-ui-slot": "foreign",
    "data-ui-private": "foreign",
    "data-state": "consumer",
    "data-testid": testId,
    "data-track": "preserved",
    "aria-describedby": "accounts-description",
    onMouseEnter,
  };
}

function expectClosedRoot(root: HTMLElement, expectedState: "ready" | "empty") {
  expect(root).toHaveClass("ui-data-table");
  expect(root).not.toHaveClass("foreign-table");
  expect(root).not.toHaveAttribute("style");
  expect(root).not.toHaveAttribute("css");
  expect(root).not.toHaveAttribute("sx");
  expect(root).not.toHaveAttribute("tw");
  expect(root).not.toHaveAttribute("data-ui-slot");
  expect(root).not.toHaveAttribute("data-ui-private");
  expect(root).toHaveAttribute("data-ui-owner", "DataTable");
  expect(root).toHaveAttribute("data-state", expectedState);
  expect(root).toHaveAttribute("data-track", "preserved");
  expect(root).toHaveAttribute("aria-describedby", "accounts-description");
  expect(root).not.toHaveTextContent("unsafe");
  expect(root).not.toHaveTextContent("Injected child");
}

describe("DataTable public-control contract", () => {
  it("filters runtime escape props from the ready table without losing root metadata or events", () => {
    const onMouseEnter = vi.fn();
    const rawProps = escapedProps("ready-table", [{ id: "row-1", name: "Ada" }], onMouseEnter);
    const originalProps = { ...rawProps };
    const RowTable = DataTable<Row>;

    render(createElement(RowTable, rawProps as unknown as DataTableProps<Row>));

    const root = screen.getByTestId("ready-table");
    expectClosedRoot(root, "ready");
    expect(screen.getByRole("table", { name: "Accounts" })).toBeInTheDocument();
    expect(root).toHaveTextContent("Ada");
    fireEvent.mouseEnter(root);
    expect(onMouseEnter).toHaveBeenCalledTimes(1);
    expect(rawProps).toEqual(originalProps);
  });

  it("applies the same closed ownership contract to the empty-state branch", () => {
    const onMouseEnter = vi.fn();
    const rawProps = escapedProps("empty-table", [], onMouseEnter);
    const originalProps = { ...rawProps };
    const RowTable = DataTable<Row>;

    render(createElement(RowTable, rawProps as unknown as DataTableProps<Row>));

    const root = screen.getByTestId("empty-table");
    expectClosedRoot(root, "empty");
    expect(root).toHaveClass("ui-data-table--empty");
    expect(screen.getByText("没有匹配数据")).toBeInTheDocument();
    fireEvent.mouseEnter(root);
    expect(onMouseEnter).toHaveBeenCalledTimes(1);
    expect(rawProps).toEqual(originalProps);
  });
});

describe("DataTable viewport contract", () => {
  const rows: Row[] = Array.from({ length: 12 }, (_, index) => ({ id: `row-${index}`, name: `Account ${index}` }));
  const base = { ariaLabel: "Accounts", columns, rows, rowKey: (row: Row) => row.id };

  it.each([false, true])("keeps the default five-unit surface across sparse, loading, empty and error results (paginated=%s)", (paginated) => {
    const pagination = paginated ? { page: 1, pageCount: 3, total: 12, pageSize: 5, onPageChange: vi.fn() } : undefined;
    const view = render(<DataTable {...base} rows={rows.slice(0, 1)} pagination={pagination} />);
    const frame = () => view.container.querySelector(".ui-data-table__frame");
    const expectDefaultFrame = () => {
      expect(frame()).toHaveClass("ui-data-table__frame--fixed-viewport", "ui-data-table__frame--default-viewport");
      expect(frame()).toHaveStyle({ "--ui-data-table-desktop-viewport-height": "332px", "--ui-data-table-mobile-viewport-height": "380px" });
      expect(view.container.querySelectorAll(".ui-data-table__pagination")).toHaveLength(paginated ? 1 : 0);
    };
    expectDefaultFrame();
    expect(screen.getByRole("region", { name: "Accounts滚动区域" })).toHaveAttribute("tabindex", "0");
    view.rerender(<DataTable {...base} state="loading" pagination={pagination} />);
    expectDefaultFrame();
    expect(view.container.querySelectorAll("tbody tr")).toHaveLength(12);
    view.rerender(<DataTable {...base} rows={[]} state="empty" pagination={pagination} emptyAction={<span>调整条件</span>} />);
    expectDefaultFrame();
    expect(screen.getByText("调整条件")).toBeInTheDocument();
    expect(view.container.querySelector(".ui-data-table__empty-scroller")).toHaveAttribute("tabindex", "0");
    view.rerender(<DataTable {...base} rows={[]} state="error" pagination={pagination} onRetry={vi.fn()} />);
    expectDefaultFrame();
    expect(screen.getByRole("columnheader", { name: "Name" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重试", exact: true })).toBeInTheDocument();
    expect(frame()).toHaveClass(paginated ? "ui-data-table__frame--paginated" : "ui-data-table__frame--error-footer");
  });

  it("keeps numeric capacity explicit and makes content height an explicit auto opt-out", () => {
    const view = render(<DataTable {...base} viewportRows={3} mobileRow={(row) => row.name} />);
    const frame = view.container.querySelector(".ui-data-table__frame");
    expect(frame).toHaveStyle({ "--ui-data-table-desktop-viewport-height": "216px", "--ui-data-table-mobile-viewport-height": "228px" });
    expect(frame).toHaveClass("ui-data-table__frame--fixed-viewport");
    expect(frame).not.toHaveClass("ui-data-table__frame--default-viewport");
    expect(screen.getByRole("list", { name: "Accounts移动版" })).toHaveAttribute("tabindex", "0");
    view.rerender(<DataTable {...base} viewportRows="auto" mobileRow={(row) => row.name} />);
    expect(frame).not.toHaveClass("ui-data-table__frame--fixed-viewport");
    expect(frame).not.toHaveClass("ui-data-table__frame--default-viewport");
    expect((frame as HTMLElement).style.getPropertyValue("--ui-data-table-desktop-viewport-height")).toBe("");
    expect(view.container.querySelector(".ui-data-table__scroller")).not.toHaveAttribute("tabindex");
    expect(screen.getByRole("list", { name: "Accounts移动版" })).not.toHaveAttribute("tabindex");
  });

  it("resets default vertical scrolling for a new result while preserving horizontal column context", () => {
    const view = render(<DataTable {...base} mobileRow={(row) => row.name} />);
    const desktop = view.container.querySelector<HTMLElement>(".ui-data-table__scroller")!;
    const mobile = screen.getByRole("list", { name: "Accounts移动版" });
    desktop.scrollTop = 180;
    desktop.scrollLeft = 72;
    mobile.scrollTop = 120;
    view.rerender(<DataTable {...base} rows={rows.slice(1)} mobileRow={(row) => row.name} />);
    expect(desktop.scrollTop).toBe(0);
    expect(desktop.scrollLeft).toBe(72);
    expect(mobile.scrollTop).toBe(0);
  });
});
