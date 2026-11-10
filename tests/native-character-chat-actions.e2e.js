import { test, expect } from '@playwright/test';
import fs from 'node:fs';

test.use({ channel: 'chromium', video: 'off', viewport: { width: 1280, height: 800 } });
test.setTimeout(90000);
test.skip(!process.env.ST_NATIVE_UI_AUDIT, 'Use a synthetic local fixture with ST_NATIVE_UI_AUDIT=1.');

test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(12000);
    page.actionDiagnostics = { pageErrors: [], consoleErrors: [] };
    page.on('pageerror', error => page.actionDiagnostics.pageErrors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') page.actionDiagnostics.consoleErrors.push(message.text()); });
    await page.route('**/api/settings/get', async route => {
        const response = await route.fetch(); const body = await response.json(); const settings = JSON.parse(body.settings);
        settings.firstRun = false; settings.active_character = null; settings.active_group = null;
        settings.main_api = 'openai'; settings.power_user.auto_connect = false; settings.power_user.font_scale = 1;
        settings.accountStorage = { ...settings.accountStorage, workspaceLayout: 'true', workspaceAdvancedSettings: 'false', workspaceArchivedChats: '[]' };
        settings.extension_settings.tts = { ...settings.extension_settings.tts, enabled: false, currentProvider: 'System' };
        settings.extension_settings.serviceConnections = { url: '' };
        body.settings = JSON.stringify(settings); await route.fulfill({ response, json: body });
    });
    await page.goto('/'); await expect(page.locator('#preloader')).toHaveCount(0, { timeout: 30000 });
    page.auditCards = await page.evaluate(async () => {
        const s = await import('/script.js'); const cards = [];
        for (const suffix of ['A', 'B']) {
            const name = `Native action ${crypto.randomUUID()} ${suffix}`; const data = new FormData();
            data.set('ch_name', name); data.set('description', `Initial ${suffix}`); data.set('first_mes', `Hello ${suffix}`);
            const response = await fetch('/api/characters/create', { method: 'POST', headers: s.getRequestHeaders({ omitContentType: true }), body: data });
            if (!response.ok) throw new Error(`Synthetic character create: ${response.status}`);
            cards.push({ name, avatar: await response.text() });
        }
        await s.getCharacters({ preserveEditor: true }); return cards;
    });
    await selectCard(page, 0);
});

test.afterEach(async ({ page }, info) => {
    fs.writeFileSync(info.outputPath('diagnostics.json'), JSON.stringify(page.actionDiagnostics, null, 2));
    await page.screenshot({ path: info.outputPath('final.png') });
    if (!page.isClosed()) await page.evaluate(async cards => {
        const s = await import('/script.js');
        for (const card of cards || []) await fetch('/api/characters/delete', { method: 'POST', headers: s.getRequestHeaders(), body: JSON.stringify({ avatar_url: card.avatar, delete_chats: true }) });
    }, page.auditCards);
    expect(page.actionDiagnostics.pageErrors).toEqual([]);
});

async function selectCard(page, index) {
    await page.locator('#workspace-navigation [data-workspace-action="characters"]').click();
    await page.getByRole('button', { name: `Meet ${page.auditCards[index].name}`, exact: true }).click();
    await page.getByRole('button', { name: 'Edit character', exact: true }).click();
    await expect(page.locator('#avatar_url_pole')).toHaveValue(page.auditCards[index].avatar);
}
async function editDraft(page, value) {
    // Native editor fields may live in the parked classic panel. Invoke the same
    // input listener without moving the workspace panel during held requests.
    await page.locator('#description_textarea').evaluate((node, value) => { node.value = value; node.dispatchEvent(new Event('input', { bubbles: true })); }, value);
}
async function save(page) { await page.evaluate(() => { window.__saveResult = null; import('/script.js').then(s => s.createOrEditCharacter()).then(value => window.__saveResult = value); }); }
async function readCard(page, avatar) {
    return page.evaluate(async avatar => { const s = await import('/script.js'); const response = await fetch('/api/characters/get', { method: 'POST', headers: s.getRequestHeaders(), body: JSON.stringify({ avatar_url: avatar }) }); return response.json(); }, avatar);
}
async function holdEdit(page, avatar) {
    let release; const gate = new Promise(resolve => release = resolve); let entered;
    const waiting = new Promise(resolve => entered = resolve);
    await page.route('**/api/characters/edit*', async route => {
        if (!route.request().postData()?.includes(avatar)) return route.continue();
        entered(); await gate; await route.continue();
    });
    return { waiting, release };
}
async function settle(page) { await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); }

test('held native Save updates the clicked card and preserves a replacement editor draft', async ({ page }) => {
    const [a, b] = page.auditCards; const held = await holdEdit(page, a.avatar);
    await editDraft(page, 'Saved A while held'); await save(page); await held.waiting;
    await selectCard(page, 1); await editDraft(page, 'Unsaved B draft'); held.release();
    await expect.poll(() => page.evaluate(() => window.__saveResult)).toBe(true);
    await expect(page.locator('#avatar_url_pole')).toHaveValue(b.avatar);
    await expect(page.locator('#description_textarea')).toHaveValue('Unsaved B draft');
    expect((await readCard(page, a.avatar)).description).toBe('Saved A while held');
    expect((await readCard(page, b.avatar)).description).toBe('Initial B');
});

test('export retains the clicked avatar across the mandatory held Save', async ({ page }) => {
    const [a] = page.auditCards; const held = await holdEdit(page, a.avatar); const exported = [];
    await page.route('**/api/characters/export', async route => { exported.push(route.request().postDataJSON().avatar_url); await route.continue(); });
    await page.locator('.export_format[data-format="json"]').evaluate(node => node.click()); await held.waiting;
    await selectCard(page, 1);
    const download = page.waitForEvent('download'); held.release();
    expect((await download).suggestedFilename()).toBe(a.avatar.replace(/\.png$/i, '.json'));
    expect(exported).toEqual([a.avatar]);
    await expect(page.locator('#avatar_url_pole')).toHaveValue(page.auditCards[1].avatar);
});

test('same-card native writes stay ordered and do not erase a newer draft', async ({ page }) => {
    const [a] = page.auditCards; const held = await holdEdit(page, a.avatar); const writes = [];
    page.on('request', request => { if (request.url().includes('/api/characters/edit')) writes.push(request.postData()); });
    await editDraft(page, 'First captured draft'); await save(page); await held.waiting;
    await editDraft(page, 'Second captured draft');
    await page.evaluate(() => { import('/script.js').then(s => s.createOrEditCharacter()).then(value => window.__secondSave = value); });
    await settle(page); expect(writes).toHaveLength(1);
    held.release(); await expect.poll(() => page.evaluate(() => window.__secondSave)).toBe(true);
    expect(writes).toHaveLength(2);
    expect((await readCard(page, a.avatar)).description).toBe('Second captured draft');
    await expect(page.locator('#description_textarea')).toHaveValue('Second captured draft');
});

async function seedChats(page) {
    await page.evaluate(async cards => {
        const s = await import('/script.js');
        for (const [index, card] of cards.entries()) for (const query of ['oldquery', 'newquery']) {
            const response = await fetch('/api/chats/save', { method: 'POST', headers: s.getRequestHeaders(), body: JSON.stringify({ ch_name: card.name, avatar_url: card.avatar, file_name: `${query}-${index}`, chat: [{ user_name: 'unused', character_name: 'unused', chat_metadata: { integrity: crypto.randomUUID() } }, { name: card.name, mes: 'Synthetic neutral chat', is_user: false, is_system: false, extra: {} }] }) });
            if (!response.ok) throw new Error(`Seed chat failed: ${response.status}`);
        }
    }, page.auditCards);
    await page.evaluate(async () => (await import('/script.js')).displayPastChats());
}
async function search(page, query) {
    await page.locator('#select_chat_search').evaluate((node, query) => { node.value = query; node.dispatchEvent(new Event('input', { bubbles: true })); }, query);
}
async function holdSearch(page) {
    let release; const gate = new Promise(resolve => release = resolve); let entered; const waiting = new Promise(resolve => entered = resolve); let finished;
    const completed = new Promise(resolve => finished = resolve);
    await page.route('**/api/chats/search', async route => {
        if (route.request().postDataJSON().query !== 'oldquery') return route.continue();
        const response = await route.fetch(); entered(); await gate; await route.fulfill({ response }); finished();
    });
    return { waiting, release, completed };
}

test('held earlier chat search cannot overwrite a newer query result', async ({ page }) => {
    await seedChats(page); const held = await holdSearch(page);
    await search(page, 'oldquery'); await held.waiting; await search(page, 'newquery');
    await expect(page.locator('#select_chat_div .select_chat_block_filename')).toHaveText(['newquery-0']);
    held.release(); await held.completed; await settle(page);
    await expect(page.locator('#select_chat_div .select_chat_block_filename')).toHaveText(['newquery-0']);
});

test('held chat search cannot replace a newly opened character file manager', async ({ page }) => {
    await seedChats(page); const held = await holdSearch(page);
    await search(page, 'oldquery'); await held.waiting;
    await page.locator('#select_chat_cross').evaluate(node => node.click());
    await selectCard(page, 1); await page.evaluate(async () => (await import('/script.js')).displayPastChats());
    await search(page, 'newquery');
    await expect(page.locator('#select_chat_div .select_chat_block_filename')).toHaveText(['newquery-1']);
    held.release(); await held.completed; await settle(page);
    await expect(page.locator('#select_chat_div .select_chat_block_filename')).toHaveText(['newquery-1']);
});

test('offscreen forced swipe leaves native swipe controls usable', async ({ page }) => {
    await page.locator('[data-workspace-action="close-panel"]').click();
    await page.locator('#workspace-navigation [data-workspace-action="characters"]').click();
    await page.getByRole('button', { name: `Meet ${page.auditCards[0].name}`, exact: true }).click();
    await page.getByRole('button', { name: 'Start new story', exact: true }).click();
    await expect(page.locator('#send_textarea')).toBeVisible();
    await expect(page.locator('#workspace-new-story')).toHaveAttribute('aria-busy', 'false');
    await page.evaluate(async () => {
        const s = await import('/script.js'); const { power_user } = await import('/scripts/power-user.js');
        const { SWIPE_DIRECTION, SWIPE_SOURCE } = await import('/scripts/constants.js');
        power_user.chat_truncation = 4;
        s.chat.splice(0, s.chat.length, ...Array.from({ length: 80 }, (_, index) => ({ name: s.name2, mes: `Reply ${index}`, is_user: false, is_system: false, extra: {}, swipe_id: 0, swipes: [`Reply ${index}`, `Alternative ${index}`] })));
        s.chat_metadata.tainted = true; await s.clearChat(); await s.printMessages();
        if (document.querySelector('#chat .mes[mesid="0"]')) throw new Error('Fixture must truncate message zero');
        await s.swipe(null, SWIPE_DIRECTION.RIGHT, { source: SWIPE_SOURCE.SLASH_COMMAND, forceMesId: 0 });
        window.__offscreenSwipeAllowed = s.isSwipingAllowed();
    });
    expect(await page.evaluate(() => window.__offscreenSwipeAllowed)).toBe(true);
    await page.locator('#chat .last_mes .swipe_right').click();
    await expect(page.locator('#chat .last_mes .mes_text')).toContainText('Alternative 79');
    await expect.poll(() => page.evaluate(async () => (await import('/script.js')).isSwipingAllowed())).toBe(true);
});

test('debounced autosave retains its card after the editor switches', async ({ page }) => {
    const [a, b] = page.auditCards;
    await page.evaluate(async avatar => {
        const s = await import('/script.js');
        const node = document.getElementById('description_textarea'); node.value = 'Debounced A draft'; node.dispatchEvent(new Event('input', { bubbles: true }));
        await s.selectCharacterById(String(s.characters.findIndex(card => card.avatar === avatar)));
    }, b.avatar);
    await expect.poll(async () => (await readCard(page, a.avatar)).description).toBe('Debounced A draft');
    expect((await readCard(page, b.avatar)).description).toBe('Initial B');
    await expect(page.locator('#avatar_url_pole')).toHaveValue(b.avatar);
    await expect(page.locator('#description_textarea')).toHaveValue('Initial B');
});

test('failed card Save preserves the draft and allows an explicit retry', async ({ page }) => {
    let fail = true;
    await page.route('**/api/characters/edit*', async route => { if (fail) await route.fulfill({ status: 503, body: 'Synthetic save failure' }); else await route.continue(); });
    await editDraft(page, 'Retry this exact draft'); await save(page);
    await expect.poll(() => page.evaluate(() => window.__saveResult)).toBe(false);
    await expect(page.locator('#description_textarea')).toHaveValue('Retry this exact draft');
    expect((await readCard(page, page.auditCards[0].avatar)).description).toBe('Initial A');
    fail = false; await save(page); await expect.poll(() => page.evaluate(() => window.__saveResult)).toBe(true);
    expect((await readCard(page, page.auditCards[0].avatar)).description).toBe('Retry this exact draft');
});

test('one pending creation writes once and preserves a newly selected editor', async ({ page }) => {
    await page.locator('[data-workspace-action="close-panel"]').click();
    await page.locator('#workspace-navigation [data-workspace-action="characters"]').click();
    await page.locator('[data-workspace-action="create-character"]').click();
    const name = `Native single creation ${Date.now()}`;
    await page.locator('#character_name_pole').fill(name);
    let release; const gate = new Promise(resolve => release = resolve); let entered; const waiting = new Promise(resolve => entered = resolve); let count = 0, created;
    await page.route('**/api/characters/create*', async route => {
        count++; entered(); await gate; const response = await route.fetch(); created = await response.text(); await route.fulfill({ response });
    });
    await save(page); await waiting;
    await page.evaluate(() => { import('/script.js').then(s => s.createOrEditCharacter()).then(value => window.__duplicateCreate = value); });
    await expect(page.locator('#create_button')).toBeDisabled();
    await editDraft(page, 'Changed create draft while pending');
    expect(await page.evaluate(async () => (await import('/script.js')).createOrEditCharacter())).toBe(false);
    expect(count).toBe(1);
    await expect(page.locator('#description_textarea')).toHaveValue('Changed create draft while pending');
    await selectCard(page, 1); await editDraft(page, 'Preserved B after create'); release();
    await expect.poll(() => page.evaluate(() => window.__duplicateCreate)).toBe(true);
    expect(count).toBe(1); expect(created).toMatch(/\.png$/);
    page.auditCards.push({ name, avatar: created });
    await expect(page.locator('#avatar_url_pole')).toHaveValue(page.auditCards[1].avatar);
    await expect(page.locator('#description_textarea')).toHaveValue('Preserved B after create');
    expect((await readCard(page, created)).name).toBe(name);
});

test('held deletion of A never resets B when both story files have the same name', async ({ page }) => {
    const file = `same-${Date.now()}`;
    await page.evaluate(async ({ cards, file }) => {
        const s = await import('/script.js');
        for (const card of cards) await fetch('/api/chats/save', { method: 'POST', headers: s.getRequestHeaders(), body: JSON.stringify({ ch_name: card.name, avatar_url: card.avatar, file_name: file, chat: [{ user_name: 'unused', character_name: 'unused', chat_metadata: { integrity: crypto.randomUUID() } }, { name: card.name, mes: `Saved ${card.avatar}`, is_user: false, is_system: false, extra: {} }] }) });
        await s.openCharacterChat(file); await s.displayPastChats();
    }, { cards: page.auditCards, file });
    let release; const gate = new Promise(resolve => release = resolve); let entered; const waiting = new Promise(resolve => entered = resolve); let completed; const done = new Promise(resolve => completed = resolve);
    await page.route('**/api/chats/delete', async route => { entered(); await gate; const response = await route.fetch(); await route.fulfill({ response }); completed(); });
    await page.evaluate(file => window.jQuery(`#select_chat_div .PastChat_cross[file_name="${file}"]`).trigger('click', { fromSlashCommand: true }), file);
    await waiting;
    await page.evaluate(async ({ avatar, file }) => {
        const s = await import('/script.js'); await s.selectCharacterById(String(s.characters.findIndex(card => card.avatar === avatar)));
        await s.openCharacterChat(file); s.chat_metadata.ownerMarker = 'B metadata preserved'; window.__deleteOwner = s.getCurrentChatIdentity();
    }, { avatar: page.auditCards[1].avatar, file });
    release(); await done; await settle(page);
    expect(await page.evaluate(async () => { const s = await import('/script.js'); return { identity: s.getCurrentChatIdentity(), marker: s.chat_metadata.ownerMarker, text: s.chat[0].mes }; })).toEqual({ identity: await page.evaluate(() => window.__deleteOwner), marker: 'B metadata preserved', text: `Saved ${page.auditCards[1].avatar}` });
});

test('a CHARACTER_EDITED listener can change a field and await a second native Save', async ({ page }) => {
    await page.evaluate(() => {
        window.__nestedCardSave = null;
        import('/script.js').then(async s => {
            s.eventSource.once(s.event_types.CHARACTER_EDITED, async () => {
                document.getElementById('description_textarea').value = 'Nested listener draft';
                window.__nestedCardSave = await s.createOrEditCharacter();
            });
            document.getElementById('description_textarea').value = 'Outer saved draft';
            window.__outerCardSave = await s.createOrEditCharacter();
        });
    });
    await expect.poll(() => page.evaluate(() => window.__nestedCardSave)).toBe(true);
    await expect.poll(() => page.evaluate(() => window.__outerCardSave)).toBe(true);
    expect((await readCard(page, page.auditCards[0].avatar)).description).toBe('Nested listener draft');
    await expect(page.locator('#description_textarea')).toHaveValue('Nested listener draft');
});

test('a changed draft after native creation automatically saves to that same created card', async ({ page }) => {
    await page.locator('[data-workspace-action="close-panel"]').click();
    await page.locator('#workspace-navigation [data-workspace-action="characters"]').click();
    await page.locator('[data-workspace-action="create-character"]').click();
    const name = `Native draft adoption ${Date.now()}`; await page.locator('#character_name_pole').fill(name);
    let created, writes = 0;
    await page.route('**/api/characters/create*', async route => { writes++; const response = await route.fetch(); created = await response.text(); await route.fulfill({ response }); });
    let release; const gate = new Promise(resolve => release = resolve); let entered; const waiting = new Promise(resolve => entered = resolve);
    await page.route('**/api/characters/all', async route => { const response = await route.fetch(); entered(); await gate; await route.fulfill({ response }); });
    await save(page); await waiting;
    expect(created).toMatch(/\.png$/); page.auditCards.push({ name, avatar: created });
    expect((await readCard(page, created)).description).toBe('');
    await editDraft(page, 'Changed after actual native create write'); release();
    await expect.poll(() => page.evaluate(() => window.__saveResult)).toBe(true);
    await expect(page.locator('#form_create')).toHaveAttribute('actiontype', 'editcharacter');
    await expect(page.locator('#avatar_url_pole')).toHaveValue(created);
    await expect(page.locator('#description_textarea')).toHaveValue('Changed after actual native create write');
    await expect(page.locator('#create_button')).toHaveValue('Save');
    await expect(page.locator('#create_button')).toBeEnabled();
    await expect.poll(async () => (await readCard(page, created)).description).toBe('Changed after actual native create write');
    expect(writes).toBe(1);
    expect((await readCard(page, created)).description).toBe('Changed after actual native create write');
});

test('an old Delete message confirmation cannot delete a same-story reload message', async ({ page }) => {
    await page.evaluate(() => {
        window.__messageDeleteDone = false;
        import('/script.js').then(async s => {
            window.__deleteOldIdentity = s.getCurrentChatIdentity(); window.__deleteOldMessage = s.chat[0];
            await s.deleteMessage(0, undefined, true); window.__messageDeleteDone = true;
        });
    });
    await expect(page.locator('dialog[open]')).toContainText('delete this message');
    const current = await page.evaluate(async () => {
        const s = await import('/script.js'); await s.reloadCurrentChat();
        if (s.chat[0] === window.__deleteOldMessage) throw new Error('Fixture must reload a new canonical message');
        if (s.getCurrentChatIdentity() !== window.__deleteOldIdentity) throw new Error('Fixture must retain the same story identity');
        return { messages: JSON.parse(JSON.stringify(s.chat)), metadata: JSON.parse(JSON.stringify(s.chat_metadata)) };
    });
    const saves = [];
    page.on('request', request => { if (request.url().endsWith('/api/chats/save')) saves.push(request.url()); });
    await page.locator('dialog[open] .popup-button-ok').click();
    await expect.poll(() => page.evaluate(() => window.__messageDeleteDone)).toBe(true);
    expect(await page.evaluate(async () => { const s = await import('/script.js'); return { messages: s.chat, metadata: s.chat_metadata }; })).toEqual(current);
    expect(saves).toEqual([]);
});

test('a stale media render cannot replace a newer image, undo Clear, or move story scroll', async ({ page }) => {
    const held = [];
    await page.route('**/synthetic-held-media-*.png', route => held.push(route));
    const result = await page.evaluate(async () => {
        const s = await import('/script.js'); const { MEDIA_TYPE, MEDIA_DISPLAY, SCROLL_BEHAVIOR, debounce_timeout } = await import('/scripts/constants.js');
        const $ = window.jQuery;
        const fresh = 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><path fill="green" d="M0 0h2v2H0z"/></svg>');
        const make = index => {
            const row = $('#message_template .mes').clone(); row.attr('mesid', `media-audit-${index}`); $('#chat').append(row);
            return { row, message: { name: 'Synthetic media', mes: 'Synthetic', is_user: false, extra: { media_display: MEDIA_DISPLAY.LIST, media: [{ type: MEDIA_TYPE.IMAGE, url: `/synthetic-held-media-${index}.png` }] } } };
        };
        const first = make(1);
        s.appendMediaToMessage(first.message, first.row, SCROLL_BEHAVIOR.ADJUST);
        first.message.extra.media[0] = { type: MEDIA_TYPE.IMAGE, url: fresh };
        s.appendMediaToMessage(first.message, first.row, SCROLL_BEHAVIOR.NONE);
        const second = make(2);
        s.appendMediaToMessage(second.message, second.row, SCROLL_BEHAVIOR.ADJUST);
        second.message.extra.media = [];
        s.appendMediaToMessage(second.message, second.row, SCROLL_BEHAVIOR.NONE);
        // Detached preview rows are valid initial render targets.
        const preview = $('#message_template .mes').clone();
        s.appendMediaToMessage({ extra: { media: [{ type: MEDIA_TYPE.IMAGE, url: fresh }] } }, preview, SCROLL_BEHAVIOR.NONE);
        const third = make(3);
        s.appendMediaToMessage(third.message, third.row, SCROLL_BEHAVIOR.KEEP);
        third.row.remove();
        const chat = document.getElementById('chat');
        const originalScrollTop = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop'); let scrollWrites = 0;
        Object.defineProperty(chat, 'scrollTop', { configurable: true, get: () => 42, set: () => { scrollWrites++; } });
        try {
            await new Promise(resolve => setTimeout(resolve, debounce_timeout.short * 2));
            return { fresh: first.row.find('.mes_img').attr('src') === fresh, cleared: second.row.find('.mes_img').length === 0, detachedPreview: preview.find('.mes_img').attr('src') === fresh, scrollWrites };
        } finally { if (originalScrollTop) delete chat.scrollTop; }
    });
    expect(result).toEqual({ fresh: true, cleared: true, detachedPreview: true, scrollWrites: 0 });
    for (const route of held) await route.fulfill({ status: 404, body: 'Synthetic stale media' });
});
