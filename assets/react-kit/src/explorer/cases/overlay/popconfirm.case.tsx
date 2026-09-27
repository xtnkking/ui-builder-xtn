// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"popconfirm/overview","exports":["Popconfirm"]}
import { Inline, Popconfirm } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

function PopconfirmExample() {
  return (
    <Inline gap="medium" wrap>
      <Popconfirm
        triggerLabel="移除成员"
        ariaLabel="确认移除成员"
        title="移除林夏？"
        description="成员将失去当前工作区权限。"
        confirmLabel="移除"
        onConfirm={async () => undefined}
      />
      <Popconfirm
        triggerLabel="不可操作"
        ariaLabel="不可操作的确认"
        title="当前操作不可用"
        disabled
        onConfirm={() => undefined}
      />
    </Inline>
  );
}

const explorerCase: ExplorerCase = {
  id: "popconfirm/overview",
  label: "Popconfirm 就地确认",
  summary: "用于低复杂度危险操作，展示异步确认、禁用和错误承载边界。",
  states: ["default", "disabled", "readOnly", "controlled", "uncontrolled", "validation", "longContent", "keyboard", "overlay", "dark", "locale"],
  content: <PopconfirmExample />,
  code: `import { Popconfirm } from "./personal-ui";

<Popconfirm
  triggerLabel="移除成员"
  ariaLabel="确认移除成员"
  title="移除林夏？"
  onConfirm={removeMember}
/>`,
};

export default explorerCase;
