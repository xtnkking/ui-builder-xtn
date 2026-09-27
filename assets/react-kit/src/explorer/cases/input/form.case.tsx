// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"form/overview","exports":["Form"]}
import { useState } from "react";
import { Button, Field, Form, Input } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

function FormExample() {
  const [name, setName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  return (
    <div className="demo-number-case">
      <Form onSubmit={(event) => { event.preventDefault(); setSubmitted(true); }}>
        <Field label="项目名称" htmlFor="explorer-form-name" required error={submitted && !name ? "请输入项目名称" : undefined}>
          <Input id="explorer-form-name" name="name" value={name} required onChange={(event) => setName(event.currentTarget.value)} />
        </Field>
        <Button type="submit" variant="primary">创建项目</Button>
      </Form>
    </div>
  );
}

const explorerCase = {
  id: "form/overview",
  label: "提交与校验",
  summary: "展示表单提交、必填校验以及由 Form 统一表达的忙碌语义。",
  states: ["default", "loading", "empty", "error", "validation", "longContent", "keyboard", "mobile", "overlay", "dark", "locale"] as const,
  content: <FormExample />,
  code: `import { Button, Field, Form, Input } from "./personal-ui";\n\n<Form onSubmit={handleSubmit}>\n  <Field label="项目名称" htmlFor="project-name" required>\n    <Input id="project-name" name="name" value={name} onChange={handleChange} />\n  </Field>\n  <Button type="submit">创建项目</Button>\n</Form>`,
} satisfies ExplorerCase;

export default explorerCase;
