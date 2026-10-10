// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"aspect/overview","exports":["AspectRatio"]}
import { StatePreview } from "../state-preview";
import { AspectRatio } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

function AspectExample() {
  return <AspectRatio ratio="16 / 5"><div className="demo-aspect-specimen"><strong>16 : 5</strong><span>报表预览 · 内容区域始终保持宽高比</span></div></AspectRatio>;
}

const explorerCase = {
  id: "aspect/overview",
  label: "固定宽高比",
  summary: "媒体或预览区域在加载前即占据稳定比例，避免内容出现时跳动。",
  states: ["default", "longContent", "mobile", "dark", "locale"],
  stateExamples: [
    { state: "longContent", exports: ["AspectRatio"], content: <AspectRatio ratio="3 / 2"><div className="demo-aspect-specimen"><strong>3 : 2</strong><span>年度跨区域运营报表包含账户使用情况、成员权限变更、审核效率和通知偏好趋势；预览容器保持稳定宽高比，内容在内部自然换行。</span></div></AspectRatio> },
    { state: "default", exports: ["AspectRatio"], content: <AspectExample /> },
    { state: "mobile", exports: ["AspectRatio"], content: <StatePreview state="mobile"><AspectExample /></StatePreview> },
    { state: "dark", exports: ["AspectRatio"], content: <StatePreview state="dark"><AspectExample /></StatePreview> },
    { state: "locale", exports: ["AspectRatio"], content: <StatePreview state="locale"><AspectExample /></StatePreview> },
  ],
  content: <AspectExample />,
  code: `<AspectRatio ratio="16 / 9">{preview}</AspectRatio>`,
} satisfies ExplorerCase;

export default explorerCase;
