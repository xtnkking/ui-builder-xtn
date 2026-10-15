// @ui-coverage {"kind":"unit","runner":"components","exports":["Pagination","DataTable"]}
import { createElement } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DataTable, LocaleProvider, Pagination, type PaginationProps } from "../../src/ui";

describe("Pagination cursor contract", () => {
  it("renders an unknown-total ordinal with only consumer-owned previous and next requests", async () => {
    const onPageChange = vi.fn();
    render(<Pagination mode="cursor" page={4} hasPreviousPage hasNextPage onPageChange={onPageChange} />);
    const nav = screen.getByRole("navigation", { name: "数据分页" });
    expect(within(nav).getAllByRole("button")).toHaveLength(2);
    expect(nav.querySelector('[aria-current="page"]')).toHaveTextContent("第 4 页");
    expect(nav).not.toHaveTextContent("结果");
    expect(nav).not.toHaveTextContent("/");
    await userEvent.click(within(nav).getByRole("button", { name: "上一页" }));
    await userEvent.click(within(nav).getByRole("button", { name: "下一页" }));
    expect(onPageChange.mock.calls).toEqual([[3, "previous"], [5, "next"]]);
    expect(nav.querySelector('[aria-current="page"]')).toHaveTextContent("第 4 页");
  });

  it("honors cursor availability independently of the displayed ordinal and keeps valid lower bounds", () => {
    const onPageChange = vi.fn();
    const view = render(<Pagination mode="cursor" page={8} hasPreviousPage={false} hasNextPage={false} onPageChange={onPageChange} />);
    expect(screen.getByRole("button", { name: "上一页" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "下一页" })).toBeDisabled();
    view.rerender(<Pagination mode="cursor" page={1} hasPreviousPage hasNextPage onPageChange={onPageChange} />);
    expect(screen.getByRole("button", { name: "上一页" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "下一页" })).not.toBeDisabled();
    view.rerender(<Pagination mode="cursor" page={Number.MAX_SAFE_INTEGER} hasPreviousPage hasNextPage onPageChange={onPageChange} />);
    expect(screen.getByRole("button", { name: "下一页" })).toBeDisabled();
  });

  it("keeps cursor target loading on its arrow and blocks page and size duplicates", () => {
    const onPageChange = vi.fn();
    const onPageSizeChange = vi.fn();
    const view = render(<Pagination mode="cursor" page={3} hasPreviousPage hasNextPage loadingPage={4}
      pageSize={20} onPageSizeChange={onPageSizeChange} onPageChange={onPageChange} />);
    const next = screen.getByRole("button", { name: "下一页" });
    expect(next).toHaveAttribute("data-loading", "true");
    expect(screen.getByRole("navigation")).toHaveAttribute("aria-busy", "true");
    fireEvent.click(next);
    fireEvent.click(screen.getByRole("button", { name: "上一页" }));
    fireEvent.click(screen.getByRole("combobox"));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onPageChange).not.toHaveBeenCalled();
    expect(onPageSizeChange).not.toHaveBeenCalled();
    view.rerender(<Pagination mode="cursor" page={3} hasPreviousPage hasNextPage loadingPageSize
      pageSize={20} onPageSizeChange={onPageSizeChange} onPageChange={onPageChange} />);
    expect(screen.getByRole("combobox")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("combobox")).toHaveTextContent("20 条");
    expect(screen.getByRole("button", { name: "下一页" })).not.toHaveAttribute("data-loading");
  });

  it("retains numbered jumps and real total summaries for existing callers", () => {
    const onPageChange = vi.fn();
    render(<Pagination page={2} pageCount={4} total={35} pageSize={10} onPageChange={onPageChange} />);
    expect(screen.getByRole("navigation")).toHaveTextContent("11-20 / 35 条结果");
    const current = screen.getByRole("button", { name: "第 2 页" });
    expect(current).toHaveAttribute("aria-current", "page");
    fireEvent.click(screen.getByRole("button", { name: "第 4 页" }));
    expect(onPageChange).toHaveBeenCalledWith(4, "page");
  });

  it("preserves cursor semantics and localized labels in the integrated table footer", () => {
    render(<LocaleProvider locale="en-US"><DataTable ariaLabel="Recent events"
      columns={[{ id: "name", header: "Event", cell: (row: { id: string; name: string }) => row.name }]}
      rows={[{ id: "one", name: "Project created" }]} rowKey={(row) => row.id}
      pagination={{ mode: "cursor", page: 2, hasPreviousPage: true, hasNextPage: false, onPageChange: vi.fn() }}
    /></LocaleProvider>);
    const table = screen.getByRole("table", { name: "Recent events" });
    const frame = table.closest(".ui-data-table__frame")!;
    const nav = within(frame as HTMLElement).getByRole("navigation", { name: "Data pagination" });
    expect(nav.querySelector('[aria-current="page"]')).toHaveTextContent("Page 2");
    expect(within(nav).getAllByRole("button")).toHaveLength(2);
    expect(within(nav).getByRole("button", { name: "Next page" })).toBeDisabled();
    expect(nav).not.toHaveTextContent("of");
  });

  it("rejects fabricated totals and missing cursor availability at the runtime boundary", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      expect(() => render(createElement(Pagination, { mode: "cursor", page: 1, pageCount: 99,
        hasPreviousPage: false, hasNextPage: true, onPageChange: vi.fn(),
      } as unknown as PaginationProps))).toThrow(/without pageCount or total/);
      expect(() => render(createElement(Pagination, { mode: "cursor", page: 1,
        onPageChange: vi.fn(),
      } as unknown as PaginationProps))).toThrow(/requires hasPreviousPage and hasNextPage/);
    } finally {
      consoleError.mockRestore();
    }
  });
});
