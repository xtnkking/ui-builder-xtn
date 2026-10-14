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
export const THEME_PRESETS = ["default", "apple", "material"] as const;
export type UIThemePreset = (typeof THEME_PRESETS)[number];
export const THEME_MATERIALS = ["solid", "glass"] as const;
export type UIThemeMaterial = (typeof THEME_MATERIALS)[number];

// These are implementation tokens, not consumer customization capabilities.
// Portals need the same state colors, shape, elevation and material as their
// logical source, without copying arbitrary component/runtime CSS variables.
export const INTERNAL_THEME_TOKEN_NAMES = [
  "--_ui-control-hover-border", "--_ui-control-hover-bg", "--_ui-danger-hover",
  "--_ui-disabled-bg", "--_ui-disabled-text", "--_ui-placeholder", "--_ui-skeleton",
  "--_ui-switch-track", "--_ui-switch-thumb", "--_ui-segmented-bg",
  "--_ui-segmented-border", "--_ui-segmented-shadow", "--_ui-neutral-tag-border",
  "--_ui-neutral-tag-bg", "--_ui-neutral-tag-text", "--_ui-primary-border",
  "--_ui-success-border", "--_ui-warning-border", "--_ui-danger-border",
  "--_ui-interactive-hover-bg", "--_ui-progress-track", "--_ui-toast-close-hover",
  "--_ui-toast-shadow", "--_ui-toast-countdown-track", "--_ui-toast-countdown-fill",
  "--_ui-backdrop", "--_ui-tooltip-bg", "--_ui-tooltip-text", "--_ui-scrollbar-thumb",
  "--_ui-auth-visual-bg", "--_ui-auth-visual-text", "--_ui-auth-visual-muted",
  "--_ui-auth-visual-copy", "--_ui-code-bg", "--_ui-code-text", "--_ui-code-border",
  "--_ui-code-muted", "--_ui-code-action", "--_ui-meter-track", "--_ui-chart-track",
  "--_ui-carousel-dot", "--_ui-lightbox-backdrop", "--_ui-lightbox-text",
  "--_ui-tour-backdrop", "--_ui-rating", "--_ui-color-swatch-text",
  "--_ui-color-swatch-shadow", "--_ui-theme-radius-control", "--_ui-theme-radius-surface",
  "--_ui-theme-radius-table", "--_ui-theme-radius-button", "--_ui-theme-radius-toast",
  "--_ui-theme-radius-drawer-edge",
  "--_ui-theme-shadow-popover", "--_ui-theme-shadow-overlay", "--_ui-theme-shadow-toast",
  "--_ui-material-surface", "--_ui-material-filter",
] as const;

const publicThemeTokenNames = new Set<string>(PUBLIC_THEME_TOKEN_NAMES);
const themeModes = new Set<string>(THEME_MODES);

export function assertValidThemePreset(preset: unknown): asserts preset is UIThemePreset | undefined {
  if (preset === undefined || THEME_PRESETS.some((value) => value === preset)) return;
  throw new Error(
    `ThemeProvider received an unsupported preset ${JSON.stringify(preset)}. `
    + `Expected one of ${THEME_PRESETS.map((value) => JSON.stringify(value)).join(", ")}.`,
  );
}

export function assertValidThemeMaterial(material: unknown): asserts material is UIThemeMaterial | undefined {
  if (material === undefined || THEME_MATERIALS.some((value) => value === material)) return;
  throw new Error(
    `ThemeProvider received an unsupported material ${JSON.stringify(material)}. `
    + `Expected one of ${THEME_MATERIALS.map((value) => JSON.stringify(value)).join(", ")}.`,
  );
}

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
