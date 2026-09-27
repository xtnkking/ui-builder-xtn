// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"button/overview","exports":["Button"]}
import { Button, Inline } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const explorerCase = {
  id: "button/overview",
  label: "按钮",
  summary: "主要、次要、危险、禁用和加载按钮共享稳定高度与内容布局。",
  states: ["default", "disabled", "longContent", "keyboard", "dark", "locale"],
  content: <Inline wrap><Button variant="primary">保存更改</Button><Button>取消</Button><Button variant="danger">删除</Button><Button disabled>不可用</Button><Button loading loadingLabel="保存中">保存</Button></Inline>,
  code: `<Button variant="primary" loading={saving}>保存更改</Button>`,
} satisfies ExplorerCase;

export default explorerCase;
