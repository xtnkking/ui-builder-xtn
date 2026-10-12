// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"authentication/overview","exports":["AuthenticationPage","FamilyLoginPage"]}
import { StatePreview } from "../state-preview";
import { useId, useState } from "react";
import { AuthenticationPage, Button, FamilyLoginPage, Field, Form, Input, Tabs } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const loginProducts = [{ id: "docs", name: "文档", accent: "#1769d2", headline: "团队内容保持清楚有序", description: "共享同一份准确上下文。", visual: <div aria-hidden="true">Docs</div> }];
const authenticationVisual = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="560"><rect width="640" height="560" fill="#eaf2ff"/><rect x="100" y="115" width="440" height="330" rx="28" fill="white"/><rect x="140" y="160" width="150" height="16" rx="8" fill="#1769d2"/><rect x="140" y="210" width="360" height="50" rx="12" fill="#edf2f9"/><rect x="140" y="280" width="360" height="50" rx="12" fill="#edf2f9"/><rect x="140" y="355" width="150" height="42" rx="21" fill="#1769d2"/></svg>')}`;

function AuthenticationFields() {
  const emailId = useId();
  const [email, setEmail] = useState("");
  const [feedback, setFeedback] = useState("");
  return <Form aria-label="工作区登录" noValidate onSubmit={(event) => { event.preventDefault(); setFeedback(email.trim() ? `已使用 ${email.trim()} 继续` : "请先输入邮箱"); }}>
      <Field label="邮箱" htmlFor={emailId}>
        <Input id={emailId} type="email" autoComplete="username" placeholder="name@example.com" value={email} onChange={(event) => setEmail(event.currentTarget.value)} />
      </Field>
      <Button type="submit" size="field" variant="primary" loadingLabel="继续">继续</Button>
      {feedback ? <p role="status">{feedback}</p> : null}
    </Form>;
}

function GenericAuthenticationExample({ withVisual = false }: { withVisual?: boolean }) {
  return <AuthenticationPage
    company="Northstar" product="Admin" title="登录工作区" layout="embedded"
    description="使用组织账户继续。"
    visual={withVisual ? <img src={authenticationVisual} alt="统一账户登录插画" /> : undefined}
  >
    <AuthenticationFields />
  </AuthenticationPage>;
}

function AuthenticationExample() {
  const [feedback, setFeedback] = useState("");
  return (
    <Tabs
      ariaLabel="认证页面案例"
      defaultValue="family"
      items={[
        {
          id: "family",
          label: "品牌家族登录",
          content: (
            <><FamilyLoginPage
              companyName="Northstar"
              products={[
                { id: "docs", name: "文档", accent: "#1769d2", headline: "团队内容保持清楚有序", description: "共享同一份准确上下文。", visual: <div aria-hidden="true">Docs</div> },
                { id: "data", name: "数据", accent: "#188766", headline: "把数据变成判断", description: "统一指标与决策记录。", visual: <div aria-hidden="true">Data</div> },
              ]}
              onSubmit={() => setFeedback("品牌家族登录已完成")}
            /><p role="status">{feedback}</p></>
          ),
        },
        {
          id: "generic",
          label: "通用认证页",
          content: <GenericAuthenticationExample />,
        },
        { id: "generic-visual", label: "带插画认证页", content: <GenericAuthenticationExample withVisual /> },
      ]}
    />
  );
}

function ValidationLoginExample() {
  const [feedback, setFeedback] = useState("");
  return <><FamilyLoginPage companyName="Northstar" products={loginProducts} onSubmit={() => setFeedback("字段验证通过，登录已完成")} /><p role="status">{feedback}</p></>;
}

function LongAuthenticationExample() {
  const [feedback, setFeedback] = useState("");
  return <Tabs ariaLabel="长内容认证页面案例" defaultValue="generic" items={[
    { id: "generic", label: "通用认证页", content: <AuthenticationPage company="Northstar" product="Admin" title="登录工作区" layout="embedded" description="此认证页用于访问全部产品中的角色配置、数据访问权限、通知偏好和账户安全设置，请确认所有关联配置均符合团队的实际使用要求。"><AuthenticationFields /></AuthenticationPage> },
    { id: "family", label: "品牌家族登录", content: <><FamilyLoginPage companyName="Northstar" products={[{ id: "details", name: "完整配置", accent: "#1769d2", headline: "统一登录体验", description: "此产品包含全部产品中的角色配置、数据访问权限、通知偏好和账户安全设置，请确认所有关联配置均符合团队的实际使用要求。", visual: <div aria-hidden="true">Docs</div> }]} onSubmit={() => setFeedback("完整配置登录已完成")} /><p role="status">{feedback}</p></> },
  ]} />;
}

const explorerCase: ExplorerCase = {
  id: "authentication/overview",
  label: "认证与品牌家族",
  summary: "共享认证控件与公司身份，产品差异由名称、强调色、文案和视觉插槽表达。",
  states: ["default", "loading", "empty", "error", "validation", "longContent", "keyboard", "mobile", "overlay", "dark", "locale"],
  stateExamples: [
    { state: "loading", exports: ["FamilyLoginPage"], instructions: "输入 demo@example.com 和任意非空密码后登录；onSubmit 延迟 1.8 秒，登录按钮进入加载，表单字段禁用。", content: <FamilyLoginPage companyName="Northstar" products={loginProducts} onSubmit={async () => { await new Promise<void>((resolve) => setTimeout(resolve, 1800)); }} /> },
    { state: "empty", exports: ["FamilyLoginPage"], content: <FamilyLoginPage companyName="Northstar" products={[]} onSubmit={() => undefined} /> },
    { state: "error", exports: ["FamilyLoginPage"], instructions: "输入合法邮箱和非空密码后登录；拒绝回调使页面显示登录失败消息，允许修改后重试。", content: <FamilyLoginPage companyName="Northstar" products={loginProducts} onSubmit={async () => { throw new Error("模拟账户暂不可用，请稍后再试。"); }} /> },
    { state: "validation", exports: ["FamilyLoginPage"], instructions: "保持邮箱、密码为空，点击登录；组件显示字段校验并聚焦第一个无效字段。填写合法邮箱和非空密码后可再次提交。", content: <ValidationLoginExample /> },
    { state: "longContent", exports: ["AuthenticationPage", "FamilyLoginPage"], content: <LongAuthenticationExample /> },
    { state: "default", exports: ["AuthenticationPage","FamilyLoginPage"], content: <AuthenticationExample /> },
    { state: "keyboard", exports: ["AuthenticationPage","FamilyLoginPage"], content: <AuthenticationExample />, instructions: "用 Tab 访问本例可用控件，使用 Enter、Space 和组件文档中的方向键操作。此项为人工操作案例，不是自动行为验收证书。" },
    { state: "mobile", exports: ["AuthenticationPage","FamilyLoginPage"], content: <StatePreview state="mobile">{<AuthenticationExample />}</StatePreview> },
    { state: "overlay", exports: ["AuthenticationPage","FamilyLoginPage"], content: <StatePreview state="overlay">{<AuthenticationExample />}</StatePreview> },
    { state: "dark", exports: ["AuthenticationPage","FamilyLoginPage"], content: <StatePreview state="dark">{<AuthenticationExample />}</StatePreview> },
    { state: "locale", exports: ["AuthenticationPage","FamilyLoginPage"], content: <StatePreview state="locale">{<AuthenticationExample />}</StatePreview> },
  ],
  content: <AuthenticationExample />,
  previewLayout: "page",
  code: `import { FamilyLoginPage } from "./personal-ui";

<FamilyLoginPage companyName="Northstar" products={products} onSubmit={signIn} />`,
};

export default explorerCase;
