import { test, expect } from '@playwright/test';
import fs from 'node:fs';

test.use({ channel: 'chromium', video: 'off', viewport: { width: 1280, height: 844 } });
test.setTimeout(90000);
test.skip(!process.env.ST_NATIVE_UI_AUDIT, 'Use ST_NATIVE_UI_AUDIT=1 with a synthetic local fixture.');

test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(12000); page.ownerDiagnostics = { pageErrors: [], consoleErrors: [], errorResponses: [] };
    page.on('pageerror', error => page.ownerDiagnostics.pageErrors.push(error.stack || error.message));
    page.on('console', message => { if (message.type() === 'error') page.ownerDiagnostics.consoleErrors.push({ text: message.text(), location: message.location() }); });
    page.on('response', response => { if (response.status() >= 400) page.ownerDiagnostics.errorResponses.push({ status: response.status(), url: response.url() }); });
    await page.route('**/api/settings/get', async route => {
        const response = await route.fetch(), body = await response.json(), settings = JSON.parse(body.settings);
        settings.firstRun = false; settings.active_character = null; settings.active_group = null; settings.main_api = 'openai'; settings.power_user.auto_connect = false;
        settings.accountStorage = { ...settings.accountStorage, workspaceLayout: 'true' }; settings.extension_settings.tts = { ...settings.extension_settings.tts, enabled: false, currentProvider: 'System' };
        settings.extension_settings.quickReplyV2 = { ...settings.extension_settings.quickReplyV2, isEnabled: false };
        body.settings = JSON.stringify(settings); await route.fulfill({ response, json: body });
    });
    await page.goto('/'); await expect(page.locator('#preloader')).toHaveCount(0, { timeout: 30000 });
    await startStory(page);
});
test.afterEach(async ({ page }, info) => {
    await page.unrouteAll({ behavior: 'wait' });
    fs.writeFileSync(info.outputPath('diagnostics.json'), JSON.stringify(page.ownerDiagnostics, null, 2));
    await page.screenshot({ path: info.outputPath('final.png') }); expect(page.ownerDiagnostics.pageErrors).toEqual([]);
});
async function startStory(page) {
    if (!await page.locator('#workspace-navigation [data-workspace-action="characters"]').isVisible()) await page.locator('#workspace-menu').click();
    await page.locator('#workspace-navigation [data-workspace-action="characters"]').click();
    await page.locator('.workspace-library-card[data-entity="character:default_Seraphina.png"]').click();
    await page.getByRole('button', { name: 'Start new story', exact: true }).click();
    await expect(page.locator('#send_textarea')).toBeVisible(); await expect(page.locator('#workspace-new-story')).toHaveAttribute('aria-busy', 'false');
    return page.evaluate(async () => (await import('/script.js')).getCurrentChatIdentity());
}
async function command(page, command) { return page.evaluate(async value => (await (await import('/scripts/slash-commands.js')).executeSlashCommandsWithOptions(value)).pipe, command); }
async function injection(page, id) { return page.evaluate(async id => { const s = await import('/script.js'), c = (await import('/scripts/extensions.js')).getContext(); return { metadata: s.chat_metadata.script_injects?.[id] || null, prompt: c.extensionPrompts[`script_inject_${id}`]?.value || '', story: s.getCurrentChatIdentity() }; }, id); }
async function generationEvent(page, event) { await page.evaluate(async event => { const s = await import('/script.js'); await s.eventSource.emit(s.event_types[event]); }, event); }
async function tagFixture(page) {
    return page.evaluate(async () => {
        const s = await import('/script.js'), t = await import('/scripts/tags.js'); const avatar = s.characters[s.this_chid].avatar, prefix = `owner-${Date.now()}`;
        const ids = { from: `${prefix}-a`, to: `${prefix}-b`, other: `${prefix}-c` };
        t.loadTagsSettings({ tags: [{ id: ids.from, name: 'Merge From', folder_type: 'NONE' }, { id: ids.to, name: 'Merge To', folder_type: 'OPEN' }, { id: ids.other, name: 'Keep Other', folder_type: 'NONE' }], tag_map: { [avatar]: [ids.from, ids.other] } });
        return { avatar, ids };
    });
}
async function tagState(page) { return page.evaluate(async () => { const t = await import('/scripts/tags.js'); return { tags: structuredClone(t.tags), map: structuredClone(t.tag_map) }; }); }
async function tagManager(page, ids) {
    await page.locator('#workspace-navigation [data-workspace-action="characters"]').click(); await page.locator('.workspace-library-card[data-entity="character:default_Seraphina.png"]').click();
    await page.getByRole('button', { name: 'Edit character', exact: true }).click(); await page.locator('#tags_div [title="View all tags"]').click();
    await page.locator(`#tag_view_list [id="${ids.from}"] .tag_delete`).click(); await expect(page.locator('#merge_tag_select')).toBeAttached();
}
async function chooseMerge(page, target) {
    const dialog = page.locator('dialog[open]').last();
    const custom = dialog.locator('.select2-selection');
    if (await custom.count()) {
        await custom.click();
        await page.getByRole('option', { name: 'Merge To', exact: true }).click({ timeout: 3000 });
    } else await dialog.locator('#merge_tag_select').selectOption(target);
    await expect(dialog.locator('#merge_tag_select')).toHaveValue(target);
}
for (const width of [1280, 390]) {
    test(`native tag merge retains the selected target after popup removal at ${width}px`, async ({ page }, info) => {
        const { avatar, ids } = await tagFixture(page); await tagManager(page, ids); await page.setViewportSize({ width, height: 844 });
        await chooseMerge(page, ids.to);
        const select = await page.locator('#merge_tag_select').elementHandle();
        await page.locator('dialog[open]').last().locator('.popup-button-ok').click();
        await expect.poll(async () => (await tagState(page)).tags.some(tag => tag.id === ids.from)).toBe(false);
        expect(await select.evaluate(node => window.jQuery(node).data('select2') === undefined)).toBe(true);
        await expect(page.locator('.select2-dropdown')).toHaveCount(0);
        const state = await tagState(page); expect(state.map[avatar]).toEqual([ids.other, ids.to]); expect(state.tags.map(tag => tag.id)).toEqual([ids.to, ids.other]);
        await expect(page.locator(`#tag_view_list [id="${ids.from}"]`)).toHaveCount(0);
        const saved = await page.evaluate(async () => { const s = await import('/script.js'); await s.saveSettings(); const response = await fetch('/api/settings/get', { method: 'POST', headers: s.getRequestHeaders(), body: '{}' }); const settings = JSON.parse((await response.json()).settings); return { tags: settings.tags, map: settings.tag_map }; });
        expect(saved.map[avatar]).toEqual([ids.other, ids.to]); fs.writeFileSync(info.outputPath('merge-state.json'), JSON.stringify({ state, saved }, null, 2));
    });
}

test('native tag removal of an unassigned tag leaves all existing assignments intact', async ({ page }) => {
    const { avatar, ids } = await tagFixture(page);
    await page.evaluate(async ({ avatar, ids }) => { const t = await import('/scripts/tags.js'); t.tag_map[avatar] = [ids.other]; }, { avatar, ids });
    expect(await command(page, '/tag-remove "Merge From"')).toBe('false');
    expect((await tagState(page)).map[avatar]).toEqual([ids.other]);
});

test('tag changes while a merge dialog is open cannot delete another tag', async ({ page }) => {
    const { ids } = await tagFixture(page); await tagManager(page, ids); await chooseMerge(page, ids.to);
    await page.evaluate(async ids => { const t = await import('/scripts/tags.js'); t.tags.splice(t.tags.findIndex(tag => tag.id === ids.from), 1); }, ids);
    await page.locator('dialog[open]').last().locator('.popup-button-ok').click();
    await expect(page.locator('.toast-message').filter({ hasText: 'tags changed while this dialog' })).toBeVisible();
    expect((await tagState(page)).tags.map(tag => tag.id)).toEqual([ids.to, ids.other]);
});

test('an old ephemeral command cannot remove a same-story persistent replacement', async ({ page }) => {
    const id = `native_${Date.now()}`;
    await page.locator('#send_textarea').fill(`/inject id=${id} ephemeral=true An older neutral injection`); await page.locator('#send_textarea').press('Enter');
    await expect.poll(async () => (await injection(page, id)).metadata?.value).toBe('An older neutral injection');
    await command(page, `/inject id=${id} A newer persistent injection`);
    await generationEvent(page, 'GENERATION_ENDED'); await generationEvent(page, 'GENERATION_STOPPED');
    const state = await injection(page, id); expect(state.metadata.value).toBe('A newer persistent injection'); expect(state.prompt).toBe('A newer persistent injection');
});

test('the current ephemeral command clears once on Stop and cannot affect a later replacement', async ({ page }) => {
    const id = `native_${Date.now()}`; await command(page, `/inject id=${id} ephemeral=true A current neutral injection`);
    await generationEvent(page, 'GENERATION_STOPPED'); expect((await injection(page, id)).metadata).toBeNull();
    await command(page, `/inject id=${id} A replacement after stop`); await generationEvent(page, 'GENERATION_ENDED');
    expect((await injection(page, id)).prompt).toBe('A replacement after stop');
});
for (const change of ['another story', 'same story reload']) {
    test(`ephemeral cleanup cannot affect a newer injection after ${change}`, async ({ page }, info) => {
        const id = `native_${Date.now()}`; const before = (await injection(page, id)).story;
        await command(page, `/inject id=${id} ephemeral=true Old lifetime injection`);
        if (change === 'another story') expect(await startStory(page)).not.toBe(before);
        else await page.evaluate(async () => (await import('/script.js')).reloadCurrentChat());
        await command(page, `/inject id=${id} New lifetime injection`); await generationEvent(page, 'GENERATION_ENDED');
        const state = await injection(page, id); expect(state.metadata.value).toBe('New lifetime injection'); expect(state.prompt).toBe('New lifetime injection');
        fs.writeFileSync(info.outputPath('injection-ownership.json'), JSON.stringify({ before, after: state }, null, 2));
    });
}

async function tokenizerSettings(page, type) {
    await page.evaluate(async type => {
        const t = await import('/scripts/tokenizers.js'), p = await import('/scripts/power-user.js');
        document.querySelector('#main_api').value = 'textgenerationwebui'; document.querySelector('#main_api').dispatchEvent(new Event('change', { bubbles: true })); p.power_user.tokenizer = t.tokenizers[type];
    }, type);
}
for (const [type, endpoint] of [['LLAMA', '**/api/tokenizers/llama/encode'], ['API_KOBOLD', '**/api/tokenizers/remote/kobold/count'], ['API_CURRENT', '**/api/tokenizers/remote/textgenerationwebui/encode']]) {
    test(`native ${type} count rejects a delayed HTTP503 and retry succeeds`, async ({ page }, info) => {
        await tokenizerSettings(page, type); let release, began; const held = new Promise(resolve => release = resolve), requested = new Promise(resolve => began = resolve); let attempts = 0;
        await page.route(endpoint, async route => { if (++attempts === 1) { began(); await held; await route.fulfill({ status: 503, json: { error: 'Synthetic tokenizer unavailable' } }); } else await route.fulfill({ json: { count: 17, ids: [] } }); });
        try {
            await page.evaluate(() => { window.__countState = 'pending'; window.__countStarted = performance.now(); import('/scripts/tokenizers.js').then(t => t.getTokenCountAsync('A unique native count ' + Date.now())).then(value => { window.__countState = 'resolved'; window.__countValue = value; }, error => { window.__countState = 'rejected'; window.__countError = error.message; }); });
            await requested; expect(await page.evaluate(() => window.__countState)).toBe('pending'); release();
            await expect.poll(() => page.evaluate(() => window.__countState), { timeout: 3000 }).toBe('rejected');
            expect(await page.evaluate(() => window.__countError)).toContain('Token counting failed (HTTP 503)');
            expect(await page.evaluate(async () => (await import('/scripts/tokenizers.js')).getTokenCountAsync('A retry native count ' + Date.now()))).toBe(17);
            fs.writeFileSync(info.outputPath('tokenizer-result.json'), JSON.stringify(await page.evaluate(() => ({ state: window.__countState, error: window.__countError, elapsed: performance.now() - window.__countStarted })), null, 2));
        } finally { release(); }
    });
}

test('the native tokens command shows a readable tokenizer failure and permits retry', async ({ page }) => {
    await tokenizerSettings(page, 'LLAMA'); let fail = true;
    await page.route('**/api/tokenizers/llama/encode', route => fail ? route.fulfill({ status: 503, json: { error: 'Synthetic unavailable' } }) : route.fulfill({ json: { count: 23 } }));
    await page.locator('#send_textarea').fill('/tokens Neutral command text'); await page.locator('#send_textarea').press('Enter');
    await expect(page.locator('.toast-message').filter({ hasText: 'Token counting failed (HTTP 503)' })).toBeVisible();
    fail = false; expect(await command(page, '/tokens Neutral command retry')).toBe('23');
});

test('held multi-message counting pins the original model, cache owner and message snapshots', async ({ page }, info) => {
    const modelA = `native-a-${Date.now()}`, modelB = `native-b-${Date.now()}`; let release, began; const held = new Promise(resolve => release = resolve), requested = new Promise(resolve => began = resolve); const requests = [];
    await page.route('**/api/tokenizers/openai/count?*', async route => {
        const messages = route.request().postDataJSON();
        const owned = messages.some(message => ['First neutral message', 'Original second neutral message', 'Changed second message'].includes(message.content));
        if (owned) {
            requests.push({ model: new URL(route.request().url()).searchParams.get('model'), messages });
            if (requests.length === 1) { began(); await held; }
        }
        await route.fulfill({ json: { token_count: 11 } });
    });
    try {
        const storyA = await page.evaluate(async modelA => { const s = await import('/script.js'), o = await import('/scripts/openai.js'), t = await import('/scripts/tokenizers.js'); o.oai_settings.chat_completion_source = o.chat_completion_sources.OPENAI; o.oai_settings.openai_model = modelA; window.__messages = [{ role: 'user', content: 'First neutral message' }, { role: 'assistant', content: 'Original second neutral message' }]; window.__multi = t.countTokensOpenAIAsync(window.__messages, true); return s.getCurrentChatIdentity(); }, modelA);
        await requested; const storyB = await startStory(page); expect(storyB).not.toBe(storyA);
        await page.evaluate(async modelB => { (await import('/scripts/openai.js')).oai_settings.openai_model = modelB; window.__messages[1].content = 'Changed second message'; }, modelB); release();
        expect(await page.evaluate(() => window.__multi)).toBe(22); expect(requests.slice(0, 2).map(request => request.model)).toEqual([modelA, modelA]);
        expect(requests[1].messages[0].content).toBe('Original second neutral message');
        expect(await page.evaluate(async () => (await import('/scripts/tokenizers.js')).countTokensOpenAIAsync([{ role: 'assistant', content: 'Original second neutral message' }], true))).toBe(11);
        expect(requests.at(-1).model).toBe(modelB); fs.writeFileSync(info.outputPath('tokenizer-ownership.json'), JSON.stringify({ storyA, storyB, requests }, null, 2));
    } finally { release(); }
});
