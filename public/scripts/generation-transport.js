import { getRequestHeaders } from '../script.js';

// The native provider parsers consume one continuous byte stream. Its lifetime
// is independent of each HTTP subscription; reconnects resume after durable bytes.
const contexts = new WeakMap();
const subscriptions = new Set();

export function registerGenerationTransport(signal, descriptor) {
    contexts.set(signal, descriptor);
}

export function setGenerationParser(signal, parser) {
    const context = contexts.get(signal)?.context;
    if (context) context.parser = { ...context.parser, ...parser };
}

export function refreshGenerationSubscriptions() {
    for (const subscription of subscriptions) subscription.controller?.abort();
}

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

async function stopJob(id) {
    // A dropped subscription is not Stop. Only the native abort signal calls here.
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const response = await fetch(`/api/generation-jobs/${encodeURIComponent(id)}/stop`, {
                method: 'POST', headers: getRequestHeaders(), keepalive: true,
            });
            if (response.ok) return await response.json();
            if (response.status === 404 && attempt === 2) return;
        } catch { /* Retry the same cancellation, never inference. */ }
        await pause(500 * (attempt + 1));
    }
}

/** Fetch through the relay only for a native reply with an assigned lifetime. */
export async function fetchGeneration(endpoint, init) {
    const descriptor = contexts.get(init.signal);
    if (!descriptor) return fetch(endpoint, init);
    const stopBeforeAcknowledgement = () => void stopJob(descriptor.id);
    init.signal.addEventListener('abort', stopBeforeAcknowledgement, { once: true });
    try {
        const body = { ...JSON.parse(String(init.body)), __streamJob: {
            id: descriptor.id, story: descriptor.story, context: descriptor.context,
        } };
        descriptor.context.parser ||= {};
        descriptor.context.parser.n = Number(body.n) || 1;
        for (;;) {
            init.signal.throwIfAborted();
            try {
                const response = await fetch(endpoint, { ...init, headers: { ...init.headers, 'X-ST-Generation-Job': '1' }, body: JSON.stringify(body) });
                // An acknowledgement includes its complete JSON body. A reset
                // after headers still retries the same persisted job intent.
                if (!response.headers.get('X-ST-Generation-Job')) return response;
                if (!response.ok) throw Object.assign(new Error((await response.json()).error || 'The reply could not start.'), { terminal: true });
                const job = await response.json();
                if (job.id !== descriptor.id || job.story !== descriptor.story) throw Object.assign(new Error('The reply acknowledgement did not match this story.'), { terminal: true });
                descriptor.job = job;
                break;
            } catch (error) {
                if (init.signal.aborted || error.terminal) throw error;
                descriptor.onStatus?.('Reconnecting to your reply…');
                await pause(750);
            }
        }
        descriptor.onStatus?.('');
        return await openGenerationResponse(descriptor.job, init.signal, descriptor.onStatus);
    } finally {
        init.signal.removeEventListener('abort', stopBeforeAcknowledgement);
    }
}

/** Reconstruct a fresh parser from byte zero after reload; retained parsers use cursors. */
export async function openGenerationResponse(job, signal, onStatus = () => {}) {
    let settle;
    job.settled = new Promise(resolve => { settle = resolve; });
    let sequence = 0;
    let responseReady;
    let responseFailed;
    const ready = new Promise((resolve, reject) => { responseReady = resolve; responseFailed = reject; });
    const subscription = { controller: null };
    subscriptions.add(subscription);
    let receivedHeaders = false;
    let cancelled = false;
    let stopRequested = false;
    let releaseDemand;
    let stopReceipt;
    const abort = () => {
        stopRequested = true;
        subscription.controller?.abort();
        releaseDemand?.();
        stopReceipt = stopJob(job.id);
    };
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    const body = new ReadableStream({
        start(controller) {
            void (async () => {
                try {
                    while (!cancelled && !stopRequested) {
                        const attempt = subscription.controller = new AbortController();
                        let watchdog;
                        const touch = () => { clearTimeout(watchdog); watchdog = setTimeout(() => attempt.abort(), 30000); };
                        touch();
                        try {
                            const response = await fetch(`/api/generation-jobs/${encodeURIComponent(job.id)}/stream?after=${sequence}`, {
                                headers: getRequestHeaders(), signal: attempt.signal, cache: 'no-store',
                            });
                            if (!response.ok) throw Object.assign(new Error(`Reply subscription failed (${response.status}).`), { terminal: response.status >= 400 && response.status < 500 && ![408, 429].includes(response.status) });
                            const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
                            let pending = '';
                            while (!cancelled && !stopRequested) {
                                const { done, value } = await reader.read();
                                if (done) break;
                                touch();
                                pending += value;
                                let end;
                                while ((end = pending.indexOf('\n')) !== -1) {
                                    const line = pending.slice(0, end); pending = pending.slice(end + 1);
                                    if (!line.trim()) continue;
                                    let frame;
                                    try { frame = JSON.parse(line); } catch { throw Object.assign(new Error('The saved reply stream is invalid.'), { terminal: true }); }
                                    if (frame.ready || frame.headers || frame.done) {
                                        job.httpStatus = frame.httpStatus || job.httpStatus || 200;
                                        if (!receivedHeaders) {
                                            receivedHeaders = true;
                                            responseReady({ status: frame.httpStatus || 200, headers: frame.responseHeaders || (typeof frame.headers === 'object' ? frame.headers : {}) });
                                        }
                                    }
                                    if (frame.data && frame.sequence > sequence) {
                                        if (frame.sequence !== sequence + 1) throw Object.assign(new Error('Reply replay has a missing sequence.'), { terminal: true });
                                        controller.enqueue(Uint8Array.from(atob(frame.data), char => char.charCodeAt(0)));
                                        sequence = frame.sequence;
                                        job.sequence = sequence;
                                        onStatus('');
                                        // Preserve queued partial bytes before a terminal error.
                                        // ReadableStream.error otherwise discards its whole queue.
                                        if (controller.desiredSize <= 0 && !stopRequested && !cancelled) await new Promise(resolve => { releaseDemand = resolve; });
                                    }
                                    if (frame.done) {
                                        job.status = frame.status;
                                        job.sequence = frame.sequence ?? sequence;
                                        settle();
                                        if (frame.status !== 'completed' && job.httpStatus < 400) throw Object.assign(new Error(frame.error || 'The reply was interrupted.'), { terminal: true });
                                        controller.close();
                                        return;
                                    }
                                }
                            }
                            if (!cancelled && !stopRequested) onStatus('Reconnecting to your reply…');
                        } catch (error) {
                            if (error.terminal) throw error;
                            if (!cancelled && !stopRequested) onStatus('Reconnecting to your reply…');
                        } finally { clearTimeout(watchdog); }
                        if (!cancelled && !stopRequested) await pause(750);
                    }
                    if (!cancelled) {
                        const receipt = await stopReceipt;
                        if (receipt) { job.status = receipt.status; job.httpStatus = receipt.httpStatus; job.sequence = receipt.sequence; }
                        throw new DOMException('Reply stopped.', 'AbortError');
                    }
                } catch (error) {
                    settle();
                    responseFailed(error);
                    if (!cancelled) controller.error(error);
                } finally {
                    settle();
                    subscriptions.delete(subscription);
                    signal.removeEventListener('abort', abort);
                    subscription.controller?.abort();
                }
            })();
        },
        pull() { releaseDemand?.(); releaseDemand = null; },
        cancel() {
            // Parser cancellation detaches this subscriber. It does not cancel
            // the independently owned generation or discard its journal.
            cancelled = true;
            settle();
            releaseDemand?.();
            subscription.controller?.abort();
        },
    });
    try {
        const metadata = await ready;
        return new Response(body, metadata);
    } catch (error) {
        await body.cancel().catch(() => {});
        throw error;
    }
}

export async function commitGeneration(job, chat) {
    // A provider's [DONE] can precede the relay's durable terminal receipt.
    await job.settled;
    const response = await fetch(`/api/generation-jobs/${encodeURIComponent(job.id)}/commit`, {
        method: 'POST', headers: getRequestHeaders(), body: JSON.stringify({ chat }),
    });
    if (!response.ok) {
        let detail;
        try { detail = (await response.json()).error; } catch { /* Preserve the recovery copy. */ }
        if (response.status === 409 && /still running/i.test(detail)) throw new Error('Reply cancellation is not confirmed yet. Your reply is retained on the server. Retry the connection.');
        if (response.status === 409) throw new Error('This story changed in another tab. Your reply is retained on the server; reload the story before saving it.');
        throw new Error('Your reply is retained on the server, but the story could not be saved. Retry the connection.');
    }
    return true;
}
