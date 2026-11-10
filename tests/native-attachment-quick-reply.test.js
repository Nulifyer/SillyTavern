/* eslint-disable playwright/no-standalone-expect, playwright/prefer-web-first-assertions -- Jest tests exercise actual native owners with controlled I/O. */
import { describe, expect, jest, test } from '@jest/globals';
import fs from 'node:fs';
import vm from 'node:vm';
import { parse } from 'acorn';

const source = file => fs.readFileSync(new URL(`../public/scripts/${file}`, import.meta.url), 'utf8');
function functions(file, names) {
    const text = source(file);
    const ast = parse(text, { ecmaVersion: 'latest', sourceType: 'module' });
    return ast.body.map(node => node.declaration || node).filter(node => node.type === 'FunctionDeclaration' && names.includes(node.id.name)).map(node => text.slice(node.start, node.end)).join('\n');
}
const deferred = () => { let resolve; const promise = new Promise(done => resolve = done); return { promise, resolve }; };
const notices = () => ({ error: jest.fn(), warning: jest.fn(), info: jest.fn() });

async function dragModule() {
    const handlers = [], classes = new Set(), timers = new Map();
    let nextTimer = 1;
    const jquery = () => ({
        on(type, ...args) { handlers.push({ type, selector: typeof args[0] === 'string' ? args[0] : null, callback: args.at(-1) }); return this; },
        off(type, ...args) {
            const selector = typeof args[0] === 'string' ? args[0] : null, callback = args.at(-1);
            for (let index = handlers.length - 1; index >= 0; index--) if (handlers[index].type === type && handlers[index].selector === selector && handlers[index].callback === callback) handlers.splice(index, 1);
            return this;
        },
        addClass(names) { names.split(' ').forEach(name => classes.add(name)); return this; },
        removeClass(names) { names.split(' ').forEach(name => classes.delete(name)); return this; },
        remove() { throw new Error('Destroy must not remove the target DOM node.'); },
    });
    const context = vm.createContext({ $: jquery, document: { body: {} }, setTimeout: action => { const id = nextTimer++; timers.set(id, action); return id; }, clearTimeout: id => timers.delete(id) });
    const module = new vm.SourceTextModule(source('dragdrop.js'), { context });
    await module.link(() => new vm.SyntheticModule(['debounce_timeout'], function () { this.setExport('debounce_timeout', { quick: 10 }); }, { context }));
    await module.evaluate();
    return { Handler: module.namespace.DragAndDropHandler, handlers, classes, timers };
}

describe('native drag/drop lifetime', () => {
    test.each(['body', '.popup'])('destroy removes only its stable handlers and its pending timer: %s', async selector => {
        const fixture = await dragModule();
        const callback = jest.fn();
        const first = new fixture.Handler(selector, callback, { noAnimation: true });
        first.init();
        expect(fixture.handlers).toHaveLength(3);
        first.handleDragLeave({ preventDefault() {}, stopPropagation() {} });
        expect(fixture.timers.size).toBe(1);
        first.destroy(); first.destroy();
        expect(fixture.handlers).toHaveLength(0);
        expect(fixture.timers.size).toBe(0);
        expect([...fixture.classes]).toEqual([]);
        const second = new fixture.Handler(selector, callback);
        fixture.handlers.find(handler => handler.type === 'drop').callback({ preventDefault() {}, stopPropagation() {}, originalEvent: { dataTransfer: { files: [{ name: 'neutral.txt' }] } } });
        expect(callback).toHaveBeenCalledTimes(1);
        second.destroy();
    });
    test('destroying one owner does not detach another owner on the same selector', async () => {
        const fixture = await dragModule();
        const first = new fixture.Handler('.popup', jest.fn());
        const callback = jest.fn(); new fixture.Handler('.popup', callback);
        first.destroy();
        expect(fixture.handlers).toHaveLength(3);
        fixture.handlers.find(handler => handler.type === 'drop').callback({ preventDefault() {}, stopPropagation() {}, originalEvent: { dataTransfer: { files: [] } } });
        expect(callback).toHaveBeenCalledTimes(1);
    });
});

function attachments() {
    const attachment = { url: '/files/neutral.txt', name: 'neutral.txt' };
    const context = vm.createContext({
        console: { error() {}, log() {} }, toastr: notices(),
        ATTACHMENT_SOURCE: { GLOBAL: 'global', CHAT: 'chat', CHARACTER: 'character' },
        characters: [{ avatar: 'A.png' }, { avatar: 'B.png' }], this_chid: 0,
        currentIdentity: 'story-a', getCurrentChatIdentity: () => context.currentIdentity,
        extension_settings: { attachments: [attachment], disabled_attachments: [attachment.url], character_attachments: { 'A.png': [attachment], 'B.png': [] } },
        chat_metadata: { attachments: [attachment] }, ensureAttachmentsExist() {},
        callGenericPopup: jest.fn(async () => 1), POPUP_TYPE: { CONFIRM: 1 }, POPUP_RESULT: { AFFIRMATIVE: 1 },
        saveSettingsDebounced: jest.fn(), saveMetadataDebounced: jest.fn(),
        deleteFileFromServer: jest.fn(async () => true),
        stageFileAttachment: jest.fn(async () => ({ url: '/files/new.txt', name: 'new.txt' })),
        t: parts => parts.join(''), getRequestHeaders: () => ({}),
    });
    vm.runInContext(functions('chats.js', ['captureAttachmentOwner', 'attachmentOwnerCurrent', 'removeAttachmentReference', 'deleteAttachment', 'registerAttachment', 'uploadFileAttachmentToServer', 'replaceAttachment']), context);
    return { context, attachment };
}

describe('native attachment mutation ordering and owner isolation', () => {
    test.each(['global', 'chat', 'character'])('a rejected delete preserves references, disabled state and success callback: %s', async owner => {
        const { context, attachment } = attachments();
        context.deleteFileFromServer.mockResolvedValue(false);
        const callback = jest.fn();
        expect(await context.deleteAttachment(attachment, owner, callback, false)).toBe(false);
        expect(context.extension_settings.attachments).toContain(attachment);
        expect(context.chat_metadata.attachments).toContain(attachment);
        expect(context.extension_settings.character_attachments['A.png']).toContain(attachment);
        expect(context.extension_settings.disabled_attachments).toContain(attachment.url);
        expect(context.saveSettingsDebounced).not.toHaveBeenCalled();
        expect(context.saveMetadataDebounced).not.toHaveBeenCalled();
        expect(callback).not.toHaveBeenCalled();
    });
    test('a successful character attachment delete persists settings even when it was enabled', async () => {
        const { context, attachment } = attachments(); context.extension_settings.disabled_attachments = [];
        expect(await context.deleteAttachment(attachment, 'character', jest.fn(), false)).toBe(true);
        expect(context.extension_settings.character_attachments['A.png']).toEqual([]);
        expect(context.saveSettingsDebounced).toHaveBeenCalledTimes(1);
    });
    test('selection changes during confirmation cancel before any file deletion', async () => {
        const { context, attachment } = attachments(); const gate = deferred();
        context.callGenericPopup.mockReturnValue(gate.promise);
        const pending = context.deleteAttachment(attachment, 'character', jest.fn());
        context.this_chid = 1; gate.resolve(1);
        expect(await pending).toBe(false);
        expect(context.deleteFileFromServer).not.toHaveBeenCalled();
        expect(context.extension_settings.character_attachments['A.png']).toContain(attachment);
    });
    test('a late chat delete does not mutate or save a newly loaded story', async () => {
        const { context, attachment } = attachments(); const gate = deferred();
        context.deleteFileFromServer.mockReturnValue(gate.promise);
        const original = context.chat_metadata;
        const pending = context.deleteAttachment(attachment, 'chat', jest.fn(), false);
        context.currentIdentity = 'story-b'; context.chat_metadata = { attachments: [{ url: '/files/b.txt' }] };
        gate.resolve(true);
        expect(await pending).toBe(false);
        expect(context.chat_metadata.attachments).toEqual([{ url: '/files/b.txt' }]);
        expect(original.attachments).toContain(attachment);
        expect(context.saveMetadataDebounced).not.toHaveBeenCalled();
        expect(context.toastr.warning).toHaveBeenCalled();
    });
    test('late uploads never attach a file to the newly selected character', async () => {
        const { context } = attachments(); const gate = deferred(); context.stageFileAttachment.mockReturnValue(gate.promise);
        const pending = context.uploadFileAttachmentToServer({}, 'character'); context.this_chid = 1;
        gate.resolve({ url: '/files/staged.txt', name: 'staged.txt' });
        expect(await pending).toBeUndefined();
        expect(context.extension_settings.character_attachments['B.png']).toEqual([]);
        expect(context.deleteFileFromServer).toHaveBeenCalledWith('/files/staged.txt', true);
    });
    test('replacement upload failure leaves the original file, references and row untouched', async () => {
        const { context, attachment } = attachments(); context.stageFileAttachment.mockResolvedValue(undefined);
        const owner = context.captureAttachmentOwner('global');
        expect(await context.replaceAttachment(attachment, 'global', 'global', {}, owner)).toBe(false);
        expect(context.deleteFileFromServer).not.toHaveBeenCalled();
        expect(context.extension_settings.attachments).toContain(attachment);
    });
    test('replacement deletion failure preserves the original and cleans only its own staged upload', async () => {
        const { context, attachment } = attachments();
        context.deleteFileFromServer.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
        expect(await context.replaceAttachment(attachment, 'global', 'global', {}, context.captureAttachmentOwner('global'))).toBe(false);
        expect(context.extension_settings.attachments).toContain(attachment);
        expect(context.deleteFileFromServer.mock.calls).toEqual([[attachment.url, false], ['/files/new.txt', true]]);
    });
    test('a replacement retains staged content when the original deletion completed after a selection change', async () => {
        const { context, attachment } = attachments(); const requested = deferred(), deleted = deferred();
        context.deleteFileFromServer.mockImplementation(() => { requested.resolve(); return deleted.promise; });
        const pending = context.replaceAttachment(attachment, 'character', 'character', {}, context.captureAttachmentOwner('character'));
        await requested.promise; context.this_chid = 1; deleted.resolve(true);
        expect(await pending).toBe(false);
        expect(context.deleteFileFromServer.mock.calls).toEqual([[attachment.url, false]]);
        expect(context.extension_settings.character_attachments['B.png']).toEqual([]);
    });
});

async function quickReplies() {
    const set = () => ({ qrList: [], save: jest.fn(async () => true), rerender: jest.fn(), addQuickReply(data) { const value = { ...data }; this.qrList.push(value); return value; }, addQuickReplyFromText(text) { return this.addQuickReply({ message: text }); } });
    const a = set(), b = set();
    class Set { static list = [a, b]; }
    const context = vm.createContext({ console, navigator: { clipboard: { readText: jest.fn(async () => 'A neutral quick reply') } }, toastr: notices() });
    const module = new vm.SourceTextModule(source('extensions/quick-reply/src/ui/SettingsUi.js'), { context });
    const exports = { Popup: {}, escapeHtml: value => value, getSortableDelay: () => 0, log() {}, warn: jest.fn(), QuickReply: { from: value => value }, QuickReplySet: Set, QuickReplySettings: class {} };
    await module.link(() => new vm.SyntheticModule(Object.keys(exports), function () { for (const [name, value] of Object.entries(exports)) this.setExport(name, value); }, { context }));
    await module.evaluate();
    const ui = new module.namespace.SettingsUi({}); ui.currentQrSet = a;
    return { ui, a, b, Set, context };
}

describe('Quick Reply clipboard and file lifetimes', () => {
    test('a held clipboard result cannot inject into a different selected set', async () => {
        const { ui, a, b, context } = await quickReplies(); const gate = deferred();
        context.navigator.clipboard.readText.mockReturnValue(gate.promise);
        const pending = ui.pasteQuickReply(); ui.currentQrSet = b; gate.resolve('Late clipboard');
        expect(await pending).toBe(false); expect(a.qrList).toEqual([]); expect(b.qrList).toEqual([]);
    });
    test('denied clipboard access reports failure without rejecting the click handler', async () => {
        const { ui, a, context } = await quickReplies(); context.navigator.clipboard.readText.mockRejectedValue(new Error('Permission denied'));
        expect(await ui.pasteQuickReply()).toBe(false); expect(a.qrList).toEqual([]); expect(context.toastr.error).toHaveBeenCalled();
    });
    test('a deleted captured set cannot receive a late imported file', async () => {
        const { ui, a, Set } = await quickReplies(); const gate = deferred();
        const pending = ui.importQuickReplies(a, [{ name: 'reply.json', text: () => gate.promise }]);
        Set.list = []; a.isDeleted = true; gate.resolve('{"label":"A","message":"Neutral"}');
        expect(await pending).toBe(false); expect(a.qrList).toEqual([]);
    });
    test('an invalid later file leaves the entire import batch unapplied', async () => {
        const { ui, a, context } = await quickReplies();
        expect(await ui.importQuickReplies(a, [{ name: 'valid.json', text: async () => '{"label":"A","message":"Neutral"}' }, { name: 'invalid.json', text: async () => '{invalid' }])).toBe(false);
        expect(a.qrList).toEqual([]); expect(a.save).not.toHaveBeenCalled(); expect(context.toastr.error).toHaveBeenCalled();
    });
    test('failed native persistence rolls back only new replies and retains existing content', async () => {
        const { ui, a } = await quickReplies(); const original = { label: 'Existing', message: 'Keep me' }; a.qrList.push(original); a.save.mockResolvedValue(false);
        expect(await ui.importQuickReplies(a, [{ name: 'valid.json', text: async () => '{"label":"A","message":"Neutral"}' }])).toBe(false);
        expect(a.qrList).toEqual([original]);
    });
    test('valid files apply in order to their original selected set', async () => {
        const { ui, a, b } = await quickReplies();
        expect(await ui.importQuickReplies(a, [{ name: 'first.json', text: async () => '{"label":"First","message":"One"}' }, { name: 'second.json', text: async () => '{"label":"Second","message":"Two"}' }])).toBe(true);
        expect(a.qrList.map(reply => reply.label)).toEqual(['First', 'Second']); expect(b.qrList).toEqual([]);
    });
    test.each(['success', 'http-failure', 'network-failure'])('native debounced persistence resolves a truthful result without an unhandled rejection: %s', async scenario => {
        const fetch = jest.fn(async () => ({ ok: scenario === 'success', status: 503 }));
        if (scenario === 'network-failure') fetch.mockRejectedValue(new Error('Synthetic network failure'));
        const context = vm.createContext({ fetch, console: { error: jest.fn() }, toastr: notices() });
        const exports = { getRequestHeaders: () => ({}), getSanitizedFilename: async value => value, substituteParams: value => value, Popup: {}, POPUP_RESULT: {}, POPUP_TYPE: {}, executeSlashCommandsOnChatInput() {}, executeSlashCommandsWithOptions() {}, SlashCommandScope: class {}, SlashCommandParser: class {}, debounceAsync: action => action, warn: jest.fn(), QuickReply: class {} };
        const module = new vm.SourceTextModule(source('extensions/quick-reply/src/QuickReplySet.js'), { context });
        await module.link(() => new vm.SyntheticModule(Object.keys(exports), function () { for (const [name, value] of Object.entries(exports)) this.setExport(name, value); }, { context }));
        await module.evaluate();
        const target = new module.namespace.QuickReplySet(); target.name = 'Neutral set'; target.rerender = jest.fn();
        expect(await target.performSave()).toBe(scenario === 'success');
        expect(target.rerender).toHaveBeenCalledTimes(Number(scenario === 'success'));
        expect(context.toastr.error).toHaveBeenCalledTimes(Number(scenario !== 'success'));
    });
});
