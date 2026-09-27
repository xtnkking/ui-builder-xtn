// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"popover/overview","exports":["Popover"]}
import { useState } from "react";
import { Button, Popover, Stack } from "../../../personal-ui";
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
  states: ["default", "disabled", "readOnly", "controlled", "uncontrolled", "validation", "longContent", "keyboard", "overlay", "dark", "locale"],
  content: <PopoverExample />,
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
