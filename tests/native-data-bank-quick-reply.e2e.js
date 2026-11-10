import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { gunzipSync } from 'node:zlib';

test.use({ channel: 'chromium', video: 'off', viewport: { width: 1280, height: 800 } });
test.setTimeout(90000);
test.skip(!process.env.ST_NATIVE_UI_AUDIT, 'Use ST_NATIVE_UI_AUDIT=1 with a fresh synthetic local fixture.');

test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(12000);
    page.nativeDiagnostics = { pageErrors: [], consoleErrors: [], failedRequests: [] };
    page.on('pageerror', error => page.nativeDiagnostics.pageErrors.push(error.stack || error.message));
    page.on('console', message => { if (message.type() === 'error') page.nativeDiagnostics.consoleErrors.push(message.text()); });
    page.on('requestfailed', request => page.nativeDiagnostics.failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
    let first = true;
    await page.route('**/api/settings/get', async route => {
        const response = await route.fetch(); const body = await response.json(); const settings = JSON.parse(body.settings);
        if (first) {
            first = false;
            settings.firstRun = false; settings.active_character = null; settings.active_group = null;
            settings.power_user.auto_connect = false; settings.power_user.font_scale = 1;
            settings.accountStorage = { ...settings.accountStorage, workspaceLayout: 'true', workspaceAdvancedSettings: 'false' };
            settings.extension_settings.serviceConnections = { url: '' };
        }
        body.settings = JSON.stringify(settings); await route.fulfill({ response, json: body });
    });
    await page.goto('/');
    await expect(page.locator('#preloader')).toHaveCount(0, { timeout: 30000 });
    await page.locator('#workspace-navigation [data-workspace-action="characters"]').click();
    await page.locator('.workspace-library-card').first().click();
    await page.getByRole('button', { name: 'Start new story', exact: true }).click();
    await expect(page.locator('#send_textarea')).toBeVisible();
});

test.afterEach(async ({ page }, info) => {
    fs.writeFileSync(info.outputPath('diagnostics.json'), JSON.stringify(page.nativeDiagnostics, null, 2));
    await page.screenshot({ path: info.outputPath('final.png') });
    expect(page.nativeDiagnostics.pageErrors).toEqual([]);
});

async function dataBank(page) {
    const more = page.locator('.workspace-creative-menu');
    if (!await more.evaluate(node => node.open)) await more.locator('summary').click();
    if (await page.locator('#extensionsMenuButton').getAttribute('aria-expanded') !== 'true') await page.locator('#extensionsMenuButton').click();
    await page.locator('#manageAttachments').click();
    const dialog = page.locator('dialog[open]').last();
    await expect(dialog.locator('#attachmentSearch')).toBeVisible();
    return dialog;
}

async function upload(page, name, source = 'global') {
    return page.evaluate(async ({ name, source }) => {
        const url = await (await import('/scripts/chats.js')).uploadFileAttachmentToServer(new File(['An original neutral attachment.'], name, { type: 'text/plain' }), source);
        await (await import('/script.js')).saveSettings();
        return url;
    }, { name, source });
}

async function confirmDelete(page, row) {
    await row.locator('.deleteAttachmentButton').click();
    await page.locator('dialog[open]').last().locator('.popup-button-ok').click();
}

async function quickReplySettings(page) {
    await page.locator('#workspace-settings-link').click();
    if (await page.locator('#workspace-settings-category').isVisible()) await page.locator('#workspace-settings-category').selectOption('extensions');
    else await page.locator('.workspace-settings-rail [data-workspace-action="extensions"]').click();
    await page.locator('#workspace-advanced-settings').check();
    const root = page.locator('#qr--settings');
    if (!await page.locator('#qr--set-new').isVisible()) await root.locator('.inline-drawer-toggle').first().click();
    await expect(page.locator('#qr--set-new')).toBeVisible();
}

async function createSet(page, name) {
    await page.locator('#qr--set-new').click();
    const dialog = page.locator('dialog[open]').last();
    await dialog.locator('.popup-input').fill(name); await dialog.locator('.popup-button-ok').click();
    await expect(page.locator('#qr--set')).toHaveValue(name);
}

async function replies(page, name) {
    return page.evaluate(async name => (await import('/scripts/extensions/quick-reply/src/QuickReplySet.js')).QuickReplySet.get(name).qrList.map(reply => ({ label: reply.label, message: reply.message })), name);
}

test('reopening Data Bank does not multiply drop dialogs or uploads', async ({ page }) => {
    for (const width of [1280, 390, 1280]) {
        await page.setViewportSize({ width, height: 800 });
        const dialog = await dataBank(page); await dialog.locator('.popup-button-ok').click();
        await expect(page.locator('dialog[open]')).toHaveCount(0);
    }
    let uploads = 0;
    page.on('request', request => { if (request.url().endsWith('/api/files/upload')) uploads++; });
    const dialog = await dataBank(page);
    const transfer = await page.evaluateHandle(() => { const value = new DataTransfer(); value.items.add(new File(['A single dropped attachment.'], 'single-drop.txt', { type: 'text/plain' })); return value; });
    await dialog.dispatchEvent('drop', { dataTransfer: transfer });
    await expect(page.locator('dialog[open]')).toHaveCount(2);
    const confirm = page.locator('dialog[open]').last();
    await expect(confirm.locator('.droppedFilesTarget')).toBeVisible();
    await confirm.dispatchEvent('drop', { dataTransfer: transfer });
    await expect(page.locator('dialog[open]')).toHaveCount(2);
    await confirm.locator('.popup-button-ok').click();
    await expect(dialog.locator('.globalAttachmentsList .attachmentListItem').filter({ hasText: 'single-drop.txt' })).toHaveCount(1);
    expect(uploads).toBe(1);
    await dialog.locator('.popup-button-ok').click();
    expect(await page.evaluate(() => [...document.querySelectorAll('.drop_target')].filter(node => node.matches('dialog.popup')).length)).toBe(0);
});

test('failed Data Bank deletion retains its row and disabled state, then retry persists', async ({ page }, info) => {
    const name = `delete-retry-${Date.now()}.txt`;
    const url = await upload(page, name);
    await page.evaluate(async url => { const { extension_settings } = await import('/scripts/extensions.js'); extension_settings.disabled_attachments.push(url); await (await import('/script.js')).saveSettings(); }, url);
    const dialog = await dataBank(page);
    const row = dialog.locator('.globalAttachmentsList .attachmentListItem').filter({ hasText: name });
    await page.route('**/api/files/delete', route => route.fulfill({ status: 503, body: 'Synthetic unavailable storage' }));
    await confirmDelete(page, row);
    await expect(page.locator('.toast-message').filter({ hasText: 'Synthetic unavailable storage' })).toBeVisible();
    await expect(row).toBeVisible(); await expect(row).toHaveClass(/disabled/);
    expect(await page.evaluate(async url => (await import('/scripts/extensions.js')).extension_settings.disabled_attachments.includes(url), url)).toBe(true);
    expect((await page.request.get(url)).ok()).toBe(true);
    await page.unroute('**/api/files/delete');
    await confirmDelete(page, row);
    await expect(row).toHaveCount(0);
    await expect.poll(() => page.evaluate(async url => (await import('/scripts/extensions.js')).extension_settings.attachments.some(attachment => attachment.url === url), url)).toBe(false);
    await page.evaluate(async () => (await import('/script.js')).saveSettings());
    const persisted = await page.evaluate(async url => {
        const script = await import('/script.js');
        const response = await fetch('/api/settings/get', { method: 'POST', headers: script.getRequestHeaders(), body: '{}' });
        const data = await response.json();
        const settings = JSON.parse(data.settings);
        return { deletedURL: url, attachments: settings.extension_settings.attachments, disabled: settings.extension_settings.disabled_attachments };
    }, url);
    fs.writeFileSync(info.outputPath('persisted-after-delete.json'), JSON.stringify(persisted, null, 2));
    expect(persisted.attachments.some(attachment => attachment.url === url)).toBe(false);
    await page.reload(); await expect(page.locator('#preloader')).toHaveCount(0, { timeout: 30000 });
    expect(await page.evaluate(async url => (await import('/scripts/extensions.js')).extension_settings.attachments.some(attachment => attachment.url === url), url)).toBe(false);
});

test('failed replacement upload keeps the original attachment content and row', async ({ page }) => {
    const name = `edit-retry-${Date.now()}.txt`;
    const url = await upload(page, name);
    const dialog = await dataBank(page);
    const row = dialog.locator('.globalAttachmentsList .attachmentListItem').filter({ hasText: name });
    let deletedOriginal = 0;
    page.on('request', request => { if (request.url().endsWith('/api/files/delete') && request.postDataJSON()?.path === url) deletedOriginal++; });
    await row.locator('.editAttachmentButton').click();
    const editor = page.locator('dialog[open]').last();
    await editor.locator('[name="notepadFileContent"]').fill('An edited replacement that cannot upload yet.');
    await page.route('**/api/files/upload', route => route.fulfill({ status: 503, body: 'Synthetic upload failure' }));
    await editor.locator('.popup-button-ok').click();
    await expect(page.locator('.toast-message').filter({ hasText: 'Synthetic upload failure' })).toBeVisible();
    await expect(row).toBeVisible();
    expect(await (await page.request.get(url)).text()).toBe('An original neutral attachment.');
    expect(deletedOriginal).toBe(0);
});

test('Quick Reply clipboard failures and selection changes leave both sets unchanged', async ({ page }) => {
    await quickReplySettings(page);
    const a = `Clipboard A ${Date.now()}`, b = `Clipboard B ${Date.now()}`;
    await createSet(page, a); await createSet(page, b); await page.locator('#qr--set').selectOption(a);
    const originalA = await replies(page, a), originalB = await replies(page, b);
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { readText: async () => { throw new DOMException('Synthetic denied clipboard', 'NotAllowedError'); } } }));
    await page.locator('#qr--set-paste').click();
    await expect(page.locator('.toast-message').filter({ hasText: 'clipboard could not be pasted' })).toBeVisible();
    expect(await replies(page, a)).toEqual(originalA);
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { readText: () => new Promise(resolve => window.__nativeClipboard = resolve) } }));
    await page.locator('#qr--set-paste').click(); await page.locator('#qr--set').selectOption(b);
    await page.evaluate(() => window.__nativeClipboard('A late clipboard value.'));
    await expect(page.locator('.toast-message').filter({ hasText: 'selected Quick Reply set changed' })).toBeVisible();
    expect(await replies(page, a)).toEqual(originalA); expect(await replies(page, b)).toEqual(originalB);
});

test('Quick Reply import reports invalid JSON and retains input on failed save before retry', async ({ page }) => {
    await quickReplySettings(page);
    const name = `Import retry ${Date.now()}`; await createSet(page, name);
    const original = await replies(page, name);
    const invalidPicker = page.waitForEvent('filechooser'); await page.locator('#qr--set-importQr').click();
    const invalid = await invalidPicker; await invalid.setFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{invalid') });
    await expect(page.locator('.toast-message').filter({ hasText: 'could not be imported' })).toBeVisible();
    expect(await replies(page, name)).toEqual(original);
    await expect.poll(() => invalid.element().inputValue()).not.toBe('');
    await page.route('**/api/quick-replies/save', route => route.fulfill({ status: 503, json: { error: 'Synthetic save failure' } }));
    const picker = page.waitForEvent('filechooser'); await page.locator('#qr--set-importQr').click(); const failed = await picker;
    const file = { name: 'neutral.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ label: 'Imported neutral reply', message: 'A neutral lantern.' })) };
    await failed.setFiles(file);
    await expect(page.locator('.toast-message').filter({ hasText: 'set could not be saved' })).toBeVisible();
    await expect.poll(() => replies(page, name)).toEqual(original);
    await expect.poll(() => failed.element().inputValue()).not.toBe('');
    await page.unroute('**/api/quick-replies/save');
    const retryPicker = page.waitForEvent('filechooser'); await page.locator('#qr--set-importQr').click(); const retry = await retryPicker; await retry.setFiles(file);
    await expect.poll(() => replies(page, name)).toEqual([...original, { label: 'Imported neutral reply', message: 'A neutral lantern.' }]);
    await expect.poll(() => retry.element().inputValue()).toBe('');
});

test('an older held native settings save cannot resurrect a confirmed deleted attachment', async ({ page }, info) => {
    const url = await upload(page, `save-order-${Date.now()}.txt`);
    const dialog = await dataBank(page);
    const row = dialog.locator(`.globalAttachmentsList .attachmentListItem[data-attachment-url="${url}"]`);
    const trace = [];
    let releaseOld, oldReady, newSaved;
    const oldGate = new Promise(resolve => releaseOld = resolve);
    const oldRequested = new Promise(resolve => oldReady = resolve);
    const newerCommitted = new Promise(resolve => newSaved = resolve);
    let held = false;
    await page.route('**/api/settings/save', async route => {
        const request = route.request();
        const raw = request.postDataBuffer();
        const bytes = request.headers()['content-encoding'] === 'gzip' ? gunzipSync(raw) : raw;
        const payload = JSON.parse(bytes.toString());
        const contains = payload.extension_settings.attachments.some(attachment => attachment.url === url);
        const receipt = { containsDeletedURL: contains, requestedAt: Date.now() }; trace.push(receipt);
        if (contains && !held) { held = true; oldReady(); await oldGate; }
        const response = await route.fetch();
        receipt.completedAt = Date.now(); receipt.status = response.status();
        if (!contains && response.ok()) newSaved();
        await route.fulfill({ response });
    });
    await page.evaluate(() => { void import('/script.js').then(script => { window.__olderNativeSave = script.saveSettings(); }); });
    await oldRequested;
    let persisted;
    try {
        await confirmDelete(page, row);
        await expect.poll(() => page.evaluate(async url => (await import('/scripts/extensions.js')).extension_settings.attachments.some(attachment => attachment.url === url), url)).toBe(false);
        await page.evaluate(() => { void import('/script.js').then(script => { window.__newerNativeSave = script.saveSettings(); }); });
        // Let an incorrectly parallel newer POST finish before releasing the
        // older request. A serialized owner waits for the older request instead.
        await Promise.race([newerCommitted, new Promise(resolve => setTimeout(resolve, 700))]);
        releaseOld();
        await page.evaluate(async () => { await window.__olderNativeSave; await window.__newerNativeSave; });
        persisted = await page.evaluate(async url => {
            const script = await import('/script.js');
            const response = await fetch('/api/settings/get', { method: 'POST', headers: script.getRequestHeaders(), body: '{}' });
            const data = await response.json();
            return JSON.parse(data.settings).extension_settings.attachments.some(attachment => attachment.url === url);
        }, url);
        expect(persisted).toBe(false);
    } finally {
        releaseOld();
        // A debounced native save can follow the two explicit saves. Let real
        // route callbacks finish before closing this browser context.
        await page.unrouteAll({ behavior: 'wait' });
        fs.writeFileSync(info.outputPath('settings-save-order.json'), JSON.stringify({ trace, containsAfterAllAcknowledgements: persisted }, null, 2));
    }
});

test('a settings notification can await another native save without deadlocking the persistence owner', async ({ page }) => {
    const result = await page.evaluate(async () => {
        const script = await import('/script.js'); const { power_user } = await import('/scripts/power-user.js');
        let notified = false, nested = false;
        const listener = async () => {
            if (notified) return;
            notified = true; power_user.restore_user_input = true;
            nested = await script.saveSettings();
        };
        power_user.restore_user_input = false;
        script.eventSource.on(script.event_types.SETTINGS_UPDATED, listener);
        try {
            const saved = await Promise.race([script.saveSettings(), new Promise((resolve, reject) => setTimeout(() => reject(new Error('Native save notification deadlocked')), 6000))]);
            return { saved, notified, nested };
        } finally { script.eventSource.removeListener(script.event_types.SETTINGS_UPDATED, listener); }
    });
    expect(result).toEqual({ saved: true, notified: true, nested: true });
});

test('a failed native settings write does not block the next queued write', async ({ page }) => {
    let requests = 0;
    await page.route('**/api/settings/save', async route => {
        if (++requests === 1) await route.fulfill({ status: 503, json: { error: 'Synthetic settings storage failure' } });
        else await route.continue();
    });
    const result = await page.evaluate(async () => {
        const script = await import('/script.js'); const { power_user } = await import('/scripts/power-user.js');
        power_user.restore_user_input = false; const failed = script.saveSettings();
        power_user.restore_user_input = true; const next = script.saveSettings();
        return Promise.all([failed, next]);
    });
    expect(result).toEqual([false, true]);
    const persisted = await page.evaluate(async () => {
        const script = await import('/script.js'); const response = await fetch('/api/settings/get', { method: 'POST', headers: script.getRequestHeaders(), body: '{}' });
        return JSON.parse((await response.json()).settings).power_user.restore_user_input;
    });
    expect(persisted).toBe(true);
});
