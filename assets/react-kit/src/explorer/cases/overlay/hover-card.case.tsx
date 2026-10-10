// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"hover-card/overview","exports":["HoverCard"]}
import { Avatar, HoverCard, Inline, Stack, Tag } from "../../../personal-ui";
import { useState } from "react";
import { StatePreview } from "../state-preview";
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

function ControlledHoverCardExample() {
  const [open, setOpen] = useState(false);
  return <><HoverCard triggerLabel="查看受控资料卡" ariaLabel="受控资料卡" open={open} onOpenChange={setOpen}><strong>林夏</strong><p>客户成功 · lin.xia@example.com</p></HoverCard><p role="status">资料卡：{open ? "已打开" : "已关闭"}</p></>;
}

const explorerCase: ExplorerCase = {
  id: "hover-card/overview",
  label: "悬停资料预览",
  summary: "指针悬停与键盘聚焦共享触发器，并在焦点离开后稳定关闭。",
  states: ["default", "disabled", "controlled", "uncontrolled", "longContent", "keyboard", "overlay", "dark", "locale"],
  content: <HoverCardExample />,
  stateExamples: [
    { state: "default", exports: ["HoverCard"], content: <HoverCardExample /> },
    { state: "disabled", exports: ["HoverCard"], content: <HoverCard disabled triggerLabel="资料预览不可用" ariaLabel="禁用资料卡">不可打开的资料</HoverCard> },
    { state: "controlled", exports: ["HoverCard"], content: <ControlledHoverCardExample /> },
    { state: "uncontrolled", exports: ["HoverCard"], content: <HoverCard defaultOpen={false} triggerLabel="查看非受控资料卡" ariaLabel="非受控资料卡"><strong>林夏</strong><p>客户成功 · lin.xia@example.com</p></HoverCard> },
    { state: "longContent", exports: ["HoverCard"], content: <HoverCard triggerLabel="查看完整资料" ariaLabel="完整成员资料">此成员负责全部产品的客户支持、账户安全、数据访问权限、通知偏好和操作审计管理，需要在团队成员列表中持续保持完整的联系方式。</HoverCard> },
    { state: "keyboard", exports: ["HoverCard"], instructions: "用 Tab 聚焦资料按钮以打开资料卡，按 Esc 关闭；再次聚焦可重新打开，Tab 移出时关闭。", content: <ControlledHoverCardExample /> },
    { state: "overlay", exports: ["HoverCard"], content: <StatePreview state="overlay"><HoverCardExample /></StatePreview> },
    { state: "dark", exports: ["HoverCard"], content: <StatePreview state="dark"><HoverCardExample /></StatePreview> },
    { state: "locale", exports: ["HoverCard"], content: <StatePreview state="locale"><HoverCard triggerLabel="View Alex's profile" ariaLabel="Alex's profile"><strong>Alex</strong><p>Customer success · alex@example.com</p></HoverCard></StatePreview> },
  ],
  code: `import { HoverCard } from "./personal-ui";

<HoverCard triggerLabel="查看林夏资料" ariaLabel="林夏的资料卡">
  {profileSummary}
</HoverCard>`,
};

export default explorerCase;
