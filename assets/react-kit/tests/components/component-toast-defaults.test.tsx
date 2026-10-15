// @ui-coverage {"kind":"unit","runner":"components","exports":["Banner","ConfirmDialog","Popconfirm","FamilyLoginPage","ToastProvider"]}
import { StrictMode, useState } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Banner, ConfirmDialog, FamilyLoginPage, Popconfirm, ToastProvider } from "../../src/ui";

const products = [{ id: "docs", name: "文档", accent: "#1769d2", headline: "文档", visual: <span /> }];
async function flush() { await act(async () => { await Promise.resolve(); }); }

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(performance, "now").mockImplementation(() => Date.now());
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
});
afterEach(async () => {
  cleanup();
  await flush();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("component-owned floating feedback defaults", () => {
  it("keeps one persistent Banner through StrictMode and updates inline content/actions without replay", async () => {
    const firstAction = vi.fn();
    const nextAction = vi.fn();
    const view = render(<StrictMode><Banner title="维护提示" sticky action={<button onClick={firstAction}>查看维护</button>}>今晚维护</Banner></StrictMode>);
    await flush();
    const card = screen.getByRole("status");
    expect(card).toHaveClass("ui-toast");
    expect(view.container.querySelector('[data-ui-owner="Banner"]')).toHaveAttribute("hidden");
    expect(view.container.querySelector(".ui-alert")).toBeNull();
    act(() => { vi.advanceTimersByTime(20_000); });
    expect(card).toBeInTheDocument();
    view.rerender(<StrictMode><Banner title="维护提示" action={<button onClick={nextAction}>查看维护</button>}>明晚维护</Banner></StrictMode>);
    await flush();
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status")).toBe(card);
    expect(card).toHaveTextContent("明晚维护");
    expect(card).not.toHaveTextContent("今晚维护");
    fireEvent.click(within(card).getByRole("button", { name: "查看维护" }));
    expect(nextAction).toHaveBeenCalledTimes(1);
    expect(firstAction).not.toHaveBeenCalled();
    fireEvent.click(within(card).getByRole("button", { name: "关闭通知：维护提示" }));
    view.rerender(<StrictMode><Banner title="维护提示">仍不重放</Banner></StrictMode>);
    await flush();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shares the provider capacity and removes an unmounted persistent Banner from its queue", async () => {
    const view = render(<ToastProvider maxVisible={1}>
      <Banner key="first">首条持续消息</Banner><Banner key="second">第二条持续消息</Banner>
    </ToastProvider>);
    await flush();
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent("首条持续消息");
    view.rerender(<ToastProvider maxVisible={1}><Banner key="second">第二条持续消息</Banner></ToastProvider>);
    await flush();
    expect(screen.getByRole("status")).toHaveTextContent("第二条持续消息");
    expect(document.querySelectorAll('[data-ui-owner="ToastProvider"]')).toHaveLength(1);
  });

  it("keeps ConfirmDialog open after failure with an interactive Toast and the original retry button", async () => {
    const onConfirm = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(undefined);
    function Example() {
      const [open, setOpen] = useState(true);
      return <ConfirmDialog open={open} onOpenChange={setOpen} title="删除记录" confirmLabel="删除" onConfirm={onConfirm} errorMessage="删除失败" />;
    }
    render(<Example />);
    const dialog = screen.getByRole("dialog", { name: "删除记录" });
    fireEvent.click(within(dialog).getByRole("button", { name: "删除", exact: true }));
    await flush();
    expect(screen.getByRole("dialog", { name: "删除记录" })).toBe(dialog);
    expect(dialog.querySelector(".ui-alert")).toBeNull();
    const notice = screen.getByRole("alert");
    expect(notice).toHaveTextContent("删除失败");
    expect(notice.closest("[inert]")).toBeNull();
    fireEvent.click(within(notice).getByRole("button"));
    expect(screen.getByRole("dialog", { name: "删除记录" })).toBe(dialog);
    fireEvent.click(within(dialog).getByRole("button", { name: "删除", exact: true }));
    await flush();
    expect(onConfirm).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("allows Popconfirm to retry the same synchronous failure without duplicate inline messages", async () => {
    const onConfirm = vi.fn(() => { throw new Error("offline"); });
    render(<Popconfirm triggerLabel="危险操作" ariaLabel="确认删除" title="删除记录" confirmLabel="删除" onConfirm={onConfirm} errorMessage="删除失败" />);
    fireEvent.click(screen.getByRole("button", { name: "确认删除", exact: true }));
    const panel = document.querySelector<HTMLElement>('[data-ui-owner="Popconfirm"]')!;
    fireEvent.click(within(panel).getByRole("button", { name: "删除", exact: true }));
    await flush();
    const first = screen.getByRole("alert");
    expect(panel.querySelector(".ui-alert")).toBeNull();
    fireEvent.click(within(first).getByRole("button"));
    fireEvent.click(within(panel).getByRole("button", { name: "删除", exact: true }));
    await flush();
    expect(onConfirm).toHaveBeenCalledTimes(2);
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getByRole("alert")).not.toBe(first);
    fireEvent.click(within(panel).getByRole("button", { name: "取消", exact: true }));
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "确认删除", exact: true }));
    await flush();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(onConfirm).toHaveBeenCalledTimes(2);
  });

  it("does not notify from an async confirmation failure after its owner unmounts", async () => {
    let reject!: (error: Error) => void;
    const pending = new Promise<void>((_resolve, fail) => { reject = fail; });
    const view = render(<ToastProvider><ConfirmDialog open onOpenChange={() => undefined} title="确认保存" onConfirm={() => pending} /></ToastProvider>);
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "确认", exact: true }));
    view.rerender(<ToastProvider><span>已经离开</span></ToastProvider>);
    await act(async () => { reject(new Error("late")); });
    await flush();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("keeps login field validation inline and sends only submission failures to Toast", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("账号已锁定"));
    const view = render(<FamilyLoginPage companyName="示例" products={products} onSubmit={onSubmit} />);
    const email = screen.getByRole("textbox", { name: /邮箱/ });
    const password = screen.getByLabelText(/密码/, { selector: "input" });
    const form = email.closest("form")!;
    fireEvent.submit(form);
    await flush();
    expect(screen.getByText("请输入有效的邮箱地址")).toBeInTheDocument();
    expect(document.querySelector(".ui-toast")).toBeNull();
    fireEvent.change(email, { target: { value: "person@example.com" } });
    fireEvent.change(password, { target: { value: "secret" } });
    fireEvent.submit(form);
    await flush();
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getByRole("alert")).toHaveTextContent("账号已锁定");
    expect(view.container.querySelector(".ui-alert")).toBeNull();
    fireEvent.change(password, { target: { value: "secret2" } });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows one persistent unavailable-login Toast and clears it when products become available", async () => {
    const view = render(<StrictMode><FamilyLoginPage companyName="示例" products={[]} onSubmit={() => undefined} /></StrictMode>);
    await flush();
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getByRole("alert")).toHaveTextContent("登录暂不可用");
    act(() => { vi.advanceTimersByTime(20_000); });
    expect(screen.getByRole("alert")).toBeInTheDocument();
    view.rerender(<StrictMode><FamilyLoginPage companyName="示例" products={products} onSubmit={() => undefined} /></StrictMode>);
    await flush();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("button", { name: "登录", exact: true })).toBeInTheDocument();
  });

  it("preserves the Toast pause-aware five-second clock for confirmation errors", async () => {
    render(<ConfirmDialog open onOpenChange={() => undefined} title="保存" onConfirm={() => { throw new Error("offline"); }} errorMessage="保存失败" />);
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "确认", exact: true }));
    await flush();
    const notice = screen.getByRole("alert");
    act(() => { vi.advanceTimersByTime(2000); });
    fireEvent.mouseEnter(notice);
    act(() => { vi.advanceTimersByTime(6000); });
    expect(notice).toBeInTheDocument();
    fireEvent.mouseLeave(notice);
    act(() => { vi.advanceTimersByTime(3000); });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
