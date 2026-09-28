import { useEffect, useRef, type ChangeEventHandler, type InputHTMLAttributes } from "react";
import { CalendarDays } from "lucide-react";
import type { ControlRef, PublicControlProps, ValidityControlHandle } from "../foundation/contracts";
import { Input } from "./forms";
import { sanitizeFixedControlProps } from "../internal/fixed-control-props";
import { InternalInputSlot } from "../internal/input-slots";
import { usePersonalUILocale } from "../foundation/locale";

export type DatePrecision = "year" | "month" | "day" | "minute" | "second" | "time" | "time-second";

type DateFieldBaseProps = PublicControlProps<Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "children" | "defaultValue" | "onChange" | "size" | "step" | "type" | "value"
>> & {
  precision: DatePrecision;
  controlRef?: ControlRef<ValidityControlHandle>;
};

type DateFieldValueProps =
  | {
      value: string | number | readonly string[];
      defaultValue?: never;
      onChange: ChangeEventHandler<HTMLInputElement>;
    }
  | {
      value?: never;
      defaultValue?: string | number | readonly string[];
      onChange?: ChangeEventHandler<HTMLInputElement>;
    };

export type DateFieldProps = DateFieldBaseProps & DateFieldValueProps;

function inputConfig(precision: DatePrecision): { type: string; step?: number; inputMode?: "numeric" } {
  if (precision === "year") return { type: "number", inputMode: "numeric" };
  if (precision === "month") return { type: "month" };
  if (precision === "day") return { type: "date" };
  if (precision === "minute") return { type: "datetime-local", step: 60 };
  if (precision === "second") return { type: "datetime-local", step: 1 };
  if (precision === "time") return { type: "time", step: 60 };
  if (precision === "time-second") return { type: "time", step: 1 };
  throw new RangeError(`DateField received unsupported precision ${JSON.stringify(precision)}.`);
}

function comparableValue(value: string, precision: DatePrecision): number | null {
  if (!value) return null;
  if (precision === "year") return Number(value);
  if (precision === "month") {
    const [year, month] = value.split("-").map(Number);
    return Number.isFinite(year) && Number.isFinite(month) ? year * 12 + month : null;
  }
  if (precision === "time" || precision === "time-second") {
    const [hour, minute, second = 0] = value.split(":").map(Number);
    return [hour, minute, second].every(Number.isFinite) ? hour * 3600 + minute * 60 + second : null;
  }
  const timestamp = Date.parse(`${value}${precision === "day" ? "T00:00:00" : ""}Z`);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function DateField(rawProps: DateFieldProps) {
  const { message } = usePersonalUILocale();
  const safeProps = sanitizeFixedControlProps(rawProps, ["children", "size", "step", "type"]);
  const { precision, min, max, placeholder, controlRef, onChange, ...props } = safeProps;
  const config = inputConfig(precision);
  const elementRef = useRef<HTMLInputElement>(null);
  const ownValidityMessage = useRef("");
  const validateRange = (input: HTMLInputElement) => {
    if (input.validity.customError && input.validationMessage !== ownValidityMessage.current) return;
    if (ownValidityMessage.current) input.setCustomValidity("");
    ownValidityMessage.current = "";
    const current = comparableValue(input.value, precision);
    const minimum = comparableValue(String(min ?? ""), precision);
    const maximum = comparableValue(String(max ?? ""), precision);
    if (current === null || input.validity.rangeUnderflow || input.validity.rangeOverflow) return;
    const validationMessage = minimum !== null && current < minimum
      ? message("date.minimum", { value: String(min) })
      : maximum !== null && current > maximum ? message("date.maximum", { value: String(max) }) : "";
    if (validationMessage) {
      input.setCustomValidity(validationMessage);
      ownValidityMessage.current = validationMessage;
    }
  };
  useEffect(() => { if (elementRef.current) validateRange(elementRef.current); }, [precision, min, max, props.value, props.defaultValue]);
  return (
    <InternalInputSlot name="date-field" controlRef={controlRef} elementRef={elementRef}>
      <Input
        {...props}
        onChange={(event) => { validateRange(event.currentTarget); onChange?.(event); }}
        type={config.type}
        step={config.step}
        inputMode={config.inputMode}
        min={min}
        max={max}
        placeholder={placeholder ?? (precision === "year" ? "YYYY" : undefined)}
        startAdornment={<CalendarDays aria-hidden="true" />}
      />
    </InternalInputSlot>
  );
}
