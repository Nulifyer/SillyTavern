import { getRequestHeaders, substituteParams } from '../../../../script.js';
import { Popup, POPUP_RESULT, POPUP_TYPE } from '../../../popup.js';
import { executeSlashCommandsOnChatInput, executeSlashCommandsWithOptions } from '../../../slash-commands.js';
import { SlashCommandScope } from '../../../slash-commands/SlashCommandScope.js';
import { SlashCommandParser } from '../../../slash-commands/SlashCommandParser.js';
import { debounceAsync, warn } from '../index.js';
import { QuickReply } from './QuickReply.js';
import { getSanitizedFilename } from '../../../utils.js';

export class QuickReplySet {
    #saveQueue = Promise.resolve();
    static #busyNames = new Set();
    /**@type {QuickReplySet[]}*/ static list = [];

    /**
     * @param {Partial<QuickReplySet>} props
     * @returns {QuickReplySet}
     */
    static from(props) {
        const instance = new this();
        const keys = Object.keys(instance.toJSON());
        return Object.assign(instance, Object.fromEntries(Object.entries(props).filter(([key]) => keys.includes(key))), { qrList: [] });
    }

    /**
     * @param {string} name - name of the QuickReplySet
     */
    static get(name) {
        return this.list.find(it => it.name == name);
    }

    /**@type {string}*/ name;
    /**@type {'global'|'chat'|'character'}*/ scope = 'global';
    /**@type {boolean}*/ disableSend = false;
    /**@type {boolean}*/ placeBeforeInput = false;
    /**@type {boolean}*/ injectInput = false;
    /**@type {string}*/ color = 'transparent';
    /**@type {boolean}*/ onlyBorderColor = false;
    /**@type {QuickReply[]}*/ qrList = [];
    /**@type {number}*/ idIndex = 0;
    /**@type {boolean}*/ isDeleted = false;
    /**@type {function}*/ save;
    /**@type {HTMLElement}*/ dom;
    /**@type {HTMLElement}*/ settingsDom;

    constructor() {
        this.save = debounceAsync(() => this.performSave(), 200);
    }

    static #beginOperation(sets, names) {
        const targets = [...new Set(sets)];
        const keys = [...new Set(names)];
        if (targets.some(set => set.isBusy || set.deleting || set.isDeleted) || keys.some(name => this.#busyNames.has(name))) {
            toastr.warning('This Quick Reply set is busy. Try again when its current operation finishes.');
            return null;
        }
        for (const key of keys) this.#busyNames.add(key);
        const controls = [];
        for (const set of targets) {
            set.isBusy = true;
            for (const node of [set.dom, set.settingsDom, ...set.qrList.map(qr => qr.editorDom)].filter(Boolean)) {
                controls.push([node, node.inert]);
                node.inert = true;
            }
        }
        return {
            ready: Promise.all(targets.map(set => set.#saveQueue)),
            release: () => {
                for (const key of keys) this.#busyNames.delete(key);
                for (const set of targets) set.isBusy = false;
                for (const [node, inert] of controls) node.inert = inert;
            },
        };
    }

    /** Persist a complete replacement before changing the instance used by links. */
    async replaceWith(candidate) {
        if (candidate.name !== this.name) throw new Error('Replacement set names must match.');
        const operation = QuickReplySet.#beginOperation([this], [this.name]);
        if (!operation) return false;
        try {
            await operation.ready;
            if (!await this.#write(JSON.stringify(candidate))) return false;
            for (const qr of this.qrList) { qr.unrender(); qr.unrenderSettings(); }
            const { qrList, ...properties } = candidate.toJSON();
            Object.assign(this, properties);
            this.qrList = qrList;
            for (const qr of this.qrList) for (const link of qr.contextList || []) if (link.set === candidate) link.set = this;
            this.init();
            if (this.settingsDom) {
                this.settingsDom.replaceChildren();
                this.qrList.forEach((qr, index) => this.renderSettingsItem(qr, index));
            }
            this.rerender();
            this.updateColor();
            return true;
        } finally { operation.release(); }
    }

    /** New sets enter the shared list only after their first file write succeeds. */
    async create() {
        if (!await QuickReplySet.#validName(this.name)) return false;
        if (QuickReplySet.get(this.name)) { toastr.error('A Quick Reply set with that name already exists.'); return false; }
        const operation = QuickReplySet.#beginOperation([this], [this.name]);
        if (!operation) return false;
        try {
            await operation.ready;
            if (!await this.#write(JSON.stringify(this))) return false;
            const index = QuickReplySet.list.findIndex(set => set.name.toLowerCase().localeCompare(this.name.toLowerCase()) > 0);
            if (index < 0) QuickReplySet.list.push(this);
            else QuickReplySet.list.splice(index, 0, this);
            return true;
        } finally { operation.release(); }
    }

    /** Rename only after the new file and all referring sets have been saved. */
    async rename(newName) {
        const oldName = this.name;
        if (!newName || newName === oldName) return true;
        if (!await QuickReplySet.#validName(newName) || this.name !== oldName) return false;
        if (QuickReplySet.get(newName)) { toastr.error('A Quick Reply set with that name already exists.'); return false; }
        const referring = QuickReplySet.list.filter(set => set !== this && set.qrList.some(qr => qr.contextList?.some(link => link.set === this)));
        const operation = QuickReplySet.#beginOperation([this, ...referring], [oldName, newName, ...referring.map(set => set.name)]);
        if (!operation) return false;
        const renamedSnapshot = set => {
            const data = JSON.parse(JSON.stringify(set));
            if (set === this) data.name = newName;
            for (const qr of data.qrList) for (const link of qr.contextList || []) if (link.set === oldName) link.set = newName;
            return JSON.stringify(data);
        };
        let copied = false;
        try {
            await operation.ready;
            if (!await this.#write(renamedSnapshot(this))) return false;
            copied = true;
            for (const set of referring) if (!await set.#write(renamedSnapshot(set))) throw new Error('A referring set could not be saved.');
            const response = await fetch('/api/quick-replies/delete', { method: 'POST', headers: getRequestHeaders(), body: JSON.stringify({ name: oldName }) });
            if (!response.ok) throw new Error('The original set could not be removed.');
            this.name = newName;
            return true;
        } catch (error) {
            console.error('Quick Reply rename could not finish', error);
            toastr.error(copied ? 'The copy was saved, but the rename could not finish. Both files were retained. Reload to access the copy.' : 'The Quick Reply set could not be renamed. The original was kept.');
            return false;
        } finally { operation.release(); }
    }

    static async #validName(name) {
        try {
            if (typeof name !== 'string' || !name.trim() || await getSanitizedFilename(`${name}.json`) !== `${name}.json`) {
                toastr.error('Use a Quick Reply set name without filesystem path characters. The existing sets were kept.');
                return false;
            }
            return true;
        } catch { return false; }
    }

    init() {
        this.qrList.forEach(qr => this.hookQuickReply(qr));
    }

    unrender() {
        this.dom?.remove();
        this.dom = null;
    }
    render() {
        this.unrender();
        if (!this.dom) {
            const root = document.createElement('div'); {
                this.dom = root;
                root.classList.add('qr--buttons');
                this.updateColor();
                this.qrList.filter(qr => !qr.isHidden).forEach(qr => {
                    root.append(qr.render());
                });
            }
        }
        return this.dom;
    }
    rerender() {
        if (!this.dom) return;
        this.dom.innerHTML = '';
        this.qrList.filter(qr => !qr.isHidden).forEach(qr => {
            this.dom.append(qr.render());
        });
    }
    updateColor() {
        if (!this.dom) return;
        if (this.color && this.color != 'transparent') {
            this.dom.style.setProperty('--qr--color', this.color);
            this.dom.classList.add('qr--color');
            if (this.onlyBorderColor) {
                this.dom.classList.add('qr--borderColor');
            } else {
                this.dom.classList.remove('qr--borderColor');
            }
        } else {
            this.dom.style.setProperty('--qr--color', 'transparent');
            this.dom.classList.remove('qr--color');
            this.dom.classList.remove('qr--borderColor');
        }
    }

    renderSettings() {
        if (!this.settingsDom) {
            this.settingsDom = document.createElement('div'); {
                this.settingsDom.classList.add('qr--set-qrListContents');
                this.qrList.forEach((qr, idx) => {
                    this.renderSettingsItem(qr, idx);
                });
            }
        }
        return this.settingsDom;
    }
    /**
     *
     * @param {QuickReply} qr
     * @param {number} idx
     */
    renderSettingsItem(qr, idx) {
        this.settingsDom.append(qr.renderSettings(idx));
    }

    /**
     *
     * @param {QuickReply} qr
     */
    async debug(qr) {
        const parser = new SlashCommandParser();
        const closure = parser.parse(qr.message, true, [], qr.abortController, qr.debugController);
        closure.source = `${this.name}.${qr.label}`;
        closure.onProgress = (done, total) => qr.updateEditorProgress(done, total);
        closure.scope.setMacro('arg::*', '');
        return (await closure.execute())?.pipe;
    }

    /**
     *
     * @param {QuickReply} qr The QR to execute.
     * @param {object} options
     * @param {string} [options.message] (null) altered message to be used
     * @param {boolean} [options.isAutoExecute] (false) whether the execution is triggered by auto execute
     * @param {boolean} [options.isEditor] (false) whether the execution is triggered by the QR editor
     * @param {boolean} [options.isRun] (false) whether the execution is triggered by /run or /: (window.executeQuickReplyByName)
     * @param {SlashCommandScope} [options.scope] (null) scope to be used when running the command
     * @param {import('../../../slash-commands.js').ExecuteSlashCommandsOptions} [options.executionOptions] ({}) further execution options
     * @returns
     */
    async executeWithOptions(qr, options = {}) {
        options = Object.assign({
            message: null,
            isAutoExecute: false,
            isEditor: false,
            isRun: false,
            scope: null,
            executionOptions: {},
        }, options);
        const execOptions = options.executionOptions;
        /**@type {HTMLTextAreaElement}*/
        const ta = document.querySelector('#send_textarea');
        const finalMessage = options.message ?? qr.message;
        let input = ta.value;
        if (!options.isAutoExecute && !options.isEditor && !options.isRun && this.injectInput && input.length > 0) {
            if (this.placeBeforeInput) {
                input = `${finalMessage} ${input}`;
            } else {
                input = `${input} ${finalMessage}`;
            }
        } else {
            input = `${finalMessage} `;
        }

        if (input[0] == '/' && !this.disableSend) {
            let result;
            if (options.isAutoExecute || options.isRun) {
                result = await executeSlashCommandsWithOptions(input, Object.assign(execOptions, {
                    handleParserErrors: true,
                    scope: options.scope,
                    source: `${this.name}.${qr.label}`,
                }));
            } else if (options.isEditor) {
                result = await executeSlashCommandsWithOptions(input, Object.assign(execOptions, {
                    handleParserErrors: false,
                    scope: options.scope,
                    abortController: qr.abortController,
                    source: `${this.name}.${qr.label}`,
                    onProgress: (done, total) => qr.updateEditorProgress(done, total),
                }));
            } else {
                result = await executeSlashCommandsOnChatInput(input, Object.assign(execOptions, {
                    scope: options.scope,
                    source: `${this.name}.${qr.label}`,
                }));
            }
            return typeof result === 'object' ? result?.pipe : '';
        }

        ta.value = substituteParams(input);
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        ta.focus();

        if (!this.disableSend) {
            // @ts-ignore
            document.querySelector('#send_but').click();
        }
    }

    /**
     * @param {QuickReply} qr
     * @param {string} [message] - optional altered message to be used
     * @param {SlashCommandScope} [scope] - optional scope to be used when running the command
     */
    async execute(qr, message = null, isAutoExecute = false, scope = null) {
        return this.executeWithOptions(qr, {
            message,
            isAutoExecute,
            scope,
        });
    }

    addQuickReply(data = {}) {
        const id = Math.max(this.idIndex, this.qrList.reduce((max, qr) => Math.max(max, qr.id), 0)) + 1;
        data.id = this.idIndex = id + 1;
        const qr = QuickReply.from(data);
        this.qrList.push(qr);
        this.hookQuickReply(qr);
        if (this.settingsDom) {
            this.renderSettingsItem(qr, this.qrList.length - 1);
        }
        if (this.dom) {
            this.dom.append(qr.render());
        }
        this.save();
        return qr;
    }

    parseQuickReplyText(qrJson, requireJson = false) {
        let data;
        if (qrJson) {
            try {
                data = JSON.parse(qrJson ?? '{}');
                delete data.id;
            } catch {
                if (requireJson) { toastr.error('Not a QR. Choose a valid Quick Reply JSON file.'); return; }
            }
            if (requireJson && (!data || typeof data !== 'object' || Array.isArray(data))) { toastr.error('Not a QR. Choose a valid Quick Reply JSON file.'); return; }
            if (data) {
                // JSON data
                if (typeof data.label !== 'string' || typeof data.message !== 'string'
                    || (data.icon && (typeof data.icon !== 'string' || !/^[\w-]+$/.test(data.icon)))
                    || (data.contextList !== undefined && (!Array.isArray(data.contextList) || data.contextList.some(link => !link || typeof link !== 'object' || (link.set !== undefined && typeof link.set !== 'string'))))) {
                    // not a QR
                    toastr.error('Not a QR.');
                    return;
                }
            } else {
                // no JSON, use plaintext as QR message
                data = { message: qrJson };
            }
        } else {
            data = {};
        }
        return data;
    }

    addQuickReplyFromText(qrJson) {
        const data = this.parseQuickReplyText(qrJson);
        return data ? this.addQuickReply(data) : undefined;
    }

    /**
     *
     * @param {QuickReply} qr
     */
    hookQuickReply(qr) {
        // @ts-ignore
        qr.onDebug = () => this.debug(qr);
        qr.onExecute = (_, options) => this.executeWithOptions(qr, options);
        qr.onDelete = () => this.removeQuickReply(qr);
        qr.onUpdate = () => this.save();
        qr.onInsertBefore = async (text, requireJson = false) => {
            if (this.isDeleted || this.isBusy || !this.qrList.includes(qr)) return false;
            const data = (Array.isArray(text) ? text : [text]).map(value => this.parseQuickReplyText(value, requireJson));
            if (data.some(value => !value)) return false;
            const inserted = [];
            for (const value of data) {
                const newQr = this.addQuickReply(value);
                this.qrList.pop();
                this.qrList.splice(this.qrList.indexOf(qr), 0, newQr);
                if (qr.settingsDom) qr.settingsDom.insertAdjacentElement('beforebegin', newQr.settingsDom);
                inserted.push(newQr);
            }
            if (await this.save() === false) {
                this.qrList = this.qrList.filter(reply => !inserted.includes(reply));
                for (const reply of inserted) { reply.unrender(); reply.unrenderSettings(); }
                this.rerender();
                return false;
            }
            return true;
        };
        qr.onTransfer = async () => {
            /**@type {HTMLSelectElement} */
            let sel;
            let isCopy = false;
            const dom = document.createElement('div'); {
                dom.classList.add('qr--transferModal');
                const title = document.createElement('h3'); {
                    title.textContent = 'Transfer Quick Reply';
                    dom.append(title);
                }
                const subTitle = document.createElement('h4'); {
                    const entryName = qr.label;
                    const bookName = this.name;
                    subTitle.textContent = `${bookName}: ${entryName}`;
                    dom.append(subTitle);
                }
                sel = document.createElement('select'); {
                    sel.classList.add('qr--transferSelect');
                    sel.setAttribute('autofocus', '1');
                    const noOpt = document.createElement('option'); {
                        noOpt.value = '';
                        noOpt.textContent = '-- Select QR Set --';
                        sel.append(noOpt);
                    }
                    for (const qrs of QuickReplySet.list) {
                        const opt = document.createElement('option'); {
                            opt.value = qrs.name;
                            opt.textContent = qrs.name;
                            sel.append(opt);
                        }
                    }
                    sel.addEventListener('keyup', (evt) => {
                        if (evt.key == 'Shift') {
                            // @ts-ignore
                            (dlg.dom ?? dlg.dlg).classList.remove('qr--isCopy');
                            return;
                        }
                    });
                    sel.addEventListener('keydown', (evt) => {
                        if (evt.key == 'Shift') {
                            // @ts-ignore
                            (dlg.dom ?? dlg.dlg).classList.add('qr--isCopy');
                            return;
                        }
                        if (!evt.ctrlKey && !evt.altKey && evt.key == 'Enter') {
                            evt.preventDefault();
                            if (evt.shiftKey) isCopy = true;
                            dlg.completeAffirmative();
                        }
                    });
                    dom.append(sel);
                }
                const hintP = document.createElement('p'); {
                    const hint = document.createElement('small'); {
                        hint.textContent = 'Type or arrows to select QR Set. Enter to transfer. Shift+Enter to copy.';
                        hintP.append(hint);
                    }
                    dom.append(hintP);
                }
            }
            const dlg = new Popup(dom, POPUP_TYPE.CONFIRM, null, { okButton: 'Transfer', cancelButton: 'Cancel' });
            const copyBtn = document.createElement('div'); {
                copyBtn.classList.add('qr--copy');
                copyBtn.classList.add('menu_button');
                copyBtn.textContent = 'Copy';
                copyBtn.addEventListener('click', () => {
                    isCopy = true;
                    dlg.completeAffirmative();
                });
                // @ts-ignore
                (dlg.ok ?? dlg.okButton).insertAdjacentElement('afterend', copyBtn);
            }
            const prom = dlg.show();
            sel.focus();
            await prom;
            if (dlg.result == POPUP_RESULT.AFFIRMATIVE) {
                const qrs = QuickReplySet.list.find(it => it.name == sel.value);
                if (!qrs || qrs.isDeleted || qrs.isBusy || qrs.deleting || this.isBusy || this.deleting || !QuickReplySet.list.includes(this) || !this.qrList.includes(qr)) {
                    toastr.warning('Choose an available Quick Reply set. The original reply was kept.');
                    return;
                }
                const original = JSON.stringify(qr.toJSON());
                const added = qrs.addQuickReply(qr.toJSON());
                if (!await qrs.save()) {
                    const index = qrs.qrList.indexOf(added);
                    if (index >= 0) qrs.qrList.splice(index, 1);
                    added.unrender();
                    added.unrenderSettings();
                    toastr.error('The destination could not be saved. The original reply was kept.');
                    return;
                }
                if (!isCopy) {
                    if (qrs.isDeleted || !QuickReplySet.list.includes(this) || !this.qrList.includes(qr) || JSON.stringify(qr.toJSON()) !== original) {
                        toastr.warning('The source changed during transfer. The saved copy and original were kept.');
                        return;
                    }
                    await qr.delete();
                }
            }
        };
    }

    async removeQuickReply(qr) {
        const index = this.qrList.indexOf(qr);
        if (index < 0 || this.isDeleted || this.deleting || this.isBusy) return false;
        this.qrList.splice(index, 1);
        qr.dom?.setAttribute('inert', '');
        qr.settingsDom?.setAttribute('inert', '');
        try {
            if (!await this.save()) {
                if (!this.isDeleted && !this.qrList.includes(qr)) this.qrList.splice(Math.min(index, this.qrList.length), 0, qr);
                this.rerender();
                return false;
            }
            qr.unrender();
            qr.unrenderSettings();
            return true;
        } finally {
            qr.dom?.removeAttribute('inert');
            qr.settingsDom?.removeAttribute('inert');
        }
    }

    toJSON() {
        return {
            version: 2,
            name: this.name,
            disableSend: this.disableSend,
            placeBeforeInput: this.placeBeforeInput,
            injectInput: this.injectInput,
            color: this.color,
            onlyBorderColor: this.onlyBorderColor,
            qrList: this.qrList,
            idIndex: this.idIndex,
        };
    }

    async performSave() {
        const payload = JSON.stringify(this);
        const save = async () => {
            if (this.isDeleted || this.deleting || this.isBusy || QuickReplySet.#busyNames.has(this.name)) return false;
            const saved = await this.#write(payload);
            if (saved) this.rerender();
            return saved;
        };
        const saved = this.#saveQueue.then(save, save);
        this.#saveQueue = saved;
        return saved;
    }

    async #write(payload) {
        try {
            const response = await fetch('/api/quick-replies/save', { method: 'POST', headers: getRequestHeaders(), body: payload });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return true;
        } catch (error) {
            warn(`Failed to save Quick Reply Set: ${this.name}`);
            console.error('QR could not be saved', error);
            toastr.error('The Quick Reply set could not be saved. Your existing replies are preserved; try again.');
            return false;
        }
    }

    async delete() {
        if (this.isDeleted) return true;
        if (this.deleting || this.isBusy || QuickReplySet.#busyNames.has(this.name)) return false;
        this.deleting = true;
        await this.#saveQueue;
        try {
            const response = await fetch('/api/quick-replies/delete', {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify(this),
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            this.unrender();
            this.isDeleted = true;
            const idx = QuickReplySet.list.indexOf(this);
            if (idx > -1) {
                QuickReplySet.list.splice(idx, 1);
            } else {
                warn(`Deleted Quick Reply Set was not found in the list of sets: ${this.name}`);
            }
            return true;
        } catch (error) {
            console.error('Quick Reply set could not be deleted', error);
            toastr.error('The Quick Reply set could not be deleted. Your replies were kept. Try again.');
            return false;
        } finally {
            this.deleting = false;
            if (!this.isDeleted) void this.save();
        }
    }
}
