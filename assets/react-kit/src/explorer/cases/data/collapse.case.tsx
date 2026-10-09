// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"collapse/overview","exports":["Collapse"]}
import { StatePreview } from "../state-preview";
import { Collapse } from "../../../personal-ui";
import { useState } from "react";
import type { ExplorerCase } from "../types";

function ControlledCollapseExample() {
  const [open, setOpen] = useState(false);
  return <><Collapse title="受控部署说明" open={open} onOpenChange={setOpen}>发布前检查说明</Collapse><p role="status">内容：{open ? "展开" : "收起"}</p></>;
}

const explorerCase = {
  id: "collapse/overview",
  label: "折叠内容",
  summary: "支持非受控展开、键盘切换和禁用状态，长内容由组件自己管理展开区域。",
  states: ["default", "disabled", "controlled", "uncontrolled", "longContent", "keyboard", "overlay", "dark", "locale"],
  stateExamples: [
    { state: "controlled", exports: ["Collapse"], content: <ControlledCollapseExample /> },
    { state: "default", exports: ["Collapse"], content: (
    <div>
      <Collapse title="部署说明" defaultOpen>
        生产环境在发布前会依次完成类型检查、可访问性检查与构建校验。
      </Collapse>
      <Collapse title="暂不可用的归档记录" disabled>该内容不会被展开。</Collapse>
    </div>
  ) },
    { state: "disabled", exports: ["Collapse"], content: (
    <div>
      <Collapse title="部署说明" defaultOpen>
        生产环境在发布前会依次完成类型检查、可访问性检查与构建校验。
      </Collapse>
      <Collapse title="暂不可用的归档记录" disabled>该内容不会被展开。</Collapse>
    </div>
  ) },
    { state: "uncontrolled", exports: ["Collapse"], content: (
    <div>
      <Collapse title="部署说明" defaultOpen>
        生产环境在发布前会依次完成类型检查、可访问性检查与构建校验。
      </Collapse>
      <Collapse title="暂不可用的归档记录" disabled>该内容不会被展开。</Collapse>
    </div>
  ) },
    { state: "longContent", exports: ["Collapse"], content: (
    <div>
      <Collapse title="部署说明" defaultOpen>
        生产环境在发布前会依次完成类型检查、可访问性检查与构建校验。
      </Collapse>
      <Collapse title="暂不可用的归档记录" disabled>该内容不会被展开。</Collapse>
    </div>
  ) },
    { state: "keyboard", exports: ["Collapse"], content: (
    <div>
      <Collapse title="部署说明" defaultOpen>
        生产环境在发布前会依次完成类型检查、可访问性检查与构建校验。
      </Collapse>
      <Collapse title="暂不可用的归档记录" disabled>该内容不会被展开。</Collapse>
    </div>
  ), instructions: "用 Tab 访问本例可用控件，使用 Enter、Space 和组件文档中的方向键操作。此项为人工操作案例，不是自动行为验收证书。" },
    { state: "overlay", exports: ["Collapse"], content: <StatePreview state="overlay">{(
    <div>
      <Collapse title="部署说明" defaultOpen>
        生产环境在发布前会依次完成类型检查、可访问性检查与构建校验。
      </Collapse>
      <Collapse title="暂不可用的归档记录" disabled>该内容不会被展开。</Collapse>
    </div>
  )}</StatePreview> },
    { state: "dark", exports: ["Collapse"], content: <StatePreview state="dark">{(
    <div>
      <Collapse title="部署说明" defaultOpen>
        生产环境在发布前会依次完成类型检查、可访问性检查与构建校验。
      </Collapse>
      <Collapse title="暂不可用的归档记录" disabled>该内容不会被展开。</Collapse>
    </div>
  )}</StatePreview> },
    { state: "locale", exports: ["Collapse"], content: <StatePreview state="locale">{(
    <div>
      <Collapse title="部署说明" defaultOpen>
        生产环境在发布前会依次完成类型检查、可访问性检查与构建校验。
      </Collapse>
      <Collapse title="暂不可用的归档记录" disabled>该内容不会被展开。</Collapse>
    </div>
  )}</StatePreview> },
  ],
  content: (
    <div>
      <Collapse title="部署说明" defaultOpen>
        生产环境在发布前会依次完成类型检查、可访问性检查与构建校验。
      </Collapse>
      <Collapse title="暂不可用的归档记录" disabled>该内容不会被展开。</Collapse>
    </div>
  ),
  code: `<Collapse title="部署说明" defaultOpen>发布前检查说明</Collapse>`,
} satisfies ExplorerCase;

export default explorerCase;
