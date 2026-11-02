# Service workspace verification

Synthetic local browser work only. Production69 and shared test85 were never
accessed or changed. Source target: `st-ui-dev-20261102`, port8013, four separate
synthetic volumes with read-only public/src overlays. Published-image acceptance
must use new volumes and no overlays.

Before captures are retained from the verified v1.19.9 synthetic run in
`../ui-juiced-20261102/`. Source captures use the T3 collaborative browser.
Controlled regressions use the repository Playwright workflow, including desktop,
390/320px, enlarged fonts, native dialogs, repeated navigation, pending saves,
streams, classic restoration, prompt editing, context discovery and migration.

The context regression caught applying a second compatible model restoring the
previous model: provider switching triggered the old native model selector.
The native helper now switches provider before setting the requested model.
The new composer initially exposed a classic-drawer overlay and phone tools-menu
clipping; shared layout/menu owners now close or bound those surfaces.

Source and released logs, diagnostics, live request summaries and immutable
image identity are added at their verified boundaries. Console/network evidence
includes intentional connection failures and cancelled requests; those are not
claimed to be successful inference.

Source acceptance: all31 controlled cases passed across the full30-pass run and
the corrected320px rerun. Voice retry passed in the targeted run. The one full-run
failure clicked a covered editor coordinate; the realistic exposed-edge check
passed without forced clicks. Both final live cases pass. The first live attempt
failed on hidden/ambiguous test locators after the service controls moved; those
locators were corrected. Initial logs are retained and do not represent a clean
full-suite result. The actual released-image run will provide that result.
