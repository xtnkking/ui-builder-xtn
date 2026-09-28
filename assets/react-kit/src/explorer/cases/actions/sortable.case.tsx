// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"sortable/overview","exports":["SortableList"]}
import { useState } from "react";
import { SortableList, Tag } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

function SortableExample() {
  const [items, setItems] = useState([{ id: "todo", value: "待处理" }, { id: "doing", value: "进行中" }, { id: "done", value: "已完成" }]);
  return <SortableList ariaLabel="状态顺序" items={items} renderItem={(value) => <Tag>{value}</Tag>} onReorder={setItems} />;
}

const explorerCase = {
  id: "sortable/overview",
  label: "可排序列表",
  summary: "列表同时支持拖动和上移/下移按钮，并通过 live region 宣告结果。",
  states: ["default", "disabled", "readOnly", "controlled", "validation", "keyboard", "overlay", "dark", "locale"],
  content: <SortableExample />,
  code: `<SortableList ariaLabel="状态顺序" items={items} onReorder={setItems} renderItem={renderItem} />`,
} satisfies ExplorerCase;

export default explorerCase;
