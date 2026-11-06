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

## Current evidence and next action

425units/lint/actionlint pass. Source full run61/63 passed with zero uncaught page
errors; corrected migration/reload checks plus keyboard recovery passed4focused
cases. No runtime changes remain after the recovery button activation fix.
Repeated owner checks12passed. Actual hidden/freeze is asserted through the original
Playwright CDP session, not visibility emulation alone. Native dropdown preservation,
multiple unacknowledged messages, pending-permission ownership and late APP_READY/
dry-run notice resets were corrected before publication. Publishv16 and require
full63-case acceptance of the pulled image/no overlays before final handoff.

## Boundaries and limits

Only local synthetic containers are used. Production69 and shared85 remain
untouched. Browser lifecycle emulation is not physical phone-lock qualification.
OS discard cannot reattach the original HTTP inference. Local text checkpoints
support explicit recovery; storage-disabled users get a visible copy warning.
