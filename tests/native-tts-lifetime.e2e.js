import { test, expect } from '@playwright/test';
import fs from 'node:fs';

test.use({ channel: 'chromium', video: 'off', viewport: { width: 1280, height: 800 } });
test.setTimeout(90000);
test.skip(!process.env.ST_NATIVE_UI_AUDIT, 'Use ST_NATIVE_UI_AUDIT=1 with a synthetic local fixture.');

test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(12000);
    await page.addInitScript(() => {
        const sources = new WeakMap(), paused = new WeakMap();
        window.__ttsMedia = [];
        Object.defineProperty(HTMLMediaElement.prototype, 'src', { configurable: true, get() { return sources.get(this) || ''; }, set(value) {
            sources.set(this, String(value));
            if (String(value).startsWith('data:audio/')) queueMicrotask(() => this.dispatchEvent(new Event('canplay')));
        } });
        Object.defineProperty(HTMLMediaElement.prototype, 'paused', { configurable: true, get() { return paused.get(this) !== false; } });
        HTMLMediaElement.prototype.pause = function () { paused.set(this, true); };
        HTMLMediaElement.prototype.play = async function () {
            paused.set(this, false);
            window.__ttsMedia.push({ id: this.id, source: this.src, text: this.src.startsWith('data:audio/') ? atob(this.src.split(',')[1]) : '' });
        };
    });
    page.nativeDiagnostics = { pageErrors: [], consoleErrors: [], failedRequests: [] };
    page.on('pageerror', error => page.nativeDiagnostics.pageErrors.push(error.stack || error.message));
    page.on('console', message => { if (message.type() === 'error') page.nativeDiagnostics.consoleErrors.push(message.text()); });
    page.on('requestfailed', request => page.nativeDiagnostics.failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
    await page.route('**/api/settings/get', async route => {
        const response = await route.fetch(); const body = await response.json(); const settings = JSON.parse(body.settings);
        settings.firstRun = false; settings.active_character = null; settings.active_group = null;
        settings.main_api = 'openai'; settings.power_user.auto_connect = false; settings.power_user.font_scale = 1;
        settings.accountStorage = { ...settings.accountStorage, workspaceLayout: 'true', workspaceAdvancedSettings: 'false', workspaceArchivedChats: '[]' };
        settings.extension_settings.tts = {
            enabled: false, currentProvider: 'System', System: {}, voiceMap: '', auto_generation: false,
            periodic_auto_generation: false, narrate_user: false, playback_rate: 1, multi_voice_enabled: false,
            narrate_dialogues_only: false, narrate_quoted_only: false, narrate_translated_only: false,
            narrate_by_paragraphs: false, pass_asterisks: false, skip_codeblocks: false, skip_tags: false,
            apply_regex: false, regex_pattern: '',
        };
        settings.extension_settings.translate = { ...settings.extension_settings.translate, auto_mode: 'none' };
        settings.extension_settings.caption = { ...settings.extension_settings.caption, auto_mode: false };
        settings.extension_settings.serviceConnections = { url: '' };
        body.settings = JSON.stringify(settings); await route.fulfill({ response, json: body });
    });
    await page.route('**/api/settings/save', route => route.fulfill({ json: { result: 'ok' } }));
    await page.goto('/');
    await expect(page.locator('#preloader')).toHaveCount(0, { timeout: 30000 });
    await page.locator('#workspace-navigation [data-workspace-action="characters"]').click();
    await page.locator('.workspace-library-card[data-entity="character:default_Seraphina.png"]').click();
    await page.getByRole('button', { name: 'Start new story', exact: true }).click();
    await expect(page.locator('#workspace-new-story')).toHaveAttribute('aria-busy', 'false');
    await expect(page.locator('#send_textarea')).toBeVisible();
    page.fixtureStory = await page.evaluate(async () => {
        const script = await import('/script.js');
        return { identity: script.getCurrentChatIdentity(), name: script.name2, saved: await script.saveChatConditional() };
    });
    expect(page.fixtureStory.name).toBe('Seraphina');
    expect(page.fixtureStory.saved).toBe(true);
});

test.afterEach(async ({ page }, info) => {
    fs.writeFileSync(info.outputPath('diagnostics.json'), JSON.stringify(page.nativeDiagnostics, null, 2));
    fs.writeFileSync(info.outputPath('fixture-story.json'), JSON.stringify(page.fixtureStory || null, null, 2));
    await page.screenshot({ path: info.outputPath('final.png') });
    expect(page.nativeDiagnostics.pageErrors).toEqual([]);
});

// The native browser pipeline and listeners run unchanged. Only the provider and
// media decoding/playback are synthetic; these checks do not certify real audio hardware.
async function configure(page) {
    await page.evaluate(async () => {
        const tts = await import('/scripts/extensions/tts/index.js');
        const { extension_settings } = await import('/scripts/extensions.js');
        const script = await import('/script.js');
        if (!script.name2 || !script.getCurrentChatId()) throw new Error('The native story must finish loading before configuring its voice map.');
        window.__ttsAudit = { calls: [], pending: [] };
        class SyntheticProvider {
            settings = {};
            get settingsHtml() { return '<p>Synthetic local TTS lifetime fixture.</p>'; }
            async loadSettings(settings) { this.settings = settings; window.__ttsAudit.provider = this; }
            async checkReady() {}
            async onRefreshClick() {}
            async fetchTtsVoiceObjects() { return [{ name: 'Audit Voice', voice_id: 'audit', lang: 'en-US' }]; }
            async getVoice() { return { name: 'Audit Voice', voice_id: 'audit' }; }
            async generateTts(text) { window.__ttsAudit.calls.push(text); return new Promise(resolve => window.__ttsAudit.pending.push({ text, resolve })); }
        }
        tts.registerTtsProvider('Synthetic lifetime', SyntheticProvider);
        extension_settings.tts['Synthetic lifetime'] = { voiceMap: { '[Default Voice]': 'Audit Voice', [script.name2]: 'Audit Voice' } };
        extension_settings.tts.auto_generation = false;
    });
    await page.locator('#workspace-settings-link').click();
    await page.locator('.workspace-settings-rail [data-workspace-action="voice-settings"]').click();
    await page.locator('#tts_provider').selectOption('Synthetic lifetime');
    await page.locator('[data-workspace-action="close-panel"]').click();
    await page.locator('#workspace-voice-button').click();
    await expect(page.locator('#workspace-voice-button')).toHaveAttribute('aria-pressed', 'true');
    await page.evaluate(async () => (await import('/scripts/extensions/tts/index.js')).initVoiceMap());
}
async function appendReply(page, text) {
    await page.evaluate(async text => {
        const script = await import('/script.js');
        const message = { name: script.name2, mes: text, is_user: false, is_system: false, extra: {}, send_date: new Date().toISOString() };
        script.chat.push(message); script.addOneMessage(message);
    }, text);
}
async function action(page, name) {
    const menu = page.locator('.workspace-creative-menu');
    if (!await menu.evaluate(node => node.open)) await menu.locator('summary').click();
    await menu.locator(`[data-workspace-action="${name}"]`).click();
}
async function waitCalls(page, count) {
    await expect.poll(() => page.evaluate(() => window.__ttsAudit.calls.length)).toBe(count);
}
async function resolve(page, index) {
    await page.evaluate(index => {
        const pending = window.__ttsAudit.pending[index];
        pending.resolve(new Response(new Blob([pending.text], { type: 'audio/wav' })));
    }, index);
}
async function plays(page) { return page.evaluate(() => window.__ttsMedia.filter(play => play.id === 'tts_audio').map(play => play.text)); }

test('Stop rejects late narration and preserves a newer pending job before normal playback', async ({ page }) => {
    await configure(page);
    await appendReply(page, 'Old held narration'); await action(page, 'read-reply'); await waitCalls(page, 1);
    await action(page, 'voice-playback');
    await appendReply(page, 'New narration after Stop'); await action(page, 'read-reply'); await waitCalls(page, 2);
    await resolve(page, 0);
    await expect(page.locator('#tts_media_control')).toHaveClass(/fa-stop-circle/);
    expect(await plays(page)).toEqual([]);
    await resolve(page, 1);
    await expect.poll(() => plays(page)).toEqual(['New narration after Stop']);
    expect(await page.evaluate(() => window.__ttsAudit.calls)).toEqual(['Old held narration', 'New narration after Stop']);
});

test('turning Voice off invalidates held output and a later opt-in can narrate normally', async ({ page }) => {
    await configure(page);
    await appendReply(page, 'Held before Voice off'); await action(page, 'read-reply'); await waitCalls(page, 1);
    await page.locator('#workspace-voice-button').click();
    await expect(page.locator('#workspace-voice-button')).toHaveAttribute('aria-pressed', 'false');
    await resolve(page, 0);
    expect(await plays(page)).toEqual([]);
    await page.locator('#workspace-voice-button').click();
    await expect(page.locator('#workspace-voice-button')).toHaveAttribute('aria-pressed', 'true');
    await appendReply(page, 'Fresh opt-in narration'); await action(page, 'read-reply'); await waitCalls(page, 2);
    await resolve(page, 1); await expect.poll(() => plays(page)).toEqual(['Fresh opt-in narration']);
});

test('switching stories discards the old held voice response before the new story can play', async ({ page }) => {
    await configure(page);
    await appendReply(page, 'Held in previous story'); await action(page, 'read-reply'); await waitCalls(page, 1);
    const before = await page.evaluate(async () => (await import('/script.js')).getCurrentChatIdentity());
    await page.locator('#workspace-navigation [data-workspace-action="characters"]').click();
    await page.locator('.workspace-library-card[data-entity="character:default_Seraphina.png"]').click();
    await page.getByRole('button', { name: 'Start new story', exact: true }).click();
    await expect(page.locator('#workspace-new-story')).toHaveAttribute('aria-busy', 'false');
    await expect.poll(() => page.evaluate(async () => (await import('/script.js')).getCurrentChatIdentity())).not.toBe(before);
    await resolve(page, 0); expect(await plays(page)).toEqual([]);
    await appendReply(page, 'Narration in new story'); await action(page, 'read-reply'); await waitCalls(page, 2);
    await resolve(page, 1); await expect.poll(() => plays(page)).toEqual(['Narration in new story']);
});

test('changing provider starts its voice map while the previous provider is still held', async ({ page }) => {
    await configure(page);
    await page.locator('#workspace-settings-link').click();
    await page.locator('.workspace-settings-rail [data-workspace-action="voice-settings"]').click();
    await page.evaluate(async () => {
        const tts = await import('/scripts/extensions/tts/index.js');
        const { extension_settings } = await import('/scripts/extensions.js');
        const script = await import('/script.js');
        window.__ttsAudit.provider.fetchTtsVoiceObjects = () => {
            window.__ttsAudit.oldVoicesRequested = true;
            return new Promise(resolve => window.__ttsAudit.releaseOldVoices = resolve);
        };
        class NewProvider {
            settings = {};
            get settingsHtml() { return '<p>New synthetic provider.</p>'; }
            async loadSettings(settings) { this.settings = settings; }
            async checkReady() {}
            async fetchTtsVoiceObjects() { return [{ name: 'New Audit Voice', voice_id: 'new-audit', lang: 'en-US' }]; }
            async getVoice() { return { voice_id: 'new-audit' }; }
            async generateTts(text) { window.__ttsAudit.calls.push(text); return new Promise(resolve => window.__ttsAudit.pending.push({ text, resolve })); }
        }
        tts.registerTtsProvider('New synthetic lifetime', NewProvider);
        extension_settings.tts['New synthetic lifetime'] = { voiceMap: { '[Default Voice]': 'New Audit Voice', [script.name2]: 'New Audit Voice' } };
    });
    await page.locator('#tts_refresh').click();
    await expect.poll(() => page.evaluate(() => Boolean(window.__ttsAudit.oldVoicesRequested))).toBe(true);
    await page.locator('#tts_provider').selectOption('New synthetic lifetime');
    await expect(page.locator('#tts_voicemap_block select').first()).toHaveValue('New Audit Voice');
    await page.evaluate(() => window.__ttsAudit.releaseOldVoices([]));
    await expect(page.locator('#tts_voicemap_block select').first()).toHaveValue('New Audit Voice');
    await page.locator('[data-workspace-action="close-panel"]').click();
    await appendReply(page, 'New provider remains usable'); await action(page, 'read-reply'); await waitCalls(page, 1);
    await resolve(page, 0); await expect.poll(() => plays(page)).toEqual(['New provider remains usable']);
});
