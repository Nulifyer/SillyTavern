import { morphdom } from '../lib.js';
import {
    characters, doNavbarIconClick, isGenerating, name1, name2, online_status, unshallowCharacter,
} from '../script.js';
import { eventSource, event_types } from './events.js';
import { extension_settings } from './extensions.js';
import { createGroupWithMembers, groups, selected_group } from './group-chats.js';
import { callGenericPopup, POPUP_RESULT, POPUP_TYPE } from './popup.js';
import { shouldSendOnEnter } from './RossAscends-mods.js';
import { accountStorage } from './util/AccountStorage.js';
import { WorkspaceChats } from './workspace-chats.js';
import { WorkspaceSettings } from './workspace-settings.js';
import { WorkspaceTools } from './workspace-tools.js';
import {
    button, chatMenu, chatRow, element, plainText, portrait,
    renderWorkspaceView, workspaceSettings,
} from './workspace-views.js';

const transcripts = new WorkspaceChats();
const settingsPanel = new WorkspaceSettings();
const creativeTools = new WorkspaceTools(refreshWorkspace);
const state = { view: 'characters', entities: [], chats: [], entityKey: '', query: '', filter: 'all', profileScope: 'active', loading: false, error: '' };
const mainDestinations = [
    { id: 'chats', label: 'Stories', icon: 'fa-comment-dots' },
    { id: 'characters', label: 'Characters', icon: 'fa-address-card' },
    { id: 'archive', label: 'Archive', icon: 'fa-box-archive' },
];
let navigationQueue = Promise.resolve();
let returnFocus;
let chatRequest;
let refreshTimer;
let initializedView = false;
let portraitSignature = '';
let inspectorSignature = '';
let sidebarSignature = '';

function entities() {
    const library = characters.map(character => ({
        kind: 'character', id: character.avatar, key: `character:${character.avatar}`, name: character.name,
        description: characterSummary(character),
        tags: (character.data?.tags || character.tags || []).filter(tag => typeof tag === 'string'),
        favorite: Boolean(character.fav || character.data?.extensions?.fav), members: [], raw: character,
    }));
    return [...library, ...groups.map(group => {
        const members = (group.members || []).map(avatar => library.find(item => item.id === avatar)).filter(Boolean);
        return { kind: 'group', id: group.id, key: `group:${group.id}`, name: group.name, description: members.map(item => item.name).join(', '), tags: [], favorite: Boolean(group.fav), members, raw: group };
    })].sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name));
}

function characterSummary(character) {
    const data = character.data || character;
    const description = character.description || data.description || '';
    const embeddedScenario = description.match(/(?:^|[;[])\s*Scenario:\s*([^\]]+)/i)?.[1];
    const premise = data.scenario || embeddedScenario || (description.startsWith('[') ? data.first_mes : description) || data.creator_notes || '';
    return plainText(String(premise).replace(/\{\{char\}\}/gi, character.name).replace(/\{\{user\}\}/gi, name1 || 'You')).slice(0, 240);
}

function setMobileNavigation(open) {
    const enabled = document.body.classList.contains('workspace-ui');
    const mobile = matchMedia('(max-width: 900px)').matches;
    document.body.classList.toggle('workspace-nav-open', enabled && open);
    document.getElementById('workspace-menu').setAttribute('aria-expanded', String(enabled && open));
    document.getElementById('workspace-scrim').hidden = !enabled || !open;
    document.getElementById('workspace-sidebar').inert = enabled && mobile && !open;
    document.getElementById('sheld').inert = enabled && mobile && open;
    if (enabled && open) document.getElementById('workspace-search-button').focus();
}

function focusContent() {
    if (state.view === 'chat') {
        if (transcripts.current()?.archived) document.getElementById('workspace-header-portrait').focus();
        else document.getElementById('send_textarea').focus();
    } else document.getElementById('workspace-view').focus();
}

async function closeDrawers() {
    settingsPanel.restore();
    for (const destination of workspaceSettings) {
        const panel = document.getElementById(destination.panel);
        if (!panel?.classList.contains('openDrawer')) continue;
        if (document.body.classList.contains('workspace-ui')) {
            panel.classList.remove('openDrawer');
            panel.classList.add('closedDrawer');
        } else await doNavbarIconClick.call(document.querySelector(`#${destination.drawer} > .drawer-toggle`));
    }
}

/** Route native extension/menu entry points to the same settings presentation. */
export function openWorkspacePanel(drawerId) {
    if (!document.body.classList.contains('workspace-ui')) return false;
    const setting = workspaceSettings.find(item => item.drawer === drawerId && (!item.focus));
    if (!setting) return false;
    navigationQueue = navigationQueue.then(() => drawerId === 'rightNavHolder' ? showView('characters') : openDrawer(setting.id))
        .catch(error => toastr.error(error.message || 'The settings could not open.'));
    return true;
}

async function openDrawer(action, trigger) {
    const destination = workspaceSettings.find(item => item.id === action);
    if (!destination) return;
    returnFocus = trigger || document.activeElement;
    setMobileNavigation(false);
    if (!document.body.classList.contains('workspace-ui')) {
        await doNavbarIconClick.call(document.querySelector(`#${destination.drawer} > .drawer-toggle`));
        return;
    }
    await closeDrawers();
    await settingsPanel.open(action);
    if (action === 'voice-settings') await refreshVoices();
    syncNavigation();
}

async function refreshVoices() {
    if (document.getElementById('tts_enabled')?.checked) {
        const { initVoiceMap } = await import('./extensions/tts/index.js');
        await initVoiceMap();
    }
}

function renderPage() {
    const container = document.getElementById('workspace-view');
    const active = document.activeElement;
    const searchFocused = active?.id === 'workspace-view-search';
    const selection = searchFocused ? [active.selectionStart, active.selectionEnd] : null;
    const focusedAction = container.contains(active) && active?.dataset.workspaceAction ? JSON.stringify(active.dataset) : null;
    const scrollTop = container.scrollTop;
    state.entities = entities();
    state.currentKey = transcripts.current()?.key;
    state.generating = isGenerating();
    state.creativeTools = {
        voice: Boolean(extension_settings.tts?.enabled), image: Boolean(extension_settings.sd?.enabled),
        voiceAvailable: Boolean(document.getElementById('tts_enabled')), imageAvailable: Boolean(document.getElementById('sd_enabled')),
    };
    const next = element('section');
    next.append(renderWorkspaceView(state));
    morphdom(container, next, {
        childrenOnly: true,
        getNodeKey: node => node.id || node.dataset?.chatKey || (node.dataset?.entity ? `${node.dataset.workspaceAction}:${node.dataset.entity}` : undefined),
        onBeforeElUpdated: (from, to) => {
            if (from.isEqualNode(to)) return false;
            if (from.tagName === 'DETAILS') to.open = from.open;
            return true;
        },
    });
    container.scrollTop = scrollTop;
    if (searchFocused) {
        const input = document.getElementById('workspace-view-search');
        input?.focus();
        input?.setSelectionRange(...selection);
    } else if (focusedAction) {
        const replacement = [...container.querySelectorAll('button')].find(control => JSON.stringify(control.dataset) === focusedAction);
        if (replacement) replacement.focus();
        else container.focus();
    }
}

async function showView(view, options = {}) {
    initializedView = true;
    setMobileNavigation(false);
    await closeDrawers();
    document.body.classList.remove('workspace-inspecting');
    state.view = view;
    state.query = '';
    if (view === 'profile') {
        state.entityKey = options.entity;
        state.profileScope = 'active';
        const entity = entities().find(item => item.key === options.entity);
        if (entity?.kind === 'character') await unshallowCharacter(String(characters.findIndex(character => character.avatar === entity.id)));
    }
    renderPage();
    refreshWorkspace();
    document.getElementById('workspace-view').scrollTop = 0;
    focusContent();
    if (view === 'chats' || view === 'archive' || view === 'profile') void refreshChats();
}

function currentCharacter() {
    const record = transcripts.current();
    return record && entities().find(item => item.key === (record.group ? `group:${record.group}` : `character:${record.avatar}`));
}

function currentRecord() {
    const current = transcripts.current();
    return current && (state.chats.find(record => record.key === current.key) || { ...current, title: current.file_name, entity: currentCharacter()?.raw });
}

function syncNavigation() {
    const selected = settingsPanel.active ? 'settings-page' : state.view === 'chat' ? 'chats' : state.view === 'profile' ? 'characters' : state.view;
    document.querySelectorAll('#workspace-navigation button, #workspace-settings-link').forEach(item => {
        const active = item.dataset.workspaceAction === selected;
        item.classList.toggle('active', active);
        if (active) item.setAttribute('aria-current', 'page');
        else item.removeAttribute('aria-current');
    });
}

function refreshSidebar() {
    const list = document.getElementById('workspace-character-list');
    const records = state.chats.filter(record => !record.archived).slice(0, 8);
    const signature = JSON.stringify(records.map(record => [record.key, record.title, state.entities.find(entity => entity.key === record.entityKey)?.name, record.key === transcripts.current()?.key, isGenerating()]));
    if (signature === sidebarSignature) {
        list.querySelectorAll('[data-chat-key]').forEach(row => row.classList.toggle('active', state.view === 'chat' && row.dataset.chatKey === transcripts.current()?.key));
        return;
    }
    sidebarSignature = signature;
    list.replaceChildren();
    for (const record of records) {
        const entity = state.entities.find(item => item.key === record.entityKey);
        if (!entity) continue;
        const row = chatRow({ ...record, current: record.key === transcripts.current()?.key, generating: record.key === transcripts.current()?.key && isGenerating() }, entity, true);
        row.classList.toggle('active', state.view === 'chat' && transcripts.current()?.key === record.key);
        list.append(row);
    }
    if (!records.length) list.append(element('p', '', 'Your stories will appear here. Choose a character to begin.'));
}

function refreshWorkspace() {
    document.body.classList.toggle('workspace-images-enabled', Boolean(extension_settings.sd?.enabled));
    creativeTools.update(isGenerating(), Boolean(transcripts.current()?.archived));
    state.entities = entities();
    const current = transcripts.current();
    const entity = currentCharacter();
    const connected = online_status !== 'no_connection' && Boolean(online_status);
    document.body.classList.toggle('workspace-connected', connected);
    document.body.classList.toggle('workspace-browsing', state.view !== 'chat');
    const titles = { characters: 'Characters', chats: 'Stories', archive: 'Archive', profile: entity?.name || 'Character profile', 'settings-page': 'Settings' };
    document.getElementById('workspace-chat-title').textContent = state.view === 'chat' ? current?.file_name || 'Your story' : state.view === 'profile' ? state.entities.find(item => item.key === state.entityKey)?.name || 'Character profile' : titles[state.view];
    document.getElementById('workspace-chat-subtitle').textContent = state.view === 'chat' ? `${entity?.name || name2 || 'Character'}${selected_group ? ' • Cast story' : ''}` : 'Roleplay workspace';
    const headingPortrait = document.getElementById('workspace-header-portrait');
    headingPortrait.hidden = state.view !== 'chat' || !entity;
    headingPortrait.setAttribute('aria-expanded', String(state.view === 'chat' && document.body.classList.contains('workspace-inspecting') && !settingsPanel.active));
    if (portraitSignature !== entity?.key) {
        portraitSignature = entity?.key;
        headingPortrait.replaceChildren();
        if (entity) headingPortrait.append(portrait(entity));
    }
    document.getElementById('workspace-history').hidden = state.view !== 'chat';
    const headerMenu = document.getElementById('workspace-header-menu');
    const menuSignature = state.view === 'chat' && current ? JSON.stringify([current.key, current.archived]) : '';
    if (headerMenu.dataset.signature !== menuSignature) {
        headerMenu.replaceChildren();
        headerMenu.dataset.signature = menuSignature;
        if (menuSignature) headerMenu.append(chatMenu(currentRecord()));
    }
    document.getElementById('workspace-new-story').hidden = state.view !== 'chat';
    document.getElementById('workspace-new-story').dataset.workspaceAction = state.view === 'chat' ? 'start-current-story' : 'characters';
    document.getElementById('workspace-persona-name').textContent = name1 || 'Your persona';
    document.getElementById('workspace-connection-label').textContent = connected ? 'Model connected' : 'Connect a model';
    document.getElementById('workspace-connection-detail').textContent = connected ? online_status : 'Set up an API to write replies';
    document.getElementById('workspace-model-chip').textContent = connected ? 'Model connected' : 'Connect model';
    const activeStory = document.getElementById('workspace-active-story');
    activeStory.hidden = !current || state.view === 'chat';
    activeStory.querySelector('strong').textContent = current?.file_name || '';
    activeStory.querySelector('small').textContent = isGenerating() ? 'Reply in progress. Open story' : 'Return to your open story';
    document.getElementById('workspace-generation-status').hidden = !isGenerating();
    renderInspector(entity, current);
    document.getElementById('workspace-composer-hint').textContent = current?.archived
        ? 'Archived story. Restore it from the story menu to continue writing.'
        : connected ? (shouldSendOnEnter() ? 'Enter to send. Shift + Enter for a new line.' : 'Use the send button to send a message.') : 'Connect a model to get replies. Your existing stories stay available.';
    document.getElementById('form_sheld').inert = document.body.classList.contains('workspace-ui') && Boolean(current?.archived);
    document.getElementById('send_form').inert = document.body.classList.contains('workspace-ui') && creativeTools.busy;
    const phoneInspector = document.body.classList.contains('workspace-ui') && state.view === 'chat'
        && document.body.classList.contains('workspace-inspecting') && matchMedia('(max-width: 900px)').matches;
    document.getElementById('chat').inert = phoneInspector;
    if (phoneInspector) document.getElementById('form_sheld').inert = true;
    document.getElementById('send_textarea').placeholder = entity ? `Write your next turn with ${entity.name}…` : 'Write your next turn…';
    refreshSidebar();
    syncNavigation();
}

function renderInspector(entity, record) {
    const panel = document.getElementById('workspace-scene-info');
    if (!panel) return;
    const signature = JSON.stringify([entity?.key, entity?.description, entity?.members.map(member => member.key), record?.key, name1]);
    if (signature === inspectorSignature) return;
    inspectorSignature = signature;
    panel.replaceChildren();
    const header = element('div', 'workspace-tools-heading');
    const close = button('Close scene details', 'close-inspector', {}, 'workspace-icon-button', 'fa-xmark');
    close.setAttribute('aria-label', 'Close scene details');
    header.append(element('h2', '', 'Scene details'), close);
    panel.append(header);
    if (!entity) return;
    const cast = element('div', 'workspace-inspector-character');
    cast.append(portrait(entity, 'workspace-profile-portrait'), element('h3', '', entity.name), element('p', '', entity.description));
    panel.append(cast, button('Character and stories', 'history', {}, 'workspace-button', 'fa-address-card'));
    if (entity.kind === 'group') {
        const members = element('div', 'workspace-profile-cast');
        for (const member of entity.members) {
            const control = button(member.name, 'profile', { entity: member.key }, 'workspace-cast-member');
            control.prepend(portrait(member));
            members.append(control);
        }
        panel.append(members, button('Cast reply order & members', 'edit-entity', { entity: entity.key }, 'workspace-button', 'fa-users'));
    }
    panel.append(element('h3', '', 'You in this story'), button(name1 || 'Choose a persona', 'persona', {}, 'workspace-button', 'fa-user'));
    panel.append(element('h3', '', 'Story controls'), button('World & lore', 'world', {}, 'workspace-back-link', 'fa-book-atlas'), button('Writing & replies', 'generation', {}, 'workspace-back-link', 'fa-sliders'), button('Scene background', 'backgrounds', {}, 'workspace-back-link', 'fa-panorama'));
    if (record) panel.append(chatMenu(currentRecord()));
}

async function refreshChats() {
    clearTimeout(refreshTimer);
    chatRequest?.abort();
    const request = new AbortController();
    chatRequest = request;
    state.loading = true;
    try {
        const records = await transcripts.list(request.signal);
        if (request.signal.aborted) return;
        state.chats = records;
        state.error = '';
        if (!initializedView) {
            state.view = transcripts.current() ? 'chat' : records.some(record => !record.archived) ? 'chats' : 'characters';
            initializedView = true;
        }
    } catch (error) {
        if (request.signal.aborted) return;
        state.error = error.message;
    } finally {
        if (!request.signal.aborted) {
            state.loading = false;
            if (state.view !== 'chat') renderPage();
            refreshWorkspace();
        }
    }
}

function scheduleChats() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => void refreshChats(), 500);
}

function popupContent(title, text) {
    const content = element('div', 'workspace-popup-content');
    content.append(element('h3', '', title), element('p', '', text));
    return content;
}

async function enterChat(record) {
    await transcripts.open(record);
    state.view = 'chat';
    initializedView = true;
    setMobileNavigation(false);
    await closeDrawers();
    document.body.classList.remove('workspace-inspecting');
    refreshWorkspace();
    focusContent();
    void refreshChats();
}

async function startStory(entity) {
    if (!entity) return;
    if (isGenerating()) throw new Error('Stop the current reply before starting a different story.');
    const title = await callGenericPopup(popupContent(`A new story with ${entity.name}`, 'Give this scene a title, or leave it blank for an automatic title. Your previous scenes stay in Stories.'), POPUP_TYPE.INPUT, '', { okButton: 'Start story', cancelButton: 'Cancel' });
    if (typeof title !== 'string') return;
    await transcripts.start(entity, title);
    state.view = 'chat';
    initializedView = true;
    await closeDrawers();
    refreshWorkspace();
    focusContent();
    scheduleChats();
}

function openCast() {
    const dialog = document.getElementById('workspace-tools');
    const content = element('div', 'workspace-tools-content');
    const header = element('div', 'workspace-tools-heading');
    header.append(element('h2', '', 'Bring a cast together'), button('Close', 'close-tools', {}, 'workspace-icon-button', 'fa-xmark'));
    content.append(header, element('p', '', 'Choose at least two characters. Each keeps their own card, personality, and voice.'));
    const label = element('label', 'workspace-cast-name');
    label.append(element('span', '', 'Cast name'));
    const name = element('input');
    name.id = 'workspace-cast-name';
    name.placeholder = 'The forest companions';
    name.maxLength = 100;
    label.append(name);
    content.append(label);
    const search = element('input');
    search.type = 'search';
    search.id = 'workspace-cast-search';
    search.placeholder = 'Find a character';
    search.setAttribute('aria-label', 'Find a cast member');
    content.append(search);
    const list = element('div', 'workspace-cast-picker');
    for (const entity of entities().filter(item => item.kind === 'character')) {
        const option = element('label', 'workspace-cast-option');
        const input = element('input');
        input.type = 'checkbox';
        input.value = entity.id;
        option.append(input, portrait(entity), element('span', '', entity.name));
        list.append(option);
    }
    const count = element('p', 'workspace-cast-count', '0 characters selected');
    count.id = 'workspace-cast-count';
    count.setAttribute('role', 'status');
    const create = button('Create cast', 'save-cast', {}, 'workspace-button workspace-primary', 'fa-users');
    create.disabled = true;
    content.append(list, count, create);
    search.addEventListener('input', () => {
        const query = search.value.toLocaleLowerCase();
        for (const option of list.children) option.hidden = !option.textContent.toLocaleLowerCase().includes(query);
    });
    list.addEventListener('change', () => {
        const selected = list.querySelectorAll('input:checked').length;
        count.textContent = `${selected} characters selected`;
        create.disabled = selected < 2;
    });
    if (list.childElementCount < 2) content.append(element('p', '', 'Import or create another character to start a cast.'));
    dialog.replaceChildren(content);
    dialog.showModal();
}

async function handleAction(action, target) {
    if (creativeTools.busy && !(action === 'open-chat' && target.dataset.chat === transcripts.current()?.key) && ['open-chat', 'start-story', 'start-current-story', 'archive-chat', 'delete-chat', 'rename-chat', 'edit-entity', 'create-character', 'import-character'].includes(action)) {
        throw new Error('Wait for the current illustration to finish before changing stories.');
    }
    const dialog = document.getElementById('workspace-tools');
    const record = target.dataset.chat ? state.chats.find(item => item.key === target.dataset.chat) || (currentRecord()?.key === target.dataset.chat ? currentRecord() : null) : null;
    const entity = state.entities.find(item => item.key === target.dataset.entity);
    if (['home', 'characters', 'chats', 'archive', 'settings-page'].includes(action)) return showView(action === 'home' ? 'chats' : action);
    if (workspaceSettings.some(item => item.id === action)) {
        dialog.close();
        return openDrawer(action, target.element);
    }
    if (action === 'profile') return showView('profile', { entity: target.dataset.entity });
    if (action === 'settings-section') { settingsPanel.selectSection(target.dataset.section); return; }
    if (action === 'back-chat') { await closeDrawers(); setMobileNavigation(false); state.view = 'chat'; refreshWorkspace(); focusContent(); return; }
    if (action === 'history') return showView('profile', { entity: currentCharacter()?.key });
    if (action === 'current-profile') {
        const open = document.body.classList.toggle('workspace-inspecting');
        document.getElementById('workspace-header-portrait').setAttribute('aria-expanded', String(open));
        refreshWorkspace();
        if (open) document.querySelector('#workspace-scene-info button').focus();
        return;
    }
    if (action === 'close-inspector') { document.body.classList.remove('workspace-inspecting'); refreshWorkspace(); document.getElementById('workspace-header-portrait').focus(); return; }
    if (action === 'library-filter') { state.filter = target.dataset.filter; renderPage(); return; }
    if (action === 'profile-scope') { state.profileScope = target.dataset.scope; renderPage(); return; }
    if (action === 'refresh-chats') return refreshChats();
    if (action === 'open-chat' && record) return enterChat(record);
    if (action === 'start-story') return startStory(entity);
    if (action === 'start-current-story') return startStory(currentCharacter());
    if (action === 'archive-chat' && record) {
        if (!await transcripts.archive(record)) return;
        if (!transcripts.current()) state.view = 'chats';
        await refreshChats();
        toastr.success('Story archived. You can restore it from Archive.');
    } else if (action === 'restore-chat' && record) {
        await transcripts.archive(record, false);
        await refreshChats();
        toastr.success('Story restored to Chats.');
    } else if (action === 'rename-chat' && record) {
        const title = await callGenericPopup(popupContent('Rename this story', `Choose a title for your scene with ${record.entity?.name || currentCharacter()?.name}.`), POPUP_TYPE.INPUT, record.title, { okButton: 'Save title' });
        if (typeof title === 'string' && title.trim() && title.trim() !== record.title) {
            await transcripts.rename(record, title.trim());
            await refreshChats();
        }
    } else if (action === 'delete-chat' && record) {
        const confirmed = await callGenericPopup(popupContent(`Delete “${record.title}”?`, `This permanently removes the transcript with ${record.entity?.name || currentCharacter()?.name}. Archive it instead if you want to keep the story.`), POPUP_TYPE.CONFIRM, '', { okButton: 'Delete story', cancelButton: 'Keep story', defaultResult: POPUP_RESULT.NEGATIVE });
        if (confirmed && await transcripts.remove(record)) {
            if (!transcripts.current()) state.view = 'chats';
            await refreshChats();
            toastr.success('Story deleted.');
        }
    } else if (action === 'edit-entity' && entity) {
        await transcripts.select(entity);
        await openDrawer('character-editor', target.element);
    } else if (action === 'create-character' || action === 'import-character') {
        await openDrawer('character-editor', target.element);
        document.getElementById(action === 'create-character' ? 'rm_button_create' : 'character_import_button').click();
    } else if (action === 'create-cast') openCast();
    else if (action === 'save-cast') {
        const name = document.getElementById('workspace-cast-name').value;
        const members = [...document.querySelectorAll('.workspace-cast-picker input:checked')].map(input => input.value);
        const group = await createGroupWithMembers(name, members);
        dialog.close();
        await showView('profile', { entity: `group:${group.id}` });
    } else if (action === 'image') creativeTools.openImageOptions();
    else if (action === 'close-tools') dialog.close();
    else if (action === 'toggle-voice') await creativeTools.toggleVoice();
    else if (action === 'read-reply') creativeTools.readReply();
    else if (action === 'voice-playback') document.getElementById('ttsExtensionMenuItem')?.click();
    else if (action === 'close-panel') {
        await closeDrawers();
        refreshWorkspace();
        if (returnFocus?.isConnected && returnFocus.getClientRects().length && !returnFocus.closest('[inert]')) returnFocus.focus();
        else focusContent();
    } else if (action === 'restore-workspace') {
        accountStorage.setItem('workspaceLayout', 'true');
        applyLayout(true);
    } else if (action === 'close-search') document.getElementById('workspace-command').close();
}

function renderSearch() {
    const query = document.getElementById('workspace-command-input').value.trim().toLocaleLowerCase();
    const results = document.getElementById('workspace-command-results');
    results.replaceChildren();
    for (const item of [...mainDestinations, { id: 'settings-page', label: 'Settings', icon: 'fa-gear' }, ...workspaceSettings].filter(item => item.id !== 'character-editor' && item.label.toLocaleLowerCase().includes(query))) {
        results.append(button(item.label, item.id, {}, 'workspace-command-result', item.icon));
    }
    for (const entity of entities().filter(item => item.name.toLocaleLowerCase().includes(query)).slice(0, 8)) {
        const result = button(entity.name, 'profile', { entity: entity.key }, 'workspace-command-result');
        result.prepend(portrait(entity));
        results.append(result);
    }
    for (const record of state.chats.filter(item => !item.archived && `${item.title} ${item.entity.name}`.toLocaleLowerCase().includes(query)).slice(0, 8)) {
        results.append(button(record.title, 'open-chat', { chat: record.key }, 'workspace-command-result', 'fa-comment'));
    }
    if (!results.childElementCount) results.append(element('p', '', 'No matches. Try a character, story title, or setting.'));
}

function openSearch() {
    if (document.querySelector('dialog[open]')) return;
    setMobileNavigation(false);
    document.getElementById('workspace-command-input').value = '';
    renderSearch();
    document.getElementById('workspace-command').showModal();
    document.getElementById('workspace-command-input').focus();
}

function applyLayout(enabled) {
    if (!enabled) settingsPanel.restore();
    document.body.classList.toggle('workspace-ui', enabled);
    creativeTools.setLayout(enabled);
    setMobileNavigation(false);
    document.getElementById('workspace-layout-toggle').checked = enabled;
    document.getElementById('workspace-restore').hidden = enabled;
    refreshWorkspace();
    if (!enabled) {
        document.querySelectorAll('.workspace-advanced-creative').forEach(details => details.open = true);
        document.getElementById('form_sheld').inert = false;
        document.getElementById('send_form').inert = false;
        document.getElementById('chat').inert = false;
    }
    window.dispatchEvent(new Event('resize'));
}

export function initWorkspace() {
    const navigation = document.getElementById('workspace-navigation');
    for (const item of mainDestinations) navigation.append(button(item.label, item.id, {}, 'workspace-nav-item', item.icon));
    const view = element('section', 'workspace-only');
    view.id = 'workspace-view';
    view.tabIndex = -1;
    view.setAttribute('aria-label', 'Roleplay workspace');
    document.getElementById('sheld').prepend(view);
    const tools = element('dialog', 'workspace-only');
    tools.id = 'workspace-tools';
    tools.setAttribute('aria-label', 'Creative tools');
    document.body.append(tools);
    const layoutControl = element('label', 'workspace-layout-control checkbox_label');
    const layoutToggle = element('input');
    layoutToggle.id = 'workspace-layout-toggle';
    layoutToggle.type = 'checkbox';
    layoutControl.append(layoutToggle, element('span', '', 'Dark workspace layout. Turn off to use the classic layout and custom themes.'));
    document.querySelector('#user-settings-block > .flex-container').prepend(layoutControl);
    const restore = button('Use workspace layout', 'restore-workspace', {}, 'workspace-restore menu_button', 'fa-table-columns');
    restore.id = 'workspace-restore';
    document.body.append(restore);
    settingsPanel.init();
    creativeTools.init();
    const inspector = element('aside', 'workspace-only workspace-scene-info');
    inspector.id = 'workspace-scene-info';
    inspector.setAttribute('aria-label', 'Scene details');
    document.getElementById('sheld').append(inspector);
    const hint = element('p', 'workspace-only');
    hint.id = 'workspace-composer-hint';
    document.getElementById('form_sheld').append(hint);
    document.getElementById('send_textarea').setAttribute('aria-label', 'Message');
    document.getElementById('send_textarea').setAttribute('aria-describedby', hint.id);
    document.getElementById('options_button').title = 'More chat tools';
    for (const [id, label] of [['rm_button_create', 'Create'], ['character_import_button', 'Import'], ['rm_button_group_chats', 'New group']]) document.getElementById(id).append(element('span', 'workspace-only workspace-action-label', label));
    layoutToggle.addEventListener('change', () => { accountStorage.setItem('workspaceLayout', String(layoutToggle.checked)); applyLayout(layoutToggle.checked); });
    document.addEventListener('click', event => {
        const target = event.target instanceof Element ? event.target.closest('[data-workspace-action]') : null;
        if (!target) return;
        event.preventDefault();
        if (target.disabled) return;
        const action = target.dataset.workspaceAction;
        const command = document.getElementById('workspace-command');
        if (command.open && action !== 'close-search') command.close();
        document.querySelectorAll('.workspace-scene-menu[open]').forEach(menu => menu.open = false);
        const showError = error => { console.error('Workspace action failed', error); toastr.error(error.message || 'This action could not finish. Try again.'); };
        if (['generate-scene-image', 'generate-image', 'generate-custom-image'].includes(action)) {
            if (isGenerating()) { showError(new Error('Wait for the reply to finish before illustrating this scene.')); return; }
            void creativeTools.generate(action === 'generate-scene-image' ? 'scene' : action === 'generate-image' ? target.dataset.imagePrompt : document.getElementById('workspace-image-prompt').value).catch(showError);
        } else {
            // A page may reconcile while this command waits. Capture identity at click time.
            const request = { dataset: { ...target.dataset }, element: target };
            navigationQueue = navigationQueue.then(() => handleAction(action, request)).catch(showError);
        }
    });
    document.addEventListener('input', event => {
        if (event.target.id === 'workspace-view-search') { state.query = event.target.value; renderPage(); }
    });
    document.addEventListener('change', event => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement)) return;
        if (target.dataset.workspaceCapability) {
            const native = document.getElementById(target.dataset.workspaceCapability === 'voice' ? 'tts_enabled' : 'sd_enabled');
            if (native && native.checked !== target.checked) native.click();
        }
        if (target.dataset.workspaceCapability || ['tts_enabled', 'sd_enabled'].includes(target.id)) {
            refreshWorkspace();
            if (state.view === 'settings-page') {
                const capability = target.dataset.workspaceCapability;
                renderPage();
                if (capability) document.querySelector(`[data-workspace-capability="${capability}"]`).focus();
            }
        }
    });
    document.getElementById('workspace-search-button').addEventListener('click', openSearch);
    document.getElementById('workspace-menu').addEventListener('click', () => setMobileNavigation(!document.body.classList.contains('workspace-nav-open')));
    document.getElementById('workspace-scrim').addEventListener('click', () => { setMobileNavigation(false); document.getElementById('workspace-menu').focus(); });
    document.getElementById('workspace-command-input').addEventListener('input', renderSearch);
    document.getElementById('workspace-command').addEventListener('keydown', event => {
        const buttons = [...document.querySelectorAll('#workspace-command-results button')];
        const index = buttons.indexOf(document.activeElement);
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            buttons[(index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus();
        } else if (event.key === 'Enter' && event.target.id === 'workspace-command-input') { event.preventDefault(); buttons[0]?.click(); }
    });
    document.addEventListener('keydown', event => {
        if (!document.body.classList.contains('workspace-ui') || event.isComposing) return;
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && !document.querySelector('dialog[open]')) { event.preventDefault(); openSearch(); } else if (event.key === 'Escape' && !document.querySelector('dialog[open]')) {
            if ($('.select2-dropdown').is(':visible')) return;
            if (document.body.classList.contains('workspace-nav-open')) {
                event.preventDefault(); event.stopImmediatePropagation(); setMobileNavigation(false); document.getElementById('workspace-menu').focus();
            } else if (settingsPanel.active && !$('.edit_textarea, .reasoning_edit_textarea, #select_chat_popup').is(':visible')) {
                event.preventDefault(); event.stopImmediatePropagation(); void closeDrawers().then(() => { refreshWorkspace(); focusContent(); });
            } else if (!settingsPanel.active && document.body.classList.contains('workspace-inspecting')) {
                event.preventDefault(); event.stopImmediatePropagation(); document.body.classList.remove('workspace-inspecting'); refreshWorkspace(); document.getElementById('workspace-header-portrait').focus();
            }
        } else if (event.key === 'Tab' && (document.body.classList.contains('workspace-nav-open') || (document.body.classList.contains('workspace-inspecting') && matchMedia('(max-width: 900px)').matches))) {
            const selector = document.body.classList.contains('workspace-nav-open') ? '#workspace-sidebar a, #workspace-sidebar button' : '#workspace-scene-info button, #workspace-scene-info summary';
            const controls = [...document.querySelectorAll(selector)].filter(control => control.getClientRects().length);
            if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1)?.focus(); } else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0]?.focus(); }
        }
    }, { capture: true });
    matchMedia('(max-width: 900px)').addEventListener('change', () => { setMobileNavigation(false); refreshWorkspace(); });
    eventSource.on(event_types.CHAT_RENAMED, data => { transcripts.renamed(data); scheduleChats(); });
    for (const event of [event_types.CHAT_DELETED, event_types.GROUP_CHAT_DELETED, event_types.GROUP_UPDATED, event_types.CHARACTER_DELETED, event_types.CHARACTER_EDITED, event_types.GENERATION_ENDED]) eventSource.on(event, scheduleChats);
    for (const event of [event_types.ONLINE_STATUS_CHANGED, event_types.SETTINGS_UPDATED, event_types.GENERATION_STARTED, event_types.GENERATION_AFTER_DATA, event_types.GENERATION_ENDED, event_types.GENERATION_STOPPED]) eventSource.on(event, refreshWorkspace);
    eventSource.on(event_types.CHARACTER_PAGE_LOADED, () => { if (state.view !== 'chat') renderPage(); refreshWorkspace(); });
    eventSource.on(event_types.CHAT_CHANGED, () => {
        if (state.view === 'chat' && !transcripts.current()) state.view = 'chats';
        refreshWorkspace(); scheduleChats();
    });
    eventSource.on(event_types.APP_READY, () => void refreshChats());
    renderPage();
    applyLayout(accountStorage.getItem('workspaceLayout') !== 'false');
    void refreshChats();
}
