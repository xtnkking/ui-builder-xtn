// @ui-coverage {"kind":"unit","runner":"components","exports":["Field","Form","SettingsPage","NumberInput"]}
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Field, Form, Input, SettingsPage } from "../../src/ui";
import { SettingsExample } from "../../src/explorer/cases/pattern/settings.case";

describe("form and settings width contracts", () => {
  it("keeps labels, hints, required validation and values when a Field width changes", () => {
    const view = render(<Form aria-label="Profile"><Field label="Account" htmlFor="account" width="short" required hint="Use your team account."><Input name="account" /></Field></Form>);
    const input = screen.getByRole("textbox", { name: "Account 必填" });
    const field = input.closest<HTMLElement>("[data-ui-owner='Field']")!;
    expect(field.style.getPropertyValue("--ui-field-width")).toBe("240px");
    expect(input).toHaveAccessibleDescription("Use your team account.");
    expect(input).toBeRequired();
    expect(input).toBeInvalid();
    fireEvent.change(input, { target: { value: "Ada" } });

    view.rerender(<Form aria-label="Profile"><Field label="Account" htmlFor="account" width={280} required hint="Use your team account."><Input name="account" /></Field></Form>);
    expect(field.style.getPropertyValue("--ui-field-width")).toBe("280px");
    expect(input).toHaveValue("Ada");
    expect(input).toBeValid();
    expect(Array.from(new FormData(screen.getByRole("form", { name: "Profile" }) as HTMLFormElement))).toEqual([["account", "Ada"]]);

    view.rerender(<Form aria-label="Profile"><Field label="Account" htmlFor="account"><Input name="account" /></Field></Form>);
    expect(field).not.toHaveClass("ui-field--sized");
    expect(field.style.getPropertyValue("--ui-field-width")).toBe("");
    expect(input).toHaveValue("Ada");
  });

  it("supports readable medium and long fields, including grouped fields", () => {
    const view = render(<Field label="Group" group width="medium"><Input aria-label="Group value" /></Field>);
    expect(screen.getByRole("group", { name: "Group" }).style.getPropertyValue("--ui-field-width")).toBe("360px");
    view.rerender(<Field label="URL" htmlFor="url" width="long"><Input /></Field>);
    expect(screen.getByRole("textbox", { name: "URL" }).closest<HTMLElement>("[data-ui-owner='Field']")!.style.getPropertyValue("--ui-field-width")).toBe("560px");
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])("rejects invalid numeric Field width %s", (width) => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      expect(() => render(<Field label="Invalid" htmlFor="invalid" width={width}><Input /></Field>)).toThrow(/positive finite number/);
    } finally {
      consoleError.mockRestore();
    }
  });

  it("defaults settings to readable content and supports an explicit wide layout", () => {
    const sections = [{ id: "general", label: "General", content: <p>Settings content</p> }];
    const view = render(<SettingsPage title="Settings" sections={sections} currentId="general" onCurrentChange={() => undefined} />);
    expect(screen.getByRole("main")).not.toHaveClass("ui-settings-page--wide");
    expect(screen.getByRole("region", { name: "General" })).toHaveClass("ui-settings-page__content");
    view.rerender(<SettingsPage title="Settings" sections={sections} currentId="general" onCurrentChange={() => undefined} layoutWidth="wide" />);
    expect(screen.getByRole("main")).toHaveClass("ui-settings-page--wide");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("serializes the numeric settings and blocks duplicate submissions until one save completes", async () => {
    vi.useFakeTimers();
    try {
      render(<SettingsExample />);
      const form = screen.getByRole("form", { name: "任务限制设置" }) as HTMLFormElement;
      expect(within(form).getAllByRole("spinbutton")).toHaveLength(4);
      expect(Array.from(new FormData(form))).toEqual([["imports", "500"], ["retries", "3"], ["timeout", "60"], ["concurrency", "4"]]);
      fireEvent.submit(form);
      fireEvent.submit(form);
      expect(form).toHaveAttribute("aria-busy", "true");
      expect(within(form).getByRole("button", { name: "正在保存" })).toHaveAttribute("aria-busy", "true");
      for (const input of within(form).getAllByRole("spinbutton")) expect(input).toBeDisabled();
      await act(async () => { await vi.advanceTimersByTimeAsync(900); });
      expect(form).not.toHaveAttribute("aria-busy");
      expect(screen.getAllByText("任务限制已保存")).toHaveLength(1);
      for (const input of within(form).getAllByRole("spinbutton")) expect(input).not.toBeDisabled();
    } finally {
      vi.useRealTimers();
    }
  });
});
