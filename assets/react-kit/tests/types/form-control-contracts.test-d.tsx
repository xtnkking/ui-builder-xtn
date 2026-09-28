import { createRef } from "react";
import type { ControllerRenderProps } from "react-hook-form";
import {
  Checkbox,
  DateField,
  Field,
  Input,
  PasswordInput,
  Radio,
  SearchInput,
  Select,
  Combobox,
  SegmentedControl,
  Switch,
  Textarea,
  type ControllerFieldBinding,
  type PasswordInputProps,
  type SearchInputProps,
  type TextControlHandle,
  type ValidityControlHandle,
} from "../../src/personal-ui";

const textControlRef = createRef<TextControlHandle>();
const validityControlRef = createRef<ValidityControlHandle>();
const inputControllerField: ControllerFieldBinding<string, HTMLInputElement> = {
  name: "email",
  value: "ada@example.com",
  onChange: () => undefined,
  onBlur: () => undefined,
  ref: textControlRef,
};
const textareaControllerField: ControllerFieldBinding<string, HTMLTextAreaElement> = {
  name: "notes",
  value: "Draft",
  onChange: () => undefined,
  onBlur: () => undefined,
  ref: textControlRef,
};
declare const reactHookFormField: ControllerRenderProps<{ email: string }, "email">;
const allowedFormControls = (
  <>
    <Field label="Email" htmlFor="email"><Input id="email" /></Field>
    <Field label="Methods" group><Checkbox label="Email" /></Field>
    <Input defaultValue="draft" controlRef={textControlRef} data-track="email" />
    <Input data-pui-consumer-state="draft" />
    <Input value="saved" onChange={() => undefined} />
    <Input value={undefined} defaultValue="draft" />
    <Input controllerField={inputControllerField} />
    <Input controllerField={reactHookFormField} />
    <PasswordInput defaultValue="secret" controlRef={textControlRef} />
    <PasswordInput data-pui-consumer-state="draft" />
    <PasswordInput controllerField={inputControllerField} />
    <SearchInput value="query" onChange={() => undefined} onClear={() => undefined} controlRef={textControlRef} />
    <Select name="country" form="profile" required controlRef={validityControlRef} options={[{ value: "us", label: "US" }]} value="us" onValueChange={() => undefined} ariaLabel="Country" />
    <Combobox name="country-search" form="profile" required controlRef={validityControlRef} options={[{ value: "us", label: "United States" }]} value="us" onValueChange={() => undefined} ariaLabel="Country search" />
    <SegmentedControl name="view" form="profile" required controlRef={validityControlRef} value="list" options={[{ value: "list", label: "List" }]} onValueChange={() => undefined} ariaLabel="View" />
    <Textarea defaultValue="notes" controlRef={textControlRef} />
    <Textarea controllerField={textareaControllerField} />
    <DateField precision="day" defaultValue="2026-09-19" controlRef={validityControlRef} />
    <Checkbox label="Remember" defaultChecked />
    <Checkbox label="Remember" checked onChange={() => undefined} />
    <Checkbox label="Remember" checked={undefined} defaultChecked />
    <Radio label="Email" defaultChecked />
    <Switch label="Alerts" checked={false} onChange={() => undefined} />
  </>
);
void allowedFormControls;

// @ts-expect-error fixed inputs do not expose className
const inputClassName = <Input className="foreign" />;
// @ts-expect-error fixed inputs do not expose style
const inputStyle = <Input style={{ color: "red" }} />;
// @ts-expect-error fixed inputs do not expose CSS-in-JS props
const inputCss = <Input css={{ color: "red" }} />;
// @ts-expect-error fixed inputs do not expose sx
const inputSx = <Input sx={{ color: "red" }} />;
// @ts-expect-error fixed inputs do not expose utility class props
const inputTw = <Input tw="text-red" />;
// @ts-expect-error fixed inputs do not expose raw DOM refs
const inputRef = <Input ref={createRef<HTMLInputElement>()} />;
// @ts-expect-error controlRef accepts only the limited text-control handle
const inputDomControlRef = <Input controlRef={createRef<HTMLInputElement>()} />;
// @ts-expect-error fixed inputs do not expose raw HTML injection
const inputHtml = <Input dangerouslySetInnerHTML={{ __html: "unsafe" }} />;
// @ts-expect-error fixed inputs do not expose internal ownership markers
const inputOwner = <Input data-pui-owner="Consumer" />;
// @ts-expect-error fixed inputs do not expose internal slot markers
const inputSlot = <Input data-pui-slot="foreign" />;

// @ts-expect-error controlled input values require onChange
const inputMissingChange = <Input value="saved" />;
// @ts-expect-error controlled and uncontrolled input values are mutually exclusive
const contradictoryInput = <Input value="saved" defaultValue="draft" onChange={() => undefined} />;
// @ts-expect-error controllerField owns the direct value channel
const controllerWithValue = <Input controllerField={inputControllerField} value="saved" onChange={() => undefined} />;
// @ts-expect-error controllerField owns the limited ref channel
const controllerWithControlRef = <Input controllerField={inputControllerField} controlRef={textControlRef} />;
// @ts-expect-error controllerField requires the complete blur/ref contract
const incompleteController = <Input controllerField={{ name: "email", value: "saved", onChange: () => undefined }} />;
// @ts-expect-error controllerField requires a usable ref callback or object
const nullControllerRef = <Input controllerField={{ name: "email", value: "saved", onChange: () => undefined, onBlur: () => undefined, ref: null }} />;
// @ts-expect-error SearchInput is controlled-only
const uncontrolledSearch = <SearchInput defaultValue="query" onChange={() => undefined} />;
// @ts-expect-error SearchInput requires onChange
const searchMissingChange = <SearchInput value="query" />;
// @ts-expect-error PasswordInput wrappers retain the explicit owner-marker boundary
const passwordOwnerProps: PasswordInputProps = { "data-pui-owner": "Consumer" };
// @ts-expect-error SearchInput wrappers retain the explicit slot-marker boundary
const searchSlotProps: SearchInputProps = { value: "query", onChange: () => undefined, "data-pui-slot": "foreign" };
// @ts-expect-error arbitrary reserved data remains closed after input wrapping
const passwordPrivateProps: PasswordInputProps = { "data-pui-private": "foreign" };
// @ts-expect-error PasswordInput JSX rejects the explicitly reserved owner marker
const passwordOwnerJsx = <PasswordInput data-pui-owner="Consumer" />;
// @ts-expect-error SearchInput JSX rejects the explicitly reserved slot marker
const searchSlotJsx = <SearchInput value="query" onChange={() => undefined} data-pui-slot="foreign" />;
// @ts-expect-error re-publishing PasswordInput must not reopen className
const passwordClassName = <PasswordInput className="foreign" />;
// @ts-expect-error re-publishing SearchInput must not reopen style
const searchStyle = <SearchInput value="query" onChange={() => undefined} style={{ color: "red" }} />;
// @ts-expect-error wrapped inputs do not expose raw DOM refs
const passwordRef = <PasswordInput ref={createRef<HTMLInputElement>()} />;
// @ts-expect-error Select owns its visual class
const selectClassName = <Select options={[]} onValueChange={() => undefined} ariaLabel="Country" className="foreign" />;
// @ts-expect-error Combobox owns its visual style
const comboboxStyle = <Combobox options={[]} onValueChange={() => undefined} ariaLabel="Country" style={{ color: "red" }} />;
// @ts-expect-error Select exposes a limited validity handle instead of its button element
const selectDomControlRef = <Select options={[]} value="" onValueChange={() => undefined} ariaLabel="Country" controlRef={createRef<HTMLButtonElement>()} />;
// @ts-expect-error SegmentedControl does not expose internal owner markers
const segmentedOwner = <SegmentedControl value="list" options={[]} onValueChange={() => undefined} ariaLabel="View" data-pui-owner="Consumer" />;
// @ts-expect-error DateField follows the same value-state contract
const contradictoryDate = <DateField precision="month" value="2026-09" defaultValue="2026-08" onChange={() => undefined} />;

// @ts-expect-error controlled checked state requires onChange
const checkboxMissingChange = <Checkbox label="Remember" checked />;
// @ts-expect-error controlled and uncontrolled checked state are mutually exclusive
const contradictoryCheckbox = <Checkbox label="Remember" checked defaultChecked onChange={() => undefined} />;
// @ts-expect-error choice controls do not expose className
const radioClassName = <Radio label="Email" className="foreign" />;
// @ts-expect-error choice controls do not expose style
const switchStyle = <Switch label="Alerts" style={{ color: "red" }} />;

// @ts-expect-error Field requires htmlFor unless it is a group
const fieldWithoutTarget = <Field label="Email"><Input /></Field>;
// @ts-expect-error Field does not expose className
const fieldClassName = <Field label="Email" htmlFor="email" className="foreign"><Input id="email" /></Field>;
// @ts-expect-error Textarea does not expose raw DOM refs
const textareaRef = <Textarea ref={createRef<HTMLTextAreaElement>()} />;

void inputClassName;
void inputStyle;
void inputCss;
void inputSx;
void inputTw;
void inputRef;
void inputDomControlRef;
void inputHtml;
void inputOwner;
void inputSlot;
void inputMissingChange;
void contradictoryInput;
void controllerWithValue;
void controllerWithControlRef;
void incompleteController;
void nullControllerRef;
void uncontrolledSearch;
void searchMissingChange;
void passwordOwnerProps;
void searchSlotProps;
void passwordPrivateProps;
void passwordOwnerJsx;
void searchSlotJsx;
void passwordClassName;
void searchStyle;
void passwordRef;
void selectClassName;
void comboboxStyle;
void selectDomControlRef;
void segmentedOwner;
void contradictoryDate;
void checkboxMissingChange;
void contradictoryCheckbox;
void radioClassName;
void switchStyle;
void fieldWithoutTarget;
void fieldClassName;
void textareaRef;
