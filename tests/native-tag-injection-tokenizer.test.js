/* eslint-disable playwright/no-standalone-expect, playwright/prefer-web-first-assertions -- Jest exercises native state owners with controlled I/O. */
import { describe, expect, jest, test } from '@jest/globals';
import fs from 'node:fs';
import vm from 'node:vm';
import { parse } from 'acorn';
import { TextEncoder } from 'node:util';

const source = file => fs.readFileSync(new URL(`../public/scripts/${file}`, import.meta.url), 'utf8');
const deferred = () => { let resolve; const promise = new Promise(done => resolve = done); return { promise, resolve }; };
function nativeFunction(file, name) {
    const text = source(file);
    const node = parse(text, { ecmaVersion: 'latest', sourceType: 'module' }).body.map(node => node.declaration || node).find(node => node.type === 'FunctionDeclaration' && node.id.name === name);
    return text.slice(node.start, node.end);
}

describe('native tag membership removal', () => {
    test.each([['absent', false, ['assigned', 'last']], ['assigned', true, ['last']]])('removing %s preserves every other assignment', (id, removed, remaining) => {
        const context = vm.createContext({ tag_map: { avatar: ['assigned', 'last'] }, getTagKeyForEntity: value => value, getTagKey: () => 'avatar' });
        vm.runInContext(nativeFunction('tags.js', 'removeTagFromMap') + '\nthis.remove = removeTagFromMap;', context);
        expect(context.remove(id, 'avatar')).toBe(removed); expect([...context.tag_map.avatar]).toEqual(remaining);
    });
});

function injections() {
    const events = new Map(); const metadata = { script_injects: {} };
    const context = vm.createContext({
        chat_metadata: metadata, SCRIPT_PROMPT_KEY: 'script_inject_', identity: 'story-a', load: {},
        getCurrentChatIdentity: () => context.identity, getChatLoadToken: () => context.load,
        extension_prompt_types: { BEFORE_PROMPT: 0, IN_PROMPT: 1, IN_CHAT: 2, NONE: -1 }, extension_prompt_roles: { SYSTEM: 0, USER: 1, ASSISTANT: 2 },
        isTrueBoolean: value => value === 'true', SlashCommandClosure: class {}, setExtensionPrompt: jest.fn(), saveMetadataDebounced: jest.fn(), console: { log: jest.fn() },
        event_types: { GENERATION_ENDED: 'ended', GENERATION_STOPPED: 'stopped', CHAT_CHANGED: 'chat' },
        eventSource: {
            on(event, listener) { if (!events.has(event)) events.set(event, new Set()); events.get(event).add(listener); },
            removeListener(event, listener) { events.get(event)?.delete(listener); },
        },
    });
    vm.runInContext(nativeFunction('slash-commands.js', 'injectCallback') + '\nthis.inject = injectCallback;', context);
    return { context, metadata, events, emit(event) { for (const listener of [...(events.get(event) || [])]) listener(); } };
}

describe('native ephemeral injection ownership', () => {
    test('an older ephemeral handler cannot delete a persistent replacement with the same ID', () => {
        const f = injections(); f.context.inject({ id: 'same', ephemeral: true }, 'Old ephemeral'); f.context.inject({ id: 'same' }, 'Persistent replacement');
        f.emit('ended'); f.emit('stopped');
        expect(f.metadata.script_injects.same.value).toBe('Persistent replacement');
        expect(f.context.setExtensionPrompt).toHaveBeenCalledTimes(2);
        expect([...f.events.values()].every(listeners => listeners.size === 0)).toBe(true);
    });
    test('a replacement ephemeral injection clears once and removes both generation listeners', () => {
        const f = injections(); f.context.inject({ id: 'same', ephemeral: true }, 'First'); f.context.inject({ id: 'same', ephemeral: true }, 'Second');
        f.emit('stopped'); f.emit('ended');
        expect(f.metadata.script_injects.same).toBeUndefined(); expect(f.context.setExtensionPrompt).toHaveBeenCalledTimes(3);
        expect([...f.events.values()].every(listeners => listeners.size === 0)).toBe(true);
    });
    test.each(['story', 'load', 'metadata', 'entry'])('a changed %s rejects stale cleanup', change => {
        const f = injections(); f.context.inject({ id: 'same', ephemeral: true }, 'Original');
        if (change === 'story') f.context.identity = 'story-b';
        if (change === 'load') f.context.load = {};
        if (change === 'metadata') f.context.chat_metadata = { script_injects: { same: { value: 'Other metadata' } } };
        if (change === 'entry') f.metadata.script_injects.same = { value: 'Newer entry' };
        f.emit('ended');
        expect(f.context.chat_metadata.script_injects.same).toBeDefined(); expect(f.context.setExtensionPrompt).toHaveBeenCalledTimes(1);
    });
    test('chat change detaches old callbacks without modifying a new story', () => {
        const f = injections(); f.context.inject({ id: 'same', ephemeral: true }, 'Original'); f.emit('chat');
        f.context.chat_metadata = { script_injects: { same: { value: 'New story' } } }; f.emit('ended');
        expect(f.context.chat_metadata.script_injects.same.value).toBe('New story');
        expect([...f.events.values()].every(listeners => listeners.size === 0)).toBe(true);
    });
});

async function tokenizerFixture() {
    const ajax = jest.fn(), store = { getItem: jest.fn(async () => null), setItem: jest.fn(async () => {}) };
    const power = { tokenizer: 3, token_padding: 64 }, settings = { chat_completion_source: 'openai', openai_model: 'model-a' }, textgen = { type: 'ooba', model: 'remote-a', server: 'http://synthetic-a.invalid' };
    const characters = [{ avatar: 'synthetic.png', chat: 'story-a' }];
    const exports = {
        localforage: { createInstance: () => store }, characters, event_types: {}, eventSource: {}, main_api: 'textgenerationwebui', nai_settings: {}, online_status: 'connected', this_chid: 0,
        power_user: power, registerDebugFunction() {}, chat_completion_sources: { OPENAI: 'openai', CLAUDE: 'claude' }, model_list: [], oai_settings: settings,
        groups: [], selected_group: null, getStringHash: value => String(value), kai_flags: {}, kai_settings: { api_server: 'http://synthetic-kobold.invalid' },
        textgen_types: { OOBA: 'ooba' }, textgenerationwebui_settings: textgen, getTextGenServer: () => textgen.server, getTextGenModel: () => textgen.model,
        getCurrentDreamGenModelTokenizer() {}, getCurrentOpenRouterModelTokenizer() {}, openRouterModels: [],
    };
    const context = vm.createContext({ TextEncoder, structuredClone, jQuery: { ajax }, console: { debug: jest.fn(), log: jest.fn(), warn: jest.fn(), error: jest.fn() }, sessionStorage: { getItem: () => null, setItem() {} } });
    const module = new vm.SourceTextModule(source('tokenizers.js'), { context });
    await module.link(() => new vm.SyntheticModule(Object.keys(exports), function () { for (const [name, value] of Object.entries(exports)) this.setExport(name, value); }, { context }));
    await module.evaluate();
    return { api: module.namespace, ajax, store, power, settings, textgen, characters };
}

describe('native async tokenizer completion and cache ownership', () => {
    test.each([3, 9, 10, 6])('tokenizer %s rejects HTTP503 promptly and a retry is not poisoned by failure', async type => {
        const f = await tokenizerFixture(); f.power.tokenizer = type;
        f.ajax.mockRejectedValueOnce({ status: 503 }).mockResolvedValue({ count: 7 });
        await expect(f.api.getTokenCountAsync('Neutral unique text')).rejects.toThrow('Token counting failed (HTTP 503)');
        await expect(f.api.getTokenCountAsync('Neutral unique text')).resolves.toBe(7); expect(f.ajax).toHaveBeenCalledTimes(2);
    });
    test('a network error rejects with readable guidance', async () => {
        const f = await tokenizerFixture(); f.ajax.mockRejectedValue({ status: 0 });
        await expect(f.api.getTokenCountAsync('Neutral text')).rejects.toThrow('network error');
    });
    test.each([undefined, -1, NaN, '7'])('invalid token count %s rejects and never becomes a successful cache hit', async count => {
        const f = await tokenizerFixture(); f.ajax.mockResolvedValueOnce({ count }).mockResolvedValue({ count: 7 });
        await expect(f.api.getTokenCountAsync('Neutral text')).rejects.toThrow('invalid token count');
        await expect(f.api.getTokenCountAsync('Neutral text')).resolves.toBe(7); expect(f.ajax).toHaveBeenCalledTimes(2);
    });
    test('remote provider/model/server cache identity is captured independently for each call', async () => {
        const f = await tokenizerFixture(); f.power.tokenizer = 6; const gate = deferred(); f.ajax.mockReturnValueOnce(gate.promise).mockResolvedValue({ count: 20 });
        const pending = f.api.getTokenCountAsync('Same neutral text'); f.textgen.server = 'http://synthetic-b.invalid'; f.textgen.model = 'remote-b'; gate.resolve({ count: 10 });
        expect(await pending).toBe(10); expect(await f.api.getTokenCountAsync('Same neutral text')).toBe(20); expect(f.ajax).toHaveBeenCalledTimes(2);
        expect(JSON.parse(f.ajax.mock.calls[0][0].data)).toMatchObject({ url: 'http://synthetic-a.invalid', model: 'remote-a' });
        expect(JSON.parse(f.ajax.mock.calls[1][0].data)).toMatchObject({ url: 'http://synthetic-b.invalid', model: 'remote-b' });
    });
    test('multi-message counts pin model, cache owner, full-count semantics and message contents before awaiting', async () => {
        const f = await tokenizerFixture(); const gate = deferred(); f.ajax.mockReturnValueOnce(gate.promise).mockResolvedValue({ token_count: 13 });
        const messages = [{ content: 'First' }, { content: 'Original second' }];
        const pending = f.api.countTokensOpenAIAsync(messages);
        f.settings.openai_model = 'model-b'; f.settings.chat_completion_source = 'claude'; f.characters[0].chat = 'story-b'; messages[1].content = 'Changed second'; gate.resolve({ token_count: 11 });
        expect(await pending).toBe(22);
        expect(f.ajax.mock.calls.map(([request]) => request.url)).toEqual(['/api/tokenizers/openai/count?model=model-a', '/api/tokenizers/openai/count?model=model-a']);
        expect(JSON.parse(f.ajax.mock.calls[1][0].data)).toEqual([{ content: 'Original second' }]);
        await f.api.saveTokenCache(); const cache = f.store.setItem.mock.calls.at(-1)[1]; expect(Object.keys(cache)).toEqual(['story-a']);
        f.settings.chat_completion_source = 'openai'; f.settings.openai_model = 'model-a'; f.characters[0].chat = 'story-a';
        expect(await f.api.countTokensOpenAIAsync([{ content: 'First' }, { content: 'Original second' }], true)).toBe(24); expect(f.ajax).toHaveBeenCalledTimes(2);
        f.settings.openai_model = 'model-b'; f.characters[0].chat = 'story-b';
        expect(await f.api.countTokensOpenAIAsync([{ content: 'First' }, { content: 'Original second' }], true)).toBe(26); expect(f.ajax).toHaveBeenCalledTimes(4);
    });
});
