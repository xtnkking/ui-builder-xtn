// @personal-ui-coverage {"kind":"unit","runner":"components","exports":["Button","DataTable","Dialog","Drawer","Field","Input","PasswordInput","SearchInput","Tabs"]}
import { useState } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  Button,
  DataTable,
  Dialog,
  Drawer,
  Field,
  Input,
  PasswordInput,
  SearchInput,
  Tabs,
  type DataColumn,
} from "../../src/personal-ui";

describe("core component contracts", () => {
  it("keeps a loading button inert while exposing its pending label", async () => {
    const user = userEvent.setup();
    let clickCount = 0;
    const handleClick = () => { clickCount += 1; };

    render(
      <Button loading loadingLabel="正在保存" onClick={handleClick}>
        保存
      </Button>,
    );

    const button = screen.getByRole("button", { name: "正在保存" });
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveAttribute("aria-disabled", "true");

    await user.click(button);

    expect(clickCount).toBe(0);
  });

  it("connects field labels, required state, hints, and errors to the input", () => {
    const { rerender } = render(
      <Field label="邮箱" htmlFor="account-email" required hint="仅用于账户通知">
        <Input id="account-email" type="email" />
      </Field>,
    );

    const input = screen.getByLabelText(/邮箱/);
    expect(input).toBeRequired();
    expect(input).toHaveAccessibleDescription("仅用于账户通知");
    expect(input).not.toHaveAttribute("aria-invalid", "true");

    rerender(
      <Field label="邮箱" htmlFor="account-email" required error="请输入有效邮箱">
        <Input id="account-email" type="email" />
      </Field>,
    );

    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("请输入有效邮箱");
    expect(screen.getByRole("alert")).toHaveTextContent("请输入有效邮箱");
  });

  it("owns search clearing and restores focus to the search field", async () => {
    const user = userEvent.setup();

    function SearchHarness() {
      const [value, setValue] = useState("northstar");
      return (
        <SearchInput
          aria-label="搜索成员"
          value={value}
          onChange={(event) => setValue(event.currentTarget.value)}
          onClear={() => setValue("")}
        />
      );
    }

    render(<SearchHarness />);
    const input = screen.getByRole("searchbox", { name: "搜索成员" });

    await user.click(screen.getByRole("button", { name: "清除搜索" }));

    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
  });

  it("exposes one password visibility control and updates its accessible state", async () => {
    const user = userEvent.setup();

    render(
      <Field label="密码" htmlFor="account-password">
        <PasswordInput id="account-password" defaultValue="secret" />
      </Field>,
    );

    const input = screen.getByLabelText("密码");
    expect(input).toHaveAttribute("type", "password");
    expect(screen.getAllByRole("button", { name: "显示密码" })).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "显示密码" }));

    expect(input).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "隐藏密码" })).toHaveAttribute("aria-pressed", "true");
  });

  it("moves tab focus and selection with arrow keys while skipping disabled items", async () => {
    const user = userEvent.setup();

    function TabsHarness() {
      const [value, setValue] = useState("overview");
      return (
        <Tabs
          ariaLabel="账户页面"
          value={value}
          onValueChange={setValue}
          items={[
            { id: "overview", label: "概览", content: "概览内容" },
            { id: "billing", label: "账单", content: "账单内容", disabled: true },
            { id: "security", label: "安全", content: "安全内容" },
          ]}
        />
      );
    }

    render(<TabsHarness />);
    const overview = screen.getByRole("tab", { name: "概览" });
    const security = screen.getByRole("tab", { name: "安全" });

    await user.click(overview);
    await user.keyboard("{ArrowRight}");

    expect(security).toHaveFocus();
    expect(security).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel", { name: "安全" })).toHaveTextContent("安全内容");

    await user.keyboard("{Home}");
    expect(overview).toHaveFocus();
    expect(overview).toHaveAttribute("aria-selected", "true");
  });

  it("keeps the paginated table frame and pager stable while loading", async () => {
    const user = userEvent.setup();
    const pageChanges: Array<[number, "page" | "previous" | "next"]> = [];
    const handlePageChange = (page: number, trigger: "page" | "previous" | "next") => {
      pageChanges.push([page, trigger]);
    };
    type Row = { id: string; name: string };
    const columns: DataColumn<Row>[] = [
      { id: "selection", kind: "selection", header: "选择", width: 52, cell: (row) => row.id },
      { id: "name", header: "成员", minWidth: 180, cell: (row) => row.name },
      { id: "actions", header: "操作", width: 80, pin: "end", cell: () => "查看" },
    ];
    const rows = [{ id: "u-1", name: "陈沐" }];
    const pagination = { page: 1, pageCount: 2, pageSize: 5, total: 6, onPageChange: handlePageChange };
    const { container, rerender } = render(
      <DataTable
        ariaLabel="成员列表"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        pagination={pagination}
      />,
    );

    const scrollRegion = screen.getByRole("region", { name: "成员列表滚动区域" });
    const headers = screen.getAllByRole("columnheader");
    expect(headers[0]).toHaveStyle({ left: "0px" });
    expect(headers[1]).toHaveStyle({ left: "52px" });
    expect(headers[2]).toHaveStyle({ right: "0px" });
    expect(screen.getByRole("navigation", { name: "数据分页" })).toBeInTheDocument();

    rerender(
      <DataTable
        ariaLabel="成员列表"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        state="loading"
        pagination={pagination}
      />,
    );

    expect(screen.getByRole("region", { name: "成员列表滚动区域" })).toBe(scrollRegion);
    expect(screen.getByRole("table", { name: "成员列表" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "数据分页" })).toBeInTheDocument();
    expect(container.querySelectorAll("tbody tr")).toHaveLength(5);

    rerender(
      <DataTable
        ariaLabel="成员列表"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        pagination={pagination}
      />,
    );
    await user.click(screen.getByRole("button", { name: "下一页" }));
    expect(pageChanges).toEqual([[2, "next"]]);
  });

  it("preserves backdrop dismissal policy after Escape and reopening", async () => {
    const user = userEvent.setup();
    let closeCount = 0;

    function DialogHarness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <Button onClick={() => setOpen(true)}>打开设置</Button>
          <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
              if (!nextOpen) closeCount += 1;
              setOpen(nextOpen);
            }}
            closeOnBackdropClick={false}
            title="账户设置"
          >
            <Input aria-label="账户名称" />
          </Dialog>
        </>
      );
    }

    render(<DialogHarness />);
    const openButton = screen.getByRole("button", { name: "打开设置" });

    await user.click(openButton);
    await screen.findByRole("dialog", { name: "账户设置" });
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "账户设置" })).not.toBeInTheDocument());
    expect(closeCount).toBe(1);
    expect(openButton).toHaveFocus();

    await user.click(openButton);
    const reopenedDialog = await screen.findByRole("dialog", { name: "账户设置" });
    const backdrop = reopenedDialog.parentElement;
    expect(backdrop).not.toBeNull();
    fireEvent.mouseDown(backdrop!);

    expect(screen.getByRole("dialog", { name: "账户设置" })).toBeInTheDocument();
    expect(closeCount).toBe(1);

    await user.click(within(reopenedDialog).getByRole("button", { name: "关闭对话框" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "账户设置" })).not.toBeInTheDocument());
    expect(closeCount).toBe(2);
  });

  it("restores an unfocused pointer opener after closing Dialog and Drawer with Escape", async () => {
    const user = userEvent.setup();

    function OverlayHarness() {
      const [dialogOpen, setDialogOpen] = useState(false);
      const [drawerOpen, setDrawerOpen] = useState(false);
      return (
        <>
          <Button>其他操作</Button>
          <Button onClick={() => setDialogOpen(true)}>打开对话框</Button>
          <Button onClick={() => setDrawerOpen(true)}>打开抽屉</Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen} title="指针对话框">
            <Input aria-label="对话框字段" />
          </Dialog>
          <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} title="指针抽屉">
            <Input aria-label="抽屉字段" />
          </Drawer>
        </>
      );
    }

    render(<OverlayHarness />);
    const dialogOpener = screen.getByRole("button", { name: "打开对话框" });
    const drawerOpener = screen.getByRole("button", { name: "打开抽屉" });

    fireEvent.click(dialogOpener);
    expect(dialogOpener).not.toHaveFocus();
    await screen.findByRole("dialog", { name: "指针对话框" });
    await user.keyboard("{Escape}");
    await waitFor(() => expect(dialogOpener).toHaveFocus());

    fireEvent.click(drawerOpener);
    expect(drawerOpener).not.toHaveFocus();
    await screen.findByRole("dialog", { name: "指针抽屉" });
    await user.keyboard("{Escape}");
    await waitFor(() => expect(drawerOpener).toHaveFocus());
  });
});
