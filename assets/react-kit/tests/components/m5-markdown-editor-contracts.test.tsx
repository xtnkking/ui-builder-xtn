// @personal-ui-coverage {"kind":"unit","runner":"components","exports":["MarkdownEditor","RichTextEditor"]}
import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MarkdownEditor, RichTextEditor } from "../../src/personal-ui";

afterEach(() => vi.restoreAllMocks());

describe("Markdown editor naming and source editing", () => {
  it("inserts Markdown delimiters into a controlled plain-text value", () => {
    function Editor() {
      const [value, setValue] = useState("hello world");
      return <MarkdownEditor value={value} onValueChange={setValue} aria-label="Markdown source" name="notes" />;
    }
    const view = render(<Editor />);
    const editor = screen.getByRole("textbox", { name: "Markdown source" }) as HTMLTextAreaElement;
    expect(view.container.querySelector('[data-pui-owner="MarkdownEditor"]')).not.toBeNull();
    expect(editor).toHaveAttribute("data-pui-owner", "MarkdownEditor");
    editor.setSelectionRange(6, 11);
    fireEvent.click(screen.getByRole("button", { name: "粗体" }));
    expect(editor).toHaveValue("hello **world**");
    expect(view.container.querySelector("strong")).toBeNull();
    editor.setSelectionRange(0, 5);
    fireEvent.click(screen.getByRole("button", { name: "插入链接" }));
    expect(editor).toHaveValue("[hello](https://) **world**");
  });

  it("preserves the old owner and warns once per deprecated instance in development", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const view = render(<RichTextEditor value="legacy" onValueChange={() => undefined} aria-label="Legacy source" />);
    expect(view.container.querySelector('[data-pui-owner="RichTextEditor"]')).not.toBeNull();
    expect(screen.getByRole("textbox", { name: "Legacy source" })).toHaveAttribute("data-pui-owner", "RichTextEditor");
    await waitFor(() => expect(warning).toHaveBeenCalledWith(expect.stringContaining("use MarkdownEditor")));
    const count = warning.mock.calls.length;
    view.rerender(<RichTextEditor value="updated" onValueChange={() => undefined} aria-label="Legacy source" />);
    expect(warning).toHaveBeenCalledTimes(count);
    view.unmount();

    render(<MarkdownEditor value="canonical" onValueChange={() => undefined} aria-label="Canonical source" />);
    expect(warning).toHaveBeenCalledTimes(count);
  });

  it("keeps editing actions inert while disabled or read-only", () => {
    const onValueChange = vi.fn();
    const view = render(<MarkdownEditor value="text" onValueChange={onValueChange} aria-label="Source" disabled />);
    expect(screen.getByRole("button", { name: "粗体" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "Source" })).toBeDisabled();
    view.rerender(<MarkdownEditor value="text" onValueChange={onValueChange} aria-label="Source" readOnly />);
    expect(screen.getByRole("button", { name: "粗体" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "Source" })).toHaveAttribute("readonly");
    expect(onValueChange).not.toHaveBeenCalled();
  });
});
