// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"inline-message/overview","exports":["InlineMessage"]}
import { Inline, InlineMessage } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const explorerCase = {
  id: "inline-message/overview",
  label: "行内消息",
  summary: "在字段或局部内容旁给出简短状态，不打断当前任务。",
  states: ["default", "empty", "error", "longContent", "dark", "locale"],
  content: (
    <Inline gap="large" wrap>
      <InlineMessage tone="info">配置将在保存后生效。</InlineMessage>
      <InlineMessage tone="success">地址验证通过。</InlineMessage>
      <InlineMessage tone="warning">此密钥将在 3 天后过期，请及时轮换。</InlineMessage>
      <InlineMessage tone="danger">连接失败，请检查网络代理。</InlineMessage>
    </Inline>
  ),
  code: `<InlineMessage tone="warning">此密钥将在 3 天后过期。</InlineMessage>`,
} satisfies ExplorerCase;

export default explorerCase;
