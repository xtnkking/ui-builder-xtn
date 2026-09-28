// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"responsive-visibility/overview","exports":["ResponsiveVisibility"]}
import { ResponsiveVisibility, Tag } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const explorerCase = {
  id: "responsive-visibility/overview",
  label: "响应式可见性",
  summary: "按断点控制辅助信息可见性，同时保留稳定的语义内容。",
  states: ["default", "longContent", "mobile", "dark", "locale"],
  content: <ResponsiveVisibility visibleOn="desktop"><Tag tone="blue">桌面端批量操作</Tag></ResponsiveVisibility>,
  code: `<ResponsiveVisibility visibleOn="desktop">{content}</ResponsiveVisibility>`,
} satisfies ExplorerCase;

export default explorerCase;
