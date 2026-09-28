// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"toolbar/overview","exports":["Toolbar"]}
import { Button, Inline, Tag, Toolbar } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const explorerCase = {
  id: "toolbar/overview",
  label: "工具栏",
  summary: "起始信息、主要工具与末端动作拥有稳定区域，窄屏允许自然换行。",
  states: ["default", "disabled", "longContent", "keyboard", "dark", "locale"],
  content: <Toolbar ariaLabel="成员工具" start={<Tag tone="blue">已选 3 项</Tag>} end={<Button variant="primary">邀请成员</Button>}><Inline><Button>导出</Button><Button disabled>停用</Button></Inline></Toolbar>,
  code: `<Toolbar ariaLabel="成员工具" start={selection} end={primaryAction}>{tools}</Toolbar>`,
} satisfies ExplorerCase;

export default explorerCase;
