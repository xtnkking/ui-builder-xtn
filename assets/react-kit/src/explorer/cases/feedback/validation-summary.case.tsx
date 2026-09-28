// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"validation-summary/overview","exports":["ValidationSummary"]}
import { Field, Input, ValidationSummary } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const explorerCase = {
  id: "validation-summary/overview",
  label: "校验摘要",
  summary: "错误摘要链接到对应字段，键盘用户可以直接把焦点移到需要修正的位置。",
  states: ["default", "disabled", "longContent", "keyboard", "dark", "locale"],
  content: (
    <div style={{ display: "grid", gap: 16 }}>
      <ValidationSummary title="请修正以下 2 项" issues={[
        { id: "email-required", message: "请输入工作邮箱。", fieldId: "validation-email" },
        { id: "endpoint-invalid", message: "回调地址必须使用 HTTPS，并且不能包含空格。", fieldId: "validation-endpoint" },
      ]} />
      <Field label="工作邮箱" htmlFor="validation-email" error="请输入工作邮箱。"><Input id="validation-email" invalid defaultValue="" /></Field>
      <Field label="回调地址" htmlFor="validation-endpoint" error="请输入有效的 HTTPS 地址。"><Input id="validation-endpoint" invalid defaultValue="http://invalid address" /></Field>
    </div>
  ),
  code: `<ValidationSummary title="请修正以下 2 项" issues={[{ id: "email-required", message: "请输入工作邮箱。", fieldId: "email" }]} />`,
} satisfies ExplorerCase;

export default explorerCase;
