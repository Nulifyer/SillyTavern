import { eventSource, event_types, getCurrentChatId, getRequestHeaders, saveSettingsDebounced } from '../script.js';
import { extension_settings, getContext } from './extensions.js';
import { element } from './workspace-views.js';
import { encodeDictationWav } from './audio-recording.js';

let instance;

/** Endpoint and model belong to dictation, independent of story and speech generation. */
export function configureDictation(endpoint, model) {
    extension_settings.dictation = { ...extension_settings.dictation, endpoint, model };
    instance?.sync();
    saveSettingsDebounced();
}

function storyIdentity() {
    const context = getContext();
    return JSON.stringify([context.characterId, context.groupId, getCurrentChatId()]);
}

/** Opt-in recording inserts a transcript into the existing composer. It never sends. */
export class Dictation {
    init(button) {
        instance = this;
        this.button = button;
        this.sequence = 0;
        this.status = element('p', 'workspace-only service-status');
        this.status.id = 'dictation-status';
        this.status.setAttribute('role', 'status');
        this.status.hidden = true;
        document.getElementById('form_sheld').prepend(this.status);
        const wrapper = element('section', 'dictation-settings inline-drawer');
        wrapper.id = 'dictation-settings';
        const heading = element('div', 'inline-drawer-toggle inline-drawer-header');
        heading.append(element('b', '', 'Microphone dictation'), element('i', 'inline-drawer-icon fa-solid fa-circle-chevron-down down'));
        const settings = element('div', 'inline-drawer-content');
        settings.style.display = 'none';
        wrapper.append(heading, settings);
        settings.append(element('h3', '', 'Microphone dictation'), element('p', '', 'Use a compatible transcription service to add text to your draft. Dictation never sends messages. Microphone access requires HTTPS or localhost and browser permission. Audio is sent as mono 16 kHz WAV. You can also transcribe an audio file up to 120 seconds long.'));
        this.endpoint = this.input(settings, 'dictation-endpoint', 'Transcription endpoint');
        this.model = this.input(settings, 'dictation-model', 'Transcription model');
        settings.append(element('small', '', 'Uses the Custom OpenAI provider key when one is saved. Key-free servers need no key. Choose discovered models in Settings > Dictation.'));
        const label = element('label', '', 'Transcribe audio into the current story draft');
        const upload = element('input', 'text_pole');
        upload.type = 'file';
        upload.accept = 'audio/*';
        upload.id = 'dictation-file';
        label.htmlFor = upload.id;
        this.fileStatus = element('p', 'service-status');
        this.fileStatus.id = 'dictation-file-status';
        upload.setAttribute('aria-describedby', this.fileStatus.id);
        this.fileStatus.setAttribute('role', 'status');
        upload.addEventListener('change', async () => {
            const file = upload.files?.[0];
            if (!file) return;
            if (this.active) { this.fileStatus.textContent = 'Finish or cancel the current dictation first.'; upload.value = ''; return; }
            if (!getCurrentChatId()) { this.show('Open a story before transcribing audio.'); upload.value = ''; return; }
            const sequence = ++this.sequence;
            this.active = true;
            this.update();
            try {
                await this.transcribe(file, sequence, storyIdentity());
            } catch (error) {
                if (sequence === this.sequence) this.show(error.message);
            } finally {
                if (sequence === this.sequence) {
                    this.active = false;
                    upload.value = '';
                    this.update();
                }
            }
        });
        settings.append(label, upload, this.fileStatus);
        document.getElementById('extensions_settings2').append(wrapper);
        this.sync();
        button.addEventListener('click', () => void this.toggle());
        eventSource.on(event_types.CHAT_CHANGED, () => { if (this.active) this.cancel('Story changed. Dictation cancelled. Retry in the intended story.'); });
        window.addEventListener('pagehide', () => this.cancel());
    }

    input(parent, id, title) {
        const label = element('label', '', title);
        label.htmlFor = id;
        const input = element('input', 'text_pole');
        input.id = id;
        input.type = 'text';
        parent.append(label, input);
        input.addEventListener('input', () => configureDictation(this.endpoint.value.trim(), this.model.value.trim()));
        return input;
    }

    sync() {
        this.endpoint.value = extension_settings.dictation?.endpoint || '';
        this.model.value = extension_settings.dictation?.model || '';
    }

    show(text) {
        this.status.hidden = !text;
        this.status.textContent = text || '';
        this.fileStatus.textContent = text || '';
    }

    update(disabled = this.disabled) {
        this.disabled = disabled;
        this.button.disabled = Boolean(disabled && !this.active);
        this.button.setAttribute('aria-pressed', String(Boolean(this.active)));
        this.button.setAttribute('aria-label', this.active ? 'Stop dictation' : 'Dictate message');
        this.button.querySelector('i').className = `fa-solid ${this.active ? 'fa-stop' : 'fa-microphone'}`;
        this.button.querySelector('span').textContent = this.active ? 'Stop dictation' : 'Dictate';
    }

    stopTracks() {
        clearTimeout(this.timer);
        this.stream?.getTracks().forEach(track => track.stop());
        this.stream = null;
    }

    cancel(message) {
        this.sequence++;
        this.request?.abort();
        if (this.recorder?.state === 'recording') this.recorder.stop();
        this.stopTracks();
        this.active = false;
        if (message) this.show(message);
        this.update();
    }

    async toggle() {
        if (this.active) {
            if (this.recorder?.state === 'recording') {
                this.recorder.stop();
                this.stopTracks();
            } else this.cancel('Dictation cancelled. You can retry.');
            return;
        }
        const sequence = ++this.sequence;
        const identity = storyIdentity();
        this.active = true;
        this.update();
        try {
            if (!extension_settings.dictation?.endpoint || !extension_settings.dictation?.model) throw new Error('Configure dictation in Models & connections or Dictation settings, then retry.');
            if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('Microphone access needs HTTPS or localhost. Reopen this app securely, then retry.');
            if (!window.MediaRecorder) throw new Error('This browser cannot record audio. Use an audio file in Dictation settings.');
            this.show('Allow microphone access, then speak. Stop dictation adds text to your draft.');
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            if (sequence !== this.sequence) { stream.getTracks().forEach(track => track.stop()); return; }
            this.stream = stream;
            const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'].find(type => MediaRecorder.isTypeSupported(type));
            const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
            this.recorder = recorder;
            const chunks = [];
            recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
            recorder.onerror = () => this.cancel('Audio recording failed. Check microphone permissions and retry.');
            recorder.onstop = async () => {
                this.stopTracks();
                if (sequence !== this.sequence) return;
                try {
                    const type = recorder.mimeType;
                    const extension = type.includes('mp4') ? 'mp4' : type.includes('ogg') ? 'ogg' : 'webm';
                    await this.transcribe(new File(chunks, `dictation.${extension}`, { type }), sequence, identity);
                } catch (error) {
                    if (sequence === this.sequence) this.show(`${error.message} Retry dictation.`);
                } finally {
                    if (sequence === this.sequence) { this.active = false; this.update(); }
                }
            };
            recorder.start();
            this.show('Listening… Stop dictation when finished. Recording stops after 60 seconds.');
            this.timer = setTimeout(() => { if (recorder.state === 'recording') { recorder.stop(); this.stopTracks(); } }, 60000);
        } catch (error) {
            if (sequence !== this.sequence) return;
            this.stopTracks();
            this.active = false;
            this.show(error.name === 'NotAllowedError' ? 'Microphone permission denied. Allow access in your browser, then retry, or use an audio file in Dictation settings.' : error.message);
            this.update();
        }
    }

    async transcribe(file, sequence, identity) {
        const settings = extension_settings.dictation;
        if (!settings?.endpoint || !settings?.model) throw new Error('Choose a dictation endpoint and model first.');
        if (!file.size || file.size > 25 * 1024 * 1024) throw new Error('Choose a nonempty audio file smaller than 25 MB.');
        this.show('Preparing audio…');
        const wav = await encodeDictationWav(file);
        if (sequence !== this.sequence || identity !== storyIdentity()) return;
        this.show('Transcribing… You can keep editing your draft.');
        this.request = new AbortController();
        const body = new FormData();
        body.append('avatar', wav);
        body.append('endpoint', settings.endpoint);
        body.append('model', settings.model);
        const response = await fetch('/api/openai/custom/transcribe-audio', { method: 'POST', headers: getRequestHeaders({ omitContentType: true }), body, signal: this.request.signal });
        if (!response.ok) throw new Error(`Transcription failed, HTTP ${response.status}. Check the endpoint and enabled model.`);
        const data = await response.json();
        if (sequence !== this.sequence || identity !== storyIdentity()) return;
        if (!data.text?.trim()) throw new Error('The service returned no text.');
        const input = document.getElementById('send_textarea');
        const start = input.selectionStart;
        const prefix = start && !/\s$/.test(input.value.slice(0, start)) ? ' ' : '';
        input.setRangeText(`${prefix}${data.text.trim()}`, start, input.selectionEnd, 'end');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        this.show('Transcript added to your draft. Review it before sending.');
        if (input.getClientRects().length) input.focus();
    }
}
