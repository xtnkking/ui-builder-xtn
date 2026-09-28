// @personal-ui-coverage {"kind":"unit","runner":"components","exports":["Checkbox","Combobox","DateField","Field","Input","PasswordInput","Radio","SearchInput","SegmentedControl","Select","Switch","Textarea"]}
import { createElement, createRef, useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  Checkbox,
  DateField,
  Field,
  Input,
  PasswordInput,
  Radio,
  SearchInput,
  SegmentedControl,
  Select,
  Combobox,
  Switch,
  Textarea,
  type CheckboxProps,
  type FieldProps,
  type InputProps,
  type ComboboxProps,
  type SegmentedControlProps,
  type SelectProps,
  type TextareaProps,
  type TextControlHandle,
  type ValidityControlHandle,
} from "../../src/personal-ui";

function forcedEscapeProps(testId: string) {
  return {
    className: "foreign-control",
    style: { color: "red", background: "magenta" },
    css: "foreign-css",
    sx: "foreign-sx",
    tw: "foreign-tw",
    dangerouslySetInnerHTML: { __html: "<b>unsafe control</b>" },
    "data-pui-owner": "Consumer",
    "data-pui-slot": "foreign",
    "data-pui-private": "foreign",
    "data-testid": testId,
    "data-track": "preserved",
  };
}

function expectEscapesRemoved(element: HTMLElement, owner: string) {
  expect(element).toHaveAttribute("data-pui-owner", owner);
  expect(element).not.toHaveClass("foreign-control");
  expect(element).not.toHaveAttribute("style");
  expect(element).not.toHaveAttribute("css");
  expect(element).not.toHaveAttribute("sx");
  expect(element).not.toHaveAttribute("tw");
  expect(element).not.toHaveAttribute("data-pui-slot");
  expect(element).not.toHaveAttribute("data-pui-private");
  expect(element).not.toHaveTextContent("unsafe control");
}

function expectDevelopmentError(run: () => void, message: RegExp) {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
  try {
    expect(run).toThrow(message);
  } finally {
    consoleError.mockRestore();
  }
}

describe("form control public and private composition contracts", () => {
  it("filters forced input and textarea escape props while preserving safe native props", () => {
    const inputProps = {
      ...forcedEscapeProps("account-input"),
      name: "account",
      defaultValue: "Ada",
      "aria-label": "Account",
    };
    const input = render(createElement(Input, inputProps as unknown as InputProps));
    const inputElement = screen.getByTestId("account-input");
    expectEscapesRemoved(inputElement, "Input");
    expect(inputElement).toHaveClass("pui-input");
    expect(inputElement).toHaveAttribute("name", "account");
    expect(inputElement).toHaveAttribute("data-track", "preserved");
    expect(inputElement).toHaveValue("Ada");
    input.unmount();

    const textareaProps = {
      ...forcedEscapeProps("notes-input"),
      name: "notes",
      defaultValue: "Draft",
      "aria-label": "Notes",
    };
    render(createElement(Textarea, textareaProps as unknown as TextareaProps));
    const textarea = screen.getByTestId("notes-input");
    expectEscapesRemoved(textarea, "Textarea");
    expect(textarea).toHaveClass("pui-textarea");
    expect(textarea).toHaveAttribute("data-track", "preserved");
    expect(textarea).toHaveValue("Draft");
  });

  it("keeps private owner and class mappings for composed text controls", () => {
    const dateControlRef = createRef<ValidityControlHandle>();
    render(
      <>
        <PasswordInput aria-label="Password" defaultValue="secret" />
        <SearchInput aria-label="Search" value="query" onChange={() => undefined} onClear={() => undefined} />
        <DateField aria-label="Date" precision="day" defaultValue="2026-09-19" controlRef={dateControlRef} />
      </>,
    );

    const password = screen.getByLabelText("Password");
    const search = screen.getByLabelText("Search");
    const date = screen.getByLabelText("Date");
    expect(password.closest("[data-pui-owner='PasswordInput']")).not.toBeNull();
    expect(search.closest("[data-pui-owner='SearchInput']")).not.toBeNull();
    expect(date.closest("[data-pui-owner='DateField']")).not.toBeNull();
    expect(Object.keys(dateControlRef.current ?? {})).toEqual([
      "focus",
      "setCustomValidity",
      "checkValidity",
      "reportValidity",
    ]);
    expect("select" in (dateControlRef.current ?? {})).toBe(false);
    expect(screen.getAllByRole("button", { name: /密码|搜索/ })).toHaveLength(2);
    expect(document.querySelector("[data-pui-owner='Consumer']")).toBeNull();
  });

  it("filters forced escape props at PasswordInput and SearchInput wrapper boundaries", () => {
    const passwordResult = render(createElement(PasswordInput, {
      ...forcedEscapeProps("password-wrapper"),
      "aria-label": "Password wrapper",
      defaultValue: "secret",
    } as never));
    const passwordInput = screen.getByTestId("password-wrapper");
    const passwordRoot = passwordInput.closest<HTMLElement>("[data-pui-owner='PasswordInput']")!;
    expectEscapesRemoved(passwordRoot, "PasswordInput");
    expect(passwordInput).not.toHaveAttribute("data-pui-slot");
    expect(passwordInput).not.toHaveAttribute("data-pui-private");
    passwordResult.unmount();

    render(createElement(SearchInput, {
      ...forcedEscapeProps("search-wrapper"),
      "aria-label": "Search wrapper",
      value: "query",
      onChange: () => undefined,
      onClear: () => undefined,
    } as never));
    const searchInput = screen.getByTestId("search-wrapper");
    const searchRoot = searchInput.closest<HTMLElement>("[data-pui-owner='SearchInput']")!;
    expectEscapesRemoved(searchRoot, "SearchInput");
    expect(searchInput).not.toHaveAttribute("data-pui-slot");
    expect(searchInput).not.toHaveAttribute("data-pui-private");
  });

  it("exposes a limited text-control handle with focus, selection, and validity operations", () => {
    const controlRef = createRef<TextControlHandle>();
    const { unmount } = render(
      <Input aria-label="Handle target" defaultValue="abcdef" required controlRef={controlRef} />,
    );
    const input = screen.getByLabelText("Handle target") as HTMLInputElement;

    expect(Object.keys(controlRef.current ?? {})).toEqual([
      "focus",
      "select",
      "setSelectionRange",
      "setCustomValidity",
      "checkValidity",
      "reportValidity",
    ]);
    expect("style" in (controlRef.current ?? {})).toBe(false);
    expect("value" in (controlRef.current ?? {})).toBe(false);
    controlRef.current?.focus();
    expect(input).toHaveFocus();
    controlRef.current?.select();
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(6);
    controlRef.current?.setSelectionRange(1, 4, "forward");
    expect(input.selectionStart).toBe(1);
    expect(input.selectionEnd).toBe(4);
    controlRef.current?.setCustomValidity("Invalid account");
    expect(controlRef.current?.checkValidity()).toBe(false);
    controlRef.current?.setCustomValidity("");
    expect(controlRef.current?.checkValidity()).toBe(true);
    expect(controlRef.current?.reportValidity()).toBe(true);

    unmount();
    expect(controlRef.current).toBeNull();
  });

  it("filters Field and choice escape props without losing their owned structure", () => {
    const fieldProps = {
      ...forcedEscapeProps("ignored-field-id"),
      label: "Account",
      htmlFor: "account",
      children: <Input id="account" />,
    };
    const field = render(createElement(Field, fieldProps as unknown as FieldProps));
    const fieldRoot = document.querySelector<HTMLElement>("[data-pui-owner='Field']")!;
    expectEscapesRemoved(fieldRoot, "Field");
    expect(fieldRoot).toHaveClass("pui-field");
    expect(fieldRoot).not.toHaveAttribute("data-testid");
    field.unmount();

    const choiceProps = {
      ...forcedEscapeProps("remember-choice"),
      label: "Remember",
      defaultChecked: true,
    };
    render(createElement(Checkbox, choiceProps as unknown as CheckboxProps));
    const choice = document.querySelector<HTMLElement>("[data-pui-owner='Checkbox']")!;
    expectEscapesRemoved(choice, "Checkbox");
    expect(choice).toHaveClass("pui-choice");
    expect(screen.getByRole("checkbox", { name: "Remember" })).toBeChecked();
  });

  it("retains the canonical owner geometry for every native choice control", () => {
    render(
      <>
        <Checkbox label="Checkbox" />
        <Radio label="Radio" />
        <Switch label="Switch" />
      </>,
    );

    expect(document.querySelector("[data-pui-owner='Checkbox']")).toHaveClass("pui-choice");
    expect(document.querySelector("[data-pui-owner='Radio']")).toHaveClass("pui-choice");
    expect(document.querySelector("[data-pui-owner='Switch']")).toHaveClass("pui-switch");
  });

  it("filters forced escape props from select controls while retaining their owners", () => {
    const options = [{ value: "us", label: "United States" }];
    const select = render(createElement(Select, {
      ...forcedEscapeProps("country-select"),
      options,
      value: "us",
      onValueChange: () => undefined,
      ariaLabel: "Country",
    } as unknown as SelectProps));
    const selectRoot = document.querySelector<HTMLElement>("[data-pui-owner='Select']")!;
    expectEscapesRemoved(selectRoot, "Select");
    expect(selectRoot).toHaveClass("pui-select-shell");
    select.unmount();

    const combobox = render(createElement(Combobox, {
      ...forcedEscapeProps("country-combobox"),
      options,
      value: "us",
      onValueChange: () => undefined,
      ariaLabel: "Country search",
    } as unknown as ComboboxProps));
    const comboboxRoot = document.querySelector<HTMLElement>("[data-pui-owner='Combobox']")!;
    expectEscapesRemoved(comboboxRoot, "Combobox");
    expect(comboboxRoot).toHaveClass("pui-combobox");
    combobox.unmount();

    render(createElement(SegmentedControl, {
      ...forcedEscapeProps("view-mode"),
      value: "list",
      options: [{ value: "list", label: "List" }],
      onValueChange: () => undefined,
      ariaLabel: "View",
    } as unknown as SegmentedControlProps<string>));
    const segmented = document.querySelector<HTMLElement>("[data-pui-owner='SegmentedControl']")!;
    expectEscapesRemoved(segmented, "SegmentedControl");
    expect(segmented).toHaveClass("pui-segmented");
  });

  it("rejects contradictory native state props and controlled-mode switching", () => {
    expectDevelopmentError(
      () => render(createElement(Input, {
        value: "saved",
      } as unknown as InputProps)),
      /Input requires onChange when value is controlled/,
    );
    expectDevelopmentError(
      () => render(createElement(Input, {
        value: "saved",
        defaultValue: "draft",
        onChange: () => undefined,
      } as unknown as InputProps)),
      /Input cannot receive both value and defaultValue/,
    );
    expectDevelopmentError(
      () => render(createElement(Checkbox, {
        label: "Remember",
        checked: true,
      } as unknown as CheckboxProps)),
      /Checkbox requires onChange when checked is controlled/,
    );

    const undefinedValue = render(createElement(Input, {
      value: undefined,
      defaultValue: "draft",
      "aria-label": "Undefined value",
    } as unknown as InputProps));
    expect(screen.getByLabelText("Undefined value")).toHaveValue("draft");
    undefinedValue.unmount();

    const undefinedChecked = render(createElement(Checkbox, {
      label: "Undefined checked",
      checked: undefined,
      defaultChecked: true,
    } as unknown as CheckboxProps));
    expect(screen.getByRole("checkbox", { name: "Undefined checked" })).toBeChecked();
    undefinedChecked.unmount();

    expectDevelopmentError(
      () => render(createElement(SearchInput, {
        onChange: () => undefined,
      } as never)),
      /SearchInput requires value; uncontrolled mode is not supported/,
    );
    expectDevelopmentError(
      () => render(createElement(SearchInput, {
        value: "query",
        defaultValue: "draft",
        onChange: () => undefined,
      } as never)),
      /SearchInput cannot receive both value and defaultValue/,
    );
    expectDevelopmentError(
      () => render(createElement(Select, {
        options: [],
        ariaLabel: "Country",
      } as unknown as SelectProps)),
      /Select requires onValueChange when value is controlled/,
    );
    expectDevelopmentError(
      () => render(createElement(SegmentedControl, {
        options: [],
        onValueChange: () => undefined,
        ariaLabel: "View",
      } as unknown as SegmentedControlProps<string>)),
      /SegmentedControl requires value; uncontrolled mode is not supported/,
    );

    const controllerField = {
      name: "email",
      value: "saved",
      onChange: () => undefined,
      onBlur: () => undefined,
      ref: createRef<TextControlHandle>(),
    };
    expectDevelopmentError(
      () => render(createElement(Input, {
        controllerField,
        value: "conflict",
        onChange: () => undefined,
      } as unknown as InputProps)),
      /Input cannot receive both controllerField and value/,
    );

    function SwitchingInput() {
      const [controlled, setControlled] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setControlled(true)}>switch</button>
          {controlled
            ? <Input value="saved" onChange={() => undefined} aria-label="Switch target" />
            : <Input defaultValue="draft" aria-label="Switch target" />}
        </>
      );
    }
    const switching = render(<SwitchingInput />);
    expectDevelopmentError(
      () => fireEvent.click(screen.getByRole("button", { name: "switch" })),
      /Input cannot switch from uncontrolled to controlled mode/,
    );
    switching.unmount();
  });

  it("serializes and resets a form-associated SegmentedControl", async () => {
    const user = userEvent.setup();

    function SegmentedForm() {
      const [view, setView] = useState<"grid" | "list">("grid");
      return (
        <form aria-label="View settings">
          <SegmentedControl
            name="view"
            value={view}
            options={[
              { value: "grid", label: "Grid" },
              { value: "list", label: "List" },
            ]}
            onValueChange={setView}
            ariaLabel="View"
          />
          <button type="reset">Reset view</button>
        </form>
      );
    }

    render(<SegmentedForm />);
    await user.click(screen.getByRole("button", { name: "List" }));
    expect(screen.getByRole("button", { name: "List" })).toHaveAttribute("aria-pressed", "true");
    expect(Array.from(new FormData(screen.getByRole("form", { name: "View settings" }) as HTMLFormElement).entries()))
      .toEqual([["view", "list"]]);

    await user.click(screen.getByRole("button", { name: "Reset view" }));
    expect(screen.getByRole("button", { name: "Grid" })).toHaveAttribute("aria-pressed", "true");
    expect(Array.from(new FormData(screen.getByRole("form", { name: "View settings" }) as HTMLFormElement).entries()))
      .toEqual([["view", "grid"]]);
  });
});
