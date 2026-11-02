# UI repair and Juiced release

Status: active
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
- [ ] Navigation, settings, dialogs, pending requests, errors/retry, keyboard, reload, desktop and mobile pass realistic browser regressions.
- [ ] Lint, unit tests and browser checks pass with documented coverage.
- [ ] Publish source, immutable version tag and GitHub Release; native amd64/arm64 publication gates pass.
- [ ] Pull and verify released GHCR image without source overlays using fresh synthetic volumes.
- [ ] Record source, index and architecture digests, workflow, migration, limits and rollback handoff.

## Scope

In: SillyTavern source, UX, tests, release, continuity and accepted four uncommitted writer/documentation inputs.
Out: Production stack69, all production data/config/chats/characters/settings, Homelab production deployment, shared Juiced runtime/policy/cache changes, GPU manager deployment.

## Current state

Phase: Final source regression and v1.19.9 release preparation.
Dependencies: Existing Juiced HTTPS service, local Podman, T3 collaborative browser, GitHub release access.
Integration: Four modified inputs integrated. Shared panel/dropdown repairs, native service setup and PCM dictation implemented. Stock sd.cpp backend unchanged.
Next action: Finish the source browser suite, commit the inspected source, publish v1.19.9 and verify the pulled release without overlays.

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
- Historical v1.19.8 checks do not establish current UI reliability. New source and released-image browser acceptance are required.
- Final released-image behavior and publication remain outstanding.
