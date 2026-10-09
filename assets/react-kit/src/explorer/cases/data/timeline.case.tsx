// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"timeline/overview","exports":["Timeline"]}
import { StatePreview } from "../state-preview";
import { Timeline } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const explorerCase = {
  id: "timeline/overview",
  label: "事件时间线",
  summary: "以有序、带时间语义的结构展示状态变更，并允许每项使用独立状态色。",
  states: ["default", "empty", "longContent", "dark", "locale"],
  stateExamples: [
    { state: "empty", exports: ["Timeline"], content: <><Timeline ariaLabel="没有事件记录" items={[]} /><p>当前没有事件；页面提供空态说明。</p></> },
    { state: "longContent", exports: ["Timeline"], content: <Timeline ariaLabel="详细配置事件" items={[{ id: "config", title: "更新配置", description: "此事件更新全部产品中的角色配置、数据访问权限、通知偏好和账户安全设置，请在保存前确认所有关联配置均符合团队的实际使用要求。", tone: "blue" }]} /> },
    { state: "default", exports: ["Timeline"], content: (
    <Timeline
      ariaLabel="发布进度"
      items={[
        { id: "created", title: "创建发布", description: "已锁定构建输入。", time: "09:20", dateTime: "2026-09-22T09:20:00+08:00", tone: "blue" },
        { id: "checked", title: "质量检查通过", description: "类型、行为与可访问性检查均通过。", time: "09:32", dateTime: "2026-09-22T09:32:00+08:00", tone: "success" },
        { id: "waiting", title: "等待审批", time: "当前", tone: "warning" },
      ]}
    />
  ) },
    { state: "dark", exports: ["Timeline"], content: <StatePreview state="dark">{(
    <Timeline
      ariaLabel="发布进度"
      items={[
        { id: "created", title: "创建发布", description: "已锁定构建输入。", time: "09:20", dateTime: "2026-09-22T09:20:00+08:00", tone: "blue" },
        { id: "checked", title: "质量检查通过", description: "类型、行为与可访问性检查均通过。", time: "09:32", dateTime: "2026-09-22T09:32:00+08:00", tone: "success" },
        { id: "waiting", title: "等待审批", time: "当前", tone: "warning" },
      ]}
    />
  )}</StatePreview> },
    { state: "locale", exports: ["Timeline"], content: <StatePreview state="locale">{(
    <Timeline
      ariaLabel="发布进度"
      items={[
        { id: "created", title: "创建发布", description: "已锁定构建输入。", time: "09:20", dateTime: "2026-09-22T09:20:00+08:00", tone: "blue" },
        { id: "checked", title: "质量检查通过", description: "类型、行为与可访问性检查均通过。", time: "09:32", dateTime: "2026-09-22T09:32:00+08:00", tone: "success" },
        { id: "waiting", title: "等待审批", time: "当前", tone: "warning" },
      ]}
    />
  )}</StatePreview> },
  ],
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
