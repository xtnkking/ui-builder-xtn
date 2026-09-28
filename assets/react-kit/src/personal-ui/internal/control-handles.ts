import type { Ref, RefObject } from "react";
import type { FormControlHandle, TextControlHandle, ValidityControlHandle } from "../foundation/contracts";

export function assignElementRef<Element>(ref: Ref<Element> | undefined, value: Element | null): void {
  if (typeof ref === "function") {
    ref(value);
    return;
  }
  if (ref) {
    (ref as { current: Element | null }).current = value;
  }
}

export function createTextControlHandle(
  elementRef: RefObject<HTMLInputElement | HTMLTextAreaElement | null>,
): TextControlHandle {
  return {
    focus(options?: FocusOptions) {
      elementRef.current?.focus(options);
    },
    select() {
      elementRef.current?.select();
    },
    setSelectionRange(start, end, direction) {
      elementRef.current?.setSelectionRange(start, end, direction);
    },
    setCustomValidity(error) {
      elementRef.current?.setCustomValidity(error);
    },
    checkValidity() {
      return elementRef.current?.checkValidity() ?? false;
    },
    reportValidity() {
      return elementRef.current?.reportValidity() ?? false;
    },
  } as TextControlHandle;
}

export function createValidityControlHandle(
  elementRef: RefObject<HTMLInputElement | HTMLTextAreaElement | null>,
): ValidityControlHandle {
  return {
    focus(options?: FocusOptions) {
      elementRef.current?.focus(options);
    },
    setCustomValidity(error) {
      elementRef.current?.setCustomValidity(error);
    },
    checkValidity() {
      return elementRef.current?.checkValidity() ?? false;
    },
    reportValidity() {
      return elementRef.current?.reportValidity() ?? false;
    },
  } as ValidityControlHandle;
}

export function createFormControlHandle(
  elementRef: RefObject<HTMLFormElement | null>,
): FormControlHandle {
  return {
    requestSubmit(submitter?: HTMLElement) {
      elementRef.current?.requestSubmit(submitter);
    },
    reset() {
      elementRef.current?.reset();
    },
    checkValidity() {
      return elementRef.current?.checkValidity() ?? false;
    },
    reportValidity() {
      return elementRef.current?.reportValidity() ?? false;
    },
  } as FormControlHandle;
}
