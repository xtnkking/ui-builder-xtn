// @ui-coverage {"kind":"unit","runner":"components","exports":["ThemeProvider"]}
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  ThemeProvider,
  type ThemeProviderProps,
  type ThemeTokens,
} from "../../src/ui";

describe("ThemeProvider contracts", () => {
  it("defaults to the original solid preset without redefining an inherited palette", () => {
    render(<ThemeProvider data-testid="theme">Default</ThemeProvider>);
    const theme = screen.getByTestId("theme");
    expect(theme).toHaveAttribute("data-theme-preset", "default");
    expect(theme).toHaveAttribute("data-theme-material", "solid");
    expect(theme).not.toHaveAttribute("data-theme-definition");
    expect(theme.style.getPropertyValue("backdrop-filter")).toBe("");
  });

  it("inherits preset and material independently and updates nested providers with their ancestor", () => {
    const content = (preset: "apple" | "material", material: "solid" | "glass") => (
      <ThemeProvider preset={preset} material={material}>
        <ThemeProvider data-testid="inherited">Inherited</ThemeProvider>
        <ThemeProvider data-testid="solid" material="solid">Solid override</ThemeProvider>
        <ThemeProvider data-testid="default" preset="default">Preset override</ThemeProvider>
      </ThemeProvider>
    );
    const { rerender } = render(content("apple", "glass"));
    expect(screen.getByTestId("inherited")).toHaveAttribute("data-theme-preset", "apple");
    expect(screen.getByTestId("inherited")).toHaveAttribute("data-theme-material", "glass");
    expect(screen.getByTestId("inherited")).not.toHaveAttribute("data-theme-definition");
    expect(screen.getByTestId("solid")).toHaveAttribute("data-theme-preset", "apple");
    expect(screen.getByTestId("solid")).toHaveAttribute("data-theme-material", "solid");
    expect(screen.getByTestId("default")).toHaveAttribute("data-theme-preset", "default");
    expect(screen.getByTestId("default")).toHaveAttribute("data-theme-material", "glass");

    rerender(content("material", "solid"));
    expect(screen.getByTestId("inherited")).toHaveAttribute("data-theme-preset", "material");
    expect(screen.getByTestId("inherited")).toHaveAttribute("data-theme-material", "solid");
    expect(screen.getByTestId("solid")).toHaveAttribute("data-theme-preset", "material");
    expect(screen.getByTestId("default")).toHaveAttribute("data-theme-preset", "default");
    expect(screen.getByTestId("default")).toHaveAttribute("data-theme-material", "solid");
  });

  it("keeps inherited custom colors while selecting the same preset for an explicit mode", () => {
    render(
      <ThemeProvider mode="dark" preset="apple" material="glass" tokens={{ "--ui-primary": "#224466" }}>
        <ThemeProvider data-testid="inherited" tokens={{ "--ui-surface": "#223344" }}>Inherited</ThemeProvider>
        <ThemeProvider data-testid="light" mode="light">Light Apple</ThemeProvider>
      </ThemeProvider>,
    );
    const inherited = screen.getByTestId("inherited");
    expect(inherited).not.toHaveAttribute("data-color-scheme");
    expect(inherited).not.toHaveAttribute("data-theme-definition");
    expect(inherited.style.getPropertyValue("--ui-primary")).toBe("");
    expect(inherited.style.getPropertyValue("--ui-surface")).toBe("#223344");
    expect(screen.getByTestId("light")).toHaveAttribute("data-color-scheme", "light");
    expect(screen.getByTestId("light")).toHaveAttribute("data-theme-preset", "apple");
    expect(screen.getByTestId("light")).toHaveAttribute("data-theme-definition", "true");
  });

  it("rejects unsupported presets and materials at runtime", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => render(
      <ThemeProvider preset={"custom" as ThemeProviderProps["preset"]}>Invalid preset</ThemeProvider>,
    )).toThrow(/unsupported preset "custom"/);
    expect(() => render(
      <ThemeProvider material={"transparent" as ThemeProviderProps["material"]}>Invalid material</ThemeProvider>,
    )).toThrow(/unsupported material "transparent"/);
    expect(() => render(
      <ThemeProvider tokens={{ "--_ui-theme-radius-surface": "999px" } as unknown as ThemeTokens}>Private shape</ThemeProvider>,
    )).toThrow(/unsupported theme token "--_ui-theme-radius-surface"/);
    consoleError.mockRestore();
  });

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
            "--ui-primary": "#246bfe",
            "--ui-on-primary": "#ffffff",
            "--ui-focus-ring": "#77a3ff",
          }}
        >
          Nested content
        </ThemeProvider>
      </ThemeProvider>,
    );

    expect(screen.getByTestId("outer")).toHaveAttribute("data-color-scheme", "dark");
    const inner = screen.getByTestId("inner");
    expect(inner).not.toHaveAttribute("data-color-scheme");
    expect(inner.style.getPropertyValue("--ui-primary")).toBe("#246bfe");
    expect(inner.style.getPropertyValue("--ui-on-primary")).toBe("#ffffff");
    expect(inner.style.getPropertyValue("--ui-focus-ring")).toBe("#77a3ff");
  });

  it("rejects unknown, geometric, and invalid semantic token values at runtime", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() => render(
      <ThemeProvider
        tokens={{ "--ui-radius-control": "999px" } as unknown as ThemeTokens}
      >
        Invalid geometry
      </ThemeProvider>,
    )).toThrow(/unsupported theme token "--ui-radius-control"/);

    expect(() => render(
      <ThemeProvider
        tokens={{ "--ui-brand-surprise": "hotpink" } as unknown as ThemeTokens}
      >
        Unknown token
      </ThemeProvider>,
    )).toThrow(/unsupported theme token "--ui-brand-surprise"/);

    expect(() => render(
      <ThemeProvider
        tokens={{ "--ui-primary": 42 } as unknown as ThemeTokens}
      >
        Invalid value
      </ThemeProvider>,
    )).toThrow(/token "--ui-primary" must be a non-empty CSS color string/);

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
    expect(theme).toHaveClass("ui-theme", "ui-root");
    expect(theme).not.toHaveClass("foreign-theme");
    expect(theme.style.background).toBe("");

    consoleError.mockRestore();
  });
});
