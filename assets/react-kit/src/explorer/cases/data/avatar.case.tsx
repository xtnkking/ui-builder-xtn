// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"avatar/overview","exports":["Avatar","AvatarGroup"]}
import { Avatar, AvatarGroup } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const explorerCase = {
  id: "avatar/overview",
  label: "头像与头像组",
  summary: "无图片时使用稳定的姓名回退；头像组通过 max 汇总超出成员且保留整体名称。",
  states: ["default", "empty", "error", "longContent", "dark", "locale"],
  content: (
    <AvatarGroup max={3} ariaLabel="项目成员：林晓、陈屿、王宁和赵舒">
      <Avatar name="林晓" size="large" />
      <Avatar name="陈屿" size="large" />
      <Avatar name="王宁" size="large" />
      <Avatar name="赵舒" size="large" />
    </AvatarGroup>
  ),
  code: `<AvatarGroup max={3} ariaLabel="项目成员"><Avatar name="林晓" /><Avatar name="陈屿" /></AvatarGroup>`,
} satisfies ExplorerCase;

export default explorerCase;
