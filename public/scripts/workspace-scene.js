import { morphdom } from '../lib.js';
import { getWorldInfoBindings } from './world-info.js';
import { chat, chat_metadata, getCurrentChatIdentity, isGenerating, name1 } from '../script.js';
import { extension_settings } from './extensions.js';
import { readClientCapture } from './itemized-captures.js';
import { button, element, portrait } from './workspace-views.js';

const componentLabels = { charDescription: 'Character description', charPersonality: 'Personality', scenarioText: 'Premise', userPersona: 'Persona', summarizeString: 'Summary', authorsNoteString: 'Author’s Note', worldInfoString: 'World & lore', chatVectorsString: 'Chat retrieval', dataBankVectorsString: 'Data Bank retrieval', instruction: 'Instructions' };

function disclosure(label, text, identity = label) {
    const details = element('details', 'workspace-context-block');
    const content = element('pre', '', text || 'No content recorded.');
    content.dataset.sceneFocus = `content:${identity}`;
    details.dataset.sceneDisclosure = identity;
    const summary = element('summary', '', label);
    summary.dataset.sceneFocus = `disclosure:${identity}`;
    details.append(summary, content);
    return details;
}

function resolveParent(origin, legacyName, peers) {
    const candidates = origin?.parentIntegrity ? peers.filter(item => item.chat_metadata?.integrity === origin.parentIntegrity) : peers.filter(item => item.file_name === legacyName);
    const exact = origin?.parentFile && candidates.find(item => item.file_name === origin.parentFile);
    return { parent: exact || (candidates.length === 1 ? candidates[0] : null), ambiguous: candidates.length > 1 };
}

/** Presentation only. Native owners supply memory, requests, metadata and actions. */
export class WorkspaceScene {
    constructor(panel) {
        this.panel = panel;
        this.section = 'setup';
        this.revision = 0;
        this.panel.addEventListener('click', event => {
            const tab = event.target.closest('[data-scene-section]');
            if (!tab) return;
            this.section = tab.dataset.sceneSection;
            this.signature = '';
            void this.render(this.entity, this.record, this.records);
        });
    }

    async render(entity, record, records = [], busy = this.busy, indexState = this.indexState || {}) {
        this.indexState = indexState;
        this.busy = busy;
        this.entity = entity; this.record = record; this.records = records;
        if (!entity || !record) return;
        const requestRevision = this.requestRevision = (this.requestRevision || 0) + 1;
        const owner = getCurrentChatIdentity();
        if (this.owner !== owner) { this.owner = owner; this.selected = -1; this.signature = ''; }
        const replies = chat.map((message, index) => ({ message, index })).filter(item => !item.message.is_user && !item.message.is_system);
        if (!replies.some(item => item.index === this.selected)) this.selected = replies.at(-1)?.index ?? -1;
        let memory = { state: 'uninitialized' };
        if (extension_settings.disabledExtensions?.includes('memory')) memory = { state: 'disabled' };
        else if (document.getElementById('memory_contents')) {
            const native = await import('./extensions/memory/index.js');
            memory = { state: 'ready', ...native.getMemorySnapshot() };
        }
        if (owner !== getCurrentChatIdentity() || requestRevision !== this.requestRevision) return;
        const lore = getWorldInfoBindings(entity.kind === 'group' ? entity.members.map(member => member.raw) : [entity.raw]);
        const signature = JSON.stringify([indexState, lore, owner, entity.name, entity.raw?.data?.scenario, entity.raw?.scenario, entity.members?.map(member => [member.name, member.raw?.data?.scenario, member.raw?.scenario]), record.archived, chat_metadata.scenario, memory, this.section, this.selected, replies.map(item => [item.index, item.message.swipe_id, item.message.extra?.client_context, item.index === this.selected && !isGenerating() ? item.message.mes : null]), isGenerating(), busy, records.map(item => [item.key, item.chat_metadata?.branch_origin, item.chat_metadata?.integrity])]);
        if (this.signature === signature) return;
        const changing = isGenerating() && this.selected === chat.length - 1;
        const capture = this.section === 'reply' && !changing ? await readClientCapture(owner, chat[this.selected], this.selected) : null;
        if (owner !== getCurrentChatIdentity() || requestRevision !== this.requestRevision) return;
        this.signature = signature;
        const revision = ++this.revision;
        const focusKey = node => node.dataset.sceneFocus || node.dataset.workspaceAction && `${node.dataset.workspaceAction}:${node.dataset.chat || node.dataset.message || ''}` || (node.tagName === 'SUMMARY' ? `disclosure:${node.textContent}` : null);
        const focused = this.panel.contains(document.activeElement) ? focusKey(document.activeElement) : null;
        const scrollTop = this.panel.scrollTop;
        const expanded = new Set([...this.panel.querySelectorAll('details[open]')].map(node => node.dataset.sceneDisclosure));
        const header = element('div', 'workspace-tools-heading');
        header.append(element('h2', '', 'Scene details'), button('Close scene details', 'close-inspector', {}, 'workspace-icon-button', 'fa-xmark'));
        header.lastChild.dataset.sceneFocus = 'close';
        header.lastChild.setAttribute('aria-label', 'Close scene details');
        const identity = element('div', 'workspace-scene-identity');
        identity.append(portrait(entity), element('div', '', entity.name), element('strong', '', record.file_name), element('small', '', `${entity.kind === 'group' ? 'Cast' : 'Character'} story${record.archived ? ' · Archived · Read only' : ''}`));
        const nav = element('nav', 'workspace-scene-sections');
        nav.setAttribute('aria-label', 'Scene details sections');
        for (const [id, label] of [['setup', 'Setup & memory'], ['reply', 'Reply context'], ['related', 'Related stories']]) {
            const tab = element('button', this.section === id ? 'active' : '', label);
            tab.type = 'button'; tab.dataset.sceneSection = id; tab.dataset.sceneFocus = id;
            if (this.section === id) tab.setAttribute('aria-current', 'page');
            nav.append(tab);
        }
        const body = element('div', 'workspace-scene-content');
        const nextPanel = this.panel.cloneNode(false);
        nextPanel.append(header, identity, nav, body);
        if (this.section === 'setup') this.setup(body, entity, record, memory, lore);
        else if (this.section === 'related') this.related(body, entity, record, records);
        else this.reply(body, replies, capture, changing);
        if (revision !== this.revision) return;
        for (const node of nextPanel.querySelectorAll('details')) { node.open = expanded.has(node.dataset.sceneDisclosure); node.dataset.sceneKey = `${owner}:${this.section}:block:${node.dataset.sceneDisclosure}`; }
        for (const node of nextPanel.querySelectorAll('button, select, input, a, summary, pre')) {
            const key = focusKey(node);
            if (key) node.dataset.sceneKey = `${owner}:${this.section}:${key}`;
        }
        for (const action of nextPanel.querySelectorAll('[data-workspace-action]')) action.dataset.sceneOwner = owner;
        morphdom(this.panel, nextPanel, { childrenOnly: true, getNodeKey: node => node.dataset?.sceneKey, onBeforeElUpdated: (from, to) => !from.isEqualNode(to) });
        if (focused) [...this.panel.querySelectorAll('button, select, input, a, summary, pre')].find(node => focusKey(node) === focused)?.focus({ preventScroll: true });
        this.panel.scrollTop = scrollTop;
    }

    setup(body, entity, record, memory, lore) {
        body.append(element('h3', '', 'Current story setup'));
        if (entity.kind === 'group') {
            const cast = element('div', 'workspace-profile-cast');
            for (const member of entity.members) cast.append(button(member.name, 'profile', { entity: member.key }, 'workspace-back-link'));
            const edit = button('Cast reply order & members', 'edit-entity', { entity: entity.key }, 'workspace-button', 'fa-users');
            edit.disabled = record.archived || isGenerating() || this.busy;
            body.append(cast, edit);
        }
        if (chat_metadata.scenario) {
            body.append(element('p', 'workspace-scope', 'Premise · This story override'), element('p', 'workspace-scene-premise', chat_metadata.scenario));
        } else if (entity.kind === 'group') {
            body.append(element('p', 'workspace-scope', 'Premise · Shared cast member cards'), element('p', '', 'The native cast mode and active speaker determine which member fields are assembled. Reply context shows what was recorded for an individual reply.'));
            for (const member of entity.members) body.append(disclosure(member.name, member.raw?.data?.scenario || member.raw?.scenario || 'No premise on this card.', member.key));
        } else {
            body.append(element('p', 'workspace-scope', 'Premise · Shared character card'), element('p', 'workspace-scene-premise', entity.raw?.data?.scenario || entity.raw?.scenario || 'No premise set. The character and conversation can still guide the story.'));
        }
        const edit = button('Edit this story’s overrides', 'story-overrides', {}, 'workspace-button', 'fa-pen');
        edit.disabled = record.archived || isGenerating() || this.busy;
        body.append(edit, element('p', 'workspace-scope', 'Scenario, examples and system overrides apply to this transcript. Empty overrides use the shared source.'));
        body.append(element('h3', '', 'Summary memory'));
        if (memory.state !== 'ready') body.append(element('p', '', memory.state === 'disabled' ? 'The Summarize extension is disabled. No active summary can be verified.' : 'Summarize is not initialized. No active summary can be verified.'));
        else {
            body.append(element('p', '', memory.paused ? 'Automatic summary updates are paused. Existing injection remains separate.' : 'Summary updates are not paused. The configured source must be available and its update triggers met.'));
            body.append(element('p', '', memory.text ? `Latest effective summary is anchored at message ${memory.anchor + 1}. This is not a verified coverage range.` : 'No effective saved summary. The native summary owner skips the final message.'));
            if (memory.text) body.append(disclosure('Saved summary', memory.text));
            body.append(element('p', '', memory.injected ? 'Summary text is currently configured for prompt injection. Reply context shows recorded use.' : 'No summary text is currently configured for prompt injection.'));
            if (memory.saving) body.append(element('p', 'workspace-scope', memory.saving));
        }
        body.append(element('h3', '', 'Attached lore'));
        if (!lore.length) body.append(element('p', '', 'No lorebooks attached to the current setup.'));
        for (const item of lore.slice(0, 20)) body.append(element('p', '', `${item.name} · ${item.scope}`));
        if (lore.length > 20) body.append(element('p', '', 'Showing 20 attachments. Open World & lore for all bindings.'));
        body.append(element('p', 'workspace-scope', 'Configured attachments do not prove entry activation or inclusion. Cast mode and active speaker also affect lore selection. Recorded reply context shows available assembled lore text.'));
        body.append(element('h3', '', 'Correct the source'));
        const links = [
            ['Summary editor & configuration', 'memory-settings', 'Summary text belongs to this story. Automation, prompts and injection settings are shared.'],
            ['World & lore', 'world', 'Shared lorebooks and activation rules.'],
            ['Author’s Note', 'authors-note', 'Authored instructions for this story, with separate reusable defaults and character options in the native editor.'],
            ['Retrieval', 'embeddings-settings', 'Native vector retrieval configuration.'],
            [name1 || 'Your persona', 'persona', 'Reusable persona settings.'],
            ['Writing & replies', 'generation', 'Shared provider preset, sampling and reply budgets.'],
            ['Advanced prompts', 'prompts', 'Native system, instruction and formatting controls.'],
        ];
        for (const [label, action, scope] of links) {
            const link = button(label, action, {}, 'workspace-back-link');
            // An archive can be inspected without silently enabling a native editor.
            link.disabled = record.archived || isGenerating() || this.busy;
            body.append(link, element('p', 'workspace-scope', scope));
        }
        body.append(button('Character and stories', 'history', {}, 'workspace-back-link'));
    }

    reply(body, replies, record, changing) {
        body.append(element('h3', '', 'Selected reply'));
        if (!replies.length) { body.append(element('p', '', 'No character reply in this story yet.')); return; }
        const label = element('label', 'workspace-reply-picker', 'Reply to inspect');
        const select = element('select', 'text_pole');
        select.dataset.sceneFocus = 'reply-picker';
        for (const { message, index } of replies) {
            const option = element('option', '', `${index + 1} · ${message.name || 'Character'} · ${String(message.mes).slice(0, 70)}`);
            option.value = String(index); option.selected = index === this.selected; select.append(option);
        }
        select.addEventListener('change', () => { this.selected = Number(select.value); this.signature = ''; void this.render(this.entity, this.record, this.records); });
        label.append(select); body.append(label);
        const message = chat[this.selected];
        body.append(element('p', 'workspace-scope', `Alternative ${(message.swipe_id ?? 0) + 1} · ${changing ? 'Reply in progress' : 'Current selected revision'}`));
        if (changing) {
            body.append(element('p', '', 'This reply is still changing. Its current revision can be inspected when generation ends. Older replies remain available.'));
        } else if (!record) {
            body.append(element('p', '', 'Recorded context unavailable for this reply revision in this browser. Older replies, edits, copied transcripts and evicted captures cannot be reconstructed as exact history. The legacy filename cache is not used.'));
        } else {
            body.append(element('p', '', `${record.stage} · ${record.created}`));
            const facts = element('dl', 'workspace-context-facts');
            for (const [label, value] of [['Model', record.request?.model || record.model], ['Provider', record.request?.chat_completion_source || record.api], ['Preset', record.preset || 'Unknown'], ['Configured context', record.contextCapacity ?? 'Unavailable'], ['Available prompt budget', record.contextBudget ?? 'Unknown'], ['Output budget', record.request?.max_tokens ?? record.request?.max_completion_tokens ?? record.outputBudget ?? 'Unavailable']]) facts.append(element('dt', '', label), element('dd', '', String(value)));
            body.append(facts);
            if (record.omissions?.length) body.append(element('p', 'workspace-scope', `Capture omissions: ${record.omissions.join('; ')}`));
            body.append(disclosure('Recorded request parameters', JSON.stringify(record.request ? Object.fromEntries(Object.entries(record.request).filter(([key]) => key !== 'messages')) : {}, null, 2)));
            body.append(disclosure('Recorded client messages', typeof record.request?.messages === 'string' ? record.request.messages : JSON.stringify(record.request?.messages || [], null, 2)));
            for (const [key, value] of Object.entries(record.components)) if (value) body.append(disclosure(componentLabels[key] || key, value));
        }
        body.append(element('p', 'workspace-scope', 'Current setup can differ from this recorded request. Components overlap and do not form additive token counts. Captures retain at most 60 replies in this browser, up to 240,000 characters each. Media and tool payloads are omitted.'));
        body.append(element('p', 'workspace-scope', 'Server compatibility conversion, the final provider request and model chat template are unavailable here. No inference runs when inspecting a reply.'));
        const branch = button('Branch from this reply', 'scene-branch', { message: String(this.selected), swipe: message.swipes?.length ? String(message.swipe_id ?? 0) : '' }, 'workspace-button', 'fa-code-branch');
        branch.disabled = this.record.archived || isGenerating() || this.busy;
        body.append(branch);
    }

    related(body, entity, record, records) {
        body.append(element('h3', '', 'Related stories'), element('p', '', 'Branches copy the transcript through the selected reply and its chat overrides. Character cards, lorebooks, provider settings and presets remain shared.'));
        if (this.indexState.loading) body.append(element('p', 'workspace-scope', 'Loading related story index…'));
        if (this.indexState.error) { body.append(element('p', '', 'Related story index unavailable. Known links may be incomplete.'), button('Retry story index', 'refresh-chats', {}, 'workspace-button')); }
        const peers = records.filter(item => item.entityKey === entity.key);
        const origin = chat_metadata.branch_origin;
        const { parent, ambiguous } = resolveParent(origin, chat_metadata.main_chat, peers);
        if (origin || chat_metadata.main_chat) {
            body.append(element('p', '', origin ? `${origin.kind === 'checkpoint' ? 'Checkpoint' : 'Branch'} from message ${origin.messageIndex + 1}, alternative ${(origin.swipeId ?? 0) + 1}.` : 'Legacy parent reference. Full origin was not recorded.'));
            if (parent && parent.key !== record.key) { const link = button(`Open parent: ${parent.file_name}${parent.archived ? ' · Archived' : ''}`, 'open-chat', { chat: parent.key }, 'workspace-back-link'); link.disabled = isGenerating(); body.append(link); } else body.append(element('p', '', ambiguous ? 'Parent ambiguous. Multiple transcripts have this identity; no story was guessed.' : 'Parent unavailable. It may have been renamed, deleted or belong to unavailable history.'));
        } else body.append(element('p', '', 'No parent recorded for this story.'));
        const children = peers.filter(item => item.key !== record.key && resolveParent(item.chat_metadata?.branch_origin, item.chat_metadata?.main_chat, peers).parent?.key === record.key);
        if (!children.length && !this.indexState.loading && !this.indexState.error) body.append(element('p', '', 'No related branches or checkpoints found.'));
        for (const child of children.slice(0, 20)) {
            const link = button(`${child.file_name}${child.archived ? ' · Archived' : ''}`, 'open-chat', { chat: child.key }, 'workspace-back-link');
            link.disabled = isGenerating(); body.append(link);
        }
        if (children.length > 20) body.append(element('p', '', 'Showing the 20 most recent related stories. Find the rest in Stories.'));
    }
}
