// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"menu/overview","exports":["Menu","DropdownMenu","ContextMenu"]}
import { MoreHorizontal } from "lucide-react";
import { ContextMenu, DropdownMenu, Menu } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const menuItems = [
  { id: "open", label: "打开", onSelect: () => undefined },
  { id: "duplicate", label: "创建副本", onSelect: () => undefined },
  { id: "archive", label: "归档", onSelect: () => undefined, disabled: true },
  { id: "delete", label: "删除", onSelect: () => undefined, danger: true },
];

const explorerCase = {
  id: "menu/overview",
  label: "导航、下拉与右键菜单",
  summary: "覆盖稳定的菜单数据、禁用和危险项、方向键、typeahead 以及右键/键盘打开。",
  states: ["default", "disabled", "readOnly", "controlled", "uncontrolled", "validation", "longContent", "keyboard", "overlay", "dark", "locale"] as const,
  content: (
    <div className="demo-number-case__grid">
      <Menu ariaLabel="页面菜单" items={[{ id: "overview", label: "概览", active: true }, { id: "members", label: "成员" }, { id: "settings", label: "设置", disabled: true }]} />
      <DropdownMenu label="更多操作" ariaLabel="更多操作菜单" icon={<MoreHorizontal aria-hidden="true" />} items={menuItems} />
      <ContextMenu ariaLabel="记录右键菜单" items={menuItems}><p>右键或按 Shift+F10 打开记录菜单。</p></ContextMenu>
    </div>
  ),
  code: `<Menu ariaLabel="页面菜单" items={navigationItems} />\n<DropdownMenu label="更多操作" ariaLabel="更多操作菜单" items={menuItems} />\n<ContextMenu ariaLabel="记录菜单" items={menuItems}><Record /></ContextMenu>`,
} satisfies ExplorerCase;

export default explorerCase;
