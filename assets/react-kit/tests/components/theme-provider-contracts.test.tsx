// @personal-ui-coverage {"kind":"unit","runner":"components","exports":["ThemeProvider"]}
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  ThemeProvider,
  type ThemeProviderProps,
  type ThemeTokens,
} from "../../src/personal-ui";

describe("ThemeProvider contracts", () => {
  it("represents light, dark, system, and true inherited modes without local mode drift", () => {
    const { rerender } = render(
      <ThemeProvider data-testid="theme" mode="light">Light</ThemeProvider>,
    );
    const theme = screen.getByTestId("theme");

    expect(theme).toHaveAttribute("data-color-scheme", "light");
    expect(theme.style.colorScheme).toBe("");

    rerender(<ThemeProvider data-testid="theme" mode="dark">Dark</ThemeProvider>);
    expect(theme).toHaveAttribute("data-color-scheme", "dark");

    rerender(<ThemeProvider data-testid="theme" mode="system">System</ThemeProvider>);
    expect(theme).toHaveAttribute("data-color-scheme", "system");

    rerender(<ThemeProvider data-testid="theme">Inherited</ThemeProvider>);
    expect(theme).not.toHaveAttribute("data-color-scheme");
    expect(theme.style.colorScheme).toBe("inherit");
  });

  it("keeps nested inherit mode attached to its ancestor while applying semantic tokens", () => {
    render(
      <ThemeProvider data-testid="outer" mode="dark">
        <ThemeProvider
          data-testid="inner"
          tokens={{
            "--pui-primary": "#246bfe",
            "--pui-on-primary": "#ffffff",
            "--pui-focus-ring": "#77a3ff",
          }}
        >
          Nested content
        </ThemeProvider>
      </ThemeProvider>,
    );

    expect(screen.getByTestId("outer")).toHaveAttribute("data-color-scheme", "dark");
    const inner = screen.getByTestId("inner");
    expect(inner).not.toHaveAttribute("data-color-scheme");
    expect(inner.style.getPropertyValue("--pui-primary")).toBe("#246bfe");
    expect(inner.style.getPropertyValue("--pui-on-primary")).toBe("#ffffff");
    expect(inner.style.getPropertyValue("--pui-focus-ring")).toBe("#77a3ff");
  });

  it("rejects unknown, geometric, and invalid semantic token values at runtime", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() => render(
      <ThemeProvider
        tokens={{ "--pui-radius-control": "999px" } as unknown as ThemeTokens}
      >
        Invalid geometry
      </ThemeProvider>,
    )).toThrow(/unsupported theme token "--pui-radius-control"/);

    expect(() => render(
      <ThemeProvider
        tokens={{ "--pui-brand-surprise": "hotpink" } as unknown as ThemeTokens}
      >
        Unknown token
      </ThemeProvider>,
    )).toThrow(/unsupported theme token "--pui-brand-surprise"/);

    expect(() => render(
      <ThemeProvider
        tokens={{ "--pui-primary": 42 } as unknown as ThemeTokens}
      >
        Invalid value
      </ThemeProvider>,
    )).toThrow(/token "--pui-primary" must be a non-empty CSS color string/);

    consoleError.mockRestore();
  });

  it("rejects unsupported modes and strips forced styling escape hatches", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() => render(
      <ThemeProvider mode={"auto" as unknown as ThemeProviderProps["mode"]}>
        Invalid mode
      </ThemeProvider>,
    )).toThrow(/unsupported mode "auto"/);

    const forcedProps = {
      className: "foreign-theme",
      style: { background: "hotpink" },
      "data-testid": "safe-theme",
      children: "Safe theme",
    } as unknown as ThemeProviderProps;
    render(<ThemeProvider {...forcedProps} />);

    const theme = screen.getByTestId("safe-theme");
    expect(theme).toHaveClass("pui-theme", "pui-root");
    expect(theme).not.toHaveClass("foreign-theme");
    expect(theme.style.background).toBe("");

    consoleError.mockRestore();
  });
});
