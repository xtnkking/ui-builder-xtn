// @personal-ui-coverage {"kind":"unit","runner":"components","exports":["GuidedTour","Lightbox","Tooltip"]}
import { createPortal } from "react-dom";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useRef, type CSSProperties } from "react";
import { GuidedTour, Lightbox, Tooltip } from "../../src/personal-ui";
import { usePersonalUiPortalTokens } from "../../src/personal-ui/internal/portal-tokens";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function PortalThemeProbe() {
  const sourceRef = useRef<HTMLSpanElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  usePersonalUiPortalTokens(true, sourceRef, portalRef);
  return (
    <>
      <span
        ref={sourceRef}
        style={{
          "--pui-primary": "rgb(12, 34, 56)",
          "--pui-radius-control": "99px",
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
  it("copies only public semantic tokens and the resolved color scheme", () => {
    const { getByTestId } = render(<PortalThemeProbe />);
    const portal = getByTestId("portal-theme-probe");

    expect(portal.style.getPropertyValue("--pui-primary")).toBe("rgb(12, 34, 56)");
    expect(portal.style.getPropertyValue("--pui-radius-control")).toBe("");
    expect(portal).toHaveAttribute("data-color-scheme", "dark");
    expect(portal.style.colorScheme).toBe("dark");
  });

  it("gives body-level Lightbox and GuidedTour portals a logical theme source", () => {
    const sourceStyles = document.createElement("style");
    sourceStyles.textContent = `
      [data-pui-portal-source="lightbox"],
      [data-pui-portal-source="guided-tour"] {
        --pui-primary: rgb(21, 43, 65);
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
      const surface = document.querySelector<HTMLElement>(`[data-pui-owner='${owner}']`);
      const portal = surface?.closest<HTMLElement>(".pui-portal") ?? null;
      expect(portal).not.toBeNull();
      expect(portal?.style.getPropertyValue("--pui-primary")).toBe("rgb(21, 43, 65)");
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
    const roots = Array.from(container.querySelectorAll<HTMLElement>("[data-pui-owner='Tooltip']"));

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
