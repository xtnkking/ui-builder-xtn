// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"breadcrumb/overview","exports":["Breadcrumbs"]}
import { Breadcrumbs } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const explorerCase = {
  id: "breadcrumb/overview",
  label: "层级路径",
  summary: "中间层级可操作，末项自动标记为当前页面，并处理较长名称。",
  states: ["default", "disabled", "longContent", "keyboard", "dark", "locale"] as const,
  content: <Breadcrumbs ariaLabel="项目路径" items={[{ id: "workspace", label: "工作空间", onClick: () => undefined }, { id: "projects", label: "跨区域基础设施迁移项目", onClick: () => undefined }, { id: "current", label: "发布检查" }]} />,
  code: `<Breadcrumbs items={[{ id: "home", label: "首页", href: "/" }, { id: "current", label: "发布检查" }]} />`,
} satisfies ExplorerCase;

export default explorerCase;
