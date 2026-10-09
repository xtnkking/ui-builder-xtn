// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"visually-hidden/overview","exports":["VisuallyHidden"]}
import { StatePreview } from "../state-preview";
import { IconButton, VisuallyHidden } from "../../../personal-ui";
import { Search } from "lucide-react";
import type { ExplorerCase } from "../types";

const explorerCase = {
  id: "visually-hidden/overview",
  label: "视觉隐藏文本",
  summary: "隐藏文本继续为辅助技术提供上下文，图标按钮本身仍保留明确名称。",
  states: ["default", "longContent", "dark", "locale"],
  stateExamples: [
    { state: "longContent", exports: ["VisuallyHidden"], content: <VisuallyHidden>在全部产品、成员账户和历史审批记录中搜索当前关键词；辅助技术应读取完整说明，视觉布局不应因为说明长度增加而改变。</VisuallyHidden> },
    { state: "default", exports: ["VisuallyHidden"], content: <span><IconButton aria-label="搜索" icon={<Search aria-hidden="true" />} /><VisuallyHidden>在全部项目中搜索</VisuallyHidden></span> },
    { state: "dark", exports: ["VisuallyHidden"], content: <StatePreview state="dark">{<span><IconButton aria-label="搜索" icon={<Search aria-hidden="true" />} /><VisuallyHidden>在全部项目中搜索</VisuallyHidden></span>}</StatePreview> },
    { state: "locale", exports: ["VisuallyHidden"], content: <StatePreview state="locale">{<span><IconButton aria-label="搜索" icon={<Search aria-hidden="true" />} /><VisuallyHidden>在全部项目中搜索</VisuallyHidden></span>}</StatePreview> },
  ],
  content: <span><IconButton aria-label="搜索" icon={<Search aria-hidden="true" />} /><VisuallyHidden>在全部项目中搜索</VisuallyHidden></span>,
  code: `<VisuallyHidden>在全部项目中搜索</VisuallyHidden>`,
} satisfies ExplorerCase;

export default explorerCase;
