import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const kitRoot = fileURLToPath(new URL("../assets/react-kit/", import.meta.url));
const kitRequire = createRequire(new URL("../assets/react-kit/package.json", import.meta.url));
const { createServer } = await import(pathToFileURL(kitRequire.resolve("vite")).href);
const { chromium } = createRequire(import.meta.url)(process.env.PERSONAL_UI_PLAYWRIGHT_MODULE || "playwright");
const server = await createServer({ root: kitRoot, server: { host: "127.0.0.1", port: 0 } });
let browser;

async function checkPopover(page, panel, popup, label) {
  await popup.waitFor({ state: 'visible' });
  await page.locator('.pui-async-select__popover[data-positioned="true"]').waitFor();
  const measured = await popup.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const list = element.querySelector('.pui-async-select__list');
    const listBounds = list.getBoundingClientRect();
    const footer = element.querySelector('.pui-async-select__footer');
    const footerBounds = footer?.getBoundingClientRect();
    const hit = document.elementFromPoint(
      Math.min(innerWidth - 1, bounds.left + bounds.width / 2),
      Math.min(innerHeight - 1, bounds.top + 20),
    );
    return {
      portalOutsidePanel: !element.closest('.pui-dialog__panel, .pui-drawer__panel'),
      visible: getComputedStyle(element).visibility === 'visible',
      hit: !!hit && element.contains(hit),
      bounds: { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom },
      listHeight: listBounds.height,
      footerBounds: footerBounds ? { top: footerBounds.top, bottom: footerBounds.bottom } : null,
      viewport: { width: document.documentElement.clientWidth, height: document.documentElement.clientHeight },
      documentWidth: document.documentElement.scrollWidth,
    };
  });
  assert.ok(measured.portalOutsidePanel && measured.visible && measured.hit, `${label}: popup clipped or covered`);
  assert.ok(measured.bounds.left >= 11 && measured.bounds.right <= measured.viewport.width - 11, `${label}: horizontal clipping ${JSON.stringify(measured.bounds)}`);
  assert.ok(measured.bounds.top >= 11 && measured.bounds.bottom <= measured.viewport.height - 11, `${label}: vertical clipping ${JSON.stringify(measured.bounds)}`);
  assert.ok(measured.listHeight >= 70, `${label}: list has no useful vertical space`);
  assert.ok(measured.footerBounds && measured.footerBounds.top >= measured.bounds.top && measured.footerBounds.bottom <= measured.bounds.bottom + 1, `${label}: load-more footer clipped`);
  assert.ok(measured.documentWidth <= measured.viewport.width, `${label}: document horizontal overflow`);
  assert.equal(await panel.locator('.pui-async-select__popover').count(), 0, `${label}: popup remained inside overlay scroll body`);
  return measured;
}

async function exercise(page, panel, ariaLabel, label) {
  const trigger = panel.getByRole('combobox', { name: ariaLabel });
  const footer = panel.locator('.pui-dialog__footer, .pui-drawer__footer');
  const footerBefore = await footer.boundingBox();
  await trigger.click();
  const popup = page.locator('.pui-async-select__popover');
  await popup.waitFor();
  const list = popup.getByRole('listbox', { name: ariaLabel });
  assert.equal(await list.getByRole('option').count(), 6, `${label}: initial page mismatch`);
  await page.waitForFunction((name) => document.activeElement?.getAttribute('aria-label') === name, `搜索${ariaLabel}`, { timeout: 1200 });
  const measured = await checkPopover(page, panel, popup, label);
  if (label === '1440px Dialog') {
    const anchor = await trigger.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return { bottom: bounds.bottom, roomBelow: document.documentElement.clientHeight - 12 - bounds.bottom - 6 };
    });
    // Leave enough space for a useful option list, even when control height or modal spacing changes.
    assert.ok(anchor.roomBelow >= 220, `${label}: fixture no longer exercises a useful below-trigger popup (${anchor.roomBelow}px)`);
    assert.equal(await popup.getAttribute('data-vertical-align'), 'bottom', `${label}: popup flipped over header despite ${anchor.roomBelow}px below`);
    assert.ok(measured.bounds.top >= anchor.bottom + 5, `${label}: popup covers its trigger instead of opening below it`);
  }
  const loadMore = popup.getByRole('button', { name: '加载更多' });
  await loadMore.click();
  assert.equal(await popup.locator('.pui-async-select__footer .pui-button').getAttribute('data-loading'), 'true', `${label}: load-more button lacks loading state`);
  await list.getByRole('option').nth(11).waitFor();
  assert.equal(await loadMore.count(), 0, `${label}: load-more footer stayed after final page`);
  assert.equal(await list.getByRole('option').count(), 12, `${label}: load-more options missing`);
  const footerAfter = await footer.boundingBox();
  assert.ok(Math.abs(footerBefore.y - footerAfter.y) <= 1, `${label}: overlay footer shifted after opening popup`);

  await list.getByRole('option', { name: /意大利/ }).click();
  await popup.waitFor({ state: 'detached' });
  assert.ok((await trigger.textContent())?.includes('意大利'), `${label}: loaded-more selection not reflected in trigger`);
  await trigger.click();
  await popup.waitFor({ state: 'visible' });

  const search = popup.getByRole('searchbox', { name: `搜索${ariaLabel}` });
  await search.fill('日本');
  await list.getByText('正在加载').waitFor();
  try {
    await list.getByRole('option', { name: /日本/ }).waitFor({ timeout: 2500 });
  } catch (cause) {
    console.error(`${label} search diagnostics:`, await page.evaluate(() => ({
      popups: [...document.querySelectorAll('.pui-async-select__popover')].map((popup) => popup.textContent?.trim()),
      active: document.activeElement?.outerHTML,
      dialogs: [...document.querySelectorAll('[role="dialog"]')].map((dialog) => dialog.getAttribute('aria-label')),
    })));
    throw cause;
  }
  assert.equal(await list.getByRole('option').count(), 1, `${label}: query did not filter`);
  assert.ok((await trigger.textContent())?.includes('意大利'), `${label}: selected label vanished when server results replaced options`);
  await list.getByRole('option', { name: /日本/ }).click();
  await popup.waitFor({ state: 'detached' });
  assert.ok((await trigger.textContent())?.includes('日本'), `${label}: selection not reflected in trigger`);
  assert.equal(await panel.isVisible(), true, `${label}: choosing option closed parent overlay`);

  await trigger.click();
  await popup.waitFor();
  await popup.getByRole('searchbox', { name: `搜索${ariaLabel}` }).fill('异常');
  await popup.getByRole('alert').waitFor();
  assert.ok((await popup.getByRole('alert').textContent())?.includes('国家目录加载失败'), `${label}: error state missing`);
  const retry = popup.getByRole('button', { name: '重试' });
  await retry.click();
  assert.equal(await popup.locator('.pui-extra-error .pui-button').getAttribute('data-loading'), 'true', `${label}: retry button lacks loading state`);
  await list.getByRole('option').nth(5).waitFor();
  assert.equal(await popup.getByRole('alert').count(), 0, `${label}: retry did not clear error`);
  await checkPopover(page, panel, popup, `${label} after retry`);
  await popup.getByRole('searchbox', { name: `搜索${ariaLabel}` }).press('Escape');
  await popup.waitFor({ state: 'detached' });
  assert.equal(await panel.isVisible(), true, `${label}: Escape closed parent overlay`);
  assert.equal(await trigger.evaluate((button) => document.activeElement === button), true, `${label}: Escape did not return focus to trigger`);
  return measured;
}

async function checkMenu(page, menu, label) {
  await menu.waitFor({ state: 'visible' });
  const geometry = await menu.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const hit = document.elementFromPoint(Math.min(innerWidth - 1, box.left + box.width / 2), Math.min(innerHeight - 1, box.top + 20));
    return { portal: element.parentElement?.matches('.pui-overlay'), hit: !!hit && element.contains(hit), left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: document.documentElement.clientWidth, height: document.documentElement.clientHeight };
  });
  assert.ok(geometry.portal && geometry.hit, `${label}: menu is clipped or covered`);
  assert.ok(geometry.left >= 11 && geometry.right <= geometry.width - 11 && geometry.top >= 11 && geometry.bottom <= geometry.height - 11, `${label}: menu escaped viewport ${JSON.stringify(geometry)}`);
  assert.ok(await menu.getByRole('menuitem').first().isVisible(), `${label}: first action not visible`);
}

async function checkSelectorPopup(page, popup, label) {
  await popup.waitFor({ state: 'visible' });
  const geometry = await popup.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const hit = document.elementFromPoint(Math.min(innerWidth - 1, box.left + box.width / 2), Math.min(innerHeight - 1, box.top + 20));
    return { portal: element.parentElement?.matches('.pui-overlay'), positioned: element.dataset.positioned, hit: !!hit && element.contains(hit), left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: document.documentElement.clientWidth, height: document.documentElement.clientHeight };
  });
  assert.ok(geometry.portal && geometry.positioned === 'true' && geometry.hit, `${label}: selector popup clipped or covered ${JSON.stringify(geometry)}`);
  assert.ok(geometry.left >= 11 && geometry.right <= geometry.width - 11 && geometry.top >= 11 && geometry.bottom <= geometry.height - 11, `${label}: selector popup escaped viewport ${JSON.stringify(geometry)}`);
}

try {
  await server.listen();
  const url = server.resolvedUrls?.local?.[0];
  assert.ok(url, 'Vite did not expose a local URL');
  browser = await chromium.launch({ headless: true, ...(process.env.PERSONAL_UI_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PERSONAL_UI_CHROMIUM_EXECUTABLE } : {}) });
  for (const width of [2560, 1440, 1024, 736, 360, 320]) {
    const height = width <= 360 ? 640 : 900;
    const page = await browser.newPage({ viewport: { width, height } });
    try {
      await page.goto(url);
      await page.getByRole('tab', { name: '弹窗' }).click();
      await page.getByRole('button', { name: '分配角色' }).click();
      const dialog = page.getByRole('dialog', { name: '分配角色 · xtn' });
      const dialogGeometry = await exercise(page, dialog, '国家或地区', `${width}px Dialog`);
      await dialog.getByRole('button', { name: '角色操作菜单' }).click();
      const dropdown = page.getByRole('menu', { name: '角色操作菜单' });
      await checkMenu(page, dropdown, `${width}px DropdownMenu`);
      if (process.env.PERSONAL_UI_ASYNC_SCREENSHOT_PREFIX && (width === 1440 || width === 320)) {
        await page.screenshot({ path: `${process.env.PERSONAL_UI_ASYNC_SCREENSHOT_PREFIX}-menu-${width}.png` });
      }
      assert.equal(await dropdown.getByRole('menuitem', { name: '查看角色记录' }).evaluate((item) => document.activeElement === item), true, `${width}px: DropdownMenu did not focus first item`);
      await page.keyboard.press('ArrowDown');
      assert.equal(await dropdown.getByRole('menuitem', { name: '导出角色列表' }).evaluate((item) => document.activeElement === item), true, `${width}px: DropdownMenu arrow navigation failed`);
      await page.keyboard.press('Escape');
      await dropdown.waitFor({ state: 'detached' });
      assert.equal(await dialog.isVisible(), true, `${width}px: menu Escape closed parent Dialog`);
      await dialog.getByRole('button', { name: '角色操作菜单' }).click();
      await dropdown.waitFor();
      await dialog.getByRole('combobox', { name: /角色，已选择/ }).click();
      await dropdown.waitFor({ state: 'detached' });
      await page.keyboard.press('Escape');
      const priorFocus = dialog.getByRole('button', { name: '角色操作菜单' });
      await priorFocus.focus();
      await dialog.locator('.demo-context-target').click({ button: 'right' });
      const context = page.getByRole('menu', { name: '角色右键菜单' });
      await checkMenu(page, context, `${width}px ContextMenu`);
      if (process.env.PERSONAL_UI_ASYNC_SCREENSHOT_PREFIX && (width === 1440 || width === 320)) {
        await page.screenshot({ path: `${process.env.PERSONAL_UI_ASYNC_SCREENSHOT_PREFIX}-context-${width}.png` });
      }
      assert.equal(await context.getByRole('menuitem', { name: '查看权限详情' }).evaluate((item) => document.activeElement === item), true, `${width}px: ContextMenu did not retain keyboard focus`);
      await page.keyboard.press('Escape');
      await context.waitFor({ state: 'detached' });
      assert.equal(await dialog.isVisible(), true, `${width}px: context menu Escape closed parent Dialog`);
      assert.equal(await priorFocus.evaluate((button) => document.activeElement === button), true, `${width}px: context menu Escape did not restore previous focus`);
      await dialog.locator('.demo-context-target').click({ button: 'right' });
      await context.getByRole('menuitem', { name: '查看权限详情' }).click();
      await context.waitFor({ state: 'detached' });
      assert.equal(await priorFocus.evaluate((button) => document.activeElement === button), true, `${width}px: context menu selection did not restore previous focus`);
      await dialog.locator('.demo-context-target').click({ button: 'right' });
      await context.waitFor();
      await priorFocus.click();
      await context.waitFor({ state: 'detached' });
      await dropdown.waitFor({ state: 'visible' });
      assert.equal(await dropdown.getByRole('menuitem', { name: '查看角色记录' }).evaluate((item) => document.activeElement === item), true, `${width}px: outside pointer dismissal stole focus from the newly opened dropdown`);
      await page.keyboard.press('Escape');
      await dropdown.waitFor({ state: 'detached' });
      if (process.env.PERSONAL_UI_ASYNC_SCREENSHOT_PREFIX && (width === 1440 || width === 320)) {
        await dialog.getByRole('combobox', { name: '国家或地区' }).click();
        await page.locator('.pui-async-select__popover[data-positioned="true"]').waitFor();
        await page.screenshot({ path: `${process.env.PERSONAL_UI_ASYNC_SCREENSHOT_PREFIX}-dialog-${width}.png` });
        await page.keyboard.press('Escape');
      }
      await dialog.getByRole('combobox', { name: '国家或地区' }).click();
      const parentPopup = page.locator('.pui-async-select__popover');
      await parentPopup.waitFor({ state: 'visible' });
      await dialog.getByRole('button', { name: '上层确认' }).evaluate((button) => button.click());
      const nested = page.getByRole('dialog', { name: '确认国家范围' });
      await nested.waitFor();
      const covered = await page.evaluate(() => {
        const popupElement = document.querySelector('.pui-async-select__popover');
        if (!popupElement) return true;
        const box = popupElement.getBoundingClientRect();
        const hit = document.elementFromPoint(box.left + box.width / 2, box.top + 20);
        return !popupElement.contains(hit);
      });
      assert.equal(covered, true, `${width}px: parent popup paints over nested dialog`);
      await nested.getByRole('button', { name: '完成' }).click();
      await nested.waitFor({ state: 'detached' });
      if (!(await parentPopup.isVisible().catch(() => false))) await dialog.getByRole('combobox', { name: '国家或地区' }).click();
      await parentPopup.waitFor({ state: 'visible' });
      await parentPopup.getByRole('searchbox', { name: '搜索国家或地区' }).fill('中国');
      await parentPopup.getByRole('option', { name: /中国/ }).waitFor();
      await page.keyboard.press('Escape');
      await dialog.getByRole('button', { name: '取消' }).click();
      await dialog.waitFor({ state: 'detached' });

      await page.getByRole('button', { name: '更多选择器' }).click();
      const selectorDialog = page.getByRole('dialog', { name: '更多选择器' });
      const autocomplete = selectorDialog.getByRole('combobox', { name: '团队搜索' });
      await autocomplete.fill('平台');
      const autoPopup = page.getByRole('listbox', { name: '团队搜索' });
      await checkSelectorPopup(page, autoPopup, `${width}px Autocomplete`);
      await autoPopup.getByRole('option', { name: /平台工程/ }).click();
      await autoPopup.waitFor({ state: 'detached' });
      assert.equal(await selectorDialog.isVisible(), true, `${width}px: Autocomplete selection closed parent`);
      const tagInput = selectorDialog.getByRole('combobox', { name: '权限标签' });
      await tagInput.fill('平');
      const tagPopup = page.getByRole('listbox', { name: '标签建议' });
      await checkSelectorPopup(page, tagPopup, `${width}px TagInput`);
      await tagPopup.getByRole('option', { name: '平台' }).click();
      await tagPopup.waitFor({ state: 'detached' });
      assert.ok((await selectorDialog.textContent())?.includes('平台'), `${width}px: TagInput selection missing`);
      await selectorDialog.getByRole('combobox', { name: '组织节点' }).click();
      const tree = page.getByRole('tree', { name: '组织节点' });
      await checkSelectorPopup(page, tree, `${width}px TreeSelect`);
      await tree.getByRole('button', { name: '展开总部' }).click();
      await tree.getByRole('treeitem', { name: '产品组' }).click();
      await tree.waitFor({ state: 'detached' });
      assert.equal(await selectorDialog.isVisible(), true, `${width}px: TreeSelect selection closed parent`);
      const external = selectorDialog.getByRole('combobox', { name: '外部选中项' });
      assert.ok((await external.textContent())?.includes('意大利'), `${width}px: external off-page selectedOption label missing`);
      await selectorDialog.getByRole('button', { name: '切换外部国家值' }).click();
      assert.ok((await external.textContent())?.includes('选择国家或地区'), `${width}px: stale selectedOption reused for a different unknown value`);
      await selectorDialog.getByRole('button', { name: '完成' }).click();
      await selectorDialog.waitFor({ state: 'detached' });

      await page.getByRole('tab', { name: '用户权限' }).click();
      const edit = page.getByRole('button', { name: '编辑陈沐' });
      await edit.click();
      const drawer = page.getByRole('dialog', { name: '编辑陈沐的权限' });
      const drawerGeometry = await exercise(page, drawer, '所属国家或地区', `${width}px Drawer`);
      if (process.env.PERSONAL_UI_ASYNC_SCREENSHOT_PREFIX && (width === 1440 || width === 320)) {
        await drawer.getByRole('combobox', { name: '所属国家或地区' }).click();
        await page.locator('.pui-async-select__popover[data-positioned="true"]').waitFor();
        await page.screenshot({ path: `${process.env.PERSONAL_UI_ASYNC_SCREENSHOT_PREFIX}-drawer-${width}.png` });
        await page.keyboard.press('Escape');
      }
      await page.keyboard.press('Escape');
      await drawer.waitFor({ state: 'detached' });
      assert.equal(await edit.evaluate((button) => document.activeElement === button), true, `${width}px: drawer opener focus not restored`);
      if (width === 1440 || width === 320) console.log(`${width}px Dialog popup: ${JSON.stringify(dialogGeometry.bounds)}; Drawer popup: ${JSON.stringify(drawerGeometry.bounds)}`);
    } finally {
      await page.close();
    }
  }
  console.log('AsyncSelect Dialog/Drawer browser regression passed at 2560, 1440, 1024, 736, 360, and 320px.');
} finally {
  await browser?.close();
  await server.close();
}
