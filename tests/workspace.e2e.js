import { test, expect } from '@playwright/test';

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
    await expect(page.locator('#workspace-chat-subtitle')).toHaveText(title, { timeout: 20000 });
    await expect(page.locator('#send_textarea')).toBeVisible();
    await expect.poll(async () => (await api(page, '/api/chats/recent', {})).some(record => record.file_name === `${title}.jsonl`)).toBe(true);
}

async function currentAction(page, action) {
    await page.locator('#workspace-header-menu summary').click();
    await page.locator(`#workspace-header-menu [data-workspace-action="${action}"]`).click();
}

async function enableTool(page, name) {
    await navigate(page, 'settings-page');
    await page.getByRole('checkbox', { name, exact: true }).check();
    await page.locator('.workspace-return-chat').click();
}

test.beforeEach(async ({ page }) => {
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
            settings.extension_settings.tts = { ...settings.extension_settings.tts };
            settings.extension_settings.sd = { ...settings.extension_settings.sd };
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
    await page.getByRole('button', { name: 'Back to Seraphina', exact: true }).click();
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
    await expect(page.locator('#workspace-chat-subtitle')).toHaveText(first);
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
    await expect(page.locator('#workspace-chat-subtitle')).toHaveText(renamed);
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
        ['world', 'WorldInfo'], ['image-settings', 'rm_extensions_block'], ['voice-settings', 'rm_extensions_block'],
        ['settings', 'user-settings-block'], ['backgrounds', 'Backgrounds'], ['prompts', 'AdvancedFormatting'], ['extensions', 'rm_extensions_block'],
    ];
    for (const [action, panel] of destinations) {
        await page.locator(`.workspace-settings [data-workspace-action="${action}"]`).click();
        await expect(page.locator(`#${panel}`)).toBeVisible();
        await expect(page.locator('.drawer-content.openDrawer')).toHaveCount(1);
        await expect(page.locator(`#${panel} .workspace-panel-close`)).toBeFocused();
        await page.keyboard.press('Escape');
        await expect(page.locator(`#${panel}`)).toBeHidden();
        await expect(page.locator('#workspace-view')).toBeFocused();
    }
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
    await page.locator('.workspace-composer-tools [data-workspace-action="connection"]').click();
    await page.locator('#chat_completion_source').selectOption('custom');
    await page.locator('#custom_api_url_text').fill('http://127.0.0.1:12345/v1');
    await page.locator('#custom_model_id').fill('workspace-fixture');
    await page.locator('#api_button_openai').click();
    await expect(page.locator('#workspace-connection-label')).toHaveText('Model connected');
    await page.keyboard.press('Escape');
    await navigate(page, 'settings-page');
    await page.locator('.workspace-settings [data-workspace-action="generation"]').click();
    await page.locator('#stream_toggle').uncheck();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Back to Seraphina', exact: true }).click();
    await expect(page.locator('#mes_stop')).toBeHidden();
    for (const selector of ['#options_button', '#extensionsMenuButton', '#send_but']) {
        await expect(page.locator(selector)).toHaveCSS('font-size', '16px');
        const bounds = await page.locator(selector).boundingBox();
        expect(bounds.width).toBe(32);
        expect(bounds.height).toBe(32);
    }
    await page.locator('#send_textarea').fill('Which path should we take?');
    const singleLine = await page.locator('#send_form').boundingBox();
    expect(singleLine.height).toBeLessThanOrEqual(50);
    await page.locator('#send_textarea').fill('Which path should we take?\nThe forest is quiet.\nI watch the trees.');
    await expect.poll(async () => (await page.locator('#send_form').boundingBox()).height).toBeGreaterThan(singleLine.height + 30);
    await page.locator('#send_textarea').fill('Which path should we take?');
    await page.locator('#send_but').click();
    await expect(page.locator('#mes_stop')).toBeVisible();
    await expect(page.locator('#mes_stop i')).toHaveCSS('font-size', '16px');
    const stop = await page.locator('#mes_stop').boundingBox();
    expect(stop.width).toBe(32);
    expect(stop.height).toBe(32);
    finishReply();
    await expect(page.locator('#chat .mes[is_user="true"] .mes_text')).toContainText('Which path should we take?');
    await expect(page.locator('#chat .mes_text').last()).toContainText('The forest path opens before you.', { timeout: 20000 });
    await expect(page.locator('#mes_stop')).toBeHidden();
    await expect(page.locator('#send_but')).toBeVisible();
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
    await expect(page.locator('#workspace-chat-subtitle')).toHaveText(title);
    await expect.poll(async () => page.evaluate(async () => (await import('/script.js')).chat.some(message => message.extra?.media?.some(media => typeof media.url === 'string')))).toBe(true);
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
    await page.locator('[data-workspace-action="voice"]').click();
    if (await page.getByRole('button', { name: 'Enable narration', exact: true }).count()) {
        await page.getByRole('button', { name: 'Enable narration', exact: true }).click();
    }
    await page.locator('#workspace-tools [data-workspace-action="voice-settings"]').click();
    await page.locator('#tts_provider').selectOption('System');
    await page.locator('#tts_refresh').click();
    await page.locator('#tts_voicemap_char_Seraphina_voice').selectOption({ label: 'System Default Voice' });
    await page.keyboard.press('Escape');
    await page.locator('[data-workspace-action="voice"]').click();
    await page.getByRole('button', { name: 'Read latest reply', exact: true }).click();
    await expect.poll(async () => page.evaluate(() => window.__workspaceSpoken.join(' ')), { timeout: 20000 }).toContain('forest');
    await page.keyboard.press('Escape');
});

test('creative tools start off, persist opt-in, and native controls can turn them off', async ({ page }, testInfo) => {
    const title = `Workspace e2e ${testInfo.testId}-${runId} opt-in`;
    await startStory(page, title);
    await expect(page.locator('#workspace-image-button')).toBeHidden();
    await expect(page.locator('#workspace-voice-button')).toBeHidden();
    expect(await page.evaluate(async () => {
        const { generateWorkspaceImage } = await import('/scripts/extensions/stable-diffusion/index.js');
        try { await generateWorkspaceImage('A forest'); return 'allowed'; } catch (error) { return error.message; }
    })).toContain('Turn on image generation');
    await navigate(page, 'settings-page');
    await expect(page.getByRole('checkbox', { name: 'Voice narration', exact: true })).not.toBeChecked();
    await expect(page.getByRole('checkbox', { name: 'Image generation', exact: true })).not.toBeChecked();
    const saved = page.waitForResponse(response => response.url().endsWith('/api/settings/save') && response.request().postDataJSON().extension_settings.sd.enabled);
    for (const name of ['Voice narration', 'Image generation']) await page.getByRole('checkbox', { name, exact: true }).check();
    await expect.poll(async () => page.evaluate(async () => {
        const { extension_settings } = await import('/scripts/extensions.js');
        return extension_settings.tts.enabled && extension_settings.sd.enabled;
    })).toBe(true);
    await saved;
    await page.reload();
    await expect(page.locator('#preloader')).toHaveCount(0, { timeout: 30000 });
    await navigate(page, 'settings-page');
    for (const name of ['Voice narration', 'Image generation']) await expect(page.getByRole('checkbox', { name, exact: true })).toBeChecked();
    await navigate(page, 'chats');
    await page.locator('.workspace-conversations .workspace-scene-row').filter({ hasText: title }).locator('.workspace-scene-open').click();
    await expect(page.locator('#workspace-image-button')).toBeVisible();
    await expect(page.locator('#workspace-voice-button')).toBeVisible();
    await navigate(page, 'settings-page');
    await page.locator('.workspace-settings [data-workspace-action="image-settings"]').click();
    await page.locator('#sd_enabled').uncheck();
    await expect(page.locator('#workspace-image-button')).toBeHidden();
    await page.keyboard.press('Escape');
    await page.locator('.workspace-settings [data-workspace-action="voice-settings"]').click();
    await page.locator('#tts_enabled').uncheck();
    await expect(page.locator('#workspace-voice-button')).toBeHidden();
    await page.keyboard.press('Escape');
    for (const name of ['Voice narration', 'Image generation']) await expect(page.getByRole('checkbox', { name, exact: true })).not.toBeChecked();
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
    await expect(page.locator('#workspace-chat-subtitle')).toHaveText(`${prefix} group-scene`, { timeout: 20000 });
    await expect(page.locator('#workspace-cast-button')).toBeVisible();
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
        for (const selector of ['#options_button', '#extensionsMenuButton']) {
            await expect(page.locator(selector)).toHaveCSS('font-size', '16px');
            const bounds = await page.locator(selector).boundingBox();
            expect(bounds.width).toBe(44);
            expect(bounds.height).toBe(44);
        }
        await enableTool(page, 'Image generation');
        await enableTool(page, 'Voice narration');
        for (const selector of ['#workspace-header', '#sheld', '#form_sheld', '.workspace-composer-tools']) {
            const bounds = await page.locator(selector).boundingBox();
            expect(bounds.x).toBeGreaterThanOrEqual(0);
            expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
        }
        await page.locator('[data-workspace-action="image"]').click();
        const dialog = await page.locator('#workspace-tools').boundingBox();
        expect(dialog.x).toBeGreaterThanOrEqual(0);
        expect(dialog.x + dialog.width).toBeLessThanOrEqual(width);
        await page.keyboard.press('Escape');
        await page.locator('[data-workspace-action="voice"]').click();
        await expect(page.locator('#workspace-tools')).toContainText('Hear your characters');
        await page.keyboard.press('Escape');
        await page.screenshot({ path: testInfo.outputPath(`workspace-chat-${width}.png`) });
        await page.setViewportSize({ width, height: 480 });
        const composer = await page.locator('#form_sheld').boundingBox();
        expect(composer.y + composer.height).toBeLessThanOrEqual(481);
        await expect(page.locator('#send_textarea')).toBeVisible();
        await navigate(page, 'settings-page');
        await page.locator('.workspace-settings [data-workspace-action="connection"]').click();
        const panel = await page.locator('#rm_api_block').boundingBox();
        expect(panel.x).toBeGreaterThanOrEqual(0);
        expect(panel.x + panel.width).toBeLessThanOrEqual(width);
    });
}

test('classic preference survives reload and can be restored', async ({ page }) => {
    await navigate(page, 'settings-page');
    await page.locator('.workspace-settings [data-workspace-action="settings"]').click();
    const save = page.waitForResponse(response => response.url().endsWith('/api/settings/save') && response.request().postDataJSON().accountStorage?.workspaceLayout === 'false');
    await page.locator('#workspace-layout-toggle').uncheck();
    await save;
    await expect(page.locator('body')).not.toHaveClass(/workspace-ui/);
    await expect(page.locator('#workspace-sidebar')).toBeHidden();
    await expect(page.locator('#top-settings-holder .drawer-toggle').first()).toBeVisible();
    await page.reload();
    await expect(page.locator('#preloader')).toHaveCount(0, { timeout: 30000 });
    await expect(page.locator('body')).not.toHaveClass(/workspace-ui/);
    await page.locator('#workspace-restore').click();
    await expect(page.locator('body')).toHaveClass(/workspace-ui/);
    await expect(page.locator('#workspace-sidebar')).toBeVisible();
});
