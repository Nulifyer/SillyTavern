import { test, expect } from '@playwright/test';
import fs from 'node:fs';

test.use({ channel: 'chromium', video: 'off', viewport: { width: 390, height: 844 } });
test.setTimeout(60000);
const account = { handle: 'audit-account', name: 'Audit account', avatar: '/img/ai4.png', password: true };

async function loginPage(page) {
    page.loginErrors = [];
    page.on('pageerror', error => page.loginErrors.push(error.message));
    await page.route('**/audit-login', route => route.fulfill({ contentType: 'text/html', body: fs.readFileSync(new URL('../public/login.html', import.meta.url), 'utf8') }));
    await page.route('**/csrf-token', route => route.fulfill({ json: { token: 'synthetic-login-token' } }));
    await page.route('**/api/users/list', route => route.fulfill({ json: [account] }));
}

for (const failure of ['accounts', 'csrf', 'malformed accounts']) {
    test(`login shows a retryable ${failure} failure instead of a blank page`, async ({ page }, info) => {
        await loginPage(page);
        let failed = false;
        const endpoint = failure === 'csrf' ? '**/csrf-token' : '**/api/users/list';
        await page.route(endpoint, async route => {
            if (!failed) {
                failed = true;
                await route.fulfill(failure === 'malformed accounts'
                    ? { json: { unexpected: true } }
                    : { status: 503, json: { error: 'Synthetic account list unavailable' } });
            } else await route.fallback();
        });
        await page.goto('/audit-login');
        await expect(page.locator('#shadow_popup')).toHaveCSS('opacity', '1');
        await expect(page.getByRole('alert')).not.toBeEmpty();
        await page.getByRole('button', { name: 'Retry', exact: true }).click();
        const card = page.getByRole('button', { name: /Audit account/ });
        await expect(card).toBeVisible();
        await card.focus(); await page.keyboard.press('Enter');
        await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
        await page.screenshot({ path: info.outputPath('login-ready.png') });
        expect(page.loginErrors).toEqual([]);
    });
}

test('native login and recovery controls support keyboard activation and report failed requests', async ({ page }, info) => {
    await loginPage(page);
    let logins = 0, recovery = 0;
    await page.route('**/api/users/login', route => { logins++; return route.fulfill({ status: 401, json: { error: 'Synthetic password rejected' } }); });
    await page.route('**/api/users/recover-step1', route => {
        recovery++;
        return route.fulfill(recovery === 1 ? { status: 503, json: { error: 'Synthetic recovery unavailable' } } : { json: {} });
    });
    await page.route('**/api/users/recover-step2', route => route.abort('failed'));
    await page.goto('/audit-login');
    const card = page.getByRole('button', { name: /Audit account/ });
    await card.focus(); await page.keyboard.press('Space');
    await page.getByLabel('Password', { exact: true }).fill('synthetic-password');
    await page.getByRole('button', { name: 'Login', exact: true }).focus(); await page.keyboard.press('Enter');
    await expect(page.getByRole('alert')).toHaveText('Synthetic password rejected');
    expect(logins).toBe(1);
    await page.getByRole('link', { name: 'Forgot password?' }).click();
    await expect(page.getByRole('alert')).toHaveText('Synthetic recovery unavailable');
    await page.getByRole('link', { name: 'Forgot password?' }).click();
    await page.getByLabel('Recovery code', { exact: true }).fill('000000');
    await page.getByLabel('New password', { exact: true }).fill('synthetic-new-password');
    await page.getByRole('button', { name: 'Send', exact: true }).focus(); await page.keyboard.press('Enter');
    await expect(page.getByRole('alert')).toContainText(/fetch|connect/i);
    await page.getByRole('button', { name: 'Cancel', exact: true }).focus(); await page.keyboard.press('Enter');
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Recovery code', { exact: true })).toBeHidden();
    await page.screenshot({ path: info.outputPath('recovery-returned.png') });
    expect(page.loginErrors).toEqual([]);
});
