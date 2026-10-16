// @ui-coverage {"kind":"unit","runner":"components","exports":["DataTable","DataTableProvider"]}
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DataTable, DataTableProvider, type DataColumn } from "../../src/ui";

type Row = { id: string; name: string };

const rows: Row[] = Array.from({ length: 20 }, (_, index) => ({
  id: `member-${index}`,
  name: `成员 ${index + 1}`,
}));
const columns: DataColumn<Row>[] = [{ id: "name", header: "姓名", cell: (row) => row.name }];
const rowKey = (row: Row) => row.id;

function frame(testId: string) {
  return screen.getByTestId(testId).querySelector<HTMLElement>(".ui-data-table__frame")!;
}

function expectCapacity(testId: string, desktop: string, mobile: string) {
  expect(frame(testId)).toHaveClass("ui-data-table__frame--fixed-viewport");
  expect(frame(testId)).toHaveStyle({
    "--ui-data-table-desktop-viewport-height": desktop,
    "--ui-data-table-mobile-viewport-height": mobile,
  });
}

describe("DataTable project height policy", () => {
  it("keeps one capacity across sparse, many, loading, empty and error results despite local auto or numeric requests", () => {
    render(
      <DataTableProvider viewportRows={7}>
        <DataTable data-testid="sparse" ariaLabel="代理池" columns={columns} rows={rows.slice(0, 1)} rowKey={rowKey}
          viewportRows="auto" pagination={{ page: 1, pageCount: 1, pageSize: 20, onPageChange: vi.fn() }} />
        <DataTable data-testid="many" ariaLabel="混合号码池" columns={columns} rows={rows} rowKey={rowKey} viewportRows={20} />
        <DataTable data-testid="loading" ariaLabel="加载中" columns={columns} rows={[]} rowKey={rowKey} state="loading" viewportRows="auto" />
        <DataTable data-testid="empty" ariaLabel="无匹配数据" columns={columns} rows={[]} rowKey={rowKey} state="empty" viewportRows={1} />
        <DataTable data-testid="error" ariaLabel="请求失败" columns={columns} rows={[]} rowKey={rowKey} state="error" onRetry={vi.fn()} viewportRows="auto" />
      </DataTableProvider>,
    );

    for (const id of ["sparse", "many", "loading", "empty", "error"]) {
      expectCapacity(id, "448px", "532px");
    }
    expect(screen.getByTestId("sparse").querySelectorAll("tbody tr")).toHaveLength(1);
    expect(screen.getByTestId("many").querySelectorAll("tbody tr")).toHaveLength(20);
    expect(screen.getByTestId("empty").querySelector(".ui-data-table__empty-scroller")).toHaveAttribute("tabindex", "0");
    expect(frame("error")).toHaveClass("ui-data-table__frame--error-footer");
  });

  it("isolates nested and sibling policies without inserting layout elements", () => {
    render(
      <section data-testid="scope-host">
        <DataTableProvider viewportRows={8}>
          <DataTable data-testid="outer" ariaLabel="外层" columns={columns} rows={rows} rowKey={rowKey} />
          <DataTableProvider>
            <DataTable data-testid="inner" ariaLabel="独立内层" columns={columns} rows={rows} rowKey={rowKey} viewportRows="auto" />
          </DataTableProvider>
          <DataTable data-testid="outer-after" ariaLabel="回到外层" columns={columns} rows={rows} rowKey={rowKey} viewportRows={2} />
        </DataTableProvider>
        <DataTableProvider viewportRows={3}>
          <DataTable data-testid="sibling" ariaLabel="独立范围" columns={columns} rows={rows} rowKey={rowKey} />
        </DataTableProvider>
      </section>,
    );

    expectCapacity("outer", "506px", "608px");
    expectCapacity("inner", "332px", "380px");
    expectCapacity("outer-after", "506px", "608px");
    expectCapacity("sibling", "216px", "228px");
    // Existing table feedback boundaries may emit hidden auxiliary siblings.
    // Each table must remain a direct child: the policy adds no layout wrapper.
    for (const id of ["outer", "inner", "outer-after", "sibling"]) {
      expect(screen.getByTestId(id).parentElement).toBe(screen.getByTestId("scope-host"));
    }
  });

  it("updates existing tables when project capacity changes and normalizes invalid or out-of-range policy", () => {
    const scope = (capacity: number) => (
      <DataTableProvider viewportRows={capacity}>
        <DataTable data-testid="dynamic" ariaLabel="动态容量" columns={columns} rows={rows} rowKey={rowKey} viewportRows="auto" />
      </DataTableProvider>
    );
    const view = render(scope(4));
    const originalRoot = screen.getByTestId("dynamic");
    const scroller = originalRoot.querySelector<HTMLElement>(".ui-data-table__scroller")!;
    expectCapacity("dynamic", "274px", "304px");
    scroller.scrollTop = 180;

    view.rerender(scope(6.9));
    expect(screen.getByTestId("dynamic")).toBe(originalRoot);
    expectCapacity("dynamic", "390px", "456px");
    expect(scroller.scrollTop).toBe(0);
    view.rerender(scope(-2));
    expectCapacity("dynamic", "100px", "76px");
    view.rerender(scope(200));
    expectCapacity("dynamic", "5842px", "7600px");
    view.rerender(scope(Number.NaN));
    expectCapacity("dynamic", "332px", "380px");
  });

  it("preserves explicit content height and independent numeric or default capacity outside any provider", () => {
    render(
      <>
        <DataTable data-testid="auto" ariaLabel="内容高度" columns={columns} rows={rows.slice(0, 1)} rowKey={rowKey}
          mobileRow={(row) => row.name} viewportRows="auto" />
        <DataTable data-testid="default" ariaLabel="默认容量" columns={columns} rows={[]} rowKey={rowKey} />
        <DataTable data-testid="numeric" ariaLabel="自选容量" columns={columns} rows={rows} rowKey={rowKey} viewportRows={3} />
      </>,
    );

    expect(frame("auto")).not.toHaveClass("ui-data-table__frame--fixed-viewport");
    expect(frame("auto").style.getPropertyValue("--ui-data-table-desktop-viewport-height")).toBe("");
    expect(screen.getByTestId("auto").querySelector(".ui-data-table__scroller")).not.toHaveAttribute("tabindex");
    expect(screen.getByRole("list", { name: "内容高度移动版" })).not.toHaveAttribute("tabindex");
    expectCapacity("default", "332px", "380px");
    expectCapacity("numeric", "216px", "228px");
  });
});
