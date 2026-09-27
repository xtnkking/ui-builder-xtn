// @personal-ui-coverage {"kind":"browser","runner":"browser","exports":["ThemeProvider"]}
import { expect, test, type Page } from "@playwright/test";

test.use({ viewport: { width: 1180, height: 760 } });

const fixtureStyle = `
  body { margin: 0; background: #eef1f6; }
  #theme-contract-fixture {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
    padding: 24px;
  }
  #theme-contract-fixture .theme-sample {
    display: grid;
    align-content: start;
    gap: 12px;
    min-height: 168px;
    padding: 18px;
    border: 1px solid var(--pui-border);
    border-radius: var(--pui-radius-surface);
    background: var(--pui-surface);
    color: var(--pui-text);
  }
  #theme-contract-fixture .theme-actions { display: flex; flex-wrap: wrap; gap: 8px; }
  #theme-contract-fixture h2, #theme-contract-fixture p { margin: 0; }
  #theme-contract-fixture p { color: var(--pui-muted); }
`;

async function mountThemeFixture(page: Page): Promise<void> {
  await page.goto("/");
  await page.evaluate((styleText) => {
    document.body.innerHTML = `
      <style>${styleText}</style>
      <main id="theme-contract-fixture">
        <section id="light-theme" class="pui-theme pui-root theme-sample" data-color-scheme="light">
          <h2>Light</h2><p>Primary controls keep readable semantic contrast.</p>
          <div class="theme-actions"><button class="pui-button pui-button--primary">Primary</button><button class="pui-button pui-button--danger">Danger</button></div>
        </section>
        <section id="dark-theme" class="pui-theme pui-root theme-sample" data-color-scheme="dark">
          <h2>Dark</h2><p>State colors follow the dark semantic palette.</p>
          <div class="theme-actions"><button class="pui-button pui-button--primary">Primary</button><button class="pui-button pui-button--danger">Danger</button></div>
        </section>
        <section id="system-theme" class="pui-theme pui-root theme-sample" data-color-scheme="system">
          <h2>System</h2><p>The browser preference selects the resolved palette.</p>
          <div class="theme-actions"><button class="pui-button pui-button--primary">Primary</button></div>
        </section>
        <section id="outer-dark" class="pui-theme pui-root theme-sample" data-color-scheme="dark">
          <h2>Nested themes</h2>
          <div id="nested-light" class="pui-theme pui-root theme-sample" data-color-scheme="light"><p>Explicit light resets inherited dark tokens.</p></div>
        </section>
        <section id="inherit-outer" class="pui-theme pui-root theme-sample" data-color-scheme="dark">
          <h2>Inherited</h2>
          <div id="inherited-theme" class="pui-theme pui-root theme-sample" style="color-scheme: inherit"><p>No mode attribute keeps the parent palette.</p></div>
        </section>
        <section id="portal-source-theme" class="pui-theme pui-root theme-sample" data-color-scheme="dark" style="--pui-primary: rgb(52, 211, 153)">
          <h2>Portal source</h2><span id="portal-logical-source">Logical source</span>
        </section>
      </main>
      <aside id="theme-portal" class="pui-portal"><span>Portal surface</span></aside>
    `;
  }, fixtureStyle);

  await page.evaluate(async () => {
    const { syncPersonalUiPortalTheme } = await import("/src/personal-ui/internal/portal-tokens.ts");
    const source = document.querySelector<HTMLElement>("#portal-logical-source");
    const portal = document.querySelector<HTMLElement>("#theme-portal");
    if (!source || !portal) throw new Error("Theme fixture failed to mount");
    syncPersonalUiPortalTheme(source, portal, new Set<string>());
  });
}

function parseRgb(value: string): [number, number, number] {
  const channels = value.match(/[\d.]+/g)?.slice(0, 3).map(Number);
  if (!channels || channels.length !== 3) throw new Error(`Unsupported computed color: ${value}`);
  return channels as [number, number, number];
}

function contrastRatio(foreground: string, background: string): number {
  const luminance = (value: string) => {
    const [red, green, blue] = parseRgb(value).map((channel) => {
      const normalized = channel / 255;
      return normalized <= 0.04045
        ? normalized / 12.92
        : ((normalized + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  };
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

test("resolves light, dark, inherited, nested, system, and portal themes", async ({ page }, testInfo) => {
  await page.emulateMedia({ colorScheme: "light" });
  await mountThemeFixture(page);

  const computed = await page.evaluate(() => {
    const style = (selector: string) => getComputedStyle(document.querySelector<HTMLElement>(selector)!);
    return {
      lightPrimary: style("#light-theme").getPropertyValue("--pui-primary").trim(),
      darkPrimary: style("#dark-theme").getPropertyValue("--pui-primary").trim(),
      systemPrimary: style("#system-theme").getPropertyValue("--pui-primary").trim(),
      nestedPrimary: style("#nested-light").getPropertyValue("--pui-primary").trim(),
      inheritedPrimary: style("#inherited-theme").getPropertyValue("--pui-primary").trim(),
      inheritedScheme: style("#inherited-theme").colorScheme,
      portalPrimary: style("#theme-portal").getPropertyValue("--pui-primary").trim(),
      portalTooltipBackground: style("#theme-portal").getPropertyValue("--_pui-tooltip-bg").trim(),
      portalScheme: style("#theme-portal").colorScheme,
      portalMode: document.querySelector<HTMLElement>("#theme-portal")?.dataset.colorScheme,
    };
  });

  expect(computed).toEqual({
    lightPrimary: "#1769d2",
    darkPrimary: "#69a5ff",
    systemPrimary: "#1769d2",
    nestedPrimary: "#1769d2",
    inheritedPrimary: "#69a5ff",
    inheritedScheme: "dark",
    portalPrimary: "rgb(52, 211, 153)",
    portalTooltipBackground: "#f1f5fb",
    portalScheme: "dark",
    portalMode: "dark",
  });

  await page.emulateMedia({ colorScheme: "dark" });
  await expect.poll(() => page.locator("#system-theme").evaluate((element) => (
    getComputedStyle(element).getPropertyValue("--pui-primary").trim()
  ))).toBe("#69a5ff");

  const contrastPairs = await page.evaluate(() => (
    ["#light-theme", "#dark-theme"].flatMap((theme) => {
      const root = document.querySelector<HTMLElement>(theme)!;
      const rootStyle = getComputedStyle(root);
      return Array.from(root.querySelectorAll<HTMLElement>(".pui-button")).map((button) => {
        const style = getComputedStyle(button);
        return [style.color, style.backgroundColor] as const;
      }).concat([[rootStyle.color, rootStyle.backgroundColor] as const]);
    })
  ));
  contrastPairs.forEach(([foreground, background]) => {
    expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });

  if (testInfo.project.name === "chromium") {
    await expect(page.locator("#theme-contract-fixture")).toHaveScreenshot("theme-modes.png", {
      animations: "disabled",
      maxDiffPixels: 0,
    });
  }
});
