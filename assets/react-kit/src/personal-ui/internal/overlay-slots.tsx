import { createContext, useContext, type ReactElement, type ReactNode } from "react";

type InternalDropdownMenuSlotName = "split-menu";
type InternalTooltipSlotName = "overflow-text";
type InternalPopoverSlotName = "hover-card";

const DropdownMenuSlotContext = createContext<InternalDropdownMenuSlotName | null>(null);
const TooltipSlotContext = createContext<InternalTooltipSlotName | null>(null);
const PopoverSlotContext = createContext<InternalPopoverSlotName | null>(null);

export function InternalDropdownMenuSlot({
  name,
  children,
}: {
  name: InternalDropdownMenuSlotName;
  children: ReactElement;
}) {
  return <DropdownMenuSlotContext.Provider value={name}>{children}</DropdownMenuSlotContext.Provider>;
}

export function InternalTooltipSlot({
  name,
  children,
}: {
  name: InternalTooltipSlotName;
  children: ReactElement;
}) {
  return <TooltipSlotContext.Provider value={name}>{children}</TooltipSlotContext.Provider>;
}

export function InternalPopoverSlot({
  name,
  children,
}: {
  name: InternalPopoverSlotName;
  children: ReactElement;
}) {
  return <PopoverSlotContext.Provider value={name}>{children}</PopoverSlotContext.Provider>;
}

export function useInternalDropdownMenuSlot(): InternalDropdownMenuSlotName | null {
  return useContext(DropdownMenuSlotContext);
}

export function useInternalTooltipSlot(): InternalTooltipSlotName | null {
  return useContext(TooltipSlotContext);
}

export function useInternalPopoverSlot(): InternalPopoverSlotName | null {
  return useContext(PopoverSlotContext);
}

export function InternalOverlaySlotBoundary({ children }: { children: ReactNode }) {
  return (
    <DropdownMenuSlotContext.Provider value={null}>
      <TooltipSlotContext.Provider value={null}>
        <PopoverSlotContext.Provider value={null}>{children}</PopoverSlotContext.Provider>
      </TooltipSlotContext.Provider>
    </DropdownMenuSlotContext.Provider>
  );
}
