import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { spawn, execFile } from 'node:child_process';
import { once } from 'node:events';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import yaml from 'yaml';

test.use({ channel: 'chromium', video: 'off', viewport: { width: 1280, height: 800 } });
test.describe.configure({ mode: 'default' });
test.setTimeout(150000);
test.skip(!process.env.ST_STREAM_LIFECYCLE, 'Opt in with ST_STREAM_LIFECYCLE=1; this file owns synthetic fixture port 8058.');

const projectRoot = path.resolve(new URL('..', import.meta.url).pathname);
const fixtureBase = '/tmp/st-ui-followup-20261109';
const baseURL = 'http://127.0.0.1:8058';
const sourceFiles = ['public/script.js', 'public/scripts/generation-transport.js', 'public/scripts/browser-recovery.js', 'public/scripts/openai.js', 'public/scripts/textgen-settings.js', 'public/scripts/kai-settings.js', 'public/scripts/nai-settings.js', 'public/scripts/group-chats.js', 'public/scripts/tool-calling.js', 'src/generation-jobs.js', 'src/endpoints/generation-jobs.js', 'src/endpoints/chats.js', 'src/server-startup.js'];
const sourceSnapshot = () => Object.fromEntries(sourceFiles.map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(projectRoot, file))).digest('hex')]));
const execute = promisify(execFile);

class LifecycleFixture {
    constructor(name) {
        this.directory = fs.mkdtempSync(path.join(fixtureBase, `lifecycle-${name}-`));
        this.data = path.join(this.directory, 'data');
        this.config = path.join(this.directory, 'config.yaml');
        const config = yaml.parse(fs.readFileSync(path.join(projectRoot, 'default/config.yaml'), 'utf8'));
        config.listen = false; config.port = 8058; config.browserLaunch.enabled = false;
        config.extensions.models.autoDownload = false;
        fs.writeFileSync(this.config, yaml.stringify(config));
        this.starts = 0;
        this.image = process.env.ST_LIFECYCLE_IMAGE;
        this.imageReceipts = [];
        this.volumes = [];
        if (this.image && !/(?:@|^)sha256:[a-f0-9]{64}$/.test(this.image)) throw new Error('ST_LIFECYCLE_IMAGE must be an immutable image digest.');
    }

    async start() {
        if (this.image) return this.startImage();
        const log = fs.openSync(path.join(this.directory, `server-${++this.starts}.log`), 'a');
        this.child = spawn(process.execPath, ['server.js', '--configPath', this.config, '--dataRoot', this.data, '--port', '8058', '--listen', 'false', '--browserLaunchEnabled', 'false'], { cwd: projectRoot, stdio: ['ignore', log, log] });
        fs.closeSync(log);
        await expect.poll(async () => {
            if (this.child.exitCode !== null) throw new Error(`Owned fixture exited ${this.child.exitCode}. Logs: ${this.directory}`);
            try { return (await fetch(baseURL)).status; } catch { return 0; }
        }, { timeout: 45000 }).toBe(200);
    }

    async stop(signal = 'SIGTERM') {
        if (this.image) {
            if (!this.containerCreated) return;
            const inspect = JSON.parse((await execute('podman', ['inspect', this.containerName])).stdout)[0];
            if (inspect.State.Running) {
                if (signal === 'SIGKILL') await execute('podman', ['kill', '--signal', 'KILL', this.containerName]);
                else await execute('podman', ['stop', '--time', '5', this.containerName]);
            }
            const log = await execute('podman', ['logs', this.containerName], { maxBuffer: 16 * 1024 * 1024 });
            fs.writeFileSync(path.join(this.directory, `server-${this.starts}.log`), log.stdout + log.stderr);
            return;
        }
        if (!this.child || this.child.exitCode !== null || this.child.signalCode !== null) return;
        const child = this.child;
        const closed = once(child, 'close');
        child.kill(signal);
        const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
        try { await closed; } finally { clearTimeout(timer); }
    }

    async startImage() {
        if (!this.containerCreated) {
            this.containerName = `st-${path.basename(this.directory)}`;
            const destinations = { config: '/home/node/app/config', data: '/home/node/app/data', plugins: '/home/node/app/plugins', extensions: '/home/node/app/public/scripts/extensions/third-party', backups: '/home/node/app/backups' };
            for (const [kind, destination] of Object.entries(destinations)) {
                const name = `${this.containerName}-${kind}`;
                await execute('podman', ['volume', 'create', name]);
                const mountpoint = (await execute('podman', ['volume', 'inspect', '--format', '{{.Mountpoint}}', name])).stdout.trim();
                this.volumes.push({ kind, name, mountpoint, destination });
            }
            this.data = this.volumes.find(volume => volume.kind === 'data').mountpoint;
            const configDirectory = this.volumes.find(volume => volume.kind === 'config').mountpoint;
            fs.copyFileSync(this.config, path.join(configDirectory, 'config.yaml'));
            const mounts = this.volumes.flatMap(volume => ['--volume', `${volume.name}:${volume.destination}:nocopy`]);
            await execute('podman', ['create', '--pull=never', '--network', 'host', '--name', this.containerName, ...mounts, this.image, '--listen', 'false', '--port', '8058', '--browserLaunchEnabled', 'false']);
            this.containerCreated = true;
        }
        this.starts++;
        await execute('podman', ['start', this.containerName]);
        await expect.poll(async () => {
            const inspect = JSON.parse((await execute('podman', ['inspect', this.containerName])).stdout)[0];
            if (!inspect.State.Running) throw new Error(`Owned image fixture exited ${inspect.State.ExitCode}. Container: ${this.containerName}`);
            try { return (await fetch(baseURL)).status; } catch { return 0; }
        }, { timeout: 45000 }).toBe(200);
        const inspect = JSON.parse((await execute('podman', ['inspect', this.containerName])).stdout)[0];
        const script = `const fs=require('node:fs'),crypto=require('node:crypto');console.log(JSON.stringify({version:JSON.parse(fs.readFileSync('package.json','utf8')).version,hashes:Object.fromEntries(${JSON.stringify(sourceFiles)}.map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')]))}));`;
        const runtime = JSON.parse((await execute('podman', ['exec', this.containerName, 'node', '--input-type=commonjs', '-e', script])).stdout);
        const mounts = inspect.Mounts.map(mount => ({ type: mount.Type, name: mount.Name, destination: mount.Destination, source: mount.Source }));
        const revision = inspect.Config.Labels?.['org.opencontainers.image.revision'];
        expect(runtime.version).toBe(JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8')).version);
        expect(revision).toMatch(/^[a-f0-9]{40}$/);
        if (process.env.ST_LIFECYCLE_EXPECTED_REVISION) expect(revision).toBe(process.env.ST_LIFECYCLE_EXPECTED_REVISION);
        expect(runtime.hashes).toEqual(sourceSnapshot());
        expect(mounts).toHaveLength(5);
        expect(mounts.every(mount => mount.type === 'volume')).toBe(true);
        expect(mounts.map(mount => mount.name).sort()).toEqual(this.volumes.map(volume => volume.name).sort());
        const receipt = { requestedImage: this.image, containerId: inspect.Id, imageId: inspect.Image, revision, version: runtime.version, runtimeHashes: runtime.hashes, mounts, networkMode: inspect.HostConfig.NetworkMode, start: this.starts };
        if (this.imageReceipts.length) {
            expect(receipt.containerId).toBe(this.imageReceipts[0].containerId);
            expect(receipt.imageId).toBe(this.imageReceipts[0].imageId);
            expect(receipt.mounts).toEqual(this.imageReceipts[0].mounts);
        }
        this.imageReceipts.push(receipt);
        fs.writeFileSync(path.join(this.directory, 'image-receipts.json'), JSON.stringify(this.imageReceipts, null, 2));
    }

    async close() {
        await this.stop();
        if (this.containerCreated) {
            await execute('podman', ['rm', this.containerName]);
            fs.writeFileSync(path.join(this.directory, 'fixture-cleanup.json'), JSON.stringify({ containerRemoved: this.containerName, retainedVolumes: this.volumes }, null, 2));
            this.containerCreated = false;
        }
    }

    transcript(identity) {
        const [handle, kind, owner, name] = JSON.parse(identity);
        return kind === 'character' ? path.join(this.data, handle, 'chats', owner.replace('.png', ''), `${name}.jsonl`) : path.join(this.data, handle, 'group chats', `${name}.jsonl`);
    }
}

async function nativeState(page) {
    return page.evaluate(async () => {
        const script = await import('/script.js');
        return { title: script.getCurrentChatId(), identity: script.getCurrentChatIdentity(), chat: script.chat, generating: script.isGenerating(), notice: document.querySelector('#browser-recovery')?.textContent };
    });
}

async function jobs(page) {
    return page.evaluate(async () => {
        const script = await import('/script.js');
        const response = await fetch(`/api/generation-jobs?story=${encodeURIComponent(script.getCurrentChatIdentity())}`, { headers: script.getRequestHeaders() });
        if (!response.ok) throw new Error(`Reply inventory HTTP ${response.status}`);
        return response.json();
    });
}

async function reopen(page, title) {
    await page.goto(baseURL);
    await expect(page.locator('#preloader')).toHaveCount(0, { timeout: 30000 });
    if (!await page.locator('#workspace-navigation [data-workspace-action="chats"]').isVisible()) await page.locator('#workspace-menu').click();
    await page.locator('#workspace-navigation [data-workspace-action="chats"]').click();
    await page.locator('.workspace-conversations .workspace-scene-row').filter({ has: page.locator('strong', { hasText: title }) }).locator('.workspace-scene-open').click();
    await expect(page.locator('#send_textarea')).toBeVisible();
}

async function reloadStory(page, title) {
    await page.reload();
    await reopen(page, title);
}

async function provider(page, settings = {}) {
    const calls = [];
    const server = createServer((request, response) => {
        let body = '';
        request.on('data', chunk => body += chunk);
        request.on('end', () => {
            if (request.url === '/v1/models') { response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ data: [{ id: 'lifecycle-model' }] })); return; }
            if (request.url !== '/v1/chat/completions') { response.writeHead(404).end(); return; }
            const call = { response, body: JSON.parse(body), closed: false };
            response.on('close', () => call.closed = true);
            calls.push(call);
        });
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    await page.evaluate(async ({ url, settings }) => {
        const script = await import('/script.js');
        const { oai_settings } = await import('/scripts/openai.js');
        Object.assign(oai_settings, { chat_completion_source: 'custom', custom_url: url, custom_model: 'lifecycle-model', stream_openai: true, n: 1, function_calling: false, ...settings });
        script.changeMainAPI('openai');
        script.setOnlineStatus('lifecycle-model');
        await script.saveSettings();
    }, { url: `http://127.0.0.1:${server.address().port}/v1`, settings });
    const fixture = {
        calls,
        async wait(count = 1) { await expect.poll(() => calls.length, { timeout: 15000 }).toBe(count); return calls[count - 1]; },
        event(call, value) {
            if (!call.started) { call.started = true; call.response.writeHead(200, { 'content-type': 'text/event-stream' }); }
            call.response.write(`data: ${JSON.stringify(value)}\n\n`);
        },
        chunk(call, text, index = 0) { this.event(call, { choices: [{ index, delta: { content: text } }] }); },
        finish(call, text = '', count = 1, reason = 'stop') {
            if (text) this.chunk(call, text);
            for (let index = 0; index < count; index++) this.event(call, { choices: [{ index, delta: {}, finish_reason: reason }] });
            call.response.end('data: [DONE]\n\n');
        },
        async close() { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); },
    };
    page.lifecycleProviders.push(fixture);
    return fixture;
}

test.beforeEach(async ({ page }, info) => {
    page.setDefaultTimeout(15000);
    page.lifecycleDiagnostics = { pageErrors: [], consoleErrors: [], failedRequests: [] };
    page.lifecycleProviders = [];
    page.lifecycleSources = sourceSnapshot();
    page.on('pageerror', error => page.lifecycleDiagnostics.pageErrors.push(error.stack || error.message));
    page.on('console', message => { if (message.type() === 'error') page.lifecycleDiagnostics.consoleErrors.push(message.text()); });
    page.on('requestfailed', request => page.lifecycleDiagnostics.failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
    fs.mkdirSync(fixtureBase, { recursive: true });
    page.lifecycleFixture = new LifecycleFixture(info.testId.replace(/[^a-z0-9]/gi, '').slice(-12));
    await page.lifecycleFixture.start();
    const settingsFile = path.join(page.lifecycleFixture.data, 'default-user', 'settings.json');
    const settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
    settings.firstRun = false; settings.active_character = null; settings.active_group = null; settings.main_api = 'openai';
    Object.assign(settings.power_user, { auto_connect: false, font_scale: 1, restore_user_input: true, auto_swipe: false });
    settings.power_user.auto_continue = { ...settings.power_user.auto_continue, enabled: false };
    settings.accountStorage = { ...settings.accountStorage, workspaceLayout: 'true', workspaceAdvancedSettings: 'false', workspaceArchivedChats: '[]' };
    settings.extension_settings.tts = { ...settings.extension_settings.tts, enabled: false, currentProvider: 'System' };
    settings.extension_settings.serviceConnections = { url: '' };
    fs.writeFileSync(settingsFile, JSON.stringify(settings));
    await page.goto(baseURL);
    await expect(page.locator('#preloader')).toHaveCount(0, { timeout: 30000 });
    await page.locator('#workspace-navigation [data-workspace-action="characters"]').click();
    await page.locator('.workspace-library-card').first().click();
    await page.getByRole('button', { name: 'Start new story', exact: true }).click();
    await expect(page.locator('#send_textarea')).toBeVisible();
    page.lifecycleTitle = (await nativeState(page)).title;
    // The fixture settings are read from native storage. Subsequent provider
    // choices use the real settings/save endpoint, including every reload.
    const save = page.waitForResponse(response => response.url().endsWith('/api/settings/save') && response.request().method() === 'POST');
    await page.evaluate(async () => (await import('/script.js')).saveSettings());
    expect((await save).ok()).toBe(true);
    fs.writeFileSync(info.outputPath('fixture.json'), JSON.stringify({ directory: page.lifecycleFixture.directory, port: 8058, image: page.lifecycleFixture.image || null, imageReceipts: page.lifecycleFixture.imageReceipts, volumes: page.lifecycleFixture.volumes, sources: page.lifecycleSources }, null, 2));
});

test.afterEach(async ({ page }, info) => {
    try {
        if (!page.isClosed() && page.url().startsWith(baseURL)) {
            fs.writeFileSync(info.outputPath('native-state.json'), JSON.stringify(await nativeState(page), null, 2));
            await page.screenshot({ path: info.outputPath('final.png') });
            await page.goto('about:blank');
        }
        fs.writeFileSync(info.outputPath('diagnostics.json'), JSON.stringify(page.lifecycleDiagnostics, null, 2));
        const sources = sourceSnapshot();
        fs.writeFileSync(info.outputPath('source-final.json'), JSON.stringify({ sources, changed: sourceFiles.filter(file => sources[file] !== page.lifecycleSources[file]) }, null, 2));
        if (page.lifecycleFixture.image) fs.writeFileSync(info.outputPath('image-receipts.json'), JSON.stringify(page.lifecycleFixture.imageReceipts, null, 2));
        expect(page.lifecycleDiagnostics.pageErrors).toEqual([]);
    } finally {
        for (const fixture of page.lifecycleProviders || []) await fixture.close();
        await page.lifecycleFixture?.close();
    }
});

test('a real server restart retains partial output and never reissues inference', async ({ page }, info) => {
    const fixture = await provider(page);
    await page.locator('#send_textarea').fill('Describe a quiet lantern.');
    await page.locator('#send_but').click();
    const call = await fixture.wait(); fixture.chunk(call, 'The lantern survives the interruption.');
    await expect(page.locator('#chat .mes_text').last()).toContainText('The lantern survives the interruption.');
    const pending = (await jobs(page))[0];
    await page.locator('#send_textarea').fill('My unsent next turn.');
    await page.goto('about:blank');
    await page.lifecycleFixture.stop('SIGKILL');
    await expect.poll(() => call.closed).toBe(true);
    await page.lifecycleFixture.start();
    await reopen(page, page.lifecycleTitle);
    await expect(page.locator('#mes_stop')).toBeHidden();
    await expect(page.locator('#chat .mes_text').last()).toHaveText('The lantern survives the interruption.');
    await expect(page.locator('#send_textarea')).toHaveValue('My unsent next turn.');
    await expect(page.locator('#browser-recovery')).toContainText('Reply interrupted');
    await expect.poll(async () => (await jobs(page)).length).toBe(0);
    expect(fixture.calls).toHaveLength(1);
    const state = await nativeState(page);
    expect(state.chat.filter(message => message.extra?.generation_job === pending.id)).toHaveLength(1);
    fs.writeFileSync(info.outputPath('restart.json'), JSON.stringify({ starts: page.lifecycleFixture.starts, providerCalls: fixture.calls.length, message: state.chat.at(-1) }, null, 2));
});

test('repeated active reloads preserve one reply and a draft across narrow and short windows', async ({ page }) => {
    const fixture = await provider(page);
    await page.locator('#send_textarea').fill('Describe a quiet lantern.'); await page.locator('#send_but').click();
    const call = await fixture.wait(); fixture.chunk(call, 'A lantern ');
    await expect(page.locator('#chat .mes_text').last()).toContainText('A lantern');
    const job = (await jobs(page))[0];
    await page.locator('#send_textarea').fill('Draft kept through three reloads.');
    for (const viewport of [{ width: 390, height: 400 }, { width: 945, height: 396 }, { width: 1280, height: 800 }]) {
        await page.setViewportSize(viewport);
        await reloadStory(page, page.lifecycleTitle);
        await expect(page.locator('#mes_stop')).toBeVisible();
        await expect(page.locator('#chat .mes_text').last()).toContainText('A lantern');
        expect((await jobs(page))[0].id).toBe(job.id);
        await expect(page.locator('#send_textarea')).toHaveValue('Draft kept through three reloads.');
        expect(fixture.calls).toHaveLength(1);
    }
    fixture.finish(call, 'lights one path.');
    await expect(page.locator('#mes_stop')).toBeHidden();
    await expect(page.locator('#chat .mes_text').last()).toHaveText('A lantern lights one path.');
    await expect.poll(async () => (await jobs(page)).length).toBe(0);
    expect((await nativeState(page)).chat.filter(message => message.extra?.generation_job === job.id)).toHaveLength(1);
});

test('a native swipe resumes after reload without duplicating its original alternative', async ({ page }) => {
    const fixture = await provider(page);
    await page.locator('#send_textarea').fill('Describe the first lantern.'); await page.locator('#send_but').click();
    const first = await fixture.wait(); fixture.finish(first, 'The original lantern reply.');
    await expect(page.locator('#mes_stop')).toBeHidden();
    await expect.poll(async () => (await jobs(page)).length).toBe(0);
    const original = (await nativeState(page)).chat.at(-1).mes;
    await page.locator('#chat .mes').last().hover();
    await page.locator('#chat .mes').last().locator('.swipe_right').click();
    const call = await fixture.wait(2); fixture.chunk(call, 'An alternative lantern ');
    await expect(page.locator('#chat .mes_text').last()).toContainText('An alternative lantern');
    expect((await jobs(page))[0].context.type).toBe('swipe');
    await reloadStory(page, page.lifecycleTitle);
    fixture.finish(call, 'lights the room.');
    await expect(page.locator('#mes_stop')).toBeHidden();
    await expect.poll(async () => (await jobs(page)).length).toBe(0);
    const state = await nativeState(page);
    expect(state.chat).toHaveLength(3);
    expect(state.chat.at(-1).swipes).toEqual([original, 'An alternative lantern lights the room.']);
    expect(state.chat.at(-1).swipe_id).toBe(1);
    await reloadStory(page, page.lifecycleTitle);
    expect((await nativeState(page)).chat.at(-1).swipes).toEqual(state.chat.at(-1).swipes);
    expect(fixture.calls).toHaveLength(2);
});

test('multi-choice replay retains every alternative once after active reload', async ({ page }) => {
    const fixture = await provider(page, { n: 3 });
    await page.locator('#send_textarea').fill('Describe three lanterns.'); await page.locator('#send_but').click();
    const call = await fixture.wait();
    expect(call.body.n).toBe(3);
    fixture.chunk(call, 'The first ', 0); fixture.chunk(call, 'The second ', 1); fixture.chunk(call, 'The third ', 2);
    await expect(page.locator('#chat .mes_text').last()).toContainText('The first');
    await reloadStory(page, page.lifecycleTitle);
    fixture.chunk(call, 'lantern.', 0); fixture.chunk(call, 'lantern.', 1); fixture.chunk(call, 'lantern.', 2);
    fixture.finish(call, '', 3);
    await expect(page.locator('#mes_stop')).toBeHidden();
    await expect.poll(async () => (await jobs(page)).length).toBe(0);
    expect((await nativeState(page)).chat.at(-1).swipes).toEqual(['The first lantern.', 'The second lantern.', 'The third lantern.']);
    await reloadStory(page, page.lifecycleTitle);
    expect((await nativeState(page)).chat.at(-1).swipes).toEqual(['The first lantern.', 'The second lantern.', 'The third lantern.']);
    expect(fixture.calls).toHaveLength(1);
});

test('reload uses the original parser after provider settings change', async ({ page }) => {
    const fixture = await provider(page);
    await page.locator('#send_textarea').fill('Describe a quiet lantern.'); await page.locator('#send_but').click();
    const call = await fixture.wait(); fixture.chunk(call, 'The original parser ');
    await expect(page.locator('#chat .mes_text').last()).toContainText('The original parser');
    await page.evaluate(async () => {
        const script = await import('/script.js'); const { oai_settings } = await import('/scripts/openai.js');
        oai_settings.chat_completion_source = 'claude'; oai_settings.show_thoughts = true;
        script.changeMainAPI('textgenerationwebui');
        await script.saveSettings();
    });
    await reloadStory(page, page.lifecycleTitle);
    fixture.finish(call, 'still reads the reply.');
    await expect(page.locator('#mes_stop')).toBeHidden();
    await expect(page.locator('#chat .mes_text').last()).toHaveText('The original parser still reads the reply.');
    await expect.poll(async () => (await jobs(page)).length).toBe(0);
    expect(fixture.calls).toHaveLength(1);
    expect(await page.evaluate(async () => (await import('/script.js')).main_api)).toBe('textgenerationwebui');
});

test('a same-integrity concurrent disk edit is preserved and prevents a second inference', async ({ page }, info) => {
    const fixture = await provider(page);
    await page.locator('#send_textarea').fill('Describe a quiet lantern.'); await page.locator('#send_but').click();
    const call = await fixture.wait(); fixture.chunk(call, 'A delayed reply ');
    await expect(page.locator('#chat .mes_text').last()).toContainText('A delayed reply');
    const state = await nativeState(page);
    const file = page.lifecycleFixture.transcript(state.identity);
    await page.goto('about:blank');
    const rows = fs.readFileSync(file, 'utf8').trim().split('\n').map(line => JSON.parse(line));
    rows.push({ name: 'User', is_user: true, is_system: false, mes: 'A concurrent edit to the same story.', send_date: 'concurrent-edit', extra: {} });
    const expected = rows.map(row => JSON.stringify(row)).join('\n');
    fs.writeFileSync(file, expected);
    fixture.finish(call, 'must remain separate.');
    await reopen(page, page.lifecycleTitle);
    await expect(page.locator('#browser-recovery')).toContainText('story changed');
    await expect(page.locator('#chat .mes_text').last()).toHaveText('A concurrent edit to the same story.');
    expect(fs.readFileSync(file, 'utf8')).toBe(expected);
    expect(await jobs(page)).toHaveLength(1);
    await page.evaluate(async () => (await import('/script.js')).setOnlineStatus('lifecycle-model'));
    await page.getByRole('button', { name: 'Retry connection', exact: true }).click();
    await expect(page.locator('#browser-recovery')).toContainText('story changed');
    await expect(page.getByRole('button', { name: 'Discard interrupted reply', exact: true })).toBeVisible();
    await expect(page.locator('#send_but')).toBeVisible();
    await page.locator('#send_textarea').fill('Do not lose this next draft.'); await page.locator('#send_but').click();
    await expect(page.locator('#send_textarea')).toHaveValue('Do not lose this next draft.');
    expect(fs.readFileSync(file, 'utf8')).toBe(expected);
    expect(fixture.calls).toHaveLength(1);
    fs.writeFileSync(info.outputPath('concurrent-transcript.json'), JSON.stringify(rows, null, 2));
    const discard = page.getByRole('button', { name: 'Discard interrupted reply', exact: true });
    for (const viewport of [{ width: 320, height: 700 }, { width: 844, height: 390 }, { width: 390, height: 844 }]) {
        await page.setViewportSize(viewport);
        await expect(discard).toBeVisible();
        const bounds = await page.locator('#browser-recovery').evaluate(element => {
            const rect = element.getBoundingClientRect();
            return { left: rect.left, right: rect.right, scrollWidth: element.scrollWidth, clientWidth: element.clientWidth };
        });
        expect(bounds.left).toBeGreaterThanOrEqual(0);
        expect(bounds.right).toBeLessThanOrEqual(viewport.width);
        expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.clientWidth + 1);
        await discard.click({ trial: true });
        await page.screenshot({ path: info.outputPath(`conflict-${viewport.width}x${viewport.height}.png`) });
    }
    await discard.click();
    await page.getByRole('button', { name: 'Keep reply', exact: true }).click();
    expect(await jobs(page)).toHaveLength(1);
    expect(fs.readFileSync(file, 'utf8')).toBe(expected);
    await expect(page.locator('#send_textarea')).toHaveValue('Do not lose this next draft.');
    await discard.click();
    await page.getByRole('button', { name: 'Discard reply', exact: true }).click();
    await expect.poll(async () => (await jobs(page)).length).toBe(0);
    expect(fs.readFileSync(file, 'utf8')).toBe(expected);
    await expect(page.locator('#send_textarea')).toHaveValue('Do not lose this next draft.');
    expect(fixture.calls).toHaveLength(1);
    await page.locator('#send_but').click();
    const next = await fixture.wait(2);
    fixture.finish(next, 'A fresh reply follows the saved story.');
    await expect(page.locator('#chat .mes_text').last()).toHaveText('A fresh reply follows the saved story.');
    await expect.poll(async () => (await jobs(page)).length).toBe(0);
    expect((await nativeState(page)).chat.some(message => message.mes === 'A concurrent edit to the same story.')).toBe(true);
});

test('a lost HTTP commit acknowledgement leaves the saved last reply intact after fresh reload', async ({ page }) => {
    const fixture = await provider(page);
    let acknowledge;
    const applied = new Promise(resolve => acknowledge = resolve);
    await page.route('**/api/generation-jobs/*/commit', async route => {
        const response = await route.fetch();
        expect(response.status()).toBe(200);
        acknowledge();
        await route.abort('failed');
    });
    await page.locator('#send_textarea').fill('Describe a quiet lantern.'); await page.locator('#send_but').click();
    const call = await fixture.wait(); fixture.finish(call, 'The saved lantern stays exactly here.');
    await applied;
    const state = await nativeState(page);
    const file = page.lifecycleFixture.transcript(state.identity);
    const expected = fs.readFileSync(file, 'utf8');
    await page.unroute('**/api/generation-jobs/*/commit');
    await reloadStory(page, page.lifecycleTitle);
    await expect(page.locator('#chat .mes_text').last()).toHaveText('The saved lantern stays exactly here.');
    await expect.poll(async () => (await jobs(page)).length).toBe(0);
    expect(fs.readFileSync(file, 'utf8')).toBe(expected);
    expect(fixture.calls).toHaveLength(1);
    expect((await nativeState(page)).chat.filter(message => message.extra?.generation_job)).toHaveLength(1);
});

test('a recovered cast reply does not automatically advance to another member', async ({ page }) => {
    const group = await page.evaluate(async () => {
        const script = await import('/script.js');
        const avatar = script.characters[0].avatar;
        const duplicate = await fetch('/api/characters/duplicate', { method: 'POST', headers: script.getRequestHeaders(), body: JSON.stringify({ avatar_url: avatar }) }).then(response => response.json());
        const companion = await fetch('/api/characters/rename', { method: 'POST', headers: script.getRequestHeaders(), body: JSON.stringify({ avatar_url: duplicate.path, new_name: 'Lifecycle companion' }) }).then(response => response.json());
        await script.getCharacters();
        const groups = await import('/scripts/group-chats.js');
        const group = await groups.createGroupWithMembers('Lifecycle cast', [avatar, companion.avatar]);
        groups.groups.find(value => value.id === group.id).activation_strategy = 1;
        await groups.editGroup(group.id, true, false);
        await groups.openGroupById(group.id, { newChat: true });
        return group;
    });
    await expect(page.locator('#send_textarea')).toBeVisible();
    page.lifecycleTitle = (await nativeState(page)).title;
    const fixture = await provider(page);
    await page.locator('#send_textarea').fill('Describe the room together.'); await page.locator('#send_but').click();
    const call = await fixture.wait(); fixture.chunk(call, 'One cast member notices ');
    await expect(page.locator('#chat .mes_text').last()).toContainText('One cast member notices');
    const pending = (await jobs(page))[0];
    expect(JSON.parse(pending.story)[1]).toBe('group');
    await page.locator('#send_textarea').fill('An unsent cast draft.');
    await reloadStory(page, page.lifecycleTitle);
    fixture.finish(call, 'the lantern.');
    await expect(page.locator('#mes_stop')).toBeHidden();
    await expect(page.locator('#chat .mes_text').last()).toHaveText('One cast member notices the lantern.');
    await expect(page.locator('#send_textarea')).toHaveValue('An unsent cast draft.');
    await expect.poll(async () => (await jobs(page)).length).toBe(0);
    expect(await page.evaluate(async () => (await import('/scripts/group-chats.js')).selected_group)).toBe(group.id);
    expect((await nativeState(page)).chat.filter(message => message.extra?.generation_job === pending.id)).toHaveLength(1);
    expect(fixture.calls).toHaveLength(1);
});

test('an already executed tool is not repeated when its follow-up reply resumes after reload', async ({ page }) => {
    const fixture = await provider(page, { function_calling: true });
    await page.evaluate(async () => {
        localStorage.setItem('lifecycle-tool-invocations', '0');
        const { ToolManager } = await import('/scripts/tool-calling.js');
        ToolManager.registerFunctionTool({
            name: 'lifecycle_lantern', displayName: 'Lifecycle lantern', description: 'Record one neutral lantern observation.',
            parameters: { type: 'object', properties: {}, additionalProperties: false },
            action: () => {
                localStorage.setItem('lifecycle-tool-invocations', String(Number(localStorage.getItem('lifecycle-tool-invocations')) + 1));
                return 'One lantern observation recorded.';
            },
        });
    });
    await page.locator('#send_textarea').fill('Check the lantern once.'); await page.locator('#send_but').click();
    const first = await fixture.wait();
    expect(first.body.tools.some(tool => tool.function.name === 'lifecycle_lantern')).toBe(true);
    fixture.event(first, { choices: [{ index: 0, delta: { tool_calls: [{ index: 0, id: 'lifecycle-tool-call-1', type: 'function', function: { name: 'lifecycle_lantern', arguments: '{}' } }] } }] });
    fixture.finish(first, '', 1, 'tool_calls');
    const followup = await fixture.wait(2);
    expect(await page.evaluate(() => Number(localStorage.getItem('lifecycle-tool-invocations')))).toBe(1);
    fixture.chunk(followup, 'The observed lantern ');
    await expect(page.locator('#chat .mes_text').last()).toContainText('The observed lantern');
    await reloadStory(page, page.lifecycleTitle);
    fixture.finish(followup, 'lights the room.');
    await expect(page.locator('#mes_stop')).toBeHidden();
    await expect(page.locator('#chat .mes_text').last()).toHaveText('The observed lantern lights the room.');
    await expect.poll(async () => (await jobs(page)).length).toBe(0);
    expect(await page.evaluate(() => Number(localStorage.getItem('lifecycle-tool-invocations')))).toBe(1);
    const invocations = (await nativeState(page)).chat.flatMap(message => message.extra?.tool_invocations || []);
    expect(invocations.filter(invocation => invocation.id === 'lifecycle-tool-call-1')).toHaveLength(1);
    expect(fixture.calls).toHaveLength(2);
});

test('coalesced multi-choice events preserve every alternative through reload', async ({ page }) => {
    const fixture = await provider(page, { n: 3 });
    await page.evaluate(async () => {
        const { power_user } = await import('/scripts/power-user.js');
        power_user.smooth_streaming = true;
        await (await import('/script.js')).saveSettings();
    });
    await page.locator('#send_textarea').fill('Describe three lanterns.'); await page.locator('#send_but').click();
    const call = await fixture.wait();
    expect(call.body.n).toBe(3);
    fixture.event(call, { choices: [
        { index: 0, delta: { content: 'The first ' } },
        { index: 1, delta: { content: 'The second ' } },
        { index: 2, delta: { content: 'The third ' } },
    ] });
    await expect(page.locator('#chat .mes_text').last()).toContainText('The first');
    await reloadStory(page, page.lifecycleTitle);
    fixture.event(call, { choices: [
        { index: 2, delta: { content: 'lantern.' }, finish_reason: 'stop' },
        { index: 0, delta: { content: 'lantern.' }, finish_reason: 'stop' },
        { index: 1, delta: { content: 'lantern.' }, finish_reason: 'stop' },
    ] });
    call.response.end('data: [DONE]\n\n');
    await expect(page.locator('#mes_stop')).toBeHidden();
    await expect.poll(async () => (await jobs(page)).length).toBe(0);
    expect((await nativeState(page)).chat.at(-1).swipes).toEqual(['The first lantern.', 'The second lantern.', 'The third lantern.']);
    await reloadStory(page, page.lifecycleTitle);
    expect((await nativeState(page)).chat.at(-1).swipes).toEqual(['The first lantern.', 'The second lantern.', 'The third lantern.']);
    expect(fixture.calls).toHaveLength(1);
});
