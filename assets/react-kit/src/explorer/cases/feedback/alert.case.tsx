// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"alert/overview","exports":["Alert"]}
import { StatePreview } from "../state-preview";
import { Alert } from "../../../personal-ui";
import type { ExplorerCase } from "../types";


const explorerCase = {
  id: "alert/overview",
  label: "页面内提醒",
  summary: "信息、错误和长内容有独立实例；不把无正文当作空数据状态。",
  states: ["default","error","longContent","dark","locale"],
  stateExamples: [
    { state: "default", exports: ["Alert"], content: <Alert tone="info">配置将在保存后生效。</Alert> },
    { state: "error", exports: ["Alert"], content: <Alert tone="danger">连接失败，请检查网络后重试。</Alert> },
    { state: "longContent", exports: ["Alert"], content: <Alert tone="warning">当前工作区的生产环境访问凭据将在维护窗口结束后过期，请先检查所有关联应用的回调地址并轮换密钥，再通知团队成员更新客户端配置，期间已建立的会话会继续保留。</Alert> },
    { state: "dark", exports: ["Alert"], content: <StatePreview state="dark"><Alert tone="info">配置将在保存后生效。</Alert></StatePreview> },
    { state: "locale", exports: ["Alert"], content: <StatePreview state="locale"><Alert tone="info">配置将在保存后生效。</Alert></StatePreview> },
  ],
  content: <Alert tone="info">配置将在保存后生效。</Alert>,
  code: "<Alert tone=\"info\">配置将在保存后生效。</Alert>",
} satisfies ExplorerCase;

export default explorerCase;
