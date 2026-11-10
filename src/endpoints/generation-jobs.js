import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import express from 'express';
import sanitize from 'sanitize-filename';
import { GenerationJobStore, generationJobError } from '../generation-jobs.js';
import { trySaveChat } from './chats.js';

function contentHash(file) {
    try { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); } catch (error) {
        if (error.code === 'ENOENT') return null;
        throw error;
    }
}

/** Resolve a native transcript from its authenticated account/story identity. */
export function generationTarget(story, request) {
    let key;
    try { key = JSON.parse(story); } catch { throw generationJobError('Invalid story identity.'); }
    if (!Array.isArray(key) || key.length !== 5) throw generationJobError('Invalid story identity.');
    const [handle, kind, owner, fileName, integrity] = key;
    if (handle !== request.user.profile.handle || !['character', 'group'].includes(kind)
        || typeof owner !== 'string' || !owner || owner === '.' || owner === '..' || sanitize(owner) !== owner
        || typeof fileName !== 'string' || !fileName || sanitize(`${fileName}.jsonl`) !== `${fileName}.jsonl`
        || typeof integrity !== 'string' || !integrity) throw generationJobError('Invalid story identity.');
    const directories = request.user.directories;
    const cardName = kind === 'character' ? owner.replace('.png', '') : fileName;
    const file = kind === 'character' ? path.join(directories.chats, cardName, `${fileName}.jsonl`) : path.join(directories.groupChats, `${fileName}.jsonl`);
    const root = path.resolve(kind === 'character' ? directories.chats : directories.groupChats);
    if (!path.resolve(file).startsWith(root + path.sep)) throw generationJobError('Invalid transcript path.');
    return { file, cardName, integrity, handle, directories };
}

/** Keep registration at the server composition root; native routers are injected. */
export function createGenerationJobsRouter(nativeRouters) {
    const router = express.Router();
    const stores = new Map();
    const dispatch = (endpoint, request, response) => {
        const native = nativeRouters.get(endpoint);
        if (!native) throw generationJobError('Unsupported generation endpoint.');
        native.handle(request, response, error => response.destroy(error || new Error('The generation route was not handled.')));
    };
    const storeFor = request => {
        const root = request.user.directories.root;
        if (!stores.has(root)) stores.set(root, new GenerationJobStore(path.join(root, 'generation-jobs'), dispatch));
        return stores.get(root);
    };
    const failure = (response, error) => {
        if (response.headersSent) return response.destroy();
        return response.status(error.status || 500).json({ error: error.status ? error.message : 'Reply recovery storage is unavailable. Existing reply data has been preserved.' });
    };
    const reconcile = (store, request, story) => {
        for (const job of store.jobs.values()) {
            if (job.record.acknowledged || !job.record.pendingCommitHash || (story !== undefined && story !== job.record.story)) continue;
            const target = generationTarget(job.record.story, request);
            // The write-ahead digest identifies the original candidate even if
            // replay would produce a different completion timestamp on reload.
            if (contentHash(target.file) === job.record.pendingCommitHash) store.acknowledge(job.id, job.record.pendingCommitHash);
        }
    };
    const start = (payload, request) => {
        if (!nativeRouters.has(payload.endpoint)) throw generationJobError('Unsupported generation endpoint.');
        const target = generationTarget(payload.story, request);
        const store = storeFor(request);
        reconcile(store, request, payload.story);
        // Repeated requests are resolved by their original intent before reading
        // a transcript that may already contain the committed result.
        const existing = store.jobs.get(payload.id);
        if (!existing) {
            const hash = contentHash(target.file);
            if (!hash) throw generationJobError('Save this story before starting a reply.', 409);
            const first = fs.readFileSync(target.file, 'utf8').split('\n', 1)[0].replace(/^\uFEFF/, '');
            let header;
            try { header = JSON.parse(first); } catch { throw generationJobError('The story header could not be read.', 409); }
            if (header?.chat_metadata?.integrity !== target.integrity) throw generationJobError('The story changed before this reply started.', 409);
            payload.baselineHash = hash;
        }
        return { store, job: store.start(payload, request) };
    };
    router.post('/', (request, response) => {
        try {
            const { store, job } = start({ ...request.body }, request);
            response.status(202).json(store.metadata(job));
        } catch (error) { failure(response, error); }
    });
    router.get('/', (request, response) => {
        try {
            const story = request.query.story;
            if (story !== undefined && typeof story !== 'string') throw generationJobError('Invalid story filter.');
            const store = storeFor(request);
            reconcile(store, request, story);
            response.json(store.list(story));
        } catch (error) { failure(response, error); }
    });
    router.get('/:id', (request, response) => {
        try {
            const store = storeFor(request);
            const job = store.get(request.params.id);
            reconcile(store, request, job.record.story);
            response.json(store.metadata(job));
        } catch (error) { failure(response, error); }
    });
    router.post('/:id/stop', (request, response) => {
        try { response.json(storeFor(request).stop(request.params.id)); } catch (error) { failure(response, error); }
    });
    router.post('/:id/ack', (request, response) => {
        try { storeFor(request).acknowledge(request.params.id); response.json({ ok: true }); } catch (error) { failure(response, error); }
    });
    router.post('/:id/commit', async (request, response) => {
        try {
            const store = storeFor(request);
            const job = store.get(request.params.id);
            const target = generationTarget(job.record.story, request);
            reconcile(store, request, job.record.story);
            const candidate = request.body?.chat;
            if (!Array.isArray(candidate) || candidate[0]?.chat_metadata?.integrity !== target.integrity || candidate.slice(1).some(message => !message || typeof message.mes !== 'string')) throw generationJobError('Invalid reply transcript.');
            if (job.record.status === 'running') throw generationJobError('The reply is still running.', 409);
            if (typeof job.record.baselineHash !== 'string') throw generationJobError('The saved reply has no verified transcript baseline. Its replay data has been preserved.', 503);
            const serialized = candidate.map(message => JSON.stringify(message)).join('\n');
            const hash = crypto.createHash('sha256').update(serialized).digest('hex');
            if (job.record.acknowledged) {
                if (job.record.committedHash !== hash) throw generationJobError('This reply was already saved with different content.', 409);
                return response.json({ ok: true });
            }
            if (job.commitInFlight) {
                if (job.commitInFlight.hash !== hash) throw generationJobError('This reply is already being saved with different content.', 409);
                await job.commitInFlight.promise;
            } else {
                const promise = (async () => {
                    // Journal the exact candidate before native save. A restart
                    // after the write but before receipt persistence can then
                    // establish completion without replaying or rewriting it.
                    store.prepareCommit(job.id, hash);
                    if (contentHash(target.file) !== hash) {
                        try {
                            await trySaveChat(candidate, target.file, false, target.handle, target.cardName, target.directories.backups, job.record.baselineHash);
                        } catch (error) {
                            if (error.status !== 409 || contentHash(target.file) !== hash) throw error;
                        }
                    }
                    store.acknowledge(job.id, hash);
                })();
                job.commitInFlight = { hash, promise };
                try { await promise; } finally {
                    if (job.commitInFlight?.promise === promise) delete job.commitInFlight;
                }
            }
            response.json({ ok: true });
        } catch (error) { failure(response, error); }
    });
    router.get('/:id/stream', async (request, response) => {
        let cleanup = () => {};
        try {
            const store = storeFor(request);
            const job = store.get(request.params.id);
            const after = Number(request.query.after || 0);
            if (!Number.isSafeInteger(after) || after < 0 || after > job.record.sequence) throw generationJobError('Invalid reply cursor.');
            if (job.record.acknowledged) throw generationJobError('This reply is already saved.', 410);
            if (job.events.listenerCount('frame') >= 8) throw generationJobError('Too many reply subscriptions.', 429);
            const events = job.events;
            const pending = [];
            let pendingBytes = 0, closed = false, wake;
            const receive = frame => {
                const line = JSON.stringify(frame) + '\n';
                pendingBytes += Buffer.byteLength(line);
                if (pendingBytes > 1024 * 1024) { response.destroy(); return; }
                pending.push(line);
                wake?.();
            };
            const close = () => { closed = true; wake?.(); };
            events.on('frame', receive);
            response.on('close', close);
            const heartbeat = setInterval(() => receive({ heartbeat: true }), 10000);
            heartbeat.unref?.();
            cleanup = () => { clearInterval(heartbeat); events.off('frame', receive); response.off('close', close); };
            // Subscription precedes the synchronous journal high-water read, so
            // there is no replay/tail gap. Duplicate cursor frames are skipped.
            const frames = store.frames(job, after);
            const initialTerminal = job.record.status !== 'running' ? store.terminal(job) : null;
            let cursor = after;
            response.setHeader('Content-Type', 'application/x-ndjson');
            response.setHeader('Cache-Control', 'no-cache, no-transform');
            response.setHeader('X-Accel-Buffering', 'no');
            response.flushHeaders();
            const send = async line => {
                if (closed) return;
                if (!response.write(line)) await new Promise(resolve => {
                    const done = () => { response.off('drain', done); response.off('close', done); resolve(); };
                    response.once('drain', done); response.once('close', done);
                });
            };
            if (job.record.ready) await send(JSON.stringify({ ready: true, httpStatus: job.record.httpStatus, headers: job.record.headers }) + '\n');
            for (const frame of frames) { await send(JSON.stringify(frame) + '\n'); cursor = frame.sequence; }
            if (initialTerminal) {
                await send(JSON.stringify(initialTerminal) + '\n');
                response.end();
                return;
            }
            while (!closed) {
                if (!pending.length) await new Promise(resolve => wake = resolve);
                wake = null;
                while (!closed && pending.length) {
                    const line = pending.shift(); pendingBytes -= Buffer.byteLength(line);
                    const frame = JSON.parse(line);
                    if (frame.sequence && !frame.done && frame.sequence <= cursor) continue;
                    await send(line);
                    if (frame.sequence) cursor = frame.sequence;
                    if (frame.done) { response.end(); return; }
                }
            }
        } catch (error) { failure(response, error); } finally { cleanup(); }
    });
    const middleware = (request, response, next) => {
        if (request.get('X-ST-Generation-Job') !== '1') return next();
        try {
            const { __streamJob, ...body } = request.body || {};
            if (!__streamJob) throw generationJobError('Missing reply recovery context.');
            const endpoint = request.originalUrl.split('?')[0];
            const { store, job } = start({ ...__streamJob, endpoint, body }, request);
            response.setHeader('X-ST-Generation-Job', job.id);
            response.status(202).json(store.metadata(job));
        } catch (error) { failure(response, error); }
    };
    return { router, middleware };
}
