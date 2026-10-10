// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"portal/overview","exports":["Portal"]}
import { StatePreview } from "../state-preview";
import { useState } from "react";
import { Box, Portal } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

function PortalExample() {
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  return <div><div ref={setTarget} />{target && <Portal container={target}><Box padding="medium" surface="raised">这段内容通过真实 Portal 挂载到当前案例指定的容器，并保留创建位置的主题和语言上下文；长文本仍在目标容器内自然换行。</Box></Portal>}</div>;
}

const explorerCase = {
  id: "portal/overview",
  label: "跨层渲染容器",
  summary: "内容通过真实 Portal 移入本例的目标容器；不向页面外散布预览内容，并保留来源主题。",
  states: ["default", "longContent", "mobile", "dark", "locale"],
  stateExamples: [
    { state: "default", exports: ["Portal"], content: <PortalExample /> },
    { state: "longContent", exports: ["Portal"], content: <PortalExample /> },
    { state: "mobile", exports: ["Portal"], content: <StatePreview state="mobile"><PortalExample /></StatePreview> },
    { state: "dark", exports: ["Portal"], content: <StatePreview state="dark"><PortalExample /></StatePreview> },
    { state: "locale", exports: ["Portal"], content: <StatePreview state="locale"><PortalExample /></StatePreview> },
  ],
  content: <PortalExample />,
  code: `<Portal container={overlayRoot}>{overlay}</Portal>`,
} satisfies ExplorerCase;

export default explorerCase;
