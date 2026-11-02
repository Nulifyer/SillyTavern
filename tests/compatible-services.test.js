import { afterAll, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const fetchMock = jest.fn();
const readSecret = jest.fn();
jest.unstable_mockModule('node-fetch', () => ({ default: fetchMock }));
jest.unstable_mockModule('../src/endpoints/secrets.js', () => ({ readSecret, SECRET_KEYS: { CUSTOM: 'custom', CUSTOM_OPENAI_TTS: 'tts' } }));

describe('compatible service discovery and transcription', () => {
    let server, base, uploads;
    const json = data => ({ ok: true, json: async () => data });
    const post = body => fetch(`${base}/custom/discover`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

    beforeAll(async () => {
        const { default: express } = await import('express');
        const { default: multer } = await import('multer');
        const { router } = await import('../src/endpoints/openai.js');
        uploads = fs.mkdtempSync(path.join(os.tmpdir(), 'st-compatible-test-'));
        const app = express();
        app.use(express.json());
        app.use(multer({ dest: uploads }).single('avatar'));
        app.use((req, _res, next) => { req.user = { directories: {} }; next(); });
        app.use(router);
        server = app.listen(0, '127.0.0.1');
        await new Promise(resolve => server.once('listening', resolve));
        base = `http://127.0.0.1:${server.address().port}`;
    });
    afterAll(async () => {
        await new Promise(resolve => server.close(resolve));
        fs.rmSync(uploads, { recursive: true, force: true });
    });
    beforeEach(() => { fetchMock.mockReset(); readSecret.mockReset(); });

    test.each(['https://fixture.example', 'https://fixture.example/v1/', 'https://fixture.example/v1/audio/speech'])('discovers service-filtered models from %s without credentials or management mutations', async url => {
        fetchMock.mockImplementation(async target => {
            if (target.endsWith('/.well-known/juiced.json')) return json({ name: 'Juiced' });
            if (target.endsWith('/juiced/protocols')) return json({ protocols: [{ id: 'automatic1111', features: ['txt2img'] }] });
            const service = new URL(target).searchParams.get('service');
            return json({ data: service === 'embeddings' ? [] : [{ id: `${service}-model`, labels: [service] }] });
        });
        const result = await post({ url });
        expect(result.status).toBe(200);
        const body = await result.json();
        expect(body).toMatchObject({ root: 'https://fixture.example', base: 'https://fixture.example/v1', juiced: true, services: { chat: { models: [{ id: 'chat-model' }] }, embeddings: { models: [] } } });
        expect(fetchMock).toHaveBeenCalledTimes(7);
        for (const [, options] of fetchMock.mock.calls) {
            expect(options.headers).toEqual({});
            expect(options.method).toBeUndefined();
            expect(options.redirect).toBe('error');
        }
    });

    test('generic servers expose chat discovery without claiming filtered audio or image support', async () => {
        fetchMock.mockResolvedValueOnce({ ok: false, status: 404 }).mockResolvedValueOnce(json({ data: [{ id: 'generic-chat' }] }));
        const result = await post({ url: 'http://fixture.example' });
        expect(await result.json()).toMatchObject({ juiced: false, services: { chat: { models: [{ id: 'generic-chat' }] } } });
        expect(fetchMock.mock.calls.map(call => call[0])).toEqual(['http://fixture.example/.well-known/juiced.json', 'http://fixture.example/v1/models']);
    });

    test('discovery preserves reported context limits without forwarding runtime internals', async () => {
        fetchMock.mockResolvedValueOnce({ ok: false, status: 404 }).mockResolvedValueOnce(json({ data: [{ id: 'context-model', context_length: 16384, max_context_window: 262144, max_output_tokens: 2048, labels: ['chat', null], recipe_options: { secret: 'synthetic-private-value' } }] }));
        const result = await post({ url: 'https://fixture.example' });
        expect((await result.json()).services.chat.models).toEqual([{ id: 'context-model', context_length: 16384, max_context_window: 262144, max_output_tokens: 2048, labels: ['chat'] }]);
    });

    test.each(['file:///tmp/fixture', 'https://user:secret@fixture.example', 'https://fixture.example?key=secret', 'invalid'])('rejects unsafe or ambiguous URL %s', async url => {
        const result = await post({ url });
        expect(result.status).toBe(400);
        expect(fetchMock).not.toHaveBeenCalled();
        expect(JSON.stringify(await result.json())).not.toContain('secret');
    });

    test('upstream model errors remain visible with a retry instruction', async () => {
        fetchMock.mockResolvedValue({ ok: false, status: 503 });
        const result = await post({ url: 'https://fixture.example' });
        expect(result.status).toBe(502);
        expect((await result.json()).error).toContain('HTTP 503');
    });

    test('voice discovery uses the native TTS key and returns actual deduplicated voices', async () => {
        readSecret.mockReturnValue('synthetic-key');
        fetchMock.mockResolvedValue(json({ voices: ['voice-a', 'voice-b', 'voice-a'] }));
        const result = await post({ url: 'https://fixture.example', voice_model: 'Speech Model/1' });
        expect(await result.json()).toEqual({ voices: ['voice-a', 'voice-b'] });
        expect(readSecret).toHaveBeenCalledWith({}, 'tts');
        expect(fetchMock.mock.calls[0][0]).toBe('https://fixture.example/v1/audio/voices?model=Speech%20Model%2F1');
        expect(fetchMock.mock.calls[0][1].headers).toEqual({ Authorization: 'Bearer synthetic-key' });
    });

    test.each([true, false])('key-free transcription preserves recording format and cleans its upload, success=%s', async success => {
        let multipart;
        fetchMock.mockImplementation(async (_target, options) => {
            multipart = await new Promise((resolve, reject) => {
                const chunks = [];
                options.body.on('data', chunk => chunks.push(Buffer.from(chunk)));
                options.body.on('end', () => resolve(Buffer.concat(chunks).toString()));
                options.body.on('error', reject);
                options.body.resume();
            });
            return success ? json({ text: 'The blue book.' }) : { ok: false, statusText: 'Unavailable', text: async () => 'Synthetic failure' };
        });
        const form = new FormData();
        form.append('avatar', new Blob(['synthetic audio'], { type: 'audio/webm' }), 'recording.webm');
        form.append('endpoint', 'https://fixture.example/v1/audio/transcriptions');
        form.append('model', 'transcription-model');
        const result = await fetch(`${base}/custom/transcribe-audio`, { method: 'POST', body: form });
        expect(result.status).toBe(success ? 200 : 500);
        expect(multipart).toContain('filename="recording.webm"');
        expect(multipart).toContain('Content-Type: audio/webm');
        expect(multipart).toContain('transcription-model');
        expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
        expect(fs.readdirSync(uploads)).toEqual([]);
    });
});
