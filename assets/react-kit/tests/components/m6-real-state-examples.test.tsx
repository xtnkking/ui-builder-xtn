import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import inputCase from "../../src/explorer/cases/input/text-input.case";
import tableCase from "../../src/explorer/cases/data/data-table.case";
import searchCase from "../../src/explorer/cases/input/search-input.case";
import textareaCase from "../../src/explorer/cases/input/textarea.case";
import { StatePreview } from "../../src/explorer/cases/state-preview";
import { Input } from "../../src/personal-ui";
import type { ExplorerCase, ExplorerCaseState } from "../../src/explorer/cases/types";

afterEach(cleanup);

function example(componentCase: ExplorerCase, state: ExplorerCaseState) {
  const fixture = componentCase.stateExamples?.find((item) => item.state === state);
  if (!fixture) throw new Error(`Missing ${componentCase.id}:${state}`);
  return fixture.content;
}

describe("real Explorer state fixtures", () => {
  it("renders actual invalid text and password controls with visible error messages", () => {
    const { container } = render(example(inputCase, "validation"));
    const inputs = container.querySelectorAll("input");
    expect(inputs).toHaveLength(2);
    for (const input of inputs) expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("请输入有效的邮箱地址。")).toBeVisible();
    expect(screen.getByText("密码至少需要八个字符。")).toBeVisible();
    expect(screen.getByRole("button", { name: "显示密码" })).toBeVisible();
  });

  it("preserves disabled, read-only, and uncontrolled modes for both input exports", async () => {
    let rendered = render(example(inputCase, "disabled"));
    for (const input of rendered.container.querySelectorAll("input")) expect(input).toBeDisabled();
    rendered.unmount();
    rendered = render(example(inputCase, "readOnly"));
    for (const input of rendered.container.querySelectorAll("input")) expect(input).toHaveAttribute("readonly");
    rendered.unmount();
    rendered = render(example(inputCase, "uncontrolled"));
    const input = screen.getByLabelText("默认账号（内部管理输入值）");
    await userEvent.setup().type(input, ".updated");
    expect(input).toHaveValue("default@example.com.updated");
  });

  it("exercises the long-value password eye and keeps exactly one visibility action", async () => {
    const { container } = render(example(inputCase, "longContent"));
    const password = container.querySelector('input[type="password"]') as HTMLInputElement;
    expect(password.value.length).toBeGreaterThan(60);
    await userEvent.setup().click(screen.getByRole("button", { name: "显示密码" }));
    expect(password).toHaveAttribute("type", "text");
    expect(screen.getAllByRole("button", { name: "隐藏密码" })).toHaveLength(1);
  });

  it("uses a real dark theme, locale, and modal host with working dismissal", async () => {
    const rendered = render(<StatePreview state="dark"><Input aria-label="主题输入" /></StatePreview>);
    expect(screen.getByLabelText("主题输入").closest('[data-color-scheme="dark"]')).not.toBeNull();
    rendered.unmount();
    render(example(inputCase, "locale"));
    expect(screen.getByRole("button", { name: "Show password" })).toBeVisible();
    cleanup();
    render(example(inputCase, "overlay"));
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "在弹窗中查看此状态" }));
    const dialog = screen.getByRole("dialog", { name: "浮层内的组件" });
    expect(within(dialog).getByLabelText("账号")).toBeVisible();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("actually filters only on the explicit search command and sorts rendered rows", async () => {
    const { container } = render(tableCase.content);
    const table = screen.getByRole("table", { name: "账户列表" });
    const rowNames = () => within(table).getAllByRole("row").slice(1).map((row) => row.textContent);
    const beforeSort = rowNames();
    const user = userEvent.setup();
    await user.click(within(table).getByRole("button", { name: /账户/ }));
    expect(rowNames()).not.toEqual(beforeSort);
    const beforeTyping = rowNames();
    await user.type(screen.getByLabelText("账户、负责人或状态"), "英国");
    expect(rowNames()).toEqual(beforeTyping);
    await user.click(screen.getByRole("button", { name: "搜索" }));
    expect(within(table).getByText("英国市场推广账户")).toBeVisible();
    expect(within(table).getAllByRole("row")).toHaveLength(2);
    expect(container.querySelector('[data-pui-owner="DataTable"]')).toBeInTheDocument();
  });

  it("renders separate table loading, empty, and recoverable error examples", async () => {
    let rendered = render(example(tableCase, "loading"));
    expect(rendered.container.querySelector('[data-pui-owner="DataTable"]')).toHaveAttribute("aria-busy", "true");
    rendered.unmount();
    rendered = render(example(tableCase, "empty"));
    expect(screen.getByText("没有匹配账户")).toBeVisible();
    expect(screen.getByText("目录中暂时没有文件。")).toBeVisible();
    rendered.unmount();
    render(example(tableCase, "error"));
    expect(screen.getByText("账户加载失败")).toBeVisible();
    await userEvent.setup().click(screen.getByRole("button", { name: "重试" }));
    expect(screen.getByRole("table", { name: "重试后的账户" })).toBeVisible();
    expect(screen.queryByText("账户加载失败")).not.toBeInTheDocument();
  });

  it("renders SearchInput and Textarea invalid fixtures as controls, not coverage labels", () => {
    render(example(searchCase, "validation"));
    expect(screen.getByRole("searchbox")).toHaveAttribute("aria-invalid", "true");
    cleanup();
    render(example(textareaCase, "validation"));
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("请补充变更原因。")).toBeVisible();
  });
});
