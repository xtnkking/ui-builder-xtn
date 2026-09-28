import {
  createContext,
  useContext,
  type ReactElement,
  type ReactNode,
  type Ref,
} from "react";

export type InternalButtonSlotName =
  | "split-primary"
  | "toggle"
  | "retry"
  | "async-action"
  | "dropdown-trigger";

export type InternalIconButtonSlotName =
  | "lightbox-close"
  | "lightbox-previous"
  | "lightbox-next";

interface InternalButtonSlotValue {
  name: InternalButtonSlotName;
  elementRef?: Ref<HTMLButtonElement>;
}

const ButtonSlotContext = createContext<InternalButtonSlotValue | null>(null);
const IconButtonSlotContext = createContext<InternalIconButtonSlotName | null>(null);

type InternalButtonSlotProps =
  | {
      name: "dropdown-trigger";
      elementRef: Ref<HTMLButtonElement>;
      children: ReactElement;
    }
  | {
      name: Exclude<InternalButtonSlotName, "dropdown-trigger">;
      elementRef?: never;
      children: ReactElement;
    };

export function InternalButtonSlot(props: InternalButtonSlotProps) {
  const value: InternalButtonSlotValue = props.name === "dropdown-trigger"
    ? { name: props.name, elementRef: props.elementRef }
    : { name: props.name };
  return <ButtonSlotContext.Provider value={value}>{props.children}</ButtonSlotContext.Provider>;
}

export function InternalIconButtonSlot({
  name,
  children,
}: {
  name: InternalIconButtonSlotName;
  children: ReactElement;
}) {
  return <IconButtonSlotContext.Provider value={name}>{children}</IconButtonSlotContext.Provider>;
}

export function useInternalButtonSlot(): InternalButtonSlotValue | null {
  return useContext(ButtonSlotContext);
}

export function useInternalIconButtonSlot(): InternalIconButtonSlotName | null {
  return useContext(IconButtonSlotContext);
}

export function InternalControlSlotBoundary({ children }: { children: ReactNode }) {
  return (
    <ButtonSlotContext.Provider value={null}>
      <IconButtonSlotContext.Provider value={null}>{children}</IconButtonSlotContext.Provider>
    </ButtonSlotContext.Provider>
  );
}
