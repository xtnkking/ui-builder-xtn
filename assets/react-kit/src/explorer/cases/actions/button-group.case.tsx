// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"button-group/overview","exports":["ButtonGroup"]}
import { Button, ButtonGroup, Stack } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const explorerCase = {
  id: "button-group/overview",
  label: "按钮组",
  summary: "相关动作以具名 group 组织，可选择连接式或独立式布局。",
  states: ["default", "empty", "error", "longContent", "dark", "locale"],
  content: <Stack gap="medium"><ButtonGroup ariaLabel="文本对齐" attached><Button>左对齐</Button><Button>居中</Button><Button>右对齐</Button></ButtonGroup><ButtonGroup ariaLabel="空操作组" /></Stack>,
  code: `<ButtonGroup ariaLabel="文本对齐" attached>{buttons}</ButtonGroup>`,
} satisfies ExplorerCase;

export default explorerCase;
