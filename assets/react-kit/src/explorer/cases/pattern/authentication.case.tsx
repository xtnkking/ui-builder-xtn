// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"authentication/overview","exports":["AuthenticationPage","FamilyLoginPage"]}
import { useState } from "react";
import { AuthenticationPage, Button, FamilyLoginPage, Field, Input, Tabs } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

function AuthenticationExample() {
  const [email, setEmail] = useState("");
  return (
    <Tabs
      ariaLabel="认证页面案例"
      defaultValue="family"
      items={[
        {
          id: "family",
          label: "品牌家族登录",
          content: (
            <FamilyLoginPage
              companyName="Northstar"
              products={[
                { id: "docs", name: "文档", accent: "#1769d2", headline: "团队内容保持清楚有序", description: "共享同一份准确上下文。", visual: <div aria-hidden="true">Docs</div> },
                { id: "data", name: "数据", accent: "#188766", headline: "把数据变成判断", description: "统一指标与决策记录。", visual: <div aria-hidden="true">Data</div> },
              ]}
              onSubmit={async () => undefined}
            />
          ),
        },
        {
          id: "generic",
          label: "通用认证页",
          content: (
            <AuthenticationPage company="Northstar" product="Admin" title="登录工作区" description="使用组织账户继续。">
              <Field label="邮箱" htmlFor="explorer-auth-email">
                <Input id="explorer-auth-email" value={email} onChange={(event) => setEmail(event.currentTarget.value)} />
              </Field>
              <Button variant="primary">继续</Button>
            </AuthenticationPage>
          ),
        },
      ]}
    />
  );
}

const explorerCase: ExplorerCase = {
  id: "authentication/overview",
  label: "认证与品牌家族",
  summary: "共享认证控件与公司身份，产品差异由名称、强调色、文案和视觉插槽表达。",
  states: ["default", "loading", "empty", "error", "validation", "longContent", "keyboard", "mobile", "overlay", "dark", "locale"],
  content: <AuthenticationExample />,
  code: `import { FamilyLoginPage } from "./personal-ui";

<FamilyLoginPage companyName="Northstar" products={products} onSubmit={signIn} />`,
};

export default explorerCase;
