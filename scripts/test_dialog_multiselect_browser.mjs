import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const kitRoot = fileURLToPath(new URL("../assets/react-kit/", import.meta.url));
const kitRequire = createRequire(new URL("../assets/react-kit/package.json", import.meta.url));
const { createServer } = await import(pathToFileURL(kitRequire.resolve("vite")).href);
const { chromium } = createRequire(import.meta.url)(process.env.PERSONAL_UI_PLAYWRIGHT_MODULE || "playwright");
const server = await createServer({ root: kitRoot, server: { host: "127.0.0.1", port: 0 } });
let browser;

async function noHorizontalOverflow(page, label) {
  const sizes = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: window.innerWidth }));
  assert.ok(sizes.document <= sizes.viewport, `${label}: document overflows horizontally (${sizes.document} > ${sizes.viewport})`);
}

async function clickBackdrop(dialog, label) {
  const overlay = dialog.locator("..");
  const backdropIsTopmost = await overlay.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return document.elementFromPoint(bounds.left + 5, bounds.top + 5) === element;
  });
  assert.equal(backdropIsTopmost, true, `${label}: backdrop test point is covered by another surface`);
  await overlay.click({ position: { x: 5, y: 5 } });
}

async function inspectMoreSelectorsFocus(dialog, label) {
  const actionFocused = await dialog.getByRole("button", { name: "完成", exact: true }).evaluate((button) => document.activeElement === button);
  const focus = await dialog.evaluate((panel) => ({
    panelFocusVisible: panel.matches(":focus-visible"),
    panelOutline: getComputedStyle(panel).outlineStyle,
  }));
  assert.equal(actionFocused, true, `${label}: initial focus did not reach the safe footer action`);
  assert.equal(focus.panelFocusVisible, false, `${label}: panel shows a keyboard focus ring`);
  assert.equal(focus.panelOutline, "none", `${label}: panel has a visible outline`);
}

async function inspectCompactConfirmation(dialog, label) {
  const geometry = await dialog.evaluate((element) => {
    const panel = element.getBoundingClientRect();
    const header = element.querySelector(".pui-dialog__header").getBoundingClientRect();
    const footer = element.querySelector(".pui-dialog__footer").getBoundingClientRect();
    const actions = [...element.querySelectorAll(".pui-dialog__footer button")].map((button) => {
      const rect = button.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
    });
    return {
      panel: { left: panel.left, right: panel.right, top: panel.top, bottom: panel.bottom, width: panel.width, height: panel.height },
      header: { bottom: header.bottom, height: header.height },
      footer: { top: footer.top, bottom: footer.bottom, height: footer.height },
      actions,
      bodyCount: element.querySelectorAll(".pui-dialog__body").length,
      viewport: { width: innerWidth, height: innerHeight },
    };
  });
  assert.equal(geometry.bodyCount, 0, `${label}: confirmation rendered empty body`);
  assert.ok(Math.abs(geometry.header.bottom - geometry.footer.top) <= 1, `${label}: blank band between confirmation header and actions`);
  assert.ok(geometry.panel.width <= 441, `${label}: confirmation is not compact`);
  assert.ok(geometry.panel.height <= 190, `${label}: confirmation has excessive vertical whitespace`);
  assert.ok(geometry.footer.height <= 78, `${label}: action area has excessive vertical whitespace`);
  assert.ok(Math.abs((geometry.panel.left + geometry.panel.right) / 2 - geometry.viewport.width / 2) <= 2, `${label}: dialog is not centered horizontally`);
  assert.ok(Math.abs((geometry.panel.top + geometry.panel.bottom) / 2 - geometry.viewport.height / 2) <= 2, `${label}: dialog is not centered vertically`);
  for (const action of geometry.actions) {
    assert.ok(action.left >= geometry.panel.left && action.right <= geometry.panel.right && action.top >= geometry.footer.top && action.bottom <= geometry.footer.bottom, `${label}: action escaped confirmation footer`);
  }
  return geometry;
}

async function inspectRoleForm(dialog, label) {
  const geometry = await dialog.evaluate((element) => {
    const body = element.querySelector(".pui-dialog__body");
    const bodyBox = body.getBoundingClientRect();
    const form = body.querySelector(".demo-dialog-form");
    const rows = [...form.children].map((child) => {
      const box = child.getBoundingClientRect();
      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
    });
    const footer = element.querySelector(".pui-dialog__footer").getBoundingClientRect();
    return {
      body: { left: bodyBox.left, right: bodyBox.right, top: bodyBox.top, bottom: bodyBox.bottom, scrollHeight: body.scrollHeight, clientHeight: body.clientHeight },
      rows,
      footer: { top: footer.top, bottom: footer.bottom },
      formGap: parseFloat(getComputedStyle(form).rowGap),
    };
  });
  assert.equal(geometry.rows.length, 3, `${label}: role form rows changed; update the spacing contract`);
  assert.ok(geometry.formGap >= 14 && geometry.formGap <= 26, `${label}: role form has inconsistent vertical rhythm (${geometry.formGap}px)`);
  for (let index = 0; index < geometry.rows.length; index++) {
    const row = geometry.rows[index];
    assert.ok(row.left >= geometry.body.left - 1 && row.right <= geometry.body.right + 1, `${label}: role form row overflows dialog body`);
    if (index > 0) {
      const gap = row.top - geometry.rows[index - 1].bottom;
      assert.ok(gap >= 13 && gap <= 27, `${label}: role form rows visually touch or drift (${gap}px)`);
    }
  }
  assert.ok(geometry.footer.top >= geometry.body.bottom - 1, `${label}: dialog footer overlaps role form`);
  return geometry;
}

async function inspectVisualTokens(dialog, width) {
  const measured = await dialog.evaluate((element) => {
    const multi = element.querySelector(".pui-multi-select__trigger");
    const country = element.querySelector(".pui-async-select .pui-combobox__trigger");
    const save = element.querySelector(".pui-dialog__footer .pui-button--primary");
    const cancel = element.querySelector(".pui-dialog__footer .pui-button:not(.pui-button--primary)");
    return {
      multi: { height: multi.getBoundingClientRect().height, radius: getComputedStyle(multi).borderTopLeftRadius },
      country: { height: country.getBoundingClientRect().height, radius: getComputedStyle(country).borderTopLeftRadius },
      save: { height: save.getBoundingClientRect().height, background: getComputedStyle(save).backgroundColor },
      cancel: { height: cancel.getBoundingClientRect().height },
      primaryToken: getComputedStyle(element).getPropertyValue("--pui-primary").trim(),
    };
  });
  assert.deepEqual(measured.multi, { height: 44, radius: "12px" }, `${width}px: MultiSelect differs from source-kit control geometry`);
  assert.deepEqual(measured.country, { height: 44, radius: "12px" }, `${width}px: AsyncSelect differs from source-kit control geometry`);
  assert.equal(measured.cancel.height, 38, `${width}px: ordinary button differs from source-kit control geometry`);
  assert.equal(measured.save.height, 38, `${width}px: primary button differs from source-kit control geometry`);
  assert.equal(measured.primaryToken.toLowerCase(), "#1769d2", `${width}px: source-kit primary token drifted`);
  assert.equal(measured.save.background, "rgb(23, 105, 210)", `${width}px: primary action is not company blue`);
}

async function inspectPopup(page, dialog, popup, label) {
  await page.locator('.pui-overlay > .pui-multi-select__popover[data-positioned="true"]').waitFor();
  const geometry = await popup.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const list = element.querySelector(".pui-multi-select__list");
    const listBox = list.getBoundingClientRect();
    const footer = element.querySelector(".pui-multi-select__footer");
    const footerBox = footer.getBoundingClientRect();
    const visibleOptions = [...list.querySelectorAll('[role="option"]')].filter((option) => {
      const optionBox = option.getBoundingClientRect();
      return optionBox.bottom > listBox.top + 1 && optionBox.top < listBox.bottom - 1;
    }).length;
    const hit = document.elementFromPoint(Math.min(innerWidth - 1, box.left + box.width / 2), Math.min(innerHeight - 1, box.top + 20));
    return {
      portal: element.parentElement?.classList.contains("pui-overlay") === true,
      visible: getComputedStyle(element).visibility === "visible",
      onTop: Boolean(hit && element.contains(hit)),
      bounds: { left: box.left, right: box.right, top: box.top, bottom: box.bottom, height: box.height },
      list: { height: listBox.height, scrollHeight: list.scrollHeight, clientHeight: list.clientHeight },
      footer: { top: footerBox.top, bottom: footerBox.bottom },
      visibleOptions,
      viewport: { width: document.documentElement.clientWidth, height: document.documentElement.clientHeight },
    };
  });
  assert.ok(geometry.portal, `${label}: popup is still inside the clipped Dialog body`);
  assert.ok(geometry.visible && geometry.onTop, `${label}: popup is hidden or covered by the modal`);
  assert.ok(geometry.bounds.left >= 11 && geometry.bounds.right <= geometry.viewport.width - 11, `${label}: popup outside horizontal viewport`);
  assert.ok(geometry.bounds.top >= 11 && geometry.bounds.bottom <= geometry.viewport.height - 11, `${label}: popup outside vertical viewport`);
  assert.ok(geometry.list.height > 70 && geometry.visibleOptions >= 2, `${label}: options are not meaningfully visible`);
  assert.ok(geometry.footer.top >= geometry.bounds.top && geometry.footer.bottom <= geometry.bounds.bottom + 1, `${label}: footer escaped popup`);
  assert.equal(await dialog.locator(".pui-multi-select__popover").count(), 0, `${label}: dialog owns clipped popup DOM`);
  await noHorizontalOverflow(page, label);
  return geometry;
}

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
    const height = width <= 360 ? 640 : 900;
    const page = await browser.newPage({ viewport: { width, height } });
    try {
      await page.goto(url);
      const memberAction = page.getByRole("button", { name: "陈沐的更多操作" });
      await memberAction.click();
      const memberDrawer = page.getByRole("dialog", { name: "陈沐" });
      const descriptionList = memberDrawer.locator('[data-pui-owner="DescriptionList"]');
      await descriptionList.waitFor();
      const descriptionGeometry = await descriptionList.evaluate((element) => {
        const listBounds = element.getBoundingClientRect();
        const items = [...element.querySelectorAll(".pui-description-list__item")];
        const itemBounds = items.map((item) => {
          const bounds = item.getBoundingClientRect();
          return { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom, width: bounds.width };
        });
        const longValue = items[0].querySelector("dd");
        longValue.textContent = "super_admin";
        const textRange = document.createRange();
        textRange.selectNodeContents(longValue);
        const lineTops = [...textRange.getClientRects()].map((rect) => Math.round(rect.top));
        return {
          list: { left: listBounds.left, right: listBounds.right, width: listBounds.width },
          itemBounds,
          lineCount: new Set(lineTops).size,
          longValueWidth: longValue.getBoundingClientRect().width,
          columnCount: getComputedStyle(element).gridTemplateColumns.split(" ").length,
        };
      });
      assert.equal(descriptionGeometry.columnCount, 1, `${width}px: DescriptionList default outer grid is not one column`);
      assert.equal(descriptionGeometry.itemBounds.length, 4, `${width}px: member metadata items changed unexpectedly`);
      for (const item of descriptionGeometry.itemBounds) {
        assert.ok(Math.abs(item.left - descriptionGeometry.list.left) <= 1 && Math.abs(item.right - descriptionGeometry.list.right) <= 1, `${width}px: DescriptionList item was compressed by an outer grid column`);
      }
      assert.ok(descriptionGeometry.longValueWidth >= 80, `${width}px: DescriptionList value column is too narrow for identifiers`);
      assert.equal(descriptionGeometry.lineCount, 1, `${width}px: super_admin wrapped despite fitting in the Drawer`);
      await memberDrawer.getByRole("button", { name: "关闭抽屉" }).click();
      await memberDrawer.waitFor({ state: "detached" });

      await page.getByRole("tab", { name: "弹窗" }).click();
      const responseMode = page.getByRole("group", { name: "选择确认操作响应" });
      const opener = page.getByRole("button", { name: "停用用户", exact: true });
      await opener.click();
      const confirm = page.getByRole("dialog", { name: "停用用户" });
      await confirm.waitFor();
      const close = confirm.getByRole("button", { name: "关闭对话框" });
      const cancel = confirm.getByRole("button", { name: "取消" });
      const danger = confirm.getByRole("button", { name: "停用", exact: true });
      const compact = await inspectCompactConfirmation(confirm, `${width}px initial confirmation`);
      assert.ok(Math.abs(compact.panel.width - Math.min(420, width - 40)) <= 1, `${width}px: compact confirmation width drifted from source-kit geometry`);
      const spacing = await confirm.evaluate((dialog) => {
        const header = dialog.querySelector(".pui-dialog__header").getBoundingClientRect();
        const footer = dialog.querySelector(".pui-dialog__footer").getBoundingClientRect();
        const closeButton = dialog.querySelector('.pui-dialog__header button');
        return {
          gap: footer.top - header.bottom,
          closeFocusVisible: closeButton.matches(":focus-visible"),
          focused: document.activeElement?.textContent?.trim() ?? document.activeElement?.tagName,
        };
      });
      assert.ok(Math.abs(spacing.gap) <= 1, `${width}px: blank band between confirmation header and actions`);
      assert.equal(spacing.closeFocusVisible, false, `${width}px: close button shows initial keyboard focus ring`);
      if (width === 1440 || width === 320) {
        console.log(`${width}px ConfirmDialog ${Math.round(compact.panel.width)}x${Math.round(compact.panel.height)}, initial focus: ${spacing.focused}; close focus-visible: ${spacing.closeFocusVisible}`);
        if (process.env.PERSONAL_UI_DIALOG_SCREENSHOT_PREFIX) {
          await page.screenshot({ path: `${process.env.PERSONAL_UI_DIALOG_SCREENSHOT_PREFIX}-confirm-${width}.png` });
        }
      }
      assert.equal(await cancel.evaluate((button) => document.activeElement === button), true, `${width}px: cancel did not receive initial safe focus`);
      await cancel.press("Shift+Tab");
      assert.equal(await close.evaluate((button) => document.activeElement === button), true, `${width}px: Shift+Tab missed close`);
      await close.press("Shift+Tab");
      assert.equal(await danger.evaluate((button) => document.activeElement === button), true, `${width}px: reverse focus trap failed`);
      await danger.press("Tab");
      assert.equal(await close.evaluate((button) => document.activeElement === button), true, `${width}px: forward focus trap failed`);
      await page.keyboard.press("Escape");
      await confirm.waitFor({ state: "detached" });
      assert.equal(await opener.evaluate((button) => document.activeElement === button), true, `${width}px: Escape did not restore opener focus`);
      await opener.click();
      await clickBackdrop(confirm, `${width}px default confirmation`);
      await confirm.waitFor({ state: "detached" });

      await responseMode.getByRole("button", { name: "请求失败" }).click();
      await opener.click();
      await danger.click();
      const failed = page.getByRole("dialog", { name: "停用用户" });
      await failed.getByRole("alert").waitFor();
      assert.ok((await failed.locator(".pui-dialog__body").boundingBox())?.height > 0, `${width}px: error body not visible`);
      await failed.getByRole("button", { name: "取消" }).click();
      await failed.waitFor({ state: "detached" });
      await opener.click();
      assert.equal(await page.getByRole("dialog", { name: "停用用户" }).getByRole("alert").count(), 0, `${width}px: error persisted on reopen`);
      await page.keyboard.press("Escape");

      await page.getByRole("button", { name: "分配角色" }).click();
      const roleDialog = page.getByRole("dialog", { name: "分配角色 · xtn" });
      await roleDialog.waitFor();
      await clickBackdrop(roleDialog, `${width}px role dialog`);
      assert.equal(await roleDialog.isVisible(), true, `${width}px: backdrop closed the role Dialog`);
      await roleDialog.getByRole("button", { name: "关闭对话框" }).click();
      await roleDialog.waitFor({ state: "detached" });
      await page.getByRole("button", { name: "分配角色" }).click();
      await clickBackdrop(roleDialog, `${width}px reopened role dialog`);
      assert.equal(await roleDialog.isVisible(), true, `${width}px: backdrop closed the reopened role Dialog`);
      await page.keyboard.press("Escape");
      await roleDialog.waitFor({ state: "detached" });
      await page.getByRole("button", { name: "分配角色" }).click();
      const roleForm = await inspectRoleForm(roleDialog, `${width}px role dialog`);
      await inspectVisualTokens(roleDialog, width);
      if (width === 1440 || width === 320) {
        console.log(`${width}px role form gap: ${roleForm.formGap}px, body scroll: ${roleForm.body.scrollHeight}/${roleForm.body.clientHeight}`);
        if (process.env.PERSONAL_UI_DIALOG_SCREENSHOT_PREFIX) {
          await page.screenshot({ path: `${process.env.PERSONAL_UI_DIALOG_SCREENSHOT_PREFIX}-role-${width}.png` });
        }
      }
      if (width === 1440 || width === 320) {
        const panelFocus = await roleDialog.evaluate((panel) => ({
          focused: document.activeElement === panel,
          focusVisible: panel.matches(":focus-visible"),
          outline: getComputedStyle(panel).outline,
        }));
        console.log(`${width}px regular Dialog initial focus: ${JSON.stringify(panelFocus)}`);
      }
      const body = roleDialog.locator(".pui-dialog__body");
      const footer = roleDialog.locator(".pui-dialog__footer");
      const trigger = roleDialog.getByRole("combobox", { name: /角色，已选择/ });
      await trigger.click();
      const popup = page.locator(".pui-overlay > .pui-multi-select__popover");
      await popup.waitFor();
      const list = popup.getByRole("listbox", { name: "角色" });
      assert.equal(await list.getByRole("option").count(), 8, `${width}px: options missing`);
      assert.equal(await popup.getByRole("searchbox", { name: "搜索角色" }).evaluate((input) => document.activeElement === input), true, `${width}px: search was not focused`);
      const initial = await inspectPopup(page, roleDialog, popup, `${width}px initial`);
      if (width === 1440 || width === 320) {
        console.log(`${width}px MultiSelect popup: ${JSON.stringify(initial.bounds)}, visible options: ${initial.visibleOptions}`);
        if (process.env.PERSONAL_UI_DIALOG_SCREENSHOT_PREFIX) {
          await page.screenshot({ path: `${process.env.PERSONAL_UI_DIALOG_SCREENSHOT_PREFIX}-multi-${width}.png` });
        }
      }
      const fixedFooter = await footer.boundingBox();
      await list.evaluate((element) => { element.scrollTop = element.scrollHeight; });
      await list.getByRole("option", { name: "管理员 · 等级 7" }).click();
      assert.equal(await list.getByRole("option", { name: "管理员 · 等级 7" }).getAttribute("aria-selected"), "true", `${width}px: selection did not toggle`);
      const afterScrollFooter = await footer.boundingBox();
      assert.ok(Math.abs(fixedFooter.y - afterScrollFooter.y) <= 1, `${width}px: dialog footer moved with popup scroll`);
      await popup.getByRole("searchbox", { name: "搜索角色" }).fill("客户支持");
      assert.equal(await list.getByRole("option").count(), 1, `${width}px: search did not filter`);
      await list.getByRole("option", { name: "客户支持 · 等级 4" }).click();
      assert.equal(await list.getByRole("option", { name: "客户支持 · 等级 4" }).getAttribute("aria-selected"), "true", `${width}px: filtered toggle failed`);
      await popup.getByRole("button", { name: "清除搜索" }).click();
      assert.equal(await list.getByRole("option").count(), 8, `${width}px: search clear did not restore options`);
      await popup.getByRole("button", { name: "清空", exact: true }).click();
      assert.equal(await trigger.getAttribute("aria-label"), "角色，已选择 0 项", `${width}px: clear did not clear selected values`);
      await popup.getByRole("button", { name: "完成" }).click();
      await popup.waitFor({ state: "detached" });
      assert.equal(await roleDialog.isVisible(), true, `${width}px: completing MultiSelect closed parent Dialog`);
      await trigger.click();
      await popup.waitFor();
      await popup.getByRole("searchbox", { name: "搜索角色" }).fill("运营成员");
      await page.keyboard.press("Escape");
      await popup.waitFor({ state: "detached" });
      assert.equal(await roleDialog.isVisible(), true, `${width}px: popup Escape closed parent Dialog`);
      await trigger.click();
      await popup.waitFor();
      await popup.getByRole("button", { name: "清除搜索" }).click();
      for (const name of ["普通用户 · 等级 0", "内容编辑 · 等级 3", "客户支持 · 等级 4", "管理员 · 等级 7"]) {
        await popup.getByRole("option", { name }).click();
      }
      await popup.getByRole("button", { name: "完成" }).click();
      await popup.waitFor({ state: "detached" });
      assert.equal(await trigger.getAttribute("aria-label"), "角色，已选择 4 项", `${width}px: selected role count changed`);
      const country = roleDialog.getByRole("combobox", { name: "国家或地区" });
      await country.click();
      const countryPopup = page.locator(".pui-overlay > .pui-async-select__popover");
      await countryPopup.waitFor({ state: "visible" });
      await countryPopup.getByRole("searchbox", { name: "搜索国家或地区" }).fill("日本");
      await countryPopup.getByRole("option", { name: /日本/ }).click();
      await countryPopup.waitFor({ state: "detached" });
      assert.ok((await country.textContent())?.includes("日本"), `${width}px: selected country is not rendered`);
      await inspectRoleForm(roleDialog, `${width}px selected role dialog`);
      if ((width === 1440 || width === 320) && process.env.PERSONAL_UI_DIALOG_SCREENSHOT_PREFIX) {
        await page.screenshot({ path: `${process.env.PERSONAL_UI_DIALOG_SCREENSHOT_PREFIX}-role-selected-${width}.png` });
      }
      await body.evaluate((element) => { element.scrollTop = element.scrollHeight; });
      const scrolledDialogFooter = await footer.boundingBox();
      assert.ok(Math.abs(fixedFooter.y - scrolledDialogFooter.y) <= 1, `${width}px: dialog footer moved with body scroll`);
      await roleDialog.getByRole("button", { name: "上层确认" }).click();
      const nested = page.getByRole("dialog", { name: "确认国家范围" });
      await nested.waitFor();
      const nestedGeometry = await inspectCompactConfirmation(nested, `${width}px nested confirmation`);
      const coveredParent = page.locator('.pui-dialog[aria-hidden="true"][inert]');
      assert.equal(await coveredParent.count(), 1, `${width}px: parent dialog was not retained inert beneath nested confirmation`);
      assert.equal(await coveredParent.isVisible(), true, `${width}px: parent dialog vanished beneath nested confirmation`);
      assert.equal(await nested.locator(".pui-dialog__footer button").count(), 2, `${width}px: nested confirmation missing cancel action`);
      const nestedOnTop = await nested.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return hit != null && element.contains(hit);
      });
      assert.equal(nestedOnTop, true, `${width}px: nested confirmation is covered by parent dialog`);
      if (width === 1440 || width === 320) {
        console.log(`${width}px nested confirmation ${Math.round(nestedGeometry.panel.width)}x${Math.round(nestedGeometry.panel.height)}`);
        if (process.env.PERSONAL_UI_DIALOG_SCREENSHOT_PREFIX) {
          await page.screenshot({ path: `${process.env.PERSONAL_UI_DIALOG_SCREENSHOT_PREFIX}-nested-${width}.png` });
        }
      }
      await clickBackdrop(nested, `${width}px nested confirmation`);
      assert.equal(await nested.isVisible(), true, `${width}px: backdrop closed the nested ConfirmDialog`);
      assert.equal(await coveredParent.isVisible(), true, `${width}px: backdrop removed the inert parent Dialog under the nested ConfirmDialog`);
      await nested.getByRole("button", { name: "关闭对话框" }).click();
      await nested.waitFor({ state: "detached" });
      await roleDialog.getByRole("button", { name: "上层确认" }).click();
      await clickBackdrop(nested, `${width}px reopened nested confirmation`);
      assert.equal(await nested.isVisible(), true, `${width}px: backdrop closed the reopened nested ConfirmDialog`);
      await page.keyboard.press("Escape");
      await nested.waitFor({ state: "detached" });
      assert.equal(await roleDialog.isVisible(), true, `${width}px: nested Escape closed the parent Dialog`);
      await roleDialog.getByRole("button", { name: "上层确认" }).click();
      await nested.getByRole("button", { name: "取消" }).click();
      await nested.waitFor({ state: "detached" });
      assert.equal(await roleDialog.isVisible(), true, `${width}px: canceling nested confirmation closed parent dialog`);
      await roleDialog.getByRole("button", { name: "取消" }).click();
      await roleDialog.waitFor({ state: "detached" });

      const moreOpener = page.getByRole("button", { name: "更多选择器" });
      const moreDialog = page.getByRole("dialog", { name: "更多选择器" });
      await moreOpener.click();
      await moreDialog.waitFor();
      await inspectMoreSelectorsFocus(moreDialog, `${width}px more selectors`);
      await clickBackdrop(moreDialog, `${width}px more selectors`);
      assert.equal(await moreDialog.isVisible(), true, `${width}px: backdrop closed the more-selectors Dialog`);
      await page.keyboard.press("Escape");
      await moreDialog.waitFor({ state: "detached" });
      assert.equal(await moreOpener.evaluate((button) => document.activeElement === button), true, `${width}px: more-selectors Escape did not restore opener focus`);
      await moreOpener.click();
      await moreDialog.waitFor();
      await inspectMoreSelectorsFocus(moreDialog, `${width}px reopened more selectors`);
      await clickBackdrop(moreDialog, `${width}px reopened more selectors`);
      assert.equal(await moreDialog.isVisible(), true, `${width}px: backdrop closed the reopened more-selectors Dialog`);
      await moreDialog.getByRole("button", { name: "关闭对话框" }).click();
      await moreDialog.waitFor({ state: "detached" });
      await noHorizontalOverflow(page, `${width}px final`);

      await page.getByRole("tab", { name: "用户权限" }).click();
      const edit = page.getByRole("button", { name: "编辑陈沐" });
      await edit.click();
      const drawer = page.getByRole("dialog", { name: "编辑陈沐的权限" });
      const drawerGeometry = await drawer.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        const overlayStyle = getComputedStyle(element.parentElement);
        return {
          bounds: { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom, width: bounds.width, height: bounds.height },
          className: element.className,
          overlayClassName: element.parentElement.className,
          overlayPadding: overlayStyle.padding,
          radii: {
            topLeft: style.borderTopLeftRadius,
            topRight: style.borderTopRightRadius,
            bottomRight: style.borderBottomRightRadius,
            bottomLeft: style.borderBottomLeftRadius,
          },
        };
      });
      const drawerBounds = drawerGeometry.bounds;
      assert.ok(drawerBounds.left >= -1 && drawerBounds.right <= width + 1 && drawerBounds.top >= -1 && drawerBounds.bottom <= height + 1, `${width}px: drawer outside viewport ${JSON.stringify(drawerBounds)}`);
      assert.match(drawerGeometry.className, /(?:^|\s)pui-drawer--edge(?:\s|$)/, `${width}px: Drawer default is not the edge variant`);
      assert.match(drawerGeometry.overlayClassName, /(?:^|\s)pui-overlay--drawer-edge(?:\s|$)/, `${width}px: Drawer overlay default is not the edge variant`);
      if (width > 640) {
        assert.ok(Math.abs(drawerBounds.top) <= 1, `${width}px: desktop Drawer is not flush to the top`);
        assert.ok(Math.abs(drawerBounds.right - width) <= 1, `${width}px: desktop Drawer is not flush to the right`);
        assert.ok(Math.abs(drawerBounds.bottom - height) <= 1, `${width}px: desktop Drawer is not flush to the bottom`);
        assert.equal(drawerGeometry.overlayPadding, "0px", `${width}px: desktop edge Drawer overlay retains an outer gap`);
        assert.notEqual(drawerGeometry.radii.topLeft, "0px", `${width}px: desktop Drawer lost its top-left radius`);
        assert.notEqual(drawerGeometry.radii.bottomLeft, "0px", `${width}px: desktop Drawer lost its bottom-left radius`);
        assert.equal(drawerGeometry.radii.topRight, "0px", `${width}px: desktop Drawer top-right corner is rounded`);
        assert.equal(drawerGeometry.radii.bottomRight, "0px", `${width}px: desktop Drawer bottom-right corner is rounded`);
      } else {
        assert.ok(Math.abs(drawerBounds.left) <= 1 && Math.abs(drawerBounds.right - width) <= 1, `${width}px: mobile Drawer does not span the viewport width`);
        assert.ok(drawerBounds.top > 0 && Math.abs(drawerBounds.bottom - height) <= 1, `${width}px: mobile Drawer is not a bottom sheet`);
        assert.notEqual(drawerGeometry.radii.topLeft, "0px", `${width}px: mobile Drawer lost its top-left radius`);
        assert.notEqual(drawerGeometry.radii.topRight, "0px", `${width}px: mobile Drawer lost its top-right radius`);
        assert.equal(drawerGeometry.radii.bottomRight, "0px", `${width}px: mobile Drawer bottom-right corner is rounded`);
        assert.equal(drawerGeometry.radii.bottomLeft, "0px", `${width}px: mobile Drawer bottom-left corner is rounded`);
      }
      assert.ok(await drawer.locator(".pui-drawer__footer").isVisible(), `${width}px: drawer actions clipped`);
      await clickBackdrop(drawer, `${width}px editing drawer`);
      assert.equal(await drawer.isVisible(), true, `${width}px: backdrop closed the Drawer`);
      await drawer.getByRole("button", { name: "关闭抽屉" }).click();
      await drawer.waitFor({ state: "detached" });
      await edit.click();
      await clickBackdrop(drawer, `${width}px reopened editing drawer`);
      assert.equal(await drawer.isVisible(), true, `${width}px: backdrop closed the reopened Drawer`);
      await page.keyboard.press("Escape");
      await drawer.waitFor({ state: "detached" });
      assert.equal(await edit.evaluate((button) => document.activeElement === button), true, `${width}px: drawer failed to restore focus`);
    } finally {
      await page.close();
    }
  }
  console.log("Dialog, ConfirmDialog, MultiSelect, and Drawer browser regression passed at 2560, 1440, 1024, 736, 360, and 320px.");
} finally {
  await browser?.close();
  await server.close();
}
