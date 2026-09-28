// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"progress/overview","exports":["Progress","ProgressRing"]}
import { Inline, Progress, ProgressRing } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const explorerCase = {
  id: "progress/overview",
  label: "进度反馈",
  summary: "线性进度用于连续任务，环形进度用于紧凑摘要；两者都提供可访问标签和值。",
  states: ["default", "empty", "error", "longContent", "dark", "locale"],
  content: (
    <div style={{ display: "grid", gap: 20 }}>
      <Progress value={68} label="导入成员" showValue />
      <Inline gap="large" wrap>
        <ProgressRing value={42} label="资料上传进度" showValue />
        <ProgressRing indeterminate label="正在检查文件" />
      </Inline>
    </div>
  ),
  code: `<Progress value={68} label="导入成员" showValue />\n<ProgressRing value={42} label="资料上传进度" showValue />`,
} satisfies ExplorerCase;

export default explorerCase;
