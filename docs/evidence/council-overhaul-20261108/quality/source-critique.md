# Implementation consultation

The parent invited source critique before the rendered build was ready. These findings describe the source read at that point. They are sent recommendations, not a final verdict. No browser has been opened.

## Sent findings

1. Major layout risk. workspace.css changes the desktop details panel to min(400px, 42%) while the chat and composer still reserve 320px. At widths where the panel reaches 400px, the reservations disagree by 80px. Use one width owner and inspect 1024px and 1280px renders.
2. Keyboard focus loss. workspace-scene.js replaces its panel on generation/summary signature changes but restores focus only through data-scene-focus, which currently exists on close, section controls and the reply selector. Correction links, branch actions and disclosure summaries lack that identity. Preserve these focused controls during updates and test focused summaries through generation completion.
3. Readability defect. Historical model/provider/preset/budget values are placed in one paragraph with newline separators. Normal paragraph whitespace collapses those separators. Use semantic rows and expose recorded capacity/output reservation beside the prompt budget when captured.
4. Major reliability risk. itemized-captures.js calls crypto.randomUUID during beginClientCapture and computes the response fingerprint with crypto.subtle before finishClientCapture enters its try block. Those APIs may be unavailable on non-localhost HTTP; a rejected digest can escape into native generation before its transcript save. Enclose all diagnostic construction in the best-effort boundary and test missing/rejecting crypto without blocking reply completion or saving.
5. Late state risk. Scene details refresh subscriptions currently omit EXTENSION_ACTIVATED. The memory owner can initialize after the first details render. Its state must recover from uninitialized without navigation, duplicate controls or focus loss.

The parent separately identified summary Restore persistence, group-registration rollback and stale asynchronous rendering as implementation work still in progress. I did not treat those known incomplete areas as final defects.

## Rechecks on isolated source fixture 8038

The parent supplied st-council-quality-20261108 with five fresh synthetic volumes and source overlays. I opened only my returned browser tab, tab_p_dfebdf42-64d6-46f6-9748-1374a67d0b39, after preview_status. This is source-fixture evidence, not immutable release-image proof.

The initial layout, focus, text grouping, crypto-boundary and late-activation findings were addressed in source. Rendered desktop now reserves the same 400px details width. Phone close naming, 44px reply selector and sticky close header were checked after reload. A deterministic native Custom request to council-neutral-fixture produced recorded client context showing model, preset, configured capacity 4095, prompt budget 3795 and output budget 300. This establishes fixture capture integration, not model quality.

At 768px, opening details/context retained the exact composer and last-message nodes, draft text and selection [2,10]. A signature-changing native metadata refresh retained an open recorded-message PRE node, focus, scrollTop120 and selected text. The temporary unsaved fixture premise used to trigger that refresh was removed immediately afterward.

Native override Escape discarded pending scenario text and restored focus to its trigger. At 320x400, native font scale1.5 and 20px root text, the fixed header remains closable and the override Remove action now wraps within the modal width. All three override textareas now have associated visible labels. Browser-only style changes here simulate enlarged text; they are not a physical phone test.

A one-shot browser fetch wrapper returned a synthetic500 for /api/chats/save on this fixture only. Apply left the modal open, retained pending scenario text, rolled native metadata back to its previous undefined value, and reported Not saved in its status. A second Apply succeeded and retained the user draft. The fetch wrapper was restored. The remaining feedback finding is that the status is appended after the long form and is outside the viewport while editing Scenario at the top. The failed-state screenshot has no visible failure explanation. Parent was asked to put failure feedback beside the fixed actions or bring it into view.

The browser tool rejected one long attribute selector. Dependent clicks then timed out and an evaluation found no disclosure; these were review-automation failures, not application findings. Fresh snapshot refs corrected the path. Earlier attempts to type while the app was still loading or while the composer was hidden did not establish draft behavior and were excluded from the draft-preservation claim.

## Further rendered rechecks

At 448px, keyboard Tab from the final setup action wraps to Close scene details; Shift+Tab wraps back. Escape closes details, restores the header portrait trigger and retains the draft. Summary memory and Author's Note destinations each mount one existing native node. The summary source selector now measures44px. Author's Note initially rendered blank under an older loaded stylesheet; after reloading the supplied fix, it renders its native textareas and controls. That objection is closed.

The failed-save status now appears above the fixed Apply/Cancel actions and is visible at448x600. Its measured top/bottom are448/490px. A separate paint issue remains under investigation: after a controlled500, the Apply node is absent from screenshots despite normal computed display, visibility, opacity, color and a valid44px bounding rectangle. Hovering it immediately restores its painted text/button. Shift+Tab back from Cancel also produces a visible focused Apply. The action itself still works. The precise cause is unproven; inert toggling of the dialog is a candidate. The parent received before/after screenshots and a recommendation to avoid making the footer inert or to restore its paint/focus after failure.

## Final implementation recheck

Q1 and the enlarged-footer follow-up are closed. A fresh reload of the updated frozen manifest shows visible Apply/Cancel after500 before hover at448x600. At320x400 with native scale1.5 and root20px, shortened feedback and footer sizing keep both55px-high actions inside the viewport. Cancel was clicked successfully. A separate500 followed by Apply succeeded and preserved the user draft. final-failure-phone.png and final-failure-enlarged.png record these states. Served script.js and workspace.css matched the updated source-final hashes. No review fetch wrapper remains installed.

The earlier package version inference was corrected:8038 does have a package bind, but npm replaced its host inode after container start. Its old reported version is not evidence that the package overlay was absent. Static served-source hash checks remain valid. Implementation accepted; actual-image release review remains pending.
