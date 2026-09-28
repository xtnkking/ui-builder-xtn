// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"master-detail/overview","exports":["MasterDetail"]}
import { useState } from "react";
import { Button, DescriptionList, MasterDetail, Stack } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

function MasterDetailExample() {
  const [selected, setSelected] = useState("northstar");
  return (
    <MasterDetail
      title="项目"
      master={<Stack gap="small"><Button variant={selected === "northstar" ? "primary" : "secondary"} onClick={() => setSelected("northstar")}>Northstar</Button><Button variant={selected === "atlas" ? "primary" : "secondary"} onClick={() => setSelected("atlas")}>Atlas</Button></Stack>}
      detail={<DescriptionList items={[{ id: "project", term: "项目", description: selected === "northstar" ? "Northstar" : "Atlas" }, { id: "status", term: "状态", description: "运行中" }]} />}
    />
  );
}

const explorerCase: ExplorerCase = {
  id: "master-detail/overview",
  label: "主从页面",
  summary: "列表选择与详情区采用稳定双栏，并在移动端保持可读顺序。",
  states: ["default", "loading", "empty", "error", "validation", "longContent", "keyboard", "mobile", "overlay", "dark", "locale"],
  content: <MasterDetailExample />,
  code: `import { MasterDetail } from "./personal-ui";

<MasterDetail title="项目" master={projectList} detail={projectDetail} />`,
};

export default explorerCase;
