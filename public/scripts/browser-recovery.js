import { captureChatViewport, characters, eventSource, event_types, getCurrentChatId, isGenerating, main_api, online_status, refreshChatViewport, refreshServerConnection, setOnlineStatus, this_chid } from '../script.js';
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

export function reportGenerationInterrupted() {
    recovery?.show('Reply interrupted. Continue or regenerate in the chat.', true, recovery.key);
}

export function initBrowserRecovery() {
    if (recovery) return;
    recovery = new BrowserRecovery();
    recovery.init();
}

/** Restores the viewport and unsent drafts; native chat owns replies and saves. */
class BrowserRecovery {
    init() {
        this.input = document.getElementById('send_textarea');
        this.key = identity();
        this.memory = new Map();
        this.connected = online_status !== 'no_connection';
        this.connectedProvider = this.connected ? providerIdentity() : null;
        this.root = document.createElement('section');
        this.root.id = 'browser-recovery';
        this.root.setAttribute('aria-label', 'Connection status');
        this.root.hidden = true;
        this.message = document.createElement('p');
        this.message.setAttribute('role', 'status');
        this.retry = this.button('Retry connection', () => void this.foreground(true));
        this.root.append(this.message, this.retry);
        document.getElementById('form_sheld').prepend(this.root);
        this.input.addEventListener('input', () => this.saveDraft());
        eventSource.on(event_types.CHAT_CHANGED, () => this.changeChat());
        eventSource.on(event_types.CHAT_RENAMED, ({ avatarId, groupId, oldFileName, newFileName }) => {
            const oldKey = identity({ group: groupId || '', avatar: avatarId, fileName: oldFileName.replace(/\.jsonl$/, '') });
            const newKey = identity({ group: groupId || '', avatar: avatarId, fileName: newFileName.replace(/\.jsonl$/, '') });
            const record = this.readDraft(oldKey);
            if (record) { this.writeDraft(newKey, record); this.writeDraft(oldKey, null); }
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
            this.viewport ??= captureChatViewport();
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
        return button;
    }

    storageFailure() {
        this.storageUnavailable = true;
        this.show('Browser storage is unavailable. Keep this tab open or copy your text before reloading.');
    }

    readDraft(key = this.key) {
        const id = `st-recovery:draft:${key}`;
        try {
            const record = this.memory.has(id) ? this.memory.get(id) : JSON.parse(localStorage.getItem(id));
            return typeof record?.text === 'string' ? record : undefined;
        } catch { return this.memory.get(id); }
    }

    writeDraft(key, value) {
        const id = `st-recovery:draft:${key}`;
        this.memory.set(id, value);
        try {
            if (value) localStorage.setItem(id, JSON.stringify(value));
            else localStorage.removeItem(id);
        } catch { this.storageFailure(); }
    }

    saveDraft() {
        if (!power_user.restore_user_input || this.key !== identity()) return;
        this.writeDraft(this.key, this.input.value ? { text: this.input.value } : null);
    }

    changeChat(initial = false) {
        const next = identity();
        if (!initial && next === this.key) return;
        if (next !== this.key) {
            this.viewport = null;
            if (this.noticeKey) { this.notice = ''; this.canRetry = false; this.noticeKey = null; }
        }
        this.key = next;
        if (power_user.restore_user_input) {
            const draft = this.readDraft();
            // A newly opened story never inherits the previous story's composer.
            this.input.value = initial && this.input.value ? this.input.value : typeof draft?.text === 'string' ? draft.text : '';
            this.input.dispatchEvent(new Event('input', { bubbles: true }));
        }
        this.render();
    }

    show(message, retry = false, storyKey = null) {
        this.notice = message;
        this.canRetry = retry;
        this.noticeKey = storyKey;
        this.render();
    }

    render() {
        this.message.textContent = this.notice || (this.storageUnavailable ? 'Browser storage is unavailable. Keep this tab open or copy your text before reloading.' : '');
        this.retry.hidden = !this.canRetry;
        this.root.hidden = !this.message.textContent;
    }

    refreshViewport() {
        if (this.layoutPending || document.visibilityState !== 'visible') return;
        const viewport = this.viewport ?? captureChatViewport();
        this.viewport = null;
        // Layout must recover even when the server or model check never responds.
        this.layoutPending = refreshChatViewport(viewport).finally(() => {
            this.layoutPending = null;
            if (this.viewport) this.refreshViewport();
        });
    }

    async foreground(force = false) {
        if (document.visibilityState !== 'visible') return;
        this.refreshViewport();
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
