// @personal-ui-coverage {"kind":"unit","runner":"components","exports":["AsyncSelect","Autocomplete","Cascader","CodeEditor","FileUpload","Form","InlineEdit","MultiSelect","NumberInput","OtpInput","RichTextEditor","SearchableSelect","TagInput","Transfer","TreeSelect"]}
import { createElement, createRef, useState, type ComponentType } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  Autocomplete,
  AsyncSelect,
  Cascader,
  CodeEditor,
  Field,
  FileUpload,
  Form,
  InlineEdit,
  MultiSelect,
  NumberInput,
  OtpInput,
  RichTextEditor,
  SearchableSelect,
  TagInput,
  Transfer,
  TreeSelect,
  type AutocompleteProps,
  type AsyncSelectProps,
  type CascaderProps,
  type CodeEditorProps,
  type FileUploadProps,
  type FormControlHandle,
  type FormProps,
  type MultiSelectProps,
  type NumberInputProps,
  type OtpInputProps,
  type RichTextEditorProps,
  type SearchableSelectProps,
  type TagInputProps,
  type TextControlHandle,
  type TransferProps,
  type TreeSelectProps,
  type ValidityControlHandle,
} from "../../src/personal-ui";

const forcedEscapes = {
  className: "foreign-control",
  style: { color: "red" },
  css: "foreign-css",
  sx: "foreign-sx",
  tw: "foreign-tw",
  dangerouslySetInnerHTML: { __html: "<b>unsafe</b>" },
  "data-pui-owner": "Consumer",
  "data-pui-slot": "foreign",
};

function expectDevelopmentError(run: () => void, message: RegExp) {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
  try {
    expect(run).toThrow(message);
  } finally {
    consoleError.mockRestore();
  }
}

describe("extra input public and private composition contracts", () => {
  it("keeps number and editor geometry in private slots while filtering forced escapes", () => {
    const numberProps = {
      ...forcedEscapes,
      value: 1,
      onValueChange: () => undefined,
      ariaLabel: "Amount",
    };
    const number = render(createElement(NumberInput, numberProps as unknown as NumberInputProps));
    const spinbutton = screen.getByRole("spinbutton", { name: "Amount" });
    const numberOwner = spinbutton.closest<HTMLElement>("[data-pui-owner='NumberInput']");
    expect(numberOwner).toHaveClass("pui-input-shell", "pui-number-input");
    expect(numberOwner).not.toHaveClass("foreign-control");
    expect(document.querySelector("[data-pui-owner='Consumer']")).toBeNull();
    number.unmount();

    const richProps = {
      ...forcedEscapes,
      value: "Notes",
      onValueChange: () => undefined,
      "aria-label": "Rich notes",
    };
    const rich = render(createElement(RichTextEditor, richProps as unknown as RichTextEditorProps));
    const richTextarea = screen.getByLabelText("Rich notes");
    expect(richTextarea).toHaveAttribute("data-pui-owner", "RichTextEditor");
    expect(richTextarea).toHaveClass("pui-textarea");
    expect(richTextarea).not.toHaveClass("foreign-control");
    expect(richTextarea).not.toHaveAttribute("style");
    rich.unmount();

    const codeProps = {
      ...forcedEscapes,
      value: "const answer = 42;",
      onValueChange: () => undefined,
      "aria-label": "Source code",
    };
    render(createElement(CodeEditor, codeProps as unknown as CodeEditorProps));
    const codeTextarea = screen.getByLabelText("Source code");
    expect(codeTextarea).toHaveAttribute("data-pui-owner", "CodeEditor");
    expect(codeTextarea).toHaveClass("pui-textarea", "pui-code-editor__input");
    expect(codeTextarea).not.toHaveClass("foreign-control");
  });

  it("exposes only limited form and text control handles", () => {
    const formRef = createRef<FormControlHandle>();
    const numberRef = createRef<ValidityControlHandle>();
    const editorRef = createRef<TextControlHandle>();
    const onSubmit = vi.fn((event: React.FormEvent<HTMLFormElement>) => event.preventDefault());
    const { unmount } = render(
      <Form controlRef={formRef} aria-label="Profile" onSubmit={onSubmit}>
        <input aria-label="Reset target" defaultValue="initial" required />
        <NumberInput value={1} onValueChange={() => undefined} ariaLabel="Amount" controlRef={numberRef} />
        <RichTextEditor value="Notes" onValueChange={() => undefined} aria-label="Notes" controlRef={editorRef} />
      </Form>,
    );
    const form = screen.getByRole("form", { name: "Profile" }) as HTMLFormElement;
    const resetTarget = screen.getByLabelText("Reset target") as HTMLInputElement;
    const requestSubmit = vi.spyOn(form, "requestSubmit");
    const reset = vi.spyOn(form, "reset");
    const checkValidity = vi.spyOn(form, "checkValidity");
    const reportValidity = vi.spyOn(form, "reportValidity");

    expect(Object.keys(formRef.current ?? {})).toEqual([
      "requestSubmit",
      "reset",
      "checkValidity",
      "reportValidity",
    ]);
    expect("style" in (formRef.current ?? {})).toBe(false);
    formRef.current?.requestSubmit();
    expect(requestSubmit).toHaveBeenCalledOnce();
    expect(onSubmit).toHaveBeenCalledOnce();
    fireEvent.change(resetTarget, { target: { value: "changed" } });
    expect(resetTarget).toHaveValue("changed");
    formRef.current?.reset();
    expect(reset).toHaveBeenCalledOnce();
    expect(resetTarget).toHaveValue("initial");
    expect(formRef.current?.checkValidity()).toBe(true);
    expect(checkValidity).toHaveBeenCalledOnce();
    fireEvent.change(resetTarget, { target: { value: "" } });
    expect(formRef.current?.reportValidity()).toBe(false);
    expect(reportValidity).toHaveBeenCalledOnce();
    expect(Object.keys(numberRef.current ?? {})).toEqual([
      "focus",
      "setCustomValidity",
      "checkValidity",
      "reportValidity",
    ]);
    expect("value" in (numberRef.current ?? {})).toBe(false);
    expect("select" in (numberRef.current ?? {})).toBe(false);

    numberRef.current?.focus();
    expect(screen.getByRole("spinbutton", { name: "Amount" })).toHaveFocus();
    editorRef.current?.focus();
    expect(screen.getByLabelText("Notes")).toHaveFocus();

    unmount();
    expect(formRef.current).toBeNull();
    expect(numberRef.current).toBeNull();
    expect(editorRef.current).toBeNull();
  });

  it("keeps fixed wrapper classes for inline and searchable composite inputs", () => {
    const options = [{ value: "cn", label: "China" }];
    const asyncProps = {
      ...forcedEscapes,
      options,
      query: "",
      onQueryChange: () => undefined,
      onValueChange: () => undefined,
      ariaLabel: "Country",
    };
    const asyncSelect = render(createElement(AsyncSelect, asyncProps as unknown as AsyncSelectProps));
    expect(document.querySelector("[data-pui-owner='AsyncSelect']")).toHaveClass("pui-async-select");
    expect(document.querySelector("[data-pui-owner='AsyncSelect']")).not.toHaveClass("foreign-control");
    asyncSelect.unmount();

    const multiProps = {
      ...forcedEscapes,
      options,
      value: [],
      onValueChange: () => undefined,
      ariaLabel: "Countries",
    };
    const multiSelect = render(createElement(MultiSelect, multiProps as unknown as MultiSelectProps));
    expect(document.querySelector("[data-pui-owner='MultiSelect']")).toHaveClass("pui-multi-select");
    expect(document.querySelector("[data-pui-owner='MultiSelect']")).not.toHaveClass("foreign-control");
    multiSelect.unmount();

    render(<InlineEdit value="Ada" onCommit={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "编辑" }));
    expect(screen.getByRole("textbox", { name: "编辑" })).toHaveFocus();
  });

  it("projects Field semantics onto every composite bridge owner", () => {
    const options = [{ value: "cn", label: "China" }];
    const multiRef = createRef<ValidityControlHandle>();
    render(
      <>
        <Field label="One-time code" htmlFor="otp-field" required error="OTP is required">
          <OtpInput defaultValue="" ariaLabel="One-time code" />
        </Field>
        <Field label="Documents" htmlFor="upload-field" required error="A document is required">
          <FileUpload items={[]} onFiles={() => undefined} browseLabel="Choose files" />
        </Field>
        <Field label="Async country" htmlFor="async-field" required error="Async country is required">
          <AsyncSelect options={options} defaultValue="" defaultQuery="" ariaLabel="Async country" />
        </Field>
        <Field label="Countries" htmlFor="multi-field" required error="Countries are required">
          <MultiSelect options={options} defaultValue={[]} defaultQuery="" ariaLabel="Countries" controlRef={multiRef} />
        </Field>
        <Field label="Tags" htmlFor="tag-field" required error="Tags are required">
          <TagInput defaultValue={[]} defaultInputValue="" ariaLabel="Tags" />
        </Field>
        <Field label="Tree country" htmlFor="tree-field" required error="Tree country is required">
          <TreeSelect options={options} defaultValue="" ariaLabel="Tree country" />
        </Field>
        <Field label="Display name" htmlFor="inline-field" required error="Display name is required">
          <InlineEdit value="" onCommit={() => undefined} editLabel="Edit display name" />
        </Field>
        <Field label="Autocomplete country" htmlFor="autocomplete-field" required error="Autocomplete country is required">
          <Autocomplete options={options} defaultValue="" defaultQuery="" ariaLabel="Autocomplete country" />
        </Field>
        <Field label="Searchable country" htmlFor="searchable-field" required error="Searchable country is required">
          <SearchableSelect options={options} value="" onValueChange={() => undefined} ariaLabel="Searchable country" />
        </Field>
        <Field label="Region" htmlFor="cascader-field" required error="Region is required">
          <Cascader options={options} defaultValue={[]} ariaLabel="Region" />
        </Field>
        <Field label="Assignments" htmlFor="transfer-field" required error="Assignments are required">
          <Transfer options={options} defaultValue={[]} sourceTitle="Available assignments" />
        </Field>
      </>,
    );

    const controls = [
      "otp-field",
      "upload-field",
      "async-field",
      "multi-field",
      "tag-field",
      "tree-field",
      "inline-field",
      "autocomplete-field",
      "searchable-field",
      "cascader-field",
      "transfer-field",
    ].map((id): [HTMLElement, string] => [document.getElementById(id)!, id]);
    controls.forEach(([control, id]) => {
      expect(control).toHaveAttribute("id", id);
      expect(control).toHaveAttribute("aria-describedby", `${id}-error`);
      expect(control).toHaveAttribute("aria-invalid", "true");
      if (id === "upload-field" || id === "inline-field") {
        expect(control).not.toHaveAttribute("aria-required");
        if (id === "upload-field") {
          expect(control.closest("[data-pui-owner='FileUpload']")).not.toHaveAttribute("aria-required");
        }
      } else {
        expect(control).toHaveAttribute("aria-required", "true");
      }
    });

    expect(multiRef.current?.reportValidity()).toBe(false);
    expect(document.getElementById("multi-field")).toHaveFocus();
  });

  it("merges TagInput validation feedback with Field help", () => {
    render(
      <Field label="Tags" htmlFor="tag-help-field" hint="Use a short label">
        <TagInput
          defaultValue={[]}
          defaultInputValue=""
          ariaLabel="Validated tags"
          validateValue={() => "That tag is unavailable"}
        />
      </Field>,
    );

    const input = screen.getByRole("combobox", { name: "Validated tags" });
    fireEvent.change(input, { target: { value: "blocked" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(input).toHaveAttribute(
      "aria-describedby",
      "tag-help-field-hint tag-help-field-local-error",
    );
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("That tag is unavailable")).toHaveAttribute(
      "id",
      "tag-help-field-local-error",
    );
  });

  it("filters forced escapes from the remaining composite input owners", () => {
    const options = [{ value: "cn", label: "China" }];
    render(
      <>
        {createElement(OtpInput, {
          ...forcedEscapes,
          value: "123456",
          onValueChange: () => undefined,
        } as unknown as OtpInputProps)}
        {createElement(FileUpload, {
          ...forcedEscapes,
          items: [],
          onFiles: () => undefined,
        } as unknown as FileUploadProps)}
        {createElement(Autocomplete, {
          ...forcedEscapes,
          options,
          query: "",
          onQueryChange: () => undefined,
          onValueChange: () => undefined,
          ariaLabel: "Autocomplete country",
        } as unknown as AutocompleteProps)}
        {createElement(SearchableSelect, {
          ...forcedEscapes,
          options,
          onValueChange: () => undefined,
          ariaLabel: "Searchable country",
        } as unknown as SearchableSelectProps)}
        {createElement(TagInput, {
          ...forcedEscapes,
          value: [],
          inputValue: "",
          onInputValueChange: () => undefined,
          onValueChange: () => undefined,
        } as unknown as TagInputProps)}
        {createElement(Cascader, {
          ...forcedEscapes,
          options,
          value: [],
          onValueChange: () => undefined,
          ariaLabel: "Region",
        } as unknown as CascaderProps)}
        {createElement(TreeSelect, {
          ...forcedEscapes,
          options,
          onValueChange: () => undefined,
          ariaLabel: "Tree region",
        } as unknown as TreeSelectProps)}
        {createElement(Transfer, {
          ...forcedEscapes,
          options,
          value: [],
          onValueChange: () => undefined,
        } as unknown as TransferProps)}
      </>,
    );

    const expectedOwners = [
      ["OtpInput", "pui-otp"],
      ["FileUpload", "pui-file-upload"],
      ["Autocomplete", "pui-autocomplete"],
      ["SearchableSelect", "pui-form-control-bridge"],
      ["TagInput", "pui-tag-input"],
      ["Cascader", "pui-cascader"],
      ["TreeSelect", "pui-tree-select"],
      ["Transfer", "pui-transfer"],
    ] as const;
    expectedOwners.forEach(([ownerName, className]) => {
      const owner = document.querySelector<HTMLElement>(`[data-pui-owner='${ownerName}']`);
      expect(owner).not.toBeNull();
      expect(owner).toHaveClass(className);
      expect(owner).not.toHaveClass("foreign-control");
      expect(owner).not.toHaveAttribute("style");
    });
    expect(document.querySelector("[data-pui-owner='Consumer']")).toBeNull();
    expect(document.querySelector("[data-pui-slot='foreign']")).toBeNull();
  });

  it("filters forced form escape props without losing native behavior", () => {
    const onSubmit = (event: React.FormEvent<HTMLFormElement>) => event.preventDefault();
    const props = {
      ...forcedEscapes,
      "aria-label": "Profile",
      onSubmit,
      children: <button type="submit">Save</button>,
    };
    render(createElement(Form, props as unknown as FormProps));
    const form = screen.getByRole("form", { name: "Profile" });
    expect(form).toHaveClass("pui-form");
    expect(form).not.toHaveClass("foreign-control");
    expect(form).not.toHaveAttribute("style");
    expect(form).toHaveAttribute("data-pui-owner", "Form");
  });

  it("owns uncontrolled async and multi-select queries while reporting changes", () => {
    const options = [
      { value: "cn", label: "China" },
      { value: "jp", label: "Japan" },
    ];
    const onAsyncQueryChange = vi.fn();
    const asyncSelect = render(
      <AsyncSelect
        options={options}
        defaultQuery="chi"
        onQueryChange={onAsyncQueryChange}
        onValueChange={() => undefined}
        ariaLabel="Async country"
      />,
    );
    fireEvent.click(screen.getByRole("combobox", { name: "Async country" }));
    const asyncSearch = screen.getByRole("combobox", { name: "搜索Async country" });
    expect(asyncSearch).toHaveValue("chi");
    fireEvent.change(asyncSearch, { target: { value: "jap" } });
    expect(asyncSearch).toHaveValue("jap");
    expect(onAsyncQueryChange).toHaveBeenLastCalledWith("jap");
    asyncSelect.unmount();

    const onMultiQueryChange = vi.fn();
    render(
      <MultiSelect
        options={options}
        value={[]}
        defaultQuery="chi"
        onQueryChange={onMultiQueryChange}
        onValueChange={() => undefined}
        ariaLabel="Multi country"
      />,
    );
    fireEvent.click(screen.getByRole("combobox", { name: "Multi country，已选择 0 项" }));
    const multiSearch = screen.getByRole("searchbox", { name: "搜索Multi country" });
    expect(multiSearch).toHaveValue("chi");
    fireEvent.change(multiSearch, { target: { value: "jap" } });
    expect(multiSearch).toHaveValue("jap");
    expect(onMultiQueryChange).toHaveBeenLastCalledWith("jap");
  });

  it("updates uncontrolled scalar selections and reports their changes", () => {
    const options = [{ value: "cn", label: "China" }, { value: "jp", label: "Japan" }];

    const onOtpChange = vi.fn();
    const otp = render(<OtpInput defaultValue="1" onValueChange={onOtpChange} />);
    const firstDigit = screen.getByRole("textbox", { name: "验证码第 1 位" });
    fireEvent.change(firstDigit, { target: { value: "2" } });
    expect(firstDigit).toHaveValue("2");
    expect(onOtpChange).toHaveBeenLastCalledWith("2");
    otp.unmount();

    const onAutocompleteChange = vi.fn();
    const autocomplete = render(<Autocomplete options={options} defaultValue="cn" defaultQuery="China" onValueChange={onAutocompleteChange} ariaLabel="Autocomplete country" />);
    const autocompleteInput = screen.getByRole("combobox", { name: "Autocomplete country" });
    fireEvent.focus(autocompleteInput);
    fireEvent.change(autocompleteInput, { target: { value: "Jap" } });
    fireEvent.click(screen.getByRole("option", { name: "Japan" }));
    expect(screen.getByRole("combobox", { name: "Autocomplete country" })).toHaveValue("Japan");
    expect(onAutocompleteChange).toHaveBeenLastCalledWith("jp");
    autocomplete.unmount();

    const onAsyncChange = vi.fn();
    const asyncSelect = render(<AsyncSelect options={options} defaultValue="cn" onValueChange={onAsyncChange} ariaLabel="Async country" />);
    fireEvent.click(screen.getByRole("combobox", { name: "Async country" }));
    fireEvent.click(screen.getByRole("option", { name: "Japan" }));
    expect(screen.getByRole("combobox", { name: "Async country" })).toHaveTextContent("Japan");
    expect(onAsyncChange).toHaveBeenLastCalledWith("jp");
    asyncSelect.unmount();

    const onTreeChange = vi.fn();
    render(<TreeSelect options={options} defaultValue="cn" onValueChange={onTreeChange} ariaLabel="Tree country" />);
    fireEvent.click(screen.getByRole("combobox", { name: "Tree country" }));
    fireEvent.click(screen.getByRole("treeitem", { name: "Japan" }));
    expect(screen.getByRole("combobox", { name: "Tree country" })).toHaveTextContent("Japan");
    expect(onTreeChange).toHaveBeenLastCalledWith("jp");
  });

  it("updates uncontrolled list selections and tag draft state", () => {
    const options = [{ value: "cn", label: "China" }, { value: "jp", label: "Japan" }];

    const onMultiChange = vi.fn();
    const multi = render(<MultiSelect options={options} defaultValue={["cn"]} onValueChange={onMultiChange} ariaLabel="Multi country" />);
    fireEvent.click(screen.getByRole("combobox", { name: "Multi country，已选择 1 项" }));
    fireEvent.click(screen.getByRole("option", { name: "Japan" }));
    expect(screen.getByRole("combobox", { name: "Multi country，已选择 2 项" })).toHaveTextContent("China +1");
    expect(onMultiChange).toHaveBeenLastCalledWith(["cn", "jp"]);
    multi.unmount();

    const onTagsChange = vi.fn();
    const onDraftChange = vi.fn();
    const tags = render(<TagInput defaultValue={["base"]} defaultInputValue="next" onValueChange={onTagsChange} onInputValueChange={onDraftChange} />);
    const tagDraft = screen.getByRole("combobox", { name: "标签输入" });
    fireEvent.keyDown(tagDraft, { key: "Enter" });
    expect(tagDraft).toHaveValue("");
    expect(onTagsChange).toHaveBeenLastCalledWith(["base", "next"]);
    expect(onDraftChange).toHaveBeenLastCalledWith("");
    tags.unmount();

    const onCascaderChange = vi.fn();
    const cascader = render(<Cascader options={options} defaultValue={[]} onValueChange={onCascaderChange} ariaLabel="Region" />);
    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: "Japan" }));
    expect(onCascaderChange).toHaveBeenLastCalledWith(["jp"]);
    cascader.unmount();

    const onTransferChange = vi.fn();
    render(<Transfer options={options} defaultValue={["cn"]} onValueChange={onTransferChange} />);
    const source = screen.getByRole("listbox", { name: "可选项" }) as HTMLSelectElement;
    const japan = source.querySelector<HTMLOptionElement>("option[value='jp']");
    if (!japan) throw new Error("Expected Japan transfer option");
    japan.selected = true;
    fireEvent.change(source);
    fireEvent.click(screen.getByRole("button", { name: "添加选中项" }));
    expect(onTransferChange).toHaveBeenLastCalledWith(["cn", "jp"]);
    expect(screen.getByRole("listbox", { name: "已选择" })).toHaveValue(["cn", "jp"]);
  });

  it("rejects contradictory query props and missing controlled callbacks", () => {
    const options = [{ value: "cn", label: "China" }];
    expectDevelopmentError(
      () => render(createElement(AsyncSelect, {
        options,
        query: "chi",
        onValueChange: () => undefined,
        ariaLabel: "Async country",
      } as unknown as AsyncSelectProps)),
      /AsyncSelect requires onQueryChange when query is controlled/,
    );
    expectDevelopmentError(
      () => render(createElement(AsyncSelect, {
        options,
        query: "chi",
        defaultQuery: "cn",
        onQueryChange: () => undefined,
        onValueChange: () => undefined,
        ariaLabel: "Async country",
      } as unknown as AsyncSelectProps)),
      /AsyncSelect cannot receive both query and defaultQuery/,
    );
    expectDevelopmentError(
      () => render(createElement(MultiSelect, {
        options,
        value: [],
        query: "chi",
        onValueChange: () => undefined,
        ariaLabel: "Multi country",
      } as unknown as MultiSelectProps)),
      /MultiSelect requires onQueryChange when query is controlled/,
    );
    expectDevelopmentError(
      () => render(createElement(MultiSelect, {
        options,
        value: [],
        query: "chi",
        defaultQuery: "cn",
        onQueryChange: () => undefined,
        onValueChange: () => undefined,
        ariaLabel: "Multi country",
      } as unknown as MultiSelectProps)),
      /MultiSelect cannot receive both query and defaultQuery/,
    );
  });

  it("rejects async and multi-select query mode switching", () => {
    const options = [{ value: "cn", label: "China" }];

    function SwitchingAsyncSelect() {
      const [controlled, setControlled] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setControlled(true)}>control async query</button>
          {controlled
            ? <AsyncSelect options={options} query="" onQueryChange={() => undefined} onValueChange={() => undefined} ariaLabel="Async country" />
            : <AsyncSelect options={options} defaultQuery="" onValueChange={() => undefined} ariaLabel="Async country" />}
        </>
      );
    }
    const asyncSelect = render(<SwitchingAsyncSelect />);
    expectDevelopmentError(
      () => fireEvent.click(screen.getByRole("button", { name: "control async query" })),
      /AsyncSelect cannot switch from uncontrolled to controlled mode/,
    );
    asyncSelect.unmount();

    function SwitchingMultiSelect() {
      const [controlled, setControlled] = useState(true);
      return (
        <>
          <button type="button" onClick={() => setControlled(false)}>uncontrol multi query</button>
          {controlled
            ? <MultiSelect options={options} value={[]} query="" onQueryChange={() => undefined} onValueChange={() => undefined} ariaLabel="Multi country" />
            : <MultiSelect options={options} value={[]} defaultQuery="" onValueChange={() => undefined} ariaLabel="Multi country" />}
        </>
      );
    }
    const multiSelect = render(<SwitchingMultiSelect />);
    expectDevelopmentError(
      () => fireEvent.click(screen.getByRole("button", { name: "uncontrol multi query" })),
      /MultiSelect cannot switch from controlled to uncontrolled mode/,
    );
    multiSelect.unmount();
  });

  it.each([
    [
      "OtpInput value",
      () => render(createElement(OtpInput, { value: "123456" } as unknown as OtpInputProps)),
      () => render(createElement(OtpInput, { value: "123456", defaultValue: "654321", onValueChange: () => undefined } as unknown as OtpInputProps)),
      /OtpInput requires onValueChange when value is controlled/,
      /OtpInput cannot receive both value and defaultValue/,
    ],
    [
      "Autocomplete value",
      () => render(createElement(Autocomplete, { options: [], value: "cn", defaultQuery: "", ariaLabel: "Country" } as unknown as AutocompleteProps)),
      () => render(createElement(Autocomplete, { options: [], value: "cn", defaultValue: "us", onValueChange: () => undefined, defaultQuery: "", ariaLabel: "Country" } as unknown as AutocompleteProps)),
      /Autocomplete requires onValueChange when value is controlled/,
      /Autocomplete cannot receive both value and defaultValue/,
    ],
    [
      "Autocomplete query",
      () => render(createElement(Autocomplete, { options: [], defaultValue: "", query: "", ariaLabel: "Country" } as unknown as AutocompleteProps)),
      () => render(createElement(Autocomplete, { options: [], defaultValue: "", query: "", defaultQuery: "draft", onQueryChange: () => undefined, ariaLabel: "Country" } as unknown as AutocompleteProps)),
      /Autocomplete requires onQueryChange when query is controlled/,
      /Autocomplete cannot receive both query and defaultQuery/,
    ],
    [
      "AsyncSelect value",
      () => render(createElement(AsyncSelect, { options: [], value: "cn", defaultQuery: "", ariaLabel: "Country" } as unknown as AsyncSelectProps)),
      () => render(createElement(AsyncSelect, { options: [], value: "cn", defaultValue: "us", onValueChange: () => undefined, defaultQuery: "", ariaLabel: "Country" } as unknown as AsyncSelectProps)),
      /AsyncSelect requires onValueChange when value is controlled/,
      /AsyncSelect cannot receive both value and defaultValue/,
    ],
    [
      "MultiSelect value",
      () => render(createElement(MultiSelect, { options: [], value: [], defaultQuery: "", ariaLabel: "Countries" } as unknown as MultiSelectProps)),
      () => render(createElement(MultiSelect, { options: [], value: [], defaultValue: ["cn"], onValueChange: () => undefined, defaultQuery: "", ariaLabel: "Countries" } as unknown as MultiSelectProps)),
      /MultiSelect requires onValueChange when value is controlled/,
      /MultiSelect cannot receive both value and defaultValue/,
    ],
    [
      "TagInput value",
      () => render(createElement(TagInput, { value: [], defaultInputValue: "" } as unknown as TagInputProps)),
      () => render(createElement(TagInput, { value: [], defaultValue: ["base"], onValueChange: () => undefined, defaultInputValue: "" } as unknown as TagInputProps)),
      /TagInput requires onValueChange when value is controlled/,
      /TagInput cannot receive both value and defaultValue/,
    ],
    [
      "TagInput inputValue",
      () => render(createElement(TagInput, { defaultValue: [], inputValue: "" } as unknown as TagInputProps)),
      () => render(createElement(TagInput, { defaultValue: [], inputValue: "", defaultInputValue: "draft", onInputValueChange: () => undefined } as unknown as TagInputProps)),
      /TagInput requires onInputValueChange when inputValue is controlled/,
      /TagInput cannot receive both inputValue and defaultInputValue/,
    ],
    [
      "Cascader value",
      () => render(createElement(Cascader, { options: [], value: [], ariaLabel: "Region" } as unknown as CascaderProps)),
      () => render(createElement(Cascader, { options: [], value: [], defaultValue: ["cn"], onValueChange: () => undefined, ariaLabel: "Region" } as unknown as CascaderProps)),
      /Cascader requires onValueChange when value is controlled/,
      /Cascader cannot receive both value and defaultValue/,
    ],
    [
      "TreeSelect value",
      () => render(createElement(TreeSelect, { options: [], value: "cn", ariaLabel: "Region" } as unknown as TreeSelectProps)),
      () => render(createElement(TreeSelect, { options: [], value: "cn", defaultValue: "us", onValueChange: () => undefined, ariaLabel: "Region" } as unknown as TreeSelectProps)),
      /TreeSelect requires onValueChange when value is controlled/,
      /TreeSelect cannot receive both value and defaultValue/,
    ],
    [
      "Transfer value",
      () => render(createElement(Transfer, { options: [], value: [] } as unknown as TransferProps)),
      () => render(createElement(Transfer, { options: [], value: [], defaultValue: ["cn"], onValueChange: () => undefined } as unknown as TransferProps)),
      /Transfer requires onValueChange when value is controlled/,
      /Transfer cannot receive both value and defaultValue/,
    ],
  ])("rejects invalid %s state", (_name, missingCallback, contradictory, missingMessage, conflictMessage) => {
    expectDevelopmentError(missingCallback, missingMessage);
    expectDevelopmentError(contradictory, conflictMessage);
  });

  it("keeps InlineEdit persisted value controlled by its commit command", () => {
    expectDevelopmentError(
      () => render(createElement(InlineEdit, { onCommit: () => undefined } as never)),
      /InlineEdit requires value; uncontrolled mode is not supported/,
    );
    expectDevelopmentError(
      () => render(createElement(InlineEdit, { value: "Ada" } as never)),
      /InlineEdit requires onCommit when value is controlled/,
    );
    expectDevelopmentError(
      () => render(createElement(InlineEdit, { value: "Ada", defaultValue: "Grace", onCommit: () => undefined } as never)),
      /InlineEdit cannot receive both value and defaultValue/,
    );
  });

  it.each([
    ["OtpInput value", OtpInput, { defaultValue: "" }, { value: "", onValueChange: () => undefined }, /OtpInput cannot switch from uncontrolled to controlled mode/],
    ["Autocomplete value", Autocomplete, { options: [], defaultValue: "", defaultQuery: "", ariaLabel: "Country" }, { options: [], value: "cn", onValueChange: () => undefined, defaultQuery: "", ariaLabel: "Country" }, /Autocomplete cannot switch from uncontrolled to controlled mode/],
    ["Autocomplete query", Autocomplete, { options: [], defaultValue: "", defaultQuery: "", ariaLabel: "Country" }, { options: [], defaultValue: "", query: "", onQueryChange: () => undefined, ariaLabel: "Country" }, /Autocomplete cannot switch from uncontrolled to controlled mode/],
    ["AsyncSelect value", AsyncSelect, { options: [], defaultValue: "", defaultQuery: "", ariaLabel: "Country" }, { options: [], value: "cn", onValueChange: () => undefined, defaultQuery: "", ariaLabel: "Country" }, /AsyncSelect cannot switch from uncontrolled to controlled mode/],
    ["MultiSelect value", MultiSelect, { options: [], defaultValue: [], defaultQuery: "", ariaLabel: "Countries" }, { options: [], value: [], onValueChange: () => undefined, defaultQuery: "", ariaLabel: "Countries" }, /MultiSelect cannot switch from uncontrolled to controlled mode/],
    ["TagInput value", TagInput, { defaultValue: [], defaultInputValue: "" }, { value: [], onValueChange: () => undefined, defaultInputValue: "" }, /TagInput cannot switch from uncontrolled to controlled mode/],
    ["TagInput inputValue", TagInput, { defaultValue: [], defaultInputValue: "" }, { defaultValue: [], inputValue: "", onInputValueChange: () => undefined }, /TagInput cannot switch from uncontrolled to controlled mode/],
    ["Cascader value", Cascader, { options: [], defaultValue: [], ariaLabel: "Region" }, { options: [], value: [], onValueChange: () => undefined, ariaLabel: "Region" }, /Cascader cannot switch from uncontrolled to controlled mode/],
    ["TreeSelect value", TreeSelect, { options: [], defaultValue: "", ariaLabel: "Region" }, { options: [], value: "cn", onValueChange: () => undefined, ariaLabel: "Region" }, /TreeSelect cannot switch from uncontrolled to controlled mode/],
    ["Transfer value", Transfer, { options: [], defaultValue: [] }, { options: [], value: [], onValueChange: () => undefined }, /Transfer cannot switch from uncontrolled to controlled mode/],
  ])("rejects %s mode switching", (name, component, uncontrolledProps, controlledProps, message) => {
    const Control = component as unknown as ComponentType<Record<string, unknown>>;
    function SwitchingControl() {
      const [controlled, setControlled] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setControlled(true)}>{`switch ${name}`}</button>
          {createElement(Control, controlled ? controlledProps : uncontrolledProps)}
        </>
      );
    }
    const rendered = render(<SwitchingControl />);
    expectDevelopmentError(
      () => fireEvent.click(screen.getByRole("button", { name: `switch ${name}` })),
      message,
    );
    rendered.unmount();
  });

  it.each([
    [
      "NumberInput",
      () => render(createElement(NumberInput, { onValueChange: () => undefined } as unknown as NumberInputProps)),
      () => render(createElement(NumberInput, { value: 1 } as unknown as NumberInputProps)),
      () => render(createElement(NumberInput, { value: 1, defaultValue: 2, onValueChange: () => undefined } as unknown as NumberInputProps)),
    ],
    [
      "RichTextEditor",
      () => render(createElement(RichTextEditor, { onValueChange: () => undefined } as unknown as RichTextEditorProps)),
      () => render(createElement(RichTextEditor, { value: "Notes" } as unknown as RichTextEditorProps)),
      () => render(createElement(RichTextEditor, { value: "Notes", defaultValue: "Draft", onValueChange: () => undefined } as unknown as RichTextEditorProps)),
    ],
    [
      "CodeEditor",
      () => render(createElement(CodeEditor, { onValueChange: () => undefined } as unknown as CodeEditorProps)),
      () => render(createElement(CodeEditor, { value: "const value = 1;" } as unknown as CodeEditorProps)),
      () => render(createElement(CodeEditor, { value: "const value = 1;", defaultValue: "", onValueChange: () => undefined } as unknown as CodeEditorProps)),
    ],
  ])("rejects invalid controlled-only %s state", (componentName, missingValue, missingChange, contradictory) => {
    expectDevelopmentError(
      missingValue,
      new RegExp(`${componentName} requires value; uncontrolled mode is not supported`),
    );
    expectDevelopmentError(
      missingChange,
      new RegExp(`${componentName} requires onValueChange when value is controlled`),
    );
    expectDevelopmentError(
      contradictory,
      new RegExp(`${componentName} cannot receive both value and defaultValue`),
    );
  });
});
