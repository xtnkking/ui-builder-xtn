// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"link/overview","exports":["Link"]}
import { Inline, Link } from "../../../personal-ui";
import { StatePreview } from "../state-preview";
import type { ExplorerCase } from "../types";

const explorerCase = {
  id: "link/overview",
  label: "链接",
  summary: "普通、弱化、危险和外部链接保持清晰的导航语义。",
  states: ["default", "longContent", "keyboard", "dark", "locale"],
  content: <Inline wrap><Link href="#account">账户设置</Link><Link href="#archive" variant="muted">归档记录</Link><Link href="#remove" variant="danger">移除成员</Link><Link href="https://example.com" external>外部文档</Link></Inline>,
  stateExamples: [
    { state: "default", exports: ["Link"], content: <Inline wrap><Link href="#account">账户设置</Link><Link href="https://example.com" external newTab>外部文档</Link></Inline> },
    { state: "longContent", exports: ["Link"], content: <Link href="#account">阅读所有产品的成员管理、账户安全、数据访问权限、通知偏好和操作审计配置说明，以确认当前账户设置符合团队的实际使用要求</Link> },
    { state: "keyboard", exports: ["Link"], instructions: "用 Tab 聚焦链接，按 Enter 跳转；浏览器地址的片段变为 #link-keyboard-target。", content: <><Link href="#link-keyboard-target">跳转到说明</Link><p id="link-keyboard-target">链接导航目标</p></> },
    { state: "dark", exports: ["Link"], content: <StatePreview state="dark">{<Link href="#account">账户设置</Link>}</StatePreview> },
    { state: "locale", exports: ["Link"], content: <StatePreview state="locale">{<Link href="https://example.com" external newTab>Documentation</Link>}</StatePreview> },
  ],
  code: `<Link href="/docs" external>外部文档</Link>`,
} satisfies ExplorerCase;

export default explorerCase;
