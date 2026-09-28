// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"description/overview","exports":["DescriptionList"]}
import { DescriptionList } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const explorerCase = {
  id: "description/overview",
  label: "描述列表",
  summary: "用稳定的术语和值网格呈现详情，长值可以在自身列内换行。",
  states: ["default", "empty", "error", "longContent", "dark", "locale"],
  content: (
    <DescriptionList
      columns={2}
      divided
      items={[
        { id: "owner", term: "负责人", description: "林晓" },
        { id: "status", term: "状态", description: "运行中" },
        { id: "endpoint", term: "回调地址", description: "https://service.example.com/integrations/notifications/primary" },
        { id: "updated", term: "更新时间", description: "2026-09-22 14:30:00" },
      ]}
    />
  ),
  code: `<DescriptionList columns={2} divided items={details} />`,
} satisfies ExplorerCase;

export default explorerCase;
