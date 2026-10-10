// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"app-navigation/overview","exports":["AppNavigation","TopNavigation","SideNavigation","BottomNavigation"]}
import { AppNavigation, BottomNavigation, SideNavigation, Stack, TopNavigation, type NavigationItem } from "../../../personal-ui";
import { StatePreview } from "../state-preview";
import type { ExplorerCase } from "../types";

const items: NavigationItem[] = [{ id: "home", label: "概览", active: true, onSelect: () => window.alert("当前页") }, { id: "projects", label: "项目", onSelect: () => window.alert("项目") }, { id: "billing", label: "账单", disabled: true }];
const longItems: NavigationItem[] = [{ id: "long", label: "跨区域基础设施迁移项目的全部成员权限与安全策略审核记录及发布检查", onSelect: () => undefined }];

function NavigationExample() {
  return <Stack gap="large">
    <AppNavigation ariaLabel="应用导航" brand="Northstar" variant="top" items={items} />
    <TopNavigation ariaLabel="顶部导航" brand="Workspace" items={items} />
    <div style={{ maxWidth: 280 }}><SideNavigation ariaLabel="侧边导航" items={items} /></div>
    <BottomNavigation ariaLabel="底部导航" items={items} />
  </Stack>;
}

function EmptyNavigationExample() {
  return <Stack gap="large">
    <AppNavigation ariaLabel="空应用导航" brand="Northstar" variant="top" items={[]} />
    <TopNavigation ariaLabel="空顶部导航" brand="Workspace" items={[]} />
    <div style={{ maxWidth: 280 }}><SideNavigation ariaLabel="空侧边导航" items={[]} /></div>
    <BottomNavigation ariaLabel="空底部导航" items={[]} />
  </Stack>;
}

function LongNavigationExample() {
  return <Stack gap="large">
    <AppNavigation ariaLabel="长应用导航" brand="Northstar" variant="top" items={longItems} />
    <TopNavigation ariaLabel="长顶部导航" brand="Workspace" items={longItems} />
    <div style={{ maxWidth: 280 }}><SideNavigation ariaLabel="长侧边导航" items={longItems} /></div>
    <BottomNavigation ariaLabel="长底部导航" items={longItems} />
  </Stack>;
}

function LocaleNavigationExample() {
  return <Stack gap="large">
    <AppNavigation ariaLabel="App navigation" brand="Northstar" variant="top" items={[{ id: "home", label: "Home" }]} />
    <TopNavigation ariaLabel="Top navigation" brand="Workspace" items={[{ id: "home", label: "Home" }]} />
    <div style={{ maxWidth: 280 }}><SideNavigation ariaLabel="Side navigation" items={[{ id: "home", label: "Home" }]} /></div>
    <BottomNavigation ariaLabel="Bottom navigation" items={[{ id: "home", label: "Home" }]} />
  </Stack>;
}
const explorerCase = {
  id: "app-navigation/overview", label: "应用导航变体", summary: "四个公开导出分别展示禁用项、空数据、长名称及窄屏；active/onSelect 由调用方的数据维护。",
  states: ["default", "disabled", "empty", "longContent", "keyboard", "mobile", "dark", "locale"],
  content: <NavigationExample />,
  stateExamples: [
    { state: "default", exports: ["AppNavigation", "TopNavigation", "SideNavigation", "BottomNavigation"], content: <NavigationExample /> },
    { state: "disabled", exports: ["AppNavigation", "TopNavigation", "SideNavigation", "BottomNavigation"], instructions: "四种导航的“账单”均禁用；Tab 不进入禁用按钮。", content: <NavigationExample /> },
    { state: "empty", exports: ["AppNavigation", "TopNavigation", "SideNavigation", "BottomNavigation"], instructions: "空数据只保留导航框架，不创建占位菜单。", content: <EmptyNavigationExample /> },
    { state: "longContent", exports: ["AppNavigation", "TopNavigation", "SideNavigation", "BottomNavigation"], content: <LongNavigationExample /> },
    { state: "keyboard", exports: ["AppNavigation", "TopNavigation", "SideNavigation", "BottomNavigation"], instructions: "Tab 访问各导航的可用项；Enter/Space 触发按钮，禁用项不可访问。", content: <NavigationExample /> },
    { state: "mobile", exports: ["AppNavigation", "TopNavigation", "SideNavigation", "BottomNavigation"], content: <StatePreview state="mobile"><NavigationExample /></StatePreview> },
    { state: "dark", exports: ["AppNavigation", "TopNavigation", "SideNavigation", "BottomNavigation"], content: <StatePreview state="dark"><NavigationExample /></StatePreview> },
    { state: "locale", exports: ["AppNavigation", "TopNavigation", "SideNavigation", "BottomNavigation"], content: <StatePreview state="locale"><LocaleNavigationExample /></StatePreview> },
  ],
  code: '<AppNavigation variant="side" items={items} ariaLabel="应用导航" />\n<TopNavigation items={items} ariaLabel="顶部导航" />\n<SideNavigation items={items} ariaLabel="侧边导航" />\n<BottomNavigation items={items} ariaLabel="底部导航" />',
} satisfies ExplorerCase;
export default explorerCase;
