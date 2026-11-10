/* eslint-disable playwright/no-standalone-expect, playwright/prefer-web-first-assertions -- Jest exercises native functions with controlled I/O. */
import { describe, expect, jest, test } from '@jest/globals';
import fs from 'node:fs';
import vm from 'node:vm';
import { parse } from 'acorn';

const source = fs.readFileSync(new URL('../public/scripts/extensions/tts/index.js', import.meta.url), 'utf8');
const names = ['isPlaybackCurrent', 'isTtsJobCurrent', 'resetTtsPlayback', 'tts', 'addAudioJob', 'completeTtsJob', 'playAudioData', 'completeCurrentAudioJob', 'processAudioJobQueue', 'processTtsQueue', 'parseMessageSegments', 'joinQuotedBlocks'];
const code = parse(source, { ecmaVersion: 'latest', sourceType: 'module' }).body.map(node => node.declaration || node).filter(node => node.type === 'FunctionDeclaration' && names.includes(node.id.name)).map(node => source.slice(node.start, node.end)).join('\n');
const deferred = () => { let resolve; const promise = new Promise(done => resolve = done); return { promise, resolve }; };
const response = text => new Response(new Blob([text], { type: 'audio/wav' }));
function fixture() {
    const context = vm.createContext({
        Blob, Response, setTimeout, structuredClone, console: { debug() {}, info() {}, log() {}, warn() {}, error() {} },
        toastr: { error: jest.fn(), info: jest.fn() }, playbackEpoch: 0, story: 'A', getCurrentChatIdentity: () => context.story,
        extension_settings: { tts: { enabled: true, playback_rate: 1 } },
        currentTtsJob: { id: 1, name: 'Old' }, currentAudioJob: null, ttsJobQueue: [], audioJobQueue: [], audioPaused: false, audioQueueProcessorReady: true,
        audioElement: { src: '', currentTime: 0, pause: jest.fn(), play: jest.fn(async () => {}) }, cancelTtsPlay: jest.fn(),
        eventSource: { emit: jest.fn(async () => {}) }, event_types: { TTS_JOB_STARTED: 'start', TTS_AUDIO_READY: 'audio', TTS_JOB_COMPLETE: 'complete' },
        ttsProvider: { generateTts: jest.fn(async () => response('normal')), getVoice: jest.fn(async () => ({ voice_id: 'neutral' })) },
        getBase64Async: jest.fn(async blob => `data:audio/wav;base64,${Buffer.from(await blob.text()).toString('base64')}`), wrapper: { update: jest.fn() },
        voiceMap: { Old: 'neutral' }, DEFAULT_VOICE_MARKER: '[Default Voice]', DISABLED_VOICE_MARKER: 'disabled', accountStorage: { getItem: () => null, setItem() {} },
        substituteParams: value => value, regexFromString: value => new RegExp(value), power_user: { allow_name2_display: true }, escapeRegex: value => value,
    });
    vm.runInContext(code, context);
    return { context, owner: () => ({ epoch: context.playbackEpoch, provider: context.ttsProvider, story: context.story, job: context.currentTtsJob }) };
}

describe('native TTS operation lifetime', () => {
    test.each(['stop', 'story', 'provider'])('late provider audio cannot queue or clear a newer job after %s', async change => {
        const f = fixture(), gate = deferred(), began = deferred();
        f.context.ttsProvider.generateTts.mockImplementation(async () => { began.resolve(); await gate.promise; return response('old'); });
        const pending = f.context.tts('old', 'neutral', 'Old', null, f.owner()); await began.promise;
        if (change === 'stop') f.context.resetTtsPlayback();
        if (change === 'story') f.context.story = 'B';
        if (change === 'provider') f.context.ttsProvider = {};
        const newer = f.context.currentTtsJob = { id: 2, name: 'New' };
        gate.resolve(); await pending;
        expect(f.context.audioJobQueue).toHaveLength(0); expect(f.context.currentTtsJob).toBe(newer);
        expect(f.context.eventSource.emit.mock.calls.map(call => call[0])).toEqual(['start']);
    });
    test('cancellation during response body reading preserves the new job and emits no ready event', async () => {
        const f = fixture(), gate = deferred(), began = deferred();
        f.context.ttsProvider.generateTts.mockResolvedValue({ blob: async () => { began.resolve(); return gate.promise; } });
        const pending = f.context.tts('old', 'neutral', 'Old', null, f.owner()); await began.promise;
        f.context.resetTtsPlayback(); const newer = f.context.currentTtsJob = { name: 'New' };
        gate.resolve(new Blob(['old'], { type: 'audio/wav' })); await pending;
        expect(f.context.audioJobQueue).toHaveLength(0); expect(f.context.currentTtsJob).toBe(newer);
    });
    test('a late async generator chunk cannot return cancelled audio', async () => {
        const f = fixture(), gate = deferred(), began = deferred();
        f.context.ttsProvider.generateTts.mockImplementation(async function* () { yield response('first'); began.resolve(); await gate.promise; yield response('late'); });
        const pending = f.context.tts('old', 'neutral', 'Old', null, f.owner()); await began.promise;
        expect(f.context.audioJobQueue).toHaveLength(1); f.context.resetTtsPlayback(); gate.resolve(); await pending;
        expect(f.context.audioJobQueue).toHaveLength(0);
    });
    test('cancelled blob conversion never assigns a media source or starts playback', async () => {
        const f = fixture(), gate = deferred(); f.context.getBase64Async.mockReturnValue(gate.promise);
        const job = f.context.currentAudioJob = { audioBlob: new Blob(['old']), char: 'Old', owner: f.owner() };
        const pending = f.context.playAudioData(job); f.context.resetTtsPlayback(); gate.resolve('data:audio/wav;base64,b2xk'); await pending;
        expect(f.context.audioElement.src).toBe(''); expect(f.context.audioElement.play).not.toHaveBeenCalled();
    });
    test('a queued canplay callback from a cancelled job cannot play the new job', async () => {
        const f = fixture(); const job = f.context.currentAudioJob = { audioBlob: '/neutral.wav', char: 'Old', owner: f.owner() };
        await f.context.playAudioData(job); const late = f.context.audioElement.oncanplay;
        f.context.resetTtsPlayback(); f.context.currentAudioJob = { name: 'New' }; late();
        expect(f.context.audioElement.play).not.toHaveBeenCalled();
    });
    test('normal narration still queues, plays and completes once', async () => {
        const f = fixture(); await f.context.tts('normal', 'neutral', 'Old', null, f.owner());
        expect(f.context.currentTtsJob).toBeNull(); expect(f.context.audioJobQueue).toHaveLength(1);
        await f.context.processAudioJobQueue(); f.context.audioElement.oncanplay();
        expect(f.context.audioElement.play).toHaveBeenCalledTimes(1); f.context.audioElement.onended();
        expect(f.context.currentAudioJob).toBeNull(); expect(f.context.audioQueueProcessorReady).toBe(true);
        expect(f.context.eventSource.emit.mock.calls.map(call => call[0])).toEqual(['start', 'audio', 'complete']);
    });
    test('a late provider text transformation does not segment into the new queue', async () => {
        const f = fixture(), gate = deferred(); f.context.ttsProvider.processText = jest.fn(() => gate.promise);
        f.context.currentTtsJob = null; f.context.ttsJobQueue.push({ name: 'Old', mes: 'old', extra: {} });
        const pending = f.context.processTtsQueue(); f.context.resetTtsPlayback(); const newer = f.context.currentTtsJob = { name: 'New' };
        gate.resolve('late'); await pending;
        expect(f.context.ttsJobQueue).toHaveLength(0); expect(f.context.currentTtsJob).toBe(newer);
    });
    test('a late voice lookup cannot dispatch generation after stop', async () => {
        const f = fixture(), gate = deferred(); f.context.ttsProvider.getVoice.mockReturnValue(gate.promise);
        f.context.currentTtsJob = null; f.context.ttsJobQueue.push({ name: 'Old', segmentType: 'other', segmentText: 'old' });
        const pending = f.context.processTtsQueue(); f.context.resetTtsPlayback(); gate.resolve({ voice_id: 'neutral' }); await pending;
        expect(f.context.ttsProvider.generateTts).not.toHaveBeenCalled(); expect(f.context.audioJobQueue).toHaveLength(0);
    });
    test('a rejected play promise clears its job and permits the next audio job', async () => {
        const f = fixture(); f.context.audioElement.play.mockRejectedValue(new Error('Synthetic browser playback failure'));
        f.context.audioJobQueue.push({ audioBlob: '/neutral.wav', char: 'Old', owner: f.owner() });
        await f.context.processAudioJobQueue(); f.context.audioElement.oncanplay(); await Promise.resolve();
        expect(f.context.currentAudioJob).toBeNull(); expect(f.context.audioQueueProcessorReady).toBe(true); expect(f.context.toastr.error).toHaveBeenCalledTimes(1);
    });
});

describe('native voice map initialization owner', () => {
    const declarations = parse(source, { ecmaVersion: 'latest', sourceType: 'module' }).body.map(node => node.declaration || node);
    const initCode = declarations.filter(node => node.type === 'FunctionDeclaration' && node.id.name === 'initVoiceMap').map(node => source.slice(node.start, node.end)).join('\n');
    test('a changed provider starts immediately and late old completion cannot clear its request', async () => {
        const old = deferred(), next = deferred();
        const context = vm.createContext({ currentVoiceMapRequest: null, ttsProvider: {}, getCurrentChatIdentity: () => 'same-story', initVoiceMapInternal: jest.fn(() => old.promise) });
        vm.runInContext(initCode.replace('export async function', 'async function'), context);
        const first = context.initVoiceMap(); context.ttsProvider = {};
        context.initVoiceMapInternal.mockImplementation(() => next.promise); const second = context.initVoiceMap();
        expect(context.initVoiceMapInternal).toHaveBeenCalledTimes(2); const owner = context.currentVoiceMapRequest;
        old.resolve(); await first; expect(context.currentVoiceMapRequest).toBe(owner);
        next.resolve(); await second; expect(context.currentVoiceMapRequest).toBeNull();
    });
});
