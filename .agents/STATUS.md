# Status

## Project state

Published and verified v1.19.14, source `06ab7010310dfa174be81d7eefa38ecdc195778c`.
Fork: https://github.com/Nulifyer/SillyTavern. Published branch: release.
Workflow42273796301 passed native amd64/arm64 startup/heartbeat and publication.
Image index: `sha256:5f8324a85c392cb2682b5c0892d7088bcf8687af9148413c1cfbe5336441c24b`.

## Active tasks

Mobile message portrait overlap follow-up is active. User also requests Pixel9ProXL sizing.
Source fix constrains avatar images to their container and keeps the avatar column
from shrinking. Publish/verifyv1.19.15 after focused/source checks. Never touch
production69/test85. Evidence: docs/evidence/mobile-portraits-20261106/.

[Full workspace review](work/full-workspace-review.md) and the earlier
[service workspace task](work/service-workspace.md) are complete.

## Next action

First finish the v1.19.15 portrait follow-up and actual image acceptance.
Homelab owns the later deployment using
[handoff](../docs/evidence/full-workspace-review-20261106/handoff.md).
Production69 and shared test85 were never accessed or changed. Do not update
production from this thread. Preserve existing volume identities and take the
normal private backup; record the actual pre-update image before deployment.

## Verification

Actual pulled amd64 image:43browser cases passed in6.2minutes, including both
live Juiced cases, zero uncaught page errors. Fresh local8021 container
st-full-review-release14-20261106 has5synthetic volumes/no overlays,24tagged
runtime-file matches, version1.19.14, HTTPS Juiced200 and valid native heartbeat.
Standalone native Save/restart/reload preserved Advanced controls, Qwen3.5-2B,
manual12288context, temperature0.85, imageSteps20 and voice off.
Source41controlled cases/2opt-in live skips plus final focused character case
passed;424units, lint/actionlint pass. Test lint0errors/24warnings.
Every16settings destination and core story flows reviewed with independent
baseline/follow-up/final captures; Edit/Create re-review adds28captures/16states.
Evidence: docs/evidence/full-workspace-review-20261106/.

## Limits

Paid-provider inference, physical microphone, audible quality, administrator
mutations and every conditional provider form remain unqualified. Retrieval
retains native setup; Juiced reported no enabled embeddings model. ARM64 has
native startup/heartbeat proof; full browser/service acceptance ran on amd64.
No Juiced model policy, runtime or cache configuration was changed.
