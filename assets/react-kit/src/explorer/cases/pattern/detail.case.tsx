// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"detail/overview","exports":["DetailPage"]}
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
  states: ["default", "loading", "empty", "error", "validation", "longContent", "keyboard", "mobile", "overlay", "dark", "locale"],
  content: <DetailExample />,
  code: `import { DetailPage } from "./personal-ui";

<DetailPage title="API 凭证" sections={sections} aside={securityAdvice} />`,
};

export default explorerCase;
