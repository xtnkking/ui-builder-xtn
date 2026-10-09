// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"accordion/overview","exports":["Accordion"]}
import { StatePreview } from "../state-preview";
import { Accordion } from "../../../personal-ui";
import { useState } from "react";
import type { ExplorerCase } from "../types";

function ControlledAccordionExample() {
  const [value, setValue] = useState<string[]>(["scope"]);
  return <><Accordion value={value} onValueChange={setValue} ariaLabel="受控接入说明" items={[{ id: "scope", title: "授权范围", content: "最小权限" }, { id: "callback", title: "回调配置", content: "HTTPS 回调" }]} /><p role="status">展开项：{value.join("、") || "无"}</p></>;
}

const explorerCase = {
  id: "accordion/overview",
  label: "手风琴",
  summary: "可同时展开多项，禁用项不会进入操作流程，按钮保留标准键盘行为。",
  states: ["default", "disabled", "controlled", "uncontrolled", "empty", "longContent", "keyboard", "overlay", "dark", "locale"],
  stateExamples: [
    { state: "controlled", exports: ["Accordion"], content: <ControlledAccordionExample /> },
    { state: "empty", exports: ["Accordion"], content: <><Accordion items={[]} ariaLabel="空接入说明" /><p>没有可展开的说明。</p></> },
    { state: "longContent", exports: ["Accordion"], content: <Accordion defaultValue={["details"]} items={[{ id: "details", title: "完整配置说明", content: "此配置说明覆盖全部产品中的角色配置、数据访问权限、通知偏好和账户安全设置，请在保存前确认所有关联配置均符合团队的实际使用要求。" }]} /> },
    { state: "default", exports: ["Accordion"], content: (
    <Accordion
      type="multiple"
      defaultValue={["scope"]}
      ariaLabel="接入说明"
      items={[
        { id: "scope", title: "授权范围", content: "只请求完成同步所需的最小权限。" },
        { id: "callback", title: "回调配置", content: "配置 HTTPS 地址并完成一次签名校验。" },
        { id: "legacy", title: "旧版协议", content: "已停用。", disabled: true },
      ]}
    />
  ) },
    { state: "disabled", exports: ["Accordion"], content: (
    <Accordion
      type="multiple"
      defaultValue={["scope"]}
      ariaLabel="接入说明"
      items={[
        { id: "scope", title: "授权范围", content: "只请求完成同步所需的最小权限。" },
        { id: "callback", title: "回调配置", content: "配置 HTTPS 地址并完成一次签名校验。" },
        { id: "legacy", title: "旧版协议", content: "已停用。", disabled: true },
      ]}
    />
  ) },
    { state: "uncontrolled", exports: ["Accordion"], content: (
    <Accordion
      type="multiple"
      defaultValue={["scope"]}
      ariaLabel="接入说明"
      items={[
        { id: "scope", title: "授权范围", content: "只请求完成同步所需的最小权限。" },
        { id: "callback", title: "回调配置", content: "配置 HTTPS 地址并完成一次签名校验。" },
        { id: "legacy", title: "旧版协议", content: "已停用。", disabled: true },
      ]}
    />
  ) },
    { state: "keyboard", exports: ["Accordion"], content: (
    <Accordion
      type="multiple"
      defaultValue={["scope"]}
      ariaLabel="接入说明"
      items={[
        { id: "scope", title: "授权范围", content: "只请求完成同步所需的最小权限。" },
        { id: "callback", title: "回调配置", content: "配置 HTTPS 地址并完成一次签名校验。" },
        { id: "legacy", title: "旧版协议", content: "已停用。", disabled: true },
      ]}
    />
  ), instructions: "用 Tab 访问本例可用控件，使用 Enter、Space 和组件文档中的方向键操作。此项为人工操作案例，不是自动行为验收证书。" },
    { state: "overlay", exports: ["Accordion"], content: <StatePreview state="overlay">{(
    <Accordion
      type="multiple"
      defaultValue={["scope"]}
      ariaLabel="接入说明"
      items={[
        { id: "scope", title: "授权范围", content: "只请求完成同步所需的最小权限。" },
        { id: "callback", title: "回调配置", content: "配置 HTTPS 地址并完成一次签名校验。" },
        { id: "legacy", title: "旧版协议", content: "已停用。", disabled: true },
      ]}
    />
  )}</StatePreview> },
    { state: "dark", exports: ["Accordion"], content: <StatePreview state="dark">{(
    <Accordion
      type="multiple"
      defaultValue={["scope"]}
      ariaLabel="接入说明"
      items={[
        { id: "scope", title: "授权范围", content: "只请求完成同步所需的最小权限。" },
        { id: "callback", title: "回调配置", content: "配置 HTTPS 地址并完成一次签名校验。" },
        { id: "legacy", title: "旧版协议", content: "已停用。", disabled: true },
      ]}
    />
  )}</StatePreview> },
    { state: "locale", exports: ["Accordion"], content: <StatePreview state="locale">{(
    <Accordion
      type="multiple"
      defaultValue={["scope"]}
      ariaLabel="接入说明"
      items={[
        { id: "scope", title: "授权范围", content: "只请求完成同步所需的最小权限。" },
        { id: "callback", title: "回调配置", content: "配置 HTTPS 地址并完成一次签名校验。" },
        { id: "legacy", title: "旧版协议", content: "已停用。", disabled: true },
      ]}
    />
  )}</StatePreview> },
  ],
  content: (
    <Accordion
      type="multiple"
      defaultValue={["scope"]}
      ariaLabel="接入说明"
      items={[
        { id: "scope", title: "授权范围", content: "只请求完成同步所需的最小权限。" },
        { id: "callback", title: "回调配置", content: "配置 HTTPS 地址并完成一次签名校验。" },
        { id: "legacy", title: "旧版协议", content: "已停用。", disabled: true },
      ]}
    />
  ),
  code: `<Accordion type="multiple" defaultValue={["scope"]} items={items} ariaLabel="接入说明" />`,
} satisfies ExplorerCase;

export default explorerCase;
