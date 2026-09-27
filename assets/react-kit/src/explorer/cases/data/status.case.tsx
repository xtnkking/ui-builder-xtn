// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"status/overview","exports":["StatusIndicator"]}
import { Inline, StatusIndicator } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const explorerCase = {
  id: "status/overview",
  label: "状态指示",
  summary: "颜色点、主要状态和补充信息作为一个稳定整体展示，不只依赖颜色判断状态。",
  states: ["default", "empty", "error", "longContent", "dark", "locale"],
  content: (
    <Inline gap="large" wrap>
      <StatusIndicator tone="success" label="运行中" detail="最后检查于 2 分钟前" />
      <StatusIndicator tone="warning" label="等待复核" detail="需要管理员确认" />
      <StatusIndicator tone="danger" label="同步失败" detail="将在 10 分钟后重试" />
    </Inline>
  ),
  code: `<StatusIndicator tone="success" label="运行中" detail="最后检查于 2 分钟前" />`,
} satisfies ExplorerCase;

export default explorerCase;
