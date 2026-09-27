import {
  useId,
  useImperativeHandle,
  useRef,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Check, Palette, Star } from "lucide-react";
import type {
  ControllableValueProps,
  ControlRef,
  PublicControlProps,
  ValidityControlHandle,
} from "../foundation/contracts";
import { useControllableState } from "../internal/controllable-state";
import { DateField, type DatePrecision } from "./date-field";
import { Input, Select, type SelectOption } from "./forms";
import { sanitizeFixedControlProps } from "../internal/fixed-control-props";
import {
  CompositeFieldBoundary,
  CompositeFormControl,
  useCompositeFieldState,
  useFormReset,
} from "../internal/composite-form-control";
import { usePersonalUILocale } from "../foundation/locale";
import { cx } from "../internal/utils";

export type SliderValue = number | readonly [number, number];

type SliderBaseProps = PublicControlProps<Omit<
  HTMLAttributes<HTMLElement>,
  "aria-label" | "children" | "defaultValue" | "onChange"
>> & {
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
  controlRef?: ControlRef<ValidityControlHandle>;
};

export type SliderProps = SliderBaseProps & ControllableValueProps<SliderValue>;

function normalizeSliderValue(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function Slider(rawProps: SliderProps) {
  const { message } = usePersonalUILocale();
  const controlled = rawProps.value !== undefined;
  const defaultValueProvided = rawProps.defaultValue !== undefined;
  const safeProps = sanitizeFixedControlProps(rawProps, ["aria-label", "children"]);
  const {
    value,
    defaultValue,
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
    controlRef,
    id,
    "aria-describedby": ariaDescribedBy,
    "aria-invalid": ariaInvalid,
    "aria-required": ariaRequired,
    ...rootProps
  } = safeProps;
  const [currentValue, setCurrentValue, resetCurrentValue] = useControllableState<SliderValue>({
    componentName: "Slider",
    controlled,
    value,
    defaultValue: defaultValue ?? min,
    defaultValueProvided,
    onChange: onValueChange,
  });
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    throw new RangeError("Slider max must be greater than min.");
  }
  if (!Number.isFinite(step) || step <= 0) throw new RangeError("Slider step must be greater than zero.");
  const generatedId = useId();
  const fallbackId = `pui-slider-${generatedId}`;
  const fieldState = useCompositeFieldState({
    id,
    fallbackId,
    describedBy: ariaDescribedBy,
    invalid: ariaInvalid,
    required: required || ariaRequired,
  });
  const fieldInvalid = fieldState.invalid === true || fieldState.invalid === "true";
  const firstInputRef = useRef<HTMLInputElement>(null);
  const range = Array.isArray(currentValue);
  const values: [number, number] = range
    ? [normalizeSliderValue(currentValue[0], min, max), normalizeSliderValue(currentValue[1], min, max)]
    : [normalizeSliderValue(currentValue as number, min, max), max];
  if (values[0] > values[1]) values.reverse();
  if (!range) {
    return (
      <>
        <label {...rootProps} data-pui-owner="Slider" className={cx("pui-slider", fieldInvalid && "is-invalid")}>
          <span className="pui-slider__header"><span>{ariaLabel}</span>{showValue ? <output>{formatValue(values[0])}</output> : null}</span>
          <input ref={firstInputRef} id={fieldState.id} type="range" min={min} max={max} step={step} value={values[0]} disabled={disabled} aria-label={ariaLabel} aria-describedby={fieldState.describedBy} aria-invalid={fieldState.invalid} aria-required={fieldState.required} onChange={(event) => setCurrentValue(event.target.valueAsNumber)} />
        </label>
        <CompositeFormControl name={name} form={form} values={[String(values[0])]} disabled={disabled} required={required} controlRef={controlRef} focusTargetRef={firstInputRef} onReset={resetCurrentValue} />
      </>
    );
  }
  return (
    <div {...rootProps} data-pui-owner="Slider" className={cx("pui-slider pui-slider--range", fieldInvalid && "is-invalid")} role="group" aria-label={ariaLabel} aria-describedby={fieldState.describedBy} aria-invalid={fieldState.invalid} aria-required={fieldState.required}>
      <div className="pui-slider__header"><span>{ariaLabel}</span>{showValue ? <output>{formatValue(values[0])} - {formatValue(values[1])}</output> : null}</div>
      <label className="pui-slider__range-control"><span>{message("slider.minimum")}</span><input ref={firstInputRef} id={fieldState.id} type="range" min={min} max={values[1]} step={step} value={values[0]} disabled={disabled} aria-label={message("slider.minimumAria", { label: ariaLabel })} aria-describedby={fieldState.describedBy} aria-invalid={fieldState.invalid} aria-required={fieldState.required} onChange={(event) => setCurrentValue([Math.min(event.target.valueAsNumber, values[1]), values[1]])} /></label>
      <label className="pui-slider__range-control"><span>{message("slider.maximum")}</span><input type="range" min={values[0]} max={max} step={step} value={values[1]} disabled={disabled} aria-label={message("slider.maximumAria", { label: ariaLabel })} aria-describedby={fieldState.describedBy} aria-invalid={fieldState.invalid} onChange={(event) => setCurrentValue([values[0], Math.max(event.target.valueAsNumber, values[0])])} /></label>
      <CompositeFormControl name={name} form={form} values={values.map(String)} disabled={disabled} required={required} controlRef={controlRef} focusTargetRef={firstInputRef} onReset={resetCurrentValue} />
    </div>
  );
}

type RatingBaseProps = PublicControlProps<Omit<
  HTMLAttributes<HTMLDivElement>,
  "aria-label" | "children" | "defaultValue" | "onChange"
>> & {
  max?: number;
  allowClear?: boolean;
  name?: string;
  form?: string;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  ariaLabel: string;
  getLabel?: (value: number, max: number) => string;
  controlRef?: ControlRef<ValidityControlHandle>;
};

export type RatingProps = RatingBaseProps & ControllableValueProps<number>;

export function Rating(rawProps: RatingProps) {
  const { message } = usePersonalUILocale();
  const controlled = rawProps.value !== undefined;
  const defaultValueProvided = rawProps.defaultValue !== undefined;
  const safeProps = sanitizeFixedControlProps(rawProps, ["aria-label", "children"]);
  const {
    value,
    defaultValue,
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
    controlRef,
    id,
    "aria-describedby": ariaDescribedBy,
    "aria-invalid": ariaInvalid,
    "aria-required": ariaRequired,
    ...rootProps
  } = safeProps;
  const [currentValue, setCurrentValue, resetCurrentValue] = useControllableState({
    componentName: "Rating",
    controlled,
    value,
    defaultValue: defaultValue ?? 0,
    defaultValueProvided,
    onChange: onValueChange,
  });
  if (!Number.isInteger(max) || max < 1 || max > 20) throw new RangeError("Rating max must be an integer between 1 and 20.");
  const generatedId = useId();
  const fallbackId = `pui-rating-${generatedId}`;
  const fieldState = useCompositeFieldState({
    id,
    fallbackId,
    describedBy: ariaDescribedBy,
    invalid: ariaInvalid,
    required: required || ariaRequired,
  });
  const fieldInvalid = fieldState.invalid === true || fieldState.invalid === "true";
  const normalized = Math.min(max, Math.max(0, Math.round(currentValue)));
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const firstButtonRef = useRef<HTMLButtonElement | null>(null);
  const choose = (next: number) => {
    if (disabled || readOnly) return;
    setCurrentValue(allowClear && next === normalized ? 0 : next);
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
    setCurrentValue(next);
    refs.current[next - 1]?.focus();
  };
  return (
    <div {...rootProps} data-pui-owner="Rating" className={cx("pui-rating", fieldInvalid && "is-invalid")} role="radiogroup" aria-label={ariaLabel} aria-describedby={fieldState.describedBy} aria-invalid={fieldState.invalid} aria-required={fieldState.required} aria-disabled={disabled || readOnly || undefined}>
      <span className="pui-rating__stars">
        {Array.from({ length: max }, (_, index) => {
          const current = index + 1;
          return (
            <button key={current} ref={(node) => { refs.current[index] = node; if (index === 0) firstButtonRef.current = node; }} id={index === 0 ? fieldState.id : undefined} type="button" role="radio" aria-checked={current === normalized} aria-label={getLabel(current, max)} tabIndex={current === (normalized || 1) ? 0 : -1} disabled={disabled} aria-disabled={readOnly || undefined} onClick={() => choose(current)} onKeyDown={(event) => handleKey(event, current)}>
              <Star aria-hidden="true" fill={current <= normalized ? "currentColor" : "none"} />
            </button>
          );
        })}
      </span>
      <span className="pui-rating__value" aria-live="polite">{normalized ? getLabel(normalized, max) : message("rating.unrated")}</span>
      <CompositeFormControl name={name} form={form} values={[normalized ? String(normalized) : ""]} disabled={disabled} readOnly={readOnly} required={required} controlRef={controlRef} focusTargetRef={firstButtonRef} onReset={resetCurrentValue} />
    </div>
  );
}

type ColorPickerBaseProps = PublicControlProps<Omit<
  HTMLAttributes<HTMLDivElement>,
  "aria-label" | "children" | "defaultValue" | "onChange"
>> & {
  swatches?: readonly string[];
  showTextInput?: boolean;
  name?: string;
  form?: string;
  required?: boolean;
  disabled?: boolean;
  ariaLabel: string;
  controlRef?: ControlRef<ValidityControlHandle>;
};

export type ColorPickerProps = ColorPickerBaseProps & ControllableValueProps<string>;

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export function ColorPicker(rawProps: ColorPickerProps) {
  const { message } = usePersonalUILocale();
  const controlled = rawProps.value !== undefined;
  const defaultValueProvided = rawProps.defaultValue !== undefined;
  const safeProps = sanitizeFixedControlProps(rawProps, ["aria-label", "children"]);
  const {
    id,
    value,
    defaultValue,
    onValueChange,
    swatches = ["#1769d2", "#137a43", "#996300", "#c9362b", "#7c3aed", "#171a20"],
    showTextInput = true,
    name,
    form,
    required,
    disabled,
    ariaLabel,
    controlRef,
    "aria-describedby": ariaDescribedBy,
    "aria-invalid": ariaInvalid,
    "aria-required": ariaRequired,
    ...rootProps
  } = safeProps;
  const [currentValue, setCurrentValue, resetCurrentValue] = useControllableState({
    componentName: "ColorPicker",
    controlled,
    value,
    defaultValue: defaultValue ?? "",
    defaultValueProvided,
    onChange: onValueChange,
  });
  const generatedId = useId();
  const fallbackId = `pui-color-${generatedId}`;
  const fieldState = useCompositeFieldState({
    id,
    fallbackId,
    describedBy: ariaDescribedBy,
    invalid: ariaInvalid,
    required: required || ariaRequired,
  });
  const controlId = fieldState.id ?? fallbackId;
  const colorInputRef = useRef<HTMLInputElement>(null);
  const nativeValue = HEX_COLOR.test(currentValue) ? currentValue : "#000000";
  const formatInvalid = Boolean(currentValue && !HEX_COLOR.test(currentValue));
  const resolvedInvalid = formatInvalid || fieldState.invalid === true || fieldState.invalid === "true";
  return (
    <div {...rootProps} data-pui-owner="ColorPicker" className={cx("pui-color-picker", resolvedInvalid && "is-invalid")} role="group" aria-describedby={fieldState.describedBy} aria-invalid={resolvedInvalid || undefined} aria-required={fieldState.required}>
      <label className="pui-color-picker__native" htmlFor={controlId} title={ariaLabel}>
        <Palette aria-hidden="true" />
        <span style={{ backgroundColor: nativeValue }} />
        <input ref={colorInputRef} id={controlId} type="color" value={nativeValue} disabled={disabled} aria-label={ariaLabel} aria-describedby={fieldState.describedBy} aria-invalid={resolvedInvalid || undefined} aria-required={fieldState.required} onChange={(event) => setCurrentValue(event.target.value)} />
      </label>
      <div className="pui-color-picker__swatches" role="group" aria-label={message("color.presets", { label: ariaLabel })}>
        {swatches.map((color) => (
          <button key={color} type="button" className="pui-color-picker__swatch" style={{ backgroundColor: color }} aria-label={color} aria-pressed={color.toLocaleLowerCase() === currentValue.toLocaleLowerCase()} disabled={disabled} onClick={() => setCurrentValue(color)}>{color.toLocaleLowerCase() === currentValue.toLocaleLowerCase() ? <Check aria-hidden="true" /> : null}</button>
        ))}
      </div>
      {showTextInput ? (
        <CompositeFieldBoundary>
          <Input id={`${controlId}-text`} value={currentValue} disabled={disabled} aria-describedby={fieldState.describedBy} aria-required={fieldState.required} invalid={formatInvalid} aria-label={message("color.hex", { label: ariaLabel })} placeholder="#1769d2" onChange={(event) => setCurrentValue(event.target.value)} />
        </CompositeFieldBoundary>
      ) : null}
      <CompositeFormControl name={name} form={form} values={[currentValue]} disabled={disabled} required={required} controlRef={controlRef} focusTargetRef={colorInputRef} onReset={resetCurrentValue} />
    </div>
  );
}

export interface DateRangeValue {
  start: string;
  end: string;
}

type DateRangeFieldBaseProps = PublicControlProps<Omit<
  HTMLAttributes<HTMLDivElement>,
  "aria-label" | "children" | "defaultValue" | "onChange"
>> & {
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
  controlRef?: ControlRef<ValidityControlHandle>;
};

export type DateRangeFieldProps = DateRangeFieldBaseProps & ControllableValueProps<DateRangeValue>;

export function DateRangeField(rawProps: DateRangeFieldProps) {
  const { message } = usePersonalUILocale();
  const controlled = rawProps.value !== undefined;
  const defaultValueProvided = rawProps.defaultValue !== undefined;
  const safeProps = sanitizeFixedControlProps(rawProps, ["aria-label", "children"]);
  const {
    value,
    defaultValue,
    onValueChange,
    precision = "day",
    startLabel = message("dateRange.start"),
    endLabel = message("dateRange.end"),
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
    rangeError = message("dateRange.invalidOrder"),
    controlRef,
    ...rootProps
  } = safeProps;
  const [currentValue, setCurrentValue, resetCurrentValue] = useControllableState({
    componentName: "DateRangeField",
    controlled,
    value,
    defaultValue: defaultValue ?? { start: "", end: "" },
    defaultValueProvided,
    onChange: onValueChange,
  });
  const generatedId = useId();
  const startId = `pui-date-range-start-${generatedId}`;
  const endId = `pui-date-range-end-${generatedId}`;
  const orderInvalid = Boolean(currentValue.start && currentValue.end && currentValue.start > currentValue.end);
  const resolvedInvalid = Boolean(invalid || orderInvalid);
  const rootRef = useRef<HTMLDivElement>(null);
  const startControlRef = useRef<ValidityControlHandle>(null);
  const endControlRef = useRef<ValidityControlHandle>(null);
  useFormReset(form, rootRef, resetCurrentValue);
  useImperativeHandle(controlRef, () => ({
    focus(options?: FocusOptions) {
      startControlRef.current?.focus(options);
    },
    setCustomValidity(error: string) {
      startControlRef.current?.setCustomValidity(error);
    },
    checkValidity() {
      const startValid = startControlRef.current?.checkValidity() ?? false;
      const endValid = endControlRef.current?.checkValidity() ?? false;
      return startValid && endValid;
    },
    reportValidity() {
      if (!(startControlRef.current?.checkValidity() ?? false)) {
        return startControlRef.current?.reportValidity() ?? false;
      }
      return endControlRef.current?.reportValidity() ?? false;
    },
  } as ValidityControlHandle), []);
  return (
    <div ref={rootRef} {...rootProps} data-pui-owner="DateRangeField" className={cx("pui-date-range", resolvedInvalid && "is-invalid")} role="group" aria-label={message("dateRange.label", { start: String(startLabel), end: String(endLabel) })}>
      <label htmlFor={startId}><span>{startLabel}</span><DateField id={startId} precision={precision} value={currentValue.start} name={startName ?? (name ? `${name}.start` : undefined)} form={form} min={min} max={currentValue.end || max} required={required} disabled={disabled} readOnly={readOnly} aria-invalid={resolvedInvalid || undefined} controlRef={startControlRef} onChange={(event) => setCurrentValue({ ...currentValue, start: event.target.value })} /></label>
      <span className="pui-date-range__separator" aria-hidden="true">{message("dateRange.separator")}</span>
      <label htmlFor={endId}><span>{endLabel}</span><DateField id={endId} precision={precision} value={currentValue.end} name={endName ?? (name ? `${name}.end` : undefined)} form={form} min={currentValue.start || min} max={max} required={required} disabled={disabled} readOnly={readOnly} aria-invalid={resolvedInvalid || undefined} controlRef={endControlRef} onChange={(event) => setCurrentValue({ ...currentValue, end: event.target.value })} /></label>
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

type TimezoneSelectBaseProps = PublicControlProps<Omit<
  HTMLAttributes<HTMLDivElement>,
  "aria-label" | "children" | "defaultValue" | "onChange"
>> & {
  options?: readonly TimezoneOption[];
  name?: string;
  form?: string;
  required?: boolean;
  disabled?: boolean;
  placement?: "top" | "bottom";
  ariaLabel?: string;
  placeholder?: string;
  controlRef?: ControlRef<ValidityControlHandle>;
};

export type TimezoneSelectProps = TimezoneSelectBaseProps & ControllableValueProps<string>;

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

export function TimezoneSelect(rawProps: TimezoneSelectProps) {
  const { message } = usePersonalUILocale();
  const controlled = rawProps.value !== undefined;
  const defaultValueProvided = rawProps.defaultValue !== undefined;
  const safeProps = sanitizeFixedControlProps(rawProps, ["aria-label", "children"]);
  const {
    id,
    value,
    defaultValue,
    onValueChange,
    options = DEFAULT_TIMEZONE_OPTIONS,
    name,
    form,
    required,
    disabled,
    placement,
    ariaLabel = message("timezone.label"),
    placeholder = message("timezone.placeholder"),
    controlRef,
    "aria-describedby": ariaDescribedBy,
    "aria-invalid": ariaInvalid,
    "aria-required": ariaRequired,
    ...rootProps
  } = safeProps;
  const [currentValue, setCurrentValue, resetCurrentValue] = useControllableState({
    componentName: "TimezoneSelect",
    controlled,
    value,
    defaultValue: defaultValue ?? "",
    defaultValueProvided,
    onChange: onValueChange,
  });
  const generatedId = useId();
  const fallbackId = `pui-timezone-${generatedId}`;
  const fieldState = useCompositeFieldState({
    id,
    fallbackId,
    describedBy: ariaDescribedBy,
    invalid: ariaInvalid,
    required: required || ariaRequired,
  });
  const fieldInvalid = fieldState.invalid === true || fieldState.invalid === "true";
  const selectOptions: SelectOption[] = options.map((option) => ({
    value: option.value,
    label: option.label,
    textValue: option.textValue ?? (typeof option.label === "string" ? option.label : option.value),
    disabled: option.disabled,
  }));
  return (
    <div {...rootProps} data-pui-owner="TimezoneSelect" className={cx("pui-form-control-bridge", fieldInvalid && "is-invalid")}>
      <CompositeFieldBoundary>
        <Select id={fieldState.id} options={selectOptions} value={currentValue} onValueChange={setCurrentValue} ariaLabel={ariaLabel} placeholder={placeholder} placement={placement} disabled={disabled} aria-describedby={fieldState.describedBy} aria-invalid={fieldState.invalid} aria-required={fieldState.required} />
      </CompositeFieldBoundary>
      <CompositeFormControl name={name} form={form} values={[currentValue]} disabled={disabled} required={required} controlRef={controlRef} onReset={resetCurrentValue} />
    </div>
  );
}
