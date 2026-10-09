// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"inline-message/overview","exports":["InlineMessage"]}
import { StatePreview } from "../state-preview";
import { InlineMessage } from "../../../personal-ui";
import type { ExplorerCase } from "../types";


const explorerCase = {
  id: "inline-message/overview",
  label: "行内消息",
  summary: "信息、错误和长内容有独立实例；不把无正文当作空数据状态。",
  states: ["default","error","longContent","dark","locale"],
  stateExamples: [
    { state: "default", exports: ["InlineMessage"], content: <InlineMessage tone="info">配置将在保存后生效。</InlineMessage> },
    { state: "error", exports: ["InlineMessage"], content: <InlineMessage tone="danger">连接失败，请检查网络后重试。</InlineMessage> },
    { state: "longContent", exports: ["InlineMessage"], content: <InlineMessage tone="warning">当前工作区的生产环境访问凭据将在维护窗口结束后过期，请先检查所有关联应用的回调地址并轮换密钥，再通知团队成员更新客户端配置，期间已建立的会话会继续保留。</InlineMessage> },
    { state: "dark", exports: ["InlineMessage"], content: <StatePreview state="dark"><InlineMessage tone="info">配置将在保存后生效。</InlineMessage></StatePreview> },
    { state: "locale", exports: ["InlineMessage"], content: <StatePreview state="locale"><InlineMessage tone="info">配置将在保存后生效。</InlineMessage></StatePreview> },
  ],
  content: <InlineMessage tone="info">配置将在保存后生效。</InlineMessage>,
  code: "<InlineMessage tone=\"info\">配置将在保存后生效。</InlineMessage>",
} satisfies ExplorerCase;

export default explorerCase;
