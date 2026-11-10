/* eslint-disable playwright/no-standalone-expect, playwright/prefer-web-first-assertions -- This suite uses Jest and mocked controls. */
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

async function keyboardModule(globals = {}) {
    const context = vm.createContext({ console, CSS: { supports: () => false }, HTMLElement: Control, MutationObserver: class {}, ...globals });
    const source = fs.readFileSync(new URL('../public/scripts/keyboard.js', import.meta.url), 'utf8');
    const module = new vm.SourceTextModule(`${source}\nexport { handleGlobalKeyDown, initializeScrollResetBehaviors };`, { context });
    await module.link(() => { throw new Error('Unexpected keyboard dependency'); });
    await module.evaluate();
    return module.namespace;
}

async function keyboard() { return (await keyboardModule()).handleGlobalKeyDown; }

const enter = (target, options = {}) => ({ key: 'Enter', target, preventDefault: jest.fn(), ...options });

describe('native and custom keyboard activation ownership', () => {
    test.each(['disabled', 'aria-disabled', 'inert'])('custom %s controls cannot activate through Enter', async attribute => {
        const handle = await keyboard(); const target = new Control();
        target.hasAttribute = key => key === attribute && attribute === 'disabled';
        target.getAttribute = key => key === 'aria-disabled' && attribute === key ? 'true' : null;
        target.inert = attribute === 'inert';
        handle(enter(target));
        expect(target.click).not.toHaveBeenCalled();
    });
    test('a control focused before its parent is disabled cannot activate', async () => {
        const handle = await keyboard(); const target = new Control();
        target.parentElement = new Control({ custom: false });
        target.parentElement.hasAttribute = key => key === 'disabled';
        handle(enter(target));
        expect(target.click).not.toHaveBeenCalled();
    });
    test('repeated disabled ancestor updates preserve the original keyboard position', async () => {
        const module = await keyboardModule();
        const classes = new Set(), attributes = new Map();
        const control = new Control();
        control.classList = { contains: value => classes.has(value), add: value => classes.add(value) };
        control.hasAttribute = key => attributes.has(key);
        control.getAttribute = key => attributes.get(key) ?? null;
        control.setAttribute = (key, value) => attributes.set(key, String(value));
        control.removeAttribute = key => attributes.delete(key);
        const parentClasses = new Set();
        control.parentElement = { classList: { contains: value => parentClasses.has(value) }, parentElement: null };
        module.makeKeyboardInteractable(control);
        expect(control.getAttribute('tabindex')).toBe('0');
        parentClasses.add('disabled');
        for (let iteration = 0; iteration < 9; iteration++) module.makeKeyboardInteractable(control);
        expect(control.hasAttribute('tabindex')).toBe(false);
        parentClasses.clear(); module.makeKeyboardInteractable(control);
        expect(control.getAttribute('tabindex')).toBe('0');
    });
    test('repeated ancestor updates install one scroll reset handler per container', async () => {
        const handlers = [];
        const document = { activeElement: null };
        const setTimeout = action => action();
        const module = await keyboardModule({ document, setTimeout });
        const container = { addEventListener: (type, listener) => handlers.push({ type, listener }), contains: node => node === container, scrollTop: 40, scrollLeft: 20 };
        const ancestor = { querySelectorAll: () => [container] };
        for (let iteration = 0; iteration < 9; iteration++) module.initializeScrollResetBehaviors(ancestor);
        expect(handlers).toHaveLength(1);
        expect(handlers[0].type).toBe('focusout');
        handlers[0].listener();
        expect(container.scrollTop).toBe(0);
        expect(container.scrollLeft).toBe(0);
        container.scrollTop = 40; document.activeElement = container;
        handlers[0].listener();
        expect(container.scrollTop).toBe(40);
    });
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
