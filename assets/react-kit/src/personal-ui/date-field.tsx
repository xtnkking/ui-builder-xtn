import { forwardRef, type InputHTMLAttributes } from "react";
import { CalendarDays } from "lucide-react";
import { Input } from "./forms";

export type DatePrecision = "year" | "month" | "day" | "minute" | "second" | "time" | "time-second";

export interface DateFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "step"> {
  precision: DatePrecision;
}

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

export const DateField = forwardRef<HTMLInputElement, DateFieldProps>(function DateField(
  { precision, min, max, placeholder, ...props },
  ref,
) {
  const config = inputConfig(precision);
  return (
    <Input
      {...props}
      ref={ref}
      type={config.type}
      step={config.step}
      inputMode={config.inputMode}
      min={min}
      max={max}
      placeholder={placeholder ?? (precision === "year" ? "YYYY" : undefined)}
      startAdornment={<CalendarDays aria-hidden="true" />}
    />
  );
});
