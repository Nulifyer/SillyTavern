import { test, expect } from '@playwright/test';
import fs from 'node:fs';

// Deliberately separate from the behavioral regression suite: this audit records
// reachable controls, disclosures and provider forms, including below the fold.
test.use({ channel: 'chromium', video: 'off', viewport: { width: 1280, height: 800 } });
test.setTimeout(900000);
test.skip(!process.env.ST_UI_AUDIT, 'Set ST_UI_AUDIT=1 and use a fresh synthetic data root for the full UI audit.');

async function settle(page) {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function category(page, id) {
    if (id === 'character-editor') {
        if (!await page.locator('#workspace-navigation [data-workspace-action="characters"]').isVisible()) await page.locator('#workspace-menu').click();
        await page.locator('#workspace-navigation [data-workspace-action="characters"]').click();
        await page.locator('.workspace-library-card').first().click();
        await page.getByRole('button', { name: 'Edit character', exact: true }).click();
        await settle(page);
        return;
    }
    if (!await page.locator('#workspace-settings-shell').isVisible()) {
        if (!await page.locator('#workspace-settings-link').isVisible()) await page.locator('#workspace-menu').click();
        await page.locator('#workspace-settings-link').click();
    }
    const parent = ['generation', 'prompts'].includes(id) ? 'connection' : id;
    if (await page.locator('#workspace-settings-category').isVisible()) await page.locator('#workspace-settings-category').selectOption(parent);
    else await page.locator(`.workspace-settings-rail [data-workspace-action="${parent}"]`).click();
    if (parent !== id) await page.locator(`[data-service-destination="${id}"]`).click();
    await expect(page.locator('.workspace-mounted-panel')).toHaveCount(1);
    if (!await page.locator('#workspace-advanced-settings').isChecked()) await page.locator('#workspace-advanced-settings').check();
    await settle(page);
}

async function expand(page) {
    // Use real clicks so native disclosure code, sizing and focus behavior run.
    for (let pass = 0; pass < 4; pass++) {
        const nodes = page.locator('.workspace-mounted-panel details:not([open]) > summary, .workspace-mounted-panel .inline-drawer-toggle:is(.down, :has(.down))');
        let changed = false;
        for (const node of await nodes.all()) {
            if (!await node.isVisible()) continue;
            await node.click(); changed = true;
        }
        if (!changed) break;
        await settle(page);
    }
}

async function inspect(page, label, testInfo, capture = true) {
    await settle(page);
    const state = await page.evaluate(() => {
        const root = document.querySelector('.workspace-mounted-panel') || document.querySelector('dialog[open]') || document.querySelector('#workspace-view');
        const scroller = document.querySelector('.workspace-settings-content');
        const savedScroll = scroller?.scrollTop;
        const controls = [];
        for (const node of root.querySelectorAll('button,input:not([type=hidden]),select,textarea,a[href],summary,[role=button],[tabindex="0"]')) {
            if (!node.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) || node.closest('[inert]')) continue;
            if (!node.matches('.select2-hidden-accessible')) node.scrollIntoView({ block: 'center', inline: 'nearest' });
            const r = node.getBoundingClientRect();
            if (!r.width || !r.height) continue;
            const inline = node.tagName === 'A' && getComputedStyle(node).display === 'inline';
            const target = inline ? [...node.getClientRects()].find(rect => rect.top >= 0 && rect.bottom <= innerHeight && rect.width > 0) || r : r;
            const x = Math.min(innerWidth - 1, Math.max(1, target.left + target.width / 2));
            const y = Math.min(innerHeight - 1, Math.max(1, target.top + target.height / 2));
            const hit = document.elementFromPoint(x, y);
            const reachable = node === hit || node.contains(hit) || hit?.closest('label')?.control === node;
            const identity = node.id || node.getAttribute('name') || node.dataset.workspaceAction || node.dataset.action || node.className;
            const name = node.getAttribute('aria-label') || node.getAttribute('title') || [...(node.labels || [])].map(label => label.textContent.trim()).join(' ') || node.textContent.trim().slice(0, 100) || node.getAttribute('placeholder') || '';
            controls.push({ identity, name, tag: node.tagName, type: node.type, disabled: Boolean(node.disabled || node.closest('.disabled, [aria-disabled="true"]')), width: Math.round(r.width), height: Math.round(r.height), reachable,
                nativeProxy: node.matches('.select2-hidden-accessible'), sharedRange: node.type === 'range' && Boolean(node.closest('.doubleRangeInputContainer')),
                outside: target.left < -1 || target.top < -1 || target.right > innerWidth + 1 || target.bottom > innerHeight + 1,
                coveredBy: reachable ? '' : hit?.id || hit?.className,
                options: node.tagName === 'SELECT' ? [...node.options].map(o => ({ value: o.value, text: o.text, disabled: o.disabled })) : undefined });
        }
        if (scroller) scroller.scrollTop = savedScroll;
        for (let parent = root; parent; parent = parent.parentElement) parent.scrollLeft = 0;
        const r = root.getBoundingClientRect();
        return { viewport: { width: innerWidth, height: innerHeight }, background: getComputedStyle(document.querySelector('#bg1')).backgroundImage,
            panel: { width: r.width, scrollWidth: root.scrollWidth, clientWidth: root.clientWidth }, controls,
            overflowElements: [...root.querySelectorAll('*')].filter(n => n.checkVisibility() && !n.matches('.select2-hidden-accessible') && n.getBoundingClientRect().right > r.right + 1).slice(0, 35).map(n => ({ id: n.id, className: n.className, text: n.textContent.trim().slice(0, 80), width: n.getBoundingClientRect().width, minWidth: getComputedStyle(n).minWidth, whiteSpace: getComputedStyle(n).whiteSpace })) };
    });
    state.label = label;
    if (state.panel.scrollWidth > state.panel.clientWidth + 1) fs.writeFileSync(testInfo.outputPath(`${label}-overflow.json`), JSON.stringify(state, null, 2));
    expect(state.panel.scrollWidth, `${label}: panel requires horizontal scrolling`).toBeLessThanOrEqual(state.panel.clientWidth + 1);
    expect(state.controls.filter(control => !control.disabled && !control.nativeProxy && !control.sharedRange && (control.outside || !control.reachable)), `${label}: obscured or offscreen controls`).toEqual([]);
    if (capture) {
        await page.locator('.workspace-settings-content').evaluate(n => n.scrollTop = 0);
        await page.locator('#sheld').evaluate(n => n.scrollTop = 0);
        await page.screenshot({ path: testInfo.outputPath(`${label}.png`) });
    }
    return state;
}

async function exerciseToggles(page, testInfo, label, visited = new Set()) {
    const actions = [], states = [];
    const fields = () => page.locator('.workspace-mounted-panel input, .workspace-mounted-panel select, .workspace-mounted-panel textarea').evaluateAll(nodes => nodes.filter(n => n.checkVisibility()).map(n => n.id || n.name));
    const visit = async depth => {
        if (depth > 8) throw new Error('Unreviewed settings disclosure nesting');
        for (const input of await page.locator('.workspace-mounted-panel input[type="checkbox"], .workspace-mounted-panel input[type="radio"]').elementHandles()) {
            if (!await input.isVisible() || await input.isDisabled()) continue;
            const key = await input.evaluate(n => n.id || `${n.name}:${n.value}`);
            if (key === 'workspace-layout-toggle' || visited.has(key)) continue;
            visited.add(key);
            const checked = await input.isChecked();
            const radio = await input.evaluate(n => n.type === 'radio');
            if (radio && checked) continue;
            const previousRadio = radio ? await input.evaluateHandle(n => [...document.querySelectorAll('input[type="radio"]')].find(other => other.name === n.name && other.checked)) : null;
            const before = await fields();
            await input.click(); await settle(page);
            const current = await input.isChecked();
            if (current === checked) {
                await expect(page.locator('.toast-message').last()).toBeVisible();
                actions.push({ label, width: page.viewportSize().width, key, from: checked, to: current, blockedWithFeedback: true });
                await previousRadio?.dispose();
                continue;
            }
            const added = (await fields()).filter(key => !before.includes(key));
            actions.push({ label, width: page.viewportSize().width, key, from: checked, to: !checked, revealed: added });
            if (added.length) {
                states.push(await inspect(page, `toggle-${label}-${key}`.replace(/[^a-zA-Z0-9_-]/g, '_'), testInfo));
                await visit(depth + 1);
            }
            if (radio) {
                const previous = previousRadio?.asElement();
                if (previous) await previous.check();
                await previousRadio?.dispose();
            } else await input.setChecked(checked);
            await settle(page);
        }
    };
    await visit(0);
    return { actions, states };
}

test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(8000);
    page.uiDiagnostics = { pageErrors: [], pageErrorDetails: [], consoleErrors: [], failedRequests: [] };
    page.on('pageerror', error => { page.uiDiagnostics.pageErrors.push(error.message); page.uiDiagnostics.pageErrorDetails.push(error.stack); });
    page.on('console', message => { if (message.type() === 'error') page.uiDiagnostics.consoleErrors.push(message.text()); });
    page.on('requestfailed', request => page.uiDiagnostics.failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
    let saved;
    await page.addInitScript(() => {
        window.__uiActions = [];
        for (const type of ['click', 'change']) document.addEventListener(type, event => {
            const n = event.target.closest('button,input,select,textarea,a,summary,[role=button],[data-workspace-action]');
            if (n) window.__uiActions.push({ type, id: n.id, action: n.dataset.workspaceAction || n.dataset.action || n.dataset.serviceDestination, name: n.getAttribute('aria-label') || n.title || n.textContent.trim().slice(0, 100), value: n.type === 'password' ? undefined : n.value });
        }, true);
    });
    await page.route('**/api/settings/get', async route => {
        const response = await route.fetch(); const body = await response.json();
        const s = saved || JSON.parse(body.settings);
        if (!saved) {
            s.firstRun = false; s.active_character = null; s.active_group = null; s.main_api = 'openai';
            s.power_user.auto_connect = false; s.power_user.font_scale = 1;
            s.accountStorage = { ...s.accountStorage, workspaceLayout: 'true', workspaceAdvancedSettings: 'false', workspaceArchivedChats: '[]' };
            s.extension_settings.serviceConnections = { url: '' };
        }
        body.settings = JSON.stringify(s); await route.fulfill({ response, json: body });
    });
    await page.route('**/api/settings/save', async route => { saved = route.request().postDataJSON(); await route.fulfill({ json: { result: 'ok' } }); });
    await page.goto('/');
    await expect(page.locator('#preloader')).toHaveCount(0, { timeout: 30000 });
    await page.locator('#workspace-navigation [data-workspace-action="characters"]').click();
    await expect(page.locator('.workspace-library-card').first()).toBeVisible();
    await page.locator('.workspace-library-card').first().click();
    await page.getByRole('button', { name: 'Start new story', exact: true }).click();
    await expect(page.locator('#send_textarea')).toBeVisible();
});

test('audit background menus folders selection fitting and portrait layering with selected backgrounds', async ({ page }, testInfo) => {
    const checks = [];
    const suffix = Date.now().toString(36);
    const accept = async value => {
        const popup = page.locator('dialog[open]');
        if (value !== undefined) await popup.locator('.popup-input').fill(value);
        await popup.locator('.popup-button-ok').click();
        await expect(popup).toHaveCount(0);
    };
    const menu = async (tile, action) => {
        await tile.scrollIntoViewIfNeeded();
        if (await tile.locator('.mobile-only-menu-toggle').isVisible()) {
            if (!await tile.evaluate(n => n.classList.contains('mobile-menu-open'))) await tile.locator('.mobile-only-menu-toggle').click();
        } else await tile.focus();
        await tile.locator(`[data-action="${action}"]`).click();
    };
    for (const width of [1280, 390, 320]) {
        await page.setViewportSize({ width, height: 800 });
        await category(page, 'backgrounds');
        for (const button of ['bg_thumb_zoom_in', 'bg_thumb_zoom_out']) {
            for (let step = 0; step < 8 && !await page.locator(`#${button}`).isDisabled(); step++) {
                const before = await page.locator('#bg_menu_content').evaluate(n => getComputedStyle(n).gridTemplateColumns);
                await page.locator(`#${button}`).click(); await settle(page);
                const after = await page.locator('#bg_menu_content').evaluate(n => getComputedStyle(n).gridTemplateColumns);
                expect(after).not.toBe(before);
            }
        }
        await page.locator('.bg_tabs_list a[href$="#bg_chat_tab"]').click();
        await expect(page.locator('#bg_chat_tab')).toBeVisible();
        await page.locator('.bg_tabs_list a[href$="#bg_global_tab"]').click();
        await page.locator('#add_bg_button').setInputFiles({ name: `audit-bright-${suffix}-${width}.jpg`, mimeType: 'image/jpeg', buffer: fs.readFileSync(new URL('../default/content/backgrounds/_white.jpg', import.meta.url)) });
        let tile = page.locator(`.bg_example[bgfile="audit-bright-${suffix}-${width}.jpg"]`);
        await expect(tile).toBeVisible();
        await tile.click();
        await expect(page.locator('#bg1')).toHaveCSS('background-image', new RegExp(`audit-bright-${suffix}-${width}`));
        for (const value of ['classic', 'cover', 'contain', 'stretch', 'center']) await page.locator('#background_fitting').selectOption(value);
        for (const value of ['az', 'za', 'newest', 'oldest']) await page.locator('#bg-sort').selectOption(value);
        await page.locator('#bg-sort').selectOption('az');
        await page.locator('#bg-filter').fill(`audit-bright-${suffix}-${width}`);
        await expect(page.locator('#bg_menu_content .bg_example:visible')).toHaveCount(1);
        await page.locator('#bg-filter').fill('');
        await menu(tile, 'lock');
        await expect(tile).toHaveClass(/locked-background/);
        if (width < 900) {
            // One Escape must dismiss only the foreground thumbnail menu.
            await tile.locator('.mobile-only-menu-toggle').click();
            await page.keyboard.press('Escape');
            await expect(page.locator('#workspace-settings-shell')).toBeVisible();
            await expect(tile).not.toHaveClass(/mobile-menu-open/);
            await expect(tile.locator('.mobile-only-menu-toggle')).toBeFocused();
            await tile.locator('.mobile-only-menu-toggle').click();
            await page.locator('#bg-filter').click();
            await expect(tile).not.toHaveClass(/mobile-menu-open/);
        }
        await menu(tile, 'unlock');
        await expect(tile).not.toHaveClass(/locked-background/);
        await menu(tile, 'edit');
        await accept(`audit-renamed-${suffix}-${width}`);
        tile = page.locator(`.bg_example[bgfile="audit-renamed-${suffix}-${width}.jpg"]`);
        await expect(tile).toBeVisible();
        await page.locator('#bg_add_folder_button').click();
        await accept(`Audit folder ${suffix} ${width}`);
        const folder = page.locator('.bg_folder_tile').filter({ hasText: `Audit folder ${suffix} ${width}` });
        await expect(folder).toBeVisible();
        await menu(tile, 'folder');
        await page.locator('dialog[open]').getByLabel(`Audit folder ${suffix} ${width}`, { exact: true }).check();
        await accept();
        await folder.press('Enter');
        await expect(page.locator('#bg_current_folder_name')).toHaveText(`Audit folder ${suffix} ${width}`);
        await expect(tile).toBeVisible();
        await menu(tile, 'set-cover');
        await page.locator('#bg_selection_mode_button').click();
        await tile.click();
        await expect(tile).toHaveClass(/folder-group-selected/);
        await page.locator('#bg_folder_remove_selected_button').click();
        await expect(tile).toHaveCount(0);
        await page.locator('#bg_back_to_folders').click();
        await page.locator('#bg_selection_mode_button').click();
        await tile.click();
        await page.locator('#bg_group_add_to_folder_button').click();
        await page.locator('dialog[open]').getByLabel(`Audit folder ${suffix} ${width}`, { exact: true }).check();
        await accept();
        await folder.press('Enter');
        await expect(tile).toBeVisible();
        await page.locator('#bg_back_to_folders').click();
        await menu(folder, 'rename-folder');
        await accept(`Audit renamed folder ${suffix} ${width}`);
        const renamedFolder = page.locator('.bg_folder_tile').filter({ hasText: `Audit renamed folder ${suffix} ${width}` });
        await menu(renamedFolder, 'delete-folder');
        await page.keyboard.press('Escape');
        await expect(renamedFolder).toBeVisible();
        await menu(renamedFolder, 'delete-folder');
        await accept();
        await expect(renamedFolder).toHaveCount(0);
        await tile.click();
        await page.locator('[data-workspace-action="close-panel"]').click();
        await page.locator('#chat .avatar').first().click();
        await expect(page.locator('dialog[open] .workspace-portrait-image')).toBeInViewport();
        await page.screenshot({ path: testInfo.outputPath(`background-portrait-${width}.png`) });
        await page.keyboard.press('Escape');
        await category(page, 'backgrounds');
        await menu(tile, 'delete');
        await page.keyboard.press('Escape');
        await expect(tile).toBeVisible();
        await menu(tile, 'delete');
        await accept();
        await expect(tile).toHaveCount(0);
        checks.push({ width, uploaded: true, fittingModes: 5, sortModes: 4, searched: true, lockedAndUnlocked: true, renamed: true, folderAssignedAndCoverSet: true, folderRenamedAndDeleted: true, confirmedAndCancelledDeletion: true });
    }
    fs.writeFileSync(testInfo.outputPath('background-checks.json'), JSON.stringify(checks, null, 2));
});

test.afterEach(async ({ page }, info) => {
    fs.writeFileSync(info.outputPath('actual-actions.json'), JSON.stringify(await page.evaluate(() => window.__uiActions), null, 2));
    fs.writeFileSync(info.outputPath('browser-diagnostics.json'), JSON.stringify(page.uiDiagnostics, null, 2));
    expect(page.uiDiagnostics.pageErrors).toEqual([]);
});

test('audit every settings destination and expanded section at eight viewport sizes', async ({ page }, testInfo) => {
    const states = [];
    const categories = await page.evaluate(async () => (await import('/scripts/workspace-views.js')).workspaceSettings.map(s => s.id));
    try {
        for (const [width, height] of [[1440, 900], [1024, 768], [768, 1024], [448, 921], [390, 844], [320, 568], [844, 390], [320, 400]]) {
            await page.setViewportSize({ width, height });
            for (const id of categories) {
                await category(page, id); await expand(page);
                states.push(await inspect(page, `${id}-${width}x${height}`, testInfo));
                // The first state is All controls. Individual sections must remain
                // independently navigable and retain the mounted native owner.
                const sections = await page.locator('.workspace-settings-sections button').evaluateAll(nodes => nodes.map(n => n.dataset.section));
                for (const section of sections.filter(s => s !== 'all')) {
                    await page.locator(`[data-workspace-action="settings-section"][data-section="${section}"]`).click();
                    await expand(page);
                    states.push(await inspect(page, `${id}-${section}-${width}x${height}`, testInfo, width === 390));
                }
            }
        }
    } finally { fs.writeFileSync(testInfo.outputPath('control-inventory.json'), JSON.stringify(states, null, 2)); }
});

test('audit provider-specific forms and dependent controls on desktop and phone', async ({ page }, testInfo) => {
    const states = [];
    const toggles = [], toggleStates = [], visited = new Set();
    const sources = [
        ['connection', 'main_api'], ['connection', 'chat_completion_source'],
        ['connection', 'textgen_type'],
        ['image-settings', 'sd_source'], ['voice-settings', 'tts_provider'],
        ['embeddings-settings', 'vectors_source'], ['vision-settings', 'caption_source'], ['vision-settings', 'caption_multimodal_api'],
        ['extensions', 'translation_provider'], ['extensions', 'expression_api'],
        ['memory-settings', 'summary_source'],
    ];
    try {
        for (const [id, selector] of sources) {
            await page.setViewportSize({ width: 1280, height: 800 });
            await category(page, id); await expand(page);
            if (selector === 'textgen_type') await page.locator('#main_api').selectOption('textgenerationwebui');
            if (selector === 'caption_multimodal_api') await page.locator('#caption_source').selectOption('multimodal');
            const control = page.locator(`#${selector}`);
            const initial = await control.inputValue();
            const options = await control.locator('option:not(:disabled)').evaluateAll(nodes => nodes.map(n => n.value));
            for (const value of options) {
                await page.setViewportSize({ width: 1280, height: 800 });
                await control.selectOption(value); await settle(page); await expand(page);
                const changed = await exerciseToggles(page, testInfo, `${selector}-${value}`, visited);
                toggles.push(...changed.actions); toggleStates.push(...changed.states);
                for (const [width, height] of [[1280, 800], [390, 844], [320, 400]]) {
                    await page.setViewportSize({ width, height });
                    const name = `${selector}-${value || 'none'}-${width}`.replace(/[^a-zA-Z0-9_-]/g, '_');
                    states.push(await inspect(page, name, testInfo));
                }
            }
            await control.selectOption(initial);
            if (selector === 'textgen_type') await page.locator('#main_api').selectOption('openai');
        }
    } finally {
        fs.writeFileSync(testInfo.outputPath('provider-control-inventory.json'), JSON.stringify(states, null, 2));
        fs.writeFileSync(testInfo.outputPath('provider-toggle-actions.json'), JSON.stringify(toggles, null, 2));
        fs.writeFileSync(testInfo.outputPath('provider-toggle-inventory.json'), JSON.stringify(toggleStates, null, 2));
    }
});

test('audit enlarged text insertion controls and reading surfaces with bright backgrounds', async ({ page }, testInfo) => {
    for (const [width, height] of [[390, 844], [320, 568], [844, 390], [320, 400]]) {
        await page.setViewportSize({ width, height });
        await page.locator('#font_scale').evaluate(input => {
            input.value = '1.5'; input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            document.documentElement.style.fontSize = '20px';
        });
        await category(page, 'authors-note'); await expand(page);
        for (const field of ['extension_floating', 'extension_default']) {
            const radio = page.locator(`#${field}_position_depth`);
            await radio.check();
            const label = radio.locator('..');
            const text = label.locator('span').first();
            const r = await text.boundingBox();
            // The complete insertion label must remain readable instead of
            // collapsing to one or two letters per line beside the number field.
            expect(r.width).toBeGreaterThan(90);
            await page.locator(`#${field}_depth`).fill('3');
            await page.locator(`#${field}_role`).selectOption('1');
            await page.locator(`#${field}_role`).press('Tab');
            await expect(label).toBeInViewport();
        }
        await page.screenshot({ path: testInfo.outputPath(`note-large-${width}x${height}.png`) });
        await category(page, 'backgrounds');
        await page.locator('.bg_example[bgfile="_white.jpg"]').click();
        await page.locator('[data-workspace-action="close-panel"]').click();
        await page.locator('#chat .avatar').first().click();
        await expect(page.getByRole('button', { name: 'Close portrait', exact: true })).toBeInViewport();
        await expect(page.locator('.workspace-portrait-image')).toBeInViewport();
        await page.screenshot({ path: testInfo.outputPath(`portrait-large-${width}x${height}.png`) });
        await page.keyboard.press('Escape');
    }
});

test('audit native message editors and chat panels above selected backgrounds at every size', async ({ page }, testInfo) => {
    const openActions = async () => {
        const tools = page.locator('.workspace-creative-menu');
        if (!await tools.evaluate(n => n.open)) await tools.locator('summary').click();
        if (await page.locator('#options_button').getAttribute('aria-expanded') !== 'true') await page.locator('#options_button').click();
        await expect(page.locator('#options')).toBeVisible();
    };
    const reachable = async control => {
        await control.scrollIntoViewIfNeeded();
        await expect(control).toBeInViewport();
        expect(await control.evaluate(n => {
            const r = n.getBoundingClientRect(); const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
            return n === hit || n.contains(hit);
        })).toBe(true);
    };
    await category(page, 'backgrounds');
    await page.locator('.bg_example[bgfile="_white.jpg"]').click();
    await page.locator('[data-workspace-action="close-panel"]').click();
    for (const [width, height] of [[1280, 800], [1024, 768], [768, 1024], [448, 921], [390, 844], [320, 568], [844, 390], [320, 400]]) {
        await page.setViewportSize({ width, height });
        const message = page.locator('#chat .mes').first();
        await message.locator('.extraMesButtonsHint').click();
        await expect(message.locator('.extraMesButtons')).toHaveClass(/visible/);
        for (const control of await message.locator('.extraMesButtons .mes_button:visible').all()) {
            await control.scrollIntoViewIfNeeded();
            await reachable(control);
        }
        await page.screenshot({ path: testInfo.outputPath(`message-actions-${width}x${height}.png`) });
        await message.locator('.mes_edit').click();
        const edit = page.locator('#curEditTextarea');
        await expect(edit).toBeVisible();
        await edit.fill('A neutral edited line for the UI audit.');
        await reachable(message.locator('.mes_edit_done'));
        await reachable(message.locator('.mes_edit_cancel'));
        await page.screenshot({ path: testInfo.outputPath(`message-editor-${width}x${height}.png`) });
        await message.locator('.mes_edit_done').click();
        await expect(message.locator('.mes_text')).toHaveText('A neutral edited line for the UI audit.');
        for (const [action, panel, close] of [['option_toggle_CFG', 'cfgConfig', 'CFGClose'], ['option_toggle_logprobs', 'logprobsViewer', 'logprobsViewerClose']]) {
            await openActions();
            await page.locator(`#${action}`).click();
            await expect(page.locator(`#${panel}`)).toBeVisible();
            await reachable(page.locator(`#${close}`));
            const r = await page.locator(`#${panel}`).boundingBox();
            expect(r.x).toBeGreaterThanOrEqual(0);
            expect(r.x + r.width).toBeLessThanOrEqual(width + 1);
            await page.screenshot({ path: testInfo.outputPath(`${panel}-${width}x${height}.png`) });
            await page.locator(`#${close}`).click();
            await expect(page.locator(`#${panel}`)).toBeHidden();
        }
        await openActions();
        await page.locator('#option_select_chat').click();
        await expect(page.locator('#select_chat_popup')).toBeVisible();
        await reachable(page.locator('#select_chat_cross'));
        await page.screenshot({ path: testInfo.outputPath(`chat-files-${width}x${height}.png`) });
        await page.locator('#select_chat_cross').click();
        await expect(page.locator('#select_chat_popup')).toBeHidden();
    }
});

test('native popovers remain reachable after classic layout restoration in short windows', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await category(page, 'settings');
    await page.locator('#workspace-layout-toggle').uncheck();
    await expect(page.locator('body')).not.toHaveClass(/workspace-ui/);
    for (const [trigger, menu] of [['options_button', 'options'], ['extensionsMenuButton', 'extensionsMenu']]) {
        await page.locator(`#${trigger}`).click();
        await expect(page.locator(`#${menu}`)).toBeVisible();
        expect(await page.locator(`#${menu}`).evaluate(n => {
            const r = n.getBoundingClientRect(); return r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight;
        })).toBe(true);
        await page.screenshot({ path: testInfo.outputPath(`classic-${menu}-844x390.png`) });
        await page.locator(`#${trigger}`).click();
    }
    await page.locator('#workspace-restore').click();
    await expect(page.locator('body')).toHaveClass(/workspace-ui/);
});

test('audit checkbox and radio states including newly revealed settings controls', async ({ page }, testInfo) => {
    const changes = [];
    const revealed = [];
    const categories = await page.evaluate(async () => (await import('/scripts/workspace-views.js')).workspaceSettings.map(s => s.id));
    try {
        for (const width of [1280, 390]) {
            await page.setViewportSize({ width, height: 844 });
            for (const id of categories) {
                await category(page, id); await expand(page);
                const result = await exerciseToggles(page, testInfo, `${id}-${width}`);
                changes.push(...result.actions); revealed.push(...result.states);
            }
        }
    } finally {
        fs.writeFileSync(testInfo.outputPath('toggle-actions.json'), JSON.stringify(changes, null, 2));
        fs.writeFileSync(testInfo.outputPath('toggle-control-inventory.json'), JSON.stringify(revealed, null, 2));
    }
});

test('speech provider load failures remain in settings and switching provider clears the failure', async ({ page }, testInfo) => {
    await category(page, 'voice-settings'); await expand(page);
    await page.locator('#tts_provider').selectOption('Edge');
    await expect(page.locator('#tts_status')).toContainText('could not load');
    await expect(page.locator('#tts_provider')).toBeEnabled();
    await page.screenshot({ path: testInfo.outputPath('speech-provider-failure.png') });
    await page.locator('#tts_provider').selectOption('System');
    await expect(page.locator('#tts_status')).toContainText('settings loaded');
    await expect(page.locator('#tts_status')).not.toHaveClass(/tts-status-error/);
});

test('a rejected background deletion preserves the selected image and can be retried', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await category(page, 'backgrounds');
    const name = `audit-delete-retry-${Date.now()}.jpg`;
    await page.locator('#add_bg_button').setInputFiles({ name, mimeType: 'image/jpeg', buffer: fs.readFileSync(new URL('../default/content/backgrounds/_white.jpg', import.meta.url)) });
    const tile = page.locator(`.bg_example[bgfile="${name}"]`);
    await tile.click();
    const before = await page.locator('#bg1').getAttribute('style');
    const remove = async () => {
        await tile.locator('.mobile-only-menu-toggle').click();
        await tile.locator('[data-action="delete"]').click();
        await page.locator('dialog[open] .popup-button-ok').click();
    };
    await page.route('**/api/backgrounds/delete', route => route.fulfill({ status: 503, json: { error: 'Synthetic unavailable storage' } }));
    await remove();
    await expect(page.locator('.toast-message').filter({ hasText: 'delete background' })).toBeVisible();
    await expect(tile).toBeVisible();
    await expect(page.locator('#bg1')).toHaveAttribute('style', before);
    await page.screenshot({ path: testInfo.outputPath('background-delete-failure.png') });
    await page.unroute('**/api/backgrounds/delete');
    await remove();
    await expect(tile).toHaveCount(0);
});

test('XTTS settings failures keep local edits and Reload retries the speech server', async ({ page }) => {
    let fail = false;
    await page.route('**/speakers', route => route.fulfill({ json: [] }));
    await page.route('**/set_tts_settings', route => route.fulfill({ status: fail ? 503 : 200, json: fail ? { error: 'Synthetic unavailable XTTS' } : { result: 'ok' } }));
    await category(page, 'voice-settings'); await expand(page);
    await page.locator('#tts_provider').selectOption('XTTSv2');
    await expect(page.locator('#tts_status')).toContainText('settings loaded');
    fail = true;
    const checkbox = page.locator('#xtts_enable_text_splitting');
    const initial = await checkbox.isChecked();
    await checkbox.setChecked(!initial);
    await expect(page.locator('#tts_status')).toContainText('saved locally');
    await expect(checkbox).toBeChecked({ checked: !initial });
    fail = false;
    await page.locator('#tts_refresh').click();
    await expect(page.locator('#tts_status')).toContainText('Successfully applied settings');
});

test('native extension dialogs gallery and file entry points remain reachable with a selected background', async ({ page }, testInfo) => {
    const openExtensions = async () => {
        const more = page.locator('.workspace-creative-menu');
        if (!await more.evaluate(n => n.open)) await more.locator('summary').click();
        if (await page.locator('#extensionsMenuButton').getAttribute('aria-expanded') !== 'true') await page.locator('#extensionsMenuButton').click();
        await expect(page.locator('#extensionsMenu')).toBeVisible();
    };
    await category(page, 'backgrounds');
    await page.locator('.bg_example[bgfile="_white.jpg"]').click();
    await category(page, 'vision-settings');
    await page.locator('#caption_source').selectOption('local');
    await page.locator('[data-workspace-action="close-panel"]').click();
    for (const [width, height] of [[1280, 800], [390, 844], [320, 568], [844, 390]]) {
        await page.setViewportSize({ width, height });
        for (const action of ['manageAttachments', 'token_counter']) {
            await openExtensions(); await page.locator(`#${action}`).click();
            const popup = page.locator('dialog[open]');
            await expect(popup).toBeVisible();
            if (action === 'manageAttachments') {
                await popup.locator('#attachmentSearch').fill('No fixture attachments');
                await popup.locator('#attachmentSort').selectOption({ index: 2 });
                await popup.locator('.attachmentsBulkEditButton').click();
                await popup.locator('.bulkActionSelectAll').click();
                await popup.locator('.bulkActionSelectNone').click();
            } else {
                await popup.locator('#token_counter_textarea').fill('A neutral lantern line.');
                await expect.poll(() => popup.locator('#token_counter_result').innerText()).not.toBe('0');
            }
            expect(await popup.evaluate(n => n.scrollWidth <= n.clientWidth + 1)).toBe(true);
            await expect(popup.locator('.popup-button-ok')).toBeInViewport();
            await page.screenshot({ path: testInfo.outputPath(`${action}-${width}x${height}.png`) });
            await popup.locator('.popup-button-ok').click();
            await expect(popup).toHaveCount(0);
        }
        await openExtensions(); await page.locator('#show_gallery_wand_button').click();
        const gallery = page.locator('#gallery');
        await expect(gallery).toBeVisible();
        await expect(gallery.locator('.gallery-upload-help')).toContainText('Drop images here');
        const close = gallery.locator('.dragClose');
        await expect(close).toHaveAttribute('role', 'button');
        await expect(close).toHaveAccessibleName('Close gallery');
        expect(await close.evaluate(n => {
            const r = n.getBoundingClientRect(); return n === document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        })).toBe(true);
        expect(await gallery.evaluate(n => { const r = n.getBoundingClientRect(); return r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight; })).toBe(true);
        await page.screenshot({ path: testInfo.outputPath(`gallery-${width}x${height}.png`) });
        if (width === 1280) await close.click();
        else await close.press(width === 320 ? 'Space' : 'Enter');
        await expect(gallery).toHaveCount(0);
        for (const action of ['attachFile', 'send_picture']) {
            await openExtensions();
            const chooser = page.waitForEvent('filechooser');
            await page.locator(`#${action}`).click();
            await (await chooser).setFiles([]);
        }
    }
});

test('populated lorebook editor and persona dialogs retain usable controls with a selected background', async ({ page }, testInfo) => {
    await category(page, 'backgrounds');
    await page.locator('.bg_example[bgfile="_white.jpg"]').click();
    await category(page, 'world');
    const name = `UI audit lore ${Date.now()}`;
    await page.locator('#world_create_button').click();
    await page.locator('dialog[open] .popup-input').fill(name);
    await page.locator('dialog[open] .popup-button-ok').click();
    await expect(page.locator('#world_editor_select option:checked')).toHaveText(name);
    await page.locator('#world_popup_new').click();
    const entry = page.locator('#world_popup_entries_list .world_entry').first();
    await expect(entry).toBeVisible();
    await entry.locator('.inline-drawer-toggle').first().click();
    await expand(page);
    await entry.locator('textarea[name="comment"]').fill('The lantern archive');
    await entry.locator('textarea[name="content"]').fill('A neutral synthetic lore entry used to inspect the native editor.');
    for (const [width, height] of [[1440, 900], [768, 1024], [390, 844], [320, 400], [844, 390]]) {
        await page.setViewportSize({ width, height });
        await inspect(page, `populated-lore-${width}x${height}`, testInfo);
    }
    await page.locator('#world_popup_delete').click();
    await page.keyboard.press('Escape');
    await expect(entry).toBeVisible();
    await page.locator('#world_popup_delete').click();
    await page.locator('dialog[open] .popup-button-ok').click();
    await expect(page.locator('#world_editor_select option').filter({ hasText: name })).toHaveCount(0);
    await category(page, 'persona');
    for (const [width, height] of [[1280, 800], [390, 844], [320, 400], [844, 390]]) {
        await page.setViewportSize({ width, height });
        for (const action of ['create_dummy_persona', 'persona_rename_button', 'persona_delete_button']) {
            await page.locator(`#${action}`).click();
            const popup = page.locator('dialog[open]');
            await expect(popup).toBeVisible();
            expect(await popup.evaluate(n => n.scrollWidth <= n.clientWidth + 1)).toBe(true);
            await expect(popup.locator('.popup-button-ok')).toBeInViewport();
            await page.screenshot({ path: testInfo.outputPath(`${action}-${width}x${height}.png`) });
            await page.keyboard.press('Escape');
            await expect(popup).toHaveCount(0);
        }
    }
});

test('advanced provider rows fit phone panels without horizontal scrolling', async ({ page }, testInfo) => {
    for (const [id, selector, value] of [
        ['connection', 'chat_completion_source', 'openai'],
        ['connection', 'chat_completion_source', 'vertexai'],
        ['extensions', 'translation_provider', 'lingva'],
        ['extensions', 'translation_provider', 'google'],
    ]) {
        await page.setViewportSize({ width: 1280, height: 800 });
        await category(page, id); await expand(page);
        await page.locator(`#${selector}`).selectOption(value);
        for (const width of [390, 320]) {
            await page.setViewportSize({ width, height: 844 });
            await inspect(page, `${selector}-${value}-${width}`, testInfo);
        }
    }
});
