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
  | "dropdown-trigger"
  | "lightbox-close"
  | "lightbox-previous"
  | "lightbox-next";

interface InternalButtonSlotValue {
  name: InternalButtonSlotName;
  elementRef?: Ref<HTMLButtonElement>;
}

const ButtonSlotContext = createContext<InternalButtonSlotValue | null>(null);
interface InternalIconButtonSlotValue {
  name: InternalIconButtonSlotName;
  elementRef?: Ref<HTMLButtonElement>;
}

const IconButtonSlotContext = createContext<InternalIconButtonSlotValue | null>(null);
const FilterActionContext = createContext(false);

/** Query actions keep their own short label during loading without consumer boilerplate. */
export function InternalFilterActionBoundary({ children, enabled = true }: { children: ReactNode; enabled?: boolean }) {
  return <FilterActionContext.Provider value={enabled}>{children}</FilterActionContext.Provider>;
}

export function useInternalFilterAction(): boolean {
  return useContext(FilterActionContext);
}

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

type InternalIconButtonSlotProps =
  | { name: "dropdown-trigger"; elementRef: Ref<HTMLButtonElement>; children: ReactElement }
  | { name: Exclude<InternalIconButtonSlotName, "dropdown-trigger">; elementRef?: never; children: ReactElement };

export function InternalIconButtonSlot(props: InternalIconButtonSlotProps) {
  const value: InternalIconButtonSlotValue = props.name === "dropdown-trigger"
    ? { name: props.name, elementRef: props.elementRef }
    : { name: props.name };
  return <IconButtonSlotContext.Provider value={value}>{props.children}</IconButtonSlotContext.Provider>;
}

export function useInternalButtonSlot(): InternalButtonSlotValue | null {
  return useContext(ButtonSlotContext);
}

export function useInternalIconButtonSlot(): InternalIconButtonSlotValue | null {
  return useContext(IconButtonSlotContext);
}

export function InternalControlSlotBoundary({ children }: { children: ReactNode }) {
  return (
    <FilterActionContext.Provider value={false}>
      <ButtonSlotContext.Provider value={null}>
        <IconButtonSlotContext.Provider value={null}>{children}</IconButtonSlotContext.Provider>
      </ButtonSlotContext.Provider>
    </FilterActionContext.Provider>
  );
}
