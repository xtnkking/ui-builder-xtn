// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"banner/overview","exports":["Banner"]}
import { StatePreview } from "../state-preview";
import { Banner } from "../../../personal-ui";
import type { ExplorerCase } from "../types";


const explorerCase = {
  id: "banner/overview",
  label: "全局横幅",
  summary: "默认横幅保留表面圆角；仅吸顶横幅使用贴边外观，信息、错误和长内容均有独立实例。",
  states: ["default","error","longContent","dark","locale"],
  stateExamples: [
    { state: "default", exports: ["Banner"], instructions: "普通页面内横幅默认保留圆角；sticky 用于贴住页面或滚动容器边界，因此采用全宽直角外观。", content: <Banner tone="info">配置将在保存后生效。</Banner> },
    { state: "error", exports: ["Banner"], content: <Banner tone="danger">连接失败，请检查网络后重试。</Banner> },
    { state: "longContent", exports: ["Banner"], content: <Banner tone="warning">当前工作区的生产环境访问凭据将在维护窗口结束后过期，请先检查所有关联应用的回调地址并轮换密钥，再通知团队成员更新客户端配置，期间已建立的会话会继续保留。</Banner> },
    { state: "dark", exports: ["Banner"], content: <StatePreview state="dark"><Banner tone="info">配置将在保存后生效。</Banner></StatePreview> },
    { state: "locale", exports: ["Banner"], content: <StatePreview state="locale"><Banner tone="info">配置将在保存后生效。</Banner></StatePreview> },
  ],
  content: <Banner tone="info">配置将在保存后生效。</Banner>,
  code: `<Banner tone="info">配置将在保存后生效。</Banner>
<Banner tone="warning" sticky>系统维护通知</Banner>`,
} satisfies ExplorerCase;

export default explorerCase;
