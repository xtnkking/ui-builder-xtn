import assert from "node:assert/strict";
import { isPersonalUiRegressionMain, runPersonalUiRegression } from "./browser-test-harness.mjs";

export async function runDataTableFocusRegression({ page, baseURL }) {
  assert.ok(baseURL, "A baseURL is required");
  for (const width of [2560, 1440, 1024, 736]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(baseURL);
      const action = page.locator(".pui-data-table tbody tr .pui-data-table__cell--pin-end .pui-icon-button").first();
      await action.waitFor();
      for (let index = 0; index < 80 && !await action.evaluate((button) => document.activeElement === button); index += 1) {
        await page.keyboard.press("Tab");
      }
      assert.equal(await action.evaluate((button) => document.activeElement === button), true, `button not reachable by Tab at ${width}px`);
      const geometry = await action.evaluate((button) => {
        const content = button.closest(".pui-data-table__cell-content");
        const cell = button.closest("td");
        const buttonBox = button.getBoundingClientRect();
        const cellBox = cell.getBoundingClientRect();
        const buttonStyle = getComputedStyle(button);
        return {
          focusVisible: button.matches(":focus-visible"),
          contentOverflow: getComputedStyle(content).overflowX,
          outlineWidth: parseFloat(buttonStyle.outlineWidth),
          outlineOffset: parseFloat(buttonStyle.outlineOffset),
          buttonLeft: buttonBox.left,
          buttonRight: buttonBox.right,
          cellLeft: cellBox.left,
          cellRight: cellBox.right,
          viewportWidth: window.innerWidth,
          documentWidth: document.documentElement.scrollWidth,
        };
      });
      const focusGutter = geometry.outlineWidth + geometry.outlineOffset;
      assert.ok(geometry.focusVisible, `keyboard focus not visible at ${width}px`);
      assert.equal(geometry.contentOverflow, "visible", `table content clipped the focus ring at ${width}px`);
      assert.ok(geometry.outlineWidth >= 2, `focus indicator missing at ${width}px`);
      assert.ok(geometry.buttonLeft - focusGutter >= geometry.cellLeft, `focus ring clipped on the left at ${width}px`);
      assert.ok(geometry.buttonRight + focusGutter <= geometry.cellRight, `focus ring clipped on the right at ${width}px`);
      assert.ok(geometry.documentWidth <= geometry.viewportWidth, `horizontal overflow at ${width}px`);
      if (process.env.PERSONAL_UI_TABLE_FOCUS_SCREENSHOT_PREFIX) {
        await page.screenshot({ path: `${process.env.PERSONAL_UI_TABLE_FOCUS_SCREENSHOT_PREFIX}-${width}.png` });
      }
  }
  console.log("DataTable action focus regression passed at 2560, 1440, 1024, and 736px.");
}

if (isPersonalUiRegressionMain(import.meta.url)) {
  await runPersonalUiRegression(runDataTableFocusRegression);
}
