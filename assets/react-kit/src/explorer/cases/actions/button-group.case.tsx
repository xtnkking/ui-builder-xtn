// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"button-group/overview","exports":["ButtonGroup"]}
import { Button, ButtonGroup, Stack } from "../../../personal-ui";
import { StatePreview } from "../state-preview";
import type { ExplorerCase } from "../types";

const explorerCase = {
  id: "button-group/overview",
  label: "按钮组",
  summary: "相关动作以具名 group 组织，可选择连接式或独立式布局。",
  states: ["default", "empty", "longContent", "dark", "locale"],
  content: <Stack gap="medium" align="start"><ButtonGroup ariaLabel="文本对齐" attached><Button>左对齐</Button><Button>居中</Button><Button>右对齐</Button></ButtonGroup><ButtonGroup ariaLabel="空操作组" /></Stack>,
  stateExamples: [
    { state: "default", exports: ["ButtonGroup"], content: <ButtonGroup ariaLabel="文本对齐" attached><Button>左对齐</Button><Button>居中</Button><Button>右对齐</Button></ButtonGroup> },
    { state: "empty", exports: ["ButtonGroup"], instructions: "空按钮组只保留分组语义；不会自动生成空状态消息或占位按钮。", content: <Stack><ButtonGroup ariaLabel="当前没有可用操作" /><p>上方分组没有子按钮；空态说明由页面提供。</p></Stack> },
    { state: "longContent", exports: ["ButtonGroup"], content: <Stack align="start" style={{ width: "100%", maxWidth: 360 }}><ButtonGroup ariaLabel="长操作名称" orientation="vertical" attached><Button>保存当前成员在全部产品中的角色配置、数据访问权限、通知偏好和账户安全设置，然后返回成员管理列表继续处理其他成员</Button><Button>取消</Button></ButtonGroup></Stack> },
    { state: "dark", exports: ["ButtonGroup"], content: <StatePreview state="dark">{<ButtonGroup ariaLabel="文本对齐" attached><Button>左对齐</Button><Button>居中</Button><Button>右对齐</Button></ButtonGroup>}</StatePreview> },
    { state: "locale", exports: ["ButtonGroup"], content: <StatePreview state="locale">{<ButtonGroup ariaLabel="Text alignment" attached><Button>Left</Button><Button>Center</Button><Button>Right</Button></ButtonGroup>}</StatePreview> },
  ],
  code: `<ButtonGroup ariaLabel="文本对齐" attached>{buttons}</ButtonGroup>`,
} satisfies ExplorerCase;

export default explorerCase;
