import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import { Writable } from 'node:stream';
import { sync as writeFileAtomicSync } from 'write-file-atomic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TERMINAL = new Set(['completed', 'failed', 'stopped', 'interrupted']);
const DEFAULT_LIMITS = { jobs: 64, receipts: 4096, active: 2, bytes: 64 * 1024 * 1024, context: 16 * 1024 * 1024, duration: 30 * 60 * 1000 };

export function generationJobError(message, status = 400) {
    return Object.assign(new Error(message), { status });
}

/** Server-owned inference lifetime and durable, cursor-addressed response bytes.
 * Native provider routers still own protocol translation and credentials.
 * Subscriber lifetimes never own the provider socket.
 */
export class GenerationJobStore {
    constructor(directory, dispatch, limits = {}) {
        this.directory = directory;
        this.dispatch = dispatch;
        this.limits = { ...DEFAULT_LIMITS, ...limits };
        this.jobs = new Map();
        fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
        this.load();
    }

    file(id, extension = 'json') {
        if (!UUID.test(id)) throw generationJobError('Invalid generation ID.');
        return path.join(this.directory, `${id}.${extension}`);
    }

    persist(job) {
        writeFileAtomicSync(this.file(job.id), JSON.stringify(job.record), { mode: 0o600 });
    }

    load() {
        for (const name of fs.readdirSync(this.directory)) {
            if (!name.endsWith('.json') || !UUID.test(name.slice(0, -5))) continue;
            const record = JSON.parse(fs.readFileSync(path.join(this.directory, name), 'utf8'));
            if (record.id !== name.slice(0, -5) || !record.story || !['running', ...TERMINAL].includes(record.status)) {
                throw generationJobError('A saved generation record is invalid. It has been preserved.', 503);
            }
            const job = { id: record.id, record };
            if (!record.acknowledged) {
                job.events = new EventEmitter();
                job.bytes = 0;
                const frames = this.frames(job);
                record.sequence = frames.at(-1)?.sequence || 0;
                job.bytes = fs.statSync(this.file(job.id, 'jsonl')).size;
            }
            if (record.status === 'running') {
                record.status = 'interrupted';
                record.error = 'The server restarted during this reply. Saved reply data is available; inference was not repeated.';
                record.updatedAt = Date.now();
                this.persist(job);
            }
            this.jobs.set(job.id, job);
        }
        for (const name of fs.readdirSync(this.directory)) {
            if (!name.endsWith('.jsonl') || !UUID.test(name.slice(0, -6))) continue;
            const job = this.jobs.get(name.slice(0, -6));
            // An intent is persisted before dispatch. An orphaned empty journal
            // cannot own inference, and acknowledged replay data is disposable.
            if (!job || job.record.acknowledged) fs.rmSync(path.join(this.directory, name));
        }
    }

    metadata(job) {
        const record = structuredClone(job.record);
        delete record.fingerprint;
        delete record.baselineHash;
        delete record.pendingCommitHash;
        return record;
    }

    get(id) {
        this.file(id);
        const job = this.jobs.get(id);
        if (!job) throw generationJobError('Generation not found.', 404);
        return job;
    }

    list(story) {
        return [...this.jobs.values()].filter(job => !job.record.acknowledged && (story === undefined || job.record.story === story)).map(job => this.metadata(job));
    }

    start({ id, story, endpoint, body, context, baselineHash }, request) {
        this.file(id);
        if (typeof story !== 'string' || !story || story.length > 4096 || !context || typeof context !== 'object' || Array.isArray(context) || !body || typeof body !== 'object' || Array.isArray(body)) {
            throw generationJobError('A story, request body and recovery context are required.');
        }
        const contextJSON = JSON.stringify(context);
        if (Buffer.byteLength(contextJSON) > this.limits.context) throw generationJobError('The reply recovery context is too large.', 413);
        const fingerprint = crypto.createHash('sha256').update(JSON.stringify([story, endpoint, body, context])).digest('hex');
        const existing = this.jobs.get(id);
        if (existing) {
            if (existing.record.fingerprint !== fingerprint) throw generationJobError('This generation ID belongs to a different request.', 409);
            return existing;
        }
        // Small idempotent save receipts live for seven days; unresolved reply
        // data is never expired or evicted to make room for another request.
        for (const [oldId, oldJob] of this.jobs) {
            if (oldJob.record.acknowledged && Date.now() - oldJob.record.updatedAt > 7 * 24 * 60 * 60 * 1000) {
                fs.rmSync(this.file(oldId));
                fs.rmSync(this.file(oldId, 'jsonl'), { force: true });
                this.jobs.delete(oldId);
            }
        }
        const unresolved = [...this.jobs.values()].filter(job => !job.record.acknowledged);
        const active = unresolved.filter(job => job.record.status === 'running');
        if (active.some(job => job.record.story === story)) throw generationJobError('This story already has a running reply.', 409);
        if (unresolved.some(job => job.record.story === story)) throw generationJobError('This story has an unsaved reply. Resume or save it before starting another.', 409);
        if (active.length >= this.limits.active || unresolved.length >= this.limits.jobs || this.jobs.size >= this.limits.receipts) throw generationJobError('Reply recovery storage is full. Finish and save existing replies before starting another.', 429);
        const now = Date.now();
        const job = {
            id, bytes: 0, events: new EventEmitter(),
            record: { id, story, endpoint, context: JSON.parse(contextJSON), fingerprint, baselineHash, status: 'running', ready: false, httpStatus: 200, headers: {}, sequence: 0, error: null, createdAt: now, updatedAt: now },
        };
        // The intent and empty journal exist before inference can start or the
        // caller receives an acknowledgement. No provider request is persisted.
        fs.writeFileSync(this.file(id, 'jsonl'), '', { mode: 0o600, flag: 'wx' });
        try { this.persist(job); } catch (error) {
            fs.rmSync(this.file(id, 'jsonl'), { force: true });
            throw error;
        }
        this.jobs.set(id, job);
        job.timer = setTimeout(() => this.stop(id, 'Reply generation exceeded the server time limit.', 'interrupted'), this.limits.duration);
        job.timer.unref?.();
        // The request belongs to this invocation only. In particular, its socket
        // is not inherited from the browser's HTTP connection.
        const socket = new EventEmitter();
        socket.destroyed = false;
        socket.destroy = () => {
            if (socket.destroyed) return;
            socket.destroyed = true;
            socket.emit('close');
        };
        socket.setTimeout = () => socket;
        job.socket = socket;
        const detached = Object.create(request);
        Object.assign(detached, { body: structuredClone(body), headers: { ...request.headers }, socket, connection: socket, method: 'POST', url: '/generate', originalUrl: endpoint, baseUrl: endpoint.slice(0, -9), params: {}, query: {} });
        const sink = job.sink = new GenerationResponse(this, job, socket);
        queueMicrotask(() => {
            if (job.record.status !== 'running') return;
            try {
                const result = this.dispatch(endpoint, detached, sink);
                Promise.resolve(result).catch(error => sink.destroy(error));
            } catch (error) { sink.destroy(error); }
        });
        return job;
    }

    ready(job, status, headers) {
        if (job.record.ready || job.record.status !== 'running') return;
        job.record.ready = true;
        job.record.httpStatus = status;
        // Native providers need only response content type for their existing
        // parsers. Do not journal arbitrary provider headers or cookies.
        job.record.headers = { 'content-type': String(headers['content-type'] || 'text/event-stream') };
        this.persist(job);
        job.events.emit('frame', { ready: true, httpStatus: status, headers: job.record.headers });
    }

    append(job, data) {
        if (job.record.status !== 'running') return;
        const frame = { sequence: job.record.sequence + 1, data: data.toString('base64') };
        const line = JSON.stringify(frame) + '\n';
        if (job.bytes + Buffer.byteLength(line) > this.limits.bytes) throw generationJobError('Reply recovery storage reached its size limit.', 413);
        const fd = fs.openSync(this.file(job.id, 'jsonl'), 'a', 0o600);
        try {
            fs.writeFileSync(fd, line);
            fs.fsyncSync(fd);
        } finally { fs.closeSync(fd); }
        job.bytes += Buffer.byteLength(line);
        job.record.sequence = frame.sequence;
        job.record.updatedAt = Date.now();
        // A cursor is observable only after its bytes have been journaled.
        job.events.emit('frame', frame);
    }

    frames(job, after = 0) {
        const text = fs.readFileSync(this.file(job.id, 'jsonl'), 'utf8');
        const lines = text.split('\n');
        // A crash may leave an incomplete final append. Its bytes were never
        // acknowledged to a client; retain the file and replay complete records.
        lines.pop();
        const frames = lines.filter(Boolean).map(line => JSON.parse(line));
        for (let index = 0; index < frames.length; index++) {
            if (frames[index].sequence !== index + 1 || typeof frames[index].data !== 'string') throw generationJobError('The saved reply journal is invalid. It has been preserved.', 503);
        }
        return frames.filter(frame => frame.sequence > after);
    }

    finish(job, status, error = null) {
        if (job.record.status !== 'running') return;
        clearTimeout(job.timer);
        delete job.timer;
        job.record.status = status;
        job.record.error = error;
        job.record.updatedAt = Date.now();
        try { this.persist(job); } catch (cause) {
            job.record.status = 'failed';
            job.record.error = 'The server could not persist the reply status. Saved reply bytes have been preserved.';
            console.error('Could not persist generation completion:', cause.code || cause.name);
        }
        job.events.emit('frame', this.terminal(job));
    }

    terminal(job) {
        return { done: true, status: job.record.status, httpStatus: job.record.httpStatus, error: job.record.error, headers: job.record.headers, sequence: job.record.sequence };
    }

    stop(id, message = null, status = 'stopped') {
        const job = this.get(id);
        this.finish(job, status, message);
        job.socket?.destroy();
        job.sink?.destroy();
        return this.metadata(job);
    }

    acknowledge(id, committedHash = null) {
        const job = this.get(id);
        if (job.record.status === 'running') throw generationJobError('A running reply cannot be acknowledged.', 409);
        if (job.record.acknowledged) {
            fs.rmSync(this.file(id, 'jsonl'), { force: true });
            return;
        }
        // Persist the save receipt before removing any replay data. Losing an
        // HTTP acknowledgement must not start inference or apply a reply twice.
        const previous = job.record;
        job.record = { ...previous, acknowledged: true, committedHash, context: null, updatedAt: Date.now() };
        try { this.persist(job); } catch (error) { job.record = previous; throw error; }
        fs.rmSync(this.file(id, 'jsonl'), { force: true });
        // Existing subscribers have already received the terminal frame. The
        // receipt must not retain their callback queues or provider resources.
        job.events?.removeAllListeners();
        delete job.events;
        delete job.bytes;
        this.release(job);
    }

    prepareCommit(id, hash) {
        const job = this.get(id);
        if (job.record.acknowledged || job.record.pendingCommitHash === hash) return;
        const previous = job.record;
        job.record = { ...previous, pendingCommitHash: hash, updatedAt: Date.now() };
        try { this.persist(job); } catch (error) { job.record = previous; throw error; }
    }

    release(job, sink = job.sink) {
        // Destroy may still have a queued error event. Wait for close before
        // removing its error listener or dropping the provider lifetime.
        if (!sink?.closed) return;
        job.socket?.removeAllListeners();
        sink.removeAllListeners();
        delete job.socket;
        delete job.sink;
        clearTimeout(job.timer);
        delete job.timer;
    }
}

/** Express-compatible Writable, consumed by the existing native router paths. */
class GenerationResponse extends Writable {
    constructor(store, job, socket) {
        super();
        this.store = store;
        this.job = job;
        this.socket = socket;
        this.statusCode = 200;
        this.statusMessage = 'OK';
        this.headersSent = false;
        this.headers = {};
        this.locals = {};
        this.on('error', () => this.socket.destroy());
        this.on('close', () => this.store.release(this.job, this));
    }

    status(code) { this.statusCode = code; return this; }
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; return this; }
    getHeader(name) { return this.headers[name.toLowerCase()]; }
    removeHeader(name) { delete this.headers[name.toLowerCase()]; }
    writeHead(code, status, headers) {
        this.statusCode = code;
        for (const [name, value] of Object.entries(headers || (typeof status === 'object' ? status : {}))) this.setHeader(name, value);
        this.flushHeaders();
        return this;
    }
    flushHeaders() {
        this.store.ready(this.job, this.statusCode, this.headers);
        this.headersSent = true;
    }
    json(value) { this.setHeader('content-type', 'application/json'); return this.end(JSON.stringify(value)); }
    send(value) { return typeof value === 'object' ? this.json(value) : this.end(String(value ?? '')); }
    sendStatus(code) { return this.status(code).end(String(code)); }
    _write(data, encoding, callback) {
        try { this.flushHeaders(); this.store.append(this.job, data); callback(); } catch (error) { callback(error); }
    }
    _final(callback) {
        try {
            this.flushHeaders();
            this.store.finish(this.job, this.statusCode >= 200 && this.statusCode < 300 ? 'completed' : 'failed', this.statusCode >= 400 ? `The provider returned HTTP ${this.statusCode}.` : null);
            callback();
        } catch (error) { callback(error); }
    }
    _destroy(error, callback) {
        if (this.job.record.status === 'running') {
            this.store.finish(this.job, 'failed', error ? 'The provider stream failed. Saved reply bytes are available.' : 'The provider stream ended unexpectedly. Saved reply bytes are available.');
        }
        if (error) this.socket.destroy();
        callback(error);
    }
}
