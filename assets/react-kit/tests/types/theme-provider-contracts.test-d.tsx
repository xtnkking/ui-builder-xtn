import { createRef } from "react";
import {
  ThemeProvider,
  type ThemeProviderProps,
  type ThemeTokens,
} from "../../src/ui";

const semanticTokens: ThemeTokens = {
  "--ui-bg": "#f7f8fa",
  "--ui-surface": "#ffffff",
  "--ui-surface-subtle": "#f8faff",
  "--ui-text": "#171a20",
  "--ui-muted": "#626a75",
  "--ui-border": "#dee2e8",
  "--ui-border-strong": "#bac2cd",
  "--ui-primary": "#1769d2",
  "--ui-primary-hover": "#125ab8",
  "--ui-primary-soft": "#eaf2ff",
  "--ui-primary-ink": "#125ab8",
  "--ui-on-primary": "#ffffff",
  "--ui-success": "#137a43",
  "--ui-success-soft": "#edf8f1",
  "--ui-warning": "#996300",
  "--ui-warning-soft": "#fff6df",
  "--ui-danger": "#c9362b",
  "--ui-danger-soft": "#fff1ef",
  "--ui-on-danger": "#ffffff",
  "--ui-focus-ring": "#1769d2",
  "--ui-product-accent": "#1769d2",
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
const geometricToken: ThemeTokens = { "--ui-radius-control": "999px" };
// @ts-expect-error arbitrary prefixed tokens are not part of the semantic allowlist
const unknownToken: ThemeTokens = { "--ui-brand-surprise": "hotpink" };
// @ts-expect-error semantic color token values must be CSS strings
const numericToken: ThemeTokens = { "--ui-primary": 42 };
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
const ownerEscape = <ThemeProvider data-ui-owner="Consumer">Content</ThemeProvider>;
// @ts-expect-error mode is a closed public contract
const invalidMode = <ThemeProvider mode="auto">Content</ThemeProvider>;
void classNameEscape;
void styleEscape;
void cssEscape;
void refEscape;
void ownerEscape;
void invalidMode;
