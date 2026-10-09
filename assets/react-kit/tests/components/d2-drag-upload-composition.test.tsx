// @personal-ui-coverage {"kind":"unit","runner":"components","exports":["DragDrop","FileUpload"]}
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DragExample } from "../../src/explorer/cases/actions/drag.case";

function controls(container: HTMLElement) {
  const input = container.querySelector<HTMLInputElement>("input[type=file]");
  if (!input) throw new Error("The official FileUpload file input is missing.");
  const upload = container.querySelector<HTMLElement>("[data-pui-owner='FileUpload']");
  if (!upload) throw new Error("The official FileUpload owner is missing.");
  return { input, upload, drop: screen.getByRole("group", { name: "接收CSV文件" }) };
}

describe("D2 official shared file composition", () => {
  it("D2 shares the received queue and removes exactly one same-name identity", () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { container } = render(<DragExample />);
    const { input, upload, drop } = controls(container);
    fireEvent.change(input, { target: { files: [new File(["aa"], "same.csv", { type: "text/plain" })] } });
    fireEvent.drop(drop, { dataTransfer: { files: [new File(["bbbbbb"], "same.csv", { type: "application/octet-stream" })] } });
    expect(within(upload).getAllByRole("listitem")).toHaveLength(2);
    expect(within(upload).getAllByRole("listitem")[0]).toHaveTextContent("2 B");
    expect(within(upload).getAllByRole("listitem")[1]).toHaveTextContent("6 B");
    fireEvent.click(within(upload).getAllByRole("button", { name: "移除 same.csv" })[0]);
    expect(within(upload).getAllByRole("listitem")).toHaveLength(1);
    expect(within(upload).getByRole("listitem")).toHaveTextContent("6 B");
    expect(screen.getByLabelText("文件选择结果")).toHaveTextContent("已选入 1 个");
    expect(errors.mock.calls.filter((args) => /same key|unique.*key/i.test(args.map(String).join(" ")))).toEqual([]);
  });

  it("D2 preserves accept OR matching and gives both rejection paths visible feedback", () => {
    const { container } = render(<DragExample />);
    const { input, upload, drop } = controls(container);
    fireEvent.change(input, { target: { files: [
      new File(["a"], "suffix.csv", { type: "text/plain" }),
      new File(["b"], "mime.txt", { type: "text/csv" }),
      new File(["x"], "denied.txt", { type: "text/plain" }),
    ] } });
    expect(within(upload).getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByRole("alert", { name: "文件拒绝反馈" })).toHaveTextContent("denied.txt");
    fireEvent.drop(drop, { dataTransfer: { files: [
      new File(["c"], "drop.csv", { type: "application/octet-stream" }),
      new File(["d"], "drop.bin", { type: "text/csv" }),
      new File(["y"], "denied.png", { type: "image/png" }),
    ] } });
    expect(within(upload).getAllByRole("listitem")).toHaveLength(4);
    expect(screen.getByRole("alert", { name: "文件拒绝反馈" })).toHaveTextContent("denied.png");
    expect(within(upload).queryByText("denied.txt")).not.toBeInTheDocument();
    expect(within(upload).queryByText("denied.png")).not.toBeInTheDocument();
    expect(upload.querySelectorAll("[data-status='queued']")).toHaveLength(4);
    expect(upload.querySelector("[data-status='success']")).toBeNull();
  });

  it("D2 locks both inputs and removal without changing the shared queue or rejection feedback", () => {
    const { container } = render(<DragExample />);
    const { input, upload, drop } = controls(container);
    fireEvent.change(input, { target: { files: [new File(["a"], "retained.csv", { type: "text/csv" })] } });
    fireEvent.click(screen.getByRole("switch", { name: "锁定文件操作" }));
    expect(screen.getByRole("button", { name: "选择CSV文件" })).toBeDisabled();
    expect(input).toBeDisabled();
    expect(screen.getByRole("button", { name: "移除 retained.csv" })).toBeDisabled();
    const blocked = [new File(["b"], "blocked.csv", { type: "text/csv" }), new File(["x"], "blocked.png", { type: "image/png" })];
    fireEvent.change(input, { target: { files: blocked } });
    fireEvent.drop(drop, { dataTransfer: { files: blocked } });
    const zone = upload.querySelector(".pui-file-upload__dropzone");
    if (!zone) throw new Error("The official upload dropzone is missing.");
    fireEvent.drop(zone, { dataTransfer: { files: blocked } });
    fireEvent.click(screen.getByRole("button", { name: "移除 retained.csv" }));
    expect(within(upload).getAllByRole("listitem")).toHaveLength(1);
    expect(within(upload).getByRole("listitem")).toHaveTextContent("retained.csv");
    expect(screen.queryByRole("alert", { name: "文件拒绝反馈" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("switch", { name: "锁定文件操作" }));
    fireEvent.click(screen.getByRole("button", { name: "移除 retained.csv" }));
    expect(within(upload).queryAllByRole("listitem")).toHaveLength(0);
  });
});
