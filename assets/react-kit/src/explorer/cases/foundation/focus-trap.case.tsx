// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"focus-trap/overview","exports":["FocusTrap"]}
import { Button, FocusTrap, Inline } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const explorerCase = {
  id: "focus-trap/overview",
  label: "焦点约束",
  summary: "焦点陷阱用于真正的模态场景；静态案例关闭 active，避免阻断 Explorer 本身。",
  states: ["default", "disabled", "readOnly", "controlled", "validation", "keyboard", "overlay", "dark", "locale"],
  content: <FocusTrap active={false}><Inline><Button>上一步</Button><Button variant="primary">下一步</Button></Inline></FocusTrap>,
  code: `<FocusTrap active={modalOpen}>{dialogContent}</FocusTrap>`,
} satisfies ExplorerCase;

export default explorerCase;
