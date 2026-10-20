import { createRef } from "react";
import {
  DropdownMenu,
  HoverCard,
  OverflowText,
  Popover,
  Tooltip,
  type HoverCardProps,
} from "../../src/ui";

const menuItems = [{ id: "edit", label: "Edit", onSelect: () => undefined }];

const allowedOverlays = (
  <>
    <DropdownMenu label="Actions" ariaLabel="Actions" items={menuItems} />
    <DropdownMenu triggerAppearance="button" label="Actions" ariaLabel="Actions" items={menuItems} />
    <DropdownMenu triggerAppearance="icon" label="更多操作" ariaLabel="更多操作：代理 A" items={menuItems} />
    <DropdownMenu triggerAppearance="icon" icon={<span aria-hidden="true">⋮</span>} label="更多操作" ariaLabel="更多操作：代理 B" items={menuItems} />
    <Tooltip content="Details"><span>Info</span></Tooltip>
    <OverflowText>Long value</OverflowText>
    <Popover triggerLabel="Open" ariaLabel="Details">Content</Popover>
    <Popover triggerLabel="Open" ariaLabel="Details" open={false} onOpenChange={() => undefined}>Content</Popover>
    <HoverCard triggerLabel="Preview" ariaLabel="Preview" defaultOpen>Content</HoverCard>
    <HoverCard triggerLabel="Preview" ariaLabel="Preview" data-ui-consumer-state="draft">Content</HoverCard>
  </>
);
void allowedOverlays;

// @ts-expect-error fixed overlays do not expose className
const menuClassName = <DropdownMenu className="foreign" label="Actions" ariaLabel="Actions" items={menuItems} />;
// @ts-expect-error trigger appearance is a closed official variation
const menuUnknownAppearance = <DropdownMenu triggerAppearance="pill" label="Actions" ariaLabel="Actions" items={menuItems} />;
// @ts-expect-error icon appearance does not expose an arbitrary interactive trigger
const menuCustomTrigger = <DropdownMenu trigger={<button type="button">More</button>} triggerAppearance="icon" label="Actions" ariaLabel="Actions" items={menuItems} />;
// @ts-expect-error fixed overlays do not expose style
const tooltipStyle = <Tooltip style={{ color: "red" }} content="Details"><span>Info</span></Tooltip>;
// @ts-expect-error fixed overlays do not expose raw DOM refs
const overflowRef = <OverflowText ref={createRef<HTMLSpanElement>()}>Long value</OverflowText>;
// @ts-expect-error fixed overlays do not expose internal owner markers
const tooltipOwner = <Tooltip data-ui-owner="Consumer" content="Details"><span>Info</span></Tooltip>;
// @ts-expect-error fixed overlays do not expose raw HTML injection
const popoverHtml = <Popover dangerouslySetInnerHTML={{ __html: "unsafe" }} triggerLabel="Open" ariaLabel="Details">Content</Popover>;
// @ts-expect-error controlled open requires onOpenChange
const controlledWithoutChange = <Popover triggerLabel="Open" ariaLabel="Details" open>Content</Popover>;
// @ts-expect-error controlled and uncontrolled open props are mutually exclusive
const contradictoryPopover = <Popover triggerLabel="Open" ariaLabel="Details" open defaultOpen onOpenChange={() => undefined}>Content</Popover>;
// @ts-expect-error HoverCard uses the same discriminated open contract
const contradictoryHoverCard = <HoverCard triggerLabel="Preview" ariaLabel="Preview" open defaultOpen onOpenChange={() => undefined}>Content</HoverCard>;
// @ts-expect-error HoverCard owns its interaction mode
const hoverInteraction = <HoverCard triggerLabel="Preview" ariaLabel="Preview" interaction="click">Content</HoverCard>;
// @ts-expect-error HoverCard wrappers retain the explicit owner-marker boundary
const hoverOwnerProps: HoverCardProps = { triggerLabel: "Preview", ariaLabel: "Preview", children: "Content", "data-ui-owner": "Consumer" };
// @ts-expect-error HoverCard wrappers retain the explicit slot-marker boundary
const hoverSlotProps: HoverCardProps = { triggerLabel: "Preview", ariaLabel: "Preview", children: "Content", "data-ui-slot": "foreign" };
// @ts-expect-error arbitrary reserved data remains closed after overlay wrapping
const hoverPrivateProps: HoverCardProps = { triggerLabel: "Preview", ariaLabel: "Preview", children: "Content", "data-ui-private": "foreign" };
// @ts-expect-error HoverCard JSX rejects the explicitly reserved owner marker
const hoverOwnerJsx = <HoverCard triggerLabel="Preview" ariaLabel="Preview" data-ui-owner="Consumer">Content</HoverCard>;
// @ts-expect-error HoverCard JSX rejects the explicitly reserved slot marker
const hoverSlotJsx = <HoverCard triggerLabel="Preview" ariaLabel="Preview" data-ui-slot="foreign">Content</HoverCard>;
// @ts-expect-error re-publishing HoverCard must not reopen className
const hoverClassName = <HoverCard triggerLabel="Preview" ariaLabel="Preview" className="foreign">Content</HoverCard>;
// @ts-expect-error wrapped overlays do not expose raw DOM refs
const hoverRef = <HoverCard triggerLabel="Preview" ariaLabel="Preview" ref={createRef<HTMLSpanElement>()}>Content</HoverCard>;
// @ts-expect-error legacy arbitrary trigger nodes must migrate to triggerLabel
const legacyPopoverTrigger = <Popover trigger="Open" ariaLabel="Details">Content</Popover>;
// @ts-expect-error triggerLabel is intentionally plain text and cannot contain an interactive tree
const richPopoverTrigger = <Popover triggerLabel={<button type="button">Nested</button>} ariaLabel="Details">Content</Popover>;

void menuClassName;
void menuUnknownAppearance;
void menuCustomTrigger;
void tooltipStyle;
void overflowRef;
void tooltipOwner;
void popoverHtml;
void controlledWithoutChange;
void contradictoryPopover;
void contradictoryHoverCard;
void hoverInteraction;
void hoverOwnerProps;
void hoverSlotProps;
void hoverPrivateProps;
void hoverOwnerJsx;
void hoverSlotJsx;
void hoverClassName;
void hoverRef;
void legacyPopoverTrigger;
void richPopoverTrigger;
