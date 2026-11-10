import { test, expect } from '@playwright/test';
import fs from 'node:fs';

test.use({ channel: 'chromium', video: 'off', viewport: { width: 1280, height: 844 } });
test.setTimeout(90000);

async function hold(page, pattern, response) {
    let release, entered;
    const gate = new Promise(resolve => { release = resolve; });
    const started = new Promise(resolve => { entered = resolve; });
    let count = 0;
    await page.route(pattern, async route => { count++; entered(); await gate; await route.fulfill(response); });
    return { release, started, count: () => count };
}

async function openGroup(page, id) {
    expect(await page.evaluate(async id => (await import('/scripts/group-chats.js')).openGroupById(id), id)).toBe(true);
}

test.beforeEach(async ({ page }) => {
    page.errors = []; page.on('pageerror', error => page.errors.push(error.message));
    await page.route('**/api/settings/get', async route => {
        const response = await route.fetch(), body = await response.json(), settings = JSON.parse(body.settings);
        Object.assign(settings, { firstRun: false, active_character: null, active_group: null, main_api: 'openai' });
        settings.power_user.auto_connect = false;
        settings.accountStorage = { ...settings.accountStorage, workspaceLayout: 'true' };
        settings.extension_settings.tts = { ...settings.extension_settings.tts, enabled: false, currentProvider: 'System' };
        settings.extension_settings.translate = { ...settings.extension_settings.translate, auto_mode: 'none' };
        settings.extension_settings.caption = { ...settings.extension_settings.caption, auto_mode: false };
        settings.extension_settings.apiUrl = '';
        body.settings = JSON.stringify(settings); await route.fulfill({ response, json: body });
    });
    await page.route('**/api/settings/save', route => route.fulfill({ json: { result: 'ok' } }));
    await page.goto('/'); await expect(page.locator('#preloader')).toHaveCount(0, { timeout: 30000 });
    page.groups = await page.evaluate(async () => {
        const g = await import('/scripts/group-chats.js'), s = await import('/script.js');
        const result = [];
        const members = s.characters.slice(0, 2).map(character => character.avatar);
        if (members.length < 2) { const response = await fetch('/api/characters/duplicate', { method: 'POST', headers: s.getRequestHeaders(), body: JSON.stringify({ avatar_url: members[0] }) }); members.push((await response.json()).path); await s.getCharacters(); }
        for (const suffix of ['A', 'B']) {
            const group = await g.createGroupWithMembers(`Async owner ${suffix} ${Date.now()}`, members);
            await g.openGroupById(group.id, { newChat: true }); result.push(group.id);
        }
        return result;
    });
    await openGroup(page, page.groups[0]);
});

test.afterEach(async ({ page }, info) => {
    fs.writeFileSync(info.outputPath('page-errors.json'), JSON.stringify(page.errors, null, 2));
    expect(page.errors).toEqual([]);
});

test('separate groups retain both debounced settings saves', async ({ page }) => {
    const edits = [];
    await page.route('**/api/groups/edit', route => { edits.push(route.request().postDataJSON().id); return route.fulfill({ json: {} }); });
    await page.evaluate(async ids => {
        const g = await import('/scripts/group-chats.js');
        for (const id of ids) { g.groups.find(group => group.id === id).name += ' changed'; await g.editGroup(id, false, false); }
    }, page.groups);
    await expect.poll(() => edits.sort()).toEqual([...page.groups].sort());
});

test('failed group chat deletion preserves chat membership and metadata', async ({ page }) => {
    await page.route('**/api/chats/group/delete', route => route.fulfill({ status: 503, json: { error: 'Synthetic failure' } }));
    const result = await page.evaluate(async id => {
        const g = await import('/scripts/group-chats.js'), s = await import('/script.js');
        const group = g.groups.find(group => group.id === id);
        const before = { chats: [...group.chats], chat: group.chat_id, metadata: structuredClone(s.chat_metadata) };
        await g.deleteGroupChat(id, group.chat_id);
        return { before, after: { chats: [...group.chats], chat: group.chat_id, metadata: structuredClone(s.chat_metadata) } };
    }, page.groups[0]);
    expect(result.after).toEqual(result.before);
    await expect(page.locator('.toast-message').filter({ hasText: /could not be deleted/i })).toBeVisible();
});

test('pending group import retains its original group and leaves foreground group alone', async ({ page }) => {
    const pending = await hold(page, '**/api/chats/group/import', { json: { res: 'synthetic-import-owner' } });
    try {
        await page.evaluate(() => { window.__groupImport = import('/scripts/group-chats.js').then(g => g.importGroupChat(new FormData(), { refresh: false })); });
        await pending.started; await openGroup(page, page.groups[1]); pending.release();
        const result = await page.evaluate(async ids => {
            await window.__groupImport; const g = await import('/scripts/group-chats.js');
            return { selected: g.selected_group, owners: ids.map(id => g.groups.find(group => group.id === id).chats.includes('synthetic-import-owner')) };
        }, page.groups);
        expect(result).toEqual({ selected: page.groups[1], owners: [true, false] });
    } finally { pending.release(); }
});

test('pending gallery mount cannot append after changing its character or group owner', async ({ page }) => {
    await page.route('**/api/images/list', route => route.fulfill({ json: [] }));
    const pending = await hold(page, '**/api/images/folders', { json: [] });
    try {
        await page.evaluate(async () => { const p = await import('/scripts/slash-commands/SlashCommandParser.js'); p.SlashCommandParser.commands['show-gallery'].callback(); });
        await pending.started; await openGroup(page, page.groups[1]); pending.release();
        await expect.poll(() => page.locator('#gallery').count()).toBe(0);
        await page.waitForTimeout(500);
        await expect(page.locator('#gallery')).toHaveCount(0);
    } finally { pending.release(); }
});

test('new blocking loader retains its popup while the previous popup closes', async ({ page }) => {
    const result = await page.evaluate(async () => {
        const { loader } = await import('/scripts/action-loader.js');
        const first = loader.show({ message: 'First synthetic task' });
        const closing = first.hide();
        const next = loader.show({ message: 'Next synthetic task' });
        await closing;
        const state = { active: next.isActive, blocking: loader.isBlocking(), dialogs: document.querySelectorAll('dialog[open] #loader').length };
        await next.hide(); return state;
    });
    expect(result).toEqual({ active: true, blocking: true, dialogs: 1 });
});

test('a pending loader stop handler runs once across repeated activation', async ({ page }) => {
    const count = await page.evaluate(async () => {
        const { loader } = await import('/scripts/action-loader.js');
        let count = 0, release;
        const gate = new Promise(resolve => { release = resolve; });
        const handle = loader.show({ blocking: false, onStop: async () => { count++; await gate; } });
        const first = handle.stop(), second = handle.stop(); release(); await Promise.all([first, second]); return count;
    });
    expect(count).toBe(1);
});

test('profile streaming error preserves partial content and never issues another inference', async ({ page }) => {
    let requests = 0;
    await page.route('**/api/backends/chat-completions/generate', route => {
        requests++;
        return route.fulfill({ contentType: 'text/event-stream', body: 'data: {"choices":[{"delta":{"content":"A retained partial reply."}}]}\n\ndata: {"error":{"message":"Synthetic interrupted stream"}}\n\n' });
    });
    const result = await page.evaluate(async () => {
        const manager = await import('/scripts/extensions/connection-manager/index.js');
        const { SlashCommandParser } = await import('/scripts/slash-commands/SlashCommandParser.js');
        const id = await manager.saveCompatibleProfile('Synthetic stream owner', 'https://synthetic.invalid/v1', 'synthetic-local');
        return SlashCommandParser.commands['profile-genstream'].callback({ profile: id, delay: 'infinite' }, 'A synthetic local prompt');
    });
    expect(requests).toBe(1);
    expect(result).toBe('A retained partial reply.');
    await expect(page.locator('.toast-message').filter({ hasText: /interrupted stream/i })).toBeVisible();
});

test('pending avatar upload cannot change another group editor', async ({ page }) => {
    const pending = await hold(page, '**/api/images/upload', { json: { path: 'user/images/synthetic-avatar.jpg' } });
    try {
        await page.evaluate(async id => {
            const g = await import('/scripts/group-chats.js'), p = await import('/scripts/power-user.js');
            p.power_user.never_resize_avatars = true; g.select_group_chats(id, true);
        }, page.groups[0]);
        const before = await page.evaluate(async ids => (await import('/scripts/group-chats.js')).groups.filter(group => ids.includes(group.id)).map(group => [group.id, group.avatar_url]), page.groups);
        await page.locator('#group_avatar_button').setInputFiles({ name: 'synthetic-avatar.jpg', mimeType: 'image/jpeg', buffer: fs.readFileSync(new URL('../default/content/backgrounds/_white.jpg', import.meta.url)) });
        await pending.started;
        await page.evaluate(async id => (await import('/scripts/group-chats.js')).select_group_chats(id, true), page.groups[1]);
        pending.release(); await page.waitForTimeout(400);
        expect(await page.evaluate(async ids => (await import('/scripts/group-chats.js')).groups.filter(group => ids.includes(group.id)).map(group => [group.id, group.avatar_url]), page.groups)).toEqual(before);
        expect(await page.evaluate(async () => (await import('/scripts/group-chats.js')).openGroupId)).toBe(page.groups[1]);
    } finally { pending.release(); }
});

test('a completed group deletion cannot clear a newer foreground conversation', async ({ page }) => {
    const pending = await hold(page, '**/api/groups/delete', { json: {} });
    try {
        await page.evaluate(async id => { window.__deleteGroup = (await import('/scripts/group-chats.js')).deleteGroup(id); }, page.groups[0]);
        await pending.started; await openGroup(page, page.groups[1]);
        const before = await page.evaluate(async () => { const s = await import('/script.js'); return { identity: s.getCurrentChatIdentity(), chat: structuredClone(s.chat), metadata: structuredClone(s.chat_metadata) }; });
        pending.release();
        expect(await page.evaluate(() => window.__deleteGroup)).toBe(true);
        expect(await page.evaluate(async () => { const s = await import('/script.js'); return { identity: s.getCurrentChatIdentity(), chat: structuredClone(s.chat), metadata: structuredClone(s.chat_metadata) }; })).toEqual(before);
    } finally { pending.release(); }
});

test('failed group import preserves membership and can be retried successfully', async ({ page }) => {
    let fail = true;
    await page.route('**/api/chats/group/import', route => route.fulfill(fail ? { status: 503, json: { error: 'Synthetic failure' } } : { json: { res: 'synthetic-import-retry' } }));
    const invoke = () => page.evaluate(async () => (await import('/scripts/group-chats.js')).importGroupChat(new FormData(), { refresh: false }));
    expect(await invoke()).toEqual([]);
    await expect(page.locator('.toast-message').filter({ hasText: /could not be imported/i })).toBeVisible();
    fail = false;
    expect(await invoke()).toEqual(['synthetic-import-retry']);
    expect(await page.evaluate(async id => (await import('/scripts/group-chats.js')).groups.find(group => group.id === id).chats.includes('synthetic-import-retry'), page.groups[0])).toBe(true);
});

async function showGallery(page) {
    await page.evaluate(async () => (await import('/scripts/slash-commands/SlashCommandParser.js')).SlashCommandParser.commands['show-gallery'].callback());
    await expect(page.locator('#gallery')).toBeVisible();
    await expect(page.locator('#dragGallery')).toHaveClass(/drop_target/);
}

test('late gallery upload cannot close or replace a newly opened gallery', async ({ page }) => {
    await page.route('**/api/images/list', route => route.fulfill({ json: [] }));
    await page.route('**/api/images/folders', route => route.fulfill({ json: [] }));
    await showGallery(page);
    const pending = await hold(page, '**/api/images/upload', { json: { path: 'user/images/synthetic-upload.jpg' } });
    try {
        await page.locator('#gallery input[type="file"]').setInputFiles({ name: 'synthetic-upload.jpg', mimeType: 'image/jpeg', buffer: fs.readFileSync(new URL('../default/content/backgrounds/_white.jpg', import.meta.url)) });
        await pending.started; await openGroup(page, page.groups[1]); await showGallery(page);
        await page.evaluate(() => { window.__newGallery = document.getElementById('gallery'); });
        pending.release(); await page.waitForTimeout(500);
        expect(await page.evaluate(() => document.getElementById('gallery') === window.__newGallery)).toBe(true);
        await expect(page.locator('#gallery')).toHaveCount(1);
    } finally { pending.release(); }
});

test('gallery close removes its delegated upload handlers and loading failure remains retryable', async ({ page }) => {
    let fail = true;
    await page.route('**/api/images/list', route => route.fulfill(fail ? { status: 503, json: { error: 'Synthetic list failure' } } : { json: [] }));
    await page.route('**/api/images/folders', route => route.fulfill({ json: [] }));
    await page.evaluate(async () => (await import('/scripts/slash-commands/SlashCommandParser.js')).SlashCommandParser.commands['show-gallery'].callback());
    await expect(page.locator('.toast-message').filter({ hasText: /could not be loaded/i })).toBeVisible();
    await expect(page.locator('#gallery')).toHaveCount(0);
    fail = false; await showGallery(page);
    const handlers = () => page.evaluate(() => ($._data(document.body, 'events')?.drop || []).filter(listener => listener.selector?.startsWith('#dragGallery.')).length);
    expect(await handlers()).toBe(1);
    await page.locator('#gallery .dragClose').click();
    await expect(page.locator('#gallery')).toHaveCount(0);
    await expect.poll(handlers).toBe(0);
});

test('successful profile stream still returns one result and completes its display', async ({ page }) => {
    let requests = 0;
    await page.route('**/api/backends/chat-completions/generate', route => {
        requests++; return route.fulfill({ contentType: 'text/event-stream', body: 'data: {"choices":[{"delta":{"content":"One successful reply."}}]}\n\ndata: [DONE]\n\n' });
    });
    const result = await page.evaluate(async () => {
        const manager = await import('/scripts/extensions/connection-manager/index.js');
        const { SlashCommandParser } = await import('/scripts/slash-commands/SlashCommandParser.js');
        const id = await manager.saveCompatibleProfile('Synthetic successful stream', 'https://synthetic.invalid/v1', 'synthetic-local');
        return SlashCommandParser.commands['profile-genstream'].callback({ profile: id, delay: 'infinite' }, 'Synthetic prompt');
    });
    expect(result).toBe('One successful reply.'); expect(requests).toBe(1);
    await expect(page.locator('.streaming-display-complete')).toHaveCount(1);
});

for (const action of ['Stop', 'None']) {
    test(`profile ${action} cancels a pending inference without a retry`, async ({ page }) => {
        const pending = await hold(page, '**/api/backends/chat-completions/generate', { contentType: 'text/event-stream', body: 'data: [DONE]\n\n' });
        try {
            await page.evaluate(async () => {
                const manager = await import('/scripts/extensions/connection-manager/index.js');
                const { SlashCommandParser } = await import('/scripts/slash-commands/SlashCommandParser.js');
                const id = await manager.saveCompatibleProfile('Synthetic cancel stream', 'https://synthetic.invalid/v1', 'synthetic-local');
                window.__cancelProfile = SlashCommandParser.commands['profile-genstream'].callback({ profile: id, delay: 'infinite' }, 'Synthetic prompt');
                window.__profileSettled = false; window.__cancelProfile.finally(() => { window.__profileSettled = true; });
            });
            await pending.started;
            if (action === 'Stop') await page.locator('.streaming-display-btn-stop').click();
            else await page.evaluate(() => { const select = document.getElementById('connection_profiles'); select.value = ''; select.dispatchEvent(new Event('change', { bubbles: true })); });
            await expect.poll(() => page.evaluate(() => window.__profileSettled)).toBe(true);
            expect(await page.evaluate(() => window.__cancelProfile)).toBe('');
            expect(pending.count()).toBe(1);
            await expect(page.locator('.streaming-display-stopped')).toHaveCount(1);
        } finally { pending.release(); }
    });
}

test('None cancels the active profile command protocol and skips later profile commands', async ({ page }) => {
    await page.evaluate(async () => {
        const { extension_settings } = await import('/scripts/extensions.js');
        const { SlashCommandParser } = await import('/scripts/slash-commands/SlashCommandParser.js');
        const profile = { id: 'synthetic-application', name: 'Synthetic application', mode: 'cc', preset: 'held', model: 'later-model' };
        extension_settings.connectionManager.profiles.push(profile);
        const select = document.getElementById('connection_profiles'); select.add(new Option(profile.name, profile.id));
        window.__profileModelCalls = 0;
        window.__originalProfileCallbacks = { preset: SlashCommandParser.commands.preset.callback, model: SlashCommandParser.commands.model.callback };
        SlashCommandParser.commands.preset.callback = async args => {
            window.__profileCommandAbort = args._abortController;
            await new Promise(resolve => { window.__releaseProfileCommand = resolve; });
            return '';
        };
        SlashCommandParser.commands.model.callback = () => { window.__profileModelCalls++; return ''; };
        select.value = profile.id; select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    try {
        await expect.poll(() => page.evaluate(() => Boolean(window.__releaseProfileCommand))).toBe(true);
        await page.evaluate(() => { const select = document.getElementById('connection_profiles'); select.value = ''; select.dispatchEvent(new Event('change', { bubbles: true })); });
        expect(await page.evaluate(() => window.__profileCommandAbort.signal.aborted)).toBe(true);
        await expect(page.locator('#connection_profile_spinner')).toHaveClass(/hidden/);
        await page.evaluate(() => window.__releaseProfileCommand());
        await expect(page.locator('#connection_profile_spinner')).toHaveClass(/hidden/);
        expect(await page.evaluate(() => window.__profileModelCalls)).toBe(0);
    } finally {
        await page.evaluate(async () => {
            const { SlashCommandParser } = await import('/scripts/slash-commands/SlashCommandParser.js');
            window.__releaseProfileCommand?.(); Object.assign(SlashCommandParser.commands.preset, { callback: window.__originalProfileCallbacks.preset });
            Object.assign(SlashCommandParser.commands.model, { callback: window.__originalProfileCallbacks.model });
        });
    }
});

test('saving a group chat rejects a group that does not own the current transcript', async ({ page }) => {
    let saves = 0;
    await page.route('**/api/chats/group/save', route => { saves++; return route.fulfill({ json: {} }); });
    expect(await page.evaluate(async id => (await import('/scripts/group-chats.js')).saveGroupChat(id, false), page.groups[1])).toBe(false);
    expect(saves).toBe(0);
});

test('group deletion failure sends no deleted lifecycle events and leaves the group retryable', async ({ page }) => {
    let fail = true;
    await page.route('**/api/groups/delete', route => route.fulfill(fail ? { status: 503, json: { error: 'Synthetic failure' } } : { json: {} }));
    await page.evaluate(async () => { const s = await import('/script.js'); window.__deletedGroupEvents = []; s.eventSource.on(s.event_types.GROUP_CHAT_DELETED, id => window.__deletedGroupEvents.push(id)); });
    const invoke = () => page.evaluate(async id => (await import('/scripts/group-chats.js')).deleteGroup(id), page.groups[1]);
    expect(await invoke()).toBe(false);
    expect(await page.evaluate(() => window.__deletedGroupEvents)).toEqual([]);
    expect(await page.evaluate(async id => (await import('/scripts/group-chats.js')).groups.some(group => group.id === id), page.groups[1])).toBe(true);
    fail = false; expect(await invoke()).toBe(true);
    expect(await page.evaluate(() => window.__deletedGroupEvents.length)).toBe(1);
});

test('finishing a locked profile request cannot unlock a pending native reply', async ({ page }) => {
    const pending = await hold(page, '**/api/backends/chat-completions/generate', { json: { choices: [{ message: { content: 'Synthetic native reply.' } }] } });
    try {
        await page.evaluate(async () => {
            const s = await import('/script.js'), o = await import('/scripts/openai.js');
            await s.selectCharacterById('0', { switchMenu: false, newChat: true });
            Object.assign(o.oai_settings, { chat_completion_source: 'custom', custom_url: 'https://synthetic.invalid/v1', custom_model: 'synthetic-local', stream_openai: false, n: 1 });
            s.setOnlineStatus('synthetic-local');
            document.getElementById('send_textarea').value = 'Synthetic main reply prompt';
            window.__mainNativeReply = s.Generate('normal');
        });
        await pending.started;
        expect(await page.evaluate(async () => (await import('/script.js')).is_send_press)).toBe(true);
        // An unknown profile exits before inference, exercising its actual lock/finally path.
        await page.evaluate(async () => {
            const { SlashCommandParser } = await import('/scripts/slash-commands/SlashCommandParser.js');
            await SlashCommandParser.commands['profile-genstream'].callback({ profile: '__synthetic_missing__', lock: 'true' }, 'Synthetic independent prompt');
        });
        expect(await page.evaluate(async () => (await import('/script.js')).is_send_press)).toBe(true);
        expect(await page.evaluate(() => document.body.dataset.generating)).toBe('true');
    } finally {
        pending.release(); await page.evaluate(() => window.__mainNativeReply);
    }
});

test('one profile request cannot release another pending profile lock', async ({ page }) => {
    const pending = await hold(page, '**/api/backends/chat-completions/generate', { contentType: 'text/event-stream', body: 'data: {"choices":[{"delta":{"content":"Synthetic locked reply."}}]}\n\ndata: [DONE]\n\n' });
    try {
        await page.evaluate(async () => {
            const manager = await import('/scripts/extensions/connection-manager/index.js');
            const { SlashCommandParser } = await import('/scripts/slash-commands/SlashCommandParser.js');
            const id = await manager.saveCompatibleProfile('Synthetic retained lock', 'https://synthetic.invalid/v1', 'synthetic-local');
            window.__firstProfileLock = SlashCommandParser.commands['profile-genstream'].callback({ profile: id, lock: 'true' }, 'Synthetic pending lock');
        });
        await pending.started;
        await page.evaluate(async () => (await import('/scripts/slash-commands/SlashCommandParser.js')).SlashCommandParser.commands['profile-genstream'].callback({ profile: '__synthetic_missing__', lock: 'true' }, 'Synthetic second lock'));
        expect(await page.evaluate(() => document.body.dataset.generating)).toBe('true');
        pending.release();
        expect(await page.evaluate(() => window.__firstProfileLock)).toBe('Synthetic locked reply.');
        expect(await page.evaluate(() => document.body.dataset.generating)).toBeUndefined();
    } finally { pending.release(); }
});

test('same-owner avatar upload still saves the selected group avatar', async ({ page }) => {
    const pixel = fs.readFileSync(new URL('../default/content/backgrounds/_white.jpg', import.meta.url));
    const writes = [];
    await page.route('**/api/images/upload', route => route.fulfill({ json: { path: 'user/images/synthetic-current-avatar.jpg' } }));
    await page.route('**/user/images/synthetic-current-avatar.jpg', route => route.fulfill({ contentType: 'image/jpeg', body: pixel }));
    await page.route('**/api/groups/edit', async route => { writes.push(route.request().postDataJSON()); await route.continue(); });
    await page.evaluate(async id => {
        const g = await import('/scripts/group-chats.js'), p = await import('/scripts/power-user.js');
        p.power_user.never_resize_avatars = true; g.select_group_chats(id, true);
    }, page.groups[0]);
    await page.locator('#group_avatar_button').setInputFiles({ name: 'synthetic-current-avatar.jpg', mimeType: 'image/jpeg', buffer: pixel });
    await expect.poll(() => writes.some(group => group.id === page.groups[0] && group.avatar_url === 'user/images/synthetic-current-avatar.jpg')).toBe(true);
    await expect(page.locator('#group_avatar_preview img')).toHaveAttribute('src', 'user/images/synthetic-current-avatar.jpg');
});

test('successful current group deletion clears only that group and opens the neutral chat', async ({ page }) => {
    expect(await page.evaluate(async id => (await import('/scripts/group-chats.js')).deleteGroup(id), page.groups[0])).toBe(true);
    const state = await page.evaluate(async ids => {
        const g = await import('/scripts/group-chats.js');
        return { selected: g.selected_group, groups: ids.map(id => g.groups.some(group => group.id === id)) };
    }, page.groups);
    expect(state).toEqual({ selected: null, groups: [false, true] });
});

test('a group list reload cannot discard a different group queued settings edit', async ({ page }) => {
    const writes = [];
    await page.route('**/api/groups/edit', async route => { writes.push(route.request().postDataJSON()); await route.continue(); });
    await page.evaluate(async id => { const g = await import('/scripts/group-chats.js'); g.groups.find(group => group.id === id).name += ' saved A'; await g.editGroup(id, false, true); }, page.groups[0]);
    await page.waitForTimeout(500);
    await page.evaluate(async id => { const g = await import('/scripts/group-chats.js'); g.groups.find(group => group.id === id).name += ' queued B'; await g.editGroup(id, false, false); }, page.groups[1]);
    await expect.poll(() => writes.map(group => group.id).sort()).toEqual([...page.groups].sort());
    expect(writes.find(group => group.id === page.groups[1]).name).toContain('queued B');
});

test('overlapping named group chat deletions preserve unrelated remaining chats', async ({ page }) => {
    await openGroup(page, page.groups[1]);
    const pending = await hold(page, '**/api/chats/group/delete', { json: {} });
    try {
        await page.evaluate(async id => {
            const g = await import('/scripts/group-chats.js');
            const group = g.groups.find(group => group.id === id);
            group.chats = ['synthetic-delete-target', 'synthetic-delete-sentinel']; group.chat_id = 'synthetic-delete-sentinel';
            window.__namedDeletes = Promise.all([g.deleteGroupChatByName(id, 'synthetic-delete-target'), g.deleteGroupChatByName(id, 'synthetic-delete-target')]);
        }, page.groups[0]);
        await expect.poll(() => pending.count()).toBe(2); pending.release();
        expect(await page.evaluate(() => window.__namedDeletes)).toEqual([true, true]);
        expect(await page.evaluate(async id => (await import('/scripts/group-chats.js')).groups.find(group => group.id === id).chats, page.groups[0])).toEqual(['synthetic-delete-sentinel']);
    } finally { pending.release(); }
});

test('a catalog reload preserves the target of an accepted pending group import', async ({ page }) => {
    const pending = await hold(page, '**/api/chats/group/import', { json: { res: 'synthetic-import-after-catalog' } });
    try {
        await page.evaluate(async () => { window.__catalogImport = (await import('/scripts/group-chats.js')).importGroupChat(new FormData(), { refresh: false }); });
        await pending.started;
        await page.evaluate(async () => (await import('/scripts/group-chats.js')).getGroups());
        pending.release(); expect(await page.evaluate(() => window.__catalogImport)).toEqual(['synthetic-import-after-catalog']);
        expect(await page.evaluate(async id => (await import('/scripts/group-chats.js')).groups.find(group => group.id === id).chats.includes('synthetic-import-after-catalog'), page.groups[0])).toBe(true);
    } finally { pending.release(); }
});
