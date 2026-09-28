import { createRef } from "react";
import {
  ColorPicker,
  DateRangeField,
  Rating,
  Slider,
  TimezoneSelect,
  type ValidityControlHandle,
} from "../../src/personal-ui";

const validityControlRef = createRef<ValidityControlHandle>();

const controlledValueControls = (
  <>
    <Slider name="volume" form="profile" required controlRef={validityControlRef} value={25} onValueChange={() => undefined} ariaLabel="Volume" title="Volume control" />
    <Slider value={[20, 80] as const} onValueChange={() => undefined} ariaLabel="Price range" />
    <Rating value={4} onValueChange={() => undefined} ariaLabel="Rating" />
    <ColorPicker value="#1769d2" onValueChange={() => undefined} ariaLabel="Accent" />
    <DateRangeField name="period" form="profile" required controlRef={validityControlRef} value={{ start: "2026-09-01", end: "2026-09-30" }} onValueChange={() => undefined} />
    <TimezoneSelect value="Asia/Shanghai" onValueChange={() => undefined} />
  </>
);
void controlledValueControls;

const uncontrolledValueControls = (
  <>
    <Slider defaultValue={25} ariaLabel="Volume" onValueChange={() => undefined} />
    <Slider defaultValue={[20, 80]} ariaLabel="Price range" />
    <Rating defaultValue={4} ariaLabel="Rating" />
    <ColorPicker defaultValue="#1769d2" ariaLabel="Accent" />
    <DateRangeField defaultValue={{ start: "2026-09-01", end: "2026-09-30" }} />
    <TimezoneSelect defaultValue="Asia/Shanghai" />
  </>
);
void uncontrolledValueControls;

// @ts-expect-error controlled Slider requires onValueChange
const sliderMissingChange = <Slider value={25} ariaLabel="Volume" />;
// @ts-expect-error Slider cannot be controlled and uncontrolled simultaneously
const sliderContradictory = <Slider value={25} defaultValue={10} onValueChange={() => undefined} ariaLabel="Volume" />;
// @ts-expect-error fixed controls do not expose className
const sliderClassName = <Slider defaultValue={25} ariaLabel="Volume" className="foreign" />;
// @ts-expect-error fixed controls do not expose raw DOM refs
const sliderRef = <Slider defaultValue={25} ariaLabel="Volume" ref={createRef<HTMLElement>()} />;

// @ts-expect-error controlled Rating requires onValueChange
const ratingMissingChange = <Rating value={4} ariaLabel="Rating" />;
// @ts-expect-error Rating cannot be controlled and uncontrolled simultaneously
const ratingContradictory = <Rating value={4} defaultValue={2} onValueChange={() => undefined} ariaLabel="Rating" />;
// @ts-expect-error fixed controls do not expose style
const ratingStyle = <Rating defaultValue={4} ariaLabel="Rating" style={{ color: "red" }} />;

// @ts-expect-error controlled ColorPicker requires onValueChange
const colorMissingChange = <ColorPicker value="#1769d2" ariaLabel="Accent" />;
// @ts-expect-error ColorPicker cannot be controlled and uncontrolled simultaneously
const colorContradictory = <ColorPicker value="#1769d2" defaultValue="#137a43" onValueChange={() => undefined} ariaLabel="Accent" />;
// @ts-expect-error fixed controls do not expose internal ownership markers
const colorOwner = <ColorPicker defaultValue="#1769d2" ariaLabel="Accent" data-pui-owner="Consumer" />;

// @ts-expect-error controlled DateRangeField requires onValueChange
const rangeMissingChange = <DateRangeField value={{ start: "", end: "" }} />;
// @ts-expect-error DateRangeField cannot be controlled and uncontrolled simultaneously
const rangeContradictory = <DateRangeField value={{ start: "", end: "" }} defaultValue={{ start: "2026-09-01", end: "2026-09-30" }} onValueChange={() => undefined} />;
// @ts-expect-error fixed controls do not expose consumer styles
const rangeStyle = <DateRangeField style={{ color: "red" }} />;

// @ts-expect-error controlled TimezoneSelect requires onValueChange
const timezoneMissingChange = <TimezoneSelect value="UTC" />;
// @ts-expect-error TimezoneSelect cannot be controlled and uncontrolled simultaneously
const timezoneContradictory = <TimezoneSelect value="UTC" defaultValue="Asia/Shanghai" onValueChange={() => undefined} />;
// @ts-expect-error fixed controls do not expose reserved slot attributes
const timezoneSlot = <TimezoneSelect defaultValue="UTC" data-pui-slot="foreign" />;

void sliderMissingChange;
void sliderContradictory;
void sliderClassName;
void sliderRef;
void ratingMissingChange;
void ratingContradictory;
void ratingStyle;
void colorMissingChange;
void colorContradictory;
void colorOwner;
void rangeMissingChange;
void rangeContradictory;
void rangeStyle;
void timezoneMissingChange;
void timezoneContradictory;
void timezoneSlot;
