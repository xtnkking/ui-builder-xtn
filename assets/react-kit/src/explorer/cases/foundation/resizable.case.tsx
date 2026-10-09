// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"resizable/overview","exports":["ResizablePanels"]}
import { StatePreview } from "../state-preview";
import { Box, ResizablePanels } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const explorerCase = {
  id: "resizable/overview",
  label: "可调整面板",
  summary: "分隔柄支持指针和方向键调整，并暴露当前比例的可访问语义。",
  states: ["default", "uncontrolled", "longContent", "keyboard", "overlay", "dark", "locale"],
  stateExamples: [
    { state: "longContent", exports: ["ResizablePanels"], content: <ResizablePanels ariaLabel="调整长内容面板" defaultSize={38} first={<Box padding="medium" surface="subtle">当前工作区的全部成员、角色与跨区域访问策略需要完整呈现，缩小面板时长文本应在当前面板内部自然换行。</Box>} second={<Box padding="medium">详细审批记录及通知偏好</Box>} /> },
    { state: "default", exports: ["ResizablePanels"], content: <ResizablePanels ariaLabel="调整目录和详情宽度" defaultSize={38} first={<Box padding="medium" surface="subtle">目录</Box>} second={<Box padding="medium">详情内容</Box>} /> },
    { state: "uncontrolled", exports: ["ResizablePanels"], content: <ResizablePanels ariaLabel="调整目录和详情宽度" defaultSize={38} first={<Box padding="medium" surface="subtle">目录</Box>} second={<Box padding="medium">详情内容</Box>} /> },
    { state: "keyboard", exports: ["ResizablePanels"], content: <ResizablePanels ariaLabel="调整目录和详情宽度" defaultSize={38} first={<Box padding="medium" surface="subtle">目录</Box>} second={<Box padding="medium">详情内容</Box>} />, instructions: "用 Tab 访问本例可用控件，使用 Enter、Space 和组件文档中的方向键操作。此项为人工操作案例，不是自动行为验收证书。" },
    { state: "overlay", exports: ["ResizablePanels"], content: <StatePreview state="overlay">{<ResizablePanels ariaLabel="调整目录和详情宽度" defaultSize={38} first={<Box padding="medium" surface="subtle">目录</Box>} second={<Box padding="medium">详情内容</Box>} />}</StatePreview> },
    { state: "dark", exports: ["ResizablePanels"], content: <StatePreview state="dark">{<ResizablePanels ariaLabel="调整目录和详情宽度" defaultSize={38} first={<Box padding="medium" surface="subtle">目录</Box>} second={<Box padding="medium">详情内容</Box>} />}</StatePreview> },
    { state: "locale", exports: ["ResizablePanels"], content: <StatePreview state="locale">{<ResizablePanels ariaLabel="调整目录和详情宽度" defaultSize={38} first={<Box padding="medium" surface="subtle">目录</Box>} second={<Box padding="medium">详情内容</Box>} />}</StatePreview> },
  ],
  content: <ResizablePanels ariaLabel="调整目录和详情宽度" defaultSize={38} first={<Box padding="medium" surface="subtle">目录</Box>} second={<Box padding="medium">详情内容</Box>} />,
  code: `<ResizablePanels ariaLabel="调整宽度" first={directory} second={detail} />`,
} satisfies ExplorerCase;

export default explorerCase;
