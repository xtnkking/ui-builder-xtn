// @ui-coverage {"kind":"example","runner":"explorer","caseId":"button-group/overview","exports":["ButtonGroup"]}
import { useState } from "react";
import { AlignCenter, AlignJustify, AlignLeft, AlignRight } from "lucide-react";
import { Button, ButtonGroup, IconButton, Stack } from "../../../ui";
import { StatePreview } from "../state-preview";
import type { ExplorerCase } from "../types";

function NarrowButtonGroupExample() {
  const [actions, setActions] = useState(0);
  const options = [
    { label: "左对齐", icon: <AlignLeft /> }, { label: "居中", icon: <AlignCenter /> },
    { label: "右对齐", icon: <AlignRight /> }, { label: "两端对齐", icon: <AlignJustify /> },
  ];
  return <Stack gap="small" align="start" style={{ width: 120, maxWidth: "100%" }}>
    <ButtonGroup ariaLabel="窄容器普通操作">
      {options.map(({ label, icon }) => <IconButton key={label} aria-label={`普通操作：${label}`} icon={icon} onClick={() => setActions((count) => count + 1)} />)}
    </ButtonGroup>
    <ButtonGroup ariaLabel="窄容器连接操作" attached>
      {options.map(({ label, icon }) => <IconButton key={label} aria-label={`连接操作：${label}`} icon={icon} onClick={() => setActions((count) => count + 1)} />)}
    </ButtonGroup>
    <span role="status">已执行 {actions} 次操作</span>
  </Stack>;
}

const explorerCase = {
  id: "button-group/overview",
  label: "按钮组",
  summary: "相关动作以具名 group 组织；普通横向组自然换行，连接式横向组在自身滚动区域保留单行。",
  states: ["default", "empty", "longContent", "dark", "locale"],
  content: <Stack gap="medium" align="start"><ButtonGroup ariaLabel="文本对齐" attached><Button>左对齐</Button><Button>居中</Button><Button>右对齐</Button></ButtonGroup><ButtonGroup ariaLabel="空操作组" /></Stack>,
  stateExamples: [
    { state: "default", exports: ["ButtonGroup"], content: <ButtonGroup ariaLabel="文本对齐" attached><Button>左对齐</Button><Button>居中</Button><Button>右对齐</Button></ButtonGroup> },
    { state: "empty", exports: ["ButtonGroup"], instructions: "空按钮组只保留分组语义；不会自动生成空状态消息或占位按钮。", content: <Stack><ButtonGroup ariaLabel="当前没有可用操作" /><p>上方分组没有子按钮；空态说明由页面提供。</p></Stack> },
    { state: "longContent", exports: ["ButtonGroup"], content: <Stack align="start" style={{ width: "100%", maxWidth: 360 }}><ButtonGroup ariaLabel="长操作名称" orientation="vertical" attached><Button>保存当前成员在全部产品中的角色配置、数据访问权限、通知偏好和账户安全设置，然后返回成员管理列表继续处理其他成员</Button><Button>取消</Button></ButtonGroup><NarrowButtonGroupExample /></Stack>, instructions: "120px 容器里的四个图标按钮保持原尺寸；普通组换行，连接组内滚动。Tab 逐个聚焦连接组按钮时，当前按钮与焦点轮廓应完整可见。" },
    { state: "dark", exports: ["ButtonGroup"], content: <StatePreview state="dark">{<ButtonGroup ariaLabel="文本对齐" attached><Button>左对齐</Button><Button>居中</Button><Button>右对齐</Button></ButtonGroup>}</StatePreview> },
    { state: "locale", exports: ["ButtonGroup"], content: <StatePreview state="locale">{<ButtonGroup ariaLabel="Text alignment" attached><Button>Left</Button><Button>Center</Button><Button>Right</Button></ButtonGroup>}</StatePreview> },
  ],
  code: `<ButtonGroup ariaLabel="文本对齐" attached>{buttons}</ButtonGroup>`,
} satisfies ExplorerCase;

export default explorerCase;
