// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"accordion/overview","exports":["Accordion"]}
import { Accordion } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const explorerCase = {
  id: "accordion/overview",
  label: "手风琴",
  summary: "可同时展开多项，禁用项不会进入操作流程，按钮保留标准键盘行为。",
  states: ["default", "disabled", "readOnly", "controlled", "uncontrolled", "validation", "longContent", "keyboard", "overlay", "dark", "locale"],
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
