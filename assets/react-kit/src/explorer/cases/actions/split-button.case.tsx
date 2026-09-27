// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"split-button/overview","exports":["SplitButton"]}
import { SplitButton } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const explorerCase = {
  id: "split-button/overview",
  label: "拆分按钮",
  summary: "主要动作与次要菜单共享一个稳定控制组，禁用和加载会同步到两侧。",
  states: ["default", "disabled", "readOnly", "controlled", "uncontrolled", "validation", "longContent", "keyboard", "overlay", "dark", "locale"],
  content: <SplitButton variant="primary" menuAriaLabel="更多保存方式" menuItems={[{ id: "draft", label: "保存为草稿", onSelect: () => undefined }, { id: "template", label: "保存为模板", onSelect: () => undefined }]}>保存并发布</SplitButton>,
  code: `<SplitButton menuAriaLabel="更多保存方式" menuItems={items}>保存并发布</SplitButton>`,
} satisfies ExplorerCase;

export default explorerCase;
