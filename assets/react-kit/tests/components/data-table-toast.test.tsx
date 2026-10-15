// @ui-coverage {"kind":"unit","runner":"components","exports":["DataTable","ToastProvider"]}
import { StrictMode, useState } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DataTable, LocaleProvider, ToastProvider, type DataTableProps } from "../../src/ui";

type Row = { id: string; name: string };
const rows: Row[] = [{ id: "one", name: "Ada" }];
const columns = [{ id: "name", header: "Name", cell: (row: Row) => row.name }];
const base: DataTableProps<Row> = { ariaLabel: "Accounts", columns, rows, rowKey: (row) => row.id };
const page = { page: 1, pageCount: 2, total: 6, pageSize: 5, onPageChange: vi.fn() };

async function flushNotifications() {
  await act(async () => { await Promise.resolve(); });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(performance, "now").mockImplementation(() => Date.now());
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("DataTable component-owned failure feedback", () => {
  it("works without a provider and renders rich failure content only in one scoped toast", async () => {
    const view = render(<DataTable {...base} state="error" errorTitle={<strong>Unavailable</strong>}
      errorDescription={<em>Failure details</em>} onRetry={vi.fn()} pagination={page} />);
    await flushNotifications();
    const alert = screen.getByRole("alert");
    expect(alert).toHaveClass("ui-toast");
    expect(alert).toHaveTextContent("Accounts：Unavailable");
    expect(screen.getAllByText("Failure details")).toHaveLength(1);
    expect(view.container.querySelector(".ui-alert")).toBeNull();
    expect(screen.getAllByRole("button", { name: "重试" })).toHaveLength(1);
  });

  it("uses the existing provider's shared visible limit and queue", async () => {
    render(<ToastProvider maxVisible={1}>
      <DataTable {...base} state="error" errorDescription="First table failure" />
      <DataTable {...base} ariaLabel="Orders" state="error" errorDescription="Second table failure" />
    </ToastProvider>);
    await flushNotifications();
    expect(document.querySelectorAll('[data-ui-owner="ToastProvider"]')).toHaveLength(1);
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getByRole("alert")).toHaveTextContent("First table failure");
    fireEvent.click(within(screen.getByRole("alert")).getByRole("button"));
    expect(screen.getByRole("alert")).toHaveTextContent("Second table failure");
  });

  it("does not repeat an error across StrictMode effect replay or fresh inline ReactNodes", async () => {
    const view = render(<StrictMode><DataTable {...base} state="error"
      errorTitle={<strong>Unavailable</strong>} errorDescription={<span>Same failure</span>} /></StrictMode>);
    await flushNotifications();
    view.rerender(<StrictMode><DataTable {...base} state="error"
      errorTitle={<strong>Unavailable</strong>} errorDescription={<span>Same failure</span>} /></StrictMode>);
    await flushNotifications();
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getAllByText("Same failure")).toHaveLength(1);
    act(() => { vi.advanceTimersByTime(5000); });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("dismisses after five seconds without reappearing while the same failure remains", async () => {
    const view = render(<DataTable {...base} state="error" />);
    await flushNotifications();
    act(() => { vi.advanceTimersByTime(4999); });
    expect(screen.getByRole("alert")).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(1); });
    expect(screen.queryByRole("alert")).toBeNull();
    view.rerender(<DataTable {...base} state="error" errorDescription={<span>Same episode, new node</span>} />);
    await flushNotifications();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("allows a new toast after retry failure and removes it after recovery", async () => {
    function Example() {
      const [state, setState] = useState<"error" | "loading" | "ready">("error");
      return <>
        <button onClick={() => setState("error")}>Fail request</button>
        <button onClick={() => setState("ready")}>Recover request</button>
        <DataTable {...base} state={state} onRetry={() => setState("loading")} pagination={page} />
      </>;
    }
    render(<Example />);
    await flushNotifications();
    fireEvent.click(screen.getByRole("button", { name: "重试" }));
    expect(screen.queryByRole("alert")).toBeNull();
    await act(async () => { await Promise.resolve(); });
    fireEvent.click(screen.getByRole("button", { name: "Fail request" }));
    await flushNotifications();
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Recover request" }));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("table")).toHaveTextContent("Ada");
  });

  it("shows a new external refresh failure while the previous toast is still exiting", async () => {
    // Keep the real Toast presence alive long enough to exercise overlapping failure episodes.
    const timing = document.createElement("style");
    timing.textContent = ".ui-toast { --ui-motion-enter: 0ms; --ui-motion-exit: 140ms; }";
    document.head.append(timing);
    function Example() {
      const [state, setState] = useState<"error" | "loading">("error");
      const [failure, setFailure] = useState(1);
      return <>
        <button onClick={() => setState("loading")}>Refresh externally</button>
        <button onClick={() => { setFailure((current) => current + 1); setState("error"); }}>Fail externally</button>
        <DataTable {...base} state={state} errorDescription={`External failure ${failure}`} pagination={page} />
      </>;
    }
    try {
      render(<Example />);
      await flushNotifications();
      const previous = screen.getByText("External failure 1").closest(".ui-toast");
      fireEvent.click(screen.getByRole("button", { name: "Refresh externally" }));
      expect(previous).toHaveAttribute("data-exiting", "true");
      fireEvent.click(screen.getByRole("button", { name: "Fail externally" }));
      await flushNotifications();
      expect(screen.getByText("External failure 2").closest(".ui-toast")).not.toHaveAttribute("data-exiting");
      act(() => { vi.advanceTimersByTime(190); });
      expect(screen.queryByText("External failure 1")).toBeNull();
      expect(screen.getByText("External failure 2")).toBeInTheDocument();
    } finally {
      cleanup();
      timing.remove();
    }
  });

  it("keeps retry available when the current callback throws synchronously", async () => {
    const onRetry = vi.fn(() => { throw new Error("offline"); });
    render(<DataTable {...base} state="error" onRetry={onRetry} pagination={page} />);
    await flushNotifications();
    fireEvent.click(screen.getByRole("button", { name: "重试" }));
    await flushNotifications();
    expect(screen.getByRole("button", { name: "重试" })).not.toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "重试" }));
    await flushNotifications();
    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });

  it("preserves an empty failed table's header, fixed viewport and pagination without claiming success or no matches", async () => {
    const view = render(<DataTable {...base} rows={[]} state="error" onRetry={vi.fn()} pagination={page} />);
    await flushNotifications();
    expect(screen.getByRole("columnheader", { name: "Name" })).toBeInTheDocument();
    expect(screen.getByText("数据加载失败")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "数据分页" })).toBeInTheDocument();
    expect(view.container.querySelector(".ui-data-table__frame")).toHaveStyle({ "--ui-data-table-desktop-viewport-height": "332px" });
    expect(screen.queryByText("没有匹配数据")).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent("数据未能加载，请重试。");
    expect(screen.getByRole("alert")).not.toHaveTextContent("上一次成功");
    expect(screen.getAllByRole("button", { name: "重试" })).toHaveLength(1);
  });

  it("retains rows and uses localized in-frame status with one shared retry for desktop/mobile layouts", async () => {
    const view = render(<LocaleProvider locale="en-US"><DataTable {...base} state="error"
      mobileRow={(row) => row.name} viewportRows={5} onRetry={vi.fn()} /></LocaleProvider>);
    await flushNotifications();
    expect(screen.getByRole("table", { name: "Accounts" })).toHaveTextContent("Ada");
    expect(screen.getByText("Refresh failed; previous data retained")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Retry" })).toHaveLength(1);
    expect(view.container.querySelector(".ui-data-table__frame--error-footer")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Accounts：Unable to load data");
  });
});
