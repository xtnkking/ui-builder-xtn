import assert from "node:assert/strict";
import { isPersonalUiRegressionMain, runPersonalUiRegression } from "./browser-test-harness.mjs";

const danger = "rgb(201, 54, 43)";
const primary = "rgb(23, 105, 210)";

function assertUniformInset(shadow, label) {
  const dimensions = shadow
    .replace(/rgba?\([^)]+\)|#[\da-f]{3,8}|\btransparent\b|var\([^)]+\)/gi, "")
    .replace(/\binset\b/gi, "")
    .trim()
    .split(/\s+/)
    .map((value) => Number(value.replace(/px$/, "")));
  assert.match(shadow, /\binset\b/, `${label}: focus indicator must be inset (${shadow})`);
  assert.equal(dimensions.length, 4, `${label}: focus indicator must declare x, y, blur, and spread (${shadow})`);
  assert.deepEqual(dimensions.slice(0, 3), [0, 0, 0], `${label}: focus indicator cannot favor one edge (${shadow})`);
  assert.ok(dimensions[3] > 0, `${label}: uniform focus indicator must have visible spread (${shadow})`);
}

async function inspectFocus(input, target, expectedColor, label) {
  await input.evaluate(() => new Promise((resolve) => window.setTimeout(resolve, 180)));
  const state = await input.evaluate((element, targetSelector) => {
    const control = targetSelector ? element.closest(targetSelector) : element;
    const controlStyle = getComputedStyle(control);
    return {
      focused: document.activeElement === element,
      focusVisible: element.matches(":focus-visible"),
      border: controlStyle.borderColor,
      shadow: controlStyle.boxShadow,
      invalid: element.getAttribute("aria-invalid"),
      autofillStateShadow: getComputedStyle(element).getPropertyValue("--_pui-input-autofill-state-shadow").trim().toLowerCase(),
    };
  }, target);
  assert.equal(state.focused, true, `${label}: input did not receive keyboard focus`);
  assert.equal(state.focusVisible, true, `${label}: keyboard focus indication is missing`);
  assert.equal(state.border, expectedColor, `${label}: border color conflicts with the field state`);
  if (state.invalid === "true") {
    assert.ok(state.shadow.includes(expectedColor), `${label}: focus indicator is not the error color (${state.shadow})`);
    assert.ok(!state.shadow.includes(primary), `${label}: brand-blue focus indicator conflicts with the red error border`);
    assertUniformInset(state.shadow, label);
    if (!target) {
      assert.ok(state.autofillStateShadow.includes("#c9362b") || state.autofillStateShadow.includes(danger), `${label}: autofill focus state does not inherit danger color (${state.autofillStateShadow})`);
      assert.ok(!state.autofillStateShadow.includes("#1769d2") && !state.autofillStateShadow.includes(primary), `${label}: autofill focus state still uses brand blue`);
      assertUniformInset(state.autofillStateShadow, `${label} autofill`);
    }
  } else {
    assert.equal(state.shadow, "none", `${label}: normal focus unexpectedly retained the error inset`);
    if (!target) {
      assert.ok(state.autofillStateShadow.includes("transparent"), `${label}: autofill focus state did not reset to transparent (${state.autofillStateShadow})`);
      assert.ok(!state.autofillStateShadow.includes("#c9362b") && !state.autofillStateShadow.includes(danger), `${label}: autofill focus state retained danger color`);
    }
  }
}

export async function runInputInvalidFocusRegression({ page, baseURL }) {
  assert.ok(baseURL, "A baseURL is required");
  for (const width of [2560, 1440, 1024, 736, 360, 320]) {
    await page.setViewportSize({ width, height: 800 });
      await page.goto(`${baseURL}/?regressionWidth=${width}#/patterns/authentication`);
      await page.getByRole("tab", { name: "品牌家族登录预览", exact: true }).click();
      const authCase = page.getByRole("tabpanel", { name: "品牌家族登录预览", exact: true });
      const email = authCase.locator('.pui-auth__form input[name="email"]');
      const password = authCase.locator('.pui-auth__form input[name="password"]');
      await authCase.getByRole("button", { name: "登录", exact: true }).click();
      assert.equal(await email.getAttribute("aria-invalid"), "true", `${width}px: email validation did not run`);
      assert.equal(await password.getAttribute("aria-invalid"), "true", `${width}px: password validation did not run`);

      await password.focus();
      await page.keyboard.press("Shift+Tab");
      await inspectFocus(email, null, danger, `${width}px invalid Input`);
      await page.keyboard.press("Tab");
      await inspectFocus(password, ".pui-input-shell", danger, `${width}px invalid PasswordInput`);
      assert.equal(await password.locator("..").getAttribute("data-pui-owner"), "PasswordInput", `${width}px: password adornment is not owned by the source-kit component`);
      if (process.env.PERSONAL_UI_INPUT_FOCUS_SCREENSHOT_PREFIX) {
        await page.screenshot({ path: `${process.env.PERSONAL_UI_INPUT_FOCUS_SCREENSHOT_PREFIX}-invalid-${width}.png` });
      }

      await email.fill("member@example.com");
      await password.fill("valid-password");
      assert.equal(await email.getAttribute("aria-invalid"), null, `${width}px: email error persisted after correction`);
      assert.equal(await password.getAttribute("aria-invalid"), null, `${width}px: password error persisted after correction`);
      await password.focus();
      await page.keyboard.press("Shift+Tab");
      await inspectFocus(email, null, primary, `${width}px normal Input`);
      await page.keyboard.press("Tab");
      await inspectFocus(password, ".pui-input-shell", primary, `${width}px normal PasswordInput`);
      if (process.env.PERSONAL_UI_INPUT_FOCUS_SCREENSHOT_PREFIX) {
        await page.screenshot({ path: `${process.env.PERSONAL_UI_INPUT_FOCUS_SCREENSHOT_PREFIX}-normal-${width}.png` });
      }
  }
  console.log("Input and PasswordInput uniform invalid focus regression passed at 2560, 1440, 1024, 736, 360, and 320px.");
}

if (isPersonalUiRegressionMain(import.meta.url)) {
  await runPersonalUiRegression(runInputInvalidFocusRegression);
}
