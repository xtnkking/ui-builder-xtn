// @ui-coverage {"kind":"browser","runner":"browser","exports":["Lightbox"]}
import { expect, test, type Locator, type Page } from "@playwright/test";

async function example(page: Page, state = "默认") {
  await page.goto("/#/components/lightbox");
  await page.getByRole("tab", { name: state, exact: true }).click();
  return page.getByRole("tabpanel", { name: state, exact: true });
}
const viewerFor = (page: Page) => page.locator('[data-ui-owner="Lightbox"]');
async function blankFigurePoint(viewer: Locator) {
  return viewer.locator(":scope > figure").evaluate(node => {
    const rect = node.getBoundingClientRect();
    for (const y of [8, rect.height / 4, rect.height / 2, rect.height - 8]) {
      for (const x of [8, rect.width / 2, rect.width - 8]) {
        const point = { x: rect.x + x, y: rect.y + y };
        if (document.elementFromPoint(point.x, point.y) === node) return point;
      }
    }
    throw new Error("Expected genuine blank figure space outside image/caption");
  });
}
async function capture(viewer: Locator, name: string) {
  await viewer.screenshot({ path: test.info().outputPath(`${name}.png`), animations: "disabled" });
}

for (const width of [1440, 320]) {
  test(`lightbox shows distinct images and readable pointer/keyboard controls at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const panel = await example(page);
    await panel.getByRole("button", { name: "预览图片", exact: true }).click();
    const viewer = viewerFor(page);
    const image = viewer.locator("figure > img");
    await expect(image).toBeVisible();
    const firstSrc = await image.getAttribute("src");
    for (const label of ["上一张", "下一张", "关闭预览"]) {
      const control = viewer.getByRole("button", { name: label, exact: true });
      await expect(control).toBeVisible();
      const bounds = await control.boundingBox();
      expect(bounds?.width).toBe(44);
      expect(bounds?.height).toBe(44);
      await expect(control).toHaveCSS("color", "rgb(255, 255, 255)");
      expect(await control.evaluate(node => getComputedStyle(node).backgroundColor)).not.toBe("rgba(0, 0, 0, 0)");
      expect((await control.locator("svg").boundingBox())?.width).toBe(22);
    }
    const next = viewer.getByRole("button", { name: "下一张", exact: true });
    await next.hover();
    await expect(next).toHaveCSS("color", "rgb(255, 255, 255)");
    await next.click();
    await expect(viewer.locator(".ui-lightbox__position")).toHaveText("2 / 2");
    await expect(image).not.toHaveAttribute("src", firstSrc!);
    await expect(image).toHaveAttribute("alt", "深蓝色 Workspace 第二张示例图");
    await capture(viewer, `multi-${width}`);
    await viewer.getByRole("button", { name: "上一张", exact: true }).click();
    await expect(image).toHaveAttribute("src", firstSrc!);
    await page.keyboard.press("ArrowLeft");
    await expect(viewer.locator(".ui-lightbox__position")).toHaveText("2 / 2");
    await page.keyboard.press("Home");
    await expect(image).toHaveAttribute("src", firstSrc!);
    await page.keyboard.press("End");
    await expect(image).not.toHaveAttribute("src", firstSrc!);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  });
}

test("blank figure and outer shadow close while image, caption and dragging stay open", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const panel = await example(page);
  const trigger = panel.getByRole("button", { name: "预览图片", exact: true });
  await trigger.click();
  const viewer = viewerFor(page);
  const image = viewer.locator("figure > img");
  await image.click();
  await viewer.locator(".ui-lightbox__caption").click();
  await viewer.locator(".ui-lightbox__position").click();
  await expect(viewer).toBeVisible();
  const blank = await blankFigurePoint(viewer);
  const imageBox = (await image.boundingBox())!;
  await page.mouse.move(imageBox.x + imageBox.width / 2, imageBox.y + imageBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(blank.x, blank.y, { steps: 5 });
  await page.mouse.up();
  await expect(viewer).toBeVisible();
  const captionBox = (await viewer.locator(".ui-lightbox__caption").boundingBox())!;
  await page.mouse.move(captionBox.x + 5, captionBox.y + 5);
  await page.mouse.down();
  await page.mouse.move(blank.x, blank.y, { steps: 5 });
  await page.mouse.up();
  await expect(viewer).toBeVisible();
  // Keep the native context menu out of subsequent pointer assertions.
  await viewer.evaluate(node => node.addEventListener("contextmenu", event => event.preventDefault(), { once: true }));
  await page.mouse.click(blank.x, blank.y, { button: "right" });
  await expect(viewer).toBeVisible();
  // A drag that starts and ends on the same blank figure is not a click.
  await page.mouse.move(blank.x, blank.y);
  await page.mouse.down();
  await page.mouse.move(blank.x + 20, blank.y, { steps: 3 });
  await page.mouse.up();
  await expect(viewer).toBeVisible();
  await page.mouse.move(blank.x, blank.y);
  await page.mouse.down();
  await page.mouse.move(blank.x + 20, blank.y, { steps: 3 });
  await page.mouse.move(blank.x, blank.y, { steps: 3 });
  await page.mouse.up();
  await expect(viewer).toBeVisible();
  await page.mouse.click(blank.x, blank.y);
  await expect(viewer).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.mouse.click(5, 5);
  await expect(viewer).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("close control and Escape work after reopening, including single and failed images", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  for (const [state, label] of [["默认", "预览图片"], ["长内容", "预览长说明图片"], ["错误", "预览损坏的图片"]]) {
    const panel = await example(page, state);
    const trigger = panel.getByRole("button", { name: label, exact: true });
    const viewer = viewerFor(page);
    await trigger.click();
    await expect(viewer).toBeVisible();
    if (state === "错误") await expect(viewer.locator(".ui-lightbox__image-error")).toBeVisible();
    await viewer.getByRole("button", { name: "关闭预览", exact: true }).click();
    await expect(viewer).toBeHidden();
    await expect(trigger).toBeFocused();
    await trigger.click();
    await page.keyboard.press("Escape");
    await expect(viewer).toBeHidden();
    await expect(trigger).toBeFocused();
    await trigger.click();
    const blank = await blankFigurePoint(viewer);
    await page.mouse.click(blank.x, blank.y);
    await expect(viewer).toBeHidden();
    await expect(trigger).toBeFocused();
  }
});

test("dark controls keep contrast and shadow closes only the nested preview", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  let panel = await example(page, "深色模式");
  await panel.getByRole("button", { name: "预览图片", exact: true }).click();
  const viewer = viewerFor(page);
  const next = viewer.getByRole("button", { name: "下一张", exact: true });
  await expect(next).toHaveCSS("color", "rgb(241, 245, 251)");
  await next.hover();
  await expect(next).toHaveCSS("color", "rgb(241, 245, 251)");
  await page.keyboard.press("Tab");
  const close = viewer.getByRole("button", { name: "关闭预览", exact: true });
  await expect(close).toBeFocused();
  await expect(close).toHaveCSS("outline-style", "solid");
  await capture(viewer, "dark-controls");
  await page.keyboard.press("Escape");
  panel = await example(page, "浮层交互");
  await panel.getByRole("button", { name: "在弹窗中查看此状态", exact: true }).click();
  const outer = page.locator('[data-ui-owner="Dialog"]');
  const trigger = outer.getByRole("button", { name: "预览图片", exact: true });
  for (const method of ["shadow", "close", "escape"]) {
    await trigger.click();
    await expect(viewer).toBeVisible();
    if (method === "shadow") {
      const blank = await blankFigurePoint(viewer);
      await page.mouse.click(blank.x, blank.y);
    } else if (method === "close") {
      await viewer.getByRole("button", { name: "关闭预览", exact: true }).click();
    } else await page.keyboard.press("Escape");
    await expect(viewer).toBeHidden();
    await expect(outer).toBeVisible();
    await expect(trigger).toBeFocused();
  }
  await page.keyboard.press("Escape");
  await expect(outer).toBeHidden();
});
