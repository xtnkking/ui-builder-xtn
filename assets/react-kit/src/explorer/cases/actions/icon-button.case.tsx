// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"icon-button/overview","exports":["IconButton"]}
import { IconButton, Inline } from "../../../personal-ui";
import { useState } from "react";
import { MoreHorizontal, RefreshCw, Trash2 } from "lucide-react";
import { StatePreview } from "../state-preview";
import type { ExplorerCase } from "../types";

function KeyboardIconButtonExample() {
  const [refreshCount, setRefreshCount] = useState(0);
  return <><IconButton aria-label="刷新数据" icon={<RefreshCw />} onClick={() => setRefreshCount((count) => count + 1)} /><p role="status">已刷新 {refreshCount} 次</p></>;
}

const explorerCase = {
  id: "icon-button/overview",
  label: "图标按钮",
  summary: "纯图标动作始终提供可访问名称，并覆盖默认、危险、加载和禁用状态。",
  states: ["default", "disabled", "loading", "keyboard", "dark", "locale"],
  content: <Inline><IconButton aria-label="更多操作" icon={<MoreHorizontal />} /><IconButton aria-label="删除" variant="danger" icon={<Trash2 />} /><IconButton aria-label="刷新中" loading icon={<RefreshCw />} /><IconButton aria-label="刷新不可用" disabled icon={<RefreshCw />} /></Inline>,
  stateExamples: [
    { state: "default", exports: ["IconButton"], content: <Inline><IconButton aria-label="更多操作" icon={<MoreHorizontal />} /><IconButton aria-label="删除" variant="danger" icon={<Trash2 />} /></Inline> },
    { state: "disabled", exports: ["IconButton"], content: <IconButton aria-label="刷新不可用" disabled icon={<RefreshCw />} /> },
    { state: "loading", exports: ["IconButton"], content: <IconButton aria-label="刷新中" loading icon={<RefreshCw />} /> },
    { state: "keyboard", exports: ["IconButton"], instructions: "用 Tab 聚焦刷新按钮，按 Enter 或空格；下方计数应增加。", content: <KeyboardIconButtonExample /> },
    { state: "dark", exports: ["IconButton"], content: <StatePreview state="dark">{<IconButton aria-label="删除" variant="danger" icon={<Trash2 />} />}</StatePreview> },
    { state: "locale", exports: ["IconButton"], content: <StatePreview state="locale">{<IconButton aria-label="Refresh records" icon={<RefreshCw />} />}</StatePreview> },
  ],
  code: `<IconButton aria-label="更多操作" icon={<MoreHorizontal />} />`,
} satisfies ExplorerCase;

export default explorerCase;
