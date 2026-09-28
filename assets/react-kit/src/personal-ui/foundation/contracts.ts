import type { ChangeEventHandler, FocusEventHandler, Ref } from "react";

declare const controlHandleBrand: unique symbol;

export type ProtectedControlProp =
  | "className"
  | "style"
  | "css"
  | "sx"
  | "tw"
  | "ref"
  | "dangerouslySetInnerHTML"
  | "internalClassName"
  | "data-pui-owner";

// JSX permits unknown hyphenated attributes, so current internal markers must also be named explicitly.
type KnownReservedControlDataProps = {
  "data-pui-owner"?: never;
  "data-pui-floating-root"?: never;
  "data-pui-form-bridge"?: never;
  "data-pui-portal-source"?: never;
  "data-pui-toast-portal-root"?: never;
  "data-pui-slot"?: never;
};

type ReservedControlDataProps = {
  [Key in `data-pui-${string}`]?: never;
};

export type PublicControlProps<Props extends object> = {
  [Key in keyof Props as Key extends ProtectedControlProp | `data-pui-${string}` ? never : Key]: Props[Key];
} & KnownReservedControlDataProps & ReservedControlDataProps;

export type ControlledValueProps<Value> = {
  value: Value;
  defaultValue?: never;
  onValueChange: (value: Value) => void;
};

export type UncontrolledValueProps<Value> = {
  value?: never;
  defaultValue?: Value;
  onValueChange?: (value: Value) => void;
};

export type ControllableValueProps<Value> =
  | ControlledValueProps<Value>
  | UncontrolledValueProps<Value>;

export type ControlledOpenProps = {
  open: boolean;
  defaultOpen?: never;
  onOpenChange: (open: boolean) => void;
};

export type UncontrolledOpenProps = {
  open?: never;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export type ControllableOpenProps = ControlledOpenProps | UncontrolledOpenProps;

export interface ControlHandle {
  readonly [controlHandleBrand]: true;
  focus(options?: FocusOptions): void;
}

export interface ValidityControlHandle extends ControlHandle {
  setCustomValidity(error: string): void;
  checkValidity(): boolean;
  reportValidity(): boolean;
}

export interface TextControlHandle extends ValidityControlHandle {
  select(): void;
  setSelectionRange(
    start: number | null,
    end: number | null,
    direction?: "forward" | "backward" | "none",
  ): void;
}

export interface FormControlHandle {
  readonly [controlHandleBrand]: true;
  requestSubmit(submitter?: HTMLElement): void;
  reset(): void;
  checkValidity(): boolean;
  reportValidity(): boolean;
}

export type ControlRef<Handle> = Ref<Handle>;

export interface ControllerFieldBinding<
  Value,
  Element extends HTMLInputElement | HTMLTextAreaElement,
  Handle extends ControlHandle = TextControlHandle,
> {
  name: string;
  value: Value;
  onChange: ChangeEventHandler<Element>;
  onBlur: FocusEventHandler<Element>;
  ref: NonNullable<ControlRef<Handle>>;
}
