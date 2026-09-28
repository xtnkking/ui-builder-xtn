// @personal-ui-coverage {"kind":"unit","runner":"components","exports":["InlineEdit"]}
import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Field, Form, InlineEdit } from "../../src/personal-ui";

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((accept, decline) => {
    resolve = accept;
    reject = decline;
  });
  return { promise, resolve, reject };
}

describe("InlineEdit keyboard and persistence contract", () => {
  it("returns focus to Edit after Escape, Cancel, unchanged Save, and successful async Save", async () => {
    const pending = deferred();
    const onCommit = vi.fn(() => pending.promise);
    function Fixture() {
      const [value, setValue] = useState("Ada");
      return <InlineEdit value={value} onCommit={async (next) => { await onCommit(); setValue(next); }} />;
    }
    render(<Fixture />);
    const edit = () => screen.getByRole("button", { name: "编辑" });
    const input = () => screen.getByRole("textbox", { name: "编辑" });

    fireEvent.click(edit());
    expect(input()).toHaveFocus();
    fireEvent.keyDown(input(), { key: "Escape" });
    await waitFor(() => expect(edit()).toHaveFocus());

    fireEvent.click(edit());
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    await waitFor(() => expect(edit()).toHaveFocus());

    fireEvent.click(edit());
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(onCommit).not.toHaveBeenCalled();
    await waitFor(() => expect(edit()).toHaveFocus());

    fireEvent.click(edit());
    fireEvent.change(input(), { target: { value: "Grace" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(onCommit).toHaveBeenCalledOnce();
    expect(input()).not.toBeDisabled();
    expect(input()).toHaveAttribute("readonly");
    pending.resolve();
    await waitFor(() => expect(edit()).toHaveFocus());
    expect(screen.getByText("Grace")).toBeInTheDocument();
  });

  it("keeps rejected async edits available and returns focus to the input", async () => {
    const pending = deferred();
    render(<InlineEdit value="Ada" onCommit={() => pending.promise} />);
    fireEvent.click(screen.getByRole("button", { name: "编辑" }));
    const input = screen.getByRole("textbox", { name: "编辑" });
    fireEvent.change(input, { target: { value: "Grace" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    pending.reject(new Error("服务器繁忙"));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("服务器繁忙"));
    expect(input).toHaveFocus();
    expect(input).not.toHaveAttribute("readonly");
    expect(input).toHaveValue("Grace");
  });

  it("cancels pending local completion when the owning form resets", async () => {
    const pending = deferred();
    const onReset = vi.fn();
    render(
      <Form aria-label="Profile">
        <InlineEdit name="name" value="Ada" onCommit={() => pending.promise} onReset={onReset} />
        <button type="reset">Reset profile</button>
      </Form>,
    );
    fireEvent.click(screen.getByRole("button", { name: "编辑" }));
    fireEvent.change(screen.getByRole("textbox", { name: "编辑" }), { target: { value: "Grace" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    fireEvent.click(screen.getByRole("button", { name: "Reset profile" }));
    await waitFor(() => expect(onReset).toHaveBeenCalledOnce());
    expect(screen.getByRole("button", { name: "编辑" })).toBeInTheDocument();
    pending.reject(new Error("stale request"));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(screen.getByText("Ada")).toBeInTheDocument();
  });

  it("exposes required and invalid state on the actual textbox, not its collapsed command", () => {
    render(
      <Field label="Display name" htmlFor="name" required error="Name is required">
        <InlineEdit value="" onCommit={() => undefined} editLabel="Edit display name" />
      </Field>,
    );
    const trigger = screen.getByRole("button", { name: "Edit display name" });
    expect(trigger).not.toHaveAttribute("aria-required");
    expect(trigger).toHaveAttribute("aria-invalid", "true");
    fireEvent.click(trigger);
    expect(screen.getByRole("textbox", { name: "Edit display name" })).toHaveAttribute("aria-required", "true");
  });
});
