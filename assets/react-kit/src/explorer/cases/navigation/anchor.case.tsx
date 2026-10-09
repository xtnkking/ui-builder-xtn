// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"anchor/overview","exports":["AnchorNavigation"]}
import { useState } from "react";
import { AnchorNavigation } from "../../../personal-ui";
import { StatePreview } from "../state-preview";
import type { ExplorerCase } from "../types";

function AnchorExample() {
  const [activeId, setActiveId] = useState("summary");
  return <div onClickCapture={(event) => {
    const target = event.target;
    if (target instanceof Element && target.closest('a[href^="#explorer-anchor-"]')) event.preventDefault();
  }}>
    <AnchorNavigation ariaLabel="本例目录" activeId={activeId} onNavigate={(id) => { setActiveId(id); document.getElementById("explorer-anchor-" + id)?.scrollIntoView({ block: "nearest" }); }} items={[{ id: "summary", label: "概览", href: "#explorer-anchor-summary" }, { id: "permissions", label: "权限与安全", href: "#explorer-anchor-permissions" }]} />
    <section id="explorer-anchor-summary"><h3>概览</h3><p>此例由页面协调滚动，保持 Explorer 的组件路由。</p></section>
    <section id="explorer-anchor-permissions"><h3>权限与安全</h3><p>当前章节由 activeId 显式维护。</p></section>
  </div>;
}
const explorerCase = {
  id: "anchor/overview", label: "页内锚点导航", summary: "公开接口没有禁用项字段；调用方拥有当前章节和滚动/路由协调。",
  states: ["default", "controlled", "empty", "longContent", "keyboard", "dark", "locale"],
  content: <AnchorExample />,
  stateExamples: [
    { state: "default", exports: ["AnchorNavigation"], content: <AnchorExample /> },
    { state: "controlled", exports: ["AnchorNavigation"], content: <AnchorExample /> },
    { state: "empty", exports: ["AnchorNavigation"], instructions: "items=[] 不生成目录项；空态说明由页面提供。", content: <AnchorNavigation ariaLabel="空目录" items={[]} /> },
    { state: "longContent", exports: ["AnchorNavigation"], content: <AnchorNavigation ariaLabel="长章节目录" items={[{ id: "long", label: "跨区域基础设施迁移项目的全部成员权限与安全策略审核记录及发布检查", href: "#/components/anchor" }]} /> },
    { state: "keyboard", exports: ["AnchorNavigation"], instructions: "Tab 聚焦章节链接，Enter 选中并滚动到对应内容；示例拦截原生 hash 更新，以免覆盖 Explorer 路由。", content: <AnchorExample /> },
    { state: "dark", exports: ["AnchorNavigation"], content: <StatePreview state="dark"><AnchorExample /></StatePreview> },
    { state: "locale", exports: ["AnchorNavigation"], content: <StatePreview state="locale"><AnchorNavigation ariaLabel="On this page" items={[{ id: "summary", label: "Overview", href: "#/components/anchor" }]} /></StatePreview> },
  ],
  code: '<AnchorNavigation activeId={activeId} onNavigate={navigateToSection} items={sections} />',
} satisfies ExplorerCase;
export default explorerCase;
