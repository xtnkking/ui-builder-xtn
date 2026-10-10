// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"focus-trap/overview","exports":["FocusTrap"]}
import { StatePreview } from "../state-preview";
import { Button, FocusTrap, Inline } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const explorerCase = {
  id: "focus-trap/overview",
  label: "焦点约束",
  summary: "焦点陷阱用于真正的模态场景；静态案例关闭 active，避免阻断 Explorer 本身。",
  states: ["default", "keyboard", "overlay", "dark", "locale"],
  stateExamples: [
    { state: "default", exports: ["FocusTrap"], content: <FocusTrap active={false}><Inline justify="end"><Button>上一步</Button><Button variant="primary">下一步</Button></Inline></FocusTrap> },
    { state: "keyboard", exports: ["FocusTrap"], content: <StatePreview state="overlay"><FocusTrap><Inline justify="end"><Button>上一步</Button><Button variant="primary">下一步</Button></Inline></FocusTrap></StatePreview>, instructions: "先打开弹窗，再按 Tab 和 Shift+Tab，焦点应在这两个按钮间循环；按 Esc 关闭外层弹窗并返回触发按钮。操作组使用 Inline justify=end 靠右排列，FocusTrap 只负责焦点。" },
    { state: "overlay", exports: ["FocusTrap"], content: <StatePreview state="overlay"><FocusTrap><Inline justify="end"><Button>上一步</Button><Button variant="primary">下一步</Button></Inline></FocusTrap></StatePreview> },
    { state: "dark", exports: ["FocusTrap"], content: <StatePreview state="dark">{<FocusTrap active={false}><Inline justify="end"><Button>上一步</Button><Button variant="primary">下一步</Button></Inline></FocusTrap>}</StatePreview> },
    { state: "locale", exports: ["FocusTrap"], content: <StatePreview state="locale">{<FocusTrap active={false}><Inline justify="end"><Button>上一步</Button><Button variant="primary">下一步</Button></Inline></FocusTrap>}</StatePreview> },
  ],
  content: <FocusTrap active={false}><Inline justify="end"><Button>上一步</Button><Button variant="primary">下一步</Button></Inline></FocusTrap>,
  code: `<FocusTrap active={modalOpen}>\n  <Inline justify="end"><Button>上一步</Button><Button variant="primary">下一步</Button></Inline>\n</FocusTrap>`,
} satisfies ExplorerCase;

export default explorerCase;
