import { test, expect } from '@playwright/test';

test.use({ channel: 'chromium', video: 'off', viewport: { width: 1280, height: 800 } });

test.beforeEach(async ({ page }) => {
    let savedSettings;
    await page.route('**/api/settings/get', async route => {
        const response = await route.fetch();
        const body = await response.json();
        const settings = savedSettings || JSON.parse(body.settings);
        if (!savedSettings) {
            settings.firstRun = false;
            settings.username = 'Storyteller';
            settings.main_api = 'openai';
            settings.power_user.auto_connect = false;
            settings.accountStorage = { ...settings.accountStorage, workspaceLayout: 'true' };
        }
        body.settings = JSON.stringify(settings);
        await route.fulfill({ response, json: body });
    });
    await page.route('**/api/settings/save', async route => {
        savedSettings = route.request().postDataJSON();
        await route.fulfill({ json: { result: 'ok' } });
    });
    await page.route('**/api/chats/save', route => route.fulfill({ json: { result: 'ok' } }));
    await page.route('**/api/chats/recent', route => route.fulfill({ json: [] }));
    await page.goto('/');
    await expect(page.locator('#preloader')).toHaveCount(0, { timeout: 30000 });
    await expect(page.locator('.workspace-home-intro')).toBeVisible();
});

test('home uses real characters and gives disconnected users a next action', async ({ page }, testInfo) => {
    await expect(page.locator('#workspace-connection-label')).toHaveText('Connect a model');
    await expect(page.locator('.workspace-setup-status')).toContainText('connect a model');
    await expect(page.locator('.workspace-character-card')).toHaveCount(1);
    await expect(page.locator('.workspace-character-card strong')).toHaveText('Seraphina');
    await expect(page.locator('#workspace-persona-name')).not.toBeEmpty();
    await page.screenshot({ path: testInfo.outputPath('workspace-desktop.png') });
});

test('every named destination opens its existing drawer and closes with Escape', async ({ page }) => {
    const destinations = {
        characters: 'right-nav-panel',
        world: 'WorldInfo',
        persona: 'PersonaManagement',
        generation: 'left-nav-panel',
        connection: 'rm_api_block',
        prompts: 'AdvancedFormatting',
        extensions: 'rm_extensions_block',
        backgrounds: 'Backgrounds',
        settings: 'user-settings-block',
    };
    for (const [action, panel] of Object.entries(destinations)) {
        const button = page.locator(`#workspace-navigation [data-workspace-action="${action}"]`);
        await button.click();
        await expect(page.locator(`#${panel}`)).toBeVisible();
        await expect(page.locator('.drawer-content.openDrawer')).toHaveCount(1);
        await expect(button).toHaveAttribute('aria-expanded', 'true');
        await expect(page.locator(`#${panel} .workspace-panel-close`)).toBeFocused();
        await page.keyboard.press('Escape');
        await expect(page.locator(`#${panel}`)).toBeHidden();
        await expect(page.locator('#send_textarea')).toBeFocused();
    }
});

test('character shortcuts open a conversation and existing history', async ({ page }) => {
    await page.locator('.workspace-character-card').click();
    await expect(page.locator('#workspace-chat-title')).toHaveText('Seraphina');
    await expect(page.locator('#chat .mes_text')).toContainText('guardian of this forest');
    await expect(page.locator('#send_textarea')).toBeFocused();
    await expect(page.locator('.workspace-header-actions .workspace-button')).toHaveText('New chat');
    await page.locator('#workspace-history').click();
    await expect(page.locator('#select_chat_popup')).toBeVisible();
    await page.locator('#select_chat_cross').click();
    await page.locator('#workspace-navigation [data-workspace-action="home"]').click();
    await expect(page.locator('.workspace-home-intro')).toBeVisible();
});

test('command search works by keyboard and handles an empty result', async ({ page }) => {
    await page.keyboard.press('Control+k');
    await expect(page.locator('#workspace-command')).toBeVisible();
    await expect(page.locator('#workspace-command-input')).toBeFocused();
    await page.locator('#workspace-command-input').fill('unmatched-xyz-123');
    await expect(page.locator('#workspace-command-results')).toContainText('No matches');
    await page.locator('#workspace-command-input').fill('Connections');
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('#workspace-command-results button')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#workspace-command')).toBeHidden();
    await expect(page.locator('#rm_api_block')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.keyboard.press('Control+k');
    await page.locator('#workspace-command-input').fill('Seraphina');
    await page.keyboard.press('Enter');
    await expect(page.locator('#workspace-chat-title')).toHaveText('Seraphina');
});

test('connection status and the composer follow the existing generation pipeline', async ({ page }) => {
    await page.route('**/api/backends/chat-completions/status', route => route.fulfill({ json: { data: [{ id: 'workspace-fixture' }] } }));
    await page.route('**/api/backends/chat-completions/generate', route => route.fulfill({ json: { choices: [{ message: { content: 'The forest path opens before you.' } }] } }));
    await page.locator('#workspace-navigation [data-workspace-action="connection"]').click();
    await page.locator('#chat_completion_source').selectOption('custom');
    await page.locator('#custom_api_url_text').fill('http://127.0.0.1:12345/v1');
    await page.locator('#custom_model_id').fill('workspace-fixture');
    await page.locator('#api_button_openai').click();
    await expect(page.locator('#workspace-connection-label')).toHaveText('Model connected');
    await page.keyboard.press('Escape');
    await page.locator('.workspace-character-card').click();
    await page.locator('#workspace-navigation [data-workspace-action="generation"]').click();
    await page.locator('#stream_toggle').uncheck();
    await page.keyboard.press('Escape');
    await page.locator('#send_textarea').fill('Which path should we take?');
    await page.locator('#send_but').click();
    await expect(page.locator('#chat .mes[is_user="true"] .mes_text')).toContainText('Which path should we take?');
    await expect(page.locator('#chat .mes_text').last()).toContainText('The forest path opens before you.', { timeout: 15000 });
});

test('phone navigation closes, restores focus, and keeps chat within the viewport', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const menu = page.locator('#workspace-menu');
    await expect(menu).toBeVisible();
    await expect(page.locator('#workspace-sidebar')).toBeHidden();
    await menu.click();
    await expect(page.locator('#workspace-sidebar')).toBeVisible();
    await expect(menu).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#sheld')).toHaveAttribute('inert', '');
    await page.keyboard.press('Escape');
    await expect(page.locator('#workspace-sidebar')).toBeHidden();
    await expect(menu).toBeFocused();
    await expect(page.locator('#sheld')).not.toHaveAttribute('inert');
    await expect(page.locator('.workspace-header-actions .workspace-button')).toHaveAccessibleName('New conversation');
    const bounds = await page.locator('#sheld').boundingBox();
    expect(bounds.x).toBe(0);
    expect(bounds.width).toBe(390);
    await page.screenshot({ path: testInfo.outputPath('workspace-mobile.png') });
    await menu.click();
    await page.locator('#workspace-navigation [data-workspace-action="characters"]').click();
    await expect(page.locator('#workspace-sidebar')).toBeHidden();
    const panel = await page.locator('#right-nav-panel').boundingBox();
    expect(panel.x).toBeGreaterThanOrEqual(0);
    expect(panel.x + panel.width).toBeLessThanOrEqual(390);
    await expect(page.locator('#right-nav-panel .workspace-panel-close')).toBeFocused();
});

test('classic layout preference survives reload and can be restored', async ({ page }) => {
    await page.locator('#workspace-navigation [data-workspace-action="settings"]').click();
    const save = page.waitForResponse(response => response.url().endsWith('/api/settings/save') && response.request().postDataJSON().accountStorage?.workspaceLayout === 'false');
    await page.locator('#workspace-layout-toggle').uncheck();
    await save;
    await expect(page.locator('body')).not.toHaveClass(/workspace-ui/);
    await expect(page.locator('#workspace-sidebar')).toBeHidden();
    await expect(page.locator('#top-settings-holder .drawer-toggle').first()).toBeVisible();
    await page.reload();
    await expect(page.locator('#preloader')).toHaveCount(0, { timeout: 30000 });
    await expect(page.locator('body')).not.toHaveClass(/workspace-ui/);
    await page.locator('#workspace-restore').click();
    await expect(page.locator('body')).toHaveClass(/workspace-ui/);
    await expect(page.locator('#workspace-sidebar')).toBeVisible();
});
