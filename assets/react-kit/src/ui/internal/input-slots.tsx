import { createContext, useContext, type ReactElement, type ReactNode, type Ref } from "react";
import type { ControlRef, ValidityControlHandle } from "../foundation/contracts";

export type InternalInputSlotName =
  | "date-field"
  | "number-input"
  | "password-input"
  | "search-input";

export type InternalTextareaSlotName = "code-editor" | "markdown-editor" | "rich-text-editor";

interface InternalInputSlotValue {
  name: InternalInputSlotName;
  controlRef?: ControlRef<ValidityControlHandle>;
  elementRef?: Ref<HTMLInputElement>;
}

interface InternalTextareaSlotValue {
  name: InternalTextareaSlotName;
  elementRef?: Ref<HTMLTextAreaElement>;
}

const InputSlotContext = createContext<InternalInputSlotValue | null>(null);
const TextareaSlotContext = createContext<InternalTextareaSlotValue | null>(null);

export function InternalInputSlot({
  name,
  controlRef,
  elementRef,
  children,
}: {
  name: InternalInputSlotName;
  controlRef?: ControlRef<ValidityControlHandle>;
  elementRef?: Ref<HTMLInputElement>;
  children: ReactElement;
}) {
  return <InputSlotContext.Provider value={{ name, controlRef, elementRef }}>{children}</InputSlotContext.Provider>;
}

type InternalTextareaSlotProps =
  | {
      name: "markdown-editor" | "rich-text-editor";
      elementRef: Ref<HTMLTextAreaElement>;
      children: ReactElement;
    }
  | {
      name: "code-editor";
      elementRef?: never;
      children: ReactElement;
    };

export function InternalTextareaSlot(props: InternalTextareaSlotProps) {
  const value: InternalTextareaSlotValue = props.name !== "code-editor"
    ? { name: props.name, elementRef: props.elementRef }
    : { name: props.name };
  return <TextareaSlotContext.Provider value={value}>{props.children}</TextareaSlotContext.Provider>;
}

export function useInternalInputSlot(): InternalInputSlotValue | null {
  return useContext(InputSlotContext);
}

export function useInternalTextareaSlot(): InternalTextareaSlotValue | null {
  return useContext(TextareaSlotContext);
}

export function InternalInputSlotBoundary({ children }: { children: ReactNode }) {
  return (
    <InputSlotContext.Provider value={null}>
      <TextareaSlotContext.Provider value={null}>{children}</TextareaSlotContext.Provider>
    </InputSlotContext.Provider>
  );
}
