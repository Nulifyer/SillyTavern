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

async function tabTo(page, control) {
    // Use the real browser tab order, rather than focusing the requested icon directly.
    for (let index = 0; index < 100; index++) {
        if (await control.evaluate(node => document.activeElement === node)) return;
        await page.keyboard.press('Tab');
    }
    throw new Error(`Tab did not reach ${await control.getAttribute('aria-label')}`);
}

async function openStory(page) {
    if (!await page.locator('#workspace-navigation [data-workspace-action="characters"]').isVisible()) await page.locator('#workspace-menu').click();
    await page.locator('#workspace-navigation [data-workspace-action="characters"]').click();
    await page.locator('.workspace-library-card').first().click();
    await page.getByRole('button', { name: 'Start new story', exact: true }).click();
    await expect(page.locator('#send_textarea')).toBeVisible();
}

for (const width of [1280, 390]) {
    test(`swipe Copy, Expand, Delete and Branch work through Tab and Enter at ${width}px`, async ({ page }, info) => {
        await page.setViewportSize({ width, height: 844 });
        await openStory(page);
        const initialChat = await page.evaluate(async () => {
            const script = await import('/script.js');
            await script.clearChat({ clearData: true });
            const swipes = ['A neutral first path.', 'A neutral second path.', 'A neutral third path.'];
            const message = { name: 'Neutral guide', is_user: false, is_system: false, mes: swipes[0], send_date: Date.now(), extra: {}, swipe_id: 0, swipes, swipe_info: swipes.map(() => ({ extra: {} })) };
            script.chat.push(message); script.addOneMessage(message); await script.saveChatConditional();
            (await import('/scripts/power-user.js')).power_user.confirm_message_delete = true;
            window.__clipboardWrites = [];
            Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => window.__clipboardWrites.push(text) } });
            return script.getCurrentChatId();
        });
        const picker = page.locator('#chat .mes').last().locator('.mes_swipe_picker');
        await page.locator('#chat .mes').last().hover();
        await page.locator('#chat .mes').last().locator('.extraMesButtonsHint').click();
        await picker.click();
        const dialog = page.locator('dialog[open]');
        await expect(dialog.locator('.swipe_picker_block')).toHaveCount(3);
        const copy = dialog.getByRole('button', { name: 'Copy swipe 2', exact: true });
        await tabTo(page, copy); await page.keyboard.press('Enter');
        await expect.poll(() => page.evaluate(() => window.__clipboardWrites)).toEqual(['A neutral second path.']);
        await expect(dialog).toHaveCount(1);
        const expand = dialog.getByRole('button', { name: /^(Expand|Collapse) swipe 2$/ });
        await tabTo(page, expand); await page.keyboard.press('Enter');
        await expect(expand).toHaveAttribute('aria-expanded', 'true');
        await page.keyboard.press('Space'); await expect(expand).toHaveAttribute('aria-expanded', 'false');
        const remove = dialog.getByRole('button', { name: 'Delete swipe 3', exact: true });
        await tabTo(page, remove); await page.keyboard.press('Enter');
        const confirmation = page.locator('dialog[open]').last();
        await expect(confirmation).toContainText('delete swipe #3');
        await confirmation.getByRole('button', { name: 'Delete Swipe', exact: true }).click();
        await expect(dialog.locator('.swipe_picker_block')).toHaveCount(2);
        expect(await page.evaluate(async () => (await import('/script.js')).chat[0].swipes)).toEqual(['A neutral first path.', 'A neutral second path.']);
        const branch = dialog.getByRole('button', { name: 'Branch from swipe 2', exact: true });
        await tabTo(page, branch);
        await page.screenshot({ path: info.outputPath('branch-keyboard-focus.png') });
        expect(await branch.evaluate(node => node.matches(':focus-visible'))).toBe(true);
        await page.keyboard.press('Enter');
        await expect(page.locator('dialog[open]')).toHaveCount(0);
        await expect.poll(() => page.evaluate(async () => (await import('/script.js')).getCurrentChatId())).not.toBe(initialChat);
        expect(await page.evaluate(async () => (await import('/script.js')).chat[0].mes)).toBe('A neutral second path.');
    });
}

async function classicLibrary(page) {
    await page.locator('#workspace-settings-link').click();
    await page.locator('.workspace-settings-rail [data-workspace-action="settings"]').click();
    await page.locator('#workspace-layout-toggle').uncheck();
    await expect(page.locator('body')).not.toHaveClass(/workspace-ui/);
    if (!await page.locator('#rm_print_characters_block').isVisible()) await page.locator('#rightNavDrawerIcon').click();
    await page.locator('#rm_button_characters').click();
    await expect(page.locator('#bulkEditButton')).toBeVisible();
}

async function favoriteAction(page, id) {
    if (!await page.locator('#bulkEditButton').isVisible()) await page.locator('#rightNavDrawerIcon').click();
    await expect(page.locator('#bulkEditButton')).toBeVisible();
    await page.locator('#bulkEditButton').click();
    const card = page.locator(`#CharID${id}`);
    await card.click();
    await card.click({ button: 'right' });
    await expect(page.locator('#character_context_menu')).toBeVisible();
    await page.locator('#character_context_menu_favorite').click();
}

test('favorite HTTP failure preserves state and paint, then native bulk action retries successfully', async ({ page }) => {
    let cards, releaseRefresh;
    let holdRefresh = false;
    const refreshHeld = new Promise(resolve => releaseRefresh = resolve);
    await page.route('**/api/characters/all', async route => {
        if (!cards) { const response = await route.fetch(); cards = await response.json(); cards.forEach(card => { card.fav = false; card.data ||= {}; card.data.extensions ||= {}; card.data.extensions.fav = false; }); }
        if (holdRefresh) await refreshHeld;
        await route.fulfill({ json: cards });
    });
    await page.evaluate(async () => (await import('/script.js')).getCharacters());
    const id = 0;
    let fail = true, requests = 0;
    await page.route('**/api/characters/merge-attributes', async route => {
        requests++;
        if (fail) { await route.fulfill({ status: 503, json: { message: 'Synthetic favorite save failed.' } }); return; }
        const patch = route.request().postDataJSON(); const card = cards.find(card => card.avatar === patch.avatar);
        card.fav = patch.fav; card.data.extensions.fav = patch.fav;
        await route.fulfill({ json: {} });
    });
    await classicLibrary(page);
    holdRefresh = true;
    await favoriteAction(page, id);
    await expect(page.locator('.toast-error')).toContainText('Synthetic favorite save failed.');
    await expect(page.locator(`#CharID${id}`)).not.toHaveClass(/is_fav/);
    expect(await page.evaluate(async () => { const card = (await import('/script.js')).characters[0]; return [card.fav, card.data.extensions.fav]; })).toEqual([false, false]);
    holdRefresh = false; releaseRefresh();
    await expect.poll(() => page.evaluate(async () => (await import('/script.js')).characterGroupOverlay.state)).toBe(0);
    await expect(page.locator('#right-nav-panel')).toBeHidden();
    fail = false;
    await favoriteAction(page, id);
    await expect(page.locator(`#CharID${id}`)).toHaveClass(/is_fav/);
    expect(await page.evaluate(async () => { const card = (await import('/script.js')).characters[0]; return [card.fav, card.data.extensions.fav]; })).toEqual([true, true]);
    expect(requests).toBe(2);
});

async function refreshCharacterList(page, reorder) {
    await page.route('**/api/characters/all', async route => {
        const response = await route.fetch(); const cards = await response.json();
        expect(cards.length).toBeGreaterThan(1);
        if (reorder) [cards[0], cards[1]] = [cards[1], cards[0]];
        await route.fulfill({ response, json: cards });
    });
    await page.evaluate(async () => (await import('/script.js')).getCharacters());
}

for (const reorder of [false, true]) {
    test(`a held favorite response cannot mutate a refreshed character-list owner${reorder ? ' after numeric-slot reuse' : ''}`, async ({ page }) => {
        await classicLibrary(page);
        let release, began;
        const held = new Promise(resolve => release = resolve), requested = new Promise(resolve => began = resolve);
        await page.route('**/api/characters/merge-attributes', async route => { began(); await held; await route.fulfill({ json: {} }); });
        try {
            await page.evaluate(async () => {
                const script = await import('/script.js');
                const card = script.characters[0]; card.fav = false; card.data.extensions.fav = false;
                document.getElementById('CharID0').classList.remove('is_fav');
                window.__capturedFavoriteCard = card;
                window.__favoritePending = (await import('/scripts/BulkEditOverlay.js')).CharacterContextMenu.favorite(0);
            });
            await requested;
            // Exercise native list publication; optionally reuse the same numeric ID for a different card.
            await refreshCharacterList(page, reorder);
            const before = await page.evaluate(async () => {
                const script = await import('/script.js');
                return { replaced: script.characters[0] !== window.__capturedFavoriteCard, changedAvatar: script.characters[0].avatar !== window.__capturedFavoriteCard.avatar, fav: script.characters[0].fav, nestedFav: script.characters[0].data.extensions.fav, paint: document.getElementById('CharID0').classList.contains('is_fav') };
            });
            expect(before.replaced).toBe(true);
            expect(before.changedAvatar).toBe(reorder);
            release();
            expect(await page.evaluate(() => window.__favoritePending)).toBe(true);
            expect(await page.evaluate(async () => {
                const script = await import('/script.js');
                return { replaced: script.characters[0] !== window.__capturedFavoriteCard, changedAvatar: script.characters[0].avatar !== window.__capturedFavoriteCard.avatar, fav: script.characters[0].fav, nestedFav: script.characters[0].data.extensions.fav, paint: document.getElementById('CharID0').classList.contains('is_fav') };
            })).toEqual(before);
            expect(await page.evaluate(() => window.__capturedFavoriteCard.fav)).toBe(false);
        } finally { release(); }
    });
}
