# Status

## Project state

Fork: https://github.com/Nulifyer/SillyTavern. Published branch: release.
Published and verified v1.19.9 source: 9ab8d2cedec44448c7f8ea49c4dfba5c8799ebf1.
Release workflow 41404996482 passed native amd64/arm64 startup and publication.
Image index: sha256:1aeffc008478d6923152ae4dc61eb3115c56e97d0da3cb3a62b8cc17f4be33bf.

## Active tasks

No active tasks. [Completed UI repair and Juiced release](work/ui-juiced-release.md).
Homelab owns the later production update. Production stack69 and shared test85
were never accessed or changed by this task.

## Next action

Homelab can deploy the immutable v1.19.9 index using the handoff in
docs/container-releases.md, preserving production volume identities and taking
the normal private backup. Configure optional services through the user's UI.

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
