// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"skeleton/overview","exports":["Skeleton"]}
import { Skeleton } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const explorerCase = {
  id: "skeleton/overview",
  label: "骨架占位",
  summary: "使用与最终内容相近的固定宽度组合，避免加载完成时布局跳动。",
  states: ["default", "longContent", "dark", "locale"],
  content: (
    <div style={{ display: "grid", gap: 12, maxWidth: 520 }} aria-label="正在加载账户摘要">
      <Skeleton width="38%" />
      <Skeleton width="100%" />
      <Skeleton width="82%" />
    </div>
  ),
  code: `<div aria-label="正在加载账户摘要"><Skeleton width="38%" /><Skeleton width="100%" /></div>`,
} satisfies ExplorerCase;

export default explorerCase;
