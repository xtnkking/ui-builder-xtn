// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"popconfirm/overview","exports":["Popconfirm"]}
import { Inline, Popconfirm } from "../../../personal-ui";
import { StatePreview } from "../state-preview";
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
  label: "就地气泡确认",
  summary: "用于低复杂度危险操作，展示异步确认、禁用和错误承载边界。",
  states: ["default", "disabled", "loading", "error", "longContent", "keyboard", "overlay", "dark", "locale"],
  content: <PopconfirmExample />,
  stateExamples: [
    { state: "default", exports: ["Popconfirm"], content: <PopconfirmExample /> },
    { state: "disabled", exports: ["Popconfirm"], content: <Popconfirm disabled triggerLabel="不可操作" ariaLabel="不可操作的确认" title="当前操作不可用" onConfirm={() => undefined} /> },
    { state: "loading", exports: ["Popconfirm"], instructions: "打开确认框并点击确认；异步操作持续 1.8 秒，期间确认按钮显示加载、取消按钮禁用。", content: <Popconfirm triggerLabel="模拟异步移除" ariaLabel="异步移除确认" title="移除成员？" onConfirm={async () => { await new Promise<void>((resolve) => setTimeout(resolve, 1800)); }} /> },
    { state: "error", exports: ["Popconfirm"], instructions: "打开确认框并点击确认；操作失败后显示错误消息，浮层保持打开，可以取消。", content: <Popconfirm triggerLabel="模拟移除失败" ariaLabel="失败确认案例" title="移除成员？" errorMessage="模拟服务器拒绝，成员未被移除。" onConfirm={async () => { throw new Error("offline fixture rejection"); }} /> },
    { state: "longContent", exports: ["Popconfirm"], content: <Popconfirm triggerLabel="查看移除影响" ariaLabel="移除成员的详细影响" title="确认移除成员？" description="移除后该成员将失去全部产品中的角色配置、数据访问权限、通知偏好和账户安全设置管理能力，请确认所有关联权限均可以从团队中安全撤销。" onConfirm={() => undefined} /> },
    { state: "keyboard", exports: ["Popconfirm"], instructions: "用 Tab 聚焦移除成员，按 Enter 打开；Tab 切换取消与移除，Esc 关闭并返回触发器。", content: <PopconfirmExample /> },
    { state: "overlay", exports: ["Popconfirm"], content: <StatePreview state="overlay"><PopconfirmExample /></StatePreview> },
    { state: "dark", exports: ["Popconfirm"], content: <StatePreview state="dark"><PopconfirmExample /></StatePreview> },
    { state: "locale", exports: ["Popconfirm"], content: <StatePreview state="locale"><Popconfirm triggerLabel="Remove member" ariaLabel="Confirm member removal" title="Remove this member?" onConfirm={() => undefined} /></StatePreview> },
  ],
  code: `import { Popconfirm } from "./personal-ui";

<Popconfirm
  triggerLabel="移除成员"
  ariaLabel="确认移除成员"
  title="移除林夏？"
  onConfirm={removeMember}
/>`,
};

export default explorerCase;
