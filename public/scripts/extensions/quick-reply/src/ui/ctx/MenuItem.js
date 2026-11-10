import { SubMenu } from './SubMenu.js';

export class MenuItem {
    /**@type {string}*/ icon;
    /**@type {boolean}*/ showLabel;
    /**@type {string}*/ label;
    /**@type {string}*/ title;
    /**@type {object}*/ value;
    /**@type {function}*/ callback;
    /**@type {MenuItem[]}*/ childList = [];
    /**@type {SubMenu}*/ subMenu;

    /**@type {HTMLElement}*/ root;

    /**@type {function}*/ onExpand;


    /**
     *
     * @param {?string} icon
     * @param {?boolean} showLabel
     * @param {string} label
     * @param {?string} title Tooltip
     * @param {object} value
     * @param {function} callback
     * @param {MenuItem[]} children
     */
    constructor(icon, showLabel, label, title, value, callback, children = []) {
        this.icon = icon;
        this.showLabel = showLabel;
        this.label = label;
        this.title = title;
        this.value = value;
        this.callback = callback;
        this.childList = children;
    }


    render() {
        if (!this.root) {
            const item = document.createElement('li'); {
                this.root = item;
                item.classList.add('list-group-item');
                item.classList.add('ctx-item');

                // if a title/tooltip is set, add it, otherwise use the QR content
                // same as for the main QR list
                item.title = this.title || this.value;

                // Native action buttons support pointer, Enter and Space.
                const action = document.createElement(this.callback ? 'button' : 'div');
                action.classList.add('ctx-action');
                if (action instanceof HTMLButtonElement) {
                    action.type = 'button';
                    action.setAttribute('aria-label', this.label || this.title || 'Quick Reply');
                    action.addEventListener('click', (evt) => {
                        evt.stopPropagation();
                        this.callback(evt, this);
                    });
                }
                item.append(action);
                const icon = document.createElement('div'); {
                    icon.classList.add('qr--button-icon');
                    icon.classList.add('fa-solid');
                    if (!this.icon) icon.classList.add('qr--hidden');
                    else icon.classList.add(this.icon);
                    action.append(icon);
                }
                const lbl = document.createElement('div'); {
                    lbl.classList.add('qr--button-label');
                    if (this.icon && !this.showLabel) lbl.classList.add('qr--hidden');
                    lbl.textContent = this.label;
                    action.append(lbl);
                }
                if (this.childList.length > 0) {
                    item.classList.add('ctx-has-children');
                    const sub = new SubMenu(this.childList);
                    this.subMenu = sub;
                    sub.onLeave = () => this.collapse();
                    const trigger = document.createElement('button'); {
                        trigger.type = 'button';
                        trigger.setAttribute('aria-label', `Submenu for ${this.label}`);
                        trigger.setAttribute('aria-expanded', 'false');
                        trigger.setAttribute('aria-haspopup', 'true');
                        trigger.classList.add('ctx-expander');
                        trigger.textContent = '⋮';
                        trigger.addEventListener('click', (evt) => {
                            evt.stopPropagation();
                            this.toggle();
                            if (evt.detail === 0 && this.subMenu.isActive) this.subMenu.root.querySelector('button')?.focus({ preventScroll: true });
                        });
                        item.append(trigger);
                    }
                    item.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') this.expand(); });
                    item.addEventListener('pointerleave', event => {
                        if (event.pointerType === 'mouse' && !this.subMenu.contains(event.relatedTarget) && !this.subMenu.contains(document.activeElement)) this.collapse();
                    });
                }
            }
        }
        return this.root;
    }


    expand() {
        this.subMenu?.show(this.root);
        this.root?.querySelector(':scope > .ctx-expander')?.setAttribute('aria-expanded', 'true');
        if (this.onExpand) {
            this.onExpand();
        }
    }
    collapse() {
        this.subMenu?.hide();
        this.root?.querySelector(':scope > .ctx-expander')?.setAttribute('aria-expanded', 'false');
    }
    toggle() {
        if (this.subMenu.isActive) {
            this.collapse();
        } else {
            this.expand();
        }
    }
}
