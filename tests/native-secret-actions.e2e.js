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
        settings.main_api = 'openai'; settings.power_user.auto_connect = false; settings.power_user.font_scale = 1;
        settings.accountStorage = { ...settings.accountStorage, workspaceLayout: 'true', workspaceAdvancedSettings: 'false', workspaceArchivedChats: '[]' };
        settings.extension_settings.tts = { ...settings.extension_settings.tts, enabled: false, currentProvider: 'System' };
        settings.extension_settings.serviceConnections = { url: '' };
        body.settings = JSON.stringify(settings); await route.fulfill({ response, json: body });
    });
    await page.route('**/api/secrets/read', route => route.fulfill({ json: {} }));
    await page.route('**/api/settings/save', route => route.fulfill({ json: { result: 'ok' } }));
    await page.goto('/');
    await expect(page.locator('#preloader')).toHaveCount(0, { timeout: 30000 });
});

test.afterEach(async ({ page }, info) => {
    fs.writeFileSync(info.outputPath('diagnostics.json'), JSON.stringify(page.nativeDiagnostics, null, 2));
    await page.screenshot({ path: info.outputPath('final.png') });
    expect(page.nativeDiagnostics.pageErrors).toEqual([]);
});

async function command(page, text) {
    return page.evaluate(async text => (await (await import('/scripts/slash-commands.js')).executeSlashCommandsWithOptions(text)).pipe, text);
}

test('an explicit unknown secret ID cannot read, rename or delete the active key', async ({ page }) => {
    const mutations = [];
    await page.route('**/api/secrets/read', route => route.fulfill({ json: { api_key_custom: [{ id: 'synthetic-active-id', label: 'Synthetic key', active: true, value: 'masked' }] } }));
    await page.route(/\/api\/secrets\/(delete|rename|find)$/, route => { mutations.push(route.request().url()); return route.fulfill({ json: {} }); });
    await page.evaluate(async () => (await import('/scripts/secrets.js')).readSecretState());
    for (const text of ['/secret-delete key=api_key_custom missing-id', '/secret-rename key=api_key_custom id=missing-id New label', '/secret-read key=api_key_custom missing-id']) {
        expect(await command(page, text)).toBe('');
    }
    expect(mutations).toEqual([]);
    await expect(page.locator('.toast-message').filter({ hasText: 'No secret found' })).toHaveCount(3);
});

test('the first secret can be saved and a failed retry cannot report success', async ({ page }) => {
    let writes = 0;
    await page.route('**/api/secrets/write', route => ++writes === 1 ? route.fulfill({ json: { id: 'synthetic-first-id' } }) : route.fulfill({ status: 503, json: { error: 'Synthetic unavailable storage' } }));
    expect(await command(page, '/secret-write key=api_key_custom label=Synthetic synthetic-value')).toBe('synthetic-first-id');
    await page.locator('#toast-container').evaluate(node => node.remove());
    expect(await command(page, '/secret-write key=api_key_custom label=Retry synthetic-value')).toBe('');
    await expect(page.locator('.toast-message')).toContainText('could not be saved');
    await expect(page.locator('.toast-success')).toHaveCount(0);
});

test('failed native delete and rename commands preserve the active key and avoid success messages', async ({ page }) => {
    await page.route('**/api/secrets/read', route => route.fulfill({ json: { api_key_custom: [{ id: 'synthetic-active-id', label: 'Synthetic key', active: true, value: 'masked' }] } }));
    await page.evaluate(async () => (await import('/scripts/secrets.js')).readSecretState());
    await page.route(/\/api\/secrets\/(delete|rename)$/, route => route.fulfill({ status: 503, json: { error: 'Synthetic unavailable storage' } }));
    expect(await command(page, '/secret-delete key=api_key_custom synthetic-active-id')).toBe('');
    expect(await command(page, '/secret-rename key=api_key_custom id=synthetic-active-id New label')).toBe('');
    await expect(page.locator('.toast-success')).toHaveCount(0);
    expect(await page.evaluate(async () => (await import('/scripts/secrets.js')).secret_state.api_key_custom[0].id)).toBe('synthetic-active-id');
});

test('a held secret save preserves a newer typed draft including an identical replacement', async ({ page }) => {
    let release, began;
    const gate = new Promise(resolve => release = resolve), requested = new Promise(resolve => began = resolve);
    await page.route('**/api/secrets/write', async route => { began(); await gate; await route.fulfill({ json: { id: 'synthetic-saved-id' } }); });
    await page.evaluate(async () => {
        const input = document.querySelector('#api_key_openai'); input.value = 'synthetic-original'; input.dispatchEvent(new Event('input', { bubbles: true }));
        window.__heldSecretWrite = (await import('/scripts/secrets.js')).writeSecret('api_key_openai', input.value, 'Synthetic');
    });
    await requested;
    await page.locator('#api_key_openai').evaluate(input => {
        for (const value of ['synthetic-newer', 'synthetic-original']) { input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); }
    });
    release();
    expect(await page.evaluate(() => window.__heldSecretWrite)).toBe('synthetic-saved-id');
    await expect(page.locator('#api_key_openai')).toHaveValue('synthetic-original');
});
