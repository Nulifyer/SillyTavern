import { extension_settings } from './extensions.js';
import { button, element } from './workspace-views.js';

/** Scene actions use native providers; the toolbar stays mounted while replies stream. */
export class WorkspaceTools {
    constructor(refresh) {
        this.busy = false;
        this.refresh = refresh;
        this.menuOrigins = new Map();
    }

    init() {
        const toolbar = element('div', 'workspace-only workspace-composer-tools');
        this.image = button('Illustrate scene', 'generate-scene-image', {}, 'workspace-tool-button', 'fa-image');
        this.image.id = 'workspace-image-button';
        this.image.title = 'Generate one illustration from the current story';
        this.voice = button('Voice off', 'toggle-voice', {}, 'workspace-tool-button workspace-voice-toggle', 'fa-volume-xmark');
        this.voice.id = 'workspace-voice-button';
        this.voice.setAttribute('aria-label', 'Voice narration');
        this.voice.setAttribute('aria-pressed', 'false');
        toolbar.append(this.image, this.voice);
        const more = element('details', 'workspace-scene-menu workspace-creative-menu');
        const summary = element('summary', 'workspace-icon-button');
        summary.setAttribute('aria-label', 'Chat tools and options');
        summary.innerHTML = '<i class="fa-solid fa-ellipsis" aria-hidden="true"></i>';
        const menu = element('div', 'workspace-action-menu');
        this.menu = menu;
        menu.append(
            button('Portrait or custom image', 'image', {}, 'workspace-menu-action', 'fa-paintbrush'),
            button('Read latest reply', 'read-reply', {}, 'workspace-menu-action', 'fa-play'),
            button('Play / pause voice', 'voice-playback', {}, 'workspace-menu-action', 'fa-pause'),
            button('Voice settings', 'voice-settings', {}, 'workspace-menu-action', 'fa-volume-high'),
            button('Image settings', 'image-settings', {}, 'workspace-menu-action', 'fa-image'),
            button('Model settings', 'connection', {}, 'workspace-menu-action', 'fa-plug'),
        );
        more.append(summary, menu);
        toolbar.append(more);
        const model = button('', 'connection', {}, 'workspace-tool-button workspace-model-chip', 'fa-circle');
        model.querySelector('span').id = 'workspace-model-chip';
        toolbar.append(model);
        document.getElementById('form_sheld').append(toolbar);
        // Preserve native menu anchors and handlers in the secondary tools menu.
        for (const [id, label] of [['options_button', 'Chat actions'], ['extensionsMenuButton', 'Extension tools']]) {
            const control = document.getElementById(id);
            if (!control) continue;
            this.menuOrigins.set(control, { parent: control.parentNode, next: control.nextSibling });
            control.append(element('span', 'workspace-only', label));
            control.setAttribute('role', 'button');
            control.setAttribute('tabindex', '0');
            control.setAttribute('aria-label', label);
            control.addEventListener('keydown', event => {
                if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); control.click(); }
            });
            menu.append(control);
        }
        this.status = element('p', 'workspace-only workspace-scene-status');
        this.status.id = 'workspace-image-status';
        this.status.setAttribute('role', 'status');
        this.status.hidden = true;
        document.getElementById('form_sheld').prepend(this.status);
    }

    setLayout(workspace) {
        for (const [control, origin] of this.menuOrigins) {
            if (workspace) this.menu.append(control);
            else origin.parent.insertBefore(control, origin.next?.parentNode === origin.parent ? origin.next : null);
        }
    }

    update(generating, archived) {
        const enabled = Boolean(extension_settings.tts?.enabled);
        this.voice.setAttribute('aria-pressed', String(enabled));
        this.voice.querySelector('span').textContent = enabled ? 'Voice on' : 'Voice off';
        this.voice.querySelector('i').className = `fa-solid ${enabled ? 'fa-volume-high' : 'fa-volume-xmark'}`;
        this.voice.disabled = !document.getElementById('tts_enabled') || archived;
        this.image.disabled = this.busy || generating || archived;
        this.image.querySelector('span').textContent = this.busy ? 'Illustrating…' : 'Illustrate scene';
        this.image.setAttribute('aria-busy', String(this.busy));
    }

    async toggleVoice() {
        const toggle = document.getElementById('tts_enabled');
        if (!toggle) throw new Error('Enable the TTS extension in Extensions first.');
        toggle.click();
        this.refresh();
        if (toggle.checked) {
            const { initVoiceMap } = await import('./extensions/tts/index.js');
            void initVoiceMap().catch(error => toastr.error(error.message || 'The voice provider could not load. Open Voice settings.'));
        }
    }

    readReply() {
        if (!extension_settings.tts?.enabled) throw new Error('Turn on Voice to read a reply.');
        const replies = [...document.querySelectorAll('#chat .mes[is_user="false"]:not([is_system="true"]) .mes_narrate')];
        if (!replies.length) throw new Error('There is no character reply to read yet.');
        replies.at(-1).click();
    }

    openImageOptions() {
        const dialog = document.getElementById('workspace-tools');
        const content = element('div', 'workspace-tools-content');
        const heading = element('div', 'workspace-tools-heading');
        const close = button('Close', 'close-tools', {}, 'workspace-icon-button', 'fa-xmark');
        close.setAttribute('aria-label', 'Close image options');
        heading.append(element('h2', '', 'Image options'), close);
        content.append(heading, element('p', '', 'One image per request. Uses your configured image provider.'));
        content.append(button('Character portrait', 'generate-image', { imagePrompt: 'face' }, 'workspace-button', 'fa-user'));
        const label = element('label', 'workspace-image-prompt');
        label.append(element('span', '', 'Custom image prompt'));
        const input = element('textarea');
        input.id = 'workspace-image-prompt';
        input.rows = 3;
        input.placeholder = 'Describe the composition, characters, and setting…';
        label.append(input);
        content.append(label, button('Generate custom image', 'generate-custom-image', {}, 'workspace-button workspace-primary', 'fa-wand-magic-sparkles'), button('Image settings', 'image-settings', {}, 'workspace-back-link', 'fa-gear'));
        dialog.replaceChildren(content);
        if (!dialog.open) dialog.showModal();
    }

    async generate(prompt = 'scene') {
        if (this.busy) return;
        if (!prompt.trim()) throw new Error('Describe the image you want to create.');
        if (!document.getElementById('sd_gen')) throw new Error('Enable Image Generation in Extensions first.');
        this.busy = true;
        this.status.hidden = false;
        this.status.replaceChildren(element('span', '', 'Creating a scene illustration…'));
        this.refresh();
        const controls = [...document.querySelectorAll('#workspace-tools [data-workspace-action^="generate-"]')];
        controls.forEach(control => control.disabled = true);
        try {
            const { generateWorkspaceImage } = await import('./extensions/stable-diffusion/index.js');
            const result = await generateWorkspaceImage(prompt);
            if (!result) throw new Error('The image could not be generated. Check your image provider settings.');
            this.status.replaceChildren(element('span', '', 'Illustration added to this story.'));
            if (document.getElementById('workspace-tools').open) document.getElementById('workspace-tools').close();
        } catch (error) {
            this.status.replaceChildren(element('span', '', error.message), button('Image settings', 'image-settings', {}, 'workspace-back-link'));
        } finally {
            this.busy = false;
            controls.forEach(control => control.disabled = false);
            this.refresh();
        }
    }
}
