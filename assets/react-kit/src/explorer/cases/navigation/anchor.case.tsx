// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"anchor/overview","exports":["AnchorNavigation"]}
import { useState } from "react";
import { AnchorNavigation } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

function AnchorExample() {
  const [activeId, setActiveId] = useState("summary");
  return <AnchorNavigation ariaLabel="本页目录" activeId={activeId} onNavigate={setActiveId} items={[{ id: "summary", label: "概览", href: "#explorer-anchor-summary" }, { id: "permissions", label: "权限与安全设置", href: "#explorer-anchor-permissions" }, { id: "history", label: "变更记录", href: "#explorer-anchor-history" }]} />;
}

const explorerCase = {
  id: "anchor/overview",
  label: "页内锚点导航",
  summary: "展示当前章节、长标题以及调用方拥有的滚动/路由同步。",
  states: ["default", "disabled", "longContent", "keyboard", "dark", "locale"] as const,
  content: <AnchorExample />,
  code: `<AnchorNavigation activeId={activeId} onNavigate={setActiveId} items={sections} />`,
} satisfies ExplorerCase;

export default explorerCase;
