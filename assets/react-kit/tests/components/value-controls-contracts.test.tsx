// @personal-ui-coverage {"kind":"unit","runner":"components","exports":["ColorPicker","DateRangeField","Rating","Slider","TimezoneSelect"]}
import { createElement, createRef, useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  ColorPicker,
  DateRangeField,
  Field,
  Rating,
  Slider,
  TimezoneSelect,
  type ColorPickerProps,
  type DateRangeFieldProps,
  type RatingProps,
  type SliderProps,
  type TimezoneSelectProps,
  type ValidityControlHandle,
} from "../../src/personal-ui";

const forcedEscapes = {
  className: "foreign-control",
  style: { color: "red" },
  css: "foreign-css",
  sx: "foreign-sx",
  tw: "foreign-tw",
  dangerouslySetInnerHTML: { __html: "<b>unsafe</b>" },
  "data-pui-owner": "Consumer",
  "data-pui-slot": "foreign",
  children: "Injected child",
};

function expectClosedRoot(element: HTMLElement, owner: string) {
  expect(element).not.toHaveClass("foreign-control");
  expect(element).not.toHaveAttribute("style");
  expect(element).not.toHaveAttribute("css");
  expect(element).not.toHaveAttribute("sx");
  expect(element).not.toHaveAttribute("tw");
  expect(element).not.toHaveAttribute("data-pui-slot");
  expect(element).toHaveAttribute("data-pui-owner", owner);
  expect(element).toHaveAttribute("data-track", "preserved");
  expect(element).not.toHaveTextContent("Injected child");
}

function expectDevelopmentError(run: () => void, message: RegExp) {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
  try {
    expect(run).toThrow(message);
  } finally {
    consoleError.mockRestore();
  }
}

describe("value control public contracts", () => {
  it("filters escape props at every fixed root while preserving reviewed semantics", () => {
    const onMouseEnter = vi.fn();
    const common = { ...forcedEscapes, "data-track": "preserved", onMouseEnter };
    render(createElement(Slider, {
      ...common,
      "data-testid": "slider",
      defaultValue: 25,
      ariaLabel: "Volume",
    } as unknown as SliderProps));
    render(createElement(Rating, {
      ...common,
      "data-testid": "rating",
      defaultValue: 4,
      ariaLabel: "Rating",
    } as unknown as RatingProps));
    render(createElement(ColorPicker, {
      ...common,
      "data-testid": "color",
      defaultValue: "#1769d2",
      ariaLabel: "Accent",
    } as unknown as ColorPickerProps));
    render(createElement(DateRangeField, {
      ...common,
      "data-testid": "date-range",
      defaultValue: { start: "2026-09-01", end: "2026-09-30" },
    } as unknown as DateRangeFieldProps));
    render(createElement(TimezoneSelect, {
      ...common,
      "data-testid": "timezone",
      defaultValue: "UTC",
    } as unknown as TimezoneSelectProps));

    const roots = [
      ["slider", "Slider"],
      ["rating", "Rating"],
      ["color", "ColorPicker"],
      ["date-range", "DateRangeField"],
      ["timezone", "TimezoneSelect"],
    ] as const;
    roots.forEach(([testId, owner]) => {
      const root = screen.getByTestId(testId);
      expectClosedRoot(root, owner);
      fireEvent.mouseEnter(root);
    });
    expect(onMouseEnter).toHaveBeenCalledTimes(roots.length);
    expect(document.querySelector("[data-pui-owner='Consumer']")).toBeNull();
  });

  it("owns uncontrolled Slider, Rating, ColorPicker, and DateRangeField values", async () => {
    const user = userEvent.setup();
    const sliderChange = vi.fn();
    const ratingChange = vi.fn();
    const colorChange = vi.fn();
    const rangeChange = vi.fn();
    render(
      <>
        <Slider defaultValue={25} onValueChange={sliderChange} ariaLabel="Volume" />
        <Rating defaultValue={2} onValueChange={ratingChange} ariaLabel="Rating" />
        <ColorPicker defaultValue="#1769d2" onValueChange={colorChange} ariaLabel="Accent" />
        <DateRangeField defaultValue={{ start: "2026-09-01", end: "" }} onValueChange={rangeChange} />
      </>,
    );

    const slider = screen.getByRole("slider", { name: "Volume" });
    fireEvent.change(slider, { target: { value: "40" } });
    expect(slider).toHaveValue("40");
    expect(sliderChange).toHaveBeenLastCalledWith(40);

    await user.click(screen.getByRole("radio", { name: "4 / 5" }));
    expect(screen.getByRole("radio", { name: "4 / 5" })).toHaveAttribute("aria-checked", "true");
    expect(ratingChange).toHaveBeenLastCalledWith(4);

    const colorText = screen.getByRole("textbox", { name: "Accent十六进制值" });
    fireEvent.change(colorText, { target: { value: "#137a43" } });
    expect(colorText).toHaveValue("#137a43");
    expect(colorChange).toHaveBeenLastCalledWith("#137a43");

    const start = screen.getByLabelText("开始时间");
    const end = screen.getByLabelText("结束时间");
    fireEvent.change(end, { target: { value: "2026-09-30" } });
    expect(start).toHaveValue("2026-09-01");
    expect(end).toHaveValue("2026-09-30");
    expect(rangeChange).toHaveBeenLastCalledWith({ start: "2026-09-01", end: "2026-09-30" });
  });

  it("owns an uncontrolled TimezoneSelect value and reports selection", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<TimezoneSelect defaultValue="UTC" onValueChange={onValueChange} />);

    const trigger = screen.getByRole("combobox", { name: /时区/ });
    expect(trigger).toHaveTextContent("UTC (±00:00)");
    await user.click(trigger);
    await user.click(screen.getByRole("option", { name: "Asia/Shanghai (UTC+08:00)" }));

    expect(trigger).toHaveTextContent("Asia/Shanghai (UTC+08:00)");
    expect(onValueChange).toHaveBeenLastCalledWith("Asia/Shanghai");
  });

  it("resets DateRangeField state and serialized values together", async () => {
    render(
      <form data-testid="range-form">
        <DateRangeField
          name="period"
          defaultValue={{ start: "2026-09-01", end: "2026-09-30" }}
        />
      </form>,
    );
    const form = screen.getByTestId("range-form") as HTMLFormElement;
    fireEvent.change(screen.getByLabelText("结束时间"), { target: { value: "2026-10-15" } });
    expect(Array.from(new FormData(form).entries())).toEqual([
      ["period.start", "2026-09-01"],
      ["period.end", "2026-10-15"],
    ]);

    fireEvent.reset(form);
    await waitFor(() => {
      expect(screen.getByLabelText("开始时间")).toHaveValue("2026-09-01");
      expect(screen.getByLabelText("结束时间")).toHaveValue("2026-09-30");
    });
    expect(Array.from(new FormData(form).entries())).toEqual([
      ["period.start", "2026-09-01"],
      ["period.end", "2026-09-30"],
    ]);
  });

  it("projects Field semantics and invalid focus onto value controls", () => {
    const ratingRef = createRef<ValidityControlHandle>();
    const colorRef = createRef<ValidityControlHandle>();
    render(
      <>
        <Field label="Volume" htmlFor="slider-field" required error="Volume is invalid">
          <Slider defaultValue={25} ariaLabel="Volume" />
        </Field>
        <Field label="Rating" htmlFor="rating-field" required error="Rating is required">
          <Rating defaultValue={0} ariaLabel="Rating" controlRef={ratingRef} />
        </Field>
        <Field label="Accent" htmlFor="color-field" required error="Accent is required">
          <ColorPicker defaultValue="" ariaLabel="Accent" controlRef={colorRef} />
        </Field>
        <Field label="Timezone" htmlFor="timezone-field" required error="Timezone is required">
          <TimezoneSelect defaultValue="" ariaLabel="Timezone" />
        </Field>
      </>,
    );

    const slider = screen.getByRole("slider", { name: "Volume" });
    const ratingGroup = screen.getByRole("radiogroup", { name: "Rating" });
    const firstRating = screen.getByRole("radio", { name: "1 / 5" });
    const color = screen.getByLabelText("Accent");
    const colorText = screen.getByRole("textbox", { name: "Accent十六进制值" });
    const timezone = screen.getByRole("combobox", { name: /Timezone/ });

    expect(slider).toHaveAttribute("id", "slider-field");
    expect(slider).toHaveAttribute("aria-describedby", "slider-field-error");
    expect(slider).toHaveAttribute("aria-invalid", "true");
    expect(slider).toHaveAttribute("aria-required", "true");

    expect(ratingGroup).toHaveAttribute("aria-describedby", "rating-field-error");
    expect(ratingGroup).toHaveAttribute("aria-invalid", "true");
    expect(ratingGroup).toHaveAttribute("aria-required", "true");
    expect(firstRating).toHaveAttribute("id", "rating-field");

    expect(color).toHaveAttribute("id", "color-field");
    expect(color).toHaveAttribute("aria-describedby", "color-field-error");
    expect(color).toHaveAttribute("aria-invalid", "true");
    expect(color).toHaveAttribute("aria-required", "true");
    expect(colorText).toHaveAttribute("id", "color-field-text");

    expect(timezone).toHaveAttribute("id", "timezone-field");
    expect(timezone).toHaveAttribute("aria-describedby", "timezone-field-error");
    expect(timezone).toHaveAttribute("aria-invalid", "true");
    expect(timezone).toHaveAttribute("aria-required", "true");

    expect(ratingRef.current?.reportValidity()).toBe(false);
    expect(firstRating).toHaveFocus();
    expect(colorRef.current?.reportValidity()).toBe(false);
    expect(color).toHaveFocus();
  });

  it.each([
    [
      "Slider",
      () => render(createElement(Slider, { value: 25, ariaLabel: "Volume" } as unknown as SliderProps)),
      () => render(createElement(Slider, { value: 25, defaultValue: 10, onValueChange: () => undefined, ariaLabel: "Volume" } as unknown as SliderProps)),
    ],
    [
      "Rating",
      () => render(createElement(Rating, { value: 4, ariaLabel: "Rating" } as unknown as RatingProps)),
      () => render(createElement(Rating, { value: 4, defaultValue: 2, onValueChange: () => undefined, ariaLabel: "Rating" } as unknown as RatingProps)),
    ],
    [
      "ColorPicker",
      () => render(createElement(ColorPicker, { value: "#1769d2", ariaLabel: "Accent" } as unknown as ColorPickerProps)),
      () => render(createElement(ColorPicker, { value: "#1769d2", defaultValue: "#137a43", onValueChange: () => undefined, ariaLabel: "Accent" } as unknown as ColorPickerProps)),
    ],
    [
      "DateRangeField",
      () => render(createElement(DateRangeField, { value: { start: "", end: "" } } as unknown as DateRangeFieldProps)),
      () => render(createElement(DateRangeField, { value: { start: "", end: "" }, defaultValue: { start: "2026-09-01", end: "2026-09-30" }, onValueChange: () => undefined } as unknown as DateRangeFieldProps)),
    ],
    [
      "TimezoneSelect",
      () => render(createElement(TimezoneSelect, { value: "UTC" } as unknown as TimezoneSelectProps)),
      () => render(createElement(TimezoneSelect, { value: "UTC", defaultValue: "Asia/Shanghai", onValueChange: () => undefined } as unknown as TimezoneSelectProps)),
    ],
  ])("rejects invalid controlled %s state", (componentName, missingChange, contradictory) => {
    expectDevelopmentError(
      missingChange,
      new RegExp(`${componentName} requires onValueChange when value is controlled`),
    );
    expectDevelopmentError(
      contradictory,
      new RegExp(`${componentName} cannot receive both value and defaultValue`),
    );
  });

  it("rejects switching Slider from uncontrolled to controlled mode", () => {
    function SwitchingSlider() {
      const [controlled, setControlled] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setControlled(true)}>control slider</button>
          {controlled
            ? <Slider value={25} onValueChange={() => undefined} ariaLabel="Volume" />
            : <Slider defaultValue={10} ariaLabel="Volume" />}
        </>
      );
    }
    render(<SwitchingSlider />);

    expectDevelopmentError(
      () => fireEvent.click(screen.getByRole("button", { name: "control slider" })),
      /Slider cannot switch from uncontrolled to controlled mode/,
    );
  });
});
