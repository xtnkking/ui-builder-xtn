// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"visually-hidden/overview","exports":["VisuallyHidden"]}
import { IconButton, VisuallyHidden } from "../../../personal-ui";
import { Search } from "lucide-react";
import type { ExplorerCase } from "../types";

const explorerCase = {
  id: "visually-hidden/overview",
  label: "视觉隐藏文本",
  summary: "隐藏文本继续为辅助技术提供上下文，图标按钮本身仍保留明确名称。",
  states: ["default", "longContent", "dark", "locale"],
  content: <span><IconButton aria-label="搜索" icon={<Search aria-hidden="true" />} /><VisuallyHidden>在全部项目中搜索</VisuallyHidden></span>,
  code: `<VisuallyHidden>在全部项目中搜索</VisuallyHidden>`,
} satisfies ExplorerCase;

export default explorerCase;
