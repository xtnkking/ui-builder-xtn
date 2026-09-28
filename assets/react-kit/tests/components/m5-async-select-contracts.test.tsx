// @personal-ui-coverage {"kind":"unit","runner":"components","exports":["AsyncSelect"]}
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AsyncSelect, type AsyncSelectOption } from "../../src/personal-ui";

const unitedStates: AsyncSelectOption = { value: "us", label: "United States" };
const unitedKingdom: AsyncSelectOption = { value: "gb", label: "United Kingdom" };

describe("AsyncSelect result identity and composition", () => {
  it("does not expose stale external results and keeps the active value through reordering", () => {
    const onChange = vi.fn();
    const renderSelect = (query: string, optionsQuery: string, options: readonly AsyncSelectOption[]) => (
      <AsyncSelect
        ariaLabel="Country"
        name="country"
        options={options}
        optionsQuery={optionsQuery}
        query={query}
        onQueryChange={() => undefined}
        defaultValue="us"
        onValueChange={onChange}
      />
    );
    const { rerender } = render(renderSelect("slow", "slow", [unitedStates, unitedKingdom]));
    fireEvent.click(screen.getByRole("combobox", { name: "Country", exact: true }));
    const search = screen.getByRole("combobox", { name: "搜索Country" });
    fireEvent.keyDown(search, { key: "ArrowDown" });
    const kingdomId = screen.getByRole("option", { name: "United Kingdom" }).id;
    expect(search).toHaveAttribute("aria-activedescendant", kingdomId);

    rerender(renderSelect("fast", "slow", [unitedStates, unitedKingdom]));
    expect(within(screen.getByRole("listbox", { name: "Country" })).queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Country", exact: true })).toHaveTextContent("United States");

    rerender(renderSelect("fast", "fast", [unitedKingdom, unitedStates]));
    expect(search).toHaveAttribute("aria-activedescendant", kingdomId);
    fireEvent.keyDown(search, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("gb");
    expect(screen.queryByRole("listbox", { name: "Country" })).not.toBeInTheDocument();
  });

  it("does not select an option when Enter confirms an IME composition", () => {
    const onChange = vi.fn();
    render(<AsyncSelect ariaLabel="Country" options={[unitedStates]} defaultValue="" onValueChange={onChange} />);
    fireEvent.click(screen.getByRole("combobox", { name: "Country", exact: true }));
    const search = screen.getByRole("combobox", { name: "搜索Country" });
    fireEvent.compositionStart(search);
    fireEvent.keyDown(search, { key: "Enter" });
    expect(screen.getByRole("listbox", { name: "Country" })).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.compositionEnd(search);
    fireEvent.keyDown(search, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("us");
  });
});
