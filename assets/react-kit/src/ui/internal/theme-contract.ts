export const PUBLIC_THEME_TOKEN_NAMES = [
  "--ui-bg",
  "--ui-surface",
  "--ui-surface-subtle",
  "--ui-text",
  "--ui-muted",
  "--ui-border",
  "--ui-border-strong",
  "--ui-primary",
  "--ui-primary-hover",
  "--ui-primary-soft",
  "--ui-primary-ink",
  "--ui-on-primary",
  "--ui-success",
  "--ui-success-soft",
  "--ui-warning",
  "--ui-warning-soft",
  "--ui-danger",
  "--ui-danger-soft",
  "--ui-on-danger",
  "--ui-focus-ring",
  "--ui-product-accent",
] as const;

export type PublicThemeTokenName = (typeof PUBLIC_THEME_TOKEN_NAMES)[number];
export type PublicThemeTokens = Partial<Record<PublicThemeTokenName, string>>;

export const THEME_MODES = ["inherit", "light", "dark", "system"] as const;
export type UIThemeMode = (typeof THEME_MODES)[number];

const publicThemeTokenNames = new Set<string>(PUBLIC_THEME_TOKEN_NAMES);
const themeModes = new Set<string>(THEME_MODES);

export function assertValidThemeMode(mode: unknown): asserts mode is UIThemeMode {
  if (typeof mode !== "string" || !themeModes.has(mode)) {
    throw new Error(
      `ThemeProvider received an unsupported mode ${JSON.stringify(mode)}. `
      + `Expected one of ${THEME_MODES.map((value) => JSON.stringify(value)).join(", ")}.`,
    );
  }
}

export function assertValidThemeTokens(tokens: unknown): asserts tokens is PublicThemeTokens | undefined {
  if (tokens === undefined) return;
  if (tokens === null || typeof tokens !== "object" || Array.isArray(tokens)) {
    throw new Error("ThemeProvider tokens must be an object containing supported semantic color tokens.");
  }

  Object.entries(tokens).forEach(([token, value]) => {
    if (!publicThemeTokenNames.has(token)) {
      throw new Error(
        `ThemeProvider received an unsupported theme token ${JSON.stringify(token)}. `
        + "Only documented semantic color tokens can be overridden.",
      );
    }
    if (typeof value !== "string" || !value.trim()) {
      throw new Error(
        `ThemeProvider token ${JSON.stringify(token)} must be a non-empty CSS color string.`,
      );
    }
  });
}
