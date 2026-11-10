import { test, expect } from '@playwright/test';
import fs from 'node:fs';

test.use({ channel: 'chromium', video: 'off', viewport: { width: 1280, height: 844 } });
test.setTimeout(60000);

async function held(page, url, response) {
    let release, entered;
    const gate = new Promise(resolve => { release = resolve; });
    const started = new Promise(resolve => { entered = resolve; });
    const requests = [];
    await page.route(url, async route => { requests.push(route.request().postDataJSON()); entered(); await gate; await route.fulfill(response); });
    return { release, started, requests };
}

async function nativeForm(page) {
    await page.evaluate(async () => (await import('/scripts/workspace.js')).openWorkspacePanel('advanced-formatting-button'));
    await expect(page.locator('#AdvancedFormatting')).toBeVisible();
    if (!await page.locator('#workspace-advanced-settings').isChecked()) await page.locator('#workspace-advanced-settings').check();
    await expect(page.locator('#context_presets')).toBeVisible();
}

async function select(page, name) { await page.locator('#context_presets').selectOption(name); }
async function current(page) { return page.evaluate(async () => { const m = (await import('/scripts/preset-manager.js')).getPresetManager('context'); return { selected: m.getSelectedPresetName(), names: m.getAllPresets(), value: (await import('/scripts/power-user.js')).power_user.context.story_string }; }); }

test.beforeEach(async ({ page }) => {
    page.errors = []; page.on('pageerror', error => page.errors.push(error.message));
    await page.route('**/api/settings/get', async route => {
        const response = await route.fetch(), body = await response.json(), settings = JSON.parse(body.settings);
        Object.assign(settings, { firstRun: false, active_character: null, active_group: null, main_api: 'textgenerationwebui' });
        settings.power_user.auto_connect = false;
        settings.accountStorage = { ...settings.accountStorage, workspaceLayout: 'true' };
        settings.extension_settings.tts = { ...settings.extension_settings.tts, enabled: false, currentProvider: 'System' };
        body.settings = JSON.stringify(settings); await route.fulfill({ response, json: body });
    });
    await page.route('**/api/settings/save', route => route.fulfill({ json: { result: 'ok' } }));
    page.saved = []; page.deleted = [];
    await page.route('**/api/presets/save', route => { const body = route.request().postDataJSON(); page.saved.push(body); return route.fulfill({ json: { name: body.name } }); });
    await page.route('**/api/presets/delete', route => { page.deleted.push(route.request().postDataJSON()); return route.fulfill({ json: {} }); });
    await page.goto('/'); await expect(page.locator('#preloader')).toHaveCount(0, { timeout: 30000 });
    await page.evaluate(async () => {
        const manager = (await import('/scripts/preset-manager.js')).getPresetManager('context');
        const base = manager.getPresetSettings(manager.getSelectedPresetName());
        for (const name of ['Lifetime A', 'Lifetime B']) await manager.savePreset(name, { ...structuredClone(base), name, story_string: name });
        await manager.selectPreset('Lifetime A');
    });
    page.saved.length = 0;
});

test.afterEach(async ({ page }, info) => {
    fs.writeFileSync(info.outputPath('page-errors.json'), JSON.stringify(page.errors, null, 2));
    expect(page.errors).toEqual([]);
});

test('native delete keeps failed target visible and permits keyboard retry', async ({ page }) => {
    await nativeForm(page); let failed = true;
    await page.route('**/api/presets/delete', route => { page.deleted.push(route.request().postDataJSON()); return route.fulfill(failed ? { status: 503, json: {} } : { json: {} }); });
    await page.locator('#context_delete_preset').focus(); await page.keyboard.press('Enter');
    await page.locator('dialog[open] .popup-button-ok').click();
    await expect(page.locator('.toast-message').filter({ hasText: /could not be deleted/i })).toBeVisible();
    expect((await current(page)).names).toContain('Lifetime A'); expect((await current(page)).selected).toBe('Lifetime A');
    failed = false;
    await page.locator('#context_delete_preset').click(); await page.locator('dialog[open] .popup-button-ok').click();
    await expect.poll(async () => (await current(page)).names.includes('Lifetime A')).toBe(false);
    expect(page.deleted).toEqual([{ name: 'Lifetime A', apiId: 'context' }, { name: 'Lifetime A', apiId: 'context' }]);
});

test('missing named deletion sends no request and retains unrelated entries', async ({ page }) => {
    const before = await current(page);
    expect(await page.evaluate(async () => (await import('/scripts/preset-manager.js')).getPresetManager('context').deletePreset('absent lifetime target'))).toBe(false);
    expect(await current(page)).toEqual(before); expect(page.deleted).toEqual([]);
});

test('save acknowledgement updates its catalog without selecting over newer selection', async ({ page }) => {
    await nativeForm(page);
    const pending = await held(page, '**/api/presets/save', { json: { name: 'Lifetime A' } });
    try {
        await page.evaluate(async () => { const manager = (await import('/scripts/preset-manager.js')).getPresetManager('context'); window.__presetSave = manager.savePreset('Lifetime A', { ...manager.getPresetSettings('Lifetime A'), story_string: 'accepted A' }); });
        await pending.started; await select(page, 'Lifetime B'); pending.release(); await page.evaluate(() => window.__presetSave);
        expect(await current(page)).toMatchObject({ selected: 'Lifetime B', value: 'Lifetime B' });
        expect(await page.evaluate(async () => (await import('/scripts/preset-manager.js')).getPresetManager('context').presetRecord('Lifetime A').story_string)).toBe('accepted A');
    } finally { pending.release(); }
});

test('pending update preserves a newer editor change on the same selected preset', async ({ page }) => {
    const pending = await held(page, '**/api/presets/save', { json: { name: 'Lifetime A' } });
    try {
        await page.evaluate(async () => { window.__presetSave = (await import('/scripts/preset-manager.js')).getPresetManager('context').updatePreset(); });
        await pending.started;
        await page.evaluate(async () => { const input = document.getElementById('context_story_string'); input.value = 'newer unsaved edit'; input.dispatchEvent(new Event('input', { bubbles: true })); });
        pending.release(); await page.evaluate(() => window.__presetSave);
        expect(await current(page)).toMatchObject({ selected: 'Lifetime A', value: 'newer unsaved edit' });
    } finally { pending.release(); }
});

test('Save As captures settings before its native input dialog awaits', async ({ page }) => {
    await nativeForm(page); await page.locator('[data-preset-manager-new="context"]').click();
    await expect(page.locator('dialog[open] .popup-input')).toBeVisible();
    await page.evaluate(async () => (await import('/scripts/preset-manager.js')).getPresetManager('context').selectPreset('Lifetime B'));
    await page.locator('dialog[open] .popup-input').fill('Lifetime captured copy'); await page.locator('dialog[open] .popup-button-ok').click();
    await expect.poll(() => page.saved.length).toBe(1);
    expect(page.saved[0]).toMatchObject({ name: 'Lifetime captured copy', preset: { story_string: 'Lifetime A' } });
    expect(await current(page)).toMatchObject({ selected: 'Lifetime B', value: 'Lifetime B' });
});

test('delete confirmation is pinned to original target while another preset is selected', async ({ page }) => {
    await nativeForm(page); await page.locator('#context_delete_preset').click();
    await page.evaluate(async () => (await import('/scripts/preset-manager.js')).getPresetManager('context').selectPreset('Lifetime B'));
    await page.locator('dialog[open] .popup-button-ok').click();
    await expect.poll(() => page.deleted.length).toBe(1); expect(page.deleted[0].name).toBe('Lifetime A');
    expect(await current(page)).toMatchObject({ selected: 'Lifetime B', value: 'Lifetime B' });
});

test('rename dialog saves the captured target and preserves a newer selected preset', async ({ page }) => {
    await nativeForm(page); await page.locator('[data-preset-manager-rename="context"]').click();
    await page.evaluate(async () => (await import('/scripts/preset-manager.js')).getPresetManager('context').selectPreset('Lifetime B'));
    await page.locator('dialog[open] .popup-input').fill('Lifetime renamed A'); await page.locator('dialog[open] .popup-button-ok').click();
    await expect.poll(() => page.deleted.length).toBe(1);
    expect(page.saved[0]).toMatchObject({ name: 'Lifetime renamed A', preset: { story_string: 'Lifetime A' } });
    expect(page.deleted[0].name).toBe('Lifetime A'); expect(await current(page)).toMatchObject({ selected: 'Lifetime B', value: 'Lifetime B' });
});

test('failed rename delete retains both acknowledged copies and reports partial result', async ({ page }) => {
    await page.route('**/api/presets/delete', route => route.fulfill({ status: 503, json: {} }));
    const message = await page.evaluate(async () => { try { await (await import('/scripts/preset-manager.js')).getPresetManager('context').renamePreset('Lifetime retained copy'); } catch (error) { return error.message; } });
    expect(message).toMatch(/Both copies have been retained/);
    const state = await current(page); expect(state.names).toEqual(expect.arrayContaining(['Lifetime A', 'Lifetime retained copy', 'Lifetime B'])); expect(state.selected).toBe('Lifetime A');
});

test('restore default overwrites only acknowledged target without delete-first or foreground takeover', async ({ page }) => {
    await nativeForm(page);
    const pending = await held(page, '**/api/presets/restore', { json: { isDefault: true, preset: { name: 'Lifetime A', story_string: 'restored original A' } } });
    try {
        await page.locator('[data-preset-manager-restore="context"]').click(); await pending.started; await select(page, 'Lifetime B'); pending.release();
        await page.locator('dialog[open] .popup-button-ok').click(); await expect.poll(() => page.saved.length).toBe(1);
        expect(page.deleted).toEqual([]); expect(page.saved[0].name).toBe('Lifetime A'); expect(await current(page)).toMatchObject({ selected: 'Lifetime B', value: 'Lifetime B' });
    } finally { pending.release(); }
});

test('same API mutations persist in invocation order without nested notification deadlock', async ({ page }) => {
    const pending = await held(page, '**/api/presets/save', { json: { name: 'Lifetime A' } });
    try {
        await page.evaluate(async () => { const m = (await import('/scripts/preset-manager.js')).getPresetManager('context'); window.__first = m.savePreset('Lifetime A'); window.__second = m.deletePreset('Lifetime A'); });
        await pending.started; await page.waitForTimeout(150); expect(page.deleted).toEqual([]); pending.release();
        expect(await page.evaluate(async () => [await window.__first, await window.__second])).toEqual(['Lifetime A', true]);
        expect((await current(page)).names).not.toContain('Lifetime A');
    } finally { pending.release(); }
});

for (const classes of ['alpha beta', ['alpha', ' beta  gamma ']]) {
    test(`popup custom classes normalize ${JSON.stringify(classes)}`, async ({ page }) => {
        await page.evaluate(async classes => { const { Popup, POPUP_TYPE } = await import('/scripts/popup.js'); window.__popup = new Popup('Class normalization', POPUP_TYPE.TEXT, '', { animation: 'none', customButtons: [{ text: 'Custom action', classes, result: 1001 }] }); window.__shown = window.__popup.show(); }, classes);
        const custom = page.locator('dialog[open] .popup-button-custom'); await expect(custom).toHaveClass(/alpha/); await expect(custom).toHaveClass(/beta/);
        await custom.focus(); await page.keyboard.press('Enter'); expect(await page.evaluate(() => window.__shown)).toBe(1001);
    });
}

test('rejected onClose still removes modal registry and settles original promise', async ({ page }) => {
    const result = await page.evaluate(async () => { const { Popup, POPUP_TYPE } = await import('/scripts/popup.js'); const popup = new Popup('Close failure', POPUP_TYPE.TEXT, '', { animation: 'none', onClose: async () => { throw new Error('Controlled close failure'); } }); const shown = popup.show(); await popup.completeAffirmative(); return { value: await shown, registered: Popup.util.popups.includes(popup), connected: popup.dlg.isConnected }; });
    expect(result).toEqual({ value: 1, registered: false, connected: false });
    await expect(page.locator('.toast-message').filter({ hasText: /dialog action failed/i })).toBeVisible();
});

test('onOpen failure remains visible and closeable without an uncaught promise', async ({ page }) => {
    await page.evaluate(async () => { const { Popup, POPUP_TYPE } = await import('/scripts/popup.js'); window.__popup = new Popup('Open failure', POPUP_TYPE.TEXT, '', { animation: 'none', onOpen: async () => { throw new Error('Controlled open failure'); } }); window.__shown = window.__popup.show(); });
    await expect(page.locator('.toast-message').filter({ hasText: /dialog action failed/i })).toBeVisible();
    await page.locator('dialog[open] .popup-button-ok').click(); expect(await page.evaluate(() => window.__shown)).toBe(1);
});

test('closing error permits retry and only explicit false vetoes closing', async ({ page }) => {
    await page.evaluate(async () => { const { Popup, POPUP_TYPE } = await import('/scripts/popup.js'); let attempts = 0; window.__popup = new Popup('Closing retry', POPUP_TYPE.TEXT, '', { animation: 'none', onClosing: async () => { if (++attempts === 1) throw new Error('Controlled closing failure'); } }); window.__shown = window.__popup.show(); });
    await page.locator('dialog[open] .popup-button-ok').click(); await expect(page.locator('dialog[open]')).toHaveCount(1);
    await expect(page.locator('.toast-message').filter({ hasText: /dialog action failed/i })).toBeVisible();
    await page.locator('dialog[open] .popup-button-ok').click(); expect(await page.evaluate(() => window.__shown)).toBe(1);
});

test('explicit false keeps popup open and repeated pending completion invokes hook once', async ({ page }) => {
    const result = await page.evaluate(async () => {
        const { Popup, POPUP_TYPE } = await import('/scripts/popup.js'); let calls = 0, release;
        const gate = new Promise(resolve => { release = resolve; });
        const popup = new Popup('Held hook', POPUP_TYPE.TEXT, '', { animation: 'none', onClosing: async () => { calls++; await gate; return false; } });
        const shown = popup.show(); const first = popup.completeAffirmative(), second = popup.completeAffirmative(); release(); await Promise.all([first, second]);
        const state = { calls, open: popup.dlg.open, value: popup.value ?? null }; popup.onClosing = null; await popup.completeCancelled(); await shown; return state;
    });
    expect(result).toEqual({ calls: 1, open: true, value: null });
});

test('normal rename applies its acknowledged snapshot once and preserves extension data', async ({ page }) => {
    await page.evaluate(async () => { const manager = (await import('/scripts/preset-manager.js')).getPresetManager('context'); await manager.writePresetExtensionField({ name: 'Lifetime A', path: 'synthetic', value: 'retained' }); await manager.renamePreset('Lifetime normal rename'); });
    expect(await current(page)).toMatchObject({ selected: 'Lifetime normal rename', value: 'Lifetime A' });
    const saved = page.saved.find(item => item.name === 'Lifetime normal rename');
    expect(saved.preset.extensions.synthetic).toBe('retained'); expect((await current(page)).names).not.toContain('Lifetime A');
});

test('failed native import clears its file chooser so the same file can be retried', async ({ page }) => {
    await nativeForm(page); let failed = true;
    await page.route('**/api/presets/save', route => { const body = route.request().postDataJSON(); page.saved.push(body); return route.fulfill(failed ? { status: 503, json: {} } : { json: { name: body.name } }); });
    const input = page.locator('[data-preset-manager-file="context"]');
    const file = { name: 'same-retry.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ name: 'Lifetime imported retry', story_string: 'same file content' })) };
    await input.setInputFiles(file); await expect(page.locator('.toast-message').filter({ hasText: /could not be saved/i }).first()).toBeVisible(); await expect(input).toHaveValue('');
    expect((await current(page)).names).not.toContain('Lifetime imported retry'); failed = false; await input.setInputFiles(file);
    await expect.poll(async () => (await current(page)).names.includes('Lifetime imported retry')).toBe(true); expect(page.saved).toHaveLength(2);
});

test('custom popup action runs once from Enter without closing an action-only control', async ({ page }) => {
    await page.evaluate(async () => { const { Popup, POPUP_TYPE } = await import('/scripts/popup.js'); window.__customCalls = 0; window.__popup = new Popup('Action keyboard', POPUP_TYPE.TEXT, '', { animation: 'none', customButtons: [{ text: 'Action without closing', action: () => { window.__customCalls++; } }] }); window.__shown = window.__popup.show(); });
    await page.locator('dialog[open] .popup-button-custom').focus(); await page.keyboard.press('Enter');
    expect(await page.evaluate(() => window.__customCalls)).toBe(1); await expect(page.locator('dialog[open]')).toHaveCount(1);
    await page.locator('dialog[open] .popup-button-ok').click(); expect(await page.evaluate(() => window.__shown)).toBe(1);
});

test('onOpen can immediately complete its own popup and settle show', async ({ page }) => {
    expect(await page.evaluate(async () => { const { Popup, POPUP_TYPE } = await import('/scripts/popup.js'); const popup = new Popup('Immediate completion', POPUP_TYPE.TEXT, '', { animation: 'none', onOpen: popup => popup.completeAffirmative() }); return popup.show(); })).toBe(1);
});

test('accepted deletion preserves a newer selected draft under an explicit unsaved option', async ({ page }) => {
    const pending = await held(page, '**/api/presets/delete', { json: {} });
    try {
        await page.evaluate(async () => { window.__deleted = (await import('/scripts/preset-manager.js')).getPresetManager('context').deletePreset(); });
        await pending.started;
        await page.evaluate(() => { const input = document.getElementById('context_story_string'); input.value = 'newer A draft after delete began'; input.dispatchEvent(new Event('input', { bubbles: true })); });
        pending.release(); expect(await page.evaluate(() => window.__deleted)).toBe(true);
        expect(await current(page)).toMatchObject({ selected: 'Lifetime A', value: 'newer A draft after delete began' });
        await expect(page.locator('#context_presets option:checked')).toHaveAttribute('label', /unsaved changes/);
        await page.evaluate(async () => (await import('/scripts/preset-manager.js')).getPresetManager('context').updatePreset());
        expect(page.saved.at(-1)).toMatchObject({ name: 'Lifetime A', preset: { story_string: 'newer A draft after delete began' } });
        await expect(page.locator('#context_presets option:checked')).not.toHaveAttribute('data-unsaved', 'true');
        expect(await page.evaluate(async () => (await import('/scripts/preset-manager.js')).getPresetManager('context').presetRecord('Lifetime B').story_string)).toBe('Lifetime B');
    } finally { pending.release(); }
});

test('queued restore rejects a target replaced by an earlier acknowledged save', async ({ page }) => {
    await nativeForm(page);
    const pending = await held(page, '**/api/presets/save', { json: { name: 'Lifetime A' } });
    await page.route('**/api/presets/restore', route => route.fulfill({ json: { isDefault: true, preset: { name: 'Lifetime A', story_string: 'obsolete restore' } } }));
    try {
        await page.evaluate(async () => { const m = (await import('/scripts/preset-manager.js')).getPresetManager('context'); window.__queuedSave = m.savePreset('Lifetime A', { ...m.getPresetSettings('Lifetime A'), story_string: 'earlier accepted change' }); });
        await pending.started; await page.locator('[data-preset-manager-restore="context"]').click(); await page.locator('dialog[open] .popup-button-ok').click();
        await page.waitForTimeout(100); pending.release(); await page.evaluate(() => window.__queuedSave);
        await expect(page.locator('.toast-message').filter({ hasText: /preset changed.*Reopen/i }).first()).toBeVisible();
        expect(pending.requests).toHaveLength(1); expect((await current(page)).value).toBe('earlier accepted change');
    } finally { pending.release(); }
});

test('malformed native preset import reports failure and permits same-file correction', async ({ page }) => {
    await nativeForm(page); const input = page.locator('[data-preset-manager-file="context"]');
    await input.setInputFiles({ name: 'malformed.json', mimeType: 'application/json', buffer: Buffer.from('{malformed') });
    await expect(page.locator('.toast-error')).toBeVisible(); await expect(input).toHaveValue(''); expect(page.saved).toHaveLength(0);
});

test('mapped Chat Completion rename captures native preset fields and preserves a newer selection', async ({ page }) => {
    await page.evaluate(async () => {
        const m = (await import('/scripts/preset-manager.js')).getPresetManager('openai');
        const base = (await import('/scripts/openai.js')).getChatCompletionPreset();
        await m.savePreset('Lifetime mapped A', { ...base, temperature: 0.31, extensions: { synthetic: 'mapped metadata' } });
        await m.savePreset('Lifetime mapped B', { ...base, temperature: 0.77 });
        await m.selectPreset(m.findPreset('Lifetime mapped A'));
    });
    page.saved.length = 0;
    const pending = await held(page, '**/api/presets/save', { json: { name: 'Lifetime mapped renamed' } });
    try {
        await page.evaluate(async () => { window.__renamed = (await import('/scripts/preset-manager.js')).getPresetManager('openai').renamePreset('Lifetime mapped renamed'); });
        await pending.started;
        await page.evaluate(async () => { const m = (await import('/scripts/preset-manager.js')).getPresetManager('openai'); await m.selectPreset(m.findPreset('Lifetime mapped B')); });
        pending.release(); await page.evaluate(() => window.__renamed);
        expect(pending.requests[0].preset).toMatchObject({ temperature: 0.31, extensions: { synthetic: 'mapped metadata' } });
        expect(await page.evaluate(async () => ({ selected: (await import('/scripts/preset-manager.js')).getPresetManager('openai').getSelectedPresetName(), temperature: (await import('/scripts/openai.js')).oai_settings.temp_openai }))).toEqual({ selected: 'Lifetime mapped B', temperature: 0.77 });
        expect(page.deleted.at(-1)).toEqual({ name: 'Lifetime mapped A', apiId: 'openai' });
    } finally { pending.release(); }
});

test('mapped preset deletion failure preserves numeric option mapping and permits retry', async ({ page }) => {
    await page.evaluate(async () => { const m = (await import('/scripts/preset-manager.js')).getPresetManager('openai'); await m.savePreset('Lifetime mapped delete', (await import('/scripts/openai.js')).getChatCompletionPreset()); await m.selectPreset(m.findPreset('Lifetime mapped delete')); });
    let failed = true;
    await page.route('**/api/presets/delete', route => route.fulfill(failed ? { status: 503, json: {} } : { json: {} }));
    const invoke = () => page.evaluate(async () => { const m = (await import('/scripts/preset-manager.js')).getPresetManager('openai'); return { result: await m.deletePreset('Lifetime mapped delete'), names: m.getAllPresets(), found: Boolean(m.presetRecord('Lifetime mapped delete')), selected: m.getSelectedPresetName() }; });
    expect(await invoke()).toMatchObject({ result: false, found: true, selected: 'Lifetime mapped delete' }); failed = false;
    expect(await invoke()).toMatchObject({ result: true, found: false });
});
