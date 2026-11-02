import { element } from './workspace-views.js';

// Composer shell/host/main/context-strip structure adapted from T3 Code's
// ComposerSurface.tsx at 6f41364805e31a1f8d59c18c7cc451630cd9265d.
// Copyright (c) 2026 T3 Tools Inc. MIT notice: /licenses/T3-Code.txt.
// Native SillyTavern form, textarea and action nodes keep their own handlers.
export class ComposerSurface {
    constructor(toolbar) {
        this.toolbar = toolbar;
        this.origins = new Map();
        this.shell = element('div', 'workspace-only workspace-composer-surface');
        this.shell.dataset.slot = 'composer-shell';
        this.host = element('div', 'workspace-composer-host');
        this.host.dataset.slot = 'composer-host';
        this.main = element('div', 'workspace-composer-main');
        this.main.dataset.slot = 'composer-main';
        this.strip = element('div', 'workspace-composer-context');
        this.strip.dataset.slot = 'composer-context-strip';
        this.host.append(this.main);
        this.shell.append(this.host, this.strip);
        document.getElementById('form_sheld').append(this.shell);
    }

    mount(node, parent) {
        if (!this.origins.has(node)) this.origins.set(node, { parent: node.parentNode, next: node.nextSibling });
        parent.append(node);
    }

    setLayout(workspace) {
        if (workspace) {
            this.mount(document.getElementById('send_form'), this.main);
            // Native stop/command visibility is scoped to #send_form.
            this.mount(this.toolbar, document.getElementById('send_form'));
            this.mount(document.getElementById('rightSendForm'), this.toolbar);
            this.mount(document.getElementById('workspace-composer-hint'), this.strip);
        } else {
            for (const [node, origin] of [...this.origins].reverse()) {
                origin.parent.insertBefore(node, origin.next?.parentNode === origin.parent ? origin.next : null);
            }
        }
    }
}
