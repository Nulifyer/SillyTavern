import { characters, chat, eventSource, event_types, getCurrentChatId, isChatSaving, isGenerating, main_api, online_status, refreshServerConnection, saveChatConditional, setOnlineStatus, this_chid } from '../script.js';
import { selected_group } from './group-chats.js';
import { getChatCompletionModel, oai_settings, refreshChatCompletionStatus } from './openai.js';
import { power_user } from './power-user.js';
import { getCurrentUserHandle } from './user.js';

let recovery;

function identity({ group = selected_group, avatar = characters[this_chid]?.avatar, fileName = getCurrentChatId() } = {}) {
    return JSON.stringify([getCurrentUserHandle(), group ? 'group' : avatar ? 'character' : 'welcome', String(group || avatar || ''), String(fileName ?? '')]);
}

function providerIdentity() {
    return JSON.stringify([main_api, oai_settings.chat_completion_source, getChatCompletionModel(oai_settings), oai_settings.custom_url, oai_settings.reverse_proxy, oai_settings.azure_base_url]);
}

function replyRecords(record) {
    return record ? [...(Array.isArray(record.previous) ? record.previous : []), record]
        .filter(value => typeof value?.text === 'string' && Number.isInteger(value.messageId))
        .map(({ text, messageId, sendDate, status }) => ({ text, messageId, sendDate, status })) : [];
}

function combineReplies(records) {
    if (!records.length) return null;
    return { ...records.at(-1), previous: records.slice(0, -1) };
}

function sameReply(a, b) {
    return a.messageId === b.messageId && a.sendDate === b.sendDate && a.text === b.text && a.status === b.status;
}

/** Local checkpoints never send prompts or overwrite a server transcript. */
export function checkpointStreamingReply(messageId, text, status = 'pending') {
    recovery?.checkpointReply(messageId, text, status);
}

/** Capture the exact text before a native save awaits I/O; acknowledge only HTTP success. */
export function captureRecoverySave({ group = '', avatar = '', fileName, messages }) {
    const key = identity({ group, avatar, fileName });
    const acknowledged = replyRecords(recovery?.read('reply', key)).filter(record => record.status === 'complete' && messages[record.messageId]?.mes === record.text && messages[record.messageId]?.send_date === record.sendDate);
    return () => {
        const current = replyRecords(recovery?.read('reply', key));
        const remaining = current.filter(record => !acknowledged.some(saved => sameReply(saved, record)));
        if (remaining.length !== current.length) {
            recovery.write('reply', key, combineReplies(remaining));
            if (recovery.key === key) recovery.render();
        }
    };
}

export function reportGenerationInterrupted() {
    recovery?.show('The reply connection was interrupted. No request was sent again. Reconnect, then continue or regenerate from the story.', true, recovery.key);
}

export function initBrowserRecovery() {
    if (recovery) return;
    recovery = new BrowserRecovery();
    recovery.init();
}

/** Owns browser lifecycle, local composer/reply recovery and bounded foreground probes. */
class BrowserRecovery {
    init() {
        this.input = document.getElementById('send_textarea');
        this.key = identity();
        this.memory = new Map();
        this.connected = online_status !== 'no_connection';
        this.connectedProvider = this.connected ? providerIdentity() : null;
        this.root = document.createElement('section');
        this.root.id = 'browser-recovery';
        this.root.setAttribute('aria-label', 'Connection and text recovery');
        this.root.hidden = true;
        this.message = document.createElement('p');
        this.message.setAttribute('role', 'status');
        this.retry = this.button('Retry connection', () => void this.foreground(true));
        this.details = document.createElement('details');
        const summary = document.createElement('summary');
        summary.textContent = 'Recovered reply text';
        this.text = document.createElement('textarea');
        this.text.readOnly = true;
        this.text.setAttribute('aria-label', 'Recovered partial reply');
        this.details.append(summary, this.text, this.button('Add recovered text to draft', () => this.append(this.text.value)));
        this.dismiss = this.button('Dismiss recovered text', () => { this.write('reply', this.key, null); this.render(); });
        this.legacy = this.button('Restore older saved draft', () => {
            try {
                const key = getCurrentUserHandle() + '_userInput';
                const value = localStorage.getItem(key);
                if (value) { this.append(value); localStorage.removeItem(key); }
            } catch { this.storageFailure(); }
            this.render();
        });
        this.root.append(this.message, this.retry, this.details, this.dismiss, this.legacy);
        document.getElementById('form_sheld').prepend(this.root);
        this.input.addEventListener('input', () => this.saveDraft());
        eventSource.on(event_types.CHAT_CHANGED, () => this.changeChat());
        eventSource.on(event_types.CHAT_RENAMED, ({ avatarId, groupId, oldFileName, newFileName }) => {
            const oldKey = identity({ group: groupId || '', avatar: avatarId, fileName: oldFileName.replace(/\.jsonl$/, '') });
            const newKey = identity({ group: groupId || '', avatar: avatarId, fileName: newFileName.replace(/\.jsonl$/, '') });
            for (const kind of ['draft', 'reply']) {
                const record = this.read(kind, oldKey);
                if (record) { this.write(kind, newKey, record); this.write(kind, oldKey, null); }
            }
            if (this.key === newKey) this.changeChat(true);
        });
        eventSource.on(event_types.APP_READY, () => { this.changeChat(true); if (document.wasDiscarded) void this.foreground(); });
        eventSource.on(event_types.GENERATION_STARTED, (_type, _options, dryRun) => {
            if (dryRun) return;
            this.notice = '';
            this.noticeKey = null;
            this.canRetry = false;
            this.render();
        });
        eventSource.on(event_types.GENERATION_ENDED, () => this.render());
        eventSource.on(event_types.ONLINE_STATUS_CHANGED, () => {
            if (online_status && online_status !== 'no_connection') {
                this.connected = true;
                this.connectedProvider = providerIdentity();
            }
        });
        const background = () => {
            this.saveDraft();
            this.lastProbe = 0;
            this.controller?.abort();
            this.controller = null;
            this.root.removeAttribute('aria-busy');
            this.retry.disabled = false;
        };
        document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' ? background() : void this.foreground());
        document.addEventListener('freeze', background);
        document.addEventListener('resume', () => void this.foreground());
        window.addEventListener('pagehide', background);
        window.addEventListener('pageshow', event => { if (event.persisted) void this.foreground(); });
        window.addEventListener('online', () => void this.foreground());
        window.addEventListener('offline', () => this.show('The browser reports no network connection. Your text stays here. Retry when the connection returns.', true));
    }

    button(label, action) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'menu_button';
        button.textContent = label;
        button.addEventListener('click', action);
        button.addEventListener('keydown', event => {
            if (event.key !== 'Enter') return;
            // Appending text moves focus to the composer. Consume activation
            // before its keypress/default action can type into that new focus.
            event.preventDefault();
            event.stopPropagation();
            button.click();
        });
        return button;
    }

    storageFailure() {
        this.storageUnavailable = true;
        this.show('Browser storage is unavailable. Keep this tab open or copy your text before reloading.');
    }

    read(kind, key = this.key) {
        const id = `st-recovery:${kind}:${key}`;
        try {
            const record = this.memory.has(id) ? this.memory.get(id) : JSON.parse(localStorage.getItem(id));
            return typeof record?.text === 'string' ? record : undefined;
        } catch { return this.memory.get(id); }
    }

    write(kind, key, value) {
        const id = `st-recovery:${kind}:${key}`;
        this.memory.set(id, value);
        try {
            if (value) localStorage.setItem(id, JSON.stringify(value));
            else localStorage.removeItem(id);
        } catch { this.storageFailure(); }
    }

    saveDraft() {
        if (!power_user.restore_user_input || this.key !== identity()) return;
        this.write('draft', this.key, this.input.value ? { text: this.input.value } : null);
    }

    changeChat(initial = false) {
        const next = identity();
        if (!initial && next === this.key) return;
        if (next !== this.key) {
            this.details.open = false;
            if (this.noticeKey) { this.notice = ''; this.canRetry = false; this.noticeKey = null; }
        }
        this.key = next;
        if (power_user.restore_user_input) {
            const draft = this.read('draft');
            // A newly opened story never inherits the previous story's composer.
            this.input.value = initial && this.input.value ? this.input.value : typeof draft?.text === 'string' ? draft.text : '';
            this.input.dispatchEvent(new Event('input', { bubbles: true }));
        }
        // A loaded native transcript can confirm previously unacknowledged text.
        captureRecoverySave({ group: selected_group || '', avatar: characters[this_chid]?.avatar || '', fileName: getCurrentChatId(), messages: chat })();
        this.render();
    }

    append(text) {
        if (!text) return;
        this.input.value += `${this.input.value ? '\n\n' : ''}${text}`;
        this.input.dispatchEvent(new Event('input', { bubbles: true }));
        this.input.focus();
    }

    checkpointReply(messageId, text, status) {
        if (!power_user.restore_user_input || !chat[messageId]) return;
        const key = identity();
        const record = { text, messageId, sendDate: chat[messageId].send_date, status };
        const records = replyRecords(this.read('reply', key));
        const index = records.findIndex(value => value.messageId === record.messageId && value.sendDate === record.sendDate);
        if (index >= 0) records[index] = record;
        else records.push(record);
        this.write('reply', key, combineReplies(records));
        if (status === 'interrupted') this.render();
    }

    show(message, retry = false, storyKey = null) {
        this.notice = message;
        this.canRetry = retry;
        this.noticeKey = storyKey;
        this.render();
    }

    render() {
        this.record = power_user.restore_user_input ? this.read('reply') : null;
        const records = replyRecords(this.record);
        const interrupted = records.length > 0 && !isGenerating();
        const replyNotice = records.every(record => record.status === 'complete')
            ? 'The reply could not be confirmed saved. Received text is available below; nothing was sent again.'
            : 'A reply was interrupted before completion. Received text is available below; nothing was sent again.';
        this.message.textContent = this.notice || (interrupted ? replyNotice : this.storageUnavailable ? 'Browser storage is unavailable. Keep this tab open or copy your text before reloading.' : '');
        this.retry.hidden = !this.canRetry;
        this.details.hidden = !interrupted || !records.some(record => record.text);
        this.dismiss.hidden = !interrupted;
        this.text.value = interrupted ? records.map(record => records.length > 1 ? `Reply ${record.messageId + 1}\n${record.text}` : record.text).join('\n\n') : '';
        try { this.legacy.hidden = !power_user.restore_user_input || !localStorage.getItem(getCurrentUserHandle() + '_userInput'); } catch { this.legacy.hidden = true; }
        this.root.hidden = !this.message.textContent && this.details.hidden && this.legacy.hidden;
    }

    async foreground(force = false) {
        if (document.visibilityState !== 'visible') return;
        if (this.probing && this.controller && !this.controller.signal.aborted) return this.probing;
        if (!force && Date.now() - (this.lastProbe || 0) < 1000) return;
        this.lastProbe = Date.now();
        const controller = this.controller = new AbortController();
        this.root.setAttribute('aria-busy', 'true');
        this.retry.disabled = true;
        const provider = providerIdentity();
        const isCurrent = () => this.controller === controller && provider === providerIdentity() && document.visibilityState === 'visible';
        const timer = setTimeout(() => controller.abort(), 10000);
        this.probing = (async () => {
            try {
                const reachable = await refreshServerConnection(controller.signal);
                if (controller.signal.aborted || !isCurrent()) return;
                if (!reachable) {
                    setOnlineStatus('no_connection');
                    this.show('The app server is unavailable. Your draft stays here. Retry when the connection returns.', true);
                    return;
                }
                if (this.connected && this.connectedProvider === provider && main_api === 'openai' && !isGenerating()) {
                    const valid = await refreshChatCompletionStatus(controller.signal);
                    if (!isCurrent()) return;
                    if (controller.signal.aborted) { this.show('Connection check timed out. Your draft stays here. Retry when ready.', true); return; }
                    if (!valid) { this.show('The app server is available. Check the model connection in Settings, then retry.', true); return; }
                }
                this.notice = '';
                this.noticeKey = null;
                this.canRetry = false;
                const matches = replyRecords(this.read('reply')).some(record => chat[record.messageId]?.mes === record.text && chat[record.messageId]?.send_date === record.sendDate);
                // Native saves own their own lifetime. A slow disk/save request
                // must not keep the bounded connection check or Retry busy.
                if (matches && !isGenerating() && !isChatSaving) void saveChatConditional().then(() => this.render());
                this.render();
            } catch {
                if (isCurrent()) this.show('Connection check could not finish. Your draft stays here. Retry when ready.', true);
            } finally {
                clearTimeout(timer);
                if (this.controller === controller) {
                    this.probing = null;
                    this.controller = null;
                    this.root.removeAttribute('aria-busy');
                    this.retry.disabled = false;
                }
            }
        })();
        return this.probing;
    }
}
