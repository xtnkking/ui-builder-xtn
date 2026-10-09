// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"field/overview","exports":["Field"]}
import { StatePreview } from "../state-preview";
import { Field, Input } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const explorerCase = {
  id: "field/overview",
  label: "标签、提示与错误",
  summary: "Field 统一拥有标签、必填标记、说明文本和校验错误的关联关系。",
  states: ["default", "error", "validation", "longContent", "dark", "locale"] as const,
  stateExamples: [
    { state: "validation", exports: ["Field"], content: <Field label="工作邮箱" htmlFor="explorer-field-validation" error="邮箱格式不正确，请使用企业邮箱。"><Input id="explorer-field-validation" defaultValue="invalid" /></Field> },
    { state: "longContent", exports: ["Field"], content: <Field label="用于接收跨区域结算账户的安全通知、账单更新和成员访问权限变更提醒的企业邮箱地址" htmlFor="explorer-field-long" hint="请确保组织管理员能够访问此邮箱，所有安全通知将发送至该地址，并在发送失败时提示管理员检查配置。"><Input id="explorer-field-long" defaultValue="owner@example.com" /></Field> },
    { state: "default", exports: ["Field"], content: (
    <div className="demo-number-case__grid">
      <Field label="工作邮箱" htmlFor="explorer-field-email" required hint="用于接收安全通知和较长的组织协作提醒。">
        <Input id="explorer-field-email" type="email" defaultValue="owner@example.com" />
      </Field>
      <Field label="备用邮箱" htmlFor="explorer-field-error" required error="邮箱格式不正确">
        <Input id="explorer-field-error" type="email" defaultValue="invalid" readOnly />
      </Field>
    </div>
  ) },
    { state: "error", exports: ["Field"], content: (
    <div className="demo-number-case__grid">
      <Field label="工作邮箱" htmlFor="explorer-field-email" required hint="用于接收安全通知和较长的组织协作提醒。">
        <Input id="explorer-field-email" type="email" defaultValue="owner@example.com" />
      </Field>
      <Field label="备用邮箱" htmlFor="explorer-field-error" required error="邮箱格式不正确">
        <Input id="explorer-field-error" type="email" defaultValue="invalid" readOnly />
      </Field>
    </div>
  ) },
    { state: "dark", exports: ["Field"], content: <StatePreview state="dark">{(
    <div className="demo-number-case__grid">
      <Field label="工作邮箱" htmlFor="explorer-field-email" required hint="用于接收安全通知和较长的组织协作提醒。">
        <Input id="explorer-field-email" type="email" defaultValue="owner@example.com" />
      </Field>
      <Field label="备用邮箱" htmlFor="explorer-field-error" required error="邮箱格式不正确">
        <Input id="explorer-field-error" type="email" defaultValue="invalid" readOnly />
      </Field>
    </div>
  )}</StatePreview> },
    { state: "locale", exports: ["Field"], content: <StatePreview state="locale">{(
    <div className="demo-number-case__grid">
      <Field label="工作邮箱" htmlFor="explorer-field-email" required hint="用于接收安全通知和较长的组织协作提醒。">
        <Input id="explorer-field-email" type="email" defaultValue="owner@example.com" />
      </Field>
      <Field label="备用邮箱" htmlFor="explorer-field-error" required error="邮箱格式不正确">
        <Input id="explorer-field-error" type="email" defaultValue="invalid" readOnly />
      </Field>
    </div>
  )}</StatePreview> },
  ],
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
