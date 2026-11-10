/**
 * @typedef {import('./MenuItem.js').MenuItem} MenuItem
 */

export class SubMenu {
    /**@type {MenuItem[]}*/ itemList = [];
    /**@type {Boolean}*/ isActive = false;

    /**@type {HTMLElement}*/ root;


    constructor(/**@type {MenuItem[]}*/items) {
        this.itemList = items;
        this.onResize = () => this.position();
    }

    render() {
        if (!this.root) {
            const menu = document.createElement('ul'); {
                this.root = menu;
                menu.classList.add('list-group');
                menu.classList.add('ctx-menu');
                menu.classList.add('ctx-sub-menu');
                menu.addEventListener('pointerleave', event => {
                    if (event.pointerType === 'mouse' && !this.contains(event.relatedTarget) && !this.parent?.contains(event.relatedTarget) && !this.contains(document.activeElement)) this.onLeave?.();
                });
                this.itemList.forEach(it => menu.append(it.render()));
            }
        }
        return this.root;
    }


    show(/**@type {HTMLElement}*/parent) {
        if (this.isActive) return;
        this.isActive = true;
        this.parent = parent;
        this.render();
        // The root menu scrolls and applies a backdrop filter, so descendants
        // cannot use viewport coordinates without being clipped or translated.
        (parent.closest('.ctx-blocker') || document.body).append(this.root);
        this.position();
        window.addEventListener('resize', this.onResize);
    }
    contains(target) {
        return target instanceof Node && (this.root?.contains(target) || this.itemList.some(item => item.subMenu?.contains(target)));
    }
    position() {
        if (!this.isActive || !this.parent?.isConnected) return;
        const parent = this.parent.getBoundingClientRect();
        Object.assign(this.root.style, { position: 'fixed', bottom: 'auto', right: 'auto', left: '8px', top: '8px', width: 'max-content', maxWidth: `${window.innerWidth - 16}px`, maxHeight: `${window.innerHeight - 16}px`, overflowY: 'auto' });
        const bounds = this.root.getBoundingClientRect();
        const desired = parent.right + bounds.width <= window.innerWidth - 8 ? parent.right : parent.left - bounds.width;
        this.root.style.left = `${Math.max(8, Math.min(desired, window.innerWidth - bounds.width - 8))}px`;
        this.root.style.top = `${Math.max(8, Math.min(parent.top, window.innerHeight - bounds.height - 8))}px`;
    }
    hide() {
        window.removeEventListener('resize', this.onResize);
        this.itemList.forEach(item => item.collapse());
        if (this.root) {
            this.root.remove();
            this.root.style.top = '';
            this.root.style.left = '';
        }
        this.isActive = false;
    }
    toggle(/**@type {HTMLElement}*/parent) {
        if (this.isActive) {
            this.hide();
        } else {
            this.show(parent);
        }
    }
}
