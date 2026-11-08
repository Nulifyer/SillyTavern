import { jest, test, expect } from '@jest/globals';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/scripts/bookmarks.js', import.meta.url), 'utf8');
function nativeFunction(name, context) {
    const start = source.indexOf(`export async function ${name}(`);
    const end = source.indexOf('\n}\n', start) + 2;
    return vm.runInNewContext(`(${source.slice(start, end).replace('export ', '')})`, context);
}
for (const operation of ['branchChat', 'createNewBookmark']) test(`${operation} rejects a changed story after the legacy prompt cache await`, async () => {
    let owner = 'original'; let release, reached;
    const held = new Promise(resolve => release = resolve);
    const ready = new Promise(resolve => reached = resolve);
    const open = jest.fn(); const save = jest.fn();
    const context = {
        getCurrentChatIdentity: () => owner, getCurrentChatId: () => 'parent', isGenerating: () => false,
        this_chid: 0, selected_group: null, characters: [{ chat: 'parent' }], chat: [{ mes: 'Neutral reply', extra: {} }], chat_metadata: { integrity: 'parent-integrity' },
        createBranch: async () => 'child', getBookmarkName: async () => 'checkpoint', uuidv4: () => 'fresh-child-integrity',
        saveItemizedPrompts: async () => { reached(); await held; },
        openCharacterChat: open, openGroupChat: open, saveChat: save, saveGroupBookmarkChat: save,
    };
    const pending = nativeFunction(operation, context)(0);
    await ready; owner = 'different-story'; release(); await pending;
    expect(open).not.toHaveBeenCalled(); expect(save).not.toHaveBeenCalled();
});
