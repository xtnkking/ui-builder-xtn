import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowRight, Building2 } from "lucide-react";
import type { TextControlHandle } from "../foundation/contracts";
import { Alert } from "../feedback/feedback";
import { Checkbox, Field, Input, PasswordInput, SegmentedControl } from "../input/forms";
import { usePersonalUILocale } from "../foundation/locale";
import { Button } from "../foundation/primitives";
import { assertUniqueIdentities, type CSSVariableProperties } from "../internal/utils";

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

type LoginErrors = {
  email?: "invalid";
  password?: "required";
  submit?: { kind: "default" } | { kind: "business"; message: string };
};

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
  const { message } = usePersonalUILocale();
  assertUniqueIdentities("FamilyLoginPage", "product.id", products.map((product) => product.id));
  const productTitleId = useId();
  const emailId = useId();
  const passwordId = useId();
  const [productId, setProductId] = useState(initialProductId ?? products[0]?.id ?? "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<LoginErrors>({});
  const emailRef = useRef<TextControlHandle>(null);
  const passwordRef = useRef<TextControlHandle>(null);
  const submittingRef = useRef(false);
  const product = useMemo(() => products.find((item) => item.id === productId) ?? products[0], [productId, products]);
  const resolvedProductId = product?.id ?? "";
  const emailError = errors.email ? message("login.invalidEmail") : undefined;
  const passwordError = errors.password ? message("login.passwordRequired") : undefined;
  const submitError = errors.submit?.kind === "business"
    ? errors.submit.message
    : errors.submit
      ? message("login.failedDefault")
      : undefined;

  useEffect(() => {
    if (productId !== resolvedProductId) setProductId(resolvedProductId);
  }, [productId, resolvedProductId]);

  if (!product) {
    return (
      <div className="pui-auth-unavailable pui-root" data-pui-owner="FamilyLoginPage">
        <Alert tone="danger" title={message("login.unavailableTitle")}>
          {message("login.unavailableDescription")}
        </Alert>
      </div>
    );
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current) return;
    const nextErrors: LoginErrors = {};
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) nextErrors.email = "invalid";
    if (!password) nextErrors.password = "required";
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
      const errorMessage = error instanceof Error ? error.message.trim() : "";
      setErrors({ submit: errorMessage
        ? { kind: "business", message: errorMessage }
        : { kind: "default" } });
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
    <div className="pui-auth pui-root" style={accentStyle} data-pui-owner="FamilyLoginPage">
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
            ariaLabel={message("login.productSelector")}
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
            <h2>{message("login.heading", { product: product.name })}</h2>
            <p>{message("login.continue", { company: companyName })}</p>
          </div>

          {submitError ? <Alert tone="danger" title={message("login.failedTitle")}>{submitError}</Alert> : null}

          <Field label={message("login.email")} htmlFor={emailId} required error={emailError}>
            <Input
              id={emailId}
              controlRef={emailRef}
              name="email"
              type="email"
              disabled={submitting}
              autoComplete="email"
              value={email}
              invalid={Boolean(errors.email)}
              aria-describedby={emailError ? `${emailId}-error` : undefined}
              placeholder="name@company.com"
              onChange={(event) => {
                setEmail(event.target.value);
                if (errors.email || errors.submit) setErrors((current) => ({ ...current, email: undefined, submit: undefined }));
              }}
            />
          </Field>

          <Field label={message("login.password")} htmlFor={passwordId} required error={passwordError}>
            <PasswordInput
              id={passwordId}
              controlRef={passwordRef}
              name="password"
              disabled={submitting}
              autoComplete="current-password"
              value={password}
              invalid={Boolean(errors.password)}
              placeholder={message("login.passwordPlaceholder")}
              onChange={(event) => {
                setPassword(event.target.value);
                if (errors.password || errors.submit) setErrors((current) => ({ ...current, password: undefined, submit: undefined }));
              }}
            />
          </Field>

          <div className="pui-auth__options">
            <Checkbox label={message("login.remember")} checked={remember} disabled={submitting} onChange={(event) => setRemember(event.target.checked)} />
            {forgotPasswordHref ? <a href={forgotPasswordHref}>{message("login.forgot")}</a> : onForgotPassword ? (
              <button type="button" className="pui-link-button" disabled={submitting} onClick={onForgotPassword}>{message("login.forgot")}</button>
            ) : null}
          </div>

          <Button
            type="submit"
            variant="primary"
            trailingIcon={<ArrowRight aria-hidden="true" />}
            loading={submitting}
            loadingLabel={message("login.submitting")}
          >
            {message("login.submit")}
          </Button>

          {createAccountHref || onCreateAccount ? (
            <p className="pui-auth__create">
              {message("login.noAccount")} {createAccountHref ? <a href={createAccountHref}>{message("login.createAccount")}</a> : (
                <button type="button" className="pui-link-button" disabled={submitting} onClick={onCreateAccount}>{message("login.createAccount")}</button>
              )}
            </p>
          ) : null}
        </form>

        <footer className="pui-auth__legal">{legal ?? message("login.legal")}</footer>
      </section>
    </div>
  );
}
