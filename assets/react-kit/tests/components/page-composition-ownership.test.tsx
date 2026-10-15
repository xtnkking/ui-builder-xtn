// @ui-coverage {"kind":"unit","runner":"components","exports":["MemberManagementPage","ListManagementPage","FilterBar","DataTable"]}
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MemberManagementPage, type MemberResult } from "../../src/ui";
import { ScopedListExample } from "../../src/explorer/cases/pattern/list-filter.case";

const result: MemberResult = {
  items: [{ id: "m1", name: "林夏", email: "lin@example.com", team: "平台", role: "editor", status: "joined", joinedAt: "2026-09-20" }],
  total: 317,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((accept, fail) => { resolve = accept; reject = fail; });
  return { promise, resolve, reject };
}

describe("page composition ownership", () => {
  it("gives the member pager sole ownership of the result total across loading, success and cached failure", async () => {
    const user = userEvent.setup();
    const initial = deferred<MemberResult>();
    const later = deferred<MemberResult>();
    const fetchMembers = vi.fn().mockReturnValueOnce(initial.promise).mockReturnValueOnce(later.promise);
    render(<MemberManagementPage fetchMembers={fetchMembers} />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByText("正在加载成员数据")).toBeInTheDocument();
    await act(async () => { initial.resolve(result); });

    const pager = screen.getByRole("navigation", { name: "数据分页" });
    expect(within(pager).getByText(/317 条结果/)).toBeInTheDocument();
    expect(screen.getAllByText(/317/)).toHaveLength(1);
    expect(screen.getByText("首次加载完成")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "查询", exact: true }));
    expect(screen.getByText("正在加载成员数据")).toBeInTheDocument();
    expect(screen.getAllByText(/317/)).toHaveLength(1);
    await act(async () => { later.reject(new Error("offline")); });

    expect(screen.queryByText("查询失败，仍显示上一次结果")).toBeNull();
    expect(screen.getByRole("table", { name: "成员数据" })).toHaveTextContent("林夏");
    expect(screen.queryAllByText(/317/)).toHaveLength(0);
    expect(fetchMembers).toHaveBeenCalledTimes(2);
  });

  it("leaves the member result summary empty when DataTable owns initial failure feedback", async () => {
    const initial = deferred<MemberResult>();
    const view = render(<MemberManagementPage fetchMembers={() => initial.promise} />);
    await act(async () => { initial.reject(new Error("offline")); });
    expect(view.container.querySelector(".ui-result-summary > span")).toBeEmptyDOMElement();
    expect(screen.queryByText("查询失败，暂无可显示结果")).toBeNull();
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getByRole("alert")).toHaveClass("ui-toast");
    expect(screen.getByRole("columnheader", { name: "成员" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "重试" })).toHaveLength(1);
  });

  it("keeps the concrete service and list requests independent with one heading and one total", async () => {
    const user = userEvent.setup();
    render(<ScopedListExample />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    const service = screen.getByRole("region", { name: "服务状态" });
    const listFilters = screen.getByRole("form", { name: "任务列表筛选" });
    expect(screen.getAllByRole("button", { name: "查询任务" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "检查服务状态" })).toHaveLength(1);

    await user.click(within(service).getByRole("button", { name: "检查服务状态" }));
    expect(within(service).getByRole("button")).toHaveAttribute("aria-busy", "true");
    const serviceStatus = await within(service).findByText(/服务正常 · 服务状态更新于/);
    const successfulServiceStatus = serviceStatus.textContent;
    expect(within(listFilters).getByRole("status")).toHaveTextContent("任务列表：演示初始数据");

    await user.type(screen.getByRole("searchbox", { name: "任务名称" }), "库存");
    await user.click(within(listFilters).getByRole("button", { name: "查询任务" }));
    await within(listFilters).findByText(/任务列表更新于/);
    expect(serviceStatus).toHaveTextContent(successfulServiceStatus!);
    const table = screen.getByRole("table", { name: "任务列表" });
    expect(table).toHaveTextContent("同步商品库存");
    expect(table).not.toHaveTextContent("核对订单金额");
    const pager = screen.getByRole("navigation", { name: "数据分页" });
    expect(within(pager).getByText(/1 条结果/)).toBeInTheDocument();
    expect(screen.getAllByText(/1 条结果/)).toHaveLength(1);
  });
});
