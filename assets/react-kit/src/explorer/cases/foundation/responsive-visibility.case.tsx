// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"responsive-visibility/overview","exports":["ResponsiveVisibility"]}
import { StatePreview } from "../state-preview";
import { ResponsiveVisibility, Tag } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const explorerCase = {
  id: "responsive-visibility/overview",
  label: "响应式可见性",
  summary: "按断点控制辅助信息可见性，同时保留稳定的语义内容。",
  states: ["default", "longContent", "mobile", "dark", "locale"],
  stateExamples: [
    { state: "longContent", exports: ["ResponsiveVisibility"], content: <ResponsiveVisibility visibleOn="all">在全部屏幕尺寸中展示当前账户的完整访问权限、跨区域任务审批状态和通知偏好，验证辅助内容换行。</ResponsiveVisibility> },
    { state: "default", exports: ["ResponsiveVisibility"], content: <ResponsiveVisibility visibleOn="desktop"><Tag tone="blue">桌面端批量操作</Tag></ResponsiveVisibility> },
    { state: "mobile", exports: ["ResponsiveVisibility"], content: <StatePreview state="mobile">{<ResponsiveVisibility visibleOn="desktop"><Tag tone="blue">桌面端批量操作</Tag></ResponsiveVisibility>}</StatePreview> },
    { state: "dark", exports: ["ResponsiveVisibility"], content: <StatePreview state="dark">{<ResponsiveVisibility visibleOn="desktop"><Tag tone="blue">桌面端批量操作</Tag></ResponsiveVisibility>}</StatePreview> },
    { state: "locale", exports: ["ResponsiveVisibility"], content: <StatePreview state="locale">{<ResponsiveVisibility visibleOn="desktop"><Tag tone="blue">桌面端批量操作</Tag></ResponsiveVisibility>}</StatePreview> },
  ],
  content: <ResponsiveVisibility visibleOn="desktop"><Tag tone="blue">桌面端批量操作</Tag></ResponsiveVisibility>,
  code: `<ResponsiveVisibility visibleOn="desktop">{content}</ResponsiveVisibility>`,
} satisfies ExplorerCase;

export default explorerCase;
