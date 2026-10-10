import { Card, Stack } from "../../../personal-ui";
import { StatePreview } from "../state-preview";
import type { ExplorerCase } from "../types";

function TypographyExample() {
  return (
    <Stack gap="large">
      <div className="demo-foundation-type">
        <span className="demo-foundation-caption">系统字体 · 中文与拉丁字母回退</span>
        <p className="demo-foundation-type__heading">清晰、克制的产品界面</p>
        <p className="demo-foundation-type__body">正文 14px / 1.5。团队成员、项目名称与操作说明保持易读，长内容自然换行。</p>
        <p className="demo-foundation-type__secondary">辅助信息 12px · 更新时间 2026-10-10</p>
        <p className="demo-foundation-type__numbers">金额与编号：12,480.00 · XTN-2026-001</p>
      </div>
      <Card heading="真实 Card 标题" description="标题 16px，说明 13px；直接使用组件的默认排版。">
        组件内的字号与字重由规范源码维护，业务页面只填写标题、说明和内容。
      </Card>
    </Stack>
  );
}

const explorerCase = {
  id: "typography/overview",
  label: "字体层级与长文本",
  summary: "展示系统字体、正文和辅助信息的排版，以及真实 Card 的标题层级。字体基础规范没有独立运行时控件。",
  states: ["default", "longContent", "dark"],
  stateExamples: [
    { state: "default", exports: [], content: <TypographyExample /> },
    { state: "longContent", exports: [], content: <Card heading="跨地区团队成员账户安全策略、访问权限与审批记录管理" description="较长的标题与描述由真实 Card 自然换行，不截断重要信息。">名称、日期与说明长度变化时，保留阅读顺序和正常行距，避免通过缩小字号容纳业务内容。</Card> },
    { state: "dark", exports: [], content: <StatePreview state="dark"><TypographyExample /></StatePreview> },
  ],
  content: <TypographyExample />,
  code: `<Card heading="团队成员" description="管理账户和访问权限">\n  正文内容\n</Card>\n\n/* 业务非交互文本继承规范字体；\n   不通过 CSS 覆盖组件内部文字。 */`,
} satisfies ExplorerCase;

export default explorerCase;
