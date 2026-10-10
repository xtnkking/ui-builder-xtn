// @personal-ui-coverage {"kind":"unit","runner":"components","exports":["DragDrop"]}
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DragDrop } from "../../src/personal-ui";

describe("DragDrop file acceptance", () => {
  it("passes only accepted dropped files and reports rejected ones", () => {
    const onFiles = vi.fn();
    const onRejected = vi.fn();
    render(<DragDrop ariaLabel="Drop target" accept=".png,image/jpeg" onFiles={onFiles} onRejected={onRejected}>Drop files</DragDrop>);
    const accepted = new File(["ok"], "PHOTO.PNG", { type: "image/png" });
    const rejected = new File(["bad"], "archive.zip", { type: "application/zip" });
    fireEvent.drop(screen.getByRole("group", { name: "Drop target" }), { dataTransfer: { files: [accepted, rejected] } });
    expect(onFiles).toHaveBeenCalledWith([accepted]);
    expect(onRejected).toHaveBeenCalledWith([rejected]);
  });

  it("does not dispatch dropped files while disabled", () => {
    const onFiles = vi.fn();
    const onRejected = vi.fn();
    render(<DragDrop ariaLabel="Drop target" disabled onFiles={onFiles} onRejected={onRejected}>Drop files</DragDrop>);
    fireEvent.drop(screen.getByRole("group", { name: "Drop target" }), { dataTransfer: { files: [new File(["x"], "one.txt")] } });
    expect(onFiles).not.toHaveBeenCalled();
    expect(onRejected).not.toHaveBeenCalled();
  });

  it("owns one browse command and uses the same accept and single-file policy for selection and drop", () => {
    const onFiles = vi.fn();
    const onRejected = vi.fn();
    const view = render(<DragDrop ariaLabel="Drop target" accept=".csv,text/csv" multiple={false} onFiles={onFiles} onRejected={onRejected}>Files</DragDrop>);
    const input = view.container.querySelector<HTMLInputElement>("input[type=file]")!;
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(input).toHaveAttribute("tabindex", "-1");
    expect(input).toHaveAttribute("aria-hidden", "true");
    expect(input).not.toHaveAttribute("multiple");
    const suffix = new File(["a"], "a.csv", { type: "text/plain" });
    const mime = new File(["b"], "b.txt", { type: "text/csv" });
    const denied = new File(["c"], "c.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [denied, suffix, mime] } });
    expect(onFiles).toHaveBeenLastCalledWith([suffix]);
    expect(onRejected).toHaveBeenLastCalledWith([denied, mime]);
    expect(input).toHaveValue("");
    fireEvent.change(input, { target: { files: [suffix] } });
    expect(onFiles).toHaveBeenCalledTimes(2);
    fireEvent.drop(screen.getByRole("group", { name: "Drop target" }), { dataTransfer: { files: [denied, suffix, mime] } });
    expect(onFiles).toHaveBeenLastCalledWith([suffix]);
    expect(onRejected).toHaveBeenLastCalledWith([denied, mime]);
  });

  it("blocks forced file changes while disabled and can explicitly delegate browse without a duplicate command", () => {
    const onFiles = vi.fn();
    const onRejected = vi.fn();
    const view = render(<DragDrop disabled onFiles={onFiles} onRejected={onRejected}>Files</DragDrop>);
    expect(screen.getByRole("button")).toBeDisabled();
    const input = view.container.querySelector<HTMLInputElement>("input[type=file]")!;
    expect(input).toBeDisabled();
    fireEvent.change(input, { target: { files: [new File(["a"], "one.csv")] } });
    expect(onFiles).not.toHaveBeenCalled();
    expect(onRejected).not.toHaveBeenCalled();
    view.rerender(<DragDrop showBrowseButton={false} onFiles={onFiles}>Files</DragDrop>);
    expect(screen.queryByRole("button")).toBeNull();
    expect(view.container.querySelector("input[type=file]")).toBeNull();
  });
});
