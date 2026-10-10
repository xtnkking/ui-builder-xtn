import { useState } from "react";
import { Button, Dialog, Inline, Popover, Select, Stack, Tag } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

function LayerExample() {
  const [open, setOpen] = useState(false);
  const [nested, setNested] = useState(false);
  const [region, setRegion] = useState("cn");
  return (
    <Stack gap="large">
      <ol className="demo-foundation-layers">
        <li className="demo-foundation-layers__item"><Tag>页面内容</Tag><span className="demo-foundation-layer-description">普通内容和表格内部固定区域</span></li>
        <li className="demo-foundation-layers__item"><Tag tone="blue">主弹窗</Tag><span className="demo-foundation-layer-description">由共享层级内核管理遮罩、焦点与滚动锁</span></li>
        <li className="demo-foundation-layers__item"><Tag tone="blue">弹窗内浮层</Tag><span className="demo-foundation-layer-description">选择菜单与气泡挂载到当前弹窗所属层</span></li>
        <li className="demo-foundation-layers__item"><Tag tone="success">嵌套弹窗</Tag><span className="demo-foundation-layer-description">后打开的模态层接管焦点和 Escape</span></li>
      </ol>
      <Inline><Button variant="primary" onClick={() => setOpen(true)}>打开真实层级示例</Button></Inline>
      <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) setNested(false); }} title="主弹窗" description="打开菜单或嵌套弹窗，观察浮层所属关系。">
        <Stack gap="large">
          <Select ariaLabel="弹窗内地区" value={region} onValueChange={setRegion} options={[{ value: "cn", label: "中国大陆" }, { value: "gb", label: "英国" }, { value: "us", label: "美国" }]} />
          <Inline gap="medium" wrap>
            <Popover triggerLabel="显示弹窗内气泡" ariaLabel="层级说明"><p>这个气泡由官方 Popover 挂载到主弹窗所属层。</p></Popover>
            <Button onClick={() => setNested(true)}>打开嵌套弹窗</Button>
          </Inline>
          <Dialog open={nested} onOpenChange={setNested} title="嵌套弹窗" description="Escape 先关闭这一层，再返回主弹窗。"><span>焦点与层级由官方内核统一维护。</span></Dialog>
        </Stack>
      </Dialog>
      <p className="demo-foundation-note">层级不是页面自由填写的 z-index 参数。应用组合 Dialog、Select 与 Popover，避免给组件外层增加 transform、额外遮罩或随意提升层级。</p>
    </Stack>
  );
}

const explorerCase = {
  id: "z-index/overview",
  label: "浮层归属与嵌套顺序",
  summary: "用关系示意和可操作的官方 Dialog、Select、Popover 观察层级，避免把 CSS 初始层级数字误当成嵌套层的完整规则。",
  states: ["default", "overlay", "keyboard"],
  stateExamples: [
    { state: "default", exports: [], content: <LayerExample /> },
    { state: "overlay", exports: [], content: <LayerExample />, instructions: "打开主弹窗，分别打开地区菜单、气泡和嵌套弹窗，观察所属表面和遮罩顺序。" },
    { state: "keyboard", exports: [], content: <LayerExample />, instructions: "用 Tab 和 Enter 打开主弹窗、再打开嵌套弹窗；按 Escape 逐层关闭，观察焦点返回。此为人工操作步骤。" },
  ],
  content: <LayerExample />,
  code: `<Dialog open={open} onOpenChange={setOpen} title="主弹窗">\n  <Select ariaLabel="地区" value={region} onValueChange={setRegion} options={regions} />\n  <Dialog open={nested} onOpenChange={setNested} title="嵌套弹窗">\n    嵌套内容\n  </Dialog>\n</Dialog>`,
} satisfies ExplorerCase;

export default explorerCase;
