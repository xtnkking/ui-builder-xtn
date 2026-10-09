import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import toastCase from "../../src/explorer/cases/feedback/toast.case";
import summaryCase from "../../src/explorer/cases/feedback/validation-summary.case";
import resultCase from "../../src/explorer/cases/feedback/result.case";
import type { ExplorerCase, ExplorerCaseState } from "../../src/explorer/cases/types";

afterEach(cleanup);
function fixture(componentCase: ExplorerCase, state: ExplorerCaseState) {
  const item = componentCase.stateExamples?.find((entry) => entry.state === state);
  if (!item) throw new Error(`Missing ${componentCase.id}:${state}`);
  return item.content;
}

describe("new feedback state fixtures", () => {
  it("sends real error and asynchronous action toasts instead of state labels", async () => {
    const user = userEvent.setup();
    render(fixture(toastCase, "loading"));
    await user.click(screen.getByRole("button", { name: "异步操作提示" }));
    const undo = screen.getByRole("button", { name: "撤销" });
    await user.click(undo);
    expect(undo).toHaveAttribute("aria-busy", "true");
    await waitFor(() => expect(screen.queryByText("文件已移至回收站")).not.toBeInTheDocument(), { timeout: 2500 });
    await user.click(screen.getByRole("button", { name: "右下错误胶囊" }));
    expect(screen.getByRole("alert")).toHaveTextContent("连接中断");
  });

  it("focuses the invalid field from the summary and renders nothing for no issues", async () => {
    const user = userEvent.setup();
    const view = render(fixture(summaryCase, "keyboard"));
    await user.click(screen.getByRole("button", { name: "请输入工作邮箱。" }));
    expect(screen.getByLabelText("工作邮箱")).toHaveFocus();
    expect(screen.getByLabelText("工作邮箱")).toHaveAttribute("aria-invalid", "true");
    view.unmount();
    render(fixture(summaryCase, "empty"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows actual recovery loading and handles a rejected async command", async () => {
    const view = render(fixture(resultCase, "loading"));
    const pending = screen.getAllByRole("button");
    expect(pending).toHaveLength(3);
    for (const button of pending) expect(button).toHaveAttribute("aria-busy", "true");
    view.unmount();
    render(fixture(resultCase, "error"));
    await userEvent.setup().click(screen.getByRole("button", { name: "触发保存失败" }));
    expect(await screen.findByText("保存失败，请检查网络。")).toBeVisible();
  });
});
