// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"hover-card/overview","exports":["HoverCard"]}
import { Avatar, HoverCard, Inline, Stack, Tag } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

function HoverCardExample() {
  return (
    <HoverCard triggerLabel="查看林夏资料" ariaLabel="林夏的资料卡">
      <Inline gap="medium" align="center">
        <Avatar name="林夏" />
        <Stack gap="small">
          <strong>林夏</strong>
          <span>客户成功 · lin.xia@example.com</span>
          <Tag tone="success">在线</Tag>
        </Stack>
      </Inline>
    </HoverCard>
  );
}

const explorerCase: ExplorerCase = {
  id: "hover-card/overview",
  label: "HoverCard 资料预览",
  summary: "指针悬停与键盘聚焦共享触发器，并在焦点离开后稳定关闭。",
  states: ["default", "disabled", "readOnly", "controlled", "uncontrolled", "validation", "longContent", "keyboard", "overlay", "dark", "locale"],
  content: <HoverCardExample />,
  code: `import { HoverCard } from "./personal-ui";

<HoverCard triggerLabel="查看林夏资料" ariaLabel="林夏的资料卡">
  {profileSummary}
</HoverCard>`,
};

export default explorerCase;
