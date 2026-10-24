import { useEffect, useState } from "react";
import { ArrowLeft, Code2, ShoppingBag } from "lucide-react";
import { Button, CodeBlock, Drawer, Link, Tabs, ThemeProvider } from "../../../ui";
import { AccountWorkspace } from "./AccountWorkspace";
import workspaceSource from "./AccountWorkspace.tsx?raw";
import drawersSource from "./AccountDrawers.tsx?raw";
import groupsSource from "./GroupManager.tsx?raw";
import selectedSource from "./SelectedRoles.tsx?raw";
import modelSource from "./account-model.ts?raw";
import rolesSource from "./roles.ts?raw";
import workspaceStyles from "./accounts.css?raw";
import drawerStyles from "./account-drawers.css?raw";
import selectedStyles from "./selected-roles.css?raw";

export function AccountsExample() {
  const [sourceOpen, setSourceOpen] = useState(false);
  useEffect(() => {
    const previousTitle = document.title;
    document.title = "账号与角色 · 完整案例";
    return () => { document.title = previousTitle; };
  }, []);

  return <ThemeProvider mode="light">
    <AccountWorkspace previewTools={<>
      <Link href="#/components/button" icon={<ArrowLeft aria-hidden="true" />}>组件目录</Link>
      <Link href="#/examples/shop" icon={<ShoppingBag aria-hidden="true" />}>商城案例</Link>
      <Button variant="ghost" size="small" icon={<Code2 aria-hidden="true" />} onClick={() => setSourceOpen(true)}>项目源码</Button>
    </>} />
    <Drawer open={sourceOpen} onOpenChange={setSourceOpen} width="large" title="账号与角色 · 项目源码"
      description="240 个模拟账号的查询、分页、编辑、文本批量新增、分组和角色管理，均组合公开组件。">
      <Tabs ariaLabel="账号角色项目源码" items={[
        { id: "workspace", label: "账号与角色", content: <CodeBlock language="tsx" code={workspaceSource} copyable /> },
        { id: "editor", label: "编辑与文本导入", content: <CodeBlock language="tsx" code={drawersSource} copyable /> },
        { id: "groups", label: "分组与选择", content: <CodeBlock language="tsx" code={`${groupsSource}\n\n${selectedSource}`} copyable /> },
        { id: "data", label: "业务数据", content: <CodeBlock language="tsx" code={`${modelSource}\n\n${rolesSource}`} copyable /> },
        { id: "layout", label: "布局", content: <CodeBlock language="css" code={[workspaceStyles, drawerStyles, selectedStyles].join("\n\n")} copyable /> },
      ]} />
    </Drawer>
  </ThemeProvider>;
}
