// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"tooltip/overview","exports":["Tooltip"]}
import { Button, Inline, Tooltip } from "../../../personal-ui";
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
  label: "Tooltip 状态",
  summary: "展示指针与键盘触发、禁用状态和由 Portal 承载的说明内容。",
  states: ["default", "disabled", "readOnly", "controlled", "uncontrolled", "validation", "longContent", "keyboard", "overlay", "dark", "locale"],
  content: <TooltipExample />,
  code: `import { Button, Tooltip } from "./personal-ui";

<Tooltip content="用于解释当前操作，不替代可见标签。">
  <Button>悬停或聚焦</Button>
</Tooltip>`,
};

export default explorerCase;
