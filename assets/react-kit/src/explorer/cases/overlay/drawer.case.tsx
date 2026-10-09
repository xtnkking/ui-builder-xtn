// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"drawer/overview","exports":["Drawer"]}
import { useState } from "react";
import { Button, DescriptionList, Drawer, Inline } from "../../../personal-ui";
import { StatePreview } from "../state-preview";
import type { ExplorerCase } from "../types";

function DrawerExample() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>打开成员详情</Button>
      <Drawer
        open={open}
        onOpenChange={setOpen}
        closeOnBackdropClick={false}
        title="成员详情"
        description="桌面端上、右、下贴边；移动端转为底部面板。"
        footer={<Inline justify="end"><Button onClick={() => setOpen(false)}>关闭</Button><Button variant="primary" onClick={() => setOpen(false)}>保存</Button></Inline>}
      >
        <DescriptionList
          items={[
            { id: "name", term: "姓名", description: "林夏" },
            { id: "email", term: "邮箱", description: "lin.xia@example.com" },
            { id: "role", term: "角色", description: "客户成功" },
          ]}
        />
      </Drawer>
    </>
  );
}

function LongDrawerExample() {
  const [open, setOpen] = useState(false);
  return <><Button onClick={() => setOpen(true)}>打开长内容详情</Button><Drawer open={open} onOpenChange={setOpen} title="完整成员资料" description="此成员负责全部产品中的角色配置、数据访问权限、通知偏好和账户安全设置，请在保存前确认所有关联配置均符合团队的实际使用要求。"><DescriptionList items={[{ id: "responsibility", term: "职责", description: "成员管理、账户安全、数据访问权限、通知偏好和操作审计管理，需要在团队成员列表中持续保持完整的联系方式与全部配置记录。" }]} /></Drawer></>;
}

function EnglishDrawerExample() {
  const [open, setOpen] = useState(false);
  return <><Button onClick={() => setOpen(true)}>View member details</Button><Drawer open={open} onOpenChange={setOpen} title="Member details" description="The close action uses the current locale."><DescriptionList items={[{ id: "name", term: "Name", description: "Alex" }, { id: "role", term: "Role", description: "Customer success" }]} /></Drawer></>;
}

const explorerCase: ExplorerCase = {
  id: "drawer/overview",
  label: "Drawer 边缘模式",
  summary: "默认 edge 模式在桌面三边贴合，并保留左侧圆角、焦点恢复和移动端转换。",
  states: ["default", "controlled", "longContent", "keyboard", "overlay", "dark", "locale"],
  content: <DrawerExample />,
  stateExamples: [
    { state: "default", exports: ["Drawer"], content: <DrawerExample /> },
    { state: "controlled", exports: ["Drawer"], content: <DrawerExample /> },
    { state: "longContent", exports: ["Drawer"], content: <LongDrawerExample /> },
    { state: "keyboard", exports: ["Drawer"], instructions: "用 Tab 聚焦打开按钮并按 Enter；Tab/Shift+Tab 在抽屉内移动，Esc 关闭并返回触发器。点击遮罩不能关闭本例。", content: <DrawerExample /> },
    { state: "overlay", exports: ["Drawer"], instructions: "在外层弹窗中打开抽屉；Esc 先关闭抽屉，再关闭外层弹窗。", content: <StatePreview state="overlay"><DrawerExample /></StatePreview> },
    { state: "dark", exports: ["Drawer"], content: <StatePreview state="dark"><DrawerExample /></StatePreview> },
    { state: "locale", exports: ["Drawer"], content: <StatePreview state="locale"><EnglishDrawerExample /></StatePreview> },
  ],
  code: `import { Drawer } from "./personal-ui";

<Drawer open={open} onOpenChange={setOpen} closeOnBackdropClick={false} title="成员详情">
  {details}
</Drawer>`,
};

export default explorerCase;
