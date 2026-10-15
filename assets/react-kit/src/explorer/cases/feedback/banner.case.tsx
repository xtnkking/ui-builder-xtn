// @ui-coverage {"kind":"example","runner":"explorer","caseId":"banner/overview","exports":["Banner"]}
import { StatePreview } from "../state-preview";
import { useState } from "react";
import { Banner, Button, Stack } from "../../../ui";
import type { ExplorerCase } from "../types";

function MaintenanceBannerExample() {
  const [details, setDetails] = useState(false);
  return <Stack>
    <p>当前工作区的维护通知会持续显示，可通过通知中的按钮查看详情，也可单独关闭通知。</p>
    <Banner tone="warning" title="维护通知" action={<Button size="small" onClick={() => setDetails(true)}>查看维护详情</Button>}>今晚 23:00–23:30 暂停配置保存，已保存的数据不受影响。</Banner>
    {details ? <p role="status">维护详情：今晚 23:00–23:30 更新配置服务；维护结束后可继续保存。</p> : null}
  </Stack>;
}

const explorerCase = {
  id: "banner/overview",
  label: "全局横幅",
  summary: "横幅通过官方轻提示浮层持续显示，保留标题、正文和业务操作；不会在页面内插入大块提示区域。",
  states: ["default","error","longContent","dark","locale"],
  stateExamples: [
    { state: "default", exports: ["Banner"], instructions: "持续通知复用当前 ToastProvider 的位置和可见数量策略；点击查看详情更新页面内容，不重复生成通知。sticky 不再切换为贴边大区域。", content: <MaintenanceBannerExample /> },
    { state: "error", exports: ["Banner"], content: <Banner tone="danger">连接失败，请检查网络后重试。</Banner> },
    { state: "longContent", exports: ["Banner"], content: <Banner tone="warning">当前工作区的生产环境访问凭据将在维护窗口结束后过期，请先检查所有关联应用的回调地址并轮换密钥，再通知团队成员更新客户端配置，期间已建立的会话会继续保留。</Banner> },
    { state: "dark", exports: ["Banner"], content: <StatePreview state="dark"><Banner tone="info">配置将在保存后生效。</Banner></StatePreview> },
    { state: "locale", exports: ["Banner"], content: <StatePreview state="locale"><Banner tone="info">配置将在保存后生效。</Banner></StatePreview> },
  ],
  content: <MaintenanceBannerExample />,
  code: `<Banner tone="warning" title="维护通知" action={<Button size="small" onClick={showDetails}>查看维护详情</Button>}>
  今晚 23:00–23:30 暂停配置保存，已保存的数据不受影响。
</Banner>`,
} satisfies ExplorerCase;

export default explorerCase;
