import { useState } from "react";
import { Button, Card, FilterBar, Grid, Inline, SearchInput, Stack, Tag } from "../../../personal-ui";
import { StatePreview } from "../state-preview";
import type { ExplorerCase } from "../types";

function DensityExample() {
  const [query, setQuery] = useState("");
  const [applied, setApplied] = useState("");
  return (
    <Stack gap="large">
      <Inline gap="medium" align="end" wrap>
        <Stack gap="small"><span className="demo-foundation-caption">small · 32px</span><Button size="small">行内操作</Button></Stack>
        <Stack gap="small"><span className="demo-foundation-caption">medium · 38px</span><Button>普通操作</Button></Stack>
        <Stack gap="small"><span className="demo-foundation-caption">field · 44px</span><Button size="field" variant="primary">与字段对齐</Button></Stack>
      </Inline>
      <FilterBar ariaLabel="密度规范搜索演示" onSubmit={(event) => { event.preventDefault(); setApplied(query); }} actions={<Button type="submit" size="field" variant="primary">搜索</Button>}>
        <SearchInput aria-label="搜索示例名称" value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder="搜索框与按钮等高" />
      </FilterBar>
      <span role="status" className="demo-foundation-caption">当前提交：{applied || "尚未输入关键词"}（本例只更新本地展示）</span>
      <Grid minItemWidth="180px" gap="medium">
        <Card padding="small" heading="紧凑留白"><Tag>12px</Tag></Card>
        <Card padding="medium" heading="默认留白"><Tag>16px</Tag></Card>
        <Card padding="large" heading="宽松留白"><Tag>桌面 24px</Tag><p className="demo-foundation-note">窄屏由组件自动收为 16px。</p></Card>
      </Grid>
      <p className="demo-foundation-note">密度通过具体组件的 size、padding 与布局 gap 配置。当前没有全局 density 开关；不通过压缩字号或业务 CSS 改写控件高度。</p>
    </Stack>
  );
}

const explorerCase = {
  id: "density/overview",
  label: "操作高度与内容密度",
  summary: "查看按钮的三种高度、字段对齐方式和 Card 的三档留白；不同尺寸使用真实公开参数。",
  states: ["default", "mobile"],
  stateExamples: [
    { state: "default", exports: [], content: <DensityExample /> },
    { state: "mobile", exports: [], content: <StatePreview state="mobile"><DensityExample /></StatePreview>, instructions: "在 320px 容器内观察尺寸样例自然换行，以及 FilterBar 的组件自有移动布局。" },
  ],
  content: <DensityExample />,
  code: `<Button size="small">行内操作</Button>\n<Button>普通操作</Button>\n<Button size="field">与编辑框同高</Button>\n<Card padding="small" heading="紧凑留白">{children}</Card>`,
} satisfies ExplorerCase;

export default explorerCase;
