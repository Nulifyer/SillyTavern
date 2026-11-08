import { test, expect } from '@jest/globals';
import { webcrypto } from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';

async function fixture(crypto = webcrypto) {
    const data = new Map();
    const storage = { getItem: async key => structuredClone(data.get(key)), setItem: async (key, value) => data.set(key, structuredClone(value)), removeItem: async key => data.delete(key) };
    const context = vm.createContext({ crypto, TextEncoder, console });
    const lib = new vm.SyntheticModule(['localforage'], function () { this.setExport('localforage', { createInstance: () => storage }); }, { context });
    const module = new vm.SourceTextModule(fs.readFileSync(new URL('../public/scripts/itemized-captures.js', import.meta.url), 'utf8'), { context });
    await module.link(() => lib); await module.evaluate();
    return { api: module.namespace, data, storage };
}
const owner = (account = 'alice', kind = 'character', entity = 'one.png', file = 'same', integrity = 'scene1') => JSON.stringify([account, kind, entity, file, integrity]);
async function capture(api, identity = owner(), text = 'The blue book opens.', index = 2, swipe = 0) {
    const draft = api.beginClientCapture(identity, 'normal', { main_api: 'openai', presetName: 'Roleplay', this_max_context: 15000, summarizeString: 'A neutral quest.' }, 'Exact model name');
    api.recordClientRequest(draft, { model: 'Exact model name', messages: [{ role: 'user', content: 'Open the book.' }] });
    const message = { mes: text, swipe_id: swipe, extra: {}, swipe_info: [{ extra: {} }] };
    await api.finishClientCapture(draft, identity, message, index);
    return { message, draft };
}
test('immutable context follows the exact account/entity/file/message/alternative/revision', async () => {
    const { api } = await fixture(); const { message } = await capture(api);
    expect(await api.readClientCapture(owner(), message, 2)).toMatchObject({ model: 'Exact model name', preset: 'Roleplay', contextBudget: 15000 });
    for (const identity of [owner('bob'), owner('alice', 'group'), owner('alice', 'character', 'two.png'), owner('alice', 'character', 'one.png', 'other'), owner('alice', 'character', 'one.png', 'same', 'copy')]) expect(await api.readClientCapture(identity, message, 2)).toBeNull();
    expect(await api.readClientCapture(owner(), message, 3)).toBeNull();
    expect(await api.readClientCapture(owner(), { ...message, mes: 'Edited' }, 2)).toBeNull();
    expect(await api.readClientCapture(owner(), { ...message, swipe_id: 1 }, 2)).toBeNull();
});
test('request allowlist strips credentials, arbitrary body fields and media payloads', async () => {
    const { api, data } = await fixture(); const { draft } = await capture(api);
    draft.finished = false;
    api.recordClientRequest(draft, { model: 'model', proxy_password: 'SECRET', custom_include_headers: 'SECRET', custom_include_body: 'SECRET', custom_url: 'https://user:SECRET@host/?key=SECRET', messages: [{ role: 'user', content: [{ type: 'text', text: '<script>visible as text</script>' }, { type: 'image_url', image_url: { url: 'data:image/png;base64,SECRET' } }] }] });
    await api.finishClientCapture(draft, owner(), { mes: 'Reply', extra: {} }, 2);
    const record = data.get(draft.id);
    expect(JSON.stringify(record)).not.toContain('SECRET');
    expect(record.request.messages[0].content[1]).toEqual({ type: 'image_url', omitted: true });
});
test('bounded capture retains newest sixty records and omits oversized request text', async () => {
    const { api, data } = await fixture(); const first = await capture(api);
    for (let i = 0; i < 60; i++) await capture(api, owner(), `Reply ${i}`);
    expect(await api.readClientCapture(owner(), first.message, 2)).toBeNull();
    expect(data.get('index')).toHaveLength(60);
    const draft = api.beginClientCapture(owner(), 'normal', {}, 'model');
    api.recordClientRequest(draft, { messages: [{ role: 'user', content: 'x'.repeat(300000) }] });
    expect(draft.truncated).toBe(true); expect(JSON.stringify(draft).length).toBeLessThan(240000);
});
test('only acknowledged native rename bindings keep recorded identity intact', async () => {
    const { api } = await fixture(); const { message } = await capture(api);
    await api.renameClientCaptures('bob', { avatarId: 'one.png', oldFileName: 'same', newFileName: 'renamed' });
    const renamed = owner('alice', 'character', 'one.png', 'renamed');
    expect(await api.readClientCapture(renamed, message, 2)).toBeNull();
    await api.renameClientCaptures('alice', { avatarId: 'one.png', oldFileName: 'same', newFileName: 'renamed' });
    expect(await api.readClientCapture(renamed, message, 2)).toMatchObject({ owner: owner() });
    await api.renameClientCaptures('alice', { oldAvatar: 'one.png', newAvatar: 'new.png' });
    expect(await api.readClientCapture(owner('alice', 'character', 'new.png', 'renamed'), message, 2)).not.toBeNull();
});
test('Continue creates an independent revision and quiet/impersonate never capture', async () => {
    const { api, data } = await fixture(); const first = await capture(api);
    const second = await capture(api, owner(), 'The blue book opens. A map appears.');
    expect(first.message.extra.client_context).not.toBe(second.message.extra.client_context);
    expect(data.get(first.message.extra.client_context).responseHash).not.toBe(data.get(second.message.extra.client_context).responseHash);
    expect(api.beginClientCapture(owner(), 'quiet', {}, '')).toBeNull();
    expect(api.beginClientCapture(owner(), 'impersonate', {}, '')).toBeNull();
});
test('obsolete completion and storage failure cannot attach unrelated references', async () => {
    const { api, storage } = await fixture(); const draft = api.beginClientCapture(owner(), 'normal', {}, 'model');
    const message = { mes: 'Reply', extra: {} };
    await api.finishClientCapture(draft, owner('bob'), message, 0);
    expect(message.extra.client_context).toBeUndefined();
    storage.setItem = async () => { throw new Error('quota'); };
    await api.finishClientCapture(draft, owner(), message, 0);
    expect(message.extra.client_context).toBeUndefined();
});

test('absent or failing Web Crypto never escapes optional diagnostics', async () => {
    for (const crypto of [null, {}, { randomUUID: () => { throw new Error('uuid'); }, subtle: webcrypto.subtle }]) {
        const { api } = await fixture(crypto);
        expect(api.beginClientCapture(owner(), 'normal', {}, 'model')).toBeNull();
    }
    const { api } = await fixture({ randomUUID: () => 'id', subtle: { digest: async () => { throw new Error('digest'); } } });
    const draft = api.beginClientCapture(owner(), 'normal', {}, 'model');
    const message = { mes: 'Native reply', extra: {} };
    await expect(api.finishClientCapture(draft, owner(), message, 0)).resolves.toBeUndefined();
    expect(message.mes).toBe('Native reply'); expect(message.extra.client_context).toBeUndefined();
});
