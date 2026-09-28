// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"field/overview","exports":["Field"]}
import { Field, Input } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const explorerCase = {
  id: "field/overview",
  label: "标签、提示与错误",
  summary: "Field 统一拥有标签、必填标记、说明文本和校验错误的关联关系。",
  states: ["default", "empty", "error", "longContent", "dark", "locale"] as const,
  content: (
    <div className="demo-number-case__grid">
      <Field label="工作邮箱" htmlFor="explorer-field-email" required hint="用于接收安全通知和较长的组织协作提醒。">
        <Input id="explorer-field-email" type="email" defaultValue="owner@example.com" />
      </Field>
      <Field label="备用邮箱" htmlFor="explorer-field-error" required error="邮箱格式不正确">
        <Input id="explorer-field-error" type="email" defaultValue="invalid" readOnly />
      </Field>
    </div>
  ),
  code: `<Field label="工作邮箱" htmlFor="email" required hint="用于安全通知">\n  <Input id="email" type="email" />\n</Field>`,
} satisfies ExplorerCase;

export default explorerCase;
