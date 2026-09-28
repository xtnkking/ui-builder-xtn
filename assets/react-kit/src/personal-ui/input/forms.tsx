import {
  useCallback,
  useContext,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ChangeEventHandler,
  type FocusEventHandler,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  type TextareaHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Eye, EyeOff, LoaderCircle, Search, X } from "lucide-react";
import type {
  ControlRef,
  ControllerFieldBinding,
  PublicControlProps,
  TextControlHandle,
  ValidityControlHandle,
} from "../foundation/contracts";
import { useControllableMode } from "../internal/controllable-state";
import { FieldContext, type FieldContextValue } from "../internal/field-context";
import { floatingPortalTarget, usePopoverPosition } from "../internal/floating-position";
import {
  assignElementRef,
  createTextControlHandle,
  createValidityControlHandle,
} from "../internal/control-handles";
import {
  CompositeFormControl,
  useCompositeFieldState,
} from "../internal/composite-form-control";
import { sanitizeFixedControlProps } from "../internal/fixed-control-props";
import { usePersonalUILocale } from "../foundation/locale";
import {
  InternalInputSlot,
  InternalInputSlotBoundary,
  useInternalInputSlot,
  useInternalTextareaSlot,
  type InternalInputSlotName,
  type InternalTextareaSlotName,
} from "../internal/input-slots";
import { assertUniqueIdentities, cx, getTabStops } from "../internal/utils";

const useClientLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

type NativeInputValue = string | number | readonly string[];

type NativeValueProps<Element extends HTMLInputElement | HTMLTextAreaElement, Value> =
  | {
      value: Value;
      defaultValue?: never;
      onChange: ChangeEventHandler<Element>;
    }
  | {
      value?: never;
      defaultValue?: Value;
      onChange?: ChangeEventHandler<Element>;
    };

type TextControlValueProps<
  Element extends HTMLInputElement | HTMLTextAreaElement,
  Value,
> =
  | (NativeValueProps<Element, Value> & {
      controllerField?: never;
      controlRef?: ControlRef<TextControlHandle>;
      name?: string;
      onBlur?: FocusEventHandler<Element>;
    })
  | {
      controllerField: ControllerFieldBinding<Value, Element>;
      controlRef?: never;
      name?: never;
      value?: never;
      defaultValue?: never;
      onChange?: never;
      onBlur?: never;
    };

type NativeCheckedProps =
  | {
      checked: boolean;
      defaultChecked?: never;
      onChange: ChangeEventHandler<HTMLInputElement>;
    }
  | {
      checked?: never;
      defaultChecked?: boolean;
      onChange?: ChangeEventHandler<HTMLInputElement>;
    };

function assertControllerFieldContract(
  componentName: string,
  rawProps: object,
  controllerField: ControllerFieldBinding<unknown, HTMLInputElement | HTMLTextAreaElement> | undefined,
): void {
  if (!controllerField) return;
  const processValue = (
    globalThis as typeof globalThis & {
      process?: { env?: { NODE_ENV?: string } };
    }
  ).process;
  if (processValue?.env?.NODE_ENV === "production") return;
  const conflict = ["value", "defaultValue", "onChange", "onBlur", "name", "controlRef"]
    .find((propName) => (rawProps as Record<PropertyKey, unknown>)[propName] !== undefined);
  if (conflict) {
    throw new Error(
      `${componentName} cannot receive both controllerField and ${conflict}.`,
    );
  }
  if (!controllerField.name.trim()) {
    throw new Error(`${componentName} controllerField.name must be a non-empty string.`);
  }
  if (typeof controllerField.onChange !== "function"
    || typeof controllerField.onBlur !== "function"
    || !controllerField.ref) {
    throw new Error(
      `${componentName} controllerField requires onChange, onBlur, and ref.`,
    );
  }
}

function useNativeControlMode(
  componentName: string,
  rawProps: object,
  valuePropName: "checked" | "value" = "value",
  controlledOnly = false,
): void {
  const defaultValuePropName = valuePropName === "checked" ? "defaultChecked" : "defaultValue";
  useControllableMode({
    componentName,
    controlled: (rawProps as Record<PropertyKey, unknown>)[valuePropName] !== undefined,
    controlledOnly,
    defaultValueProvided: (rawProps as Record<PropertyKey, unknown>)[defaultValuePropName] !== undefined,
    onChangeProvided: typeof (rawProps as { onChange?: unknown }).onChange === "function",
    valuePropName,
    defaultValuePropName,
    changePropName: "onChange",
  });
}

type FieldControlAriaProps = Pick<
  InputHTMLAttributes<HTMLInputElement>,
  "id" | "aria-describedby" | "aria-disabled" | "aria-invalid" | "aria-required"
>;

function mergeAriaIds(...values: Array<string | undefined>): string | undefined {
  const ids = Array.from(new Set(values.flatMap((value) => value?.split(/\s+/).filter(Boolean) ?? [])));
  return ids.length ? ids.join(" ") : undefined;
}

function isAriaTrue(value: boolean | "true" | "false" | undefined): boolean {
  return value === true || value === "true";
}

function useFieldControl(
  id: string | undefined,
  describedBy: string | undefined,
  invalid: InputHTMLAttributes<HTMLInputElement>["aria-invalid"],
  required?: InputHTMLAttributes<HTMLInputElement>["aria-required"],
) {
  const field = useContext(FieldContext);
  const generatedId = useId();
  return {
    id: id ?? (field?.group ? generatedId : field?.controlId),
    groupName: field?.groupName,
    describedBy: mergeAriaIds(describedBy, field?.describedBy),
    invalid: field?.invalid ? true : invalid,
    fieldInvalid: field?.invalid ?? false,
    fieldRequired: field?.required ?? false,
    required: field?.required ? true : required,
    group: field?.group ?? false,
  };
}

function firstEnabledIndex<T extends { disabled?: boolean }>(options: readonly T[], fromEnd = false): number {
  if (fromEnd) {
    for (let index = options.length - 1; index >= 0; index -= 1) {
      if (!options[index].disabled) return index;
    }
    return -1;
  }
  return options.findIndex((option) => !option.disabled);
}

function nextEnabledIndex<T extends { disabled?: boolean }>(
  options: readonly T[],
  current: number,
  direction: 1 | -1,
): number {
  if (!options.length) return -1;
  let next = current >= 0 && current < options.length
    ? current
    : direction === 1 ? -1 : 0;
  for (let count = 0; count < options.length; count += 1) {
    next = (next + direction + options.length) % options.length;
    if (!options[next].disabled) return next;
  }
  return -1;
}

function focusAdjacentTabStop(trigger: HTMLElement, root: HTMLElement, backwards: boolean) {
  const modalBoundary = trigger.closest<HTMLElement>("[role='dialog'][aria-modal='true']");
  const withinBoundary = (element: HTMLElement) => !modalBoundary || modalBoundary.contains(element);
  const candidates = getTabStops(document, withinBoundary);
  const triggerIndex = candidates.indexOf(trigger);
  const direction = backwards ? -1 : 1;

  for (
    let index = triggerIndex + direction;
    index >= 0 && index < candidates.length;
    index += direction
  ) {
    if (!root.contains(candidates[index]) && withinBoundary(candidates[index])) {
      candidates[index].focus();
      return;
    }
  }

  if (modalBoundary) {
    const wrappedCandidates = candidates.filter((candidate) => (
      !root.contains(candidate) && modalBoundary.contains(candidate)
    ));
    const wrapped = backwards ? wrappedCandidates[wrappedCandidates.length - 1] : wrappedCandidates[0];
    (wrapped ?? trigger).focus();
    return;
  }

  trigger.blur();
}

type FieldBaseProps = PublicControlProps<{
  label: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
}>;

export type FieldProps = FieldBaseProps & (
  | { group: true; htmlFor?: string }
  | { group?: false; htmlFor: string }
);

export function Field(rawProps: FieldProps) {
  const { message } = usePersonalUILocale();
  const safeProps = sanitizeFixedControlProps(rawProps, ["aria-describedby", "aria-invalid"]);
  const { label, htmlFor, group = false, required, hint, error, children } = safeProps;
  const generatedId = useId();
  if (!group && (!htmlFor || !htmlFor.trim())) {
    throw new TypeError("Field htmlFor must be a non-empty string unless group is true.");
  }
  const fieldId = htmlFor?.trim() || generatedId;
  const invalid = Boolean(error);
  const describedBy = invalid
    ? `${fieldId}-error`
    : hint ? `${fieldId}-hint` : undefined;
  const context = useMemo<FieldContextValue>(() => ({
    controlId: group ? undefined : fieldId,
    labelId: group ? undefined : `${fieldId}-label`,
    groupName: group ? fieldId : undefined,
    describedBy,
    invalid,
    required: Boolean(required),
    group,
  }), [describedBy, fieldId, group, invalid, required]);

  const labelContent = (
    <>
      <span>{label}</span>
      {required ? <span className="pui-label__required">{message("field.required")}</span> : null}
    </>
  );
  const messages = (
    <>
      {error ? <div id={`${fieldId}-error`} className="pui-field__error" role="alert">{error}</div> : null}
      {!error && hint ? <div id={`${fieldId}-hint`} className="pui-field__hint">{hint}</div> : null}
    </>
  );

  if (group) {
    return (
      <fieldset
        className={cx("pui-field", "pui-field--group")}
        data-invalid={invalid || undefined}
        data-pui-owner="Field"
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
      >
        <legend className="pui-label">{labelContent}</legend>
        <FieldContext.Provider value={context}>{children}</FieldContext.Provider>
        {messages}
      </fieldset>
    );
  }

  return (
    <div className="pui-field" data-invalid={invalid || undefined} data-pui-owner="Field">
      <label id={`${fieldId}-label`} className="pui-label" htmlFor={fieldId}>{labelContent}</label>
      <FieldContext.Provider value={context}>{children}</FieldContext.Provider>
      {messages}
    </div>
  );
}

type InputBaseProps = PublicControlProps<Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "children" | "defaultValue" | "name" | "onBlur" | "onChange" | "size" | "value"
>> & {
  startAdornment?: ReactNode;
  endAdornment?: ReactNode;
  invalid?: boolean;
};

type WrappedInputControlProps<Props extends object> = PublicControlProps<Props> & {
  "data-pui-owner"?: never;
  "data-pui-slot"?: never;
};

export type InputProps = InputBaseProps & TextControlValueProps<HTMLInputElement, NativeInputValue>;

type InputOwner = "DateField" | "Input" | "NumberInput" | "PasswordInput" | "SearchInput";

interface InputSlotConfig {
  className?: string;
  owner: InputOwner;
}

const DEFAULT_INPUT_SLOT: InputSlotConfig = { owner: "Input" };
const INPUT_SLOT_CONFIG: Record<InternalInputSlotName, InputSlotConfig> = {
  "date-field": { owner: "DateField" },
  "number-input": { className: "pui-number-input", owner: "NumberInput" },
  "password-input": { owner: "PasswordInput" },
  "search-input": { owner: "SearchInput" },
};

export function Input(rawProps: InputProps) {
  const safeProps = sanitizeFixedControlProps(rawProps, ["children", "size"]);
  const {
    startAdornment,
    endAdornment,
    invalid,
    id,
    required,
    readOnly,
    "aria-disabled": ariaDisabled,
    "aria-describedby": ariaDescribedBy,
    "aria-invalid": ariaInvalid,
    controllerField,
    name,
    value,
    defaultValue,
    onChange,
    onBlur,
    onClick,
    onKeyDown,
    controlRef,
    ...props
  } = safeProps;
  const internalSlot = useInternalInputSlot();
  const { className: slotClassName, owner } = internalSlot
    ? INPUT_SLOT_CONFIG[internalSlot.name]
    : DEFAULT_INPUT_SLOT;
  assertControllerFieldContract(
    owner,
    rawProps,
    controllerField as ControllerFieldBinding<unknown, HTMLInputElement> | undefined,
  );
  useNativeControlMode(owner, controllerField
    ? { value: controllerField.value, onChange: controllerField.onChange }
    : rawProps);
  const elementRef = useRef<HTMLInputElement | null>(null);
  const mergedElementRef = useCallback((element: HTMLInputElement | null) => {
    elementRef.current = element;
    assignElementRef(internalSlot?.elementRef, element);
  }, [internalSlot?.elementRef]);
  useImperativeHandle(controllerField?.ref ?? controlRef, () => createTextControlHandle(elementRef), []);
  useImperativeHandle(internalSlot?.controlRef, () => createValidityControlHandle(elementRef), []);
  const fieldControl = useFieldControl(id, ariaDescribedBy, invalid ? true : ariaInvalid, required);
  const isInvalid = fieldControl.fieldInvalid || invalid || fieldControl.invalid === true || fieldControl.invalid === "true";
  const interactionDisabled = isAriaTrue(ariaDisabled);
  const handleChange: ChangeEventHandler<HTMLInputElement> = (event) => {
    if (interactionDisabled) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    (controllerField?.onChange ?? onChange)?.(event);
  };
  const handleClick: NonNullable<InputHTMLAttributes<HTMLInputElement>["onClick"]> = (event) => {
    if (interactionDisabled) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    onClick?.(event);
  };
  const handleKeyDown: NonNullable<InputHTMLAttributes<HTMLInputElement>["onKeyDown"]> = (event) => {
    if (interactionDisabled && event.key !== "Tab") {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    onKeyDown?.(event);
  };
  if (!startAdornment && !endAdornment) {
    return (
      <input
        {...props}
        ref={mergedElementRef}
        id={fieldControl.id}
        name={controllerField?.name ?? name}
        value={controllerField ? controllerField.value : value}
        defaultValue={defaultValue}
        required={Boolean(fieldControl.required)}
        readOnly={Boolean(readOnly || interactionDisabled)}
        className={cx("pui-input", slotClassName)}
        aria-disabled={ariaDisabled}
        aria-describedby={fieldControl.describedBy}
        aria-invalid={fieldControl.invalid}
        data-pui-owner={owner}
        onChange={handleChange}
        onBlur={controllerField?.onBlur ?? onBlur}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      />
    );
  }
  return (
    <span className={cx("pui-input-shell", isInvalid && "is-invalid", slotClassName)} data-pui-owner={owner}>
      <InternalInputSlotBoundary>
        {startAdornment ? <span className="pui-input-shell__start">{startAdornment}</span> : null}
        <input
          {...props}
          ref={mergedElementRef}
          id={fieldControl.id}
          name={controllerField?.name ?? name}
          value={controllerField ? controllerField.value : value}
          defaultValue={defaultValue}
          required={Boolean(fieldControl.required)}
          readOnly={Boolean(readOnly || interactionDisabled)}
          className="pui-input pui-input--embedded"
          aria-disabled={ariaDisabled}
          aria-describedby={fieldControl.describedBy}
          aria-invalid={fieldControl.invalid}
          onChange={handleChange}
          onBlur={controllerField?.onBlur ?? onBlur}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
        />
        {endAdornment ? <span className="pui-input-shell__end">{endAdornment}</span> : null}
      </InternalInputSlotBoundary>
    </span>
  );
}

export type PasswordInputProps = WrappedInputControlProps<Omit<InputBaseProps, "endAdornment" | "type">> &
  TextControlValueProps<HTMLInputElement, NativeInputValue> & {
  showLabel?: string;
  hideLabel?: string;
};

export function PasswordInput(rawProps: PasswordInputProps) {
  const { message } = usePersonalUILocale();
  const safeProps = sanitizeFixedControlProps(rawProps, ["children", "size"]);
  const {
    showLabel = message("password.show"),
    hideLabel = message("password.hide"),
    disabled,
    "aria-disabled": ariaDisabled,
    ...props
  } = safeProps;
  const [visible, setVisible] = useState(false);
  const interactionDisabled = isAriaTrue(ariaDisabled);
  return (
    <InternalInputSlot name="password-input">
      <Input
        {...props}
        disabled={disabled}
        aria-disabled={ariaDisabled}
        type={visible ? "text" : "password"}
        endAdornment={(
          <button
            type="button"
            className="pui-input-action"
            aria-label={visible ? hideLabel : showLabel}
            aria-pressed={visible}
            disabled={disabled}
            aria-disabled={interactionDisabled || undefined}
            onClick={(event) => {
              if (interactionDisabled) {
                event.preventDefault();
                event.stopPropagation();
                return;
              }
              setVisible((current) => !current);
            }}
          >
            {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
          </button>
        )}
      />
    </InternalInputSlot>
  );
}

export type SearchInputProps = WrappedInputControlProps<Omit<
  InputBaseProps,
  "endAdornment" | "startAdornment" | "type"
>> & {
  value: string;
  defaultValue?: never;
  onChange: ChangeEventHandler<HTMLInputElement>;
  name?: string;
  onBlur?: FocusEventHandler<HTMLInputElement>;
  controlRef?: ControlRef<TextControlHandle>;
  onClear?: () => void;
  clearLabel?: string;
};

export function SearchInput(rawProps: SearchInputProps) {
  const { message } = usePersonalUILocale();
  useNativeControlMode("SearchInput", rawProps, "value", true);
  const safeProps = sanitizeFixedControlProps(rawProps, ["children", "size"]);
  const {
    value,
    onClear,
    clearLabel = message("search.clear"),
    disabled,
    readOnly,
    "aria-disabled": ariaDisabled,
    ...props
  } = safeProps;
  const interactionDisabled = isAriaTrue(ariaDisabled);
  return (
    <InternalInputSlot name="search-input">
      <Input
        {...props}
        type="search"
        value={value}
        disabled={disabled}
        readOnly={readOnly}
        aria-disabled={ariaDisabled}
        startAdornment={<Search aria-hidden="true" />}
        endAdornment={onClear ? (
          <button
            type="button"
            className="pui-input-action"
            aria-label={clearLabel}
            aria-hidden={!value}
            tabIndex={value ? 0 : -1}
            data-visible={Boolean(value) || undefined}
            disabled={disabled || readOnly}
            aria-disabled={interactionDisabled || undefined}
            onClick={(event) => {
              if (interactionDisabled) {
                event.preventDefault();
                event.stopPropagation();
                return;
              }
              const input = event.currentTarget.closest(".pui-input-shell")?.querySelector<HTMLInputElement>("input");
              onClear();
              input?.focus();
            }}
          >
            <X aria-hidden="true" />
          </button>
        ) : undefined}
      />
    </InternalInputSlot>
  );
}

type TextareaBaseProps = PublicControlProps<Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "children" | "defaultValue" | "name" | "onBlur" | "onChange" | "value"
>>;

export type TextareaProps = TextareaBaseProps & TextControlValueProps<HTMLTextAreaElement, string | number>;

const TEXTAREA_SLOT_CONFIG: Record<InternalTextareaSlotName, { className?: string; owner: "CodeEditor" | "MarkdownEditor" | "RichTextEditor" }> = {
  "code-editor": { className: "pui-code-editor__input", owner: "CodeEditor" },
  "markdown-editor": { owner: "MarkdownEditor" },
  "rich-text-editor": { owner: "RichTextEditor" },
};

export function Textarea(rawProps: TextareaProps) {
  const safeProps = sanitizeFixedControlProps(rawProps, ["children"]);
  const {
    id,
    required,
    readOnly,
    "aria-disabled": ariaDisabled,
    "aria-describedby": ariaDescribedBy,
    "aria-invalid": ariaInvalid,
    controllerField,
    name,
    value,
    defaultValue,
    onChange,
    onBlur,
    onClick,
    onKeyDown,
    controlRef,
    ...props
  } = safeProps;
  const internalSlot = useInternalTextareaSlot();
  const slotConfig = internalSlot ? TEXTAREA_SLOT_CONFIG[internalSlot.name] : null;
  const owner = slotConfig?.owner ?? "Textarea";
  assertControllerFieldContract(
    owner,
    rawProps,
    controllerField as ControllerFieldBinding<unknown, HTMLTextAreaElement> | undefined,
  );
  useNativeControlMode(owner, controllerField
    ? { value: controllerField.value, onChange: controllerField.onChange }
    : rawProps);
  const elementRef = useRef<HTMLTextAreaElement | null>(null);
  useImperativeHandle(controllerField?.ref ?? controlRef, () => createTextControlHandle(elementRef), []);
  const mergedRef = useCallback((element: HTMLTextAreaElement | null) => {
    elementRef.current = element;
    assignElementRef(internalSlot?.elementRef, element);
  }, [internalSlot?.elementRef]);
  const fieldControl = useFieldControl(id, ariaDescribedBy, ariaInvalid, required);
  const interactionDisabled = isAriaTrue(ariaDisabled);
  return (
    <textarea
      {...props}
      ref={mergedRef}
      id={fieldControl.id}
      name={controllerField?.name ?? name}
      value={controllerField ? controllerField.value : value}
      defaultValue={defaultValue}
      required={Boolean(fieldControl.required)}
      readOnly={Boolean(readOnly || interactionDisabled)}
      className={cx("pui-textarea", slotConfig?.className)}
      aria-disabled={ariaDisabled}
      aria-describedby={fieldControl.describedBy}
      aria-invalid={fieldControl.invalid}
      data-pui-owner={owner}
      onChange={(event) => {
        if (interactionDisabled) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        (controllerField?.onChange ?? onChange)?.(event);
      }}
      onBlur={controllerField?.onBlur ?? onBlur}
      onClick={(event) => {
        if (interactionDisabled) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        onClick?.(event);
      }}
      onKeyDown={(event) => {
        if (interactionDisabled && event.key !== "Tab") {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        onKeyDown?.(event);
      }}
    />
  );
}

export interface SelectOption {
  value: string;
  label: ReactNode;
  leading?: ReactNode;
  disabled?: boolean;
  textValue?: string;
}

export type SelectProps = PublicControlProps<FieldControlAriaProps & {
  options: readonly SelectOption[];
  value?: string;
  onValueChange: (value: string) => void;
  name?: string;
  form?: string;
  required?: boolean;
  ariaLabel: string;
  placeholder?: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  placement?: "bottom" | "top";
  controlRef?: ControlRef<ValidityControlHandle>;
}>;

function selectOptionText(option: SelectOption): string {
  if (option.textValue) return option.textValue;
  if (typeof option.label === "string" || typeof option.label === "number") return String(option.label);
  return option.value;
}

export function Select(rawProps: SelectProps) {
  const { message } = usePersonalUILocale();
  const safeProps = sanitizeFixedControlProps(rawProps);
  const {
    options,
    value,
    onValueChange,
    name,
    form,
    required,
    ariaLabel,
    placeholder = message("select.placeholder"),
    disabled,
    loading = false,
    loadingLabel = message("common.loading"),
    placement = "bottom",
    id: providedId,
    "aria-disabled": ariaDisabled,
    "aria-required": ariaRequired,
    "aria-describedby": ariaDescribedBy,
    "aria-invalid": ariaInvalid,
    controlRef,
  } = safeProps;
  useControllableMode({
    componentName: "Select",
    controlled: true,
    controlledOnly: true,
    defaultValueProvided: (rawProps as { defaultValue?: unknown }).defaultValue !== undefined,
    onChangeProvided: typeof onValueChange === "function",
  });
  assertUniqueIdentities("Select", "option.value", options.map((option) => option.value), { allowEmpty: true });
  const generatedId = useId();
  const fieldControl = useFieldControl(providedId, ariaDescribedBy, ariaInvalid, required || ariaRequired);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const typeaheadRef = useRef("");
  const typeaheadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const hasLeading = options.some((option) => option.leading != null);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const [activeValue, setActiveValue] = useState<string | null>(() => (
    selectedIndex >= 0 && !options[selectedIndex].disabled
      ? options[selectedIndex].value
      : options[firstEnabledIndex(options)]?.value ?? null
  ));
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;
  const interactionDisabled = ariaDisabled === true || ariaDisabled === "true" || loading;
  const unavailable = Boolean(disabled || interactionDisabled || options.length === 0);
  const triggerAriaLabel = selected
    ? message("select.currentValue", { label: ariaLabel, value: selectOptionText(selected) })
    : message("select.unselected", { label: ariaLabel });
  const resolvedTriggerAriaLabel = loading
    ? message("select.loadingState", { label: triggerAriaLabel, loading: loadingLabel })
    : triggerAriaLabel;
  const preferredActiveValue = selectedIndex >= 0 && !options[selectedIndex].disabled
    ? options[selectedIndex].value
    : options[firstEnabledIndex(options)]?.value ?? null;
  const activeIndex = options.findIndex((option) => option.value === activeValue);
  const activeOptionIsValid = activeIndex >= 0
    && activeIndex < options.length
    && !options[activeIndex].disabled;
  usePopoverPosition(open, placement, rootRef, popoverRef);

  useEffect(() => {
    setPortalTarget(floatingPortalTarget(rootRef.current));
  }, []);

  const openMenu = () => {
    if (unavailable) return;
    setActiveValue(preferredActiveValue);
    setOpen(true);
  };

  const closeMenu = (restoreFocus = false) => {
    if (restoreFocus) triggerRef.current?.focus();
    setOpen(false);
  };

  const moveActive = (direction: 1 | -1) => {
    setActiveValue((current) => {
      const currentIndex = options.findIndex((option) => option.value === current);
      const nextIndex = nextEnabledIndex(options, currentIndex, direction);
      return options[nextIndex]?.value ?? null;
    });
  };

  const choose = (index: number) => {
    const option = options[index];
    if (unavailable || !option || option.disabled) return;
    if (option.value !== value) onValueChange(option.value);
    closeMenu(true);
  };

  useEffect(() => {
    if (!open) return;
    const handlePointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !popoverRef.current?.contains(target)) closeMenu();
    };
    document.addEventListener("mousedown", handlePointer);
    return () => document.removeEventListener("mousedown", handlePointer);
  }, [open]);

  useEffect(() => {
    if (unavailable) setOpen(false);
    if (!options.length) setActiveValue(null);
  }, [options.length, unavailable]);

  useEffect(() => {
    if (open && !activeOptionIsValid && activeValue !== preferredActiveValue) {
      setActiveValue(preferredActiveValue);
    }
  }, [activeOptionIsValid, activeValue, open, preferredActiveValue]);

  useEffect(() => {
    if (!open || !activeOptionIsValid) return;
    optionRefs.current[activeIndex]?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeIndex, activeOptionIsValid, open, options]);

  useEffect(() => () => {
    if (typeaheadTimerRef.current) clearTimeout(typeaheadTimerRef.current);
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (unavailable) return;
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (event.key === "Escape" && open) {
      event.preventDefault();
      closeMenu(true);
      return;
    }
    if (event.key === "Tab") {
      closeMenu();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        openMenu();
      } else {
        moveActive(event.key === "ArrowDown" ? 1 : -1);
      }
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      if (!open) openMenu();
      const edgeIndex = firstEnabledIndex(options, event.key === "End");
      setActiveValue(options[edgeIndex]?.value ?? null);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (open) choose(activeIndex);
      else openMenu();
      return;
    }
    if (event.key.length !== 1 || event.altKey || event.ctrlKey || event.metaKey) return;
    const character = event.key.toLocaleLowerCase();
    const previousBuffer = typeaheadRef.current;
    const nextBuffer = `${previousBuffer}${character}`;
    const repeatedCharacter = previousBuffer.length > 0
      && Array.from(previousBuffer).every((entry) => entry === character);
    const searchText = repeatedCharacter ? character : nextBuffer;
    typeaheadRef.current = nextBuffer;
    if (typeaheadTimerRef.current) clearTimeout(typeaheadTimerRef.current);
    typeaheadTimerRef.current = setTimeout(() => { typeaheadRef.current = ""; }, 500);
    const currentIndex = open ? activeIndex : selectedIndex;
    let matchIndex = -1;
    for (let offset = 1; offset <= options.length; offset += 1) {
      const index = (Math.max(currentIndex, -1) + offset) % options.length;
      const option = options[index];
      if (!option.disabled && selectOptionText(option).toLocaleLowerCase().startsWith(searchText)) {
        matchIndex = index;
        break;
      }
    }
    if (matchIndex >= 0) {
      event.preventDefault();
      if (open) setActiveValue(options[matchIndex].value);
      else choose(matchIndex);
    }
  };

  const menu = open ? (
    <div
      ref={popoverRef}
      id={`${generatedId}-listbox`}
      className="pui-select__popover pui-portal"
      role="listbox"
      aria-label={ariaLabel}
      data-pui-floating-root="true"
      data-has-leading={hasLeading || undefined}
    >
      {options.map((option, index) => (
        <button
          ref={(node) => { optionRefs.current[index] = node; }}
          id={`${generatedId}-option-${index}`}
          key={option.value}
          type="button"
          role="option"
          className="pui-select__option"
          aria-selected={option.value === value}
          data-active={activeOptionIsValid && option.value === activeValue || undefined}
          disabled={option.disabled}
          tabIndex={-1}
          onMouseMove={() => {
            if (!option.disabled && activeValue !== option.value) setActiveValue(option.value);
          }}
          onClick={() => choose(index)}
        >
          {hasLeading ? <span className="pui-option__leading" aria-hidden="true">{option.leading ?? null}</span> : null}
          <span className="pui-select__option-label">{option.label}</span>
          <Check aria-hidden="true" />
        </button>
      ))}
    </div>
  ) : null;

  return (
    <div
      ref={rootRef}
      className="pui-select-shell"
      data-open={open || undefined}
      data-placement={placement}
      data-has-leading={hasLeading || undefined}
      data-loading={loading || undefined}
      data-pui-owner="Select"
    >
      <button
        ref={triggerRef}
        id={fieldControl.id}
        type="button"
        className="pui-select"
        role="combobox"
        aria-label={resolvedTriggerAriaLabel}
        aria-describedby={fieldControl.describedBy}
        aria-invalid={fieldControl.invalid}
        aria-required={fieldControl.required || undefined}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${generatedId}-listbox` : undefined}
        aria-activedescendant={open && activeOptionIsValid ? `${generatedId}-option-${activeIndex}` : undefined}
        aria-busy={loading || undefined}
        disabled={Boolean(disabled || options.length === 0)}
        aria-disabled={interactionDisabled || undefined}
        onClick={() => {
          if (unavailable) return;
          if (open) closeMenu();
          else openMenu();
        }}
        onKeyDown={handleKeyDown}
      >
        <span className="pui-select__value">
          {hasLeading ? <span className="pui-option__leading" aria-hidden="true">{selected?.leading ?? null}</span> : null}
          <span>{selected?.label ?? placeholder}</span>
        </span>
        <span className="pui-select__indicator" aria-hidden="true">
          {loading ? <LoaderCircle className="pui-spinner" /> : <ChevronDown />}
        </span>
      </button>
      {menu && portalTarget ? createPortal(menu, portalTarget) : menu}
      {name || form || required || fieldControl.fieldRequired || controlRef ? <CompositeFormControl
        name={name}
        form={form}
        values={[value ?? ""]}
        disabled={disabled}
        required={Boolean(required || fieldControl.fieldRequired)}
        controlRef={controlRef}
        focusTargetRef={triggerRef}
        onReset={() => {
          if (value) onValueChange("");
          setOpen(false);
        }}
      /> : null}
    </div>
  );
}

export interface ComboboxOption {
  value: string;
  label: string;
  description?: string;
  leading?: ReactNode;
  searchText?: string;
  disabled?: boolean;
}

export type ComboboxProps = PublicControlProps<FieldControlAriaProps & {
  options: readonly ComboboxOption[];
  value?: string;
  onValueChange: (value: string) => void;
  name?: string;
  form?: string;
  required?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  ariaLabel: string;
  disabled?: boolean;
  placement?: "bottom" | "top";
  controlRef?: ControlRef<ValidityControlHandle>;
}>;

export function Combobox(rawProps: ComboboxProps) {
  const { message } = usePersonalUILocale();
  const safeProps = sanitizeFixedControlProps(rawProps);
  const {
    options,
    value,
    onValueChange,
    name,
    form,
    required,
    placeholder = message("select.placeholder"),
    searchPlaceholder = message("select.searchPlaceholder"),
    emptyText = message("select.empty"),
    ariaLabel,
    disabled,
    placement = "bottom",
    id: providedId,
    "aria-disabled": ariaDisabled,
    "aria-describedby": ariaDescribedBy,
    "aria-invalid": ariaInvalid,
    "aria-required": ariaRequired,
    controlRef,
  } = safeProps;
  useControllableMode({
    componentName: "Combobox",
    controlled: true,
    controlledOnly: true,
    defaultValueProvided: (rawProps as { defaultValue?: unknown }).defaultValue !== undefined,
    onChangeProvided: typeof onValueChange === "function",
  });
  assertUniqueIdentities("Combobox", "option.value", options.map((option) => option.value), { allowEmpty: true });
  const generatedId = useId();
  const fieldControl = useFieldControl(providedId, ariaDescribedBy, ariaInvalid, required || ariaRequired);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const hasLeading = options.some((option) => option.leading != null);
  const [activeValue, setActiveValue] = useState<string | null>(() => {
    const initialSelectedIndex = options.findIndex((option) => option.value === value);
    return initialSelectedIndex >= 0 && !options[initialSelectedIndex].disabled
      ? options[initialSelectedIndex].value
      : options[firstEnabledIndex(options)]?.value ?? null;
  });
  const selected = options.find((option) => option.value === value);
  const triggerAriaLabel = selected
    ? message("select.currentValue", { label: ariaLabel, value: selectOptionText(selected) })
    : message("select.unselected", { label: ariaLabel });
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return options;
    return options.filter((option) => `${option.label} ${option.description ?? ""} ${option.searchText ?? ""}`.toLocaleLowerCase().includes(needle));
  }, [options, query]);
  const filteredSelectedIndex = filtered.findIndex((option) => option.value === value);
  const preferredActiveValue = filteredSelectedIndex >= 0 && !filtered[filteredSelectedIndex].disabled
    ? filtered[filteredSelectedIndex].value
    : filtered[firstEnabledIndex(filtered)]?.value ?? null;
  const activeIndex = filtered.findIndex((option) => option.value === activeValue);
  const activeOptionIsValid = activeIndex >= 0
    && activeIndex < filtered.length
    && !filtered[activeIndex].disabled;
  const interactionDisabled = ariaDisabled === true || ariaDisabled === "true";
  const menuOpen = open && !disabled && !interactionDisabled;
  usePopoverPosition(menuOpen, placement, rootRef, popoverRef);

  useEffect(() => {
    setPortalTarget(floatingPortalTarget(rootRef.current));
  }, []);

  const openMenu = () => {
    if (disabled || interactionDisabled) return;
    const selectedIndex = options.findIndex((option) => option.value === value);
    setQuery("");
    setActiveValue(
      selectedIndex >= 0 && !options[selectedIndex].disabled
        ? options[selectedIndex].value
        : options[firstEnabledIndex(options)]?.value ?? null,
    );
    setOpen(true);
  };

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    if (disabled || interactionDisabled) return;
    openMenu();
    if (event.key === "ArrowUp") {
      const lastIndex = firstEnabledIndex(options, true);
      setActiveValue(options[lastIndex]?.value ?? null);
    }
  };

  const closeMenu = (restoreFocus = false) => {
    if (restoreFocus) triggerRef.current?.focus();
    setOpen(false);
  };

  useEffect(() => {
    if (!menuOpen) return;
    const handlePointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !popoverRef.current?.contains(target)) closeMenu();
    };
    document.addEventListener("mousedown", handlePointer);
    return () => document.removeEventListener("mousedown", handlePointer);
  }, [menuOpen]);

  useClientLayoutEffect(() => {
    if (!menuOpen) return;
    searchRef.current?.focus();
  }, [menuOpen]);

  useClientLayoutEffect(() => {
    if (!open || (!disabled && !interactionDisabled)) return;
    setOpen(false);
    if (!disabled && interactionDisabled) triggerRef.current?.focus();
  }, [disabled, interactionDisabled, open]);

  useEffect(() => {
    if (menuOpen && !activeOptionIsValid && activeValue !== preferredActiveValue) {
      setActiveValue(preferredActiveValue);
    }
  }, [activeOptionIsValid, activeValue, menuOpen, preferredActiveValue]);

  useEffect(() => {
    if (!menuOpen || !activeOptionIsValid) return;
    optionRefs.current[activeIndex]?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeIndex, activeOptionIsValid, filtered, menuOpen]);

  const choose = (option: ComboboxOption) => {
    if (disabled || interactionDisabled || option.disabled) return;
    if (option.value !== value) onValueChange(option.value);
    closeMenu(true);
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (disabled || interactionDisabled) {
      event.preventDefault();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu(true);
      return;
    }
    if (event.key === "Tab") {
      event.preventDefault();
      closeMenu();
      const trigger = triggerRef.current;
      const root = rootRef.current;
      if (trigger && root) {
        window.requestAnimationFrame(() => focusAdjacentTabStop(trigger, root, event.shiftKey));
      }
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setActiveValue((current) => {
        const currentIndex = filtered.findIndex((option) => option.value === current);
        const nextIndex = nextEnabledIndex(filtered, currentIndex, direction);
        return filtered[nextIndex]?.value ?? null;
      });
      return;
    }
    if (event.key === "PageUp" || event.key === "PageDown") {
      event.preventDefault();
      const edgeIndex = firstEnabledIndex(filtered, event.key === "PageDown");
      setActiveValue(filtered[edgeIndex]?.value ?? null);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (activeOptionIsValid) choose(filtered[activeIndex]);
    }
  };

  const menu = menuOpen ? (
    <div ref={popoverRef} className="pui-combobox__popover pui-portal" data-pui-floating-root="true">
      <div className="pui-combobox__search">
        <Search aria-hidden="true" />
        <input
          ref={searchRef}
          value={query}
          role="combobox"
          aria-label={message("select.searchAria", { label: ariaLabel })}
          aria-autocomplete="list"
          aria-expanded="true"
          aria-controls={`${generatedId}-listbox`}
          aria-activedescendant={activeOptionIsValid ? `${generatedId}-option-${activeIndex}` : undefined}
          aria-describedby={mergeAriaIds(fieldControl.describedBy, !filtered.length ? `${generatedId}-empty` : undefined)}
          aria-invalid={fieldControl.invalid}
          aria-required={fieldControl.required || undefined}
          placeholder={searchPlaceholder}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            if (disabled || interactionDisabled) return;
            const nextQuery = event.target.value;
            const needle = nextQuery.trim().toLocaleLowerCase();
            const nextOptions = needle
              ? options.filter((option) => (
                `${option.label} ${option.description ?? ""} ${option.searchText ?? ""}`
                  .toLocaleLowerCase()
                  .includes(needle)
              ))
              : options;
            setQuery(nextQuery);
            const firstIndex = firstEnabledIndex(nextOptions);
            setActiveValue(nextOptions[firstIndex]?.value ?? null);
          }}
          onKeyDown={handleSearchKeyDown}
        />
      </div>
      <div id={`${generatedId}-listbox`} className="pui-combobox__list" role="listbox" aria-label={ariaLabel}>
        {filtered.map((option, index) => (
          <button
            ref={(node) => { optionRefs.current[index] = node; }}
            id={`${generatedId}-option-${index}`}
            key={option.value}
            type="button"
            role="option"
            className="pui-option"
            aria-selected={option.value === value}
            data-active={activeOptionIsValid && option.value === activeValue || undefined}
            disabled={option.disabled}
            tabIndex={-1}
            onMouseMove={() => {
              if (!disabled && !interactionDisabled && !option.disabled && activeValue !== option.value) {
                setActiveValue(option.value);
              }
            }}
            onClick={() => choose(option)}
          >
            {hasLeading ? <span className="pui-option__leading" aria-hidden="true">{option.leading ?? null}</span> : null}
            <span className="pui-option__copy">
              <strong>{option.label}</strong>
              {option.description ? <span>{option.description}</span> : null}
            </span>
            <Check className="pui-option__check" aria-hidden="true" />
          </button>
        ))}
        {!filtered.length ? (
          <div
            id={`${generatedId}-empty`}
            className="pui-combobox__empty"
            role="status"
            aria-live="polite"
          >
            {emptyText}
          </div>
        ) : null}
      </div>
    </div>
  ) : null;

  return (
    <div
      ref={rootRef}
      className="pui-combobox"
      data-open={menuOpen || undefined}
      data-placement={placement}
      data-has-leading={hasLeading || undefined}
      data-pui-owner="Combobox"
    >
      <button
        ref={triggerRef}
        id={fieldControl.id}
        type="button"
        className="pui-combobox__trigger"
        role={menuOpen ? undefined : "combobox"}
        aria-label={triggerAriaLabel}
        aria-describedby={fieldControl.describedBy}
        aria-invalid={fieldControl.invalid}
        aria-required={!menuOpen && fieldControl.required || undefined}
        aria-haspopup="listbox"
        aria-expanded={menuOpen}
        aria-controls={menuOpen ? `${generatedId}-listbox` : undefined}
        disabled={disabled}
        aria-disabled={interactionDisabled || undefined}
        onClick={() => {
          if (disabled || interactionDisabled) return;
          if (menuOpen) closeMenu();
          else openMenu();
        }}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className="pui-combobox__value">
          {hasLeading ? <span className="pui-option__leading" aria-hidden="true">{selected?.leading ?? null}</span> : null}
          <span>{selected?.label ?? placeholder}</span>
        </span>
        <ChevronDown aria-hidden="true" />
      </button>
      {menu && portalTarget ? createPortal(menu, portalTarget) : menu}
      {name || form || required || fieldControl.fieldRequired || controlRef ? <CompositeFormControl
        name={name}
        form={form}
        values={[value ?? ""]}
        disabled={disabled}
        required={Boolean(required || fieldControl.fieldRequired)}
        controlRef={controlRef}
        focusTargetRef={triggerRef}
        onReset={() => {
          if (value) onValueChange("");
          setOpen(false);
          setQuery("");
        }}
      /> : null}
    </div>
  );
}

type ChoiceBaseProps = PublicControlProps<Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "checked" | "children" | "defaultChecked" | "onChange" | "readOnly" | "type"
>> & {
  label: ReactNode;
};

export type CheckboxProps = ChoiceBaseProps & NativeCheckedProps;
export type RadioProps = ChoiceBaseProps & NativeCheckedProps;
export type SwitchProps = ChoiceBaseProps & NativeCheckedProps;

export function Checkbox(rawProps: CheckboxProps) {
  useNativeControlMode("Checkbox", rawProps, "checked");
  const safeProps = sanitizeFixedControlProps(rawProps, ["children", "readOnly", "type"]);
  const {
    label,
    id,
    required,
    disabled,
    checked,
    defaultChecked,
    "aria-disabled": ariaDisabled,
    "aria-describedby": ariaDescribedBy,
    "aria-invalid": ariaInvalid,
    "aria-required": ariaRequired,
    onChange,
    onClick,
    onKeyDown,
    ...props
  } = safeProps;
  const fieldControl = useFieldControl(id, ariaDescribedBy, ariaInvalid, required);
  const interactionDisabled = isAriaTrue(ariaDisabled);
  const resolvedRequired = fieldControl.group
    ? Boolean(required)
    : fieldControl.required === true || fieldControl.required === "true";
  const resolvedAriaRequired = fieldControl.group
    ? Boolean(required || ariaRequired === true || ariaRequired === "true")
    : Boolean(resolvedRequired || ariaRequired === true || ariaRequired === "true");
  return (
    <label className="pui-choice" data-pui-owner="Checkbox">
      <input
        {...props}
        id={fieldControl.id}
        type="checkbox"
        checked={checked}
        defaultChecked={defaultChecked}
        disabled={disabled}
        aria-disabled={interactionDisabled || undefined}
        required={resolvedRequired}
        aria-required={resolvedAriaRequired || undefined}
        aria-describedby={fieldControl.describedBy}
        aria-invalid={fieldControl.invalid}
        onChange={(event) => {
          if (interactionDisabled) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          onChange?.(event);
        }}
        onClick={(event) => {
          if (interactionDisabled) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          onClick?.(event);
        }}
        onKeyDown={(event) => {
          if (interactionDisabled && event.key !== "Tab") {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          onKeyDown?.(event);
        }}
      />
      <span>{label}</span>
    </label>
  );
}

export function Radio(rawProps: RadioProps) {
  useNativeControlMode("Radio", rawProps, "checked");
  const safeProps = sanitizeFixedControlProps(rawProps, ["children", "readOnly", "type"]);
  const {
    label,
    id,
    name,
    required,
    disabled,
    checked,
    defaultChecked,
    "aria-disabled": ariaDisabled,
    "aria-describedby": ariaDescribedBy,
    "aria-invalid": ariaInvalid,
    "aria-required": ariaRequired,
    onChange,
    onClick,
    onKeyDown,
    ...props
  } = safeProps;
  const fieldControl = useFieldControl(id, ariaDescribedBy, ariaInvalid, required);
  const interactionDisabled = isAriaTrue(ariaDisabled);
  const resolvedRequired = fieldControl.required === true || fieldControl.required === "true";
  const resolvedAriaRequired = Boolean(
    resolvedRequired || ariaRequired === true || ariaRequired === "true",
  );
  return (
    <label className="pui-choice" data-pui-owner="Radio">
      <input
        {...props}
        id={fieldControl.id}
        type="radio"
        checked={checked}
        defaultChecked={defaultChecked}
        name={name ?? fieldControl.groupName}
        disabled={disabled}
        aria-disabled={interactionDisabled || undefined}
        required={resolvedRequired}
        aria-required={resolvedAriaRequired || undefined}
        aria-describedby={fieldControl.describedBy}
        aria-invalid={fieldControl.invalid}
        onChange={(event) => {
          if (interactionDisabled) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          onChange?.(event);
        }}
        onClick={(event) => {
          if (interactionDisabled) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          onClick?.(event);
        }}
        onKeyDown={(event) => {
          if (interactionDisabled && event.key !== "Tab") {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          onKeyDown?.(event);
        }}
      />
      <span>{label}</span>
    </label>
  );
}

export function Switch(rawProps: SwitchProps) {
  useNativeControlMode("Switch", rawProps, "checked");
  const safeProps = sanitizeFixedControlProps(rawProps, ["children", "readOnly", "type"]);
  const {
    label,
    id,
    required,
    disabled,
    checked,
    defaultChecked,
    "aria-disabled": ariaDisabled,
    "aria-describedby": ariaDescribedBy,
    "aria-invalid": ariaInvalid,
    "aria-required": ariaRequired,
    onChange,
    onClick,
    onKeyDown,
    ...props
  } = safeProps;
  const fieldControl = useFieldControl(id, ariaDescribedBy, ariaInvalid, required);
  const interactionDisabled = isAriaTrue(ariaDisabled);
  const resolvedRequired = fieldControl.group
    ? Boolean(required)
    : fieldControl.required === true || fieldControl.required === "true";
  const resolvedAriaRequired = fieldControl.group
    ? Boolean(required || ariaRequired === true || ariaRequired === "true")
    : Boolean(resolvedRequired || ariaRequired === true || ariaRequired === "true");
  return (
    <label className="pui-switch" data-pui-owner="Switch">
      <input
        {...props}
        id={fieldControl.id}
        type="checkbox"
        role="switch"
        checked={checked}
        defaultChecked={defaultChecked}
        disabled={disabled}
        aria-disabled={interactionDisabled || undefined}
        required={resolvedRequired}
        aria-required={resolvedAriaRequired || undefined}
        aria-describedby={fieldControl.describedBy}
        aria-invalid={fieldControl.invalid}
        onChange={(event) => {
          if (interactionDisabled) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          onChange?.(event);
        }}
        onClick={(event) => {
          if (interactionDisabled) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          onClick?.(event);
        }}
        onKeyDown={(event) => {
          if (interactionDisabled && event.key !== "Tab") {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          onKeyDown?.(event);
        }}
      />
      <span className="pui-switch__track" aria-hidden="true"><span /></span>
      <span>{label}</span>
    </label>
  );
}

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
}

export type SegmentedControlProps<T extends string> = PublicControlProps<Pick<
  FieldControlAriaProps,
  "id" | "aria-describedby" | "aria-invalid" | "aria-required"
> & {
  value: T;
  options: SegmentedOption<T>[];
  onValueChange: (value: T) => void;
  ariaLabel: string;
  name?: string;
  form?: string;
  required?: boolean;
  disabled?: boolean;
  fill?: boolean | "mobile";
  controlRef?: ControlRef<ValidityControlHandle>;
}>;

export function SegmentedControl<T extends string>(rawProps: SegmentedControlProps<T>) {
  const safeProps = sanitizeFixedControlProps(rawProps);
  const {
    value,
    options,
    onValueChange,
    ariaLabel,
    name,
    form,
    required,
    disabled = false,
    fill = false,
    id,
    "aria-describedby": ariaDescribedBy,
    "aria-invalid": ariaInvalid,
    "aria-required": ariaRequired,
    controlRef,
  } = safeProps;
  useControllableMode({
    componentName: "SegmentedControl",
    controlled: value !== undefined,
    controlledOnly: true,
    defaultValueProvided: (rawProps as { defaultValue?: unknown }).defaultValue !== undefined,
    onChangeProvided: typeof onValueChange === "function",
  });
  assertUniqueIdentities("SegmentedControl", "option.value", options.map((option) => option.value), { allowEmpty: true });
  if (value !== "" && options.length > 0 && !options.some((option) => option.value === value)) {
    throw new RangeError(
      `SegmentedControl received value ${JSON.stringify(value)}, but no option has that value.`,
    );
  }
  const initialValueRef = useRef(value);
  const focusTargetRef = useRef<HTMLButtonElement>(null);
  const fieldState = useCompositeFieldState({
    id,
    describedBy: ariaDescribedBy,
    invalid: ariaInvalid,
    required: required || ariaRequired,
  });
  const firstEnabledOption = options.find((option) => !option.disabled);
  const formDisabled = disabled || !firstEnabledOption;
  return (
    <div
      id={fieldState.id}
      className={cx(
        "pui-segmented",
        fill === true && "pui-segmented--fill",
        fill === "mobile" && "pui-segmented--mobile-fill",
      )}
      role="group"
      aria-label={fieldState.labelId ? undefined : ariaLabel}
      aria-labelledby={fieldState.labelId}
      aria-describedby={fieldState.describedBy}
      aria-invalid={fieldState.invalid}
      aria-required={fieldState.required || undefined}
      aria-disabled={formDisabled || undefined}
      data-pui-owner="SegmentedControl"
    >
      {options.map((option) => (
        <button
          key={option.value}
          ref={option === firstEnabledOption ? focusTargetRef : undefined}
          type="button"
          aria-pressed={value === option.value}
          title={typeof option.label === "string" || typeof option.label === "number" ? String(option.label) : undefined}
          disabled={disabled || option.disabled}
          onClick={() => {
            if (option.value !== value) onValueChange(option.value);
          }}
        >
          {option.label}
        </button>
      ))}
      {name || form || required || fieldState.fieldRequired || controlRef ? (
        <CompositeFormControl
          name={name}
          form={form}
          values={[value]}
          disabled={formDisabled}
          required={Boolean(required || fieldState.fieldRequired)}
          controlRef={controlRef}
          focusTargetRef={focusTargetRef}
          onReset={() => onValueChange(initialValueRef.current)}
        />
      ) : null}
    </div>
  );
}
