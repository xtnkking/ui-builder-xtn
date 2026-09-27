// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"link/overview","exports":["Link"]}
import { Inline, Link } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const explorerCase = {
  id: "link/overview",
  label: "链接",
  summary: "普通、弱化、危险和外部链接保持清晰的导航语义。",
  states: ["default", "disabled", "longContent", "keyboard", "dark", "locale"],
  content: <Inline wrap><Link href="#account">账户设置</Link><Link href="#archive" variant="muted">归档记录</Link><Link href="#remove" variant="danger">移除成员</Link><Link href="https://example.com" external>外部文档</Link></Inline>,
  code: `<Link href="/docs" external>外部文档</Link>`,
} satisfies ExplorerCase;

export default explorerCase;
