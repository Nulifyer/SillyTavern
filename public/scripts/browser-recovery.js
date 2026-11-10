import { captureChatViewport, characters, eventSource, event_types, getCurrentChatId, getCurrentChatIdentity, isGenerating, main_api, online_status, refreshChatViewport, refreshServerConnection, restorePendingGeneration, setOnlineStatus, this_chid } from '../script.js';
import { refreshGenerationSubscriptions } from './generation-transport.js';
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

export function reportGenerationRecoveryStatus(message, retry = false, action = null) {
    recovery?.show(message, retry, recovery.key, action);
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
        this.discard = this.button('Discard interrupted reply', async () => {
            const action = this.noticeAction;
            if (!action || this.discard.disabled) return;
            this.discard.disabled = true;
            try { await action(); } finally { this.discard.disabled = false; }
        });
        this.discard.hidden = true;
        this.root.append(this.message, this.retry, this.discard);
        document.getElementById('form_sheld').prepend(this.root);
        this.input.addEventListener('input', () => this.saveDraft());
        eventSource.on(event_types.CHAT_CHANGED, () => {
            this.changeChat();
            void restorePendingGeneration().catch(error => reportGenerationRecoveryStatus(error.message, true));
        });
        eventSource.on(event_types.CHARACTER_RENAMED, (oldAvatar, newAvatar) => this.renameCharacter(oldAvatar, newAvatar));
        eventSource.makeFirst(event_types.CHAT_RENAME_ACKNOWLEDGED, data => this.acknowledgeRename(data));
        eventSource.on(event_types.CHAT_RENAMED, data => {
            if (data.accountHandle && data.accountHandle !== getCurrentUserHandle()) return;
            const { oldKey, newKey } = this.renameKeys(data);
            if (this.renameTransition?.oldKey === oldKey && this.renameTransition?.newKey === newKey) this.renameTransition = null;
            // Older extensions can still emit the established completion event.
            // A native operation already moved its draft at file acknowledgement.
            if (!data.fileAcknowledged) {
                this.moveDraft(oldKey, newKey);
                if (this.key === newKey) this.changeChat(true);
            }
        });
        eventSource.on(event_types.APP_READY, () => {
            this.changeChat(true);
            void restorePendingGeneration().catch(error => reportGenerationRecoveryStatus(error.message, true));
            if (document.wasDiscarded) void this.foreground();
        });
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
            return true;
        } catch { this.storageFailure(); return false; }
    }

    moveDraft(oldKey, newKey) {
        if (oldKey === newKey) return true;
        const record = this.readDraft(oldKey);
        if (!record) return true;
        const destination = this.readDraft(newKey);
        if (destination && destination.text !== record.text) {
            this.show('A draft already exists for the renamed story. That draft is preserved; the earlier draft remains in browser storage under its previous name.');
            return false;
        }
        // Keep the source if browser storage cannot persist its new identity.
        if (!this.writeDraft(newKey, record)) return false;
        this.writeDraft(oldKey, null);
        return true;
    }

    renameKeys({ avatarId, groupId, oldFileName, newFileName }) {
        return {
            oldKey: identity({ group: groupId || '', avatar: avatarId, fileName: oldFileName.replace(/\.jsonl$/, '') }),
            newKey: identity({ group: groupId || '', avatar: avatarId, fileName: newFileName.replace(/\.jsonl$/, '') }),
        };
    }

    acknowledgeRename(data) {
        if (data.accountHandle && data.accountHandle !== getCurrentUserHandle()) return;
        const { oldKey, newKey } = this.renameKeys(data);
        const live = identity();
        // A newly loaded incarnation can already have written its own draft at this path.
        // An older acknowledgement cannot migrate that live owner's stored record.
        if (data.activeIdentity && data.activeIdentity !== getCurrentChatIdentity() && (live === oldKey || live === newKey)) return;
        const active = this.key === oldKey && (live === oldKey || live === newKey) && (!data.activeIdentity || data.activeIdentity === getCurrentChatIdentity());
        if (active && power_user.restore_user_input) this.writeDraft(oldKey, this.input.value ? { text: this.input.value } : null);
        const moved = this.moveDraft(oldKey, newKey);
        if (!active) return;
        this.key = newKey;
        this.viewport = null;
        // One acknowledged rename, never an alias table or a guessed filename match.
        this.renameTransition = { oldKey, newKey };
        if (!moved && power_user.restore_user_input) {
            this.input.value = this.readDraft(newKey)?.text || '';
            this.input.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }

    renameCharacter(oldAvatar, newAvatar) {
        if (oldAvatar === newAvatar) return;
        this.saveDraft();
        const prefix = 'st-recovery:draft:';
        const keys = new Set(this.memory.keys());
        try {
            for (let index = 0; index < localStorage.length; index++) keys.add(localStorage.key(index));
        } catch { this.storageFailure(); }
        for (const id of keys) {
            if (!id?.startsWith(prefix)) continue;
            let key;
            try { key = JSON.parse(id.slice(prefix.length)); } catch { continue; }
            if (!Array.isArray(key) || key.length !== 4 || key[0] !== getCurrentUserHandle() || key[1] !== 'character' || key[2] !== oldAvatar) continue;
            const next = [...key];
            next[2] = newAvatar;
            this.moveDraft(JSON.stringify(key), JSON.stringify(next));
        }
    }

    saveDraft() {
        const live = identity();
        const acknowledgedOldName = this.renameTransition?.newKey === this.key && this.renameTransition?.oldKey === live;
        if (!power_user.restore_user_input || (this.key !== live && !acknowledgedOldName)) return;
        this.writeDraft(this.key, this.input.value ? { text: this.input.value } : null);
    }

    changeChat(initial = false) {
        const next = identity();
        if (this.renameTransition && next !== this.renameTransition.newKey) {
            this.renameTransition = null;
        }
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

    show(message, retry = false, storyKey = null, action = null) {
        this.noticeRevision = (this.noticeRevision || 0) + 1;
        this.notice = message;
        this.canRetry = retry;
        this.noticeKey = storyKey;
        this.noticeAction = action;
        this.render();
    }

    render() {
        this.message.textContent = this.notice || (this.storageUnavailable ? 'Browser storage is unavailable. Keep this tab open or copy your text before reloading.' : '');
        this.retry.hidden = !this.canRetry;
        this.discard.hidden = !this.noticeAction;
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
        refreshGenerationSubscriptions();
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
                const noticeRevision = this.noticeRevision;
                const restored = await restorePendingGeneration();
                if (!isCurrent() || restored || this.noticeRevision !== noticeRevision) return;
                if (this.connected && this.connectedProvider === provider && main_api === 'openai' && !isGenerating()) {
                    const valid = await refreshChatCompletionStatus(controller.signal);
                    if (!isCurrent()) return;
                    if (controller.signal.aborted) { this.show('Connection check timed out. Your draft stays here. Retry when ready.', true); return; }
                    if (valid === false) { this.show('The app server is available. Check the model connection in Settings, then retry.', true); return; }
                }
                this.notice = '';
                this.noticeKey = null;
                this.canRetry = false;
                this.noticeAction = null;
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
