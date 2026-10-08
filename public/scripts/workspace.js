import {
    characters, chat, closeCurrentChat, doNavbarIconClick, getCurrentChatId, getThumbnailUrl,
    isGenerating, name1, name2, online_status, selectCharacterById, this_chid,
} from '../script.js';
import { eventSource, event_types } from './events.js';
import { groups, selected_group } from './group-chats.js';
import { t, translate } from './i18n.js';
import { shouldSendOnEnter } from './RossAscends-mods.js';
import { accountStorage } from './util/AccountStorage.js';
import { getPermanentAssistantAvatar } from './welcome-screen.js';

// The shell owns navigation and presentation. Existing drawers own their data and actions.
const destinations = [
    { id: 'home', label: 'Workspace', icon: 'fa-house', section: 'Conversations' },
    { id: 'characters', label: 'Characters', icon: 'fa-address-card', drawer: 'rightNavHolder', panel: 'right-nav-panel', section: 'Conversations' },
    { id: 'world', label: 'World info', icon: 'fa-book-atlas', drawer: 'WI-SP-button', panel: 'WorldInfo', section: 'Create' },
    { id: 'persona', label: 'Personas', icon: 'fa-face-smile', drawer: 'persona-management-button', panel: 'PersonaManagement', section: 'Create' },
    { id: 'generation', label: 'Generation', icon: 'fa-sliders', drawer: 'ai-config-button', panel: 'left-nav-panel', section: 'Configure' },
    { id: 'connection', label: 'Connections', icon: 'fa-plug', drawer: 'sys-settings-button', panel: 'rm_api_block', section: 'Configure' },
    { id: 'prompts', label: 'Prompt formatting', icon: 'fa-align-left', drawer: 'advanced-formatting-button', panel: 'AdvancedFormatting', section: 'Configure' },
    { id: 'extensions', label: 'Extensions', icon: 'fa-cubes', drawer: 'extensions-settings-button', panel: 'rm_extensions_block', section: 'Configure' },
    { id: 'backgrounds', label: 'Backgrounds', icon: 'fa-image', drawer: 'backgrounds-button', panel: 'Backgrounds', section: 'Configure' },
    { id: 'settings', label: 'Settings', icon: 'fa-gear', drawer: 'user-settings-button', panel: 'user-settings-block', section: 'Configure' },
];

const panelDescriptions = {
    characters: 'Choose a character, import a card, or create someone new.',
    world: 'Create lorebooks and decide when their entries enter the conversation.',
    persona: 'Choose who you are in a conversation. Each persona can have its own description.',
    generation: 'Tune replies with presets, sampling controls, and context limits.',
    connection: 'Choose an API provider and connect the model that will write replies.',
    prompts: 'Control how character details, messages, and instructions reach your model.',
    extensions: 'Manage extra tools for your conversations and character library.',
    backgrounds: 'Choose a background for your workspace.',
    settings: 'Adjust appearance, chat behavior, and your account preferences.',
};

let returnFocus;
let navigationQueue = Promise.resolve();

function makeIcon(icon) {
    const element = document.createElement('i');
    element.className = `fa-solid ${icon}`;
    element.setAttribute('aria-hidden', 'true');
    return element;
}

function makeButton(label, icon, action, className = 'workspace-nav-item') {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.dataset.workspaceAction = action;
    if (icon) button.append(makeIcon(icon));
    const text = document.createElement('span');
    text.textContent = translate(label);
    button.append(text);
    return button;
}

function setMobileNavigation(open) {
    document.body.classList.toggle('workspace-nav-open', open);
    document.getElementById('workspace-menu').setAttribute('aria-expanded', String(open));
    document.getElementById('workspace-scrim').hidden = !open;
    const mobile = matchMedia('(max-width: 900px)').matches;
    document.getElementById('workspace-sidebar').inert = mobile && !open;
    document.getElementById('sheld').inert = mobile && open;
    if (open) document.getElementById('workspace-search-button').focus();
}

async function closeDrawers() {
    for (const destination of destinations) {
        const panel = document.getElementById(destination.panel);
        if (!panel?.classList.contains('openDrawer')) continue;
        const toggle = document.querySelector(`#${destination.drawer} > .drawer-toggle`);
        await doNavbarIconClick.call(toggle);
    }
}

async function navigate(action, trigger) {
    returnFocus = trigger || document.activeElement;
    setMobileNavigation(false);
    if (action === 'home') {
        if (isGenerating()) {
            toastr.info(t`Stop generation before leaving the conversation.`);
            return;
        }
        await closeDrawers();
        await closeCurrentChat();
        document.getElementById('send_textarea').focus();
    } else if (action === 'history') {
        await closeDrawers();
        $('#option_select_chat').trigger('click');
    } else if (action === 'new-chat') {
        await closeDrawers();
        $('#option_start_new_chat').trigger('click');
    } else {
        const destination = destinations.find(item => item.id === action);
        if (!destination?.drawer) return;
        const panel = document.getElementById(destination.panel);
        if (action === 'characters') $('#rm_button_characters').trigger('click');
        if (!panel.classList.contains('openDrawer')) {
            await closeDrawers();
            await doNavbarIconClick.call(document.querySelector(`#${destination.drawer} > .drawer-toggle`));
        }
        if (document.body.classList.contains('workspace-ui')) {
            panel.querySelector('.workspace-panel-close')?.focus();
        }
    }
    syncNavigation();
}

function syncNavigation() {
    const active = destinations.find(item => document.getElementById(item.panel)?.classList.contains('openDrawer'));
    document.querySelectorAll('#workspace-navigation [data-workspace-action]').forEach(button => {
        const current = button.dataset.workspaceAction === (active?.id || 'home');
        button.classList.toggle('active', current);
        if (current) button.setAttribute('aria-current', 'page');
        else button.removeAttribute('aria-current');
        const panel = destinations.find(item => item.id === button.dataset.workspaceAction)?.panel;
        if (panel) button.setAttribute('aria-expanded', String(document.getElementById(panel).classList.contains('openDrawer')));
    });
}

async function openCharacter(avatar) {
    const id = characters.findIndex(character => character.avatar === avatar);
    if (id === -1) return;
    setMobileNavigation(false);
    await selectCharacterById(id, { switchMenu: false });
    if (String(this_chid) !== String(id) || selected_group) return;
    await closeDrawers();
    refreshWorkspace();
    document.getElementById('send_textarea').focus();
}

function characterButton(character, card = false) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = card ? 'workspace-character-card' : 'workspace-character-item';
    button.dataset.workspaceAvatar = character.avatar;
    const image = document.createElement('img');
    image.src = getThumbnailUrl('avatar', character.avatar);
    image.alt = '';
    image.loading = 'lazy';
    const text = document.createElement('span');
    const name = document.createElement('strong');
    name.textContent = character.name;
    text.append(name);
    if (card) {
        const detail = document.createElement('small');
        detail.textContent = character.data?.creator_notes?.replace(/<[^>]*>/g, '').slice(0, 90) || t`Start a conversation`;
        text.append(detail);
    }
    button.append(image, text);
    if (character.fav || character.data?.extensions?.fav) button.append(makeIcon('fa-star'));
    button.classList.toggle('active', !selected_group && characters[this_chid]?.avatar === character.avatar);
    return button;
}

function refreshCharacters() {
    const sorted = [...characters].sort((a, b) => Number(Boolean(b.fav || b.data?.extensions?.fav)) - Number(Boolean(a.fav || a.data?.extensions?.fav)) || Number(b.date_last_chat || 0) - Number(a.date_last_chat || 0));
    const sidebar = document.getElementById('workspace-character-list');
    sidebar.replaceChildren(...sorted.slice(0, 6).map(character => characterButton(character)));
    if (!sorted.length) {
        const empty = document.createElement('p');
        empty.textContent = t`Add your first character from the character library.`;
        sidebar.append(empty);
    }
    document.querySelectorAll('.workspace-home-characters').forEach(list => {
        list.replaceChildren(...sorted.slice(0, 3).map(character => characterButton(character, true)));
        list.closest('.workspace-home-library').hidden = !sorted.length;
    });
    const count = document.querySelector('[data-workspace-action="characters"] .workspace-count');
    if (count) count.textContent = String(characters.length + groups.length);
}

function refreshWorkspace() {
    const connected = online_status !== 'no_connection' && Boolean(online_status);
    document.body.classList.toggle('workspace-connected', connected);
    const hasChat = getCurrentChatId() !== undefined;
    const temporaryChat = !hasChat && !document.querySelector('.welcomePanel') && chat.length > 0;
    document.body.classList.toggle('workspace-default-assistant', getPermanentAssistantAvatar() === 'default_Assistant.png');
    const group = groups.find(item => item.id === selected_group);
    document.getElementById('workspace-chat-title').textContent = hasChat ? group?.name || name2 : temporaryChat ? t`Temporary chat` : t`Workspace`;
    document.getElementById('workspace-chat-subtitle').textContent = hasChat || temporaryChat ? t`Your conversation` : t`A place for your characters and conversations`;
    document.getElementById('workspace-history').hidden = !hasChat;
    const newChatButton = document.querySelector('.workspace-header-actions .workspace-button');
    newChatButton.dataset.workspaceAction = hasChat || temporaryChat ? 'new-chat' : 'characters';
    const newChatLabel = hasChat || temporaryChat ? t`New chat` : t`New conversation`;
    newChatButton.querySelector('span').textContent = newChatLabel;
    newChatButton.setAttribute('aria-label', newChatLabel);
    newChatButton.title = newChatLabel;
    document.getElementById('workspace-persona-name').textContent = name1 || t`Your persona`;
    document.getElementById('workspace-connection-label').textContent = connected ? t`Model connected` : t`Connect a model`;
    document.getElementById('workspace-connection-detail').textContent = connected ? online_status : t`Set up an API to start chatting`;
    document.getElementById('workspace-composer-hint').textContent = connected
        ? (shouldSendOnEnter() ? t`Enter to send. Shift + Enter for a new line.` : t`Use the send button to send a message.`)
        : t`Connect a model to generate replies. You can still explore your characters.`;
    document.querySelectorAll('.workspace-setup-status').forEach(element => {
        element.textContent = connected ? t`Connected. You are ready to chat.` : t`One more thing: connect a model to get replies.`;
    });
    refreshCharacters();
    syncNavigation();
}

function renderSearch() {
    const query = document.getElementById('workspace-command-input').value.trim().toLocaleLowerCase();
    const results = document.getElementById('workspace-command-results');
    const commands = destinations.filter(item => translate(item.label).toLocaleLowerCase().includes(query));
    const matches = characters.filter(character => character.name.toLocaleLowerCase().includes(query)).slice(0, 12);
    results.replaceChildren();
    for (const item of commands) results.append(makeButton(item.label, item.icon, item.id, 'workspace-command-result'));
    for (const character of matches) {
        const button = characterButton(character);
        button.classList.add('workspace-command-result');
        results.append(button);
    }
    if (!results.childElementCount) {
        const empty = document.createElement('p');
        empty.textContent = t`No matches. Try a character name or a tool, such as Connections.`;
        results.append(empty);
    }
}

function openSearch() {
    const dialog = document.getElementById('workspace-command');
    if (document.querySelector('dialog[open]')) return;
    setMobileNavigation(false);
    document.getElementById('workspace-command-input').value = '';
    renderSearch();
    dialog.showModal();
    document.getElementById('workspace-command-input').focus();
}

function applyLayout(enabled) {
    setMobileNavigation(false);
    document.body.classList.toggle('workspace-ui', enabled);
    document.getElementById('workspace-sidebar').inert = enabled && matchMedia('(max-width: 900px)').matches;
    document.getElementById('workspace-layout-toggle').checked = enabled;
    document.getElementById('workspace-restore').hidden = enabled;
    window.dispatchEvent(new Event('resize'));
}

export function initWorkspace() {
    const navigation = document.getElementById('workspace-navigation');
    let section;
    for (const destination of destinations) {
        if (destination.section !== section) {
            const heading = document.createElement('p');
            heading.className = 'workspace-nav-heading';
            heading.textContent = translate(destination.section);
            navigation.append(heading);
            section = destination.section;
        }
        const button = makeButton(destination.label, destination.icon, destination.id);
        if (destination.panel) {
            button.setAttribute('aria-controls', destination.panel);
            const panel = document.getElementById(destination.panel);
            const header = document.createElement('div');
            header.className = 'workspace-only workspace-panel-heading';
            const title = document.createElement('h2');
            title.id = `workspace-panel-title-${destination.id}`;
            title.textContent = translate(destination.label);
            const close = makeButton('Close panel', 'fa-xmark', 'close-panel', 'workspace-panel-close workspace-icon-button');
            close.setAttribute('aria-label', t`Close panel`);
            const text = document.createElement('div');
            const description = document.createElement('p');
            description.textContent = translate(panelDescriptions[destination.id]);
            text.append(title, description);
            header.append(text, close);
            panel.prepend(header);
            panel.setAttribute('role', 'region');
            panel.setAttribute('aria-labelledby', title.id);
            new MutationObserver(syncNavigation).observe(panel, { attributes: true, attributeFilter: ['class'] });
        }
        if (destination.id === 'characters') {
            const count = document.createElement('small');
            count.className = 'workspace-count';
            button.append(count);
        }
        navigation.append(button);
    }

    const layoutControl = document.createElement('label');
    layoutControl.className = 'workspace-layout-control checkbox_label';
    const layoutToggle = document.createElement('input');
    layoutToggle.id = 'workspace-layout-toggle';
    layoutToggle.type = 'checkbox';
    const layoutText = document.createElement('span');
    layoutText.textContent = t`Dark workspace layout. Turn off to use the classic layout and custom themes.`;
    layoutControl.append(layoutToggle, layoutText);
    document.querySelector('#user-settings-block > .flex-container').prepend(layoutControl);
    const restore = makeButton('Use workspace layout', 'fa-table-columns', 'restore-workspace', 'workspace-restore menu_button');
    restore.id = 'workspace-restore';
    restore.hidden = true;
    document.body.append(restore);
    const hint = document.createElement('p');
    hint.id = 'workspace-composer-hint';
    hint.className = 'workspace-only';
    document.getElementById('form_sheld').append(hint);
    document.getElementById('send_textarea').setAttribute('aria-label', t`Message`);
    document.getElementById('send_textarea').setAttribute('aria-describedby', hint.id);
    document.getElementById('options_button').setAttribute('title', t`Conversation actions`);
    for (const [id, label] of [['rm_button_create', 'Create'], ['character_import_button', 'Import'], ['rm_button_group_chats', 'New group']]) {
        const span = document.createElement('span');
        span.className = 'workspace-only workspace-action-label';
        span.textContent = translate(label);
        document.getElementById(id).append(span);
    }

    layoutToggle.addEventListener('change', () => {
        accountStorage.setItem('workspaceLayout', String(layoutToggle.checked));
        applyLayout(layoutToggle.checked);
    });
    document.addEventListener('click', event => {
        const target = event.target instanceof Element ? event.target : null;
        const button = target?.closest('[data-workspace-action], [data-workspace-avatar]');
        if (!button) return;
        event.preventDefault();
        const action = button.dataset.workspaceAction;
        const dialog = document.getElementById('workspace-command');
        if (dialog.open && action !== 'close-search') dialog.close();
        // Character loading and drawer transitions share one queue so rapid clicks keep their order.
        navigationQueue = navigationQueue.then(async () => {
            if (button.dataset.workspaceAvatar) await openCharacter(button.dataset.workspaceAvatar);
            else if (action === 'close-search') dialog.close();
            else if (action === 'close-panel') {
                await closeDrawers();
                if (returnFocus?.isConnected && !returnFocus.inert) returnFocus.focus();
                else document.getElementById('send_textarea').focus();
            } else if (action === 'restore-workspace') {
                accountStorage.setItem('workspaceLayout', 'true');
                applyLayout(true);
                refreshWorkspace();
            } else await navigate(action, button);
        }).catch(error => {
            console.error('Workspace navigation failed', error);
            toastr.error(t`Could not open this view. Try again or switch to the classic layout in Settings.`);
        });
    });
    document.getElementById('workspace-search-button').addEventListener('click', openSearch);
    document.getElementById('workspace-menu').addEventListener('click', () => setMobileNavigation(!document.body.classList.contains('workspace-nav-open')));
    document.getElementById('workspace-scrim').addEventListener('click', () => {
        setMobileNavigation(false);
        document.getElementById('workspace-menu').focus();
    });
    document.getElementById('workspace-command-input').addEventListener('input', renderSearch);
    document.getElementById('workspace-command').addEventListener('keydown', event => {
        const buttons = [...document.querySelectorAll('#workspace-command-results button')];
        const index = buttons.indexOf(document.activeElement);
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            buttons[(index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus();
        } else if (event.key === 'Enter' && event.target.id === 'workspace-command-input') {
            event.preventDefault();
            buttons[0]?.click();
        }
    });
    document.addEventListener('keydown', event => {
        if (!document.body.classList.contains('workspace-ui') || event.isComposing) return;
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && !document.querySelector('dialog[open]')) {
            event.preventDefault();
            openSearch();
        } else if (event.key === 'Escape' && !document.querySelector('dialog[open]')) {
            if (document.body.classList.contains('workspace-nav-open')) {
                event.preventDefault();
                event.stopImmediatePropagation();
                setMobileNavigation(false);
                document.getElementById('workspace-menu').focus();
            } else if (!isGenerating() && !$('.edit_textarea, .reasoning_edit_textarea, #select_chat_popup, #character_popup, #dialogue_popup').is(':visible') && destinations.some(item => document.getElementById(item.panel)?.classList.contains('openDrawer'))) {
                event.preventDefault();
                event.stopImmediatePropagation();
                void closeDrawers().then(() => document.getElementById('send_textarea').focus());
            }
        } else if (event.key === 'Tab' && document.body.classList.contains('workspace-nav-open')) {
            const buttons = [...document.querySelectorAll('#workspace-sidebar a, #workspace-sidebar button')].filter(element => element.getClientRects().length);
            if (event.shiftKey && document.activeElement === buttons[0]) {
                event.preventDefault();
                buttons.at(-1)?.focus();
            } else if (!event.shiftKey && document.activeElement === buttons.at(-1)) {
                event.preventDefault();
                buttons[0]?.focus();
            }
        }
    }, { capture: true });
    matchMedia('(max-width: 900px)').addEventListener('change', () => setMobileNavigation(false));
    for (const event of [event_types.APP_READY, event_types.CHAT_CHANGED, event_types.CHARACTER_PAGE_LOADED, event_types.CHARACTER_EDITED, event_types.CHARACTER_DELETED, event_types.GROUP_UPDATED, event_types.ONLINE_STATUS_CHANGED, event_types.SETTINGS_UPDATED]) {
        eventSource.on(event, refreshWorkspace);
    }
    new MutationObserver(() => {
        refreshWorkspace();
        document.querySelectorAll('.recentChat').forEach(item => {
            item.tabIndex = 0;
            item.setAttribute('role', 'button');
            item.onkeydown = event => {
                if (event.target === item && (event.key === 'Enter' || event.key === ' ')) {
                    event.preventDefault();
                    item.click();
                }
            };
        });
    }).observe(document.getElementById('chat'), { childList: true });
    applyLayout(accountStorage.getItem('workspaceLayout') !== 'false');
    refreshWorkspace();
}
