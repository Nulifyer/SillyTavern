import {
    characters, doNavbarIconClick, isGenerating, name1, name2, online_status, unshallowCharacter,
} from '../script.js';
import { eventSource, event_types } from './events.js';
import { extension_settings } from './extensions.js';
import { createGroupWithMembers, groups, selected_group } from './group-chats.js';
import { translate } from './i18n.js';
import { callGenericPopup, POPUP_RESULT, POPUP_TYPE } from './popup.js';
import { shouldSendOnEnter } from './RossAscends-mods.js';
import { accountStorage } from './util/AccountStorage.js';
import { WorkspaceChats } from './workspace-chats.js';
import {
    button, chatMenu, chatRow, element, plainText, portrait,
    renderWorkspaceView, workspaceSettings,
} from './workspace-views.js';

const transcripts = new WorkspaceChats();
const state = { view: 'characters', entities: [], chats: [], entityKey: '', query: '', filter: 'all', profileScope: 'active', loading: false, error: '' };
const mainDestinations = [
    { id: 'chats', label: 'Chats', icon: 'fa-comment-dots' },
    { id: 'characters', label: 'Characters', icon: 'fa-address-card' },
    { id: 'archive', label: 'Archive', icon: 'fa-box-archive' },
];
let navigationQueue = Promise.resolve();
let returnFocus;
let chatRequest;
let refreshTimer;
let initializedView = false;
let imageBusy = false;
let sidebarSignature = '';

function entities() {
    const library = characters.map(character => ({
        kind: 'character', id: character.avatar, key: `character:${character.avatar}`, name: character.name,
        description: plainText(character.data?.creator_notes || character.description || character.data?.description).slice(0, 240),
        tags: (character.data?.tags || character.tags || []).filter(tag => typeof tag === 'string'),
        favorite: Boolean(character.fav || character.data?.extensions?.fav), members: [], raw: character,
    }));
    return [...library, ...groups.map(group => {
        const members = (group.members || []).map(avatar => library.find(item => item.id === avatar)).filter(Boolean);
        return { kind: 'group', id: group.id, key: `group:${group.id}`, name: group.name, description: members.map(item => item.name).join(', '), tags: [], favorite: Boolean(group.fav), members, raw: group };
    })].sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name));
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
    const panels = new Set();
    for (const destination of workspaceSettings) {
        if (panels.has(destination.panel)) continue;
        panels.add(destination.panel);
        const panel = document.getElementById(destination.panel);
        if (panel?.classList.contains('openDrawer')) await doNavbarIconClick.call(document.querySelector(`#${destination.drawer} > .drawer-toggle`));
    }
}

async function openDrawer(action, trigger) {
    const destination = workspaceSettings.find(item => item.id === action);
    if (!destination) return;
    returnFocus = trigger || document.activeElement;
    setMobileNavigation(false);
    await closeDrawers();
    const panel = document.getElementById(destination.panel);
    const heading = panel.querySelector('.workspace-panel-heading');
    heading.querySelector('h2').textContent = translate(destination.label);
    heading.querySelector('p').textContent = translate(destination.description);
    await doNavbarIconClick.call(document.querySelector(`#${destination.drawer} > .drawer-toggle`));
    if (action === 'voice-settings') await refreshVoices();
    if (destination.focus) {
        const section = panel.querySelector(destination.focus);
        if (section) {
            const toggle = section.querySelector('.inline-drawer-toggle');
            if (toggle && !$(section.querySelector('.inline-drawer-content')).is(':visible')) toggle.click();
            section.scrollIntoView({ block: 'start' });
        } else toastr.info('This extension is not loaded. Enable it in Extensions to use this tool.');
    }
    panel.querySelector('.workspace-panel-close').focus();
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
    state.creativeTools = {
        voice: Boolean(extension_settings.tts?.enabled), image: Boolean(extension_settings.sd?.enabled),
        voiceAvailable: Boolean(document.getElementById('tts_enabled')), imageAvailable: Boolean(document.getElementById('sd_enabled')),
    };
    container.replaceChildren(renderWorkspaceView(state));
    if (transcripts.current() && state.view !== 'chat') {
        const currentEntity = currentCharacter();
        container.querySelector('.workspace-page')?.prepend(button(`Back to ${currentEntity?.name || 'your story'}`, 'back-chat', {}, 'workspace-return-chat', 'fa-arrow-left'));
    }
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
    const selected = state.view === 'chat' ? 'chats' : state.view === 'profile' ? 'characters' : state.view;
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
    const signature = JSON.stringify(records.map(record => [record.key, record.title, state.entities.find(entity => entity.key === record.entityKey)?.name]));
    if (signature === sidebarSignature) {
        list.querySelectorAll('[data-chat-key]').forEach(row => row.classList.toggle('active', state.view === 'chat' && row.dataset.chatKey === transcripts.current()?.key));
        return;
    }
    sidebarSignature = signature;
    list.replaceChildren();
    for (const record of records) {
        const entity = state.entities.find(item => item.key === record.entityKey);
        if (!entity) continue;
        const row = chatRow(record, entity, true);
        row.classList.toggle('active', state.view === 'chat' && transcripts.current()?.key === record.key);
        list.append(row);
    }
    if (!records.length) list.append(element('p', '', 'Your stories will appear here. Choose a character to begin.'));
}

function refreshWorkspace() {
    document.body.classList.toggle('workspace-images-enabled', Boolean(extension_settings.sd?.enabled));
    document.getElementById('workspace-image-button').hidden = !extension_settings.sd?.enabled;
    document.getElementById('workspace-voice-button').hidden = !extension_settings.tts?.enabled;
    state.entities = entities();
    const current = transcripts.current();
    const entity = currentCharacter();
    const connected = online_status !== 'no_connection' && Boolean(online_status);
    document.body.classList.toggle('workspace-connected', connected);
    document.body.classList.toggle('workspace-browsing', state.view !== 'chat');
    const titles = { characters: 'Characters', chats: 'Chats', archive: 'Archive', profile: entity?.name || 'Character profile', 'settings-page': 'Settings' };
    document.getElementById('workspace-chat-title').textContent = state.view === 'chat' ? entity?.name || name2 || 'Your story' : state.view === 'profile' ? state.entities.find(item => item.key === state.entityKey)?.name || 'Character profile' : titles[state.view];
    document.getElementById('workspace-chat-subtitle').textContent = state.view === 'chat' ? current?.file_name || 'A new scene' : 'Your characters. Your stories.';
    const headingPortrait = document.getElementById('workspace-header-portrait');
    headingPortrait.replaceChildren();
    headingPortrait.hidden = state.view !== 'chat' || !entity;
    if (state.view === 'chat' && entity) headingPortrait.append(portrait(entity));
    document.getElementById('workspace-history').hidden = state.view !== 'chat';
    const headerMenu = document.getElementById('workspace-header-menu');
    const menuSignature = state.view === 'chat' && current ? JSON.stringify([current.key, current.archived]) : '';
    if (headerMenu.dataset.signature !== menuSignature) {
        headerMenu.replaceChildren();
        headerMenu.dataset.signature = menuSignature;
        if (menuSignature) headerMenu.append(chatMenu(currentRecord()));
    }
    document.getElementById('workspace-new-story').dataset.workspaceAction = state.view === 'chat' ? 'start-current-story' : 'characters';
    document.getElementById('workspace-persona-name').textContent = name1 || 'Your persona';
    document.getElementById('workspace-connection-label').textContent = connected ? 'Model connected' : 'Connect a model';
    document.getElementById('workspace-connection-detail').textContent = connected ? online_status : 'Set up an API to write replies';
    document.getElementById('workspace-model-chip').textContent = connected ? 'Model connected' : 'Connect model';
    document.getElementById('workspace-composer-persona').textContent = name1 || 'Your persona';
    document.getElementById('workspace-cast-button').hidden = !selected_group;
    document.getElementById('workspace-composer-hint').textContent = current?.archived
        ? 'Archived story. Restore it from the story menu to continue writing.'
        : connected ? (shouldSendOnEnter() ? 'Enter to send. Shift + Enter for a new line.' : 'Use the send button to send a message.') : 'Connect a model to get replies. Your existing stories stay available.';
    document.getElementById('form_sheld').inert = document.body.classList.contains('workspace-ui') && Boolean(current?.archived);
    document.getElementById('send_textarea').placeholder = entity ? `Write your next turn with ${entity.name}…` : 'Write your next turn…';
    refreshSidebar();
    syncNavigation();
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
    refreshWorkspace();
    focusContent();
    void refreshChats();
}

async function startStory(entity) {
    if (!entity) return;
    const title = await callGenericPopup(popupContent(`A new story with ${entity.name}`, 'Give this scene a title, or leave it blank for an automatic title. Your previous stories stay in Chats.'), POPUP_TYPE.INPUT, '', { okButton: 'Start story', cancelButton: 'Cancel' });
    if (typeof title !== 'string') return;
    await transcripts.start(entity, title);
    state.view = 'chat';
    initializedView = true;
    await closeDrawers();
    refreshWorkspace();
    focusContent();
    scheduleChats();
}

function openTools(kind) {
    const dialog = document.getElementById('workspace-tools');
    const content = element('div', 'workspace-tools-content');
    const title = element('div', 'workspace-tools-heading');
    title.append(element('h2', '', kind === 'image' ? 'Illustrate this story' : 'Hear your characters'));
    const close = button('Close', 'close-tools', {}, 'workspace-icon-button', 'fa-xmark');
    close.setAttribute('aria-label', 'Close creative tools');
    title.append(close);
    content.append(title);
    if (kind === 'image') {
        content.append(element('p', '', 'Create an illustration with your configured image provider. The result appears in this conversation.'));
        const actions = element('div', 'workspace-image-actions');
        actions.append(button('Illustrate the scene', 'generate-image', { imagePrompt: 'last' }, 'workspace-button workspace-primary', 'fa-panorama'), button('Character portrait', 'generate-image', { imagePrompt: 'face' }, 'workspace-button', 'fa-user'));
        content.append(actions);
        const label = element('label', 'workspace-image-prompt');
        label.append(element('span', '', 'Or describe an image'));
        const input = element('textarea');
        input.id = 'workspace-image-prompt';
        input.placeholder = 'A lantern-lit clearing beneath ancient trees…';
        input.rows = 3;
        label.append(input);
        content.append(label, button('Generate image', 'generate-custom-image', {}, 'workspace-button', 'fa-wand-magic-sparkles'));
        const status = element('p', 'workspace-tools-status');
        status.id = 'workspace-image-status';
        status.setAttribute('role', 'status');
        status.textContent = document.getElementById('sd_gen') ? 'Uses your image generation settings.' : 'Enable Image Generation in Extensions before creating images.';
        content.append(status, button('Image settings', 'image-settings', {}, 'workspace-back-link', 'fa-gear'));
    } else {
        const enabled = document.getElementById('tts_enabled')?.checked;
        content.append(element('p', '', 'Use your character voices to read replies. Cast members keep their own voice assignments.'));
        content.append(button(enabled ? 'Disable narration' : 'Enable narration', 'toggle-voice', {}, 'workspace-button', 'fa-volume-high'));
        const actions = element('div', 'workspace-image-actions');
        const read = button('Read latest reply', 'read-reply', {}, 'workspace-button workspace-primary', 'fa-play');
        const playback = button('Play / pause', 'voice-playback', {}, 'workspace-button', 'fa-pause');
        read.disabled = !enabled;
        playback.disabled = !enabled;
        actions.append(read, playback);
        content.append(actions, element('p', 'workspace-tools-status', enabled ? 'Voice and provider assignments come from your narration settings.' : 'Enable narration and choose a voice to hear replies.'), button('Voice settings', 'voice-settings', {}, 'workspace-back-link', 'fa-gear'));
    }
    dialog.replaceChildren(content);
    if (!dialog.open) dialog.showModal();
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
    const list = element('div', 'workspace-cast-picker');
    for (const entity of entities().filter(item => item.kind === 'character')) {
        const option = element('label', 'workspace-cast-option');
        const input = element('input');
        input.type = 'checkbox';
        input.value = entity.id;
        option.append(input, portrait(entity), element('span', '', entity.name));
        list.append(option);
    }
    content.append(list, button('Create cast', 'save-cast', {}, 'workspace-button workspace-primary', 'fa-users'));
    if (list.childElementCount < 2) content.append(element('p', '', 'Import or create another character to start a cast.'));
    dialog.replaceChildren(content);
    dialog.showModal();
}

async function generateImage(prompt) {
    if (imageBusy) return;
    if (!prompt.trim()) throw new Error('Describe the image you want to create.');
    if (!document.getElementById('sd_gen')) throw new Error('Enable Image Generation in Extensions first.');
    const status = document.getElementById('workspace-image-status');
    const controls = [...document.querySelectorAll('#workspace-tools [data-workspace-action^="generate-"]')];
    imageBusy = true;
    controls.forEach(control => control.disabled = true);
    if (status) status.textContent = 'Generating your illustration…';
    try {
        const { generateWorkspaceImage } = await import('./extensions/stable-diffusion/index.js');
        const result = await generateWorkspaceImage(prompt);
        if (result && document.getElementById('workspace-tools').open) document.getElementById('workspace-tools').close();
        if (!result && status?.isConnected) status.textContent = 'The image could not be generated. Check your image provider settings.';
    } finally {
        imageBusy = false;
        controls.forEach(control => control.disabled = false);
    }
}

async function handleAction(action, target) {
    if (imageBusy && ['open-chat', 'start-story', 'start-current-story', 'archive-chat', 'delete-chat', 'rename-chat', 'edit-entity', 'create-character', 'import-character'].includes(action)) {
        throw new Error('Wait for the current illustration to finish before changing stories.');
    }
    const dialog = document.getElementById('workspace-tools');
    const record = target.dataset.chat ? state.chats.find(item => item.key === target.dataset.chat) || (currentRecord()?.key === target.dataset.chat ? currentRecord() : null) : null;
    const entity = state.entities.find(item => item.key === target.dataset.entity);
    if (['home', 'characters', 'chats', 'archive', 'settings-page'].includes(action)) return showView(action === 'home' ? 'chats' : action);
    if (workspaceSettings.some(item => item.id === action)) {
        dialog.close();
        return openDrawer(action, target);
    }
    if (action === 'profile') return showView('profile', { entity: target.dataset.entity });
    if (action === 'back-chat') { state.view = 'chat'; refreshWorkspace(); focusContent(); return; }
    if (action === 'history' || action === 'current-profile') return showView('profile', { entity: currentCharacter()?.key });
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
        await openDrawer('character-editor', target);
    } else if (action === 'create-character' || action === 'import-character') {
        await openDrawer('character-editor', target);
        document.getElementById(action === 'create-character' ? 'rm_button_create' : 'character_import_button').click();
    } else if (action === 'create-cast') openCast();
    else if (action === 'save-cast') {
        const name = document.getElementById('workspace-cast-name').value;
        const members = [...document.querySelectorAll('.workspace-cast-picker input:checked')].map(input => input.value);
        const group = await createGroupWithMembers(name, members);
        dialog.close();
        await showView('profile', { entity: `group:${group.id}` });
    } else if (action === 'image' || action === 'voice') {
        if (action === 'voice') await refreshVoices();
        openTools(action);
    } else if (action === 'close-tools') dialog.close();
    else if (action === 'toggle-voice') {
        const toggle = document.getElementById('tts_enabled');
        if (!toggle) throw new Error('Enable the TTS extension in Extensions first.');
        toggle.click();
        await refreshVoices();
        openTools('voice');
    } else if (action === 'read-reply') {
        const replies = [...document.querySelectorAll('#chat .mes[is_user="false"]:not([is_system="true"]) .mes_narrate')];
        if (!replies.length) throw new Error('There is no character reply to read yet.');
        replies.at(-1).click();
    } else if (action === 'voice-playback') document.getElementById('ttsExtensionMenuItem')?.click();
    else if (action === 'close-panel') {
        await closeDrawers();
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
    for (const item of [...mainDestinations, { id: 'settings-page', label: 'Settings', icon: 'fa-gear' }, ...workspaceSettings].filter(item => item.label.toLocaleLowerCase().includes(query))) {
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
    document.body.classList.toggle('workspace-ui', enabled);
    setMobileNavigation(false);
    document.getElementById('workspace-layout-toggle').checked = enabled;
    document.getElementById('workspace-restore').hidden = enabled;
    refreshWorkspace();
    if (!enabled) document.getElementById('form_sheld').inert = false;
    window.dispatchEvent(new Event('resize'));
}

export function initWorkspace() {
    const navigation = document.getElementById('workspace-navigation');
    for (const item of mainDestinations) navigation.append(button(item.label, item.id, {}, 'workspace-nav-item', item.icon));
    const panels = new Set();
    for (const destination of workspaceSettings) {
        if (panels.has(destination.panel)) continue;
        panels.add(destination.panel);
        const panel = document.getElementById(destination.panel);
        const heading = element('div', 'workspace-only workspace-panel-heading');
        const text = element('div');
        const title = element('h2', '', destination.label);
        title.id = `workspace-panel-title-${destination.panel}`;
        text.append(title, element('p', '', destination.description));
        const close = button('Close panel', 'close-panel', {}, 'workspace-panel-close workspace-icon-button', 'fa-xmark');
        close.setAttribute('aria-label', 'Close panel');
        heading.append(text, close);
        panel.prepend(heading);
        panel.setAttribute('role', 'region');
        panel.setAttribute('aria-labelledby', title.id);
    }
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
    const toolbar = element('div', 'workspace-only workspace-composer-tools');
    const image = button('Image', 'image', {}, 'workspace-tool-button', 'fa-image');
    image.id = 'workspace-image-button';
    const voice = button('Voice', 'voice', {}, 'workspace-tool-button', 'fa-volume-high');
    voice.id = 'workspace-voice-button';
    toolbar.append(image, voice);
    const cast = button('Cast', 'current-profile', {}, 'workspace-tool-button', 'fa-users');
    cast.id = 'workspace-cast-button';
    toolbar.append(cast);
    const persona = button('', 'persona', {}, 'workspace-tool-button workspace-composer-persona', 'fa-user');
    persona.querySelector('span').id = 'workspace-composer-persona';
    toolbar.append(persona);
    const model = button('', 'connection', {}, 'workspace-tool-button workspace-model-chip', 'fa-circle');
    model.querySelector('span').id = 'workspace-model-chip';
    toolbar.append(model);
    document.getElementById('form_sheld').prepend(toolbar);
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
        if (action === 'generate-image' || action === 'generate-custom-image') {
            void generateImage(action === 'generate-image' ? target.dataset.imagePrompt : document.getElementById('workspace-image-prompt').value).catch(showError);
        } else navigationQueue = navigationQueue.then(() => handleAction(action, target)).catch(showError);
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
            if (document.body.classList.contains('workspace-nav-open')) {
                event.preventDefault(); event.stopImmediatePropagation(); setMobileNavigation(false); document.getElementById('workspace-menu').focus();
            } else if (!isGenerating() && document.querySelector('.drawer-content.openDrawer') && !$('.edit_textarea, .reasoning_edit_textarea, #select_chat_popup').is(':visible')) {
                event.preventDefault(); event.stopImmediatePropagation(); void closeDrawers().then(focusContent);
            }
        } else if (event.key === 'Tab' && document.body.classList.contains('workspace-nav-open')) {
            const controls = [...document.querySelectorAll('#workspace-sidebar a, #workspace-sidebar button')].filter(control => control.getClientRects().length);
            if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1)?.focus(); } else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0]?.focus(); }
        }
    }, { capture: true });
    matchMedia('(max-width: 900px)').addEventListener('change', () => setMobileNavigation(false));
    eventSource.on(event_types.CHAT_RENAMED, data => { transcripts.renamed(data); scheduleChats(); });
    for (const event of [event_types.CHAT_DELETED, event_types.GROUP_CHAT_DELETED, event_types.GROUP_UPDATED, event_types.CHARACTER_DELETED, event_types.CHARACTER_EDITED, event_types.GENERATION_ENDED]) eventSource.on(event, scheduleChats);
    for (const event of [event_types.ONLINE_STATUS_CHANGED, event_types.SETTINGS_UPDATED]) eventSource.on(event, refreshWorkspace);
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
