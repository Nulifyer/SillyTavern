import fs from 'node:fs';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';

// Source execution only. No application server, browser storage, user data,
// provider, container or network is accessed. Every fetch below is a stub.
const sourceRef = process.argv[2] || '13005c03ee62b009fadbe208f78e8a793eacdc0a';
const read = file => sourceRef === 'worktree'
    ? fs.readFileSync(file, 'utf8')
    : execFileSync('git', ['show', `${sourceRef}:${file}`], { encoding: 'utf8' });
const results = [];
const isolated = async (name, check) => {
    try { results.push({ name, ...await check() }); }
    catch (error) { results.push({ name, executionError: error.message }); }
};

await isolated('character HTTP503 load initializes and saves a greeting', async () => {
    const source = read('public/script.js');
    const start = source.indexOf('export async function getChat()');
    const code = source.slice(start, source.indexOf('\nfunction getFirstMessage()', start)).replace('export ', '');
    const writes = [];
    const box = {
        characters: [{ name: 'Synthetic', avatar: 'synthetic.png', chat: 'protected-existing' }],
        this_chid: 0, chat: [], chat_metadata: {}, name2: 'Synthetic', console: { log() {} },
        fetch: async () => ({ ok: false, status: 503 }), unshallowCharacter: async () => {},
        getRequestHeaders: () => ({}), uuidv4: () => 'generated-integrity',
        getFirstMessage: () => ({ mes: 'Greeting only', name: 'Synthetic' }),
        saveChatConditional: async () => writes.push({ metadata: structuredClone(box.chat_metadata), messages: structuredClone(box.chat) }),
        loadItemizedPrompts: async () => {}, getCurrentChatId: () => 'protected-existing',
        printMessages: async () => {}, select_selected_character() {},
        eventSource: { emit: async () => {} }, event_types: {},
    };
    vm.createContext(box);
    vm.runInContext(code, box);
    await box.getChat();
    return { writes };
});

await isolated('group HTTP503 load initializes and saves greetings', async () => {
    const source = read('public/scripts/group-chats.js');
    const loadStart = source.indexOf('async function loadGroupChat(');
    const loader = source.slice(loadStart, source.indexOf('\n/**', loadStart));
    const getStart = source.indexOf('export async function getGroupChat(');
    const getter = source.slice(getStart, source.indexOf('\n/**', getStart)).replace('export ', '');
    const writes = [];
    const box = {
        groups: [{ id: 'synthetic-group', chat_id: 'protected-existing', members: ['synthetic.png'] }],
        characters: [{ avatar: 'synthetic.png' }], chat: [], chat_metadata: {}, console,
        fetch: async () => ({ ok: false, status: 503 }), getRequestHeaders: () => ({}),
        validateGroup: async () => {}, unshallowGroupMembers: async () => {},
        uuidv4: () => 'generated-integrity', loadItemizedPrompts: async () => {},
        getCurrentChatId: () => 'protected-existing',
        getFirstCharacterMessage: async () => ({ mes: 'Group greeting only' }),
        chatElement: { find: () => ({ remove() {} }) }, eventSource: { emit: async () => {} },
        event_types: {}, addOneMessage() {},
        saveGroupChat: async () => writes.push({ metadata: structuredClone(box.chat_metadata), messages: structuredClone(box.chat) }),
        updateChatMetadata(value) { box.chat_metadata = value; },
    };
    vm.createContext(box);
    vm.runInContext(`${loader}\n${getter}`, box);
    await box.getGroupChat('synthetic-group');
    return { writes };
});

await isolated('old recorder stop event stops a newer recording stream', async () => {
    const source = read('public/scripts/dictation.js');
    const code = source.slice(source.indexOf('function storyIdentity()')).replace('export class Dictation', 'class Dictation') + '\nthis.Dictation = Dictation;';
    const streams = [0, 1].map(id => ({
        id, track: { readyState: 'live', stop() { this.readyState = 'ended'; } },
        getTracks() { return [this.track]; },
    }));
    const recorders = [];
    let next = 0;
    class Recorder {
        static isTypeSupported() { return true; }
        constructor(stream) { this.stream = stream; this.state = 'inactive'; this.mimeType = 'audio/webm'; recorders.push(this); }
        start() { this.state = 'recording'; }
        stop() { this.state = 'inactive'; }
    }
    const box = {
        window: { isSecureContext: true, MediaRecorder: Recorder }, MediaRecorder: Recorder,
        navigator: { mediaDevices: { getUserMedia: async () => streams[next++] } },
        extension_settings: { dictation: { endpoint: 'https://synthetic.invalid/transcribe', model: 'fixture' } },
        getContext: () => ({ characterId: 0, groupId: null }), getCurrentChatId: () => 'fixture-story',
        setTimeout: () => 1, clearTimeout() {}, AbortController, File,
    };
    vm.createContext(box);
    vm.runInContext(code, box);
    const dictation = new box.Dictation();
    dictation.sequence = 0;
    dictation.update = () => {};
    dictation.show = () => {};
    await dictation.toggle();
    dictation.cancel();
    await dictation.toggle();
    const before = streams[1].track.readyState;
    await recorders[0].onstop();
    const after = streams[1].track.readyState;
    const newRecorderState = recorders[1].state;
    dictation.cancel();
    return { newStreamBeforeOldStop: before, newStreamAfterOldStop: after, newRecorderState };
});

await isolated('character rename strands its unsent draft', async () => {
    const source = read('public/scripts/browser-recovery.js');
    const identity = source.slice(source.indexOf('function identity('), source.indexOf('\nfunction providerIdentity('));
    const code = source.slice(source.indexOf('class BrowserRecovery')) + '\nthis.BrowserRecovery = BrowserRecovery;';
    const records = new Map();
    const box = {
        characters: [{ avatar: 'old.png' }], this_chid: 0, selected_group: null,
        getCurrentChatId: () => 'story', getCurrentUserHandle: () => 'synthetic',
        power_user: { restore_user_input: true }, Event,
        localStorage: { getItem: key => records.get(key) || null, setItem: (key, value) => records.set(key, value), removeItem: key => records.delete(key) },
    };
    vm.createContext(box);
    vm.runInContext(`${identity}\n${code}`, box);
    const recovery = new box.BrowserRecovery();
    recovery.key = vm.runInContext('identity()', box);
    recovery.memory = new Map();
    recovery.input = { value: 'Unsent turn survives renaming', dispatchEvent() {} };
    recovery.render = () => {};
    recovery.saveDraft();
    box.characters[0].avatar = 'renamed.png';
    recovery.changeChat();
    return { draftAfterRename: recovery.input.value, oldRecordsRetained: records.size };
});

await isolated('character rename makes archived stories active', async () => {
    const source = read('public/scripts/workspace-chats.js');
    const code = source.slice(source.indexOf('const archiveKey =')).replace('export class WorkspaceChats', 'class WorkspaceChats') + '\nthis.WorkspaceChats = WorkspaceChats;';
    const oldKey = JSON.stringify(['character', 'old.png', 'story']);
    const box = {
        characters: [{ avatar: 'old.png', name: 'Synthetic' }], groups: [],
        accountStorage: { getItem: () => JSON.stringify([oldKey]) }, getRequestHeaders: () => ({}),
        fetch: async () => ({ ok: true, json: async () => [{ avatar: box.characters[0].avatar, file_name: 'story.jsonl', last_mes: 0 }] }),
        timestampToMoment: () => ({ valueOf: () => 0 }),
    };
    vm.createContext(box);
    vm.runInContext(code, box);
    const chats = new box.WorkspaceChats();
    const before = (await chats.list())[0].archived;
    box.characters[0].avatar = 'renamed.png';
    const after = (await chats.list())[0].archived;
    return { archivedBeforeRename: before, archivedAfterRename: after };
});

await isolated('normal status response is accepted after its server URL changes', async () => {
    const source = read('public/scripts/openai.js');
    const start = source.indexOf('async function getStatusOpen(');
    const code = source.slice(start, source.indexOf('\n/** Foreground checks', start));
    let resolve;
    const response = new Promise(fulfill => { resolve = fulfill; });
    const applied = [];
    const box = {
        oai_settings: { chat_completion_source: 'custom', custom_url: 'https://server-a.invalid/v1', custom_model: 'same-model', custom_context_auto: true },
        main_api: 'openai', chat_completion_sources: { CUSTOM: 'custom', OPENAI: 'openai' },
        abortStatusCheck: new AbortController(), isValidUrl: () => true, substituteParams: value => value,
        $: () => ({ empty() {} }), setOnlineStatus(value) { box.online_status = value; },
        online_status: 'Valid', getRequestHeaders: () => ({}), fetch: () => response,
        saveModelList(models) { applied.push({ currentUrl: box.oai_settings.custom_url, metadata: models }); },
        updateFeatureSupportFlags() {}, resultCheckStatus() {}, console, t: parts => parts.join(''),
    };
    vm.createContext(box);
    vm.runInContext(code, box);
    const request = box.getStatusOpen();
    box.oai_settings.custom_url = 'https://server-b.invalid/v1';
    resolve({ ok: true, json: async () => ({ data: [{ id: 'same-model', context_length: 65536 }] }) });
    await request;
    return { applied };
});

console.log(JSON.stringify({ sourceRef, checks: results }, null, 2));
