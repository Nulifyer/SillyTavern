import { describe, expect, jest, test } from '@jest/globals';
import fs from 'node:fs';
import vm from 'node:vm';

const source = file => fs.readFileSync(new URL(`../public/${file}`, import.meta.url), 'utf8');
const extract = (text, start, end) => text.slice(text.indexOf(start), text.indexOf(end, text.indexOf(start))).replace(/^export /gm, '');
const deferred = () => {
    let resolve;
    const promise = new Promise(fulfill => { resolve = fulfill; });
    return { promise, resolve };
};

async function nativeFixture() {
    const requested = deferred();
    const response = deferred();
    const first = { avatar: 'a.png', name: 'A', chat: 'a-story' };
    const current = { avatar: 'b.png', name: 'B', chat: 'b-story' };
    const group = { id: 'group', chat_id: 'group-story', chats: ['group-story'], members: ['a.png'] };
    const writes = [];
    const box = {
        console: { debug() {}, error() {} }, AbortController,
        characters: [first, current], groups: [group], this_chid: 1, selected_group: null,
        chat: [{ mes: 'Original B transcript' }], chat_metadata: { integrity: 'original-integrity' },
        mounted: ['Original B transcript'], itemizedPrompts: [], extension_prompts: {},
        isChatSaving: false, is_send_press: false, is_group_generating: false, is_delete_mode: false,
        debounce_timeout: { extended: 1, short: 1 }, event_types: {},
        fetch: jest.fn(async (_url, options) => { requested.resolve(options); return response.promise; }),
        unshallowCharacter: jest.fn(async () => {}), validateGroup: async () => {}, unshallowGroupMembers: async () => {},
        getRequestHeaders: () => ({}), waitUntilCondition: async () => {}, isGenerating: () => false,
        saveItemizedPrompts: jest.fn(async () => {}), cancelDebouncedChatSave: jest.fn(), cancelDebouncedMetadataSave: jest.fn(), closeMessageEditor: jest.fn(),
        chatElement: { children: () => ({ remove() { box.mounted = []; } }) },
        $: () => ({ length: 0, is: () => true, children: () => ({ text() {} }) }),
        resetSelectedGroup() { box.selected_group = null; },
        setCharacterId(id) { box.this_chid = id; },
        setCharacterName(name) { box.name2 = name; },
        getCurrentChatId: () => box.selected_group
            ? box.groups.find(value => value.id === box.selected_group)?.chat_id
            : box.characters[box.this_chid]?.chat,
        cancelTtsPlay: jest.fn(), ensureMessageMediaIsArray: jest.fn(), uuidv4: () => 'generated-integrity',
        // Native rendering, extension callbacks and writes are controlled seams.
        // The actual read/clear/owner commit functions execute unchanged.
        getChatResult: jest.fn(async () => { box.mounted = box.chat.map(value => value.mes); return true; }),
        eventSource: { emit: jest.fn(async () => {}) }, document: { activeElement: {} }, delay: async () => {},
        toastr: { error: jest.fn(), info: jest.fn() }, t: parts => parts.join(''),
        setActiveCharacter: jest.fn(), setActiveGroup: jest.fn(), select_rm_characters: jest.fn(),
        getFirstCharacterMessage: async () => ({ mes: 'Synthetic group greeting' }),
        setEditedMessageId: jest.fn(), updateChatMetadata(value) { box.chat_metadata = value; },
        loadItemizedPrompts: async () => {}, printMessages: async () => { box.mounted = box.chat.map(value => value.mes); },
        select_group_chats: jest.fn(), saveGroupChat: async () => writes.push({ metadata: { ...box.chat_metadata }, messages: box.chat.map(value => value.mes) }),
        humanizedDateTime: () => 'synthetic-new-story',
    };
    const context = vm.createContext(box);
    const loader = new vm.SourceTextModule(source('scripts/chat-loader.js'), { context });
    await loader.link(() => { throw new Error('Chat loader must not import application state'); });
    await loader.evaluate();
    box.beginChatLoad = loader.namespace.beginChatLoad;
    box.cancelChatLoad = loader.namespace.cancelChatLoad;
    const native = source('script.js');
    const groupSource = source('scripts/group-chats.js');
    const functions = [
        extract(native, 'export async function clearChat(', '\nexport async function deleteLastMessage('),
        extract(native, 'export async function getChat(', '\nasync function getChatResult('),
        extract(native, 'export async function closeCurrentChat(', '\n/**'),
        extract(groupSource, 'export async function getGroupChat(', '\n/**'),
    ];
    vm.runInContext(functions.join('\n'), context);
    const finish = data => response.resolve({ ok: true, json: async () => structuredClone(data) });
    const characterData = [{ chat_metadata: { integrity: 'a-integrity' } }, { mes: 'Message from A' }];
    const groupData = [{ chat_metadata: { integrity: 'group-integrity' } }, { mes: 'Group message' }];
    return { box, first, current, group, requested, finish, writes, characterData, groupData };
}

describe('native chat owner commits', () => {
    test('a delayed character read follows its avatar after array indexes change', async () => {
        const { box, first, current, requested, finish, characterData } = await nativeFixture();
        const loading = box.getChat({ characterId: 0, fileName: 'a-story' });
        await requested.promise;
        box.characters.splice(0, 2, current, first);
        finish(characterData);
        expect(await loading).toBe(true);
        expect(box.characters[box.this_chid].avatar).toBe('a.png');
        expect(box.getCurrentChatId()).toBe('a-story');
        expect(box.mounted).toEqual(['Message from A']);
        expect(current.chat).toBe('b-story');
    });

    test('character identity is captured before shallow-card hydration yields', async () => {
        const { box, first, current, requested, finish, characterData } = await nativeFixture();
        const hydration = deferred();
        box.unshallowCharacter.mockImplementationOnce(() => hydration.promise);
        const loading = box.getChat({ characterId: 0, fileName: 'a-story' });
        box.characters.splice(0, 2, current, first);
        hydration.resolve();
        const request = await requested.promise;
        expect(JSON.parse(request.body).avatar_url).toBe('a.png');
        finish(characterData);
        expect(await loading).toBe(true);
        expect(box.characters[box.this_chid].avatar).toBe('a.png');
    });

    test('removing the character during its read preserves the mounted conversation', async () => {
        const { box, requested, finish, characterData } = await nativeFixture();
        const loading = box.getChat({ characterId: 0, fileName: 'a-story' });
        await requested.promise;
        box.characters.splice(0, 1);
        box.this_chid = 0;
        finish(characterData);
        expect(await loading).toBe(false);
        expect(box.getCurrentChatId()).toBe('b-story');
        expect(box.mounted).toEqual(['Original B transcript']);
        expect(box.chat.map(value => value.mes)).toEqual(['Original B transcript']);
        expect(box.cancelDebouncedChatSave).not.toHaveBeenCalled();
    });

    test('a character removed during prompt-cache persistence cannot clear the current transcript', async () => {
        const { box, requested, finish, characterData } = await nativeFixture();
        const cacheStarted = deferred();
        const cache = deferred();
        box.saveItemizedPrompts.mockImplementationOnce(() => { cacheStarted.resolve(); return cache.promise; });
        const loading = box.getChat({ characterId: 0, fileName: 'a-story' });
        await requested.promise;
        finish(characterData);
        await cacheStarted.promise;
        box.characters.splice(0, 1);
        box.this_chid = 0;
        cache.resolve();
        expect(await loading).toBe(false);
        expect(box.mounted).toEqual(['Original B transcript']);
        expect(box.cancelDebouncedChatSave).not.toHaveBeenCalled();
    });

    test('a canonical group replacement invalidates the pending group read', async () => {
        const { box, group, requested, finish, groupData, writes } = await nativeFixture();
        const loading = box.getGroupChat('group');
        await requested.promise;
        const replacement = { ...group, chat_id: 'new-server-default' };
        box.groups = [replacement];
        finish(groupData);
        expect(await loading).toBe(false);
        expect(box.selected_group).toBeNull();
        expect(box.mounted).toEqual(['Original B transcript']);
        expect(replacement.chat_id).toBe('new-server-default');
        expect(writes).toHaveLength(0);
    });

    test('group replacement while clearing awaits its cache is checked before DOM mutation', async () => {
        const { box, group, requested, finish, groupData } = await nativeFixture();
        const cacheStarted = deferred();
        const cache = deferred();
        box.saveItemizedPrompts.mockImplementationOnce(() => { cacheStarted.resolve(); return cache.promise; });
        const loading = box.getGroupChat('group');
        await requested.promise;
        finish(groupData);
        await cacheStarted.promise;
        box.groups = [{ ...group }];
        cache.resolve();
        expect(await loading).toBe(false);
        expect(box.mounted).toEqual(['Original B transcript']);
        expect(box.cancelDebouncedChatSave).not.toHaveBeenCalled();
    });

    test('closing a story invalidates a held read even if its response ignores abort', async () => {
        const { box, requested, finish, characterData } = await nativeFixture();
        const loading = box.getChat({ characterId: 0, fileName: 'a-story' });
        const request = await requested.promise;
        expect(await box.closeCurrentChat()).toBe(true);
        expect(request.signal.aborted).toBe(true);
        finish(characterData);
        expect(await loading).toBe(false);
        expect(box.this_chid).toBeUndefined();
        expect(box.selected_group).toBeNull();
        expect(box.chat).toHaveLength(0);
        expect(box.mounted).toHaveLength(0);
    });

    test('fresh group greetings save only after installing generated integrity metadata', async () => {
        const { box, requested, finish, writes } = await nativeFixture();
        const loading = box.getGroupChat('group', false, { chatId: 'new-group-story' });
        await requested.promise;
        finish([]);
        expect(await loading).toBe(true);
        expect(writes).toEqual([{ metadata: { integrity: 'generated-integrity' }, messages: ['Synthetic group greeting'] }]);
    });
});

describe('exact workspace story transactions', () => {
    async function workspaceFixture(opened) {
        const { box } = await nativeFixture();
        box.event_types = { CHARACTER_RENAMED: 'character-renamed' };
        box.eventSource.on = jest.fn();
        box.accountStorage = { getItem: () => '[]' };
        box.openCharacterChat = jest.fn(async () => opened);
        box.openGroupChat = jest.fn(async () => opened);
        box.selectCharacterById = jest.fn();
        box.openGroupById = jest.fn();
        box.saveSettingsDebounced = jest.fn();
        const text = source('scripts/workspace-chats.js');
        const imports = new Map([...text.matchAll(/^import\s+{([^}]+)}\s+from\s+'([^']+)';/gm)].map(([, names, specifier]) => [specifier, names.split(',').map(name => name.trim()).filter(Boolean)]));
        const context = vm.createContext(box);
        const module = new vm.SourceTextModule(text, { context });
        await module.link(specifier => new vm.SyntheticModule(imports.get(specifier), function () {
            for (const name of imports.get(specifier)) this.setExport(name, box[name]);
        }, { context }));
        await module.evaluate();
        return { box, chats: new module.namespace.WorkspaceChats() };
    }

    test('a character historical-file open skips its default transcript', async () => {
        const { box, chats } = await workspaceFixture(true);
        await chats.open({ key: 'requested', avatar: 'a.png', file_name: 'historical' });
        expect(box.openCharacterChat).toHaveBeenCalledWith('historical', { characterId: 0 });
        expect(box.selectCharacterById).not.toHaveBeenCalled();
        expect(box.openGroupById).not.toHaveBeenCalled();
        expect(box.setActiveCharacter).toHaveBeenCalledWith('a.png');
        expect(box.saveSettingsDebounced).toHaveBeenCalledTimes(1);
    });

    test('a group historical-file open skips its default transcript', async () => {
        const { box, chats } = await workspaceFixture(true);
        await chats.open({ key: 'requested', group: 'group', file_name: 'historical' });
        expect(box.openGroupChat).toHaveBeenCalledWith('group', 'historical');
        expect(box.selectCharacterById).not.toHaveBeenCalled();
        expect(box.openGroupById).not.toHaveBeenCalled();
        expect(box.setActiveGroup).toHaveBeenCalledWith('group');
        expect(box.saveSettingsDebounced).toHaveBeenCalledTimes(1);
    });

    test('a failed exact-file open does not select an intermediate default or persist active settings', async () => {
        const { box, chats } = await workspaceFixture(false);
        await expect(chats.open({ key: 'requested', avatar: 'a.png', file_name: 'historical' })).rejects.toThrow('could not be opened');
        expect(box.openCharacterChat).toHaveBeenCalledTimes(1);
        expect(box.selectCharacterById).not.toHaveBeenCalled();
        expect(box.openGroupById).not.toHaveBeenCalled();
        expect(box.setActiveCharacter).not.toHaveBeenCalled();
        expect(box.setActiveGroup).not.toHaveBeenCalled();
        expect(box.saveSettingsDebounced).not.toHaveBeenCalled();
    });
});
