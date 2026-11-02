# Status

## Project state

Fork: https://github.com/Nulifyer/SillyTavern. Published branch: release.
Published and verified v1.19.9 source: 9ab8d2cedec44448c7f8ea49c4dfba5c8799ebf1.
Release workflow 41404996482 passed native amd64/arm64 startup and publication.
Image index: sha256:1aeffc008478d6923152ae4dc61eb3115c56e97d0da3cb3a62b8cc17f4be33bf.

## Active tasks

No active tasks. [Shared-screen follow-up](work/shared-screen-lifecycle.md)
confirmed the affected instance is still v1.19.8. The
[earlier UI repair and Juiced release](work/ui-juiced-release.md) is published.
Homelab owns the later production update. Production stack69 and shared test85
were never accessed or changed by this task.

## Next action

Homelab can deploy the immutable v1.19.9 index using docs/container-releases.md,
preserving production volume identities and taking the normal private backup.
User confirmed their affected page is v1.19.8. Production and test85 were not
updated by this thread; publication alone did not deliver the fix to that page.

## Blockers

None. Do not infer broad audio-format support from the deployed FUTO backend;
the documented 16 kHz WAV gap belongs to Juiced. Physical microphone hardware
and audible quality remain unqualified.

## Verification

Lint, 423 unit tests, actionlint, continuity validation and all 27 browser cases
passed. The 27 cases passed against both committed source and the actual pulled
GHCR image. Real Juiced streaming story chat, independent writer/image, decoded
speech and transcription passed. Settings survived native save/reload and local
container restart; explicit native reconnect passed. Eighteen selected source
files match the tag. Stock sd.cpp backend also matches v1.19.8 bytes.

Local verified preview: http://127.0.0.1:8014, container st-ui-release-20261102,
five fresh synthetic named volumes, no source overlays. Baseline/dev containers
are stopped. Exact index/architecture identities, workflow and rollback are in
docs/container-releases.md. Evidence: docs/evidence/ui-juiced-20261102/.

## First-reply follow-up

User reported the Jinja error `System message must be at the beginning`, then
confirmed it occurs on the first reply. Their selected model remains unknown.
Reproduced the exact error locally with Qwen3.5-2B and native post-history
instructions. Native Prompt Post-Processing `semi_tools` resolves the tested
case on v1.19.9, including save/reload, exact-story retry and 390px settings.
Evidence: docs/evidence/first-reply-formatting-20261102/. No application code,
image, server template or production settings were changed. The added live
regression covers a message-order/model combination absent from the original
27 cases. Steps and preset persistence caveat are in docs/model-services.md.
Next user action: apply that native setting and retry. Homelab's later image
handoff remains v1.19.9; no new container is required for this correction.

## Shared-screen follow-up

User confirmed v1.19.8 after reporting that image settings still disappear.
The actual v1.19.9 image passed 27 browser cases with 2 live-service cases
skipped. New coverage includes 33 category/control checkpoints at 1280/390/320px,
direct category-rail switching and a delayed save completing after navigation.
All 12 category screenshots were inspected at those widths. No new application
change or release was needed. Evidence: docs/evidence/shared-screen-lifecycle-20261102/.
