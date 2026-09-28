// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"app-navigation/overview","exports":["AppNavigation","TopNavigation","SideNavigation","BottomNavigation"]}
import { useState } from "react";
import { AppNavigation, BottomNavigation, SideNavigation, TopNavigation } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const baseItems = [
  { id: "overview", label: "概览" },
  { id: "projects", label: "项目" },
  { id: "reports", label: "报表" },
  { id: "billing", label: "账单", disabled: true },
];

function AppNavigationExample() {
  const [active, setActive] = useState("overview");
  const items = baseItems.map((item) => ({ ...item, active: item.id === active, onSelect: () => setActive(item.id) }));
  return (
    <div className="demo-number-case__grid">
      <AppNavigation ariaLabel="应用导航" brand="Northstar" variant="top" items={items} />
      <TopNavigation ariaLabel="顶部导航" brand="Workspace" items={items} />
      <SideNavigation ariaLabel="侧边导航" items={items} />
      <BottomNavigation ariaLabel="底部导航" items={items.slice(0, 3)} />
    </div>
  );
}

const explorerCase = {
  id: "app-navigation/overview",
  label: "应用导航变体",
  summary: "相同数据模型驱动自动、顶部、侧边和底部导航，并保持当前项宽度稳定。",
  states: ["default", "disabled", "longContent", "keyboard", "dark", "locale"] as const,
  content: <AppNavigationExample />,
  code: `<AppNavigation ariaLabel="应用导航" variant="side" items={items} />\n<TopNavigation ariaLabel="顶部导航" items={items} />\n<SideNavigation ariaLabel="侧边导航" items={items} />\n<BottomNavigation ariaLabel="底部导航" items={items} />`,
} satisfies ExplorerCase;

export default explorerCase;
