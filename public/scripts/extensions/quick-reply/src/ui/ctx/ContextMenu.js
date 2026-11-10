import { QuickReply } from '../../QuickReply.js';
import { QuickReplySet } from '../../QuickReplySet.js';
import { MenuHeader } from './MenuHeader.js';
import { MenuItem } from './MenuItem.js';
import { eventSource, event_types } from '../../../../../../script.js';

export class ContextMenu {
    /**@type {MenuItem[]}*/ itemList = [];
    /**@type {Boolean}*/ isActive = false;

    /**@type {HTMLElement}*/ root;
    /**@type {HTMLElement}*/ menu;


    constructor(/**@type {QuickReply}*/qr) {
        this.onResize = () => this.position();
        this.onChatChanged = () => this.hide();
        // this.itemList = items;
        this.itemList = this.build(qr).children;
        this.itemList.forEach(item => {
            item.onExpand = () => {
                this.itemList.filter(it => it !== item)
                    .forEach(it => it.collapse());
            };
        });
    }

    /**
     * @param {QuickReply} qr
     * @param {String} chainedMessage
     * @param {QuickReplySet[]} hierarchy
     * @param {String[]} labelHierarchy
     */
    build(qr, chainedMessage = null, hierarchy = [], labelHierarchy = []) {
        const tree = {
            icon: qr.icon,
            showLabel: qr.showLabel,
            label: qr.label,
            title: qr.title,
            message: (chainedMessage && qr.message ? `${chainedMessage} | ` : '') + qr.message,
            children: [],
        };
        qr.contextList.forEach((cl) => {
            if (!cl.set) return;
            if (!hierarchy.includes(cl.set)) {
                const nextHierarchy = [...hierarchy, cl.set];
                const nextLabelHierarchy = [...labelHierarchy, tree.label];
                tree.children.push(new MenuHeader(cl.set.name));

                // If the Quick Reply's own set is added as a context menu,
                // show only the sub-QRs that are Invisible but have an icon
                // intent: allow a QR set to be assigned to one of its own QR buttons for a "burger" menu
                // with "UI" QRs either in the bar or in the menu, and "library function" QRs still hidden.
                // - QRs already visible on the bar are filtered out,
                // - hidden QRs without an icon are filtered out,
                // - hidden QRs **with an icon** are shown in the menu
                // so everybody is happy
                const qrsOwnSetAddedAsContextMenu = cl.set.qrList.includes(qr);
                const visible = (subQr) => {
                    return qrsOwnSetAddedAsContextMenu
                        ? subQr.isHidden && !!subQr.icon  // yes .isHidden gets inverted here
                        : !subQr.isHidden;
                };

                cl.set.qrList.filter(visible).forEach(subQr => {
                    const subTree = this.build(subQr, cl.isChained ? tree.message : null, nextHierarchy, nextLabelHierarchy);
                    tree.children.push(new MenuItem(
                        subTree.icon,
                        subTree.showLabel,
                        subTree.label,
                        subTree.title,
                        subTree.message,
                        (evt) => {
                            evt.stopPropagation();
                            this.hide();
                            const finalQr = Object.assign(new QuickReply(), subQr);
                            finalQr.message = subTree.message.replace(/%%parent(-\d+)?%%/g, (_, index) => {
                                return nextLabelHierarchy.slice(parseInt(index ?? '-1'))[0];
                            });
                            cl.set.execute(finalQr);
                        },
                        subTree.children,
                    ));
                });
            }
        });
        return tree;
    }

    render() {
        if (!this.root) {
            const blocker = document.createElement('div'); {
                this.root = blocker;
                blocker.classList.add('ctx-blocker');
                blocker.addEventListener('click', () => this.hide());
                blocker.addEventListener('keydown', event => {
                    if (event.key !== 'Escape') return;
                    event.preventDefault(); event.stopPropagation();
                    this.hide();
                    if (this.anchor?.isConnected) this.anchor.focus({ preventScroll: true });
                });
                const menu = document.createElement('ul'); {
                    this.menu = menu;
                    menu.classList.add('list-group');
                    menu.classList.add('ctx-menu');
                    this.itemList.forEach(it => menu.append(it.render()));
                    blocker.append(menu);
                }
            }
        }
        return this.root;
    }


    show(event) {
        if (this.isActive) return;
        this.isActive = true;
        this.render();
        this.anchor = event.currentTarget instanceof HTMLElement ? event.currentTarget : event.target instanceof HTMLElement ? event.target : null;
        this.pointer = event.clientX || event.clientY ? { x: event.clientX, y: event.clientY } : null;
        document.body.append(this.root);
        this.position();
        window.addEventListener('resize', this.onResize);
        eventSource.on(event_types.CHAT_CHANGED, this.onChatChanged);
        this.anchor?.setAttribute('aria-expanded', 'true');
        if (!this.pointer) this.menu.querySelector('button')?.focus({ preventScroll: true });
    }
    position() {
        if (!this.isActive) return;
        const anchor = this.anchor?.getBoundingClientRect();
        const x = this.pointer?.x ?? anchor?.left ?? 8;
        const y = this.pointer?.y ?? anchor?.top ?? 8;
        Object.assign(this.menu.style, { bottom: 'auto', left: '8px', top: '8px', width: 'max-content', maxWidth: `${window.innerWidth - 16}px`, maxHeight: `${window.innerHeight - 16}px`, overflowY: 'auto' });
        const bounds = this.menu.getBoundingClientRect();
        this.menu.style.left = `${Math.max(8, Math.min(x, window.innerWidth - bounds.width - 8))}px`;
        this.menu.style.top = `${Math.max(8, Math.min(y - bounds.height, window.innerHeight - bounds.height - 8))}px`;
    }
    hide() {
        window.removeEventListener('resize', this.onResize);
        eventSource.removeListener(event_types.CHAT_CHANGED, this.onChatChanged);
        this.anchor?.setAttribute('aria-expanded', 'false');
        this.itemList.forEach(item => item.collapse());
        if (this.root) {
            this.root.remove();
        }
        this.isActive = false;
    }
    toggle(/**@type {PointerEvent}*/evt) {
        if (this.isActive) {
            this.hide();
        } else {
            this.show(evt);
        }
    }
}
