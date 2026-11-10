import { test, expect } from '@playwright/test';
import fs from 'node:fs';

test.use({ channel: 'chromium', video: 'off', viewport: { width: 1280, height: 844 } });
test.setTimeout(60000);

async function start(page, text) {
    await page.locator('#workspace-navigation [data-workspace-action="characters"]').click();
    await page.locator('.workspace-library-card[data-entity="character:default_Seraphina.png"]').click(); await page.getByRole('button', { name: 'Start new story', exact: true }).click();
    await expect(page.locator('#workspace-new-story')).toHaveAttribute('aria-busy', 'false');
    await expect(page.locator('#send_textarea')).toBeVisible();
    const created = await page.evaluate(async text => {
        const s = await import('/script.js');
        const identity = s.getCurrentChatIdentity(), file = s.getCurrentChatId();
        s.chat[0].mes = text; s.chat[0].extra = {};
        const saved = await s.saveChatConditional({ expectedIdentity: identity });
        await s.reloadCurrentChat();
        return { file, identity, saved, reloadedIdentity: s.getCurrentChatIdentity(), reloadedFile: s.getCurrentChatId(), reloadedText: s.chat[0]?.mes };
    }, text);
    page.fixtureSetup.push(created);
    expect(created.saved).toBe(true);
    expect(created.reloadedIdentity).toBe(created.identity);
    expect(created.reloadedFile).toBe(created.file);
    expect(created.reloadedText).toBe(text);
    return created.file;
}

async function snapshot(page) {
    return page.evaluate(async () => {
        const s = await import('/script.js');
        return { identity: s.getCurrentChatIdentity(), draft: document.getElementById('send_textarea').value, messages: structuredClone(s.chat), rendered: [...document.querySelectorAll('#chat .mes .mes_text')].map(node => node.textContent) };
    });
}

async function open(page, file) {
    const loaded = await page.evaluate(async file => {
        const s = await import('/script.js');
        return { accepted: await s.openCharacterChat(file), file: s.getCurrentChatId() };
    }, file);
    expect(loaded.accepted).toBe(true);
    expect(loaded.file).toBe(file);
    await expect(page.locator('#send_textarea')).toBeVisible();
}

async function configure(page, mode = 'none') {
    await page.evaluate(async mode => {
        const { extension_settings } = await import('/scripts/extensions.js');
        Object.assign(extension_settings.translate, { auto_mode: mode, provider: 'google', internal_language: 'fr', target_language: 'en' });
    }, mode);
}

async function emit(page, event, index = 0) {
    await page.evaluate(async ({ event, index }) => {
        const s = await import('/script.js');
        window.__translationTask = s.eventSource.emit(s.event_types[event], index);
    }, { event, index });
}

async function trigger(page, id) {
    await page.evaluate(id => document.getElementById(id).click(), id);
}

async function held(page, reply = 'Controlled translation') {
    let release, began;
    const waiting = new Promise(resolve => { release = resolve; }), started = new Promise(resolve => { began = resolve; });
    const requests = [];
    await page.route('**/api/translate/google', async route => {
        requests.push(route.request().postDataJSON()); began(); await waiting;
        await route.fulfill({ body: reply });
    });
    return { release, started, requests };
}

test.beforeEach(async ({ page }) => {
    page.errors = []; page.on('pageerror', error => page.errors.push(error.message));
    await page.route('**/api/settings/get', async route => {
        const response = await route.fetch(), body = await response.json(), s = JSON.parse(body.settings);
        s.firstRun = false; s.active_character = null; s.active_group = null; s.power_user.auto_connect = false;
        s.accountStorage = { ...s.accountStorage, workspaceLayout: 'true' };
        s.extension_settings.tts = { ...s.extension_settings.tts, enabled: false, currentProvider: 'System' };
        s.extension_settings.translate = { ...s.extension_settings.translate, provider: 'google', auto_mode: 'none', internal_language: 'fr', target_language: 'en' };
        body.settings = JSON.stringify(s); await route.fulfill({ response, json: body });
    });
    await page.route('**/api/settings/save', route => route.fulfill({ json: { result: 'ok' } }));
    await page.goto('/'); await expect(page.locator('#preloader')).toHaveCount(0, { timeout: 30000 });
    page.fixtureSetup = [];
    page.storyA = await start(page, 'Original message');
    page.storyB = await start(page, 'Other story message');
    expect(page.storyB).not.toBe(page.storyA);
    await open(page, page.storyA); page.fixtureSetup.push({ step: 'openedA', state: await snapshot(page) });
    expect((await snapshot(page)).messages[0].mes).toBe('Original message');
});

test.afterEach(async ({ page }, info) => {
    fs.writeFileSync(info.outputPath('fixture-setup.json'), JSON.stringify(page.fixtureSetup || [], null, 2));
    fs.writeFileSync(info.outputPath('browser-errors.json'), JSON.stringify(page.errors, null, 2));
    expect(page.errors).toEqual([]);
});

test('pending native input translation preserves a newer draft including edit-and-restore', async ({ page }, info) => {
    await page.locator('#send_textarea').fill('Original draft'); const pending = await held(page);
    try {
        await trigger(page, 'translate_input_message'); await pending.started;
        await page.locator('#send_textarea').fill('Newer draft'); await page.locator('#send_textarea').fill('Original draft');
        pending.release();
        await expect(page.locator('.toast-message').filter({ hasText: 'earlier translation was not applied' })).toBeVisible();
        await expect(page.locator('#send_textarea')).toHaveValue('Original draft');
        fs.writeFileSync(info.outputPath('draft-owner.json'), JSON.stringify(await snapshot(page), null, 2));
    } finally { pending.release(); }
});

for (const reload of [false, true]) {
    test(`pending input translation rejects ${reload ? 'same-file reload' : 'a newly opened story'}`, async ({ page }) => {
        await page.locator('#send_textarea').fill('Old draft'); const pending = await held(page);
        try {
            await trigger(page, 'translate_input_message'); await pending.started;
            await open(page, reload ? page.storyA : page.storyB); await page.locator('#send_textarea').fill('Keep this draft');
            pending.release();
            await expect(page.locator('.toast-message').filter({ hasText: 'earlier translation was not applied' })).toBeVisible();
            await expect(page.locator('#send_textarea')).toHaveValue('Keep this draft');
        } finally { pending.release(); }
    });
}

test('input provider failure preserves text and a successful retry dispatches native input', async ({ page }) => {
    await page.locator('#send_textarea').fill('Keep on failure');
    await page.route('**/api/translate/google', route => route.fulfill({ status: 503, body: 'Synthetic translator failure' }));
    await trigger(page, 'translate_input_message'); await expect(page.locator('.toast-title').filter({ hasText: 'Failed to translate message' })).toBeVisible();
    await expect(page.locator('#send_textarea')).toHaveValue('Keep on failure');
    await page.unroute('**/api/translate/google'); await page.route('**/api/translate/google', route => route.fulfill({ body: 'Successful translation' }));
    await page.evaluate(() => { window.__translatedInputs = 0; document.getElementById('send_textarea').addEventListener('input', () => window.__translatedInputs++); });
    await trigger(page, 'translate_input_message'); await expect(page.locator('#send_textarea')).toHaveValue('Successful translation');
    expect(await page.evaluate(() => window.__translatedInputs)).toBe(1);
});

test('automatic impersonation translation preserves user typing while its request is pending', async ({ page }) => {
    await configure(page, 'responses'); await page.locator('#send_textarea').fill('Generated draft'); const pending = await held(page);
    try {
        await emit(page, 'IMPERSONATE_READY'); await pending.started; await page.locator('#send_textarea').fill('User-owned draft');
        pending.release(); await page.evaluate(() => window.__translationTask);
        await expect(page.locator('#send_textarea')).toHaveValue('User-owned draft');
    } finally { pending.release(); }
});

for (const kind of ['incoming', 'outgoing']) {
    test(`${kind} translation cannot update or save another story`, async ({ page }, info) => {
        await configure(page, kind === 'incoming' ? 'responses' : 'inputs'); const pending = await held(page);
        try {
            await emit(page, kind === 'incoming' ? 'CHARACTER_MESSAGE_RENDERED' : 'USER_MESSAGE_RENDERED'); await pending.started;
            await configure(page);
            await open(page, page.storyB); const before = await snapshot(page), saves = [];
            page.on('request', request => { if (request.url().endsWith('/api/chats/save')) saves.push(request.url()); });
            pending.release(); await page.evaluate(() => window.__translationTask);
            expect(await snapshot(page)).toEqual(before); expect(saves).toHaveLength(0);
            fs.writeFileSync(info.outputPath('message-owner.json'), JSON.stringify({ kind, before, after: await snapshot(page), requests: pending.requests.length, lateSaves: saves.length }, null, 2));
        } finally { pending.release(); }
    });
}

test('incoming translation rejects a saved message edit-and-restore revision', async ({ page }) => {
    await configure(page, 'responses'); const pending = await held(page);
    try {
        await emit(page, 'CHARACTER_MESSAGE_RENDERED'); await pending.started; await configure(page);
        for (const text of ['Newer message', 'Original message']) {
            await page.locator('#chat .mes').first().locator('.mes_edit').click();
            await page.locator('#chat .mes').first().locator('textarea').first().fill(text);
            await page.locator('#chat .mes').first().locator('.mes_edit_done').click();
        }
        pending.release(); await page.evaluate(() => window.__translationTask);
        const message = (await snapshot(page)).messages[0]; expect(message.mes).toBe('Original message'); expect(message.extra?.display_text).toBeUndefined();
    } finally { pending.release(); }
});

test('reasoning edit invalidates the entire pending incoming translation sequence', async ({ page }) => {
    await page.evaluate(async () => {
        const s = await import('/script.js'); s.chat[0].extra.reasoning = 'Original reasoning'; s.updateMessageBlock(0, s.chat[0]);
    });
    await configure(page, 'responses'); const pending = await held(page);
    try {
        await emit(page, 'CHARACTER_MESSAGE_RENDERED'); await pending.started; await configure(page);
        await page.evaluate(async () => {
            const s = await import('/script.js'); s.chat[0].extra.reasoning = 'Newer reasoning'; s.updateMessageBlock(0, s.chat[0]);
            await s.eventSource.emit(s.event_types.MESSAGE_REASONING_EDITED, 0);
        });
        pending.release(); await page.evaluate(() => window.__translationTask);
        const message = (await snapshot(page)).messages[0]; expect(message.extra.reasoning).toBe('Newer reasoning'); expect(message.extra.reasoning_display_text).toBeUndefined();
        expect(message.extra.display_text).toBeUndefined(); expect(pending.requests).toHaveLength(1);
    } finally { pending.release(); }
});

test('outgoing translation failure preserves the raw message and same-owner success works', async ({ page }) => {
    await configure(page, 'inputs');
    await page.route('**/api/translate/google', route => route.fulfill({ status: 503, body: 'Synthetic translator failure' }));
    await emit(page, 'USER_MESSAGE_RENDERED'); await page.evaluate(() => window.__translationTask);
    expect((await snapshot(page)).messages[0].mes).toBe('Original message');
    expect((await snapshot(page)).messages[0].extra?.display_text).toBeUndefined();
    await page.unroute('**/api/translate/google'); await page.route('**/api/translate/google', route => route.fulfill({ body: 'Translated outgoing text' }));
    await emit(page, 'USER_MESSAGE_RENDERED'); await page.evaluate(() => window.__translationTask);
    const message = (await snapshot(page)).messages[0]; expect(message.mes).toBe('Translated outgoing text'); expect(message.extra.display_text).toBe('Original message');
});

test('Translate Chat stops before another story and never starts its next message or saves there', async ({ page }, info) => {
    await page.evaluate(async () => { const s = await import('/script.js'); s.chat[0].extra.reasoning = 'Batch reasoning'; s.updateMessageBlock(0, s.chat[0]); });
    const pending = await held(page);
    try {
        await trigger(page, 'translate_chat'); await pending.started; await open(page, page.storyB); const before = await snapshot(page), saves = [];
        page.on('request', request => { if (request.url().endsWith('/api/chats/save')) saves.push(request.url()); });
        pending.release(); await expect(page.locator('.toast-message').filter({ hasText: 'earlier translation was not applied' })).toBeVisible();
        expect(await snapshot(page)).toEqual(before); expect(pending.requests).toHaveLength(1); expect(saves).toHaveLength(0);
        fs.writeFileSync(info.outputPath('batch-owner.json'), JSON.stringify({ before, after: await snapshot(page), requests: pending.requests, lateSaves: saves.length }, null, 2));
    } finally { pending.release(); }
});

test('same-owner manual translation includes reasoning and persists then toggles off', async ({ page }) => {
    await page.evaluate(async () => { const s = await import('/script.js'); s.chat[0].extra.reasoning = 'Reasoning source'; s.updateMessageBlock(0, s.chat[0]); });
    await page.route('**/api/translate/google', route => route.fulfill({ body: `Translated ${route.request().postDataJSON().text}` }));
    await page.locator('#chat .mes').first().locator('.mes_translate').evaluate(node => node.click());
    await expect.poll(async () => (await snapshot(page)).messages[0].extra.display_text).toBe('Translated Original message');
    await expect.poll(async () => (await snapshot(page)).messages[0].extra.reasoning_display_text).toBe('Translated Reasoning source');
    await expect(page.locator('#chat .mes').first().locator('.mes_text')).toContainText('Translated Original message');
    await page.locator('#chat .mes').first().locator('.mes_translate').evaluate(node => node.click());
    await expect.poll(async () => (await snapshot(page)).messages[0].extra.display_text).toBeUndefined();
    expect((await snapshot(page)).messages[0].extra.reasoning_display_text).toBeUndefined();
});

test('a pending incoming translation preserves an open unsaved message editor', async ({ page }) => {
    await configure(page, 'responses'); const pending = await held(page);
    try {
        await emit(page, 'CHARACTER_MESSAGE_RENDERED'); await pending.started;
        await page.locator('#chat .mes').first().locator('.mes_edit').click();
        const editor = page.locator('#chat .mes').first().locator('textarea').first(); await editor.fill('Unsaved user revision');
        pending.release(); await page.evaluate(() => window.__translationTask);
        await expect(editor).toBeVisible(); await expect(editor).toHaveValue('Unsaved user revision');
        const message = (await snapshot(page)).messages[0]; expect(message.mes).toBe('Original message'); expect(message.extra?.display_text).toBeUndefined();
    } finally { pending.release(); }
});

test('Translate Chat completes its same-owner message and reasoning batch and persists', async ({ page }) => {
    await page.evaluate(async () => {
        const s = await import('/script.js'); s.chat[0].extra.reasoning = 'Reasoning source';
        const message = { ...structuredClone(s.chat[0]), mes: 'Second message', extra: {} }; s.chat.push(message); s.addOneMessage(message); await s.saveChatConditional();
    });
    await page.route('**/api/translate/google', route => route.fulfill({ body: `Translated ${route.request().postDataJSON().text}` }));
    const saved = page.waitForResponse(response => response.url().endsWith('/api/chats/save') && response.request().postData().includes('Translated Second message'));
    await trigger(page, 'translate_chat'); await saved; await open(page, page.storyA);
    const messages = (await snapshot(page)).messages;
    expect(messages[0].mes).toBe('Original message'); expect(messages[0].extra.display_text).toBe('Translated Original message');
    expect(messages[0].extra.reasoning_display_text).toBe('Translated Reasoning source'); expect(messages[1].extra.display_text).toBe('Translated Second message');
});

test('clearing translations refuses a confirmation from a different story', async ({ page }) => {
    await open(page, page.storyB);
    await page.evaluate(async () => { const s = await import('/script.js'); s.chat[0].extra.display_text = 'Keep the new story translation'; await s.saveChatConditional(); s.updateMessageBlock(0, s.chat[0]); });
    await open(page, page.storyA);
    await trigger(page, 'translation_clear'); await expect(page.locator('dialog[open]')).toBeVisible();
    await open(page, page.storyB); const before = await snapshot(page);
    await page.locator('dialog[open] .popup-button-ok').click();
    await expect(page.locator('.toast-message').filter({ hasText: 'earlier translation was not applied' })).toBeVisible();
    expect(await snapshot(page)).toEqual(before);
});

test('same-owner clear persists and empty provider responses preserve the draft', async ({ page }) => {
    await page.evaluate(async () => {
        const s = await import('/script.js'); Object.assign(s.chat[0].extra, { display_text: 'Visible translation', reasoning_display_text: 'Visible reasoning translation' }); await s.saveChatConditional(); s.updateMessageBlock(0, s.chat[0]);
    });
    await trigger(page, 'translation_clear'); await page.locator('dialog[open] .popup-button-ok').click();
    await expect.poll(async () => (await snapshot(page)).messages[0].extra.display_text).toBeUndefined();
    await open(page, page.storyA);
    expect((await snapshot(page)).messages[0].extra.display_text).toBeUndefined(); expect((await snapshot(page)).messages[0].extra.reasoning_display_text).toBeUndefined();
    await page.locator('#send_textarea').fill('Keep on empty result');
    await page.route('**/api/translate/google', route => route.fulfill({ body: '' }));
    await trigger(page, 'translate_input_message'); await expect(page.locator('.toast-title').filter({ hasText: 'Failed to translate message' })).toBeVisible();
    await expect(page.locator('#send_textarea')).toHaveValue('Keep on empty result');
});

test('an obsolete chat batch neither blocks nor releases the newer story batch', async ({ page }, info) => {
    let releaseA, releaseB, beganA, beganB, requests = 0;
    const a = new Promise(resolve => { releaseA = resolve; }), b = new Promise(resolve => { releaseB = resolve; });
    const startedA = new Promise(resolve => { beganA = resolve; }), startedB = new Promise(resolve => { beganB = resolve; });
    await page.route('**/api/translate/google', async route => {
        const number = ++requests;
        if (number === 1) { beganA(); await a; }
        if (number === 2) { beganB(); await b; }
        await route.fulfill({ body: `Translated ${route.request().postDataJSON().text}` });
    });
    try {
        await trigger(page, 'translate_chat'); await startedA; await open(page, page.storyB);
        await trigger(page, 'translate_chat'); await startedB;
        releaseA(); await expect(page.locator('.toast-message').filter({ hasText: 'earlier translation was not applied' })).toBeVisible();
        await trigger(page, 'translate_chat'); await expect(page.locator('.toast-message').filter({ hasText: 'already translating' })).toBeVisible();
        expect(requests).toBe(2); releaseB();
        await expect.poll(async () => (await snapshot(page)).messages[0].extra.display_text).toBe('Translated Other story message');
        fs.writeFileSync(info.outputPath('batch-guard-owner.json'), JSON.stringify({ requests, current: await snapshot(page) }, null, 2));
    } finally { releaseA(); releaseB(); }
});
