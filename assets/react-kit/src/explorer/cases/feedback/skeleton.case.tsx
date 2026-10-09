// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"skeleton/overview","exports":["Skeleton"]}
import { StatePreview } from "../state-preview";
import { Skeleton, Stack } from "../../../personal-ui";
import type { ExplorerCase } from "../types";


const explorerCase = {
  id: "skeleton/overview",
  label: "骨架占位",
  summary: "骨架用宽度组合模拟布局；组件没有文本内容和数据空态。",
  states: ["default","dark","locale"],
  stateExamples: [
    { state: "default", exports: ["Skeleton"], content: <Skeleton width="82%" /> },
    { state: "dark", exports: ["Skeleton"], content: <StatePreview state="dark"><Skeleton width="82%" /></StatePreview> },
    { state: "locale", exports: ["Skeleton"], content: <StatePreview state="locale"><Skeleton width="82%" /></StatePreview> },
  ],
  content: <Stack gap="small"><Skeleton width="38%" /><Skeleton width="100%" /><Skeleton width="82%" /></Stack>,
  code: "<Skeleton width=\"82%\" />",
} satisfies ExplorerCase;

export default explorerCase;
