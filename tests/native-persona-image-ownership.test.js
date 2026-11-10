/* eslint-disable playwright/no-standalone-expect, playwright/prefer-web-first-assertions -- Jest runs actual native owners with controlled I/O. */
import { describe, expect, jest, test } from '@jest/globals';
import fs from 'node:fs';
import vm from 'node:vm';
import { parse } from 'acorn';
const read = name => fs.readFileSync(new URL(`../public/scripts/${name}`, import.meta.url), 'utf8');
const gate = () => { let resolve; const promise = new Promise(done => resolve = done); return { promise, resolve }; };
function functions(file, names) {
    const source = read(file); return parse(source, { ecmaVersion: 'latest', sourceType: 'module' }).body.map(node => node.declaration || node).filter(node => node.type === 'FunctionDeclaration' && names.includes(node.id.name)).map(node => source.slice(node.start, node.end)).join('\n');
}
function persona() {
    const context = vm.createContext({
        owner: 'actor-a/same-file', load: {}, personaLastLoadedChat: null, personaLoadRequest: 0, personaSelectionRevision: 0,
        getCurrentChatIdentity: () => context.owner, getChatLoadToken: () => context.load,
        power_user: { personas: { 'a.png': 'Persona A', 'b.png': 'Persona B' }, persona_descriptions: {}, persona_auto_lock: false, persona_show_notifications: false, default_persona: null },
        user_avatar: 'a.png', chat_metadata: {}, name1: 'Persona A', chat: [{ is_user: true, mes: 'Original turn', name: 'Original name', force_avatar: 'Original.png' }],
        getUserAvatars: jest.fn(async () => ['a.png', 'b.png']), getConnectedPersonas: () => [context.owner.startsWith('actor-a') ? 'a.png' : 'b.png'],
        setUserAvatar: jest.fn(async avatar => { context.personaSelectionRevision++; context.user_avatar = avatar; }),
        updatePersonaUIStates: jest.fn(), saveSettingsDebounced: jest.fn(), getThumbnailUrl: (_type, avatar) => avatar,
        saveChatConditional: jest.fn(async () => true), reloadCurrentChat: jest.fn(async () => {}),
        equalsIgnoreCaseAndAccents: (a, b) => a === b, Popup: { show: { confirm: jest.fn(async () => true) } },
        toastr: { error: jest.fn(), info: jest.fn(), success: jest.fn() }, console: { log() {}, warn() {} }, t: strings => strings.join(''),
    });
    vm.runInContext(functions('personas.js', ['loadPersonaForCurrentChat', 'syncUserNameToPersona']) + '\nthis.loadPersona = loadPersonaForCurrentChat; this.syncPersona = syncUserNameToPersona;', context);
    return context;
}

describe('native persona load and synchronization ownership', () => {
    test('same filenames under different actor identities do not share the successful load cache', async () => {
        const f = persona(); await f.loadPersona(); f.owner = 'actor-b/same-file'; await f.loadPersona(); expect(f.user_avatar).toBe('b.png');
    });
    test('a failed avatar list is not cached and retry for the same load succeeds', async () => {
        const f = persona(); f.owner = 'actor-b/same-file'; f.getUserAvatars.mockResolvedValueOnce(null);
        expect(await f.loadPersona()).toBe(false); expect(f.personaLastLoadedChat).toBeNull(); expect(f.user_avatar).toBe('a.png');
        expect(await f.loadPersona()).toBe(true); expect(f.user_avatar).toBe('b.png');
    });
    test('a newer native load invalidates an older avatar response', async () => {
        const f = persona(), delayed = gate(); f.getUserAvatars.mockReturnValueOnce(delayed.promise); const old = f.loadPersona();
        f.owner = 'actor-b/same-file'; f.load = {}; await f.loadPersona(); delayed.resolve(['a.png', 'b.png']);
        expect(await old).toBe(false); expect(f.user_avatar).toBe('b.png');
    });
    test('a manual selection revision supersedes a held automatic load', async () => {
        const f = persona(), delayed = gate(); f.owner = 'actor-b/same-file'; f.getUserAvatars.mockReturnValue(delayed.promise); const pending = f.loadPersona(); f.personaSelectionRevision++;
        delayed.resolve(['a.png', 'b.png']); expect(await pending).toBe(false); expect(f.setUserAvatar).not.toHaveBeenCalled();
    });
    test.each(['story', 'load', 'message', 'name', 'avatar'])('a changed %s prevents held sync from touching or saving the newer state', async change => {
        const f = persona(), delayed = gate(); f.Popup.show.confirm.mockReturnValue(delayed.promise); const pending = f.syncPersona();
        if (change === 'story') f.owner = 'actor-b/other'; if (change === 'load') f.load = {};
        if (change === 'message') f.chat[0].mes = 'A newer canonical turn'; if (change === 'name') f.name1 = 'A newer user name'; if (change === 'avatar') f.user_avatar = 'b.png';
        delayed.resolve(true); expect(await pending).toBe(false); expect(f.chat[0].name).toBe('Original name'); expect(f.saveChatConditional).not.toHaveBeenCalled();
    });
    test('same-owner sync updates exactly the chosen messages and uses the native save acknowledgment', async () => {
        const f = persona(); expect(await f.syncPersona({ quiet: true })).toBe(true); expect(f.chat[0].name).toBe('Persona A'); expect(f.chat[0].force_avatar).toBe('a.png'); expect(f.saveChatConditional).toHaveBeenCalledWith({ expectedIdentity: f.owner }); expect(f.reloadCurrentChat).toHaveBeenCalledTimes(1);
    });
    test('failed sync persistence does not reload over its unsaved edits', async () => {
        const f = persona(); f.saveChatConditional.mockResolvedValue(false); expect(await f.syncPersona({ quiet: true })).toBe(false); expect(f.reloadCurrentChat).not.toHaveBeenCalled();
    });
});

async function image() {
    const source = read('extensions/stable-diffusion/index.js'); const listeners = new Map();
    const events = { CHAT_CHANGED: 'chat', MESSAGE_EDITED: 'edited', MESSAGE_DELETED: 'deleted', MESSAGE_SWIPED: 'swiped', PERSONA_CHANGED: 'persona', SD_PROMPT_PROCESSING: 'prompt' };
    const eventSource = { on: (type, listener) => listeners.set(type, [...(listeners.get(type) || []), listener]), removeListener: (type, listener) => listeners.set(type, (listeners.get(type) || []).filter(value => value !== listener)), emit: async (type, ...args) => { for (const listener of listeners.get(type) || []) await listener(...args); } };
    const registrations = [];
    const context = { name1: 'User', characterId: 0, characters: [{ avatar: 'synthetic.png', name: 'Synthetic' }], groups: [], groupId: null, chat: [{ mes: 'Original', name: 'Synthetic', extra: { media: [{ url: '/first.png' }, { url: '/second.png' }], media_index: 0 } }] };
    let load = {}, editor = null; const extension_settings = { sd: {} }, fetch = jest.fn(async () => ({ ok: true, json: async () => ({ images: ['synthetic'] }) }));
    const values = {
        ToolManager: { registerFunctionTool: tool => registrations.push(tool), unregisterFunctionTool() {} }, event_types: events, eventSource, extension_settings, getContext: () => context, getCurrentChatIdentity: () => 'actor/same-file', getChatLoadToken: () => load,
        this_chid: 0, selected_group: null, user_avatar: 'user.png', getRequestHeaders: () => ({}), saveSettingsDebounced: jest.fn(),
        getCharaFilename: () => 'synthetic', substituteParams: value => value, substituteParamsExtended: value => value,
        isTrueBoolean: value => value === true || value === 'true', isFalseBoolean: value => value === false || value === 'false', debounce: value => value,
        ActionLoaderHandle: { EMPTY: { hide: async () => {} } }, loader: { show: () => ({ hide: async () => {} }) },
        MEDIA_TYPE: { IMAGE: 'image' }, MEDIA_SOURCE: { GENERATED: 'generated' }, MEDIA_DISPLAY: { GALLERY: 'gallery' }, VIDEO_EXTENSIONS: [],
        stringFormat: value => value, humanizedDateTime: () => 'synthetic-time', saveBase64AsFile: jest.fn(async () => '/synthetic-result.png'), oai_settings: {}, secret_state: {}, SECRET_KEYS: {}, modules: [],
    };
    const scope = vm.createContext({ AbortController, DOMException, URL, structuredClone, fetch, console: { log() {}, warn() {}, error() {}, trace() {} }, toastr: { info() {}, error() {}, clear() {} }, document: { querySelector: selector => selector === '#curEditTextarea' ? editor : null } });
    const exports = ['defaultSettings', 'generatePicture', 'createImageOperation', 'applyCommandArguments', 'captureImageOptions', 'markImageSettingEdited', 'loadAutoModels', 'generateSdcppImage', 'generateAutoImage', 'generateOpenAiImage', 'generateComfyImage', 'generateElectronHubImage', 'getGenerationType', 'getQuietPrompt', 'registerFunctionTool'];
    const module = new vm.SourceTextModule(source + `\nexport { ${exports.join(', ')} };`, { context: scope });
    const imports = new Map([...source.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g)].map(match => [match[2], match[1].split(',').map(name => name.trim()).filter(Boolean)]));
    await module.link(specifier => new vm.SyntheticModule(imports.get(specifier), function () { for (const name of imports.get(specifier)) this.setExport(name, values[name] ?? (() => {})); }, { context: scope })); await module.evaluate();
    extension_settings.sd = structuredClone(module.namespace.defaultSettings); Object.assign(extension_settings.sd, { source: 'sdcpp', enabled: true, sdcpp_url: 'https://synthetic.invalid', model: 'cpp-A', sampler: 'Euler', width: 768, height: 512, seed: 42, refine_mode: false, snap: false });
    return { api: module.namespace, registrations, settings: extension_settings.sd, extension_settings, context, events, eventSource, listeners, fetch, reload() { load = {}; }, edit(value) { editor = value; } };
}

describe('native image request snapshots and loaded message ownership', () => {
    test.each(['load', 'message', 'media', 'selection', 'edit draft', 'replacement'])('a changed %s invalidates the originating image operation', async change => {
        const f = await image(), operation = f.api.createImageOperation();
        if (change === 'load') f.reload(); if (change === 'message') f.context.chat[0].mes = 'Newer turn'; if (change === 'media') f.context.chat[0].extra.media[0].url = '/newer.png';
        if (change === 'selection') f.context.chat[0].extra.media_index = 1; if (change === 'edit draft') f.edit({ value: 'A newer unconfirmed edit' }); if (change === 'replacement') f.context.chat[0] = structuredClone(f.context.chat[0]);
        expect(() => operation.check()).toThrow(); expect(operation.signal.aborted).toBe(true); operation.dispose(); expect([...f.listeners.values()].every(listeners => !listeners.length)).toBe(true);
    });
    test('only explicit owned publication advances the canonical message snapshot', async () => {
        const f = await image(), operation = f.api.createImageOperation(); f.context.chat.push({ mes: 'Owned publication' }); operation.acceptChatChange(); f.context.chat.at(-1).swipe_id = 0; expect(() => operation.check()).not.toThrow(); operation.dispose();
    });
    test('request-local extend, multimodal and prompt settings determine generation mode', async () => {
        const f = await image(); const owned = { ...structuredClone(f.settings), free_extend: true, multimodal_captioning: true }; owned.prompts[11] = 'Owned prompt table';
        expect(f.api.getGenerationType('A neutral book', owned)).toBe(11); expect(f.api.getGenerationType('face', owned)).toBe(10); expect(f.api.getQuietPrompt(11, 'A neutral book', owned)).toBe('Owned prompt table');
        expect(f.settings.free_extend).toBe(false); expect(f.settings.multimodal_captioning).toBe(false);
    });
    test('command parsing never writes generation overrides to user preferences', async () => {
        const f = await image(); const before = structuredClone(f.settings); expect(f.api.applyCommandArguments({ width: '640', seed: '1', steps: '5' })).toEqual({ width: 640, seed: 1, steps: 5 }); expect(f.settings).toEqual(before);
    });
    test('two overlapping generation requests retain their own parameters and newer preferences', async () => {
        const f = await image(), first = gate(), second = gate(); const bodies = [];
        f.fetch.mockImplementation((_url, request) => { bodies.push(JSON.parse(request.body)); return bodies.length === 1 ? first.promise : second.promise; });
        const a = f.api.generatePicture('command', { quiet: 'true' }, 'Neutral A', undefined, undefined, { settings: { width: 640, seed: 1 } });
        const b = f.api.generatePicture('command', { quiet: 'true' }, 'Neutral B', undefined, undefined, { settings: { width: 832, seed: 2 } });
        for (let i = 0; i < 12 && bodies.length < 2; i++) await Promise.resolve();
        expect(bodies.map(body => [body.width, body.seed])).toEqual([[640, 1], [832, 2]]); expect(f.settings.width).toBe(768); expect(f.settings.seed).toBe(42);
        f.settings.width = 1024; f.settings.seed = 99; second.resolve({ ok: true, json: async () => ({ images: ['second'] }) }); first.resolve({ ok: true, json: async () => ({ images: ['first'] }) });
        await Promise.all([a, b]); expect(f.settings.width).toBe(1024); expect(f.settings.seed).toBe(99);
    });
    test('inner model discovery returns owned data without changing later preferences', async () => {
        const f = await image(), delayed = gate(); f.settings.auto_url = 'https://auto-A.invalid'; const body = { url: f.settings.auto_url }; f.fetch.mockReturnValueOnce(delayed.promise).mockResolvedValue({ ok: true, json: async () => ['Owned option'] });
        const pending = f.api.loadAutoModels(body); f.settings.source = 'sdcpp'; f.settings.model = 'Newer CPP selection'; delayed.resolve({ ok: true, text: async () => 'Old remote model' });
        const result = await pending; expect(result.model).toBe('Old remote model'); expect(f.settings.model).toBe('Newer CPP selection'); expect(f.fetch.mock.calls.every(([, request]) => JSON.parse(request.body).url === body.url)).toBe(true);
    });
    test('option publication rejects ABA native selections and provider changes', async () => {
        const f = await image(), current = f.api.captureImageOptions('model'); expect(current()).toBe(true); f.api.markImageSettingEdited('model'); expect(current()).toBe(false);
        const provider = f.api.captureImageOptions('model'); f.settings.sdcpp_url = 'https://new-provider.invalid'; expect(provider()).toBe(false);
    });
    test.each(['generateSdcppImage', 'generateAutoImage', 'generateOpenAiImage'])('%s builds its request from the explicit operation configuration', async name => {
        const f = await image(), owned = structuredClone(f.settings), stop = new Error('Captured request'); owned.source = 'auto'; owned.auto_url = 'https://owned-A.invalid'; owned.model = name === 'generateOpenAiImage' ? 'dall-e-3' : 'owned-model-A'; f.settings.model = 'newer-model-B'; f.fetch.mockRejectedValue(stop);
        const signal = new AbortController().signal;
        await expect(name === 'generateOpenAiImage' ? f.api[name]('Neutral', signal, owned) : f.api[name]('Neutral', '', signal, owned)).rejects.toBe(stop);
        const body = JSON.parse(f.fetch.mock.calls[0][1].body);
        expect(body).toMatchObject(name === 'generateAutoImage' ? { url: owned.auto_url, width: owned.width, seed: owned.seed } : { model: owned.model });
    });
    test('native GenerateImage tool rejects a failed provider result instead of returning undefined as success', async () => {
        const f = await image(); f.settings.function_tool = true; f.api.registerFunctionTool(); f.fetch.mockResolvedValue({ ok: false, text: async () => 'Synthetic provider unavailable' });
        await expect(f.registrations[0].action({ prompt: 'A neutral book' })).rejects.toThrow('Image generation failed. No image was created.'); expect(f.fetch).toHaveBeenCalledTimes(1);
    });
    test('Comfy preparation pins workflow, custom replacements and server through its await', async () => {
        const f = await image(), delayed = gate(), stop = new Error('Captured generation'); const owned = { ...structuredClone(f.settings), source: 'comfy', comfy_url: 'https://owned-A.invalid', comfy_workflow: 'A.json', comfy_placeholders: [{ find: 'custom', replace: 'Owned A' }] };
        f.fetch.mockReturnValueOnce(delayed.promise).mockRejectedValue(stop);
        const pending = f.api.generateComfyImage('Neutral', '', new AbortController().signal, owned); f.settings.comfy_workflow = 'B.json'; f.settings.comfy_url = 'https://newer-B.invalid'; delayed.resolve({ ok: true, json: async () => '{"text":"%custom%","width":"%width%"}' });
        await expect(pending).rejects.toBe(stop); expect(JSON.parse(f.fetch.mock.calls[0][1].body).file_name).toBe('A.json'); const body = JSON.parse(f.fetch.mock.calls[1][1].body); expect(body.url).toBe('https://owned-A.invalid'); expect(body.prompt).toContain('Owned A');
    });
});
