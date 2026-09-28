// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"clipboard/overview","exports":["ClipboardButton"]}
import { ClipboardButton, Inline } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const explorerCase = {
  id: "clipboard/overview",
  label: "复制按钮",
  summary: "复制动作包含处理中、成功和失败反馈，并为图标模式保留稳定的可访问名称。",
  states: ["default", "disabled", "longContent", "keyboard", "dark", "locale"],
  content: <Inline><ClipboardButton text="sk_live_example" label="复制 API 密钥" /><ClipboardButton text="disabled" disabled label="不可复制" /></Inline>,
  code: `<ClipboardButton text={apiKey} label="复制 API 密钥" />`,
} satisfies ExplorerCase;

export default explorerCase;
