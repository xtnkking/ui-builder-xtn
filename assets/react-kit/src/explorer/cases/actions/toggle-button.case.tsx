// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"toggle-button/overview","exports":["ToggleButton"]}
import { Inline, ToggleButton } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const explorerCase = {
  id: "toggle-button/overview",
  label: "切换按钮",
  summary: "切换按钮通过 aria-pressed 表达状态，并同时支持受控与非受控使用方式。",
  states: ["default", "disabled", "readOnly", "controlled", "uncontrolled", "validation", "longContent", "keyboard", "overlay", "dark", "locale"],
  content: <Inline><ToggleButton defaultPressed>加粗</ToggleButton><ToggleButton>斜体</ToggleButton><ToggleButton disabled>删除线</ToggleButton></Inline>,
  code: `<ToggleButton pressed={bold} onPressedChange={setBold}>加粗</ToggleButton>`,
} satisfies ExplorerCase;

export default explorerCase;
