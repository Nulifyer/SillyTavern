import { test, expect } from '@playwright/test';
import fs from 'node:fs';

test.use({ channel: 'chromium', video: 'off' });
test.setTimeout(60000);

for (const width of [1280, 390]) {
    test(`folder assignment completion preserves an existing keyboard target at ${width}px`, async ({ page }, info) => {
        await page.setViewportSize({ width, height: 844 });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/api/settings/get', async route => {
            const response = await route.fetch(); const body = await response.json(); const settings = JSON.parse(body.settings);
            settings.firstRun = false; settings.active_character = null; settings.active_group = null;
            settings.power_user.auto_connect = false;
            settings.accountStorage = { ...settings.accountStorage, workspaceLayout: 'true', workspaceAdvancedSettings: 'false' };
            settings.extension_settings.tts = { ...settings.extension_settings.tts, enabled: false, currentProvider: 'System' };
            body.settings = JSON.stringify(settings); await route.fulfill({ response, json: body });
        });
        await page.goto('/');
        await expect(page.locator('#preloader')).toHaveCount(0, { timeout: 30000 });
        if (!await page.locator('#workspace-settings-link').isVisible()) await page.locator('#workspace-menu').click();
        await page.locator('#workspace-settings-link').click();
        if (await page.locator('#workspace-settings-category').isVisible()) await page.locator('#workspace-settings-category').selectOption('backgrounds');
        else await page.locator('.workspace-settings-rail [data-workspace-action="backgrounds"]').click();
        const name = `Keyboard assignment ${width} ${Date.now()}`;
        await page.locator('#bg_add_folder_button').click();
        await page.locator('dialog[open] .popup-input').fill(name);
        await page.locator('dialog[open] .popup-button-ok').click();
        const folder = page.locator('#bg_folder_grid .bg_folder_tile').filter({ hasText: name });
        await expect(folder).toBeVisible();
        const tile = page.locator('#bg_menu_content .bg_example[bgfile="_white.jpg"]');
        await tile.scrollIntoViewIfNeeded();
        if (width < 900) await tile.locator('.mobile-only-menu-toggle').click();
        else await tile.focus();
        await tile.locator('[data-action="folder"]').click();
        await page.locator('dialog[open]').getByLabel(name, { exact: true }).check();
        let release, began;
        const held = new Promise(resolve => release = resolve), requested = new Promise(resolve => began = resolve);
        await page.route('**/api/image-metadata/folders/assign', async route => { began(); await held; await route.continue(); });
        try {
            await page.locator('dialog[open] .popup-button-ok').click();
            await requested;
            await expect(page.locator('dialog[open]')).toHaveCount(0);
            await folder.focus();
            await expect(folder).toBeFocused();
            const original = await folder.elementHandle();
            release();
            await expect(page.locator('.toast-message').filter({ hasText: 'Folder assignment updated' })).toBeVisible();
            const state = { sameNode: await folder.evaluate((node, original) => node === original, original), focused: await folder.evaluate(node => node === document.activeElement) };
            fs.writeFileSync(info.outputPath('focus.json'), JSON.stringify(state, null, 2));
            await page.screenshot({ path: info.outputPath('assignment-complete.png') });
            expect(state).toEqual({ sameNode: true, focused: true });
            await page.keyboard.press('Enter');
            await expect(page.locator('#bg_current_folder_name')).toHaveText(name);
            await expect(tile).toBeVisible();
            expect(errors).toEqual([]);
        } finally { release(); await page.unrouteAll({ behavior: 'wait' }); }
    });
}
