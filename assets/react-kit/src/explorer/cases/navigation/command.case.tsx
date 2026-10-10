// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"command/overview","exports":["CommandPalette","useCommandPaletteShortcut"]}
import { useCallback, useState } from "react";
import { Button, CommandPalette, useCommandPaletteShortcut } from "../../../personal-ui";
import { StatePreview } from "../state-preview";
import type { ExplorerCase } from "../types";

const commands = [
  { id: "create", label: "创建项目", textValue: "创建项目", onSelect: () => window.alert("创建项目") },
  { id: "archive", label: "归档工作区", textValue: "归档工作区", disabled: true, onSelect: () => undefined },
];
function useCommandControls() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const onOpen = useCallback(() => setOpen(true), []);
  useCommandPaletteShortcut({ onOpen });
  return { open, setOpen, query, setQuery, onOpen };
}

function CommandExample() {
  const { open, setOpen, query, setQuery, onOpen } = useCommandControls();
  return <><Button onClick={onOpen}>打开命令面板</Button><p>也可使用 Ctrl+K / Cmd+K。</p><CommandPalette open={open} onOpenChange={setOpen} query={query} onQueryChange={setQuery} commands={commands} /></>;
}

function DisabledCommandExample() {
  const { open, setOpen, query, setQuery, onOpen } = useCommandControls();
  return <><Button onClick={onOpen}>打开禁用项案例</Button><p>“归档工作区”保持禁用。</p><CommandPalette open={open} onOpenChange={setOpen} query={query} onQueryChange={setQuery} commands={[
    { id: "create", label: "创建项目", textValue: "创建项目", onSelect: () => window.alert("创建项目") },
    { id: "archive", label: "归档工作区", textValue: "归档工作区", disabled: true, onSelect: () => undefined },
  ]} /></>;
}

function LoadingCommandExample() {
  const { open, setOpen, query, setQuery, onOpen } = useCommandControls();
  return <><Button onClick={onOpen}>打开加载案例</Button><p>打开后显示命令加载状态。</p><CommandPalette open={open} onOpenChange={setOpen} query={query} onQueryChange={setQuery} commands={commands} loading /></>;
}

function EmptyCommandExample() {
  const { open, setOpen, query, setQuery, onOpen } = useCommandControls();
  return <><Button onClick={onOpen}>打开空结果案例</Button><p>打开后显示明确空态。</p><CommandPalette open={open} onOpenChange={setOpen} query={query} onQueryChange={setQuery} commands={[]} emptyText="没有可用命令" /></>;
}

function LongCommandExample() {
  const { open, setOpen, query, setQuery, onOpen } = useCommandControls();
  return <><Button onClick={onOpen}>打开长内容案例</Button><p>打开后检查标题和命令名称换行。</p><CommandPalette open={open} onOpenChange={setOpen} query={query} onQueryChange={setQuery} title="跨区域基础设施迁移项目的全部成员权限与安全策略审核记录及发布操作" commands={[{ id: "long", label: "保存当前成员在全部产品中的角色配置、数据访问权限、通知偏好和账户安全设置", textValue: "保存全部设置", onSelect: () => undefined }]} /></>;
}

function LocaleCommandExample() {
  const { open, setOpen, query, setQuery, onOpen } = useCommandControls();
  return <><Button onClick={onOpen}>Open command palette</Button><p>Ctrl+K / Cmd+K also opens it.</p><CommandPalette open={open} onOpenChange={setOpen} query={query} onQueryChange={setQuery} commands={[{ id: "new", label: "Create project", textValue: "Create project", onSelect: () => undefined }]} /></>;
}

function UncontrolledCommandExample() {
  const [mounted, setMounted] = useState(false);
  return <><Button onClick={() => setMounted(true)}>打开非受控命令面板</Button>{mounted ? <CommandPalette defaultOpen defaultQuery="" commands={commands} onOpenChange={(open) => { if (!open) setMounted(false); }} /> : null}</>;
}
const explorerCase = {
  id: "command/overview", label: "命令面板与快捷键", summary: "真正演示开关和查询的双状态模式、空结果及加载；快捷键 Hook 在实际可打开的面板中使用。",
  states: ["default", "disabled", "controlled", "uncontrolled", "loading", "empty", "longContent", "keyboard", "overlay", "dark", "locale", "usage"],
  content: <CommandExample />,
  stateExamples: [
    { state: "default", exports: ["CommandPalette"], content: <CommandExample /> },
    { state: "disabled", exports: ["CommandPalette"], instructions: "打开后“归档工作区”被禁用，不接受点击和键盘选择。", content: <DisabledCommandExample /> },
    { state: "controlled", exports: ["CommandPalette"], content: <CommandExample /> },
    { state: "uncontrolled", exports: ["CommandPalette"], instructions: "点击触发器后挂载 defaultOpen/defaultQuery 实例，由组件内部维护开关与查询；Esc 关闭并卸载，以便再次打开。", content: <UncontrolledCommandExample /> },
    { state: "loading", exports: ["CommandPalette"], content: <LoadingCommandExample /> },
    { state: "empty", exports: ["CommandPalette"], content: <EmptyCommandExample /> },
    { state: "longContent", exports: ["CommandPalette"], content: <LongCommandExample /> },
    { state: "keyboard", exports: ["CommandPalette", "useCommandPaletteShortcut"], instructions: "Ctrl+K/Cmd+K 打开；方向键、Home、End 移动命令，Enter 执行，Esc 关闭并返回原焦点。", content: <CommandExample /> },
    { state: "overlay", exports: ["CommandPalette"], content: <StatePreview state="overlay"><CommandExample /></StatePreview> },
    { state: "dark", exports: ["CommandPalette"], content: <StatePreview state="dark"><CommandExample /></StatePreview> },
    { state: "locale", exports: ["CommandPalette"], content: <StatePreview state="locale"><LocaleCommandExample /></StatePreview> },
    { state: "usage", exports: ["useCommandPaletteShortcut"], instructions: "Hook 绑定当前实例的 onOpen；卸载场景会清理全局快捷键监听。", content: <CommandExample /> },
  ],
  code: 'useCommandPaletteShortcut({ onOpen: () => setOpen(true) });\n<CommandPalette open={open} onOpenChange={setOpen} query={query} onQueryChange={setQuery} commands={commands} />\n<CommandPalette defaultOpen defaultQuery="" commands={commands} />',
} satisfies ExplorerCase;
export default explorerCase;
