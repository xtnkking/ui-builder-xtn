// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"validation-summary/overview","exports":["ValidationSummary"]}
import { StatePreview } from "../state-preview";
import { Field, Input, Stack, ValidationSummary } from "../../../personal-ui";
import type { ExplorerCase } from "../types";


const explorerCase = {
  id: "validation-summary/overview",
  label: "校验摘要",
  summary: "摘要链接可将焦点移到出错字段；没有问题时摘要不渲染。",
  states: ["default","empty","error","validation","longContent","keyboard","dark","locale"],
  stateExamples: [
    { state: "default", exports: ["ValidationSummary"], content: <Stack><ValidationSummary issues={[{ id: "email-required", message: "请输入工作邮箱。", fieldId: "validation-email" }]} /><Field label="工作邮箱" htmlFor="validation-email" error="请输入工作邮箱。"><Input id="validation-email" invalid /></Field></Stack> },
    { state: "empty", exports: ["ValidationSummary"], content: <ValidationSummary issues={[]} /> },
    { state: "error", exports: ["ValidationSummary"], content: <Stack><ValidationSummary issues={[{ id: "email-required", message: "请输入工作邮箱。", fieldId: "validation-email" }]} /><Field label="工作邮箱" htmlFor="validation-email" error="请输入工作邮箱。"><Input id="validation-email" invalid /></Field></Stack> },
    { state: "validation", exports: ["ValidationSummary"], content: <Stack><ValidationSummary issues={[{ id: "email-required", message: "请输入工作邮箱。", fieldId: "validation-email" }]} /><Field label="工作邮箱" htmlFor="validation-email" error="请输入工作邮箱。"><Input id="validation-email" invalid /></Field></Stack> },
    { state: "longContent", exports: ["ValidationSummary"], content: <ValidationSummary title="成员目录查询暂时无法完成，请检查工作区权限、组织网络代理及身份提供方配置。修正这些设置之后重试，已经成功载入的数据将保留，不会重复提交操作。" issues={[{ id: "long-issue", message: "成员目录查询暂时无法完成，请检查工作区权限、组织网络代理及身份提供方配置。修正这些设置之后重试，已经成功载入的数据将保留，不会重复提交操作。" }]} /> },
    { state: "keyboard", exports: ["ValidationSummary"], content: <Stack><ValidationSummary issues={[{ id: "email-required", message: "请输入工作邮箱。", fieldId: "validation-email" }]} /><Field label="工作邮箱" htmlFor="validation-email" error="请输入工作邮箱。"><Input id="validation-email" invalid /></Field></Stack>, instructions: "用 Tab 到达“请输入工作邮箱”链接，按 Enter 后焦点应落在工作邮箱输入框。" },
    { state: "dark", exports: ["ValidationSummary"], content: <StatePreview state="dark"><Stack><ValidationSummary issues={[{ id: "email-required", message: "请输入工作邮箱。", fieldId: "validation-email" }]} /><Field label="工作邮箱" htmlFor="validation-email" error="请输入工作邮箱。"><Input id="validation-email" invalid /></Field></Stack></StatePreview> },
    { state: "locale", exports: ["ValidationSummary"], content: <StatePreview state="locale"><Stack><ValidationSummary issues={[{ id: "email-required", message: "请输入工作邮箱。", fieldId: "validation-email" }]} /><Field label="工作邮箱" htmlFor="validation-email" error="请输入工作邮箱。"><Input id="validation-email" invalid /></Field></Stack></StatePreview> },
  ],
  content: <Stack><ValidationSummary issues={[{ id: "email-required", message: "请输入工作邮箱。", fieldId: "validation-email" }]} /><Field label="工作邮箱" htmlFor="validation-email" error="请输入工作邮箱。"><Input id="validation-email" invalid /></Field></Stack>,
  code: "<ValidationSummary issues={[{ id: \"email-required\", message: \"请输入工作邮箱。\", fieldId: \"email\" }]} />",
} satisfies ExplorerCase;

export default explorerCase;
