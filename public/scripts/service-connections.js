import { getRequestHeaders, saveSettingsDebounced } from '../script.js';
import { extension_settings } from './extensions.js';
import { oai_settings, configureCustomConnection } from './openai.js';
import { element } from './workspace-views.js';

/** Discover once, then apply each choice through its existing provider owner. */
export class ServiceConnections {
    init() {
        this.root = element('section', 'service-connections');
        this.root.id = 'service-connections';
        this.root.append(element('h2', '', 'Connect model services'), element('p', '', 'Enter your Juiced server once to discover enabled models for stories, images, narration and dictation. Each service is optional. Existing provider settings remain available below.'));
        const label = element('label', '', 'Server URL');
        this.url = element('input', 'text_pole');
        this.url.id = 'service-server-url';
        this.url.type = 'url';
        this.url.placeholder = 'https://your-server';
        this.url.value = extension_settings.serviceConnections?.url || (oai_settings.chat_completion_source === 'custom' ? oai_settings.custom_url : '');
        label.htmlFor = this.url.id;
        this.verify = element('button', 'menu_button', 'Verify & discover');
        this.verify.type = 'button';
        this.verify.id = 'service-discover';
        this.status = element('p', 'service-status');
        this.status.setAttribute('role', 'status');
        this.status.id = 'service-discovery-status';
        this.results = element('div', 'service-results');
        this.root.append(label, this.url, this.verify, this.status, this.results);
        document.getElementById('rm_api_block').prepend(this.root);
        this.verify.addEventListener('click', () => void this.discover());
        this.url.addEventListener('input', () => {
            this.request?.abort();
            this.voiceRequest?.abort();
            this.data = null;
            this.results.replaceChildren();
            this.status.textContent = 'Verify this address to refresh its available services.';
            this.verify.disabled = false;
        });
    }

    async fetch(body, signal) {
        const response = await fetch('/api/openai/custom/discover', { method: 'POST', headers: getRequestHeaders(), body: JSON.stringify(body), signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `Discovery failed, HTTP ${response.status}. Retry after checking the server.`);
        return data;
    }

    async discover() {
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
            this.render(data);
        } catch (error) {
            if (!request.signal.aborted) this.status.textContent = `${error.message} Check the URL, TLS, network and enabled models, then retry.`;
        } finally {
            if (this.request === request) {
                this.verify.disabled = false;
                this.root.removeAttribute('aria-busy');
            }
        }
    }

    row(id, title, service, current, apply) {
        const row = element('section', 'service-connection-row');
        row.id = `service-${id}-row`;
        const label = element('label', '', title);
        const select = element('select', 'text_pole');
        select.id = `service-${id}-model`;
        label.htmlFor = select.id;
        select.add(new Option(id === 'writer' ? 'Current chat model' : 'Choose a model', ''));
        for (const model of service?.models || []) select.add(new Option(model.id, model.id));
        select.value = [...select.options].some(option => option.value === current) ? current : '';
        const action = element('button', 'menu_button', 'Use selected model');
        action.type = 'button';
        action.id = `service-${id}-apply`;
        const status = element('p', 'service-status', service?.error || (!service?.models?.length ? 'No enabled models for this service. Enable one on the server, then retry discovery.' : ''));
        status.setAttribute('role', 'status');
        action.disabled = id !== 'writer' && !select.value;
        select.disabled = !service?.models?.length;
        select.addEventListener('change', () => action.disabled = id !== 'writer' && !select.value);
        action.addEventListener('click', async () => {
            action.disabled = true;
            status.textContent = 'Applying connection…';
            try {
                await apply(select.value);
                status.textContent = 'Saved. Native provider settings contain this connection.';
            } catch (error) {
                status.textContent = `${error.message} Retry or open the provider settings.`;
            } finally {
                if (row.isConnected) action.disabled = id !== 'writer' && !select.value;
            }
        });
        row.append(label, select, action, status);
        this.results.append(row);
        return { row, select, action, status };
    }

    render(data) {
        this.results.replaceChildren();
        this.row('chat', 'Story replies', data.services.chat, oai_settings.custom_model, model => configureCustomConnection(data.base, model));
        const imageAvailable = Boolean(document.getElementById('sd_source'));
        if (imageAvailable) {
            const writer = this.row('writer', 'Optional image prompt writer', data.services.chat, '', async model => {
                const sd = await import('./extensions/stable-diffusion/index.js');
                const { saveCompatibleProfile } = await import('./extensions/connection-manager/index.js');
                const id = model ? await saveCompatibleProfile(`Image writer ${model}`, data.base, model) : '';
                sd.configureImageWriter(id);
            });
            writer.row.append(element('small', '', 'Current chat remains the default. A separate writer receives the scene context and keeps your story model selected. Instructions and output budget are in Image generation.'));
            const profile = extension_settings.connectionManager?.profiles?.find(profile => profile.id === extension_settings.sd?.prompt_writer_profile);
            if (profile && profile['api-url'] === data.base) writer.select.value = profile.model;
        }
        if (!data.juiced) return;
        const sdSupported = data.protocols.some(protocol => protocol.id === 'automatic1111' && protocol.features?.includes('txt2img'));
        if (imageAvailable && sdSupported) {
            const image = this.row('images', 'Image generation', data.services.images, extension_settings.sd?.model, async model => {
                const { configureSdcppConnection } = await import('./extensions/stable-diffusion/index.js');
                await configureSdcppConnection(data.root, model);
            });
            image.row.append(element('small', '', 'Uses stable-diffusion.cpp with the server root. Review size, steps, CFG and sampler in Image generation. Automatic image tools stay as configured.'));
        } else this.results.append(element('p', '', 'Image generation needs the Image Generation extension and an advertised sd.cpp txt2img service.'));
        if (document.getElementById('tts_provider')) {
            const settings = extension_settings.tts?.['OpenAI Compatible'];
            const speech = this.row('speak', 'Voice narration', data.services.speak, settings?.model, async model => {
                if (!speech.voice.value || !speech.voices?.length) throw new Error('Discover voices and choose a voice first.');
                const { configureCompatibleTts } = await import('./extensions/tts/index.js');
                await configureCompatibleTts(`${data.base}/audio/speech`, model, speech.voices, speech.voice.value);
            });
            const label = element('label', '', 'Available voice');
            speech.voice = element('select', 'text_pole');
            speech.voice.id = 'service-speak-voice';
            label.htmlFor = speech.voice.id;
            speech.voice.disabled = true;
            speech.action.disabled = true;
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
                speech.status.textContent = 'Discovering voices…';
                try {
                    const result = await this.fetch({ url: data.root, voice_model: speech.select.value }, request.signal);
                    if (request.signal.aborted || !speech.row.isConnected) return;
                    speech.voices = result.voices;
                    for (const voice of result.voices) speech.voice.add(new Option(voice, voice));
                    const map = settings?.voiceMap;
                    const saved = typeof map === 'object' ? map?.['[Default Voice]'] : '';
                    if (result.voices.includes(saved)) speech.voice.value = saved;
                    speech.voice.disabled = !result.voices.length;
                    speech.action.disabled = !result.voices.length;
                    speech.status.textContent = result.voices.length ? `${result.voices.length} voices discovered from the speech backend.` : 'The server returned no voices. Enable or load the speech model, then retry.';
                } catch (error) {
                    if (!request.signal.aborted) speech.status.textContent = `${error.message} Re-select the model to retry voice discovery.`;
                }
            };
            speech.select.addEventListener('change', () => void voices());
            if (speech.select.value) void voices();
        }
        this.row('transcribe', 'Microphone dictation', data.services.transcribe, extension_settings.dictation?.model, async model => {
            const { configureDictation } = await import('./dictation.js');
            configureDictation(`${data.base}/audio/transcriptions`, model);
        }).row.append(element('small', '', 'Dictation inserts text into your draft. It never sends the message. Microphone access needs HTTPS or localhost and browser permission.'));
        if (data.services.embeddings?.models?.length) this.results.append(element('p', '', `Embeddings available: ${data.services.embeddings.models.map(model => model.id).join(', ')}. Configure retrieval in its extension settings.`));
    }
}
