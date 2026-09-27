// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"timeline/overview","exports":["Timeline"]}
import { Timeline } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const explorerCase = {
  id: "timeline/overview",
  label: "事件时间线",
  summary: "以有序、带时间语义的结构展示状态变更，并允许每项使用独立状态色。",
  states: ["default", "empty", "error", "longContent", "dark", "locale"],
  content: (
    <Timeline
      ariaLabel="发布进度"
      items={[
        { id: "created", title: "创建发布", description: "已锁定构建输入。", time: "09:20", dateTime: "2026-09-22T09:20:00+08:00", tone: "blue" },
        { id: "checked", title: "质量检查通过", description: "类型、行为与可访问性检查均通过。", time: "09:32", dateTime: "2026-09-22T09:32:00+08:00", tone: "success" },
        { id: "waiting", title: "等待审批", time: "当前", tone: "warning" },
      ]}
    />
  ),
  code: `<Timeline ariaLabel="发布进度" items={events} />`,
} satisfies ExplorerCase;

export default explorerCase;
