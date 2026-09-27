import { createRef } from "react";
import {
  Accordion,
  Collapse,
  KeyboardShortcut,
  type AccordionProps,
  type CollapseProps,
} from "../../src/personal-ui";

const accordionItems = [
  { id: "profile", title: "Profile", content: "Profile content" },
  { id: "security", title: "Security", content: "Security content" },
];

const collapseControlled: CollapseProps = {
  title: "Details",
  open: true,
  onOpenChange: () => undefined,
};
const collapseUncontrolled: CollapseProps = {
  title: "Details",
  defaultOpen: true,
};
const accordionControlled: AccordionProps = {
  items: accordionItems,
  value: ["profile"],
  onValueChange: () => undefined,
};
const accordionUncontrolled: AccordionProps = {
  items: accordionItems,
  defaultValue: ["security"],
};
void collapseControlled;
void collapseUncontrolled;
void accordionControlled;
void accordionUncontrolled;

const allowedUsage = (
  <>
    <Collapse title="Details" defaultOpen data-track="collapse">Content</Collapse>
    <Collapse title="Details" open onOpenChange={() => undefined}>Content</Collapse>
    <Accordion items={accordionItems} defaultValue={["profile"]} data-track="accordion" />
    <Accordion items={accordionItems} value={["security"]} onValueChange={() => undefined} />
    <KeyboardShortcut keys={["Ctrl", "K"]} data-track="shortcut" />
  </>
);
void allowedUsage;

// @ts-expect-error controlled Collapse requires onOpenChange
const collapseMissingChange = <Collapse title="Details" open>Content</Collapse>;
// @ts-expect-error Collapse cannot be controlled and uncontrolled simultaneously
const collapseContradictory = <Collapse title="Details" open defaultOpen onOpenChange={() => undefined}>Content</Collapse>;
// @ts-expect-error fixed controls do not expose className
const collapseClassName = <Collapse title="Details" className="foreign">Content</Collapse>;
// @ts-expect-error fixed controls do not expose style
const collapseStyle = <Collapse title="Details" style={{ color: "red" }}>Content</Collapse>;
// @ts-expect-error fixed controls do not expose raw refs
const collapseRef = <Collapse title="Details" ref={createRef<HTMLDivElement>()}>Content</Collapse>;
// @ts-expect-error private composition props are not public
const collapseInternalClass = <Collapse title="Details" internalClassName="foreign">Content</Collapse>;
// @ts-expect-error reserved ownership attributes are never public
const collapseOwner = <Collapse title="Details" data-pui-owner="Consumer">Content</Collapse>;

// @ts-expect-error controlled Accordion requires onValueChange
const accordionMissingChange = <Accordion items={accordionItems} value={["profile"]} />;
// @ts-expect-error Accordion cannot be controlled and uncontrolled simultaneously
const accordionContradictory = <Accordion items={accordionItems} value={["profile"]} defaultValue={["security"]} onValueChange={() => undefined} />;
// @ts-expect-error Accordion keeps styling internal
const accordionClassName = <Accordion items={accordionItems} className="foreign" />;
// @ts-expect-error Accordion does not expose raw refs
const accordionRef = <Accordion items={accordionItems} ref={createRef<HTMLDivElement>()} />;
// @ts-expect-error Accordion does not expose ownership markers
const accordionOwner = <Accordion items={accordionItems} data-pui-owner="Consumer" />;
// @ts-expect-error KeyboardShortcut keeps styling internal
const shortcutClassName = <KeyboardShortcut keys="Escape" className="foreign" />;
// @ts-expect-error KeyboardShortcut does not expose ownership markers
const shortcutOwner = <KeyboardShortcut keys="Escape" data-pui-owner="Consumer" />;

void collapseMissingChange;
void collapseContradictory;
void collapseClassName;
void collapseStyle;
void collapseRef;
void collapseInternalClass;
void collapseOwner;
void accordionMissingChange;
void accordionContradictory;
void accordionClassName;
void accordionRef;
void accordionOwner;
void shortcutClassName;
void shortcutOwner;
