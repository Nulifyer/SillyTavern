import { test, expect } from '@playwright/test';
import fs from 'node:fs';

test.use({ channel: 'chromium', video: 'off', viewport: { width: 1280, height: 800 } });
test.setTimeout(90000);
const runId = Date.now().toString(36);

async function api(page, url, body) {
    return page.evaluate(async ({ url, body }) => {
        const { getRequestHeaders } = await import('/script.js');
        const response = await fetch(url, { method: 'POST', headers: getRequestHeaders(), body: JSON.stringify(body) });
        if (!response.ok) throw new Error(`${url}: ${response.status}`);
        const text = await response.text();
        try { return JSON.parse(text); } catch { return text; }
    }, { url, body });
}

async function navigate(page, action) {
    const selector = action === 'settings-page' ? '#workspace-settings-link' : `#workspace-navigation [data-workspace-action="${action}"]`;
    if (!await page.locator(selector).isVisible()) await page.locator('#workspace-menu').click();
    await page.locator(selector).click();
}

async function settingsCategory(page, category, native = true) {
    if (!await page.locator('#workspace-settings-shell').isVisible()) await navigate(page, 'settings-page');
    if (['generation', 'prompts'].includes(category)) {
        await page.locator('.workspace-settings-rail [data-workspace-action="connection"]').click();
        await page.locator(`.workspace-service-tabs [data-service-destination="${category}"]`).click();
    } else await page.locator(`.workspace-settings-rail [data-workspace-action="${category}"]`).click();
    if (native) {
        const controls = page.locator('.workspace-settings-host .service-native-controls');
        for (let i = 0; i < await controls.count(); i++) {
            const control = controls.nth(i);
            if (!await control.evaluate(node => node.open) && await control.locator(':scope > summary').isVisible()) await control.locator(':scope > summary').click();
        }
    }
}

async function serviceCategory(page, service) {
    return settingsCategory(page, { chat: 'connection', writer: 'image-writer', images: 'image-settings', speak: 'voice-settings', transcribe: 'dictation-settings', vision: 'vision-settings' }[service], false);
}

async function profile(page) {
    await navigate(page, 'characters');
    await page.locator('.workspace-library-card').first().click();
    await expect(page.locator('.workspace-profile-intro h1')).toHaveText('Seraphina');
}

async function startStory(page, title) {
    await profile(page);
    await page.getByRole('button', { name: 'Start new story', exact: true }).click();
    await page.locator('dialog[open] .popup-input').fill(title);
    await page.locator('dialog[open] .popup-button-ok').click();
    await expect(page.locator('#workspace-chat-title')).toHaveText(title, { timeout: 20000 });
    await expect(page.locator('#send_textarea')).toBeVisible();
    await expect.poll(async () => (await api(page, '/api/chats/recent', {})).some(record => record.file_name === `${title}.jsonl`)).toBe(true);
}

async function currentAction(page, action) {
    await page.locator('#workspace-header-menu summary').click();
    await page.locator(`#workspace-header-menu [data-workspace-action="${action}"]`).click();
}

async function enableTool(page, name) {
    if (name === 'Voice narration' && await page.locator('#workspace-voice-button').getAttribute('aria-pressed') === 'false') await page.locator('#workspace-voice-button').click();
}

async function returnToChat(page) {
    if (await page.locator('#send_textarea').isVisible()) return;
    if (!await page.locator('#workspace-active-story').isVisible()) await page.locator('#workspace-menu').click();
    await page.locator('#workspace-active-story').click();
}

test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(10000);
    page.workspaceDiagnostics = { pageErrors: [], consoleErrors: [], failedRequests: [] };
    page.on('pageerror', error => page.workspaceDiagnostics.pageErrors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') page.workspaceDiagnostics.consoleErrors.push(message.text()); });
    page.on('requestfailed', request => page.workspaceDiagnostics.failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
    let savedSettings;
    await page.route('**/api/settings/get', async route => {
        const response = await route.fetch();
        const body = await response.json();
        const settings = savedSettings || JSON.parse(body.settings);
        if (!savedSettings) {
            settings.firstRun = false;
            settings.username = 'Storyteller';
            settings.main_api = 'openai';
            settings.active_character = null;
            settings.active_group = null;
            settings.power_user.auto_connect = false;
            settings.accountStorage = { ...settings.accountStorage, workspaceLayout: 'true', workspaceArchivedChats: '[]' };
            settings.extension_settings.serviceConnections = { url: '' };
            settings.extension_settings.tts = { ...settings.extension_settings.tts };
            settings.extension_settings.sd = { ...settings.extension_settings.sd };
            // Fixture runs must not inherit a reachable live provider from the
            // synthetic container used for opt-in service acceptance.
            settings.extension_settings.tts.currentProvider = 'System';
            settings.extension_settings.sd.source = 'extras';
            settings.extension_settings.sd.prompt_writer_profile = '';
            delete settings.extension_settings.tts.enabled;
            delete settings.extension_settings.sd.enabled;
        }
        body.settings = JSON.stringify(settings);
        await route.fulfill({ response, json: body });
    });
    await page.route('**/api/settings/save', async route => {
        savedSettings = route.request().postDataJSON();
        await route.fulfill({ json: { result: 'ok' } });
    });
    await page.goto('/');
    await expect(page.locator('#preloader')).toHaveCount(0, { timeout: 30000 });
    await navigate(page, 'characters');
    await expect(page.locator('.workspace-library-card').first()).toBeVisible();
});

test.afterEach(async ({ page }, testInfo) => {
    if (page.isClosed()) return;
    fs.writeFileSync(testInfo.outputPath('browser-diagnostics.json'), JSON.stringify(page.workspaceDiagnostics, null, 2));
    expect(page.workspaceDiagnostics.pageErrors).toEqual([]);
    await page.evaluate(async () => { const { closeCurrentChat } = await import('/script.js'); await closeCurrentChat(); });
    const prefix = `Workspace e2e ${testInfo.testId}-${runId}`;
    const records = await api(page, '/api/chats/recent', {});
    await page.evaluate(async records => {
        const script = await import('/script.js');
        const group = await import('/scripts/group-chats.js');
        for (const record of records) {
            if (record.group) await group.deleteGroupChatByName(record.group, record.file_name.replace(/\.jsonl$/, ''));
            else {
                const id = script.characters.findIndex(character => character.avatar === record.avatar);
                await script.deleteCharacterChatByName(String(id), record.file_name.replace(/\.jsonl$/, ''));
            }
        }
    }, records.filter(record => record.file_name.startsWith(prefix)));
    const { groups, characters } = await page.evaluate(async () => {
        const script = await import('/script.js');
        const group = await import('/scripts/group-chats.js');
        return { groups: group.groups.map(item => ({ id: item.id, name: item.name })), characters: script.characters.map(item => ({ avatar: item.avatar, name: item.name })) };
    });
    for (const group of groups.filter(group => group.name.startsWith(prefix))) await api(page, '/api/groups/delete', { id: group.id });
    for (const character of characters.filter(character => character.name.startsWith(prefix))) await api(page, '/api/characters/delete', { avatar_url: character.avatar, delete_chats: true });
});

test('library browsing shows profiles without opening or replacing a story', async ({ page }, testInfo) => {
    await expect(page.locator('#workspace-navigation button')).toHaveCount(3);
    await expect(page.locator('#workspace-connection-label')).toHaveText('Connect a model');
    await expect(page.locator('.workspace-library-card').first()).toHaveAccessibleName('Meet Seraphina');
    await page.locator('#workspace-view-search').click();
    await page.keyboard.type('Seraphina');
    await expect(page.locator('#workspace-view-search')).toHaveValue('Seraphina');
    await expect(page.locator('.workspace-library-card')).toHaveCount(1);
    await page.locator('.workspace-library-card').click();
    await expect(page.locator('.workspace-profile-intro h1')).toHaveText('Seraphina');
    await expect(page.locator('#send_textarea')).toBeHidden();
    await expect(page.locator('.workspace-profile-detail[open]')).toHaveCount(0);
    expect(await page.evaluate(async () => (await import('/script.js')).getCurrentChatId())).toBeUndefined();
    await page.screenshot({ path: testInfo.outputPath('workspace-profile-desktop.png') });
});

test('new stories preserve previous transcripts and profile history resumes the exact scene', async ({ page }, testInfo) => {
    const first = `Workspace e2e ${testInfo.testId}-${runId} first`;
    const second = `Workspace e2e ${testInfo.testId}-${runId} second`;
    await startStory(page, first);
    await page.locator('#send_textarea').fill('An unsent turn stays here.');
    await navigate(page, 'characters');
    await expect(page.locator('#send_textarea')).toHaveValue('An unsent turn stays here.');
    await returnToChat(page);
    await expect(page.locator('#send_textarea')).toHaveValue('An unsent turn stays here.');
    await page.locator('#send_textarea').fill('');
    await profile(page);
    await page.getByRole('button', { name: 'Start new story', exact: true }).click();
    await page.locator('dialog[open] .popup-input').fill(first);
    await page.locator('dialog[open] .popup-button-ok').click();
    await expect(page.locator('#toast-container')).toContainText('A story with that title already exists');
    expect(await page.evaluate(async () => (await import('/script.js')).getCurrentChatId())).toBe(first);
    await startStory(page, second);
    await page.locator('#workspace-history').click();
    const row = page.locator('.workspace-profile .workspace-scene-row').filter({ has: page.locator('.workspace-scene-text strong', { hasText: first }) });
    await expect(row).toBeVisible();
    await row.locator('.workspace-scene-open').click();
    await expect(page.locator('#workspace-chat-title')).toHaveText(first);
    const records = await api(page, '/api/chats/recent', {});
    expect(records.some(record => record.file_name === `${second}.jsonl`)).toBe(true);
    await expect(page.locator('#send_textarea')).toBeFocused();
});

test('starting a fresh character creates exactly one transcript, with or without a title', async ({ page }, testInfo) => {
    const prefix = `Workspace e2e ${testInfo.testId}-${runId}`;
    const source = await page.evaluate(async () => (await import('/script.js')).characters[0].avatar);
    const duplicate = await api(page, '/api/characters/duplicate', { avatar_url: source });
    const character = await api(page, '/api/characters/rename', { avatar_url: duplicate.path, new_name: `${prefix} fresh` });
    await page.evaluate(async () => (await import('/script.js')).getCharacters());
    const before = await api(page, '/api/chats/recent', {});
    for (const title of [`${prefix} first`, '']) {
        await navigate(page, 'characters');
        await page.locator('.workspace-library-card').filter({ hasText: `${prefix} fresh` }).click();
        await page.getByRole('button', { name: 'Start new story', exact: true }).click();
        await page.locator('dialog[open] .popup-input').fill(title);
        await page.locator('dialog[open] .popup-button-ok').click();
        await expect(page.locator('#send_textarea')).toBeVisible();
        const current = await page.evaluate(async () => (await import('/script.js')).getCurrentChatId());
        expect(current).toBeTruthy();
        if (title) expect(current).toBe(title);
        const records = (await api(page, '/api/chats/recent', {})).filter(record => record.avatar === character.avatar);
        expect(records).toHaveLength(title ? 1 : 2);
        expect(records.some(record => record.file_name === `${current}.jsonl`)).toBe(true);
    }
    expect((await api(page, '/api/chats/recent', {})).filter(record => record.avatar !== character.avatar)).toEqual(before);
});

test('archive persists, excludes active lists, reads without editing, and restores the same transcript', async ({ page }, testInfo) => {
    const title = `Workspace e2e ${testInfo.testId}-${runId} archive`;
    await startStory(page, title);
    const saved = page.waitForResponse(response => response.url().endsWith('/api/settings/save') && response.request().postDataJSON().accountStorage?.workspaceArchivedChats?.includes(title));
    await currentAction(page, 'archive-chat');
    await saved;
    await expect(page.locator('.workspace-conversations .workspace-scene-text strong').filter({ hasText: title })).toHaveCount(0);
    await expect(page.locator('#workspace-character-list')).not.toContainText(title);
    await page.reload();
    await expect(page.locator('#preloader')).toHaveCount(0, { timeout: 30000 });
    await navigate(page, 'archive');
    const row = page.locator('.workspace-scene-row').filter({ hasText: title });
    await expect(row).toBeVisible();
    await row.locator('.workspace-scene-open').click();
    await expect(page.locator('#form_sheld')).toHaveAttribute('inert', '');
    await currentAction(page, 'restore-chat');
    await expect(page.locator('#form_sheld')).not.toHaveAttribute('inert');
    await navigate(page, 'chats');
    await expect(page.locator('.workspace-conversations .workspace-scene-text strong').filter({ hasText: title })).toBeVisible();
    expect((await api(page, '/api/chats/recent', {})).filter(record => record.file_name === `${title}.jsonl`)).toHaveLength(1);
});

test('rename follows archived identity and deletion requires confirmation without recreating the file', async ({ page }, testInfo) => {
    const original = `Workspace e2e ${testInfo.testId}-${runId} original.jsonl`;
    const renamed = `Workspace e2e ${testInfo.testId}-${runId} renamed`;
    await startStory(page, original);
    await currentAction(page, 'archive-chat');
    await navigate(page, 'archive');
    let row = page.locator('.workspace-scene-row').filter({ hasText: original });
    await row.locator('summary').click();
    await row.locator('[data-workspace-action="rename-chat"]').click();
    await page.locator('dialog[open] .popup-input').fill(`${renamed}/`);
    await page.locator('dialog[open] .popup-button-ok').click();
    row = page.locator('.workspace-scene-row').filter({ hasText: renamed });
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: 'Restore', exact: true }).click();
    await navigate(page, 'chats');
    await page.locator('.workspace-conversations .workspace-scene-row').filter({ hasText: renamed }).locator('.workspace-scene-open').click();
    await currentAction(page, 'delete-chat');
    await expect(page.locator('dialog[open]')).toContainText(renamed);
    await page.keyboard.press('Enter');
    await expect(page.locator('#workspace-chat-title')).toHaveText(renamed);
    expect((await api(page, '/api/chats/recent', {})).some(record => record.file_name === `${renamed}.jsonl`)).toBe(true);
    await currentAction(page, 'delete-chat');
    await page.locator('dialog[open] .popup-button-ok').click();
    await expect(page.locator('#send_textarea')).toBeHidden();
    await expect.poll(async () => (await api(page, '/api/chats/recent', {})).some(record => record.file_name === `${renamed}.jsonl`)).toBe(false);
});

test('failed deletion keeps the story and reports the server failure', async ({ page }, testInfo) => {
    const title = `Workspace e2e ${testInfo.testId}-${runId} failed-delete`;
    await startStory(page, title);
    await page.route('**/api/chats/delete', route => route.fulfill({ status: 500, json: { error: true } }), { times: 1 });
    await currentAction(page, 'delete-chat');
    await page.locator('dialog[open] .popup-button-ok').click();
    await expect(page.locator('#toast-container')).toContainText('could not be deleted');
    expect((await api(page, '/api/chats/recent', {})).some(record => record.file_name === `${title}.jsonl`)).toBe(true);
});

test('settings keep every native area reachable with Escape and focus restoration', async ({ page }) => {
    await navigate(page, 'settings-page');
    const destinations = [
        ['connection', 'rm_api_block'], ['generation', 'left-nav-panel'], ['persona', 'PersonaManagement'],
        ['world', 'WorldInfo'], ['image-settings', 'rm_extensions_block'], ['voice-settings', 'rm_extensions_block'], ['dictation-settings', 'rm_extensions_block'],
        ['settings', 'user-settings-block'], ['backgrounds', 'Backgrounds'], ['prompts', 'AdvancedFormatting'], ['extensions', 'rm_extensions_block'],
    ];
    for (const [action, panel] of destinations) {
        await settingsCategory(page, action);
        await expect(page.locator(`#${panel}`)).toBeVisible();
        await expect(page.locator('.drawer-content.openDrawer')).toHaveCount(1);
        await page.locator('#workspace-settings-shell [data-workspace-action="close-panel"]').focus();
        await expect(page.locator('#workspace-settings-shell [data-workspace-action="close-panel"]')).toBeFocused();
        await expect(page.locator(`#workspace-settings-shell #${panel}`)).toHaveCount(1);
        await page.keyboard.press('Escape');
        await expect(page.locator(`#${panel}`)).toBeHidden();
        await expect(page.locator('#workspace-view')).toBeFocused();
    }
    // Native extensions call this handler with a jQuery object as `this`.
    await page.evaluate(async () => {
        const { doNavbarIconClick } = await import('/script.js');
        await doNavbarIconClick.call($('#sys-settings-button > .drawer-toggle'));
    });
    await expect(page.locator('#workspace-settings-shell #rm_api_block')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.evaluate(async () => {
        const { doNavbarIconClick } = await import('/script.js');
        await doNavbarIconClick.call($('#extensions-settings-button > .drawer-toggle'));
    });
    await expect(page.locator('.workspace-settings-heading h1')).toHaveText('Extensions');
    await expect(page.locator('#workspace-settings-shell .workspace-extension-path')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.evaluate(async () => {
        const { doNavbarIconClick } = await import('/script.js');
        await doNavbarIconClick.call($('#rightNavHolder > .drawer-toggle'));
    });
    await expect(page.locator('.workspace-library-grid')).toBeVisible();
});

test('every settings category uses one control tree and fits desktop and phone', async ({ page }, testInfo) => {
    const categories = ['servers', 'image-writer', 'vision-settings', 'embeddings-settings', 'connection', 'generation', 'persona', 'world', 'image-settings', 'voice-settings', 'dictation-settings', 'settings', 'backgrounds', 'prompts', 'extensions', 'character-editor'];
    const nativeIds = await page.evaluate(() => [...document.querySelectorAll('.drawer-content input[id],.drawer-content select[id],.drawer-content textarea[id]')].map(e => e.id));
    for (const width of [1280, 390, 320]) {
        await page.setViewportSize({ width, height: 844 });
        await navigate(page, 'settings-page');
        for (const category of categories) {
            if (category === 'character-editor') {
                await profile(page);
                await page.getByRole('button', { name: 'Edit character', exact: true }).click();
            } else await settingsCategory(page, category, false);
            const panel = page.locator('.workspace-mounted-panel');
            await expect(panel).toHaveCount(1);
            const bounds = await panel.boundingBox();
            expect(bounds.x).toBeGreaterThanOrEqual(0);
            expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
            expect(await panel.evaluate(e => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
            const done = await page.locator('#workspace-settings-shell [data-workspace-action="close-panel"]').boundingBox();
            expect(done.x + done.width).toBeLessThanOrEqual(width + 1);
            expect(done.y).toBeGreaterThanOrEqual(0);
            if (category === 'world' && width < 900) {
                const picker = page.locator('#world_editor_select + .select2-container');
                const pickerBounds = await picker.boundingBox();
                expect(pickerBounds.width).toBeGreaterThanOrEqual(width - 64);
                await expect(picker.locator('.select2-selection')).toHaveCSS('height', '44px');
                await picker.click();
                await expect(page.locator('.select2-dropdown')).toBeVisible();
                await page.keyboard.press('Escape');
            }
            await page.screenshot({ path: testInfo.outputPath(`settings-${category}-${width}.png`) });
            await page.locator('#workspace-settings-shell [data-workspace-action="close-panel"]').click();
            if (category === 'character-editor') await navigate(page, 'settings-page');
        }
    }
    const after = await page.evaluate(() => [...document.querySelectorAll('.drawer-content input[id],.drawer-content select[id],.drawer-content textarea[id]')].map(e => e.id));
    expect(after.sort()).toEqual(nativeIds.sort());
});

test('settings sections, blank space and external dialogs never close mounted controls', async ({ page }, testInfo) => {
    const failures = [];
    page.on('pageerror', error => failures.push(error.message));
    const ids = await page.locator('.drawer-content input[id], .drawer-content select[id]').evaluateAll(nodes => nodes.map(node => node.id).sort());
    for (const width of [1280, 390, 320]) {
        await page.setViewportSize({ width, height: 844 });
        await navigate(page, 'settings-page');
        for (const [category, sections] of [
            ['generation', ['Presets', 'Advanced sampling & prompts', 'Replies']],
            ['settings', ['Interaction', 'Reading & appearance']],

        ]) {
            await settingsCategory(page, category);
            const panel = page.locator('.workspace-mounted-panel');
            const original = await panel.elementHandle();
            for (let pass = 0; pass < 2; pass++) {
                for (const section of sections) {
                    await page.locator('#workspace-settings-shell').getByRole('button', { name: section, exact: true }).click();
                    await expect(panel).toBeVisible();
                    await expect(panel).toHaveClass(/openDrawer/);
                    await expect.poll(() => original.evaluate(node => node.isConnected && node === document.querySelector('.workspace-mounted-panel'))).toBe(true);
                    await expect(panel.locator('.workspace-section-hidden')).not.toHaveCount(0);
                }
            }
            await page.locator('.workspace-settings-heading h1').click();
            await expect(panel).toBeVisible();
            await page.evaluate(async () => {
                const { callGenericPopup, POPUP_TYPE } = await import('/scripts/popup.js');
                void callGenericPopup('Synthetic settings dialog', POPUP_TYPE.INPUT, 'Draft');
            });
            await page.locator('dialog[open] .popup-input').fill('Edited draft');
            await page.locator('dialog[open] .popup-button-ok').click();
            await expect(page.locator('dialog[open]')).toHaveCount(0);
            await expect(panel).toBeVisible();
            await page.screenshot({ path: testInfo.outputPath(`sections-${category}-${width}.png`) });
            await page.keyboard.press('Escape');
            await expect(panel).toHaveCount(0);
        }
    }
    expect(await page.locator('.drawer-content input[id], .drawer-content select[id]').evaluateAll(nodes => nodes.map(node => node.id).sort())).toEqual(ids);
    expect(failures).toEqual([]);
});

test('settings changes and late saves preserve every category through direct navigation', async ({ page }, testInfo) => {
    test.setTimeout(180000);
    page.setDefaultTimeout(7000);
    const errors = [];
    const checkpoints = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/backends/chat-completions/status', route => route.fulfill({ json: { data: [{ id: 'synthetic-story' }] } }));
    await page.route('**/api/sd/sdcpp/models', route => route.fulfill({ json: { data: [{ id: 'synthetic-image' }] } }));
    // Hold a real settings save across category changes. Completion must not
    // restore a stale panel or remove the mounted controls.
    let releaseSave;
    let pendingSave;
    let delayedRequest;
    const saveGate = new Promise(resolve => releaseSave = resolve);
    const saveStarted = new Promise(resolve => pendingSave = resolve);
    await page.route('**/api/settings/save', async route => {
        delayedRequest = route.request();
        pendingSave();
        await saveGate;
        await route.fallback();
    }, { times: 1 });
    const cases = [
        ['connection', '#custom_model_id', async () => {
            await page.locator('#chat_completion_source').selectOption('custom');
            await page.locator('#custom_api_url_text').fill('https://synthetic.example/v1');
            await page.locator('#custom_model_id').fill('synthetic-story');
            await page.locator('#custom_prompt_post_processing').selectOption('semi_tools');
        }],
        ['generation', '#openai_max_tokens', async () => {
            await page.locator('#openai_max_tokens').fill('128');
            await page.locator('#stream_toggle').check();
        }],
        ['prompts', '#completion_prompt_manager', async () => page.locator('.workspace-service-tabs [data-service-destination="prompts"]').click()],
        ['persona', '#persona_description_position', async () => page.locator('#persona_show_notifications').click()],
        ['world', '#world_info_search', async () => page.locator('#world_info_search').fill('Synthetic forest')],
        ['backgrounds', '#background_fitting', async () => {
            const select = page.locator('#background_fitting');
            await select.selectOption({ index: 1 });
        }],
        ['voice-settings', '#tts_provider', async () => {
            await page.locator('#tts_provider').selectOption('System');
            await page.locator('#tts_settings .workspace-advanced-creative summary').click();
            await page.locator('#tts_narrate_user').click();
        }],
        ['dictation-settings', '#dictation-model', async () => {
            await page.locator('#dictation-endpoint').fill('https://synthetic.example/v1/audio/transcriptions');
            await page.locator('#dictation-model').fill('synthetic-transcription');
        }],
        ['image-settings', '#sd_source', async () => {
            await page.locator('#sd_source').selectOption('sdcpp');
            await page.locator('#sd_sdcpp_url').fill('https://synthetic.example');
            await page.locator('#sd_models_refresh').click();
            await page.locator('#sd_model').selectOption('synthetic-image');
            await page.locator('#sd_sampler').selectOption('euler');
            await page.locator('#sd_scheduler').selectOption('simple');
            await page.locator('#sd_steps_value').fill('8');
            await page.locator('#sd_steps_value').press('Tab');
            await page.locator('#sd_swap_dimensions').click();
        }],
        ['settings', '#avatar_style', async () => page.locator('#avatar_style').selectOption({ index: 1 })],
        ['extensions', '#extensions_notify_updates', async () => page.locator('#extensions_notify_updates').click()],
    ];
    await navigate(page, 'settings-page');
    await settingsCategory(page, 'connection');
    for (const width of [1280, 390, 320]) {
        await page.setViewportSize({ width, height: 844 });
        for (const [category, control, change] of cases) {
            console.log(`Settings mutation: ${width}px ${category}`);
            await settingsCategory(page, category);
            const panel = await page.locator('.workspace-mounted-panel').elementHandle();
            await change();
            if (width === 1280 && category === 'connection') await saveStarted;
            if (width === 1280 && category === 'image-settings') {
                const saved = page.waitForResponse(response => response.request() === delayedRequest);
                releaseSave();
                expect((await saved).ok()).toBe(true);
            }
            await expect(page.locator('#workspace-settings-shell')).toBeVisible();
            await expect(page.locator('.workspace-mounted-panel')).toHaveCount(1);
            await expect(page.locator(control)).toBeVisible();
            expect(await panel.evaluate(node => node.isConnected && node === document.querySelector('.workspace-mounted-panel'))).toBe(true);
            await page.locator(control).scrollIntoViewIfNeeded();
            checkpoints.push({ width, category, control, panel: await panel.getAttribute('id') });
            if (category === 'image-settings') await page.screenshot({ path: testInfo.outputPath(`changed-image-settings-${width}.png`) });
        }
    }
    releaseSave();
    fs.writeFileSync(testInfo.outputPath('settings-changes.json'), JSON.stringify({ checkpoints, errors }, null, 2));
    expect(errors).toEqual([]);
});

function serviceFixture() {
    return {
        root: 'https://synthetic.example', base: 'https://synthetic.example/v1', juiced: true,
        services: {
            chat: { models: [{ id: 'story-fixture' }, { id: 'writer-fixture' }] },
            images: { models: [{ id: 'image-fixture' }] },
            speak: { models: [{ id: 'speech-fixture' }] },
            transcribe: { models: [{ id: 'transcription-fixture' }] },
        },
        protocols: [{ id: 'automatic1111', features: ['txt2img'] }],
    };
}

test('dictation settings remain available when the optional TTS extension is disabled', async ({ page }) => {
    await page.route('**/api/settings/get', async route => {
        const response = await route.fetch();
        const body = await response.json();
        const settings = JSON.parse(body.settings);
        settings.firstRun = false;
        settings.extension_settings.disabledExtensions = [...new Set([...settings.extension_settings.disabledExtensions, 'tts'])];
        body.settings = JSON.stringify(settings);
        await route.fulfill({ response, json: body });
    });
    await page.reload();
    await expect(page.locator('#preloader')).toHaveCount(0, { timeout: 30000 });
    await expect(page.locator('#tts_enabled')).toHaveCount(0);
    await navigate(page, 'settings-page');
    await settingsCategory(page, 'dictation-settings');
    await expect(page.locator('#dictation-endpoint')).toBeVisible();
    await expect(page.locator('#dictation-file')).toBeEnabled();
    await page.locator('#dictation-endpoint').fill('https://synthetic.example/v1/audio/transcriptions');
    await page.locator('#dictation-model').fill('transcription-fixture');
    expect(await page.evaluate(async () => (await import('/scripts/extensions.js')).extension_settings.dictation)).toMatchObject({ model: 'transcription-fixture', endpoint: 'https://synthetic.example/v1/audio/transcriptions' });
});

async function serviceSetup(page) {
    await navigate(page, 'settings-page');
    await settingsCategory(page, 'servers');
    await page.locator('#service-server-url').fill('https://synthetic.example/v1');
    await page.locator('#service-discover').click();
    await expect(page.locator('#service-discovery-status')).toContainText('Connected to Juiced');
}

test('one server configures native services and survives reload without replacing sampling or profiles', async ({ page }) => {
    let discoveryCalls = 0;
    await page.route('**/api/openai/custom/discover', route => {
        if (!route.request().postDataJSON().voice_model) discoveryCalls++;
        return route.fulfill({ json: route.request().postDataJSON().voice_model ? { voices: ['voice-a', 'voice-b'] } : serviceFixture() });
    });
    await page.route('**/api/backends/chat-completions/status', route => route.fulfill({ json: { data: [{ id: 'story-fixture' }, { id: 'writer-fixture' }] } }));
    await page.route('**/api/sd/sdcpp/models', route => route.fulfill({ json: { data: [{ id: 'image-fixture' }] } }));
    const previous = await page.evaluate(async () => {
        const { oai_settings } = await import('/scripts/openai.js');
        const { extension_settings } = await import('/scripts/extensions.js');
        extension_settings.sd.steps = 13;
        extension_settings.sd.scale = 2.5;
        extension_settings.sd.prompt_writer_instructions = 'Preserve the scene and the blue book.';
        extension_settings.sd.prompt_writer_max_tokens = 384;
        return { temp: oai_settings.temp_openai, profiles: structuredClone(extension_settings.connectionManager.profiles), tts: extension_settings.tts.enabled, sd: extension_settings.sd.enabled };
    });
    for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: 844 });
        await serviceSetup(page);
        await serviceCategory(page, 'chat');
        await page.locator('#service-chat-model').selectOption('story-fixture');
        await page.locator('#service-chat-apply').click();
        await expect(page.locator('#service-chat-row')).toContainText('Saved.');
        await serviceCategory(page, 'writer');
        await page.locator('#service-writer-model').selectOption('writer-fixture');
        await page.locator('#service-writer-apply').click();
        await expect(page.locator('#service-writer-row')).toContainText('Saved.');
        await serviceCategory(page, 'images');
        await page.locator('#service-images-model').selectOption('image-fixture');
        await page.locator('#service-images-apply').click();
        await expect(page.locator('#service-images-row')).toContainText('Saved.');
        await serviceCategory(page, 'speak');
        await page.locator('#service-speak-model').selectOption('speech-fixture');
        await expect(page.locator('#service-speak-voice option')).toHaveCount(2);
        await page.locator('#service-speak-voice').selectOption('voice-b');
        await page.locator('#service-speak-apply').click();
        await expect(page.locator('#service-speak-row')).toContainText('Saved.');
        await serviceCategory(page, 'transcribe');
        await page.locator('#service-transcribe-model').selectOption('transcription-fixture');
        await page.locator('#service-transcribe-apply').click();
        await expect(page.locator('#service-transcribe-row')).toContainText('Saved.');
        await page.keyboard.press('Escape');
    }
    const configured = await page.evaluate(async () => {
        const { oai_settings } = await import('/scripts/openai.js');
        const { extension_settings: settings } = await import('/scripts/extensions.js');
        return { chat: { model: oai_settings.custom_model, url: oai_settings.custom_url, temp: oai_settings.temp_openai }, sd: settings.sd, tts: settings.tts, stt: settings.dictation, profiles: settings.connectionManager.profiles };
    });
    expect(configured.chat).toEqual({ model: 'story-fixture', url: 'https://synthetic.example/v1', temp: previous.temp });
    expect(configured.sd).toMatchObject({ source: 'sdcpp', sdcpp_url: 'https://synthetic.example', model: 'image-fixture', steps: 13, scale: 2.5, prompt_writer_max_tokens: 384, prompt_writer_instructions: 'Preserve the scene and the blue book.', enabled: previous.sd });
    expect(configured.profiles).toHaveLength(previous.profiles.length + 1);
    expect(configured.profiles.slice(0, previous.profiles.length)).toEqual(previous.profiles);
    expect(configured.profiles.find(profile => profile.id === configured.sd.prompt_writer_profile)).toMatchObject({ model: 'writer-fixture', 'api-url': 'https://synthetic.example/v1', api: 'custom' });
    expect(configured.tts).toMatchObject({ enabled: previous.tts, currentProvider: 'OpenAI Compatible', 'OpenAI Compatible': { model: 'speech-fixture', available_voices: ['voice-a', 'voice-b'], voiceMap: { '[Default Voice]': 'voice-b' } } });
    expect(configured.stt).toMatchObject({ model: 'transcription-fixture', endpoint: 'https://synthetic.example/v1/audio/transcriptions' });
    await expect.poll(async () => (await page.evaluate(() => document.querySelector('#openai_compatible_model')?.value))).toBe('speech-fixture');
    await page.evaluate(async () => await (await import('/script.js')).saveSettings());
    await page.reload();
    await expect(page.locator('#preloader')).toHaveCount(0, { timeout: 30000 });
    await navigate(page, 'settings-page');
    await settingsCategory(page, 'servers');
    await expect(page.locator('#service-server-url')).toHaveValue('https://synthetic.example');
    await expect(page.locator('#service-chat-model')).toHaveValue('story-fixture');
    await expect(page.locator('#service-writer-model')).toHaveValue('writer-fixture');
    expect(discoveryCalls).toBe(3);
});

test('discovered context uses configured capacity, preserves manual overrides and survives reload', async ({ page }, testInfo) => {
    const data = serviceFixture();
    data.services.chat.models = [{ id: 'story-fixture', context_length: 16384, max_context_window: 262144 }, { id: 'writer-fixture', context_length: 32768 }, { id: 'unknown-fixture' }];
    await page.route('**/api/openai/custom/discover', route => route.fulfill({ json: data }));
    await page.route('**/api/backends/chat-completions/status', route => route.fulfill({ json: { data: data.services.chat.models } }));
    await page.evaluate(async () => {
        const { oai_settings } = await import('/scripts/openai.js');
        oai_settings.custom_context_auto = true;
    });
    await serviceSetup(page);
    await serviceCategory(page, 'chat');
    await page.locator('#service-chat-model').selectOption('story-fixture');
    await page.locator('#service-chat-apply').click();
    await expect(page.locator('#service-chat-context')).toContainText('16,384');
    await expect(page.locator('#service-chat-auto-context')).toBeChecked();
    expect(await page.evaluate(async () => (await import('/scripts/openai.js')).oai_settings.openai_max_context)).toBe(16384);
    await settingsCategory(page, 'generation');
    await page.locator('#openai_max_context_counter').fill('8192');
    await page.locator('#openai_max_context_counter').press('Tab');
    await serviceCategory(page, 'chat');
    await expect(page.locator('#service-chat-auto-context')).not.toBeChecked();
    await page.locator('#service-chat-model').selectOption('writer-fixture');
    await page.locator('#service-chat-apply').click();
    await expect(page.locator('#service-chat-context')).toContainText('Custom: 8,192');
    await page.locator('#service-chat-auto-context').check();
    await expect(page.locator('#service-chat-context')).toContainText('Automatic: 32,768');
    await page.locator('#service-chat-model').selectOption('unknown-fixture');
    await page.locator('#service-chat-apply').click();
    await expect(page.locator('#service-chat-context')).toContainText('not reported');
    expect(await page.evaluate(async () => (await import('/scripts/openai.js')).oai_settings.openai_max_context)).toBe(32768);
    await page.locator('#service-chat-model').selectOption('story-fixture');
    await page.locator('#service-chat-apply').click();
    await page.evaluate(async () => await (await import('/script.js')).saveSettings());
    await page.reload();
    await expect(page.locator('#preloader')).toHaveCount(0, { timeout: 30000 });
    await serviceCategory(page, 'chat');
    await expect(page.locator('#service-chat-context')).toContainText('Automatic: 16,384');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: testInfo.outputPath('discovered-context-phone.png') });
    const ids = await page.locator('#service-chat-auto-context').count();
    expect(ids).toBe(1);
    await settingsCategory(page, 'generation');
    await page.locator('[data-workspace-action="settings-section"][data-section="Presets"]').click();
    await page.evaluate(async () => { (await import('/scripts/openai.js')).oai_settings.bind_preset_to_connection = false; });
    await page.locator('#settings_preset_openai').selectOption({ index: 0 });
    await page.evaluate(async () => await (await import('/scripts/openai.js')).getPresetApplicationPromise());
    await serviceCategory(page, 'chat');
    await expect(page.locator('#service-chat-auto-context')).not.toBeChecked();
});

test('service prompt editors save native values and composer nodes survive classic round trips', async ({ page }, testInfo) => {
    await startStory(page, `Workspace e2e ${testInfo.testId}-${runId} prompts`);
    const editor = await page.locator('#send_textarea').elementHandle();
    const form = await page.locator('#send_form').elementHandle();
    await page.locator('#send_textarea').fill('A synthetic draft with a blue book.');
    await settingsCategory(page, 'prompts', false);
    const manager = await page.locator('#completion_prompt_manager').elementHandle();
    await page.locator('.completion_prompt_manager_prompt[data-pm-identifier="main"] .prompt-manager-edit-action').click();
    await page.locator('#completion_prompt_manager_popup_entry_form_prompt').fill('Write the next neutral scene with {{char}} and {{user}}.');
    await page.locator('#completion_prompt_manager_popup_entry_form_save').click();
    await expect(page.locator('#completion_prompt_manager_popup')).toBeHidden();
    await expect(page.locator('.workspace-mounted-panel')).toBeVisible();
    await settingsCategory(page, 'image-writer', false);
    await page.locator('#service-image-prompt-purpose').selectOption('sd_prompt_2');
    await page.locator('#sd_prompt_2').fill('Preserve the current blue book and red teapot.');
    await page.locator('#service-image-prompt-purpose').selectOption('sd_prompt_0');
    await expect(page.locator('#sd_prompt_2')).toBeHidden();
    await page.locator('#service-image-prompt-purpose').selectOption('sd_prompt_2');
    await expect(page.locator('#sd_prompt_2')).toHaveValue('Preserve the current blue book and red teapot.');
    await page.screenshot({ path: testInfo.outputPath('image-prompts.png') });
    await settingsCategory(page, 'settings');
    await page.locator('#workspace-layout-toggle').uncheck();
    await expect(page.locator('body')).not.toHaveClass(/workspace-ui/);
    expect(await editor.evaluate(node => node === document.getElementById('send_textarea'))).toBe(true);
    expect(await form.evaluate(node => node === document.getElementById('send_form') && node.parentElement.id === 'form_sheld')).toBe(true);
    expect(await manager.evaluate(node => node.parentElement.id !== 'AdvancedFormatting')).toBe(true);
    await page.locator('#user-settings-button > .drawer-toggle').click();
    await page.locator('#workspace-layout-toggle').check();
    await expect(page.locator('body')).toHaveClass(/workspace-ui/);
    await returnToChat(page);
    await expect(page.locator('#send_textarea')).toHaveValue('A synthetic draft with a blue book.');
    await settingsCategory(page, 'prompts', false);
    await page.locator('.completion_prompt_manager_prompt[data-pm-identifier="main"] .prompt-manager-edit-action').click();
    await expect(page.locator('#completion_prompt_manager_popup_entry_form_prompt')).toHaveValue('Write the next neutral scene with {{char}} and {{user}}.');
    await page.locator('#completion_prompt_manager_popup_entry_form_close').click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: testInfo.outputPath('story-prompts-phone.png') });
});

for (const existing of [false, true]) {
    test(`${existing ? 'existing explicit' : 'fresh'} compatible connection migrates context preference`, async ({ page }) => {
        await page.route('**/api/settings/get', async route => {
            const response = await route.fetch();
            const body = await response.json();
            const settings = JSON.parse(body.settings);
            settings.firstRun = false;
            settings.main_api = 'openai';
            settings.oai_settings.custom_url = existing ? 'https://synthetic.example/v1' : '';
            settings.oai_settings.custom_model = 'story-fixture';
            settings.oai_settings.chat_completion_source = 'custom';
            settings.oai_settings.openai_max_context = 8192;
            delete settings.oai_settings.custom_context_auto;
            settings.extension_settings.serviceConnections = { url: '' };
            settings.accountStorage = { ...settings.accountStorage, workspaceLayout: 'true' };
            body.settings = JSON.stringify(settings);
            await route.fulfill({ response, json: body });
        });
        await page.reload();
        await expect(page.locator('#preloader')).toHaveCount(0, { timeout: 30000 });
        const data = serviceFixture();
        data.services.chat.models[0].context_length = 16384;
        await page.route('**/api/openai/custom/discover', route => route.fulfill({ json: data }));
        await page.route('**/api/backends/chat-completions/status', route => route.fulfill({ json: { data: data.services.chat.models } }));
        await serviceSetup(page);
        await serviceCategory(page, 'chat');
        if (existing) await expect(page.locator('#service-chat-auto-context')).not.toBeChecked();
        else await expect(page.locator('#service-chat-auto-context')).toBeChecked();
        await page.locator('#service-chat-model').selectOption('story-fixture');
        await page.locator('#service-chat-apply').click();
        expect(await page.evaluate(async () => (await import('/scripts/openai.js')).oai_settings.openai_max_context)).toBe(existing ? 8192 : 16384);
    });
}

test('service setup reports failure, missing capability and voice errors; stale requests cannot replace a new server', async ({ page }) => {
    let attempt = 0;
    let voiceAttempts = 0;
    let finishSlow;
    const slow = new Promise(resolve => finishSlow = resolve);
    await page.route('**/api/openai/custom/discover', async route => {
        const body = route.request().postDataJSON();
        if (body.voice_model) return voiceAttempts++ === 0
            ? route.fulfill({ status: 409, json: { error: 'Load the speech model before listing its voices' } })
            : route.fulfill({ json: { voices: ['voice-retry-fixture'] } });
        if (body.url.includes('slow')) { await slow; return route.fulfill({ json: serviceFixture() }).catch(() => {}); }
        if (attempt++ === 0) return route.fulfill({ status: 502, json: { error: 'Synthetic connection failure' } });
        const data = serviceFixture();
        data.services.transcribe = { models: [] };
        return route.fulfill({ json: data });
    });
    await navigate(page, 'settings-page');
    await settingsCategory(page, 'servers');
    await page.locator('#service-server-url').fill('https://synthetic.example');
    await page.locator('#service-discover').click();
    await expect(page.locator('#service-discovery-status')).toContainText('Synthetic connection failure');
    await page.locator('#service-discover').click();
    await expect(page.locator('#service-transcribe-row')).toContainText(/No enabled models|not enabled on this server/);
    await expect(page.locator('#service-transcribe-apply')).toBeDisabled();
    await serviceCategory(page, 'speak');
    await page.locator('#service-speak-model').selectOption('speech-fixture');
    await expect(page.locator('#service-speak-row')).toContainText('Load the speech model');
    await expect(page.locator('#service-speak-apply')).toBeDisabled();
    await page.locator('#service-speak-retry').click();
    await expect(page.locator('#service-speak-voice')).toHaveValue('voice-retry-fixture');
    await expect(page.locator('#service-speak-apply')).toBeEnabled();
    await settingsCategory(page, 'servers');
    await page.locator('#service-server-url').fill('https://slow.example');
    await page.locator('#service-discover').click();
    await expect(page.locator('#service-discovery-status')).toContainText('Checking connection');
    await page.keyboard.press('Escape');
    await navigate(page, 'characters');
    await expect(page.locator('.workspace-library-grid')).toBeVisible();
    await navigate(page, 'settings-page');
    await settingsCategory(page, 'servers');
    await page.locator('#service-server-url').fill('https://new.example');
    finishSlow();
    await expect(page.locator('#service-discovery-status')).toContainText('Verify this address');
    await expect(page.locator('#service-chat-model')).toHaveCount(0);
    await expect(page.locator('#service-server-url')).toHaveValue('https://new.example');
    await page.locator('#service-discover').click();
    await expect(page.locator('#service-chat-model option')).toHaveCount(3);
    await expect(page.locator('.workspace-mounted-panel')).toBeVisible();
});

test('dictation handles permission failure and retry, preserves drafts, never sends, and cancels on story change', async ({ page }, testInfo) => {
    await startStory(page, `Workspace e2e ${testInfo.testId}-${runId} dictation`);
    await page.evaluate(async () => {
        const { configureDictation } = await import('/scripts/dictation.js');
        configureDictation('https://synthetic.example/v1/audio/transcriptions', 'transcription-fixture');
        navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Denied', 'NotAllowedError'); };
    });
    await page.locator('#workspace-dictation').click();
    await expect(page.locator('#dictation-status')).toContainText('Microphone permission denied');
    let requests = 0;
    await page.route('**/api/openai/custom/transcribe-audio', route => {
        requests++;
        const body = route.request().postDataBuffer();
        const wav = body.indexOf('RIFF');
        expect(wav).toBeGreaterThan(0);
        expect(body.readUInt32LE(wav + 24)).toBe(16000);
        expect(body.readUInt16LE(wav + 22)).toBe(1);
        expect(body.readUInt16LE(wav + 34)).toBe(16);
        return route.fulfill({ json: { text: 'A blue book beside a red teapot.' } });
    });
    await page.evaluate(() => {
        navigator.mediaDevices.getUserMedia = async () => {
            const context = new AudioContext();
            const destination = context.createMediaStreamDestination();
            const oscillator = context.createOscillator();
            oscillator.connect(destination);
            oscillator.start();
            window.syntheticAudioContext = context;
            return destination.stream;
        };
    });
    const messages = await page.locator('#chat .mes').count();
    await page.locator('#send_textarea').fill('Draft remains');
    await page.locator('#workspace-dictation').click();
    await expect(page.locator('#dictation-status')).toContainText('Listening');
    await expect.poll(() => page.evaluate(() => window.syntheticAudioContext.currentTime)).toBeGreaterThan(0.2);
    await page.locator('#workspace-dictation').click();
    await expect(page.locator('#dictation-status')).toContainText('Transcript added');
    await expect(page.locator('#send_textarea')).toHaveValue('Draft remains A blue book beside a red teapot.');
    expect(await page.locator('#chat .mes').count()).toBe(messages);
    expect(requests).toBe(1);
    await page.evaluate(async () => { await (await import('/script.js')).eventSource.emit((await import('/script.js')).event_types.CHAT_CHANGED); });
    await page.locator('#workspace-dictation').click();
    await expect(page.locator('#dictation-status')).toContainText('Listening');
    await page.evaluate(async () => { await (await import('/script.js')).eventSource.emit((await import('/script.js')).event_types.CHAT_CHANGED); });
    await expect(page.locator('#dictation-status')).toContainText('Story changed');
    await expect(page.locator('#workspace-dictation')).toHaveAttribute('aria-pressed', 'false');
    expect(requests).toBe(1);
});

test('image writer preserves scene context and story model through failure and retry', async ({ page }, testInfo) => {
    await startStory(page, `Workspace e2e ${testInfo.testId}-${runId} writer retry`);
    await page.evaluate(async () => {
        const { extension_settings: settings } = await import('/scripts/extensions.js');
        const { oai_settings } = await import('/scripts/openai.js');
        const { saveCompatibleProfile } = await import('/scripts/extensions/connection-manager/index.js');
        const { configureImageWriter } = await import('/scripts/extensions/stable-diffusion/index.js');
        oai_settings.custom_model = 'unchanged-story-model';
        settings.sd.source = 'sdcpp';
        settings.sd.sdcpp_url = 'https://synthetic.example';
        settings.sd.model = 'image-fixture';
        settings.sd.enabled = false;
        settings.sd.prompt_writer_max_tokens = 384;
        settings.sd.prompt_writer_instructions = 'Keep the red teapot, blue book and current action.';
        configureImageWriter(await saveCompatibleProfile('Synthetic writer', 'https://synthetic.example/v1', 'writer-fixture'));
        const context = SillyTavern.getContext();
        context.chat.push({ name: 'Storyteller', is_user: true, mes: 'I place the red teapot beside the blue book in the workshop.' });
    });
    let writers = 0, images = 0;
    await page.route('**/api/backends/chat-completions/generate', route => {
        writers++;
        const body = route.request().postDataJSON();
        expect(body).toMatchObject({ model: 'writer-fixture', max_tokens: 384 });
        expect(JSON.stringify(body.messages)).toContain('red teapot beside the blue book');
        expect(JSON.stringify(body.messages)).toContain('Seraphina');
        expect(JSON.stringify(body.messages)).toContain('current action');
        expect(JSON.parse(body.custom_include_body)).toEqual({ chat_template_kwargs: { enable_thinking: false } });
        return route.fulfill(writers === 1 ? { status: 503, json: { error: { message: 'Synthetic writer unavailable' } } } : { json: { choices: [{ message: { content: 'A red teapot beside a blue book in a sunlit workshop.' } }] } });
    });
    await page.route('**/api/sd/sdcpp/generate', route => {
        images++;
        expect(route.request().postDataJSON().prompt).toContain('red teapot beside a blue book');
        return route.fulfill({ json: { images: ['iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jS1kAAAAASUVORK5CYII='] } });
    });
    await page.locator('#workspace-image-button').click();
    await expect(page.locator('#workspace-image-status')).toContainText('API request failed');
    await expect(page.locator('#workspace-image-button')).toBeEnabled();
    expect(images).toBe(0);
    await page.locator('#workspace-image-button').click();
    await expect(page.locator('#workspace-image-status')).toContainText('Illustration added');
    expect(writers).toBe(2);
    expect(images).toBe(1);
    expect(await page.evaluate(async () => (await import('/scripts/openai.js')).oai_settings.custom_model)).toBe('unchanged-story-model');
    expect(await page.evaluate(async () => (await import('/scripts/extensions.js')).extension_settings.sd.enabled)).toBe(false);
});

test('live Juiced first reply with post-history instructions recovers through native prompt formatting', async ({ page }, testInfo) => {
    test.skip(!process.env.ST_JUICED_URL, 'Set ST_JUICED_URL only for an authorized synthetic live run.');
    test.setTimeout(180000);
    const model = 'Qwen3.5-2B';
    const title = `Workspace e2e ${testInfo.testId}-${runId} role-format`;
    const requests = [];
    const pageErrors = [];
    const consoleErrors = [];
    const networkErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    page.on('requestfailed', request => networkErrors.push({ path: new URL(request.url()).pathname, error: request.failure()?.errorText }));
    page.on('request', request => {
        if (request.url().endsWith('/api/backends/chat-completions/generate')) requests.push(request.postDataJSON());
    });
    await navigate(page, 'settings-page');
    await settingsCategory(page, 'servers');
    await page.locator('#service-server-url').fill(process.env.ST_JUICED_URL);
    await page.locator('#service-discover').click();
    await expect(page.locator('#service-discovery-status')).toContainText('Connected to Juiced', { timeout: 30000 });
    await serviceCategory(page, 'chat');
    await page.locator('#service-chat-model').selectOption(model);
    await page.locator('#service-chat-apply').click();
    await expect(page.locator('#workspace-connection-label')).toHaveText('Model connected', { timeout: 30000 });
    await settingsCategory(page, 'connection');
    await page.locator('#custom_prompt_post_processing').selectOption('');
    await page.locator('#customize_additional_parameters').click();
    await page.locator('dialog[open] #custom_include_body').fill('chat_template_kwargs:\n  enable_thinking: false');
    await page.locator('dialog[open] .popup-button-ok').click();
    await page.evaluate(async () => {
        const { oai_settings } = await import('/scripts/openai.js');
        oai_settings.stream_openai = true;
        oai_settings.openai_max_tokens = 64;
        // A native post-history instruction creates a later system message even
        // on the first reply. No chat-template override or server patch is used.
        oai_settings.prompts.find(prompt => prompt.identifier === 'jailbreak').content = 'Keep the red teapot and blue book in the scene. Answer in one short sentence.';
        for (const order of oai_settings.prompt_order) {
            const instruction = order.order.find(prompt => prompt.identifier === 'jailbreak');
            if (instruction) instruction.enabled = true;
        }
    });
    await page.keyboard.press('Escape');
    await startStory(page, title);
    await page.locator('#send_textarea').fill('In this neutral scene a red teapot sits beside a blue book. What is beside the teapot?');
    await page.locator('#send_but').click();
    await expect(page.locator('.toast-error')).toContainText('System message must be at the beginning', { timeout: 60000 });
    await expect(page.locator('#mes_stop')).toBeHidden({ timeout: 60000 });
    await page.screenshot({ path: testInfo.outputPath('first-reply-template-error.png') });
    const failedResponse = await page.locator('.toast-error').last().innerText();
    expect(requests[0].messages.slice(1).some(message => message.role === 'system')).toBe(true);
    await navigate(page, 'settings-page');
    await settingsCategory(page, 'connection');
    await page.locator('#custom_prompt_post_processing').selectOption({ label: 'Semi-strict (alternating roles; with tools)' });
    await page.evaluate(async () => await (await import('/script.js')).saveSettings());
    await page.reload();
    await expect(page.locator('#preloader')).toHaveCount(0, { timeout: 30000 });
    await navigate(page, 'settings-page');
    await settingsCategory(page, 'connection');
    await expect(page.locator('#custom_prompt_post_processing')).toHaveValue('semi_tools');
    await page.locator('#api_button_openai').click();
    await expect(page.locator('#workspace-connection-label')).toHaveText('Model connected');
    await page.keyboard.press('Escape');
    // Reload deliberately lands on the library. Reopen this exact synthetic
    // transcript rather than assuming the previous in-memory chat is mounted.
    await navigate(page, 'chats');
    await page.locator('.workspace-conversations .workspace-scene-row').filter({ hasText: title }).locator('.workspace-scene-open').click();
    // Retry the same first turn with the send button; it has no generated reply.
    await page.locator('#send_but').click();
    await expect.poll(() => requests.length, { timeout: 30000 }).toBe(2);
    await expect(page.locator('#mes_stop')).toBeHidden({ timeout: 60000 });
    const reply = await page.locator('#chat .mes[is_user="false"]').last().innerText();
    expect(reply.toLowerCase()).toContain('book');
    expect(requests[1].custom_prompt_post_processing).toBe('semi_tools');
    expect(requests[1].model).toBe(model);
    await page.screenshot({ path: testInfo.outputPath('first-reply-formatting-recovered.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await navigate(page, 'settings-page');
    await settingsCategory(page, 'connection');
    await page.locator('#custom_prompt_post_processing').scrollIntoViewIfNeeded();
    await expect(page.locator('#custom_prompt_post_processing')).toBeVisible();
    await expect(page.locator('#custom_prompt_post_processing')).toHaveValue('semi_tools');
    await page.screenshot({ path: testInfo.outputPath('prompt-formatting-mobile.png') });
    const summary = { base: process.env.ST_BASE_URL, server: process.env.ST_JUICED_URL, model, failedResponse, reply, requests: requests.map(request => ({ model: request.model, processing: request.custom_prompt_post_processing, roles: request.messages.map(message => message.role), messages: request.messages })), pageErrors, consoleErrors, networkErrors };
    fs.writeFileSync(testInfo.outputPath('first-reply-formatting.json'), JSON.stringify(summary, null, 2));
    expect(pageErrors).toEqual([]);
});

test('live Juiced services use native providers from the tested container', async ({ page }, testInfo) => {
    test.skip(!process.env.ST_JUICED_URL, 'Set ST_JUICED_URL only for an authorized synthetic live run.');
    test.setTimeout(600000);
    page.setDefaultTimeout(15000);
    const storyModel = 'TheDrummer_Skyfall-31B-v4.2-GGUF-IQ4_NL';
    const writerModel = 'Qwen3.5-4B-Uncensored-HauhauCS-Aggressive-Q8_0';
    const requests = [];
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
        if (!/\/api\/(?:backends\/chat-completions\/generate|sd\/sdcpp\/generate|openai\/custom\/)/.test(request.url())) return;
        const type = request.headers()['content-type'] || '';
        if (!type.includes('application/json')) { requests.push({ path: new URL(request.url()).pathname, multipart: true }); return; }
        const body = request.postDataJSON();
        requests.push({ path: new URL(request.url()).pathname, model: body.model, stream: body.stream, max_tokens: body.max_tokens, custom_url: body.custom_url, url: body.url, width: body.width, height: body.height, steps: body.steps, cfg_scale: body.cfg_scale, sampler: body.sampler_name, scheduler: body.scheduler, custom_include_body: body.custom_include_body });
    });
    const start = Date.now();
    console.log('Live Juiced: discover and configure native providers');
    await navigate(page, 'settings-page');
    await settingsCategory(page, 'servers');
    await page.locator('#service-server-url').fill(process.env.ST_JUICED_URL);
    await page.locator('#service-discover').click();
    await expect(page.locator('#service-discovery-status')).toContainText('Connected to Juiced', { timeout: 60000 });
    const discovered = await page.locator('.service-setup select').evaluateAll(selects => selects.map(select => ({ id: select.id, options: [...select.options].map(option => option.value) })));
    for (const [service, model] of [['chat', storyModel], ['writer', writerModel], ['images', 'z-image-turbo-nsfw-v2-GGUF-Q8_0'], ['transcribe', 'asr4all-l-gptq-Q8_0']]) {
        await serviceCategory(page, service);
        await page.locator(`#service-${service}-model`).selectOption(model);
        await page.locator(`#service-${service}-apply`).click();
        await expect(page.locator(`#service-${service}-row`)).toContainText('Saved.', { timeout: 30000 });
    }
    await serviceCategory(page, 'speak');
    await page.locator('#service-speak-model').selectOption('kokoro-v1');
    await expect(page.locator('#service-speak-voice')).toBeEnabled({ timeout: 30000 });
    const voices = await page.locator('#service-speak-voice option').allTextContents();
    await page.locator('#service-speak-voice').selectOption('af_heart');
    await page.locator('#service-speak-apply').click();
    await expect(page.locator('#service-speak-row')).toContainText('Saved.');
    await settingsCategory(page, 'connection');
    await page.locator('#customize_additional_parameters').click();
    await page.locator('dialog[open] #custom_include_body').fill('chat_template_kwargs:\n  enable_thinking: false');
    await page.locator('dialog[open] .popup-button-ok').click();
    await page.keyboard.press('Escape');
    await navigate(page, 'settings-page');
    await settingsCategory(page, 'generation');
    await page.locator('#oai_max_context_unlocked').check();
    await page.locator('#openai_max_context_counter').fill('16384');
    await page.locator('#openai_max_context_counter').press('Tab');
    expect(await page.evaluate(async () => (await import('/scripts/openai.js')).oai_settings.openai_max_context)).toBe(16384);
    await page.locator('#openai_max_tokens').fill('128');
    await page.locator('#stream_toggle').check();
    await page.keyboard.press('Escape');
    await startStory(page, `Workspace e2e ${testInfo.testId}-${runId} live`);
    console.log('Live Juiced: streaming story reply');
    await page.locator('#send_textarea').fill('We are in a sunlit workshop. On the table there is a red teapot beside a blue book. Describe only this quiet scene in two short sentences.');
    const chatResponse = page.waitForResponse(response => response.url().endsWith('/api/backends/chat-completions/generate'), { timeout: 180000 });
    await page.locator('#send_but').click();
    await expect(page.locator('#mes_stop')).toBeVisible();
    await navigate(page, 'characters');
    await returnToChat(page);
    expect((await chatResponse).status()).toBe(200);
    await expect(page.locator('#mes_stop')).toBeHidden({ timeout: 180000 });
    const storyText = await page.locator('#chat .mes[is_user="false"]').last().innerText();
    expect(storyText.length).toBeGreaterThan(30);
    const chatSeconds = (Date.now() - start) / 1000;
    console.log('Live Juiced: configure image sampling and generate scene');
    await navigate(page, 'settings-page');
    await settingsCategory(page, 'image-settings');
    for (const [id, value] of [['sd_width', '512'], ['sd_height', '512'], ['sd_steps', '8'], ['sd_scale', '1']]) {
        await page.locator(`#${id}_value`).fill(value);
        await page.locator(`#${id}_value`).press('Tab');
    }
    await page.locator('#sd_sampler').selectOption('euler');
    await page.locator('#sd_scheduler').selectOption('simple');
    await settingsCategory(page, 'image-writer');
    await page.locator('#sd_prompt_writer_instructions').fill('Write a neutral, nonexplicit image prompt. Preserve the latest red teapot and blue book, current location, character identity and actions. Return only the image prompt.');
    await page.locator('#sd_prompt_writer_max_tokens').fill('512');
    await page.keyboard.press('Escape');
    await returnToChat(page);
    const imageStart = Date.now();
    await page.locator('#workspace-image-button').click();
    await navigate(page, 'characters');
    await returnToChat(page);
    await expect(page.locator('#workspace-image-status')).toContainText('Illustration added', { timeout: 240000 });
    const imageSeconds = (Date.now() - imageStart) / 1000;
    expect(await page.evaluate(async () => (await import('/scripts/openai.js')).oai_settings.custom_model)).toBe(storyModel);
    expect(requests.filter(request => request.path.endsWith('/chat-completions/generate')).map(request => request.model)).toEqual([storyModel, writerModel]);
    expect(requests.find(request => request.model === writerModel)).toMatchObject({ max_tokens: 512, custom_include_body: '{"chat_template_kwargs":{"enable_thinking":false}}' });
    expect(requests.filter(request => request.path.endsWith('/sd/sdcpp/generate'))).toHaveLength(1);
    await page.screenshot({ path: testInfo.outputPath('live-story-image-desktop.png') });
    const speechStart = Date.now();
    console.log('Live Juiced: configure vision and caption the synthetic scene');
    await settingsCategory(page, 'vision-settings', false);
    const visionModel = await page.locator('#service-vision-model option').evaluateAll(options => options.map(option => option.value).find(value => value.startsWith('Ornith-')));
    expect(visionModel).toBeTruthy();
    await page.locator('#service-vision-model').selectOption(visionModel);
    await page.locator('#service-vision-apply').click();
    await expect(page.locator('#service-vision-row')).toContainText('Saved.');
    await page.locator('#caption_prompt').fill('Briefly describe the visible objects and colors in this neutral scene.');
    await page.keyboard.press('Escape');
    const caption = await page.evaluate(async () => {
        const image = document.querySelector('#chat .mes[is_user="false"] img.mes_img');
        const blob = await (await fetch(image.src)).blob();
        const encoded = await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(blob); });
        const { getMultimodalCaption } = await import('/scripts/extensions/shared.js');
        const { extension_settings } = await import('/scripts/extensions.js');
        return getMultimodalCaption(encoded, extension_settings.caption.prompt);
    });
    expect(caption.length).toBeGreaterThan(10);
    expect(await page.evaluate(async () => (await import('/scripts/openai.js')).oai_settings.custom_model)).toBe(storyModel);
    console.log('Live Juiced: synthesize and decode speech');
    const audio = await page.evaluate(async () => {
        const { getRequestHeaders } = await import('/script.js');
        const { extension_settings } = await import('/scripts/extensions.js');
        const settings = extension_settings.tts['OpenAI Compatible'];
        const response = await fetch('/api/openai/custom/generate-voice', { method: 'POST', headers: getRequestHeaders(), body: JSON.stringify({ provider_endpoint: settings.provider_endpoint, model: settings.model, voice: 'af_heart', input: 'The red teapot is beside the blue book.', response_format: 'wav' }) });
        if (!response.ok) throw new Error(`Speech HTTP ${response.status}`);
        const blob = await response.blob();
        const media = document.createElement('audio');
        media.src = URL.createObjectURL(blob);
        await new Promise((resolve, reject) => { media.onloadedmetadata = resolve; media.onerror = reject; });
        const bytes = new Uint8Array(await blob.arrayBuffer());
        return { base64: btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join('')), type: blob.type, duration: media.duration, bytes: bytes.length };
    });
    expect(audio.duration).toBeGreaterThan(1);
    const speechSeconds = (Date.now() - speechStart) / 1000;
    const draft = 'My draft.';
    await page.locator('#send_textarea').fill(draft);
    const messageCount = await page.locator('#chat .mes').count();
    await navigate(page, 'settings-page');
    await settingsCategory(page, 'dictation-settings');
    const transcriptionStart = Date.now();
    console.log('Live Juiced: transcribe speech into draft');
    await page.locator('#dictation-file').setInputFiles({ name: 'neutral-speech.wav', mimeType: 'audio/wav', buffer: Buffer.from(audio.base64, 'base64') });
    await expect(page.locator('#dictation-file-status')).toContainText('Transcript added', { timeout: 120000 });
    const transcriptionSeconds = (Date.now() - transcriptionStart) / 1000;
    await page.keyboard.press('Escape');
    await returnToChat(page);
    const transcriptDraft = await page.locator('#send_textarea').inputValue();
    expect(transcriptDraft).toContain(draft);
    expect(transcriptDraft.toLowerCase()).toContain('teapot');
    expect(await page.locator('#chat .mes').count()).toBe(messageCount);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: testInfo.outputPath('live-story-mobile.png') });
    const summary = { server: process.env.ST_JUICED_URL, base: process.env.ST_BASE_URL, discovered, voices, storyModel, writerModel, visionModel, caption, storyText, transcriptDraft, audio: { type: audio.type, bytes: audio.bytes, duration: audio.duration }, seconds: { chatAndSetup: chatSeconds, writerAndImage: imageSeconds, speech: speechSeconds, transcription: transcriptionSeconds }, requests, errors };
    fs.writeFileSync(testInfo.outputPath('live-juiced-summary.json'), JSON.stringify(summary, null, 2));
    await testInfo.attach('live-juiced-summary.json', { body: JSON.stringify(summary, null, 2), contentType: 'application/json' });
    await testInfo.attach('neutral-speech.wav', { body: Buffer.from(audio.base64, 'base64'), contentType: 'audio/wav' });
    expect(errors).toEqual([]);
});

test('search opens character profiles and a fixture model generates through the native composer', async ({ page }, testInfo) => {
    await page.keyboard.press('Control+k');
    await page.locator('#workspace-command-input').fill('Seraphina');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(page.locator('.workspace-profile-intro h1')).toHaveText('Seraphina');
    await startStory(page, `Workspace e2e ${testInfo.testId}-${runId} model`);
    await page.route('**/api/backends/chat-completions/status', route => route.fulfill({ json: { data: [{ id: 'workspace-fixture' }] } }));
    let finishReply;
    const replyReady = new Promise(resolve => finishReply = resolve);
    await page.route('**/api/backends/chat-completions/generate', async route => {
        await replyReady;
        return route.fulfill({ json: { choices: [{ message: { content: 'The forest path opens before you.' } }] } });
    });
    await page.locator('.workspace-model-chip').click();
    await settingsCategory(page, 'connection');
    await page.locator('#chat_completion_source').selectOption('custom');
    await page.locator('#custom_api_url_text').fill('http://127.0.0.1:12345/v1');
    await page.locator('#custom_model_id').fill('workspace-fixture');
    await page.locator('#api_button_openai').click();
    await expect(page.locator('#workspace-connection-label')).toHaveText('Model connected');
    await page.keyboard.press('Escape');
    await navigate(page, 'settings-page');
    await settingsCategory(page, 'generation');
    await page.locator('#stream_toggle').uncheck();
    await page.keyboard.press('Escape');
    await returnToChat(page);
    await expect(page.locator('#mes_stop')).toBeHidden();
    for (const selector of ['#send_but']) {
        await expect(page.locator(selector)).toHaveCSS('font-size', '16px');
        const bounds = await page.locator(selector).boundingBox();
        expect(bounds.width).toBe(32);
        expect(bounds.height).toBe(32);
    }
    await page.locator('#send_textarea').fill('Which path should we take?');
    const singleLine = await page.locator('#send_form').boundingBox();
    expect(singleLine.height).toBeLessThanOrEqual(160);
    await page.locator('#send_textarea').fill('Which path should we take?\nThe forest is quiet.\nI watch the trees.\nA blue book sits nearby.\nThe teapot is red.\nWe wait.');
    await expect.poll(async () => (await page.locator('#send_form').boundingBox()).height).toBeGreaterThan(singleLine.height + 30);
    await page.locator('#send_textarea').fill('Which path should we take?');
    await page.locator('#send_but').click();
    await expect(page.locator('#mes_stop')).toBeVisible();
    await expect(page.locator('#mes_stop i')).toHaveCSS('font-size', '16px');
    const stop = await page.locator('#mes_stop').boundingBox();
    expect(stop.width).toBe(32);
    expect(stop.height).toBe(32);
    const title = await page.locator('#workspace-chat-title').textContent();
    await page.locator('#send_textarea').fill('A draft for my next turn');
    await page.evaluate(() => {
        window.__workspaceMessageNode = document.querySelector('#chat .mes');
        document.getElementById('chat').scrollTop = 48;
        window.__workspaceChatScroll = document.getElementById('chat').scrollTop;
    });
    await navigate(page, 'chats');
    await page.locator('#workspace-character-list .workspace-scene-row').filter({ hasText: title }).locator('.workspace-scene-open').click();
    await expect(page.locator('#mes_stop')).toBeVisible();
    await expect(page.locator('#send_textarea')).toHaveValue('A draft for my next turn');
    expect(await page.evaluate(() => window.__workspaceMessageNode === document.querySelector('#chat .mes'))).toBe(true);
    expect(await page.evaluate(() => document.getElementById('chat').scrollTop)).toBe(await page.evaluate(() => window.__workspaceChatScroll));
    await navigate(page, 'chats');
    await page.locator('.workspace-conversations .workspace-scene-row').filter({ hasText: title }).locator('.workspace-scene-open').click();
    await expect(page.locator('#mes_stop')).toBeVisible();
    await page.locator('#workspace-history').click();
    await page.locator('.workspace-profile .workspace-scene-row').filter({ hasText: title }).locator('.workspace-scene-open').click();
    await expect(page.locator('#mes_stop')).toBeVisible();
    await navigate(page, 'characters');
    await page.keyboard.press('Control+k');
    await page.locator('#workspace-command-input').fill(title);
    await page.locator('#workspace-command-results [data-workspace-action="open-chat"]').click();
    await expect(page.locator('#mes_stop')).toBeVisible();
    await expect(page.locator('#send_textarea')).toHaveValue('A draft for my next turn');
    expect(await page.evaluate(() => window.__workspaceMessageNode === document.querySelector('#chat .mes'))).toBe(true);
    finishReply();
    await expect(page.locator('#chat .mes[is_user="true"] .mes_text')).toContainText('Which path should we take?');
    await expect(page.locator('#chat .mes_text').last()).toContainText('The forest path opens before you.', { timeout: 20000 });
    await expect(page.locator('#mes_stop')).toBeHidden();
    await expect(page.locator('#send_but')).toBeVisible();
});

test('native streamed replies keep the composer and character identity mounted', async ({ page }, testInfo) => {
    await startStory(page, `Workspace e2e ${testInfo.testId}-${runId} streamed`);
    await page.route('**/api/backends/chat-completions/status', route => route.fulfill({ json: { data: [{ id: 'workspace-fixture' }] } }));
    await page.route('**/api/backends/chat-completions/generate', route => {
        expect(route.request().postDataJSON().stream).toBe(true);
        const chunks = ['The clearing ', 'is quiet. ', 'Seraphina lights a lantern.'];
        const body = chunks.map(content => `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content } }] })}\n\n`).join('') + 'data: [DONE]\n\n';
        return route.fulfill({ status: 200, contentType: 'text/event-stream', body });
    });
    await page.locator('.workspace-model-chip').click();
    await settingsCategory(page, 'connection');
    await page.locator('#chat_completion_source').selectOption('custom');
    await page.locator('#custom_api_url_text').fill('http://127.0.0.1:12345/v1');
    await page.locator('#custom_model_id').fill('workspace-fixture');
    await page.locator('#api_button_openai').click();
    await expect(page.locator('#workspace-connection-label')).toHaveText('Model connected');
    await page.keyboard.press('Escape');
    await page.evaluate(() => {
        window.__workspaceComposer = document.getElementById('send_textarea');
        window.__workspaceVoice = document.getElementById('workspace-voice-button');
        window.__workspacePortrait = document.querySelector('#workspace-header-portrait img');
    });
    await page.locator('#send_textarea').fill('What do you see?');
    await page.locator('#send_but').click();
    await expect(page.locator('#chat .mes_text').last()).toContainText('The clearing is quiet. Seraphina lights a lantern.', { timeout: 20000 });
    await expect(page.locator('#mes_stop')).toBeHidden();
    expect(await page.evaluate(() => window.__workspaceComposer === document.getElementById('send_textarea') && window.__workspaceVoice === document.getElementById('workspace-voice-button') && window.__workspacePortrait === document.querySelector('#workspace-header-portrait img'))).toBe(true);
});

test('image tools use the native provider and treat custom prompts as text', async ({ page }, testInfo) => {
    const title = `Workspace e2e ${testInfo.testId}-${runId} image`;
    await startStory(page, title);
    await enableTool(page, 'Image generation');
    let sentPrompt = '';
    let finishImage;
    const imageReady = new Promise(resolve => finishImage = resolve);
    await page.route('**/api/openai/generate-image', async route => {
        sentPrompt = route.request().postDataJSON().prompt;
        await imageReady;
        return route.fulfill({ json: { data: [{ b64_json: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jS1kAAAAASUVORK5CYII=' }] } });
    });
    await page.evaluate(async () => {
        const { extension_settings } = await import('/scripts/extensions.js');
        const { secret_state } = await import('/scripts/secrets.js');
        extension_settings.sd.source = 'openai';
        extension_settings.sd.model = 'dall-e-3';
        secret_state.api_key_openai = true;
    });
    await page.locator('.workspace-creative-menu summary').click();
    await page.locator('[data-workspace-action="image"]').click();
    await page.locator('#workspace-image-prompt').fill('A moonlit forest | /newchat');
    await page.locator('[data-workspace-action="generate-custom-image"]').click();
    await expect.poll(() => sentPrompt).toContain('/newchat');
    await page.keyboard.press('Escape');
    await page.locator('#workspace-new-story').click();
    await expect(page.locator('#toast-container')).toContainText('Wait for the current illustration');
    expect(await page.evaluate(async () => (await import('/script.js')).getCurrentChatId())).toBe(title);
    finishImage();
    await expect(page.locator('#workspace-tools')).not.toBeVisible({ timeout: 20000 });
    expect(sentPrompt).toContain('/newchat');
    await expect(page.locator('#workspace-chat-title')).toHaveText(title);
    await expect.poll(async () => page.evaluate(async () => (await import('/script.js')).chat.some(message => message.extra?.media?.some(media => typeof media.url === 'string')))).toBe(true);
});

test('one scene click generates one native illustration with automatic tools off', async ({ page }, testInfo) => {
    const title = `Workspace e2e ${testInfo.testId}-${runId} scene image`;
    await startStory(page, title);
    await page.route('**/api/backends/chat-completions/status', route => route.fulfill({ json: { data: [{ id: 'workspace-fixture' }] } }));
    let sceneRequests = 0;
    await page.route('**/api/backends/chat-completions/generate', route => {
        sceneRequests++;
        expect(JSON.stringify(route.request().postDataJSON())).toContain('brief recap of recent events');
        return route.fulfill({ json: { choices: [{ message: { content: 'forest clearing, pink-haired guardian, warm lantern light' } }] } });
    });
    await page.locator('.workspace-model-chip').click();
    await settingsCategory(page, 'connection');
    await page.locator('#chat_completion_source').selectOption('custom');
    await page.locator('#custom_api_url_text').fill('http://127.0.0.1:12345/v1');
    await page.locator('#custom_model_id').fill('workspace-fixture');
    await page.locator('#api_button_openai').click();
    await expect(page.locator('#workspace-connection-label')).toHaveText('Model connected');
    await page.keyboard.press('Escape');
    await page.evaluate(async () => {
        const { extension_settings } = await import('/scripts/extensions.js');
        const { secret_state } = await import('/scripts/secrets.js');
        extension_settings.sd.source = 'openai';
        extension_settings.sd.model = 'dall-e-3';
        extension_settings.sd.enabled = false;
        extension_settings.sd.refine_mode = true;
        secret_state.api_key_openai = true;
    });
    let imageRequests = 0;
    let finishImage;
    const imageReady = new Promise(resolve => finishImage = resolve);
    await page.route('**/api/openai/generate-image', async route => {
        imageRequests++;
        expect(route.request().postDataJSON().prompt).toContain('forest clearing');
        await imageReady;
        return route.fulfill({ json: { data: [{ b64_json: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jS1kAAAAASUVORK5CYII=' }] } });
    });
    await page.locator('#workspace-image-button').click();
    await expect.poll(() => imageRequests).toBe(1);
    await expect(page.locator('#workspace-image-button')).toBeDisabled();
    await expect(page.locator('#workspace-tools')).not.toBeVisible();
    await navigate(page, 'chats');
    await page.locator('.workspace-conversations .workspace-scene-row').filter({ hasText: title }).locator('.workspace-scene-open').click();
    await expect(page.locator('#workspace-image-status')).toContainText('Creating a scene illustration');
    expect(await page.evaluate(async () => (await import('/scripts/extensions.js')).extension_settings.sd.enabled)).toBe(false);
    finishImage();
    await expect(page.locator('#workspace-image-status')).toContainText('Illustration added', { timeout: 20000 });
    await expect(page.locator('#workspace-image-button')).toBeEnabled();
    expect(sceneRequests).toBe(1);
    expect(imageRequests).toBe(1);
    expect(await page.evaluate(async () => (await import('/scripts/extensions.js')).extension_settings.sd.enabled)).toBe(false);
    expect(await page.evaluate(async () => (await import('/script.js')).getCurrentChatId())).toBe(title);
    await expect.poll(async () => page.evaluate(async () => (await import('/script.js')).chat.filter(message => message.extra?.media?.length).length)).toBe(1);
});

test('voice tools narrate the latest native reply with the configured System voice', async ({ page }, testInfo) => {
    await startStory(page, `Workspace e2e ${testInfo.testId}-${runId} voice`);
    await page.evaluate(() => {
        window.__workspaceSpoken = [];
        Object.defineProperty(speechSynthesis, 'getVoices', { value: () => [] });
        Object.defineProperty(speechSynthesis, 'speak', { value: utterance => {
            window.__workspaceSpoken.push(utterance.text);
            setTimeout(() => utterance.dispatchEvent(new Event('end')), 10);
        } });
    });
    await enableTool(page, 'Voice narration');
    await page.locator('.workspace-creative-menu summary').click();
    await page.locator('.workspace-creative-menu [data-workspace-action="voice-settings"]').click();
    await page.locator('#tts_provider').selectOption('System');
    await page.locator('#tts_refresh').click();
    await page.locator('#tts_voicemap_char_Seraphina_voice').selectOption({ label: 'System Default Voice' });
    await page.keyboard.press('Escape');
    await page.locator('.workspace-creative-menu summary').click();
    await page.getByRole('button', { name: 'Read latest reply', exact: true }).click();
    await expect.poll(async () => page.evaluate(() => window.__workspaceSpoken.join(' ')), { timeout: 20000 }).toContain('forest');
    await page.keyboard.press('Escape');
});

test('chat voice is opt-in and persists; manual images do not enable automatic tools', async ({ page }, testInfo) => {
    const title = `Workspace e2e ${testInfo.testId}-${runId} opt in`;
    await startStory(page, title);
    await expect(page.locator('#workspace-image-button')).toBeVisible();
    await expect(page.locator('#workspace-voice-button')).toHaveAttribute('aria-pressed', 'false');
    const save = page.waitForResponse(response => response.url().endsWith('/api/settings/save') && response.request().postDataJSON().extension_settings?.tts?.enabled === true);
    await page.locator('#workspace-voice-button').click();
    await expect(page.locator('#workspace-voice-button')).toHaveAttribute('aria-pressed', 'true');
    await save;
    await expect.poll(async () => page.evaluate(async () => (await import('/scripts/extensions.js')).extension_settings.tts.enabled)).toBe(true);
    await page.reload();
    await expect(page.locator('#preloader')).toHaveCount(0, { timeout: 30000 });
    await navigate(page, 'chats');
    await page.locator('.workspace-conversations .workspace-scene-row').filter({ hasText: title }).locator('.workspace-scene-open').click();
    await expect(page.locator('#workspace-voice-button')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('#workspace-voice-button').click();
    await expect(page.locator('#workspace-voice-button')).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(async () => page.evaluate(async () => (await import('/scripts/extensions.js')).extension_settings.sd.enabled)).toBe(false);
    await page.locator('#workspace-image-button').click();
    await expect(page.locator('#workspace-image-status')).toContainText('Image settings');
    await expect(page.locator('#workspace-image-button')).toBeEnabled();
    await expect.poll(async () => page.evaluate(async () => (await import('/scripts/extensions.js')).extension_settings.sd.enabled)).toBe(false);
});

test('cast creation selects real characters and opens a group story', async ({ page }, testInfo) => {
    const prefix = `Workspace e2e ${testInfo.testId}-${runId}`;
    const avatar = (await page.locator('.workspace-library-card').first().getAttribute('data-entity')).replace(/^character:/, '');
    const duplicate = await api(page, '/api/characters/duplicate', { avatar_url: avatar });
    const renamed = await api(page, '/api/characters/rename', { avatar_url: duplicate.path, new_name: `${prefix} companion` });
    expect(renamed.avatar).toBeTruthy();
    await page.evaluate(async () => { await (await import('/script.js')).getCharacters(); });
    await page.getByRole('button', { name: 'Create cast', exact: true }).click();
    await page.locator('#workspace-cast-name').fill(`${prefix} cast`);
    await page.locator('.workspace-cast-picker input').first().check();
    await page.locator('.workspace-cast-picker input').nth(1).check();
    await page.locator('#workspace-tools [data-workspace-action="save-cast"]').click();
    await expect(page.locator('.workspace-profile-intro h1')).toHaveText(`${prefix} cast`);
    await expect(page.locator('.workspace-profile-cast .workspace-cast-member')).toHaveCount(2);
    await page.getByRole('button', { name: 'Start new story', exact: true }).click();
    await page.locator('dialog[open] .popup-input').fill(`${prefix} group-scene`);
    await page.locator('dialog[open] .popup-button-ok').click();
    await expect(page.locator('#workspace-chat-title')).toHaveText(`${prefix} group-scene`, { timeout: 20000 });
    await page.locator('#workspace-header-portrait').click();
    await expect(page.locator('#workspace-scene-info')).toContainText('Cast reply order & members');
    await page.locator('[data-workspace-action="close-inspector"]').click();
    expect(await page.evaluate(async () => (await import('/scripts/group-chats.js')).selected_group)).toBeTruthy();
    const groupId = await page.evaluate(async () => (await import('/scripts/group-chats.js')).selected_group);
    expect((await api(page, '/api/chats/recent', {})).filter(record => record.group === groupId)).toHaveLength(1);
    expect(await page.evaluate(async id => (await import('/scripts/group-chats.js')).groups.find(group => group.id === id).chats, groupId)).toEqual([`${prefix} group-scene`]);
    await page.route('**/api/chats/group/delete', route => route.fulfill({ status: 500, json: { error: true } }), { times: 1 });
    await currentAction(page, 'delete-chat');
    await page.locator('dialog[open] .popup-button-ok').click();
    await expect(page.locator('#toast-container')).toContainText('could not be deleted');
    expect(await page.evaluate(async title => (await import('/scripts/group-chats.js')).groups.some(group => group.chats.includes(title)), `${prefix} group-scene`)).toBe(true);
});

for (const width of [320, 390, 768]) {
    test(`roleplay pages and composer stay within a ${width}px viewport`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width, height: 844 });
        await expect(page.locator('#workspace-sidebar')).toBeHidden();
        await page.locator('#workspace-menu').click();
        await expect(page.locator('#sheld')).toHaveAttribute('inert', '');
        await page.keyboard.press('Escape');
        await expect(page.locator('#workspace-menu')).toBeFocused();
        await expect(page.locator('#sheld')).not.toHaveAttribute('inert');
        await expect(page.locator('.workspace-library-grid')).toBeVisible();
        await startStory(page, `Workspace e2e ${testInfo.testId}-${runId} phone`);
        const tools = page.locator('.workspace-creative-menu summary');
        await tools.click();
        for (const selector of ['#options_button', '#extensionsMenuButton']) {
            await expect(page.locator(selector)).toHaveCSS('font-size', '16px');
            const bounds = await page.locator(selector).boundingBox();
            expect(bounds.width).toBeGreaterThanOrEqual(44);
            expect(bounds.height).toBeGreaterThanOrEqual(44);
            expect(bounds.x).toBeGreaterThanOrEqual(0);
            expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
        }
        await page.locator('#options_button').click();
        await expect(page.locator('#options')).toBeVisible();
        // The phone tools popover covers the editor's upper area. Click its exposed lower edge.
        await page.locator('#send_textarea').click({ position: { x: 8, y: (await page.locator('#send_textarea').boundingBox()).height - 4 } });
        await expect(page.locator('#options')).toBeHidden();
        await page.locator('#extensionsMenuButton').click();
        await expect(page.locator('#extensionsMenu')).toBeVisible();
        // The phone tools popover covers the editor's upper area. Click its exposed lower edge.
        await page.locator('#send_textarea').click({ position: { x: 8, y: (await page.locator('#send_textarea').boundingBox()).height - 4 } });
        await expect(page.locator('#extensionsMenu')).toBeHidden();
        await tools.click();
        const profileTarget = await page.locator('#workspace-header-portrait').boundingBox();
        expect(profileTarget.width).toBe(44);
        expect(profileTarget.height).toBe(44);
        await page.locator('#workspace-header-portrait').click();
        const inspectorHeading = page.locator('#workspace-scene-info .workspace-tools-heading h2');
        expect(await inspectorHeading.evaluate(e => {
            const bounds = e.getBoundingClientRect();
            return e.contains(document.elementFromPoint(bounds.x + 5, bounds.y + 5));
        })).toBe(true);
        await page.screenshot({ path: testInfo.outputPath(`workspace-inspector-${width}.png`) });
        await page.locator('#workspace-scene-info [data-workspace-action="world"]').click();
        await page.locator('#world_editor_select + .select2-container').click();
        await expect(page.locator('.select2-dropdown')).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.locator('.select2-dropdown')).toBeHidden();
        await expect(page.locator('#workspace-settings-shell')).toBeVisible();
        await page.locator('#workspace-settings-shell [data-workspace-action="close-panel"]').click();
        await page.locator('[data-workspace-action="close-inspector"]').click();
        await enableTool(page, 'Image generation');
        await enableTool(page, 'Voice narration');
        for (const selector of ['#workspace-header', '#sheld', '#form_sheld', '.workspace-composer-tools']) {
            const bounds = await page.locator(selector).boundingBox();
            expect(bounds.x).toBeGreaterThanOrEqual(0);
            expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
        }
        await page.locator('.workspace-creative-menu summary').click();
        await page.locator('[data-workspace-action="image"]').click();
        const dialog = await page.locator('#workspace-tools').boundingBox();
        expect(dialog.x).toBeGreaterThanOrEqual(0);
        expect(dialog.x + dialog.width).toBeLessThanOrEqual(width);
        await page.keyboard.press('Escape');
        await expect(page.locator('#workspace-voice-button')).toHaveAttribute('aria-pressed', 'true');
        await page.screenshot({ path: testInfo.outputPath(`workspace-chat-${width}.png`) });
        await page.setViewportSize({ width, height: 480 });
        const composer = await page.locator('#form_sheld').boundingBox();
        expect(composer.y + composer.height).toBeLessThanOrEqual(481);
        await expect(page.locator('#send_textarea')).toBeVisible();
        await navigate(page, 'settings-page');
        await settingsCategory(page, 'connection');
        const panel = await page.locator('#rm_api_block').boundingBox();
        expect(panel.x).toBeGreaterThanOrEqual(0);
        expect(panel.x + panel.width).toBeLessThanOrEqual(width);
    });
}

test('native font preferences and browser text sizing keep phone controls usable', async ({ page }, testInfo) => {
    await startStory(page, `Workspace e2e ${testInfo.testId}-${runId} large text`);
    await navigate(page, 'settings-page');
    await settingsCategory(page, 'settings');
    await page.locator('#font_scale').evaluate(input => {
        input.value = '1.5';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--fontScale').trim())).toBe('1.5');
    await page.keyboard.press('Escape');
    await returnToChat(page);
    await page.setViewportSize({ width: 390, height: 844 });
    // Simulate a larger browser default independently of the native font preference.
    await page.evaluate(() => document.documentElement.style.fontSize = '20px');
    await expect(page.locator('#send_textarea')).toHaveCSS('font-size', '30px');
    await page.locator('#send_textarea').fill('A larger text preference\nstill leaves room to write.');
    await page.locator('.workspace-creative-menu summary').click();
    for (const selector of ['#workspace-header', '#workspace-header-portrait', '#form_sheld', '#send_textarea', '#options_button', '#extensionsMenuButton']) {
        const bounds = await page.locator(selector).boundingBox();
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(391);
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(845);
    }
    for (const selector of ['#options_button', '#extensionsMenuButton']) {
        const bounds = await page.locator(selector).boundingBox();
        expect(bounds.width).toBeGreaterThanOrEqual(44);
        expect(bounds.height).toBeGreaterThanOrEqual(44);
    }
    await navigate(page, 'settings-page');
    await settingsCategory(page, 'voice-settings');
    await page.locator('#tts_settings .workspace-advanced-creative summary').click();
    await expect(page.locator('#tts_enabled')).toBeVisible();
    expect(await page.locator('#workspace-view').evaluate(view => view.scrollWidth <= view.clientWidth)).toBe(true);
});

test('classic preference survives reload and can be restored', async ({ page }) => {
    await navigate(page, 'settings-page');
    await settingsCategory(page, 'settings');
    const save = page.waitForResponse(response => response.url().endsWith('/api/settings/save') && response.request().postDataJSON().accountStorage?.workspaceLayout === 'false');
    await page.locator('#workspace-layout-toggle').uncheck();
    await save;
    await expect(page.locator('body')).not.toHaveClass(/workspace-ui/);
    await expect(page.locator('#workspace-sidebar')).toBeHidden();
    await expect(page.locator('#top-settings-holder .drawer-toggle').first()).toBeVisible();
    await expect(page.locator('#leftSendForm #options_button')).toHaveCount(1);
    await expect(page.locator('#leftSendForm #extensionsMenuButton')).toHaveCount(1);
    await page.reload();
    await expect(page.locator('#preloader')).toHaveCount(0, { timeout: 30000 });
    await expect(page.locator('body')).not.toHaveClass(/workspace-ui/);
    await expect(page.locator('#leftSendForm #options_button')).toHaveCount(1);
    await expect(page.locator('#leftSendForm #extensionsMenuButton')).toHaveCount(1);
    await page.locator('#workspace-restore').click();
    await expect(page.locator('body')).toHaveClass(/workspace-ui/);
    await expect(page.locator('#workspace-sidebar')).toBeVisible();
    await expect(page.locator('.workspace-creative-menu #options_button')).toHaveCount(1);
    await expect(page.locator('.workspace-creative-menu #extensionsMenuButton')).toHaveCount(1);
});
