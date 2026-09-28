import type { CSSProperties } from "react";
import type {
  ControllableOpenProps,
  ControllableValueProps,
  PublicControlProps,
  TextControlHandle,
} from "../../src/personal-ui";

type LeakyProps = {
  id?: string;
  className?: string;
  style?: CSSProperties;
  css?: object;
  sx?: object;
  tw?: string;
  ref?: unknown;
  dangerouslySetInnerHTML?: { __html: string };
  "data-pui-owner"?: string;
  "data-pui-slot"?: string;
};

const publicProps: PublicControlProps<LeakyProps> = { id: "account" };
void publicProps;

// @ts-expect-error protected styling props are not public
const classNameLeak: PublicControlProps<LeakyProps> = { className: "foreign" };
// @ts-expect-error reserved ownership attributes are not public
const ownerLeak: PublicControlProps<LeakyProps> = { "data-pui-slot": "field" };
void classNameLeak;
void ownerLeak;

const controlledValue: ControllableValueProps<string> = {
  value: "saved",
  onValueChange: () => undefined,
};
const uncontrolledValue: ControllableValueProps<string> = { defaultValue: "draft" };
void controlledValue;
void uncontrolledValue;

// @ts-expect-error controlled value requires its change callback
const controlledWithoutCallback: ControllableValueProps<string> = { value: "saved" };
// @ts-expect-error controlled and default values are mutually exclusive
const contradictoryValue: ControllableValueProps<string> = {
  value: "saved",
  defaultValue: "draft",
  onValueChange: () => undefined,
};
void controlledWithoutCallback;
void contradictoryValue;

const controlledOpen: ControllableOpenProps = { open: true, onOpenChange: () => undefined };
const uncontrolledOpen: ControllableOpenProps = { defaultOpen: true };
void controlledOpen;
void uncontrolledOpen;

// @ts-expect-error controlled open state requires its change callback
const openWithoutCallback: ControllableOpenProps = { open: true };
void openWithoutCallback;

declare const textControl: TextControlHandle;
textControl.focus();
textControl.select();
textControl.setSelectionRange(0, 2);
textControl.setCustomValidity("Required");
textControl.reportValidity();
// @ts-expect-error control handles do not expose mutable DOM styling
textControl.style.color = "red";
