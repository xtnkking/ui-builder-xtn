// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"badge/overview","exports":["Badge"]}
import { StatePreview } from "../state-preview";
import { Badge, Inline } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const explorerCase = {
  id: "badge/overview",
  label: "徽标",
  summary: "数字、封顶数字、文字和状态点使用一致的小型信息容器，并提供明确的可访问标签。",
  states: ["default", "empty", "error", "longContent", "dark", "locale"],
  stateExamples: [
    { state: "empty", exports: ["Badge"], instructions: "数量为 0 且 showZero=false 时徽标隐藏；第二项对照显示 0。", content: <Inline><Badge count={0} showZero={false} label="没有未读消息" /><Badge count={0} showZero label="没有未读消息" /></Inline> },
    { state: "longContent", exports: ["Badge"], content: <Badge content="此工作区包含全部产品中的角色配置、数据访问权限、通知偏好和账户安全设置，请确认所有配置均符合团队的实际使用要求。" tone="neutral" /> },
    { state: "default", exports: ["Badge"], content: (
    <Inline gap="medium" wrap>
      <Badge count={8} tone="blue" label="8 条未读消息" />
      <Badge count={128} max={99} tone="danger" label="超过 99 条告警" />
      <Badge content="Beta" tone="neutral" />
      <Badge dot tone="success" label="服务在线" />
    </Inline>
  ) },
    { state: "error", exports: ["Badge"], content: (
    <Inline gap="medium" wrap>
      <Badge count={8} tone="blue" label="8 条未读消息" />
      <Badge count={128} max={99} tone="danger" label="超过 99 条告警" />
      <Badge content="Beta" tone="neutral" />
      <Badge dot tone="success" label="服务在线" />
    </Inline>
  ) },
    { state: "dark", exports: ["Badge"], content: <StatePreview state="dark">{(
    <Inline gap="medium" wrap>
      <Badge count={8} tone="blue" label="8 条未读消息" />
      <Badge count={128} max={99} tone="danger" label="超过 99 条告警" />
      <Badge content="Beta" tone="neutral" />
      <Badge dot tone="success" label="服务在线" />
    </Inline>
  )}</StatePreview> },
    { state: "locale", exports: ["Badge"], content: <StatePreview state="locale">{(
    <Inline gap="medium" wrap>
      <Badge count={8} tone="blue" label="8 条未读消息" />
      <Badge count={128} max={99} tone="danger" label="超过 99 条告警" />
      <Badge content="Beta" tone="neutral" />
      <Badge dot tone="success" label="服务在线" />
    </Inline>
  )}</StatePreview> },
  ],
  content: (
    <Inline gap="medium" wrap>
      <Badge count={8} tone="blue" label="8 条未读消息" />
      <Badge count={128} max={99} tone="danger" label="超过 99 条告警" />
      <Badge content="Beta" tone="neutral" />
      <Badge dot tone="success" label="服务在线" />
    </Inline>
  ),
  code: `<Badge count={128} max={99} tone="danger" label="超过 99 条告警" />`,
} satisfies ExplorerCase;

export default explorerCase;
