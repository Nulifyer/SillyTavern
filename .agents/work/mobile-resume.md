# Mobile tab recovery

User request: recover when a phone locks, a tab goes into the background, or the
browser suspends it. Preserve the earlier advanced settings/service workspace and
Pixel9ProXL fixes. Latest release before this batch is v1.19.15.

## Ownership and acceptance

Root owns browser lifecycle/draft recovery, native generation/save/status seams,
synthetic browser tests, source review, release and actual-image qualification.
Native draft preference, provider settings, transcript formats and service owners
remain authoritative. No automatic inference replay, parallel model registry,
Juiced adapter, production deployment or shared runtime changes.

Required proof: real browser hidden/freeze/resume events; healthy paused reply
exactly once; failed stream partial text and next draft recover after failed save
and reload; cast queue stops; stale status cannot mutate a changed provider;
coalesced bounded connection retry and CSRF renewal; per-story draft/rename and
native opt-out; explicit legacy recovery; blocked storage warning; late microphone
permission stopped; mobile/keyboard recovery UI; source/full checks; published
image with fresh synthetic volumes and no overlays.

## Completion and handoff

Published/verifiedv1.19.16, source05e7858f429a5fc5680e2d64919a47f5505d029d,
workflow42310788170. Actual pulled image passed63/63browser cases in8.2minutes,
zero skips/flaky/uncaught errors, both live Juiced cases. Five fresh volumes/no
overlays,28runtime-file matches/version/heartbeat/HTTPS and both native architecture
gates passed.425units/lint/actionlint pass; test lint0errors/28warnings.
Native Save/readback/stop/start/retry/reload and final manual phone views passed.
[Handoff](../../docs/evidence/mobile-resume-20261106/handoff.md) owns exact pins,
connections, migration, rollback and limits. Homelab owns later production deployment.

Source attempts, corrected fixtures and before/after renders are retained. The
review caught dropdown mutation, replaced unsaved replies, stale permission
ownership, late APP_READY/dry-run notice resets and keyboard focus-transfer input.
No runtime code changed after publication. This ledger has no remaining action.

## Boundaries and limits

Only local synthetic containers are used. Production69 and shared85 remain
untouched. Browser lifecycle emulation is not physical phone-lock qualification.
OS discard cannot reattach the original HTTP inference. Local text checkpoints
support explicit recovery; storage-disabled users get a visible copy warning.
