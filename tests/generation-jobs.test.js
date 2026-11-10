import { afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import express from 'express';
import { once } from 'node:events';
import { GenerationJobStore } from '../src/generation-jobs.js';
import { setConfigFilePath } from '../src/util.js';

process.env.SILLYTAVERN_BACKUPS_CHAT_ENABLED = 'false';
process.env.SILLYTAVERN_BACKUPS_CHAT_MAXTOTALBACKUPS = '-1';
process.env.SILLYTAVERN_BACKUPS_CHAT_THROTTLEINTERVAL = '0';
process.env.SILLYTAVERN_BACKUPS_CHAT_CHECKINTEGRITY = 'true';

let createGenerationJobsRouter, generationTarget, trySaveChat, textCompletionsRouter;
beforeAll(async () => {
    setConfigFilePath(new URL('../default/config.yaml', import.meta.url).pathname);
    ({ createGenerationJobsRouter, generationTarget } = await import('../src/endpoints/generation-jobs.js'));
    ({ trySaveChat } = await import('../src/endpoints/chats.js'));
    ({ router: textCompletionsRouter } = await import('../src/endpoints/backends/text-completions.js'));
});

const endpoint = '/api/backends/chat-completions/generate';
const integrity = '149d9f21-cda4-4187-939b-58a46d096eee';
const header = { chat_metadata: { integrity }, user_name: 'unused', character_name: 'unused' };
const baseline = [header, { name: 'Character', is_user: false, mes: 'Hello', send_date: 'one' }];
const tick = () => new Promise(resolve => setImmediate(resolve));
const jsonl = value => value.map(row => JSON.stringify(row)).join('\n');

let directory, stores;
beforeEach(() => { directory = fs.mkdtempSync(path.join(os.tmpdir(), 'st-generation-jobs-')); stores = []; });
afterEach(() => {
    jest.restoreAllMocks();
    for (const store of stores) for (const job of store.jobs.values()) clearTimeout(job.timer);
    fs.rmSync(directory, { recursive: true, force: true });
});

function makeStore(dispatch, limits) {
    const store = new GenerationJobStore(path.join(directory, 'journal'), dispatch, limits);
    stores.push(store);
    return store;
}

function payload(overrides = {}) {
    return { id: crypto.randomUUID(), story: 'story-a', endpoint, body: { stream: true }, context: { version: 1, baseline }, ...overrides };
}

const request = { headers: {}, user: { profile: { handle: 'user-a' } } };

describe('durable generation owner', () => {
    test('persists intent before invoking once and never persists request credentials', async () => {
        let invocations = 0;
        const store = makeStore((_endpoint, req, res) => {
            invocations++;
            expect(JSON.parse(fs.readFileSync(store.file(job.id), 'utf8')).status).toBe('running');
            expect(req.body.proxy_password).toBe('test-private-key');
            res.end('data: [DONE]\n\n');
        });
        const body = payload({ body: { stream: true, proxy_password: 'test-private-key' } });
        const job = store.start(body, request);
        expect(store.start(body, request)).toBe(job);
        await tick();
        expect(invocations).toBe(1);
        expect(job.record.status).toBe('completed');
        expect(fs.readFileSync(store.file(job.id), 'utf8')).not.toContain('test-private-key');
        expect(fs.readFileSync(store.file(job.id, 'jsonl'), 'utf8')).not.toContain('test-private-key');
        expect(store.frames(job).map(frame => frame.sequence)).toEqual([1]);
    });

    test('rejects an idempotency ID reused for a different intent', async () => {
        const store = makeStore((_endpoint, req, res) => res.end());
        const body = payload();
        store.start(body, request);
        expect(() => store.start({ ...body, body: { stream: true, different: true } }, request)).toThrow('different request');
        await tick();
    });

    test('an explicit stop cancels only the server-owned provider socket and retains partial bytes', async () => {
        let req, res, stopped = 0;
        const store = makeStore((_endpoint, nativeRequest, nativeResponse) => {
            req = nativeRequest; res = nativeResponse;
            req.socket.on('close', () => stopped++);
            res.write('data: partial\n\n');
        });
        const job = store.start(payload(), request);
        await tick();
        expect(req.socket).not.toBe(request.socket);
        expect(store.stop(job.id).status).toBe('stopped');
        expect(stopped).toBe(1);
        expect(store.frames(job).map(frame => Buffer.from(frame.data, 'base64').toString()).join('')).toBe('data: partial\n\n');
        expect(res.destroyed).toBe(true);
    });

    test('server restart exposes saved bytes as interrupted and never reissues inference', async () => {
        let invocations = 0;
        const store = makeStore((_endpoint, req, res) => { invocations++; res.write('data: saved\n\n'); });
        const job = store.start(payload(), request);
        await tick();
        clearTimeout(job.timer);
        const restored = makeStore(() => invocations++);
        const saved = restored.get(job.id);
        expect(saved.record.status).toBe('interrupted');
        expect(saved.record.sequence).toBe(1);
        expect(restored.frames(saved)).toHaveLength(1);
        expect(invocations).toBe(1);
    });

    test('failed intent persistence starts no inference and leaves no discoverable phantom', async () => {
        let calls = 0;
        const store = makeStore(() => calls++);
        jest.spyOn(store, 'persist').mockImplementation(() => { throw new Error('disk unavailable'); });
        const body = payload();
        expect(() => store.start(body, request)).toThrow('disk unavailable');
        await tick();
        expect(calls).toBe(0);
        expect(store.list()).toEqual([]);
        expect(fs.existsSync(store.file(body.id, 'jsonl'))).toBe(false);
    });

    test('an output limit aborts inference with a failed status rather than reporting successful EOF', async () => {
        let socket;
        const store = makeStore((_endpoint, req, res) => { socket = req.socket; res.write('data: too much\n\n'); }, { bytes: 2 });
        const job = store.start(payload(), request);
        await tick();
        expect(job.record.status).toBe('failed');
        expect(job.record.sequence).toBe(0);
        expect(socket.destroyed).toBe(true);
    });

    test('non-success provider responses retain their actual HTTP status and error body', async () => {
        const store = makeStore((_endpoint, req, res) => res.status(503).json({ error: 'Unavailable' }));
        const job = store.start(payload(), request);
        await tick();
        expect(job.record.httpStatus).toBe(503);
        expect(job.record.status).toBe('failed');
        expect(JSON.parse(Buffer.from(store.frames(job)[0].data, 'base64').toString())).toEqual({ error: 'Unavailable' });
        expect(job.record.headers['content-type']).toBe('application/json');
    });

    test('same-story concurrent start is blocked and unresolved jobs are not evicted for capacity', async () => {
        const store = makeStore((_endpoint, req, res) => res.write('partial'), { jobs: 1 });
        const job = store.start(payload(), request);
        await tick();
        expect(() => store.start(payload(), request)).toThrow('already has a running reply');
        store.stop(job.id);
        expect(() => store.start(payload({ story: 'another-story' }), request)).toThrow('storage is full');
        expect(store.get(job.id).record.status).toBe('stopped');
    });

    test('a completed but unsaved same-story reply blocks new inference until acknowledgement', async () => {
        let calls = 0;
        const store = makeStore((_endpoint, req, res) => { calls++; res.end('done'); });
        const job = store.start(payload(), request);
        await tick();
        expect(job.record.status).toBe('completed');
        expect(() => store.start(payload(), request)).toThrow('unsaved reply');
        expect(calls).toBe(1);
        store.acknowledge(job.id);
        store.start(payload(), request);
        await tick();
        expect(calls).toBe(2);
    });

    test('failed save-receipt persistence leaves the unacknowledged replay discoverable', async () => {
        const store = makeStore((_endpoint, req, res) => res.end('complete'));
        const job = store.start(payload(), request);
        await tick();
        jest.spyOn(store, 'persist').mockImplementation(() => { throw new Error('receipt write failed'); });
        expect(() => store.acknowledge(job.id, 'hash')).toThrow('receipt write failed');
        expect(store.list()).toHaveLength(1);
        expect(store.get(job.id).record.context).not.toBeNull();
        expect(fs.existsSync(store.file(job.id, 'jsonl'))).toBe(true);
    });

    test('a saved receipt survives restart and a repeated start never invokes inference again', async () => {
        let calls = 0;
        const store = makeStore((_endpoint, req, res) => { calls++; res.end('done'); });
        const input = payload();
        const job = store.start(input, request);
        await tick();
        store.acknowledge(job.id, 'committed-digest');
        const restored = makeStore(() => calls++);
        expect(restored.start(input, request).record).toMatchObject({ acknowledged: true, committedHash: 'committed-digest', context: null });
        expect(restored.list()).toEqual([]);
        expect(calls).toBe(1);
    });

    test('settled and acknowledged jobs retain only receipt data, without provider or subscriber callbacks', async () => {
        let response, socket;
        const store = makeStore((_endpoint, req, res) => {
            response = res; socket = req.socket;
            socket.on('close', () => req.body);
            res.end('data: [DONE]\n\n');
        });
        const job = store.start(payload(), request);
        await tick();
        expect(job.sink).toBeUndefined();
        expect(job.socket).toBeUndefined();
        expect(job.timer).toBeUndefined();
        expect(socket.eventNames()).toEqual([]);
        expect(response.eventNames()).toEqual([]);
        expect(socket.destroyed).toBe(false);
        job.events.on('frame', () => 'synthetic subscriber');
        store.acknowledge(job.id, 'saved-content');
        expect(Object.keys(job).sort()).toEqual(['id', 'record']);
        expect(job.record.context).toBeNull();
        const restored = makeStore(() => { throw new Error('Inference must not restart'); });
        expect(Object.keys(restored.get(job.id)).sort()).toEqual(['id', 'record']);
    });

    test('a journal write failure aborts inference without publishing an unpersisted cursor', async () => {
        let response;
        const store = makeStore((_endpoint, req, res) => response = res);
        const job = store.start(payload(), request);
        await tick();
        const socket = job.socket;
        const original = fs.writeFileSync;
        jest.spyOn(fs, 'writeFileSync').mockImplementation((file, ...args) => {
            if (typeof file === 'number') throw Object.assign(new Error('Synthetic disk error'), { code: 'EIO' });
            return original(file, ...args);
        });
        response.write('unpersisted token');
        await tick();
        expect(job.record.status).toBe('failed');
        expect(job.record.sequence).toBe(0);
        expect(socket.destroyed).toBe(true);
        expect(store.frames(job)).toEqual([]);
    });
});

describe('authenticated generation HTTP lifecycle and native commit', () => {
    let server, url, calls, held, accounts, restartJobs;
    beforeEach(async () => {
        calls = []; held = new Map(); accounts = {};
        for (const handle of ['user-a', 'user-b']) {
            const root = path.join(directory, handle);
            const directories = { root, chats: path.join(root, 'chats'), groupChats: path.join(root, 'group-chats'), backups: path.join(root, 'backups') };
            fs.mkdirSync(path.join(directories.chats, 'Character'), { recursive: true });
            fs.mkdirSync(directories.groupChats); fs.mkdirSync(directories.backups);
            fs.writeFileSync(path.join(directories.chats, 'Character', 'story.jsonl'), jsonl(baseline));
            fs.writeFileSync(path.join(directories.groupChats, 'cast-story.jsonl'), jsonl(baseline));
            accounts[handle] = { profile: { handle }, directories };
        }
        const native = express.Router();
        native.post('/generate', (req, res) => {
            if (req.body.api_type) return textCompletionsRouter.handle(req, res, error => res.destroy(error));
            calls.push(req.body);
            res.setHeader('Content-Type', 'text/event-stream');
            res.write('data: first\n\n');
            if (req.body.held) held.set(req.body.token, { req, res });
            else res.end('data: [DONE]\n\n');
        });
        let jobs = createGenerationJobsRouter(new Map([[endpoint, native]]));
        restartJobs = () => jobs = createGenerationJobsRouter(new Map([[endpoint, native]]));
        const app = express();
        app.use(express.json());
        app.use((req, res, next) => {
            req.user = accounts[req.get('X-Test-User') || 'user-a'];
            if (req.get('X-Test-Finish-During-Replay')) {
                const write = res.write.bind(res);
                let finished = false;
                res.write = (...args) => {
                    const result = write(...args);
                    if (!finished && String(args[0]).includes('"ready":true')) {
                        finished = true;
                        held.get('race').res.write('data: tail\n\n');
                        held.get('race').res.end('data: [DONE]\n\n');
                    }
                    return result;
                };
            }
            next();
        });
        app.post(endpoint, (req, res, next) => jobs.middleware(req, res, next));
        app.use('/api/generation-jobs', (req, res, next) => jobs.router(req, res, next));
        server = app.listen(0, '127.0.0.1');
        await once(server, 'listening');
        url = `http://127.0.0.1:${server.address().port}`;
    });
    afterEach(async () => {
        for (const { res } of held.values()) if (!res.destroyed && !res.writableEnded) res.end();
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
    });
    const story = (handle = 'user-a', kind = 'character') => JSON.stringify([handle, kind, kind === 'character' ? 'Character.png' : 'cast-id', kind === 'character' ? 'story' : 'cast-story', integrity]);
    const send = (route, body, handle = 'user-a', options = {}) => fetch(url + route, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', 'X-Test-User': handle, ...options.headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), ...options });
    const start = async (body = {}, identity = story()) => {
        const input = payload({ story: identity, body: { stream: true, ...body } });
        const response = await send('/api/generation-jobs', input);
        expect(response.status).toBe(202);
        return { input, job: await response.json() };
    };

    test('native endpoint middleware strips recovery metadata before native dispatch', async () => {
        const input = payload({ story: story() });
        const response = await send(endpoint, { ...input.body, __streamJob: { id: input.id, story: input.story, context: input.context } }, 'user-a', { headers: { 'Content-Type': 'application/json', 'X-Test-User': 'user-a', 'X-ST-Generation-Job': '1' } });
        expect(response.status).toBe(202);
        expect(response.headers.get('X-ST-Generation-Job')).toBe(input.id);
        expect(calls).toEqual([{ stream: true }]);
    });

    test('subscriber disconnect does not cancel inference; cursor replay is ordered without duplicate bytes', async () => {
        const { job } = await start({ held: true, token: 'live' });
        const controller = new AbortController();
        const response = await fetch(`${url}/api/generation-jobs/${job.id}/stream?after=0`, { signal: controller.signal });
        const reader = response.body.getReader();
        let first = '';
        while (!first.includes('"sequence":1')) first += new TextDecoder().decode((await reader.read()).value);
        expect(first).toContain('"sequence":1');
        controller.abort();
        await tick();
        expect(held.get('live').req.socket.destroyed).toBe(false);
        held.get('live').res.write('data: second\n\n');
        held.get('live').res.end('data: [DONE]\n\n');
        const replay = await send(`/api/generation-jobs/${job.id}/stream?after=1`);
        const frames = (await replay.text()).trim().split('\n').map(line => JSON.parse(line));
        expect(frames.filter(frame => frame.data).map(frame => frame.sequence)).toEqual([2, 3]);
        expect(frames.at(-1)).toMatchObject({ done: true, status: 'completed', sequence: 3 });
        expect(calls).toHaveLength(1);
    });

    test('completion during replay cannot skip queued tail chunks or send terminal status early', async () => {
        const { job } = await start({ held: true, token: 'race' });
        const replay = await fetch(`${url}/api/generation-jobs/${job.id}/stream`, { headers: { 'X-Test-Finish-During-Replay': '1' } });
        const frames = (await replay.text()).trim().split('\n').map(line => JSON.parse(line));
        expect(frames.filter(frame => frame.data).map(frame => frame.sequence)).toEqual([1, 2, 3]);
        expect(frames.at(-1)).toMatchObject({ done: true, status: 'completed', sequence: 3 });
    });

    test('the unchanged native HTTP provider adapter survives subscriber loss and explicit Stop cancels it', async () => {
        const provider = express();
        provider.use(express.json());
        const providerReplies = [];
        let arrived;
        provider.post('/v1/completions', (req, res) => {
            expect(req.body.__streamJob).toBeUndefined();
            res.setHeader('Content-Type', 'text/event-stream');
            res.write('data: {"choices":[{"text":"A native partial reply"}]}\n\n');
            providerReplies.push(res);
            arrived?.();
        });
        const providerServer = provider.listen(0, '127.0.0.1');
        await once(providerServer, 'listening');
        const apiServer = `http://127.0.0.1:${providerServer.address().port}`;
        try {
            const providerReady = new Promise(resolve => arrived = resolve);
            const { job } = await start({ api_type: 'generic', api_server: apiServer, prompt: 'A neutral story', max_tokens: 16 });
            await providerReady;
            const controller = new AbortController();
            const subscription = await fetch(`${url}/api/generation-jobs/${job.id}/stream`, { signal: controller.signal });
            const reader = subscription.body.getReader();
            let bytes = '';
            while (!bytes.includes('"sequence":1')) bytes += new TextDecoder().decode((await reader.read()).value);
            controller.abort();
            await tick();
            expect(providerReplies[0].destroyed).toBe(false);
            providerReplies[0].end('data: [DONE]\n\n');
            const replay = await send(`/api/generation-jobs/${job.id}/stream?after=1`);
            expect(await replay.text()).toContain('"status":"completed"');
            expect((await send(`/api/generation-jobs/${job.id}/ack`, {})).status).toBe(200);
            const nextReady = new Promise(resolve => arrived = resolve);
            const next = await start({ api_type: 'generic', api_server: apiServer, prompt: 'A second neutral story', max_tokens: 16 });
            await nextReady;
            const closed = once(providerReplies[1], 'close');
            expect((await send(`/api/generation-jobs/${next.job.id}/stop`, {})).status).toBe(200);
            await closed;
            expect(providerReplies[1].destroyed).toBe(true);
        } finally {
            providerServer.closeAllConnections();
            await new Promise(resolve => providerServer.close(resolve));
        }
    });

    test('accounts cannot list, stream, stop, commit or acknowledge another account job', async () => {
        const { job } = await start();
        expect(await (await send('/api/generation-jobs', undefined, 'user-b')).json()).toEqual([]);
        for (const [route, body] of [[`/${job.id}`, undefined], [`/${job.id}/stream`, undefined], [`/${job.id}/stop`, {}], [`/${job.id}/ack`, {}], [`/${job.id}/commit`, { chat: baseline }]]) {
            expect((await send('/api/generation-jobs' + route, body, 'user-b')).status).toBe(404);
        }
    });

    test('invalid future and negative cursors fail before opening a stream', async () => {
        const { job } = await start();
        for (const cursor of ['-1', '1.5', '999', 'NaN']) expect((await send(`/api/generation-jobs/${job.id}/stream?after=${cursor}`)).status).toBe(400);
    });

    test('native compare-and-save commits exactly once and a lost acknowledgement is idempotent', async () => {
        const { job } = await start();
        const candidate = [...baseline, { name: 'Character', is_user: false, mes: 'A complete reply', send_date: 'two' }];
        expect((await send(`/api/generation-jobs/${job.id}/commit`, { chat: candidate })).status).toBe(200);
        expect(fs.readFileSync(path.join(accounts['user-a'].directories.chats, 'Character', 'story.jsonl'), 'utf8')).toBe(jsonl(candidate));
        expect((await send(`/api/generation-jobs/${job.id}/commit`, { chat: candidate })).status).toBe(200);
        expect((await send(`/api/generation-jobs/${job.id}/commit`, { chat: baseline })).status).toBe(409);
        expect(await (await send('/api/generation-jobs')).json()).toEqual([]);
        expect((await send(`/api/generation-jobs/${job.id}/stream`)).status).toBe(410);
        expect(calls).toHaveLength(1);
        const receipt = JSON.parse(fs.readFileSync(path.join(accounts['user-a'].directories.root, 'generation-jobs', `${job.id}.json`), 'utf8'));
        expect(receipt.acknowledged).toBe(true);
        expect(receipt.context).toBeNull();
        expect(fs.existsSync(path.join(accounts['user-a'].directories.root, 'generation-jobs', `${job.id}.jsonl`))).toBe(false);
    });

    test('a restart reconciles a native save whose receipt failed without replaying new completion timestamps', async () => {
        const { input, job } = await start();
        const candidate = [...baseline, { name: 'Character', is_user: false, mes: 'A finished reply', gen_finished: '2026-11-09T22:00:00.000Z' }];
        const originalPersist = GenerationJobStore.prototype.persist;
        const persistence = jest.spyOn(GenerationJobStore.prototype, 'persist').mockImplementation(function (value) {
            if (value.record.acknowledged) throw Object.assign(new Error('Synthetic receipt failure'), { code: 'EIO' });
            return originalPersist.call(this, value);
        });
        expect((await send(`/api/generation-jobs/${job.id}/commit`, { chat: candidate })).status).toBe(500);
        const file = path.join(accounts['user-a'].directories.chats, 'Character', 'story.jsonl');
        expect(fs.readFileSync(file, 'utf8')).toBe(jsonl(candidate));
        const manifestFile = path.join(accounts['user-a'].directories.root, 'generation-jobs', `${job.id}.json`);
        expect(JSON.parse(fs.readFileSync(manifestFile, 'utf8'))).toMatchObject({ pendingCommitHash: crypto.createHash('sha256').update(jsonl(candidate)).digest('hex') });
        persistence.mockRestore();
        restartJobs();
        expect(await (await send('/api/generation-jobs?story=' + encodeURIComponent(input.story))).json()).toEqual([]);
        const restored = await (await send(`/api/generation-jobs/${job.id}`)).json();
        expect(restored).toMatchObject({ acknowledged: true, context: null });
        expect((await send(`/api/generation-jobs/${job.id}/stream`)).status).toBe(410);
        expect((await send('/api/generation-jobs', input)).status).toBe(202);
        expect(calls).toHaveLength(1);
        expect(fs.readFileSync(file, 'utf8')).toBe(jsonl(candidate));
    });

    test('a pending receipt does not reconcile over a different concurrent transcript', async () => {
        const { job } = await start();
        const candidate = [...baseline, { name: 'Character', is_user: false, mes: 'A completed reply' }];
        const originalPersist = GenerationJobStore.prototype.persist;
        const persistence = jest.spyOn(GenerationJobStore.prototype, 'persist').mockImplementation(function (value) {
            if (value.record.acknowledged) throw new Error('Synthetic receipt failure');
            return originalPersist.call(this, value);
        });
        expect((await send(`/api/generation-jobs/${job.id}/commit`, { chat: candidate })).status).toBe(500);
        persistence.mockRestore();
        const file = path.join(accounts['user-a'].directories.chats, 'Character', 'story.jsonl');
        const changed = [...candidate, { name: 'User', is_user: true, mes: 'A later edit' }];
        fs.writeFileSync(file, jsonl(changed));
        restartJobs();
        expect(await (await send('/api/generation-jobs')).json()).toHaveLength(1);
        expect((await send(`/api/generation-jobs/${job.id}/commit`, { chat: candidate })).status).toBe(409);
        expect(fs.readFileSync(file, 'utf8')).toBe(jsonl(changed));
    });

    test('failed write-ahead persistence leaves the native transcript unchanged and retryable', async () => {
        const { job } = await start();
        const candidate = [...baseline, { name: 'Character', is_user: false, mes: 'A pending reply' }];
        const originalPersist = GenerationJobStore.prototype.persist;
        const persistence = jest.spyOn(GenerationJobStore.prototype, 'persist').mockImplementation(function (value) {
            if (value.record.pendingCommitHash) throw new Error('Synthetic intent write failure');
            return originalPersist.call(this, value);
        });
        expect((await send(`/api/generation-jobs/${job.id}/commit`, { chat: candidate })).status).toBe(500);
        const file = path.join(accounts['user-a'].directories.chats, 'Character', 'story.jsonl');
        expect(fs.readFileSync(file, 'utf8')).toBe(jsonl(baseline));
        persistence.mockRestore();
        expect(await (await send('/api/generation-jobs')).json()).toHaveLength(1);
        expect((await send(`/api/generation-jobs/${job.id}/commit`, { chat: candidate })).status).toBe(200);
    });

    test('concurrent different final candidates cannot replace the committed write-ahead receipt', async () => {
        const { job } = await start();
        const first = [...baseline, { name: 'Character', is_user: false, mes: 'First candidate', gen_finished: 'first-time' }];
        const second = [...baseline, { name: 'Character', is_user: false, mes: 'Second candidate', gen_finished: 'second-time' }];
        const responses = await Promise.all([send(`/api/generation-jobs/${job.id}/commit`, { chat: first }), send(`/api/generation-jobs/${job.id}/commit`, { chat: second })]);
        expect(responses.map(response => response.status).sort()).toEqual([200, 409]);
        const successful = [first, second][responses.findIndex(response => response.status === 200)];
        const file = path.join(accounts['user-a'].directories.chats, 'Character', 'story.jsonl');
        expect(fs.readFileSync(file, 'utf8')).toBe(jsonl(successful));
        const manifestFile = path.join(accounts['user-a'].directories.root, 'generation-jobs', `${job.id}.json`);
        const receipt = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
        expect(receipt.committedHash).toBe(crypto.createHash('sha256').update(jsonl(successful)).digest('hex'));
        expect(receipt.pendingCommitHash).toBe(receipt.committedHash);
    });

    test('same-integrity concurrent edit is never overwritten and leaves reply replay available', async () => {
        const { job } = await start();
        const file = path.join(accounts['user-a'].directories.chats, 'Character', 'story.jsonl');
        const external = [...baseline, { name: 'User', is_user: true, mes: 'Concurrent edit' }];
        fs.writeFileSync(file, jsonl(external));
        const candidate = [...baseline, { name: 'Character', is_user: false, mes: 'Late reply' }];
        const response = await send(`/api/generation-jobs/${job.id}/commit`, { chat: candidate });
        expect(response.status).toBe(409);
        expect(fs.readFileSync(file, 'utf8')).toBe(jsonl(external));
        expect((await (await send('/api/generation-jobs')).json())).toHaveLength(1);
        expect((await send(`/api/generation-jobs/${job.id}/stream`)).status).toBe(200);
    });

    test('deleting the original transcript causes a conflict instead of recreating it', async () => {
        const { job } = await start();
        const file = path.join(accounts['user-a'].directories.chats, 'Character', 'story.jsonl');
        fs.unlinkSync(file);
        expect((await send(`/api/generation-jobs/${job.id}/commit`, { chat: baseline })).status).toBe(409);
        expect(fs.existsSync(file)).toBe(false);
    });

    test('group commit uses the native group transcript path and metadata header', async () => {
        const { job } = await start({}, story('user-a', 'group'));
        const candidate = [...baseline, { name: 'Member', is_user: false, mes: 'A cast reply' }];
        expect((await send(`/api/generation-jobs/${job.id}/commit`, { chat: candidate })).status).toBe(200);
        expect(fs.readFileSync(path.join(accounts['user-a'].directories.groupChats, 'cast-story.jsonl'), 'utf8')).toBe(jsonl(candidate));
    });

    test('running reply cannot commit or acknowledge', async () => {
        const { job } = await start({ held: true, token: 'pending' });
        for (const [action, data] of [['commit', { chat: baseline }], ['ack', {}]]) expect((await send(`/api/generation-jobs/${job.id}/${action}`, data)).status).toBe(409);
        expect((await send(`/api/generation-jobs/${job.id}/stop`, {})).status).toBe(200);
    });

    test('target validation rejects traversal and cross-account identities', () => {
        for (const value of [JSON.stringify(['user-b', 'character', 'Character.png', 'story', integrity]), JSON.stringify(['user-a', 'character', '../Character.png', 'story', integrity]), JSON.stringify(['user-a', 'group', 'cast', '../story', integrity]), 'null', '{}']) {
            expect(() => generationTarget(value, { user: accounts['user-a'] })).toThrow();
        }
    });

    test('native CAS checks after the awaited integrity read, preserving an interleaving edit', async () => {
        const file = path.join(accounts['user-a'].directories.chats, 'Character', 'story.jsonl');
        const expected = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
        const saving = trySaveChat(baseline, file, false, 'user-a', 'Character', accounts['user-a'].directories.backups, expected);
        const external = [...baseline, { name: 'User', is_user: true, mes: 'An edit during integrity I/O' }];
        fs.writeFileSync(file, jsonl(external));
        await expect(saving).rejects.toMatchObject({ status: 409 });
        expect(fs.readFileSync(file, 'utf8')).toBe(jsonl(external));
    });
});
