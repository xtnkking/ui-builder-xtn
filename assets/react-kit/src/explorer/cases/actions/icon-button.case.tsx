// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"icon-button/overview","exports":["IconButton"]}
import { IconButton, Inline } from "../../../personal-ui";
import { MoreHorizontal, RefreshCw, Trash2 } from "lucide-react";
import type { ExplorerCase } from "../types";

const explorerCase = {
  id: "icon-button/overview",
  label: "图标按钮",
  summary: "纯图标动作始终提供可访问名称，并覆盖默认、危险、加载和禁用状态。",
  states: ["default", "disabled", "longContent", "keyboard", "dark", "locale"],
  content: <Inline><IconButton aria-label="更多操作" icon={<MoreHorizontal />} /><IconButton aria-label="删除" variant="danger" icon={<Trash2 />} /><IconButton aria-label="刷新中" loading icon={<RefreshCw />} /><IconButton aria-label="刷新不可用" disabled icon={<RefreshCw />} /></Inline>,
  code: `<IconButton aria-label="更多操作" icon={<MoreHorizontal />} />`,
} satisfies ExplorerCase;

export default explorerCase;
