// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"clipboard/overview","exports":["ClipboardButton"]}
import { StatePreview } from "../state-preview";
import { ClipboardButton, Inline } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const explorerCase = {
  id: "clipboard/overview",
  label: "复制按钮",
  summary: "复制动作包含处理中、成功和失败反馈，并为图标模式保留稳定的可访问名称。",
  states: ["default", "disabled", "longContent", "keyboard", "dark", "locale"],
  stateExamples: [
    { state: "longContent", exports: ["ClipboardButton"], content: <ClipboardButton text="copied fixture text" label="复制全部产品中的角色配置、数据访问权限、通知偏好和账户安全设置的完整说明，请确认所有配置均符合团队的实际使用要求。" /> },
    { state: "default", exports: ["ClipboardButton"], content: <Inline><ClipboardButton text="sk_live_example" label="复制 API 密钥" /><ClipboardButton text="disabled" disabled label="不可复制" /></Inline> },
    { state: "disabled", exports: ["ClipboardButton"], content: <Inline><ClipboardButton text="sk_live_example" label="复制 API 密钥" /><ClipboardButton text="disabled" disabled label="不可复制" /></Inline> },
    { state: "keyboard", exports: ["ClipboardButton"], content: <Inline><ClipboardButton text="sk_live_example" label="复制 API 密钥" /><ClipboardButton text="disabled" disabled label="不可复制" /></Inline>, instructions: "用 Tab 访问本例可用控件，使用 Enter、Space 和组件文档中的方向键操作。此项为人工操作案例，不是自动行为验收证书。" },
    { state: "dark", exports: ["ClipboardButton"], content: <StatePreview state="dark">{<Inline><ClipboardButton text="sk_live_example" label="复制 API 密钥" /><ClipboardButton text="disabled" disabled label="不可复制" /></Inline>}</StatePreview> },
    { state: "locale", exports: ["ClipboardButton"], content: <StatePreview state="locale">{<Inline><ClipboardButton text="sk_live_example" label="复制 API 密钥" /><ClipboardButton text="disabled" disabled label="不可复制" /></Inline>}</StatePreview> },
  ],
  content: <Inline><ClipboardButton text="sk_live_example" label="复制 API 密钥" /><ClipboardButton text="disabled" disabled label="不可复制" /></Inline>,
  code: `<ClipboardButton text={apiKey} label="复制 API 密钥" />`,
} satisfies ExplorerCase;

export default explorerCase;
