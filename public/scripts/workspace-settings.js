import { button, element, workspaceSettings } from './workspace-views.js';

/** One mounted copy of each native settings panel, presented as a category workspace. */
export class WorkspaceSettings {
    constructor() {
        this.active = '';
        this.origins = new Map();
        this.extensionBranches = [];
        this.sectionNodes = [];
    }

    init() {
        this.root = element('section', 'workspace-only workspace-settings-shell');
        this.root.id = 'workspace-settings-shell';
        this.root.hidden = true;
        const rail = element('nav', 'workspace-settings-rail');
        rail.setAttribute('aria-label', 'Settings categories');
        rail.append(element('h2', '', 'Settings'));
        for (const [label, ids] of [
            ['Writing', ['connection', 'generation', 'prompts']],
            ['Story world', ['persona', 'world', 'backgrounds']],
            ['Creative tools', ['voice-settings', 'image-settings']],
            ['Workspace', ['settings', 'extensions', 'character-editor']],
        ]) {
            const group = element('div', 'workspace-settings-category');
            group.append(element('h3', '', label));
            for (const id of ids) {
                const setting = workspaceSettings.find(item => item.id === id);
                const destination = button(setting.label, id, {}, 'workspace-settings-destination', setting.icon);
                destination.hidden = id === 'character-editor';
                group.append(destination);
            }
            rail.append(group);
        }
        const content = element('div', 'workspace-settings-content');
        const header = element('header', 'workspace-settings-heading');
        this.heading = element('h1');
        this.description = element('p');
        const text = element('div');
        text.append(this.heading, this.description);
        this.close = button('Done', 'close-panel', {}, 'workspace-button', 'fa-check');
        header.append(text, this.close);
        this.host = element('div', 'workspace-settings-host');
        this.sections = element('nav', 'workspace-settings-sections');
        this.sections.setAttribute('aria-label', 'Settings sections');
        this.sections.hidden = true;
        content.append(header, this.sections, this.host);
        this.root.append(rail, content);
        document.getElementById('sheld').prepend(this.root);
        for (const setting of workspaceSettings) {
            const panel = document.getElementById(setting.panel);
            if (!this.origins.has(panel)) this.origins.set(panel, { parent: panel.parentNode, next: panel.nextSibling });
        }
    }

    async open(id) {
        const setting = workspaceSettings.find(item => item.id === id);
        if (!setting) return;
        this.restore();
        this.active = id;
        this.heading.textContent = setting.label;
        this.description.textContent = setting.description;
        const panel = document.getElementById(setting.panel);
        panel.querySelectorAll('.workspace-advanced-creative').forEach(details => details.open = false);
        this.host.append(panel);
        panel.classList.remove('closedDrawer');
        panel.classList.add('openDrawer', 'workspace-mounted-panel');
        panel.setAttribute('aria-label', setting.label);
        this.root.hidden = false;
        document.body.classList.add('workspace-configuring');
        this.root.querySelectorAll('[data-workspace-action]').forEach(control => {
            if (control.dataset.workspaceAction === 'close-panel') return;
            if (control.dataset.workspaceAction === 'character-editor') control.hidden = id !== 'character-editor';
            const selected = control.dataset.workspaceAction === id;
            control.classList.toggle('active', selected);
            if (selected) control.setAttribute('aria-current', 'page');
            else control.removeAttribute('aria-current');
        });
        this.root.querySelector('.workspace-settings-destination.active')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        if (setting.focus) {
            const section = panel.querySelector(setting.focus);
            if (section) {
                // Keep native ancestry and handlers while showing only this extension's controls.
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
            } else toastr.info('This extension is not loaded. Enable it in Extensions to use this tool.');
        }
        this.configureSections(id, panel);
        this.root.querySelector('.workspace-settings-content').scrollTop = 0;
        this.close.focus();
    }

    restore() {
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
        if (groups.length) this.selectSection(groups[0][0]);
    }

    selectSection(label) {
        const group = this.groups.find(item => item[0] === label);
        if (!group) return;
        for (const node of this.sectionNodes) node.classList.toggle('workspace-section-hidden', !group[1].includes(node.id));
        this.sections.querySelectorAll('button').forEach(control => control.setAttribute('aria-pressed', String(control.dataset.section === label)));
    }
}
