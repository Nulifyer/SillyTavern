import { button, element, workspaceSettings } from './workspace-views.js';
import { ServiceConnections } from './service-connections.js';
import { accountStorage } from './util/AccountStorage.js';
import { eventSource, event_types } from './events.js';

/** One mounted copy of each native settings panel, presented as a category workspace. */
export class WorkspaceSettings {
    constructor() {
        this.active = '';
        this.origins = new Map();
        this.extensionBranches = [];
        this.sectionNodes = [];
    }

    init() {
        this.services = new ServiceConnections();
        this.services.init();
        this.root = element('section', 'workspace-only workspace-settings workspace-settings-shell');
        this.root.id = 'workspace-settings-shell';
        this.root.hidden = true;
        const rail = element('nav', 'workspace-settings-rail');
        rail.setAttribute('aria-label', 'Settings categories');
        rail.append(element('h2', '', 'Settings'));
        const mobileNavigation = element('label', 'workspace-settings-picker');
        const mobileBar = element('div', 'workspace-settings-mobile');
        mobileBar.append(mobileNavigation);
        mobileNavigation.append(element('span', '', 'Settings category'));
        this.category = element('select', 'text_pole');
        this.category.id = 'workspace-settings-category';
        mobileNavigation.append(this.category);
        for (const [label, ids] of [
            ['Model services', ['servers', 'connection', 'image-writer', 'image-settings', 'voice-settings', 'dictation-settings', 'vision-settings', 'embeddings-settings']],
            ['Story world', ['persona', 'world', 'memory-settings', 'authors-note', 'backgrounds']],
            ['Workspace', ['settings', 'extensions', 'character-editor']],
        ]) {
            const group = element('div', 'workspace-settings-category');
            group.append(element('h3', '', label));
            const options = document.createElement('optgroup');
            options.label = label;
            for (const id of ids) {
                const setting = workspaceSettings.find(item => item.id === id);
                const destination = button(setting.label, id, {}, 'workspace-settings-destination', setting.icon);
                destination.hidden = id === 'character-editor';
                group.append(destination);
                options.append(new Option(setting.label, id));
            }
            rail.append(group);
            this.category.append(options);
        }
        this.category.addEventListener('change', () => {
            // Reuse the workspace navigation queue and its captured action identity.
            rail.querySelector(`[data-workspace-action="${this.category.value}"]`)?.click();
        });
        const content = element('div', 'workspace-settings-content');
        const header = element('header', 'workspace-settings-heading');
        this.heading = element('h1');
        this.description = element('p');
        const text = element('div');
        text.append(this.heading, this.description);
        this.close = button('Done', 'close-panel', {}, 'workspace-button', 'fa-check');
        const actions = element('div', 'workspace-settings-actions');
        const advancedLabel = element('label', 'checkbox_label workspace-advanced-toggle');
        this.advancedToggle = element('input');
        this.advancedToggle.type = 'checkbox';
        this.advancedToggle.id = 'workspace-advanced-settings';
        this.advancedToggle.checked = accountStorage.getItem('workspaceAdvancedSettings') === 'true';
        advancedLabel.append(this.advancedToggle, element('span', '', 'Advanced controls'));
        advancedLabel.title = 'Expand native provider settings, sampling, prompt formatting and extension options. Changes only which controls are shown.';
        actions.append(advancedLabel, this.close);
        const mobile = matchMedia('(max-width: 900px)');
        const placeClose = () => (mobile.matches ? mobileBar : actions).append(this.close);
        mobile.addEventListener('change', placeClose);
        placeClose();
        header.append(text, actions);
        this.advancedToggle.addEventListener('change', () => {
            accountStorage.setItem('workspaceAdvancedSettings', String(this.advancedToggle.checked));
            this.applyAdvanced();
        });
        this.host = element('div', 'workspace-settings-host');
        this.storyTabs = element('nav', 'workspace-service-tabs');
        this.storyTabs.setAttribute('aria-label', 'Story model settings');
        for (const [id, label] of [['connection', 'Model connection'], ['generation', 'Reply controls'], ['prompts', 'Story prompts']]) {
            const tab = button(label, id, {}, 'workspace-filter');
            tab.dataset.serviceDestination = id;
            delete tab.dataset.workspaceAction;
            this.storyTabs.append(tab);
        }
        this.sections = element('nav', 'workspace-settings-sections');
        this.sections.setAttribute('aria-label', 'Settings sections');
        this.sections.hidden = true;
        content.append(header, this.storyTabs, this.sections, this.host);
        this.root.append(mobileBar, rail, content);
        document.getElementById('sheld').prepend(this.root);
        for (const setting of workspaceSettings) {
            const panel = document.getElementById(setting.panel);
            if (!panel) continue;
            if (!this.origins.has(panel)) this.origins.set(panel, { parent: panel.parentNode, next: panel.nextSibling });
        }
        this.promptManager = document.getElementById('completion_prompt_manager');
        this.promptOrigin = { parent: this.promptManager.parentNode, next: this.promptManager.nextSibling };
        this.promptHelp = element('p', 'workspace-only service-note', 'These are the instructions assembled for story replies. Character cards and lore can add further instructions. Select a prompt to inspect or edit it.');
        const formatting = document.getElementById('AdvancedFormatting');
        this.templateControls = element('details', 'service-native-controls service-template-controls');
        this.templateControls.open = true;
        this.templateControls.append(element('summary', 'workspace-only', 'Text completion templates and tokenization'), ...formatting.childNodes);
        formatting.append(this.templateControls);
        eventSource.on(event_types.EXTENSION_ACTIVATED, () => this.extensionsActivated());
    }

    extensionsActivated() {
        this.services.extensionsActivated();
        const setting = workspaceSettings.find(item => item.id === this.active);
        const panel = setting && document.getElementById(setting.panel);
        if (!this.empty?.isConnected || !setting?.focus || !this.host.contains(panel) || !panel.querySelector(setting.focus)) return;
        // Only recover a missing section. Never remount a form the user is editing.
        for (const branch of this.extensionBranches) branch.classList.remove('workspace-extension-path', 'workspace-extension-section');
        this.extensionBranches = [];
        this.empty.remove();
        this.showExtension(setting, panel);
        this.applyAdvanced();
    }

    showExtension(setting, panel) {
        const section = panel.querySelector(setting.focus);
        if (!section) return false;
        let branch = section;
        while (branch && branch !== panel) {
            branch.classList.add('workspace-extension-path');
            this.extensionBranches.push(branch);
            const parent = branch.parentElement;
            parent.classList.add('workspace-extension-section');
            this.extensionBranches.push(parent);
            branch = parent;
        }
        const toggle = section.querySelector('.inline-drawer-toggle');
        if (toggle && !$(section.querySelector('.inline-drawer-content')).is(':visible')) toggle.click();
        return true;
    }

    setLayout(workspace) {
        this.services.setLayout(workspace);
        if (!workspace) this.templateControls.open = true;
    }

    async open(id) {
        const setting = workspaceSettings.find(item => item.id === id);
        if (!setting) return;
        this.restore();
        this.active = id;
        this.category.value = ['generation', 'prompts'].includes(id) ? 'connection' : id;
        this.heading.textContent = ['generation', 'prompts'].includes(id) ? 'Story replies' : setting.label;
        this.description.textContent = setting.description;
        const panel = document.getElementById(setting.panel);
        panel.querySelectorAll('.workspace-advanced-creative').forEach(details => details.open = this.advancedToggle.checked);
        this.host.append(panel);
        panel.classList.remove('closedDrawer');
        panel.classList.add('openDrawer', 'workspace-mounted-panel');
        panel.setAttribute('aria-label', setting.label);
        this.root.hidden = false;
        document.body.classList.add('workspace-configuring');
        this.root.querySelectorAll('[data-workspace-action]').forEach(control => {
            if (control.dataset.workspaceAction === 'close-panel') return;
            if (control.dataset.workspaceAction === 'character-editor') control.hidden = id !== 'character-editor';
            const selected = control.dataset.workspaceAction === (['generation', 'prompts'].includes(id) ? 'connection' : id);
            control.classList.toggle('active', selected);
            if (selected) control.setAttribute('aria-current', 'page');
            else control.removeAttribute('aria-current');
        });
        this.root.querySelector('.workspace-settings-destination.active')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        if (setting.focus) {
            if (!this.showExtension(setting, panel)) {
                panel.classList.add('workspace-extension-section');
                this.extensionBranches.push(panel);
                this.empty = element('p', 'service-empty', 'These controls are not available yet. If the extension is disabled, enable it in Extensions.');
                this.host.append(this.empty);
            }
        }
        const chatPrompts = id === 'prompts' && document.getElementById('main_api').value === 'openai';
        if (!chatPrompts) this.configureSections(id, panel);
        else { this.sections.replaceChildren(); this.sections.hidden = true; this.groups = []; }
        this.storyTabs.hidden = !['connection', 'generation', 'prompts'].includes(id);
        this.storyTabs.querySelectorAll('button').forEach(tab => tab.setAttribute('aria-pressed', String(tab.dataset.serviceDestination === id)));
        if (id === 'prompts') {
            this.templateControls.open = !chatPrompts;
            this.templateControls.dataset.primary = String(!chatPrompts);
            if (chatPrompts) panel.prepend(this.promptHelp, this.promptManager);
        }
        this.applyAdvanced();
        this.services.opened(id);
        this.root.querySelector('.workspace-settings-content').scrollTop = 0;
        this.close.focus();
    }

    applyAdvanced() {
        const advanced = this.advancedToggle.checked;
        this.services.setAdvanced(advanced);
        this.root.dataset.advanced = String(advanced);
        this.host.querySelectorAll('.workspace-advanced-creative').forEach(details => details.open = advanced);
        if (this.active === 'prompts') this.templateControls.open = advanced || this.templateControls.dataset.primary === 'true';
        if (this.groups?.length) this.selectSection(advanced ? 'all' : this.groups[0][0]);
    }

    restore() {
        this.empty?.remove();
        this.promptHelp?.remove();
        if (this.promptOrigin && this.promptManager.parentNode !== this.promptOrigin.parent) {
            this.promptOrigin.parent.insertBefore(this.promptManager, this.promptOrigin.next?.parentNode === this.promptOrigin.parent ? this.promptOrigin.next : null);
        }
        for (const node of this.sectionNodes) node.classList.remove('workspace-section-hidden');
        this.sectionNodes = [];
        for (const branch of this.extensionBranches) branch.classList.remove('workspace-extension-path', 'workspace-extension-section');
        this.extensionBranches = [];
        for (const [panel, origin] of this.origins) {
            if (!panel.classList.contains('workspace-mounted-panel')) continue;
            panel.classList.remove('openDrawer', 'workspace-mounted-panel');
            panel.classList.add('closedDrawer');
            origin.parent.insertBefore(panel, origin.next?.parentNode === origin.parent ? origin.next : null);
        }
        this.active = '';
        if (this.root) this.root.hidden = true;
        document.body.classList.remove('workspace-configuring');
    }

    configureSections(id, panel) {
        const groups = {
            generation: [
                ['Replies', ['common-gen-settings-block', 'respective-ranges-and-temps']],
                ['Presets', ['respective-presets-block']],
                ['Advanced sampling & prompts', ['advanced-ai-config-block']],
            ],
            settings: [
                ['Reading & appearance', ['UI-Theme-Block']],
                ['Interaction', ['UI-Customization', 'power-user-options-block']],
            ],
            prompts: [
                ['System prompt', ['SystemPromptColumn']],
                ['Context & stopping', ['ContextSettings']],
                ['Instruction template', ['InstructSettingsColumn']],
            ],
        }[id] || [];
        this.sections.replaceChildren();
        this.sections.hidden = !groups.length;
        this.groups = groups;
        for (const [label, ids] of groups) {
            this.sectionNodes.push(...ids.map(key => panel.querySelector(`#${key}`)).filter(Boolean));
            this.sections.append(button(label, 'settings-section', { section: label }, 'workspace-filter'));
        }
        if (groups.length) {
            this.sections.append(button('All controls', 'settings-section', { section: 'all' }, 'workspace-filter'));
            this.selectSection(this.advancedToggle.checked ? 'all' : groups[0][0]);
        }
    }

    selectSection(label) {
        const group = this.groups.find(item => item[0] === label);
        if (!group && label !== 'all') return;
        for (const node of this.sectionNodes) node.classList.toggle('workspace-section-hidden', label !== 'all' && !group[1].includes(node.id));
        this.sections.querySelectorAll('button').forEach(control => control.setAttribute('aria-pressed', String(control.dataset.section === label)));
    }
}
