import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import http from 'node:http';

// Deliberately separate from the behavioral regression suite: this audit records
// reachable controls, disclosures and provider forms, including below the fold.
test.use({ channel: 'chromium', video: 'off', viewport: { width: 1280, height: 800 } });
test.setTimeout(900000);
test.skip(!process.env.ST_UI_AUDIT, 'Set ST_UI_AUDIT=1 and use a fresh synthetic data root for the full UI audit.');

async function settle(page) {
    await page.evaluate(async () => {
        const frame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        await frame();
        // Disclosure and lore-state changes use both CSS transitions and jQuery
        // fades. Sample their final paint, preserving intentional inactive states.
        for (let pass = 0; pass < 3; pass++) {
            const root = document.querySelector('dialog[open]:modal') || document.querySelector('.workspace-mounted-panel') || document.querySelector('dialog[open]') || document.querySelector('#workspace-view');
            if (!root) return;
            const animations = root.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running' && Number.isFinite(animation.effect?.getComputedTiming().endTime) && !animation.effect?.target?.closest('#toast-container'));
            const jquery = window.jQuery;
            const fading = jquery ? jquery(root).find(':animated').addBack(':animated').filter((_, node) => !node.closest('#toast-container')) : null;
            if (!animations.length && !fading?.length) return;
            let timer;
            try {
                await Promise.race([
                    Promise.all([...animations.map(animation => animation.finished.catch(() => {})), ...(fading?.length ? [Promise.resolve(fading.promise('fx'))] : [])]),
                    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Native panel animations did not settle within 3 seconds')), 3000); }),
                ]);
            } finally { clearTimeout(timer); }
            await frame();
        }
    });
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

async function inspect(page, label, testInfo, capture = true, attempt = 0) {
    await settle(page);
    const state = await page.evaluate(() => {
        const modal = document.querySelector('dialog[open]:modal');
        const root = modal || document.querySelector('.workspace-mounted-panel') || document.querySelector('dialog[open]') || document.querySelector('#workspace-view');
        const scroller = document.querySelector('.workspace-settings-content');
        const savedScroll = scroller?.scrollTop;
        const unavailable = node => Boolean(node.disabled || node.matches(':disabled') || node.closest('[disabled],[aria-disabled="true"]') || getComputedStyle(node).pointerEvents === 'none');
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
            controls.push({ identity, name, tag: node.tagName, type: node.type, disabled: unavailable(node), width: Math.round(r.width), height: Math.round(r.height), reachable,
                nativeProxy: node.matches('.select2-hidden-accessible'), sharedRange: node.type === 'range' && Boolean(node.closest('.doubleRangeInputContainer')),
                outside: target.left < -1 || target.top < -1 || target.right > innerWidth + 1 || target.bottom > innerHeight + 1,
                coveredBy: reachable ? '' : hit?.id || hit?.className,
                options: node.tagName === 'SELECT' ? [...node.options].map(o => ({ value: o.value, text: o.text, disabled: o.disabled })) : undefined });
        }
        if (scroller) scroller.scrollTop = savedScroll;
        for (let parent = root; parent; parent = parent.parentElement) parent.scrollLeft = 0;
        const rgba = value => {
            const match = value.match(/^rgba?\(([^)]+)\)/);
            if (!match) return null;
            const values = match[1].split(/[, /]+/).map(Number);
            return [values[0], values[1], values[2], values[3] ?? 1];
        };
        const over = (front, back) => {
            const alpha = front[3] + back[3] * (1 - front[3]);
            return [...front.slice(0, 3).map((value, index) => alpha ? (value * front[3] + back[index] * back[3] * (1 - front[3])) / alpha : 0), alpha];
        };
        const luminance = rgb => rgb.map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
        const filterColor = (color, filters) => {
            const result = [...color];
            for (const match of filters.matchAll(/(brightness|grayscale)\(([^)]+)\)/g)) {
                const amount = match[2].endsWith('%') ? parseFloat(match[2]) / 100 : Number(match[2]);
                if (match[1] === 'brightness') for (let index = 0; index < 3; index++) result[index] = Math.min(255, result[index] * amount);
                else {
                    const gray = result[0] * .2126 + result[1] * .7152 + result[2] * .0722;
                    for (let index = 0; index < 3; index++) result[index] = result[index] * (1 - amount) + gray * amount;
                }
            }
            return result;
        };
        const contrastFindings = [];
        let contrastSamples = 0;
        const contrastRegions = { panel: 0, sidebar: 0, header: 0, composer: 0 };
        const shell = modal ? [] : [...document.querySelectorAll('#workspace-sidebar, #workspace-header, #form_sheld')];
        const paintedNodes = new Set([root, ...shell].flatMap(region => [region, ...region.querySelectorAll('*')]));
        for (const node of paintedNodes) {
            if (!node.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) || node.closest('[inert]') || node.matches('option,script,style,svg,i,.select2-hidden-accessible')) continue;
            const directText = [...node.childNodes].filter(child => child.nodeType === Node.TEXT_NODE).map(child => child.textContent.trim()).filter(Boolean).join(' ');
            const field = node.matches('input:not([type=checkbox],[type=radio],[type=range],[type=password],[type=color],[type=file],[type=hidden]),textarea,select');
            if (!directText && !field) continue;
            const style = getComputedStyle(node);
            const placeholder = field && !node.value && node.getAttribute('placeholder') ? getComputedStyle(node, '::placeholder') : null;
            const foreground = rgba(placeholder?.color || style.color);
            if (!foreground) continue;
            if (placeholder) foreground[3] *= Number(placeholder.opacity);
            let painted = foreground;
            let background = [0, 0, 0, 0];
            let opacity = 1;
            const opacitySources = [];
            const filterSources = [];
            for (let parent = node; parent; parent = parent.parentElement) {
                const computed = getComputedStyle(parent);
                const groupOpacity = Number(computed.opacity);
                opacity *= groupOpacity;
                if (Number(computed.opacity) < 1) opacitySources.push({ id: parent.id, className: parent.className, opacity: computed.opacity,
                    animations: parent.getAnimations().filter(animation => animation.playState === 'running' && Number.isFinite(animation.effect?.getComputedTiming().endTime)).length });
                // Group opacity fades its foreground and background together.
                // Fading text alone incorrectly flags colored native tag pills.
                let layer = rgba(computed.backgroundColor) || [0, 0, 0, 0];
                if (parent === document.body && parent.classList.contains('workspace-ui')) layer = [43, 47, 57, 1];
                painted = over(painted, layer); background = over(background, layer);
                if (computed.filter !== 'none') {
                    filterSources.push({ id: parent.id, className: parent.className, filter: computed.filter });
                    painted = filterColor(painted, computed.filter); background = filterColor(background, computed.filter);
                }
                painted[3] *= groupOpacity; background[3] *= groupOpacity;
            }
            // Opaque native panels dominate the backdrop. Transparent regions
            // use the lightest supported subdued-image composition.
            painted = over(painted, [43, 47, 57, 1]); background = over(background, [43, 47, 57, 1]);
            const a = luminance(painted.slice(0, 3)), b = luminance(background.slice(0, 3));
            const ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
            const icon = node.matches('.note-link-span, .switch_input_type_icon');
            const threshold = icon || parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.66 && Number(style.fontWeight) >= 700) ? 3 : 4.5;
            contrastSamples++;
            const region = node.closest('#workspace-sidebar') ? 'sidebar' : node.closest('#workspace-header') ? 'header' : node.closest('#form_sheld') ? 'composer' : 'panel';
            contrastRegions[region]++;
            if (ratio + 1e-6 < threshold) contrastFindings.push({ id: node.id, className: node.className, tag: node.tagName,
                text: (directText || node.getAttribute('placeholder') || node.value || '').slice(0, 100), ratio: Math.round(ratio * 100) / 100,
                threshold, kind: icon ? 'control-icon' : placeholder ? 'placeholder' : 'text', color: placeholder?.color || style.color, painted: painted.slice(0, 3), background: background.slice(0, 3).map(Math.round), opacity, opacitySources,
                filterSources, contextInactive: Boolean(node.closest('.disabledWIEntry,[data-cc-null],.disabled')), disabled: unavailable(node) });
        }
        const r = root.getBoundingClientRect();
        return { viewport: { width: innerWidth, height: innerHeight }, background: getComputedStyle(document.querySelector('#bg1')).backgroundImage,
            panel: { width: r.width, scrollWidth: root.scrollWidth, clientWidth: root.clientWidth }, controls, contrastSamples, contrastRegions, contrastFindings,
            overflowElements: [...root.querySelectorAll('*')].filter(n => n.checkVisibility() && !n.matches('.select2-hidden-accessible') && n.getBoundingClientRect().right > r.right + 1).slice(0, 35).map(n => ({ id: n.id, className: n.className, text: n.textContent.trim().slice(0, 80), width: n.getBoundingClientRect().width, minWidth: getComputedStyle(n).minWidth, whiteSpace: getComputedStyle(n).whiteSpace })) };
    });
    state.label = label;
    if (attempt < 2 && state.contrastFindings.some(finding => !finding.disabled && finding.opacitySources.some(source => source.animations > 0))) {
        fs.writeFileSync(testInfo.outputPath(`${label}-transition-${attempt}.json`), JSON.stringify(state, null, 2));
        return inspect(page, label, testInfo, capture, attempt + 1);
    }
    if (state.contrastFindings.length) fs.writeFileSync(testInfo.outputPath(`${label}-contrast.json`), JSON.stringify({ label, samples: state.contrastSamples, findings: state.contrastFindings }, null, 2));
    if (state.panel.scrollWidth > state.panel.clientWidth + 1) fs.writeFileSync(testInfo.outputPath(`${label}-overflow.json`), JSON.stringify(state, null, 2));
    expect(state.panel.scrollWidth, `${label}: panel requires horizontal scrolling`).toBeLessThanOrEqual(state.panel.clientWidth + 1);
    expect(state.controls.filter(control => !control.disabled && !control.nativeProxy && !control.sharedRange && (control.outside || !control.reachable)), `${label}: obscured or offscreen controls`).toEqual([]);
    expect(state.contrastFindings.filter(finding => !finding.disabled), `${label}: unreadable text or control icons after animations settle`).toEqual([]);
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
        for (const original of await page.locator('.workspace-mounted-panel input[type="checkbox"], .workspace-mounted-panel input[type="radio"]').elementHandles()) {
            const selector = await original.evaluate(node => node.id ? `input#${CSS.escape(node.id)}` : null);
            // Native provider forms may redraw while conditional fields are audited.
            // Resolve identified controls again for every action and restoration.
            const input = selector ? page.locator('.workspace-mounted-panel').locator(selector) : original;
            if (!await input.isVisible() || await input.isDisabled()) continue;
            const key = await input.evaluate(n => n.id || `${n.name}:${n.value}`);
            if (key === 'workspace-layout-toggle' || visited.has(key)) continue;
            visited.add(key);
            const checked = await input.isChecked();
            const radio = await input.evaluate(n => n.type === 'radio');
            if (radio && checked) continue;
            const previousRadio = radio ? await input.evaluateHandle(n => [...document.querySelectorAll('input[type="radio"]')].find(other => other.name === n.name && other.checked)) : null;
            const previousSelector = previousRadio ? await previousRadio.evaluate(node => node?.id ? `input#${CSS.escape(node.id)}` : null) : null;
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
            try {
                if (radio) {
                    const previous = previousSelector ? page.locator(previousSelector) : previousRadio?.asElement();
                    if (previous) await previous.check();
                    await previousRadio?.dispose();
                } else await input.setChecked(checked);
            } catch (error) {
                const control = await original.evaluate(node => {
                    const snapshotControl = candidate => {
                        if (!candidate) return null;
                        const box = candidate.getBoundingClientRect(), style = getComputedStyle(candidate);
                        const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
                        return { id: candidate.id, connected: candidate.isConnected, checked: candidate.checked,
                            disabled: candidate.disabled, visible: candidate.checkVisibility(), display: style.display,
                            visibility: style.visibility, opacity: style.opacity, transform: style.transform,
                            rect: { x: box.x, y: box.y, width: box.width, height: box.height },
                            hit: hit ? { tag: hit.tagName, id: hit.id, className: hit.className } : null };
                    };
                    const current = node.id ? document.querySelector(`input#${CSS.escape(node.id)}`) : null;
                    return { original: snapshotControl(node), current: snapshotControl(current), sameNode: node === current,
                        matches: node.id ? document.querySelectorAll(`input#${CSS.escape(node.id)}`).length : null,
                        focus: { tag: document.activeElement?.tagName, id: document.activeElement?.id } };
                });
                fs.writeFileSync(testInfo.outputPath('toggle-restoration-failure.json'), JSON.stringify({ label, key, checked, radio, control, error: error.message }, null, 2));
                throw error;
            }
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
    await expect(page.locator('#send_textarea')).toBeVisible({ timeout: 20000 });
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
        await expect(page.locator('.toast-message').filter({ hasText: 'Folder assignment updated' })).toBeVisible();
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
        await expect(page.locator('.toast-message').filter({ hasText: 'Added backgrounds to 1 folder(s)' })).toBeVisible();
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
        // Success notices from folder operations deliberately render above a
        // modal. Let those expire before testing the portrait's own paint.
        await expect(page.locator('#toast-container .toast')).toHaveCount(0, { timeout: 12000 });
        await settle(page);
        const portrait = await page.locator('dialog[open] .workspace-portrait-image').evaluate(node => {
            const rect = node.getBoundingClientRect();
            const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
            const ancestors = [];
            for (let parent = node; parent; parent = parent.parentElement) ancestors.push({ tag: parent.tagName, opacity: getComputedStyle(parent).opacity, animations: parent.getAnimations().filter(animation => animation.playState === 'running').length });
            return { topLayer: node.closest('dialog').matches(':modal'), imageReceivesHit: hit === node, ancestors };
        });
        fs.writeFileSync(testInfo.outputPath(`background-portrait-${width}.json`), JSON.stringify(portrait, null, 2));
        expect(portrait.topLayer).toBe(true); expect(portrait.imageReceivesHit).toBe(true);
        expect(portrait.ancestors.every(ancestor => ancestor.opacity === '1' && ancestor.animations === 0)).toBe(true);
        const paintedPortrait = await page.locator('dialog[open] .workspace-portrait-image').screenshot();
        const previousVisibility = await page.locator('#chat, #form_sheld').evaluateAll(nodes => nodes.map(node => {
            const value = node.style.visibility;
            node.style.visibility = 'hidden';
            return value;
        }));
        let isolatedPortrait;
        try { isolatedPortrait = await page.locator('dialog[open] .workspace-portrait-image').screenshot(); }
        finally { await page.locator('#chat, #form_sheld').evaluateAll((nodes, values) => nodes.forEach((node, index) => { node.style.visibility = values[index]; }), previousVisibility); }
        expect(paintedPortrait.equals(isolatedPortrait), 'Chat and composer must not paint through the enlarged portrait').toBe(true);
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
        // Native action menus finish their fade after the destination opens.
        // Require a reachable settled control, allowing that finite transition.
        await expect.poll(() => control.evaluate(n => {
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

function contrastRatio(foreground, background, opacity = 1) {
    const rgb = color => color.match(/[\d.]+/g).slice(0, 3).map(Number);
    const luminance = color => rgb(color).map(value => {
        const channel = value / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    }).reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
    const painted = rgb(foreground).map((channel, index) => channel * opacity + rgb(background)[index] * (1 - opacity));
    const a = luminance(`rgb(${painted.join(',')})`), b = luminance(background);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

test('workspace color roles survive native theme changes without hiding checked state', async ({ page }, testInfo) => {
    await category(page, 'settings'); await expand(page);
    await page.locator('#main-text-color-picker').evaluate(picker => {
        picker.setAttribute('color', 'rgba(12, 12, 12, 1)');
        picker.dispatchEvent(new CustomEvent('change', { detail: { rgba: 'rgba(12, 12, 12, 1)' }, bubbles: true }));
    });
    const checkbox = page.locator('#fast_ui_mode');
    await checkbox.check(); await checkbox.scrollIntoViewIfNeeded();
    const colors = await checkbox.evaluate(node => {
        const fill = getComputedStyle(node), tick = getComputedStyle(node, '::before');
        return { fill: fill.backgroundColor, tick: tick.boxShadow.match(/rgba?\([^)]+\)/)?.[0], transform: tick.transform,
            nativeMain: document.documentElement.style.getPropertyValue('--SmartThemeBodyColor') };
    });
    colors.ratio = contrastRatio(colors.tick, colors.fill);
    await page.screenshot({ path: testInfo.outputPath('native-dark-color-workspace-checkbox.png') });
    fs.writeFileSync(testInfo.outputPath('checkbox-colors.json'), JSON.stringify(colors, null, 2));
    expect(colors.nativeMain).toBe('rgba(12, 12, 12, 1)');
    expect(colors.ratio, 'workspace checked tick must contrast with its actual checkbox fill').toBeGreaterThanOrEqual(3);
    await page.locator('#workspace-layout-toggle').uncheck();
    await expect(page.locator('body')).not.toHaveClass(/workspace-ui/);
    expect(await checkbox.evaluate(node => getComputedStyle(node).backgroundColor)).toBe('rgb(12, 12, 12)');
    await page.locator('#workspace-restore').click();
    await expect(page.locator('body')).toHaveClass(/workspace-ui/);
    await category(page, 'prompts'); await expand(page);
    const warning = page.locator('#advanced-formatting-cc-notice');
    await expect(warning).toBeVisible(); await warning.scrollIntoViewIfNeeded();
    const state = await warning.evaluate(node => ({ color: getComputedStyle(node).color, background: getComputedStyle(document.querySelector('.workspace-mounted-panel')).backgroundColor,
        surface: getComputedStyle(document.body).getPropertyValue('--ws-surface').trim() }));
    state.ratio = contrastRatio(state.color, 'rgb(32, 38, 53)');
    fs.writeFileSync(testInfo.outputPath('warning-colors.json'), JSON.stringify(state, null, 2));
    await page.screenshot({ path: testInfo.outputPath('native-warning-workspace.png') });
    expect(state.ratio, 'small warning text must contrast with workspace surfaces').toBeGreaterThanOrEqual(4.5);
    await category(page, 'connection');
    await page.locator('#chat_completion_source').selectOption('claude');
    await category(page, 'generation'); await expand(page);
    await page.locator('#openai_function_calling').check();
    await page.locator('#claude_assistant_prefill').fill('A neutral opening.');
    const prefill = page.locator('#claude_function_prefill_warning');
    await expect(prefill).toBeVisible(); await prefill.scrollIntoViewIfNeeded();
    const color = await prefill.evaluate(node => getComputedStyle(node).color);
    expect(contrastRatio(color, 'rgb(32, 38, 53)')).toBeGreaterThanOrEqual(4.5);
    state.prefill = { color, ratio: contrastRatio(color, 'rgb(32, 38, 53)') };
    await page.screenshot({ path: testInfo.outputPath('native-prefill-warning-workspace.png') });
    await category(page, 'character-editor');
    await page.locator('#advanced_div').click();
    const talkativeness = page.locator('#talkativeness_div .warning');
    await expect(talkativeness).toBeVisible(); await talkativeness.scrollIntoViewIfNeeded();
    const talkativenessColor = await talkativeness.evaluate(node => getComputedStyle(node).color);
    state.talkativeness = { color: talkativenessColor, ratio: contrastRatio(talkativenessColor, 'rgb(32, 38, 53)') };
    fs.writeFileSync(testInfo.outputPath('warning-colors.json'), JSON.stringify(state, null, 2));
    expect(state.talkativeness.ratio).toBeGreaterThanOrEqual(4.5);
    await page.screenshot({ path: testInfo.outputPath('native-character-warning-workspace.png') });
    await page.keyboard.press('Escape');
});

test('composer has continuous background color and readable painted states across layouts', async ({ page }, testInfo) => {
    const states = [];
    const sample = async label => {
        await settle(page);
        // Background image changes crossfade. Compare settled paints rather than
        // two different frames of that intentional transition.
        await page.locator('#bg1').evaluate(async node => Promise.all(node.getAnimations().map(animation => animation.finished.catch(() => {}))));
        const state = await page.evaluate(() => {
            const form = document.querySelector('#form_sheld'), host = document.querySelector('.workspace-composer-host'), hint = document.querySelector('#workspace-composer-hint');
            const f = form.getBoundingClientRect(), c = getComputedStyle(hint), h = getComputedStyle(host);
            const placeholder = getComputedStyle(document.querySelector('#send_textarea'), '::placeholder');
            return { viewport: { width: innerWidth, height: innerHeight }, form: f.toJSON(), background: getComputedStyle(form).backgroundColor,
                host: { background: h.backgroundColor, border: h.borderColor }, hint: { color: c.color, font: c.fontFamily, rect: hint.getBoundingClientRect().toJSON() },
                placeholder: { color: placeholder.color, opacity: placeholder.opacity },
                continue: document.querySelector('#workspace-continue')?.getBoundingClientRect().toJSON(),
                controls: [...document.querySelectorAll('.workspace-composer-tools > button, .workspace-composer-tools > details > summary, #send_but')]
                    .filter(n => n.checkVisibility()).map(n => ({ id: n.id || n.getAttribute('aria-label'), rect: n.getBoundingClientRect().toJSON() })) };
        });
        expect(state.form.bottom, `${label}: composer extends below the viewport`).toBeLessThanOrEqual(state.viewport.height + 1);
        expect(state.hint.rect.bottom, `${label}: composer guidance is clipped`).toBeLessThanOrEqual(state.viewport.height + 1);
        const screenshot = await page.screenshot({ path: testInfo.outputPath(`${label}.png`) });
        const oldVisibility = await page.locator('#form_sheld').evaluate(node => { const value = node.style.visibility; node.style.visibility = 'hidden'; return value; });
        let underlay;
        try { underlay = await page.screenshot(); }
        finally { await page.locator('#form_sheld').evaluate((node, value) => node.style.visibility = value, oldVisibility); }
        state.pixels = await page.evaluate(async ({ encoded, background, form }) => {
            const decode = async value => {
                const image = new Image(); image.src = `data:image/png;base64,${value}`; await image.decode();
                const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
                const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
                return (x, y) => [...context.getImageData(Math.floor(x), Math.floor(y), 1, 1).data].slice(0, 3);
            };
            const actual = await decode(encoded), underlay = await decode(background);
            return { inside: actual(form.left + 3, form.bottom - 2), outside: actual(form.left - 3, form.bottom - 2), expected: underlay(form.left + 3, form.bottom - 2) };
        }, { encoded: screenshot.toString('base64'), background: underlay.toString('base64'), form: state.form });
        state.pixelDifference = Math.max(...state.pixels.inside.map((value, index) => Math.abs(value - state.pixels.expected[index])));
        state.label = label; states.push(state);
        fs.writeFileSync(testInfo.outputPath('composer-painted-states.json'), JSON.stringify(states, null, 2));
        expect(state.background, `${label}: outer composer must not paint a rectangle`).toBe('rgba(0, 0, 0, 0)');
        expect(state.pixelDifference, `${label}: selected backdrop must continue across the composer edge`).toBeLessThanOrEqual(3);
        expect(state.host.background).toBe('rgb(32, 38, 53)');
        expect(state.placeholder.opacity).toBe('1');
        expect(contrastRatio(state.placeholder.color, state.host.background)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(state.host.border, state.host.background)).toBeGreaterThanOrEqual(3);
        expect(contrastRatio(state.host.border, 'rgb(43, 47, 57)')).toBeGreaterThanOrEqual(3);
        expect(state.hint.font).toContain('Noto Sans');
        expect(contrastRatio(state.hint.color, 'rgb(43, 47, 57)')).toBeGreaterThanOrEqual(4.5);
        for (const control of state.controls) {
            expect(control.rect.left, `${label}: ${control.id} left`).toBeGreaterThanOrEqual(-1);
            expect(control.rect.right, `${label}: ${control.id} right`).toBeLessThanOrEqual(state.viewport.width + 1);
            expect(control.rect.bottom, `${label}: ${control.id} bottom`).toBeLessThanOrEqual(state.viewport.height + 1);
        }
        await expect(page.getByRole('button', { name: 'Continue conversation', exact: true })).toBeInViewport();
        await expect(page.locator('#workspace-continue > span')).toBeVisible();
    };
    for (const background of ['_white.jpg', '__transparent.png', '_black.jpg', 'tavern day.jpg']) {
        await page.setViewportSize({ width: 1280, height: 800 });
        await category(page, 'backgrounds');
        await page.locator(`.bg_example[bgfile="${background}"]`).click();
        await page.locator('[data-workspace-action="close-panel"]').click();
        for (const [width, height] of [[1280, 800], [768, 800], [448, 921], [390, 844], [320, 568], [844, 390], [320, 400]]) {
            await page.setViewportSize({ width, height });
            await sample(`composer-${background.replace(/[^a-z0-9]/gi, '_')}-${width}x${height}`);
        }
    }
    await page.locator('#font_scale').evaluate(input => {
        input.value = '1.5'; input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        document.documentElement.style.fontSize = '20px';
    });
    for (const [width, height] of [[448, 921], [320, 400]]) {
        await page.setViewportSize({ width, height });
        await sample(`composer-large-text-${width}x${height}`);
    }
    await page.locator('#font_scale').evaluate(input => {
        input.value = '1'; input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); document.documentElement.style.fontSize = '';
    });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.locator('#workspace-header-portrait').click();
    const active = page.locator('.workspace-scene-sections button.active');
    await expect(active).toHaveCSS('background-color', 'rgb(32, 38, 53)');
    await page.screenshot({ path: testInfo.outputPath('scene-selected-tab-and-composer.png') });
    await page.keyboard.press('Escape');
    await page.locator('#send_textarea').focus();
    await expect(page.locator('.workspace-composer-host')).toHaveCSS('border-color', 'rgb(129, 119, 176)');
    await expect(page.locator('#workspace-continue')).toBeDisabled();
    await page.locator('.workspace-creative-menu > summary').hover();
    await expect(page.locator('.workspace-creative-menu > summary')).toHaveCSS('color', 'rgb(233, 237, 245)');
    expect(page.uiDiagnostics.pageErrors).toEqual([]);
});

test('command search ArrowUp starts at the last result and wraps without skipping', async ({ page }) => {
    await page.keyboard.press('Control+k');
    const input = page.locator('#workspace-command-input'), results = page.locator('#workspace-command-results button');
    await expect(results.first()).toBeVisible();
    await input.press('ArrowUp'); await expect(results.last()).toBeFocused();
    await results.last().press('ArrowDown'); await expect(results.first()).toBeFocused();
    await results.first().press('ArrowUp'); await expect(results.last()).toBeFocused();
    await input.fill('no-such-destination-zzzz'); await input.press('ArrowUp'); await expect(input).toBeFocused();
    await page.keyboard.press('Escape');
    expect(page.uiDiagnostics.pageErrors).toEqual([]);
});

test('visible Continue runs native continuation once and preserves an unsent draft', async ({ page }, testInfo) => {
    let finish;
    const held = new Promise(resolve => { finish = resolve; });
    const requests = [];
    const provider = http.createServer(async (request, response) => {
        if (request.url === '/v1/models') { response.setHeader('content-type', 'application/json'); response.end(JSON.stringify({ data: [{ id: 'ui-continue-fixture' }] })); return; }
        if (request.url !== '/v1/chat/completions') { response.writeHead(404).end(); return; }
        let body = ''; for await (const chunk of request) body += chunk;
        requests.push(JSON.parse(body));
        await held;
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content: ' The lantern reveals another page.' }, finish_reason: 'stop' }] }));
    });
    await new Promise(resolve => provider.listen(0, '127.0.0.1', resolve));
    try {
        await expect(page.getByRole('button', { name: 'Continue conversation', exact: true })).toBeVisible();
        await expect(page.locator('#workspace-continue')).toBeDisabled();
        await category(page, 'connection');
        await page.locator('#chat_completion_source').selectOption('custom');
        await page.locator('#custom_api_url_text').fill(`http://127.0.0.1:${provider.address().port}/v1`);
        await page.locator('#custom_model_id').fill('ui-continue-fixture');
        await page.locator('#api_button_openai').click();
        await expect(page.locator('#workspace-connection-label')).toHaveText('Model connected');
        await category(page, 'generation');
        await page.locator('#stream_toggle').uncheck();
        await page.locator('[data-workspace-action="close-panel"]').click();
        await page.setViewportSize({ width: 320, height: 568 });
        const draft = '/echo Keep this as my unsent next turn.';
        await page.locator('#send_textarea').fill(draft);
        const count = await page.locator('#chat .mes').count();
        await expect(page.locator('#workspace-continue > span')).toBeVisible();
        await expect(page.locator('#workspace-continue')).toBeEnabled();
        await page.locator('#workspace-continue').evaluate(button => { button.click(); button.click(); });
        await expect.poll(() => requests.length).toBe(1);
        await expect(page.locator('#workspace-continue')).toBeDisabled();
        await expect(page.locator('#send_textarea')).toHaveValue(draft);
        expect(JSON.stringify(requests[0])).not.toContain('Keep this as my unsent next turn.');
        await page.locator('.workspace-creative-menu > summary').focus();
        await page.screenshot({ path: testInfo.outputPath('continue-in-progress-phone.png') });
        finish();
        await expect(page.locator('#chat .mes').last().locator('.mes_text')).toContainText('The lantern reveals another page.', { timeout: 30000 });
        await expect(page.locator('#workspace-continue')).toBeEnabled();
        await expect(page.locator('#send_textarea')).toHaveValue(draft);
        await expect(page.locator('#chat .mes')).toHaveCount(count);
        expect(requests).toHaveLength(1);
        await page.locator('#workspace-continue').focus();
        await page.locator('#font_scale').evaluate(input => {
            input.value = '1.5'; input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            document.documentElement.style.fontSize = '20px';
        });
        await page.setViewportSize({ width: 320, height: 400 });
        const bounds = await page.locator('#form_sheld').boundingBox();
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(401);
        await expect(page.locator('#workspace-composer-hint')).toBeInViewport({ ratio: 1 });
        await expect(page.locator('#workspace-continue')).toBeInViewport({ ratio: 1 });
        fs.writeFileSync(testInfo.outputPath('continue-native-request.json'), JSON.stringify({ requests, draftPreserved: true, messageCountBefore: count, messageCountAfter: await page.locator('#chat .mes').count() }, null, 2));
        await page.screenshot({ path: testInfo.outputPath('continue-completed-phone.png') });
        expect(page.uiDiagnostics.pageErrors).toEqual([]);
    } finally {
        finish(); provider.closeAllConnections(); await new Promise(resolve => provider.close(resolve));
    }
});

test('native chat display and visual preferences remain usable after returning from Settings', async ({ page }, testInfo) => {
    const states = [];
    for (const style of ['0', '1', '2']) {
        for (const [width, height] of [[1280, 800], [448, 921], [320, 400]]) {
            await page.setViewportSize({ width: 1280, height: 800 });
            await category(page, 'settings'); await expand(page);
            await page.locator('#chat_display').selectOption(style);
            await page.locator('#fast_ui_mode').setChecked(style !== '1');
            await page.locator('#waifuMode').setChecked(style === '1');
            await page.locator('[data-workspace-action="close-panel"]').click();
            await page.setViewportSize({ width, height });
            const state = await page.locator('#chat').evaluate(node => ({ classes: document.body.className, width: innerWidth, height: innerHeight,
                scrollWidth: node.scrollWidth, clientWidth: node.clientWidth, background: getComputedStyle(node).backgroundColor,
                text: [...node.querySelectorAll('.mes_text')].filter(n => n.checkVisibility()).map(n => { const r = n.getBoundingClientRect(); return { left: r.left, right: r.right, width: r.width, color: getComputedStyle(n).color }; }) }));
            state.style = style; states.push(state);
            fs.writeFileSync(testInfo.outputPath('chat-visual-preferences.json'), JSON.stringify(states, null, 2));
            expect(state.scrollWidth).toBeLessThanOrEqual(state.clientWidth + 1);
            expect(state.text.length).toBeGreaterThan(0);
            for (const text of state.text) { expect(text.left).toBeGreaterThanOrEqual(0); expect(text.right).toBeLessThanOrEqual(width + 1); }
            await expect(page.locator('#workspace-continue > span')).toBeVisible();
            await expect(page.locator('#send_textarea')).toBeInViewport();
            await page.screenshot({ path: testInfo.outputPath(`chat-style-${style}-${width}x${height}.png`) });
        }
    }
    expect(page.uiDiagnostics.pageErrors).toEqual([]);
});

test('settled expression status and regex explanations retain readable colors', async ({ page }, testInfo) => {
    await page.route('**/api/sprites/get?*', route => route.fulfill({ json: [
        { label: 'joy', path: '/backgrounds/_white.jpg' },
        { label: 'joy', path: '/backgrounds/_black.jpg' },
    ] }));
    await category(page, 'extensions'); await expand(page);
    await page.locator('#expression_override').fill(`ui-palette-${Date.now()}`);
    await page.locator('#expression_override_button').click();
    await expect(page.locator('#image_list [data-expression-type="additional"]')).toHaveCount(1);
    await page.locator('#expressions_allow_multiple').uncheck();
    const states = [];
    for (const width of [1280, 390, 320]) {
        await page.setViewportSize({ width, height: 844 });
        for (const type of ['success', 'additional', 'failure']) {
            const label = page.locator(`#image_list [data-expression-type="${type}"] .expression_list_title`).first();
            await label.scrollIntoViewIfNeeded(); await page.mouse.move(1, 1); await settle(page);
            const state = await label.evaluate(node => {
                let opacity = 1; const sources = [];
                for (let parent = node; parent; parent = parent.parentElement) { const value = Number(getComputedStyle(parent).opacity); opacity *= value; if (value < 1) sources.push({ id: parent.id, className: parent.className, opacity: value }); }
                return { text: node.textContent.trim(), color: getComputedStyle(node).color, background: getComputedStyle(node).backgroundColor, opacity, sources };
            });
            state.type = type; state.width = width;
            state.ratio = contrastRatio(state.color, state.background); states.push(state);
            fs.writeFileSync(testInfo.outputPath('expression-status-colors.json'), JSON.stringify(states, null, 2));
            await page.screenshot({ path: testInfo.outputPath(`expression-${type}-${width}.png`) });
            expect(state.opacity, `${type}: interactive expression labels must remain readable when not selected for automatic use`).toBe(1);
            expect(state.background, `${type}: a thumbnail must not determine its label's contrast`).toBe('rgb(18, 22, 32)');
            expect(state.ratio, `${type}: expression state text contrast`).toBeGreaterThanOrEqual(4.5);
        }
    }
    for (const id of ['preset', 'scoped']) {
        const toggle = page.locator(`#regex_${id}_toggle`);
        if (await toggle.isChecked()) await page.locator(`#toggle_${id}_regex`).click();
        const note = page.locator(`#${id}_scripts_block > small`);
        await note.scrollIntoViewIfNeeded(); await page.mouse.move(1, 1); await settle(page);
        const state = await note.evaluate(node => ({ color: getComputedStyle(node).color, opacity: Number(getComputedStyle(node).opacity) * Number(getComputedStyle(node.parentElement).opacity) }));
        state.id = id; state.ratio = contrastRatio(state.color, 'rgb(32, 38, 53)');
        fs.writeFileSync(testInfo.outputPath(`regex-${id}-colors.json`), JSON.stringify(state, null, 2));
        await page.screenshot({ path: testInfo.outputPath(`regex-${id}-disabled-description.png`) });
        expect(state.opacity, 'Off state must not make its explanation unreadable').toBe(1);
        expect(state.ratio).toBeGreaterThanOrEqual(4.5);
        await page.locator(`#toggle_${id}_regex`).click();
        await expect(toggle).toBeChecked();
    }
});

test('inactive lore entries keep editable fields readable after their state animation settles', async ({ page }, testInfo) => {
    await category(page, 'world');
    const name = `UI contrast lore ${Date.now()}`;
    await page.locator('#world_create_button').click();
    await page.locator('dialog[open] .popup-input').fill(name);
    await page.locator('dialog[open] .popup-button-ok').click();
    await expect(page.locator('#world_editor_select option:checked')).toHaveText(name);
    await page.locator('#world_popup_new').click();
    const entry = page.locator('#world_popup_entries_list .world_entry').first();
    await expect(entry).toBeVisible();
    await entry.locator('.inline-drawer-toggle').first().click(); await expand(page);
    const power = entry.locator('.killSwitch');
    if (await power.evaluate(node => node.classList.contains('fa-toggle-on'))) await power.click();
    await expect(entry).toHaveClass(/disabledWIEntry/);
    const text = entry.locator('textarea[name="content"]');
    await text.fill('An inactive entry remains editable and readable.');
    const states = [];
    for (const width of [1280, 390, 320]) {
        await page.setViewportSize({ width, height: 844 });
        await text.scrollIntoViewIfNeeded(); await page.mouse.move(1, 1); await settle(page);
        const state = await text.evaluate(node => {
            let opacity = 1; const sources = [];
            for (let parent = node; parent; parent = parent.parentElement) { const value = Number(getComputedStyle(parent).opacity); opacity *= value; if (value < 1) sources.push({ id: parent.id, className: parent.className, opacity: value }); }
            return { color: getComputedStyle(node).color, background: getComputedStyle(node).backgroundColor, opacity, sources, disabled: node.disabled, value: node.value };
        });
        state.width = width; states.push(state);
        fs.writeFileSync(testInfo.outputPath('inactive-lore-colors.json'), JSON.stringify(states, null, 2));
        await page.screenshot({ path: testInfo.outputPath(`inactive-lore-${width}.png`) });
        expect(state.disabled).toBe(false);
        expect(state.opacity, 'A disabled-in-context lore entry still contains active editor controls').toBe(1);
        expect(contrastRatio(state.color, state.background)).toBeGreaterThanOrEqual(4.5);
    }
    await power.click(); await settle(page); await expect(entry).not.toHaveClass(/disabledWIEntry/);
    await expect(text).toHaveValue('An inactive entry remains editable and readable.');
    await page.locator('#world_popup_delete').click(); await page.locator('dialog[open] .popup-button-ok').click();
});

test('wrapped composer tools leave the textarea edge clickable with native menus open', async ({ page }, testInfo) => {
    const states = [];
    for (const [width, height, scale, fontSize] of [[320, 844, '1', ''], [320, 400, '1', ''], [320, 400, '1.5', '20px'], [448, 921, '1.5', '20px'], [844, 390, '1', '']]) {
        await page.locator('#font_scale').evaluate((input, values) => {
            input.value = values.scale; input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); document.documentElement.style.fontSize = values.fontSize;
        }, { scale, fontSize });
        await page.setViewportSize({ width, height });
        for (const [trigger, panel] of [['options_button', 'options'], ['extensionsMenuButton', 'extensionsMenu']]) {
            await page.locator('.workspace-creative-menu > summary').click();
            await page.locator(`#${trigger}`).click();
            await expect(page.locator(`#${panel}`)).toBeVisible(); await settle(page);
            const hit = await page.locator('#send_textarea').evaluate(node => {
                const r = node.getBoundingClientRect(); const x = r.left + 8, y = r.bottom - 4, target = document.elementFromPoint(x, y);
                return { reachable: target === node, coveredBy: target?.id || target?.className, textarea: r.toJSON(), point: { x, y } };
            });
            states.push({ width, height, scale, trigger, ...hit });
            fs.writeFileSync(testInfo.outputPath('composer-native-menu-hit-tests.json'), JSON.stringify(states, null, 2));
            await page.screenshot({ path: testInfo.outputPath(`composer-${trigger}-${width}x${height}-font${scale}.png`) });
            expect(hit.reachable, `${trigger} must leave the editor's lower edge clickable`).toBe(true);
            await page.locator('#send_textarea').click({ position: { x: 8, y: hit.textarea.height - 4 } });
            await expect(page.locator(`#${panel}`)).toBeHidden();
            await expect(page.locator('.workspace-creative-menu')).not.toHaveAttribute('open');
        }
    }
});

test('inactive prompt names remain readable while their native toggles stay operable', async ({ page }, testInfo) => {
    await page.evaluate(() => {
        const trace = window.__promptViewportTrace = { mutations: [], scrolls: [], samples: [] };
        const snapshot = () => {
            const row = document.querySelector('#completion_prompt_manager_list [data-pm-identifier="enhanceDefinitions"]');
            const scroller = row?.closest('.scrollableInner');
            const rect = row?.getBoundingClientRect();
            return { time: performance.now(), connected: row?.isConnected, scrollTop: scroller?.scrollTop,
                rect: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null };
        };
        new MutationObserver(records => {
            if (records.some(record => record.target instanceof Element && (record.target.id === 'completion_prompt_manager_list' || record.target.closest('#completion_prompt_manager_list')))) {
                trace.mutations.push(snapshot());
                if (trace.mutations.length > 200) trace.mutations.shift();
            }
        }).observe(document.body, { subtree: true, childList: true });
        document.addEventListener('scroll', event => {
            if (event.target instanceof Element && event.target.contains(document.querySelector('#completion_prompt_manager_list'))) {
                trace.scrolls.push({ ...snapshot(), target: event.target.id || event.target.className });
                if (trace.scrolls.length > 200) trace.scrolls.shift();
            }
        }, true);
    });
    await category(page, 'generation'); await expand(page);
    const row = page.locator('#completion_prompt_manager_list [data-pm-identifier="enhanceDefinitions"]');
    const toggle = row.locator('.prompt-manager-toggle-action');
    if (!await row.evaluate(node => node.classList.contains('completion_prompt_manager_prompt_disabled'))) await toggle.click();
    await expect(row).toHaveClass(/completion_prompt_manager_prompt_disabled/);
    const name = row.locator('.completion_prompt_manager_prompt_name');
    const states = [];
    for (const width of [1280, 390, 320]) {
        await page.setViewportSize({ width, height: 844 });
        // Native dry-run completion can replace the prompt list during a resize.
        try { await expect(async () => {
            await name.evaluate(node => {
                const snapshot = phase => {
                    const rect = node.getBoundingClientRect();
                    window.__promptViewportTrace.samples.push({ phase, time: performance.now(), connected: node.isConnected,
                        currentNode: node === document.querySelector('#completion_prompt_manager_list [data-pm-identifier="enhanceDefinitions"] .completion_prompt_manager_prompt_name'),
                        scrollTop: node.closest('.scrollableInner')?.scrollTop,
                        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } });
                };
                snapshot('before-scroll');
                if (!node.isConnected) throw new Error('Native prompt row was replaced before scrolling.');
                node.scrollIntoView({ block: 'center', inline: 'nearest' }); snapshot('after-scroll');
            });
            await expect(name).toBeInViewport({ timeout: 250 });
        }).toPass({ timeout: 5000, intervals: [50, 100, 250] }); } catch (error) {
            fs.writeFileSync(testInfo.outputPath('prompt-viewport-failure.json'), JSON.stringify(await page.evaluate(() => window.__promptViewportTrace), null, 2));
            throw error;
        }
        await page.mouse.move(1, 1); await settle(page);
        const color = await name.locator('.prompt-manager-inspect-action').evaluate(node => getComputedStyle(node).color);
        const state = { width, color, ratio: contrastRatio(color, 'rgb(18, 22, 32)') }; states.push(state);
        fs.writeFileSync(testInfo.outputPath('inactive-prompt-colors.json'), JSON.stringify(states, null, 2));
        await page.screenshot({ path: testInfo.outputPath(`inactive-prompt-${width}.png`) });
        expect(state.ratio).toBeGreaterThanOrEqual(4.5);
    }
    await toggle.click(); await expect(row).not.toHaveClass(/completion_prompt_manager_prompt_disabled/);
    await toggle.click(); await expect(row).toHaveClass(/completion_prompt_manager_prompt_disabled/);
    fs.writeFileSync(testInfo.outputPath('prompt-viewport-trace.json'), JSON.stringify(await page.evaluate(() => window.__promptViewportTrace), null, 2));
});

test('future-provider prompt controls remain readable and retain edits across provider and layout switches', async ({ page }, testInfo) => {
    await page.route('**/api/backends/text-completions/status', route => route.fulfill({ json: { result: 'UI context fixture', data: [{ id: 'ui-context-fixture' }] } }));
    await category(page, 'prompts'); await expand(page);
    await expect(page.locator('#advanced-formatting-cc-notice')).toBeVisible();
    const context = page.locator('#context_story_string');
    await expect(context).toBeEnabled();
    const value = '{{description}}\nA neutral context prepared for a future provider.';
    await context.fill(value);
    expect(await page.evaluate(async () => (await import('/scripts/power-user.js')).power_user.context.story_string)).toBe(value);
    for (const id of ['instruct', 'sysprompt']) {
        if (await page.locator(`#${id}_enabled`).isChecked()) await page.locator(`#${id}_enabled_label`).click();
        await expect(page.locator(`#${id}_enabled`)).not.toBeChecked();
    }
    const systemPrompt = page.locator('#sysprompt_content');
    await expect(systemPrompt).toBeEnabled();
    await systemPrompt.fill('A neutral system prompt staged while its feature is off.');
    await page.locator('#instruct_system_same_as_user').check();
    await expect(page.locator('#instruct_system_sequence')).toHaveJSProperty('readOnly', true);
    for (const width of [1280, 390, 320]) {
        await page.setViewportSize({ width, height: 844 });
        await inspect(page, `future-provider-context-${width}`, testInfo);
        await context.scrollIntoViewIfNeeded();
        expect(await context.evaluate(node => Number(getComputedStyle(node.closest('[data-cc-null]')).opacity))).toBe(1);
        await expect(context).toHaveValue(value);
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    await category(page, 'connection'); await page.locator('#main_api').selectOption('textgenerationwebui');
    await category(page, 'prompts'); await expand(page);
    await expect(page.locator('#advanced-formatting-cc-notice')).toBeHidden(); await expect(context).toHaveValue(value);
    await expect(systemPrompt).toHaveValue('A neutral system prompt staged while its feature is off.');
    await category(page, 'connection'); await page.locator('#main_api').selectOption('openai');
    await category(page, 'settings'); await expand(page); await page.locator('#workspace-layout-toggle').uncheck();
    await expect(page.locator('body')).not.toHaveClass(/workspace-ui/);
    expect(await context.evaluate(node => Number(getComputedStyle(node.closest('[data-cc-null]')).opacity))).toBe(.5);
    await page.locator('#workspace-restore').click();
    await category(page, 'prompts'); await expand(page); await expect(context).toHaveValue(value);
    fs.writeFileSync(testInfo.outputPath('future-provider-edit-retention.json'), JSON.stringify({ value, retainedAcrossProviders: true, retainedAcrossLayouts: true, classicOpacity: .5, workspaceOpacity: 1 }, null, 2));
});

test('AllTalk statuses stay readable and reload keeps one model-change listener', async ({ page }, testInfo) => {
    let online = false, readyRequests = 0, voiceRequests = 0, modelReloads = 0, holdReady = false;
    let releaseReady, releaseModel;
    const readyHeld = new Promise(resolve => { releaseReady = resolve; });
    const modelHeld = new Promise(resolve => { releaseModel = resolve; });
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type' };
    await page.route('http://localhost:7851/**', async route => {
        const path = new URL(route.request().url()).pathname;
        if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
        if (path === '/api/voices') voiceRequests++;
        if (!online) return route.fulfill({ status: 503, headers, body: 'Synthetic unavailable speech service' });
        if (path === '/api/ready') {
            readyRequests++;
            if (holdReady) { holdReady = false; await readyHeld; }
            return route.fulfill({ headers, body: 'Ready' });
        }
        if (path === '/api/currentsettings') return route.fulfill({ headers, json: {
            engines_available: ['xtts'], models_available: [{ name: 'fixture-one' }, { name: 'fixture-two' }], current_model_loaded: 'fixture-one',
            deepspeed_capable: false, deepspeed_available: false, deepspeed_enabled: false, lowvram_capable: false, lowvram_enabled: false,
        } });
        if (path === '/api/voices') return route.fulfill({ headers, json: { voices: ['fixture.wav'] } });
        if (path === '/api/rvcvoices') return route.fulfill({ headers, json: { rvcvoices: [] } });
        if (path === '/api/reload') { modelReloads++; await modelHeld; return route.fulfill({ status: 503, headers, body: 'Synthetic model reload failure' }); }
        return route.fulfill({ status: 404, headers });
    });
    const states = [];
    const capture = async text => {
        const status = page.locator('#status_info'); await expect(status).toHaveText(text); await status.scrollIntoViewIfNeeded();
        const color = await status.evaluate(node => getComputedStyle(node).color);
        states.push({ text, color, ratio: contrastRatio(color, 'rgb(23, 27, 38)') });
        fs.writeFileSync(testInfo.outputPath('alltalk-status-colors.json'), JSON.stringify({ states, modelReloads }, null, 2));
        await page.screenshot({ path: testInfo.outputPath(`alltalk-${text.toLowerCase()}.png`) });
    };
    try {
        await category(page, 'voice-settings');
        await page.locator('#tts_provider').selectOption('AllTalk');
        await expect.poll(() => voiceRequests).toBeGreaterThanOrEqual(1); await capture('Offline');
        online = true; holdReady = true;
        await page.locator('#tts_refresh').click(); await capture('Processing'); releaseReady();
        await capture('Ready');
        const before = readyRequests; await page.locator('#tts_refresh').click();
        await expect.poll(() => readyRequests).toBeGreaterThanOrEqual(before + 3); await capture('Ready');
        await page.locator('#switch_model').selectOption('fixture-two');
        await expect.poll(() => modelReloads).toBeGreaterThanOrEqual(1); await capture('Processing'); releaseModel();
        await capture('Error'); await settle(page);
        fs.writeFileSync(testInfo.outputPath('alltalk-status-colors.json'), JSON.stringify({ states, modelReloads }, null, 2));
        expect(modelReloads, 'Reload must not register another remote model-change action').toBe(1);
        for (const state of states) expect(state.ratio, `${state.text}: visible status contrast`).toBeGreaterThanOrEqual(4.5);
    } finally { releaseReady(); releaseModel(); }
});

test('workspace shell keyboard hints and composer retain readable palette roles', async ({ page }, testInfo) => {
    const states = [];
    for (const width of [1280, 390, 320]) {
        await page.setViewportSize({ width, height: 844 });
        if (width < 901) await page.locator('#workspace-menu').click();
        const kbd = page.locator('#workspace-search-button kbd');
        await expect(kbd).toBeVisible();
        const state = await kbd.evaluate(node => ({ foreground: getComputedStyle(node).color, background: getComputedStyle(node).backgroundColor, shadow: getComputedStyle(node).boxShadow }));
        state.width = width; state.ratio = contrastRatio(state.foreground, state.background); states.push(state);
        fs.writeFileSync(testInfo.outputPath('workspace-keyboard-hint-colors.json'), JSON.stringify(states, null, 2));
        expect(state.background).toBe('rgb(32, 38, 53)'); expect(state.ratio).toBeGreaterThanOrEqual(4.5); expect(state.shadow).toBe('none');
        await inspect(page, `global-shell-nav-${width}`, testInfo);
        if (width < 901) await page.keyboard.press('Escape');
        const shell = await inspect(page, `global-shell-chat-${width}`, testInfo);
        expect(shell.contrastRegions.header).toBeGreaterThan(0); expect(shell.contrastRegions.composer).toBeGreaterThan(0);
        await page.keyboard.press('Control+k');
        await expect(page.locator('#workspace-command')).toBeVisible();
        await inspect(page, `global-shell-search-${width}`, testInfo);
        await page.keyboard.press('Escape');
    }
});

test('native success info warning and error notices keep readable text links and close controls', async ({ page }, testInfo) => {
    const states = [];
    const notify = type => page.evaluate(type => { window.toastr.remove(); history.replaceState(null, '', location.pathname); window.toastr[type]('Synthetic notice <a href="#audit-notice">Inspect fixture</a>', `${type} notice`, { timeOut: 0, extendedTimeOut: 0, closeButton: true, escapeHtml: false }); }, type);
    for (const width of [1280, 390, 320]) {
        await page.setViewportSize({ width, height: 844 });
        for (const type of ['success', 'info', 'warning', 'error']) {
            await notify(type);
            const toast = page.locator(`#toast-container .toast-${type}`);
            await expect(toast).toHaveCSS('opacity', '1');
            const state = await toast.evaluate(node => {
                const style = getComputedStyle(node), rect = node.getBoundingClientRect();
                const link = node.querySelector('a'), close = node.querySelector('.toast-close-button');
                return { background: style.backgroundColor, color: style.color, border: style.borderInlineStartColor, link: getComputedStyle(link).color,
                    close: getComputedStyle(close).color, closeOpacity: getComputedStyle(close).opacity, width: rect.width, left: rect.left, right: rect.right };
            });
            state.type = type; state.viewportWidth = width;
            state.textContrast = contrastRatio(state.color, state.background); state.linkContrast = contrastRatio(state.link, state.background);
            state.closeContrast = contrastRatio(state.close, state.background, Number(state.closeOpacity));
            states.push(state);
            fs.writeFileSync(testInfo.outputPath('native-notice-colors.json'), JSON.stringify(states, null, 2));
            expect(state.textContrast).toBeGreaterThanOrEqual(4.5); expect(state.linkContrast).toBeGreaterThanOrEqual(4.5); expect(state.closeContrast).toBeGreaterThanOrEqual(3);
            expect(state.left).toBeGreaterThanOrEqual(0); expect(state.right).toBeLessThanOrEqual(width);
            await toast.locator('.toast-close-button').hover();
            const hovered = await toast.locator('.toast-close-button').evaluate(node => ({ color: getComputedStyle(node).color, opacity: Number(getComputedStyle(node).opacity) }));
            expect(contrastRatio(hovered.color, state.background, hovered.opacity)).toBeGreaterThanOrEqual(3);
            await toast.locator('.toast-close-button').focus();
            const focused = await toast.locator('.toast-close-button').evaluate(node => ({ color: getComputedStyle(node).color, opacity: Number(getComputedStyle(node).opacity) }));
            expect(contrastRatio(focused.color, state.background, focused.opacity)).toBeGreaterThanOrEqual(3);
            await toast.locator('.toast-close-button').click(); await expect(toast).toHaveCount(0);
            await notify(type); await expect(toast).toHaveCSS('opacity', '1');
            await toast.locator('a').click(); await expect(page).toHaveURL(/#audit-notice$/);
            await expect(toast).toHaveCount(0);
        }
    }
});

test('character profile actions remain reachable in short landscape windows', async ({ page }, testInfo) => {
    for (const [width, height] of [[1280, 390], [844, 390], [320, 400]]) {
        await page.setViewportSize({ width, height });
        await category(page, 'character-editor');
        await expect(page.locator('#right-nav-panel.workspace-mounted-panel')).toBeVisible();
        await inspect(page, `profile-edit-${width}x${height}`, testInfo);
        await page.locator('[data-workspace-action="close-panel"]').click();
    }
});

test('Extras connection success and failure statuses use readable native palette roles', async ({ page }, testInfo) => {
    let connected = false;
    await page.route('http://127.0.0.1:59991/**', route => route.fulfill({ status: connected ? 200 : 503,
        headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,OPTIONS', 'access-control-allow-headers': '*' }, json: { modules: [] } }));
    const states = [];
    for (const width of [1280, 390, 320]) {
        await page.setViewportSize({ width, height: 844 }); await category(page, 'extensions'); await expand(page);
        await page.locator('#extensions_url').fill('http://127.0.0.1:59991');
        for (connected of [false, true]) {
            await page.locator('#extensions_connect').click();
            const status = page.locator('#extensions_status');
            await expect(status).toHaveText(connected ? 'Connected to API' : 'Could not connect to API');
            const color = await status.evaluate(node => getComputedStyle(node).color);
            states.push({ width, connected, color, ratio: contrastRatio(color, 'rgb(23, 27, 38)') });
            fs.writeFileSync(testInfo.outputPath('extras-status-colors.json'), JSON.stringify(states, null, 2));
            expect(states.at(-1).ratio).toBeGreaterThanOrEqual(4.5);
            await inspect(page, `extras-${connected ? 'connected' : 'failed'}-${width}`, testInfo);
        }
    }
});
