// @ui-coverage {"kind":"unit","runner":"components","exports":["TableCellText","DataTable","TreeTable"]}
import { createElement } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Button, DataTable, TableCellText, Tag, TreeTable, type TableCellTextProps } from "../../src/ui";

describe("TableCellText and table typography ownership", () => {
  it("preserves zero in both primary and supporting text without accidental emphasis", () => {
    const { container } = render(<TableCellText secondary={0}>{0}</TableCellText>);
    const owner = container.querySelector('[data-ui-owner="TableCellText"]');
    expect(owner).toHaveClass("ui-table-cell-text");
    expect(owner).not.toHaveClass("ui-table-cell-text--numeric", "ui-table-cell-text--emphasis", "ui-table-cell-text--wrap");
    expect(within(owner as HTMLElement).getAllByText("0")).toHaveLength(2);
    expect(owner?.querySelector(".ui-table-cell-text__primary")).toHaveAttribute("title", "0");
    expect(owner?.querySelector(".ui-table-cell-text__secondary")).toHaveAttribute("title", "0");
  });

  it("retains complete unformatted business identifiers with explicit numeric and emphasis options", () => {
    const identifier = "00026090817113818751879";
    const { container } = render(<TableCellText numeric emphasis secondary="原始业务编号">{identifier}</TableCellText>);
    const primary = screen.getByText(identifier);
    expect(primary).toHaveAttribute("title", identifier);
    expect(primary.parentElement).toHaveClass("ui-table-cell-text--numeric", "ui-table-cell-text--emphasis");
    expect(screen.getByText("原始业务编号")).toHaveAttribute("title", "原始业务编号");
    expect(container.querySelector("code, strong, small")).toBeNull();
  });

  it("offers explicit wrapping while keeping full primary and supporting text available", () => {
    const primary = "没有空格的长内容".repeat(20);
    const secondary = "VeryLongUnbrokenSupportingValue".repeat(10);
    const { container } = render(<TableCellText secondary={secondary} wrap>{primary}</TableCellText>);
    expect(container.firstElementChild).toHaveClass("ui-table-cell-text--wrap");
    expect(screen.getByText(primary)).toHaveAttribute("title", primary);
    expect(screen.getByText(secondary)).toHaveAttribute("title", secondary);
  });

  it("does not forward runtime styling, identity, HTML or event escape props", () => {
    const onClick = vi.fn();
    const rawProps = {
      children: "原始数据",
      className: "foreign",
      style: { fontSize: 40 },
      css: "foreign",
      sx: "foreign",
      tw: "foreign",
      dangerouslySetInnerHTML: { __html: "<b>Injected</b>" },
      "data-ui-owner": "Consumer",
      "data-ui-private": "foreign",
      title: "Truncated consumer title",
      onClick,
    };
    const { container } = render(createElement(TableCellText, rawProps as unknown as TableCellTextProps));
    const owner = container.firstElementChild as HTMLElement;
    expect(owner).toHaveAttribute("data-ui-owner", "TableCellText");
    expect(owner).not.toHaveClass("foreign");
    for (const attribute of ["style", "css", "sx", "tw", "data-ui-private", "title"]) {
      expect(owner).not.toHaveAttribute(attribute);
    }
    expect(owner).not.toHaveTextContent("Injected");
    fireEvent.click(owner);
    expect(onClick).not.toHaveBeenCalled();
    expect(screen.getByText("原始数据")).toHaveAttribute("title", "原始数据");
  });

  it("automatically adapts primitive table data and leaves composed controls and semantic content intact", () => {
    const onDetails = vi.fn();
    render(<DataTable ariaLabel="任务" rows={[{ id: "00001001", count: 0 }]} rowKey={(row) => row.id}
      columns={[
        { id: "id", header: "编号", cell: (row) => row.id },
        { id: "count", header: "次数", cell: (row) => row.count },
        { id: "status", header: "状态", cell: () => <Tag>排队中</Tag> },
        { id: "note", header: "说明", cell: () => <><strong>业务强调</strong><small>辅助内容</small></> },
        { id: "action", header: "操作", cell: () => <Button onClick={onDetails}>详情</Button> },
      ]} />);
    const table = screen.getByRole("table", { name: "任务" });
    expect(table.querySelectorAll('[data-ui-owner="TableCellText"]')).toHaveLength(2);
    expect(screen.getByText("00001001").closest('[data-ui-owner="TableCellText"]')).toBeInTheDocument();
    expect(screen.getByText("0").closest('[data-ui-owner="TableCellText"]')).toBeInTheDocument();
    expect(screen.getByText("排队中").closest('[data-ui-owner="TableCellText"]')).toBeNull();
    expect(screen.getByText("业务强调").tagName).toBe("STRONG");
    expect(screen.getByText("辅助内容").tagName).toBe("SMALL");
    fireEvent.click(screen.getByRole("button", { name: "详情" }));
    expect(onDetails).toHaveBeenCalledTimes(1);
  });

  it("adapts text in both tree and other columns while preserving disclosure and row actions", () => {
    const onEdit = vi.fn();
    render(<TreeTable ariaLabel="项目成员" treeColumnId="name"
      getRowLabel={(node) => node.value.name}
      nodes={[{ id: "project", value: { name: "项目", count: 0 }, children: [{ id: "member", value: { name: "成员", count: 1 } }] }]}
      columns={[
        { id: "name", header: "名称", cell: (value) => value.name },
        { id: "count", header: "人数", cell: (value) => value.count },
        { id: "action", header: "操作", cell: (_, { node }) => <Button onClick={() => onEdit(node.id)}>编辑 {node.value.name}</Button> },
      ]} />);
    const table = screen.getByRole("table", { name: "项目成员" });
    expect(table.querySelectorAll('[data-ui-owner="TableCellText"]')).toHaveLength(2);
    const disclosure = screen.getByRole("button", { name: "展开 项目" });
    disclosure.focus();
    fireEvent.click(disclosure);
    expect(screen.getByRole("button", { name: "折叠 项目" })).toHaveFocus();
    expect(table.querySelectorAll('[data-ui-owner="TableCellText"]')).toHaveLength(4);
    expect(screen.getByRole("cell", { name: "成员" })).toHaveTextContent("成员");
    fireEvent.click(screen.getByRole("button", { name: "编辑 成员" }));
    expect(onEdit).toHaveBeenCalledWith("member");
  });
});
