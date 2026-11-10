import { test, expect } from '@playwright/test';
import fs from 'node:fs';

test.use({ channel: 'chromium', video: 'off', viewport: { width: 1280, height: 800 } });
test.setTimeout(60000);

test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(12000);
    page.nativeDiagnostics = { pageErrors: [], consoleErrors: [] };
    page.on('pageerror', error => page.nativeDiagnostics.pageErrors.push(error.stack || error.message));
    page.on('console', message => { if (message.type() === 'error') page.nativeDiagnostics.consoleErrors.push(message.text()); });
    await page.route('**/api/settings/get', async route => {
        const response = await route.fetch(); const body = await response.json(); const settings = JSON.parse(body.settings);
        settings.firstRun = false; settings.active_character = null; settings.active_group = null;
        settings.main_api = 'openai'; settings.power_user.auto_connect = false; settings.power_user.font_scale = 1; settings.power_user.reduced_motion = false; settings.power_user.waifuMode = false;
        settings.extension_settings.expressions = { ...settings.extension_settings.expressions, api: 99, showDefault: false, fallback_expression: null, allowMultiple: false, custom: [] };
        settings.accountStorage = { ...settings.accountStorage, workspaceLayout: 'false', workspaceAdvancedSettings: 'false', workspaceArchivedChats: '[]' };
        settings.extension_settings.tts = { ...settings.extension_settings.tts, enabled: false, currentProvider: 'System' };
        settings.extension_settings.serviceConnections = { url: '' };
        body.settings = JSON.stringify(settings); await route.fulfill({ response, json: body });
    });
    await page.route('**/api/settings/save', route => route.fulfill({ json: { result: 'ok' } }));
    await page.route('**/api/sprites/get?**', route => route.fulfill({ json: [{ label: 'joy', path: '/synthetic-expressions/joy.png' }, { label: 'grief', path: '/synthetic-expressions/grief.png' }] }));
    await page.route('**/synthetic-expressions/*.png', route => route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZ1kAAAAASUVORK5CYII=', 'base64') }));
    await page.goto('/');
    await expect(page.locator('#preloader')).toHaveCount(0, { timeout: 30000 });
    await page.evaluate(async () => { const s = await import('/script.js'); await s.selectCharacterById(String(s.characters.findIndex(card => card.avatar === 'default_Seraphina.png'))); });
    await expect(page.locator('#image_list .expression_list_item[data-expression="joy"][data-expression-type="success"]')).toHaveCount(1);
    await page.locator('#extensions-settings-button > .drawer-toggle').click();
    await page.locator('.expression_settings > .inline-drawer > .inline-drawer-toggle').click();
});

test.afterEach(async ({ page }, info) => {
    fs.writeFileSync(info.outputPath('diagnostics.json'), JSON.stringify(page.nativeDiagnostics, null, 2));
    await page.screenshot({ path: info.outputPath('final.png') });
    expect(page.nativeDiagnostics.pageErrors).toEqual([]);
});

const expression = (page, label) => page.locator(`#image_list .expression_list_item[data-expression="${label}"][data-expression-type="success"]`);

test('a second sprite click during an active transition becomes the final displayed expression', async ({ page }) => {
    await page.evaluate(async () => { window.$.fx.off = false; await (await import('/scripts/extensions/expressions/index.js')).sendExpressionCall('Seraphina', '#reset'); });
    await expect(page.locator('#expression-holder img').first()).toHaveAttribute('src', '');
    await expression(page, 'joy').click();
    await expect(page.locator('#expression-holder img[data-expression="joy"].expression-animating')).toHaveCount(1);
    await expression(page, 'grief').click();
    await expect(page.locator('#expression-holder img[data-expression="grief"]:not(.expression-animating)')).toHaveCount(1);
    await expect(page.locator('#expression-holder img')).toHaveCount(1);
    await expect(page.locator('#expression-holder img')).toHaveAttribute('data-expression', 'grief');
    await expect(page.locator('#expression-holder img')).toHaveAttribute('src', '/synthetic-expressions/grief.png');
});

test('a failed sprite deletion leaves its row available and reports the failure', async ({ page }) => {
    await page.route('**/api/sprites/delete', route => route.fulfill({ status: 503, json: { error: 'Synthetic unavailable storage' } }));
    await expression(page, 'joy').locator('.expression_list_delete').click();
    await page.locator('dialog[open] .popup-button-ok').click();
    await expect(page.locator('.toast-error')).toContainText('Failed to delete image');
    await expect(expression(page, 'joy')).toHaveCount(1);
});

test('a sprite confirmation deletes the original folder and does not refresh a newer folder', async ({ page }) => {
    const requests = [];
    await page.route('**/api/sprites/delete', async route => { requests.push(route.request().postDataJSON()); await route.fulfill({ json: {} }); });
    await expression(page, 'joy').locator('.expression_list_delete').click();
    await expect(page.locator('dialog[open]')).toContainText('Delete Expression');
    await page.evaluate(() => window.$('#image_list').data('name', 'Newer synthetic folder'));
    await page.locator('dialog[open] .popup-button-ok').click();
    await expect.poll(() => requests.length).toBe(1);
    expect(requests[0]).toEqual({ name: 'Seraphina', label: 'joy', spriteName: 'joy' });
    expect(await page.locator('#image_list').evaluate(node => window.$(node).data('name'))).toBe('Newer synthetic folder');
});
