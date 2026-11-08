import { localforage } from '../lib.js';

// Native generation diagnostics, separate from the released filename-only cache.
// Shared by generation and Scene details. No provider headers, keys or media.
const storage = localforage.createInstance({ name: 'SillyTavern_ClientContext_v1' });
const indexKey = 'index';
const limit = 60;
const maxLength = 240000;
let queue = Promise.resolve();
const fields = ['charDescription', 'charPersonality', 'scenarioText', 'userPersona', 'summarizeString', 'authorsNoteString', 'worldInfoString', 'chatVectorsString', 'dataBankVectorsString', 'instruction'];
const parameters = ['model', 'chat_completion_source', 'max_tokens', 'max_completion_tokens', 'temperature', 'top_p', 'top_k', 'min_p', 'frequency_penalty', 'presence_penalty', 'seed', 'stream', 'custom_prompt_post_processing'];

function safeMessages(messages) {
    if (typeof messages === 'string') return messages.slice(0, maxLength);
    if (!Array.isArray(messages)) return [];
    return messages.slice(-300).map(message => ({
        role: String(message.role || ''),
        ...(message.name ? { name: String(message.name) } : {}),
        content: typeof message.content === 'string' ? message.content : Array.isArray(message.content)
            ? message.content.map(part => part.type === 'text' ? { type: 'text', text: String(part.text || '') } : { type: String(part.type || 'media'), omitted: true })
            : '[Nontext content omitted]',
        ...(message.tool_calls ? { toolCallsOmitted: true } : {}),
    }));
}

async function fingerprint(text) {
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(text)));
    return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}

/** Start a bounded immutable capture for a visible native generation only. */
export function beginClientCapture(owner, type, bits, model) {
    if (['quiet', 'impersonate'].includes(type) || !globalThis.crypto?.subtle || !globalThis.crypto?.randomUUID) return null;
    try {
        const components = Object.fromEntries(fields.filter(key => typeof bits[key] === 'string').map(key => [key, bits[key].slice(0, 32000)]));
        return { id: crypto.randomUUID(), owner, bindings: [owner], created: new Date().toISOString(), type, model, api: bits.main_api, preset: bits.presetName, contextBudget: bits.this_max_context, contextCapacity: bits.contextCapacity, outputBudget: bits.outputBudget, components, omissions: Object.entries(components).filter(([key]) => bits[key].length > 32000).map(([key]) => `${key}: limited to 32,000 characters`), stage: 'Prepared client assembly' };
    } catch { return null; }
}

/** Allowlist the native request after extension hooks; never persist the whole object. */
export function recordClientRequest(capture, request, stage = 'Recorded client request to SillyTavern') {
    if (!capture) return;
    try {
        capture.stage = stage;
        capture.request = Object.fromEntries(parameters.filter(key => ['string', 'number', 'boolean'].includes(typeof request[key])).map(key => [key, request[key]]));
        const messages = request.messages ?? request.prompt ?? request.input;
        if (Array.isArray(messages) && messages.length > 300) capture.omissions.push('Only the last 300 client messages retained');
        if (typeof messages === 'string' && messages.length > maxLength) capture.omissions.push('Client text limited to 240,000 characters');
        capture.request.messages = safeMessages(messages);
        // Limit the whole record too, including hundreds of large individual messages.
        if (JSON.stringify(capture).length > maxLength) {
            capture.request.messages = '[Request text omitted: capture size limit exceeded]';
            capture.components = {};
            capture.truncated = true;
            capture.omissions.push('Request text and components omitted: total size limit');
        }
    } catch { capture.request = undefined; capture.stage = 'Client request unavailable'; }
}

/** Attach a revision-specific reference before the native transcript save. */
export async function finishClientCapture(capture, owner, message, messageIndex) {
    if (!capture || capture.finished || capture.owner !== owner || !message || message.is_user || message.is_system) return;
    capture.finished = true;
    try {
        const record = { ...capture, messageIndex, swipe: message.swipe_id ?? 0, responseHash: await fingerprint(message.mes) };
        delete record.finished;
        await (queue = queue.catch(() => {}).then(async () => {
            const ids = await storage.getItem(indexKey) || [];
            await storage.setItem(record.id, record);
            ids.push(record.id);
            while (ids.length > limit) await storage.removeItem(ids.shift());
            await storage.setItem(indexKey, ids);
        }));
        message.extra ||= {};
        message.extra.client_context = record.id;
        const variant = message.swipe_info?.[message.swipe_id ?? 0];
        if (variant) { variant.extra ||= {}; variant.extra.client_context = record.id; }
    } catch {
        // Diagnostics must never prevent a reply from being saved.
        console.warn('Client context could not be stored in this browser.');
    }
}

/** Missing, edited, moved or copied replies never fall back to a filename cache. */
export async function readClientCapture(owner, message, messageIndex) {
    const id = message?.extra?.client_context;
    if (!id) return null;
    try {
        const record = await storage.getItem(id);
        if (!record || !record.bindings.includes(owner) || record.messageIndex !== messageIndex || record.swipe !== (message.swipe_id ?? 0) || record.responseHash !== await fingerprint(message.mes)) return null;
        return record;
    } catch { return null; }
}

/** Only native rename acknowledgements can extend an existing capture's binding. */
export async function renameClientCaptures(account, { avatarId, groupId, oldFileName, newFileName, oldAvatar, newAvatar }) {
    await (queue = queue.catch(() => {}).then(async () => {
        const ids = await storage.getItem(indexKey) || [];
        for (const id of ids) {
            const record = await storage.getItem(id);
            if (!record) continue;
            for (const binding of [...record.bindings]) {
                const identity = JSON.parse(binding);
                if (identity[0] !== account) continue;
                if (oldAvatar && identity[1] === 'character' && identity[2] === oldAvatar) identity[2] = newAvatar;
                else if (!oldAvatar && identity[1] === (groupId ? 'group' : 'character') && identity[2] === String(groupId || avatarId) && identity[3] === oldFileName.replace(/\.jsonl$/, '')) identity[3] = newFileName.replace(/\.jsonl$/, '');
                else continue;
                const next = JSON.stringify(identity);
                if (!record.bindings.includes(next)) record.bindings.push(next);
            }
            await storage.setItem(id, record);
        }
    }));
}
