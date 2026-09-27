import { createRef } from "react";
import {
  ThemeProvider,
  type ThemeProviderProps,
  type ThemeTokens,
} from "../../src/personal-ui";

const semanticTokens: ThemeTokens = {
  "--pui-bg": "#f7f8fa",
  "--pui-surface": "#ffffff",
  "--pui-surface-subtle": "#f8faff",
  "--pui-text": "#171a20",
  "--pui-muted": "#626a75",
  "--pui-border": "#dee2e8",
  "--pui-border-strong": "#bac2cd",
  "--pui-primary": "#1769d2",
  "--pui-primary-hover": "#125ab8",
  "--pui-primary-soft": "#eaf2ff",
  "--pui-primary-ink": "#125ab8",
  "--pui-on-primary": "#ffffff",
  "--pui-success": "#137a43",
  "--pui-success-soft": "#edf8f1",
  "--pui-warning": "#996300",
  "--pui-warning-soft": "#fff6df",
  "--pui-danger": "#c9362b",
  "--pui-danger-soft": "#fff1ef",
  "--pui-on-danger": "#ffffff",
  "--pui-focus-ring": "#1769d2",
  "--pui-product-accent": "#1769d2",
};

const providerProps: ThemeProviderProps = {
  id: "account-theme",
  mode: "system",
  tokens: semanticTokens,
  "aria-label": "Account theme",
};
const allowedUsage = <ThemeProvider {...providerProps} data-track="theme">Content</ThemeProvider>;
void allowedUsage;

// @ts-expect-error geometric tokens are private implementation details
const geometricToken: ThemeTokens = { "--pui-radius-control": "999px" };
// @ts-expect-error arbitrary prefixed tokens are not part of the semantic allowlist
const unknownToken: ThemeTokens = { "--pui-brand-surprise": "hotpink" };
// @ts-expect-error semantic color token values must be CSS strings
const numericToken: ThemeTokens = { "--pui-primary": 42 };
void geometricToken;
void unknownToken;
void numericToken;

// @ts-expect-error ThemeProvider owns its canonical class
const classNameEscape = <ThemeProvider className="foreign">Content</ThemeProvider>;
// @ts-expect-error ThemeProvider styling is limited to the documented token API
const styleEscape = <ThemeProvider style={{ background: "hotpink" }}>Content</ThemeProvider>;
// @ts-expect-error ThemeProvider does not expose CSS-in-JS escape props
const cssEscape = <ThemeProvider css={{ background: "hotpink" }}>Content</ThemeProvider>;
// @ts-expect-error ThemeProvider does not expose a mutable DOM ref
const refEscape = <ThemeProvider ref={createRef<HTMLDivElement>()}>Content</ThemeProvider>;
// @ts-expect-error ThemeProvider owns its internal marker
const ownerEscape = <ThemeProvider data-pui-owner="Consumer">Content</ThemeProvider>;
// @ts-expect-error mode is a closed public contract
const invalidMode = <ThemeProvider mode="auto">Content</ThemeProvider>;
void classNameEscape;
void styleEscape;
void cssEscape;
void refEscape;
void ownerEscape;
void invalidMode;
