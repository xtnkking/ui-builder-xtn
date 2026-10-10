// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"menu/overview","exports":["Menu","DropdownMenu","ContextMenu"]}
import { ContextMenu, DropdownMenu, Menu, Stack, type MenuItem } from "../../../personal-ui";
import { StatePreview } from "../state-preview";
import type { ExplorerCase } from "../types";

const menuItems: MenuItem[] = [
  { id: "open", label: "打开", onSelect: () => window.alert("打开记录") },
  { id: "duplicate", label: "创建副本", onSelect: () => undefined },
  { id: "archive", label: "归档", onSelect: () => undefined, disabled: true },
];
const longItems: MenuItem[] = [{ id: "long", label: "保存当前成员在全部产品中的角色配置、数据访问权限、通知偏好和账户安全设置", onSelect: () => undefined }];
function MenuExample() {
  return <Stack gap="large" align="start">
    <Menu ariaLabel="导航菜单" items={menuItems} />
    <DropdownMenu label="更多操作" ariaLabel="下拉菜单" items={menuItems} />
    <ContextMenu ariaLabel="记录菜单" items={menuItems}><p>右键或 Shift+F10 打开菜单。</p></ContextMenu>
  </Stack>;
}
function EmptyMenuExample() {
  return <Stack gap="large" align="start">
    <Menu ariaLabel="空导航" items={[]} />
    <DropdownMenu label="空操作组" ariaLabel="空下拉菜单" items={[]} />
    <ContextMenu ariaLabel="空右键菜单" items={[]}><p>没有可用操作。</p></ContextMenu>
  </Stack>;
}
function LongMenuExample() {
  return <Stack gap="large" align="start">
    <Menu ariaLabel="长导航" items={longItems} />
    <DropdownMenu label="查看长操作" ariaLabel="长下拉菜单" items={longItems} />
    <ContextMenu ariaLabel="长右键菜单" items={longItems}><p>右键查看长操作名称。</p></ContextMenu>
  </Stack>;
}
function LocaleMenuExample() {
  return <Stack gap="large" align="start">
    <Menu ariaLabel="Navigation" items={[{ id: "home", label: "Home" }]} />
    <DropdownMenu label="Actions" ariaLabel="Actions" items={[{ id: "open", label: "Open", onSelect: () => undefined }]} />
    <ContextMenu ariaLabel="Record actions" items={[{ id: "open", label: "Open", onSelect: () => undefined }]}><p>Right-click this record.</p></ContextMenu>
  </Stack>;
}
const explorerCase = {
  id: "menu/overview", label: "导航、下拉与右键菜单", summary: "逐项演示菜单数据；DropdownMenu 与 ContextMenu 内部维护开关，没有 open/defaultOpen 或表单校验接口。",
  states: ["default", "disabled", "empty", "longContent", "keyboard", "overlay", "dark", "locale"],
  content: <MenuExample />,
  stateExamples: [
    { state: "default", exports: ["Menu", "DropdownMenu", "ContextMenu"], content: <MenuExample /> },
    { state: "disabled", exports: ["Menu", "DropdownMenu", "ContextMenu"], instructions: "打开菜单后“归档”不可激活；其他项保持可用。", content: <MenuExample /> },
    { state: "empty", exports: ["Menu", "DropdownMenu", "ContextMenu"], instructions: "空数组不会自动生成空态消息；下拉和右键触发入口仍由各组件维护。", content: <EmptyMenuExample /> },
    { state: "longContent", exports: ["Menu", "DropdownMenu", "ContextMenu"], content: <LongMenuExample /> },
    { state: "keyboard", exports: ["Menu", "DropdownMenu", "ContextMenu"], instructions: "Tab 访问菜单；下拉用 Enter/方向键打开，右键菜单用 Shift+F10；打开后方向键移动、Esc 关闭并返回触发入口。", content: <MenuExample /> },
    { state: "overlay", exports: ["DropdownMenu", "ContextMenu"], content: <StatePreview state="overlay"><MenuExample /></StatePreview> },
    { state: "dark", exports: ["Menu", "DropdownMenu", "ContextMenu"], content: <StatePreview state="dark"><MenuExample /></StatePreview> },
    { state: "locale", exports: ["Menu", "DropdownMenu", "ContextMenu"], content: <StatePreview state="locale"><LocaleMenuExample /></StatePreview> },
  ],
  code: '<Menu items={navigationItems} ariaLabel="导航" />\n<DropdownMenu label="更多操作" items={menuItems} ariaLabel="更多操作" />\n<ContextMenu items={menuItems} ariaLabel="右键操作"><Record /></ContextMenu>',
} satisfies ExplorerCase;
export default explorerCase;
