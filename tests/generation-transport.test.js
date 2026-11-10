/* eslint-disable playwright/no-standalone-expect -- This suite uses Jest. */
import { describe, expect, jest, test } from '@jest/globals';
import fs from 'node:fs';
import vm from 'node:vm';

const encoder = new TextEncoder();
const header = (httpStatus = 200) => ({ ready: true, httpStatus, headers: { 'Content-Type': 'text/event-stream' } });
const data = (sequence, bytes) => ({ sequence, data: Buffer.from(bytes).toString('base64') });
const end = (status = 'completed', error = undefined) => ({ done: true, status, httpStatus: 200, headers: { 'Content-Type': 'text/event-stream' }, error });
const lines = frames => encoder.encode(frames.map(frame => JSON.stringify(frame)).join('\n') + '\n');

function replay(frames, { signal, hold = false } = {}) {
    let controller;
    let closed = false;
    const stream = new ReadableStream({
        start(value) {
            controller = value;
            value.enqueue(lines(frames));
            if (!hold) { closed = true; value.close(); }
            signal?.addEventListener('abort', () => {
                if (!closed) { closed = true; value.error(new DOMException('Subscription closed.', 'AbortError')); }
            }, { once: true });
        },
        cancel() { closed = true; },
    });
    return {
        response: new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson' } }),
        append: (...frames) => controller.enqueue(lines(frames)),
    };
}

async function transport(fetch) {
    const context = vm.createContext({
        fetch, ReadableStream, Response, TextDecoderStream, Uint8Array, AbortController, DOMException, atob,
        clearTimeout,
        // Retry sequencing is real; only the backoff is shortened. Keep the
        // subscription watchdog long enough that stalled tests fail explicitly.
        setTimeout: (callback, ms) => setTimeout(callback, ms < 1000 ? 1 : ms),
    });
    const script = new vm.SyntheticModule(['getRequestHeaders'], function () {
        this.setExport('getRequestHeaders', () => ({ 'X-CSRF-Token': 'synthetic-csrf' }));
    }, { context });
    const source = fs.readFileSync(new URL('../public/scripts/generation-transport.js', import.meta.url), 'utf8');
    const module = new vm.SourceTextModule(source, { context });
    await module.link(specifier => {
        if (specifier !== '../script.js') throw new Error(`Unexpected transport dependency: ${specifier}`);
        return script;
    });
    await module.evaluate();
    return module.namespace;
}

const job = () => ({ id: '00000000-0000-4000-8000-000000000001', story: '["account","character","card.png","story","integrity"]', status: 'running' });

describe('durable generation byte transport', () => {
    test('parser cancellation settles the subscriber without stopping or falsely committing the server reply', async () => {
        const fetch = jest.fn(async (url, init) => {
            if (url.includes('/stream?')) return replay([header(), data(1, 'data: partial\n\n')], { hold: true, signal: init.signal }).response;
            if (url.endsWith('/commit')) return Response.json({ error: 'Reply is still running' }, { status: 409 });
            throw new Error(`Unexpected request: ${url}`);
        });
        const api = await transport(fetch); const pending = job();
        const response = await api.openGenerationResponse(pending, new AbortController().signal);
        const reader = response.body.getReader();
        expect(new TextDecoder().decode((await reader.read()).value)).toBe('data: partial\n\n');
        await reader.cancel();
        await expect(api.commitGeneration(pending, [])).rejects.toThrow('cancellation is not confirmed');
        expect(fetch.mock.calls.some(([url]) => url.endsWith('/stop'))).toBe(false);
        expect(pending.status).toBe('running');
    });
    test('requests without a registered reply lifetime retain native fetch behavior', async () => {
        const native = new Response('data: native\n\n');
        const fetch = jest.fn().mockResolvedValue(native);
        const api = await transport(fetch);
        const init = { method: 'POST', body: '{"stream":true}', signal: new AbortController().signal };
        expect(await api.fetchGeneration('/api/backends/chat-completions/generate', init)).toBe(native);
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(fetch).toHaveBeenCalledWith('/api/backends/chat-completions/generate', init);
    });

    test('a lost start acknowledgement retries one job id and preserves the native request payload', async () => {
        const descriptor = { ...job(), story: '["account","character","card.png","story","integrity"]', context: { version: 1 }, onStatus: jest.fn() };
        const fetch = jest.fn()
            .mockRejectedValueOnce(new TypeError('Synthetic lost start acknowledgement'))
            .mockResolvedValueOnce(Response.json(job(), { status: 202, headers: { 'X-ST-Generation-Job': descriptor.id } }))
            .mockResolvedValueOnce(replay([header(), data(1, 'data: reply\n\n'), end()]).response);
        const api = await transport(fetch);
        const signal = new AbortController().signal;
        api.registerGenerationTransport(signal, descriptor);
        const response = await api.fetchGeneration('/api/backends/chat-completions/generate', {
            method: 'POST', body: JSON.stringify({ stream: true, messages: [{ role: 'user', content: 'Neutral test' }] }),
            headers: { 'X-CSRF-Token': 'synthetic-csrf' }, signal,
        });
        expect(await response.text()).toBe('data: reply\n\n');
        expect(fetch).toHaveBeenCalledTimes(3);
        const attempts = fetch.mock.calls.slice(0, 2);
        expect(attempts[0][0]).toBe(attempts[1][0]);
        expect(attempts[0][1].body).toBe(attempts[1][1].body);
        expect(JSON.parse(attempts[0][1].body)).toEqual({
            stream: true, messages: [{ role: 'user', content: 'Neutral test' }],
            __streamJob: { id: descriptor.id, story: descriptor.story, context: descriptor.context },
        });
        expect(attempts[0][1].headers['X-ST-Generation-Job']).toBe('1');
        expect(fetch.mock.calls[2][0].endsWith('/stream?after=0')).toBe(true);
    });

    test('a truncated start acknowledgement retries the same job identity and full request body', async () => {
        const descriptor = { ...job(), context: { version: 1 }, onStatus: jest.fn() };
        const headers = { 'X-ST-Generation-Job': descriptor.id, 'Content-Type': 'application/json' };
        const fetch = jest.fn()
            .mockResolvedValueOnce(new Response('{"id":', { status: 202, headers }))
            .mockResolvedValueOnce(Response.json(job(), { status: 202, headers }))
            .mockResolvedValueOnce(replay([header(), data(1, 'Recovered acknowledgement'), end()]).response);
        const api = await transport(fetch);
        const signal = new AbortController().signal;
        api.registerGenerationTransport(signal, descriptor);
        const response = await api.fetchGeneration('/api/backends/chat-completions/generate', { method: 'POST', body: '{"stream":true}', signal });
        expect(await response.text()).toBe('Recovered acknowledgement');
        expect(fetch).toHaveBeenCalledTimes(3);
        expect(fetch.mock.calls[0][0]).toBe(fetch.mock.calls[1][0]);
        expect(fetch.mock.calls[0][1].body).toBe(fetch.mock.calls[1][1].body);
        expect(JSON.parse(fetch.mock.calls[1][1].body).__streamJob.id).toBe(descriptor.id);
        expect(descriptor.onStatus).toHaveBeenCalledWith('Reconnecting to your reply…');
    });

    test('the submitted parser descriptor pins the source and actual swipe count before the request', async () => {
        const fetch = jest.fn().mockResolvedValue(new Response('data: native\n\n'));
        const api = await transport(fetch);
        const signal = new AbortController().signal;
        const descriptor = { ...job(), context: { version: 1, parser: { source: 'previous-source', n: 1, retainedFlag: true } } };
        api.registerGenerationTransport(signal, descriptor);
        api.setGenerationParser(signal, { source: 'custom', showThoughts: true, canMultiSwipe: true, textgenType: 'vllm' });
        const response = await api.fetchGeneration('/api/backends/chat-completions/generate', { signal, body: '{"stream":true,"n":3}' });
        expect(await response.text()).toBe('data: native\n\n');
        expect(JSON.parse(fetch.mock.calls[0][1].body).__streamJob.context.parser).toEqual({
            source: 'custom', n: 3, retainedFlag: true, showThoughts: true, canMultiSwipe: true, textgenType: 'vllm',
        });
    });

    test('a native intercepted response keeps its parser protocol when no relay header is present', async () => {
        const native = new Response('data: mock provider\n\n');
        const fetch = jest.fn().mockResolvedValue(native);
        const api = await transport(fetch);
        const signal = new AbortController().signal;
        api.registerGenerationTransport(signal, { ...job(), story: 'synthetic', context: {} });
        expect(await api.fetchGeneration('/api/backends/text-completions/generate', { signal, body: '{}' })).toBe(native);
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    test('disconnect resumes after the last applied cursor, deduplicates overlap, and preserves split UTF-8 bytes', async () => {
        const utf8 = Buffer.from('A☃B');
        const fetch = jest.fn()
            .mockResolvedValueOnce(replay([header(), data(1, utf8.subarray(0, 2)), data(2, utf8.subarray(2, 3))]).response)
            .mockResolvedValueOnce(replay([header(), data(2, utf8.subarray(2, 3)), data(3, utf8.subarray(3)), end()]).response);
        const api = await transport(fetch);
        const status = jest.fn();
        const response = await api.openGenerationResponse(job(), new AbortController().signal, status);
        expect(await response.text()).toBe('A☃B');
        expect(fetch).toHaveBeenCalledTimes(2);
        expect(fetch.mock.calls[0][0].endsWith('/stream?after=0')).toBe(true);
        expect(fetch.mock.calls[1][0].endsWith('/stream?after=2')).toBe(true);
        expect(fetch.mock.calls.every(([url]) => url.includes('/stream?'))).toBe(true);
        expect(status).toHaveBeenCalledWith('Reconnecting to your reply…');
    });

    test('a fresh parser after reload replays from zero without invoking the provider endpoint', async () => {
        const fetch = jest.fn().mockImplementation(() => Promise.resolve(replay([header(), data(1, 'retained reply'), end()]).response));
        const first = await transport(fetch);
        const second = await transport(fetch);
        expect(await (await first.openGenerationResponse(job(), new AbortController().signal)).text()).toBe('retained reply');
        expect(await (await second.openGenerationResponse(job(), new AbortController().signal)).text()).toBe('retained reply');
        expect(fetch.mock.calls.map(([url]) => url)).toEqual([
            `/api/generation-jobs/${job().id}/stream?after=0`,
            `/api/generation-jobs/${job().id}/stream?after=0`,
        ]);
    });

    test('foreground synchronization replaces a stalled subscription at its applied cursor', async () => {
        const fetch = jest.fn().mockImplementation((_url, init) => Promise.resolve(fetch.mock.calls.length === 1
            ? replay([header(), data(1, 'Before ')], { signal: init.signal, hold: true }).response
            : replay([header(), data(2, 'resume'), end()]).response));
        const api = await transport(fetch);
        const response = await api.openGenerationResponse(job(), new AbortController().signal);
        const reader = response.body.getReader();
        expect(new TextDecoder().decode((await reader.read()).value)).toBe('Before ');
        api.refreshGenerationSubscriptions();
        expect(new TextDecoder().decode((await reader.read()).value)).toBe('resume');
        expect((await reader.read()).done).toBe(true);
        expect(fetch).toHaveBeenCalledTimes(2);
        expect(fetch.mock.calls[1][0].endsWith('/stream?after=1')).toBe(true);
        expect(fetch.mock.calls.some(([url]) => url.endsWith('/stop'))).toBe(false);
    });

    test('explicit native Stop cancels the server job and rejects the retained parser', async () => {
        const native = new AbortController();
        const fetch = jest.fn().mockImplementation((url, init) => {
            if (url.endsWith('/stop')) return Promise.resolve(Response.json({ ...job(), status: 'stopped' }));
            return Promise.resolve(replay([header()], { signal: init.signal, hold: true }).response);
        });
        const api = await transport(fetch);
        const response = await api.openGenerationResponse(job(), native.signal);
        const result = response.text();
        const outcome = result.catch(error => error);
        native.abort();
        await expect(outcome).resolves.toMatchObject({ message: 'Reply stopped.' });
        expect(fetch.mock.calls.filter(([url]) => url.endsWith('/stop'))).toHaveLength(1);
        expect(fetch.mock.calls.find(([url]) => url.endsWith('/stop'))[1]).toMatchObject({ method: 'POST', keepalive: true });
    });

    test('Stop before provider headers rejects the pending attachment and still cancels the job', async () => {
        const native = new AbortController();
        const fetch = jest.fn().mockImplementation((url, init) => {
            if (url.endsWith('/stop')) return Promise.resolve(Response.json({ ...job(), status: 'stopped' }));
            return new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new DOMException('Detached.', 'AbortError')), { once: true }));
        });
        const api = await transport(fetch);
        const pending = api.openGenerationResponse(job(), native.signal);
        const outcome = pending.catch(error => error);
        native.abort();
        await expect(outcome).resolves.toMatchObject({ message: 'Reply stopped.' });
        expect(fetch.mock.calls.filter(([url]) => url.endsWith('/stop'))).toHaveLength(1);
    });

    test('Stop during a lost start acknowledgement also cancels the already identified server job', async () => {
        const native = new AbortController();
        const fetch = jest.fn().mockImplementation((url, init) => {
            if (url.endsWith('/stop')) return Promise.resolve(Response.json({ ...job(), status: 'stopped' }));
            return new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new DOMException('Start response lost.', 'AbortError')), { once: true }));
        });
        const api = await transport(fetch);
        api.registerGenerationTransport(native.signal, { ...job(), story: 'synthetic', context: {} });
        const pending = api.fetchGeneration('/api/backends/chat-completions/generate', { signal: native.signal, method: 'POST', body: '{}' });
        const outcome = pending.catch(error => error);
        native.abort();
        await expect(outcome).resolves.toMatchObject({ message: 'Start response lost.' });
        expect(fetch.mock.calls.filter(([url]) => url.endsWith('/stop'))).toHaveLength(1);
    });

    test('Stop after partial output waits for its server receipt before settling or committing the reply', async () => {
        const native = new AbortController();
        let acknowledgeStop;
        const fetch = jest.fn().mockImplementation((url, init) => {
            if (url.endsWith('/stop')) return new Promise(resolve => { acknowledgeStop = () => resolve(Response.json({ ...job(), status: 'stopped' })); });
            if (url.endsWith('/commit')) return Promise.resolve(Response.json({ ok: true }));
            return Promise.resolve(replay([header(), data(1, 'Partial reply')], { signal: init.signal, hold: true }).response);
        });
        const api = await transport(fetch);
        const saved = job();
        const response = await api.openGenerationResponse(saved, native.signal);
        const reader = response.body.getReader();
        expect(new TextDecoder().decode((await reader.read()).value)).toBe('Partial reply');
        let settled = false;
        saved.settled.then(() => { settled = true; });
        const pendingRead = reader.read().catch(error => error);
        native.abort();
        const commit = api.commitGeneration(saved, [{ chat_metadata: { integrity: 'synthetic' } }, { mes: 'Partial reply' }]);
        await new Promise(resolve => setTimeout(resolve, 5));
        expect(settled).toBe(false);
        expect(fetch.mock.calls.filter(([url]) => url.endsWith('/stop'))).toHaveLength(1);
        expect(fetch.mock.calls.filter(([url]) => url.endsWith('/commit'))).toHaveLength(0);
        acknowledgeStop();
        await expect(pendingRead).resolves.toMatchObject({ name: 'AbortError', message: 'Reply stopped.' });
        await expect(commit).resolves.toBe(true);
        expect(settled).toBe(true);
        expect(fetch.mock.calls.filter(([url]) => url.endsWith('/commit'))).toHaveLength(1);
    });

    test('a truncated Stop receipt retries cancellation before reporting the native abort', async () => {
        const native = new AbortController();
        let cancellations = 0;
        const fetch = jest.fn().mockImplementation((url, init) => {
            if (url.endsWith('/stop')) {
                cancellations++;
                return Promise.resolve(cancellations === 1
                    ? new Response('{"id":', { headers: { 'Content-Type': 'application/json' } })
                    : Response.json({ ...job(), status: 'stopped' }));
            }
            return Promise.resolve(replay([header()], { signal: init.signal, hold: true }).response);
        });
        const api = await transport(fetch);
        const response = await api.openGenerationResponse(job(), native.signal);
        const outcome = response.text().catch(error => error);
        native.abort();
        await expect(outcome).resolves.toMatchObject({ name: 'AbortError', message: 'Reply stopped.' });
        expect(cancellations).toBe(2);
        expect(fetch.mock.calls.filter(([url]) => url.endsWith('/stop')).map(([, init]) => init.body)).toEqual([undefined, undefined]);
    });

    test('parser detachment closes only its subscription and never requests Stop', async () => {
        const fetch = jest.fn().mockImplementation((_url, init) => Promise.resolve(replay([header()], { signal: init.signal, hold: true }).response));
        const api = await transport(fetch);
        const response = await api.openGenerationResponse(job(), new AbortController().signal);
        await response.body.cancel();
        await new Promise(resolve => setTimeout(resolve, 5));
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
        expect(fetch.mock.calls.some(([url]) => url.endsWith('/stop'))).toBe(false);
    });

    test('a restarted server terminalizes the retained partial stream without repeating inference', async () => {
        let feed;
        const fetch = jest.fn().mockImplementation((_url, init) => {
            feed = replay([header(), data(1, 'Partial reply')], { signal: init.signal, hold: true });
            return Promise.resolve(feed.response);
        });
        const api = await transport(fetch);
        const saved = job();
        const response = await api.openGenerationResponse(saved, new AbortController().signal);
        const reader = response.body.getReader();
        expect(new TextDecoder().decode((await reader.read()).value)).toBe('Partial reply');
        const next = reader.read();
        const outcome = next.catch(error => error);
        feed.append(end('interrupted', 'Server restarted.'));
        await expect(outcome).resolves.toMatchObject({ message: 'Server restarted.' });
        expect(saved.status).toBe('interrupted');
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    test('partial bytes coalesced with an interrupted terminal remain readable before the terminal error', async () => {
        const fetch = jest.fn().mockResolvedValue(replay([
            header(), data(1, 'Partial reply before interruption'), end('interrupted', 'Server restarted.'),
        ]).response);
        const api = await transport(fetch);
        const response = await api.openGenerationResponse(job(), new AbortController().signal);
        const reader = response.body.getReader();
        expect(new TextDecoder().decode((await reader.read()).value)).toBe('Partial reply before interruption');
        await expect(reader.read()).rejects.toThrow('Server restarted.');
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    test.each([401, 403, 404])('permanent subscription HTTP %s fails instead of retrying forever', async status => {
        const fetch = jest.fn().mockResolvedValue(new Response(null, { status }));
        const api = await transport(fetch);
        await expect(api.openGenerationResponse(job(), new AbortController().signal)).rejects.toThrow(`Reply subscription failed (${status}).`);
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    test.each([408, 429, 503])('temporary subscription HTTP %s reconnects without invoking inference', async status => {
        const fetch = jest.fn()
            .mockResolvedValueOnce(new Response(null, { status }))
            .mockResolvedValueOnce(replay([header(), data(1, 'Reply after retry'), end()]).response);
        const api = await transport(fetch);
        const response = await api.openGenerationResponse(job(), new AbortController().signal);
        expect(await response.text()).toBe('Reply after retry');
        expect(fetch).toHaveBeenCalledTimes(2);
        expect(fetch.mock.calls.every(([url]) => url.endsWith('/stream?after=0'))).toBe(true);
    });

    test('a corrupt journal frame fails visibly instead of reconnecting indefinitely', async () => {
        const fetch = jest.fn().mockResolvedValue(new Response('{corrupt frame}\n', { headers: { 'Content-Type': 'application/x-ndjson' } }));
        const api = await transport(fetch);
        await expect(api.openGenerationResponse(job(), new AbortController().signal)).rejects.toThrow('The saved reply stream is invalid.');
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    test('a missing sequence fails visibly instead of accepting a truncated reply', async () => {
        const fetch = jest.fn().mockResolvedValue(replay([header(), data(2, 'Skipped first chunk')]).response);
        const api = await transport(fetch);
        const response = await api.openGenerationResponse(job(), new AbortController().signal);
        await expect(response.text()).rejects.toThrow('Reply replay has a missing sequence.');
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    test('native non-success status is available before parsing an error response', async () => {
        const fetch = jest.fn().mockResolvedValue(replay([header(503), data(1, '{"error":"provider unavailable"}'), { ...end('failed'), httpStatus: 503 }]).response);
        const api = await transport(fetch);
        const response = await api.openGenerationResponse(job(), new AbortController().signal);
        expect(response.status).toBe(503);
        expect(response.ok).toBe(false);
        expect(response.headers.get('Content-Type')).toBe('text/event-stream');
        expect(await response.text()).toBe('{"error":"provider unavailable"}');
    });

    test('saving after provider DONE waits for the separate durable terminal receipt', async () => {
        let feed;
        const fetch = jest.fn().mockImplementation((url, init) => {
            if (url.endsWith('/commit')) return Promise.resolve(Response.json({ ok: true }));
            feed = replay([header(), data(1, 'data: [DONE]\n\n')], { signal: init.signal, hold: true });
            return Promise.resolve(feed.response);
        });
        const api = await transport(fetch);
        const saved = job();
        const response = await api.openGenerationResponse(saved, new AbortController().signal);
        const reader = response.body.getReader();
        expect(new TextDecoder().decode((await reader.read()).value)).toBe('data: [DONE]\n\n');
        const commit = api.commitGeneration(saved, [{ chat_metadata: { integrity: 'synthetic' } }, { mes: 'Final reply' }]);
        await new Promise(resolve => setTimeout(resolve, 5));
        expect(fetch.mock.calls.filter(([url]) => url.endsWith('/commit'))).toHaveLength(0);
        feed.append(end());
        await expect(commit).resolves.toBe(true);
        expect(fetch.mock.calls.filter(([url]) => url.endsWith('/commit'))).toHaveLength(1);
        expect(saved.status).toBe('completed');
        expect((await reader.read()).done).toBe(true);
    });

    test('concurrent-edit commit conflict preserves the job and performs no acknowledgement or deletion', async () => {
        const fetch = jest.fn().mockResolvedValue(Response.json({ error: 'revision conflict' }, { status: 409 }));
        const api = await transport(fetch);
        const saved = job();
        const chat = [{ chat_metadata: { integrity: 'synthetic' } }, { mes: 'Retained reply', is_user: false }];
        await expect(api.commitGeneration(saved, chat)).rejects.toThrow('This story changed in another tab.');
        expect(saved).toEqual(job());
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(fetch.mock.calls[0][0]).toBe(`/api/generation-jobs/${saved.id}/commit`);
        expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ chat });
    });
});
