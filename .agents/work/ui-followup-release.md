# UI and durable chat follow-up release

Status: complete
Owner: Codex root; bounded UI/native/server workers and independent source reviews
Project: ../PLAN.md
Request: November9 UI audit, selected backgrounds, update prod, color correction,
interrupted reply recovery using T3 Code source, and visible Continue.

## Goal and authority

Deliver the corrected UI and native recovery behavior as v1.19.25. The user's
existing production-update request includes necessary source commit, release
branch push, tag/publication, synthetic actual-image qualification and existing
stack image refresh. Preserve deployment definition/environment, routing/network
and all production volume identities. Use metadata only for production checks.

## Acceptance

- [x] Inspected source/test/evidence commit excludes unrelated and private work.
- [x] All28 source UI cases qualified across the recorded attempt and corrected 2-case recheck; required checks pass.
- [x] Published native amd64/arm64 image/startup gates identify exact source.
- [x] Actual immutable amd64 image passes full browser/live/native/lifecycle checks.
- [x] Fresh-volume/no-overlay source-byte and native health checks pass.
- [x] Synthetic v1.19.24 upgrade preserves exact story/settings/draft and volumes.
- [x] Production reports the verified image and healthy native state.
- [x] Deployment definition/environment, routing/network and mounts are unchanged.

## Current state

Published and deployed v1.19.25, source `3a6e1cc6a4dc5299a870f9bdbfc36397b6208e3b`,
index `sha256:6d0432fbfd5c7bf562a10a22a4f4164d8b7d61d6f77e306e2fa099f68c545d09`.
Native amd64/arm64 startup/publication workflow 42765176165 passed. The actual
immutable amd64 image passes final UI 28, workspace 102/live, native 251 and
lifecycle 10:391 cases, no failed/skipped/flaky/uncaught page errors.657 units pass.
Exact source and initial failed attempts remain separate from final image proof.

After suites all 378 runtime files, 369 served source responses and the compiled
bundle match in each final fixture. Native heartbeat passes; fresh named volumes
and no overlays. Actual v1.19.24 migration preserves eight exact fields and five volume
identities. Production's verified new image is healthy with zero restarts in two samples;
all four volumes, stack/environment, network and routing remain unchanged.

Next action: none. Acceptance and metadata-only deployment proof:
../../docs/evidence/ui-followup-20261109/release-v25/acceptance.md.
Private operational receipts remain local. Physical hardware, audible quality,
paid providers, arbitrary themes/extensions and mid-tool browser death remain
unqualified. One page reload loads the new UI in existing browser clients.

## Boundaries

No production app routes, screens, logs or volume contents. Use only
/home/nulifyer/Projects/Homelab/portainer.sh for production metadata/lifecycle.
Do not source or print credential files. Preserve unrelated council records,
handoff edits, the earlier authorization hunk and existing untracked artifacts.
Rollback baseline is verified v1.19.24 with unchanged volumes; it has no durable
job reader, so preserve candidate journals if rollback is needed.
