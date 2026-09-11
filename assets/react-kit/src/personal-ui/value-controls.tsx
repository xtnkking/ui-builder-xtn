import {
  useId,
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Check, Palette, Star } from "lucide-react";
import { DateField, type DatePrecision } from "./date-field";
import { Input, Select, type SelectOption } from "./forms";
import { cx } from "./utils";

function FormValueBridge({
  name,
  form,
  value,
  disabled,
  required,
}: {
  name?: string;
  form?: string;
  value: string;
  disabled?: boolean;
  required?: boolean;
}) {
  if (!name) return null;
  return <input type="hidden" name={name} form={form} value={value} disabled={disabled} required={required} data-pui-form-bridge="true" readOnly />;
}

export interface SliderProps {
  value: number | readonly [number, number];
  onValueChange: (value: number | [number, number]) => void;
  min?: number;
  max?: number;
  step?: number;
  name?: string;
  form?: string;
  required?: boolean;
  disabled?: boolean;
  ariaLabel: string;
  showValue?: boolean;
  formatValue?: (value: number) => ReactNode;
  className?: string;
}

function normalizeSliderValue(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function Slider({
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  name,
  form,
  required,
  disabled,
  ariaLabel,
  showValue = true,
  formatValue = (current) => current,
  className,
}: SliderProps) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    throw new RangeError("Slider max must be greater than min.");
  }
  if (!Number.isFinite(step) || step <= 0) throw new RangeError("Slider step must be greater than zero.");
  const range = Array.isArray(value);
  const values: [number, number] = range
    ? [normalizeSliderValue(value[0], min, max), normalizeSliderValue(value[1], min, max)]
    : [normalizeSliderValue(value as number, min, max), max];
  if (values[0] > values[1]) values.reverse();
  if (!range) {
    return (
      <label data-pui-owner="Slider" className={cx("pui-slider", className)}>
        <span className="pui-slider__header"><span>{ariaLabel}</span>{showValue ? <output>{formatValue(values[0])}</output> : null}</span>
        <input type="range" min={min} max={max} step={step} value={values[0]} name={name} form={form} required={required} disabled={disabled} aria-label={ariaLabel} onChange={(event) => onValueChange(event.target.valueAsNumber)} />
      </label>
    );
  }
  return (
    <div data-pui-owner="Slider" className={cx("pui-slider pui-slider--range", className)} role="group" aria-label={ariaLabel}>
      <div className="pui-slider__header"><span>{ariaLabel}</span>{showValue ? <output>{formatValue(values[0])} - {formatValue(values[1])}</output> : null}</div>
      <label className="pui-slider__range-control"><span>最小值</span><input type="range" min={min} max={values[1]} step={step} value={values[0]} disabled={disabled} aria-label={`${ariaLabel}最小值`} onChange={(event) => onValueChange([Math.min(event.target.valueAsNumber, values[1]), values[1]])} /></label>
      <label className="pui-slider__range-control"><span>最大值</span><input type="range" min={values[0]} max={max} step={step} value={values[1]} disabled={disabled} aria-label={`${ariaLabel}最大值`} onChange={(event) => onValueChange([values[0], Math.max(event.target.valueAsNumber, values[0])])} /></label>
      <FormValueBridge name={name} form={form} value={String(values[0])} disabled={disabled} required={required} />
      <FormValueBridge name={name} form={form} value={String(values[1])} disabled={disabled} />
    </div>
  );
}

export interface RatingProps {
  value: number;
  onValueChange: (value: number) => void;
  max?: number;
  allowClear?: boolean;
  name?: string;
  form?: string;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  ariaLabel: string;
  getLabel?: (value: number, max: number) => string;
  className?: string;
}

export function Rating({
  value,
  onValueChange,
  max = 5,
  allowClear = true,
  name,
  form,
  required,
  disabled,
  readOnly,
  ariaLabel,
  getLabel = (current, total) => `${current} / ${total}`,
  className,
}: RatingProps) {
  if (!Number.isInteger(max) || max < 1 || max > 20) throw new RangeError("Rating max must be an integer between 1 and 20.");
  const normalized = Math.min(max, Math.max(0, Math.round(value)));
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const choose = (next: number) => {
    if (disabled || readOnly) return;
    onValueChange(allowClear && next === normalized ? 0 : next);
  };
  const handleKey = (event: KeyboardEvent<HTMLButtonElement>, current: number) => {
    if (disabled || readOnly) return;
    let next: number | undefined;
    if (event.key === "ArrowRight" || event.key === "ArrowUp") next = current === max ? 1 : current + 1;
    else if (event.key === "ArrowLeft" || event.key === "ArrowDown") next = current === 1 ? max : current - 1;
    else if (event.key === "Home") next = 1;
    else if (event.key === "End") next = max;
    if (next == null) return;
    event.preventDefault();
    onValueChange(next);
    refs.current[next - 1]?.focus();
  };
  return (
    <div data-pui-owner="Rating" className={cx("pui-rating", className)} role="radiogroup" aria-label={ariaLabel} aria-required={required || undefined} aria-disabled={disabled || readOnly || undefined}>
      <span className="pui-rating__stars">
        {Array.from({ length: max }, (_, index) => {
          const current = index + 1;
          return (
            <button key={current} ref={(node) => { refs.current[index] = node; }} type="button" role="radio" aria-checked={current === normalized} aria-label={getLabel(current, max)} tabIndex={current === (normalized || 1) ? 0 : -1} disabled={disabled} aria-disabled={readOnly || undefined} onClick={() => choose(current)} onKeyDown={(event) => handleKey(event, current)}>
              <Star aria-hidden="true" fill={current <= normalized ? "currentColor" : "none"} />
            </button>
          );
        })}
      </span>
      <span className="pui-rating__value" aria-live="polite">{normalized ? getLabel(normalized, max) : "未评分"}</span>
      <FormValueBridge name={name} form={form} value={normalized ? String(normalized) : ""} disabled={disabled} required={required} />
    </div>
  );
}

export interface ColorPickerProps {
  id?: string;
  value: string;
  onValueChange: (value: string) => void;
  swatches?: readonly string[];
  showTextInput?: boolean;
  name?: string;
  form?: string;
  required?: boolean;
  disabled?: boolean;
  ariaLabel: string;
  className?: string;
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export function ColorPicker({
  id,
  value,
  onValueChange,
  swatches = ["#1769e0", "#157a52", "#996300", "#b83243", "#7c3aed", "#172033"],
  showTextInput = true,
  name,
  form,
  required,
  disabled,
  ariaLabel,
  className,
}: ColorPickerProps) {
  const generatedId = useId();
  const controlId = id ?? `pui-color-${generatedId}`;
  const nativeValue = HEX_COLOR.test(value) ? value : "#000000";
  return (
    <div data-pui-owner="ColorPicker" className={cx("pui-color-picker", className)}>
      <label className="pui-color-picker__native" htmlFor={controlId} title={ariaLabel}>
        <Palette aria-hidden="true" />
        <span style={{ backgroundColor: nativeValue }} />
        <input id={controlId} type="color" value={nativeValue} disabled={disabled} aria-label={ariaLabel} onChange={(event) => onValueChange(event.target.value)} />
      </label>
      <div className="pui-color-picker__swatches" role="group" aria-label={`${ariaLabel}预设颜色`}>
        {swatches.map((color) => (
          <button key={color} type="button" className="pui-color-picker__swatch" style={{ backgroundColor: color }} aria-label={color} aria-pressed={color.toLocaleLowerCase() === value.toLocaleLowerCase()} disabled={disabled} onClick={() => onValueChange(color)}>{color.toLocaleLowerCase() === value.toLocaleLowerCase() ? <Check aria-hidden="true" /> : null}</button>
        ))}
      </div>
      {showTextInput ? <Input value={value} disabled={disabled} required={required} invalid={Boolean(value && !HEX_COLOR.test(value))} aria-label={`${ariaLabel}十六进制值`} placeholder="#1769e0" onChange={(event) => onValueChange(event.target.value)} /> : null}
      <FormValueBridge name={name} form={form} value={value} disabled={disabled} required={required} />
    </div>
  );
}

export interface DateRangeValue {
  start: string;
  end: string;
}

export interface DateRangeFieldProps {
  value: DateRangeValue;
  onValueChange: (value: DateRangeValue) => void;
  precision?: DatePrecision;
  startLabel?: string;
  endLabel?: string;
  startName?: string;
  endName?: string;
  name?: string;
  form?: string;
  min?: string;
  max?: string;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  invalid?: boolean;
  rangeError?: ReactNode;
  className?: string;
}

export function DateRangeField({
  value,
  onValueChange,
  precision = "day",
  startLabel = "开始时间",
  endLabel = "结束时间",
  startName,
  endName,
  name,
  form,
  min,
  max,
  required,
  disabled,
  readOnly,
  invalid,
  rangeError = "结束时间不能早于开始时间",
  className,
}: DateRangeFieldProps) {
  const generatedId = useId();
  const startId = `pui-date-range-start-${generatedId}`;
  const endId = `pui-date-range-end-${generatedId}`;
  const orderInvalid = Boolean(value.start && value.end && value.start > value.end);
  const resolvedInvalid = Boolean(invalid || orderInvalid);
  return (
    <div data-pui-owner="DateRangeField" className={cx("pui-date-range", resolvedInvalid && "is-invalid", className)} role="group" aria-label={`${startLabel}至${endLabel}`}>
      <label htmlFor={startId}><span>{startLabel}</span><DateField id={startId} precision={precision} value={value.start} name={startName ?? (name ? `${name}.start` : undefined)} form={form} min={min} max={value.end || max} required={required} disabled={disabled} readOnly={readOnly} aria-invalid={resolvedInvalid || undefined} onChange={(event) => onValueChange({ ...value, start: event.target.value })} /></label>
      <span className="pui-date-range__separator" aria-hidden="true">至</span>
      <label htmlFor={endId}><span>{endLabel}</span><DateField id={endId} precision={precision} value={value.end} name={endName ?? (name ? `${name}.end` : undefined)} form={form} min={value.start || min} max={max} required={required} disabled={disabled} readOnly={readOnly} aria-invalid={resolvedInvalid || undefined} onChange={(event) => onValueChange({ ...value, end: event.target.value })} /></label>
      {orderInvalid ? <span className="pui-date-range__error" role="alert">{rangeError}</span> : null}
    </div>
  );
}

export interface TimezoneOption {
  value: string;
  label: ReactNode;
  textValue?: string;
  disabled?: boolean;
}

export interface TimezoneSelectProps {
  id?: string;
  value?: string;
  onValueChange: (value: string) => void;
  options?: readonly TimezoneOption[];
  name?: string;
  form?: string;
  required?: boolean;
  disabled?: boolean;
  placement?: "top" | "bottom";
  ariaLabel?: string;
  placeholder?: string;
  className?: string;
}

export const DEFAULT_TIMEZONE_OPTIONS: readonly TimezoneOption[] = [
  { value: "UTC", label: "UTC (±00:00)" },
  { value: "Asia/Shanghai", label: "Asia/Shanghai (UTC+08:00)" },
  { value: "Asia/Hong_Kong", label: "Asia/Hong Kong (UTC+08:00)" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo (UTC+09:00)" },
  { value: "Asia/Singapore", label: "Asia/Singapore (UTC+08:00)" },
  { value: "Europe/London", label: "Europe/London" },
  { value: "Europe/Paris", label: "Europe/Paris" },
  { value: "America/New_York", label: "America/New York" },
  { value: "America/Chicago", label: "America/Chicago" },
  { value: "America/Denver", label: "America/Denver" },
  { value: "America/Los_Angeles", label: "America/Los Angeles" },
  { value: "Australia/Sydney", label: "Australia/Sydney" },
];

export function TimezoneSelect({
  id,
  value,
  onValueChange,
  options = DEFAULT_TIMEZONE_OPTIONS,
  name,
  form,
  required,
  disabled,
  placement,
  ariaLabel = "时区",
  placeholder = "选择时区",
  className,
}: TimezoneSelectProps) {
  const selectOptions: SelectOption[] = options.map((option) => ({
    value: option.value,
    label: option.label,
    textValue: option.textValue ?? (typeof option.label === "string" ? option.label : option.value),
    disabled: option.disabled,
  }));
  return (
    <div data-pui-owner="TimezoneSelect" className={cx("pui-form-control-bridge", className)}>
      <Select id={id} options={selectOptions} value={value} onValueChange={onValueChange} ariaLabel={ariaLabel} placeholder={placeholder} placement={placement} disabled={disabled} aria-required={required || undefined} />
      <FormValueBridge name={name} form={form} value={value ?? ""} disabled={disabled} required={required} />
    </div>
  );
}
