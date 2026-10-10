import { useState } from "react";
import { Bell, Check, ChevronRight, Download, Plus, Search } from "lucide-react";
import { Button, IconButton, Inline, Stack, Tag } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

function IconsExample() {
  const [count, setCount] = useState(0);
  return (
    <Stack gap="large">
      <Inline gap="medium" wrap>
        <Button variant="primary" icon={<Plus />} onClick={() => setCount((value) => value + 1)}>新增</Button>
        <Button icon={<Download />} onClick={() => setCount((value) => value + 1)}>导出</Button>
        <Button trailingIcon={<ChevronRight />} onClick={() => setCount((value) => value + 1)}>下一步</Button>
        <IconButton icon={<Search />} aria-label="执行搜索示例" onClick={() => setCount((value) => value + 1)} />
      </Inline>
      <Inline gap="medium" wrap><Tag tone="success" leading={<Check />}>已完成</Tag><Tag tone="blue" leading={<Bell />}>订阅通知</Tag><Tag>无图标</Tag></Inline>
      <span role="status" className="demo-foundation-caption">已触发 {count} 次示例操作</span>
      <p className="demo-foundation-note">Lucide 图标通过 icon、trailingIcon 或 leading 插槽传入，尺寸与对齐由组件负责。只有图标的操作必须提供 aria-label；装饰图标不重复朗读按钮文字。</p>
    </Stack>
  );
}

const explorerCase = {
  id: "icons/overview",
  label: "图标插槽与文字对齐",
  summary: "前置、后置、纯图标操作和标签图标都使用官方组件插槽，避免业务 CSS 单独定位图标。",
  states: ["default", "keyboard"],
  stateExamples: [
    { state: "default", exports: [], content: <IconsExample /> },
    { state: "keyboard", exports: [], content: <IconsExample />, instructions: "用 Tab 依次访问四个操作，再用 Enter 或 Space 触发；观察操作次数和纯图标按钮的可访问名称。" },
  ],
  content: <IconsExample />,
  code: `import { Plus, Search, Check } from "lucide-react";\n\n<Button icon={<Plus />} onClick={handleCreate}>新增</Button>\n<IconButton icon={<Search />} aria-label="搜索" onClick={handleSearch} />\n<Tag leading={<Check />} tone="success">已完成</Tag>`,
} satisfies ExplorerCase;

export default explorerCase;
