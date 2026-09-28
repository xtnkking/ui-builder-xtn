import {
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
  type AriaAttributes,
  type FormEvent,
  type ReactNode,
  type RefObject,
} from "react";
import type { ControlRef, ValidityControlHandle } from "../foundation/contracts";
import { FieldContext } from "./field-context";

const VISIBLE_CONTROL_SELECTOR = [
  "button:not(:disabled)",
  "input:not([data-pui-form-bridge]):not([type='hidden']):not(:disabled)",
  "select:not(:disabled)",
  "textarea:not(:disabled)",
  "[tabindex]:not([tabindex='-1']):not([aria-disabled='true'])",
].join(",");

export interface CompositeFormControlProps {
  name?: string;
  form?: string;
  values: readonly string[];
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  controlRef?: ControlRef<ValidityControlHandle>;
  focusTargetRef?: RefObject<HTMLElement | null>;
  onReset?: () => void;
}

export interface CompositeFieldStateOptions {
  id?: string;
  fallbackId?: string;
  describedBy?: AriaAttributes["aria-describedby"];
  invalid?: AriaAttributes["aria-invalid"];
  required?: AriaAttributes["aria-required"];
}

export interface CompositeFieldState {
  id?: string;
  labelId?: string;
  describedBy?: string;
  invalid?: AriaAttributes["aria-invalid"];
  required?: AriaAttributes["aria-required"];
  fieldInvalid: boolean;
  fieldRequired: boolean;
  group: boolean;
}

export function mergeAriaIds(...values: Array<string | undefined>): string | undefined {
  const ids = Array.from(new Set(values.flatMap((value) => value?.split(/\s+/).filter(Boolean) ?? [])));
  return ids.length ? ids.join(" ") : undefined;
}

export function useCompositeFieldState({
  id,
  fallbackId,
  describedBy,
  invalid,
  required,
}: CompositeFieldStateOptions = {}): CompositeFieldState {
  const field = useContext(FieldContext);
  return {
    id: id ?? (field?.group ? undefined : field?.controlId) ?? fallbackId,
    labelId: field?.labelId,
    describedBy: mergeAriaIds(describedBy, field?.describedBy),
    invalid: field?.invalid ? true : invalid,
    required: field?.required ? true : required,
    fieldInvalid: field?.invalid ?? false,
    fieldRequired: field?.required ?? false,
    group: field?.group ?? false,
  };
}

export function CompositeFieldBoundary({ children }: { children: ReactNode }) {
  return <FieldContext.Provider value={null}>{children}</FieldContext.Provider>;
}

function resolveAssociatedForm(
  formId: string | undefined,
  anchor: HTMLElement,
): HTMLFormElement | null {
  if (formId) {
    const candidate = anchor.ownerDocument.getElementById(formId);
    return candidate?.tagName === "FORM" ? candidate as HTMLFormElement : null;
  }
  return anchor.closest("form");
}

export function useFormReset(
  formId: string | undefined,
  anchorRef: RefObject<HTMLElement | null>,
  onReset?: () => void,
): void {
  const onResetRef = useRef(onReset);
  onResetRef.current = onReset;

  useEffect(() => {
    const anchor = anchorRef.current;
    const ownerDocument = anchor?.ownerDocument;
    if (!anchor || !ownerDocument) return;
    let active = true;
    const pendingTimers = new Set<number>();
    const handleReset = (event: Event) => {
      const associatedForm = resolveAssociatedForm(formId, anchor);
      if (event.target !== associatedForm) return;
      const timer = ownerDocument.defaultView?.setTimeout(() => {
        pendingTimers.delete(timer ?? -1);
        if (active && !event.defaultPrevented) onResetRef.current?.();
      }, 0);
      if (timer != null) pendingTimers.add(timer);
    };
    ownerDocument.addEventListener("reset", handleReset, true);
    return () => {
      active = false;
      pendingTimers.forEach((timer) => ownerDocument.defaultView?.clearTimeout(timer));
      ownerDocument.removeEventListener("reset", handleReset, true);
    };
  }, [anchorRef, formId]);
}

function focusVisibleOwner(
  bridge: HTMLInputElement | null,
  focusTargetRef?: RefObject<HTMLElement | null>,
): void {
  const explicitTarget = focusTargetRef?.current;
  const owner = bridge?.closest<HTMLElement>("[data-pui-owner]");
  const fallbackTarget = owner?.querySelector<HTMLElement>(VISIBLE_CONTROL_SELECTOR);
  (explicitTarget ?? fallbackTarget)?.focus();
}

/**
 * Form-associated bridge for composite controls. The first text input owns
 * constraint validation and the first successful value; later values use
 * repeated hidden fields with the same name.
 */
export function CompositeFormControl({
  name,
  form,
  values,
  required,
  disabled,
  readOnly,
  controlRef,
  focusTargetRef,
  onReset,
}: CompositeFormControlProps) {
  const validationRef = useRef<HTMLInputElement>(null);
  const fieldState = useCompositeFieldState({ required });
  const resolvedRequired = fieldState.required === true || fieldState.required === "true";
  const hasSuccessfulValue = values.length > 0;
  const serializedValues = values.length ? values : [""];

  useFormReset(form, validationRef, onReset);

  useImperativeHandle(controlRef, () => ({
    focus(options?: FocusOptions) {
      const target = focusTargetRef?.current
        ?? validationRef.current?.closest<HTMLElement>("[data-pui-owner]")
          ?.querySelector<HTMLElement>(VISIBLE_CONTROL_SELECTOR);
      target?.focus(options);
    },
    setCustomValidity(error: string) {
      validationRef.current?.setCustomValidity(error);
    },
    checkValidity() {
      return validationRef.current?.checkValidity() ?? false;
    },
    reportValidity() {
      return validationRef.current?.reportValidity() ?? false;
    },
  } as ValidityControlHandle), [focusTargetRef]);

  const handleInvalid = (event: FormEvent<HTMLInputElement>) => {
    event.preventDefault();
    focusVisibleOwner(event.currentTarget, focusTargetRef);
  };

  return (
    <>
      <input
        ref={validationRef}
        type="text"
        className="pui-sr-only"
        tabIndex={-1}
        aria-hidden="true"
        name={hasSuccessfulValue ? name : undefined}
        form={form}
        value={serializedValues[0]}
        disabled={disabled}
        readOnly={readOnly}
        required={resolvedRequired}
        data-pui-form-bridge="validation"
        onChange={() => undefined}
        onInvalid={handleInvalid}
      />
      {name ? serializedValues.slice(1).map((value, index) => (
        <input
          key={`${index}:${value}`}
          type="hidden"
          name={name}
          form={form}
          value={value}
          disabled={disabled}
          data-pui-form-bridge="value"
          readOnly
        />
      )) : null}
    </>
  );
}
