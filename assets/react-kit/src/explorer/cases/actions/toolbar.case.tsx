// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"toolbar/overview","exports":["Toolbar"]}
import { StatePreview } from "../state-preview";
import { Button, Inline, Tag, Toolbar } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const explorerCase = {
  id: "toolbar/overview",
  label: "工具栏",
  summary: "起始信息、主要工具与末端动作拥有稳定区域，窄屏允许自然换行。",
  states: ["default", "longContent", "keyboard", "dark", "locale"],
  stateExamples: [
    { state: "longContent", exports: ["Toolbar"], content: <Toolbar ariaLabel="完整成员操作" start={<Tag>已选 3 项</Tag>} end={<Button>邀请成员</Button>}><Button>导出全部产品中的角色配置、数据访问权限、通知偏好和账户安全设置，请确认所有关联配置均符合团队的实际使用要求。</Button></Toolbar> },
    { state: "default", exports: ["Toolbar"], content: <Toolbar ariaLabel="成员工具" start={<Tag tone="blue">已选 3 项</Tag>} end={<Button variant="primary">邀请成员</Button>}><Inline><Button>导出</Button><Button disabled>停用</Button></Inline></Toolbar> },
    { state: "keyboard", exports: ["Toolbar"], content: <Toolbar ariaLabel="成员工具" start={<Tag tone="blue">已选 3 项</Tag>} end={<Button variant="primary">邀请成员</Button>}><Inline><Button>导出</Button><Button disabled>停用</Button></Inline></Toolbar>, instructions: "用 Tab 访问本例可用控件，使用 Enter、Space 和组件文档中的方向键操作。此项为人工操作案例，不是自动行为验收证书。" },
    { state: "dark", exports: ["Toolbar"], content: <StatePreview state="dark">{<Toolbar ariaLabel="成员工具" start={<Tag tone="blue">已选 3 项</Tag>} end={<Button variant="primary">邀请成员</Button>}><Inline><Button>导出</Button><Button disabled>停用</Button></Inline></Toolbar>}</StatePreview> },
    { state: "locale", exports: ["Toolbar"], content: <StatePreview state="locale">{<Toolbar ariaLabel="成员工具" start={<Tag tone="blue">已选 3 项</Tag>} end={<Button variant="primary">邀请成员</Button>}><Inline><Button>导出</Button><Button disabled>停用</Button></Inline></Toolbar>}</StatePreview> },
  ],
  content: <Toolbar ariaLabel="成员工具" start={<Tag tone="blue">已选 3 项</Tag>} end={<Button variant="primary">邀请成员</Button>}><Inline><Button>导出</Button><Button disabled>停用</Button></Inline></Toolbar>,
  code: `<Toolbar ariaLabel="成员工具" start={selection} end={primaryAction}>{tools}</Toolbar>`,
} satisfies ExplorerCase;

export default explorerCase;
