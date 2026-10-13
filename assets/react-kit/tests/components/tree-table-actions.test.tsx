// @ui-coverage {"kind":"unit","runner":"components","exports":["TreeTable"]}
import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button, TreeTable, type TreeTableColumn, type TreeTableNode } from "../../src/ui";

interface Entry { name: string }
const columns: TreeTableColumn<Entry>[] = [{ id: "name", header: "名称", cell: (value) => value.name }];
const nodes: TreeTableNode<Entry>[] = [
  { id: "root", value: { name: "根目录" }, children: [
    { id: "nested", value: { name: "子目录" }, children: [{ id: "leaf", value: { name: "文件" } }] },
    { id: "sibling", value: { name: "同级文件" } },
  ] },
  { id: "other", value: { name: "另一个根目录" }, hasChildren: true, children: [] },
];

describe("TreeTable action regions", () => {
  it("places each expanded branch action after all its descendants and removes it on collapse", () => {
    render(<TreeTable nodes={nodes} columns={columns} treeColumnId="name" ariaLabel="目录"
      getRowLabel={(node) => node.value.name} defaultExpandedIds={["root", "nested"]}
      renderBranchFooter={({ node }) => <Button>{`新增到 ${node.value.name}`}</Button>} />);
    const table = screen.getByRole("table", { name: "目录" });
    const rows = within(table).getAllByRole("row");
    expect(rows).toHaveLength(8);
    expect(rows[3]).toHaveTextContent("文件");
    expect(within(rows[4]).getByRole("button", { name: "新增到 子目录" })).toBeInTheDocument();
    expect(rows[5]).toHaveTextContent("同级文件");
    expect(within(rows[6]).getByRole("button", { name: "新增到 根目录" })).toBeInTheDocument();
    expect(rows[7]).toHaveTextContent("另一个根目录");
    fireEvent.click(screen.getByRole("button", { name: "折叠 根目录" }));
    expect(screen.queryByRole("button", { name: "新增到 根目录" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "新增到 子目录" })).not.toBeInTheDocument();
    expect(within(table).getAllByRole("row")).toHaveLength(3);
  });

  it("provides stable node identity and depth to row actions without pretending action rows are data", () => {
    const operate = vi.fn();
    const actions: TreeTableColumn<Entry>[] = [...columns, {
      id: "actions", header: "操作", cell: (_, { node, level }) => (
        <Button aria-label={`编辑 ${node.value.name}`} onClick={() => operate(node.id, level)}>编辑</Button>
      ),
    }];
    render(<TreeTable nodes={nodes} columns={actions} treeColumnId="name" ariaLabel="目录"
      defaultExpandedIds={["root", "nested"]} renderBranchFooter={() => null} />);
    fireEvent.click(screen.getByRole("button", { name: "编辑 文件" }));
    expect(operate).toHaveBeenCalledWith("leaf", 3);
    expect(screen.getAllByRole("row")).toHaveLength(6);
    expect(screen.getAllByRole("button", { name: /^编辑 / })).toHaveLength(5);
  });

  it("supports adding the first child to an explicitly empty branch without a loader", async () => {
    function EmptyBranch() {
      const [items, setItems] = useState<TreeTableNode<Entry>[]>([{ id: "empty", value: { name: "空目录" }, hasChildren: true, children: [] }]);
      return <TreeTable nodes={items} columns={columns} treeColumnId="name" ariaLabel="目录"
        getRowLabel={(node) => node.value.name} renderBranchFooter={({ node }) => (
          <Button onClick={() => setItems((current) => current.map((item) => item.id === node.id
            ? { ...item, children: [{ id: "new", value: { name: "新增文件" } }] } : item))}>新增子项</Button>
        )} />;
    }
    const user = userEvent.setup();
    render(<EmptyBranch />);
    expect(screen.queryByRole("button", { name: "新增子项" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "展开 空目录" }));
    await user.click(screen.getByRole("button", { name: "新增子项" }));
    expect(screen.getByRole("cell", { name: "新增文件" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "折叠 空目录" })).toHaveAttribute("aria-expanded", "true");
  });

  it("keeps table-level commands outside the scroll region, including the empty state", async () => {
    const create = vi.fn();
    const user = userEvent.setup();
    render(<TreeTable nodes={[]} columns={columns} treeColumnId="name" ariaLabel="目录"
      toolbar={<Button onClick={create}>新增根目录</Button>} footer={<span>共 0 项</span>} />);
    const viewport = screen.getByRole("region", { name: "目录" });
    expect(within(viewport).getByRole("table", { name: "目录" })).toBeInTheDocument();
    expect(within(viewport).queryByRole("button", { name: "新增根目录" })).not.toBeInTheDocument();
    expect(within(viewport).queryByText("共 0 项")).not.toBeInTheDocument();
    await user.tab();
    expect(screen.getByRole("button", { name: "新增根目录" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(create).toHaveBeenCalledTimes(1);
    await user.tab();
    expect(viewport).toHaveFocus();
    expect(within(viewport).getByText("暂无数据")).toBeInTheDocument();
  });

  it("does not reload an already loaded empty directory or create empty optional regions", async () => {
    const request = vi.fn();
    const { container } = render(<TreeTable nodes={[nodes[1]]} columns={columns} treeColumnId="name" ariaLabel="目录"
      getRowLabel={(node) => node.value.name} onRequestChildren={request}
      toolbar={false} footer={null} renderBranchFooter={() => false} />);
    fireEvent.click(screen.getByRole("button", { name: "展开 另一个根目录" }));
    expect(await screen.findByRole("button", { name: "折叠 另一个根目录" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "折叠 另一个根目录" }));
    fireEvent.click(screen.getByRole("button", { name: "展开 另一个根目录" }));
    expect(request).not.toHaveBeenCalled();
    expect(screen.getAllByRole("row")).toHaveLength(2);
    expect(container.querySelector(".ui-tree-table__toolbar, .ui-tree-table__footer, .ui-tree-table__branch-footer")).toBeNull();
  });
});
