// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"form/overview","exports":["Form"]}
import { StatePreview } from "../state-preview";
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

function InvalidFormExample() {
  const [email, setEmail] = useState("invalid");
  return <Form aria-invalid onSubmit={(event) => event.preventDefault()}>
    <Field label="工作邮箱" htmlFor="explorer-form-invalid" error="服务器拒绝了邮箱格式，请修改邮箱后重新提交。">
      <Input id="explorer-form-invalid" value={email} onChange={(event) => setEmail(event.currentTarget.value)} aria-invalid />
    </Field>
    <Button type="submit">重新提交</Button>
  </Form>;
}

const explorerCase = {
  id: "form/overview",
  label: "提交与校验",
  summary: "展示表单提交、必填校验以及由 Form 统一表达的忙碌语义。",
  states: ["default", "loading", "error", "validation", "longContent", "keyboard", "mobile", "overlay", "dark", "locale"] as const,
  stateExamples: [
    { state: "loading", exports: ["Form"], content: <Form busy><Field label="正在保存的项目" htmlFor="explorer-form-busy"><Input id="explorer-form-busy" defaultValue="平台工程项目" disabled /></Field><Button type="submit" loading loadingLabel="保存中">保存</Button></Form> },
    { state: "error", exports: ["Form"], content: <InvalidFormExample /> },
    { state: "validation", exports: ["Form"], content: <InvalidFormExample /> },
    { state: "longContent", exports: ["Form"], content: <Form onSubmit={(event) => event.preventDefault()}><p>创建项目之前请确认跨区域结算工作区的成员访问范围、默认通知渠道和账单关联信息，长表单说明应完整换行显示，不遮挡输入和提交入口。</p><Field label="项目名称" htmlFor="explorer-form-long"><Input id="explorer-form-long" defaultValue="国际结算项目" /></Field><Button type="submit">创建项目</Button></Form> },
    { state: "default", exports: ["Form"], content: <FormExample /> },
    { state: "keyboard", exports: ["Form"], content: <FormExample />, instructions: "用 Tab 访问本例可用控件，使用 Enter、Space 和组件文档中的方向键操作。此项为人工操作案例，不是自动行为验收证书。" },
    { state: "mobile", exports: ["Form"], content: <StatePreview state="mobile">{<FormExample />}</StatePreview> },
    { state: "overlay", exports: ["Form"], content: <StatePreview state="overlay">{<FormExample />}</StatePreview> },
    { state: "dark", exports: ["Form"], content: <StatePreview state="dark">{<FormExample />}</StatePreview> },
    { state: "locale", exports: ["Form"], content: <StatePreview state="locale">{<FormExample />}</StatePreview> },
  ],
  content: <FormExample />,
  code: `import { Button, Field, Form, Input } from "./personal-ui";\n\n<Form onSubmit={handleSubmit}>\n  <Field label="项目名称" htmlFor="project-name" required>\n    <Input id="project-name" name="name" value={name} onChange={handleChange} />\n  </Field>\n  <Button type="submit">创建项目</Button>\n</Form>`,
} satisfies ExplorerCase;

export default explorerCase;
