import { Box, Card, Grid, Stack } from "../../../personal-ui";
import { StatePreview } from "../state-preview";
import type { ExplorerCase } from "../types";

function SurfaceExample() {
  return (
    <Stack gap="large">
      <Grid minItemWidth="200px" gap="large">
        <Card variant="outlined" heading="描边表面" description="outlined · 默认"><span>清晰的边界，适合普通内容分组。</span></Card>
        <Card variant="subtle" heading="浅色表面" description="subtle"><span>通过轻微底色区分次级信息。</span></Card>
        <Card variant="raised" heading="抬升表面" description="raised"><span>使用规范阴影，体现表面层次。</span></Card>
      </Grid>
      <Grid minItemWidth="180px" gap="medium">
        <div className="demo-foundation-border"><strong>普通边框</strong><span>内容分组</span></div>
        <div className="demo-foundation-border demo-foundation-border--strong"><strong>强调边框</strong><span>强调边界</span></div>
      </Grid>
      <Box surface="subtle" padding="medium">Box 适合非交互布局表面；有标题、说明或页脚的内容使用 Card。过滤栏默认保持无背景，不因展示表面规范而额外套卡片。</Box>
    </Stack>
  );
}

const explorerCase = {
  id: "surface/overview",
  label: "描边、底色与阴影表面",
  summary: "真实 Card 的 outlined、subtle、raised 三种公开变体，以及随主题变化的语义边框。",
  states: ["default", "dark"],
  stateExamples: [
    { state: "default", exports: [], content: <SurfaceExample /> },
    { state: "dark", exports: [], content: <StatePreview state="dark"><SurfaceExample /></StatePreview> },
  ],
  content: <SurfaceExample />,
  code: `<Card variant="outlined" heading="普通内容">{children}</Card>\n<Card variant="subtle" heading="辅助信息">{children}</Card>\n<Card variant="raised" heading="强调内容">{children}</Card>`,
} satisfies ExplorerCase;

export default explorerCase;
