// @personal-ui-coverage {"kind":"unit","runner":"components","exports":["SortableList"]}
import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SortableList, type SortableItem } from "../../src/personal-ui";

const initial: SortableItem<string>[] = [{ id: "a", value: "Alpha" }, { id: "b", value: "Beta" }];

describe("SortableList contextual reordering", () => {
  it("names controls by item and position and announces an applied keyboard reorder", () => {
    function Fixture() {
      const [items, setItems] = useState(initial);
      return <SortableList items={items} onReorder={setItems} renderItem={(value) => value} getItemLabel={(item) => item.value} ariaLabel="Priority" />;
    }
    render(<Fixture />);
    const list = screen.getByRole("list", { name: "Priority" });
    fireEvent.click(screen.getByRole("button", { name: "下移 Alpha，当前第 1 项，共 2 项" }));
    expect(within(list).getAllByRole("listitem").map((item) => item.textContent)).toEqual(expect.arrayContaining([expect.stringContaining("Beta"), expect.stringContaining("Alpha")]));
    expect(within(list).getAllByRole("listitem")[0]).toHaveTextContent("Beta");
    expect(screen.getByRole("status")).toHaveTextContent("Alpha 已移动到第 2 项");
  });

  it("keeps both drag and keyboard reordering inert when disabled", () => {
    const onReorder = vi.fn();
    render(<SortableList items={initial} onReorder={onReorder} renderItem={(value) => value} ariaLabel="Priority" disabled />);
    expect(screen.getByRole("button", { name: /下移 a/ })).toBeDisabled();
    const rows = screen.getAllByRole("listitem");
    fireEvent.dragStart(rows[0]);
    fireEvent.drop(rows[1]);
    expect(onReorder).not.toHaveBeenCalled();
  });
});
