import { Box, Grid, Inline, Stack, type LayoutSpace } from "../../../personal-ui";
import { StatePreview } from "../state-preview";
import type { ExplorerCase } from "../types";

const spaces: readonly { value: LayoutSpace; pixels: number; label: string }[] = [
  { value: "none", pixels: 0, label: "无间距" },
  { value: "xsmall", pixels: 4, label: "图标附近" },
  { value: "small", pixels: 8, label: "关联操作" },
  { value: "medium", pixels: 16, label: "表单字段" },
  { value: "large", pixels: 24, label: "内容分组" },
  { value: "xlarge", pixels: 32, label: "主要区块" },
];

function SpacingExample() {
  return (
    <Stack gap="large">
      <Grid minItemWidth="150px" gap="large">
        {spaces.map((space) => (
          <Stack key={space.value} gap="small">
            <strong>{space.value} · {space.pixels}px</strong>
            <Inline gap={space.value} wrap={false}>
              <span className="demo-foundation-spacing-unit" />
              <span className="demo-foundation-spacing-unit" />
            </Inline>
            <span className="demo-foundation-caption">{space.label}</span>
          </Stack>
        ))}
      </Grid>
      <Box surface="subtle" padding="large">
        <Stack gap="medium">
          <strong>内部留白 24px，内容间距 16px</strong>
          <span>通过 Box.padding 和 Stack.gap 组合，不给按钮或编辑框额外添加 margin。</span>
        </Stack>
      </Box>
    </Stack>
  );
}

const explorerCase = {
  id: "spacing/overview",
  label: "间距阶梯与布局留白",
  summary: "用真实 Box、Stack、Inline 和 Grid 展示 0、4、8、16、24、32px 的公开布局档位。",
  states: ["default", "mobile"],
  stateExamples: [
    { state: "default", exports: [], content: <SpacingExample /> },
    { state: "mobile", exports: [], content: <StatePreview state="mobile"><SpacingExample /></StatePreview>, instructions: "在 320px 容器内观察间距样例自动换列，内容分组仍保留各自的留白。" },
  ],
  content: <SpacingExample />,
  code: `<Box padding="large" surface="subtle">\n  <Stack gap="medium">\n    <strong>内容分组</strong>\n    <Inline gap="small" wrap>{children}</Inline>\n  </Stack>\n</Box>`,
} satisfies ExplorerCase;

export default explorerCase;
