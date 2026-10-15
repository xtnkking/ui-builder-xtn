import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, Mail, ShoppingBag } from "lucide-react";
import {
  Accordion,
  AuthenticationPage,
  Button,
  Checkbox,
  DescriptionList,
  Dialog,
  Field,
  Form,
  Inline,
  Input,
  PasswordInput,
  SegmentedControl,
  Stack,
  Tag,
  useToast,
  type FormControlHandle,
  type TextControlHandle,
} from "../../ui";
import "./authentication.css";
import { useCommerce } from "./commerce-store";

type AuthMode = "login" | "register";
type FieldErrors = Partial<Record<"name" | "email" | "password" | "confirmation" | "terms", string>>;
const demoAccount = {
  name: "林小夏",
  email: "demo@qingyu.example",
  password: "Qingyu2026!",
};
function BrandVisual() {
  return (
    <div className="business-auth-visual">
      <Tag tone="blue" leading={<ShoppingBag aria-hidden="true" />}>青屿 · 日常好物</Tag>
      <h2 className="business-auth-visual-heading">
        把喜欢的日常，带回家。
      </h2>
      <p className="business-auth-visual-copy">
        为工作和生活挑选简单、耐用的好物。从收藏心愿到订单签收，青屿陪你认真对待每一天。
      </p>
      <div className="business-auth-visual-story">
        <div className="business-auth-scene-object" aria-hidden="true">
          <span className="business-auth-scene-ring" />
          <span className="business-auth-scene-book" />
          <span className="business-auth-scene-cup" />
        </div>
        <div className="business-auth-story-copy">
          <span className="business-auth-eyebrow">本周精选</span>
          <strong>桌面，也可以很轻松</strong>
          <span>随行杯 / 桌面收纳 / 轻装出行</span>
        </div>
      </div>
      <Inline gap="small"><Tag>日常好物</Tag><Tag>用心设计</Tag><Tag>安心售后</Tag></Inline>
    </div>
  );
}

/** A local business workflow; no account or credentials are sent to a service. */
export function BusinessAuthenticationExample({ onContinue }: { onContinue: () => void }) {
  const { account, signIn, registerAccount, signOut } = useCommerce();
  const { toast } = useToast();
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [terms, setTerms] = useState(false);
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [resetPending, setResetPending] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const mounted = useRef(true);
  const pendingLock = useRef(false);
  const resetLock = useRef(false);
  const timers = useRef(new Map<ReturnType<typeof setTimeout>, () => void>());
  const formRef = useRef<FormControlHandle>(null);
  const nameRef = useRef<TextControlHandle>(null);
  const emailRef = useRef<TextControlHandle>(null);
  const passwordRef = useRef<TextControlHandle>(null);
  const confirmationRef = useRef<TextControlHandle>(null);
  const resetEmailRef = useRef<TextControlHandle>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      for (const [timer, cancel] of timers.current) {
        clearTimeout(timer);
        cancel();
      }
      timers.current.clear();
    };
  }, []);

  function waitForDemo() {
    return new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => {
        timers.current.delete(timer);
        resolve(mounted.current);
      }, 900);
      timers.current.set(timer, () => resolve(false));
    });
  }

  function clearFieldError(field: keyof FieldErrors) {
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function switchMode(next: AuthMode) {
    if (pendingLock.current) return;
    setMode(next);
    setErrors({});
    setPassword("");
    setConfirmation("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingLock.current) return;
    const nextErrors: FieldErrors = {};
    const cleanEmail = email.trim().toLowerCase();
    if (mode === "register" && name.trim().length < 2) nextErrors.name = "请输入至少两个字的姓名。";
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) nextErrors.email = "请输入有效的邮箱地址。";
    if (!password) nextErrors.password = "请输入密码。";
    if (mode === "register") {
      if (!/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(password)) nextErrors.password = "密码至少 8 位，包含字母和数字。";
      if (confirmation !== password || !confirmation) nextErrors.confirmation = "两次输入的密码需要一致。";
      if (!terms) nextErrors.terms = "请先阅读并同意演示服务条款。";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      if (nextErrors.name) nameRef.current?.focus();
      else if (nextErrors.email) emailRef.current?.focus();
      else if (nextErrors.password) passwordRef.current?.focus();
      else if (nextErrors.confirmation) confirmationRef.current?.focus();
      else formRef.current?.reportValidity();
      return;
    }
    pendingLock.current = true;
    setPending(true);
    try {
      if (!(await waitForDemo())) return;
      if (simulateFailure) {
        setSimulateFailure(false);
        toast({ tone: "danger", title: mode === "login" ? "登录未完成" : "注册未完成", description: "模拟服务暂时不可用。输入内容已保留，请再次提交重试。此异常只触发一次。" });
        return;
      }
      if (mode === "register") {
        registerAccount(name.trim(), cleanEmail, password);
        setEmail(cleanEmail);
        setMode("login");
        setPassword("");
        setConfirmation("");
        toast({ tone: "success", description: "账户已创建，请使用刚设置的密码登录。该账户在本次商城浏览期间保留，刷新页面后清除。" });
      } else {
        signIn(cleanEmail, password);
        setPassword("");
        toast({ tone: "success", description: "登录成功，欢迎来到青屿商城。" });
      }
    } catch (error) {
      if (mounted.current) toast({ tone: "danger", title: mode === "login" ? "登录未完成" : "注册未完成", description: error instanceof Error ? error.message : "暂时无法完成提交，请重试。" });
    } finally {
      pendingLock.current = false;
      if (mounted.current) setPending(false);
    }
  }

  function openReset() {
    setResetEmail(email);
    setResetError("");
    setResetSent(false);
    setResetOpen(true);
  }

  async function submitReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (resetLock.current) return;
    if (!/^\S+@\S+\.\S+$/.test(resetEmail.trim())) {
      setResetError("请输入有效的邮箱地址。");
      resetEmailRef.current?.focus();
      return;
    }
    resetLock.current = true;
    setResetPending(true);
    setResetError("");
    try {
      if (await waitForDemo()) {
        setResetSent(true);
        toast({ tone: "success", description: "重置请求已模拟完成。本案例没有发送邮件或修改密码。" });
      }
    } finally {
      resetLock.current = false;
      if (mounted.current) setResetPending(false);
    }
  }

  return (
    <div className="business-auth-root">
      <AuthenticationPage
        company="青屿"
        product="青屿商城"
        layout="embedded"
        title={account ? `你好，${account.name}` : mode === "login" ? "欢迎回来" : "创建青屿账户"}
        description={account ? "账户已登录，可以继续浏览商品。" : "登录后管理收藏、收货地址与订单。"}
        visual={<BrandVisual />}
        footer={<p>本地交互演示，不调用真实接口，不发送邮件，不持久保存密码；请勿输入真实凭据。</p>}
      >
        {account ? (
          <Stack gap="large">
            <DescriptionList items={[
              { id: "name", term: "账户姓名", description: account.name },
              { id: "email", term: "登录邮箱", description: account.email },
              { id: "session", term: "登录会话", description: "当前商城浏览会话，刷新页面后结束" },
            ]} />
            <Inline>
              <Button variant="primary" trailingIcon={<ArrowRight aria-hidden="true" />} onClick={onContinue}>去逛逛商品</Button>
              <Button onClick={() => { signOut(); toast({ tone: "info", description: "已退出账户。" }); }}>退出登录</Button>
            </Inline>
          </Stack>
        ) : (
          <Stack gap="medium">
            <SegmentedControl<AuthMode> ariaLabel="登录或注册" fill value={mode} disabled={pending} onValueChange={switchMode} options={[{ value: "login", label: "登录" }, { value: "register", label: "注册" }]} />
            <Form noValidate busy={pending} controlRef={formRef} onSubmit={submit}>
              {mode === "register" ? <Field label="姓名" htmlFor="business-auth-name" required error={errors.name}>
                <Input id="business-auth-name" name="name" autoComplete="name" maxLength={40} value={name} disabled={pending} controlRef={nameRef} placeholder="怎么称呼你" onChange={(event) => { setName(event.currentTarget.value); clearFieldError("name"); }} />
              </Field> : null}
              <Field label="邮箱" htmlFor="business-auth-email" required error={errors.email}>
                <Input id="business-auth-email" name="email" type="email" autoComplete="email" value={email} disabled={pending} controlRef={emailRef} startAdornment={<Mail aria-hidden="true" />} placeholder="请输入邮箱地址" onChange={(event) => { setEmail(event.currentTarget.value); clearFieldError("email"); }} />
              </Field>
              <Field label="密码" htmlFor="business-auth-password" required error={errors.password} hint={mode === "register" ? "至少 8 位，包含字母和数字。" : undefined}>
                <PasswordInput id="business-auth-password" name="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} disabled={pending} controlRef={passwordRef} placeholder={mode === "login" ? "请输入密码" : "设置登录密码"} onChange={(event) => { setPassword(event.currentTarget.value); clearFieldError("password"); }} />
              </Field>
              {mode === "register" ? <>
                <Field label="确认密码" htmlFor="business-auth-confirmation" required error={errors.confirmation}>
                  <PasswordInput id="business-auth-confirmation" name="confirmation" autoComplete="new-password" value={confirmation} disabled={pending} controlRef={confirmationRef} placeholder="再次输入密码" onChange={(event) => { setConfirmation(event.currentTarget.value); clearFieldError("confirmation"); }} />
                </Field>
                <Field label="服务条款" htmlFor="business-auth-terms" error={errors.terms}>
                  <Checkbox id="business-auth-terms" name="terms" required checked={terms} disabled={pending} label="我已阅读并同意演示服务条款" onChange={(event) => { setTerms(event.currentTarget.checked); clearFieldError("terms"); }} />
                </Field>
                <div><Button variant="ghost" size="small" disabled={pending} onClick={() => setTermsOpen(true)}>查看服务条款</Button></div>
              </> : <Inline justify="end" gap="small">
                <Button variant="ghost" size="small" disabled={pending} onClick={openReset}>忘记密码？</Button>
              </Inline>}
              <Button type="submit" variant="primary" size="field" loading={pending} loadingLabel={mode === "login" ? "登录中" : "创建中"} trailingIcon={<ArrowRight aria-hidden="true" />}>{mode === "login" ? "登录" : "创建账户"}</Button>
            </Form>
            <Accordion ariaLabel="登录帮助" items={[{
              id: "demo-account",
              title: "体验账号与登录帮助",
              content: <div className="business-auth-demo-help">
                <p className="business-auth-help-copy">可注册自己的临时账户，或使用下面的体验账号。</p>
                <p className="business-auth-help-copy">邮箱：{demoAccount.email}</p>
                <p className="business-auth-help-copy">密码：{demoAccount.password}</p>
                <Inline><Button size="small" disabled={pending} onClick={() => { setMode("login"); setEmail(demoAccount.email); setPassword(demoAccount.password); setErrors({}); }}>填入演示账号</Button></Inline>
                <Checkbox label="下一次提交模拟服务异常（之后可重试）" checked={simulateFailure} disabled={pending} onChange={(event) => setSimulateFailure(event.currentTarget.checked)} />
              </div>,
            }]} />
          </Stack>
        )}
      </AuthenticationPage>
      <Dialog open={resetOpen} onOpenChange={(open) => { if (!resetLock.current) setResetOpen(open); }} closable={!resetPending} width="small" title="找回密码" description="输入账户邮箱，体验密码重置邮件的发送流程。">
        {resetSent ? <Stack gap="medium">
          <p>若此邮箱已注册，真实服务应向 {resetEmail.trim()} 发送重置链接。本案例没有实际发送邮件，也没有修改密码。</p>
          <Button onClick={() => setResetOpen(false)}>返回登录</Button>
        </Stack> : <Form noValidate busy={resetPending} onSubmit={submitReset}>
          <Field label="账户邮箱" htmlFor="business-auth-reset-email" required error={resetError}>
            <Input id="business-auth-reset-email" type="email" name="resetEmail" value={resetEmail} disabled={resetPending} controlRef={resetEmailRef} autoComplete="email" placeholder="请输入注册邮箱" onChange={(event) => { setResetEmail(event.currentTarget.value); setResetError(""); }} />
          </Field>
          <Inline>
            <Button type="submit" variant="primary" loading={resetPending} loadingLabel="发送中">发送重置链接</Button>
            <Button disabled={resetPending} onClick={() => setResetOpen(false)}>取消</Button>
          </Inline>
        </Form>}
      </Dialog>
      <Dialog open={termsOpen} onOpenChange={setTermsOpen} width="small" title="演示服务条款" description="本条款仅用于展示注册时的阅读与同意流程。" footer={<Button variant="primary" onClick={() => { setTerms(true); clearFieldError("terms"); setTermsOpen(false); }}>同意并返回注册</Button>}>
        <Stack gap="medium">
          <p>青屿是虚构品牌，本案例提供登录、注册、找回密码及商品浏览的交互演示。</p>
          <p>输入内容仅存在于本次商城浏览期间，不发送到服务器。页面内切换不会清除账户，刷新页面后账户与登录状态将重置。</p>
          <p>不要输入真实账户信息。这里的确认操作不建立任何商业合同或真实用户账户。</p>
        </Stack>
      </Dialog>
    </div>
  );
}
