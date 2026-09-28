// @personal-ui-coverage {"kind":"unit","runner":"components","exports":["FileUpload"]}
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FileUpload, Form, type FileUploadItem } from "../../src/personal-ui";

const items: FileUploadItem[] = [
  { id: "queued", name: "queued.txt", status: "queued" },
  { id: "uploading", name: "uploading.txt", status: "uploading", progress: 50 },
  { id: "failed", name: "failed.txt", status: "error", error: "Upload failed" },
  { id: "complete", name: "complete.txt", status: "success", value: "remote/complete" },
  { id: "complete-fallback", name: "fallback.txt", status: "success" },
];

describe("FileUpload ownership and form contract", () => {
  it("serializes only successful items and requires a success, not a queued or failed item", () => {
    const view = render(
      <Form aria-label="Documents">
        <FileUpload name="documents" required items={items} onFiles={() => undefined} />
      </Form>,
    );
    const form = screen.getByRole("form", { name: "Documents" }) as HTMLFormElement;
    expect(Array.from(new FormData(form).entries())).toEqual([
      ["documents", "remote/complete"],
      ["documents", "complete-fallback"],
    ]);
    expect(form.checkValidity()).toBe(true);

    view.rerender(
      <Form aria-label="Documents">
        <FileUpload name="documents" required items={items.filter((item) => item.status !== "success")} onFiles={() => undefined} />
      </Form>,
    );
    expect(Array.from(new FormData(form).entries())).toEqual([]);
    expect(form.checkValidity()).toBe(false);
    expect(form.reportValidity()).toBe(false);
    expect(screen.getByRole("button", { name: "选择文件" })).toHaveFocus();
  });

  it("passes validated selections to the caller without creating upload state", () => {
    const onFiles = vi.fn();
    const onRejected = vi.fn();
    const view = render(
      <FileUpload items={[items[0]]} onFiles={onFiles} onRejected={onRejected} accept="image/png" maxSize={4} maxFiles={3} />,
    );
    const good = new File(["ok"], "good.png", { type: "image/png" });
    const wrongType = new File(["x"], "bad.txt", { type: "text/plain" });
    const oversized = new File(["large"], "large.png", { type: "image/png" });
    const overCount = new File(["ok"], "another.png", { type: "image/png" });
    const beyondLimit = new File(["ok"], "extra.png", { type: "image/png" });
    fireEvent.drop(view.container.querySelector(".pui-file-upload__dropzone")!, {
      dataTransfer: { files: [good, wrongType, oversized, overCount, beyondLimit] },
    });

    expect(onFiles).toHaveBeenCalledExactlyOnceWith([good, overCount]);
    expect(onRejected.mock.calls[0][0].map((entry: { reason: string }) => entry.reason)).toEqual(["type", "size", "count"]);
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  it("blocks retry, removal, start and file drop when disabled", () => {
    const onFiles = vi.fn();
    const onRetry = vi.fn();
    const onRemove = vi.fn();
    const onStart = vi.fn();
    const view = render(
      <FileUpload disabled items={items} onFiles={onFiles} onRetry={onRetry} onRemove={onRemove} onStart={onStart} />,
    );
    expect(screen.getByRole("button", { name: "重试 failed.txt" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "移除 failed.txt" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "移除 complete.txt" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "选择文件" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "开始上传" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "重试 failed.txt" }));
    fireEvent.click(screen.getByRole("button", { name: "移除 failed.txt" }));
    fireEvent.click(screen.getByRole("button", { name: "开始上传" }));
    fireEvent.drop(view.container.querySelector(".pui-file-upload__dropzone")!, {
      dataTransfer: { files: [new File(["ok"], "good.png", { type: "image/png" })] },
    });
    expect(onFiles).not.toHaveBeenCalled();
    expect(onRetry).not.toHaveBeenCalled();
    expect(onRemove).not.toHaveBeenCalled();
    expect(onStart).not.toHaveBeenCalled();
  });
});
