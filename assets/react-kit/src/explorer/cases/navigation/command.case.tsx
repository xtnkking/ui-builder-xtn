// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"command/overview","exports":["CommandPalette","useCommandPaletteShortcut"]}
import { useCallback, useState } from "react";
import { Button, CommandPalette, KeyboardShortcut, useCommandPaletteShortcut } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

function CommandExample() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const openPalette = useCallback(() => setOpen(true), []);
  useCommandPaletteShortcut({ onOpen: openPalette });
  return (
    <div className="demo-number-case">
      <Button variant="primary" onClick={openPalette}>打开命令面板</Button>
      <p>也可以按 <KeyboardShortcut keys={["Ctrl", "K"]} />。</p>
      <CommandPalette
        open={open}
        onOpenChange={setOpen}
        query={query}
        onQueryChange={setQuery}
        commands={[
          { id: "create", label: "创建项目", textValue: "创建项目", keywords: ["new"], onSelect: () => setOpen(false) },
          { id: "settings", label: "打开设置", textValue: "打开设置", onSelect: () => setOpen(false) },
          { id: "archive", label: "归档工作区", textValue: "归档工作区", disabled: true, onSelect: () => undefined },
        ]}
      />
    </div>
  );
}

const explorerCase = {
  id: "command/overview",
  label: "命令面板与全局快捷键",
  summary: "快捷键 Hook 真正驱动受控 CommandPalette，并覆盖查询、空结果、禁用命令和键盘导航。",
  states: ["default", "disabled", "readOnly", "controlled", "uncontrolled", "validation", "longContent", "keyboard", "overlay", "dark", "locale", "usage"] as const,
  content: <CommandExample />,
  code: `const [open, setOpen] = useState(false);\nuseCommandPaletteShortcut({ onOpen: () => setOpen(true) });\n<CommandPalette open={open} onOpenChange={setOpen} commands={commands} />`,
} satisfies ExplorerCase;

export default explorerCase;
