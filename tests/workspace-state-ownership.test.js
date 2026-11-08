/* eslint-disable playwright/no-standalone-expect -- This unit suite uses Jest test.each, not Playwright. */
import { describe, expect, jest, test } from '@jest/globals';
import fs from 'node:fs';
import vm from 'node:vm';

const source = file => fs.readFileSync(new URL(`../public/scripts/${file}`, import.meta.url), 'utf8');
const events = () => {
    const handlers = new Map();
    return {
        on(name, callback) { handlers.set(name, [...handlers.get(name) || [], callback]); },
        emit(name, ...args) { for (const callback of handlers.get(name) || []) callback(...args); },
    };
};
const event_types = new Proxy({}, { get: (_, name) => name });
const storage = () => {
    const data = new Map();
    return {
        data,
        get length() { return data.size; },
        key: index => [...data.keys()][index],
        getItem: key => data.get(key) ?? null,
        setItem: (key, value) => data.set(key, value),
        removeItem: key => data.delete(key),
    };
};

async function loadModule(file, mocks, globals = {}) {
    const context = vm.createContext({ console, Event, AbortController, File, setTimeout, clearTimeout, ...globals });
    const text = source(file);
    const imports = new Map([...text.matchAll(/^import\s+{([^}]+)}\s+from\s+'([^']+)';/gm)].map(([, names, specifier]) => [specifier, names.split(',').map(name => name.trim()).filter(Boolean)]));
    const module = new vm.SourceTextModule(text, { context });
    await module.link(specifier => {
        if (!mocks[specifier]) throw new Error(`Missing dependency stub: ${specifier}`);
        const exports = { ...Object.fromEntries(imports.get(specifier).map(name => [name, undefined])), ...mocks[specifier] };
        return new vm.SyntheticModule(Object.keys(exports), function () {
            for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
        }, { context });
    });
    await module.evaluate();
    return module.namespace;
}

class Node extends EventTarget {
    value = '';
    textContent = '';
    append() {}
    prepend() {}
    setAttribute() {}
    removeAttribute() {}
}

async function recoveryFixture() {
    const input = new Node();
    const nodes = [];
    const document = new Node();
    document.visibilityState = 'visible';
    document.getElementById = () => input;
    document.createElement = () => { const node = new Node(); nodes.push(node); return node; };
    const native = {
        captureChatViewport: () => null, characters: [{ avatar: 'old.png' }], eventSource: events(), event_types,
        getCurrentChatId: () => 'active', isGenerating: () => false, main_api: 'openai', online_status: 'Valid',
        refreshChatViewport: async () => {}, refreshServerConnection: async () => true, setOnlineStatus: jest.fn(), this_chid: 0,
    };
    const localStorage = storage();
    const refreshChatCompletionStatus = jest.fn().mockResolvedValue(null);
    const module = await loadModule('browser-recovery.js', {
        '../script.js': native, './group-chats.js': { selected_group: null },
        './openai.js': { getChatCompletionModel: () => 'model', oai_settings: { chat_completion_source: 'claude' }, refreshChatCompletionStatus },
        './power-user.js': { power_user: { restore_user_input: true } }, './user.js': { getCurrentUserHandle: () => 'current-user' },
    }, { document, window: new Node(), localStorage });
    module.initBrowserRecovery();
    return { input, nodes, document, native, localStorage, refreshChatCompletionStatus };
}

const draftId = (avatar, story, user = 'current-user', kind = 'character') => `st-recovery:draft:${JSON.stringify([user, kind, avatar, story])}`;
const saveDraft = (store, key, text) => store.setItem(key, JSON.stringify({ text }));

describe('character rename state ownership', () => {
    test('migrates active and inactive drafts for only this user and character', async () => {
        const { input, native, localStorage } = await recoveryFixture();
        input.value = 'Current unsent turn';
        input.dispatchEvent(new Event('input'));
        saveDraft(localStorage, draftId('old.png', 'inactive'), 'Other story draft');
        saveDraft(localStorage, draftId('old.png', 'foreign', 'another-user'), 'Foreign user');
        saveDraft(localStorage, draftId('old.png', 'cast', 'current-user', 'group'), 'Cast draft');
        const oldReply = 'st-recovery:reply:legacy';
        localStorage.setItem(oldReply, 'Existing assistant record');
        native.eventSource.emit(event_types.CHARACTER_DUPLICATED, { oldAvatar: 'old.png', newAvatar: 'duplicate.png' });
        expect(localStorage.getItem(draftId('duplicate.png', 'active'))).toBeNull();
        native.eventSource.emit(event_types.CHARACTER_RENAMED, 'old.png', 'new.png');
        native.characters[0].avatar = 'new.png';
        native.eventSource.emit(event_types.CHAT_CHANGED);
        expect(input.value).toBe('Current unsent turn');
        expect(JSON.parse(localStorage.getItem(draftId('new.png', 'inactive'))).text).toBe('Other story draft');
        expect(localStorage.getItem(draftId('old.png', 'inactive'))).toBeNull();
        expect(localStorage.getItem(draftId('old.png', 'foreign', 'another-user'))).toContain('Foreign user');
        expect(localStorage.getItem(draftId('old.png', 'cast', 'current-user', 'group'))).toContain('Cast draft');
        expect(localStorage.getItem(oldReply)).toBe('Existing assistant record');
    });

    test('keeps both records and reports a pre-existing destination draft', async () => {
        const { input, nodes, native, localStorage } = await recoveryFixture();
        input.value = 'Source draft';
        input.dispatchEvent(new Event('input'));
        saveDraft(localStorage, draftId('new.png', 'active'), 'Destination draft');
        native.eventSource.emit(event_types.CHARACTER_RENAMED, 'old.png', 'new.png');
        native.characters[0].avatar = 'new.png';
        native.eventSource.emit(event_types.CHAT_CHANGED);
        expect(input.value).toBe('Destination draft');
        expect(localStorage.getItem(draftId('old.png', 'active'))).toContain('Source draft');
        expect(localStorage.getItem(draftId('new.png', 'active'))).toContain('Destination draft');
        expect(nodes.some(node => node.textContent.includes('A draft already exists'))).toBe(true);
    });

    test('does not remove the source when persisting its new key fails', async () => {
        const { input, native, localStorage } = await recoveryFixture();
        input.value = 'Keep after quota failure';
        input.dispatchEvent(new Event('input'));
        localStorage.setItem = () => { throw new Error('Synthetic quota failure'); };
        native.eventSource.emit(event_types.CHARACTER_RENAMED, 'old.png', 'new.png');
        native.characters[0].avatar = 'new.png';
        native.eventSource.emit(event_types.CHAT_CHANGED);
        expect(input.value).toBe('Keep after quota failure');
        expect(localStorage.getItem(draftId('old.png', 'active'))).toContain('Keep after quota failure');
    });

    test('migrates archived character keys and coalesces only equivalent destinations', async () => {
        const accountStorage = storage();
        const eventSource = events();
        const id = (kind, avatar, file) => JSON.stringify([kind, avatar, file]);
        const original = [id('character', 'old.png', 'a'), id('character', 'old.png', 'b'), id('character', 'new.png', 'b'), id('group', 'old.png', 'a'), id('character', 'other.png', 'a')];
        accountStorage.setItem('workspaceArchivedChats', JSON.stringify(original));
        const module = await loadModule('workspace-chats.js', {
            '../script.js': { eventSource, event_types }, './group-chats.js': {},
            './util/AccountStorage.js': { accountStorage }, './utils.js': {},
        });
        new module.WorkspaceChats();
        eventSource.emit(event_types.CHARACTER_RENAMED, 'old.png', 'new.png');
        const migrated = JSON.parse(accountStorage.getItem('workspaceArchivedChats'));
        expect(migrated).toHaveLength(4);
        expect(migrated).toEqual(expect.arrayContaining([id('character', 'new.png', 'a'), id('character', 'new.png', 'b'), id('group', 'old.png', 'a'), id('character', 'other.png', 'a')]));
    });
});

describe('native connection response ownership', () => {
    // Isolate this native owner because the full provider module initializes the
    // application. Fetch, DOM effects and catalog writes are controlled seams.
    function statusFixture() {
        const text = source('openai.js');
        const start = text.indexOf('async function getStatusOpen(');
        const code = text.slice(start, text.indexOf('\n/** Foreground checks', start));
        const calls = [];
        const sources = Object.fromEntries(['CUSTOM', 'OPENAI', 'CLAUDE', 'AI21', 'VERTEXAI', 'PERPLEXITY', 'ZAI', 'MINIMAX'].map(name => [name, name.toLowerCase()]));
        const state = {
            oai_settings: { chat_completion_source: 'custom', custom_url: 'https://a.invalid/v1' }, main_api: 'openai',
            chat_completion_sources: sources, abortStatusCheck: new AbortController(), isValidUrl: () => true,
            substituteParams: value => value, $: () => ({ empty() {} }), console,
            setOnlineStatus: jest.fn(), updateFeatureSupportFlags: jest.fn(), resultCheckStatus: jest.fn(),
            stopStatusLoading: jest.fn(), saveModelList: jest.fn(), getRequestHeaders: () => ({}),
            online_status: 'Valid', t: parts => parts.join(''),
            fetch: jest.fn(() => new Promise(resolve => calls.push(resolve))),
        };
        vm.createContext(state);
        vm.runInContext(`let nativeStatusRequest = 0;\n${code}`, state);
        const reply = (index, data = { data: [{ id: 'same-model', context_length: 65536 }] }) => calls[index]({ ok: true, json: async () => data });
        return { state, reply };
    }

    test('discards old server metadata and releases its spinner after a URL edit', async () => {
        const { state, reply } = statusFixture();
        const request = state.getStatusOpen();
        state.oai_settings.custom_url = 'https://b.invalid/v1';
        reply(0);
        expect(await request).toBeNull();
        expect(state.saveModelList).not.toHaveBeenCalled();
        expect(state.setOnlineStatus).not.toHaveBeenCalledWith('Valid');
        expect(state.stopStatusLoading).toHaveBeenCalledTimes(1);
    });

    test('an obsolete same-settings Connect cannot replace a newer response or stop its spinner', async () => {
        const { state, reply } = statusFixture();
        const first = state.getStatusOpen();
        const second = state.getStatusOpen();
        reply(0);
        expect(await first).toBeNull();
        expect(state.stopStatusLoading).not.toHaveBeenCalled();
        expect(state.saveModelList).not.toHaveBeenCalled();
        reply(1);
        expect(await second).toBe(true);
        expect(state.saveModelList).toHaveBeenCalledTimes(1);
    });

    test('foreground verification does not supersede a native Connect or end its loading state', async () => {
        const { state, reply } = statusFixture();
        const connect = state.getStatusOpen();
        const foreground = state.getStatusOpen({ readOnly: true });
        reply(1);
        expect(await foreground).toBe(true);
        expect(state.resultCheckStatus).not.toHaveBeenCalled();
        expect(state.stopStatusLoading).not.toHaveBeenCalled();
        expect(state.saveModelList).not.toHaveBeenCalled();
        reply(0);
        expect(await connect).toBe(true);
        expect(state.saveModelList).toHaveBeenCalledTimes(1);
        expect(state.resultCheckStatus).toHaveBeenCalledTimes(1);
    });

    test('an older foreground failure cannot disconnect a newer successful native Connect', async () => {
        const { state, reply } = statusFixture();
        const foreground = state.getStatusOpen({ readOnly: true });
        const connect = state.getStatusOpen();
        reply(1);
        expect(await connect).toBe(true);
        expect(state.setOnlineStatus).toHaveBeenCalledWith('Valid');
        reply(0, { error: 'Synthetic delayed foreground failure' });
        expect(await foreground).toBeNull();
        expect(state.setOnlineStatus).not.toHaveBeenCalledWith('no_connection');
        expect(state.saveModelList).toHaveBeenCalledTimes(1);
    });

    test.each(['claude', 'ai21', 'vertexai', 'perplexity', 'zai', 'minimax'])('%s has no read-only verification, rather than a failed connection', async provider => {
        const { state } = statusFixture();
        state.oai_settings.chat_completion_source = provider;
        expect(await state.getStatusOpen({ readOnly: true })).toBeNull();
        expect(state.fetch).not.toHaveBeenCalled();
        expect(state.setOnlineStatus).not.toHaveBeenCalled();
    });

    test.each([[null, false], [false, true]])('foreground verification %s shows a failure only when supported verification failed', async (result, failure) => {
        const { nodes, document, refreshChatCompletionStatus } = await recoveryFixture();
        refreshChatCompletionStatus.mockResolvedValue(result);
        document.dispatchEvent(new Event('resume'));
        await new Promise(resolve => setImmediate(resolve));
        expect(refreshChatCompletionStatus).toHaveBeenCalledTimes(1);
        expect(nodes.some(node => node.textContent.includes('Check the model connection'))).toBe(failure);
    });
});

describe('workspace native load outcomes', () => {
    test.each(['character', 'group'])('%s selection rejects native failure without applying active settings', async kind => {
        const saveSettingsDebounced = jest.fn();
        const setActiveCharacter = jest.fn();
        const setActiveGroup = jest.fn();
        const module = await loadModule('workspace-chats.js', {
            '../script.js': {
                eventSource: events(), event_types, characters: [{ avatar: 'character.png' }],
                isGenerating: () => false, selectCharacterById: async () => false,
                saveSettingsDebounced, setActiveCharacter, setActiveGroup,
            },
            './group-chats.js': { openGroupById: async () => false },
            './util/AccountStorage.js': { accountStorage: storage() }, './utils.js': {},
        });
        const chats = new module.WorkspaceChats();
        await expect(chats.select({ kind, id: kind === 'group' ? 'group' : 'character.png' })).rejects.toThrow('could not be opened');
        expect(saveSettingsDebounced).not.toHaveBeenCalled();
        expect(setActiveCharacter).not.toHaveBeenCalled();
        expect(setActiveGroup).not.toHaveBeenCalled();
    });

    test.each(['character', 'group'])('%s exact-story open rejects native file-load failure', async kind => {
        const module = await loadModule('workspace-chats.js', {
            '../script.js': { eventSource: events(), event_types, characters: [{ avatar: 'character.png' }], isGenerating: () => false, getCurrentChatId: () => 'current', openCharacterChat: async () => false },
            './group-chats.js': { openGroupChat: async () => false },
            './util/AccountStorage.js': { accountStorage: storage() }, './utils.js': {},
        });
        const chats = new module.WorkspaceChats();
        chats.current = () => null;
        await expect(chats.open({ key: 'requested', group: kind === 'group' ? 'group' : '', avatar: 'character.png', file_name: 'requested' })).rejects.toThrow('could not be opened');
    });
});

describe('recorder callback ownership', () => {
    test('old stop, error and timer callbacks cannot clean a newer recording', async () => {
        const streams = [0, 1].map(() => ({ track: { stop: jest.fn() }, getTracks() { return [this.track]; } }));
        const recorders = [];
        const timers = [];
        class Recorder {
            static isTypeSupported() { return true; }
            constructor(stream) { this.stream = stream; this.state = 'inactive'; recorders.push(this); }
            start() { this.state = 'recording'; }
            stop() { this.state = 'inactive'; }
        }
        const module = await loadModule('dictation.js', {
            '../script.js': { getCurrentChatId: () => 'story' },
            './extensions.js': { extension_settings: { dictation: { endpoint: 'https://fixture.invalid', model: 'fixture' } }, getContext: () => ({ characterId: 0 }) },
            './workspace-views.js': {}, './audio-recording.js': {},
        }, {
            window: { isSecureContext: true, MediaRecorder: Recorder }, MediaRecorder: Recorder,
            navigator: { mediaDevices: { getUserMedia: jest.fn().mockResolvedValueOnce(streams[0]).mockResolvedValueOnce(streams[1]) } },
            setTimeout: callback => { timers.push(callback); return timers.length; }, clearTimeout: jest.fn(),
        });
        const dictation = new module.Dictation();
        dictation.sequence = 0;
        dictation.update = jest.fn();
        dictation.show = jest.fn();
        dictation.transcribe = jest.fn().mockResolvedValue();
        await dictation.toggle();
        dictation.cancel();
        await dictation.toggle();
        await recorders[0].onstop();
        recorders[0].onerror();
        timers[0]();
        expect(streams[1].track.stop).not.toHaveBeenCalled();
        expect(recorders[1].state).toBe('recording');
        expect(dictation.active).toBe(true);
        await dictation.toggle();
        recorders[1].mimeType = 'audio/webm';
        await recorders[1].onstop();
        expect(streams[1].track.stop).toHaveBeenCalled();
        expect(dictation.transcribe).toHaveBeenCalledTimes(1);
        expect(dictation.active).toBe(false);
    });
});
