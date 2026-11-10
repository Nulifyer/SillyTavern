import { Popup } from '../../../../popup.js';
import { escapeHtml, getSortableDelay } from '../../../../utils.js';
import { warn } from '../../index.js';
import { QuickReply } from '../QuickReply.js';
import { QuickReplySet } from '../QuickReplySet.js';
import { QuickReplySettings } from '../QuickReplySettings.js';

export class SettingsUi {
    /** @type {QuickReplySettings} */ settings;

    /** @type {HTMLElement} */ template;
    /** @type {HTMLElement} */ dom;

    /**@type {HTMLInputElement}*/ isEnabled;
    /**@type {HTMLInputElement}*/ isCombined;
    /**@type {HTMLInputElement}*/ showPopoutButton;

    /**@type {HTMLElement}*/ globalSetList;

    /**@type {HTMLElement}*/ chatSetList;
    /**@type {HTMLElement}*/ characterSetList;

    /**@type {QuickReplySet}*/ currentQrSet;
    /**@type {HTMLInputElement}*/ disableSend;
    /**@type {HTMLInputElement}*/ placeBeforeInput;
    /**@type {HTMLInputElement}*/ injectInput;
    /**@type {HTMLInputElement}*/ color;
    /**@type {HTMLInputElement}*/ onlyBorderColor;
    /**@type {HTMLSelectElement}*/ currentSet;


    constructor(/**@type {QuickReplySettings}*/settings) {
        this.settings = settings;
        settings.onRequestEditSet = (qrs) => this.selectQrSet(qrs);
    }


    rerender() {
        if (!this.dom) return;
        const content = this.dom.querySelector('.inline-drawer-content');
        content.innerHTML = '';
        // @ts-ignore
        Array.from(this.template.querySelector('.inline-drawer-content').cloneNode(true).children).forEach(el => {
            content.append(el);
        });
        this.prepareDom();
    }
    unrender() {
        this.dom?.remove();
        this.dom = null;
    }
    async render() {
        if (!this.dom) {
            const response = await fetch('/scripts/extensions/quick-reply/html/settings.html', { cache: 'no-store' });
            if (response.ok) {
                this.template = document.createRange().createContextualFragment(await response.text()).querySelector('#qr--settings');
                // @ts-ignore
                this.dom = this.template.cloneNode(true);
                this.prepareDom();
            } else {
                warn('failed to fetch settings template');
            }
        }
        return this.dom;
    }


    prepareGeneralSettings() {
        // general settings
        this.isEnabled = this.dom.querySelector('#qr--isEnabled');
        this.isEnabled.checked = this.settings.isEnabled;
        this.isEnabled.addEventListener('click', () => this.onIsEnabled());

        this.isCombined = this.dom.querySelector('#qr--isCombined');
        this.isCombined.checked = this.settings.isCombined;
        this.isCombined.addEventListener('click', () => this.onIsCombined());

        this.showPopoutButton = this.dom.querySelector('#qr--showPopoutButton');
        this.showPopoutButton.checked = this.settings.showPopoutButton;
        this.showPopoutButton.addEventListener('click', () => this.onShowPopoutButton());
    }

    prepareGlobalSetList() {
        const dom = this.template.querySelector('#qr--global');
        const clone = dom.cloneNode(true);
        // @ts-ignore
        this.settings.config.renderSettingsInto(clone);
        this.dom.querySelector('#qr--global').replaceWith(clone);
    }
    prepareChatSetList() {
        const dom = this.template.querySelector('#qr--chat');
        const clone = dom.cloneNode(true);
        if (this.settings.chatConfig) {
            // @ts-ignore
            this.settings.chatConfig.renderSettingsInto(clone);
        } else {
            const info = document.createElement('div'); {
                info.textContent = 'No active chat.';
                // @ts-ignore
                clone.append(info);
            }
        }
        this.dom.querySelector('#qr--chat').replaceWith(clone);
    }
    prepareCharacterSetList() {
        const dom = this.template.querySelector('#qr--character');
        const clone = /** @type {HTMLElement} */ (dom.cloneNode(true));

        if (!this.settings.charConfig) {
            const setListContainer = /** @type {HTMLElement} */ (clone.querySelector('.qr--setList'));
            setListContainer.innerHTML = '';
            const info = document.createElement('div');
            info.textContent = 'No character is currently loaded.';
            setListContainer.append(info);
        } else {
            // Let the config object handle its own rendering. It will render an empty list if there are no sets,
            // but the "add" button will always be functional.
            this.settings.charConfig.renderSettingsInto(clone);
        }

        // Replace the old DOM element with our newly prepared clone.
        this.dom.querySelector('#qr--character').replaceWith(clone);
    }

    prepareQrEditor() {
        // qr editor
        this.dom.querySelector('#qr--set-rename').addEventListener('click', async () => this.renameQrSet());
        this.dom.querySelector('#qr--set-new').addEventListener('click', async () => this.addQrSet());
        /**@type {HTMLInputElement}*/
        const importFile = this.dom.querySelector('#qr--set-importFile');
        importFile.addEventListener('change', async () => {
            await this.importQrSet(importFile.files);
            importFile.value = null;
        });
        this.dom.querySelector('#qr--set-import').addEventListener('click', () => importFile.click());
        this.dom.querySelector('#qr--set-export').addEventListener('click', async () => this.exportQrSet());
        this.dom.querySelector('#qr--set-duplicate').addEventListener('click', async () => this.duplicateQrSet());
        this.dom.querySelector('#qr--set-delete').addEventListener('click', async () => this.deleteQrSet());
        this.dom.querySelector('#qr--set-add').addEventListener('click', async () => {
            this.currentQrSet.addQuickReply();
        });
        this.dom.querySelector('#qr--set-paste').addEventListener('click', () => void this.pasteQuickReply());
        this.dom.querySelector('#qr--set-importQr').addEventListener('click', async () => {
            const target = this.currentQrSet;
            const inp = document.createElement('input'); {
                inp.type = 'file';
                inp.accept = '.json';
                inp.addEventListener('change', async () => {
                    if (inp.files.length > 0 && await this.importQuickReplies(target, Array.from(inp.files))) inp.value = '';
                });
                inp.click();
            }
        });
        this.qrList = this.dom.querySelector('#qr--set-qrList');
        this.currentSet = this.dom.querySelector('#qr--set');
        this.currentSet.addEventListener('change', () => this.onQrSetChange());
        QuickReplySet.list.toSorted((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase())).forEach(qrs => {
            const opt = document.createElement('option'); {
                opt.value = qrs.name;
                opt.textContent = qrs.name;
                this.currentSet.append(opt);
            }
        });
        this.disableSend = this.dom.querySelector('#qr--disableSend');
        this.disableSend.addEventListener('click', () => {
            const qrs = this.currentQrSet;
            qrs.disableSend = this.disableSend.checked;
            qrs.save();
        });
        this.placeBeforeInput = this.dom.querySelector('#qr--placeBeforeInput');
        this.placeBeforeInput.addEventListener('click', () => {
            const qrs = this.currentQrSet;
            qrs.placeBeforeInput = this.placeBeforeInput.checked;
            qrs.save();
        });
        this.injectInput = this.dom.querySelector('#qr--injectInput');
        this.injectInput.addEventListener('click', () => {
            const qrs = this.currentQrSet;
            qrs.injectInput = this.injectInput.checked;
            qrs.save();
        });
        let initialColorChange = true;
        this.color = this.dom.querySelector('#qr--color');
        // @ts-ignore
        this.color.color = this.currentQrSet?.color ?? 'transparent';
        this.color.addEventListener('change', (evt) => {
            if (!this.dom.closest('body')) return;
            const qrs = this.currentQrSet;
            if (initialColorChange) {
                initialColorChange = false;
                // @ts-ignore
                this.color.color = qrs.color;
                return;
            }
            // @ts-ignore
            qrs.color = evt.detail.rgb;
            qrs.save();
            this.currentQrSet.updateColor();
        });
        // @ts-ignore
        this.dom.querySelector('#qr--colorClear').addEventListener('click', (evt) => {
            const qrs = this.currentQrSet;
            // @ts-ignore
            this.color.color = 'transparent';
            qrs.save();
            this.currentQrSet.updateColor();
        });
        this.onlyBorderColor = this.dom.querySelector('#qr--onlyBorderColor');
        this.onlyBorderColor.addEventListener('click', () => {
            const qrs = this.currentQrSet;
            qrs.onlyBorderColor = this.onlyBorderColor.checked;
            qrs.save();
            this.currentQrSet.updateColor();
        });
        this.onQrSetChange();
    }

    quickReplyTargetCurrent(target) {
        const current = target && !target.isDeleted && !target.isBusy && QuickReplySet.list.includes(target) && this.currentQrSet === target;
        if (!current) toastr.info('The selected Quick Reply set changed. Select the intended set and try again.');
        return current;
    }

    rollbackQuickReplies(target, replies) {
        target.qrList = target.qrList.filter(reply => !replies.includes(reply));
        for (const reply of replies) { reply.unrender?.(); reply.unrenderSettings?.(); }
        target.rerender();
    }

    async pasteQuickReply() {
        const target = this.currentQrSet;
        if (!this.quickReplyTargetCurrent(target)) return false;
        try {
            const text = await navigator.clipboard.readText();
            if (!this.quickReplyTargetCurrent(target)) return false;
            const reply = target.addQuickReplyFromText(text);
            if (!reply) return false;
            if (await target.save() === false) { this.rollbackQuickReplies(target, [reply]); return false; }
            return true;
        } catch (error) {
            warn(error);
            toastr.error('The clipboard could not be pasted. Check clipboard access and try again.');
            return false;
        }
    }

    async importQuickReplies(target, files) {
        if (!this.quickReplyTargetCurrent(target)) return false;
        const data = [];
        try {
            // Validate all selected files before changing this set. A malformed
            // later file must not leave a partially imported batch.
            for (const file of files) {
                const text = await file.text();
                if (!this.quickReplyTargetCurrent(target)) return false;
                const reply = JSON.parse(text);
                if (!reply || typeof reply !== 'object' || Array.isArray(reply) || typeof reply.label !== 'string' || typeof reply.message !== 'string') throw new Error(`"${file.name}" is not a Quick Reply.`);
                QuickReply.from({ ...reply });
                data.push(reply);
            }
            if (!this.quickReplyTargetCurrent(target)) return false;
            const replies = data.map(reply => target.addQuickReply(reply));
            if (await target.save() === false) { this.rollbackQuickReplies(target, replies); return false; }
            return true;
        } catch (error) {
            warn(error);
            toastr.error(`Quick Replies could not be imported. ${error.message || 'Check the file and try again.'}`);
            return false;
        }
    }
    onQrSetChange() {
        this.currentQrSet = QuickReplySet.get(this.currentSet.value) ?? new QuickReplySet();
        this.disableSend.checked = this.currentQrSet.disableSend;
        this.placeBeforeInput.checked = this.currentQrSet.placeBeforeInput;
        this.injectInput.checked = this.currentQrSet.injectInput;
        // @ts-ignore
        this.color.color = this.currentQrSet.color ?? 'transparent';
        this.onlyBorderColor.checked = this.currentQrSet.onlyBorderColor;
        this.qrList.innerHTML = '';
        const qrsDom = this.currentQrSet.renderSettings();
        this.qrList.append(qrsDom);
        // @ts-ignore
        this.updateSetBusy();
        $(qrsDom).sortable({
            delay: getSortableDelay(),
            handle: '.drag-handle',
            stop: () => this.onQrListSort(),
        });
    }


    prepareDom() {
        this.prepareGeneralSettings();
        this.prepareGlobalSetList();
        this.prepareChatSetList();
        this.prepareCharacterSetList();
        this.prepareQrEditor();
    }


    async onIsEnabled() {
        this.settings.isEnabled = this.isEnabled.checked;
        this.settings.save();
    }

    async onIsCombined() {
        this.settings.isCombined = this.isCombined.checked;
        this.settings.save();
    }

    async onShowPopoutButton() {
        this.settings.showPopoutButton = this.showPopoutButton.checked;
        this.settings.save();
    }

    async onGlobalSetListSort() {
        this.settings.config.setList = Array.from(this.globalSetList.children).map((it, idx) => {
            const set = this.settings.config.setList[Number(it.getAttribute('data-order'))];
            it.setAttribute('data-order', String(idx));
            return set;
        });
        this.settings.save();
    }

    async onChatSetListSort() {
        this.settings.chatConfig.setList = Array.from(this.chatSetList.children).map((it, idx) => {
            const set = this.settings.chatConfig.setList[Number(it.getAttribute('data-order'))];
            it.setAttribute('data-order', String(idx));
            return set;
        });
        this.settings.save();
    }

    updateOrder(list) {
        Array.from(list.children).forEach((it, idx) => {
            it.setAttribute('data-order', idx);
        });
    }

    async onQrListSort() {
        this.currentQrSet.qrList = Array.from(this.qrList.querySelectorAll('.qr--set-item')).map((it, idx) => {
            const qr = this.currentQrSet.qrList.find(qr => qr.id == Number(it.getAttribute('data-id')));
            it.setAttribute('data-order', String(idx));
            return qr;
        });
        this.currentQrSet.save();
    }

    async deleteQrSet() {
        const target = this.currentQrSet;
        if (!target) return;
        const confirmed = await Popup.show.confirm('Delete Quick Reply Set', `Are you sure you want to delete the Quick Reply Set "${escapeHtml(target.name)}"?<br>This cannot be undone.`);
        if (confirmed) {
            if (!await this.doDeleteQrSet(target)) return;
            if (this.currentQrSet === target) this.rerender();
            else for (const option of [...this.currentSet.options]) if (option.value === target.name) option.remove();
        }
    }
    async doDeleteQrSet(qrs) {
        if (!await qrs.delete()) return false;
        //TODO (HACK) should just bubble up from QuickReplySet.delete() but that would require proper or at least more comples onDelete listeners
        for (let i = this.settings.config.setList.length - 1; i >= 0; i--) {
            if (this.settings.config.setList[i].set == qrs) {
                this.settings.config.setList.splice(i, 1);
            }
        }
        if (this.settings.chatConfig) {
            for (let i = this.settings.chatConfig.setList.length - 1; i >= 0; i--) {
                if (this.settings.chatConfig.setList[i].set == qrs) {
                    this.settings.chatConfig.setList.splice(i, 1);
                }
            }
        }
        if (this.settings.charConfig) {
            for (let i = this.settings.charConfig.setList.length - 1; i >= 0; i--) {
                if (this.settings.charConfig.setList[i].set == qrs) {
                    this.settings.charConfig.setList.splice(i, 1);
                }
            }
        }
        this.settings.save();
        return true;
    }

    updateSetBusy() {
        const busy = Boolean(this.currentQrSet?.isBusy);
        for (const node of this.dom?.querySelectorAll('#qr--set-settings, #qr--set-qrList, .qr--set-qrListActions, #qr--set-rename, #qr--set-delete, #qr--set-duplicate') || []) node.inert = busy;
    }

    refreshSetOptions() {
        const selected = this.currentSet.value;
        this.currentSet.replaceChildren(...QuickReplySet.list.toSorted((a, b) => a.name.localeCompare(b.name)).map(set => new Option(set.name, set.name)));
        this.currentSet.value = selected;
    }

    async publishCandidate(candidate, replacing, owner) {
        if (QuickReplySet.get(candidate.name) !== replacing) {
            toastr.warning('The destination set changed. Import or create it again.');
            return false;
        }
        const saving = replacing ? replacing.replaceWith(candidate) : candidate.create();
        this.updateSetBusy();
        try {
            if (!await saving) return false;
            this.settings.save();
            if (!this.dom?.isConnected) return true;
            this.refreshSetOptions();
            if (this.currentQrSet === owner) {
                this.currentSet.value = candidate.name;
                this.onQrSetChange();
            }
            this.prepareGlobalSetList();
            this.prepareChatSetList();
            this.prepareCharacterSetList();
            return true;
        } finally { this.updateSetBusy(); }
    }

    makeCandidate(props) {
        if (!props || !Number.isInteger(props.version) || typeof props.name !== 'string' || !props.name.trim() || !Array.isArray(props.qrList)
            || props.qrList.some(reply => !reply || typeof reply.label !== 'string' || typeof reply.message !== 'string')) throw new Error('The file does not contain a valid Quick Reply set.');
        const data = JSON.parse(JSON.stringify(props));
        const ids = new Set();
        let nextId = Math.max(0, ...data.qrList.map(reply => Number.isInteger(reply.id) ? reply.id : 0));
        for (const reply of data.qrList) {
            if (reply.icon && (typeof reply.icon !== 'string' || !/^[\w-]+$/.test(reply.icon))) throw new Error('A Quick Reply icon is not a valid icon class.');
            if (reply.contextList !== undefined && !Array.isArray(reply.contextList)) throw new Error('Quick Reply context links must be a list.');
            if (!Number.isInteger(reply.id) || reply.id < 0 || ids.has(reply.id)) reply.id = ++nextId;
            ids.add(reply.id);
            for (const link of reply.contextList || []) {
                if (link.set && link.set !== data.name && !QuickReplySet.get(link.set)) throw new Error('A referenced Quick Reply set is unavailable. Import that set first, then retry.');
            }
        }
        const contextNames = data.qrList.map(reply => (reply.contextList || []).map(link => link.set));
        const candidate = QuickReplySet.from({ ...data });
        candidate.qrList = data.qrList.map(reply => QuickReply.from(reply));
        candidate.idIndex = Math.max(Number.isInteger(data.idIndex) ? data.idIndex : 0, ...ids);
        candidate.qrList.forEach((reply, index) => reply.contextList.forEach((link, linkIndex) => { if (contextNames[index][linkIndex] === candidate.name) link.set = candidate; }));
        candidate.init();
        return candidate;
    }

    async renameQrSet() {
        const target = this.currentQrSet;
        if (!target || target.isBusy) return false;
        const newName = await Popup.show.input('Rename Quick Reply Set', 'Enter a new name:', target.name);
        if (!newName?.trim() || newName === target.name) return false;
        if (!QuickReplySet.list.includes(target)) { toastr.warning('The Quick Reply set changed. Select it again.'); return false; }
        const oldName = target.name;
        const saving = target.rename(newName);
        this.updateSetBusy();
        try {
            if (!await saving) return false;
            this.settings.save();
            if (!this.dom?.isConnected) return true;
            const selected = this.currentSet.value;
            this.refreshSetOptions();
            this.currentSet.value = selected === oldName ? newName : selected;
            if (this.currentQrSet === target) this.onQrSetChange();
            this.prepareGlobalSetList();
            this.prepareChatSetList();
            this.prepareCharacterSetList();
            return true;
        } finally { this.updateSetBusy(); }
    }

    async addQrSet() {
        const owner = this.currentQrSet;
        const name = await Popup.show.input('Create a new Quick Reply Set', 'Enter a name for the new Quick Reply Set:');
        if (!name?.trim()) return false;
        const existing = QuickReplySet.get(name);
        if (existing && !await Popup.show.confirm('Replace existing Quick Reply set', 'Replace the existing Quick Reply set? Its current replies will be replaced only after the new set is saved.')) return false;
        const candidate = this.makeCandidate({ version: 2, name, idIndex: 2, qrList: [{ id: 2, label: '', message: '' }] });
        return this.publishCandidate(candidate, existing, owner);
    }

    async importQrSet(/**@type {FileList}*/files) {
        for (const file of Array.from(files)) await this.importSingleQrSet(file);
    }

    async importSingleQrSet(/**@type {File}*/file) {
        const owner = this.currentQrSet;
        try {
            const candidate = this.makeCandidate(JSON.parse(await file.text()));
            const existing = QuickReplySet.get(candidate.name);
            if (existing && !await Popup.show.confirm('Replace existing Quick Reply set', 'Replace the existing Quick Reply set? Its current replies will be replaced only after the imported set is saved.')) return false;
            return await this.publishCandidate(candidate, existing, owner);
        } catch (error) {
            warn(error);
            toastr.error(`Quick Reply import failed. ${error.message}`);
            return false;
        }
    }

    exportQrSet() {
        const blob = new Blob([JSON.stringify(this.currentQrSet)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); {
            a.href = url;
            a.download = `${this.currentQrSet.name}.json`;
            a.click();
        }
        URL.revokeObjectURL(url);
    }

    async duplicateQrSet() {
        const owner = this.currentQrSet;
        if (!owner || owner.isBusy) return false;
        const snapshot = JSON.parse(JSON.stringify(owner));
        const newName = await Popup.show.input('Duplicate Quick Reply Set', 'Enter a name for the new Quick Reply Set:', `${owner.name} (Copy)`);
        if (!newName?.trim()) return false;
        if (QuickReplySet.get(newName)) { toastr.error('A Quick Reply set with that name already exists.'); return false; }
        snapshot.name = newName;
        return this.publishCandidate(this.makeCandidate(snapshot), undefined, owner);
    }

    selectQrSet(qrs) {
        this.currentSet.value = qrs.name;
        this.onQrSetChange();
    }
}
