// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"sortable/overview","exports":["SortableList"]}
import { StatePreview } from "../state-preview";
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
  states: ["default", "disabled", "controlled", "empty", "longContent", "keyboard", "overlay", "dark", "locale"],
  stateExamples: [
    { state: "disabled", exports: ["SortableList"], content: <SortableList disabled ariaLabel="不可更改的状态顺序" items={[{ id: "todo", value: "待处理" }, { id: "done", value: "已完成" }]} renderItem={(value) => <Tag>{value}</Tag>} onReorder={() => undefined} /> },
    { state: "controlled", exports: ["SortableList"], content: <SortableExample /> },
    { state: "empty", exports: ["SortableList"], content: <><SortableList<string> ariaLabel="空状态列表" items={[]} renderItem={(value) => value} onReorder={() => undefined} /><p>没有可排序的项目。</p></> },
    { state: "longContent", exports: ["SortableList"], content: <SortableList ariaLabel="完整状态名称" items={[{ id: "details", value: "此状态名称覆盖全部产品中的角色配置、数据访问权限、通知偏好和账户安全设置，请确认所有关联配置均符合团队的实际使用要求。" }]} renderItem={(value) => value} onReorder={() => undefined} /> },
    { state: "default", exports: ["SortableList"], content: <SortableExample /> },
    { state: "keyboard", exports: ["SortableList"], content: <SortableExample />, instructions: "用 Tab 访问本例可用控件，使用 Enter、Space 和组件文档中的方向键操作。此项为人工操作案例，不是自动行为验收证书。" },
    { state: "overlay", exports: ["SortableList"], content: <StatePreview state="overlay">{<SortableExample />}</StatePreview> },
    { state: "dark", exports: ["SortableList"], content: <StatePreview state="dark">{<SortableExample />}</StatePreview> },
    { state: "locale", exports: ["SortableList"], content: <StatePreview state="locale">{<SortableExample />}</StatePreview> },
  ],
  content: <SortableExample />,
  code: `<SortableList ariaLabel="状态顺序" items={items} onReorder={setItems} renderItem={renderItem} />`,
} satisfies ExplorerCase;

export default explorerCase;
