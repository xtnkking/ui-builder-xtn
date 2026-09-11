import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowRight, Building2 } from "lucide-react";
import { Alert } from "../feedback";
import { Checkbox, Field, Input, PasswordInput, SegmentedControl } from "../forms";
import { Button } from "../primitives";
import { assertUniqueIdentities, type CSSVariableProperties } from "../utils";

export interface LoginProduct {
  id: string;
  name: string;
  accent: string;
  accentHover?: string;
  accentSoft?: string;
  accentInk?: string;
  eyebrow?: string;
  headline: ReactNode;
  description?: ReactNode;
  visual: ReactNode;
}

export interface LoginCredentials {
  email: string;
  password: string;
  remember: boolean;
  productId: string;
}

export interface FamilyLoginPageProps {
  companyName: string;
  companyMark?: ReactNode;
  products: LoginProduct[];
  initialProductId?: string;
  onProductChange?: (productId: string) => void;
  onSubmit: (credentials: LoginCredentials) => Promise<void> | void;
  forgotPasswordHref?: string;
  onForgotPassword?: () => void;
  createAccountHref?: string;
  onCreateAccount?: () => void;
  legal?: ReactNode;
}

export function FamilyLoginPage({
  companyName,
  companyMark,
  products,
  initialProductId,
  onProductChange,
  onSubmit,
  forgotPasswordHref,
  onForgotPassword,
  createAccountHref,
  onCreateAccount,
  legal,
}: FamilyLoginPageProps) {
  assertUniqueIdentities("FamilyLoginPage", "product.id", products.map((product) => product.id));
  const productTitleId = useId();
  const emailId = useId();
  const passwordId = useId();
  const [productId, setProductId] = useState(initialProductId ?? products[0]?.id ?? "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; submit?: string }>({});
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const submittingRef = useRef(false);
  const product = useMemo(() => products.find((item) => item.id === productId) ?? products[0], [productId, products]);
  const resolvedProductId = product?.id ?? "";

  useEffect(() => {
    if (productId !== resolvedProductId) setProductId(resolvedProductId);
  }, [productId, resolvedProductId]);

  if (!product) {
    return (
      <div className="pui-auth-unavailable pui-root">
        <Alert tone="danger" title="登录暂不可用">
          当前没有可用的产品配置，请联系管理员。
        </Alert>
      </div>
    );
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current) return;
    const nextErrors: { email?: string; password?: string } = {};
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) nextErrors.email = "请输入有效的邮箱地址";
    if (!password) nextErrors.password = "请输入密码";
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      (nextErrors.email ? emailRef : passwordRef).current?.focus();
      return;
    }
    setErrors({});
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await onSubmit({ email: email.trim(), password, remember, productId: product.id });
    } catch (error) {
      const message = error instanceof Error ? error.message.trim() : "";
      setErrors({ submit: message || "暂时无法登录，请稍后重试" });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const accentStyle: CSSVariableProperties = {
    "--pui-product-accent": product.accent,
    "--pui-primary": product.accent,
    "--pui-primary-hover": product.accentHover ?? `color-mix(in srgb, ${product.accent} 84%, #000000)`,
    "--pui-primary-soft": product.accentSoft ?? `color-mix(in srgb, ${product.accent} 9%, #ffffff)`,
    "--pui-primary-ink": product.accentInk ?? `color-mix(in srgb, ${product.accent} 76%, #000000)`,
  };

  return (
    <div className="pui-auth pui-root" style={accentStyle}>
      <section className="pui-auth__visual" aria-labelledby={productTitleId}>
        <div className="pui-auth__scene">{product.visual}</div>
        <div className="pui-auth__product-copy">
          {product.eyebrow ? <span>{product.eyebrow}</span> : null}
          <h1 id={productTitleId}>{product.headline}</h1>
          {product.description ? <p>{product.description}</p> : null}
        </div>
      </section>

      <section className="pui-auth__panel">
        <div className="pui-auth__company">
          <span>{companyMark ?? <Building2 aria-hidden="true" />}</span>
          <strong title={companyName}>{companyName}</strong>
        </div>

        {products.length > 1 ? (
          <SegmentedControl
            value={product.id}
            ariaLabel="选择产品"
            disabled={submitting}
            options={products.map((item) => ({ value: item.id, label: item.name }))}
            onValueChange={(nextProductId) => {
              if (submittingRef.current) return;
              setProductId(nextProductId);
              setErrors({});
              onProductChange?.(nextProductId);
            }}
          />
        ) : null}

        <form className="pui-auth__form" noValidate aria-busy={submitting || undefined} onSubmit={handleSubmit}>
          <div className="pui-auth__heading">
            <h2>登录{product.name}</h2>
            <p>使用你的 {companyName} 账户继续。</p>
          </div>

          {errors.submit ? <Alert tone="danger" title="登录失败">{errors.submit}</Alert> : null}

          <Field label="邮箱" htmlFor={emailId} required error={errors.email}>
            <Input
              id={emailId}
              ref={emailRef}
              name="email"
              type="email"
              disabled={submitting}
              autoComplete="email"
              value={email}
              invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? `${emailId}-error` : undefined}
              placeholder="name@company.com"
              onChange={(event) => {
                setEmail(event.target.value);
                if (errors.email || errors.submit) setErrors((current) => ({ ...current, email: undefined, submit: undefined }));
              }}
            />
          </Field>

          <Field label="密码" htmlFor={passwordId} required error={errors.password}>
            <PasswordInput
              id={passwordId}
              ref={passwordRef}
              name="password"
              disabled={submitting}
              autoComplete="current-password"
              value={password}
              invalid={Boolean(errors.password)}
              placeholder="输入密码"
              onChange={(event) => {
                setPassword(event.target.value);
                if (errors.password || errors.submit) setErrors((current) => ({ ...current, password: undefined, submit: undefined }));
              }}
            />
          </Field>

          <div className="pui-auth__options">
            <Checkbox label="保持登录" checked={remember} disabled={submitting} onChange={(event) => setRemember(event.target.checked)} />
            {forgotPasswordHref ? <a href={forgotPasswordHref}>忘记密码？</a> : onForgotPassword ? (
              <button type="button" className="pui-link-button" disabled={submitting} onClick={onForgotPassword}>忘记密码？</button>
            ) : null}
          </div>

          <Button
            type="submit"
            variant="primary"
            trailingIcon={<ArrowRight aria-hidden="true" />}
            loading={submitting}
            loadingLabel="登录中"
          >
            登录
          </Button>

          {createAccountHref || onCreateAccount ? (
            <p className="pui-auth__create">
              还没有账户？ {createAccountHref ? <a href={createAccountHref}>创建账户</a> : (
                <button type="button" className="pui-link-button" disabled={submitting} onClick={onCreateAccount}>创建账户</button>
              )}
            </p>
          ) : null}
        </form>

        <footer className="pui-auth__legal">{legal ?? <>登录即表示你同意服务条款与隐私政策。</>}</footer>
      </section>
    </div>
  );
}
