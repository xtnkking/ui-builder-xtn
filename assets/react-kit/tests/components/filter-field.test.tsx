// @ui-coverage {"kind":"unit","runner":"components","exports":["FilterField","FilterBar"]}
import { createElement, useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Button, Field, FilterBar, FilterField, SearchInput, type FilterFieldProps } from "../../src/ui";

describe("FilterField sizing contract", () => {
  it.each([
    [undefined, "240px"],
    ["short", "140px"],
    ["medium", "240px"],
    ["long", "320px"],
    [420, "420px"],
    [187.5, "187.5px"],
    [0, "240px"],
    [-20, "240px"],
    [Number.NaN, "240px"],
    [Number.POSITIVE_INFINITY, "240px"],
  ] as const)("normalizes preferred width %s without exposing it as a DOM width", (width, expected) => {
    render(<FilterField width={width} data-testid="filter-field"><span>内容</span></FilterField>);
    const field = screen.getByTestId("filter-field");
    expect(field.style.getPropertyValue("--_ui-filter-field-width")).toBe(expected);
    expect(field).not.toHaveAttribute("width");
    expect(field).toHaveAttribute("data-ui-owner", "FilterField");
  });

  it("protects geometry and ownership while retaining public metadata and events", () => {
    const onMouseEnter = vi.fn();
    const props = {
      width: "short",
      className: "foreign-filter",
      style: { width: "9000px", "--_ui-filter-field-width": "9000px" },
      css: "foreign-css",
      sx: "foreign-sx",
      tw: "w-full",
      dangerouslySetInnerHTML: { __html: "<b>unsafe</b>" },
      "data-ui-owner": "Consumer",
      "data-ui-slot": "foreign",
      "data-testid": "protected-field",
      "data-track": "filter",
      "aria-describedby": "filter-help",
      onMouseEnter,
      children: <span>安全内容</span>,
    };
    render(createElement(FilterField, props as unknown as FilterFieldProps));
    const field = screen.getByTestId("protected-field");
    expect(field).toHaveClass("ui-filter-field");
    expect(field).not.toHaveClass("foreign-filter");
    expect(field.style.width).toBe("");
    expect(field.style.getPropertyValue("--_ui-filter-field-width")).toBe("140px");
    for (const name of ["css", "sx", "tw", "data-ui-slot"]) expect(field).not.toHaveAttribute(name);
    expect(field).toHaveAttribute("data-ui-owner", "FilterField");
    expect(field).toHaveAttribute("data-track", "filter");
    expect(field).toHaveAttribute("aria-describedby", "filter-help");
    expect(field).toHaveTextContent("安全内容");
    expect(field).not.toHaveTextContent("unsafe");
    fireEvent.mouseEnter(field);
    expect(onMouseEnter).toHaveBeenCalledTimes(1);
  });

  it("preserves real Field labels, hints, FormData and explicit submit inside FilterBar", () => {
    const submissions: Array<FormDataEntryValue | null> = [];
    function Filters() {
      const [task, setTask] = useState("");
      return <FilterBar ariaLabel="任务筛选" onSubmit={(event) => {
        event.preventDefault();
        submissions.push(new FormData(event.currentTarget).get("task"));
      }} actions={<Button type="submit">查询</Button>}>
        <FilterField width={260}>
          <Field htmlFor="task" label="任务编号" hint="输入完整编号后查询">
            <SearchInput id="task" name="task" value={task} onChange={(event) => setTask(event.target.value)} placeholder="输入任务编号" />
          </Field>
        </FilterField>
      </FilterBar>;
    }
    render(<Filters />);
    const input = screen.getByRole("searchbox", { name: "任务编号" });
    expect(input).toHaveAccessibleDescription("输入完整编号后查询");
    fireEvent.change(input, { target: { value: "TASK-2026" } });
    expect(submissions).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "查询" }));
    expect(submissions).toEqual(["TASK-2026"]);
    expect(input.closest("[data-ui-owner='FilterField']")?.parentElement).toHaveClass("ui-filter-bar__fields");
  });
});
