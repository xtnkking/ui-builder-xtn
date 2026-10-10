// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"master-detail/overview","exports":["MasterDetail"]}
import { StatePreview } from "../state-preview";
import { useState } from "react";
import { Box, Button, DescriptionList, MasterDetail, Stack } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

function MasterDetailExample() {
  const [selected, setSelected] = useState("northstar");
  return (
    <MasterDetail
      title="项目"
      master={<Box padding="medium"><Stack gap="small"><Button variant={selected === "northstar" ? "primary" : "secondary"} onClick={() => setSelected("northstar")}>Northstar</Button><Button variant={selected === "atlas" ? "primary" : "secondary"} onClick={() => setSelected("atlas")}>Atlas</Button></Stack></Box>}
      detail={<Box padding="medium"><DescriptionList items={[{ id: "project", term: "项目", description: selected === "northstar" ? "Northstar" : "Atlas" }, { id: "status", term: "状态", description: "运行中" }]} /></Box>}
    />
  );
}

const explorerCase: ExplorerCase = {
  id: "master-detail/overview",
  label: "主从页面",
  summary: "列表选择与详情区采用稳定双栏，并在移动端保持可读顺序。",
  states: ["default", "empty", "longContent", "keyboard", "mobile", "overlay", "dark", "locale"],
  stateExamples: [
    { state: "empty", exports: ["MasterDetail"], content: <MasterDetail title="选择项目" master={<Box padding="medium">项目列表</Box>} detail={<Box padding="medium">项目详情</Box>} detailOpen={false} emptyDetail={<Box padding="medium">请选择项目以查看详情。</Box>} /> },
    { state: "longContent", exports: ["MasterDetail"], content: <MasterDetail title="完整项目配置" description="此页面展示全部产品中的角色配置、数据访问权限、通知偏好和账户安全设置，请确认所有关联配置均符合团队的实际使用要求。" master={<Box padding="medium">项目列表</Box>} detail={<Box padding="medium">项目详情</Box>} /> },
    { state: "default", exports: ["MasterDetail"], content: <MasterDetailExample /> },
    { state: "keyboard", exports: ["MasterDetail"], content: <MasterDetailExample />, instructions: "用 Tab 访问本例可用控件，使用 Enter、Space 和组件文档中的方向键操作。此项为人工操作案例，不是自动行为验收证书。" },
    { state: "mobile", exports: ["MasterDetail"], content: <StatePreview state="mobile">{<MasterDetailExample />}</StatePreview> },
    { state: "overlay", exports: ["MasterDetail"], content: <StatePreview state="overlay">{<MasterDetailExample />}</StatePreview> },
    { state: "dark", exports: ["MasterDetail"], content: <StatePreview state="dark">{<MasterDetailExample />}</StatePreview> },
    { state: "locale", exports: ["MasterDetail"], content: <StatePreview state="locale">{<MasterDetailExample />}</StatePreview> },
  ],
  content: <MasterDetailExample />,
  code: `import { Box, MasterDetail } from "./personal-ui";

<MasterDetail title="项目"
  master={<Box padding="medium">{projectList}</Box>}
  detail={<Box padding="medium">{projectDetail}</Box>}
/>`,
};

export default explorerCase;
