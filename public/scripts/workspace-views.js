import { getThumbnailUrl, name1 } from '../script.js';
import { translate } from './i18n.js';

export const workspaceSettings = [
    { id: 'connection', label: 'Models & connections', icon: 'fa-plug', description: 'Choose the model and provider that write your characters’ replies.', drawer: 'sys-settings-button', panel: 'rm_api_block' },
    { id: 'generation', label: 'Writing & replies', icon: 'fa-sliders', description: 'Reply length, creativity, context limits, and generation presets.', drawer: 'ai-config-button', panel: 'left-nav-panel' },
    { id: 'persona', label: 'Your persona', icon: 'fa-user', description: 'Choose who you are in the story, with a name, portrait, and description.', drawer: 'persona-management-button', panel: 'PersonaManagement' },
    { id: 'world', label: 'World & lore', icon: 'fa-book-atlas', description: 'Build places, history, and lorebooks for your characters.', drawer: 'WI-SP-button', panel: 'WorldInfo' },
    { id: 'image-settings', label: 'Image generation', icon: 'fa-image', description: 'Connect an image provider and tune portraits and scene illustrations.', drawer: 'extensions-settings-button', panel: 'rm_extensions_block', focus: '.sd_settings' },
    { id: 'voice-settings', label: 'Voice & narration', icon: 'fa-volume-high', description: 'Choose a speech provider, assign character voices, and set playback behavior.', drawer: 'extensions-settings-button', panel: 'rm_extensions_block', focus: '#tts_container' },
    { id: 'settings', label: 'Appearance & behavior', icon: 'fa-gear', description: 'Reading preferences, account controls, and the classic layout.', drawer: 'user-settings-button', panel: 'user-settings-block' },
    { id: 'backgrounds', label: 'Scene backgrounds', icon: 'fa-panorama', description: 'Choose the backdrop for your stories.', drawer: 'backgrounds-button', panel: 'Backgrounds' },
    { id: 'prompts', label: 'Advanced prompts', icon: 'fa-align-left', description: 'System prompts, instruction templates, and context formatting.', drawer: 'advanced-formatting-button', panel: 'AdvancedFormatting' },
    { id: 'extensions', label: 'Extensions', icon: 'fa-cubes', description: 'Manage additional tools and their full configuration.', drawer: 'extensions-settings-button', panel: 'rm_extensions_block' },
    { id: 'character-editor', label: 'Character editor', icon: 'fa-address-card', description: 'Create, import, tag, and edit character cards and group behavior.', drawer: 'rightNavHolder', panel: 'right-nav-panel' },
];

export function element(tag, className = '', text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

export function icon(name) {
    const node = element('i', `fa-solid ${name}`);
    node.setAttribute('aria-hidden', 'true');
    return node;
}

export function button(label, action, data = {}, className = 'workspace-button', symbol) {
    const node = element('button', className);
    node.type = 'button';
    node.dataset.workspaceAction = action;
    for (const [key, value] of Object.entries(data)) node.dataset[key] = value;
    if (symbol) node.append(icon(symbol));
    node.append(element('span', '', translate(label)));
    return node;
}

export function plainText(value = '') {
    return String(value).replace(/<[^>]*>/g, '').replace(/\{\{char\}\}/gi, '').trim();
}

export function portrait(entity, className = '') {
    if (entity.kind === 'group') {
        const group = element('span', `workspace-cast-portrait ${className}`);
        if (entity.members.length) {
            for (const member of entity.members.slice(0, 4)) group.append(portrait(member, /library|profile/.test(className) ? 'workspace-full-portrait' : ''));
        } else group.append(icon('fa-users'));
        return group;
    }
    const image = element('img', className);
    image.src = /library|profile|full-portrait/.test(className) ? `/characters/${encodeURIComponent(entity.id)}` : getThumbnailUrl('avatar', entity.id);
    image.alt = '';
    image.loading = 'lazy';
    return image;
}

function pageHeading(title, description, actions = []) {
    const header = element('header', 'workspace-page-heading');
    const text = element('div');
    text.append(element('h1', '', translate(title)), element('p', '', translate(description)));
    const controls = element('div', 'workspace-page-actions');
    controls.append(...actions);
    header.append(text, controls);
    return header;
}

function search(value, placeholder) {
    const label = element('label', 'workspace-page-search');
    label.append(icon('fa-magnifying-glass'));
    const input = element('input');
    input.type = 'search';
    input.id = 'workspace-view-search';
    input.value = value;
    input.placeholder = translate(placeholder);
    input.setAttribute('aria-label', translate(placeholder));
    label.append(input);
    return label;
}

function empty(title, description, action) {
    const node = element('div', 'workspace-empty');
    node.append(element('h2', '', translate(title)), element('p', '', translate(description)));
    if (action) node.append(action);
    return node;
}

export function entityCard(entity) {
    const card = button('', 'profile', { entity: entity.key }, 'workspace-library-card');
    card.replaceChildren(portrait(entity, 'workspace-library-portrait'));
    const text = element('span', 'workspace-library-card-text');
    text.append(element('strong', '', entity.name), element('small', '', entity.description || (entity.kind === 'group' ? 'A story with your cast' : 'Meet this character')));
    const tags = element('span', 'workspace-card-tags');
    for (const tag of entity.tags.slice(0, 3)) tags.append(element('span', '', tag));
    if (entity.kind === 'group') tags.append(element('span', '', `${entity.members.length} characters`));
    if (tags.childElementCount) text.append(tags);
    card.append(text);
    if (entity.favorite) card.append(icon('fa-star'));
    card.setAttribute('aria-label', `Meet ${entity.name}`);
    return card;
}

export function chatRow(record, entity, compact = false) {
    const row = element('div', compact ? 'workspace-scene-row workspace-scene-compact' : 'workspace-scene-row');
    row.dataset.chatKey = record.key;
    const open = button('', 'open-chat', { chat: record.key }, 'workspace-scene-open');
    open.replaceChildren(portrait(entity, 'workspace-scene-portrait'));
    const text = element('span', 'workspace-scene-text');
    text.append(element('strong', '', record.title), element('small', '', entity.name));
    if (!compact) text.append(element('span', 'workspace-scene-preview', plainText(record.mes) || 'The story is ready to continue.'));
    open.append(text);
    open.setAttribute('aria-label', `Continue ${record.title} with ${entity.name}`);
    row.append(open);
    if (!compact) {
        const date = element('time', 'workspace-scene-date');
        if (Number.isFinite(record.updated) && record.updated > 0) {
            date.dateTime = new Date(record.updated).toISOString();
            date.textContent = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(record.updated);
            date.title = new Date(record.updated).toLocaleString();
        }
        row.append(date);
        if (record.archived) row.append(button('Restore', 'restore-chat', { chat: record.key }, 'workspace-button workspace-small', 'fa-box-open'));
        row.append(chatMenu(record));
    }
    return row;
}

export function chatMenu(record) {
    const details = element('details', 'workspace-scene-menu');
    const summary = element('summary', 'workspace-icon-button');
    summary.append(icon('fa-ellipsis'));
    summary.setAttribute('aria-label', `Actions for ${record.title || record.file_name}`);
    const menu = element('div', 'workspace-action-menu');
    menu.append(
        button('Rename', 'rename-chat', { chat: record.key }, 'workspace-menu-action', 'fa-pen'),
        button(record.archived ? 'Restore' : 'Archive', record.archived ? 'restore-chat' : 'archive-chat', { chat: record.key }, 'workspace-menu-action', record.archived ? 'fa-box-open' : 'fa-box-archive'),
        button('Delete', 'delete-chat', { chat: record.key }, 'workspace-menu-action workspace-danger', 'fa-trash'),
    );
    details.append(summary, menu);
    return details;
}

function library(state) {
    const page = element('div', 'workspace-page workspace-library');
    page.append(pageHeading('Choose your next character', 'Meet someone new, return to a familiar character, or bring a cast together.', [
        button('Import card', 'import-character', {}, 'workspace-button', 'fa-file-import'),
        button('Create character', 'create-character', {}, 'workspace-button', 'fa-plus'),
        button('Create cast', 'create-cast', {}, 'workspace-button workspace-primary', 'fa-users'),
    ]));
    const toolbar = element('div', 'workspace-library-toolbar');
    toolbar.append(search(state.query, 'Search characters, descriptions, and tags'));
    const filters = element('div', 'workspace-filters');
    for (const [id, label] of [['all', 'All'], ['characters', 'Characters'], ['groups', 'Casts'], ['favorites', 'Favorites']]) {
        const filter = button(label, 'library-filter', { filter: id }, 'workspace-filter');
        filter.setAttribute('aria-pressed', String(state.filter === id));
        filters.append(filter);
    }
    toolbar.append(filters);
    page.append(toolbar);
    const query = state.query.toLocaleLowerCase();
    const matches = state.entities.filter(entity => (state.filter !== 'characters' || entity.kind === 'character') && (state.filter !== 'groups' || entity.kind === 'group') && (state.filter !== 'favorites' || entity.favorite) && `${entity.name} ${entity.description} ${entity.tags.join(' ')}`.toLocaleLowerCase().includes(query));
    const cards = element('div', 'workspace-library-grid');
    cards.append(...matches.map(entityCard));
    page.append(matches.length ? cards : empty('No characters match', 'Try a different search or import a character card.', button('Import a card', 'import-character')));
    return page;
}

function conversations(state, archived) {
    const page = element('div', 'workspace-page workspace-conversations');
    page.append(pageHeading(archived ? 'Archived stories' : 'Your stories', archived ? 'Keep finished scenes here. Restore any story when you want to return.' : 'Pick up a scene where you left off, or begin something new.', archived ? [] : [button('New story', 'characters', {}, 'workspace-button workspace-primary', 'fa-plus')]));
    page.append(search(state.query, 'Search stories and characters'));
    const query = state.query.toLocaleLowerCase();
    const records = state.chats.filter(record => record.archived === archived && `${record.title} ${record.entity.name} ${plainText(record.mes)}`.toLocaleLowerCase().includes(query));
    const list = element('div', 'workspace-scene-list');
    for (const record of records) {
        const entity = state.entities.find(item => item.key === record.entityKey);
        if (entity) list.append(chatRow(record, entity));
    }
    if (state.loading && !records.length) page.append(element('p', 'workspace-loading', 'Loading your stories…'));
    else if (state.error) page.append(empty('Your stories could not load', state.error, button('Try again', 'refresh-chats')));
    else page.append(records.length ? list : empty(archived ? 'No archived stories' : 'Your next story is waiting', state.query ? 'Try a different title or character name.' : archived ? 'Archive a scene from its menu to keep it here without deleting it.' : 'Choose a character, read their premise, and start a scene.', archived ? null : button('Choose a character', 'characters', {}, 'workspace-button workspace-primary')));
    return page;
}

function profile(state) {
    const entity = state.entities.find(item => item.key === state.entityKey);
    if (!entity) return empty('This character is no longer available', 'Return to your library to choose another character.', button('Characters', 'characters'));
    const page = element('div', 'workspace-page workspace-profile');
    page.append(button('Characters', 'characters', {}, 'workspace-back-link', 'fa-arrow-left'));
    const hero = element('div', 'workspace-profile-hero');
    hero.append(portrait(entity, 'workspace-profile-portrait'));
    const text = element('div', 'workspace-profile-intro');
    text.append(element('h1', '', entity.name), element('p', '', entity.description || 'A character ready for your next story.'));
    const controls = element('div', 'workspace-profile-actions');
    const histories = state.chats.filter(record => record.entityKey === entity.key);
    const recent = histories.find(record => !record.archived);
    if (recent) controls.append(button('Continue latest story', 'open-chat', { chat: recent.key }, 'workspace-button workspace-primary', 'fa-play'));
    controls.append(button('Start new story', 'start-story', { entity: entity.key }, recent ? 'workspace-button' : 'workspace-button workspace-primary', 'fa-plus'));
    controls.append(button(entity.kind === 'group' ? 'Edit cast' : 'Edit character', 'edit-entity', { entity: entity.key }, 'workspace-button', 'fa-pen'));
    text.append(controls);
    if (entity.kind === 'group') {
        const members = element('div', 'workspace-profile-cast');
        for (const member of entity.members) {
            const memberButton = button(member.name, 'profile', { entity: member.key }, 'workspace-cast-member');
            memberButton.prepend(portrait(member));
            members.append(memberButton);
        }
        text.append(members);
    }
    hero.append(text);
    page.append(hero);
    const details = element('div', 'workspace-profile-details');
    const data = entity.raw.data || entity.raw;
    if (entity.kind === 'character') {
        for (const [label, value] of [['The scenario', data.scenario], ['Opening message', data.first_mes], ['Character card details', data.description]]) {
            if (!value) continue;
            const section = element('details', 'workspace-profile-detail');
            section.append(element('summary', '', label), element('p', '', String(value).replace(/<[^>]*>/g, '').replace(/\{\{char\}\}/gi, entity.name).replace(/\{\{user\}\}/gi, name1 || 'You')));
            details.append(section);
        }
    }
    const heading = element('div', 'workspace-profile-history-heading');
    heading.append(element('h2', '', `Stories with ${entity.name}`));
    const tabs = element('div', 'workspace-filters');
    for (const [id, label] of [['active', 'Active'], ['archived', 'Archived']]) {
        const tab = button(label, 'profile-scope', { scope: id }, 'workspace-filter');
        tab.setAttribute('aria-pressed', String(state.profileScope === id));
        tabs.append(tab);
    }
    heading.append(tabs);
    page.append(heading);
    const records = histories.filter(record => record.archived === (state.profileScope === 'archived'));
    const list = element('div', 'workspace-scene-list');
    list.append(...records.map(record => chatRow(record, entity)));
    page.append(records.length ? list : empty(state.profileScope === 'archived' ? 'No archived stories with this character' : 'A fresh beginning', state.profileScope === 'archived' ? 'Finished scenes will appear here when you archive them.' : 'Start a new story to write your first scene together.'));
    if (details.childElementCount) page.append(details);
    return page;
}

function settings() {
    const page = element('div', 'workspace-page workspace-settings');
    page.append(pageHeading('Make this space yours', 'Set up your models and creative tools, then return to the story.'));
    const grid = element('div', 'workspace-settings-grid');
    for (const setting of workspaceSettings.filter(item => item.id !== 'character-editor')) {
        const tile = button('', setting.id, {}, 'workspace-settings-item');
        tile.replaceChildren(icon(setting.icon));
        const text = element('span');
        text.append(element('strong', '', translate(setting.label)), element('small', '', translate(setting.description)));
        tile.append(text, icon('fa-chevron-right'));
        grid.append(tile);
    }
    page.append(grid);
    return page;
}

export function renderWorkspaceView(state) {
    if (state.view === 'characters') return library(state);
    if (state.view === 'profile') return profile(state);
    if (state.view === 'archive') return conversations(state, true);
    if (state.view === 'settings-page') return settings();
    return conversations(state, false);
}
