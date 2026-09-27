// @personal-ui-coverage {"kind":"browser","runner":"browser","exports":["Calendar","DateField"]}
import { expect, test } from "@playwright/test";

test("calendar provides one date Tab stop, real focus, and leap-year/month navigation", async ({ page }) => {
  await page.goto("/tests/fixtures/m5-calendar.html");
  const grid = page.getByRole("grid", { name: /Booking date/ });
  await expect(grid.getByRole("row")).toHaveCount(7);
  await expect(grid.getByRole("columnheader")).toHaveCount(7);
  await expect(grid.getByRole("gridcell")).toHaveCount(42);
  await expect(grid.locator("button[tabindex='0']")).toHaveCount(1);
  await page.getByRole("button", { name: "External update" }).focus();
  await expect(page.getByRole("button", { name: "上个月" })).toBeDisabled();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "下个月" })).toBeFocused();
  await page.keyboard.press("Tab");
  const feb28 = grid.getByRole("button", { name: "February 28, 2024" });
  await expect(feb28).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(grid.getByRole("button", { name: "February 29, 2024" })).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(grid.getByRole("button", { name: "March 1, 2024" })).toBeFocused();
  await expect(page.getByText("March 2024")).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(grid.getByRole("button", { name: "March 3, 2024" })).toBeFocused();
  await expect(grid.getByRole("gridcell", { name: "March 2, 2024" })).toHaveAttribute("aria-disabled", "true");
  await page.keyboard.press("Enter");
  await expect(grid.getByRole("gridcell", { name: "March 3, 2024" })).toHaveAttribute("aria-selected", "true");
  await expect(grid.locator("button[tabindex='0']")).toHaveCount(1);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "After calendar" })).toBeFocused();
});

test("external month/selection and native date precision preserve correct values", async ({ page }) => {
  await page.goto("/tests/fixtures/m5-calendar.html");
  await page.getByRole("button", { name: "External update" }).click();
  await expect(page.getByRole("button", { name: "September 15, 2026" })).toHaveAttribute("tabindex", "0");
  const expected: Array<[string, string, string]> = [
    ["Year", "number", "2024"],
    ["Month", "month", "2024-02"],
    ["Day", "date", "2024-02-29"],
    ["Minute", "datetime-local", "2024-02-29T12:34"],
    ["Second", "datetime-local", "2024-02-29T12:34:56"],
    ["Time", "time", "12:34"],
    ["Time second", "time", "12:34:56"],
  ];
  for (const [name, type, value] of expected) {
    await expect(page.getByRole("form").getByLabel(name, { exact: true })).toHaveAttribute("type", type);
    await expect(page.getByRole("form").getByLabel(name, { exact: true })).toHaveValue(
      name === "Second" || name === "Time second" ? new RegExp(`^${value}(?:\\.000)?$`) : value,
    );
  }
  const values = await page.locator("#date-precision-form").evaluate((form) => Array.from(new FormData(form as HTMLFormElement).entries()));
  expect(values).toEqual(expected.map(([name, , value]) => [
    name.toLowerCase().replace(" ", "-"),
    name === "Second" || name === "Time second" ? expect.stringMatching(new RegExp(`^${value}(?:\\.000)?$`)) : value,
  ]));
  await expect(page.getByLabel("Day", { exact: true })).toHaveAttribute("min", "2024-02-01");
  await expect(page.getByLabel("Day", { exact: true })).toHaveAttribute("max", "2024-03-05");
});

test("DateField rejects dates beyond max even when native range validation misses them", async ({ page }) => {
  await page.goto("/tests/fixtures/m5-calendar.html");
  await page.getByLabel("Day", { exact: true }).fill("2024-03-06");
  const validity = await page.getByLabel("Day", { exact: true }).evaluate((input) => ({
    value: (input as HTMLInputElement).value,
    valid: (input as HTMLInputElement).checkValidity(),
    rangeOverflow: (input as HTMLInputElement).validity.rangeOverflow,
    customError: (input as HTMLInputElement).validity.customError,
  }));
  expect(validity.value).toBe("2024-03-06");
  expect(validity.valid).toBe(false);
  expect(validity.rangeOverflow || validity.customError).toBe(true);
  await page.getByLabel("Day", { exact: true }).fill("2024-03-05");
  expect(await page.getByLabel("Day", { exact: true }).evaluate((input) => (input as HTMLInputElement).checkValidity())).toBe(true);
});

test("calendar grid remains inside a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/tests/fixtures/m5-calendar.html");
  const bounds = await page.getByRole("grid", { name: /Booking date/ }).boundingBox();
  expect(bounds).not.toBeNull();
  expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(320);
  await expect(page.getByRole("gridcell", { name: "February 28, 2024" })).toBeVisible();
});
