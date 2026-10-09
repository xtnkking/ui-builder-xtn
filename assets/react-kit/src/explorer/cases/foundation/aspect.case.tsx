// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"aspect/overview","exports":["AspectRatio"]}
import { StatePreview } from "../state-preview";
import { AspectRatio, Box } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const explorerCase = {
  id: "aspect/overview",
  label: "固定宽高比",
  summary: "媒体或预览区域在加载前即占据稳定比例，避免内容出现时跳动。",
  states: ["default", "longContent", "mobile", "dark", "locale"],
  stateExamples: [
    { state: "longContent", exports: ["AspectRatio"], content: <AspectRatio ratio="3 / 2"><Box padding="large" surface="subtle">年度跨区域运营报表包含账户使用情况、成员权限变更、审核效率和通知偏好趋势；预览容器保持稳定宽高比，内容在内部自然换行。</Box></AspectRatio> },
    { state: "default", exports: ["AspectRatio"], content: <AspectRatio ratio="16 / 5"><Box padding="large" surface="subtle">报表预览</Box></AspectRatio> },
    { state: "mobile", exports: ["AspectRatio"], content: <StatePreview state="mobile">{<AspectRatio ratio="16 / 5"><Box padding="large" surface="subtle">报表预览</Box></AspectRatio>}</StatePreview> },
    { state: "dark", exports: ["AspectRatio"], content: <StatePreview state="dark">{<AspectRatio ratio="16 / 5"><Box padding="large" surface="subtle">报表预览</Box></AspectRatio>}</StatePreview> },
    { state: "locale", exports: ["AspectRatio"], content: <StatePreview state="locale">{<AspectRatio ratio="16 / 5"><Box padding="large" surface="subtle">报表预览</Box></AspectRatio>}</StatePreview> },
  ],
  content: <AspectRatio ratio="16 / 5"><Box padding="large" surface="subtle">报表预览</Box></AspectRatio>,
  code: `<AspectRatio ratio="16 / 9">{preview}</AspectRatio>`,
} satisfies ExplorerCase;

export default explorerCase;
