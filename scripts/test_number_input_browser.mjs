import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const kitRoot = fileURLToPath(new URL("../assets/react-kit/", import.meta.url));
const kitRequire = createRequire(new URL("../assets/react-kit/package.json", import.meta.url));
const { createServer } = await import(pathToFileURL(kitRequire.resolve("vite")).href);
const playwrightModule = process.env.PERSONAL_UI_PLAYWRIGHT_MODULE || "playwright";
const { chromium } = createRequire(import.meta.url)(playwrightModule);
const numberStyles = readFileSync(new URL("../assets/react-kit/src/personal-ui/styles/inputs-extra.css", import.meta.url), "utf8");
assert.match(numberStyles, /\.pui-number-input \.pui-input--embedded::-webkit-inner-spin-button/);
assert.match(numberStyles, /-webkit-appearance:\s*none/);

const server = await createServer({ root: kitRoot, server: { host: "127.0.0.1", port: 0 } });
let browser;

try {
  await server.listen();
  const url = server.resolvedUrls?.local?.[0];
  assert.ok(url, "Vite did not expose a local URL");
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PERSONAL_UI_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PERSONAL_UI_CHROMIUM_EXECUTABLE }
      : {}),
  });

  for (const width of [2560, 1440, 1024, 736, 360, 320]) {
    const page = await browser.newPage({ viewport: { width, height: 800 } });
    try {
      await page.goto(url);
      await page.getByRole("tab", { name: "数字输入" }).click();
      if (process.env.PERSONAL_UI_NUMBER_SCREENSHOT_PREFIX) {
        await page.screenshot({ path: `${process.env.PERSONAL_UI_NUMBER_SCREENSHOT_PREFIX}-${width}.png` });
      }
      const editable = page.locator(".pui-number-input:has(#number-demo-period)");
      const input = editable.locator("input");
      const increase = editable.getByRole("button", { name: "自检周期（分钟） 增加", exact: true });
      const decrease = editable.getByRole("button", { name: "自检周期（分钟） 减少", exact: true });
      const empty = page.locator(".pui-number-input:has(#number-demo-empty)");
      const emptyInput = empty.locator("input");
      const emptyIncrease = empty.getByRole("button", { name: "空值起点 增加", exact: true });
      const emptyDecrease = empty.getByRole("button", { name: "空值起点 减少", exact: true });

      assert.equal(await emptyInput.inputValue(), "");
      await emptyIncrease.click();
      assert.equal(await emptyInput.inputValue(), "10", "first increase should reach min, not min + step");
      await emptyInput.fill("");
      await emptyDecrease.click();
      assert.equal(await emptyInput.inputValue(), "30", "first decrease should reach max");
      await emptyInput.fill("");
      await emptyInput.pressSequentially("e");
      assert.equal(await emptyInput.inputValue(), "", "invalid number input should not emit NaN");

      assert.equal(await input.inputValue(), "120");
      await input.focus();
      await page.keyboard.press("Tab");
      assert.equal(await increase.evaluate((button) => document.activeElement === button), true);
      const focusStyle = await increase.evaluate((button) => ({
        visible: button.matches(":focus-visible"),
        width: parseFloat(getComputedStyle(button).outlineWidth),
        offset: parseFloat(getComputedStyle(button).outlineOffset),
      }));
      assert.ok(focusStyle.visible && focusStyle.width >= 2 && focusStyle.offset < 0, `step focus indicator missing at ${width}px`);
      await page.keyboard.press("Enter");
      assert.equal(await input.inputValue(), "130");
      await page.keyboard.press("Tab");
      assert.equal(await decrease.evaluate((button) => document.activeElement === button), true);
      await page.keyboard.press("Enter");
      assert.equal(await input.inputValue(), "120");
      await increase.click();
      assert.equal(await input.inputValue(), "130");
      await decrease.click();
      assert.equal(await input.inputValue(), "120");

      await input.fill("180");
      assert.equal(await increase.isDisabled(), true);
      await decrease.click();
      assert.equal(await input.inputValue(), "170");
      await input.fill("0");
      assert.equal(await decrease.isDisabled(), true);

      for (const state of ["readonly", "disabled"]) {
        const control = page.locator(`.pui-number-input:has(#number-demo-${state})`);
        const label = state === "readonly" ? "只读周期" : "禁用周期";
        assert.equal(await control.getByRole("button", { name: `${label} 增加`, exact: true }).isDisabled(), true);
        assert.equal(await control.getByRole("button", { name: `${label} 减少`, exact: true }).isDisabled(), true);
      }
      assert.equal(await page.locator("#number-demo-readonly").getAttribute("readonly"), "");
      assert.equal(await page.locator("#number-demo-disabled").isDisabled(), true);

      const geometry = await editable.evaluate((shell) => {
        const field = shell.querySelector("input");
        const slot = shell.querySelector(".pui-input-shell__end");
        const buttons = [...shell.querySelectorAll(".pui-number-input__steps button")];
        const frame = shell.getBoundingClientRect();
        const slotBox = slot.getBoundingClientRect();
        const buttonBoxes = buttons.map((button) => button.getBoundingClientRect());
        return {
          shellWidth: frame.width,
          slotWidth: slotBox.width,
          inputRight: field.getBoundingClientRect().right,
          slotLeft: slotBox.left,
          inputAppearance: getComputedStyle(field).appearance,
          buttonBoxes: buttonBoxes.map((box) => ({ left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height })),
          frame: { left: frame.left, right: frame.right, top: frame.top, bottom: frame.bottom },
          documentWidth: document.documentElement.scrollWidth,
          viewportWidth: window.innerWidth,
        };
      });
      assert.ok(geometry.shellWidth >= 200, `control collapsed at ${width}px`);
      assert.ok(geometry.slotWidth >= 58, `adornment slot clipped at ${width}px`);
      assert.ok(geometry.inputRight <= geometry.slotLeft + 1, `input overlaps buttons at ${width}px`);
      assert.equal(geometry.inputAppearance, "textfield", `native number appearance retained at ${width}px`);
      assert.equal(geometry.buttonBoxes.length, 2);
      for (const box of geometry.buttonBoxes) {
        assert.ok(box.width >= 28 && box.height >= 28, `custom step button collapsed at ${width}px`);
        assert.ok(box.left >= geometry.frame.left && box.right <= geometry.frame.right, `step button clipped horizontally at ${width}px`);
        assert.ok(box.top >= geometry.frame.top && box.bottom <= geometry.frame.bottom, `step button clipped vertically at ${width}px`);
      }
      assert.ok(geometry.documentWidth <= geometry.viewportWidth, `horizontal overflow at ${width}px`);
    } finally {
      await page.close();
    }
  }
  console.log("NumberInput browser regression passed at 2560, 1440, 1024, 736, 360, and 320px.");
} finally {
  await browser?.close();
  await server.close();
}
