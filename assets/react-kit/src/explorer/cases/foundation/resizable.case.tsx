// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"resizable/overview","exports":["ResizablePanels"]}
import { Box, ResizablePanels } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const explorerCase = {
  id: "resizable/overview",
  label: "可调整面板",
  summary: "分隔柄支持指针和方向键调整，并暴露当前比例的可访问语义。",
  states: ["default", "disabled", "readOnly", "controlled", "uncontrolled", "validation", "longContent", "keyboard", "overlay", "dark", "locale"],
  content: <ResizablePanels ariaLabel="调整目录和详情宽度" defaultSize={38} first={<Box padding="medium" surface="subtle">目录</Box>} second={<Box padding="medium">详情内容</Box>} />,
  code: `<ResizablePanels ariaLabel="调整宽度" first={directory} second={detail} />`,
} satisfies ExplorerCase;

export default explorerCase;
