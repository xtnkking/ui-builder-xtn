// @personal-ui-coverage {"kind":"unit","runner":"components","exports":["Calendar","DateField"]}
import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Calendar, DateField } from "../../src/personal-ui";

function DateGrid() {
  const [month, setMonth] = useState(new Date(2024, 1, 1));
  const [value, setValue] = useState(new Date(2024, 1, 28));
  return (
    <Calendar
      month={month}
      value={value}
      onMonthChange={setMonth}
      onValueChange={setValue}
      min={new Date(2024, 1, 27)}
      max={new Date(2024, 2, 5)}
      isDateDisabled={(date) => date.getMonth() === 2 && date.getDate() === 2}
      locale="en-US"
      ariaLabel="Booking date"
    />
  );
}

describe("Calendar date grid and native DateField", () => {
  it("owns six date rows, one weekday row, and a single roving date Tab stop", async () => {
    const user = userEvent.setup();
    render(<DateGrid />);
    const grid = screen.getByRole("grid", { name: /Booking date/ });
    expect(within(grid).getAllByRole("row")).toHaveLength(7);
    expect(within(grid).getAllByRole("columnheader")).toHaveLength(7);
    expect(within(grid).getAllByRole("gridcell")).toHaveLength(42);
    const dates = within(grid).getAllByRole("button");
    expect(dates.filter((day) => day.tabIndex === 0)).toHaveLength(1);
    const selected = within(grid).getByRole("gridcell", { name: "February 28, 2024" });
    expect(selected).toHaveAttribute("aria-selected", "true");
    await user.click(within(selected).getByRole("button"));
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "February 29, 2024" })).toHaveFocus();
    expect(dates.filter((day) => day.tabIndex === 0)).toHaveLength(1);
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "March 1, 2024" })).toHaveFocus();
    expect(screen.getByText("March 2024")).toBeVisible();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "March 3, 2024" })).toHaveFocus();
    expect(screen.getByRole("gridcell", { name: "March 2, 2024" })).toHaveAttribute("aria-disabled", "true");
  });

  it("navigates week and month boundaries without activating excluded dates", async () => {
    const user = userEvent.setup();
    render(<DateGrid />);
    const selected = screen.getByRole("button", { name: "February 28, 2024" });
    selected.focus();
    await user.keyboard("{Home}");
    expect(screen.getByRole("button", { name: "February 27, 2024" })).toHaveFocus();
    await user.keyboard("{End}");
    expect(screen.getByRole("button", { name: "March 1, 2024" })).toHaveFocus();
    await user.keyboard("{PageUp}");
    expect(screen.getByRole("button", { name: "February 27, 2024" })).toHaveFocus();
    await user.keyboard("{PageDown}");
    expect(screen.getByRole("button", { name: "March 5, 2024" })).toHaveFocus();
    await user.keyboard("{PageDown}");
    expect(screen.getByRole("button", { name: "March 5, 2024" })).toHaveFocus();
  });

  it("retargets an external controlled selection and leaves no disabled date active", () => {
    const { rerender } = render(
      <Calendar month={new Date(2026, 8, 1)} value={new Date(2026, 8, 15)} onValueChange={() => undefined} locale="en-US" />,
    );
    screen.getByRole("button", { name: "September 15, 2026" }).focus();
    rerender(<Calendar month={new Date(2026, 8, 1)} value={new Date(2026, 8, 20)} onValueChange={() => undefined} locale="en-US" />);
    expect(screen.getByRole("button", { name: "September 20, 2026" })).toHaveFocus();
    rerender(<Calendar month={new Date(2026, 8, 1)} value={new Date(2026, 8, 20)} onValueChange={() => undefined} isDateDisabled={() => true} locale="en-US" />);
    expect(screen.getByRole("grid")).toHaveAttribute("tabindex", "0");
    expect(within(screen.getByRole("grid")).getAllByRole("button").filter((button) => button.tabIndex === 0)).toHaveLength(0);
  });

  it("clamps leap day when moving by a year and keeps focus across December/January", async () => {
    const user = userEvent.setup();
    function YearGrid() {
      const [month, setMonth] = useState(new Date(2024, 1, 1));
      return <Calendar month={month} onMonthChange={setMonth} defaultValue={new Date(2024, 1, 29)} locale="en-US" />;
    }
    render(<YearGrid />);
    screen.getByRole("button", { name: "February 29, 2024" }).focus();
    await user.keyboard("{Shift>}{PageUp}{/Shift}");
    expect(screen.getByRole("button", { name: "February 28, 2023" })).toHaveFocus();
    await user.keyboard("{Shift>}{PageDown}{/Shift}");
    expect(screen.getByRole("button", { name: "February 28, 2024" })).toHaveFocus();
    await user.keyboard("{End}");
    expect(screen.getByRole("button", { name: "March 2, 2024" })).toHaveFocus();

    function YearBoundary() {
      const [month, setMonth] = useState(new Date(2025, 11, 1));
      return <Calendar month={month} onMonthChange={setMonth} defaultValue={new Date(2025, 11, 31)} locale="en-US" />;
    }
    render(<YearBoundary />);
    screen.getByRole("button", { name: "December 31, 2025" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "January 1, 2026" })).toHaveFocus();
    expect(screen.getByText("January 2026")).toBeVisible();
  });

  it("preserves native date precision, min/max, and form serialization", () => {
    const submit = vi.fn((event: React.FormEvent<HTMLFormElement>) => event.preventDefault());
    render(
      <form onSubmit={submit}>
        <DateField name="period" aria-label="Period" precision="month" defaultValue="2024-02" min="2024-01" max="2024-12" required />
        <DateField name="instant" aria-label="Instant" precision="second" defaultValue="2024-02-29T12:34:56" />
      </form>,
    );
    const month = screen.getByLabelText("Period") as HTMLInputElement;
    const instant = screen.getByLabelText("Instant") as HTMLInputElement;
    expect(month.type).toBe("month");
    expect(month.min).toBe("2024-01");
    expect(month.max).toBe("2024-12");
    expect(instant.type).toBe("datetime-local");
    expect(instant.step).toBe("1");
    expect(Array.from(new FormData(month.form ?? undefined).entries())).toEqual([
      ["period", "2024-02"],
      ["instant", instant.value],
    ]);
  });
});
