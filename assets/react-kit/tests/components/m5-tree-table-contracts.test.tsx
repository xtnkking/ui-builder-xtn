// @personal-ui-coverage {"kind":"unit","runner":"components","exports":["TreeTable"]}
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TreeTable } from "../../src/personal-ui";

const nodes = [{ id: "team", value: { name: "Team" }, hasChildren: true }];
const columns = [{ id: "name", header: "Name", cell: (value: { name: string }) => value.name }];

describe("TreeTable disclosure table", () => {
  it("uses table semantics and surfaces lazy-loading failures without expanding", async () => {
    const request = vi.fn().mockRejectedValueOnce(new Error("Offline")).mockResolvedValueOnce(undefined);
    render(<TreeTable nodes={nodes} columns={columns} treeColumnId="name" ariaLabel="Teams" getRowLabel={(node) => node.value.name} onRequestChildren={request} />);
    expect(screen.getByRole("table", { name: "Teams" })).toBeInTheDocument();
    expect(screen.queryByRole("treegrid")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "展开 Team" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("加载失败，请重试");
    expect(screen.getByRole("button", { name: "重试加载 Team" })).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(screen.getByRole("button", { name: "重试加载 Team" }));
    expect(await screen.findByRole("button", { name: "折叠 Team" })).toHaveAttribute("aria-expanded", "true");
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("does not advertise lazy expansion for leaves without hasChildren", () => {
    render(<TreeTable nodes={[{ id: "leaf", value: { name: "Leaf" } }]} columns={columns} treeColumnId="name" ariaLabel="Teams" onRequestChildren={() => undefined} />);
    expect(screen.queryByRole("button", { name: /Leaf/ })).not.toBeInTheDocument();
  });
});
