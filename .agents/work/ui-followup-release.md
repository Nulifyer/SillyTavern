# UI and durable chat follow-up release

Status: source batches qualified; publication and immutable-image acceptance pending
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

- [ ] Inspected source/test/evidence commit excludes unrelated and private work.
- [x] All28 source UI cases qualified across the recorded attempt and corrected 2-case recheck; required checks pass.
- [ ] Published native amd64/arm64 image/startup gates identify exact source.
- [ ] Actual immutable amd64 image passes full browser/live/native/lifecycle checks.
- [ ] Fresh-volume/no-overlay source-byte and native health checks pass.
- [ ] Synthetic v1.19.24 upgrade preserves exact story/settings/draft and volumes.
- [ ] Production reports the verified image and healthy native state.
- [ ] Deployment definition/environment, routing/network and mounts are unchanged.

## Current state

All 370 first-party public files are reviewed at current hashes;2,037 current static
candidates and266 separate expanded registrations have no drift or review gaps.
Final source is frozen at the 89-file manifest.657 units in 34 suites pass; root
lint/actionlint/diff pass; test lint has0 errors/134 warnings. Exact source attempts,
failed fixture/timing cases, corrected rechecks and new menu lifetime regression
are recorded in ../../docs/evidence/ui-followup-20261109/source-qualification.json.
Do not present those batches as one clean 391-case final-source run.

Next action: commit inspected source and publish v1.19.25. The actual immutable
image must pass all final 391 browser/live/native/lifecycle cases together within
their four isolated fixture suites, plus source-byte/health and v1.19.24 migration
checks before production refresh. Production remains v1.19.24; private metadata
preparation is healthy and must stay local.

## Boundaries

No production app routes, screens, logs or volume contents. Use only
/home/nulifyer/Projects/Homelab/portainer.sh for production metadata/lifecycle.
Do not source or print credential files. Preserve unrelated council records,
handoff edits, the earlier authorization hunk and existing untracked artifacts.
Rollback baseline is verified v1.19.24 with unchanged volumes; it has no durable
job reader, so preserve candidate journals if rollback is needed.
