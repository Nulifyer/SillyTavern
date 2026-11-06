# Testing

## Evidence standard

Fixtures verify integrations, not paid-provider responses or audible quality.
Manifest and OCI labels establish the digest, architectures, and source.

## Fast checks

- npm run lint
- /home/nulifyer/go/bin/actionlint .github/workflows/docker-publish.yml
- git diff --check

## Full checks

- npm --prefix tests run test:unit
- cd tests && ST_BASE_URL=http://127.0.0.1:8002 npx playwright test workspace.e2e.js --workers=1
- cd tests && ST_BASE_URL=http://127.0.0.1:8013 ST_JUICED_URL=https://juiced.swarm.nulteck.com npx playwright test workspace.e2e.js --workers=1 --grep 'live Juiced'

The live case is opt-in. Use only a fresh synthetic local container. It exercises
enabled Skyfall story chat, the independent Hauhau writer, one neutral sd.cpp
image, Kokoro speech and ASR transcription. It writes live-juiced-summary.json
and desktop/mobile screenshots under its test output directory. Copy evidence
before another Playwright run replaces test-results. It does not change model
policies or runtime configuration. For release acceptance, run against the pulled
release image with fresh volumes and no source overlays.

The November 2 regression reproduces Settings section-click disappearance on
unmodified v1.19.8. Service cases cover the first saved profile, native setting
preservation/reload, failure/retry, stale discovery, missing capabilities, writer
context and retry, microphone denial and cancellation, and real PCM audio format.

The v1.19.7 redesign passed lint, all 411 unit tests, and all 20 browser cases.
The v1.19.8 correction passed the full 20-case browser suite with all settings
categories checked at 1280/390/320px. Five final settings, phone popup-priority,
and enlarged-font cases also passed after the last Escape guard update.
Coverage includes pending-reply return through four story entry points, stable
message/composer nodes during streamed replies, manual scene images with automatic
tools off, voice opt-in/persistence, exact story lifecycle, casts, all settings
categories, native menu entry points, and classic restoration.
Phone checks cover 320/390/768px, reduced height, and the native 150% font preference
combined with a 20px browser default. Design evidence: docs/roleplay-workspace.md.

Native amd64 and ARM64 release jobs passed HTTP and heartbeat checks. Anonymous
manifests, empty-auth Podman pull, local startup, and version checks passed.
Published-image workspace modules and CSS matched the source. Browser checks
confirmed desktop/phone layout, voice opt-in, tools initially off, and one new-story
transcript in v1.19.7. The v1.19.8 image confirmed the corrected 320px picker and
native dropdown Escape behavior. Exact release evidence and digest: docs/container-releases.md.

## Message portrait follow-up

Use `--grep 'message portraits|within a 448px'` for the focused regression.
It checks image containment and text/name separation, including Android/mobile/
touch at DPR3 in18viewport/font states. Pixel9ProXL uses Chromium448×997 screen,
448×921 browser height, reduced448×400 height, and997×448/945×396 landscape.
Native font scales1/1.5 are covered, plus320/390/768/1280 widths. The448px
roleplay case checks navigation, tools/dialogs, inspector and composer. These are
emulator profiles, not physical-device qualification. Source2cases pass and
prior actualv1.19.14 fails the new containment assertion. Actualv1.19.15 passed
all45cases with both live cases/zero uncaught errors in6.2minutes. Final focused
visible-portrait rerun passed in8.2seconds. Evidence:
docs/evidence/mobile-portraits-20261106/.

## Environment

Latest verifiedv1.19.15 preview: http://127.0.0.1:8022, Podman container
st-mobile-portraits-release-20261106, five new synthetic volumes/no overlays.
45browser cases,24runtime-file matches, version/heartbeat/HTTPS and native
multiarch startup passed. Previousv1.19.14 full review/restart proof follows.

Verifiedv1.19.14 preview: http://127.0.0.1:8021, Podman container
st-full-review-release14-20261106. Five fresh synthetic named volumes, no source
overlays. All43browser cases passed in6.2minutes with both live Juiced cases,
zero skips and zero uncaught page errors. Per-case console/network diagnostics
retain deliberate failure/retry/guard events and45aborted requests; classified
in v14-browser-summary.json. Twenty-four runtime files match the tag; native
heartbeat/version/HTTPS passed. Standalone native Save/restart/reload persistence
passed after the suite, with no mock settings routes.

Source41controlled cases/2opt-in live skips passed in4.5minutes, plus the final
character identity case separately. Both live cases passed on the final actual
image.424unit tests, root lint and actionlint pass; test lint0errors/24warnings.
The new character case covers1280/768/390/320 normal/150%, vertical containment,
identity readability and native Advanced Definitions/Escape. Independent review
also inspected blank Create in all16Edit/Create states and retained28captures.
The broader review retains all16settings destinations, normal/Advanced modes,
long forms, menus/dialogs, loading/error/retry, pending navigation and classic.
Coverage/limits/failed attempts: docs/evidence/full-workspace-review-20261106/.

Earlier actual previews8016(v1.19.11),8017(baselinev1.19.11),8019(v1.19.12),
8020(v1.19.13) and source8018 remain preserved with their synthetic volumes.
v1.19.12/13 are immutable intermediate releases, superseded for this handoff.
Do not overlap standalone persistence checks with fixture runs that use the
shared synthetic service. Production69/shared test85 were never accessed.

## Shared-screen follow-up

The November2 follow-up suite had27 controlled browser cases plus2 opt-in live cases.
All 27 controlled cases passed on the actual v1.19.9 image after the user
reported remaining disappearance. The user then confirmed the affected page
is v1.19.8. Evidence: docs/evidence/shared-screen-lifecycle-20261102/.

The new `settings changes and late saves` case changes native controls in 11
categories at 1280/390/320px and switches through the active category rail.
It holds a settings save across navigation to Image generation. It verifies
the same native panel/control tree survives all 33 checkpoints. Existing
cases cover the character editor, all settings sections, dialogs, keyboard,
stories, profiles, archive, pending generation, reload and classic restoration.
Screenshots of all 12 settings categories at all three widths were inspected.
The original disappearing-panel case is also rerun on the local v1.19.8 image.

## First-reply template regression

The first-reply template regression is a separate opt-in live case:
`cd tests && ST_BASE_URL=http://127.0.0.1:8014 ST_JUICED_URL=https://juiced.swarm.nulteck.com npx playwright test workspace.e2e.js --workers=1 --grep 'first reply with post-history'`.
It reproduces Qwen3.5-2B's late-system Jinja error with native post-history
instructions, applies native `semi_tools`, reloads, reopens the same synthetic
story and retries. It checks the saved setting at 390px. Evidence lives in
docs/evidence/first-reply-formatting-20261102/. Discovery success alone does
not prove a model accepts every story prompt. Earlier 27-case acceptance did
not cover this message-order/model combination.

## Known gaps

No live paid-provider, physical microphone or audible speech-quality checks.
The synthetic microphone case tests browser recording, encoding and permission
failure. Real speech is decoded in the browser and transcribed by Juiced.
