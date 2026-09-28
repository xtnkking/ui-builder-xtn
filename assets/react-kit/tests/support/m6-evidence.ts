import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

export type EvidenceCategory =
  | "foundation"
  | "actions"
  | "input"
  | "navigation"
  | "data"
  | "feedback"
  | "overlay"
  | "pattern";

type TargetRole =
  | "button"
  | "combobox"
  | "link"
  | "radio"
  | "separator"
  | "slider"
  | "spinbutton"
  | "tab"
  | "textbox"
  | "treeitem";

export interface EvidencePreparation {
  action: "click" | "focus" | "shortcut";
  key?: string;
  name?: string;
  role?: TargetRole;
}

interface EvidenceCaseBase {
  exportName: string;
  family: string;
  category: EvidenceCategory;
  ownerName?: string;
  ownerSelector?: string;
  ownerScope?: "preview" | "page";
  prepare?: EvidencePreparation;
}

export interface AriaEvidenceCase extends EvidenceCaseBase {}

export type KeyboardStrategy =
  | "arrow-change"
  | "delegated"
  | "focus-popup"
  | "modal-escape"
  | "native-activate"
  | "open-close"
  | "shortcut"
  | "tab"
  | "toggle"
  | "type";

export interface KeyboardEvidenceCase extends EvidenceCaseBase {
  strategy: KeyboardStrategy;
  key?: string;
  targetName?: string;
  targetRole?: TargetRole;
  targetSelector?: string;
  delegatedOwner?: string;
}

const blockingImpacts = new Set(["critical", "serious"]);
const focusableSelector = [
  "button:not(:disabled)",
  "a[href]",
  "input:not(:disabled)",
  "select:not(:disabled)",
  "textarea:not(:disabled)",
  "[role='button']:not([aria-disabled='true'])",
  "[role='combobox']:not([aria-disabled='true'])",
  "[role='link']:not([aria-disabled='true'])",
  "[role='menuitem']:not([aria-disabled='true'])",
  "[role='option']:not([aria-disabled='true'])",
  "[role='slider']:not([aria-disabled='true'])",
  "[role='tab']:not([aria-disabled='true'])",
  "[role='treeitem']:not([aria-disabled='true'])",
  "[tabindex]:not([tabindex='-1']):not([aria-disabled='true'])",
].join(",");

function ownerSelector(exportName: string, scope: "preview" | "page" = "preview") {
  const selector = `[data-pui-owner="${exportName}"]`;
  return scope === "page" ? selector : `.demo-explorer-preview ${selector}`;
}

function routeFor(evidence: EvidenceCaseBase) {
  const section = evidence.category === "pattern" ? "patterns" : "components";
  return `/#/${section}/${evidence.family}`;
}

async function openEvidenceCase(page: Page, evidence: EvidenceCaseBase) {
  const route = routeFor(evidence);
  await page.goto(route);
  await expect(page).toHaveURL(new RegExp(`${route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
  await expect(page.locator(".demo-explorer-preview").first()).toBeVisible();
}

function roleTarget(root: Locator, role: TargetRole, name?: string) {
  return root.getByRole(role, name ? { name, exact: true } : undefined).first();
}

async function prepareEvidence(page: Page, evidence: EvidenceCaseBase): Promise<Locator | undefined> {
  const preparation = evidence.prepare;
  if (!preparation) return undefined;
  if (preparation.action === "shortcut") {
    await page.keyboard.press(preparation.key ?? "Control+k");
    return undefined;
  }
  const preview = page.locator(".demo-explorer-preview");
  const target = roleTarget(preview, preparation.role ?? "button", preparation.name);
  await expect(target).toBeVisible();
  if (preparation.action === "click") await target.click();
  else await target.focus();
  return target;
}

async function findOwner(page: Page, evidence: EvidenceCaseBase) {
  const operationalOwner = evidence.ownerName ?? evidence.exportName;
  if (operationalOwner !== evidence.exportName && !evidence.exportName.startsWith("use")) {
    await expect(
      page.locator(ownerSelector(evidence.exportName, evidence.ownerScope)).first(),
      `${evidence.exportName} must render its registered owner marker`,
    ).toBeAttached();
  }
  const selector = evidence.ownerSelector ?? ownerSelector(operationalOwner, evidence.ownerScope);
  const owner = page.locator(selector).filter({ visible: true }).first();
  await expect(owner, `${evidence.exportName} must render its registered owner`).toBeAttached();
  await expect.poll(async () => owner.evaluate((element) => {
    const node = element as HTMLElement;
    return node.getClientRects().length > 0 || Boolean(node.querySelector(":scope > *"));
  })).toBe(true);
  return { owner, selector };
}

async function keyboardTarget(owner: Locator, evidence: KeyboardEvidenceCase) {
  if (evidence.targetRole) {
    const target = roleTarget(owner, evidence.targetRole, evidence.targetName);
    await expect(target).toBeVisible();
    return target;
  }
  if (evidence.targetSelector) {
    const ownerMatches = await owner.evaluate(
      (element, selector) => element.matches(selector),
      evidence.targetSelector,
    );
    const target = ownerMatches
      ? owner
      : owner.locator(evidence.targetSelector).filter({ visible: true }).first();
    await expect(target).toBeVisible();
    return target;
  }
  const ownerIsFocusable = await owner.evaluate((element) => (
    element.matches("button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex='-1']):not([aria-disabled='true'])")
  ));
  const target = ownerIsFocusable ? owner : owner.locator(focusableSelector).filter({ visible: true }).first();
  await expect(target, `${evidence.exportName} needs a visible keyboard target`).toBeVisible();
  return target;
}

async function keyboardState(page: Page, owner: Locator, target: Locator) {
  return page.evaluate(([ownerElement, targetElement]) => {
    const active = document.activeElement as HTMLElement | null;
    const control = targetElement as HTMLInputElement;
    return JSON.stringify({
      activeOwner: active?.closest<HTMLElement>("[data-pui-owner]")?.dataset.puiOwner ?? null,
      activeRole: active?.getAttribute("role") ?? active?.tagName ?? null,
      activeText: active?.textContent?.trim().slice(0, 80) ?? null,
      checked: "checked" in control ? control.checked : null,
      value: "value" in control ? control.value : null,
      ariaActiveDescendant: targetElement.getAttribute("aria-activedescendant"),
      ariaChecked: targetElement.getAttribute("aria-checked"),
      ariaExpanded: targetElement.getAttribute("aria-expanded"),
      ariaPressed: targetElement.getAttribute("aria-pressed"),
      ariaSelected: targetElement.getAttribute("aria-selected"),
      ariaValueNow: targetElement.getAttribute("aria-valuenow"),
      ownerText: ownerElement.textContent?.trim().slice(0, 300) ?? null,
      openSurfaces: document.querySelectorAll("[role='dialog'],[role='listbox'],[role='menu'],[role='tooltip']").length,
    });
  }, [await owner.elementHandle(), await target.elementHandle()] as const);
}

async function controlledSelectors(owner: Locator): Promise<string[]> {
  const ids = await owner.locator("[aria-controls],[aria-describedby]").evaluateAll((elements) => (
    elements.flatMap((element) => [
      ...(element.getAttribute("aria-controls")?.trim().split(/\s+/) ?? []),
      ...(element.getAttribute("aria-describedby")?.trim().split(/\s+/) ?? []),
    ]).filter(Boolean)
  ));
  return [...new Set(ids)].map((id) => `[id="${id.replace(/["\\]/g, "\\$&")}"]`);
}

export function registerAriaEvidence(cases: readonly AriaEvidenceCase[]) {
  for (const evidence of cases) {
    test(`[m6 aria:${evidence.category}] ${evidence.exportName} scopes axe to its rendered owner`, async ({ page }) => {
      await openEvidenceCase(page, evidence);
      await prepareEvidence(page, evidence);
      const { owner, selector } = await findOwner(page, evidence);
      const relatedSelectors = await controlledSelectors(owner);
      const includes = [selector, ...relatedSelectors];
      const results = await new AxeBuilder({ page })
        .include(includes)
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      const blocking = results.violations
        .filter((violation) => violation.impact != null && blockingImpacts.has(violation.impact))
        .map((violation) => ({
          id: violation.id,
          impact: violation.impact,
          targets: violation.nodes.map((node) => node.target.join(" ")),
        }));
      expect(blocking, `${evidence.exportName} contains critical or serious axe violations`).toEqual([]);
    });
  }
}

export function registerKeyboardEvidence(cases: readonly KeyboardEvidenceCase[]) {
  for (const evidence of cases) {
    test(`[m6 keyboard:${evidence.category}] ${evidence.exportName} executes its ${evidence.strategy} contract`, async ({ page }) => {
      await openEvidenceCase(page, evidence);
      const preparedTarget = await prepareEvidence(page, evidence);

      if (evidence.strategy === "shortcut") {
        const { owner } = await findOwner(page, { ...evidence, ownerName: evidence.ownerName ?? "CommandPalette", ownerScope: "page" });
        await expect(owner).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(owner).toBeHidden();
        return;
      }

      const { owner } = await findOwner(page, evidence);
      if (evidence.strategy === "modal-escape") {
        await expect(owner).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(owner).toBeHidden();
        if (preparedTarget) await expect(preparedTarget).toBeFocused();
        return;
      }

      if (evidence.strategy === "delegated") {
        const delegateName = evidence.delegatedOwner;
        if (!delegateName) throw new Error(`${evidence.exportName} delegated evidence needs delegatedOwner`);
        const delegate = page.locator(ownerSelector(delegateName)).filter({ visible: true }).first();
        await expect(delegate).toBeVisible();
        const target = await keyboardTarget(delegate, evidence);
        await target.focus();
        if (evidence.key && evidence.key !== "Tab") {
          await target.evaluate((element) => {
            element.addEventListener("click", () => {
              document.documentElement.setAttribute("data-m6-keyboard-activated", "true");
            }, { once: true, capture: true });
          });
          await page.keyboard.press(evidence.key);
          await expect(page.locator("html")).toHaveAttribute("data-m6-keyboard-activated", "true");
          return;
        }
        const handle = await target.elementHandle();
        await page.keyboard.press("Tab");
        await expect.poll(() => page.evaluate((element) => document.activeElement !== element, handle)).toBe(true);
        return;
      }

      const target = await keyboardTarget(owner, evidence);
      await target.focus();
      await expect(target).toBeFocused();

      if (evidence.strategy === "native-activate") {
        await target.evaluate((element) => {
          element.addEventListener("click", (event) => {
            if (element instanceof HTMLAnchorElement) event.preventDefault();
            document.documentElement.setAttribute("data-m6-keyboard-activated", "true");
          }, { once: true, capture: true });
        });
        await page.keyboard.press(evidence.key ?? "Enter");
        await expect(page.locator("html")).toHaveAttribute("data-m6-keyboard-activated", "true");
        return;
      }

      if (evidence.strategy === "type") {
        const before = await target.inputValue();
        await page.keyboard.type(evidence.key ?? "x");
        await expect.poll(() => target.inputValue()).not.toBe(before);
        return;
      }

      if (evidence.strategy === "tab") {
        const sentinelAttribute = `m6-tab-sentinel-${evidence.exportName}`;
        await target.evaluate((element, attribute) => {
          const sentinel = document.createElement("button");
          sentinel.type = "button";
          sentinel.setAttribute("data-m6-tab-sentinel", attribute);
          sentinel.setAttribute("aria-label", `${attribute} target`);
          sentinel.style.cssText = "position:fixed;inline-size:1px;block-size:1px;opacity:0.01;";
          element.insertAdjacentElement("afterend", sentinel);
        }, sentinelAttribute);
        const sentinel = page.locator(`[data-m6-tab-sentinel="${sentinelAttribute}"]`);
        try {
          let moved = false;
          for (let press = 0; press < 8 && !moved; press += 1) {
            await page.keyboard.press(evidence.key ?? "Tab");
            moved = await target.evaluate((element) => document.activeElement !== element);
          }
          expect(moved, `${evidence.exportName} must let Tab leave its keyboard target`).toBe(true);
        } finally {
          await sentinel.evaluateAll((elements) => elements.forEach((element) => element.remove()));
        }
        return;
      }

      if (evidence.strategy === "focus-popup") {
        await expect.poll(async () => {
          const controlled = await controlledSelectors(owner);
          if (!controlled.length) return false;
          return page.locator(controlled.join(",")).filter({ visible: true }).count().then((count) => count > 0);
        }).toBe(true);
        await page.keyboard.press(evidence.key ?? "Escape");
        return;
      }

      if (evidence.strategy === "open-close") {
        const handle = await target.elementHandle();
        if (!handle) throw new Error(`${evidence.exportName} needs a stable keyboard target`);
        await page.keyboard.press("Escape");
        await target.focus();
        await page.keyboard.press(evidence.key ?? "ArrowDown");
        await expect.poll(() => page.evaluate((element) => {
          const ids = element.getAttribute("aria-controls")?.trim().split(/\s+/).filter(Boolean) ?? [];
          const controlledVisible = ids.some((id) => {
            const controlled = document.getElementById(id);
            return controlled != null && controlled.getClientRects().length > 0;
          });
          const popupVisible = [...document.querySelectorAll<HTMLElement>("[role='listbox'],[role='menu']")]
            .some((popup) => popup.getClientRects().length > 0);
          return element.getAttribute("aria-expanded") === "true" || controlledVisible || popupVisible;
        }, handle)).toBe(true);
        await page.keyboard.press("Escape");
        await expect.poll(() => page.evaluate((element) => {
          const ids = element.getAttribute("aria-controls")?.trim().split(/\s+/).filter(Boolean) ?? [];
          const controlledVisible = ids.some((id) => {
            const controlled = document.getElementById(id);
            return controlled != null && controlled.getClientRects().length > 0;
          });
          return element.getAttribute("aria-expanded") !== "true" && !controlledVisible;
        }, handle)).toBe(true);
        return;
      }

      const before = await keyboardState(page, owner, target);
      await page.keyboard.press(evidence.key ?? (
        evidence.strategy === "toggle" ? "Space" : "ArrowRight"
      ));
      const after = await keyboardState(page, owner, target);
      expect(after, `${evidence.exportName} must react to its documented keyboard key`).not.toBe(before);
    });
  }
}
