import { test, expect } from '@playwright/test';
import fs from 'node:fs';

test.use({ channel: 'chromium', video: 'off', viewport: { width: 1280, height: 800 } });
test.setTimeout(90000);

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

async function category(page, id) {
    if (!await page.locator('#workspace-settings-shell').isVisible()) await page.locator('#workspace-settings-link').click();
    await page.locator(`.workspace-settings-rail [data-workspace-action="${id}"]`).click();
}

const discovery = root => ({ root, base: `${root}/v1`, juiced: true, services: { chat: { models: [] }, images: { models: [{ id: 'held-image' }] }, speak: { models: [] }, transcribe: { models: [] } }, protocols: [{ id: 'automatic1111', features: ['txt2img'] }] });

async function openNative(page) {
    const native = page.locator('.service-native-controls').filter({ has: page.locator('#sd_source') });
    if (!await native.evaluate(node => node.open)) await native.locator(':scope > summary').click();
}

const supersede = {
    source: async page => {
        await openNative(page);
        await page.locator('#sd_source').selectOption('openai');
        await expect(page.locator('#sd_model option[value="gpt-image-1"]')).toHaveCount(1);
        await expect(page.locator('#sd_comfy_workflow option[value="newer-workflow"]')).toHaveCount(1);
        await page.locator('#sd_model').selectOption('gpt-image-1');
    },
    discovery: async (page, setRoot) => {
        await category(page, 'servers');
        setRoot('https://newer.synthetic.example');
        await page.locator('#service-server-url').fill('https://newer.synthetic.example');
        await page.locator('#service-discover').click();
        await expect(page.locator('#service-discovery-status')).toContainText('Connected to Juiced');
        await category(page, 'image-settings');
        await page.locator('#service-images-model').selectOption('held-image');
    },
};

async function readState(page) {
    return page.evaluate(async () => {
        const settings = (await import('/scripts/extensions.js')).extension_settings.sd;
        return {
            source: settings.source, url: settings.sdcpp_url, model: settings.model,
            options: [...document.querySelector('#sd_model').options].map(option => option.value), selected: document.querySelector('#sd_model').value,
            otherSettings: { sampler: settings.sampler, scheduler: settings.scheduler, vae: settings.vae, workflow: settings.comfy_workflow },
            otherOptions: ['sd_sampler', 'sd_scheduler', 'sd_vae', 'sd_comfy_workflow'].map(id => ({ id, value: document.getElementById(id).value, options: [...document.getElementById(id).options].map(option => option.value) })),
            status: document.querySelector('#service-images-row .service-status').textContent,
            open: document.querySelector('#service-images-row').parentElement.nextElementSibling.open,
        };
    });
}

const checkOwner = {
    source: (before, after) => {
        expect(after.options).toEqual(before.options); expect(after.selected).toBe(before.selected);
        expect(after.otherOptions).toEqual(before.otherOptions); expect(after.otherSettings).toEqual(before.otherSettings);
    },
    discovery: (before, after) => { expect(after.status).toBe(before.status); expect(after.open).toBe(before.open); },
};

test('a writer Apply held in profile creation cannot replace the newer server writer selection', async ({ page }) => {
    let root = `https://writer-a-${Date.now()}.synthetic.invalid`;
    await page.route('**/api/openai/custom/discover', route => {
        const data = discovery(root); data.services.chat.models = [{ id: 'synthetic-writer' }]; return route.fulfill({ json: data });
    });
    await page.evaluate(async () => {
        const s = await import('/script.js'); const gate = new Promise(resolve => window.__releaseWriterProfile = resolve);
        const listener = async () => { window.__writerProfileEntered = true; await gate; window.__writerProfileReleased = true; };
        s.eventSource.on(s.event_types.CONNECTION_PROFILE_CREATED, listener);
        window.__writerProfileCleanup = () => s.eventSource.removeListener(s.event_types.CONNECTION_PROFILE_CREATED, listener);
    });
    try {
        await category(page, 'servers'); await page.locator('#service-server-url').fill(root); await page.locator('#service-discover').click();
        await expect(page.locator('#service-discovery-status')).toContainText('Connected to Juiced');
        await category(page, 'image-writer'); await page.locator('#service-writer-model').selectOption('synthetic-writer'); await page.locator('#service-writer-apply').click();
        await expect.poll(() => page.evaluate(() => window.__writerProfileEntered)).toBe(true);
        root = `https://writer-b-${Date.now()}.synthetic.invalid`;
        await category(page, 'servers'); await page.locator('#service-server-url').fill(root); await page.locator('#service-discover').click();
        await expect(page.locator('#service-discovery-status')).toContainText('Connected to Juiced');
        await category(page, 'image-writer'); await page.locator('#service-writer-model').selectOption(''); await page.locator('#service-writer-apply').click();
        await expect(page.locator('#service-writer-row .service-status')).toContainText('Saved.');
        await page.evaluate(() => window.__releaseWriterProfile());
        await expect.poll(() => page.evaluate(() => window.__writerProfileReleased)).toBe(true);
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        expect(await page.evaluate(async () => (await import('/scripts/extensions.js')).extension_settings.sd.prompt_writer_profile)).toBe('');
        await expect(page.locator('#service-writer-model')).toHaveValue('');
    } finally { await page.evaluate(() => { window.__releaseWriterProfile(); window.__writerProfileCleanup(); }); }
});

for (const change of ['source', 'discovery']) {
    test(`a held discovered image Apply preserves the newer ${change} owner`, async ({ page }, info) => {
        let root = 'https://held.synthetic.example';
        await page.route('**/api/openai/custom/discover', route => route.fulfill({ json: discovery(root) }));
        let release, began;
        const held = new Promise(resolve => release = resolve), requested = new Promise(resolve => began = resolve);
        await page.route('**/api/sd/sdcpp/models', async route => { began(); await held; await route.fulfill({ json: { data: [{ id: 'held-image' }] } }); });
        let workflowRequests = 0;
        await page.route('**/api/sd/comfy/workflows', async route => {
            const first = ++workflowRequests === 1;
            if (first) await held;
            await route.fulfill({ json: [first ? 'held-workflow' : 'newer-workflow'] });
        });
        await category(page, 'servers');
        await page.locator('#service-server-url').fill(root);
        await page.locator('#service-discover').click();
        await expect(page.locator('#service-discovery-status')).toContainText('Connected to Juiced');
        await category(page, 'image-settings');
        await page.locator('#service-images-model').selectOption('held-image');
        await page.locator('#service-images-apply').click();
        await requested;
        try {
            await expect(page.locator('#service-images-model')).toBeDisabled();
            await expect(page.locator('#sd_source')).toBeEnabled();
            await supersede[change](page, value => root = value);
            await openNative(page);
            const before = await readState(page);
            const response = page.waitForResponse(response => response.url().endsWith('/api/sd/sdcpp/models'));
            release(); await response;
            await expect(page.locator('#service-images-model')).toBeEnabled();
            await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
            const after = await readState(page);
            expect(after.source).toBe(before.source); expect(after.url).toBe(before.url); expect(after.model).toBe(before.model);
            checkOwner[change](before, after);
            fs.writeFileSync(info.outputPath('owner-state.json'), JSON.stringify({ before, after }, null, 2));
            await page.screenshot({ path: info.outputPath('newer-owner-preserved.png') });
        } finally { release(); }
    });
}
