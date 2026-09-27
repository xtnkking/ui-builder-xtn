// @personal-ui-coverage {"kind":"browser","runner":"browser","exports":["Form","MultiSelect","Select"]}
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/tests/fixtures/composite-form.html");
  await expect(page.locator("main[data-ready='true']")).toBeVisible();
});

test("required composites block submit and focus their visible owner", async ({ page }) => {
  const result = await page.locator("#external-profile").evaluate((form: HTMLFormElement) => {
    let submitted = false;
    form.addEventListener("submit", () => { submitted = true; }, { once: true });
    form.requestSubmit();
    return {
      activeOwner: document.activeElement?.closest<HTMLElement>("[data-pui-owner]")?.dataset.puiOwner,
      valid: form.checkValidity(),
      submitted,
    };
  });

  expect(result).toEqual({ activeOwner: "Select", valid: false, submitted: false });

  const unnamed = await page.locator("#unnamed-required").evaluate((form: HTMLFormElement) => {
    form.requestSubmit();
    return {
      activeOwner: document.activeElement?.closest<HTMLElement>("[data-pui-owner]")?.dataset.puiOwner,
      valid: form.checkValidity(),
    };
  });
  expect(unnamed).toEqual({ activeOwner: "Select", valid: false });

  const emptyMulti = await page.locator("#required-multi").evaluate((form: HTMLFormElement) => {
    let submitted = false;
    form.addEventListener("submit", () => { submitted = true; }, { once: true });
    form.requestSubmit();
    return {
      activeOwner: document.activeElement?.closest<HTMLElement>("[data-pui-owner]")?.dataset.puiOwner,
      entries: Array.from(new FormData(form).entries()),
      valid: form.checkValidity(),
      submitted,
    };
  });
  expect(emptyMulti).toEqual({ activeOwner: "MultiSelect", entries: [], valid: false, submitted: false });
});

test("disabled composites omit values and restore serialization and validation when enabled", async ({ page }) => {
  const form = page.locator("#toggle-disabled");
  const snapshot = () => form.evaluate((element: HTMLFormElement) => ({
    entries: Array.from(new FormData(element).entries()),
    valid: element.checkValidity(),
  }));

  await expect.poll(snapshot).toEqual({ entries: [["toggle-roles", "editor"]], valid: true });

  await page.getByRole("button", { name: "Disable toggle roles" }).click();
  await expect.poll(snapshot).toEqual({ entries: [], valid: true });

  await page.getByRole("button", { name: "Enable toggle roles" }).click();
  await expect.poll(snapshot).toEqual({ entries: [["toggle-roles", "editor"]], valid: true });

  await page.getByRole("combobox", { name: "Toggle roles" }).click();
  await page.getByRole("option", { name: "Editor" }).click();
  await page.getByRole("button", { name: "完成" }).click();

  const invalid = await form.evaluate((element: HTMLFormElement) => {
    element.requestSubmit();
    return {
      activeOwner: document.activeElement?.closest<HTMLElement>("[data-pui-owner]")?.dataset.puiOwner,
      entries: Array.from(new FormData(element).entries()),
      valid: element.checkValidity(),
    };
  });
  expect(invalid).toEqual({ activeOwner: "MultiSelect", entries: [], valid: false });
});

test("serializes scalar and repeated values, omits disabled controls, and resets values", async ({ page }) => {
  await page.getByRole("combobox", { name: /Country/ }).click();
  await page.getByRole("option", { name: "China" }).click();

  await page.getByRole("combobox", { name: /Roles/ }).click();
  await page.getByRole("option", { name: "Editor" }).click();
  await page.getByRole("button", { name: "完成" }).click();

  const beforeReset = await page.locator("#external-profile").evaluate((form: HTMLFormElement) => (
    Array.from(new FormData(form).entries())
  ));
  expect(beforeReset).toEqual([
    ["country", "cn"],
    ["roles", "admin"],
    ["roles", "editor"],
  ]);

  await page.getByRole("button", { name: "Reset external profile" }).click();
  await expect.poll(() => page.locator("#external-profile").evaluate((form: HTMLFormElement) => (
    Array.from(new FormData(form).entries())
  ))).toEqual([
    ["country", ""],
    ["roles", "admin"],
  ]);
});

test("custom validity reports through the visible owner and can be cleared", async ({ page }) => {
  await page.getByRole("combobox", { name: /Country/ }).click();
  await page.getByRole("option", { name: "United States" }).click();
  await page.evaluate(() => window.compositeFormFixture?.setCountryError("Country is unavailable"));

  expect(await page.evaluate(() => window.compositeFormFixture?.reportCountryValidity())).toBe(false);
  await expect(page.getByRole("combobox", { name: /Country/ })).toBeFocused();

  await page.evaluate(() => window.compositeFormFixture?.clearCountryError());
  expect(await page.evaluate(() => window.compositeFormFixture?.reportCountryValidity())).toBe(true);
});

test("keeps controlled date ranges synchronized and validates a required segmented control", async ({ page }) => {
  const rangeForm = page.locator("#date-range-form");
  const rangeStart = page.locator("input[name='period.start']");
  const rangeEnd = page.locator("input[name='period.end']");
  await expect(rangeStart).toHaveValue("2026-09-01");
  await expect(rangeEnd).toHaveValue("2026-09-30");

  await page.getByRole("button", { name: "Reset date range" }).click();
  await expect(rangeStart).toHaveValue("");
  await expect(rangeEnd).toHaveValue("");
  await expect.poll(() => rangeForm.evaluate((form: HTMLFormElement) => (
    Array.from(new FormData(form).entries())
  ))).toEqual([
    ["period.start", ""],
    ["period.end", ""],
  ]);

  const segmented = await page.locator("#segmented-required").evaluate((form: HTMLFormElement) => {
    form.requestSubmit();
    return {
      activeText: document.activeElement?.textContent,
      valid: form.checkValidity(),
    };
  });
  expect(segmented).toEqual({ activeText: "Grid", valid: false });

  await page.getByRole("button", { name: "Grid" }).click();
  expect(await page.locator("#segmented-required").evaluate((form: HTMLFormElement) => (
    Array.from(new FormData(form).entries())
  ))).toEqual([["view", "grid"]]);
});

test("does not reset composite state when reset is cancelled", async ({ page }) => {
  await page.getByRole("combobox", { name: /Cancelled roles/ }).click();
  await page.getByRole("option", { name: "Editor" }).click();
  await page.getByRole("button", { name: "完成" }).click();

  const form = page.locator("#cancelled-reset");
  await expect.poll(() => form.evaluate((element: HTMLFormElement) => (
    Array.from(new FormData(element).entries())
  ))).toEqual([
    ["cancelled-roles", "admin"],
    ["cancelled-roles", "editor"],
  ]);

  await page.getByRole("button", { name: "Cancel reset" }).click();
  await expect.poll(() => form.evaluate((element: HTMLFormElement) => (
    Array.from(new FormData(element).entries())
  ))).toEqual([
    ["cancelled-roles", "admin"],
    ["cancelled-roles", "editor"],
  ]);
});
