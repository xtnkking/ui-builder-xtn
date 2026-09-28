// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"code-block/overview","exports":["CodeBlock"]}
import { CodeBlock } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const sample = `import { Button } from "./personal-ui";\n\nexport function SaveCommand() {\n  return <Button onClick={save}>保存</Button>;\n}`;

const explorerCase = {
  id: "code-block/overview",
  label: "可复制代码",
  summary: "代码块可限制高度、换行并通过组件自带按钮复制，避免页面自行实现复制反馈。",
  states: ["default", "longContent", "dark", "locale"],
  content: <CodeBlock code={sample} language="tsx" copyable wrap maxHeight={220} />,
  code: `<CodeBlock code={source} language="tsx" copyable wrap maxHeight={220} />`,
} satisfies ExplorerCase;

export default explorerCase;
