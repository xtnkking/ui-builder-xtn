// @ui-coverage {"kind":"example","runner":"explorer","caseId":"drawer/overview","exports":["Drawer"]}
import { useState } from "react";
import { Button, DescriptionList, Drawer, Inline, Stack, type DrawerProps } from "../../../ui";
import { StatePreview } from "../state-preview";
import type { ExplorerCase } from "../types";

function DrawerExample() {
  const [open, setOpen] = useState(false);
  const [layout, setLayout] = useState<{ width: DrawerProps["width"]; variant: DrawerProps["variant"]; fullScreen: boolean; label: string }>({ width: "medium", variant: "edge", fullScreen: false, label: "默认 460px" });
  const choices = [
    { label: "打开成员详情", description: "默认 460px", width: "medium", variant: "edge", fullScreen: false },
    { label: "大号 620px", description: "大号 620px", width: "large", variant: "edge", fullScreen: false },
    { label: "自定义 800px", description: "数字宽度 800px", width: 800, variant: "edge", fullScreen: false },
    { label: "自定义 960px", description: "像素字符串 960px", width: "960px", variant: "edge", fullScreen: false },
    { label: "可用宽度 75%", description: "可用空间的 75%", width: "75%", variant: "edge", fullScreen: false },
    { label: "视口宽度 80vw", description: "视口宽度的 80vw", width: "80vw", variant: "edge", fullScreen: false },
    { label: "超宽 2000px（留边）", description: "2000px 自动限制到留边区域内", width: 2000, variant: "inset", fullScreen: false },
    { label: "全屏（忽略宽度）", description: "全屏优先于 800px 宽度和 inset 留边", width: 800, variant: "inset", fullScreen: true },
  ] satisfies Array<{ label: string; description: string; width: NonNullable<DrawerProps["width"]>; variant: NonNullable<DrawerProps["variant"]>; fullScreen: boolean }>;
  return (
    <>
      <Stack gap="medium">
        <p>选择预设、像素、百分比或视口宽度；过宽时自动限制在可用空间内。窄屏仍使用底部面板，全屏模式则铺满屏幕。</p>
        <Inline wrap gap="small">
          {choices.map((choice, index) => <Button key={choice.label} variant={index === 0 ? "primary" : "secondary"} onClick={() => { setLayout({ width: choice.width, variant: choice.variant, fullScreen: choice.fullScreen, label: choice.description }); setOpen(true); }}>{choice.label}</Button>)}
        </Inline>
      </Stack>
      <Drawer
        open={open}
        onOpenChange={setOpen}
        width={layout.width}
        variant={layout.variant}
        fullScreen={layout.fullScreen}
        closeOnBackdropClick={false}
        title="成员详情"
        description={`${layout.label}。桌面默认三边贴合；窄屏转为底部面板，内容在面板内滚动。`}
        footer={<Inline justify="end"><Button onClick={() => setOpen(false)}>关闭</Button><Button variant="primary" onClick={() => setOpen(false)}>保存</Button></Inline>}
      >
        <DescriptionList
          items={[
            { id: "name", term: "姓名", description: "林夏" },
            { id: "email", term: "邮箱", description: "lin.xia@example.com" },
            { id: "role", term: "角色", description: "客户成功" },
            { id: "team", term: "所属团队", description: "企业服务 / 华东客户组" },
            { id: "projects", term: "负责项目", description: "客户入驻、年度续约与团队协作空间配置" },
            { id: "scope", term: "数据权限", description: "可查看负责项目的成员、订单和操作记录；财务审批仍由项目管理员处理。" },
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
  label: "抽屉尺寸与贴边模式",
  summary: "默认 edge 模式三边贴合；支持自定义像素、百分比、视口宽度和全屏，自动适配窄屏并保留焦点与动效。",
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
  code: `import { Drawer } from "./ui";

// 默认 medium = 460px，large = 620px；数字按 px 解析。
<Drawer open={open} onOpenChange={setOpen} width={800} closeOnBackdropClick={false} title="成员详情">
  {details}
</Drawer>
// 字符串支持 px、%（可用空间比例）和 vw；超出可用空间时自动收窄。
<Drawer open={open} onOpenChange={setOpen} width="75%" title="项目详情">{details}</Drawer>
// fullScreen 优先于 width 和 inset，桌面与窄屏均铺满。
<Drawer open={open} onOpenChange={setOpen} fullScreen title="完整工作区">{details}</Drawer>`,
};

export default explorerCase;
