import { test, expect } from '@playwright/test';
import fs from 'node:fs';

test.use({ channel: 'chromium', video: 'off', viewport: { width: 1280, height: 800 } });
test.setTimeout(60000);

test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(12000);
    page.nativeDiagnostics = { pageErrors: [], consoleErrors: [] };
    page.on('pageerror', error => page.nativeDiagnostics.pageErrors.push(error.stack || error.message));
    page.on('console', message => { if (message.type() === 'error') page.nativeDiagnostics.consoleErrors.push(message.text()); });
    await page.route('**/api/settings/get', async route => {
        const response = await route.fetch(); const body = await response.json(); const settings = JSON.parse(body.settings);
        settings.firstRun = false; settings.active_character = null; settings.active_group = null;
        settings.main_api = 'openai'; settings.power_user.auto_connect = false; settings.power_user.font_scale = 1;
        settings.accountStorage = { ...settings.accountStorage, workspaceLayout: 'true', workspaceAdvancedSettings: 'false', workspaceArchivedChats: '[]' };
        settings.extension_settings.tts = { ...settings.extension_settings.tts, enabled: false, currentProvider: 'System' };
        settings.extension_settings.serviceConnections = { url: '' };
        body.settings = JSON.stringify(settings); await route.fulfill({ response, json: body });
    });
    await page.route('**/api/settings/save', route => route.fulfill({ json: { result: 'ok' } }));
    await page.goto('/');
    await expect(page.locator('#preloader')).toHaveCount(0, { timeout: 30000 });
});

test.afterEach(async ({ page }, info) => {
    fs.writeFileSync(info.outputPath('diagnostics.json'), JSON.stringify(page.nativeDiagnostics, null, 2));
    await page.screenshot({ path: info.outputPath('final.png') });
    expect(page.nativeDiagnostics.pageErrors).toEqual([]);
});

for (const [name, path, parser] of [
    ['Kobold', '/scripts/kai-settings.js', 'parseKoboldStream'],
    ['NovelAI', '/scripts/nai-settings.js', 'parseNovelStream'],
]) {
    test(`${name} preserves partial tokens and rejects an HTTP200 provider error frame`, async ({ page }) => {
        const result = await page.evaluate(async ({ path, parser }) => {
            (await import('/scripts/power-user.js')).power_user.smooth_streaming = false;
            const response = new Response('data: {"token":"A neutral partial reply."}\n\ndata: {"error":"Synthetic provider interruption"}\n\n', { headers: { 'Content-Type': 'text/event-stream' } });
            const received = []; let error;
            try { for await (const chunk of (await import(path))[parser](response)()) received.push(chunk.text); }
            catch (failure) { error = failure.message; }
            return { received, error };
        }, { path, parser });
        expect(result).toEqual({ received: ['A neutral partial reply.'], error: 'Synthetic provider interruption' });
    });
}

test('streamed tool parsing keeps the original reply after the active API and tool preference change', async ({ page }) => {
    const result = await page.evaluate(async () => {
        const o = await import('/scripts/openai.js'); const { ToolManager } = await import('/scripts/tool-calling.js');
        const data = { choices: [{ index: 0, delta: { tool_calls: [{ index: 0, id: 'synthetic-call', type: 'function', function: { name: 'synthetic_lantern', arguments: '{}' } }] } }] };
        Object.assign(o.oai_settings, { function_calling: true, chat_completion_source: 'custom', custom_prompt_post_processing: 'none' });
        const first = []; ToolManager.parseToolCalls(first, data);
        window.$('#main_api').val('textgenerationwebui').trigger('change'); o.oai_settings.function_calling = false;
        const second = []; ToolManager.parseToolCalls(second, data);
        return { first, second };
    });
    expect(result.first[0][0].id).toBe('synthetic-call'); expect(result.second).toEqual(result.first);
});

test('the Text Completion parser is selected before its generation fetch can yield to a settings change', async ({ page }) => {
    let release, began;
    const gate = new Promise(resolve => release = resolve), requested = new Promise(resolve => began = resolve);
    await page.route('**/api/backends/text-completions/generate', async route => { began(); await gate; await route.fulfill({ contentType: 'text/event-stream', body: 'data: {"choices":[{"text":"Original parser reply.","logprobs":{"top_logprobs":[{"Original":-0.1}]}}]}\n\n' }); });
    await page.evaluate(async () => {
        const t = await import('/scripts/textgen-settings.js'); (await import('/scripts/power-user.js')).power_user.smooth_streaming = false;
        t.textgenerationwebui_settings.type = 'ooba';
        window.__parserPromise = t.generateTextGenWithStreaming({ api_type: 'ooba', prompt: 'A neutral fixture prompt.' }, new AbortController().signal);
    });
    await requested;
    await page.evaluate(async () => { (await import('/scripts/textgen-settings.js')).textgenerationwebui_settings.type = 'ollama'; });
    release();
    expect(await page.evaluate(async () => {
        const received = []; for await (const chunk of (await window.__parserPromise)()) received.push({ text: chunk.text, logprobs: chunk.logprobs }); return received;
    })).toEqual([{ text: 'Original parser reply.', logprobs: { token: 'Original parser reply.', topLogprobs: [['Original', -0.1]] } }]);
});
