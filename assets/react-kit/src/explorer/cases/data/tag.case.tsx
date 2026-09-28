// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"tag/overview","exports":["Tag"]}
import { useState } from "react";
import { Button, Inline, Tag } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

function TagExample() {
  const [visible, setVisible] = useState(true);
  return (
    <Inline gap="small" wrap>
      <Tag tone="neutral">草稿</Tag>
      <Tag tone="success" selected>已启用</Tag>
      <Tag tone="blue" leading={<span aria-hidden="true">US</span>}>+1</Tag>
      {visible ? <Tag tone="warning" onRemove={() => setVisible(false)} removeLabel="移除即将过期标签">即将过期</Tag> : <Button variant="ghost" size="small" onClick={() => setVisible(true)}>恢复标签</Button>}
    </Inline>
  );
}

const explorerCase = {
  id: "tag/overview",
  label: "胶囊标签",
  summary: "展示无图标、带前缀、选中和可移除形式；选中状态不新增图标，避免宽度跳变。",
  states: ["default", "empty", "error", "longContent", "dark", "locale"],
  content: <TagExample />,
  code: `<Tag tone="success" selected>已启用</Tag>\n<Tag leading={<Flag />}>US +1</Tag>\n<Tag onRemove={remove}>即将过期</Tag>`,
} satisfies ExplorerCase;

export default explorerCase;
