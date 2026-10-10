// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"tooltip/overview","exports":["Tooltip"]}
import { Button, Inline, Tooltip } from "../../../personal-ui";
import { StatePreview } from "../state-preview";
import type { ExplorerCase } from "../types";

function TooltipExample() {
  return (
    <Inline gap="medium" wrap>
      <Tooltip content="用于解释当前操作，不替代可见标签。">
        <Button>悬停或聚焦</Button>
      </Tooltip>
      <Tooltip content="禁用状态不会打开浮层" disabled>
        <Button disabled>禁用提示</Button>
      </Tooltip>
    </Inline>
  );
}

const explorerCase: ExplorerCase = {
  id: "tooltip/overview",
  label: "文字提示状态",
  summary: "展示指针与键盘触发、禁用状态和由 Portal 承载的说明内容。",
  states: ["default", "disabled", "longContent", "keyboard", "overlay", "dark", "locale"],
  content: <TooltipExample />,
  stateExamples: [
    { state: "default", exports: ["Tooltip"], content: <Tooltip content="说明文字不替代可见标签。"><Button>悬停或聚焦</Button></Tooltip> },
    { state: "disabled", exports: ["Tooltip"], content: <Tooltip disabled content="禁用时不显示这段说明。"><Button>提示已禁用</Button></Tooltip> },
    { state: "longContent", exports: ["Tooltip"], content: <Tooltip content="此操作会保存当前成员在全部产品中的角色配置、数据访问权限、通知偏好和账户安全设置，请确认所有配置均符合团队的实际使用要求。"><Button>查看完整说明</Button></Tooltip> },
    { state: "keyboard", exports: ["Tooltip"], instructions: "用 Tab 聚焦按钮以显示说明，按 Esc 关闭提示，再用 Tab 移出；禁用示例不会打开提示。", content: <TooltipExample /> },
    { state: "overlay", exports: ["Tooltip"], content: <StatePreview state="overlay"><TooltipExample /></StatePreview> },
    { state: "dark", exports: ["Tooltip"], content: <StatePreview state="dark"><TooltipExample /></StatePreview> },
    { state: "locale", exports: ["Tooltip"], content: <StatePreview state="locale"><Tooltip content="Save the current configuration without leaving this page."><Button>Save preferences</Button></Tooltip></StatePreview> },
  ],
  code: `import { Button, Tooltip } from "./personal-ui";

<Tooltip content="用于解释当前操作，不替代可见标签。">
  <Button>悬停或聚焦</Button>
</Tooltip>`,
};

export default explorerCase;
