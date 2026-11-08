import { jest } from '@jest/globals';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/scripts/extensions/stable-diffusion/index.js', import.meta.url), 'utf8');
const deferred = () => {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
};

// Execute the native extension with controlled imports; no app, provider or file I/O runs.
async function fixture() {
    const listeners = new Map();
    const eventSource = {
        on: (name, handler) => listeners.set(name, [...(listeners.get(name) ?? []), handler]),
        removeListener: (name, handler) => listeners.set(name, (listeners.get(name) ?? []).filter(value => value !== handler)),
        emit: async (name, ...args) => { for (const handler of [...(listeners.get(name) ?? [])]) await handler(...args); },
    };
    const event_types = { CHAT_CHANGED: 'chat', MESSAGE_RECEIVED: 'received', CHARACTER_MESSAGE_RENDERED: 'rendered', SD_PROMPT_PROCESSING: 'prompt', FORCE_SET_BACKGROUND: 'background' };
    let context = {
        characterId: 0, groupId: null, name2: 'Synthetic',
        characters: [{ name: 'Synthetic', avatar: 'first.png' }], groups: [], chat: [],
        addOneMessage: jest.fn(), saveChat: jest.fn(async () => {}), scrollOnMediaLoad: jest.fn(),
    };
    const loaders = [];
    const extension_settings = { sd: {} };
    const writer = jest.fn(async () => ({ content: 'A lantern in the forest.' }));
    const caption = jest.fn(async () => 'A captioned lantern.');
    const quiet = jest.fn(async () => 'A quiet lantern prompt.');
    const upload = jest.fn(async () => '/images/synthetic.png');
    const fetch = jest.fn(async () => ({ ok: true, json: async () => ({ images: ['synthetic-base64'] }) }));
    const toastr = Object.fromEntries(['info', 'warning', 'error', 'clear'].map(key => [key, jest.fn()]));
    const values = {
        eventSource, event_types, extension_settings,
        debounce: value => value, debounce_timeout: { short: 1, relaxed: 1 },
        getContext: () => context, getCurrentChatId: () => 'same-story',
        this_chid: 0, selected_group: null, getRequestHeaders: () => ({}),
        ConnectionManagerRequestService: { sendRequest: writer, getProfile: () => ({ api: 'custom' }) },
        generateQuietPrompt: quiet, saveBase64AsFile: upload,
        getMultimodalCaption: caption, getCharacterAvatar: () => '/synthetic-avatar.png', getBase64Async: async () => 'data:image/png;base64,synthetic',
        substituteParams: value => value, substituteParamsExtended: value => value,
        isTrueBoolean: value => value === true || value === 'true', isFalseBoolean: value => value === false || value === 'false',
        getCharaFilename: () => 'first', humanizedDateTime: () => 'synthetic-time', getMessageTimeStamp: () => 'synthetic-date',
        MEDIA_TYPE: { IMAGE: 'image', VIDEO: 'video' }, MEDIA_SOURCE: { GENERATED: 'generated' }, MEDIA_DISPLAY: { GALLERY: 'gallery' }, VIDEO_EXTENSIONS: [],
        ActionLoaderHandle: { EMPTY: { hide: async () => {} } },
        loader: { show: options => { const handle = { options, hide: jest.fn(async () => {}) }; loaders.push(handle); return handle; } },
    };
    const scope = vm.createContext({
        AbortController, DOMException, URL, console: { log() {}, warn() {}, error() {}, trace() {} },
        fetch, toastr, t: strings => strings.join(''),
        document: { querySelector: () => null }, setTimeout: () => 1,
    });
    const module = new vm.SourceTextModule(`${source}\nexport { defaultSettings, generatePicture };`, { context: scope });
    const imports = new Map();
    for (const match of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g)) {
        imports.set(match[2], match[1].split(',').map(value => value.trim()).filter(Boolean));
    }
    await module.link(specifier => {
        const names = imports.get(specifier);
        return new vm.SyntheticModule(names, function () {
            for (const name of names) this.setExport(name, values[name] ?? (() => {}));
        }, { context: scope });
    });
    await module.evaluate();
    extension_settings.sd = structuredClone(module.namespace.defaultSettings);
    Object.assign(extension_settings.sd, { enabled: true, source: 'sdcpp', sdcpp_url: 'https://synthetic.invalid', prompt_writer_profile: 'writer', sampler: 'explicit-sampler', model: 'explicit-model', steps: 7, scale: 4 });
    return {
        module: module.namespace, context: () => context, switchStory: (change = {}) => { context = { ...context, ...change }; },
        run: () => module.namespace.generateWorkspaceImage('scene'),
        events: eventSource, types: event_types, listeners, loaders, settings: extension_settings.sd,
        writer, caption, quiet, upload, fetch, toastr,
    };
}

function heldAbortable(mock) {
    const started = deferred();
    mock.mockImplementation((_profile, _messages, _maxTokens, { signal }) => {
        started.resolve(signal);
        return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
    });
    return started.promise;
}

test('native image Stop cancels the held writer before inference and restores explicit settings', async () => {
    const f = await fixture();
    const before = structuredClone(f.settings);
    const started = heldAbortable(f.writer);
    const run = f.run();
    const signal = await started;
    expect(f.loaders).toHaveLength(1);
    f.loaders[0].options.onStop();
    await expect(run).rejects.toMatchObject({ name: 'AbortError' });
    expect(signal.aborted).toBe(true);
    expect(f.fetch).not.toHaveBeenCalled();
    expect(f.upload).not.toHaveBeenCalled();
    expect(f.context().chat).toEqual([]);
    expect(f.loaders[0].hide).toHaveBeenCalledTimes(1);
    expect(f.listeners.get(f.types.CHAT_CHANGED)).toHaveLength(0);
    expect(f.settings).toEqual(before);
    expect(f.toastr.error).not.toHaveBeenCalled();
});

test('same-filename character switch aborts the pending writer', async () => {
    const f = await fixture();
    const started = heldAbortable(f.writer);
    const run = f.run();
    const signal = await started;
    f.switchStory({ characters: [{ name: 'Other', avatar: 'other.png' }] });
    await f.events.emit(f.types.CHAT_CHANGED);
    await expect(run).rejects.toMatchObject({ name: 'AbortError' });
    expect(signal.aborted).toBe(true);
    expect(f.fetch).not.toHaveBeenCalled();
});

test('non-workspace image callers retain undefined on native Stop', async () => {
    const f = await fixture();
    const started = heldAbortable(f.writer);
    const run = f.module.generatePicture('command', {}, 'scene');
    await started;
    f.loaders[0].options.onStop();
    await expect(run).resolves.toBeUndefined();
    expect(f.toastr.info).toHaveBeenCalledWith('Image generation stopped.', 'Image Generation');
    expect(f.toastr.error).not.toHaveBeenCalled();
    expect(f.fetch).not.toHaveBeenCalled();
});

for (const kind of ['character', 'group']) test(`same-filename ${kind} switch discards an inference that finishes late`, async () => {
    const f = await fixture();
    const started = deferred(), response = deferred();
    f.fetch.mockImplementation(() => { started.resolve(); return response.promise; });
    const run = f.run();
    await started.promise;
    f.switchStory(kind === 'group' ? { groupId: 'other-group' } : { characters: [{ name: 'Other', avatar: 'other.png' }] });
    response.resolve({ ok: true, json: async () => ({ images: ['late-image'] }) });
    await expect(run).rejects.toMatchObject({ name: 'AbortError' });
    expect(f.upload).not.toHaveBeenCalled();
    expect(f.context().chat).toEqual([]);
});

test('navigation during media upload never invokes a callback or inserts into the next story', async () => {
    const f = await fixture();
    const started = deferred(), saved = deferred(), callback = jest.fn();
    f.upload.mockImplementation(() => { started.resolve(); return saved.promise; });
    const run = f.module.generatePicture('command', {}, 'A lantern', undefined, callback);
    await started.promise;
    f.switchStory({ characters: [{ name: 'Other', avatar: 'other.png' }], chat: [] });
    saved.resolve('/images/late.png');
    await expect(run).resolves.toBeUndefined();
    expect(callback).not.toHaveBeenCalled();
    expect(f.context().chat).toEqual([]);
    expect(f.context().saveChat).not.toHaveBeenCalled();
});

test('navigation in the native receive event prevents later rendering and saving in the next story', async () => {
    const f = await fixture();
    f.events.on(f.types.MESSAGE_RECEIVED, () => f.switchStory({ characters: [{ name: 'Other', avatar: 'other.png' }], chat: [] }));
    await expect(f.run()).rejects.toMatchObject({ name: 'AbortError' });
    expect(f.context().chat).toEqual([]);
    expect(f.context().addOneMessage).not.toHaveBeenCalled();
    expect(f.context().saveChat).not.toHaveBeenCalled();
});

test('Stop releases image UI during a held upload and never inserts its late result', async () => {
    const f = await fixture();
    const started = deferred(), saved = deferred();
    f.upload.mockImplementation(() => { started.resolve(); return saved.promise; });
    const run = f.run();
    await started.promise;
    f.loaders[0].options.onStop();
    await expect(run).rejects.toMatchObject({ name: 'AbortError' });
    expect(f.loaders[0].hide).toHaveBeenCalledTimes(1);
    saved.resolve('/images/cancelled-late.png');
    await saved.promise;
    expect(f.context().chat).toEqual([]);
    expect(f.context().addOneMessage).not.toHaveBeenCalled();
    expect(f.context().saveChat).not.toHaveBeenCalled();
});

test('quiet requests and explicit callbacks retain native return behavior', async () => {
    const f = await fixture();
    const callback = jest.fn();
    await expect(f.module.generatePicture('command', { quiet: 'true' }, 'A lantern')).resolves.toBe('/images/synthetic.png');
    expect(f.context().chat).toEqual([]);
    await expect(f.module.generatePicture('command', {}, 'A lantern', undefined, callback)).resolves.toBe('/images/synthetic.png');
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0]).toHaveLength(7);
    expect(f.context().chat).toEqual([]);
});

test('main-model writer cancellation waits for the native quiet owner to settle', async () => {
    const f = await fixture();
    f.settings.prompt_writer_profile = '';
    const started = deferred();
    let settled = false;
    f.quiet.mockImplementation(async ({ signal }) => {
        started.resolve(signal);
        try { await new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true })); }
        finally { settled = true; }
    });
    const run = f.run();
    const signal = await started.promise;
    f.loaders[0].hide.mockImplementation(async () => expect(settled).toBe(true));
    f.loaders[0].options.onStop();
    await expect(run).rejects.toMatchObject({ name: 'AbortError' });
    expect(signal.aborted).toBe(true);
    expect(f.fetch).not.toHaveBeenCalled();
});

test('native image Stop cancels a held multimodal caption without image inference', async () => {
    const f = await fixture();
    f.settings.multimodal_captioning = true;
    const started = deferred();
    f.fetch.mockResolvedValue({ ok: true, blob: async () => ({}) });
    f.caption.mockImplementation((_image, _prompt, signal) => {
        started.resolve(signal);
        return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
    });
    const run = f.module.generateWorkspaceImage('face');
    const signal = await started.promise;
    f.loaders[0].options.onStop();
    await expect(run).rejects.toMatchObject({ name: 'AbortError' });
    expect(signal.aborted).toBe(true);
    expect(f.fetch).toHaveBeenCalledTimes(1);
    expect(f.writer).not.toHaveBeenCalled();
    expect(f.upload).not.toHaveBeenCalled();
    expect(f.toastr.error).not.toHaveBeenCalled();
    expect(f.loaders[0].hide).toHaveBeenCalledTimes(1);
});

test('successful native scene generation inserts one image and retains writer and sampling options', async () => {
    const f = await fixture();
    const before = structuredClone(f.settings);
    await expect(f.run()).resolves.toBe('/images/synthetic.png');
    expect(f.context().chat).toHaveLength(1);
    expect(f.context().chat[0].extra.media[0].url).toBe('/images/synthetic.png');
    expect(f.context().addOneMessage).toHaveBeenCalledTimes(1);
    expect(f.context().saveChat).toHaveBeenCalledTimes(1);
    const writerOptions = f.writer.mock.calls[0][3];
    expect(writerOptions).toMatchObject({ includePreset: false, includeInstruct: false });
    expect(f.writer.mock.calls[0][4]).toEqual({ custom_include_body: JSON.stringify({ chat_template_kwargs: { enable_thinking: false } }) });
    expect(f.fetch.mock.calls[0][1].signal).toBe(writerOptions.signal);
    expect(JSON.parse(f.fetch.mock.calls[0][1].body)).toMatchObject({ steps: 7, cfg_scale: 4, model: 'explicit-model', sampler_name: 'explicit-sampler' });
    expect(f.settings).toEqual(before);
    expect(f.listeners.get(f.types.CHAT_CHANGED)).toHaveLength(0);
});
