// @ui-coverage {"kind":"unit","runner":"components","exports":["Drawer"]}
import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Drawer, type DrawerProps } from "../../src/ui";

const baseProps = {
  open: true,
  onOpenChange: () => undefined,
  title: "可调宽度抽屉",
  children: "抽屉内容",
} satisfies DrawerProps;

describe("Drawer width and full-screen public contract", () => {
  it("retains the original medium and large presets and default edge variant", () => {
    const view = render(<Drawer {...baseProps} />);
    const panel = screen.getByRole("dialog", { name: baseProps.title });
    expect(panel).toHaveClass("ui-drawer--medium", "ui-drawer--edge");
    expect(panel.style.getPropertyValue("--_ui-drawer-width")).toBe("");
    view.rerender(<Drawer {...baseProps} width="large" />);
    expect(panel).toHaveClass("ui-drawer--large", "ui-drawer--edge");
    expect(panel).not.toHaveClass("ui-drawer--custom", "ui-drawer--fullscreen");
    expect(panel.style.width).toBe("");
  });

  it("normalizes safe numeric, pixel, percentage and viewport widths through the canonical variable", () => {
    const view = render(<Drawer {...baseProps} />);
    const panel = screen.getByRole("dialog", { name: baseProps.title });
    const widths: Array<[DrawerProps["width"], string]> = [
      [800, "800px"], [920.5, "920.5px"], ["960px", "960px"],
      ["75%", "75%"], ["80vw", "80vw"], [".5px", ".5px"],
    ];
    for (const [width, expected] of widths) {
      view.rerender(<Drawer {...baseProps} width={width} />);
      expect(panel).toHaveClass("ui-drawer--custom");
      expect(panel.style.getPropertyValue("--_ui-drawer-width")).toBe(expected);
      expect(panel.style.width).toBe("");
      expect(panel).not.toHaveClass("ui-drawer--medium", "ui-drawer--large");
    }
  });

  it("falls back to medium and clears a previous custom width for invalid runtime input", () => {
    const view = render(<Drawer {...baseProps} width={800} />);
    const panel = screen.getByRole("dialog", { name: baseProps.title });
    const invalidWidths: unknown[] = [
      0, -1, Number.NaN, Number.POSITIVE_INFINITY,
      "0px", "-800px", "NaNpx", "Infinityvw", "800rem", "auto",
      "calc(100% - 20px)", "var(--consumer-width)", "800px; color: red", {}, null,
    ];
    for (const width of invalidWidths) {
      view.rerender(<Drawer {...baseProps} width={800} />);
      view.rerender(createElement(Drawer, { ...baseProps, width } as unknown as DrawerProps));
      expect(panel).toHaveClass("ui-drawer--medium");
      expect(panel).not.toHaveClass("ui-drawer--custom", "ui-drawer--large");
      expect(panel.style.getPropertyValue("--_ui-drawer-width")).toBe("");
      expect(panel.style.width).toBe("");
    }
  });

  it("lets fullScreen override width and inset while preserving the same layer on prop updates", () => {
    const view = render(<Drawer {...baseProps} width={800} variant="inset" fullScreen />);
    const panel = screen.getByRole("dialog", { name: baseProps.title });
    const overlay = panel.parentElement!;
    expect(panel).toHaveClass("ui-drawer--fullscreen");
    expect(panel).not.toHaveClass("ui-drawer--inset", "ui-drawer--edge");
    expect(panel.style.getPropertyValue("--_ui-drawer-width")).toBe("");
    expect(overlay).toHaveClass("ui-overlay--drawer-fullscreen");
    expect(overlay).toHaveAttribute("data-ui-motion-profile", "drawer");
    expect(panel).toHaveAttribute("aria-modal", "true");
    view.rerender(<Drawer {...baseProps} width="75%" variant="inset" fullScreen={false} />);
    expect(screen.getByRole("dialog", { name: baseProps.title })).toBe(panel);
    expect(panel).toHaveClass("ui-drawer--inset", "ui-drawer--custom");
    expect(panel).not.toHaveClass("ui-drawer--fullscreen");
    expect(panel.style.getPropertyValue("--_ui-drawer-width")).toBe("75%");
    expect(overlay).toHaveClass("ui-overlay--drawer-inset");
  });

  it("does not expose consumer style or class overrides when custom width is used", () => {
    render(createElement(Drawer, {
      ...baseProps,
      width: 800,
      className: "consumer-drawer",
      style: { width: "1200px", "--_ui-drawer-width": "1200px", color: "red" },
    } as unknown as DrawerProps));
    const panel = screen.getByRole("dialog", { name: baseProps.title });
    expect(panel).not.toHaveClass("consumer-drawer");
    expect(panel.style.getPropertyValue("--_ui-drawer-width")).toBe("800px");
    expect(panel.style.width).toBe("");
    expect(panel.style.color).toBe("");
  });
});
