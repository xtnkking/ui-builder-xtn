// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"aspect/overview","exports":["AspectRatio"]}
import { AspectRatio, Box } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const explorerCase = {
  id: "aspect/overview",
  label: "固定宽高比",
  summary: "媒体或预览区域在加载前即占据稳定比例，避免内容出现时跳动。",
  states: ["default", "longContent", "mobile", "dark", "locale"],
  content: <AspectRatio ratio="16 / 5"><Box padding="large" surface="subtle">报表预览</Box></AspectRatio>,
  code: `<AspectRatio ratio="16 / 9">{preview}</AspectRatio>`,
} satisfies ExplorerCase;

export default explorerCase;
