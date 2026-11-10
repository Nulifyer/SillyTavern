import { test, expect } from '@playwright/test';
import fs from 'node:fs';

test.use({ channel: 'chromium', video: 'off', viewport: { width: 1280, height: 844 } });
test.setTimeout(90000);
test.skip(!process.env.ST_NATIVE_UI_AUDIT, 'Use ST_NATIVE_UI_AUDIT=1 with a synthetic local fixture.');
const pixel = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(12000); page.ownerDiagnostics = { pageErrors: [], consoleErrors: [], errorResponses: [] };
    page.on('pageerror', error => page.ownerDiagnostics.pageErrors.push(error.stack || error.message));
    page.on('console', message => { if (message.type() === 'error') page.ownerDiagnostics.consoleErrors.push({ text: message.text(), location: message.location() }); });
    page.on('response', response => { if (response.status() >= 400) page.ownerDiagnostics.errorResponses.push({ status: response.status(), url: response.url() }); });
    await page.route('**/api/settings/get', async route => {
        const response = await route.fetch(), body = await response.json(), settings = JSON.parse(body.settings);
        settings.firstRun = false; settings.active_character = null; settings.active_group = null; settings.main_api = 'openai'; settings.power_user.auto_connect = false; settings.power_user.persona_auto_lock = false; settings.power_user.persona_show_notifications = false;
        settings.accountStorage = { ...settings.accountStorage, workspaceLayout: 'true' }; settings.extension_settings.tts = { ...settings.extension_settings.tts, enabled: false, currentProvider: 'System' };
        settings.extension_settings.sd = { ...settings.extension_settings.sd, source: 'sdcpp', sdcpp_url: '', enabled: false };
        settings.extension_settings.quickReplyV2 = { ...settings.extension_settings.quickReplyV2, isEnabled: false };
        body.settings = JSON.stringify(settings); await route.fulfill({ response, json: body });
    });
    await page.goto('/'); await expect(page.locator('#preloader')).toHaveCount(0, { timeout: 30000 });
    await page.locator('#workspace-navigation [data-workspace-action="characters"]').click(); await page.locator('.workspace-library-card[data-entity="character:default_Seraphina.png"]').click();
    await page.getByRole('button', { name: 'Start new story', exact: true }).click(); await expect(page.locator('#send_textarea')).toBeVisible(); await expect(page.locator('#workspace-new-story')).toHaveAttribute('aria-busy', 'false');
});
test.afterEach(async ({ page }, info) => {
    await page.unrouteAll({ behavior: 'wait' });
    fs.writeFileSync(info.outputPath('diagnostics.json'), JSON.stringify(page.ownerDiagnostics, null, 2)); await page.screenshot({ path: info.outputPath('final.png') });
    expect(page.ownerDiagnostics.pageErrors).toEqual([]);
});
async function trackNativeEvent(page, selector, event, key) {
    await page.evaluate(({ selector, event, key }) => {
        const node = document.querySelector(selector), handlers = window.jQuery._data(node, 'events')?.[event];
        if (!handlers?.length) throw new Error(`No native ${event} handler on ${selector}`);
        window[key] = [];
        for (const entry of handlers) {
            const original = entry.handler;
            entry.handler = function (...args) {
                const value = original.apply(this, args), record = { settled: false };
                record.promise = Promise.resolve(value).finally(() => { record.settled = true; });
                window[key].push(record); return value;
            };
            entry.handler.guid = original.guid;
        }
    }, { selector, event, key });
}
async function finishNativeEvent(page, key, index = 0) {
    await page.evaluate(async ({ key, index }) => { await window[key][index].promise; }, { key, index });
}
async function category(page, name) {
    if (!await page.locator('#workspace-settings-shell').isVisible()) await page.locator('#workspace-settings-link').click();
    if (await page.locator('#workspace-settings-category').isVisible()) await page.locator('#workspace-settings-category').selectOption(name);
    else await page.locator(`.workspace-settings-rail [data-workspace-action="${name}"]`).click();
    const controls = page.locator('.workspace-settings-host .service-native-controls');
    for (let i = 0; i < await controls.count(); i++) if (!await controls.nth(i).evaluate(node => node.open)) await controls.nth(i).locator(':scope > summary').click();
}
async function settings(page) { return page.evaluate(async () => structuredClone((await import('/scripts/extensions.js')).extension_settings.sd)); }
async function configureImage(page) {
    await page.route('**/api/sd/**', async route => {
        const path = new URL(route.request().url()).pathname;
        const data = path.endsWith('/sdcpp/models') ? { data: [{ id: 'cpp-model', name: 'CPP model' }] }
            : path.endsWith('/models') ? [{ value: 'auto-model', text: 'Auto model' }, { value: 'auto-next', text: 'Auto next' }]
                : path.endsWith('/workflows') ? ['owner-A.json', 'owner-B.json'] : path.endsWith('/workflow') ? '{}' : path.endsWith('/vaes') ? ['VAE A', 'VAE B']
                    : path.endsWith('/samplers') ? ['Euler'] : path.endsWith('/schedulers') ? ['Simple'] : path.endsWith('/upscalers') ? ['None'] : [];
        if (path.endsWith('/get-model')) await route.fulfill({ body: 'auto-model' });
        else await route.fulfill({ json: data });
    });
    await page.evaluate(async () => { const { extension_settings } = await import('/scripts/extensions.js'); Object.assign(extension_settings.sd, { source: 'sdcpp', comfy_workflow: 'owner-A.json', sdcpp_url: 'https://synthetic.invalid', auto_url: 'https://auto.synthetic.invalid', comfy_url: 'https://comfy.synthetic.invalid', model: 'cpp-model', sampler: 'Euler', scheduler: 'Simple', enabled: true, refine_mode: false, snap: false, seed: 42, width: 768, height: 512 }); });
    await category(page, 'image-settings'); await page.locator('#sd_source').selectOption('sdcpp'); await expect(page.locator('#sd_model')).toHaveValue('cpp-model');
}
async function personaFixture(page) {
    const headers = await page.evaluate(async () => (await import('/script.js')).getRequestHeaders({ omitContentType: true }));
    const upload = await page.request.post('/api/avatars/upload', { headers, multipart: { avatar: { name: 'native-owner.jpg', mimeType: 'image/jpeg', buffer: fs.readFileSync(new URL('../default/content/backgrounds/_white.jpg', import.meta.url)) }, overwrite_name: 'native-owner-persona.png' } });
    expect(upload.ok()).toBe(true);
    return page.evaluate(async () => {
        const s = await import('/script.js'), p = await import('/scripts/personas.js'), { power_user: u } = await import('/scripts/power-user.js');
        const avatars = await p.getUserAvatars(false); if (avatars.length < 2) throw new Error('Synthetic fixture needs two persona avatars.');
        const actors = ['default_Seraphina.png', 'default_Seraphina_1.png'].map(avatar => s.characters.findIndex(character => character.avatar === avatar)); if (actors.some(index => index < 0)) throw new Error('Synthetic fixture needs both Seraphina actors.');
        u.personas = { [avatars[0]]: 'Owner Persona A', [avatars[1]]: 'Owner Persona B' }; u.persona_descriptions = { [avatars[0]]: { connections: [{ type: 'character', id: 'default_Seraphina.png' }] }, [avatars[1]]: { connections: [{ type: 'character', id: 'default_Seraphina_1.png' }] } }; u.default_persona = null; u.persona_auto_lock = false; u.persona_allow_multi_connections = false; s.chat_metadata.tainted = true;
        await p.setUserAvatar(avatars[0]); return { avatars: avatars.slice(0, 2), actors };
    });
}
async function mockStories(page) {
    await page.route('**/api/chats/get', route => {
        const body = route.request().postDataJSON();
        return route.fulfill({ json: [{ chat_metadata: { integrity: `owner-${body.avatar_url}-${body.file_name}`, tainted: true } }, { name: 'Seraphina', mes: 'A neutral greeting.', is_user: false }, { name: 'Original user', force_avatar: 'Original-avatar.png', mes: 'A neutral user turn.', is_user: true }] });
    });
}
async function openStory(page, actor, file) { return page.evaluate(async ({ actor, file }) => (await import('/script.js')).openCharacterChat(file, { characterId: actor }), { actor, file }); }

test('native persona loading distinguishes actors with the same story filename', async ({ page }, info) => {
    const f = await personaFixture(page); await mockStories(page); const file = `persona-shared-${Date.now()}`;
    expect(await openStory(page, f.actors[0], file)).toBe(true); await expect.poll(() => page.evaluate(async () => (await import('/scripts/personas.js')).user_avatar)).toBe(f.avatars[0]);
    expect(await openStory(page, f.actors[1], file)).toBe(true); await expect.poll(() => page.evaluate(async () => (await import('/scripts/personas.js')).user_avatar)).toBe(f.avatars[1]);
    fs.writeFileSync(info.outputPath('persona-owner.json'), JSON.stringify({ ...f, selected: await page.evaluate(async () => (await import('/scripts/personas.js')).user_avatar) }, null, 2));
});

test('failed native avatar loading remains retryable for the same chat', async ({ page }) => {
    const f = await personaFixture(page); await mockStories(page);
    await page.route('**/api/avatars/get', route => route.fulfill({ status: 503, json: { error: 'Synthetic avatars unavailable' } }));
    await openStory(page, f.actors[1], `persona-retry-${Date.now()}`); expect(await page.evaluate(async () => (await import('/scripts/personas.js')).user_avatar)).toBe(f.avatars[0]);
    await page.unroute('**/api/avatars/get'); await page.evaluate(async () => { const s = await import('/script.js'); await s.eventSource.emit(s.event_types.CHAT_CHANGED, s.getCurrentChatId()); });
    expect(await page.evaluate(async () => (await import('/scripts/personas.js')).user_avatar)).toBe(f.avatars[1]);
});

test('held native persona-sync confirmation cannot overwrite a newly opened story', async ({ page }) => {
    const f = await personaFixture(page); await mockStories(page); await openStory(page, f.actors[0], `persona-sync-A-${Date.now()}`);
    await category(page, 'persona'); await trackNativeEvent(page, '#sync_name_button', 'click', '__syncEvents'); await page.locator('#sync_name_button').click(); await expect(page.locator('dialog[open]').last()).toContainText('attributed');
    await openStory(page, f.actors[1], `persona-sync-B-${Date.now()}`);
    const before = await page.evaluate(async () => structuredClone((await import('/script.js')).chat));
    const writes = []; page.on('request', request => { if (request.url().endsWith('/api/chats/save')) writes.push(request.postDataJSON()); });
    const dialog = page.locator('dialog[open]').last(); const opened = await dialog.elementHandle(); await dialog.locator('.popup-button-ok').click();
    await expect.poll(() => opened.evaluate(node => !node.isConnected)).toBe(true); await finishNativeEvent(page, '__syncEvents');
    expect(writes).toEqual([]);
    expect(await page.evaluate(async () => (await import('/script.js')).chat.map(message => ({ name: message.name, avatar: message.force_avatar })))).toEqual(before.map(message => ({ name: message.name, avatar: message.force_avatar })));
});

test('same-story reload rejects a held native image upload', async ({ page }) => {
    await configureImage(page);
    await page.evaluate(async () => { const { extension_settings } = await import('/scripts/extensions.js'); const { secret_state } = await import('/scripts/secrets.js'); extension_settings.sd.source = 'openai'; extension_settings.sd.model = 'dall-e-3'; secret_state.api_key_openai = true; });
    await page.route('**/api/openai/generate-image', route => route.fulfill({ json: { data: [{ b64_json: pixel }] } }));
    let release, began; const held = new Promise(resolve => release = resolve), requested = new Promise(resolve => began = resolve);
    await page.route('**/api/images/upload', async route => { began(); await held; await route.continue(); });
    try {
        await page.evaluate(() => { window.__heldImage = import('/scripts/extensions/stable-diffusion/index.js').then(s => s.generateWorkspaceImage('A neutral blue book')).catch(error => error.name); }); await requested;
        await page.evaluate(async () => (await import('/script.js')).reloadCurrentChat()); const before = await page.evaluate(async () => (await import('/script.js')).chat.length); release();
        expect(await page.evaluate(() => window.__heldImage)).toBe('AbortError'); expect(await page.evaluate(async () => (await import('/script.js')).chat.length)).toBe(before);
    } finally { release(); }
});

test('native Comfy placeholder removal preserves all later entries', async ({ page }) => {
    await configureImage(page); await page.evaluate(async () => (await import('/scripts/extensions.js')).extension_settings.sd.comfy_placeholders = [{ find: 'first', replace: '1' }, { find: 'second', replace: '2' }, { find: 'third', replace: '3' }]);
    await page.locator('#sd_source').selectOption('comfy'); await expect(page.locator('#sd_comfy_workflow')).toHaveValue('owner-A.json');
    await page.locator('#sd_comfy_open_workflow_editor').click(); await page.locator('#sd_comfy_workflow_editor_placeholder_list_custom .sd_comfy_workflow_editor_custom_remove').first().click();
    expect((await settings(page)).comfy_placeholders.map(value => value.find)).toEqual(['second', 'third']);
});

test('native VAE change persists without another settings action', async ({ page }) => {
    await configureImage(page); await page.locator('#sd_source').selectOption('auto'); await expect(page.locator('#sd_vae')).toContainText('VAE A'); await page.locator('#sd_vae').selectOption('VAE A');
    await page.evaluate(async () => { const s = await import('/script.js'); (await import('/scripts/utils.js')).cancelDebounce(s.saveSettingsDebounced); await s.saveSettings(); }); let wrote = false;
    page.on('request', request => { if (request.url().endsWith('/api/settings/save') && request.postDataJSON().extension_settings?.sd?.vae === 'VAE B') wrote = true; });
    await page.locator('#sd_vae').selectOption('VAE B'); await expect.poll(() => wrote, { timeout: 3000 }).toBe(true);
});

test('obsolete inner remote model discovery cannot overwrite a newer source selection', async ({ page }) => {
    await configureImage(page); await trackNativeEvent(page, '#sd_source', 'change', '__sourceEvents'); let release, began; const held = new Promise(resolve => release = resolve), requested = new Promise(resolve => began = resolve);
    await page.route('**/api/sd/get-model', async route => { began(); await held; await route.fulfill({ body: 'obsolete-auto-model' }); });
    try {
        await page.locator('#sd_source').selectOption('auto'); await requested; await page.locator('#sd_source').selectOption('sdcpp'); await expect(page.locator('#sd_model')).toHaveValue('cpp-model'); release();
        await finishNativeEvent(page, '__sourceEvents');
        await expect.poll(async () => (await settings(page)).model).toBe('cpp-model');
    } finally { release(); }
});

test('native model update failure does not announce success', async ({ page }) => {
    await configureImage(page); await page.locator('#sd_source').selectOption('auto'); await expect(page.locator('#sd_model')).toHaveValue('auto-model');
    await trackNativeEvent(page, '#sd_model', 'change', '__modelEvents'); await page.evaluate(() => { window.toastr.clear(); window.__modelSuccess = []; const success = window.toastr.success; window.toastr.success = function (message, ...args) { window.__modelSuccess.push(message); return success.call(this, message, ...args); }; });
    await page.route('**/api/sd/set-model', route => route.fulfill({ status: 503, body: 'Synthetic unavailable model update' }));
    await page.locator('#sd_model').selectOption('auto-next'); await expect(page.locator('.toast-message').filter({ hasText: 'Could not update SD WebUI model' })).toBeVisible(); await finishNativeEvent(page, '__modelEvents');
    expect(await page.evaluate(() => window.__modelSuccess.filter(message => message === 'Model successfully loaded!'))).toEqual([]);
});

test('a native slash image finally cannot overwrite newer width and seed preferences', async ({ page }) => {
    await configureImage(page); let release, began; const held = new Promise(resolve => release = resolve), requested = new Promise(resolve => began = resolve);
    await page.route('**/api/sd/sdcpp/generate', async route => { began(); await held; await route.fulfill({ json: { images: [pixel] } }); });
    try {
        await page.evaluate(() => { window.__slashImage = import('/scripts/slash-commands.js').then(s => s.executeSlashCommandsWithOptions('/imagine quiet=true seed=1 width=640 height=640 A neutral book')); }); await requested;
        await page.locator('#sd_width_value').fill('832'); await page.locator('#sd_seed').fill('99'); release(); await page.evaluate(() => window.__slashImage);
        expect((await settings(page)).width).toBe(832); expect((await settings(page)).seed).toBe(99);
    } finally { release(); }
});

test('a message edited during native paintbrush generation rejects the old result', async ({ page }) => {
    await configureImage(page); await page.evaluate(async () => (await import('/script.js')).saveSettings());
    await page.locator('#workspace-settings-shell [data-workspace-action="close-panel"]').click();
    let release, began; const held = new Promise(resolve => release = resolve), requested = new Promise(resolve => began = resolve);
    await page.route('**/api/sd/sdcpp/generate', async route => { began(); await held; await route.fulfill({ json: { images: [pixel] } }); });
    try {
        const message = page.locator('#chat .mes').first(); await message.locator('.extraMesButtonsHint').click(); await message.locator('.sd_message_gen').click(); await requested;
        await message.locator('.mes_edit').click(); await page.locator('#curEditTextarea').fill('A newer canonical message.'); await message.locator('.mes_edit_done').click();
        release(); await expect(message.locator('.sd_message_gen')).not.toHaveClass(/fa-hourglass/);
        expect(await page.evaluate(async () => (await import('/script.js')).chat[0].extra?.media?.length || 0)).toBe(0);
    } finally { release(); }
});

test('a held VAE discovery cannot replace options for a newer image source', async ({ page }) => {
    await configureImage(page); await trackNativeEvent(page, '#sd_source', 'change', '__sourceEvents'); let release, began; const held = new Promise(resolve => release = resolve), requested = new Promise(resolve => began = resolve);
    await page.route('**/api/sd/vaes', async route => { began(); await held; await route.fulfill({ json: ['obsolete-VAE'] }); });
    try {
        await page.locator('#sd_source').selectOption('auto'); await requested; await page.locator('#sd_source').selectOption('sdcpp'); await expect(page.locator('#sd_vae')).toHaveValue('N/A'); release();
        await finishNativeEvent(page, '__sourceEvents');
        await expect(page.locator('#sd_vae')).toHaveValue('N/A'); await expect(page.locator('#sd_vae')).not.toContainText('obsolete-VAE');
    } finally { release(); }
});

test('a held native workflow editor cannot open under a newer workflow selection', async ({ page }) => {
    await configureImage(page); await page.locator('#sd_source').selectOption('comfy'); await expect(page.locator('#sd_comfy_workflow')).toHaveValue('owner-A.json');
    await trackNativeEvent(page, '#sd_comfy_open_workflow_editor', 'click', '__editorEvents');
    let release, began; const held = new Promise(resolve => release = resolve), requested = new Promise(resolve => began = resolve);
    await page.route('**/api/sd/comfy/workflow', async route => { began(); await held; await route.fulfill({ json: '{"old":"workflow A"}' }); });
    try {
        await page.locator('#sd_comfy_open_workflow_editor').click(); await requested; await page.locator('#sd_comfy_workflow').selectOption('owner-B.json'); release();
        await finishNativeEvent(page, '__editorEvents');
        await expect(page.locator('#sd_comfy_workflow_editor_workflow')).toHaveCount(0);
    } finally { release(); }
});

test('native persona restore rejects null descriptions before changing any persona', async ({ page }) => {
    await category(page, 'persona'); const before = await page.evaluate(async () => structuredClone((await import('/scripts/power-user.js')).power_user.personas)); let uploads = 0;
    page.on('request', request => { if (request.url().endsWith('/api/avatars/upload')) uploads++; });
    await page.locator('#personas_restore_input').setInputFiles({ name: 'invalid-personas.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ personas: { 'null-owner.png': 'Invalid descriptor' }, persona_descriptions: { 'null-owner.png': null } })) });
    await expect(page.locator('.toast-message').filter({ hasText: 'Invalid persona data' })).toBeVisible(); expect(uploads).toBe(0);
    expect(await page.evaluate(async () => (await import('/scripts/power-user.js')).power_user.personas)).toEqual(before);
});

test('manual native persona selection supersedes a held automatic avatar lookup', async ({ page }) => {
    const f = await personaFixture(page); await mockStories(page); await category(page, 'persona'); await expect(page.locator(`#user_avatar_block .avatar-container[data-avatar-id="${f.avatars[0]}"]`)).toBeVisible();
    let release, began; const held = new Promise(resolve => release = resolve), requested = new Promise(resolve => began = resolve);
    await page.route('**/api/avatars/get', async route => { began(); await held; await route.continue(); });
    try {
        await page.evaluate(({ actor, file }) => { window.__heldPersona = import('/script.js').then(s => s.openCharacterChat(file, { characterId: actor })); }, { actor: f.actors[1], file: `manual-persona-${Date.now()}` }); await requested;
        await page.locator(`#user_avatar_block .avatar-container[data-avatar-id="${f.avatars[0]}"]`).click(); release(); await page.evaluate(() => window.__heldPersona);
        expect(await page.evaluate(async () => (await import('/scripts/personas.js')).user_avatar)).toBe(f.avatars[0]);
    } finally { release(); }
});

test('overlapping native image commands retain separate request parameters without temporary preference writes', async ({ page }, info) => {
    await configureImage(page); const before = await settings(page); const requests = [];
    await page.route('**/api/sd/sdcpp/generate', async route => { requests.push(route.request().postDataJSON()); await route.fulfill({ json: { images: [pixel] } }); });
    const results = await page.evaluate(async () => {
        const s = await import('/scripts/slash-commands.js'); return Promise.all([
            s.executeSlashCommandsWithOptions('/imagine quiet=true seed=11 width=640 height=512 A neutral first book').then(result => result.pipe),
            s.executeSlashCommandsWithOptions('/imagine quiet=true seed=22 width=832 height=768 A neutral second book').then(result => result.pipe),
        ]);
    });
    expect(requests.map(request => [request.seed, request.width, request.height]).sort((a, b) => a[0] - b[0])).toEqual([[11, 640, 512], [22, 832, 768]]);
    const after = await settings(page); expect([after.seed, after.width, after.height]).toEqual([before.seed, before.width, before.height]);
    fs.writeFileSync(info.outputPath('concurrent-image-parameters.json'), JSON.stringify({ requests, results, before: { width: before.width, height: before.height, seed: before.seed }, after: { width: after.width, height: after.height, seed: after.seed } }, null, 2));
});

test('a valid native image result leaves a newer unsent composer draft intact', async ({ page }) => {
    await configureImage(page); await page.locator('#workspace-settings-shell [data-workspace-action="close-panel"]').click();
    await page.route('**/api/sd/sdcpp/generate', route => route.fulfill({ json: { images: [pixel] } }));
    let release, began; const held = new Promise(resolve => release = resolve), requested = new Promise(resolve => began = resolve);
    await page.route('**/api/images/upload', async route => { began(); await held; await route.continue(); });
    try {
        const before = await page.evaluate(async () => (await import('/script.js')).chat.length);
        await page.evaluate(() => { window.__draftImage = import('/scripts/extensions/stable-diffusion/index.js').then(s => s.generateWorkspaceImage('A neutral blue book')); }); await requested;
        await page.locator('#send_textarea').fill('A newer unsent turn stays here.'); release(); expect(await page.evaluate(() => window.__draftImage)).toContain('/user/images/');
        await expect(page.locator('#send_textarea')).toHaveValue('A newer unsent turn stays here.'); expect(await page.evaluate(async () => (await import('/script.js')).chat.length)).toBe(before + 1);
    } finally { release(); }
});

test('native Comfy placeholder labels stay literal and removal supports keyboard at phone width', async ({ page }) => {
    await configureImage(page); const key = 'first[<b>&"'; await page.evaluate(async key => (await import('/scripts/extensions.js')).extension_settings.sd.comfy_placeholders = [{ find: key, replace: '1' }, { find: 'keep', replace: '2' }], key);
    await page.locator('#sd_source').selectOption('comfy'); await expect(page.locator('#sd_comfy_workflow')).toHaveValue('owner-A.json'); await page.locator('#sd_comfy_open_workflow_editor').click(); await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('#sd_comfy_workflow_editor_placeholder_list_custom .sd_comfy_workflow_editor_custom_final').first()).toHaveText(`"%${key}%"`); await expect(page.locator('#sd_comfy_workflow_editor_placeholder_list_custom b')).toHaveCount(0);
    const remove = page.getByRole('button', { name: 'Remove custom placeholder', exact: true }).first(); await remove.focus(); await page.keyboard.press('Space');
    expect((await settings(page)).comfy_placeholders.map(item => item.find)).toEqual(['keep']); await expect(page.locator('#sd_comfy_workflow_editor_workflow')).toBeVisible();
});

test('native extend argument uses its request-local writer mode without changing preferences', async ({ page }) => {
    await configureImage(page); await page.route('**/api/sd/sdcpp/generate', route => route.fulfill({ json: { images: [pixel] } }));
    await page.evaluate(async () => {
        const e = await import('/scripts/extensions.js'), shared = await import('/scripts/extensions/shared.js'), s = await import('/script.js');
        e.extension_settings.connectionManager.profiles.push({ id: 'synthetic-mode-writer', name: 'Synthetic mode writer', api: 'custom', 'api-url': 'https://synthetic.invalid/v1', model: 'synthetic-writer' });
        Object.assign(e.extension_settings.sd, { free_extend: false, multimodal_captioning: false, prompt_writer_profile: 'synthetic-mode-writer' }); window.__modeWriterCalls = 0; window.__generationModes = [];
        shared.ConnectionManagerRequestService.sendRequest = async () => { window.__modeWriterCalls++; return { content: 'A neutral expanded image prompt.' }; };
        s.eventSource.on(s.event_types.SD_PROMPT_PROCESSING, data => window.__generationModes.push(data.generationType));
    });
    const result = await page.evaluate(async () => (await (await import('/scripts/slash-commands.js')).executeSlashCommandsWithOptions('/imagine quiet=true extend=true A neutral book')).pipe);
    expect(result).toContain('/user/images/'); expect(await page.evaluate(() => ({ calls: window.__modeWriterCalls, modes: window.__generationModes }))).toEqual({ calls: 1, modes: [11] });
    expect((await settings(page)).free_extend).toBe(false);
});
