import { test, expect, devices } from '@playwright/test';
import fs from 'node:fs';
import { createServer } from 'node:http';

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
    const primary = ['generation', 'prompts'].includes(category) ? 'connection' : category;
    if (await page.locator('#workspace-settings-category').isVisible()) await page.locator('#workspace-settings-category').selectOption(primary);
    else await page.locator(`.workspace-settings-rail [data-workspace-action="${primary}"]`).click();
    if (['generation', 'prompts'].includes(category)) {
        await page.locator(`.workspace-service-tabs [data-service-destination="${category}"]`).click();
    }
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
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    await expect(page.locator('#send_textarea')).toBeVisible();
    const current = await page.evaluate(async () => (await import('/script.js')).getCurrentChatId());
    page.workspaceCreatedTitles ||= [];
    page.workspaceCreatedTitles.push(current);
    await renameCurrentStory(page, title);
    await expect.poll(async () => (await api(page, '/api/chats/recent', {})).some(record => record.file_name === `${title}.jsonl`)).toBe(true);
}

async function renameCurrentStory(page, title) {
    await currentAction(page, 'rename-chat');
    await page.locator('dialog[open] .popup-input').fill(title);
    await page.locator('dialog[open] .popup-button-ok').click();
    await expect(page.locator('#workspace-chat-title')).toHaveText(title, { timeout: 20000 });
    await expect(page.locator('#send_textarea')).toBeVisible();
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
    page.setDefaultNavigationTimeout(30000);
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
            settings.power_user.font_scale = 1;
            settings.accountStorage = { ...settings.accountStorage, workspaceLayout: 'true', workspaceAdvancedSettings: 'false', workspaceArchivedChats: '[]' };
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
    if (page.workspaceRecoveryRoutes) fs.writeFileSync(testInfo.outputPath('recovery-events.json'), JSON.stringify({ routes: page.workspaceRecoveryRoutes, browser: await page.evaluate(() => window.__recoveryTrace) }, null, 2));
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
    }, records.filter(record => record.file_name.startsWith(prefix) || page.workspaceCreatedTitles?.includes(record.file_name.replace(/\.jsonl$/, ''))));
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
    // Other synthetic characters/casts may also mention Seraphina in their
    // description or members. Select the matching profile by its exact name.
    await page.getByRole('button', { name: 'Meet Seraphina', exact: true }).click();
    await expect(page.locator('.workspace-profile-intro h1')).toHaveText('Seraphina');
    await expect(page.locator('#send_textarea')).toBeHidden();
    await expect(page.locator('.workspace-profile-detail[open]')).toHaveCount(0);
    expect(await page.evaluate(async () => (await import('/script.js')).getCurrentChatId())).toBeUndefined();
    await page.screenshot({ path: testInfo.outputPath('workspace-profile-desktop.png') });
});

test('history failure stays visible in profiles and archive while known stories remain usable', async ({ page }, testInfo) => {
    const title = `Workspace e2e ${testInfo.testId}-${runId} history`;
    await startStory(page, title);
    let unavailable = true;
    await page.route('**/api/chats/recent', route => unavailable
        ? route.fulfill({ status: 503, json: { error: 'Synthetic history outage' } })
        : route.continue());
    await page.locator('#workspace-history').click();
    await expect(page.locator('.workspace-history [role="alert"]')).toContainText('Could not load your stories');
    await expect(page.locator('.workspace-profile .workspace-scene-row').filter({ hasText: title })).toBeVisible();
    await page.locator('[data-workspace-action="profile-scope"][data-scope="archived"]').click();
    await expect(page.locator('.workspace-history [role="alert"]')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'No archived stories', exact: true })).toHaveCount(0);
    await navigate(page, 'archive');
    await expect(page.locator('.workspace-history [role="alert"]')).toBeVisible();
    unavailable = false;
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await expect(page.locator('.workspace-history [role="alert"]')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'No archived stories', exact: true })).toBeVisible();
    await navigate(page, 'chats');
    await expect(page.locator('.workspace-conversations .workspace-scene-row').filter({ hasText: title })).toBeVisible();
});

test('native character editor owns Escape before its settings page and audio upload works by keyboard', async ({ page }) => {
    await page.getByRole('button', { name: 'Create character', exact: true }).click();
    await expect(page.locator('#create_button_label')).toContainText('Create character');
    await page.locator('#advanced_div').click();
    await expect(page.locator('#character_popup')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#character_popup')).toBeHidden();
    await expect(page.locator('#workspace-settings-shell')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#workspace-settings-shell')).toBeHidden();
    await page.setViewportSize({ width: 390, height: 844 });
    await settingsCategory(page, 'dictation-settings');
    await expect(page.getByLabel('Settings category')).toHaveValue('dictation-settings');
    const choose = page.getByRole('button', { name: 'Choose audio file', exact: true });
    await choose.focus();
    const chooser = page.waitForEvent('filechooser');
    await page.keyboard.press('Enter');
    await (await chooser).setFiles([]);
    await expect(choose).toBeFocused();
    await settingsCategory(page, 'extensions');
    // The endpoint fields belong to the native dictation drawer's collapse state.
    const drawer = page.locator('#dictation-settings > .inline-drawer-content');
    if (await drawer.isVisible()) await page.locator('#dictation-settings > .inline-drawer-toggle').click();
    await expect(drawer).toBeHidden();
    await expect(page.locator('#dictation-endpoint')).toBeHidden();
    await page.locator('#dictation-settings > .inline-drawer-toggle').click();
    await expect(page.locator('#dictation-endpoint')).toBeVisible();
});

test('character portrait and native actions stay above tags and notes at every size', async ({ page }, testInfo) => {
    const audit = [];
    for (const scale of [1, 1.5]) {
        await settingsCategory(page, 'settings');
        await page.locator('#font_scale').evaluate((input, scale) => {
            input.value = String(scale);
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('mouseup', { bubbles: true }));
        }, scale);
        await profile(page);
        await page.getByRole('button', { name: 'Edit character', exact: true }).click();
        await expect(page.locator('#avatar_controls')).toBeVisible();
        for (const width of [1280, 768, 390, 320]) {
            await page.setViewportSize({ width, height: 844 });
            const bounds = await page.locator('#form_create').evaluate(form => {
                const box = id => document.getElementById(id).getBoundingClientRect().toJSON();
                return { avatar: box('avatar_div'), controls: box('avatar_controls'), tags: box('tags_div'), notes: box('spoiler_free_desc'), overflow: form.scrollWidth - form.clientWidth };
            });
            audit.push({ width, scale, ...bounds });
            expect(bounds.controls.bottom).toBeLessThanOrEqual(bounds.avatar.bottom + 1);
            expect(bounds.avatar.bottom).toBeLessThanOrEqual(bounds.tags.top + 1);
            expect(bounds.tags.bottom).toBeLessThanOrEqual(bounds.notes.top + 1);
            expect(bounds.overflow).toBeLessThanOrEqual(1);
            expect(await page.locator('#rm_button_selected_ch h2').evaluate(name => name.scrollWidth - name.clientWidth)).toBeLessThanOrEqual(1);
            await page.locator('#advanced_div').click();
            await expect(page.locator('#character_popup')).toBeVisible();
            await page.keyboard.press('Escape');
            await expect(page.locator('#character_popup')).toBeHidden();
            await page.locator('#avatar_controls').scrollIntoViewIfNeeded();
            await page.screenshot({ path: testInfo.outputPath(`character-actions-${width}-${scale}.png`) });
        }
    }
    fs.writeFileSync(testInfo.outputPath('character-layout-audit.json'), JSON.stringify(audit, null, 2));
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

test('starting a character story is immediate, creates one transcript and can be renamed afterward', async ({ page }, testInfo) => {
    const prefix = `Workspace e2e ${testInfo.testId}-${runId}`;
    const source = await page.evaluate(async () => (await import('/script.js')).characters[0].avatar);
    const duplicate = await api(page, '/api/characters/duplicate', { avatar_url: source });
    const character = await api(page, '/api/characters/rename', { avatar_url: duplicate.path, new_name: `${prefix} fresh` });
    await page.evaluate(async () => (await import('/script.js')).getCharacters());
    const before = await api(page, '/api/chats/recent', {});
    for (const index of [1, 2]) {
        const previous = await page.evaluate(async () => (await import('/script.js')).getCurrentChatId());
        if (index === 1) {
            await navigate(page, 'characters');
            await page.locator('.workspace-library-card').filter({ hasText: `${prefix} fresh` }).click();
            await page.getByRole('button', { name: 'Start new story', exact: true }).dblclick();
        } else await page.locator('#workspace-new-story').dblclick();
        await expect(page.locator('dialog[open]')).toHaveCount(0);
        await expect(page.locator('#send_textarea')).toBeVisible();
        await expect.poll(() => page.evaluate(async () => (await import('/script.js')).getCurrentChatId())).not.toBe(previous);
        await expect(page.locator('#workspace-new-story')).toHaveAttribute('aria-busy', 'false');
        const current = await page.evaluate(async () => (await import('/script.js')).getCurrentChatId());
        expect(current).toBeTruthy();
        const records = (await api(page, '/api/chats/recent', {})).filter(record => record.avatar === character.avatar);
        expect(records).toHaveLength(index);
        expect(records.some(record => record.file_name === `${current}.jsonl`)).toBe(true);
        if (index === 1) await renameCurrentStory(page, `${prefix} first`);
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

test('advanced controls retain native provider, sampling, prompts and extensions without leaving the workspace', async ({ page }, testInfo) => {
    await page.route('**/api/backends/chat-completions/status', route => route.fulfill({ json: { data: [{ id: 'story-fixture' }] } }));
    await page.route('**/api/openai/custom/discover', route => route.fulfill({ json: serviceFixture() }));
    await serviceSetup(page);
    await serviceCategory(page, 'chat');
    await page.locator('#workspace-advanced-settings').check();
    await page.locator('#service-chat-model').selectOption('story-fixture');
    await page.locator('#service-chat-apply').click();
    await expect(page.locator('#custom_prompt_post_processing')).toBeVisible();
    const before = await page.evaluate(async () => {
        const { oai_settings } = await import('/scripts/openai.js');
        return { temperature: oai_settings.temp_openai, context: oai_settings.openai_max_context, model: oai_settings.custom_model };
    });
    await expect(page.locator('#custom_prompt_post_processing')).toBeVisible();
    await page.locator('#customize_additional_parameters').click();
    await expect(page.locator('dialog[open] #custom_include_body')).toBeVisible();
    await page.locator('dialog[open] .popup-button-ok').click();
    await settingsCategory(page, 'generation', false);
    for (const id of ['respective-ranges-and-temps', 'respective-presets-block', 'advanced-ai-config-block']) await expect(page.locator(`#${id}`)).toBeVisible();
    await page.locator('#temp_counter_openai').fill('0.67');
    await page.locator('#temp_counter_openai').press('Tab');
    await settingsCategory(page, 'prompts', false);
    await expect(page.locator('#completion_prompt_manager')).toBeVisible();
    await expect(page.locator('#sysprompt_content')).toBeVisible();
    for (const width of [1280, 390, 320]) {
        await page.setViewportSize({ width, height: 844 });
        for (const [category, selector] of [['generation', '#temp_openai'], ['prompts', '#completion_prompt_manager'], ['image-settings', '#sd_source'], ['image-writer', '#sd_prompt_writer_profile'], ['voice-settings', '#tts_provider'], ['dictation-settings', '#dictation-model'], ['vision-settings', '#caption_source']]) {
            await settingsCategory(page, category, false);
            await expect(page.locator(selector)).toBeVisible();
            const panel = page.locator('.workspace-mounted-panel');
            expect(await panel.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
            const done = await page.locator('#workspace-settings-shell [data-workspace-action="close-panel"]').boundingBox();
            expect(done.x + done.width).toBeLessThanOrEqual(width + 1);
        }
    }
    await settingsCategory(page, 'voice-settings', false);
    await expect(page.locator('#tts_enabled')).toBeVisible();
    await page.setViewportSize({ width: 320, height: 844 });
    const toggle = await page.locator('#workspace-advanced-settings').boundingBox();
    expect(toggle.x).toBeGreaterThanOrEqual(0);
    expect(toggle.x + toggle.width).toBeLessThanOrEqual(320);
    await page.screenshot({ path: testInfo.outputPath('advanced-speech-phone.png') });
    await page.evaluate(async () => await (await import('/script.js')).saveSettings());
    await page.reload();
    await expect(page.locator('#preloader')).toHaveCount(0, { timeout: 30000 });
    await settingsCategory(page, 'generation', false);
    await expect(page.locator('#workspace-advanced-settings')).toBeChecked();
    await expect(page.locator('#temp_openai')).toHaveValue('0.67');
    await expect(page.locator('#advanced-ai-config-block')).toBeVisible();
    await page.locator('#workspace-advanced-settings').uncheck();
    await expect(page.locator('#advanced-ai-config-block')).toBeHidden();
    await page.locator('.workspace-settings-sections').getByRole('button', { name: 'All controls', exact: true }).click();
    await expect(page.locator('#advanced-ai-config-block')).toBeVisible();
    await expect(page.locator('#temp_openai')).toHaveValue('0.67');
    const after = await page.evaluate(async () => {
        const { oai_settings } = await import('/scripts/openai.js');
        return { temperature: oai_settings.temp_openai, context: oai_settings.openai_max_context, model: oai_settings.custom_model };
    });
    expect(after).toEqual({ ...before, temperature: 0.67 });
    expect(await page.locator('#custom_model_id').count()).toBe(1);
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

test('every settings destination keeps controls reachable with enlarged phone text', async ({ page }, testInfo) => {
    test.setTimeout(180000);
    await page.setViewportSize({ width: 320, height: 568 });
    await settingsCategory(page, 'settings');
    await page.locator('#font_scale').evaluate(input => {
        input.value = '1.5';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('mouseup', { bubbles: true }));
    });
    await page.locator('#workspace-advanced-settings').check();
    const audit = [];
    for (const width of [320, 390]) {
        await page.setViewportSize({ width, height: 568 });
        for (const category of ['servers', 'connection', 'generation', 'prompts', 'image-writer', 'image-settings', 'voice-settings', 'dictation-settings', 'vision-settings', 'embeddings-settings', 'persona', 'world', 'backgrounds', 'settings', 'extensions', 'character-editor']) {
            await settingsCategory(page, category, false);
            const result = await page.locator('.workspace-mounted-panel').evaluate(panel => {
                const bounds = panel.getBoundingClientRect();
                const outside = [...panel.querySelectorAll('input,select,button,.menu_button,.editor_maximize')].filter(node => node.getClientRects().length).flatMap(node => {
                    const box = node.getBoundingClientRect();
                    return box.left < bounds.left - 1 || box.right > bounds.right + 1 ? [{ id: node.id, class: node.className, left: box.left, right: box.right, width: box.width }] : [];
                });
                const done = document.querySelector('[data-workspace-action="close-panel"]');
                const box = done.getBoundingClientRect();
                const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
                const narrowPresets = [...panel.querySelectorAll('select[data-preset-manager-for], #openai_logit_bias_preset, #context_presets, #instruct_presets, #sysprompt_select, #reasoning_select')].filter(node => node.getClientRects().length && node.getBoundingClientRect().width < Math.min(200, panel.clientWidth * 0.7)).map(node => ({ id: node.id, width: node.getBoundingClientRect().width }));
                const smallPromptActions = [...panel.querySelectorAll('.prompt-manager-edit-action, .prompt-manager-toggle-action')].filter(node => node.getClientRects().length).filter(node => { const box = node.getBoundingClientRect(); return box.width < 44 || box.height < 44; }).length;
                return { client: panel.clientWidth, scroll: panel.scrollWidth, outside, narrowPresets, smallPromptActions, doneUsable: done.contains(hit), profileWidth: document.querySelector('#connection_profiles')?.getBoundingClientRect().width };
            });
            audit.push({ width, category, ...result });
            await page.screenshot({ path: testInfo.outputPath(`enlarged-${category}-${width}.png`) });
        }
    }
    fs.writeFileSync(testInfo.outputPath('enlarged-layout-audit.json'), JSON.stringify(audit, null, 2));
    expect(audit.filter(item => item.scroll > item.client + 1 || !item.doneUsable || item.narrowPresets.length || item.smallPromptActions)).toEqual([]);
    expect(audit.filter(item => item.category === 'connection').every(item => item.profileWidth >= item.width - 64)).toBe(true);
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

test('discovered selectors distinguish unapplied choices and follow native provider changes', async ({ page }) => {
    await page.route('**/api/openai/custom/discover', route => route.fulfill({ json: route.request().postDataJSON().voice_model ? { voices: ['voice-a', 'voice-b'] } : serviceFixture() }));
    await page.route('**/api/backends/chat-completions/status', route => route.fulfill({ json: { data: [{ id: 'story-fixture' }, { id: 'writer-fixture' }] } }));
    await serviceSetup(page);
    await serviceCategory(page, 'chat');
    await page.locator('#service-chat-model').selectOption('story-fixture');
    await page.locator('#service-chat-apply').click();
    await expect(page.locator('#service-chat-row')).toContainText('Saved.');
    await page.locator('#service-chat-model').selectOption('writer-fixture');
    await expect(page.locator('#service-chat-row')).toContainText('Selection not applied');
    expect(await page.evaluate(async () => (await import('/scripts/openai.js')).oai_settings.custom_model)).toBe('story-fixture');
    await settingsCategory(page, 'connection');
    await page.locator('#custom_model_id').fill('writer-fixture');
    await serviceCategory(page, 'transcribe');
    await serviceCategory(page, 'chat');
    await expect(page.locator('#service-chat-model')).toHaveValue('writer-fixture');
    await expect(page.locator('#service-chat-row')).toContainText('Provider settings updated');
    await settingsCategory(page, 'connection');
    await page.locator('#custom_api_url_text').fill('https://other.synthetic.example/v1');
    await serviceCategory(page, 'transcribe');
    await serviceCategory(page, 'chat');
    await expect(page.locator('#service-chat-model')).toHaveValue('');
    await expect(page.locator('#service-chat-row')).toContainText('other provider settings');
    await expect(page.locator('#service-chat-auto-context')).toBeDisabled();
    await expect(page.locator('#service-chat-context')).toContainText('not the active story connection');
    await serviceCategory(page, 'speak');
    await page.locator('#service-speak-model').selectOption('speech-fixture');
    await expect(page.locator('#service-speak-voice option')).toHaveCount(2);
    await page.locator('#service-speak-apply').click();
    await expect(page.locator('#service-speak-row')).toContainText('Saved.');
    await page.locator('#service-speak-voice').selectOption('voice-b');
    await expect(page.locator('#service-speak-row')).toContainText('Selection not applied');
});

test('vision discovery follows the native current-story-model option', async ({ page }, testInfo) => {
    const data = serviceFixture();
    data.services.chat.models.push({ id: 'vision-fixture', labels: ['vision'] });
    await page.route('**/api/openai/custom/discover', route => route.fulfill({ json: data }));
    await page.route('**/api/backends/chat-completions/status', route => route.fulfill({ json: { data: data.services.chat.models } }));
    await serviceSetup(page);
    await serviceCategory(page, 'chat');
    await page.locator('#service-chat-model').selectOption('story-fixture');
    await page.locator('#service-chat-apply').click();
    await expect(page.locator('#service-chat-row')).toContainText('Saved.');
    await serviceCategory(page, 'vision');
    await page.locator('#service-vision-model').selectOption('vision-fixture');
    await page.locator('#service-vision-apply').click();
    await expect(page.locator('#service-vision-row')).toContainText('Saved.');
    await settingsCategory(page, 'vision-settings');
    await page.locator('#caption_multimodal_model').selectOption('custom_current');
    expect(await page.evaluate(async () => (await import('/scripts/extensions.js')).extension_settings.caption.multimodal_model)).toBe('custom_current');
    // The native request owner uses story-fixture in this mode. It is not in
    // the discovered vision subset, so the separate vision choice must clear.
    await expect(page.locator('#service-vision-model')).toHaveValue('');
    await expect(page.locator('#service-vision-row')).not.toContainText('Saved.');
    await page.screenshot({ path: testInfo.outputPath('vision-native-current-mode.png') });
    await page.locator('#service-vision-row').scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath('vision-derived-current-model.png') });
    await page.locator('#caption_multimodal_model').selectOption('custom_custom');
    await expect(page.locator('#service-vision-model')).toHaveValue('vision-fixture');
});

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
    let releaseTranscript, transcriptRequested, transcriptDelivered;
    const transcriptHeld = new Promise(resolve => releaseTranscript = resolve);
    const transcriptStarted = new Promise(resolve => transcriptRequested = resolve);
    const transcriptFinished = new Promise(resolve => transcriptDelivered = resolve);
    await page.route('**/api/openai/custom/transcribe-audio', async route => {
        requests++;
        const body = route.request().postDataBuffer();
        const wav = body.indexOf('RIFF');
        expect(wav).toBeGreaterThan(0);
        expect(body.readUInt32LE(wav + 24)).toBe(16000);
        expect(body.readUInt16LE(wav + 22)).toBe(1);
        expect(body.readUInt16LE(wav + 34)).toBe(16);
        transcriptRequested();
        await transcriptHeld;
        await route.fulfill({ json: { text: 'A blue book beside a red teapot.' } });
        transcriptDelivered();
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
    await transcriptStarted;
    const pause = await freezePage(page);
    releaseTranscript();
    await transcriptFinished;
    await resumePage(page, pause);
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
    // Recovery verifies transport, prompt preservation and a rendered reply.
    // A live model can choose a different object despite the same input.
    expect(reply.trim().length).toBeGreaterThan(10);
    expect(requests[1].messages.some(message => typeof message.content === 'string' && message.content.includes('red teapot') && message.content.includes('blue book'))).toBe(true);
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
    for (const width of [1280, 448]) {
        await page.setViewportSize({ width, height: 921 });
        await page.locator('.workspace-creative-menu summary').click();
        await page.locator('#options_button').click();
        await expect(page.locator('#options')).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.locator('#options')).toBeHidden();
        await expect(page.locator('.workspace-creative-menu')).toHaveAttribute('open', '');
        await expect(page.locator('#mes_stop')).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.locator('.workspace-creative-menu')).not.toHaveAttribute('open');
        await expect(page.locator('#mes_stop')).toBeVisible();
        expect(await page.evaluate(async () => (await import('/script.js')).isGenerating())).toBe(true);
    }
    const title = await page.locator('#workspace-chat-title').textContent();
    await page.locator('#send_textarea').fill('A draft for my next turn');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#workspace-menu').click();
    await expect(page.locator('#sheld')).toHaveAttribute('inert', '');
    await page.keyboard.press('Escape');
    await expect(page.locator('#sheld')).not.toHaveAttribute('inert');
    await expect(page.locator('#mes_stop')).toBeVisible();
    await page.locator('#workspace-header-portrait').click();
    await expect(page.locator('#form_sheld')).toHaveAttribute('inert', '');
    await page.keyboard.press('Escape');
    await expect(page.locator('body')).not.toHaveClass(/workspace-inspecting/);
    await expect(page.locator('#mes_stop')).toBeVisible();
    await expect(page.locator('#send_textarea')).toHaveValue('A draft for my next turn');
    await page.setViewportSize({ width: 1280, height: 800 });
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

async function connectRecoveryFixture(page, url = 'http://127.0.0.1:12345/v1', streaming = true) {
    await page.route('**/api/backends/chat-completions/status', route => route.fulfill({ json: { data: [{ id: 'workspace-fixture' }] } }));
    await settingsCategory(page, 'connection');
    await page.locator('#chat_completion_source').selectOption('custom');
    await page.locator('#custom_api_url_text').fill(url);
    await page.locator('#custom_model_id').fill('workspace-fixture');
    await page.locator('#api_button_openai').click();
    await expect(page.locator('#workspace-connection-label')).toHaveText('Model connected');
    await settingsCategory(page, 'generation');
    await page.locator('#stream_toggle').setChecked(streaming);
    await page.keyboard.press('Escape');
}

async function freezePage(page) {
    const cdp = await page.context().newCDPSession(page);
    await page.evaluate(() => {
        window.__freezeObserved = false;
        document.addEventListener('freeze', () => { window.__freezeObserved = true; }, { once: true });
    });
    // Playwright normally forces every page visible, which prevents lifecycle freezing.
    // The override belongs to Playwright's original CDP session, so changing it
    // on a second session does not disable it. This test-only in-process seam
    // restores real visibility/freeze semantics; it never changes application code.
    cdp.nativeSession = page._connection.toImpl(page).delegate._mainFrameSession._client;
    await cdp.nativeSession.send('Emulation.setFocusEmulationEnabled', { enabled: false });
    cdp.backgroundTab = await page.context().newPage();
    await cdp.backgroundTab.bringToFront();
    await expect.poll(() => page.evaluate(() => document.visibilityState)).toBe('hidden');
    await cdp.send('Page.setWebLifecycleState', { state: 'frozen' });
    await expect.poll(async () => (await cdp.send('Runtime.evaluate', { expression: 'window.__freezeObserved' })).result.value).toBe(true);
    return cdp;
}

async function resumePage(page, cdp) {
    await cdp.send('Page.setWebLifecycleState', { state: 'active' });
    await page.bringToFront();
    await cdp.backgroundTab.close();
    await cdp.nativeSession.send('Emulation.setFocusEmulationEnabled', { enabled: true });
}

test('mobile draft survives a frozen tab and reload without leaking into another story', async ({ page }, testInfo) => {
    const title = `Workspace e2e ${testInfo.testId}-${runId} suspended draft`;
    await startStory(page, title);
    await page.setViewportSize({ width: 448, height: 921 });
    await page.locator('#send_textarea').fill('My unsent lantern scene stays private to this story.');
    const cdp = await freezePage(page);
    await resumePage(page, cdp);
    await expect(page.locator('#send_textarea')).toHaveValue('My unsent lantern scene stays private to this story.');
    await page.evaluate(async () => (await import('/script.js')).saveSettings());
    await page.reload();
    await expect(page.locator('#preloader')).toHaveCount(0, { timeout: 30000 });
    await navigate(page, 'chats');
    await page.locator('.workspace-conversations .workspace-scene-row').filter({ has: page.locator('strong', { hasText: title }) }).locator('.workspace-scene-open').click();
    await expect(page.locator('#send_textarea')).toHaveValue('My unsent lantern scene stays private to this story.');
    await page.screenshot({ path: testInfo.outputPath('resumed-draft.png') });
    await startStory(page, `Workspace e2e ${testInfo.testId}-${runId} other story`);
    await expect(page.locator('#send_textarea')).toHaveValue('');
});

test('a healthy reply completed while frozen resumes once and preserves the next draft', async ({ page }, testInfo) => {
    await startStory(page, `Workspace e2e ${testInfo.testId}-${runId} frozen reply`);
    await page.route('**/api/backends/chat-completions/status', route => route.fulfill({ json: { data: [{ id: 'workspace-fixture' }] } }));
    let releaseReply, requested, delivered;
    const replyReady = new Promise(resolve => releaseReply = resolve);
    const requestReady = new Promise(resolve => requested = resolve);
    const responseDelivered = new Promise(resolve => delivered = resolve);
    let requests = 0;
    await page.route('**/api/backends/chat-completions/generate', async route => {
        requests++;
        requested();
        await replyReady;
        await route.fulfill({ contentType: 'text/event-stream', body: 'data: {"choices":[{"index":0,"delta":{"content":"The lantern stayed lit while the phone slept."}}]}\n\ndata: [DONE]\n\n' });
        delivered();
    });
    await settingsCategory(page, 'connection');
    await page.locator('#chat_completion_source').selectOption('custom');
    await page.locator('#custom_api_url_text').fill('http://127.0.0.1:12345/v1');
    await page.locator('#custom_model_id').fill('workspace-fixture');
    await page.locator('#api_button_openai').click();
    await expect(page.locator('#workspace-connection-label')).toHaveText('Model connected');
    await settingsCategory(page, 'generation');
    await page.locator('#stream_toggle').check();
    await page.keyboard.press('Escape');
    await page.locator('#send_textarea').fill('Describe the lantern.');
    await page.locator('#send_but').click();
    await requestReady;
    await page.locator('#send_textarea').fill('My next turn is still a draft.');
    const cdp = await freezePage(page);
    releaseReply();
    await responseDelivered;
    await resumePage(page, cdp);
    await expect(page.locator('#chat .mes_text').last()).toHaveText('The lantern stayed lit while the phone slept.');
    await expect(page.locator('#mes_stop')).toBeHidden();
    await expect(page.locator('#send_textarea')).toHaveValue('My next turn is still a draft.');
    expect(requests).toBe(1);
});

for (const mobile of [false, true]) {
    test.describe(`Foreground chat layout: ${mobile ? 'Pixel 9 Pro XL' : 'desktop'}`, () => {
        test.use({ viewport: mobile ? { width: 448, height: 921 } : { width: 1280, height: 800 }, screen: mobile ? { width: 448, height: 997 } : { width: 1280, height: 800 }, userAgent: mobile ? devices['Pixel 7'].userAgent.replace('Pixel 7', 'Pixel 9 Pro XL') : undefined, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 3 : 1 });
        for (const readingHistory of [false, true]) {
            test(`resume ${readingHistory ? 'preserves the history reading position' : 'shows the final character line'} without a recovery popup`, async ({ page }, testInfo) => {
                await startStory(page, `Workspace e2e ${testInfo.testId}-${runId} viewport`);
                await connectRecoveryFixture(page);
                const reply = Array.from({ length: 15 }, (_, i) => `Lantern paragraph ${i + 1}. Seraphina walks beside the river and describes the quiet forest.`).join('\n\n') + '\n\nThe final lantern line is visible.';
                let release, requested, delivered, releasePing;
                const held = new Promise(resolve => release = resolve);
                const started = new Promise(resolve => requested = resolve);
                const finished = new Promise(resolve => delivered = resolve);
                const pingHeld = new Promise(resolve => releasePing = resolve);
                let requests = 0;
                await page.route('**/api/backends/chat-completions/generate', async route => {
                    requests++; requested(); await held;
                    await route.fulfill({ contentType: 'text/event-stream', body: `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: reply }, finish_reason: 'stop' }] })}\n\ndata: [DONE]\n\n` });
                    delivered();
                });
                // Give the reader a real, scrollable native history before starting the held reply.
                await page.evaluate(async () => {
                    const script = await import('/script.js');
                    const message = { ...structuredClone(script.chat[0]), send_date: Date.now(), mes: Array.from({ length: 20 }, (_, i) => `History paragraph ${i + 1}. The river winds through the old forest.`).join('\n\n') };
                    script.chat.push(message); script.addOneMessage(message);
                    await script.saveChatConditional();
                });
                await page.locator('#send_textarea').fill('Continue by the lantern.');
                await page.locator('#send_but').click();
                await started;
                await page.locator('#send_textarea').fill('Only my next unsent turn.');
                await page.evaluate(reading => {
                    const chat = document.getElementById('chat');
                    chat.scrollTop = reading ? 160 : chat.scrollHeight;
                    const input = document.getElementById('send_textarea');
                    input.setSelectionRange(5, 12);
                    window.__viewportNodes = { chat, input, first: chat.querySelector('.mes'), scrollTop: chat.scrollTop, position: document.documentElement.style.position };
                }, readingHistory);
                // Let the native scroll owner observe the deliberate history/bottom position.
                await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
                const cdp = await freezePage(page);
                await page.setViewportSize({ width: mobile ? 448 : 1280, height: 400 });
                await page.route('**/api/ping', async route => { await pingHeld; await route.fulfill({ status: 204 }); });
                try {
                    release(); await finished;
                    await resumePage(page, cdp);
                    await expect(page.locator('#chat .mes_text').last()).toHaveText(reply);
                    await expect(page.locator('#mes_stop')).toBeHidden();
                    await expect(page.locator('#browser-recovery')).toBeHidden();
                    await expect(page.locator('#send_textarea')).toHaveValue('Only my next unsent turn.');
                    await expect.poll(() => page.evaluate(reading => {
                        const { chat, input, first, scrollTop } = window.__viewportNodes;
                        const bounds = chat.getBoundingClientRect();
                        const composer = document.getElementById('form_sheld').getBoundingClientRect();
                        const final = chat.querySelector('.mes:last-child .mes_text').lastElementChild.getBoundingClientRect();
                        return {
                            same: chat === document.getElementById('chat') && input === document.getElementById('send_textarea') && first === chat.querySelector('.mes') && document.documentElement.style.position === window.__viewportNodes.position,
                            selection: [input.selectionStart, input.selectionEnd],
                            reading: !reading || Math.abs(chat.scrollTop - scrollTop) < 3,
                            final: reading || final.bottom <= bounds.bottom + 1,
                            fits: bounds.bottom <= composer.top + 1 && composer.bottom <= innerHeight + 1 && bounds.height > 80,
                        };
                    }, readingHistory)).toEqual({ same: true, selection: [5, 12], reading: true, final: true, fits: true });
                    expect(requests).toBe(1);
                    await page.screenshot({ path: testInfo.outputPath(`resumed-${readingHistory ? 'history' : 'latest'}-${mobile ? 'pixel' : 'desktop'}.png`) });
                } finally { releasePing(); release(); }
            });
        }
    });
}

for (const loss of ['reset', 'early-eof']) {
    test(`a ${loss} stream after freeze preserves partial text without success actions or replay`, async ({ page }, testInfo) => {
        const title = `Workspace e2e ${testInfo.testId}-${runId} interrupted`;
        await startStory(page, title);
        let upstream, requests = 0;
        const server = createServer((request, response) => {
            request.resume();
            if (request.url !== '/v1/chat/completions') { response.writeHead(404).end(); return; }
            requests++;
            upstream = response;
            response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
            response.write('data: {"choices":[{"index":0,"delta":{"content":"A partial lantern reply remains recoverable."}}]}\n\n');
        });
        await new Promise(resolve => server.listen(0, '0.0.0.0', resolve));
        try {
            await connectRecoveryFixture(page, `http://host.containers.internal:${server.address().port}/v1`);
            await page.evaluate(async () => {
                window.__receivedOnFailure = 0;
                const { eventSource, event_types } = await import('/script.js');
                eventSource.on(event_types.MESSAGE_RECEIVED, () => window.__receivedOnFailure++);
            });
            await page.locator('#send_textarea').fill('Describe the lantern.');
            await page.locator('#send_but').click();
            await expect(page.locator('#chat .mes_text').last()).toContainText('partial lantern reply', { timeout: 20000 });
            await page.locator('#send_textarea').fill('My next draft stays separate.');
            const cdp = await freezePage(page);
            if (loss === 'reset') upstream.destroy();
            else upstream.end();
            await resumePage(page, cdp);
            await expect(page.locator('#mes_stop')).toBeHidden({ timeout: 20000 });
            await expect(page.locator('#workspace-generation-status')).toBeHidden();
            await expect(page.locator('#send_textarea')).toHaveValue('My next draft stays separate.');
            await expect(page.getByRole('textbox', { name: 'Recovered partial reply', exact: true })).toHaveCount(0);
            expect(requests).toBe(1);
            await page.evaluate(async () => (await import('/script.js')).saveSettings());
            await page.reload();
            await expect(page.locator('#preloader')).toHaveCount(0, { timeout: 30000 });
            await navigate(page, 'chats');
            await page.locator('.workspace-conversations .workspace-scene-row').filter({ has: page.locator('strong', { hasText: title }) }).locator('.workspace-scene-open').click();
            await expect(page.locator('#send_textarea')).toHaveValue('My next draft stays separate.');
            await expect(page.locator('#chat .mes_text').last()).toHaveText('A partial lantern reply remains recoverable.');
            await expect(page.locator('#browser-recovery')).toBeHidden();
            await expect(page.locator('#send_textarea')).toHaveValue('My next draft stays separate.');
            expect(requests).toBe(1);
            await page.setViewportSize({ width: 448, height: 921 });
            await page.screenshot({ path: testInfo.outputPath('interrupted-reply-recovered.png') });
        } finally {
            server.closeAllConnections();
            await new Promise(resolve => server.close(resolve));
        }
    });
}

for (const complete of [true, false]) {
    test(`a multi-choice stream with ${complete ? 'all finish reasons' : 'only one finish reason'} handles EOF correctly`, async ({ page }, testInfo) => {
        await startStory(page, `Workspace e2e ${testInfo.testId}-${runId} multi EOF`);
        await connectRecoveryFixture(page);
        await page.evaluate(async () => { (await import('/scripts/openai.js')).oai_settings.n = 2; });
        await page.evaluate(async () => { window.__successEvents = 0; const script = await import('/script.js'); script.eventSource.on(script.event_types.MESSAGE_RECEIVED, () => window.__successEvents++); });
        await page.route('**/api/backends/chat-completions/generate', route => {
            expect(route.request().postDataJSON().n).toBe(2);
            const chunks = [
                { choices: [{ index: 0, delta: { content: 'The primary lantern reply.' }, finish_reason: 'stop' }] },
                { choices: [{ index: 1, delta: { content: 'The alternative lantern reply.' }, finish_reason: complete ? 'stop' : null }] },
            ];
            return route.fulfill({ contentType: 'text/event-stream', body: chunks.map(chunk => `data: ${JSON.stringify(chunk)}\n\n`).join('') });
        });
        await page.locator('#send_textarea').fill('Describe two lantern replies.');
        await page.locator('#send_but').click();
        await expect(page.locator('#chat .mes_text').last()).toHaveText('The primary lantern reply.');
        await expect(page.locator('#mes_stop')).toBeHidden();
        expect(await page.evaluate(() => window.__successEvents)).toBe(complete ? 1 : 0);
        if (complete) {
            await expect(page.locator('#browser-recovery')).toBeHidden();
            expect(await page.evaluate(async () => (await import('/script.js')).chat.at(-1).swipes)).toContain('The alternative lantern reply.');
        } else await expect(page.locator('#browser-recovery')).toContainText('interrupted');
    });
}

test('foreground retry coalesces events, refreshes CSRF and preserves explicit model settings', async ({ page }, testInfo) => {
    await startStory(page, `Workspace e2e ${testInfo.testId}-${runId} resume checks`);
    await connectRecoveryFixture(page);
    page.workspaceRecoveryRoutes = [];
    await page.evaluate(() => {
        window.__recoveryTrace = [];
        const root = document.getElementById('browser-recovery');
        new MutationObserver(() => window.__recoveryTrace.push({ at: performance.now(), hidden: root.hidden, busy: root.getAttribute('aria-busy'), message: root.querySelector('p').textContent })).observe(root, { childList: true, subtree: true, attributes: true, characterData: true });
    });
    await page.evaluate(async () => {
        const { oai_settings } = await import('/scripts/openai.js');
        oai_settings.openai_max_context = 12288;
        oai_settings.temp_openai = 0.85;
    });
    const before = await page.evaluate(async () => JSON.stringify((await import('/scripts/openai.js')).oai_settings));
    const modelOptions = () => page.locator('.model_custom_select').evaluateAll(nodes => nodes.map(node => ({ value: node.value, options: [...node.options].map(option => [option.value, option.textContent, option.selected]) })));
    const optionsBefore = await modelOptions();
    expect(optionsBefore.some(select => select.options.length > 0)).toBe(true);
    let pings = 0, checks = 0, csrf = 0, finishPing;
    const pending = new Promise(resolve => finishPing = resolve);
    await page.route('**/api/ping', async route => {
        pings++;
        page.workspaceRecoveryRoutes.push({ kind: 'initial-ping', count: pings });
        if (pings === 1) { await pending; await route.fulfill({ status: 403 }); }
        else await route.fulfill({ status: 204 });
    });
    await page.route('**/csrf-token', async route => { csrf++; await route.fulfill({ response: await route.fetch() }); });
    await page.route('**/api/backends/chat-completions/status', async route => { checks++; await route.fulfill({ json: { data: [{ id: 'different-first-model', context_length: 4096 }] } }); });
    await page.locator('#send_textarea').fill('Unsent draft during connection checks.');
    await page.evaluate(() => { for (let i = 0; i < 5; i++) { window.dispatchEvent(new Event('online')); document.dispatchEvent(new Event('resume')); } });
    await expect.poll(() => pings).toBe(1);
    finishPing();
    await expect.poll(() => checks).toBe(1);
    await expect(page.locator('#browser-recovery')).not.toHaveAttribute('aria-busy', 'true');
    expect(pings).toBe(2);
    expect(csrf).toBe(1);
    expect(await modelOptions()).toEqual(optionsBefore);
    expect(await page.evaluate(async () => JSON.stringify((await import('/scripts/openai.js')).oai_settings))).toBe(before);
    await expect(page.locator('#send_textarea')).toHaveValue('Unsent draft during connection checks.');
    // HTTP200 is not the native app heartbeat contract; expose retry inline.
    await page.route('**/api/ping', route => { page.workspaceRecoveryRoutes.push({ kind: 'outage-ping', status: 200 }); return route.fulfill({ status: 200, body: 'Synthetic login page' }); });
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await page.getByRole('button', { name: 'Retry connection', exact: true }).click();
    await expect(page.locator('#browser-recovery')).toContainText('app server is unavailable');
    // APP_READY can arrive after the user has already opened a story and checked
    // connectivity. It must not erase a newer failure/retry state.
    await page.evaluate(async () => { const script = await import('/script.js'); await script.eventSource.emit(script.event_types.APP_READY); });
    await expect(page.locator('#browser-recovery')).toContainText('app server is unavailable');
    await page.evaluate(async () => { const script = await import('/script.js'); await script.eventSource.emit(script.event_types.GENERATION_STARTED, 'quiet', {}, true); });
    await expect(page.locator('#browser-recovery')).toContainText('app server is unavailable');
    await page.setViewportSize({ width: 448, height: 400 });
    await page.screenshot({ path: testInfo.outputPath('foreground-outage-phone-keyboard.png') });
    await page.route('**/api/ping', route => { page.workspaceRecoveryRoutes.push({ kind: 'retry-ping', status: 204 }); return route.fulfill({ status: 204 }); });
    await page.getByRole('button', { name: 'Retry connection', exact: true }).click();
    await expect(page.locator('#browser-recovery')).toBeHidden();
    await expect(page.locator('#workspace-connection-label')).toHaveText('Model connected');
    expect(await modelOptions()).toEqual(optionsBefore);
    expect(await page.evaluate(async () => JSON.stringify((await import('/scripts/openai.js')).oai_settings))).toBe(before);
});

test('an unresponsive foreground heartbeat times out and can be retried without sending a reply', async ({ page }, testInfo) => {
    await startStory(page, `Workspace e2e ${testInfo.testId}-${runId} resume timeout`);
    await connectRecoveryFixture(page);
    let release, pings = 0, replies = 0;
    const held = new Promise(resolve => release = resolve);
    await page.route('**/api/ping', async route => { pings++; if (pings === 1) await held; await route.fulfill({ status: 204 }); });
    await page.route('**/api/backends/chat-completions/generate', route => { replies++; return route.abort(); });
    await page.locator('#send_textarea').fill('My draft through a timed-out check.');
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await page.getByRole('button', { name: 'Retry connection', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Retry connection', exact: true })).toBeDisabled();
    await expect(page.locator('#browser-recovery')).toContainText('Connection check could not finish', { timeout: 15000 });
    release();
    await page.getByRole('button', { name: 'Retry connection', exact: true }).click();
    await expect(page.locator('#browser-recovery')).toBeHidden();
    await expect(page.locator('#send_textarea')).toHaveValue('My draft through a timed-out check.');
    expect(pings).toBe(2);
    expect(replies).toBe(0);
});

test('a pending native save does not block foreground layout or connection checks', async ({ page }, testInfo) => {
    await startStory(page, `Workspace e2e ${testInfo.testId}-${runId} pending recovery save`);
    await connectRecoveryFixture(page);
    await expect.poll(() => page.evaluate(async () => (await import('/script.js')).isChatSaving)).toBe(false);
    let release, requested;
    const held = new Promise(resolve => release = resolve);
    const started = new Promise(resolve => requested = resolve);
    await page.route('**/api/chats/save', async route => { requested(); await held; await route.continue(); });
    await page.evaluate(async () => {
        const script = await import('/script.js');
        window.__pendingNativeSave = script.saveChatConditional();
        window.dispatchEvent(new Event('offline'));
    });
    try {
        await page.getByRole('button', { name: 'Retry connection', exact: true }).click();
        await started;
        await expect(page.locator('#browser-recovery')).not.toHaveAttribute('aria-busy', 'true');
        await page.locator('#send_textarea').fill('My draft while the native save waits.');
        await expect(page.locator('#send_textarea')).toHaveValue('My draft while the native save waits.');
        expect(await page.evaluate(async () => (await import('/script.js')).isChatSaving)).toBe(true);
    } finally { release(); }
    await expect.poll(() => page.evaluate(async () => (await import('/script.js')).isChatSaving)).toBe(false);
});

test('a delayed read-only foreground check cannot reconnect a changed provider', async ({ page }, testInfo) => {
    await startStory(page, `Workspace e2e ${testInfo.testId}-${runId} stale resume`);
    await connectRecoveryFixture(page);
    let release, requested;
    const held = new Promise(resolve => release = resolve);
    const started = new Promise(resolve => requested = resolve);
    await page.route('**/api/backends/chat-completions/status', async route => { requested(); await held; await route.fulfill({ json: { data: [{ id: 'stale-model' }] } }); });
    await page.evaluate(() => { window.__readonlyCheck = import('/scripts/openai.js').then(module => module.refreshChatCompletionStatus(new AbortController().signal)); });
    await started;
    await page.evaluate(async () => {
        const script = await import('/script.js');
        const { oai_settings } = await import('/scripts/openai.js');
        oai_settings.custom_model = 'new-manual-model';
        oai_settings.custom_url = 'http://127.0.0.1:23456/v1';
        script.setOnlineStatus('no_connection');
    });
    release();
    expect(await page.evaluate(() => window.__readonlyCheck)).toBe(false);
    await expect(page.locator('#workspace-connection-label')).toHaveText('Connect a model');
    expect(await page.evaluate(async () => (await import('/scripts/openai.js')).oai_settings.custom_model)).toBe('new-manual-model');
});

test('story drafts survive rapid switching and rename while the native recovery preference is respected', async ({ page }, testInfo) => {
    const first = `Workspace e2e ${testInfo.testId}-${runId} draft A`;
    const second = `Workspace e2e ${testInfo.testId}-${runId} draft B`;
    await startStory(page, first);
    await page.locator('#send_textarea').fill('First story unsent text.');
    await startStory(page, second);
    await expect(page.locator('#send_textarea')).toHaveValue('');
    await page.locator('#send_textarea').fill('Second story unsent text.');
    for (const title of [first, second, first]) {
        await navigate(page, 'chats');
        await page.locator('.workspace-conversations .workspace-scene-row').filter({ has: page.locator('strong', { hasText: title }) }).locator('.workspace-scene-open').click();
        await expect(page.locator('#send_textarea')).toHaveValue(title === first ? 'First story unsent text.' : 'Second story unsent text.');
    }
    const renamed = `${first} renamed`;
    await renameCurrentStory(page, renamed);
    await expect(page.locator('#send_textarea')).toHaveValue('First story unsent text.');
    await page.evaluate(async () => { (await import('/scripts/power-user.js')).power_user.restore_user_input = false; await (await import('/script.js')).saveSettings(); });
    await page.locator('#send_textarea').fill('Recovery is off for this text.');
    await page.reload();
    await expect(page.locator('#preloader')).toHaveCount(0, { timeout: 30000 });
    await navigate(page, 'chats');
    await page.locator('.workspace-conversations .workspace-scene-row').filter({ has: page.locator('strong', { hasText: renamed }) }).locator('.workspace-scene-open').click();
    await expect(page.locator('#send_textarea')).toHaveValue('');
});

test('old global drafts never interrupt chat and blocked storage retains the current draft', async ({ page }, testInfo) => {
    const title = `Workspace e2e ${testInfo.testId}-${runId} legacy draft`;
    await startStory(page, title);
    await page.evaluate(async () => {
        const { getCurrentUserHandle } = await import('/scripts/user.js');
        localStorage.setItem(`${getCurrentUserHandle()}_userInput`, 'Older native saved text.');
        await (await import('/script.js')).saveSettings();
    });
    // An upgrade finds this key at startup. Do not rely on a later unrelated
    // rendering event after injecting a key into an already initialized page.
    await page.reload();
    await expect(page.locator('#preloader')).toHaveCount(0, { timeout: 30000 });
    await navigate(page, 'chats');
    await page.locator('.workspace-conversations .workspace-scene-row').filter({ has: page.locator('strong', { hasText: title }) }).locator('.workspace-scene-open').click();
    await page.locator('#send_textarea').fill('Current draft.');
    await expect(page.getByRole('button', { name: 'Restore older saved draft', exact: true })).toHaveCount(0);
    await expect(page.locator('#browser-recovery')).toBeHidden();
    await expect(page.locator('#send_textarea')).toHaveValue('Current draft.');
    expect(await page.evaluate(async () => localStorage.getItem(`${(await import('/scripts/user.js')).getCurrentUserHandle()}_userInput`))).toBe('Older native saved text.');
    await page.evaluate(() => {
        for (const method of ['getItem', 'setItem', 'removeItem']) {
            const native = Storage.prototype[method];
            Storage.prototype[method] = function(key, ...args) {
                if (key.startsWith('st-recovery:')) throw new DOMException('Synthetic storage denial', 'SecurityError');
                return native.call(this, key, ...args);
            };
        }
    });
    await page.locator('#send_textarea').fill('This tab still holds my text.');
    await expect(page.locator('#browser-recovery')).toContainText('Browser storage is unavailable');
    await page.evaluate(() => { document.dispatchEvent(new Event('freeze')); document.dispatchEvent(new Event('resume')); });
    await expect(page.locator('#send_textarea')).toHaveValue('This tab still holds my text.');
    await expect(page.locator('#browser-recovery')).toContainText('copy your text before reloading');
});

test('identical story filenames on different characters never share a recovered draft', async ({ page }, testInfo) => {
    const prefix = `Workspace e2e ${testInfo.testId}-${runId}`;
    const title = `${prefix} same filename`;
    await startStory(page, title);
    const original = await page.evaluate(async () => (await import('/script.js')).characters[(await import('/script.js')).this_chid].avatar);
    await page.locator('#send_textarea').fill('Only the original character gets this draft.');
    const duplicate = await api(page, '/api/characters/duplicate', { avatar_url: original });
    const companion = await api(page, '/api/characters/rename', { avatar_url: duplicate.path, new_name: `${prefix} companion` });
    await page.evaluate(async avatar => {
        const script = await import('/script.js');
        await script.getCharacters();
        await script.selectCharacterById(script.characters.findIndex(character => character.avatar === avatar), { newChat: true });
    }, companion.avatar);
    await returnToChat(page);
    await renameCurrentStory(page, title);
    await expect(page.locator('#send_textarea')).toHaveValue('');
    await page.locator('#send_textarea').fill('Only the companion gets this draft.');
    await page.evaluate(async ({ avatar, title }) => {
        const script = await import('/script.js');
        await script.selectCharacterById(script.characters.findIndex(character => character.avatar === avatar));
        await script.openCharacterChat(title);
    }, { avatar: original, title });
    await expect(page.locator('#send_textarea')).toHaveValue('Only the original character gets this draft.');
});

test('quiet prompt callers keep rejection on transport failure without automatic retry', async ({ page }, testInfo) => {
    await startStory(page, `Workspace e2e ${testInfo.testId}-${runId} quiet failure`);
    await connectRecoveryFixture(page, undefined, false);
    let requests = 0;
    await page.route('**/api/backends/chat-completions/generate', route => { requests++; return route.abort('failed'); });
    const result = await page.evaluate(async () => {
        try { await (await import('/script.js')).generateQuietPrompt({ quietPrompt: 'Describe a blue book.' }); return 'resolved'; }
        catch (error) { return error.name; }
    });
    expect(result).toBe('NetworkError');
    expect(requests).toBe(1);
    await expect(page.locator('#mes_stop')).toBeHidden();
});

test('a late microphone permission result after suspension is stopped and never transcribed', async ({ page }, testInfo) => {
    await startStory(page, `Workspace e2e ${testInfo.testId}-${runId} paused microphone`);
    await page.evaluate(async () => {
        (await import('/scripts/dictation.js')).configureDictation('https://synthetic.example/v1/audio/transcriptions', 'transcription-fixture');
        window.__permissions = [];
        navigator.mediaDevices.getUserMedia = () => new Promise(resolve => {
            const destination = new AudioContext().createMediaStreamDestination();
            window.__permissions.push({ stream: destination.stream, allow: () => resolve(destination.stream) });
        });
    });
    let requests = 0;
    await page.route('**/api/openai/custom/transcribe-audio', route => { requests++; return route.fulfill({ json: { text: 'Must not be inserted.' } }); });
    await page.locator('#send_textarea').fill('My unsent microphone draft.');
    await page.locator('#workspace-dictation').click();
    await expect(page.locator('#dictation-status')).toContainText('Allow microphone access');
    const cdp = await freezePage(page);
    await resumePage(page, cdp);
    await expect(page.locator('#dictation-status')).toContainText('Recording stopped');
    // Retry before the old permission result arrives. A stale result must not
    // clear the newer permission request's pending ownership.
    await page.locator('#workspace-dictation').click();
    await expect(page.locator('#dictation-status')).toContainText('Allow microphone access');
    await page.evaluate(() => window.__permissions[0].allow());
    await expect.poll(() => page.evaluate(() => window.__permissions[0].stream.getTracks().every(track => track.readyState === 'ended'))).toBe(true);
    const secondPause = await freezePage(page);
    await resumePage(page, secondPause);
    await page.evaluate(() => window.__permissions[1].allow());
    await expect(page.locator('#dictation-status')).toContainText('Recording stopped');
    await expect.poll(() => page.evaluate(() => window.__permissions[1].stream.getTracks().every(track => track.readyState === 'ended'))).toBe(true);
    await expect(page.locator('#workspace-dictation')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#send_textarea')).toHaveValue('My unsent microphone draft.');
    expect(requests).toBe(0);
});

test('a native save failure never creates a recovered reply workflow', async ({ page }, testInfo) => {
    const title = `Workspace e2e ${testInfo.testId}-${runId} save retry`;
    await startStory(page, title);
    await connectRecoveryFixture(page);
    let failSave = false;
    await page.route('**/api/chats/save', async route => failSave ? route.fulfill({ status: 503, json: { error: 'Synthetic save outage' } }) : route.continue());
    await page.route('**/api/backends/chat-completions/generate', async route => {
        failSave = true;
        await route.fulfill({ contentType: 'text/event-stream', body: 'data: {"choices":[{"index":0,"delta":{"content":"A completed reply waiting to be saved."},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n' });
    });
    await page.locator('#send_textarea').fill('Describe the lantern.');
    await page.locator('#send_but').click();
    await expect(page.locator('#mes_stop')).toBeHidden();
    await expect(page.locator('#browser-recovery')).toBeHidden();
    await expect(page.locator('#chat .mes_text').last()).toHaveText('A completed reply waiting to be saved.');
    expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('st-recovery:reply:')).length)).toBe(0);
    failSave = false;
    await page.evaluate(async () => (await import('/script.js')).saveChatConditional());
    expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('st-recovery:reply:')).length)).toBe(0);
    await page.evaluate(async () => (await import('/script.js')).saveSettings());
    await page.reload();
    await expect(page.locator('#preloader')).toHaveCount(0, { timeout: 30000 });
    await navigate(page, 'chats');
    await page.locator('.workspace-conversations .workspace-scene-row').filter({ has: page.locator('strong', { hasText: title }) }).locator('.workspace-scene-open').click();
    await expect(page.locator('#chat .mes_text').last()).toHaveText('A completed reply waiting to be saved.');
    await expect(page.locator('#browser-recovery')).toBeHidden();
});

test('old reply checkpoints stay untouched and never become character chat popups or user drafts', async ({ page }, testInfo) => {
    const title = `Workspace e2e ${testInfo.testId}-${runId} old checkpoints`;
    await startStory(page, title);
    const records = await page.evaluate(async () => {
        const script = await import('/script.js');
        const handle = (await import('/scripts/user.js')).getCurrentUserHandle();
        const identity = JSON.stringify([handle, 'character', script.characters[script.this_chid].avatar, script.getCurrentChatId()]);
        const records = { text: 'Old character reply must never become user input.', messageId: 1, sendDate: 'old fixture date', status: 'interrupted', previous: [
            { text: 'An older pending reply.', messageId: 2, sendDate: 'older fixture date', status: 'pending' },
            { text: 'An older completed reply.', messageId: 3, sendDate: 'earlier fixture date', status: 'complete' },
        ] };
        const key = `st-recovery:reply:${identity}`;
        localStorage.setItem(key, JSON.stringify(records));
        await script.saveSettings();
        return { key, value: JSON.stringify(records) };
    });
    await page.locator('#send_textarea').fill('Only my unsent draft.');
    const cdp = await freezePage(page);
    await resumePage(page, cdp);
    await expect(page.locator('#browser-recovery')).toBeHidden();
    await expect(page.locator('#send_textarea')).toHaveValue('Only my unsent draft.');
    await page.reload();
    await expect(page.locator('#preloader')).toHaveCount(0, { timeout: 30000 });
    await navigate(page, 'chats');
    await page.locator('.workspace-conversations .workspace-scene-row').filter({ has: page.locator('strong', { hasText: title }) }).locator('.workspace-scene-open').click();
    await expect(page.locator('#send_textarea')).toHaveValue('Only my unsent draft.');
    await expect(page.locator('#browser-recovery')).toBeHidden();
    await expect(page.locator('#browser-recovery details, #browser-recovery textarea')).toHaveCount(0);
    expect(await page.evaluate(key => localStorage.getItem(key), records.key)).toBe(records.value);
    await expect(page.locator('#chat')).not.toContainText('Old character reply must never become user input.');
    await page.screenshot({ path: testInfo.outputPath('legacy-checkpoints-no-popup.png') });
});

for (const streaming of [false, true]) {
    test(`stopping a pending ${streaming ? 'streamed' : 'nonstreamed'} reply restores the composer and preserves its next draft`, async ({ page }, testInfo) => {
        await startStory(page, `Workspace e2e ${testInfo.testId}-${runId} stop`);
        await page.route('**/api/backends/chat-completions/status', route => route.fulfill({ json: { data: [{ id: 'workspace-fixture' }] } }));
        let finishReply;
        const replyReady = new Promise(resolve => finishReply = resolve);
        await page.route('**/api/backends/chat-completions/generate', async route => {
            await replyReady;
            if (streaming) await route.fulfill({ contentType: 'text/event-stream', body: 'data: {"choices":[{"index":0,"delta":{"content":"A cancelled reply must not appear."}}]}\n\ndata: [DONE]\n\n' });
            else await route.fulfill({ json: { choices: [{ message: { content: 'A cancelled reply must not appear.' } }] } });
        });
        await settingsCategory(page, 'connection');
        await page.locator('#chat_completion_source').selectOption('custom');
        await page.locator('#custom_api_url_text').fill('http://127.0.0.1:12345/v1');
        await page.locator('#custom_model_id').fill('workspace-fixture');
        await page.locator('#api_button_openai').click();
        await expect(page.locator('#workspace-connection-label')).toHaveText('Model connected');
        await settingsCategory(page, 'generation');
        await page.locator('#stream_toggle').setChecked(streaming);
        await page.keyboard.press('Escape');
        await page.locator('#send_textarea').fill('Describe the blue book.');
        await page.locator('#send_but').click();
        await expect(page.locator('#mes_stop')).toBeVisible();
        await page.locator('#send_textarea').fill('My next draft stays here.');
        await page.locator('#mes_stop').click();
        await expect(page.locator('#mes_stop')).toBeHidden();
        await expect(page.locator('#send_but')).toBeVisible();
        await expect.poll(() => page.evaluate(async () => (await import('/script.js')).isGenerating())).toBe(false);
        await expect(page.locator('#workspace-image-button')).toBeEnabled();
        await expect(page.locator('#workspace-generation-status')).toBeHidden();
        await expect(page.locator('#send_textarea')).toHaveValue('My next draft stays here.');
        finishReply();
        await expect(page.locator('#chat')).not.toContainText('A cancelled reply must not appear.');
        await page.screenshot({ path: testInfo.outputPath('stopped-reply.png') });
    });
}

for (const castOutcome of ['stop', 'network loss']) {
    test(`a two-member cast handles ${castOutcome} without advancing the queue or losing its next draft`, async ({ page }, testInfo) => {
        const prefix = `Workspace e2e ${testInfo.testId}-${runId}`;
        const avatar = await page.evaluate(async () => (await import('/script.js')).characters[0].avatar);
        const duplicate = await api(page, '/api/characters/duplicate', { avatar_url: avatar });
        const companion = await api(page, '/api/characters/rename', { avatar_url: duplicate.path, new_name: `${prefix} companion` });
        await page.evaluate(async () => (await import('/script.js')).getCharacters());
        const group = await page.evaluate(async ({ name, members }) => (await import('/scripts/group-chats.js')).createGroupWithMembers(name, members), { name: `${prefix} cast`, members: [avatar, companion.avatar] });
        await navigate(page, 'characters');
        await page.locator('.workspace-library-card').filter({ hasText: `${prefix} cast` }).click();
        await page.getByRole('button', { name: 'Start new story', exact: true }).click();
        await expect(page.locator('#send_textarea')).toBeVisible();
        await renameCurrentStory(page, `${prefix} group-stop`);
        await page.locator('#workspace-header-portrait').click();
        await page.locator('#workspace-scene-info [data-workspace-action="edit-entity"]').click();
        await page.locator('#rm_group_activation_strategy').selectOption('1');
        expect(await page.evaluate(async id => (await import('/scripts/group-chats.js')).groups.find(group => group.id === id).activation_strategy, group.id)).toBe(1);
        await page.keyboard.press('Escape');
        await returnToChat(page);
        await page.route('**/api/backends/chat-completions/status', route => route.fulfill({ json: { data: [{ id: 'workspace-fixture' }] } }));
        let finishReply, requested;
        const replyReady = new Promise(resolve => finishReply = resolve);
        const firstRequest = new Promise(resolve => requested = resolve);
        let requests = 0;
        await page.route('**/api/backends/chat-completions/generate', async route => {
            requests++;
            requested();
            await replyReady;
            if (castOutcome === 'network loss') await route.abort('failed');
            else await route.fulfill({ json: { choices: [{ message: { content: 'Cancelled cast text must not appear.' } }] } });
        });
        await settingsCategory(page, 'connection');
        await page.locator('#chat_completion_source').selectOption('custom');
        await page.locator('#custom_api_url_text').fill('http://127.0.0.1:12345/v1');
        await page.locator('#custom_model_id').fill('workspace-fixture');
        await page.locator('#api_button_openai').click();
        await expect(page.locator('#workspace-connection-label')).toHaveText('Model connected');
        await settingsCategory(page, 'generation');
        await page.locator('#stream_toggle').uncheck();
        await page.keyboard.press('Escape');
        await page.locator('#send_textarea').fill('Describe the library together.');
        await page.locator('#send_but').click();
        await firstRequest;
        await page.locator('#send_textarea').fill('My next cast draft.');
        if (castOutcome === 'stop') await page.locator('#mes_stop').click();
        else {
            const cdp = await freezePage(page);
            finishReply();
            await resumePage(page, cdp);
        }
        await expect.poll(() => page.evaluate(async () => (await import('/script.js')).isGenerating())).toBe(false);
        await expect(page.locator('#send_but')).toBeVisible();
        await expect(page.locator('#send_textarea')).toHaveValue('My next cast draft.');
        finishReply();
        await expect(page.locator('#workspace-generation-status')).toBeHidden();
        await expect(page.locator('#workspace-image-button')).toBeEnabled();
        expect(requests).toBe(1);
        await expect(page.locator('#chat')).not.toContainText('Cancelled cast text must not appear.');
        await page.screenshot({ path: testInfo.outputPath('stopped-cast-queue.png') });
    });
}

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
    await settingsCategory(page, 'generation');
    await page.locator('#stream_toggle').check();
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
    let finishImage, imageDelivered;
    const imageReady = new Promise(resolve => finishImage = resolve);
    const imageFinished = new Promise(resolve => imageDelivered = resolve);
    await page.route('**/api/openai/generate-image', async route => {
        imageRequests++;
        expect(route.request().postDataJSON().prompt).toContain('forest clearing');
        await imageReady;
        await route.fulfill({ json: { data: [{ b64_json: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jS1kAAAAASUVORK5CYII=' }] } });
        imageDelivered();
    });
    await page.locator('#send_textarea').fill('My draft while the illustration finishes.');
    await page.locator('#workspace-image-button').click();
    await expect.poll(() => imageRequests).toBe(1);
    await expect(page.locator('#workspace-image-button')).toBeDisabled();
    await expect(page.locator('#workspace-tools')).toBeHidden();
    await navigate(page, 'chats');
    await page.locator('.workspace-conversations .workspace-scene-row').filter({ hasText: title }).locator('.workspace-scene-open').click();
    await expect(page.locator('#workspace-image-status')).toContainText('Creating a scene illustration');
    expect(await page.evaluate(async () => (await import('/scripts/extensions.js')).extension_settings.sd.enabled)).toBe(false);
    await expect(page.locator('#send_textarea')).toHaveValue('My draft while the illustration finishes.');
    const pause = await freezePage(page);
    finishImage();
    await imageFinished;
    await resumePage(page, pause);
    await expect(page.locator('#workspace-image-status')).toContainText('Illustration added', { timeout: 20000 });
    await expect(page.locator('#send_textarea')).toHaveValue('My draft while the illustration finishes.');
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
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    await expect(page.locator('#send_textarea')).toBeVisible();
    await renameCurrentStory(page, `${prefix} group-scene`);
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

for (const width of [320, 390, 448, 768]) {
    test(`roleplay pages and composer stay within a ${width}px viewport`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width, height: width === 448 ? 997 : 844 });
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
        await expect(page.locator('.workspace-creative-menu')).not.toHaveAttribute('open');
        await page.locator('.workspace-creative-menu summary').click();
        await page.locator('#extensionsMenuButton').click();
        await expect(page.locator('#extensionsMenu')).toBeVisible();
        // The phone tools popover covers the editor's upper area. Click its exposed lower edge.
        await page.locator('#send_textarea').click({ position: { x: 8, y: (await page.locator('#send_textarea').boundingBox()).height - 4 } });
        await expect(page.locator('#extensionsMenu')).toBeHidden();
        await expect(page.locator('.workspace-creative-menu')).not.toHaveAttribute('open');
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

test.describe('Pixel 9 Pro XL portrait sizing', () => {
    test.use({
        isMobile: true,
        hasTouch: true,
        userAgent: devices['Pixel 7'].userAgent.replace('Pixel 7', 'Pixel 9 Pro XL'),
        screen: { width: 448, height: 997 },
        viewport: { width: 448, height: 921 },
        deviceScaleFactor: 3,
    });

    test('message portraits fit their containers and stay clear of text across screen and font sizes', async ({ page }, testInfo) => {
        await startStory(page, `Workspace e2e ${testInfo.testId}-${runId} portraits`);
        const audit = [];
        for (const scale of [1, 1.5]) {
            await settingsCategory(page, 'settings');
            await page.locator('#font_scale').evaluate((input, scale) => {
                input.value = String(scale);
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('mouseup', { bubbles: true }));
            }, scale);
            await page.keyboard.press('Escape');
            // Chromium's Pixel 9 Pro XL screen is448x997 at DPR3; include
            // reduced browser-chrome/keyboard heights and landscape as well.
            for (const { width, height } of [{ width: 320, height: 844 }, { width: 390, height: 844 }, { width: 448, height: 997 }, { width: 448, height: 921 }, { width: 448, height: 400 }, { width: 997, height: 448 }, { width: 945, height: 396 }, { width: 768, height: 844 }, { width: 1280, height: 844 }]) {
                await page.setViewportSize({ width, height });
                const message = page.locator('#chat .mes[is_user="false"]').first();
                await message.scrollIntoViewIfNeeded();
                await page.locator('#chat').evaluate(chat => { chat.scrollTop = 0; });
                const bounds = await message.evaluate(message => {
                    const box = selector => message.querySelector(selector).getBoundingClientRect().toJSON();
                    return { image: box('.avatar img'), avatar: box('.avatar'), wrapper: box('.mesAvatarWrapper'), name: box('.ch_name'), text: box('.mes_text') };
                });
                audit.push({ width, height, scale, deviceScaleFactor: await page.evaluate(() => devicePixelRatio), ...bounds });
                expect(bounds.image.right).toBeLessThanOrEqual(bounds.avatar.right + 0.5);
                expect(bounds.image.bottom).toBeLessThanOrEqual(bounds.avatar.bottom + 0.5);
                expect(bounds.image.left).toBeGreaterThanOrEqual(bounds.avatar.left - 0.5);
                expect(bounds.image.right + 8).toBeLessThanOrEqual(bounds.name.left);
                expect(bounds.image.right + 8).toBeLessThanOrEqual(bounds.text.left);
                expect(bounds.wrapper.width).toBeGreaterThanOrEqual(bounds.avatar.width);
                await page.screenshot({ path: testInfo.outputPath(`portrait-${width}-${height}-${scale}.png`), scale: 'css' });
            }
        }
        fs.writeFileSync(testInfo.outputPath('portrait-layout.json'), JSON.stringify(audit, null, 2));
    });
});

test('native font preferences and browser text sizing keep phone controls usable', async ({ page }, testInfo) => {
    await startStory(page, `Workspace e2e ${testInfo.testId}-${runId} large text`);
    await page.route('**/api/backends/chat-completions/status', route => route.fulfill({ json: { data: [{ id: 'workspace-fixture' }] } }));
    await settingsCategory(page, 'connection');
    await page.locator('#chat_completion_source').selectOption('custom');
    await page.locator('#custom_api_url_text').fill('http://127.0.0.1:12345/v1');
    await page.locator('#custom_model_id').fill('workspace-fixture');
    await page.locator('#api_button_openai').click();
    await expect(page.locator('#workspace-connection-label')).toHaveText('Model connected');
    await page.keyboard.press('Escape');
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
    await page.setViewportSize({ width: 320, height: 568 });
    await expect(page.locator('#send_but')).toBeVisible();
    const send = await page.locator('#send_but').boundingBox();
    expect(send.x).toBeGreaterThanOrEqual(0);
    expect(send.x + send.width).toBeLessThanOrEqual(321);
    await page.locator('.workspace-creative-menu summary').click();
    const menu = page.locator('.workspace-creative-menu .workspace-action-menu');
    await expect.poll(() => menu.evaluate(node => node.getBoundingClientRect().top >= document.getElementById('workspace-header').getBoundingClientRect().bottom)).toBe(true);
    expect(await menu.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    await page.locator('#extensionsMenuButton').scrollIntoViewIfNeeded();
    await expect(page.locator('#extensionsMenuButton')).toBeInViewport();
    await page.locator('.workspace-creative-menu summary').click();
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

test('query-string navigation keeps background tabs local and every native owner unique', async ({ page }) => {
    const rootFetches = [];
    page.on('request', request => { if (['xhr', 'fetch'].includes(request.resourceType()) && new URL(request.url()).pathname === '/') rootFetches.push(request.url()); });
    await page.goto('/?workspace-review=query');
    await expect(page.locator('#preloader')).toHaveCount(0, { timeout: 30000 });
    await settingsCategory(page, 'backgrounds');
    for (const fragment of ['#bg_chat_tab', '#bg_global_tab']) {
        await page.locator(`#bg_tabs > ul a[href$="${fragment}"]`).click();
        await expect(page.locator(fragment)).toBeVisible();
    }
    await settingsCategory(page, 'image-settings');
    await expect(page.locator('.sd_settings')).toBeVisible();
    for (const id of ['workspace-sidebar', 'workspace-menu', 'workspace-settings-shell', 'rm_extensions_block', 'sd_steps_value', 'connection_profiles', 'bg_tabs']) await expect(page.locator(`#${id}`)).toHaveCount(1);
    expect(rootFetches).toEqual([]);
    await page.reload();
    await expect(page.locator('#preloader')).toHaveCount(0, { timeout: 30000 });
    await settingsCategory(page, 'image-settings');
    await expect(page.locator('.sd_settings')).toBeVisible();
    await expect(page.locator('#rm_extensions_block')).toHaveCount(1);
    expect(rootFetches).toEqual([]);
});

for (const destination of ['image-settings', 'connection']) {
    test(`late extension activation recovers ${destination} without replacing edited controls`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width: destination === 'image-settings' ? 448 : 1280, height: 921 });
        let release, requested;
        const held = new Promise(resolve => release = resolve);
        const arrived = new Promise(resolve => requested = resolve);
        await page.route('**/scripts/extensions/stable-diffusion/settings.html', async route => { requested(); await held; await route.continue(); });
        await page.addInitScript(() => {
            window.__lateReady = false;
            import('/scripts/events.js').then(({ eventSource, event_types }) => eventSource.on(event_types.APP_READY, () => window.__lateReady = true));
        });
        await page.reload({ waitUntil: 'domcontentloaded' });
        await arrived;
        await expect.poll(() => page.evaluate(() => window.__lateReady), { timeout: 30000 }).toBe(true);
        await expect(page.locator('.sd_settings')).toHaveCount(0);
        try {
            await settingsCategory(page, 'image-settings', false);
            if (destination === 'connection') {
                const root = 'http://127.0.0.1:12345';
                const models = { chat: [{ id: 'late-story' }], images: [{ id: 'late-image' }], speak: [], transcribe: [], embeddings: [] };
                await page.route('**/api/openai/custom/discover', route => route.fulfill({ json: { root, base: `${root}/v1`, juiced: true, protocols: [{ id: 'automatic1111', features: ['txt2img'] }], services: Object.fromEntries(Object.entries(models).map(([service, models]) => [service, { models }])) } }));
                await settingsCategory(page, 'servers');
                await page.locator('#service-server-url').fill(root);
                await page.locator('#service-discover').click();
                await expect(page.locator('#service-discovery-status')).toContainText('Connected to Juiced');
                await settingsCategory(page, 'connection');
                await page.locator('#chat_completion_source').selectOption('custom');
                await page.locator('#custom_api_url_text').fill('http://127.0.0.1:23456/v1');
                await page.locator('#service-chat-model').selectOption('late-story');
                await page.locator('#custom_api_url_text').focus();
                page.lateNative = await page.locator('#custom_api_url_text').elementHandle();
                page.lateModel = await page.locator('#service-chat-model').elementHandle();
            } else await expect(page.locator('.workspace-settings-host')).toContainText(/not (loaded|available yet)/);
            await page.screenshot({ path: testInfo.outputPath(`late-${destination}-before.png`) });
            release();
            await expect(page.locator('.sd_image_settings')).toHaveCount(1, { timeout: 30000 });
            await expect(page.locator('.sd_writer_settings')).toHaveCount(1);
            if (destination === 'image-settings') {
                await expect(page.locator('.sd_settings')).toBeVisible();
                await expect(page.locator('.workspace-settings-host')).not.toContainText(/not (loaded|available yet)/);
                await page.locator('#sd_steps_value').fill('8');
                await page.locator('#sd_steps_value').press('Tab');
                await page.locator('.sd_settings .workspace-advanced-creative > summary').click();
            } else {
                await expect(page.locator('#custom_api_url_text')).toBeFocused();
                await expect(page.locator('#custom_api_url_text')).toHaveValue('http://127.0.0.1:23456/v1');
                await expect(page.locator('#service-chat-model')).toHaveValue('late-story');
                expect(await page.locator('#custom_api_url_text').evaluate((node, original) => node === original, page.lateNative)).toBe(true);
                expect(await page.locator('#service-chat-model').evaluate((node, original) => node === original, page.lateModel)).toBe(true);
                await expect(page.locator('#service-images-row')).toHaveCount(1);
            }
            await page.evaluate(async () => { const { eventSource, event_types } = await import('/scripts/events.js'); for (let i = 0; i < 3; i++) await eventSource.emit(event_types.EXTENSION_ACTIVATED, 'stable-diffusion'); });
            await expect(page.locator('.sd_image_settings')).toHaveCount(1);
            await expect(page.locator('#connection_profiles')).toHaveCount(1);
            if (destination === 'image-settings') {
                await expect(page.locator('#sd_steps_value')).toHaveValue('8');
                await expect(page.locator('.sd_settings .workspace-advanced-creative')).toHaveAttribute('open', '');
            } else {
                await expect(page.locator('#custom_api_url_text')).toBeFocused();
                await expect(page.locator('#service-chat-model')).toHaveValue('late-story');
            }
            await page.screenshot({ path: testInfo.outputPath(`late-${destination}-after.png`) });
        } finally { release(); }
    });
}

for (const touch of [false, true]) {
    test.describe(`Action menus: ${touch ? 'Pixel 9 Pro XL touch' : 'desktop'}`, () => {
        test.use({ viewport: touch ? { width: 448, height: 921 } : { width: 1280, height: 800 }, hasTouch: touch, isMobile: touch, deviceScaleFactor: touch ? 3 : 1 });
        test('transient menus dismiss outside without closing persistent controls', async ({ page }, testInfo) => {
            const activate = locator => touch ? locator.tap() : locator.click();
            await startStory(page, `Workspace e2e ${testInfo.testId}-${runId} dismissal ${touch}`);
            const tools = page.locator('.workspace-creative-menu');
            const toolsTrigger = tools.locator('summary');
            const story = page.locator('#workspace-header-menu details');
            const storyTrigger = story.locator('summary');
            await activate(toolsTrigger);
            await expect(tools).toHaveAttribute('open', '');
            await tools.locator('.workspace-action-menu').click({ position: { x: 3, y: 3 } });
            await expect(tools).toHaveAttribute('open', '');
            await page.screenshot({ path: testInfo.outputPath('menu-open.png') });
            await activate(page.locator('#workspace-chat-title'));
            await expect(tools).not.toHaveAttribute('open');
            await page.screenshot({ path: testInfo.outputPath('menu-dismissed.png') });
            if (touch) {
                await activate(toolsTrigger);
                await activate(page.locator('#workspace-menu'));
                await expect(tools).not.toHaveAttribute('open');
                await expect(page.locator('body')).toHaveClass(/workspace-nav-open/);
                await page.locator('#workspace-scrim').tap({ position: { x: 440, y: 460 } });
                await expect(page.locator('body')).not.toHaveClass(/workspace-nav-open/);
            }
            await activate(toolsTrigger);
            await activate(storyTrigger);
            await expect(tools).not.toHaveAttribute('open');
            await expect(story).toHaveAttribute('open', '');
            // Escape dismisses one layer; the inspector underneath stays mounted.
            await activate(page.locator('#workspace-header-portrait'));
            await expect(story).not.toHaveAttribute('open');
            await expect(page.locator('#workspace-scene-info')).toBeVisible();
            await activate(storyTrigger);
            await page.keyboard.press('Escape');
            await expect(story).not.toHaveAttribute('open');
            await expect(storyTrigger).toBeFocused();
            await expect(page.locator('#workspace-scene-info')).toBeVisible();
            await page.keyboard.press('Escape');
            await expect(page.locator('#workspace-scene-info')).toBeHidden();
            await activate(toolsTrigger);
            await page.evaluate(() => document.getElementById('send_textarea').click());
            await expect(tools).toHaveAttribute('open', '');
            await page.locator('#send_textarea').focus();
            await expect(tools).toHaveAttribute('open', '');
            await toolsTrigger.focus();
            await page.keyboard.press('Tab');
            await expect(tools.getByRole('button', { name: 'Portrait or custom image', exact: true })).toBeFocused();
            await expect(tools).toHaveAttribute('open', '');
            await page.keyboard.press('Shift+Tab');
            await page.keyboard.press('Shift+Tab');
            await expect(tools).not.toHaveAttribute('open');
            for (const [trigger, panel] of [['#options_button', '#options'], ['#extensionsMenuButton', '#extensionsMenu']]) {
                await activate(toolsTrigger);
                await activate(page.locator(trigger));
                await expect(page.locator(panel)).toBeVisible();
                await page.keyboard.press('Escape');
                await page.keyboard.press('Escape');
                await expect(page.locator(panel)).toBeHidden();
                await expect(tools).not.toHaveAttribute('open');
                await expect(toolsTrigger).toBeFocused();
                await activate(toolsTrigger);
                await activate(page.locator(trigger));
                await expect(page.locator(panel)).toBeVisible();
                await expect(tools).toHaveAttribute('open', '');
                await page.keyboard.press('Escape');
                await expect(page.locator(panel)).toBeHidden();
                await expect(page.locator(trigger)).toBeFocused();
                await expect(tools).toHaveAttribute('open', '');
                await activate(page.locator(trigger));
                await expect(page.locator(panel)).toBeVisible();
                // Nonfocusable body text used to leave the native anchor focused.
                await activate(page.locator('#workspace-chat-title'));
                await expect(page.locator(panel)).toBeHidden();
                await expect(tools).not.toHaveAttribute('open');
            }
            await settingsCategory(page, 'image-settings');
            await page.locator('.sd_settings .workspace-advanced-creative > summary').click();
            await page.locator('#sd_enabled').check();
            await returnToChat(page);
            await activate(toolsTrigger);
            await activate(page.locator('#extensionsMenuButton'));
            await activate(page.locator('#sd_gen'));
            await expect(page.locator('#sd_dropdown')).toBeVisible();
            await activate(page.locator('#sd_dropdown span').first());
            await expect(page.locator('#sd_dropdown')).toBeVisible();
            await expect(page.locator('#extensionsMenu')).toBeVisible();
            await expect(tools).toHaveAttribute('open', '');
            await page.keyboard.press('Escape');
            await expect(page.locator('#sd_dropdown')).toBeHidden();
            await expect(page.locator('#sd_gen')).toBeFocused();
            await expect(page.locator('#extensionsMenu')).toBeVisible();
            await page.keyboard.press('Enter');
            await expect(page.locator('#sd_dropdown')).toBeVisible();
            await page.keyboard.press('Escape');
            await expect(page.locator('#sd_dropdown')).toBeHidden();
            await page.keyboard.press('Escape');
            await expect(page.locator('#extensionsMenu')).toBeHidden();
            await expect(tools).toHaveAttribute('open', '');
            await page.keyboard.press('Escape');
            await expect(tools).not.toHaveAttribute('open');
            // Choosing a menu action takes effect with the same click/tap.
            await activate(toolsTrigger);
            await activate(tools.getByRole('button', { name: 'Image settings', exact: true }));
            const panel = page.locator('.sd_settings');
            await expect(panel).toBeVisible();
            const original = await panel.elementHandle();
            await settingsCategory(page, 'image-settings');
            const disclosure = page.locator('.sd_settings .workspace-advanced-creative');
            await disclosure.locator(':scope > summary').click();
            await expect(disclosure).toHaveAttribute('open', '');
            await activate(page.locator('#workspace-chat-title'));
            await expect(disclosure).toHaveAttribute('open', '');
            await expect(panel).toBeVisible();
            expect(await panel.evaluate((node, original) => node === original, original)).toBe(true);
            await expect(page.locator('dialog[open]')).toHaveCount(0);
            await navigate(page, 'chats');
            const rowMenu = page.locator('#workspace-view .workspace-scene-menu').first();
            await activate(rowMenu.locator('summary'));
            await expect(rowMenu).toHaveAttribute('open', '');
            await activate(page.locator('#workspace-chat-title'));
            await expect(rowMenu).not.toHaveAttribute('open');
            await settingsCategory(page, 'settings');
            const saved = page.waitForResponse(response => response.url().endsWith('/api/settings/save') && response.request().postDataJSON().accountStorage?.workspaceLayout === 'false');
            await page.locator('#workspace-layout-toggle').uncheck();
            await saved;
            await page.reload();
            await expect(page.locator('#preloader')).toHaveCount(0, { timeout: 30000 });
            await expect(page.locator('body')).not.toHaveClass(/workspace-ui/);
            await activate(page.locator('#options_button'));
            await expect(page.locator('#options')).toBeVisible();
            await page.locator('#options_button').focus();
            await activate(page.locator('#chat .mes_text').first());
            await expect(page.locator('#options')).toBeHidden();
        });
    });
}

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
