import {
    characters, closeCurrentChat, deleteCharacterChatByName, getCurrentChatId,
    getRequestHeaders, isGenerating, openCharacterChat, renameGroupOrCharacterChat,
    saveSettingsDebounced, selectCharacterById, setActiveCharacter, setActiveGroup, this_chid,
} from '../script.js';
import { deleteGroupChatByName, groups, openGroupById, openGroupChat, selected_group } from './group-chats.js';
import { accountStorage } from './util/AccountStorage.js';
import { equalsIgnoreCaseAndAccents, timestampToMoment } from './utils.js';

const archiveKey = 'workspaceArchivedChats';

function identity(record) {
    return JSON.stringify([record.group ? 'group' : 'character', String(record.group || record.avatar), record.file_name]);
}

function archivedIds() {
    try {
        const value = JSON.parse(accountStorage.getItem(archiveKey) || '[]');
        return new Set(Array.isArray(value) ? value.filter(item => typeof item === 'string') : []);
    } catch {
        return new Set();
    }
}

function requireIdle() {
    if (isGenerating()) throw new Error('Stop the current reply before changing stories.');
}

function characterId(avatar) {
    const id = characters.findIndex(character => character.avatar === avatar);
    if (id === -1) throw new Error('This character is no longer in your library.');
    return id;
}

/** Transcript actions stay in their native owners; only archive identifiers live here. */
export class WorkspaceChats {
    async list(signal) {
        const response = await fetch('/api/chats/recent', {
            method: 'POST', headers: getRequestHeaders(), body: JSON.stringify({}), cache: 'no-cache', signal,
        });
        if (!response.ok) throw new Error('Could not load your stories. Check the server connection and try again.');
        const data = await response.json();
        if (!Array.isArray(data)) throw new Error('The server returned an invalid story list.');
        const archived = archivedIds();
        return data.flatMap(record => {
            const group = record.group && groups.find(item => String(item.id) === String(record.group));
            const character = !group && characters.find(item => item.avatar === record.avatar);
            if (!group && !character) return [];
            const normalized = { ...record, group: group ? String(group.id) : '', avatar: character?.avatar || '', file_name: record.file_name.replace(/\.jsonl$/, '') };
            return [{
                ...normalized, key: identity(normalized), entity: group || character,
                entityKey: group ? `group:${group.id}` : `character:${character.avatar}`,
                title: normalized.file_name, archived: archived.has(identity(normalized)),
                updated: timestampToMoment(record.last_mes).valueOf() || 0,
            }];
        }).sort((a, b) => b.updated - a.updated);
    }

    current() {
        const file_name = getCurrentChatId();
        if (file_name === undefined) return null;
        const group = selected_group ? String(selected_group) : '';
        const avatar = group ? '' : characters[this_chid]?.avatar;
        if (!group && !avatar) return null;
        const key = identity({ group, avatar, file_name });
        return { group, avatar, file_name, key, archived: archivedIds().has(key) };
    }

    async select(entity, { newChat = false } = {}) {
        requireIdle();
        if (entity.kind === 'group') {
            await openGroupById(entity.id, { newChat });
            if (String(selected_group) !== String(entity.id)) throw new Error('The current story is still saving. Try again shortly.');
            setActiveGroup(entity.id);
        } else {
            await selectCharacterById(characterId(entity.id), { switchMenu: false, newChat });
            if (selected_group || characters[this_chid]?.avatar !== entity.id) throw new Error('The current story is still saving. Try again shortly.');
            setActiveCharacter(entity.id);
        }
        saveSettingsDebounced();
    }

    async open(record) {
        // Returning to the mounted transcript is navigation, even during a reply.
        if (this.current()?.key === record.key) return;
        await this.select({ kind: record.group ? 'group' : 'character', id: record.group || record.avatar });
        if (getCurrentChatId() !== record.file_name) {
            if (record.group) await openGroupChat(record.group, record.file_name);
            else await openCharacterChat(record.file_name);
        }
    }

    async start(entity, title = '') {
        requireIdle();
        if (title.trim() && (await this.list()).some(record => record.entityKey === entity.key && equalsIgnoreCaseAndAccents(record.title, title.trim()))) {
            throw new Error('A story with that title already exists. Choose another title or continue it from the character profile.');
        }
        await this.select(entity, { newChat: true });
        if (title.trim()) await this.rename(this.current(), title.trim());
    }

    async archive(record, archived = true) {
        requireIdle();
        if (archived && this.current()?.key === record.key && !await closeCurrentChat()) return false;
        const ids = archivedIds();
        if (archived) ids.add(record.key);
        else ids.delete(record.key);
        accountStorage.setItem(archiveKey, JSON.stringify([...ids]));
        return true;
    }

    renamed({ avatarId, groupId, oldFileName, newFileName }) {
        const oldKey = identity({ avatar: avatarId, group: groupId, file_name: oldFileName.replace(/\.jsonl$/, '') });
        const ids = archivedIds();
        if (!ids.delete(oldKey)) return;
        ids.add(identity({ avatar: avatarId, group: groupId, file_name: newFileName.replace(/\.jsonl$/, '') }));
        accountStorage.setItem(archiveKey, JSON.stringify([...ids]));
    }

    async rename(record, title) {
        requireIdle();
        const renamed = await renameGroupOrCharacterChat({
            characterId: record.group ? undefined : String(characterId(record.avatar)),
            groupId: record.group || undefined, oldFileName: record.file_name, newFileName: title,
        });
        if (!renamed) throw new Error('The story could not be renamed. Its previous title is unchanged.');
    }

    async remove(record) {
        requireIdle();
        if (this.current()?.key === record.key && !await closeCurrentChat()) return false;
        const deleted = record.group
            ? await deleteGroupChatByName(record.group, record.file_name)
            : await deleteCharacterChatByName(String(characterId(record.avatar)), record.file_name);
        if (!deleted) throw new Error('The story could not be deleted. Check the server connection and try again.');
        const ids = archivedIds();
        ids.delete(record.key);
        accountStorage.setItem(archiveKey, JSON.stringify([...ids]));
        return true;
    }
}
