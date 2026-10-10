// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"progress/overview","exports":["Progress","ProgressRing"]}
import { StatePreview } from "../state-preview";
import { Inline, Progress, ProgressRing, Stack } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

function ProgressExample() {
  return <div style={{ width: "100%", maxWidth: 560 }}>
    <Stack gap="large">
      <Progress value={68} label="导入成员" showValue />
      <Inline gap="large" wrap>
        <ProgressRing value={42} label="资料上传进度" />
        <ProgressRing indeterminate label="正在检查文件" />
      </Inline>
    </Stack>
  </div>;
}

const explorerCase = {
  id: "progress/overview",
  label: "进度反馈",
  summary: "展示连续进度和不确定进度；环形长 label 是可访问名称，不是可见正文。",
  states: ["default","longContent","dark","locale"],
  stateExamples: [
    { state: "default", exports: ["Progress","ProgressRing"], content: <ProgressExample /> },
    { state: "longContent", exports: ["Progress","ProgressRing"], content: <div style={{ width: "100%", maxWidth: 560 }}><Stack gap="large"><Progress value={68} label="正在校验组织的全部访问策略以及关联产品的身份提供方配置，任务完成前请保留当前页面并等待结果。" showValue /><Inline gap="large" wrap><ProgressRing value={42} label="正在校验组织的全部访问策略以及关联产品的身份提供方配置，任务完成前请保留当前页面并等待结果。" /><ProgressRing indeterminate label="正在检查文件" /></Inline></Stack></div> },
    { state: "dark", exports: ["Progress","ProgressRing"], content: <StatePreview state="dark"><ProgressExample /></StatePreview> },
    { state: "locale", exports: ["Progress","ProgressRing"], content: <StatePreview state="locale"><ProgressExample /></StatePreview> },
  ],
  content: <ProgressExample />,
  code: "<Progress value={68} label=\"导入成员\" showValue />",
} satisfies ExplorerCase;

export default explorerCase;
