import { test, expect } from '@playwright/test';
import fs from 'node:fs';

test.use({ channel: 'chromium', video: 'off', viewport: { width: 1280, height: 800 }, hasTouch: true });
test.setTimeout(90000);
test.skip(!process.env.ST_NATIVE_UI_AUDIT, 'Use ST_NATIVE_UI_AUDIT=1 with a synthetic local fixture.');

test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(12000);
    page.qrDiagnostics = { pageErrors: [], consoleErrors: [], failedRequests: [] };
    page.on('pageerror', error => page.qrDiagnostics.pageErrors.push(error.stack || error.message));
    page.on('console', message => { if (message.type() === 'error') page.qrDiagnostics.consoleErrors.push(message.text()); });
    page.on('requestfailed', request => page.qrDiagnostics.failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
    await page.route('**/api/settings/get', async route => {
        const response = await route.fetch(); const body = await response.json(); const settings = JSON.parse(body.settings);
        settings.firstRun = false; settings.active_character = null; settings.active_group = null;
        settings.main_api = 'openai'; settings.power_user.auto_connect = false; settings.power_user.font_scale = 1; settings.power_user.restore_user_input = true;
        settings.accountStorage = { ...settings.accountStorage, workspaceLayout: 'true', workspaceAdvancedSettings: 'false' };
        settings.extension_settings.tts = { ...settings.extension_settings.tts, enabled: false, currentProvider: 'System' };
        settings.extension_settings.serviceConnections = { url: '' };
        settings.extension_settings.quickReplyV2 = { isEnabled: false, isCombined: false, isPopout: false, showPopoutButton: true, config: { setList: [] }, characterConfigs: {} };
        body.settings = JSON.stringify(settings); await route.fulfill({ response, json: body });
    });
    await page.goto('/'); await expect(page.locator('#preloader')).toHaveCount(0, { timeout: 30000 });
    await page.locator('#workspace-navigation [data-workspace-action="characters"]').click();
    await page.locator('.workspace-library-card').first().click();
    await page.getByRole('button', { name: 'Start new story', exact: true }).click();
    await expect(page.locator('#send_textarea')).toBeVisible();
    await page.locator('#workspace-settings-link').click();
    await page.locator('.workspace-settings-rail [data-workspace-action="extensions"]').click();
    await page.locator('#workspace-advanced-settings').check();
    if (!await page.locator('#qr--set-new').isVisible()) await page.locator('#qr--settings .inline-drawer-toggle').first().click();
    await expect(page.locator('#qr--set-new')).toBeVisible();
});

test.afterEach(async ({ page }, info) => {
    await page.unrouteAll({ behavior: 'wait' });
    fs.writeFileSync(info.outputPath('diagnostics.json'), JSON.stringify(page.qrDiagnostics, null, 2));
    await page.screenshot({ path: info.outputPath('final.png') });
    expect(page.qrDiagnostics.pageErrors).toEqual([]);
});

const name = label => `QR ${label} ${Date.now().toString(36)}`;
async function popup(page, value) {
    const dialog = page.locator('dialog[open]').last();
    const opened = await dialog.elementHandle();
    if (value !== undefined) await dialog.locator('.popup-input').fill(value);
    await dialog.locator('.popup-button-ok').click();
    await expect.poll(() => opened.evaluate(node => !node.open || !node.isConnected)).toBe(true);
}
async function disk(page, setName) {
    const headers = await page.evaluate(async () => (await import('/script.js')).getRequestHeaders());
    const response = await page.request.post('/api/settings/get', { headers, data: {} });
    expect(response.ok()).toBe(true);
    return (await response.json()).quickReplyPresets.find(set => set.name === setName) || null;
}
async function current(page, setName) {
    return page.evaluate(async name => JSON.parse(JSON.stringify((await import('/scripts/extensions/quick-reply/src/QuickReplySet.js')).QuickReplySet.get(name))) || null, setName);
}
async function create(page, setName, message = 'Original neutral reply.') {
    await page.locator('#qr--set-new').click(); await popup(page, setName);
    await expect(page.locator('#qr--set')).toHaveValue(setName);
    await page.locator('.qr--set-itemMessage').first().fill(message);
    await page.locator('.qr--set-itemLabel').first().fill('Neutral');
    await expect.poll(async () => (await disk(page, setName))?.qrList[0]?.message, { timeout: 12000 }).toBe(message);
}
async function transfer(page, target) {
    await page.locator('.qr--set-item [title="Move quick reply to other set"]').first().click();
    if (target) await page.locator('dialog[open] .qr--transferSelect').selectOption(target);
    await popup(page);
}
async function enable(page, setName) {
    await page.evaluate(async setName => {
        const { quickReplyApi } = await import('/scripts/extensions/quick-reply/index.js');
        const { QuickReplySet } = await import('/scripts/extensions/quick-reply/src/QuickReplySet.js');
        quickReplyApi.settings.isEnabled = true;
        quickReplyApi.settings.config.addSet(QuickReplySet.get(setName), true);
        quickReplyApi.settings.save();
    }, setName);
}
const setFile = (setName, message) => ({ name: 'neutral-set.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ version: 2, name: setName, idIndex: 4, qrList: [{ id: 4, label: 'Imported', message }] })) });

test('transfer validates a destination and retains source and target when target save fails before retry', async ({ page }) => {
    const a = name('transfer A'), b = name('transfer B'); await create(page, a); await create(page, b, 'Keep target.');
    await page.evaluate(async ({ a, b }) => { const { QuickReplySet } = await import('/scripts/extensions/quick-reply/src/QuickReplySet.js'); const { QuickReplyContextLink } = await import('/scripts/extensions/quick-reply/src/QuickReplyContextLink.js'); const set = QuickReplySet.get(a); set.qrList[0].contextList = [QuickReplyContextLink.from({ set: b, isChained: false })]; await set.save(); }, { a, b });
    await page.locator('#qr--set').selectOption(a);
    await transfer(page);
    await expect(page.locator('.toast-message').filter({ hasText: 'Choose an available Quick Reply set' })).toBeVisible();
    await page.route('**/api/quick-replies/save', route => route.request().postDataJSON().name === b ? route.fulfill({ status: 503, body: 'Synthetic save failure' }) : route.continue());
    await transfer(page, b);
    await expect(page.locator('.toast-message').filter({ hasText: 'destination could not be saved' })).toBeVisible();
    expect((await disk(page, a)).qrList.map(qr => qr.message)).toEqual(['Original neutral reply.']);
    expect((await disk(page, b)).qrList.map(qr => qr.message)).toEqual(['Keep target.']);
    expect((await current(page, b)).qrList.map(qr => qr.message)).toEqual(['Keep target.']);
    await page.unroute('**/api/quick-replies/save');
    await transfer(page, b);
    await expect.poll(async () => (await disk(page, a)).qrList.length).toBe(0);
    expect((await disk(page, b)).qrList.map(qr => qr.message)).toEqual(['Keep target.', 'Original neutral reply.']);
    expect((await current(page, b)).qrList.at(-1).contextList[0].set).toBe(b);
});

test('a held transfer preserves a source edited after the target snapshot was submitted', async ({ page }) => {
    const a = name('changed A'), b = name('changed B'); await create(page, a); await create(page, b, 'Keep target.'); await page.locator('#qr--set').selectOption(a);
    let release, began; const held = new Promise(resolve => release = resolve), requested = new Promise(resolve => began = resolve);
    await page.route('**/api/quick-replies/save', async route => { if (route.request().postDataJSON().name === b) { began(); await held; } await route.continue(); });
    try {
        await transfer(page, b); await requested;
        await page.locator('.qr--set-itemMessage').first().fill('Newer source edit.');
        await expect.poll(async () => (await disk(page, a)).qrList[0].message).toBe('Newer source edit.');
        release(); await expect(page.locator('.toast-message').filter({ hasText: 'source changed during transfer' })).toBeVisible();
        expect((await disk(page, a)).qrList[0].message).toBe('Newer source edit.');
        expect((await disk(page, b)).qrList.at(-1).message).toBe('Original neutral reply.');
    } finally { release(); }
});

test('failed reply and set deletions retain their rows and active bindings before retry', async ({ page }) => {
    const a = name('delete'); await create(page, a); await enable(page, a);
    await page.route('**/api/quick-replies/save', route => route.fulfill({ status: 503, body: 'Synthetic save failure' }));
    await page.locator('.qr--set-item [title^="Remove Quick Reply"]').first().click();
    await popup(page);
    await expect(page.locator('.toast-message').filter({ hasText: 'set could not be saved' })).toBeVisible();
    await expect(page.locator('.qr--set-itemMessage')).toHaveValue('Original neutral reply.');
    expect((await disk(page, a)).qrList.length).toBe(1);
    await page.unroute('**/api/quick-replies/save');
    await page.route('**/api/quick-replies/delete', route => route.fulfill({ status: 503, body: 'Synthetic delete failure' }));
    await page.locator('#qr--set-delete').click(); await popup(page);
    await expect(page.locator('.toast-message').filter({ hasText: 'set could not be deleted' })).toBeVisible();
    await expect(page.locator('#qr--set')).toHaveValue(a);
    expect(await page.evaluate(async a => (await import('/scripts/extensions/quick-reply/index.js')).quickReplyApi.settings.config.setList.some(link => link.set.name === a), a)).toBe(true);
    await page.unroute('**/api/quick-replies/delete');
    await page.locator('#qr--set-delete').click(); await popup(page);
    await expect.poll(() => disk(page, a)).toBeNull();
});

for (const action of ['import', 'create']) {
    test(`failed ${action} overwrite preserves the existing file, object and bindings before retry`, async ({ page }) => {
        const a = name(`${action} overwrite`); await create(page, a); await enable(page, a);
        await page.evaluate(async a => window.__originalQrSet = (await import('/scripts/extensions/quick-reply/src/QuickReplySet.js')).QuickReplySet.get(a), a);
        await page.route('**/api/quick-replies/save', route => route.fulfill({ status: 503, body: 'Synthetic save failure' }));
        const attempt = async () => {
            if (action === 'import') await page.locator('#qr--set-importFile').setInputFiles(setFile(a, 'Replacement reply.'));
            else { await page.locator('#qr--set-new').click(); await popup(page, a); }
            await popup(page);
        };
        await attempt(); await expect(page.locator('.toast-message').filter({ hasText: 'set could not be saved' })).toBeVisible();
        expect((await disk(page, a)).qrList[0].message).toBe('Original neutral reply.');
        expect((await current(page, a)).qrList[0].message).toBe('Original neutral reply.');
        await page.unroute('**/api/quick-replies/save'); await attempt();
        const expected = action === 'import' ? 'Replacement reply.' : '';
        await expect.poll(async () => (await disk(page, a)).qrList[0].message).toBe(expected);
        expect(await page.evaluate(async a => {
            const { quickReplyApi } = await import('/scripts/extensions/quick-reply/index.js');
            const { QuickReplySet } = await import('/scripts/extensions/quick-reply/src/QuickReplySet.js');
            return QuickReplySet.get(a) === window.__originalQrSet && quickReplyApi.settings.config.setList.some(link => link.set === window.__originalQrSet);
        }, a)).toBe(true);
    });
}

test('rename waits for persistence and keeps context references valid after a failed save and retry', async ({ page }) => {
    const a = name('rename old'), b = name('rename new'), c = name('context'); await create(page, a); await create(page, c);
    await page.evaluate(async ({ a, c }) => {
        const { QuickReplySet } = await import('/scripts/extensions/quick-reply/src/QuickReplySet.js');
        const { QuickReplyContextLink } = await import('/scripts/extensions/quick-reply/src/QuickReplyContextLink.js');
        const set = QuickReplySet.get(c); set.qrList[0].contextList.push(QuickReplyContextLink.from({ set: a, isChained: false })); await set.performSave();
    }, { a, c });
    await page.locator('#qr--set').selectOption(a); await enable(page, a);
    await page.route('**/api/quick-replies/save', route => route.request().postDataJSON().name === b ? route.fulfill({ status: 503, body: 'Synthetic rename failure' }) : route.continue());
    await page.locator('#qr--set-rename').click(); await popup(page, b);
    await expect(page.locator('.toast-message').filter({ hasText: 'set could not be saved' })).toBeVisible();
    await expect(page.locator('#qr--set')).toHaveValue(a);
    expect(await disk(page, b)).toBeNull(); expect((await disk(page, a)).qrList[0].message).toBe('Original neutral reply.');
    await page.unroute('**/api/quick-replies/save');
    await page.locator('#qr--set-rename').click(); await popup(page, b);
    await expect(page.locator('#qr--set')).toHaveValue(b);
    expect(await disk(page, a)).toBeNull(); expect((await disk(page, c)).qrList[0].contextList[0].set).toBe(b);
});

test('a delayed duplicate save cannot replace the newer selected editor', async ({ page }) => {
    const a = name('duplicate source'), b = name('duplicate output'), c = name('duplicate newer'); await create(page, a); await create(page, c, 'Keep newer editor.'); await page.locator('#qr--set').selectOption(a);
    let release, began; const held = new Promise(resolve => release = resolve), requested = new Promise(resolve => began = resolve);
    await page.route('**/api/quick-replies/save', async route => { if (route.request().postDataJSON().name === b) { began(); await held; } await route.continue(); });
    try {
        await page.locator('#qr--set-duplicate').click(); await popup(page, b); await requested;
        await page.locator('#qr--set').selectOption(c); release();
        await expect.poll(() => disk(page, b)).not.toBeNull();
        await expect(page.locator('#qr--set')).toHaveValue(c); await expect(page.locator('.qr--set-itemMessage')).toHaveValue('Keep newer editor.');
    } finally { release(); }
});

test('icon changes update the rendered button before the pending save completes and editor drafts emit input', async ({ page }) => {
    const a = name('icon draft'); await create(page, a); await enable(page, a);
    await page.evaluate(async a => { const set = (await import('/scripts/extensions/quick-reply/src/QuickReplySet.js')).QuickReplySet.get(a); set.qrList[0].updateIcon('fa-star'); await set.save(); }, a);
    let release; const held = new Promise(resolve => release = resolve);
    await page.route('**/api/quick-replies/save', async route => { await held; await route.continue(); });
    try {
        await page.locator('.qr--set-itemIcon').first().click(); await page.locator('dialog[open] .faPicker .fa-0').click();
        await expect.poll(() => page.evaluate(async a => (await import('/scripts/extensions/quick-reply/src/QuickReplySet.js')).QuickReplySet.get(a).qrList[0].icon, a)).toBe('fa-0');
        expect(await page.evaluate(async a => (await import('/scripts/extensions/quick-reply/src/QuickReplySet.js')).QuickReplySet.get(a).qrList[0].domIcon.className, a)).toContain('fa-0');
        expect(await page.evaluate(async a => (await import('/scripts/extensions/quick-reply/src/QuickReplySet.js')).QuickReplySet.get(a).qrList[0].domIcon.className, a)).not.toContain('fa-star');
        release(); await page.unroute('**/api/quick-replies/save');
        await page.locator('.qr--set-optionsContainer .qr--action').first().click();
        await expect(page.locator('#qr--modal-send_textarea')).toBeVisible();
        await page.evaluate(() => { window.__originalInputEvents = 0; document.querySelector('#send_textarea').addEventListener('input', () => window.__originalInputEvents++); });
        await page.locator('#qr--modal-send_textarea').fill('A draft from the native QR editor.');
        expect(await page.evaluate(() => ({ text: document.querySelector('#send_textarea').value, events: window.__originalInputEvents, stored: Object.values(localStorage).some(value => value.includes('A draft from the native QR editor.')) }))).toEqual({ text: 'A draft from the native QR editor.', events: 1, stored: true });
    } finally { release(); }
});

for (const width of [1280, 390]) {
    test(`submenu and popout actions support native keyboard and touch at ${width}px`, async ({ page }) => {
        const a = name(`menu ${width}`); await create(page, a); await enable(page, a);
        await page.setViewportSize({ width, height: 844 });
        await page.evaluate(async () => {
            const { MenuItem } = await import('/scripts/extensions/quick-reply/src/ui/ctx/MenuItem.js');
            window.__menuActions = [];
            const child = new MenuItem('', true, 'Child reply', '', '', () => window.__menuActions.push('child'));
            const parent = new MenuItem('', true, 'Parent reply', '', '', () => window.__menuActions.push('parent'), [child]);
            const root = document.createElement('ul'); root.className = 'list-group ctx-menu'; root.style.cssText = 'position:fixed;z-index:20000;left:24px;top:200px;width:200px'; root.append(parent.render()); document.body.append(root); window.__testMenu = parent;
        });
        const toggle = page.getByRole('button', { name: 'Submenu for Parent reply', exact: true });
        await toggle.focus(); await page.keyboard.press('Enter'); await expect(toggle).toHaveAttribute('aria-expanded', 'true');
        await page.getByRole('button', { name: 'Child reply', exact: true }).focus(); await page.keyboard.press('Space');
        expect(await page.evaluate(() => window.__menuActions)).toEqual(['child']);
        await toggle.tap(); await expect(toggle).toHaveAttribute('aria-expanded', 'false'); await toggle.tap(); await expect(toggle).toHaveAttribute('aria-expanded', 'true');
        await page.evaluate(() => { window.__testMenu.collapse(); window.__testMenu.root.parentElement.remove(); });
        await page.evaluate(async () => { const { quickReplyApi } = await import('/scripts/extensions/quick-reply/index.js'); quickReplyApi.settings.isPopout = true; quickReplyApi.settings.save(); });
        const close = page.getByRole('button', { name: 'Close Quick Replies', exact: true }); await expect(close).toBeVisible();
        await close.focus(); await page.keyboard.press('Space'); await expect(page.locator('#qr--popout')).toHaveCount(0);
    });
}

test('a held replacement locks its original editor and preserves a newer selected set', async ({ page }) => {
    const a = name('held overwrite'), b = name('held newer'); await create(page, a); await create(page, b, 'Newer editor stays.'); await page.locator('#qr--set').selectOption(a);
    let release, began; const held = new Promise(resolve => release = resolve), requested = new Promise(resolve => began = resolve);
    await page.route('**/api/quick-replies/save', async route => { if (route.request().postDataJSON().name === a) { began(); await held; } await route.continue(); });
    try {
        await page.locator('#qr--set-importFile').setInputFiles(setFile(a, 'Replacement remains in its set.')); await popup(page); await requested;
        await expect(page.locator('#qr--set-settings')).toHaveAttribute('inert', '');
        await page.locator('#qr--set').selectOption(b);
        await expect(page.locator('#qr--set-settings')).not.toHaveAttribute('inert', '');
        release(); await expect.poll(async () => (await disk(page, a)).qrList[0].message).toBe('Replacement remains in its set.');
        await expect(page.locator('#qr--set')).toHaveValue(b); await expect(page.locator('.qr--set-itemMessage')).toHaveValue('Newer editor stays.');
    } finally { release(); }
});

test('a partial rename failure retains both files and the original active set', async ({ page }) => {
    const a = name('partial original'), b = name('partial copy'); await create(page, a); await enable(page, a);
    await page.route('**/api/quick-replies/delete', route => route.fulfill({ status: 503, body: 'Synthetic delete unavailable' }));
    await page.locator('#qr--set-rename').click(); await popup(page, b);
    await expect(page.locator('.toast-message').filter({ hasText: 'Both files were retained' })).toBeVisible();
    await expect(page.locator('#qr--set')).toHaveValue(a);
    expect((await disk(page, a)).qrList[0].message).toBe('Original neutral reply.');
    expect((await disk(page, b)).qrList[0].message).toBe('Original neutral reply.');
    expect(await page.evaluate(async a => (await import('/scripts/extensions/quick-reply/index.js')).quickReplyApi.settings.config.setList.some(link => link.set.name === a), a)).toBe(true);
});

test('malformed imported icons and filename collisions never replace the original', async ({ page }) => {
    const a = name('validated import'); await create(page, a);
    await page.locator('#qr--set-importFile').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ version: 2, name: a, qrList: [{ label: 'Invalid', message: 'Do not overwrite.', icon: 'two invalid classes' }] })) });
    await expect(page.locator('.toast-message').filter({ hasText: 'not a valid icon class' })).toBeVisible();
    expect((await disk(page, a)).qrList[0].message).toBe('Original neutral reply.');
    await page.locator('#qr--set-new').click(); await popup(page, `${a}/`);
    await expect(page.locator('.toast-message').filter({ hasText: 'filesystem path characters' })).toBeVisible();
    expect((await disk(page, a)).qrList[0].message).toBe('Original neutral reply.');
    await expect(page.locator('#qr--set')).toHaveValue(a);
});

test('an imported self context continues to point to the live set instance', async ({ page }) => {
    const a = name('self context'); await create(page, a);
    await page.locator('#qr--set-importFile').setInputFiles({ name: 'self.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ version: 2, name: a, save: 'Imported data cannot replace the owner method.', qrList: [{ id: 4, label: 'Self', message: 'A self-referencing menu.', onExecute: 'Imported data cannot replace callbacks.', contextList: [{ set: a, isChained: false }] }] })) });
    await popup(page);
    await expect.poll(async () => (await disk(page, a)).qrList[0].label).toBe('Self');
    expect(await page.evaluate(async a => { const { QuickReplySet } = await import('/scripts/extensions/quick-reply/src/QuickReplySet.js'); const set = QuickReplySet.get(a); return set.qrList[0].contextList[0].set === set; }, a)).toBe(true);
    expect(await page.evaluate(async a => { const set = (await import('/scripts/extensions/quick-reply/src/QuickReplySet.js')).QuickReplySet.get(a); return [typeof set.save, typeof set.qrList[0].onExecute]; }, a)).toEqual(['function', 'function']);
});

for (const width of [1280, 390]) {
    test(`actual Quick Reply context entry stays within viewport for keyboard at ${width}px`, async ({ page }, info) => {
        const a = name(`entry A ${width}`), b = name(`entry B ${width}`), c = name(`entry C ${width}`); await create(page, a); await create(page, b, 'Context child.'); await create(page, c, 'Nested context child.');
        await page.evaluate(async ({ a, b, c }) => {
            const { QuickReplySet } = await import('/scripts/extensions/quick-reply/src/QuickReplySet.js');
            const { QuickReplyContextLink } = await import('/scripts/extensions/quick-reply/src/QuickReplyContextLink.js');
            const set = QuickReplySet.get(a); set.qrList[0].contextList = [QuickReplyContextLink.from({ set: b, isChained: false })]; await set.performSave();
            const child = QuickReplySet.get(b); child.disableSend = true; child.qrList[0].contextList = [QuickReplyContextLink.from({ set: c, isChained: false })];
            for (let index = 0; index < 30; index++) child.addQuickReply({ label: `Extra neutral ${index}`, message: 'A neutral extra reply.' });
            await child.save(); QuickReplySet.get(c).disableSend = true; await QuickReplySet.get(c).save();
        }, { a, b, c });
        await enable(page, a); await page.locator('#workspace-settings-shell [data-workspace-action="close-panel"]').click();
        await page.setViewportSize({ width, height: 844 });
        const entry = page.getByRole('button', { name: 'Open context menu for Neutral', exact: true });
        await expect(entry).toBeVisible(); await entry.focus(); await page.keyboard.press('Enter');
        const menu = page.locator('.ctx-blocker > .ctx-menu:not(.ctx-sub-menu)'); await expect(menu).toBeVisible();
        const bounds = await menu.boundingBox();
        fs.writeFileSync(info.outputPath('context-bounds.json'), JSON.stringify(bounds, null, 2));
        expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.y).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(width); expect(bounds.y + bounds.height).toBeLessThanOrEqual(844);
        await expect(page.getByRole('button', { name: 'Neutral', exact: true })).toBeFocused();
        const nestedToggle = page.getByRole('button', { name: 'Submenu for Neutral', exact: true });
        await nestedToggle.focus(); await page.keyboard.press('Enter');
        const nested = page.locator('.ctx-blocker > .ctx-sub-menu'); await expect(nested).toBeVisible();
        const child = nested.getByRole('button', { name: 'Neutral', exact: true }); await expect(child).toBeFocused();
        const resizedBounds = [];
        for (const resizedWidth of [width, 360]) {
            await page.setViewportSize({ width: resizedWidth, height: 600 });
            await expect.poll(async () => {
                const root = await menu.boundingBox(), sub = await nested.boundingBox();
                return [root, sub].every(rect => rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= resizedWidth && rect.y + rect.height <= 600);
            }).toBe(true);
            resizedBounds.push({ viewport: { width: resizedWidth, height: 600 }, root: await menu.boundingBox(), submenu: await nested.boundingBox() });
            expect(await child.evaluate(node => { const r = node.getBoundingClientRect(); return node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); })).toBe(true);
        }
        fs.writeFileSync(info.outputPath('nested-resize-bounds.json'), JSON.stringify(resizedBounds, null, 2));
        await page.screenshot({ path: info.outputPath('nested-visible.png') });
        await page.keyboard.press('Space'); await expect(page.locator('.ctx-blocker')).toHaveCount(0); await expect(page.locator('#send_textarea')).toHaveValue('Nested context child. ');
        await entry.focus(); await page.keyboard.press('Enter'); await page.keyboard.press('Escape'); await expect(entry).toBeFocused();
        await entry.tap(); await expect(menu).toBeVisible(); await page.locator('.ctx-blocker').click({ position: { x: 2, y: 2 } }); await expect(menu).toHaveCount(0);
    });
}

test('inline paste rejects malformed replies and rolls back a failed save before retry', async ({ page }) => {
    const a = name('inline paste'); await create(page, a);
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { readText: async () => '{"wrong":"not a reply"}' } }));
    await page.locator('.qr--set-item').first().hover();
    await page.locator('.qr--set-item [title="Add quick reply from clipboard"]').first().click();
    await expect(page.locator('.toast-message').filter({ hasText: 'Not a QR.' })).toBeVisible();
    expect((await current(page, a)).qrList.map(reply => reply.message)).toEqual(['Original neutral reply.']);
    await page.evaluate(() => navigator.clipboard.readText = async () => 'A pasted neutral reply.');
    await page.route('**/api/quick-replies/save', route => route.fulfill({ status: 503, body: 'Synthetic save failure' }));
    await page.locator('.qr--set-item [title="Add quick reply from clipboard"]').first().click();
    await expect(page.locator('.toast-message').filter({ hasText: 'set could not be saved' })).toBeVisible();
    await expect(page.locator('.qr--set-itemMessage')).toHaveValue('Original neutral reply.');
    expect((await disk(page, a)).qrList.map(reply => reply.message)).toEqual(['Original neutral reply.']);
    await page.unroute('**/api/quick-replies/save');
    await page.locator('.qr--set-item [title="Add quick reply from clipboard"]').first().click();
    await expect.poll(async () => (await disk(page, a)).qrList.map(reply => reply.message)).toEqual(['A pasted neutral reply.', 'Original neutral reply.']);
});

test('a delayed inline clipboard action cannot insert into a changed editor or cut a newer edit', async ({ page }) => {
    const a = name('inline owner A'), b = name('inline owner B'); await create(page, a); await create(page, b, 'Keep other set.'); await page.locator('#qr--set').selectOption(a);
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { readText: () => new Promise(resolve => window.__releaseRead = resolve), writeText: () => new Promise(resolve => window.__releaseWrite = resolve) } }));
    await page.locator('.qr--set-item').first().hover();
    await page.locator('.qr--set-item [title="Add quick reply from clipboard"]').first().click();
    await page.locator('#qr--set').selectOption(b); await page.evaluate(() => window.__releaseRead('Late clipboard reply.'));
    await expect(page.locator('.qr--set-itemMessage')).toHaveValue('Keep other set.');
    expect((await current(page, a)).qrList.length).toBe(1); expect((await current(page, b)).qrList.length).toBe(1);
    await page.locator('#qr--set').selectOption(a);
    await page.locator('.qr--set-item [title="Cut quick reply to clipboard (copy and remove)"]').first().click();
    await page.locator('.qr--set-itemMessage').fill('Keep edit made while clipboard is held.');
    await page.evaluate(() => window.__releaseWrite());
    await expect.poll(async () => (await disk(page, a)).qrList.map(reply => reply.message)).toEqual(['Keep edit made while clipboard is held.']);
});

test('denied inline clipboard access reports failure while preserving the reply', async ({ page }) => {
    const a = name('inline denied'); await create(page, a);
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { readText: async () => { throw new Error('Synthetic clipboard denied'); }, writeText: async () => { throw new Error('Synthetic clipboard denied'); } } }));
    await page.locator('.qr--set-item').first().hover();
    await page.locator('.qr--set-item [title="Add quick reply from clipboard"]').first().click();
    await expect(page.locator('.toast-message').filter({ hasText: 'clipboard could not be pasted' })).toBeVisible();
    await page.locator('.qr--set-item [title="Copy quick reply to clipboard"]').first().click();
    await expect(page.locator('.toast-message').filter({ hasText: 'could not be copied' })).toBeVisible();
    await page.locator('.qr--set-item [title="Cut quick reply to clipboard (copy and remove)"]').first().click();
    await expect(page.locator('.toast-message').filter({ hasText: 'could not be cut' })).toBeVisible();
    expect((await disk(page, a)).qrList.map(reply => reply.message)).toEqual(['Original neutral reply.']);
});

test('inline JSON import validates the file and keeps the original on save failure before retry', async ({ page }) => {
    const a = name('inline file'); await create(page, a);
    const choose = async text => {
        const chooser = page.waitForEvent('filechooser');
        await page.locator('.qr--set-item').first().hover();
        await page.locator('.qr--set-item [title="Add quick reply from JSON file"]').first().click();
        await (await chooser).setFiles({ name: 'neutral-reply.json', mimeType: 'application/json', buffer: Buffer.from(text) });
    };
    await choose('{invalid json'); await expect(page.locator('.toast-message').filter({ hasText: 'Choose a valid Quick Reply JSON file' })).toBeVisible();
    expect((await current(page, a)).qrList.map(reply => reply.message)).toEqual(['Original neutral reply.']);
    const data = JSON.stringify({ label: 'Imported before original', message: 'A valid native inline import.' });
    await page.route('**/api/quick-replies/save', route => route.fulfill({ status: 503, body: 'Synthetic save failure' }));
    await choose(data); await expect(page.locator('.toast-message').filter({ hasText: 'set could not be saved' })).toBeVisible();
    await expect(page.locator('.qr--set-itemMessage')).toHaveValue('Original neutral reply.');
    expect((await disk(page, a)).qrList.map(reply => reply.message)).toEqual(['Original neutral reply.']);
    await page.unroute('**/api/quick-replies/save'); await choose(data);
    await expect.poll(async () => (await disk(page, a)).qrList.map(reply => reply.message)).toEqual(['A valid native inline import.', 'Original neutral reply.']);
});
