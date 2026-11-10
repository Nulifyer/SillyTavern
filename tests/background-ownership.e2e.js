import { test, expect } from '@playwright/test';
import fs from 'node:fs';

test.use({ channel: 'chromium', video: 'off', viewport: { width: 1280, height: 844 } });
test.setTimeout(60000);
const pixel = fs.readFileSync(new URL('../default/content/backgrounds/_white.jpg', import.meta.url));
const original = '/_audit/background-original.jpg';
const sentinel = '/_audit/background-sentinel.jpg';

async function startStory(page) {
    if (!await page.locator('#workspace-navigation [data-workspace-action="characters"]').isVisible()) await page.locator('#workspace-menu').click();
    await page.locator('#workspace-navigation [data-workspace-action="characters"]').click();
    await page.locator('.workspace-library-card').first().click();
    await page.getByRole('button', { name: 'Start new story', exact: true }).click();
    await expect(page.locator('#send_textarea')).toBeVisible();
    return page.evaluate(async () => (await import('/script.js')).getCurrentChatId());
}

async function openStory(page, file) {
    if (await page.locator('#workspace-settings-shell').isVisible()) await page.locator('[data-workspace-action="close-panel"]').click();
    await page.evaluate(async file => (await import('/script.js')).openCharacterChat(file), file);
    await expect(page.locator('#send_textarea')).toBeVisible();
}

async function metadata(page, files) {
    return page.evaluate(async files => {
        const s = await import('/script.js');
        if (files) { s.chat_metadata.chat_backgrounds = files; s.chat_metadata.custom_background = `url("${files[0]}")`; await s.saveMetadata(); await s.eventSource.emit(s.event_types.CHAT_CHANGED); }
        return { identity: s.getCurrentChatIdentity(), files: [...(s.chat_metadata.chat_backgrounds || [])], locked: s.chat_metadata.custom_background };
    }, files);
}

async function backgrounds(page, source = 'chat') {
    if (!await page.locator('#workspace-settings-link').isVisible()) await page.locator('#workspace-menu').click();
    await page.locator('#workspace-settings-link').click();
    if (await page.locator('#workspace-settings-category').isVisible()) await page.locator('#workspace-settings-category').selectOption('backgrounds');
    else await page.locator('.workspace-settings-rail [data-workspace-action="backgrounds"]').click();
    await page.locator(`.bg_tabs_list a[href$="#bg_${source}_tab"]`).click();
}

async function action(page, file, action) {
    const tile = page.locator(`.bg_example[bgfile="${file}"]`);
    await tile.scrollIntoViewIfNeeded(); await tile.focus();
    if (await tile.locator('.mobile-only-menu-toggle').isVisible()) await tile.locator('.mobile-only-menu-toggle').click();
    await tile.locator(`[data-action="${action}"]`).click();
}

async function hold(page, pattern, reply) {
    let release, began;
    const waiting = new Promise(resolve => { release = resolve; });
    const started = new Promise(resolve => { began = resolve; });
    const requests = [];
    await page.route(pattern, async route => {
        const request = route.request();
        const body = request.headers()['content-type']?.includes('application/json') ? request.postDataJSON() : { contentType: request.headers()['content-type'] };
        if (body.image) body.image = `[${body.image.length} encoded image characters]`;
        requests.push(body);
        began(); await waiting; await reply(route);
    });
    return { started, requests, release };
}

async function api(page, url, body) {
    return page.evaluate(async ({ url, body }) => {
        const { getRequestHeaders } = await import('/script.js');
        const response = await fetch(url, { method: 'POST', headers: getRequestHeaders(), body: JSON.stringify(body) });
        if (!response.ok) throw new Error(`Synthetic setup failed: ${response.status}`);
        return response.json();
    }, { url, body });
}

async function folders(page) {
    const result = [];
    for (const name of [`Owner A ${Date.now()}`, `Owner B ${Date.now()}`]) {
        const folder = await api(page, '/api/image-metadata/folders/create', { name });
        await api(page, '/api/image-metadata/folders/assign', { id: folder.id, paths: ['backgrounds/_white.jpg', 'backgrounds/_black.jpg'] });
        await api(page, '/api/image-metadata/folders/update', { id: folder.id, thumbnailFile: '_black.jpg' });
        result.push(folder);
    }
    await page.evaluate(async () => (await import('/scripts/backgrounds.js')).getBackgrounds());
    return result;
}

async function folderAction(page, folder, actionName) {
    const tile = page.locator(`.bg_folder_tile[data-folder-id="${folder.id}"]`);
    await tile.scrollIntoViewIfNeeded(); await tile.focus();
    await tile.locator(`[data-action="${actionName}"]`).click();
}

test.beforeEach(async ({ page }) => {
    page.errors = []; page.on('pageerror', error => page.errors.push(error.message));
    let saved;
    await page.route('**/api/settings/get', async route => {
        const response = await route.fetch(), body = await response.json(), s = saved || JSON.parse(body.settings);
        s.firstRun = false; s.active_character = null; s.active_group = null; s.main_api = 'openai'; s.power_user.auto_connect = false;
        s.extension_settings.tts = { ...s.extension_settings.tts, enabled: false, currentProvider: 'System' }; s.extension_settings.apiUrl = '';
        s.accountStorage = { ...s.accountStorage, workspaceLayout: 'true', workspaceAdvancedSettings: 'false' };
        body.settings = JSON.stringify(s); await route.fulfill({ response, json: body });
    });
    await page.route('**/api/settings/save', async route => { saved = route.request().postDataJSON(); await route.fulfill({ json: { result: 'ok' } }); });
    await page.route('**/_audit/**', route => route.fulfill({ contentType: 'image/jpeg', body: pixel }));
    await page.goto('/'); await expect(page.locator('#preloader')).toHaveCount(0, { timeout: 30000 });
    page.storyA = await startStory(page); await metadata(page, [original]);
    page.storyB = await startStory(page); await metadata(page, [sentinel]);
    await openStory(page, page.storyA);
});

test.afterEach(async ({ page }, info) => {
    fs.writeFileSync(info.outputPath('browser-errors.json'), JSON.stringify(page.errors, null, 2));
    expect(page.errors).toEqual([]);
});

for (const change of ['another story', 'same story reload']) {
    test(`pending chat-background upload cannot attach after ${change}`, async ({ page }, info) => {
        await backgrounds(page);
        const pending = await hold(page, '**/api/images/upload', route => route.fulfill({ json: { path: '/_audit/upload-result.jpg' } }));
        try {
            await page.locator('#add_bg_button').setInputFiles({ name: 'ownership.jpg', mimeType: 'image/jpeg', buffer: pixel });
            await pending.started;
            await openStory(page, change === 'another story' ? page.storyB : page.storyA);
            const before = await metadata(page);
            pending.release();
            await expect(page.locator('.toast-message').filter({ hasText: /story|background view changed/i })).toBeVisible();
            expect(await metadata(page)).toEqual(before);
            fs.writeFileSync(info.outputPath('owner.json'), JSON.stringify({ change, before, after: await metadata(page), requests: pending.requests.length }, null, 2));
        } finally { pending.release(); fs.writeFileSync(info.outputPath('settled-owner.json'), JSON.stringify({ change, active: await metadata(page), requests: pending.requests }, null, 2)); }
    });
}

test('pending custom-background copy cannot remove a newly opened story background', async ({ page }, info) => {
    await backgrounds(page);
    const pending = await hold(page, '**/api/backgrounds/upload', route => route.fulfill({ body: '_audit-copied.jpg' }));
    try {
        await action(page, original, 'copy');
        await page.locator('dialog[open] .popup-input').fill('_audit-copied');
        await page.locator('dialog[open] .popup-button-ok').click(); await pending.started;
        await openStory(page, page.storyB); const before = await metadata(page);
        pending.release();
        await expect(page.locator('.toast-message').filter({ hasText: /story|background view changed/i })).toBeVisible();
        expect(await metadata(page)).toEqual(before);
        fs.writeFileSync(info.outputPath('owner.json'), JSON.stringify({ before, after: await metadata(page), requests: pending.requests.length }, null, 2));
    } finally { pending.release(); fs.writeFileSync(info.outputPath('settled-owner.json'), JSON.stringify({ active: await metadata(page), requests: pending.requests }, null, 2)); }
});

test('video conversion retains its source tab before any upload request', async ({ page }, info) => {
    await backgrounds(page, 'global');
    let uploads = 0;
    await page.route('**/api/backgrounds/upload', route => { uploads++; return route.fulfill({ body: '_white.jpg' }); });
    await page.route('**/api/images/upload', route => { uploads++; return route.fulfill({ json: { path: '/_audit/converted.jpg' } }); });
    await page.evaluate(() => {
        window.convertVideoToAnimatedWebp = () => new Promise(resolve => { window.__releaseBackgroundVideo = resolve; window.__backgroundVideoStarted = true; });
    });
    const before = await metadata(page);
    await page.locator('#add_bg_button').setInputFiles({ name: 'ownership.mp4', mimeType: 'video/mp4', buffer: Buffer.from([1, 2, 3]) });
    await page.waitForFunction(() => window.__backgroundVideoStarted);
    await page.locator('.bg_tabs_list a[href$="#bg_chat_tab"]').click();
    await page.evaluate(() => window.__releaseBackgroundVideo(new Uint8Array([1, 2, 3])));
    await expect(page.locator('.toast-message').filter({ hasText: /story|background view changed/i })).toBeVisible();
    expect(uploads).toBe(0); expect(await metadata(page)).toEqual(before);
    fs.writeFileSync(info.outputPath('conversion-owner.json'), JSON.stringify({ before, after: await metadata(page), uploads }, null, 2));
});

test('pending global upload preserves a newer background selection', async ({ page }, info) => {
    await backgrounds(page, 'global');
    await page.locator('.bg_example[bgfile="_black.jpg"]').click();
    const pending = await hold(page, '**/api/backgrounds/upload', route => route.fulfill({ body: '_black.jpg' }));
    try {
        await page.locator('#add_bg_button').setInputFiles({ name: 'selection.jpg', mimeType: 'image/jpeg', buffer: pixel }); await pending.started;
        await page.locator('.bg_example[bgfile="_white.jpg"]').click();
        const before = await page.evaluate(async () => ({ ...(await import('/scripts/backgrounds.js')).background_settings }));
        pending.release();
        await expect(page.locator('.toast-message').filter({ hasText: /story|background view changed/i })).toBeVisible();
        expect(await page.evaluate(async () => ({ ...(await import('/scripts/backgrounds.js')).background_settings }))).toEqual(before);
        fs.writeFileSync(info.outputPath('selection-owner.json'), JSON.stringify({ before, requests: pending.requests.length }, null, 2));
    } finally { pending.release(); }
});

test('pending custom deletion cannot save or remove metadata after switching stories', async ({ page }, info) => {
    await backgrounds(page);
    const pending = await hold(page, '**/api/images/delete', route => route.fulfill({ json: { ok: true } }));
    try {
        await action(page, original, 'delete'); await page.locator('dialog[open] .popup-button-ok').click(); await pending.started;
        await openStory(page, page.storyB); const before = await metadata(page);
        const saved = [];
        page.on('request', request => { if (request.url().endsWith('/api/chats/save')) saved.push(request.postDataJSON()); });
        pending.release();
        await expect(page.locator('.toast-message').filter({ hasText: /story|background view changed/i })).toBeVisible();
        expect(await metadata(page)).toEqual(before); expect(saved).toHaveLength(0);
        await openStory(page, page.storyA); expect((await metadata(page)).files).toEqual([original]);
        fs.writeFileSync(info.outputPath('delete-owner.json'), JSON.stringify({ before, currentAfter: await metadata(page), lateSaves: saved.length, requests: pending.requests }, null, 2));
    } finally { pending.release(); }
});

test('failed custom deletion keeps the original entry and can be retried', async ({ page }) => {
    await backgrounds(page);
    await page.route('**/api/images/delete', route => route.fulfill({ status: 503, body: 'Synthetic media failure' }));
    await action(page, original, 'delete'); await page.locator('dialog[open] .popup-button-ok').click();
    await expect(page.locator('.toast-title').filter({ hasText: 'Could not delete image' })).toBeVisible();
    expect((await metadata(page)).files).toEqual([original]);
    await expect(page.locator(`.bg_example[bgfile="${original}"]`)).toBeVisible();
    await page.unroute('**/api/images/delete');
    await page.route('**/api/images/delete', route => route.fulfill({ json: { ok: true } }));
    await action(page, original, 'delete'); await page.locator('dialog[open] .popup-button-ok').click();
    await expect.poll(async () => (await metadata(page)).files).toEqual([]);
    await expect(page.locator(`.bg_example[bgfile="${original}"]`)).toHaveCount(0);
});

test('quiet background generation cannot apply its answer to a newly opened story', async ({ page }, info) => {
    await page.evaluate(async () => {
        const s = await import('/script.js'), { oai_settings } = await import('/scripts/openai.js');
        Object.assign(oai_settings, { chat_completion_source: 'custom', custom_model: 'background-fixture', custom_url: 'http://127.0.0.1:59994/v1', stream_openai: false });
        s.setOnlineStatus('Synthetic local background provider');
    });
    await backgrounds(page, 'global');
    const pending = await hold(page, '**/api/backends/chat-completions/generate', route => route.fulfill({ json: { choices: [{ message: { role: 'assistant', content: '_white' }, finish_reason: 'stop' }] } }));
    try {
        await page.locator('#auto_background').click(); await pending.started;
        await openStory(page, page.storyB); const before = await metadata(page);
        pending.release();
        await expect(page.locator('.toast-message').filter({ hasText: /story|background view changed/i })).toBeVisible();
        expect(await metadata(page)).toEqual(before);
        fs.writeFileSync(info.outputPath('quiet-owner.json'), JSON.stringify({ before, after: await metadata(page), requests: pending.requests.length }, null, 2));
    } finally { pending.release(); }
});

test('pending cover update preserves another folder and sends one request', async ({ page }, info) => {
    await backgrounds(page, 'global'); const [a, b] = await folders(page);
    await page.locator(`.bg_folder_tile[data-folder-id="${a.id}"]`).click();
    const pending = await hold(page, '**/api/image-metadata/folders/update', route => route.continue());
    try {
        await action(page, '_white.jpg', 'set-cover'); await pending.started;
        const control = page.locator('.bg_example[bgfile="_white.jpg"] [data-action="set-cover"]');
        await expect(control).toHaveAttribute('aria-disabled', 'true');
        await control.evaluate(node => { node.click(); node.click(); });
        expect(pending.requests).toHaveLength(1);
        await page.locator('#bg_back_to_folders').click(); await page.locator(`.bg_folder_tile[data-folder-id="${b.id}"]`).click();
        const cover = page.locator(`.bg_folder_tile[data-folder-id="${b.id}"] .bg_folder_tile_cover`);
        const before = await cover.evaluate(node => getComputedStyle(node).backgroundImage);
        pending.release();
        await expect(page.locator('.toast-message').filter({ hasText: /story|background view changed/i })).toBeVisible();
        await expect(page.locator('#bg_current_folder_name')).toHaveText(b.name);
        expect(await cover.evaluate(node => getComputedStyle(node).backgroundImage)).toBe(before);
        expect(pending.requests[0].id).toBe(a.id);
        await page.locator('#bg_back_to_folders').click();
        await page.evaluate(async () => (await import('/scripts/backgrounds.js')).getBackgrounds());
        await expect(page.locator(`.bg_folder_tile[data-folder-id="${a.id}"] .bg_folder_tile_cover`)).toHaveCSS('background-image', /_white\.jpg/);
        fs.writeFileSync(info.outputPath('cover-owner.json'), JSON.stringify({ a, b, before, requests: pending.requests }, null, 2));
    } finally { pending.release(); }
});

test('cover HTTP failure restores controls and permits a successful retry', async ({ page }) => {
    await backgrounds(page, 'global'); const [a] = await folders(page);
    await page.locator(`.bg_folder_tile[data-folder-id="${a.id}"]`).click();
    await page.route('**/api/image-metadata/folders/update', route => route.fulfill({ status: 503, body: 'Synthetic cover failure' }));
    await action(page, '_white.jpg', 'set-cover');
    await expect(page.locator('.toast-message').filter({ hasText: 'Failed to set folder cover' })).toBeVisible();
    await expect(page.locator('.bg_example[bgfile="_white.jpg"] [data-action="set-cover"]')).not.toHaveAttribute('aria-disabled', 'true');
    await page.unroute('**/api/image-metadata/folders/update');
    await action(page, '_white.jpg', 'set-cover');
    await expect(page.locator('.toast-message').filter({ hasText: 'Folder cover updated' })).toBeVisible();
    await page.locator('#bg_back_to_folders').click();
    await expect(page.locator(`.bg_folder_tile[data-folder-id="${a.id}"] .bg_folder_tile_cover`)).toHaveCSS('background-image', /_white\.jpg/);
});

test('folder create rename and delete HTTP failures show feedback and remain retryable', async ({ page }) => {
    await backgrounds(page, 'global'); const name = `Retry folder ${Date.now()}`;
    await page.route('**/api/image-metadata/folders/create', route => route.fulfill({ status: 503, body: 'Synthetic create failure' }));
    await page.locator('#bg_add_folder_button').click(); await page.locator('dialog[open] .popup-input').fill(name); await page.locator('dialog[open] .popup-button-ok').click();
    await expect(page.locator('.toast-message').filter({ hasText: 'Failed to create folder' })).toBeVisible();
    await page.unroute('**/api/image-metadata/folders/create');
    await page.locator('#bg_add_folder_button').click(); await page.locator('dialog[open] .popup-input').fill(name); await page.locator('dialog[open] .popup-button-ok').click();
    const tile = page.locator('#bg_folder_grid .bg_folder_tile').filter({ hasText: name }); await expect(tile).toBeVisible();
    const folder = { id: await tile.getAttribute('data-folder-id') };
    await page.route('**/api/image-metadata/folders/update', route => route.fulfill({ status: 503, body: 'Synthetic rename failure' }));
    await folderAction(page, folder, 'rename-folder'); await page.locator('dialog[open] .popup-input').fill(`${name} renamed`); await page.locator('dialog[open] .popup-button-ok').click();
    await expect(page.locator('.toast-message').filter({ hasText: 'Failed to rename folder' })).toBeVisible();
    await expect(tile).toHaveText(name);
    await page.unroute('**/api/image-metadata/folders/update');
    await folderAction(page, folder, 'rename-folder'); await page.locator('dialog[open] .popup-input').fill(`${name} renamed`); await page.locator('dialog[open] .popup-button-ok').click();
    await expect(tile).toHaveText(`${name} renamed`);
    await page.route('**/api/image-metadata/folders/delete', route => route.fulfill({ status: 503, body: 'Synthetic delete failure' }));
    await folderAction(page, folder, 'delete-folder'); await page.locator('dialog[open] .popup-button-ok').click();
    await expect(page.locator('.toast-message').filter({ hasText: 'Failed to delete folder' })).toBeVisible(); await expect(tile).toBeVisible();
    await page.unroute('**/api/image-metadata/folders/delete');
    await folderAction(page, folder, 'delete-folder'); await page.locator('dialog[open] .popup-button-ok').click(); await expect(tile).toHaveCount(0);
});

test('chat upload failure retains metadata and retry attaches to the original story', async ({ page }) => {
    await backgrounds(page);
    await page.route('**/api/images/upload', route => route.fulfill({ status: 503, json: { error: 'Synthetic upload failure' } }));
    const file = { name: 'retry-chat.jpg', mimeType: 'image/jpeg', buffer: pixel };
    await page.locator('#add_bg_button').setInputFiles(file);
    await expect(page.locator('.toast-message').filter({ hasText: 'Failed to upload chat background' })).toBeVisible();
    expect((await metadata(page)).files).toEqual([original]);
    await page.unroute('**/api/images/upload');
    await page.route('**/api/images/upload', route => route.fulfill({ json: { path: '/_audit/retried-upload.jpg' } }));
    await page.locator('#add_bg_button').setInputFiles(file);
    await expect.poll(async () => (await metadata(page)).files).toEqual([original, '/_audit/retried-upload.jpg']);
    await expect(page.locator('.bg_example[bgfile="/_audit/retried-upload.jpg"]')).toBeVisible();
    await openStory(page, page.storyA); expect((await metadata(page)).files).toEqual([original, '/_audit/retried-upload.jpg']);
});

test('global upload retries and succeeds while its image is outside the active folder', async ({ page }, info) => {
    await backgrounds(page, 'global'); const [a] = await folders(page);
    await page.locator(`.bg_folder_tile[data-folder-id="${a.id}"]`).click();
    const file = { name: `owner-global-${Date.now()}.jpg`, mimeType: 'image/jpeg', buffer: pixel };
    await page.route('**/api/backgrounds/upload', route => route.fulfill({ status: 503, body: 'Synthetic upload failure' }));
    await page.locator('#add_bg_button').setInputFiles(file);
    await expect(page.locator('.toast-message').filter({ hasText: 'Failed to upload background' })).toBeVisible();
    await page.unroute('**/api/backgrounds/upload');
    const errors = []; page.on('console', message => { if (message.type() === 'error' && /uploading background|Cannot read properties/.test(message.text())) errors.push(message.text()); });
    const response = page.waitForResponse(response => response.url().endsWith('/api/backgrounds/upload') && response.ok());
    await page.locator('#add_bg_button').setInputFiles(file); const uploaded = await (await response).text();
    await expect.poll(() => page.evaluate(async () => (await import('/scripts/backgrounds.js')).background_settings.name)).toBe(uploaded);
    await expect(page.locator('#bg_current_folder_name')).toHaveText(a.name);
    await expect(page.locator(`.bg_example[bgfile="${uploaded}"]`)).toHaveCount(0);
    expect(errors).toEqual([]);
    fs.writeFileSync(info.outputPath('outside-folder-upload.json'), JSON.stringify({ folder: a, uploaded, errors }, null, 2));
});

test('failed custom copy preserves the original and a retry completes normally', async ({ page }) => {
    await backgrounds(page); const name = `owner-copy-${Date.now()}`;
    await page.route('**/api/backgrounds/upload', route => route.fulfill({ status: 503, body: 'Synthetic copy failure' }));
    await action(page, original, 'copy'); await page.locator('dialog[open] .popup-input').fill(name); await page.locator('dialog[open] .popup-button-ok').click();
    await expect(page.locator('.toast-message').filter({ hasText: 'Failed to upload background' })).toBeVisible();
    expect((await metadata(page)).files).toEqual([original]);
    await page.unroute('**/api/backgrounds/upload');
    await action(page, original, 'copy'); await page.locator('dialog[open] .popup-input').fill(name); await page.locator('dialog[open] .popup-button-ok').click();
    await expect.poll(async () => (await metadata(page)).files).toEqual([]);
    await openStory(page, page.storyA); expect((await metadata(page)).files).toEqual([]);
});

test('a newer file selection owns the native upload input', async ({ page }, info) => {
    await backgrounds(page);
    let release, began, requests = 0;
    const held = new Promise(resolve => { release = resolve; }), started = new Promise(resolve => { began = resolve; });
    await page.route('**/api/images/upload', async route => {
        const number = ++requests;
        if (number === 1) { began(); await held; }
        await route.fulfill({ json: { path: `/_audit/input-${number}.jpg` } });
    });
    try {
        await page.locator('#add_bg_button').setInputFiles({ name: 'first.jpg', mimeType: 'image/jpeg', buffer: pixel }); await started;
        await page.locator('#add_bg_button').setInputFiles({ name: 'second.jpg', mimeType: 'image/jpeg', buffer: pixel });
        await expect.poll(async () => (await metadata(page)).files).toEqual([original, '/_audit/input-2.jpg']);
        release();
        await expect(page.locator('.toast-message').filter({ hasText: /story|background view changed/i })).toBeVisible();
        expect((await metadata(page)).files).toEqual([original, '/_audit/input-2.jpg']);
        fs.writeFileSync(info.outputPath('input-owner.json'), JSON.stringify({ requests, files: (await metadata(page)).files }, null, 2));
    } finally { release(); }
});

test('malformed successful upload responses do not corrupt metadata or background settings', async ({ page }) => {
    await backgrounds(page);
    await page.route('**/api/images/upload', route => route.fulfill({ json: {} }));
    await page.locator('#add_bg_button').setInputFiles({ name: 'missing-path.jpg', mimeType: 'image/jpeg', buffer: pixel });
    await expect(page.locator('.toast-message').filter({ hasText: 'Failed to upload chat background' })).toBeVisible();
    expect((await metadata(page)).files).toEqual([original]);
    await page.locator('.bg_tabs_list a[href$="#bg_global_tab"]').click();
    const before = await page.evaluate(async () => ({ ...(await import('/scripts/backgrounds.js')).background_settings }));
    await page.route('**/api/backgrounds/upload', route => route.fulfill({ body: '' }));
    await page.locator('#add_bg_button').setInputFiles({ name: 'missing-name.jpg', mimeType: 'image/jpeg', buffer: pixel });
    await expect(page.locator('.toast-message').filter({ hasText: 'Failed to upload background' })).toBeVisible();
    expect(await page.evaluate(async () => ({ ...(await import('/scripts/backgrounds.js')).background_settings }))).toEqual(before);
});
