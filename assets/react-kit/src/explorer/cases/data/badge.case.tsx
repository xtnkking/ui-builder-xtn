// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"badge/overview","exports":["Badge"]}
import { Badge, Inline } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const explorerCase = {
  id: "badge/overview",
  label: "徽标",
  summary: "数字、封顶数字、文字和状态点使用一致的小型信息容器，并提供明确的可访问标签。",
  states: ["default", "empty", "error", "longContent", "dark", "locale"],
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
