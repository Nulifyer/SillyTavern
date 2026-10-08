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
    return String(value).replace(/<[^>]*>/g, '').replace(/\{\{char\}\}/gi, '').replace(/[*`]/g, '').trim();
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
    const row = element('article', compact ? 'workspace-scene-row workspace-scene-compact' : 'workspace-scene-row');
    row.dataset.chatKey = record.key;
    const open = button('', 'open-chat', { chat: record.key }, 'workspace-scene-open');
    open.replaceChildren(portrait(entity, 'workspace-scene-portrait'));
    const text = element('span', 'workspace-scene-text');
    text.append(element('strong', '', record.title), element('small', '', entity.name));
    if (!compact) text.append(element('span', 'workspace-scene-preview', plainText(record.mes) || 'The story is ready to continue.'));
    open.append(text);
    open.setAttribute('aria-label', `Continue ${record.title} with ${entity.name}`);
    row.append(open);
    if (record.current) {
        row.classList.add('workspace-current-story');
        text.append(element('span', 'workspace-story-state', record.generating ? 'Writing reply…' : 'Open story'));
    }
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

function decorateRecord(record, state) {
    return { ...record, current: record.key === state.currentKey, generating: record.key === state.currentKey && state.generating };
}

function library(state) {
    const page = element('div', 'workspace-page workspace-library');
    page.append(pageHeading('Characters', 'Choose who shares your next story.', [
        button('Import card', 'import-character', {}, 'workspace-button', 'fa-file-import'),
        button('Create character', 'create-character', {}, 'workspace-button workspace-primary', 'fa-plus'),
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
    const heading = element('div', 'workspace-collection-heading');
    heading.append(element('p', '', `${matches.length} ${matches.length === 1 ? 'character or cast' : 'characters and casts'}`), button('Create cast', 'create-cast', {}, 'workspace-back-link', 'fa-users'));
    page.append(heading);
    const cards = element('div', 'workspace-library-grid');
    cards.append(...matches.map(entityCard));
    page.append(matches.length ? cards : empty('No characters match', 'Try a different search or import a character card.', button('Import a card', 'import-character')));
    return page;
}

function conversations(state, archived) {
    const page = element('div', 'workspace-page workspace-conversations');
    page.append(pageHeading(archived ? 'Archive' : 'Stories', archived ? 'Finished scenes, kept for whenever you want to return.' : 'Continue a conversation or start a new scene.', archived ? [] : [button('New story', 'characters', {}, 'workspace-button workspace-primary', 'fa-plus')]));
    const toolbar = element('div', 'workspace-library-toolbar');
    toolbar.append(search(state.query, 'Search stories and characters'));
    if (archived) toolbar.append(button('Active stories', 'chats', {}, 'workspace-back-link', 'fa-comment'));
    else toolbar.append(button('View archive', 'archive', {}, 'workspace-back-link', 'fa-box-archive'));
    page.append(toolbar);
    const query = state.query.toLocaleLowerCase();
    const records = state.chats.filter(record => record.archived === archived && `${record.title} ${record.entity.name} ${plainText(record.mes)}`.toLocaleLowerCase().includes(query));
    const list = element('div', 'workspace-scene-list');
    let previousGroup;
    for (const record of records) {
        const entity = state.entities.find(item => item.key === record.entityKey);
        if (!entity) continue;
        const days = (Date.now() - record.updated) / 86400000;
        const group = days < 1 ? 'Today' : days < 7 ? 'This week' : 'Earlier stories';
        if (group !== previousGroup) {
            list.append(element('h2', 'workspace-story-date-group', group));
            previousGroup = group;
        }
        list.append(chatRow(decorateRecord(record, state), entity));
    }
    if (state.loading && !records.length) page.append(element('p', 'workspace-loading', 'Loading your stories…'));
    else if (state.error) page.append(empty('Your stories could not load', state.error, button('Try again', 'refresh-chats')));
    else page.append(records.length ? list : empty(archived ? 'No archived stories' : 'Start your first story', state.query ? 'Try a different title or character name.' : archived ? 'Archive a story from its menu to keep it here. You can restore it later.' : 'Choose a character and read their premise before beginning.', archived ? null : button('Choose a character', 'characters', {}, 'workspace-button workspace-primary')));
    return page;
}

function profile(state) {
    const entity = state.entities.find(item => item.key === state.entityKey);
    if (!entity) return empty('This character is no longer available', 'Return to your library to choose another character.', button('Characters', 'characters'));
    const page = element('div', 'workspace-page workspace-profile');
    page.append(button('All characters', 'characters', {}, 'workspace-back-link', 'fa-arrow-left'));
    const layout = element('div', 'workspace-profile-layout');
    const identity = element('aside', 'workspace-profile-identity');
    identity.append(portrait(entity, 'workspace-profile-portrait'));
    const intro = element('div', 'workspace-profile-intro');
    intro.append(element('h1', '', entity.name), element('p', '', entity.description || 'A character ready for your next story.'));
    const controls = element('div', 'workspace-profile-actions');
    controls.append(button('Start new story', 'start-story', { entity: entity.key }, 'workspace-button workspace-primary', 'fa-plus'));
    controls.append(button(entity.kind === 'group' ? 'Edit cast' : 'Edit character', 'edit-entity', { entity: entity.key }, 'workspace-back-link', 'fa-pen'));
    intro.append(controls);
    identity.append(intro);
    if (entity.kind === 'group') {
        const members = element('div', 'workspace-profile-cast');
        for (const member of entity.members) {
            const memberButton = button(member.name, 'profile', { entity: member.key }, 'workspace-cast-member');
            memberButton.prepend(portrait(member));
            members.append(memberButton);
        }
        identity.append(element('h2', '', 'Cast members'), members);
    }
    const content = element('div', 'workspace-profile-content');
    const data = entity.raw.data || entity.raw;
    const premise = element('section', 'workspace-profile-premise');
    if (entity.kind === 'character') {
        const format = value => String(value).replace(/<[^>]*>/g, '').replace(/\{\{char\}\}/gi, entity.name).replace(/\{\{user\}\}/gi, name1 || 'You');
        if (data.scenario) premise.append(element('h2', '', 'The premise'), element('p', '', format(data.scenario)));
        if (data.first_mes) {
            const opening = element('details', 'workspace-profile-detail');
            opening.append(element('summary', '', 'Opening message'), element('p', '', format(data.first_mes)));
            premise.append(opening);
        }
        if (data.description) {
            const card = element('details', 'workspace-profile-detail');
            card.append(element('summary', '', 'Full character description'), element('p', '', format(data.description)));
            premise.append(card);
        }
    }
    if (premise.childElementCount) content.append(premise);
    const histories = state.chats.filter(record => record.entityKey === entity.key);
    const recent = histories.find(record => !record.archived);
    if (recent) {
        const resume = element('section', 'workspace-profile-resume');
        resume.append(element('h2', '', 'Pick up where you left off'), element('strong', '', recent.title), element('p', '', plainText(recent.mes) || 'Your story is ready to continue.'), button('Continue latest story', 'open-chat', { chat: recent.key }, 'workspace-button', 'fa-play'));
        content.prepend(resume);
    }
    const heading = element('div', 'workspace-profile-history-heading');
    heading.append(element('h2', '', 'Story history'));
    const tabs = element('div', 'workspace-filters');
    for (const [id, label] of [['active', 'Active'], ['archived', 'Archived']]) {
        const tab = button(label, 'profile-scope', { scope: id }, 'workspace-filter');
        tab.setAttribute('aria-pressed', String(state.profileScope === id));
        tabs.append(tab);
    }
    heading.append(tabs);
    content.append(heading);
    const records = histories.filter(record => record.archived === (state.profileScope === 'archived'));
    const list = element('div', 'workspace-scene-list');
    list.append(...records.map(record => chatRow(decorateRecord(record, state), entity)));
    content.append(records.length ? list : empty(state.profileScope === 'archived' ? 'No archived stories' : 'Your first scene together', state.profileScope === 'archived' ? 'Archived scenes with this character will appear here.' : 'Start a new story when you are ready.'));
    layout.append(identity, content);
    page.append(layout);
    return page;
}

function settings(state) {
    const page = element('div', 'workspace-page workspace-settings');
    page.append(pageHeading('Settings', 'Configure your writing tools without losing your place in the story.'));
    const layout = element('div', 'workspace-settings-overview');
    const main = element('div');
    for (const [heading, ids] of [
        ['Writing', ['connection', 'generation', 'prompts']],
        ['Your story world', ['persona', 'world', 'backgrounds']],
        ['Workspace', ['settings', 'extensions']],
    ]) {
        const section = element('section', 'workspace-settings-group');
        section.append(element('h2', '', heading));
        for (const id of ids) {
            const setting = workspaceSettings.find(item => item.id === id);
            const row = button('', id, {}, 'workspace-settings-item');
            row.replaceChildren(icon(setting.icon));
            const text = element('span');
            text.append(element('strong', '', setting.label), element('small', '', setting.description));
            row.append(text, icon('fa-chevron-right'));
            section.append(row);
        }
        main.append(section);
    }
    const creative = element('aside', 'workspace-settings-creative');
    creative.append(element('h2', '', 'Voice & images'), element('p', '', 'Turn Voice on in the chat to hear replies. Illustrate scene creates one image when you click it.'));
    for (const id of ['voice-settings', 'image-settings']) {
        const setting = workspaceSettings.find(item => item.id === id);
        creative.append(button(setting.label, id, {}, 'workspace-button', setting.icon));
    }
    const tools = element('section', 'workspace-capabilities');
    tools.setAttribute('aria-label', 'Optional creative tools');
    tools.append(element('h3', '', 'Automatic tools'), element('p', '', 'Advanced extension behavior. Scene illustrations do not require automatic image tools.'));
    for (const [kind, title, description] of [
        ['voice', 'Voice narration', 'The same voice toggle as the chat screen.'],
        ['image', 'Automatic image tools', 'Allow image commands, triggers, and model tools. Off by default.'],
    ]) {
        const label = element('label', 'workspace-capability');
        const text = element('span');
        text.append(element('strong', '', title), element('small', '', description));
        const toggle = element('input');
        toggle.type = 'checkbox';
        toggle.setAttribute('aria-label', title);
        toggle.dataset.workspaceCapability = kind;
        toggle.checked = state.creativeTools[kind];
        toggle.disabled = !state.creativeTools[`${kind}Available`];
        label.append(text, toggle);
        tools.append(label);
    }
    const advanced = element('details', 'workspace-profile-detail');
    advanced.append(element('summary', '', 'Automatic tool preferences'), tools);
    creative.append(advanced);
    layout.append(main, creative);
    page.append(layout);
    return page;
}

export function renderWorkspaceView(state) {
    if (state.view === 'characters') return library(state);
    if (state.view === 'profile') return profile(state);
    if (state.view === 'archive') return conversations(state, true);
    if (state.view === 'settings-page') return settings(state);
    return conversations(state, false);
}
