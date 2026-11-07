import { getRequestHeaders, saveSettingsDebounced } from '../script.js';
import { extension_settings } from './extensions.js';
import { oai_settings, configureCustomConnection, getCustomModelContext, applyCustomModelContext, refreshCustomModelMetadata } from './openai.js';
import { eventSource, event_types } from './events.js';
import { element, workspaceSettings } from './workspace-views.js';

/** Discover once, then apply each choice through its existing provider owner. */
export class ServiceConnections {
    init() {
        this.targets = new Map();
        this.rows = new Map();
        this.nativeControls = [];
        this.preparePanels();
        this.root = element('section', 'service-connections');
        this.root.id = 'service-connections';
        const label = element('label', '', 'Server URL');
        this.url = element('input', 'text_pole');
        this.url.id = 'service-server-url';
        this.url.type = 'url';
        this.url.placeholder = 'https://your-server';
        this.url.value = extension_settings.serviceConnections?.url ?? (oai_settings.chat_completion_source === 'custom' ? oai_settings.custom_url : '');
        label.htmlFor = this.url.id;
        this.verify = element('button', 'menu_button', 'Verify & discover');
        this.verify.type = 'button';
        this.verify.id = 'service-discover';
        this.status = element('p', 'service-status');
        this.status.setAttribute('role', 'status');
        this.status.id = 'service-discovery-status';
        this.results = element('div', 'service-results');
        this.root.append(label, this.url, this.verify, this.status, this.results);
        const storage = element('div');
        storage.hidden = true;
        storage.id = 'workspace-panel-origins';
        const panel = element('div', 'drawer-content closedDrawer');
        panel.id = 'model-service-settings';
        panel.append(this.root);
        storage.append(panel);
        document.body.append(storage);
        this.verify.addEventListener('click', () => void this.discover());
        this.url.addEventListener('input', () => {
            this.request?.abort();
            this.voiceRequest?.abort();
            this.data = null;
            this.attempted = false;
            this.results.replaceChildren();
            this.clearRows();
            this.status.textContent = 'Verify this address to refresh its available services.';
            this.verify.disabled = false;
        });
        eventSource.on(event_types.ONLINE_STATUS_CHANGED, () => this.updateContext());
        eventSource.on(event_types.OAI_PRESET_CHANGED_AFTER, () => this.updateContext());
        eventSource.on(event_types.SETTINGS_UPDATED, () => this.syncSelections());
        document.addEventListener('change', event => {
            if (event.target.closest('.service-connection-row')) return;
            queueMicrotask(() => this.syncSelections());
        });
        document.addEventListener('input', event => {
            if (['openai_max_context', 'openai_max_context_counter'].includes(event.target.id)) queueMicrotask(() => this.updateContext());
        });
    }

    /** Group existing controls once. No provider values or event handlers are copied. */
    preparePanels() {
        const sd = document.querySelector('.sd_settings > .inline-drawer > .inline-drawer-content');
        if (sd && !this.targets.has('images')) {
            const writer = element('div', 'sd_writer_settings');
            this.writer = writer;
            const image = element('div', 'sd_image_settings');
            const first = sd.querySelector('label[for="sd_prompt_writer_profile"]');
            const last = sd.querySelector('#sd_prompt_writer_max_tokens');
            let node = first;
            while (node) {
                const next = node.nextSibling;
                writer.append(node);
                if (node === last) break;
                node = next;
            }
            image.append(...sd.childNodes);
            const templates = document.getElementById('sd_prompt_templates')?.closest('.inline-drawer');
            if (templates) writer.append(templates);
            sd.append(writer, image);
            this.adopt('writer', writer, 'Saved connection profiles', [writer.querySelector('label[for="sd_prompt_writer_profile"]'), writer.querySelector('#sd_prompt_writer_profile'), writer.querySelector('small')]);
            const independent = element('div', 'service-writer-instructions');
            const instruction = writer.querySelector('label[for="sd_prompt_writer_instructions"]');
            instruction.textContent = 'Separate writer instructions';
            independent.append(instruction, writer.querySelector('#sd_prompt_writer_instructions'), writer.querySelector('label[for="sd_prompt_writer_max_tokens"]'), writer.querySelector('#sd_prompt_writer_max_tokens'));
            writer.insertBefore(independent, templates || writer.querySelector('.service-native-controls'));
            if (templates) this.prepareImagePrompts();
            $('#sd_prompt_writer_profile').on('change', () => this.updateWriter());
            this.updateWriter();
            const connection = [];
            node = image.querySelector('label[for="sd_source"]');
            const end = image.querySelector('#sd_sampler')?.closest('.flex-container');
            while (node && node !== end) { const next = node.nextSibling; connection.push(node); node = next; }
            this.adopt('images', image, 'Advanced image provider settings', connection);
        }
        const chat = document.getElementById('rm_api_block');
        if (!this.targets.has('chat')) this.adopt('chat', chat, 'Advanced provider settings and connection profiles', [...chat.childNodes]);
        const speech = document.querySelector('#tts_settings > .inline-drawer > .inline-drawer-content');
        if (speech && !this.targets.has('speak')) this.adopt('speak', speech, 'Advanced speech settings, voice mapping and playback', [...speech.childNodes]);
        const dictation = document.querySelector('#dictation-settings > .inline-drawer-content');
        if (dictation && !this.targets.has('transcribe')) this.adopt('transcribe', dictation, 'Endpoint and model override', ['dictation-endpoint', 'dictation-model'].flatMap(id => [dictation.querySelector(`label[for="${id}"]`), document.getElementById(id)]));
        const retrieval = document.querySelector('.vectors_settings > .inline-drawer > .inline-drawer-content');
        if (retrieval && !this.retrievalStatus) {
            this.retrievalStatus = element('p', 'workspace-only service-note', 'Verify a server in Servers to check available embedding models.');
            retrieval.prepend(this.retrievalStatus);
        }
        const vision = document.querySelector('.caption_settings > .inline-drawer > .inline-drawer-content');
        if (vision && !this.targets.has('vision')) {
            const prompt = document.getElementById('caption_prompt_block');
            this.adopt('vision', vision, 'Advanced vision provider settings and caption preferences', [...vision.childNodes].filter(node => node !== prompt));
        }
    }

    extensionsActivated() {
        const count = this.targets.size;
        const controls = this.nativeControls.length;
        const retrieval = this.retrievalStatus;
        this.preparePanels();
        if (count === this.targets.size && retrieval === this.retrievalStatus) return;
        if (this.data) this.render(this.data);
        for (const native of this.nativeControls.slice(controls)) native.open = !document.body.classList.contains('workspace-ui') || this.advanced || !this.data;
    }

    prepareImagePrompts() {
        const prompts = document.getElementById('sd_prompt_templates');
        const label = element('label', 'workspace-only', 'Prompt purpose');
        const select = element('select', 'workspace-only text_pole');
        select.id = 'service-image-prompt-purpose';
        label.htmlFor = select.id;
        for (const textarea of prompts.querySelectorAll('textarea')) {
            select.add(new Option(prompts.querySelector(`label[for="${textarea.id}"]`)?.textContent || textarea.id, textarea.id));
        }
        select.value = 'sd_prompt_2';
        const show = () => {
            for (const node of prompts.children) {
                if (node === label || node === select) continue;
                const id = node.matches('textarea') ? node.id : node.querySelector('label')?.htmlFor;
                node.classList.toggle('service-prompt-hidden', id !== select.value);
            }
        };
        select.addEventListener('change', show);
        prompts.prepend(label, select);
        show();
    }

    updateWriter() {
        if (this.writer) this.writer.dataset.writerMode = extension_settings.sd?.prompt_writer_profile ? 'separate' : 'current';
    }

    adopt(id, parent, title, nodes) {
        const setup = element('section', 'workspace-only service-setup');
        setup.dataset.service = id;
        const native = element('details', 'service-native-controls');
        const summary = element('summary', 'workspace-only', title);
        native.open = true;
        native.append(summary, ...nodes.filter(Boolean));
        parent.prepend(setup);
        setup.after(native);
        this.targets.set(id, { setup, native });
        this.nativeControls.push(native);
        this.emptySetup(setup);
    }

    emptySetup(setup) {
        const link = element('button', 'workspace-back-link', 'Set up a server');
        link.type = 'button';
        link.dataset.serviceDestination = 'servers';
        setup.replaceChildren(link, element('p', 'service-empty', 'Discover models, or configure a provider below.'));
    }

    setLayout(workspace) {
        for (const native of this.nativeControls) native.open = !workspace || this.advanced || !this.data;
    }

    setAdvanced(advanced) {
        this.advanced = advanced;
        for (const native of this.nativeControls) native.open = advanced || !this.data;
    }

    opened() {
        if (!this.data && !this.request && !this.attempted && this.url.value.trim()) void this.discover();
        this.updateContext();
        this.syncSelections();
    }

    clearRows() {
        this.rows.clear();
        if (this.retrievalStatus) this.retrievalStatus.textContent = 'Verify a server in Servers to check available embedding models.';
        for (const { setup, native } of this.targets.values()) {
            this.emptySetup(setup);
            native.open = true;
        }
    }

    async fetch(body, signal) {
        const response = await fetch('/api/openai/custom/discover', { method: 'POST', headers: getRequestHeaders(), body: JSON.stringify(body), signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `Discovery failed, HTTP ${response.status}. Retry after checking the server.`);
        return data;
    }

    async discover() {
        this.attempted = true;
        this.request?.abort();
        this.voiceRequest?.abort();
        const request = new AbortController();
        this.request = request;
        this.verify.disabled = true;
        this.root.setAttribute('aria-busy', 'true');
        this.results.replaceChildren();
        this.status.textContent = 'Checking connection and enabled services…';
        try {
            const data = await this.fetch({ url: this.url.value.trim() }, request.signal);
            if (request.signal.aborted) return;
            this.data = data;
            extension_settings.serviceConnections = { url: data.root };
            this.url.value = data.root;
            saveSettingsDebounced();
            this.status.textContent = data.juiced ? 'Connected to Juiced. Select a model for each service you want to use. Only enabled models are listed.' : 'Connected to an OpenAI-compatible server. Chat models are available. Configure other services in their native settings.';
            this.clearRows();
            this.render(data);
        } catch (error) {
            if (!request.signal.aborted) this.status.textContent = `${error.message} Check the URL, TLS, network and enabled models, then retry.`;
        } finally {
            if (this.request === request) {
                this.verify.disabled = false;
                this.root.removeAttribute('aria-busy');
                this.request = null;
            }
        }
    }

    /** Read applied configuration from native owners; discovery never owns it. */
    selection(id) {
        if (!this.data) return null;
        const { root, base } = this.data;
        const same = (left, right) => String(left || '').replace(/\/$/, '') === right;
        const sd = extension_settings.sd;
        const tts = extension_settings.tts;
        const caption = extension_settings.caption;
        if (id === 'chat') return document.getElementById('main_api').value === 'openai' && oai_settings.chat_completion_source === 'custom' && same(oai_settings.custom_url, base) ? { model: oai_settings.custom_model } : null;
        if (id === 'writer') {
            const profile = extension_settings.connectionManager?.profiles?.find(profile => profile.id === sd?.prompt_writer_profile);
            return !sd?.prompt_writer_profile ? { model: '' } : profile?.mode === 'cc' && profile.api === 'custom' && same(profile['api-url'], base) ? { model: profile.model } : null;
        }
        if (id === 'images') return sd?.source === 'sdcpp' && same(sd.sdcpp_url, root) ? { model: sd.model } : null;
        if (id === 'speak') {
            const settings = tts?.['OpenAI Compatible'];
            return tts?.currentProvider === 'OpenAI Compatible' && same(settings?.provider_endpoint, `${base}/audio/speech`) ? { model: settings.model, voice: typeof settings.voiceMap === 'object' ? settings.voiceMap?.['[Default Voice]'] : '' } : null;
        }
        if (id === 'transcribe') return same(extension_settings.dictation?.endpoint, `${base}/audio/transcriptions`) ? { model: extension_settings.dictation.model } : null;
        if (id === 'vision' && caption?.source === 'multimodal' && caption.multimodal_api === 'custom' && same(oai_settings.custom_url, base)) {
            const model = caption.multimodal_model === 'custom_current' ? oai_settings.custom_model
                : caption.multimodal_model === 'custom_custom' ? caption.custom_model : caption.multimodal_model;
            return { model };
        }
        return null;
    }

    syncSelections() {
        for (const [id, row] of this.rows) {
            if (row.pending) continue;
            const applied = this.selection(id);
            const signature = JSON.stringify(applied);
            if (signature === row.applied) continue;
            row.applied = signature;
            row.select.value = applied?.model || '';
            if (row.voice && [...row.voice.options].some(option => option.value === applied?.voice)) row.voice.value = applied.voice;
            row.status.textContent = applied
                ? row.select.value === applied.model ? 'Provider settings updated. The applied model is selected.' : `Applied model ${applied.model} is not in the discovered models for this service. Existing settings are preserved.`
                : 'This service uses other provider settings. Choose a model to apply this server.';
            row.action.disabled = id !== 'writer' && !row.select.value;
        }
        this.updateContext();
    }

    row(id, title, service, apply) {
        const applied = this.selection(id);
        const current = applied?.model;
        const row = element('section', 'service-connection-row');
        row.id = `service-${id}-row`;
        const label = element('label', '', title);
        const select = element('select', 'text_pole');
        select.id = `service-${id}-model`;
        label.htmlFor = select.id;
        select.add(new Option(id === 'writer' ? 'Current chat model' : 'Choose a model', ''));
        for (const model of service?.models || []) select.add(new Option(model.id, model.id));
        select.value = [...select.options].some(option => option.value === current) ? current : '';
        const action = element('button', 'menu_button', 'Use model');
        action.type = 'button';
        action.id = `service-${id}-apply`;
        const missing = current && ![...select.options].some(option => option.value === current);
        const status = element('p', 'service-status', service?.error || (missing ? `Saved model ${current} is not enabled on this server. Existing settings are preserved. Enable it or choose another model.` : !service?.models?.length ? 'No enabled models for this service. Enable one on the server, then retry discovery.' : ''));
        status.setAttribute('role', 'status');
        action.disabled = id !== 'writer' && !select.value;
        select.disabled = !service?.models?.length;
        const controls = { row, select, action, status, applied: JSON.stringify(applied), pending: false };
        controls.changed = () => {
            action.disabled = id !== 'writer' && !select.value;
            status.textContent = 'Selection not applied. Use model to save this service.';
        };
        this.rows.set(id, controls);
        select.addEventListener('change', controls.changed);
        action.addEventListener('click', async () => {
            controls.pending = true;
            action.disabled = true;
            select.disabled = true;
            if (controls.voice) controls.voice.disabled = true;
            status.textContent = 'Applying connection…';
            try {
                await apply(select.value);
                controls.applied = JSON.stringify(this.selection(id));
                status.textContent = 'Saved. This service uses the selected model. Test it in your story when ready.';
                this.targets.get(id).native.open = Boolean(this.advanced);
                this.updateContext();
                this.updateWriter();
            } catch (error) {
                status.textContent = `${error.message} Retry or open the provider settings.`;
            } finally {
                controls.pending = false;
                if (row.isConnected) {
                    action.disabled = id !== 'writer' && !select.value;
                    select.disabled = !service?.models?.length;
                    if (controls.voice) controls.voice.disabled = !controls.voices?.length;
                }
            }
        });
        row.append(label, select, action, status);
        const target = this.targets.get(id);
        target.setup.replaceChildren(row);
        target.native.open = this.advanced || !current || missing;
        return controls;
    }

    render(data) {
        this.results.replaceChildren();
        if (!this.rows.size) refreshCustomModelMetadata(data.base, data.services.chat?.models || []);
        for (const [service, destination] of [['chat', 'connection'], ['chat', 'image-writer'], ['images', 'image-settings'], ['speak', 'voice-settings'], ['transcribe', 'dictation-settings'], ['vision', 'vision-settings'], ['embeddings', 'embeddings-settings']]) {
            if (service === 'vision' && !this.targets.has('vision')) continue;
            const setting = workspaceSettings.find(setting => setting.id === destination);
            const link = element('button', 'service-destination');
            link.type = 'button';
            link.dataset.serviceDestination = destination;
            const available = service === 'vision' ? data.services.chat?.models.filter(model => model.labels?.includes('vision')).length : data.services[service]?.models.length;
            link.append(element('span', '', setting.label), element('small', '', available ? `${available} ${available === 1 ? 'model' : 'models'} available` : 'Configure provider'), element('i', 'fa-solid fa-chevron-right'));
            this.results.append(link);
        }
        if (!this.rows.has('chat')) {
            const chat = this.row('chat', 'Model', data.services.chat, model => configureCustomConnection(data.base, model, { models: data.services.chat.models, automaticContext: this.contextToggle.checked }));
            const contextLabel = element('label', 'checkbox_label service-context-toggle');
            this.contextToggle = element('input');
            this.contextToggle.type = 'checkbox';
            this.contextToggle.id = 'service-chat-auto-context';
            this.contextToggle.checked = Boolean(oai_settings.custom_context_auto);
            contextLabel.append(this.contextToggle, element('span', '', 'Use discovered context size'));
            this.contextStatus = element('p', 'service-note');
            this.contextStatus.id = 'service-chat-context';
            this.contextStatus.setAttribute('role', 'status');
            this.contextToggle.addEventListener('change', () => {
                applyCustomModelContext(this.contextToggle.checked);
                this.updateContext();
            });
            chat.row.append(contextLabel, this.contextStatus);
            chat.row.append(element('small', '', 'Reply length, temperature and context overrides are in Reply controls. Story prompts contains the actual prompt manager.'));
            this.updateContext();
        }
        const imageAvailable = this.targets.has('images');
        if (imageAvailable && !this.rows.has('writer')) {
            const writer = this.row('writer', 'Optional image prompt writer', data.services.chat, async model => {
                const sd = await import('./extensions/stable-diffusion/index.js');
                const { saveCompatibleProfile } = await import('./extensions/connection-manager/index.js');
                const id = model ? await saveCompatibleProfile(`Image writer ${model}`, data.base, model) : '';
                sd.configureImageWriter(id);
            });
            writer.row.append(element('small', '', 'Uses the current scene. A separate writer keeps the story model selected and has its own instructions and output budget.'));
        }
        if (!data.juiced) return;
        const sdSupported = data.protocols.some(protocol => protocol.id === 'automatic1111' && protocol.features?.includes('txt2img'));
        if (imageAvailable && sdSupported && !this.rows.has('images')) {
            const image = this.row('images', 'Image generation', data.services.images, async model => {
                const { configureSdcppConnection } = await import('./extensions/stable-diffusion/index.js');
                await configureSdcppConnection(data.root, model);
            });
            image.row.append(element('small', '', 'Uses stable-diffusion.cpp with the server root. Review size, steps, CFG and sampler in Image generation. Automatic image tools stay as configured.'));
        } else if (!imageAvailable || !sdSupported) this.results.append(element('p', '', 'Image generation needs the Image Generation extension and an advertised sd.cpp txt2img service.'));
        if (this.targets.has('speak') && !this.rows.has('speak')) {
            const speech = this.row('speak', 'Voice narration', data.services.speak, async model => {
                if (!speech.voice.value || !speech.voices?.length) throw new Error('Discover voices and choose a voice first.');
                const { configureCompatibleTts } = await import('./extensions/tts/index.js');
                await configureCompatibleTts(`${data.base}/audio/speech`, model, speech.voices, speech.voice.value);
            });
            const label = element('label', '', 'Available voice');
            speech.voice = element('select', 'text_pole');
            speech.voice.id = 'service-speak-voice';
            label.htmlFor = speech.voice.id;
            speech.voice.disabled = true;
            speech.voice.addEventListener('change', speech.changed);
            speech.action.disabled = true;
            const retry = element('button', 'menu_button', 'Retry voices');
            retry.type = 'button';
            retry.id = 'service-speak-retry';
            retry.hidden = true;
            speech.row.append(retry);
            speech.row.insertBefore(label, speech.action);
            speech.row.insertBefore(speech.voice, speech.action);
            speech.row.append(element('small', '', 'The Voice toggle in your story controls narration. Applying a connection preserves that choice and existing character voice mappings.'));
            const voices = async () => {
                this.voiceRequest?.abort();
                const request = new AbortController();
                this.voiceRequest = request;
                speech.action.disabled = true;
                speech.voice.disabled = true;
                speech.voices = [];
                speech.voice.replaceChildren();
                if (!speech.select.value) return;
                retry.hidden = true;
                speech.status.textContent = 'Discovering voices…';
                try {
                    const result = await this.fetch({ url: data.root, voice_model: speech.select.value }, request.signal);
                    if (request.signal.aborted || !speech.row.isConnected) return;
                    speech.voices = result.voices;
                    for (const voice of result.voices) speech.voice.add(new Option(voice, voice));
                    const saved = this.selection('speak')?.voice;
                    if (result.voices.includes(saved)) speech.voice.value = saved;
                    speech.voice.disabled = !result.voices.length;
                    speech.action.disabled = !result.voices.length;
                    retry.hidden = Boolean(result.voices.length);
                    speech.status.textContent = result.voices.length ? `${result.voices.length} voices discovered from the speech backend.` : 'The server returned no voices. Enable or load the speech model, then retry.';
                } catch (error) {
                    if (!request.signal.aborted && speech.row.isConnected) {
                        speech.status.textContent = `${error.message} Load the model if needed, then retry voices.`;
                        retry.hidden = false;
                    }
                }
            };
            retry.addEventListener('click', () => void voices());
            speech.select.addEventListener('change', () => void voices());
            if (speech.select.value) void voices();
        }
        if (this.targets.has('transcribe') && !this.rows.has('transcribe')) {
            this.row('transcribe', 'Microphone dictation', data.services.transcribe, async model => {
                const { configureDictation } = await import('./dictation.js');
                configureDictation(`${data.base}/audio/transcriptions`, model);
            }).row.append(element('small', '', 'Dictation inserts text into your draft. It never sends the message. Microphone access needs HTTPS or localhost and browser permission.'));
        }
        if (this.targets.has('vision') && !this.rows.has('vision')) {
            this.row('vision', 'Vision model', { models: data.services.chat?.models.filter(model => model.labels?.includes('vision')) || [] }, async model => {
                if (oai_settings.custom_url.replace(/\/$/, '') !== data.base) throw new Error('Connect the story service to this server first. Native custom captioning shares its compatible server address.');
                const { configureCompatibleCaption } = await import('./extensions/caption/index.js');
                configureCompatibleCaption(model);
            }).row.append(element('small', '', 'Uses the story service’s compatible server with its own vision model and caption prompt below. The story model stays selected.'));
        }
        if (this.retrievalStatus) this.retrievalStatus.textContent = data.services.embeddings?.error || (data.services.embeddings?.models?.length
            ? `Available embedding models: ${data.services.embeddings.models.map(model => model.id).join(', ')}. Choose a retrieval provider below.`
            : 'No enabled embedding models were reported by this server. Enable one on the server or choose a retrieval provider below.');
    }

    updateContext() {
        if (!this.contextStatus) return;
        const info = getCustomModelContext();
        this.contextToggle.checked = Boolean(info.automatic);
        this.contextToggle.disabled = !this.selection('chat');
        if (this.contextToggle.disabled) {
            this.contextStatus.textContent = 'This server is not the active story connection. Use model to apply it; existing context settings are preserved.';
            return;
        }
        const format = value => Number(value).toLocaleString();
        this.contextStatus.textContent = info.context
            ? `${info.automatic ? 'Automatic' : 'Custom'}: ${format(info.current)} tokens. Server reports ${format(info.context)} for ${info.model}. Reply tokens share this budget.`
            : `Server context size is not reported for the selected model. Keeping ${format(info.current)} tokens; set a limit in Reply controls if needed.`;
    }
}
