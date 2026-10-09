// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"detail/overview","exports":["DetailPage"]}
import { StatePreview } from "../state-preview";
import { Button, Card, DescriptionList, DetailPage, Tag } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

function DetailExample() {
  return (
    <DetailPage
      title="API 凭证"
      description="生产环境凭证详情"
      actions={<Button>轮换密钥</Button>}
      sections={[
        { id: "overview", title: "基本信息", content: <DescriptionList columns={2} items={[{ id: "status", term: "状态", description: <Tag tone="success">启用</Tag> }, { id: "created", term: "创建时间", description: "2026-09-22 10:30" }, { id: "owner", term: "负责人", description: "平台团队" }, { id: "environment", term: "环境", description: "Production" }]} /> },
        { id: "scope", title: "授权范围", content: <p>读取成员、写入审计日志。</p> },
      ]}
      aside={<Card heading="安全建议">每 90 天轮换一次密钥。</Card>}
    />
  );
}

const explorerCase: ExplorerCase = {
  id: "detail/overview",
  label: "详情页面",
  summary: "主内容、分组信息、操作和辅助栏在窄屏下保持稳定阅读顺序。",
  states: ["default", "empty", "longContent", "keyboard", "mobile", "overlay", "dark", "locale"],
  stateExamples: [
    { state: "empty", exports: ["DetailPage"], content: <DetailPage title="暂无详情项" sections={[]} /> },
    { state: "longContent", exports: ["DetailPage"], content: <DetailPage title="完整凭证资料" description="此页面展示全部产品中的角色配置、数据访问权限、通知偏好和账户安全设置，请确认所有关联配置均符合团队的实际使用要求。" sections={[{ id: "details", title: "配置", content: <p>详细配置由页面提供。</p> }]} /> },
    { state: "default", exports: ["DetailPage"], content: <DetailExample /> },
    { state: "keyboard", exports: ["DetailPage"], content: <DetailExample />, instructions: "用 Tab 访问本例可用控件，使用 Enter、Space 和组件文档中的方向键操作。此项为人工操作案例，不是自动行为验收证书。" },
    { state: "mobile", exports: ["DetailPage"], content: <StatePreview state="mobile">{<DetailExample />}</StatePreview> },
    { state: "overlay", exports: ["DetailPage"], content: <StatePreview state="overlay">{<DetailExample />}</StatePreview> },
    { state: "dark", exports: ["DetailPage"], content: <StatePreview state="dark">{<DetailExample />}</StatePreview> },
    { state: "locale", exports: ["DetailPage"], content: <StatePreview state="locale">{<DetailExample />}</StatePreview> },
  ],
  content: <DetailExample />,
  code: `import { DetailPage } from "./personal-ui";

<DetailPage title="API 凭证" sections={sections} aside={securityAdvice} />`,
};

export default explorerCase;
