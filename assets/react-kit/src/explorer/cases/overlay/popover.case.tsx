// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"popover/overview","exports":["Popover"]}
import { useState } from "react";
import { Button, Popover, Stack } from "../../../personal-ui";
import { StatePreview } from "../state-preview";
import type { ExplorerCase } from "../types";

function PopoverExample() {
  const [open, setOpen] = useState(false);
  return (
    <Popover
      triggerLabel="查看筛选摘要"
      ariaLabel="筛选摘要"
      open={open}
      onOpenChange={setOpen}
      placement="bottom"
    >
      <Stack gap="small">
        <strong>当前筛选</strong>
        <span>状态：启用，地区：中国大陆</span>
        <Button size="small" onClick={() => setOpen(false)}>完成</Button>
      </Stack>
    </Popover>
  );
}

const explorerCase: ExplorerCase = {
  id: "popover/overview",
  label: "Popover 受控浮层",
  summary: "受控打开状态、Escape 返回焦点和自适应定位使用同一公开实现。",
  states: ["default", "disabled", "controlled", "uncontrolled", "longContent", "keyboard", "overlay", "dark", "locale"],
  content: <PopoverExample />,
  stateExamples: [
    { state: "default", exports: ["Popover"], content: <PopoverExample /> },
    { state: "disabled", exports: ["Popover"], content: <Popover disabled triggerLabel="摘要不可用" ariaLabel="不可用的摘要">不可打开的摘要</Popover> },
    { state: "controlled", exports: ["Popover"], content: <PopoverExample /> },
    { state: "uncontrolled", exports: ["Popover"], content: <Popover defaultOpen={false} triggerLabel="组件管理打开状态" ariaLabel="非受控筛选摘要">状态：启用；地区：中国大陆</Popover> },
    { state: "longContent", exports: ["Popover"], content: <Popover triggerLabel="查看详细筛选说明" ariaLabel="详细筛选说明">当前筛选将查询全部产品中的角色配置、数据访问权限、通知偏好和账户安全设置，请确认所有筛选条件均符合团队的实际使用要求。</Popover> },
    { state: "keyboard", exports: ["Popover"], instructions: "用 Tab 聚焦摘要按钮，Enter 打开；在浮层中用 Tab 聚焦完成，Esc 关闭并返回触发按钮。", content: <PopoverExample /> },
    { state: "overlay", exports: ["Popover"], content: <StatePreview state="overlay"><PopoverExample /></StatePreview> },
    { state: "dark", exports: ["Popover"], content: <StatePreview state="dark"><PopoverExample /></StatePreview> },
    { state: "locale", exports: ["Popover"], content: <StatePreview state="locale"><Popover triggerLabel="Filter summary" ariaLabel="Active filters">Status: Active; Region: United States</Popover></StatePreview> },
  ],
  code: `import { Popover } from "./personal-ui";

<Popover
  triggerLabel="查看筛选摘要"
  ariaLabel="筛选摘要"
  open={open}
  onOpenChange={setOpen}
>
  {summary}
</Popover>`,
};

export default explorerCase;
