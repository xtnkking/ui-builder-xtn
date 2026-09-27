// @personal-ui-coverage {"kind":"unit","runner":"components","exports":["DataTable"]}
import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  DataTable,
  type DataColumn,
  type DataTableProps,
} from "../../src/personal-ui";

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
    "data-pui-owner": "Consumer",
    "data-pui-slot": "foreign",
    "data-pui-private": "foreign",
    "data-state": "consumer",
    "data-testid": testId,
    "data-track": "preserved",
    "aria-describedby": "accounts-description",
    onMouseEnter,
  };
}

function expectClosedRoot(root: HTMLElement, expectedState: "ready" | "empty") {
  expect(root).toHaveClass("pui-data-table");
  expect(root).not.toHaveClass("foreign-table");
  expect(root).not.toHaveAttribute("style");
  expect(root).not.toHaveAttribute("css");
  expect(root).not.toHaveAttribute("sx");
  expect(root).not.toHaveAttribute("tw");
  expect(root).not.toHaveAttribute("data-pui-slot");
  expect(root).not.toHaveAttribute("data-pui-private");
  expect(root).toHaveAttribute("data-pui-owner", "DataTable");
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
    expect(root).toHaveClass("pui-data-table--empty");
    expect(screen.getByText("没有匹配数据")).toBeInTheDocument();
    fireEvent.mouseEnter(root);
    expect(onMouseEnter).toHaveBeenCalledTimes(1);
    expect(rawProps).toEqual(originalProps);
  });
});
