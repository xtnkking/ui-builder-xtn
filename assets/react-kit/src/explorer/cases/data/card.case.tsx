// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"card/overview","exports":["Card"]}
import { Card, StatusIndicator } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const explorerCase = {
  id: "card/overview",
  label: "信息卡片",
  summary: "卡片用于单个需要边界的内容对象，并提供标题、说明、正文和页脚区域。",
  states: ["default", "longContent", "dark", "locale"],
  content: (
    <Card heading="订单同步" description="最近一次后台任务" variant="outlined" footer={<StatusIndicator tone="success" label="已完成" detail="共 248 条" />}>
      所有增量记录已写入目标数据源，无需人工处理。
    </Card>
  ),
  code: `<Card heading="订单同步" description="最近一次后台任务" footer={<StatusIndicator label="已完成" />}>任务详情</Card>`,
} satisfies ExplorerCase;

export default explorerCase;
