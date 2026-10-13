// @personal-ui-coverage {"kind":"browser","runner":"browser","exports":["Tag"]}
import { expect, test, type Locator, type Page } from "@playwright/test";

const flagSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20" viewBox="0 0 40 20"><path fill="#1769e0" d="M0 0h40v20H0z"/><path fill="#fff" d="M0 8h40v4H0z"/></svg>';
const longCountryName = "英国跨区域企业工作区身份认证、访问权限与安全策略审核国家名称";

async function choosePreview(page: Page, state = "默认") {
  await page.getByRole("tab", { name: state, exact: true }).click();
  return page.getByRole("tabpanel", { name: state, exact: true }).locator(".demo-explorer-preview");
}

async function openPreview(page: Page, state = "默认") {
  // Deliberately pending flag requests must not block the document load event.
  await page.goto("/#/components/tag", { waitUntil: "domcontentloaded" });
  return choosePreview(page, state);
}

async function mockFlags(page: Page) {
  await page.route("https://flagcdn.com/w40/**", (route) => route.fulfill({ status: 200, contentType: "image/svg+xml", body: flagSvg }));
}

function country(preview: Locator, code: string) {
  return preview.locator('[data-pui-owner="Tag"].pui-tag--country').filter({
    has: preview.page().locator(".pui-tag__country-code", { hasText: new RegExp(`^${code}$`) }),
  });
}

async function bounds(node: Locator) {
  await expect(node).toBeVisible();
  const box = await node.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

function sameSize(left: { width: number; height: number }, right: { width: number; height: number }) {
  expect(Math.abs(left.width - right.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(left.height - right.height)).toBeLessThanOrEqual(1);
}

async function capture(preview: Locator, name: string) {
  await preview.screenshot({ path: test.info().outputPath(`${name}.png`), animations: "disabled" });
}

test("country flags preserve their slot through pending success error and recovery", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  let releaseFlags!: () => void;
  const pendingFlags = new Promise<void>((resolve) => { releaseFlags = resolve; });
  let failGermany = true;
  const requests: string[] = [];
  await page.route("https://flagcdn.com/w40/**", async (route) => {
    requests.push(route.request().url());
    await pendingFlags;
    if (failGermany && new URL(route.request().url()).pathname === "/w40/de.png") {
      await route.abort("failed");
    } else {
      await route.fulfill({ status: 200, contentType: "image/svg+xml", body: flagSvg });
    }
  });
  const preview = await openPreview(page);
  const gb = country(preview, "GB");
  const de = country(preview, "DE");
  await expect(gb.locator(".pui-tag__flag")).toHaveAttribute("data-flag-state", "loading");
  const pendingGb = await bounds(gb);
  const pendingDe = await bounds(de);
  const flagSlot = await bounds(gb.locator(".pui-tag__flag"));
  expect(flagSlot.width).toBe(20);
  expect(flagSlot.height).toBe(20);
  await expect(gb.locator(".pui-tag__flag")).toHaveCSS("border-radius", "50%");
  await expect(gb.locator(".pui-tag__flag")).toHaveCSS("overflow", "hidden");
  await capture(preview, "country-flags-pending");
  releaseFlags();
  await expect(gb.locator(".pui-tag__flag")).toHaveAttribute("data-flag-state", "loaded");
  await expect(gb.locator("img")).toHaveAttribute("src", "https://flagcdn.com/w40/gb.png");
  await expect(gb.locator("img")).toHaveCSS("object-fit", "cover");
  await expect(gb.locator("img")).toHaveCSS("object-position", "50% 50%");
  expect(await gb.locator("img").evaluate((node) => {
    const image = node as HTMLImageElement;
    return image.naturalWidth / image.naturalHeight;
  })).toBe(2);
  sameSize(pendingGb, await bounds(gb));
  await expect(de.locator(".pui-tag__flag")).toHaveAttribute("data-flag-state", "error");
  await expect(de.locator(".pui-tag__flag svg")).toBeVisible();
  await expect(de.locator(".pui-tag__flag")).toHaveCSS("border-radius", "50%");
  sameSize(flagSlot, await bounds(de.locator(".pui-tag__flag")));
  await expect(de.locator(".pui-tag__flag img")).toBeHidden();
  sameSize(pendingDe, await bounds(de));
  expect(requests).toContain("https://flagcdn.com/w40/gb.png");
  await expect(preview.locator('.pui-tag__flag[data-flag-state="loaded"]')).toHaveCount(3);
  await capture(preview, "country-flags-loaded-and-fallback");
  failGermany = false;
  await page.reload({ waitUntil: "domcontentloaded" });
  const recoveredPreview = await choosePreview(page);
  const recovered = country(recoveredPreview, "DE");
  await expect(recovered.locator(".pui-tag__flag")).toHaveAttribute("data-flag-state", "loaded");
  await expect(recoveredPreview.locator('.pui-tag__flag[data-flag-state="loaded"]')).toHaveCount(4);
  sameSize(pendingDe, await bounds(recovered));
  await capture(recoveredPreview, "country-flags-recovered");
});

test("long country names at 320 retain country code calling code and accessible full text", async ({ page }) => {
  await mockFlags(page);
  await page.setViewportSize({ width: 320, height: 1000 });
  const preview = await openPreview(page, "长内容");
  for (const [code, callingCode] of [["GB", "+44"], ["AS", "+1684"]]) {
    const tag = country(preview, code);
    const name = tag.locator(".pui-tag__country-name");
    await expect(tag.locator(".pui-tag__flag")).toHaveAttribute("data-flag-state", "loaded");
    await expect(tag.locator(".pui-tag__country-code")).toHaveText(code);
    await expect(tag.locator(".pui-tag__calling-code")).toHaveText(callingCode);
    await expect(name).toHaveCSS("text-overflow", "ellipsis");
    expect(await name.evaluate((node) => node.scrollWidth > node.clientWidth + 1)).toBe(true);
    const tagBounds = await bounds(tag);
    const codeBounds = await bounds(tag.locator(".pui-tag__country-code"));
    const nameBounds = await bounds(name);
    const dialBounds = await bounds(tag.locator(".pui-tag__calling-code"));
    expect(tagBounds.width).toBeLessThanOrEqual(288);
    expect(nameBounds.x).toBeGreaterThanOrEqual(codeBounds.x + codeBounds.width);
    expect(dialBounds.x).toBeGreaterThanOrEqual(nameBounds.x + nameBounds.width);
    expect(dialBounds.x + dialBounds.width).toBeLessThanOrEqual(tagBounds.x + tagBounds.width);
  }
  const gb = country(preview, "GB");
  await expect(gb).toHaveAttribute("title", new RegExp(longCountryName));
  const label = gb.locator(".pui-tag__label");
  await expect(label).toHaveAttribute("tabindex", "0");
  await label.focus();
  await expect(label).toBeFocused();
  await expect(label).toHaveAccessibleName(new RegExp(longCountryName));
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await capture(preview, "country-long-320");
});

test("selecting a country keeps width and keyboard removal remains functional", async ({ page }) => {
  await mockFlags(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const preview = await openPreview(page, "键盘操作");
  const gb = country(preview, "GB");
  await expect(gb.locator(".pui-tag__flag")).toHaveAttribute("data-flag-state", "loaded");
  const idle = await bounds(gb);
  const flagCount = await gb.locator(".pui-tag__flag").count();
  const svgCount = await gb.locator("svg").count();
  await preview.getByRole("button", { name: "选择英国标签", exact: true }).click();
  await expect(gb).toHaveAttribute("data-selected", "true");
  sameSize(idle, await bounds(gb));
  await expect(gb.locator(".pui-tag__flag")).toHaveCount(flagCount);
  await expect(gb.locator("svg")).toHaveCount(svgCount);
  await expect(preview.locator('.pui-tag__flag[data-flag-state="loaded"]')).toHaveCount(4);
  await capture(preview, "country-tag-selected");
  await preview.getByRole("button", { name: "取消选择英国标签", exact: true }).click();
  await expect(gb).not.toHaveAttribute("data-selected", "true");
  sameSize(idle, await bounds(gb));
  const remove = country(preview, "AS").getByRole("button", { name: "移除美属萨摩亚标签", exact: true });
  await remove.focus();
  await expect(remove).toBeFocused();
  await remove.press("Enter");
  await expect(country(preview, "AS")).toHaveCount(0);
  await preview.getByRole("button", { name: "恢复美属萨摩亚标签", exact: true }).click();
  await expect(country(preview, "AS")).toBeVisible();
  await expect(preview.locator('.pui-tag__flag[data-flag-state="loaded"]')).toHaveCount(4);
  await capture(preview, "country-tag-restored");
});

test("country flag geometry does not resize ordinary icons and persists in dark and English examples", async ({ page }) => {
  await mockFlags(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const preview = await openPreview(page);
  const ordinaryIcon = preview.locator('[data-pui-owner="Tag"]:not(.pui-tag--country) .pui-tag__leading svg').first();
  const iconBounds = await bounds(ordinaryIcon);
  expect(iconBounds.width).toBe(13);
  expect(iconBounds.height).toBe(13);
  const gbFlag = country(preview, "GB").locator(".pui-tag__flag");
  await expect(gbFlag).toHaveAttribute("data-flag-state", "loaded");
  const flagBounds = await bounds(gbFlag);
  expect(flagBounds.width).toBe(20);
  expect(flagBounds.height).toBe(20);
  await expect(gbFlag).toHaveCSS("border-radius", "50%");
  await expect(country(preview, "FR").locator(".pui-tag__calling-code")).toHaveCount(0);
  await expect(preview.locator('.pui-tag__flag[data-flag-state="loaded"]')).toHaveCount(4);
  await capture(preview, "country-tags-desktop");
  const darkPreview = await choosePreview(page, "深色模式");
  await expect(country(darkPreview, "GB").locator(".pui-tag__flag")).toHaveAttribute("data-flag-state", "loaded");
  await expect(darkPreview.locator('.pui-tag__flag[data-flag-state="loaded"]')).toHaveCount(4);
  await capture(darkPreview, "country-tags-dark");
  const englishPreview = await choosePreview(page, "多语言");
  await expect(country(englishPreview, "GB").locator(".pui-tag__country-name")).toHaveText("United Kingdom");
  await expect(country(englishPreview, "AS").locator(".pui-tag__calling-code")).toHaveText("+1684");
  await expect(country(englishPreview, "GB").locator(".pui-tag__flag")).toHaveAttribute("data-flag-state", "loaded");
  await expect(englishPreview.locator('.pui-tag__flag[data-flag-state="loaded"]')).toHaveCount(4);
  await capture(englishPreview, "country-tags-en");
});
