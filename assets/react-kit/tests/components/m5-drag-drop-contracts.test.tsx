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
});
