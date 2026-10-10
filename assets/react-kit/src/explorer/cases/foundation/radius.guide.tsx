import { Button, Grid, Inline, Input, Stack, Tag } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

function RadiusExample() {
  return (
    <Stack gap="large">
      <Grid minItemWidth="160px" gap="large">
        <div className="demo-foundation-radius demo-foundation-radius--surface"><strong>表面 · 8px</strong><span>内容容器</span></div>
        <div className="demo-foundation-radius demo-foundation-radius--control"><strong>编辑框 · 12px</strong><span>输入控件</span></div>
        <div className="demo-foundation-radius demo-foundation-radius--table"><strong>表格 · 12px</strong><span>表格边界</span></div>
        <div className="demo-foundation-radius demo-foundation-radius--pill"><strong>胶囊 · 999px</strong><span>按钮与标签</span></div>
      </Grid>
      <Input aria-label="圆角编辑框示例" placeholder="真实 Input 的圆角" />
      <Inline gap="medium" wrap><Button variant="primary">胶囊按钮</Button><Tag tone="blue">胶囊标签</Tag><Tag>中性标签</Tag></Inline>
      <p className="demo-foundation-note">上方色块仅用于观察圆角。几何 token 属于组件内部规范，ThemeProvider 不开放任意圆角覆盖；业务页面使用组件公开变体。</p>
    </Stack>
  );
}

const explorerCase = {
  id: "radius/overview",
  label: "表面圆角与胶囊轮廓",
  summary: "并排查看内部圆角规范，再对照真实 Input、Button 和 Tag；不把示意色块当作新的组件 API。",
  states: ["default"],
  stateExamples: [{ state: "default", exports: [], content: <RadiusExample /> }],
  content: <RadiusExample />,
  code: `<Input aria-label="姓名" placeholder="请输入姓名" />\n<Button variant="primary">保存</Button>\n<Tag tone="blue">已启用</Tag>`,
} satisfies ExplorerCase;

export default explorerCase;
