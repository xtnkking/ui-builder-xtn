// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"drawer/overview","exports":["Drawer"]}
import { useState } from "react";
import { Button, DescriptionList, Drawer, Inline } from "../../../personal-ui";
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

const explorerCase: ExplorerCase = {
  id: "drawer/overview",
  label: "Drawer 边缘模式",
  summary: "默认 edge 模式在桌面三边贴合，并保留左侧圆角、焦点恢复和移动端转换。",
  states: ["default", "disabled", "readOnly", "controlled", "uncontrolled", "validation", "longContent", "keyboard", "overlay", "dark", "locale"],
  content: <DrawerExample />,
  code: `import { Drawer } from "./personal-ui";

<Drawer open={open} onOpenChange={setOpen} closeOnBackdropClick={false} title="成员详情">
  {details}
</Drawer>`,
};

export default explorerCase;
