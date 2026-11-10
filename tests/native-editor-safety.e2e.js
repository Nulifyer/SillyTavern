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

test('invalid JSON files reject cleanly and valid files still parse', async ({ page }) => {
    const result = await page.evaluate(async () => {
        const { parseJsonFile } = await import('/scripts/utils.js');
        let rejected = false; try { await parseJsonFile(new File(['{broken'], 'invalid.json', { type: 'application/json' })); } catch { rejected = true; }
        return { rejected, valid: await parseJsonFile(new File(['{"fixture":"neutral"}'], 'valid.json', { type: 'application/json' })) };
    });
    expect(result).toEqual({ rejected: true, valid: { fixture: 'neutral' } });
});

test('prompt Quick Edit preserves literal text and private copies of fallback defaults', async ({ page }) => {
    const result = await page.evaluate(async () => {
        const { PromptManager, chatCompletionDefaultPrompts } = await import('/scripts/PromptManager.js');
        const manager = new PromptManager();
        const quickContainer = document.createElement('div'); quickContainer.id = 'quick-edit-container'; document.body.append(quickContainer);
        const literal = 'before </textarea><b id="synthetic-prompt-marker">AFTER</b><textarea>';
        manager.serviceSettings = { prompts: [{ identifier: 'audit_literal', content: literal }] };
        manager.createQuickEdit('audit_literal', '<b id="synthetic-title-marker">Literal title</b>');
        const input = document.getElementById('audit_literal_prompt_quick_edit_textarea');
        const value = input.value, marker = Boolean(document.getElementById('synthetic-prompt-marker') || document.getElementById('synthetic-title-marker'));
        input.closest('.range-block').remove();
        quickContainer.remove();
        const defaults = JSON.stringify(chatCompletionDefaultPrompts);
        manager.serviceSettings = { prompts: [], prompt_order: [] }; manager.sanitizeServiceSettings();
        const aliased = manager.serviceSettings.prompts === chatCompletionDefaultPrompts.prompts;
        manager.serviceSettings.prompts[0].content = 'Synthetic separate edit';
        return { value, literal, marker, aliased, defaultsChanged: JSON.stringify(chatCompletionDefaultPrompts) !== defaults };
    });
    expect(result.value).toBe(result.literal); expect(result.marker).toBe(false); expect(result.aliased).toBe(false); expect(result.defaultsChanged).toBe(false);
});

test('invalid prompt imports leave the original preset intact and a valid import can still save', async ({ page }) => {
    const result = await page.evaluate(async () => {
        const { PromptManager } = await import('/scripts/PromptManager.js'); const manager = new PromptManager();
        manager.configuration.promptOrder.strategy = 'global';
        manager.serviceSettings = { prompts: [], prompt_order: [] }; manager.sanitizeServiceSettings();
        let saves = 0; manager.saveServiceSettings = async () => { saves++; }; manager.render = () => {};
        const before = JSON.stringify(manager.serviceSettings);
        const good = { identifier: 'audit_import', name: 'Synthetic import', role: 'system', content: 'Literal neutral prompt.' };
        const bad = [{}, { prompts: {} }, { prompts: [null] }, { prompts: [{ ...good, name: 42 }] }, { prompts: [{ identifier: 'missing-name' }] },
            { prompts: [good, good] }, { prompts: [{ ...good, injection_depth: 'bad' }] }, { prompts: [good], prompt_order: [{ identifier: good.identifier }, { identifier: good.identifier }] }];
        const invalidChanged = [];
        for (const data of bad) { manager.import({ version: 1, type: 'full', data }); invalidChanged.push(JSON.stringify(manager.serviceSettings) !== before); }
        const savesBeforeValid = saves;
        manager.import({ version: 1, type: 'full', data: { prompts: [good], prompt_order: [] } });
        await Promise.resolve();
        return { invalidChanged, savesBeforeValid, saves, valid: manager.serviceSettings.prompts.find(prompt => prompt.identifier === good.identifier) };
    });
    expect(result.invalidChanged).toEqual(Array(8).fill(false)); expect(result.savesBeforeValid).toBe(0); expect(result.saves).toBe(1);
    expect(result.valid.content).toBe('Literal neutral prompt.');
});

test('autocomplete explanations keep typed variable names and values as literal text', async ({ page }) => {
    const result = await page.evaluate(async () => {
        const m = await import('/scripts/autocomplete/EnhancedMacroAutoCompleteOption.js');
        const literal = '<b id="synthetic-autocomplete-marker">VALUE</b>';
        const value = new m.VariableValueContextAutoCompleteOption(m.VariableOperatorDefinitions.get('='), literal);
        const name = new m.VariableNameAutoCompleteOption(literal, 'local', false, true);
        return [value, name].map(option => { const root = document.createElement('div'); root.append(option.renderDetails()); return { marker: Boolean(root.querySelector('#synthetic-autocomplete-marker')), text: root.textContent }; });
    });
    for (const item of result) { expect(item.marker).toBe(false); expect(item.text).toContain('<b id="synthetic-autocomplete-marker">VALUE</b>'); }
});

for (const supersede of ['blur', 'newer input']) {
    test(`a held autocomplete result cannot reopen after ${supersede}`, async ({ page }) => {
        const result = await page.evaluate(async supersede => {
            const { AutoComplete } = await import('/scripts/autocomplete/AutoComplete.js'); const { AutoCompleteOption } = await import('/scripts/autocomplete/AutoCompleteOption.js');
            const input = document.createElement('textarea'); document.body.append(input);
            const pending = new Map();
            const ac = new AutoComplete(input, () => true, text => new Promise(resolve => pending.set(text, resolve)));
            const response = (name, option) => ({ name, start: 0, canBeQuoted: false, optionList: [new AutoCompleteOption(option)], getSecondaryNameAt: () => null });
            input.value = 'a'; input.focus(); input.setSelectionRange(1, 1); const first = ac.show(true);
            if (supersede === 'blur') input.blur();
            else { input.value = 'b'; input.setSelectionRange(1, 1); const next = ac.show(true); pending.get('b')(response('b', 'beta')); await next; }
            pending.get('a')(response('a', 'alpha')); await first; ac.render();
            const state = { active: ac.isActive, connected: ac.domWrap.isConnected, text: ac.domWrap.textContent };
            ac.hide(); input.remove(); return state;
        }, supersede);
        if (supersede === 'blur') { expect(result.active).toBe(false); expect(result.connected).toBe(false); }
        else { expect(result.active).toBe(true); expect(result.text).toContain('beta'); expect(result.text).not.toContain('alpha'); }
    });
}

test('a stalled tokenizer rejects at its deadline and a retry succeeds', async ({ page }) => {
    await page.clock.install();
    await page.evaluate(async () => {
        const t = await import('/scripts/tokenizers.js'); const p = await import('/scripts/power-user.js');
        window.$('#main_api').val('textgenerationwebui').trigger('change'); p.power_user.tokenizer = t.tokenizers.LLAMA;
    });
    let release, began; const gate = new Promise(resolve => release = resolve), requested = new Promise(resolve => began = resolve); let calls = 0;
    await page.route('**/api/tokenizers/llama/encode', async route => { if (++calls === 1) { began(); await gate; } await route.fulfill({ json: { count: 7, ids: [] } }); });
    try {
        await page.evaluate(() => { window.__tokenTimeout = import('/scripts/tokenizers.js').then(t => t.getTokenCountAsync('Synthetic timeout input')).then(count => ({ count }), error => ({ error: error.message })); });
        await requested; await page.clock.fastForward(31000);
        expect((await page.evaluate(() => window.__tokenTimeout)).error).toContain('request timed out');
        release();
        expect(await page.evaluate(async () => (await import('/scripts/tokenizers.js')).getTokenCountAsync('Synthetic retry input'))).toBe(7);
    } finally { release(); }
});

test('a failed extension delete reports failure and preserves the page for retry', async ({ page }) => {
    await page.route('**/api/extensions/delete', route => route.fulfill({ status: 503, json: { error: 'Synthetic unavailable storage' } }));
    const url = page.url();
    expect(await page.evaluate(async () => (await import('/scripts/extensions.js')).deleteExtension('synthetic-missing-extension'))).toBe(false);
    await expect(page.locator('.toast-error')).toContainText('could not be deleted'); await expect(page.locator('.toast-success')).toHaveCount(0);
    expect(page.url()).toBe(url);
});

test('failed Data Maid Delete All keeps its category and a successful retry removes it', async ({ page }) => {
    await page.route('**/api/data-maid/report', route => route.fulfill({ json: { token: 'synthetic-report-token', report: { images: [{ hash: 'synthetic-image-hash', name: 'neutral.png', size: 1, mtime: Date.now() }] } } }));
    await page.route('**/api/data-maid/finalize', route => route.fulfill({ json: {} }));
    let deletes = 0;
    await page.route('**/api/data-maid/delete', route => ++deletes === 1 ? route.fulfill({ status: 503, json: { error: 'Synthetic unavailable storage' } }) : route.fulfill({ json: {} }));
    await page.locator('#data_maid_button').evaluate(button => button.click());
    await page.getByRole('button', { name: 'Scan', exact: true }).click();
    const category = page.locator('.dataMaidCategory'); await expect(category).toHaveCount(1);
    for (const count of [1, 2]) {
        await category.locator('.dataMaidDeleteAll').click();
        await page.locator('dialog[open]').last().locator('.popup-button-ok').click();
        await expect.poll(() => deletes).toBe(count);
        await expect(category).toHaveCount(count === 1 ? 1 : 0);
    }
    await expect(page.locator('.dataMaidPlaceholder')).toContainText('No items found');
});
