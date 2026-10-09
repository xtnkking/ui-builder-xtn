// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"spinner/overview","exports":["Spinner"]}
import { StatePreview } from "../state-preview";
import { Spinner } from "../../../personal-ui";
import type { ExplorerCase } from "../types";


const explorerCase = {
  id: "spinner/overview",
  label: "加载指示",
  summary: "长 label 是屏幕阅读器状态文本，不会放大旋转图标。",
  states: ["default","longContent","dark","locale"],
  stateExamples: [
    { state: "default", exports: ["Spinner"], content: <Spinner /> },
    { state: "longContent", exports: ["Spinner"], content: <Spinner label="正在校验组织的全部访问策略以及关联产品的身份提供方配置，任务完成前请保留当前页面并等待结果。" /> },
    { state: "dark", exports: ["Spinner"], content: <StatePreview state="dark"><Spinner /></StatePreview> },
    { state: "locale", exports: ["Spinner"], content: <StatePreview state="locale"><Spinner /></StatePreview> },
  ],
  content: <Spinner />,
  code: "<Spinner label=\"正在读取数据\" />",
} satisfies ExplorerCase;

export default explorerCase;
