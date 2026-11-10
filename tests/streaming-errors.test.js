/* eslint-disable playwright/no-standalone-expect -- Jest verifies the native protocol error boundary. */
import { describe, expect, jest, test } from '@jest/globals';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/scripts/openai.js', import.meta.url), 'utf8');
function nativeFunction(name) {
    const start = source.indexOf(`function ${name}(`);
    if (start < 0) throw new Error(`Missing native function ${name}`);
    return source.slice(start, source.indexOf('\n}', start) + 2);
}
function fixture() {
    const error = jest.fn(), info = jest.fn();
    const context = vm.createContext({ toastr: { error, info }, t: strings => strings.join(''), renderTemplateAsync: () => Promise.resolve('Synthetic quota information'), Popup: { show: { text: jest.fn() } } });
    vm.runInContext(['getChatCompletionErrorMessage', 'checkQuotaError', 'checkModerationError', 'tryParseStreamingError'].map(nativeFunction).join('\n'), context);
    return { parse: (data, quiet = true) => context.tryParseStreamingError({ ok: true, statusText: '' }, typeof data === 'string' ? data : JSON.stringify(data), { quiet }), error, info };
}

describe('native streaming error boundary', () => {
    test.each([
        [{ error: { message: 'Synthetic provider failure' } }, 'Synthetic provider failure'],
        [{ error: 'Synthetic string failure' }, 'Synthetic string failure'],
        [{ error: { message: 403 } }, '403'],
        [{ detail: 'Synthetic detailed failure' }, 'Synthetic detailed failure'],
        [{ message: 'Synthetic message failure' }, 'Synthetic message failure'],
        [{ quota_error: true }, 'quota'],
        [{ quota_error: 'Synthetic quota exhausted' }, 'Synthetic quota exhausted'],
        [{ error: { message: 'Synthetic model requires moderation', metadata: { reasons: ['synthetic'], flagged_input: 'Neutral fixture' } } }, 'requires moderation'],
    ])('throws a readable terminal error for %j', (data, message) => {
        const { parse, error, info } = fixture();
        expect(() => parse(data)).toThrow(message);
        expect(error).not.toHaveBeenCalled(); expect(info).not.toHaveBeenCalled();
    });
    test('preserves ordinary OpenAI and Anthropic success packets', () => {
        const { parse } = fixture();
        expect(() => parse({ choices: [{ index: 0, delta: { content: 'A neutral reply' } }] })).not.toThrow();
        expect(() => parse({ type: 'message_start', message: { id: 'synthetic', role: 'assistant', content: [] } })).not.toThrow();
        expect(() => parse('[DONE]')).not.toThrow();
    });
    test('visible provider errors are reported once and still thrown', () => {
        const { parse, error } = fixture();
        expect(() => parse({ error: { message: 'Synthetic unavailable provider' } }, false)).toThrow('Synthetic unavailable provider');
        expect(error).toHaveBeenCalledTimes(1);
    });
});
