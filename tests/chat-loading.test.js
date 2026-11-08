import { jest, test, expect, afterEach } from '@jest/globals';
import { beginChatLoad, cancelChatLoad } from '../public/scripts/chat-loader.js';
const nativeFetch = global.fetch;
afterEach(() => { cancelChatLoad(); global.fetch = nativeFetch; });
test('newer character/group reads cancel the prior lifetime', async () => {
    const first = beginChatLoad();
    const second = beginChatLoad();
    expect(first.isCurrent()).toBe(false); expect(second.isCurrent()).toBe(true);
    cancelChatLoad(); expect(second.isCurrent()).toBe(false);
});
test('HTTP failure is rejected rather than returned as an empty conversation', async () => {
    global.fetch = jest.fn(async () => ({ ok: false, status: 503 }));
    await expect(beginChatLoad().read('/synthetic', {}, {})).rejects.toThrow(/could not be loaded/);
});
test('invalid successful payloads are rejected and genuine empty arrays remain valid', async () => {
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ error: 'synthetic' }) }));
    await expect(beginChatLoad().read('/synthetic', {}, {})).rejects.toThrow(/invalid chat/);
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => [] }));
    await expect(beginChatLoad().read('/synthetic', {}, {})).resolves.toEqual([]);
});

test('object arrays without a recognizable header or message bodies are not empty chats', async () => {
    for (const data of [[{}], [{ error: 'synthetic' }], [{ chat_metadata: {} }, { unexpected: 'not a message' }]]) {
        global.fetch = jest.fn(async () => ({ ok: true, json: async () => data }));
        await expect(beginChatLoad().read('/synthetic', {}, {})).rejects.toThrow(/invalid chat/);
    }
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => [{ mes: 'Legacy group message' }] }));
    await expect(beginChatLoad().read('/group', {}, {}, { allowHeaderless: true })).resolves.toEqual([{ mes: 'Legacy group message' }]);
});
