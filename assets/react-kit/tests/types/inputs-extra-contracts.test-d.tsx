import { createRef } from "react";
import {
  Autocomplete,
  AsyncSelect,
  Cascader,
  CodeEditor,
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
  type FormControlHandle,
  type TextControlHandle,
  type ValidityControlHandle,
} from "../../src/personal-ui";

const formControlRef = createRef<FormControlHandle>();
const textControlRef = createRef<TextControlHandle>();
const validityControlRef = createRef<ValidityControlHandle>();
const options = [{ value: "cn", label: "China" }] as const;

const allowedExtraControls = (
  <>
    <Form controlRef={formControlRef} aria-label="Profile"><button type="submit">Save</button></Form>
    <NumberInput value={1} onValueChange={() => undefined} controlRef={validityControlRef} />
    <RichTextEditor value="Notes" onValueChange={() => undefined} controlRef={textControlRef} rows={4} />
    <CodeEditor value="const value = 1;" onValueChange={() => undefined} controlRef={textControlRef} />
    <CodeEditor value="const value = 1;" onValueChange={() => undefined} tabBehavior="indent" indent="  " />
    <InlineEdit value="Ada" onCommit={() => undefined} />
    <AsyncSelect options={options} query="" onQueryChange={() => undefined} onValueChange={() => undefined} ariaLabel="Country" />
    <AsyncSelect options={options} defaultValue="cn" defaultQuery="chi" ariaLabel="Country" />
    <AsyncSelect options={options} optionsQuery="chi" query="chi" onQueryChange={() => undefined} ariaLabel="Country" />
    <AsyncSelect loadOptions={async () => options} debounceMs={100} ariaLabel="Country" />
    <MultiSelect name="countries" form="profile" required options={options} value={[]} onValueChange={() => undefined} ariaLabel="Countries" controlRef={validityControlRef} />
    <MultiSelect options={options} defaultValue={["cn"]} defaultQuery="chi" ariaLabel="Countries" />
    <OtpInput value="123456" onValueChange={() => undefined} />
    <OtpInput defaultValue="123456" />
    <FileUpload items={[]} onFiles={() => undefined} />
    <Autocomplete options={options} query="" onQueryChange={() => undefined} onValueChange={() => undefined} ariaLabel="Country" />
    <Autocomplete options={options} defaultValue="cn" defaultQuery="China" ariaLabel="Country" />
    <SearchableSelect options={options} onValueChange={() => undefined} ariaLabel="Country" />
    <TagInput value={[]} inputValue="" onInputValueChange={() => undefined} onValueChange={() => undefined} />
    <TagInput defaultValue={["base"]} defaultInputValue="draft" />
    <Cascader options={options} value={[]} onValueChange={() => undefined} ariaLabel="Region" />
    <Cascader options={options} defaultValue={["cn"]} ariaLabel="Region" />
    <TreeSelect options={options} onValueChange={() => undefined} ariaLabel="Region" />
    <TreeSelect options={options} defaultValue="cn" ariaLabel="Region" />
    <TreeSelect options={[{ value: "rich", label: <strong>Rich label</strong>, textValue: "Rich label" }]} ariaLabel="Rich tree select" />
    <Transfer options={options} value={[]} onValueChange={() => undefined} />
    <Transfer options={options} defaultValue={["cn"]} />
  </>
);
void allowedExtraControls;

// @ts-expect-error fixed forms do not expose className
const formClassName = <Form className="foreign" />;
// @ts-expect-error fixed forms expose a limited handle instead of a raw DOM ref
const formRef = <Form ref={createRef<HTMLFormElement>()} />;
// @ts-expect-error form controlRef accepts only the limited form handle
const formDomControlRef = <Form controlRef={createRef<HTMLFormElement>()} />;
// @ts-expect-error number inputs do not expose internal ownership markers
const numberOwner = <NumberInput value={1} onValueChange={() => undefined} data-pui-owner="Consumer" />;
// @ts-expect-error number inputs do not expose raw DOM refs
const numberRef = <NumberInput value={1} onValueChange={() => undefined} ref={createRef<HTMLInputElement>()} />;
// @ts-expect-error rich text editors do not expose consumer styles
const richTextStyle = <RichTextEditor value="" onValueChange={() => undefined} style={{ color: "red" }} />;
// @ts-expect-error rich text editors expose a limited handle instead of a raw DOM ref
const richTextRef = <RichTextEditor value="" onValueChange={() => undefined} ref={createRef<HTMLTextAreaElement>()} />;
// @ts-expect-error controlled editors cannot also receive defaultValue
const richTextDefault = <RichTextEditor value="" defaultValue="draft" onValueChange={() => undefined} />;
// @ts-expect-error code editors do not expose className
const codeClassName = <CodeEditor value="" onValueChange={() => undefined} className="foreign" />;
// @ts-expect-error code editor controlRef accepts only the limited text handle
const codeDomControlRef = <CodeEditor value="" onValueChange={() => undefined} controlRef={createRef<HTMLTextAreaElement>()} />;
// @ts-expect-error CodeEditor only supports focus or indent Tab ownership
const codeUnsupportedTabBehavior = <CodeEditor value="" onValueChange={() => undefined} tabBehavior="trap" />;
// @ts-expect-error inline editing owns its fixed visual class
const inlineClassName = <InlineEdit value="" onCommit={() => undefined} className="foreign" />;
// @ts-expect-error async select owns its fixed visual class
const asyncClassName = <AsyncSelect options={options} query="" onQueryChange={() => undefined} onValueChange={() => undefined} ariaLabel="Country" className="foreign" />;
// @ts-expect-error multi-select owns its fixed visual class
const multiClassName = <MultiSelect options={options} value={[]} onValueChange={() => undefined} ariaLabel="Countries" className="foreign" />;
// @ts-expect-error a controlled async query requires its change callback
const asyncMissingQueryChange = <AsyncSelect options={options} query="chi" onValueChange={() => undefined} ariaLabel="Country" />;
// @ts-expect-error an async query cannot be controlled and initialized at once
const asyncQueryConflict = <AsyncSelect options={options} query="chi" defaultQuery="cn" onQueryChange={() => undefined} onValueChange={() => undefined} ariaLabel="Country" />;
// @ts-expect-error an internal loader and external options are mutually exclusive
const asyncSourceConflict = <AsyncSelect options={options} loadOptions={async () => options} ariaLabel="Country" />;
// @ts-expect-error external result freshness is only meaningful with external options
const asyncLoaderQueryConflict = <AsyncSelect loadOptions={async () => options} optionsQuery="chi" ariaLabel="Country" />;
// @ts-expect-error a controlled multi-select query requires its change callback
const multiMissingQueryChange = <MultiSelect options={options} value={[]} query="chi" onValueChange={() => undefined} ariaLabel="Countries" />;
// @ts-expect-error a multi-select query cannot be controlled and initialized at once
const multiQueryConflict = <MultiSelect options={options} value={[]} query="chi" defaultQuery="cn" onQueryChange={() => undefined} onValueChange={() => undefined} ariaLabel="Countries" />;
// @ts-expect-error a controlled OTP value requires its change callback
const otpMissingValueChange = <OtpInput value="123456" />;
// @ts-expect-error OTP value cannot be controlled and initialized at once
const otpValueConflict = <OtpInput value="123456" defaultValue="654321" onValueChange={() => undefined} />;
// @ts-expect-error a controlled autocomplete value requires its change callback
const autocompleteMissingValueChange = <Autocomplete options={options} value="cn" defaultQuery="China" ariaLabel="Country" />;
// @ts-expect-error autocomplete value cannot be controlled and initialized at once
const autocompleteValueConflict = <Autocomplete options={options} value="cn" defaultValue="us" onValueChange={() => undefined} defaultQuery="China" ariaLabel="Country" />;
// @ts-expect-error a controlled autocomplete query requires its change callback
const autocompleteMissingQueryChange = <Autocomplete options={options} defaultValue="cn" query="China" ariaLabel="Country" />;
// @ts-expect-error autocomplete query cannot be controlled and initialized at once
const autocompleteQueryConflict = <Autocomplete options={options} defaultValue="cn" query="China" defaultQuery="United" onQueryChange={() => undefined} ariaLabel="Country" />;
// @ts-expect-error a controlled async-select value requires its change callback
const asyncMissingValueChange = <AsyncSelect options={options} value="cn" defaultQuery="chi" ariaLabel="Country" />;
// @ts-expect-error async-select value cannot be controlled and initialized at once
const asyncValueConflict = <AsyncSelect options={options} value="cn" defaultValue="us" onValueChange={() => undefined} defaultQuery="chi" ariaLabel="Country" />;
// @ts-expect-error a controlled multi-select value requires its change callback
const multiMissingValueChange = <MultiSelect options={options} value={[]} defaultQuery="chi" ariaLabel="Countries" />;
// @ts-expect-error multi-select value cannot be controlled and initialized at once
const multiValueConflict = <MultiSelect options={options} value={[]} defaultValue={["cn"]} onValueChange={() => undefined} defaultQuery="chi" ariaLabel="Countries" />;
// @ts-expect-error a controlled tag list requires its change callback
const tagMissingValueChange = <TagInput value={[]} defaultInputValue="" />;
// @ts-expect-error tag list cannot be controlled and initialized at once
const tagValueConflict = <TagInput value={[]} defaultValue={["base"]} onValueChange={() => undefined} defaultInputValue="" />;
// @ts-expect-error a controlled tag draft requires its change callback
const tagMissingInputChange = <TagInput defaultValue={[]} inputValue="draft" />;
// @ts-expect-error tag draft cannot be controlled and initialized at once
const tagInputConflict = <TagInput defaultValue={[]} inputValue="draft" defaultInputValue="base" onInputValueChange={() => undefined} />;
// @ts-expect-error a controlled cascader path requires its change callback
const cascaderMissingValueChange = <Cascader options={options} value={[]} ariaLabel="Region" />;
// @ts-expect-error cascader path cannot be controlled and initialized at once
const cascaderValueConflict = <Cascader options={options} value={[]} defaultValue={["cn"]} onValueChange={() => undefined} ariaLabel="Region" />;
// @ts-expect-error a controlled tree value requires its change callback
const treeMissingValueChange = <TreeSelect options={options} value="cn" ariaLabel="Region" />;
// @ts-expect-error tree value cannot be controlled and initialized at once
const treeValueConflict = <TreeSelect options={options} value="cn" defaultValue="us" onValueChange={() => undefined} ariaLabel="Region" />;
// @ts-expect-error a controlled transfer value requires its change callback
const transferMissingValueChange = <Transfer options={options} value={[]} />;
// @ts-expect-error transfer value cannot be controlled and initialized at once
const transferValueConflict = <Transfer options={options} value={[]} defaultValue={["cn"]} onValueChange={() => undefined} />;
// @ts-expect-error InlineEdit persists only through the required commit command
const inlineMissingCommit = <InlineEdit value="Ada" />;
// @ts-expect-error InlineEdit has no uncontrolled persisted-value mode
const inlineDefaultValue = <InlineEdit defaultValue="Ada" onCommit={() => undefined} />;
// @ts-expect-error OTP input owns its fixed visual class
const otpClassName = <OtpInput value="" onValueChange={() => undefined} className="foreign" />;
// @ts-expect-error file upload does not expose consumer styles
const uploadStyle = <FileUpload items={[]} onFiles={() => undefined} style={{ color: "red" }} />;
// @ts-expect-error autocomplete does not expose raw DOM refs
const autocompleteRef = <Autocomplete options={options} query="" onQueryChange={() => undefined} onValueChange={() => undefined} ariaLabel="Country" ref={createRef<HTMLDivElement>()} />;
// @ts-expect-error searchable select does not expose internal ownership markers
const searchableOwner = <SearchableSelect options={options} onValueChange={() => undefined} ariaLabel="Country" data-pui-owner="Consumer" />;
// @ts-expect-error tag input owns its fixed visual class
const tagClassName = <TagInput value={[]} inputValue="" onInputValueChange={() => undefined} onValueChange={() => undefined} className="foreign" />;
// @ts-expect-error cascader does not expose consumer styles
const cascaderStyle = <Cascader options={options} value={[]} onValueChange={() => undefined} ariaLabel="Region" style={{ color: "red" }} />;
// @ts-expect-error tree select does not expose internal ownership markers
const treeOwner = <TreeSelect options={options} onValueChange={() => undefined} ariaLabel="Region" data-pui-slot="foreign" />;
// @ts-expect-error transfer owns its fixed visual class
const transferClassName = <Transfer options={options} value={[]} onValueChange={() => undefined} className="foreign" />;

void formClassName;
void formRef;
void formDomControlRef;
void numberOwner;
void numberRef;
void richTextStyle;
void richTextRef;
void richTextDefault;
void codeClassName;
void codeDomControlRef;
void codeUnsupportedTabBehavior;
void inlineClassName;
void asyncClassName;
void multiClassName;
void asyncMissingQueryChange;
void asyncQueryConflict;
void asyncSourceConflict;
void asyncLoaderQueryConflict;
void multiMissingQueryChange;
void multiQueryConflict;
void otpMissingValueChange;
void otpValueConflict;
void autocompleteMissingValueChange;
void autocompleteValueConflict;
void autocompleteMissingQueryChange;
void autocompleteQueryConflict;
void asyncMissingValueChange;
void asyncValueConflict;
void multiMissingValueChange;
void multiValueConflict;
void tagMissingValueChange;
void tagValueConflict;
void tagMissingInputChange;
void tagInputConflict;
void cascaderMissingValueChange;
void cascaderValueConflict;
void treeMissingValueChange;
void treeValueConflict;
void transferMissingValueChange;
void transferValueConflict;
void inlineMissingCommit;
void inlineDefaultValue;
void otpClassName;
void uploadStyle;
void autocompleteRef;
void searchableOwner;
void tagClassName;
void cascaderStyle;
void treeOwner;
void transferClassName;
