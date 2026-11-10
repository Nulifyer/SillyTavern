import { test, expect } from '@playwright/test';
import fs from 'node:fs';

test.use({ channel: 'chromium', video: 'off', viewport: { width: 1280, height: 800 } });
test.setTimeout(90000);

async function api(page, url, body) {
    return page.evaluate(async ({ url, body }) => {
        const script = await import('/script.js');
        const response = await fetch(url, { method: 'POST', headers: script.getRequestHeaders(), body: JSON.stringify(body) });
        if (!response.ok) throw new Error(`${url} returned ${response.status}`);
        const text = await response.text();
        try { return JSON.parse(text); } catch { return text; }
    }, { url, body });
}

test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(12000);
    page.nativeDiagnostics = { pageErrors: [], consoleErrors: [], failedRequests: [] };
    page.on('pageerror', error => page.nativeDiagnostics.pageErrors.push(error.stack || error.message));
    page.on('console', message => { if (message.type() === 'error') page.nativeDiagnostics.consoleErrors.push(message.text()); });
    page.on('requestfailed', request => page.nativeDiagnostics.failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
    await page.route('**/api/settings/get', async route => {
        const response = await route.fetch(); const body = await response.json(); const settings = JSON.parse(body.settings);
        settings.firstRun = false; settings.active_character = null; settings.active_group = null;
        settings.main_api = 'openai'; settings.power_user.auto_connect = false; settings.power_user.font_scale = 1;
        settings.accountStorage = { ...settings.accountStorage, workspaceLayout: 'true', workspaceAdvancedSettings: 'false', workspaceArchivedChats: '[]' };
        settings.extension_settings.tts = { ...settings.extension_settings.tts, enabled: false, currentProvider: 'System' };
        settings.extension_settings.translate = { ...settings.extension_settings.translate, auto_mode: 'none' };
        settings.extension_settings.caption = { ...settings.extension_settings.caption, auto_mode: false };
        settings.extension_settings.serviceConnections = { url: '' };
        body.settings = JSON.stringify(settings); await route.fulfill({ response, json: body });
    });
    await page.goto('/');
    await expect(page.locator('#preloader')).toHaveCount(0, { timeout: 30000 });
    await page.locator('#workspace-navigation [data-workspace-action="characters"]').click();
    await page.locator('.workspace-library-card[data-entity="character:default_Seraphina.png"]').click();
    await page.getByRole('button', { name: 'Start new story', exact: true }).click();
    await expect(page.locator('#send_textarea')).toBeVisible();
    await expect(page.locator('#workspace-new-story')).toHaveAttribute('aria-busy', 'false');
});

test.afterEach(async ({ page }, info) => {
    fs.writeFileSync(info.outputPath('diagnostics.json'), JSON.stringify(page.nativeDiagnostics, null, 2));
    await page.screenshot({ path: info.outputPath('final.png') });
    expect(page.nativeDiagnostics.pageErrors).toEqual([]);
});

test('native quiet response limits do not change saved settings', async ({ page }) => {
    const bodies = [];
    await page.route('**/api/backends/chat-completions/generate', async route => { bodies.push(route.request().postDataJSON()); await route.fulfill({ json: { choices: [{ message: { content: 'A neutral quiet reply.' } }] } }); });
    const result = await page.evaluate(async () => {
        const s = await import('/script.js'); const o = await import('/scripts/openai.js');
        Object.assign(o.oai_settings, { chat_completion_source: 'custom', custom_url: 'https://synthetic.invalid/v1', custom_model: 'audit-quiet-limit', openai_max_tokens: 500 });
        s.setOnlineStatus('synthetic');
        const text = await s.generateQuietPrompt({ quietPrompt: 'Describe a neutral lantern.', responseLength: 37, skipWIAN: true, removeReasoning: false });
        return { text, preference: o.oai_settings.openai_max_tokens };
    });
    expect(bodies).toHaveLength(1); expect(bodies[0].max_tokens).toBe(37);
    expect(result).toEqual({ text: 'A neutral quiet reply.', preference: 500 });
});

test('native model formatters keep quoted identifiers and subscription notes inside text attributes', async ({ page }) => {
    const result = await page.evaluate(async () => {
        const o = await import('/scripts/openai.js'); const t = await import('/scripts/textgen-models.js');
        const model = { id: 'vendor/model" data-audit-marker="injected', name: 'Fixture', context_length: 2048, tokens: 2048,
            pricing: { prompt: 0, completion: 0, input: 0, output: 0 }, subscription: { included: false, note: 'Note" data-audit-note="injected' } };
        o.model_list.push(model); t.openRouterModels.push(model);
        return ['model_openrouter_select', 'model_aimlapi_select', 'model_electronhub_select', 'model_chutes_select', 'model_nanogpt_select', 'openrouter_model'].map(id => {
            const formatter = window.$(`#${id}`).data('select2').options.get('templateResult');
            const rendered = formatter({ id: model.id, element: { value: model.id } });
            return { id, title: rendered.attr('title'), marker: rendered.attr('data-audit-marker') || null,
                noteInjected: rendered.find('[data-audit-note]').length, text: rendered.text() };
        });
    });
    expect(result).toHaveLength(6);
    for (const item of result) { expect(item.title).toBe('vendor/model" data-audit-marker="injected'); expect(item.marker).toBeNull(); expect(item.noteInjected).toBe(0); expect(item.text.length).toBeGreaterThan(0); }
});

test('local expression override never dispatches to the configured remote classifier', async ({ page }) => {
    let local = 0, remote = 0;
    await page.route('**/api/extra/classify', async route => { local++; await route.fulfill({ json: { classification: [{ label: 'joy' }] } }); });
    await page.route('**/api/backends/**/generate', async route => { remote++; await route.fulfill({ status: 503, json: { error: 'Unexpected remote dispatch' } }); });
    const result = await page.evaluate(async () => {
        const { extension_settings } = await import('/scripts/extensions.js'); Object.assign(extension_settings.expressions, { api: 2, translate: false });
        return (await (await import('/scripts/slash-commands.js')).executeSlashCommandsWithOptions('/classify api=local Synthetic neutral text')).pipe;
    });
    expect(result).toBe('joy'); expect(local).toBe(1); expect(remote).toBe(0);
});

test('a held classification keeps its JSON schema and sampler settings out of another raw reply', async ({ page }) => {
    const bodies = [];
    await page.route('**/api/backends/text-completions/generate', async route => {
        const body = route.request().postDataJSON(); bodies.push(body);
        await route.fulfill({ json: { choices: [{ text: body.json_schema ? '{"emotion":"joy"}' : 'A neutral ordinary reply.' }] } });
    });
    await page.evaluate(async () => {
        const s = await import('/script.js'); const t = await import('/scripts/textgen-settings.js');
        window.$('#main_api').val('textgenerationwebui').trigger('change');
        Object.assign(t.textgenerationwebui_settings, { type: 'llamacpp', top_k: 40, json_schema: {}, grammar_string: 'synthetic-original-grammar' });
        const { extension_settings } = await import('/scripts/extensions.js');
        Object.assign(extension_settings.expressions, { api: 2, promptType: 'raw', translate: false, fallback_expression: 'grief' });
        s.setOnlineStatus('synthetic');
        let held = false; const gate = new Promise(resolve => window.__releaseClassifier = resolve);
        const listener = async () => { if (!held) { held = true; window.__classifierEntered = true; await gate; } };
        s.eventSource.on(s.event_types.GENERATE_AFTER_COMBINE_PROMPTS, listener);
        window.__classifierCleanup = () => s.eventSource.removeListener(s.event_types.GENERATE_AFTER_COMBINE_PROMPTS, listener);
        window.__heldClassifier = (await import('/scripts/extensions/expressions/index.js')).getExpressionLabel('Synthetic classifier text', 2, { customPrompt: 'Return one emotion.' });
    });
    await expect.poll(() => page.evaluate(() => window.__classifierEntered)).toBe(true);
    const result = await page.evaluate(async () => {
        const s = await import('/script.js');
        try {
            const normal = await s.generateRawData({ api: 'textgenerationwebui', prompt: 'Synthetic ordinary reply' });
            window.__releaseClassifier(); const emotion = await window.__heldClassifier;
            const settings = (await import('/scripts/textgen-settings.js')).textgenerationwebui_settings;
            return { normal: normal.choices[0].text, emotion, preference: settings.top_k, schema: settings.json_schema, grammar: settings.grammar_string };
        } finally { window.__releaseClassifier(); window.__classifierCleanup(); }
    });
    expect(bodies).toHaveLength(2); expect(bodies[0].top_k).toBe(40); expect(bodies[0].json_schema).toBeUndefined();
    expect(bodies[1].top_k).toBe(1); expect(bodies[1].json_schema.properties.emotion.enum).toContain('joy');
    expect(bodies[1].grammar).toBeUndefined(); expect(bodies[1].grammar_string).toBeUndefined();
    expect(result).toEqual({ normal: 'A neutral ordinary reply.', emotion: 'joy', preference: 40, schema: {}, grammar: 'synthetic-original-grammar' });
});

test('extension prompt filters await false results and preserve sorted accepted prompts', async ({ page }) => {
    const result = await page.evaluate(async () => {
        const s = await import('/script.js');
        const keys = ['audit-filter-b', 'audit-filter-a', 'audit-filter-c'];
        try {
            s.setExtensionPrompt(keys[0], 'Visible B', 0, 0, false, 0, async () => true);
            s.setExtensionPrompt(keys[1], 'Filtered out', 0, 0, false, 0, async () => false);
            s.setExtensionPrompt(keys[2], 'Visible C', 0, 0, false, 0, () => true);
            return await s.getExtensionPrompt(0, 0, '|', 0, false);
        } finally { for (const key of keys) s.setExtensionPrompt(key, '', 0, 0); }
    });
    expect(result).toContain('Visible B|Visible C');
    expect(result).not.toContain('Filtered out');
});

test('Gemini keeps all visible and thought parts and excludes unsupported image models', async ({ page }) => {
    const result = await page.evaluate(async () => {
        const o = await import('/scripts/openai.js');
        const state = { reasoning: '', images: [] };
        const visible = o.getStreamingReply({ candidates: [{ content: { parts: [
            { text: 'Visible A' }, { thought: true, text: 'Reasoning A' },
            { text: 'Visible B' }, { thought: true, text: 'Reasoning B', thoughtSignature: 'synthetic' },
        ] } }] }, state, { chatCompletionSource: 'makersuite', overrideShowThoughts: true });
        Object.assign(o.oai_settings, { media_inlining: true, chat_completion_source: 'openai' });
        const models = ['o1-mini', 'o3-mini', 'gpt-4-turbo-preview', 'gpt-4o'];
        const supported = models.map(model => { o.oai_settings.openai_model = model; return o.isImageInliningSupported(); });
        return { visible, state, supported };
    });
    expect(result.visible).toBe('Visible AVisible B');
    expect(result.state.reasoning).toBe('Reasoning AReasoning B');
    expect(result.state.signature).toBe('synthetic');
    expect(result.supported).toEqual([false, false, false, true]);
});

test('overlapping native raw requests keep their response limits and preserve a newer saved preference', async ({ page }) => {
    const bodies = [];
    await page.route('**/api/backends/chat-completions/generate', async route => {
        bodies.push(route.request().postDataJSON());
        await route.fulfill({ json: { choices: [{ message: { content: 'A neutral fixture reply.' } }] } });
    });
    await page.evaluate(async () => {
        const s = await import('/script.js'); const o = await import('/scripts/openai.js');
        Object.assign(o.oai_settings, { chat_completion_source: 'custom', custom_url: 'https://synthetic.invalid/v1', custom_model: 'audit-limits', openai_max_tokens: 500 });
        let held = false;
        const gate = new Promise(resolve => window.__releaseRawLimit = resolve);
        const listener = async () => { if (!held) { held = true; window.__rawLimitEntered = true; await gate; } };
        s.eventSource.on(s.event_types.CHAT_COMPLETION_PROMPT_READY, listener);
        window.__rawLimitA = s.generateRawData({ api: 'openai', prompt: [{ role: 'user', content: 'Synthetic A' }], responseLength: 11 });
        window.__rawLimitCleanup = () => s.eventSource.removeListener(s.event_types.CHAT_COMPLETION_PROMPT_READY, listener);
    });
    await expect.poll(() => page.evaluate(() => window.__rawLimitEntered)).toBe(true);
    const result = await page.evaluate(async () => {
        const s = await import('/script.js'); const o = await import('/scripts/openai.js');
        try {
            await s.generateRawData({ api: 'openai', prompt: [{ role: 'user', content: 'Synthetic B' }], responseLength: 22 });
            o.oai_settings.openai_max_tokens = 333;
            window.__releaseRawLimit(); await window.__rawLimitA;
            const saved = await s.saveSettings();
            return { saved, preference: o.oai_settings.openai_max_tokens };
        } finally { window.__releaseRawLimit(); window.__rawLimitCleanup(); }
    });
    expect(bodies.map(body => body.max_tokens)).toEqual([22, 11]);
    expect(result).toEqual({ saved: true, preference: 333 });
});

test('YouTube uses the entered language and web HTTP failures produce no attachment', async ({ page }) => {
    let transcript;
    await page.route('**/api/search/transcript', async route => { transcript = route.request().postDataJSON(); await route.fulfill({ body: 'A neutral synthetic transcript.' }); });
    await page.evaluate(() => { import('/scripts/scrapers.js').then(({ ScraperManager }) => { window.__scraped = ScraperManager.runDataBankScraper('youtube').then(async files => files.map(async file => ({ text: await file.text(), name: file.name }))).then(files => Promise.all(files)); }); });
    const dialog = page.locator('dialog[open]');
    await dialog.getByLabel('Language code', { exact: false }).fill('fr');
    await dialog.locator('.popup-input').fill('dQw4w9WgXcQ');
    await dialog.locator('.popup-button-ok').click();
    const files = await page.evaluate(() => window.__scraped);
    expect(transcript).toEqual({ id: 'dQw4w9WgXcQ', lang: 'fr' });
    expect(files[0].text).toBe('A neutral synthetic transcript.');
    await page.route('**/api/search/visit', route => route.fulfill({ status: 503, contentType: 'text/html', body: '<html><title>Unavailable</title>Synthetic failure</html>' }));
    await page.evaluate(() => { import('/scripts/scrapers.js').then(({ ScraperManager }) => { window.__webScrape = ScraperManager.runDataBankScraper('web').then(() => ({ filesCreated: true }), error => ({ filesCreated: false, message: error.message })); }); });
    await dialog.locator('.popup-input').fill('https://controlled.invalid/neutral');
    await dialog.locator('.popup-button-ok').click();
    expect(await page.evaluate(() => window.__webScrape)).toEqual({ filesCreated: false, message: 'The webpage could not be downloaded (503). No attachment was created.' });
    await expect(page.locator('.toast-message').filter({ hasText: 'Working, please wait...' })).toHaveCount(0);
});

test('password labels resolve to their native input controls', async ({ page }) => {
    await page.evaluate(async () => {
        const { Popup, POPUP_TYPE } = await import('/scripts/popup.js'); const { renderTemplateAsync } = await import('/scripts/templates.js');
        void new Popup(await renderTemplateAsync('changePassword'), POPUP_TYPE.DISPLAY).show();
    });
    const dialog = page.locator('dialog[open]');
    await expect(dialog.getByLabel('Current Password:', { exact: true })).toHaveAttribute('name', 'current');
    await expect(dialog.getByLabel('New Password:', { exact: true })).toHaveAttribute('name', 'password');
    await expect(dialog.getByLabel('Confirm New Password:', { exact: true })).toHaveAttribute('name', 'confirm');
    await page.keyboard.press('Escape');
});

test('macro rows activate from the keyboard and minimized streaming content leaves the focus order', async ({ page }, info) => {
    await page.evaluate(async () => {
        const background = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><path fill="white" d="M0 0h32v32H0z"/></svg>');
        const image = new Image(); image.src = background; await image.decode();
        document.getElementById('bg1').style.backgroundImage = `url("${background}")`;
        const { MacroBrowser } = await import('/scripts/macros/engine/MacroBrowser.js'); const { Popup, POPUP_TYPE } = await import('/scripts/popup.js');
        const content = document.createElement('div'); new MacroBrowser().renderInto(content);
        void new Popup(content, POPUP_TYPE.DISPLAY, '', { wide: true, large: true }).show();
    });
    const row = page.locator('dialog[open] .macro-item').first();
    await expect(row).toHaveJSProperty('tagName', 'BUTTON'); await row.focus(); await page.keyboard.press('Enter');
    await expect(row).toHaveClass(/selected/);
    await expect(page.locator('dialog[open] .macro-details-panel')).not.toContainText('Select a macro');
    await page.locator('dialog[open]').evaluate(async node => { await Promise.all(node.getAnimations({ subtree: true }).filter(animation => animation.effect?.getTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {}))); });
    const signature = row.locator('.macro-signature');
    const palette = await signature.evaluate(node => {
        let opacity = 1; for (let parent = node; parent; parent = parent.parentElement) opacity *= Number(getComputedStyle(parent).opacity);
        return { color: getComputedStyle(node).color, opacity, visibility: node.style.visibility };
    });
    const clip = await signature.boundingBox(); await signature.evaluate(node => node.style.visibility = 'hidden');
    const painted = await page.screenshot({ clip });
    await signature.evaluate((node, visibility) => node.style.visibility = visibility, palette.visibility);
    const contrast = await page.evaluate(async ({ bytes, color, opacity }) => {
        const bitmap = await createImageBitmap(new Blob([Uint8Array.from(bytes)], { type: 'image/png' }));
        const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
        const context = canvas.getContext('2d'); context.drawImage(bitmap, 0, 0);
        const background = [...context.getImageData(Math.floor(bitmap.width / 2), Math.floor(bitmap.height / 2), 1, 1).data].slice(0, 3); bitmap.close();
        const foreground = color.match(/[\d.]+/g).map(Number); const alpha = opacity * (foreground[3] ?? 1);
        const rendered = foreground.slice(0, 3).map((value, index) => value * alpha + background[index] * (1 - alpha));
        const luminance = rgb => rgb.map(value => value / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
        const values = [luminance(rendered), luminance(background)].sort((a, b) => b - a);
        return { color, opacity, background, rendered, ratio: (values[0] + 0.05) / (values[1] + 0.05) };
    }, { bytes: [...painted], color: palette.color, opacity: palette.opacity });
    fs.writeFileSync(info.outputPath('macro-painted-contrast.json'), JSON.stringify(contrast, null, 2));
    expect(contrast.ratio).toBeGreaterThanOrEqual(4.5);
    await page.keyboard.press('Control+f'); await expect(page.locator('.macro-search-input')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    await page.evaluate(async () => {
        const { StreamingDisplay } = await import('/scripts/streaming-display.js');
        window.__auditDisplay = new StreamingDisplay().show({ label: 'Synthetic streaming display' }).updateContent('[Neutral link](https://controlled.invalid)');
    });
    const link = page.locator('.streaming-display-content a'); await link.focus(); await expect(link).toBeFocused();
    await page.evaluate(() => window.__auditDisplay.toggleMinimize());
    await expect(page.locator('.streaming-display-content')).toHaveAttribute('inert', '');
    await expect(page.locator('.streaming-display-btn-minimize')).toBeFocused();
    await link.evaluate(node => node.focus()); await expect(link).not.toBeFocused();
    await page.evaluate(() => window.__auditDisplay.toggleMinimize());
    await link.focus(); await expect(link).toBeFocused();
    await page.evaluate(() => window.__auditDisplay.hide({ instant: true }));
});

async function speechSettings(page) {
    await page.locator('#workspace-settings-link').click();
    await page.locator('.workspace-settings-rail [data-workspace-action="voice-settings"]').click();
}

test('AllTalk false narrator settings remain false and enabling narration does not reverse its checkboxes', async ({ page }) => {
    await page.route('http://127.0.0.1:9913/**', async route => {
        const path = new URL(route.request().url()).pathname;
        if (path === '/api/ready') return route.fulfill({ body: 'Ready' });
        if (path === '/api/voices') return route.fulfill({ json: { voices: ['Neutral.wav'] } });
        if (path === '/api/rvcvoices') return route.fulfill({ json: { rvcvoices: ['Disabled'] } });
        return route.fulfill({ json: { models_available: [{ name: 'Synthetic' }], engines_available: [], current_model_loaded: 'Synthetic', deepspeed_capable: false, lowvram_capable: false } });
    });
    await page.evaluate(async () => {
        const { extension_settings } = await import('/scripts/extensions.js');
        Object.assign(extension_settings.tts, { pass_asterisks: false, narrate_quoted_only: false, narrate_dialogues_only: false });
        extension_settings.tts.AllTalk = { provider_endpoint: 'http://127.0.0.1:9913', narrator_enabled: 'false', narrator_voice_gen: 'Neutral.wav', voiceMap: {} };
    });
    await speechSettings(page); await page.locator('#tts_provider').selectOption('AllTalk');
    await expect(page.locator('#tts_status')).toContainText('Provider settings loaded');
    const state = () => page.evaluate(async () => {
        const t = (await import('/scripts/extensions.js')).extension_settings.tts;
        return { pass: t.pass_asterisks, quoted: t.narrate_quoted_only, dialogues: t.narrate_dialogues_only };
    });
    await expect(page.locator('#at_narrator_enabled')).toHaveValue('false');
    await expect(page.locator('#narrator_voice')).toBeDisabled();
    expect(await state()).toEqual({ pass: true, quoted: false, dialogues: false });
    await page.locator('#at_narrator_enabled').selectOption('true');
    await expect(page.locator('#narrator_voice')).toBeEnabled();
    expect(await state()).toEqual({ pass: false, quoted: true, dialogues: true });
    await expect(page.locator('#tts_pass_asterisks')).not.toBeChecked();
    await expect(page.locator('#tts_narrate_quoted')).toBeChecked();
    await expect(page.locator('#tts_narrate_dialogues')).toBeChecked();
});

test('GPT-SoVITS adapter loads and saves the endpoint through its actual native field', async ({ page }) => {
    await page.route('http://127.0.0.1:9911/**', route => route.fulfill({ json: [] }));
    await page.evaluate(async () => {
        const { extension_settings } = await import('/scripts/extensions.js');
        extension_settings.tts['GPT-SoVITS-Adapter'] = { provider_endpoint: 'http://127.0.0.1:9911', voiceMap: {} };
    });
    await speechSettings(page); await page.locator('#tts_provider').selectOption('GPT-SoVITS-Adapter');
    const input = page.locator('#gpt_sovits_adapter_tts_endpoint');
    await expect(input).toHaveValue('http://127.0.0.1:9911');
    await input.fill('http://127.0.0.1:9912'); await input.press('Tab');
    expect(await page.evaluate(async () => (await import('/scripts/extensions.js')).extension_settings.tts['GPT-SoVITS-Adapter'].provider_endpoint)).toBe('http://127.0.0.1:9912');
});

test('deleting the last SpeechT5 speaker clears the persisted native selection', async ({ page }) => {
    await page.evaluate(async () => {
        const { extension_settings } = await import('/scripts/extensions.js');
        extension_settings.tts.SpeechT5 = { speakers: [{ voice_id: 'synthetic.bin', name: 'Synthetic voice', data: '', lang: 'en-US' }], speaker: 'synthetic.bin', voiceMap: {} };
    });
    await speechSettings(page); await page.locator('#tts_provider').selectOption('SpeechT5');
    await expect(page.locator('#speecht5_tts_speaker')).toHaveValue('synthetic.bin');
    const savedState = () => page.evaluate(async () => {
        const s = await import('/script.js');
        const response = await fetch('/api/settings/get', { method: 'POST', headers: s.getRequestHeaders(), body: '{}' });
        const data = await response.json(); return JSON.parse(data.settings).extension_settings.tts.SpeechT5;
    });
    await expect.poll(async () => (await savedState())?.speaker).toBe('synthetic.bin');
    page.once('dialog', dialog => dialog.accept());
    await page.locator('#speecht5_tts_delete_speaker_button').click();
    await expect(page.locator('#speecht5_tts_speaker option')).toHaveCount(0);
    await expect.poll(async () => (await savedState()).speaker).toBe('');
    const state = await savedState();
    expect(state.speaker).toBe(''); expect(state.speakers).toEqual([]);
});

test('Novel custom voice supports keyboard add and Cancel leaves no invalid voice', async ({ page }) => {
    await page.evaluate(async () => { (await import('/scripts/extensions.js')).extension_settings.tts.Novel = { customVoices: [], voiceMap: {} }; });
    await speechSettings(page); await page.locator('#tts_provider').selectOption('Novel');
    const add = page.getByRole('button', { name: 'Add custom voice', exact: true });
    await add.focus(); await page.keyboard.press('Enter');
    await expect(page.locator('dialog[open]')).toBeVisible();
    await page.keyboard.press('Escape'); await expect(page.locator('dialog[open]')).toHaveCount(0);
    expect(await page.evaluate(async () => (await import('/scripts/extensions.js')).extension_settings.tts.Novel.customVoices)).toEqual([]);
    await add.click(); await page.locator('dialog[open] .popup-input').fill('Neutral custom voice');
    await page.locator('dialog[open] .popup-button-ok').focus(); await page.keyboard.press('Enter');
    await expect(page.getByLabel('Custom voice', { exact: true }).locator('option')).toHaveCount(1);
    expect(await page.evaluate(async () => (await import('/scripts/extensions.js')).extension_settings.tts.Novel.customVoices)).toEqual(['Neutral custom voice']);
});

test('reasoning Copy, Edit and Confirm and code Copy all activate through the keyboard', async ({ page }) => {
    await page.evaluate(async () => {
        const s = await import('/script.js');
        window.__nativeCopies = [];
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => window.__nativeCopies.push(text) } });
        const message = { name: s.name2, mes: 'A neutral code example.\n\n```js\nconst lantern = true;\n```', is_user: false, is_system: false,
            extra: { reasoning: 'Original neutral reasoning.', reasoning_duration: 1 }, send_date: new Date().toISOString() };
        s.chat.push(message); s.addOneMessage(message);
    });
    const message = page.locator('#chat .mes').last();
    const details = message.locator('.mes_reasoning_details');
    if (!await details.evaluate(node => node.open)) { await details.locator('summary').focus(); await page.keyboard.press('Enter'); }
    await expect(details).toHaveAttribute('open', '');
    const copy = message.getByRole('button', { name: 'Copy reasoning', exact: true });
    await copy.focus(); await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => window.__nativeCopies)).toContain('Original neutral reasoning.');
    await message.getByRole('button', { name: 'Edit reasoning', exact: true }).focus(); await page.keyboard.press('Enter');
    await message.locator('.reasoning_edit_textarea').fill('Edited neutral reasoning.');
    await message.getByRole('button', { name: 'Confirm', exact: true }).focus(); await page.keyboard.press('Enter');
    await expect(message.locator('.reasoning_edit_textarea')).toHaveCount(0);
    expect(await page.evaluate(async () => (await import('/script.js')).chat.at(-1).extra.reasoning)).toBe('Edited neutral reasoning.');
    const codeCopy = message.getByRole('button', { name: 'Copy code', exact: true });
    await codeCopy.focus(); await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => window.__nativeCopies)).toContain('const lantern = true;\n');
});

for (const change of ['same-story reload', 'reasoning revision']) {
    test(`a reasoning delete confirmation cannot clear a newer ${change}`, async ({ page }) => {
        await page.evaluate(async () => {
            const s = await import('/script.js');
            const message = { name: s.name2, mes: 'A neutral reply.', is_user: false, is_system: false,
                extra: { reasoning: 'Original reasoning.', reasoning_duration: 1 }, send_date: new Date().toISOString() };
            s.chat.push(message); s.addOneMessage(message); await s.saveChatConditional();
            window.__reasoningDeletes = 0; s.eventSource.on(s.event_types.MESSAGE_REASONING_DELETED, () => window.__reasoningDeletes++);
        });
        const message = page.locator('#chat .mes').last();
        await message.locator('.mes_reasoning_summary').focus(); await page.keyboard.press('Enter');
        await message.getByRole('button', { name: 'Edit reasoning', exact: true }).click();
        await message.getByRole('button', { name: 'Remove reasoning', exact: true }).click();
        await expect(page.locator('dialog[open]')).toContainText('Remove Reasoning');
        await page.evaluate(async change => {
            const s = await import('/script.js');
            if (change === 'same-story reload') await s.reloadCurrentChat();
            s.chat.at(-1).extra.reasoning = 'New canonical reasoning.'; s.updateMessageBlock(s.chat.length - 1, s.chat.at(-1));
        }, change);
        await page.locator('dialog[open] .popup-button-ok').click();
        await expect(page.locator('dialog[open]')).toHaveCount(0);
        expect(await page.evaluate(async () => (await import('/script.js')).chat.at(-1).extra.reasoning)).toBe('New canonical reasoning.');
        expect(await page.evaluate(() => window.__reasoningDeletes)).toBe(0);
    });
}

test('Quick Impersonate restores independently when Quick Continue is off', async ({ page }) => {
    await page.route('**/api/settings/get', async route => {
        const response = await route.fetch(); const body = await response.json(); const settings = JSON.parse(body.settings);
        settings.firstRun = false; settings.active_character = null; settings.active_group = null;
        Object.assign(settings.power_user, { auto_connect: false, quick_continue: false, quick_impersonate: true });
        settings.accountStorage = { ...settings.accountStorage, workspaceLayout: 'true' };
        settings.extension_settings.tts = { ...settings.extension_settings.tts, enabled: false, currentProvider: 'System' };
        body.settings = JSON.stringify(settings); await route.fulfill({ response, json: body });
    });
    await page.reload(); await expect(page.locator('#preloader')).toHaveCount(0, { timeout: 30000 });
    await expect(page.locator('#quick_continue')).not.toBeChecked(); await expect(page.locator('#quick_impersonate')).toBeChecked();
    expect(await page.evaluate(async () => {
        const p = (await import('/scripts/power-user.js')).power_user;
        return { continue: p.quick_continue, impersonate: p.quick_impersonate };
    })).toEqual({ continue: false, impersonate: true });
});

test('a failed theme import can retry the same file and only selecting it applies Zen controls', async ({ page }) => {
    await page.locator('#workspace-settings-link').click();
    await page.locator('.workspace-settings-rail [data-workspace-action="settings"]').click();
    await page.locator('#workspace-advanced-settings').check();
    const current = await page.locator('#themes').inputValue();
    const theme = await page.evaluate(async () => {
        const p = await import('/scripts/power-user.js');
        return { ...p.getThemeObject(`Synthetic theme ${Date.now()}`), enableZenSliders: true, enableLabMode: false };
    });
    let writes = 0;
    await page.route('**/api/themes/save', route => ++writes === 1 ? route.fulfill({ status: 503, json: { error: 'Synthetic unavailable storage' } }) : route.fulfill({ json: {} }));
    const file = { name: 'synthetic-theme.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(theme)) };
    for (const attempt of [1, 2]) {
        const chooser = page.waitForEvent('filechooser'); await page.locator('#ui_preset_import_button').click(); await (await chooser).setFiles(file);
        await expect.poll(() => writes).toBe(attempt);
        await expect(page.locator('#ui_preset_import_file')).toHaveValue('');
        await expect(page.locator('#themes option').filter({ hasText: theme.name })).toHaveCount(attempt === 1 ? 0 : 1);
        await expect(page.locator('#themes')).toHaveValue(current);
    }
    await page.locator('#themes').selectOption(theme.name);
    await expect(page.locator('#enableZenSliders')).toBeChecked();
    await expect(page.locator('body')).toHaveClass(/enableZenSliders/);
});

test('structured variable lists honor their selected scope and system messages keep independent metadata', async ({ page }) => {
    const result = await page.evaluate(async () => {
        const s = await import('/script.js'); const { extension_settings } = await import('/scripts/extensions.js');
        s.chat_metadata.variables = { syntheticLocal: 'local value' }; extension_settings.variables.global = { syntheticGlobal: 'global value' };
        const { executeSlashCommandsWithOptions } = await import('/scripts/slash-commands.js');
        const local = (await executeSlashCommandsWithOptions('/listvar scope=local return=object')).pipe;
        const global = (await executeSlashCommandsWithOptions('/listvar scope=global return=object')).pipe;
        const messages = await import('/scripts/system-messages.js');
        const first = messages.getSystemMessageByType('generic', 'Synthetic one', { auditMarker: 'first-only' });
        const second = messages.getSystemMessageByType('generic', 'Synthetic two');
        return { local, global, first: first.extra.auditMarker, second: second.extra.auditMarker || null, template: messages.system_messages.generic.extra.auditMarker || null };
    });
    expect(JSON.parse(result.local)).toEqual([{ key: 'syntheticLocal', value: 'local value', scope: 'local' }]);
    expect(JSON.parse(result.global)).toEqual([{ key: 'syntheticGlobal', value: 'global value', scope: 'global' }]);
    expect(result.first).toBe('first-only'); expect(result.second).toBeNull(); expect(result.template).toBeNull();
});

for (const change of ['same-story reload', 'manual summary edit']) {
    test(`a held summary preserves the newer ${change}`, async ({ page }) => {
        await page.evaluate(async () => {
            const s = await import('/script.js'); const o = await import('/scripts/openai.js');
            Object.assign(o.oai_settings, { chat_completion_source: 'custom', custom_url: 'https://synthetic.invalid/v1', custom_model: 'audit-memory' });
            Object.assign((await import('/scripts/extensions.js')).extension_settings.memory, { source: 'main', prompt_builder: 0, prompt: 'Summarize the neutral lantern.', overrideResponseLength: 32 });
            s.setOnlineStatus('synthetic');
            s.chat.push({ name: s.name1, mes: 'A neutral user turn.', is_user: true, is_system: false, extra: {}, send_date: new Date().toISOString() });
            s.addOneMessage(s.chat.at(-1));
            s.chat.push({ name: s.name2, mes: 'A neutral reply.', is_user: false, is_system: false, extra: {}, send_date: new Date().toISOString() });
            s.addOneMessage(s.chat.at(-1)); await s.saveChatConditional();
        });
        let release, began;
        const gate = new Promise(resolve => release = resolve), requested = new Promise(resolve => began = resolve);
        await page.route('**/api/backends/chat-completions/generate', async route => { began(); await gate; await route.fulfill({ json: { choices: [{ message: { content: 'Old delayed summary.' } }] } }); });
        await page.evaluate(() => { window.__heldSummary = import('/scripts/slash-commands.js').then(s => s.executeSlashCommandsWithOptions('/summarize quiet=true')); });
        await requested;
        try {
            if (change === 'same-story reload') await page.evaluate(async () => (await import('/script.js')).reloadCurrentChat());
            else await page.locator('#memory_contents').evaluate(input => { input.value = 'Newer manually edited summary.'; input.dispatchEvent(new Event('input', { bubbles: true })); });
            release(); await page.evaluate(() => window.__heldSummary);
            const state = await page.evaluate(async () => ({ memory: (await import('/script.js')).chat.map(message => message.extra?.memory || ''), input: document.querySelector('#memory_contents').value }));
            expect(state.memory).not.toContain('Old delayed summary.'); expect(state.input).not.toBe('Old delayed summary.');
            if (change === 'manual summary edit') { expect(state.memory).toContain('Newer manually edited summary.'); expect(state.input).toBe('Newer manually edited summary.'); }
        } finally { release(); }
    });
}

test('an empty Ollama selection permits token inspection while generation still requires a model', async ({ page }) => {
    await page.locator('#workspace-settings-link').click();
    await page.locator('.workspace-settings-rail [data-workspace-action="connection"]').click();
    await page.locator('#main_api').selectOption('textgenerationwebui');
    await page.locator('#textgen_type').selectOption('ollama');
    const result = await page.evaluate(async () => {
        const textgen = await import('/scripts/textgen-settings.js');
        const tokenizers = await import('/scripts/tokenizers.js');
        const { RA_CountCharTokens } = await import('/scripts/RossAscends-mods.js');
        textgen.textgenerationwebui_settings.ollama_model = '';
        const tokenizer = tokenizers.getTokenizerBestMatch('textgenerationwebui');
        await RA_CountCharTokens();
        let generationError;
        try { await textgen.getTextGenGenerationData('A synthetic prompt.', 16, false, false, null, 'normal'); }
        catch (error) { generationError = error.message; }
        return { model: textgen.getTextGenModel(), tokenizer, generationError };
    });
    expect(result.model).toBe('');
    expect(Number.isFinite(result.tokenizer)).toBe(true);
    expect(result.generationError).toBe('No Ollama model selected');
});

test('a delayed lorebook read cannot replace the newer selection or its save and delete actions', async ({ page }, info) => {
    const suffix = Date.now().toString(36);
    const names = [`Native ownership A ${suffix}`, `Native ownership B ${suffix}`];
    const data = label => ({ entries: { 0: { uid: 0, key: ['lantern'], keysecondary: [], comment: label, content: `${label} content.`, constant: false, disable: false, order: 100, position: 0 } } });
    for (const name of names) await api(page, '/api/worldinfo/edit', { name, data: data(name) });
    await page.evaluate(async () => {
        const world = await import('/scripts/world-info.js'); await world.updateWorldInfoList(); world.worldInfoCache.clear();
    });
    await page.locator('#workspace-settings-link').click();
    await page.locator('.workspace-settings-rail [data-workspace-action="world"]').click();
    let release, began;
    const held = new Promise(resolve => release = resolve), requested = new Promise(resolve => began = resolve);
    await page.route('**/api/worldinfo/get', async route => {
        if (route.request().postDataJSON().name === names[0]) { began(); await held; }
        await route.continue();
    });
    try {
        await page.locator('#world_editor_select').selectOption({ label: names[0] }); await requested;
        await expect(page.locator('#world_popup_entries_list')).toHaveAttribute('aria-busy', 'true');
        await expect(page.locator('#world_popup_delete')).toHaveAttribute('inert', '');
        await page.locator('#world_editor_select').selectOption({ label: names[1] });
        const list = page.locator('#world_popup_entries_list');
        await expect(list.locator('textarea[name="comment"]').first()).toHaveValue(names[1]);
        release();
        await expect(page.locator('#world_editor_select option:checked')).toHaveText(names[1]);
        await expect(list.locator('textarea[name="comment"]').first()).toHaveValue(names[1]);
        await page.locator('#world_popup_new').click();
        await expect(list.locator('.world_entry')).toHaveCount(2);
        await expect.poll(async () => Object.keys((await api(page, '/api/worldinfo/get', { name: names[1] })).entries).length).toBe(2);
        expect(Object.keys((await api(page, '/api/worldinfo/get', { name: names[0] })).entries)).toHaveLength(1);
        await page.locator('#world_popup_delete').click();
        await expect(page.locator('dialog[open]')).toContainText(names[1]);
        await page.keyboard.press('Escape');
        await page.screenshot({ path: info.outputPath('late-lorebook-preserved.png') });
    } finally {
        release(); await page.unroute('**/api/worldinfo/get');
        for (const name of names) await api(page, '/api/worldinfo/delete', { name });
    }
});

test('popup completion runs one asynchronous closing hook and cleanup despite repeated activation', async ({ page }) => {
    await page.evaluate(async () => {
        const { Popup, POPUP_TYPE } = await import('/scripts/popup.js');
        window.__closingCalls = 0; window.__closedCalls = 0;
        const held = new Promise(resolve => window.__releaseClosing = resolve);
        window.__nativePopup = new Popup('A neutral held save.', POPUP_TYPE.CONFIRM, '', {
            onClosing: async () => { window.__closingCalls++; await held; return true; },
            onClose: () => { window.__closedCalls++; },
        });
        window.__nativePopupResult = window.__nativePopup.show();
    });
    await page.locator('dialog[open] .popup-button-ok').dblclick();
    expect(await page.evaluate(() => window.__closingCalls)).toBe(1);
    await expect(page.locator('dialog[open]')).toHaveAttribute('aria-busy', 'true');
    await page.evaluate(() => window.__releaseClosing());
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    expect(await page.evaluate(() => ({ closing: window.__closingCalls, closed: window.__closedCalls }))).toEqual({ closing: 1, closed: 1 });
});

test('cancelling a force-close prompt preserves the original cleanup and closing the parent cancels confirmation', async ({ page }) => {
    await page.evaluate(async () => {
        const { Popup, POPUP_TYPE } = await import('/scripts/popup.js');
        window.__closedCalls = 0;
        window.__nativePopup = new Popup('A neutral blocking popup.', POPUP_TYPE.DISPLAY, '', { allowEscapeClose: false, onClose: () => { window.__closedCalls++; } });
        window.__nativePopupResult = window.__nativePopup.show();
    });
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
    await expect(page.locator('dialog[open]')).toHaveCount(2);
    const confirmation = page.locator('dialog[open]').last();
    await confirmation.locator('.popup-button-cancel').click();
    await expect(page.locator('dialog[open]')).toHaveCount(1);
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
    await expect(page.locator('dialog[open]')).toHaveCount(2);
    await page.evaluate(() => { void window.__nativePopup.completeCancelled(); });
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    expect(await page.evaluate(() => window.__closedCalls)).toBe(1);
});

test('a gallery folder response belongs to its original character and mounted gallery', async ({ page }, info) => {
    const avatar = await page.evaluate(async () => (await import('/script.js')).characters[0].avatar);
    const duplicate = await api(page, '/api/characters/duplicate', { avatar_url: avatar });
    await page.evaluate(async () => { await (await import('/script.js')).getCharacters(); });
    let release, began;
    const held = new Promise(resolve => release = resolve), requested = new Promise(resolve => began = resolve);
    try {
        await page.locator('.workspace-creative-menu summary').click();
        await page.locator('#extensionsMenuButton').click();
        await page.locator('#show_gallery_wand_button').click();
        await expect(page.locator('#gallery')).toBeVisible();
        const before = await page.evaluate(() => structuredClone(SillyTavern.getContext().extensionSettings.gallery.folders));
        await page.route('**/api/files/sanitize-filename', async route => { began(); await held; await route.continue(); });
        await page.locator('#gallery .gallery-folder-input').fill('A delayed gallery folder');
        await page.locator('#gallery .gallery-folder-input').press('Enter');
        await requested;
        await page.evaluate(async path => {
            const script = await import('/script.js'); const id = script.characters.findIndex(character => character.avatar === path);
            await script.selectCharacterById(id);
        }, duplicate.path);
        release();
        await expect.poll(() => page.evaluate(() => SillyTavern.getContext().extensionSettings.gallery.folders)).toEqual(before);
        fs.writeFileSync(info.outputPath('gallery-owners.json'), JSON.stringify({ before, after: await page.evaluate(() => SillyTavern.getContext().extensionSettings.gallery.folders) }, null, 2));
    } finally { release(); await page.unroute('**/api/files/sanitize-filename'); }
});

test('force closing a blocking popup runs its cleanup exactly once', async ({ page }) => {
    await page.evaluate(async () => {
        const { Popup, POPUP_TYPE } = await import('/scripts/popup.js');
        window.__closedCalls = 0;
        window.__nativePopup = new Popup('A neutral blocking popup.', POPUP_TYPE.DISPLAY, '', { allowEscapeClose: false, onClose: () => { window.__closedCalls++; } });
        window.__nativePopupResult = window.__nativePopup.show();
    });
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
    await expect(page.locator('dialog[open]')).toHaveCount(2);
    await page.locator('dialog[open]').last().locator('.popup-button-ok').click();
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    expect(await page.evaluate(() => window.__closedCalls)).toBe(1);
});

test('a prevented popup close releases its completion lifetime for a later successful attempt', async ({ page }) => {
    await page.evaluate(async () => {
        const { Popup, POPUP_TYPE } = await import('/scripts/popup.js');
        window.__allowClosing = false; window.__closingCalls = 0; window.__closedCalls = 0;
        window.__nativePopup = new Popup('A neutral validation guard.', POPUP_TYPE.CONFIRM, '', {
            onClosing: () => { window.__closingCalls++; return window.__allowClosing; },
            onClose: () => { window.__closedCalls++; },
        });
        window.__nativePopupResult = window.__nativePopup.show();
    });
    await page.locator('dialog[open] .popup-button-ok').click();
    await expect(page.locator('dialog[open]')).toHaveCount(1);
    await expect(page.locator('dialog[open]')).not.toHaveAttribute('aria-busy', 'true');
    await page.evaluate(() => { window.__allowClosing = true; });
    await page.locator('dialog[open] .popup-button-ok').click();
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    expect(await page.evaluate(() => ({ closing: window.__closingCalls, closed: window.__closedCalls }))).toEqual({ closing: 2, closed: 1 });
});

test('lorebook autosaves retain failures for retry and do not cancel another book when selection changes', async ({ page }) => {
    const suffix = Date.now().toString(36);
    const names = [`Native save A ${suffix}`, `Native save B ${suffix}`];
    const data = name => ({ entries: { 0: { uid: 0, key: ['lantern'], keysecondary: [], comment: name, content: 'A neutral lore entry.', constant: false, disable: false, order: 100, position: 0 } } });
    for (const name of names) await api(page, '/api/worldinfo/edit', { name, data: data(name) });
    await page.evaluate(async () => { const world = await import('/scripts/world-info.js'); await world.updateWorldInfoList(); world.worldInfoCache.clear(); });
    await page.locator('#workspace-settings-link').click();
    await page.locator('.workspace-settings-rail [data-workspace-action="world"]').click();
    const comment = page.locator('#world_popup_entries_list textarea[name="comment"]').first();
    try {
        await page.locator('#world_editor_select').selectOption({ label: names[0] });
        await expect(comment).toHaveValue(names[0]);
        await comment.fill('Book A independently saved');
        await page.locator('#world_editor_select').selectOption({ label: names[1] });
        await expect(comment).toHaveValue(names[1]);
        await comment.fill('Book B independently saved');
        for (let index = 0; index < names.length; index++) await expect.poll(async () => (await api(page, '/api/worldinfo/get', { name: names[index] })).entries[0].comment).toBe(`Book ${index ? 'B' : 'A'} independently saved`);
        await page.route('**/api/worldinfo/edit', route => route.fulfill({ status: 503, json: { error: 'Synthetic unavailable lore storage' } }));
        await comment.fill('Book B retained unsaved edit');
        await expect(page.locator('#world_info_save_status')).toContainText('Not saved');
        expect((await api(page, '/api/worldinfo/get', { name: names[1] })).entries[0].comment).toBe('Book B independently saved');
        await expect(comment).toHaveValue('Book B retained unsaved edit');
        await page.unroute('**/api/worldinfo/edit');
        await page.getByRole('button', { name: 'Retry save', exact: true }).click();
        await expect(page.locator('#world_info_save_status')).toContainText('Saved');
        expect((await api(page, '/api/worldinfo/get', { name: names[1] })).entries[0].comment).toBe('Book B retained unsaved edit');
    } finally {
        await page.unroute('**/api/worldinfo/edit');
        for (const name of names) await api(page, '/api/worldinfo/delete', { name });
    }
});

test('a failed lorebook deletion preserves the editor and character links before a successful retry', async ({ page }) => {
    const name = `Native delete ${Date.now().toString(36)}`;
    await api(page, '/api/worldinfo/edit', { name, data: { entries: {} } });
    await page.evaluate(async name => {
        const world = await import('/scripts/world-info.js');
        world.world_info.charLore ||= [];
        world.world_info.charLore.push({ name: 'native-fixture-only', extraBooks: [name] });
        await world.updateWorldInfoList(); world.worldInfoCache.clear();
    }, name);
    await page.locator('#workspace-settings-link').click();
    await page.locator('.workspace-settings-rail [data-workspace-action="world"]').click();
    await page.locator('#world_editor_select').selectOption({ label: name });
    await expect(page.locator('#world_popup_delete')).not.toHaveAttribute('inert', '');
    await page.route('**/api/worldinfo/delete', route => route.fulfill({ status: 503, json: { error: 'Synthetic unavailable lore deletion' } }));
    await page.locator('#world_popup_delete').click();
    await page.locator('dialog[open] .popup-button-ok').click();
    await expect(page.locator('.toast-message').filter({ hasText: 'could not be deleted' })).toBeVisible();
    await expect(page.locator('#world_editor_select option:checked')).toHaveText(name);
    expect(await page.evaluate(async name => (await import('/scripts/world-info.js')).world_info.charLore.some(link => link.extraBooks.includes(name)), name)).toBe(true);
    await page.unroute('**/api/worldinfo/delete');
    await page.locator('#world_popup_delete').click(); await page.locator('dialog[open] .popup-button-ok').click();
    await expect(page.locator('#world_editor_select option').filter({ hasText: name })).toHaveCount(0);
    expect(await page.evaluate(async name => (await import('/scripts/world-info.js')).world_info.charLore.some(link => link.extraBooks.includes(name)), name)).toBe(false);
});

test('failed lorebook overwrite and import preserve the original file and cached entries', async ({ page }) => {
    const name = `Native overwrite ${Date.now().toString(36)}`;
    const original = { entries: { 0: { uid: 0, key: ['lantern'], keysecondary: [], comment: 'Original retained entry', content: 'A neutral original.', constant: false, disable: false, order: 100, position: 0 } } };
    await api(page, '/api/worldinfo/edit', { name, data: original });
    await page.evaluate(async () => { const world = await import('/scripts/world-info.js'); await world.updateWorldInfoList(); world.worldInfoCache.clear(); });
    await page.locator('#workspace-settings-link').click();
    await page.locator('.workspace-settings-rail [data-workspace-action="world"]').click();
    await page.locator('#world_editor_select').selectOption({ label: name });
    await expect(page.locator('#world_popup_entries_list textarea[name="comment"]').first()).toHaveValue('Original retained entry');
    const deletes = [];
    page.on('request', request => { if (request.url().endsWith('/api/worldinfo/delete')) deletes.push(request.postData()); });
    try {
        await page.route('**/api/worldinfo/edit', route => route.fulfill({ status: 503, json: { error: 'Synthetic unavailable replacement' } }));
        await page.locator('#world_create_button').click();
        await page.locator('dialog[open] .popup-input').fill(name); await page.locator('dialog[open] .popup-button-ok').click();
        await expect(page.locator('dialog[open]')).toContainText('overwrite');
        await page.locator('dialog[open] .popup-button-ok').click();
        await expect(page.locator('.toast-message').filter({ hasText: 'could not be saved' })).toBeVisible();
        expect((await api(page, '/api/worldinfo/get', { name })).entries[0].comment).toBe('Original retained entry');
        expect(await page.evaluate(async name => (await (await import('/scripts/world-info.js')).loadWorldInfo(name)).entries[0].comment, name)).toBe('Original retained entry');
        expect(deletes).toHaveLength(0);
        await page.unroute('**/api/worldinfo/edit');
        await page.route('**/api/worldinfo/import', route => route.fulfill({ status: 503, json: { error: 'Synthetic unavailable import' } }));
        const replacement = { ...original, entries: { 0: { ...original.entries[0], comment: 'Replacement entry' } } };
        await page.locator('#world_import_file').setInputFiles({ name: `${name}.json`, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(replacement)) });
        await expect(page.locator('dialog[open]')).toContainText('overwrite'); await page.locator('dialog[open] .popup-button-ok').click();
        await expect(page.locator('.toast-message').filter({ hasText: 'Failed to import' })).toBeVisible();
        expect((await api(page, '/api/worldinfo/get', { name })).entries[0].comment).toBe('Original retained entry');
        expect(deletes).toHaveLength(0);
        await page.unroute('**/api/worldinfo/import');
        await page.locator('#world_import_file').setInputFiles({ name: `${name}.json`, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(replacement)) });
        await expect(page.locator('dialog[open]')).toContainText('overwrite'); await page.locator('dialog[open] .popup-button-ok').click();
        await expect(page.locator('#world_popup_entries_list textarea[name="comment"]').first()).toHaveValue('Replacement entry');
        expect((await api(page, '/api/worldinfo/get', { name })).entries[0].comment).toBe('Replacement entry');
    } finally {
        await page.unroute('**/api/worldinfo/edit'); await page.unroute('**/api/worldinfo/import');
        await api(page, '/api/worldinfo/delete', { name });
    }
});

async function nextOwnershipStory(page) {
    if (!await page.locator('#workspace-navigation [data-workspace-action="characters"]').isVisible()) await page.locator('#workspace-menu').click();
    await page.locator('#workspace-navigation [data-workspace-action="characters"]').click();
    await page.locator('.workspace-library-card[data-entity="character:default_Seraphina.png"]').click();
    await page.getByRole('button', { name: 'Start new story', exact: true }).click();
    await expect(page.locator('#send_textarea')).toBeVisible();
    await expect(page.locator('#workspace-new-story')).toHaveAttribute('aria-busy', 'false');
}

async function localCaption(page) {
    await page.evaluate(async () => {
        const { extension_settings } = await import('/scripts/extensions.js');
        Object.assign(extension_settings.caption, { source: 'local', refine_mode: false, auto_mode: false });
    });
}

const captionImage = { name: 'ownership-caption.jpg', mimeType: 'image/jpeg', buffer: fs.readFileSync(new URL('../default/content/backgrounds/_white.jpg', import.meta.url)) };

for (const change of ['another story', 'same story reload']) {
    test(`a held native caption cannot add a message after ${change}`, async ({ page }, info) => {
        await localCaption(page);
        let release, began;
        const held = new Promise(resolve => release = resolve), requested = new Promise(resolve => began = resolve);
        await page.route('**/api/extra/caption', async route => { began(); await held; await route.fulfill({ json: { caption: 'A neutral caption from the previous lifetime.' } }); });
        try {
            await page.locator('#img_file').setInputFiles(captionImage); await requested;
            if (change === 'another story') await nextOwnershipStory(page);
            else {
                await page.evaluate(async () => (await import('/script.js')).reloadCurrentChat());
            }
            const before = await page.evaluate(async () => (await import('/script.js')).chat.map(message => message.mes));
            await page.locator('#send_textarea').fill('A newer draft stays here.');
            release();
            await expect(page.locator('.toast-message').filter({ hasText: 'Caption cancelled' })).toBeVisible();
            await page.unrouteAll({ behavior: 'wait' });
            expect(await page.evaluate(async () => (await import('/script.js')).chat.map(message => message.mes))).toEqual(before);
            await expect(page.locator('#send_textarea')).toHaveValue('A newer draft stays here.');
            await page.screenshot({ path: info.outputPath('caption-current-story.png') });
        } finally { release(); await page.unrouteAll({ behavior: 'wait' }); }
    });
}

test('same-owner native caption sends its image and text into the current story', async ({ page }) => {
    await localCaption(page);
    await page.route('**/api/extra/caption', route => route.fulfill({ json: { caption: 'A neutral lantern beside the river.' } }));
    const count = await page.evaluate(async () => (await import('/script.js')).chat.length);
    await page.locator('#img_file').setInputFiles(captionImage);
    await expect(page.locator('#chat .mes_text').last()).toContainText('A neutral lantern beside the river.');
    const message = await page.evaluate(async () => (await import('/script.js')).chat.at(-1));
    expect(await page.evaluate(async () => (await import('/script.js')).chat.length)).toBe(count + 1);
    expect(message.is_user).toBe(true);
    expect(message.extra.media[0].captioned).toBe(true);
    expect((await page.request.get(message.extra.media[0].url)).ok()).toBe(true);
});

test('recaption preserves an edited message while its image caption request is pending', async ({ page }) => {
    await localCaption(page);
    await page.evaluate(async () => {
        const script = await import('/script.js'); const context = (await import('/scripts/extensions.js')).getContext();
        const { MEDIA_SOURCE, MEDIA_TYPE, MEDIA_DISPLAY } = await import('/scripts/constants.js');
        const message = { name: context.name1, is_user: true, mes: 'Original image message.', send_date: new Date().toISOString(), extra: { media: [{ url: '/backgrounds/_white.jpg', type: MEDIA_TYPE.IMAGE, source: MEDIA_SOURCE.UPLOAD, title: 'Original title', captioned: false }], media_display: MEDIA_DISPLAY.GALLERY, media_index: 0 } };
        script.chat.push(message); script.addOneMessage(message); await script.saveChatConditional();
    });
    const message = page.locator('#chat .mes').last();
    await message.locator('.mes_img').waitFor({ state: 'visible' }); await message.hover();
    let release, began;
    const held = new Promise(resolve => release = resolve), requested = new Promise(resolve => began = resolve);
    await page.route('**/api/extra/caption', async route => { began(); await held; await route.fulfill({ json: { caption: 'A stale pending caption.' } }); });
    try {
        await message.locator('.mes_img_caption').click(); await requested;
        await message.locator('.mes_edit').click();
        await message.locator('#curEditTextarea').fill('A newer message edit.');
        await message.locator('.mes_edit_done').click();
        release();
        await expect(page.locator('.toast-message').filter({ hasText: 'Caption cancelled' })).toBeVisible();
        const current = await page.evaluate(async () => (await import('/script.js')).chat.at(-1));
        expect(current.mes).toBe('A newer message edit.');
        expect(current.extra.media[0].title).toBe('Original title');
        expect(current.extra.media[0].captioned).toBe(false);
    } finally { release(); await page.unrouteAll({ behavior: 'wait' }); }
});

test('a held history action cannot dismiss a newer reopened Actions menu', async ({ page }, info) => {
    await page.setViewportSize({ width: 844, height: 390 });
    const tools = page.locator('.workspace-creative-menu');
    if (!await tools.evaluate(node => node.open)) await tools.locator('summary').click();
    await page.locator('#options_button').click();
    await expect(page.locator('#options')).toBeVisible();
    let release, began;
    const held = new Promise(resolve => { release = resolve; });
    const requested = new Promise(resolve => { began = resolve; });
    await page.route('**/api/chats/search', async route => {
        const response = await route.fetch();
        began();
        await held;
        await route.fulfill({ response });
    }, { times: 1 });
    const settleMenus = () => page.evaluate(async () => {
        await Promise.all(['#options', '#shadow_select_chat_popup'].map(selector => Promise.resolve(window.$(selector).promise('fx'))));
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    try {
        await page.locator('#option_select_chat').click();
        await requested;
        if (await page.locator('#options_button').getAttribute('aria-expanded') === 'true') {
            await page.locator('#options_button').click();
        }
        await settleMenus();
        await page.locator('#options_button').click();
        await settleMenus();
        await expect(page.locator('#options_button')).toHaveAttribute('aria-expanded', 'true');
        await expect(page.locator('#options')).toBeVisible();
        await expect(page.locator('#options_button')).toBeFocused();
        release();
        await expect(page.locator('#select_chat_popup')).toBeVisible();
        await settleMenus();
        // Native history also schedules search focus after200ms. That delayed
        // callback must not dismiss the newer intentional menu either.
        await page.waitForTimeout(300);
        await settleMenus();
        await expect(page.locator('#options_button')).toHaveAttribute('aria-expanded', 'true');
        await expect(page.locator('#options')).toBeVisible();
        await expect(page.locator('#options_button')).toBeFocused();
        await page.screenshot({ path: info.outputPath('newer-actions-after-history.png') });
        await page.keyboard.press('Escape');
        await expect(page.locator('#select_chat_popup')).toBeHidden();
        await page.keyboard.press('Escape');
        await expect(page.locator('#options')).toBeHidden();
    } finally {
        release();
        await page.unrouteAll({ behavior: 'wait' });
    }
});
