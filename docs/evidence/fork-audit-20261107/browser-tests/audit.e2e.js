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


test('audit: failed current-format story load must preserve existing transcript', async ({page}, testInfo) => {
    const title=`Workspace e2e ${testInfo.testId}-${runId} protected target`;
    await startStory(page,title);
    const target=await page.evaluate(async () => {
        const s=await import('/script.js');
        s.chat.push({name:'Storyteller',is_user:true,is_system:false,send_date:Date.now(),mes:'Audit user message must survive.'},{name:'Seraphina',is_user:false,is_system:false,send_date:Date.now()+1,mes:'Audit assistant sentinel must survive.'});
        await s.saveChatConditional();
        return {file_name:s.getCurrentChatId(),ch_name:s.characters[s.this_chid].name,avatar_url:s.characters[s.this_chid].avatar};
    });
    const before=await api(page,'/api/chats/get',target);
    expect(before[0].chat_metadata.integrity).toBeTruthy();
    expect(before.some(m=>m.mes==='Audit assistant sentinel must survive.')).toBe(true);
    await startStory(page,`Workspace e2e ${testInfo.testId}-${runId} other`);
    let reads=0;
    const fail=async route=>{
        if(route.request().postDataJSON().file_name===target.file_name){reads++;return route.fulfill({status:503,json:{error:'Synthetic read outage'}});}
        return route.continue();
    };
    await page.route('**/api/chats/get',fail);
    const save=page.waitForResponse(r=>r.url().endsWith('/api/chats/save')&&r.request().postDataJSON().file_name===target.file_name);
    await navigate(page,'chats');
    await page.locator('.workspace-conversations .workspace-scene-row').filter({has:page.locator('strong',{hasText:title})}).locator('.workspace-scene-open').click();
    const saved=await save;
    await page.unroute('**/api/chats/get',fail);
    const after=await api(page,'/api/chats/get',target);
    fs.writeFileSync(testInfo.outputPath('load-failure-observation.json'),JSON.stringify({target,reads,saveStatus:saved.status(),originalIntegrity:before[0].chat_metadata.integrity,savedIntegrity:saved.request().postDataJSON().chat[0].chat_metadata.integrity??null,before,after},null,2));
    await page.screenshot({path:testInfo.outputPath('failed-read-transcript.png')});
    expect(after).toEqual(before);
});

test('audit: unsupported read-only provider must not show false connection failure', async ({page},testInfo)=>{
    await startStory(page,`Workspace e2e ${testInfo.testId}-${runId} claude foreground`);
    await connectRecoveryFixture(page);
    await page.evaluate(async()=>{
        const s=await import('/script.js');
        (await import('/scripts/openai.js')).oai_settings.chat_completion_source='claude';
        s.setOnlineStatus('Key saved; press Test Message to verify.');
    });
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve)));
    let statusRequests=0,inferenceRequests=0;
    await page.route('**/api/backends/chat-completions/status',route=>{statusRequests++;return route.abort();});
    await page.route('**/api/backends/chat-completions/generate',route=>{inferenceRequests++;return route.abort();});
    const cdp=await freezePage(page);await resumePage(page,cdp);
    await expect(page.locator('#browser-recovery')).not.toHaveAttribute('aria-busy','true');
    const observation=await page.evaluate(async()=>({online:(await import('/script.js')).online_status,message:document.querySelector('#browser-recovery p').textContent,hidden:document.getElementById('browser-recovery').hidden}));
    fs.writeFileSync(testInfo.outputPath('provider-observation.json'),JSON.stringify({...observation,statusRequests,inferenceRequests},null,2));
    expect(statusRequests).toBe(0);expect(inferenceRequests).toBe(0);
    await expect(page.locator('#browser-recovery')).toBeHidden();
});
