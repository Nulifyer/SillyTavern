# Late extension readiness

v1.19.17 passed all 65 actual-image browser cases, but the separate native reload
review found Images showing a missing-extension notice after its controls loaded.
Advanced controls and image steps 8 persisted; changing category recovered them.
The previous suite waited for normal startup and did not hold an activation late.

Native activation hooks release startup after a 5000ms timeout while their promise
continues. No eventual completion notification existed. ServiceConnections only
prepared sections at initialization, creating the image/writer selectors; a
settings refresh alone could never find those missing wrappers.

v1.19.18 emits native EXTENSION_ACTIVATED on actual hook fulfillment, even after
the timeout. ServiceConnections groups each new native section once and renders
only missing service rows from existing discovery data. It preserves existing
inputs, pending choices, listeners and open native details. WorkspaceSettings
removes a connected missing-section notice only for its still-active category,
applies the native extension path and keeps the panel mounted. It never navigates
or refocuses the user. No model configuration, settings schema or backend changed.

The held-template test waits until APP_READY with SD still absent, opens Images,
then releases its actual settings.html request. It fails on the actual v1.19.17
image: expected one `.sd_image_settings`, received 0 after 30000ms. Native SD loads
but the workspace never groups/reveals it. The baseline run retains its additional
runner error after max-failures1. No application page error was recorded.

Source initially passed both held-template cases in 22.3 seconds. The second case
verifies a server while SD is absent, edits connection fields/unapplied model,
then releases SD. Native input/model nodes, focus and selection stay unchanged.
Repeated completion notifications create no duplicate sections or listeners and
do not collapse an opened disclosure. The final variant opens Images before
switching away, to cover a stale disconnected placeholder as well.

Source regression: six existing settings/discovery/preservation/menu cases passed
in 1.1 minutes. 425 unit tests, root lint and actionlint pass; test lint has
0 errors/50 warnings. Final source and actual-image results are separate JSON
summaries. Actual acceptance requires all 67 cases together, both live Juiced
cases, fresh synthetic volumes and no source overlays. v1.19.17 remains an
immutable intermediate; it is not this task's final deployment handoff.
