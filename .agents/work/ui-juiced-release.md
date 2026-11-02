# UI repair and Juiced release

Status: complete
Owner: SillyTavern project thread mcp:a1b3f2ea-069d-4f17-8247-e0cab15abe73
Repository: /home/nulifyer/Projects/SillyTavern
Base: feat/cohesive-workspace at 33b3e39f9
Project: ../PLAN.md
Request source: User request, November 2, 2026, repair disappearing screens, simplify Juiced service setup, browser-test and publish a verified container for Homelab handoff.

## Goal

Repair shared UI lifecycle failures, configure optional Juiced services through native owners, and publish and verify the actual multiarch release image.

## Acceptance checks

- [x] Reproduce rendering failures and retain before/after evidence and regression cases.
- [x] One server entry discovers enabled chat, image, speech and transcription models and voices. Optional image writer preserves the story model.
- [x] Real Juiced requests pass from a local container using fresh synthetic data.
- [x] Navigation, settings, dialogs, pending requests, errors/retry, keyboard, reload, desktop and mobile pass realistic browser regressions.
- [x] Lint, unit tests and browser checks pass with documented coverage.
- [x] Publish source, immutable version tag and GitHub Release; native amd64/arm64 publication gates pass.
- [x] Pull and verify released GHCR image without source overlays using fresh synthetic volumes.
- [x] Record source, index and architecture digests, workflow, migration, limits and rollback handoff.

## Scope

In: SillyTavern source, UX, tests, release, continuity and accepted four uncommitted writer/documentation inputs.
Out: Production stack69, all production data/config/chats/characters/settings, Homelab production deployment, shared Juiced runtime/policy/cache changes, GPU manager deployment.

## Current state

Phase: Complete. Homelab handoff ready.
Dependencies: Existing Juiced HTTPS service, local Podman, T3 collaborative browser, GitHub release access.
Integration: Published source/tag v1.19.9, workflow 41404996482 succeeded. Anonymous pulled image verified without overlays. Stock sd.cpp backend unchanged. Exact digests and migration/rollback are in docs/container-releases.md.
Next action: Homelab owns the later production update using docs/container-releases.md; preserve volume identities and backup requirements.

## Decisions

| Decision | Reason | Evidence |
| --- | --- | --- |
| Use local Podman with task-specific fresh volumes | Avoid production and shared test-state exposure | User boundary; Podman available |
| Preserve native provider owners and stock sd.cpp | Avoid duplicated protocol/config registries | User request; project design |

## Findings

| Finding | Evidence | Status |
| --- | --- | --- |
| Four expected files modified at start | Initial git status and inspected diff | Accepted inputs |
| Juiced HTTPS is reachable with valid TLS from local image | Container Node fetch /v1/models?service=chat returned 200 | Observed |
| Source 9ab8d2cedec44448c7f8ea49c4dfba5c8799ebf1 passed all 27 browser cases and is tagged v1.19.9 | docs/evidence/ui-juiced-20261102/source-browser.log; GitHub Release and workflow 41404996482 | Published and verified |
| New project-specific thread already exists | t3_thread_list currentThreadId matches owner | Observed |
| Settings section click closes the mounted native panel on v1.19.8 | docs/evidence/ui-juiced-20261102/render-failure.json and before/after PNGs | Fixed in native auto-close ownership |
| First saved profile was appended to an unmounted optgroup | Shared dropdown inspection and failing/passing service setup case | Fixed in shared Connection Manager dropdown |
| Real chat, separate writer/image, speech and transcription pass | docs/evidence/ui-juiced-20261102/source-live.log and live screenshots | Observed in local container |
| FUTO accepts only 16 kHz WAV for this deployment | docs/evidence/ui-juiced-20261102/transcription-format-gap.json | Homelab server compatibility handoff; generic PCM capture passes |

## Changes

| Path or artifact | Change | Verification |
| --- | --- | --- |
| docs/evidence/ui-juiced-20261102/ | Live discovery and protocol responses | HTTPS requests |
| public/script.js and extensions/shared.js | Shared mounted-panel and dropdown ownership fixes | Browser regressions |
| service-connections.js and native provider owners | One-server discovery and per-service application | Native settings/reload and real service checks |
| dictation.js and audio-recording.js | Opt-in recording/file decode, PCM WAV and unsent draft insertion | Permission/retry/cancel fixture and real Kokoro-to-ASR round trip |
| src/endpoints/openai.js | Compatible metadata discovery, transcription and speech content type | 12 new contracts; 423 total unit tests pass |

## Risks and unknowns

- Physical microphone hardware and audible output quality are not tested. Synthetic browser recording and real audio decoding/transcription are tested.
- Historical v1.19.8 checks do not establish current UI reliability. Current acceptance is in source-browser.log and released-browser.log.
- Released amd64 image passed all 27 browser cases, real services, native save/reload, restart and explicit reconnect. ARM64 passed native build/startup gates.
