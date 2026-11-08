/* eslint-disable playwright/no-standalone-expect -- This suite uses Jest. */
import { describe, expect, jest, test } from '@jest/globals';
import fs from 'node:fs';
import vm from 'node:vm';

class Control {
    constructor({ native = false, editable = false, custom = true } = {}) {
        this.native = native;
        this.isContentEditable = editable;
        this.custom = custom;
        this.parentElement = null;
        this.classList = { contains: () => false };
        this.click = jest.fn();
    }
    closest() { return this.native ? this : null; }
    matches() { return this.custom; }
}

async function keyboard() {
    const context = vm.createContext({ console, CSS: { supports: () => false }, HTMLElement: Control, MutationObserver: class {} });
    const source = fs.readFileSync(new URL('../public/scripts/keyboard.js', import.meta.url), 'utf8');
    const module = new vm.SourceTextModule(`${source}\nexport { handleGlobalKeyDown };`, { context });
    await module.link(() => { throw new Error('Unexpected keyboard dependency'); });
    await module.evaluate();
    return module.namespace.handleGlobalKeyDown;
}

const enter = (target, options = {}) => ({ key: 'Enter', target, preventDefault: jest.fn(), ...options });

describe('native and custom keyboard activation ownership', () => {
    test('native controls keep browser activation without a second synthetic click', async () => {
        const handle = await keyboard(); const target = new Control({ native: true }); const event = enter(target);
        handle(event);
        expect(target.click).not.toHaveBeenCalled(); expect(event.preventDefault).not.toHaveBeenCalled();
    });
    test('text inside a custom interactable never activates its parent while editing', async () => {
        const handle = await keyboard(); const parent = new Control(); const target = new Control({ native: true, custom: false });
        target.parentElement = parent; handle(enter(target));
        expect(parent.click).not.toHaveBeenCalled(); expect(target.click).not.toHaveBeenCalled();
    });
    test('editable content retains its own Enter behavior', async () => {
        const handle = await keyboard(); const target = new Control({ editable: true }); handle(enter(target));
        expect(target.click).not.toHaveBeenCalled();
    });
    test('an existing key handler retains activation when it already prevented default', async () => {
        const handle = await keyboard(); const target = new Control(); handle(enter(target, { defaultPrevented: true }));
        expect(target.click).not.toHaveBeenCalled();
    });
    test('custom interactables activate once and consume their Enter default', async () => {
        const handle = await keyboard(); const target = new Control(); const event = enter(target); handle(event);
        expect(target.click).toHaveBeenCalledTimes(1); expect(event.preventDefault).toHaveBeenCalledTimes(1);
    });
    test.each([{ isComposing: true }, { metaKey: true }])('composition and command shortcuts retain ownership: %j', async options => {
        const handle = await keyboard(); const target = new Control(); handle(enter(target, options));
        expect(target.click).not.toHaveBeenCalled();
    });
});
