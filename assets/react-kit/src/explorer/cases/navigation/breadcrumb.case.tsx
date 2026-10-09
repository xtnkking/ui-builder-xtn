// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"breadcrumb/overview","exports":["Breadcrumbs"]}
import { Breadcrumbs } from "../../../personal-ui";
import { StatePreview } from "../state-preview";
import type { ExplorerCase } from "../types";

function BreadcrumbExample() {
  return <Breadcrumbs ariaLabel="项目路径" items={[{ id: "workspace", label: "工作空间", onClick: () => window.alert("打开工作空间") }, { id: "project", label: "项目", onClick: () => window.alert("打开项目") }, { id: "current", label: "发布检查" }]} />;
}
const explorerCase = {
  id: "breadcrumb/overview", label: "层级路径", summary: "可操作上级路径与当前页；支持空路径、长标题，公开接口没有禁用字段。",
  states: ["default", "empty", "longContent", "keyboard", "dark", "locale"],
  content: <BreadcrumbExample />,
  stateExamples: [
    { state: "default", exports: ["Breadcrumbs"], content: <BreadcrumbExample /> },
    { state: "empty", exports: ["Breadcrumbs"], instructions: "items=[] 只保留导航容器，不生成占位路径或空态提示。", content: <Breadcrumbs ariaLabel="空路径" items={[]} /> },
    { state: "longContent", exports: ["Breadcrumbs"], content: <Breadcrumbs ariaLabel="长路径" items={[{ id: "home", label: "工作空间", onClick: () => undefined }, { id: "current", label: "跨区域基础设施迁移项目的全部成员权限与安全策略审核记录及发布检查" }]} /> },
    { state: "keyboard", exports: ["Breadcrumbs"], instructions: "Tab 到可操作的上级路径，用 Enter 激活；当前页为文本，不伪装为可点击按钮。", content: <BreadcrumbExample /> },
    { state: "dark", exports: ["Breadcrumbs"], content: <StatePreview state="dark"><BreadcrumbExample /></StatePreview> },
    { state: "locale", exports: ["Breadcrumbs"], content: <StatePreview state="locale"><Breadcrumbs items={[{ id: "home", label: "Workspace", onClick: () => undefined }, { id: "current", label: "Release review" }]} /></StatePreview> },
  ],
  code: '<Breadcrumbs items={[{ id: "home", label: "首页", href: "/" }, { id: "current", label: "发布检查" }]} />',
} satisfies ExplorerCase;
export default explorerCase;
