// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"keyboard/overview","exports":["KeyboardShortcut"]}
import { Inline, KeyboardShortcut } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const explorerCase = {
  id: "keyboard/overview",
  label: "键盘快捷键",
  summary: "快捷键按键以 kbd 语义展示，并允许单独提供本地化可读名称。",
  states: ["default", "longContent", "dark", "locale"],
  content: <Inline><span>打开命令面板</span><KeyboardShortcut keys={["Ctrl", "K"]} label="Control 加 K" /></Inline>,
  code: `<KeyboardShortcut keys={["Ctrl", "K"]} label="Control 加 K" />`,
} satisfies ExplorerCase;

export default explorerCase;
