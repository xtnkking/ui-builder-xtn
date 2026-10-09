// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"app-navigation/overview","exports":["AppNavigation","TopNavigation","SideNavigation","BottomNavigation"]}
import { AppNavigation, BottomNavigation, SideNavigation, TopNavigation } from "../../../personal-ui";
import { StatePreview } from "../state-preview";
import type { ExplorerCase } from "../types";

const items = [{ id: "home", label: "概览", active: true, onSelect: () => window.alert("当前页") }, { id: "projects", label: "项目", onSelect: () => window.alert("项目") }, { id: "billing", label: "账单", disabled: true }];
const longItems = [{ id: "long", label: "跨区域基础设施迁移项目的全部成员权限与安全策略审核记录及发布检查", onSelect: () => undefined }];
function NavigationExample() {
  return <div className="demo-number-case__grid"><AppNavigation ariaLabel="应用导航" brand="Northstar" variant="top" items={items} /><TopNavigation ariaLabel="顶部导航" brand="Workspace" items={items} /><SideNavigation ariaLabel="侧边导航" items={items} /><BottomNavigation ariaLabel="底部导航" items={items} /></div>;
}
function LongNavigation() {
  return <div className="demo-number-case__grid"><AppNavigation ariaLabel="长应用导航" variant="side" items={longItems} /><TopNavigation ariaLabel="长顶部导航" items={longItems} /><SideNavigation ariaLabel="长侧边导航" items={longItems} /><BottomNavigation ariaLabel="长底部导航" items={longItems} /></div>;
}
const explorerCase = {
  id: "app-navigation/overview", label: "应用导航变体", summary: "四个公开导出分别展示禁用项、空数据、长名称及窄屏；active/onSelect 由调用方的数据维护。",
  states: ["default", "disabled", "empty", "longContent", "keyboard", "mobile", "dark", "locale"],
  content: <NavigationExample />,
  stateExamples: [
    { state: "default", exports: ["AppNavigation", "TopNavigation", "SideNavigation", "BottomNavigation"], content: <NavigationExample /> },
    { state: "disabled", exports: ["AppNavigation", "TopNavigation", "SideNavigation", "BottomNavigation"], instructions: "四种导航的“账单”均禁用；Tab 不进入禁用按钮。", content: <NavigationExample /> },
    { state: "empty", exports: ["AppNavigation", "TopNavigation", "SideNavigation", "BottomNavigation"], instructions: "空数据只保留导航框架，不创建占位菜单。", content: <div className="demo-number-case__grid"><AppNavigation ariaLabel="空应用导航" items={[]} /><TopNavigation ariaLabel="空顶部导航" items={[]} /><SideNavigation ariaLabel="空侧边导航" items={[]} /><BottomNavigation ariaLabel="空底部导航" items={[]} /></div> },
    { state: "longContent", exports: ["AppNavigation", "TopNavigation", "SideNavigation", "BottomNavigation"], content: <LongNavigation /> },
    { state: "keyboard", exports: ["AppNavigation", "TopNavigation", "SideNavigation", "BottomNavigation"], instructions: "Tab 访问各导航的可用项；Enter/Space 触发按钮，禁用项不可访问。", content: <NavigationExample /> },
    { state: "mobile", exports: ["AppNavigation", "TopNavigation", "SideNavigation", "BottomNavigation"], content: <StatePreview state="mobile"><NavigationExample /></StatePreview> },
    { state: "dark", exports: ["AppNavigation", "TopNavigation", "SideNavigation", "BottomNavigation"], content: <StatePreview state="dark"><NavigationExample /></StatePreview> },
    { state: "locale", exports: ["AppNavigation", "TopNavigation", "SideNavigation", "BottomNavigation"], content: <StatePreview state="locale"><AppNavigation ariaLabel="App navigation" items={[{ id: "home", label: "Home" }]} /><TopNavigation ariaLabel="Top navigation" items={[{ id: "home", label: "Home" }]} /><SideNavigation ariaLabel="Side navigation" items={[{ id: "home", label: "Home" }]} /><BottomNavigation ariaLabel="Bottom navigation" items={[{ id: "home", label: "Home" }]} /></StatePreview> },
  ],
  code: '<AppNavigation variant="side" items={items} ariaLabel="应用导航" />\n<TopNavigation items={items} ariaLabel="顶部导航" />\n<SideNavigation items={items} ariaLabel="侧边导航" />\n<BottomNavigation items={items} ariaLabel="底部导航" />',
} satisfies ExplorerCase;
export default explorerCase;
