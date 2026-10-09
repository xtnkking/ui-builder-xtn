// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"keyboard/overview","exports":["KeyboardShortcut"]}
import { StatePreview } from "../state-preview";
import { Inline, KeyboardShortcut } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const explorerCase = {
  id: "keyboard/overview",
  label: "键盘快捷键",
  summary: "快捷键按键以 kbd 语义展示，并允许单独提供本地化可读名称。",
  states: ["default", "longContent", "dark", "locale"],
  stateExamples: [
    { state: "longContent", exports: ["KeyboardShortcut"], content: <KeyboardShortcut keys={["Control", "跨区域成员权限与账户安全策略快速定位命令的完整本地化名称"]} label="长按键名称展示，仅呈现说明，不注册快捷键" /> },
    { state: "default", exports: ["KeyboardShortcut"], content: <Inline><span>打开命令面板</span><KeyboardShortcut keys={["Ctrl", "K"]} label="Control 加 K" /></Inline> },
    { state: "dark", exports: ["KeyboardShortcut"], content: <StatePreview state="dark">{<Inline><span>打开命令面板</span><KeyboardShortcut keys={["Ctrl", "K"]} label="Control 加 K" /></Inline>}</StatePreview> },
    { state: "locale", exports: ["KeyboardShortcut"], content: <StatePreview state="locale">{<Inline><span>打开命令面板</span><KeyboardShortcut keys={["Ctrl", "K"]} label="Control 加 K" /></Inline>}</StatePreview> },
  ],
  content: <Inline><span>打开命令面板</span><KeyboardShortcut keys={["Ctrl", "K"]} label="Control 加 K" /></Inline>,
  code: `<KeyboardShortcut keys={["Ctrl", "K"]} label="Control 加 K" />`,
} satisfies ExplorerCase;

export default explorerCase;
