// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"rating/overview","exports":["Rating"]}
import { useState } from "react";
import { Rating } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

function RatingExample() {
  const [value, setValue] = useState(4);
  return (
    <div className="demo-number-case__grid">
      <Rating ariaLabel="服务评分" value={value} onValueChange={setValue} allowClear />
      <Rating ariaLabel="只读评分" defaultValue={3} readOnly />
      <Rating ariaLabel="禁用评分" defaultValue={2} disabled />
    </div>
  );
}

const explorerCase = {
  id: "rating/overview",
  label: "评分",
  summary: "展示可清除评分、只读结果与禁用状态。",
  states: ["default", "disabled", "readOnly", "controlled", "uncontrolled", "validation", "longContent", "keyboard", "overlay", "dark", "locale"] as const,
  content: <RatingExample />,
  code: `<Rating ariaLabel="服务评分" value={value} onValueChange={setValue} allowClear />`,
} satisfies ExplorerCase;

export default explorerCase;
