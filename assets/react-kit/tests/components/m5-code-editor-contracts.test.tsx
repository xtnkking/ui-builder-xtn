// @personal-ui-coverage {"kind":"unit","runner":"components","exports":["CodeEditor"]}
import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CodeEditor } from "../../src/personal-ui";

describe("CodeEditor keyboard ownership", () => {
  it("leaves Tab and Shift+Tab to native focus navigation by default", () => {
    const onValueChange = vi.fn();
    render(<CodeEditor value="one" onValueChange={onValueChange} aria-label="Source" />);
    const editor = screen.getByRole("textbox", { name: "Source" });
    expect(fireEvent.keyDown(editor, { key: "Tab" })).toBe(true);
    expect(fireEvent.keyDown(editor, { key: "Tab", shiftKey: true })).toBe(true);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("indents selected lines, outdents them and provides a keyboard exit", () => {
    function ControlledEditor() {
      const [value, setValue] = useState("one\ntwo\nthree");
      return <CodeEditor value={value} onValueChange={setValue} tabBehavior="indent" aria-label="Source" />;
    }
    render(<ControlledEditor />);
    const editor = screen.getByRole("textbox", { name: "Source" }) as HTMLTextAreaElement;
    editor.setSelectionRange(1, 7);
    expect(fireEvent.keyDown(editor, { key: "Tab" })).toBe(false);
    expect(editor).toHaveValue("  one\n  two\nthree");
    editor.setSelectionRange(1, 11);
    expect(fireEvent.keyDown(editor, { key: "Tab", shiftKey: true })).toBe(false);
    expect(editor).toHaveValue("one\ntwo\nthree");
    expect(editor).toHaveAttribute("aria-keyshortcuts", "Control+M");
    expect(editor).toHaveAccessibleDescription(/Control\+M/);
    expect(fireEvent.keyDown(editor, { key: "m", ctrlKey: true })).toBe(false);
    expect(fireEvent.keyDown(editor, { key: "Tab" })).toBe(true);
    expect(fireEvent.keyDown(editor, { key: "Tab", shiftKey: true })).toBe(true);
    expect(fireEvent.keyDown(editor, { key: "m", ctrlKey: true })).toBe(false);
    expect(fireEvent.keyDown(editor, { key: "Tab" })).toBe(false);
  });

  it("does not intercept IME, read-only or disabled editing, or upstream keyboard cancellation", () => {
    const onValueChange = vi.fn();
    const { rerender } = render(<CodeEditor value="one" onValueChange={onValueChange} tabBehavior="indent" aria-label="Source" />);
    const editor = screen.getByRole("textbox", { name: "Source" });
    fireEvent.compositionStart(editor);
    expect(fireEvent.keyDown(editor, { key: "Tab" })).toBe(true);
    fireEvent.compositionEnd(editor);
    rerender(<CodeEditor value="one" onValueChange={onValueChange} tabBehavior="indent" readOnly aria-label="Source" />);
    expect(fireEvent.keyDown(editor, { key: "Tab" })).toBe(true);
    rerender(<CodeEditor value="one" onValueChange={onValueChange} tabBehavior="indent" disabled aria-label="Source" />);
    expect(fireEvent.keyDown(editor, { key: "Tab" })).toBe(true);
    rerender(<CodeEditor value="one" onValueChange={onValueChange} tabBehavior="indent" onKeyDown={(event) => event.preventDefault()} aria-label="Source" />);
    expect(fireEvent.keyDown(editor, { key: "Tab" })).toBe(false);
    expect(onValueChange).not.toHaveBeenCalled();
  });
});
