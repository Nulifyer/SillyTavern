import { test, expect } from '@playwright/test';
import fs from 'node:fs';

test.use({ channel: 'chromium', video: 'off', viewport: { width: 1280, height: 800 } });
test.setTimeout(90000);
test.skip(!process.env.ST_NATIVE_UI_AUDIT, 'Use ST_NATIVE_UI_AUDIT=1 with a synthetic local fixture.');

async function api(page, url, body) {
    return page.evaluate(async ({ url, body }) => {
        const script = await import('/script.js');
        const response = await fetch(url, { method: 'POST', headers: script.getRequestHeaders(), body: JSON.stringify(body) });
        if (!response.ok) throw new Error(`${url} returned ${response.status}`);
        const text = await response.text();
        try { return JSON.parse(text); } catch { return text; }
    }, { url, body });
}

test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(12000);
    page.nativeDiagnostics = { pageErrors: [], consoleErrors: [], failedRequests: [] };
    page.on('pageerror', error => page.nativeDiagnostics.pageErrors.push(error.stack || error.message));
    page.on('console', message => { if (message.type() === 'error') page.nativeDiagnostics.consoleErrors.push(message.text()); });
    page.on('requestfailed', request => page.nativeDiagnostics.failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
    await page.route('**/api/settings/get', async route => {
        const response = await route.fetch(); const body = await response.json(); const settings = JSON.parse(body.settings);
        settings.firstRun = false; settings.active_character = null; settings.active_group = null;
        settings.main_api = 'openai'; settings.power_user.auto_connect = false; settings.power_user.font_scale = 1;
        settings.accountStorage = { ...settings.accountStorage, workspaceLayout: 'true', workspaceAdvancedSettings: 'false', workspaceArchivedChats: '[]' };
        settings.extension_settings.tts = { ...settings.extension_settings.tts, enabled: false, currentProvider: 'System' };
        settings.extension_settings.translate = { ...settings.extension_settings.translate, auto_mode: 'none' };
        settings.extension_settings.caption = { ...settings.extension_settings.caption, auto_mode: false };
        settings.extension_settings.serviceConnections = { url: '' };
        body.settings = JSON.stringify(settings); await route.fulfill({ response, json: body });
    });
    await page.goto('/');
    await expect(page.locator('#preloader')).toHaveCount(0, { timeout: 30000 });
    await page.locator('#workspace-navigation [data-workspace-action="characters"]').click();
    await page.locator('.workspace-library-card[data-entity="character:default_Seraphina.png"]').click();
    await page.getByRole('button', { name: 'Start new story', exact: true }).click();
    await expect(page.locator('#send_textarea')).toBeVisible();
    await expect(page.locator('#workspace-new-story')).toHaveAttribute('aria-busy', 'false');
});

test.afterEach(async ({ page }, info) => {
    fs.writeFileSync(info.outputPath('diagnostics.json'), JSON.stringify(page.nativeDiagnostics, null, 2));
    await page.screenshot({ path: info.outputPath('final.png') });
    expect(page.nativeDiagnostics.pageErrors).toEqual([]);
});

const book = comment => ({ entries: { 0: { uid: 0, key: ['lantern'], keysecondary: [], comment, content: 'A neutral lore entry.', constant: false, disable: false, order: 100, position: 0 } } });

async function createBooks(page, names) {
    for (const name of names) await api(page, '/api/worldinfo/edit', { name, data: book(name) });
    await page.evaluate(async () => { const world = await import('/scripts/world-info.js'); await world.updateWorldInfoList(); world.worldInfoCache.clear(); });
    await page.locator('#workspace-settings-link').click();
    await page.locator('.workspace-settings-rail [data-workspace-action="world"]').click();
    await page.locator('#world_editor_select').selectOption({ label: names[0] });
    await expect(page.locator('#world_popup_entries_list textarea[name="comment"]').first()).toHaveValue(names[0]);
}

async function cleanup(page, names) {
    await page.unrouteAll({ behavior: 'wait' });
    for (const name of names) await api(page, '/api/worldinfo/delete', { name });
}

test('a WORLDINFO_UPDATED listener can await a nested save of the same lorebook', async ({ page }) => {
    const name = `Nested lore save ${Date.now().toString(36)}`;
    await createBooks(page, [name]);
    try {
        const result = await page.evaluate(async name => {
            const world = await import('/scripts/world-info.js');
            const { eventSource, event_types } = await import('/script.js');
            let notifications = 0;
            const listener = async savedName => {
                if (savedName !== name || ++notifications !== 1) return;
                const next = structuredClone(await world.loadWorldInfo(name)); next.entries[0].comment = 'Nested listener edit';
                await world.saveWorldInfo(name, next, true);
            };
            eventSource.on(event_types.WORLDINFO_UPDATED, listener);
            try {
                const data = structuredClone(await world.loadWorldInfo(name)); data.entries[0].comment = 'Outer edit';
                const saved = await Promise.race([world.saveWorldInfo(name, data, true), new Promise(resolve => setTimeout(() => resolve('timeout'), 6000))]);
                return { saved, notifications };
            } finally { eventSource.removeListener(event_types.WORLDINFO_UPDATED, listener); }
        }, name);
        expect(result).toEqual({ saved: true, notifications: 2 });
        expect((await api(page, '/api/worldinfo/get', { name })).entries[0].comment).toBe('Nested listener edit');
    } finally { await cleanup(page, [name]); }
});

test('a failed delete resumes the pending dirty autosave without losing its draft', async ({ page }) => {
    const name = `Dirty delete save ${Date.now().toString(36)}`;
    await createBooks(page, [name]);
    await page.route('**/api/worldinfo/delete', route => route.fulfill({ status: 503, json: { error: 'Synthetic delete failure' } }));
    try {
        const result = await page.evaluate(async name => {
            const world = await import('/scripts/world-info.js');
            const data = await world.loadWorldInfo(name); data.entries[0].comment = 'Dirty draft survives delete failure';
            await world.saveWorldInfo(name, data, false);
            return world.deleteWorldInfo(name);
        }, name);
        expect(result).toBe(false);
        await expect.poll(async () => (await api(page, '/api/worldinfo/get', { name })).entries[0].comment).toBe('Dirty draft survives delete failure');
        await expect(page.locator('#world_info_save_status')).toContainText('Saved');
        expect(await page.evaluate(async name => (await (await import('/scripts/world-info.js')).loadWorldInfo(name)).entries[0].comment, name)).toBe('Dirty draft survives delete failure');
    } finally { await cleanup(page, [name]); }
});

test('a failed move preserves both lorebook caches and both native files', async ({ page }) => {
    const names = [`Move lore A ${Date.now().toString(36)}`, `Move lore B ${Date.now().toString(36)}`];
    await createBooks(page, names);
    const cacheBefore = await page.evaluate(async names => { const world = await import('/scripts/world-info.js'); return Promise.all(names.map(name => world.loadWorldInfo(name))); }, names);
    const before = await Promise.all(names.map(name => api(page, '/api/worldinfo/get', { name })));
    await page.route('**/api/worldinfo/edit', async route => {
        if (route.request().postDataJSON().name === names[1]) return route.fulfill({ status: 503, json: { error: 'Synthetic target save failure' } });
        await route.continue();
    });
    try {
        expect(await page.evaluate(async names => (await import('/scripts/world-info.js')).moveWorldInfoEntry(names[0], names[1], 0), names)).toBe(false);
        const caches = await page.evaluate(async names => { const world = await import('/scripts/world-info.js'); return Promise.all(names.map(name => world.loadWorldInfo(name))); }, names);
        expect(caches).toEqual(cacheBefore);
        expect(await Promise.all(names.map(name => api(page, '/api/worldinfo/get', { name })))).toEqual(before);
        await expect(page.locator('.toast-success').filter({ hasText: 'moved successfully' })).toHaveCount(0);
    } finally { await cleanup(page, names); }
});

test('a late first-page render cannot append its entries to the newer lorebook page', async ({ page }) => {
    const name = `Paged lore ${Date.now().toString(36)}`;
    let release, began;
    const gate = new Promise(resolve => release = resolve), requested = new Promise(resolve => began = resolve);
    let headers = 0;
    await page.route('**/scripts/templates/worldInfoKeywordHeaders.html', async route => {
        if (++headers === 1) { began(); await gate; }
        await route.continue();
    });
    await page.reload(); await expect(page.locator('#preloader')).toHaveCount(0, { timeout: 30000 });
    const data = { entries: Object.fromEntries(Array.from({ length: 60 }, (_, uid) => [uid, { ...book(`Entry ${uid}`).entries[0], uid, displayIndex: uid }])) };
    await api(page, '/api/worldinfo/edit', { name, data });
    try {
        await page.evaluate(async () => { const w = await import('/scripts/world-info.js'); await w.updateWorldInfoList(); w.worldInfoCache.clear(); const { accountStorage } = await import('/scripts/util/AccountStorage.js'); accountStorage.setItem('WI_PerPage', '25'); });
        await page.locator('#workspace-settings-link').click();
        await page.locator('.workspace-settings-rail [data-workspace-action="world"]').click();
        await page.locator('#world_editor_select').selectOption({ label: name }); await requested;
        await page.locator('#world_info_pagination .paginationjs-next a').click();
        await expect(page.locator('#world_popup_entries_list .world_entry')).toHaveCount(25);
        const current = await page.locator('#world_popup_entries_list .world_entry').evaluateAll(nodes => nodes.map(node => node.getAttribute('uid')));
        const response = page.waitForResponse(response => response.url().endsWith('/worldInfoKeywordHeaders.html'));
        release(); await response;
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        expect(await page.locator('#world_popup_entries_list .world_entry').evaluateAll(nodes => nodes.map(node => node.getAttribute('uid')))).toEqual(current);
        await expect(page.locator('#world_popup_entries_list .world_entry')).toHaveCount(25);
    } finally { release(); await cleanup(page, [name]); }
});

test('a held lorebook move locks both editors and permits a newer edit after its acknowledged save', async ({ page }) => {
    const names = [`Locked move A ${Date.now().toString(36)}`, `Locked move B ${Date.now().toString(36)}`];
    await createBooks(page, names);
    let release, began;
    const gate = new Promise(resolve => release = resolve), requested = new Promise(resolve => began = resolve);
    await page.route('**/api/worldinfo/edit', async route => {
        if (route.request().postDataJSON().name === names[1]) { began(); await gate; }
        await route.continue();
    });
    try {
        await page.evaluate(names => { import('/scripts/world-info.js').then(w => { window.__heldMove = w.moveWorldInfoEntry(names[0], names[1], 0); }); }, names);
        await requested;
        await expect(page.locator('#world_popup_entries_list')).toHaveAttribute('inert', '');
        await page.locator('#world_editor_select').selectOption({ label: names[1] });
        await expect(page.locator('#world_popup_entries_list')).toHaveAttribute('inert', '');
        expect(await page.evaluate(async name => {
            const w = await import('/scripts/world-info.js'); const data = structuredClone(await w.loadWorldInfo(name));
            data.entries[0].comment = 'Rejected edit during move'; return w.saveWorldInfo(name, data, true);
        }, names[1])).toBe(false);
        release(); expect(await page.evaluate(() => window.__heldMove)).toBe(true);
        await expect(page.locator('#world_popup_entries_list')).not.toHaveAttribute('inert', '');
        const moved = page.locator('#world_popup_entries_list .world_entry').filter({ has: page.locator('textarea[name="comment"]') }).last().locator('textarea[name="comment"]');
        await moved.fill('New edit after acknowledged move');
        await expect.poll(async () => Object.values((await api(page, '/api/worldinfo/get', { name: names[1] })).entries).map(entry => entry.comment)).toContain('New edit after acknowledged move');
        expect(Object.keys((await api(page, '/api/worldinfo/get', { name: names[0] })).entries)).toHaveLength(0);
    } finally { release(); await cleanup(page, names); }
});

test('an import locks the old editor across selection changes and rejects stale saves', async ({ page }) => {
    const names = [`Import locked A ${Date.now().toString(36)}`, `Import locked B ${Date.now().toString(36)}`];
    await createBooks(page, names);
    let release, began;
    const held = new Promise(resolve => release = resolve), requested = new Promise(resolve => began = resolve);
    await page.route('**/api/worldinfo/import', async route => { began(); await held; await route.continue(); });
    const edits = [];
    page.on('request', request => { if (request.url().endsWith('/api/worldinfo/edit')) edits.push(request.postDataJSON()); });
    try {
        await page.locator('#world_import_file').setInputFiles({ name: `${names[0]}.json`, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(book('Imported replacement'))) });
        await expect(page.locator('dialog[open]')).toContainText('overwrite');
        await page.locator('dialog[open] .popup-button-ok').click(); await requested;
        await expect(page.locator('#world_popup_entries_list')).toHaveAttribute('inert', '');
        await expect(page.locator('#world_popup_new')).toHaveAttribute('inert', '');
        await page.locator('#world_editor_select').selectOption({ label: names[1] });
        await expect(page.locator('#world_popup_entries_list textarea[name="comment"]').first()).toHaveValue(names[1]);
        await expect(page.locator('#world_popup_entries_list')).not.toHaveAttribute('inert', '');
        await page.locator('#world_editor_select').selectOption({ label: names[0] });
        await expect(page.locator('#world_popup_entries_list textarea[name="comment"]').first()).toHaveValue(names[0]);
        await expect(page.locator('#world_popup_entries_list')).toHaveAttribute('inert', '');
        expect(await page.evaluate(async name => {
            const world = await import('/scripts/world-info.js'); const stale = structuredClone(await world.loadWorldInfo(name)); stale.entries[0].comment = 'Forbidden stale edit';
            return world.saveWorldInfo(name, stale, true);
        }, names[0])).toBe(false);
        expect(edits).toHaveLength(0);
        release();
        await expect(page.locator('#world_popup_entries_list textarea[name="comment"]').first()).toHaveValue('Imported replacement');
        await expect(page.locator('#world_popup_entries_list')).not.toHaveAttribute('inert', '');
        expect((await api(page, '/api/worldinfo/get', { name: names[0] })).entries[0].comment).toBe('Imported replacement');
        expect(edits).toHaveLength(0);
    } finally { release(); await cleanup(page, names); }
});

test('a held rename locks both books across reopening and carries the latest draft to its target', async ({ page }) => {
    const names = [`Rename source ${Date.now().toString(36)}`, `Rename target ${Date.now().toString(36)}`];
    await createBooks(page, names);
    let release, began;
    const held = new Promise(resolve => release = resolve), requested = new Promise(resolve => began = resolve);
    const writes = [];
    await page.route('**/api/worldinfo/edit', async route => {
        const body = route.request().postDataJSON(); writes.push(body);
        if (body.name === names[1]) { began(); await held; }
        await route.continue();
    });
    try {
        await page.locator('#world_popup_entries_list textarea[name="comment"]').first().fill('Latest draft before rename');
        await page.locator('#world_popup_name_button').click();
        await page.locator('dialog[open] .popup-input').fill(names[1]);
        await page.locator('dialog[open] .popup-button-ok').click();
        await expect(page.locator('dialog[open]')).toContainText('overwrite');
        await page.locator('dialog[open] .popup-button-ok').click(); await requested;
        await expect(page.locator('#world_popup_entries_list')).toHaveAttribute('inert', '');
        await page.locator('#world_editor_select').selectOption({ label: names[1] });
        await expect(page.locator('#world_popup_entries_list textarea[name="comment"]').first()).toHaveValue(names[1]);
        await expect(page.locator('#world_popup_entries_list')).toHaveAttribute('inert', '');
        await page.locator('#world_editor_select').selectOption({ label: names[0] });
        await expect(page.locator('#world_popup_entries_list textarea[name="comment"]').first()).toHaveValue('Latest draft before rename');
        await expect(page.locator('#world_popup_entries_list')).toHaveAttribute('inert', '');
        const rejected = await page.evaluate(async names => {
            const world = await import('/scripts/world-info.js');
            return Promise.all(names.map(async name => { const draft = structuredClone(await world.loadWorldInfo(name)); draft.entries[0].comment = 'Forbidden during rename'; return world.saveWorldInfo(name, draft, true); }));
        }, names);
        expect(rejected).toEqual([false, false]);
        expect(writes.filter(write => write.name === names[1])).toHaveLength(1);
        release();
        await expect(page.locator('#world_editor_select option').filter({ hasText: names[0] })).toHaveCount(0);
        await expect(page.locator('#world_popup_entries_list textarea[name="comment"]').first()).toHaveValue('Latest draft before rename');
        await expect(page.locator('#world_popup_entries_list')).not.toHaveAttribute('inert', '');
        expect((await api(page, '/api/worldinfo/get', { name: names[1] })).entries[0].comment).toBe('Latest draft before rename');
    } finally {
        release(); await page.unrouteAll({ behavior: 'wait' });
        const remaining = await page.evaluate(async () => { const world = await import('/scripts/world-info.js'); await world.updateWorldInfoList(); return world.world_names; });
        for (const name of names.filter(name => remaining.includes(name))) await api(page, '/api/worldinfo/delete', { name });
    }
});

test('a failed draft Retry cannot write through a pending import operation', async ({ page }) => {
    const name = `Import retry lock ${Date.now().toString(36)}`;
    await createBooks(page, [name]);
    let release, began;
    const held = new Promise(resolve => release = resolve), requested = new Promise(resolve => began = resolve);
    try {
        await page.route('**/api/worldinfo/edit', route => route.fulfill({ status: 503, json: { error: 'Synthetic initial draft failure' } }));
        await page.locator('#world_popup_entries_list textarea[name="comment"]').first().fill('Failed old draft');
        await expect(page.locator('#world_info_save_status')).toContainText('Not saved');
        await page.unroute('**/api/worldinfo/edit');
        const retry = page.locator('#world_info_save_status button');
        await expect(retry).toBeEnabled();
        const writes = [];
        page.on('request', request => { if (request.url().endsWith('/api/worldinfo/edit')) writes.push(request.postDataJSON()); });
        await page.route('**/api/worldinfo/import', async route => { began(); await held; await route.continue(); });
        await page.locator('#world_import_file').setInputFiles({ name: `${name}.json`, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(book('Imported after failed draft'))) });
        await expect(page.locator('dialog[open]')).toContainText('overwrite');
        await page.locator('dialog[open] .popup-button-ok').click(); await requested;
        await expect(retry).toBeDisabled();
        await retry.evaluate(node => node.onclick());
        expect(writes).toHaveLength(0);
        release();
        await expect(page.locator('#world_popup_entries_list textarea[name="comment"]').first()).toHaveValue('Imported after failed draft');
        await expect(page.locator('#world_popup_entries_list')).not.toHaveAttribute('inert', '');
        expect((await api(page, '/api/worldinfo/get', { name })).entries[0].comment).toBe('Imported after failed draft');
        expect(writes).toHaveLength(0);
    } finally { release(); await cleanup(page, [name]); }
});
