// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"code-block/overview","exports":["CodeBlock"]}
import { StatePreview } from "../state-preview";
import { CodeBlock } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const sample = `import { Button } from "./personal-ui";\n\nexport function SaveCommand() {\n  return <Button onClick={save}>保存</Button>;\n}`;

const explorerCase = {
  id: "code-block/overview",
  label: "可复制代码",
  summary: "代码块可限制高度和换行；代码正文是具有本地化名称的可聚焦区域，保留原生键盘滚动，复制使用组件自带按钮。",
  states: ["default", "longContent", "dark", "locale"],
  stateExamples: [
    { state: "default", exports: ["CodeBlock"], content: <CodeBlock code={sample} language="tsx" copyable wrap maxHeight={220} /> },
    { state: "longContent", exports: ["CodeBlock"], content: <CodeBlock code={sample} language="tsx" copyable wrap maxHeight={220} /> },
    { state: "dark", exports: ["CodeBlock"], content: <StatePreview state="dark">{<CodeBlock code={sample} language="tsx" copyable wrap maxHeight={220} />}</StatePreview> },
    { state: "locale", exports: ["CodeBlock"], content: <StatePreview state="locale">{<CodeBlock code={sample} language="tsx" copyable wrap maxHeight={220} />}</StatePreview> },
  ],
  content: <CodeBlock code={sample} language="tsx" copyable wrap maxHeight={220} />,
  code: `<CodeBlock code={source} language="tsx" copyable wrap maxHeight={220} />`,
} satisfies ExplorerCase;

export default explorerCase;
