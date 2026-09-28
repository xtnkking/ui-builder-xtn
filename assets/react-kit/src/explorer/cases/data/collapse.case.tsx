// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"collapse/overview","exports":["Collapse"]}
import { Collapse } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const explorerCase = {
  id: "collapse/overview",
  label: "折叠内容",
  summary: "支持非受控展开、键盘切换和禁用状态，长内容由组件自己管理展开区域。",
  states: ["default", "disabled", "readOnly", "controlled", "uncontrolled", "validation", "longContent", "keyboard", "overlay", "dark", "locale"],
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
