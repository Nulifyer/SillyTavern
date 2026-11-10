import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import fs from 'node:fs';

test.use({ channel: 'chromium', video: 'off', viewport: { width: 1280, height: 800 } });
test.setTimeout(120000);

async function jobs(page) {
    return page.evaluate(async () => {
        const script = await import('/script.js');
        const response = await fetch(`/api/generation-jobs?story=${encodeURIComponent(script.getCurrentChatIdentity())}`, { headers: script.getRequestHeaders() });
        if (!response.ok) throw new Error(`Job inventory returned ${response.status}`);
        return response.json();
    });
}

async function reopen(page, title) {
    await page.reload();
    await expect(page.locator('#preloader')).toHaveCount(0, { timeout: 30000 });
    if (!await page.locator('#workspace-navigation [data-workspace-action="chats"]').isVisible()) await page.locator('#workspace-menu').click();
    await page.locator('#workspace-navigation [data-workspace-action="chats"]').click();
    await page.locator('.workspace-conversations .workspace-scene-row').filter({ has: page.locator('strong', { hasText: title }) }).locator('.workspace-scene-open').click();
    await expect(page.locator('#send_textarea')).toBeVisible();
    await expect(page.locator('#workspace-new-story')).toHaveAttribute('aria-busy', 'false');
}

test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(15000);
    page.recoveryDiagnostics = { pageErrors: [], consoleErrors: [], failedRequests: [] };
    page.on('pageerror', error => page.recoveryDiagnostics.pageErrors.push(error.stack || error.message));
    page.on('console', message => { if (message.type() === 'error') page.recoveryDiagnostics.consoleErrors.push(message.text()); });
    page.on('requestfailed', request => page.recoveryDiagnostics.failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
    let first = true;
    await page.route('**/api/settings/get', async route => {
        const response = await route.fetch(); const body = await response.json();
        const settings = JSON.parse(body.settings);
        if (first) {
            first = false;
            settings.firstRun = false; settings.active_character = null; settings.active_group = null;
            settings.main_api = 'openai'; settings.power_user.auto_connect = false; settings.power_user.font_scale = 1;
            settings.power_user.restore_user_input = true;
            settings.power_user.auto_continue = { ...settings.power_user.auto_continue, enabled: false };
            settings.power_user.auto_swipe = false;
            settings.accountStorage = { ...settings.accountStorage, workspaceLayout: 'true', workspaceAdvancedSettings: 'false', workspaceArchivedChats: '[]' };
            settings.extension_settings.tts = { ...settings.extension_settings.tts, enabled: false, currentProvider: 'System' };
            settings.extension_settings.translate = { ...settings.extension_settings.translate, auto_mode: 'none' };
            settings.extension_settings.caption = { ...settings.extension_settings.caption, auto_mode: false };
            settings.extension_settings.serviceConnections = { url: '' };
        }
        body.settings = JSON.stringify(settings); await route.fulfill({ response, json: body });
    });
    await page.route('**/api/backends/chat-completions/status', route => route.fulfill({ json: { data: [{ id: 'recovery-fixture' }] } }));
    await page.goto('/');
    await expect(page.locator('#preloader')).toHaveCount(0, { timeout: 30000 });
    await page.locator('#workspace-navigation [data-workspace-action="characters"]').click();
    await page.locator('.workspace-library-card[data-entity="character:default_Seraphina.png"]').click();
    await page.getByRole('button', { name: 'Start new story', exact: true }).click();
    await expect(page.locator('#send_textarea')).toBeVisible();
    await expect(page.locator('#workspace-new-story')).toHaveAttribute('aria-busy', 'false');
    page.recoveryTitle = await page.evaluate(async () => (await import('/script.js')).getCurrentChatId());
});

test.afterEach(async ({ page }, info) => {
    if (page.isClosed()) return;
    fs.writeFileSync(info.outputPath('diagnostics.json'), JSON.stringify(page.recoveryDiagnostics, null, 2));
    const state = await page.evaluate(async () => {
        const script = await import('/script.js');
        return { identity: script.getCurrentChatIdentity(), chat: script.chat, generating: script.isGenerating(), notice: document.getElementById('browser-recovery')?.textContent };
    });
    fs.writeFileSync(info.outputPath('native-state.json'), JSON.stringify(state, null, 2));
    await page.screenshot({ path: info.outputPath('final.png') });
    expect(page.recoveryDiagnostics.pageErrors).toEqual([]);
});

async function provider(page, settings = {}) {
    const calls = [];
    const server = createServer((request, response) => {
        let body = '';
        request.on('data', chunk => body += chunk);
        request.on('end', () => {
            if (request.url !== '/v1/chat/completions') { response.writeHead(404).end(); return; }
            const call = { response, body: JSON.parse(body), closed: false };
            response.on('close', () => { call.closed = true; });
            calls.push(call);
        });
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    await page.evaluate(async ({ url, settings }) => {
        const script = await import('/script.js'); const { oai_settings } = await import('/scripts/openai.js');
        Object.assign(oai_settings, { chat_completion_source: 'custom', custom_url: url, custom_model: 'recovery-fixture', stream_openai: true, n: 1 }, settings);
        script.setOnlineStatus('recovery-fixture');
        await script.saveSettings();
    }, { url: `http://127.0.0.1:${server.address().port}/v1`, settings });
    return {
        calls,
        async wait() { await expect.poll(() => calls.length).toBe(1); return calls[0]; },
        chunk(call, text) {
            if (!call.started) { call.started = true; call.response.writeHead(200, { 'content-type': 'text/event-stream' }); }
            call.response.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: text } }] })}\n\n`);
        },
        finish(call, text = '') {
            if (text) this.chunk(call, text);
            call.response.end('data: {"choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n');
        },
        async close() { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); },
    };
}

test('an unsaved tool reply stops the cast before another member or tool can run', async ({ page }) => {
    const group = await page.evaluate(async () => {
        const s = await import('/script.js'); const g = await import('/scripts/group-chats.js');
        const avatar = s.characters.find(card => card.avatar === 'default_Seraphina.png').avatar;
        const duplicate = await fetch('/api/characters/duplicate', { method: 'POST', headers: s.getRequestHeaders(), body: JSON.stringify({ avatar_url: avatar }) }).then(response => response.json());
        await s.getCharacters();
        const group = await g.createGroupWithMembers(`Unsaved tool cast ${Date.now()}`, [avatar, duplicate.path]);
        g.groups.find(value => value.id === group.id).activation_strategy = 1;
        await g.editGroup(group.id, true, false); await g.openGroupById(group.id, { newChat: true });
        const { ToolManager } = await import('/scripts/tool-calling.js');
        window.__unsavedToolCalls = 0;
        ToolManager.registerFunctionTool({ name: 'audit_unsaved_tool', displayName: 'Synthetic observation', description: 'Record one neutral observation.',
            parameters: { type: 'object', properties: {}, additionalProperties: false },
            action: () => { window.__unsavedToolCalls++; return 'A neutral observation.'; } });
        return { id: group.id, avatar: duplicate.path };
    });
    const fixture = await provider(page, { function_calling: true });
    await page.route('**/api/generation-jobs/*/commit', route => route.fulfill({ status: 503, json: { error: 'Synthetic unavailable disk' } }));
    try {
        await page.locator('#send_textarea').fill('Check one neutral lantern together.'); await page.locator('#send_but').click();
        const call = await fixture.wait();
        expect(call.body.tools.some(tool => tool.function.name === 'audit_unsaved_tool')).toBe(true);
        fixture.chunk(call, 'One member starts an observation.');
        call.response.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta: { tool_calls: [{ index: 0, id: 'audit-unsaved-call', type: 'function', function: { name: 'audit_unsaved_tool', arguments: '{}' } }] } }] })}\n\n`);
        fixture.finish(call);
        await expect(page.locator('#browser-recovery')).toContainText('retained on the server');
        await expect.poll(() => page.evaluate(async () => (await import('/script.js')).isGenerating())).toBe(false);
        await expect(page.locator('#mes_stop')).toBeHidden();
        expect(await page.evaluate(() => window.__unsavedToolCalls)).toBe(0);
        expect(fixture.calls).toHaveLength(1); expect(await jobs(page)).toHaveLength(1);
    } finally {
        await page.unroute('**/api/generation-jobs/*/commit'); await fixture.close();
        await page.evaluate(async group => {
            const s = await import('/script.js'); const { ToolManager } = await import('/scripts/tool-calling.js');
            ToolManager.unregisterFunctionTool('audit_unsaved_tool');
            for (const job of await fetch(`/api/generation-jobs?story=${encodeURIComponent(s.getCurrentChatIdentity())}`, { headers: s.getRequestHeaders() }).then(response => response.json())) {
                await fetch(`/api/generation-jobs/${job.id}/ack`, { method: 'POST', headers: s.getRequestHeaders() });
            }
            await fetch('/api/groups/delete', { method: 'POST', headers: s.getRequestHeaders(), body: JSON.stringify({ id: group.id }) });
            await fetch('/api/characters/delete', { method: 'POST', headers: s.getRequestHeaders(), body: JSON.stringify({ avatar_url: group.avatar }) });
        }, group);
    }
});

for (const absent of ['before-first-token', 'after-partial', 'completed-while-absent']) {
    test(`one server reply survives reload ${absent}`, async ({ page }, info) => {
        const fixture = await provider(page);
        try {
            await page.locator('#send_textarea').fill('Describe a quiet lantern.');
            await page.locator('#send_but').click();
            const call = await fixture.wait();
            await expect.poll(async () => (await jobs(page)).length).toBe(1);
            if (absent !== 'before-first-token') {
                fixture.chunk(call, 'A quiet lantern ');
                await expect(page.locator('#chat .mes_text').last()).toContainText('A quiet lantern');
            }
            await page.locator('#send_textarea').fill('My next unsent turn.');
            if (absent === 'completed-while-absent') {
                await page.goto('about:blank');
                fixture.finish(call, 'lights the path.');
                await page.goto('/');
                await expect(page.locator('#preloader')).toHaveCount(0, { timeout: 30000 });
            }
            await reopen(page, page.recoveryTitle);
            expect(call.closed).toBe(absent === 'completed-while-absent');
            if (absent === 'before-first-token') fixture.chunk(call, 'A quiet lantern ');
            await expect(page.locator('#chat .mes_text').last()).toContainText('A quiet lantern');
            if (absent !== 'completed-while-absent') fixture.finish(call, 'lights the path.');
            await expect(page.locator('#mes_stop')).toBeHidden();
            await expect(page.locator('#chat .mes_text').last()).toHaveText('A quiet lantern lights the path.');
            await expect(page.locator('#send_textarea')).toHaveValue('My next unsent turn.');
            await expect.poll(async () => (await jobs(page)).length).toBe(0);
            expect(fixture.calls).toHaveLength(1);
            expect(await page.evaluate(async () => (await import('/script.js')).chat.filter(message => message.extra?.generation_job).length)).toBe(1);
            await reopen(page, page.recoveryTitle);
            await expect(page.locator('#chat .mes_text').last()).toHaveText('A quiet lantern lights the path.');
            expect(fixture.calls).toHaveLength(1);
            fs.writeFileSync(info.outputPath('provider-calls.json'), JSON.stringify(fixture.calls.map(call => ({ model: call.body.model, stream: call.body.stream })), null, 2));
        } finally { await fixture.close(); }
    });
}

test('a retained parser resumes its cursor after network loss without another provider call', async ({ page }) => {
    const fixture = await provider(page);
    try {
        await page.locator('#send_textarea').fill('Describe a lantern.'); await page.locator('#send_but').click();
        const call = await fixture.wait(); fixture.chunk(call, 'A lantern ');
        await expect(page.locator('#chat .mes_text').last()).toContainText('A lantern');
        await page.context().setOffline(true);
        fixture.chunk(call, 'lights ');
        fixture.finish(call, 'the path.');
        await page.context().setOffline(false);
        await page.evaluate(() => window.dispatchEvent(new Event('online')));
        await expect(page.locator('#mes_stop')).toBeHidden();
        await expect(page.locator('#chat .mes_text').last()).toHaveText('A lantern lights the path.');
        await expect.poll(async () => (await jobs(page)).length).toBe(0);
        expect(fixture.calls).toHaveLength(1);
    } finally { await fixture.close(); }
});

test('Stop after reload cancels the existing provider and saves its partial native reply', async ({ page }) => {
    const fixture = await provider(page);
    try {
        await page.locator('#send_textarea').fill('Describe a lantern.'); await page.locator('#send_but').click();
        const call = await fixture.wait(); fixture.chunk(call, 'A lantern waits.');
        await expect(page.locator('#chat .mes_text').last()).toContainText('A lantern waits.');
        await reopen(page, page.recoveryTitle);
        await expect(page.locator('#mes_stop')).toBeVisible();
        await page.locator('#mes_stop').click();
        await expect.poll(() => call.closed).toBe(true);
        await expect(page.locator('#mes_stop')).toBeHidden();
        await expect(page.locator('#chat .mes_text').last()).toHaveText('A lantern waits.');
        await expect.poll(async () => (await jobs(page)).length).toBe(0);
        await reopen(page, page.recoveryTitle);
        await expect(page.locator('#chat .mes_text').last()).toHaveText('A lantern waits.');
        expect(fixture.calls).toHaveLength(1);
    } finally { await fixture.close(); }
});

test('native Continue survives reload without duplicate prefix or consuming a slash-command draft', async ({ page }) => {
    const fixture = await provider(page);
    try {
        const original = await page.evaluate(async () => (await import('/script.js')).chat.at(-1).mes);
        await page.locator('#send_textarea').fill('/echo this must remain unsent');
        await page.locator('#workspace-continue').click();
        const call = await fixture.wait();
        const prefix = (await jobs(page))[0].context.continueMessage;
        expect(prefix.startsWith(original)).toBe(true);
        fixture.chunk(call, ' The lantern brightens.');
        await expect(page.locator('#chat .mes_text').last()).toContainText('The lantern brightens.');
        await reopen(page, page.recoveryTitle);
        fixture.finish(call, ' The path is clear.');
        await expect(page.locator('#mes_stop')).toBeHidden();
        expect(await page.evaluate(async () => (await import('/script.js')).chat.map(message => message.mes))).toEqual([prefix + ' The lantern brightens. The path is clear.']);
        await expect(page.locator('#send_textarea')).toHaveValue('/echo this must remain unsent');
        await expect.poll(async () => (await jobs(page)).length).toBe(0);
        expect(fixture.calls).toHaveLength(1);
    } finally { await fixture.close(); }
});

test('a failed final save retains the reply and reload retries persistence without inference', async ({ page }) => {
    const fixture = await provider(page);
    try {
        await page.route('**/api/generation-jobs/*/commit', route => route.fulfill({ status: 503, json: { error: 'Synthetic unavailable disk' } }));
        await page.locator('#send_textarea').fill('Describe a lantern.'); await page.locator('#send_but').click();
        const call = await fixture.wait(); fixture.finish(call, 'A lantern lights the path.');
        await expect(page.locator('#mes_stop')).toBeHidden();
        await expect(page.locator('#browser-recovery')).toContainText('retained on the server');
        expect(await jobs(page)).toHaveLength(1);
        await page.unroute('**/api/generation-jobs/*/commit');
        await reopen(page, page.recoveryTitle);
        await expect(page.locator('#chat .mes_text').last()).toHaveText('A lantern lights the path.');
        await expect.poll(async () => (await jobs(page)).length).toBe(0);
        expect(fixture.calls).toHaveLength(1);
    } finally { await fixture.close(); }
});

test('a failed provider response preserves the native baseline and leaves no empty assistant reply', async ({ page }) => {
    const fixture = await provider(page);
    try {
        await page.locator('#send_textarea').fill('Describe a lantern.'); await page.locator('#send_but').click();
        const call = await fixture.wait();
        call.response.writeHead(503, { 'content-type': 'application/json' });
        call.response.end(JSON.stringify({ error: { message: 'Synthetic provider unavailable' } }));
        await expect(page.locator('#mes_stop')).toBeHidden();
        expect(await page.evaluate(async () => (await import('/script.js')).chat.map(message => ({ user: message.is_user, mes: message.mes })))).toHaveLength(2);
        expect(await page.evaluate(async () => (await import('/script.js')).chat.at(-1).is_user)).toBe(true);
        await expect(page.locator('#browser-recovery')).toContainText(/provider|connection/i);
        await reopen(page, page.recoveryTitle);
        expect(await page.evaluate(async () => (await import('/script.js')).chat.length)).toBe(2);
        expect(fixture.calls).toHaveLength(1);
    } finally { await fixture.close(); }
});

test('a partial stream failure keeps failed-save feedback and reload retries the retained reply', async ({ page }) => {
    const fixture = await provider(page);
    try {
        await page.route('**/api/generation-jobs/*/commit', route => route.fulfill({ status: 503, json: { error: 'Synthetic unavailable disk' } }));
        await page.locator('#send_textarea').fill('Describe a lantern.'); await page.locator('#send_but').click();
        const call = await fixture.wait(); fixture.chunk(call, 'A lantern still shines.');
        await expect(page.locator('#chat .mes_text').last()).toContainText('A lantern still shines.');
        call.response.destroy();
        await expect(page.locator('#mes_stop')).toBeHidden();
        await expect(page.locator('#browser-recovery')).toContainText('retained on the server');
        expect(await jobs(page)).toHaveLength(1);
        await expect(page.locator('#chat .mes_text').last()).toHaveText('A lantern still shines.');
        await page.unroute('**/api/generation-jobs/*/commit');
        await reopen(page, page.recoveryTitle);
        await expect(page.locator('#chat .mes_text').last()).toHaveText('A lantern still shines.');
        await expect.poll(async () => (await jobs(page)).length).toBe(0);
        expect(fixture.calls).toHaveLength(1);
    } finally { await fixture.close(); }
});

test('a stalled recovery lookup releases generation after its timeout and preserves the next draft', async ({ page }) => {
    const fixture = await provider(page);
    let release;
    const held = new Promise(resolve => release = resolve);
    const pattern = /\/api\/generation-jobs\?story=/;
    await page.route(pattern, async route => { await held; await route.fulfill({ json: [] }); });
    try {
        await page.locator('#send_textarea').fill('A draft survives the recovery timeout.');
        await page.locator('#send_but').click();
        await expect(page.locator('#browser-recovery')).toContainText('last reply check timed out', { timeout: 15000 });
        await expect(page.locator('#send_textarea')).toHaveValue('A draft survives the recovery timeout.');
        expect(await page.evaluate(async () => (await import('/script.js')).isGenerating())).toBe(false);
        expect(fixture.calls).toHaveLength(0);
        release(); await page.unroute(pattern);
        await page.locator('#send_but').click();
        const call = await fixture.wait(); fixture.finish(call, 'The next reply works.');
        await expect(page.locator('#chat .mes_text').last()).toHaveText('The next reply works.');
        expect(fixture.calls).toHaveLength(1);
    } finally { release(); await page.unrouteAll({ behavior: 'wait' }); await fixture.close(); }
});

test('a provider error inside HTTP200 SSE interrupts the partial reply without success events or another inference', async ({ page }) => {
    const fixture = await provider(page);
    try {
        await page.evaluate(async () => {
            const { eventSource, event_types } = await import('/script.js');
            window.__completedReplies = 0;
            eventSource.on(event_types.MESSAGE_RECEIVED, () => window.__completedReplies++);
        });
        await page.locator('#send_textarea').fill('Describe a lantern.'); await page.locator('#send_but').click();
        const call = await fixture.wait(); fixture.chunk(call, 'A partial lantern reply.');
        await expect(page.locator('#chat .mes_text').last()).toContainText('A partial lantern reply.');
        call.response.write(`data: ${JSON.stringify({ error: { message: 'Synthetic provider rejected the remaining stream' } })}\n\n`);
        call.response.end('data: [DONE]\n\n');
        await expect(page.locator('#mes_stop')).toBeHidden();
        await expect(page.locator('#browser-recovery')).toContainText('Reply interrupted');
        await expect(page.locator('#chat .mes_text').last()).toHaveText('A partial lantern reply.');
        expect(await page.evaluate(() => window.__completedReplies)).toBe(0);
        await expect.poll(async () => (await jobs(page)).length).toBe(0);
        await reopen(page, page.recoveryTitle);
        await expect(page.locator('#chat .mes_text').last()).toHaveText('A partial lantern reply.');
        expect(fixture.calls).toHaveLength(1);
    } finally { await fixture.close(); }
});
