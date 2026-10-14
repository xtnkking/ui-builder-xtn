// @ui-coverage {"kind":"unit","runner":"components","exports":["GuidedTour","Lightbox","Portal","ThemeProvider","Tooltip"]}
import { createPortal } from "react-dom";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useRef, type CSSProperties } from "react";
import { GuidedTour, Lightbox, Portal, ThemeProvider, Tooltip } from "../../src/ui";
import { syncUIPortalTheme, useUIPortalTokens } from "../../src/ui/internal/portal-tokens";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function PortalThemeProbe() {
  const sourceRef = useRef<HTMLSpanElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  useUIPortalTokens(true, sourceRef, portalRef);
  return (
    <>
      <span
        ref={sourceRef}
        style={{
          "--ui-primary": "rgb(12, 34, 56)",
          "--ui-radius-control": "99px",
          "--_ui-theme-radius-surface": "20px",
          "--_ui-material-filter": "blur(20px) saturate(145%)",
          "--_ui-control-hover-bg": "rgb(32, 33, 34)",
          "--_ui-unregistered-geometry": "999px",
          colorScheme: "dark",
        } as CSSProperties}
      />
      {createPortal(<div ref={portalRef} data-testid="portal-theme-probe" />, document.body)}
    </>
  );
}

class TrackingMutationObserver implements MutationObserver {
  static instances: TrackingMutationObserver[] = [];

  readonly observeCalls: Array<{ target: Node; options?: MutationObserverInit }> = [];
  readonly activeTargets = new Set<Node>();

  constructor(_callback: MutationCallback) {
    TrackingMutationObserver.instances.push(this);
  }

  disconnect(): void {
    this.activeTargets.clear();
  }

  observe(target: Node, options?: MutationObserverInit): void {
    this.observeCalls.push({ target, options });
    this.activeTargets.add(target);
  }

  takeRecords(): MutationRecord[] {
    return [];
  }
}

describe("portal theme inheritance", () => {
  it("copies semantic colors and official theme internals without arbitrary geometry", () => {
    const { getByTestId } = render(<PortalThemeProbe />);
    const portal = getByTestId("portal-theme-probe");

    expect(portal.style.getPropertyValue("--ui-primary")).toBe("rgb(12, 34, 56)");
    expect(portal.style.getPropertyValue("--ui-radius-control")).toBe("");
    expect(portal.style.getPropertyValue("--_ui-theme-radius-surface")).toBe("20px");
    expect(portal.style.getPropertyValue("--_ui-material-filter")).toBe("blur(20px) saturate(145%)");
    expect(portal.style.getPropertyValue("--_ui-control-hover-bg")).toBe("rgb(32, 33, 34)");
    expect(portal.style.getPropertyValue("--_ui-unregistered-geometry")).toBe("");
    expect(portal).toHaveAttribute("data-color-scheme", "dark");
    expect(portal.style.colorScheme).toBe("dark");
  });

  it("preserves nested preset and material across a body portal and its React descendants", () => {
    const { getByTestId, rerender } = render(
      <ThemeProvider mode="dark" preset="apple" material="glass">
        <ThemeProvider tokens={{ "--ui-primary": "#224466" }}>
          <Portal><ThemeProvider data-testid="portal-child">Child</ThemeProvider></Portal>
        </ThemeProvider>
      </ThemeProvider>,
    );
    const child = getByTestId("portal-child");
    const portal = child.closest(".ui-portal");
    expect(portal?.parentElement).toBe(document.body);
    expect(portal).toHaveAttribute("data-theme-preset", "apple");
    expect(portal).toHaveAttribute("data-theme-material", "glass");
    expect(portal).toHaveAttribute("data-color-scheme", "dark");
    expect(child).toHaveAttribute("data-theme-preset", "apple");
    expect(child).toHaveAttribute("data-theme-material", "glass");
    expect(child).not.toHaveAttribute("data-theme-definition");

    rerender(
      <ThemeProvider preset="material" material="solid">
        <Portal><ThemeProvider data-testid="portal-child">Updated</ThemeProvider></Portal>
      </ThemeProvider>,
    );
    const updatedChild = getByTestId("portal-child");
    expect(updatedChild.closest(".ui-portal")).toHaveAttribute("data-theme-preset", "material");
    expect(updatedChild.closest(".ui-portal")).toHaveAttribute("data-theme-material", "solid");
    expect(updatedChild).toHaveAttribute("data-theme-preset", "material");
  });

  it("rebinds a portal to its new logical source and removes obsolete theme values", () => {
    const apple = document.createElement("div");
    apple.dataset.themePreset = "apple";
    apple.dataset.themeMaterial = "glass";
    apple.dataset.colorScheme = "dark";
    const source = document.createElement("span");
    source.style.setProperty("--ui-primary", "rgb(12, 34, 56)");
    source.style.setProperty("--_ui-theme-radius-surface", "20px");
    source.style.setProperty("--_ui-material-filter", "blur(20px)");
    apple.append(source);
    const portal = document.createElement("div");
    document.body.append(apple, portal);

    const copied = syncUIPortalTheme(source, portal, new Set());
    expect(portal).toHaveAttribute("data-theme-preset", "apple");
    expect(portal).toHaveAttribute("data-theme-material", "glass");
    expect(portal.style.getPropertyValue("--_ui-theme-radius-surface")).toBe("20px");

    source.removeAttribute("style");
    document.body.append(source);
    syncUIPortalTheme(source, portal, copied);
    expect(portal).toHaveAttribute("data-theme-preset", "default");
    expect(portal).toHaveAttribute("data-theme-material", "solid");
    expect(portal).toHaveAttribute("data-color-scheme", "light");
    expect(portal.style.getPropertyValue("--ui-primary")).toBe("");
    expect(portal.style.getPropertyValue("--_ui-theme-radius-surface")).toBe("");
    expect(portal.style.getPropertyValue("--_ui-material-filter")).toBe("");
    apple.remove();
    source.remove();
    portal.remove();
  });

  it("gives body-level Lightbox and GuidedTour portals a logical theme source", () => {
    const sourceStyles = document.createElement("style");
    sourceStyles.textContent = `
      [data-ui-portal-source="lightbox"],
      [data-ui-portal-source="guided-tour"] {
        --ui-primary: rgb(21, 43, 65);
        color-scheme: dark;
      }
    `;
    document.head.append(sourceStyles);
    render(
      <div>
        <Lightbox
          open
          onOpenChange={() => undefined}
          value="hero"
          onValueChange={() => undefined}
          items={[{ id: "hero", src: "hero.png", alt: "Hero" }]}
        />
        <GuidedTour
          open
          onOpenChange={() => undefined}
          currentId="intro"
          onCurrentChange={() => undefined}
          steps={[{ id: "intro", title: "Intro", description: "Details" }]}
        />
      </div>,
    );

    ["Lightbox", "GuidedTour"].forEach((owner) => {
      const surface = document.querySelector<HTMLElement>(`[data-ui-owner='${owner}']`);
      const portal = surface?.closest<HTMLElement>(".ui-portal") ?? null;
      expect(portal).not.toBeNull();
      expect(portal?.style.getPropertyValue("--ui-primary")).toBe("rgb(21, 43, 65)");
      expect(portal).toHaveAttribute("data-color-scheme", "dark");
    });
    sourceStyles.remove();
  });

  it("shares narrow observers while open and releases them after many tooltips close", () => {
    TrackingMutationObserver.instances = [];
    vi.stubGlobal("MutationObserver", TrackingMutationObserver);
    vi.useFakeTimers();

    const { container, unmount } = render(
      <div>
        {Array.from({ length: 32 }, (_, index) => (
          <Tooltip key={index} content={`Tip ${index}`}>
            <button type="button">{`Trigger ${index}`}</button>
          </Tooltip>
        ))}
      </div>,
    );
    const roots = Array.from(container.querySelectorAll<HTMLElement>("[data-ui-owner='Tooltip']"));

    expect(TrackingMutationObserver.instances.some((observer) => (
      observer.observeCalls.some(({ target }) => target === document.head)
    ))).toBe(false);

    roots.forEach((root) => fireEvent.mouseEnter(root));
    const portalObservers = TrackingMutationObserver.instances.filter((observer) => (
      observer.observeCalls.some(({ target }) => target === document.head)
    ));
    expect(portalObservers).toHaveLength(1);
    expect(portalObservers[0].observeCalls.some(({ target, options }) => (
      target === document.documentElement && options?.subtree === true
    ))).toBe(false);

    roots.forEach((root) => fireEvent.mouseLeave(root));
    act(() => vi.advanceTimersByTime(101));
    expect(portalObservers[0].activeTargets.size).toBe(0);

    unmount();
    cleanup();
  });
});
