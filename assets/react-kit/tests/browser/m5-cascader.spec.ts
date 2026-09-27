// @personal-ui-coverage {"kind":"browser","runner":"browser","exports":["Cascader"]}
import { expect, test } from "@playwright/test";

test("Cascader requires an enabled leaf and supports keyboard navigation at each level", async ({ page }) => {
  await page.goto("/tests/fixtures/m5-cascader.html");
  const form = page.getByRole("form", { name: "Leaf destination" });
  const readForm = () => form.evaluate((element) => ({
    entries: Array.from(new FormData(element as HTMLFormElement).entries()),
    valid: (element as HTMLFormElement).checkValidity(),
  }));
  expect(await readForm()).toEqual({ entries: [], valid: false });
  const city = form.getByRole("combobox", { name: /^City/ });
  await city.focus();
  await city.press("ArrowDown");
  await city.press("ArrowDown");
  await city.press("Enter");
  await expect(city).toContainText("Kyoto");
  expect(await readForm()).toEqual({ entries: [["destination", "kyoto"]], valid: true });

  await form.getByRole("combobox", { name: /^Continent/ }).click();
  await expect(page.getByRole("option", { name: "Europe" })).toBeDisabled();
  await page.getByRole("option", { name: "America" }).click();
  expect(await readForm()).toEqual({ entries: [], valid: false });
  const nextCity = form.getByRole("combobox", { name: /^City/ });
  await nextCity.focus();
  await nextCity.press("ArrowDown");
  await nextCity.press("Enter");
  expect(await readForm()).toEqual({ entries: [["destination", "new-york"]], valid: true });
});

test("path submission invalidates on option changes and reset restores the caller-owned initial path", async ({ page }) => {
  await page.goto("/tests/fixtures/m5-cascader.html");
  const form = page.getByRole("form", { name: "Path destination" });
  const readForm = () => form.evaluate((element) => ({
    entries: Array.from(new FormData(element as HTMLFormElement).entries()),
    valid: (element as HTMLFormElement).checkValidity(),
  }));
  expect(await readForm()).toEqual({ entries: [["path", '["asia","tokyo"]']], valid: true });
  await page.getByRole("button", { name: "Toggle Tokyo availability" }).click();
  expect(await readForm()).toEqual({ entries: [], valid: false });
  const city = form.getByRole("combobox", { name: /^Path city/ });
  await expect(city).not.toContainText("Tokyo");
  await city.focus();
  await city.press("ArrowDown");
  await city.press("Enter");
  expect(await readForm()).toEqual({ entries: [["path", '["asia","kyoto"]']], valid: true });
  await form.evaluate((element) => (element as HTMLFormElement).reset());
  await expect.poll(readForm).toEqual({ entries: [], valid: false });
  await page.getByRole("button", { name: "Toggle Tokyo availability" }).click();
  await expect.poll(readForm).toEqual({ entries: [["path", '["asia","tokyo"]']], valid: true });
  await page.getByRole("button", { name: "Toggle disabled" }).click();
  await expect(form.getByRole("combobox", { name: /^Path city/ })).toBeDisabled();
  expect(await readForm()).toEqual({ entries: [], valid: true });
});
