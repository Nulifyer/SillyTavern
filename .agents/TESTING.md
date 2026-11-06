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

## Environment

Pendingv1.19.14 source passes41controlled cases/2opt-in live skips in4.5minutes;
separate final character-identity focused case passes all8width/scale states.
424units, root lint and actionlint pass. Test lint has0errors/24warnings.
Actualv1.19.13 passed42cases with both real cases/zero uncaught page errors,
but subsequent pixel review found native character toolbar overlap. New43rd
case fails on that image and passes the natural-height correction. Actual
immutablev1.19.14 all43-case acceptance and standalone persistence remain pending.

Pendingv1.19.13 final source:41 browser cases passed in the full run, including
both live Juiced cases. One inherited search-fixture count assertion failed;
the corrected exact-name case passed separately. All42 full-run diagnostics
have zero uncaught page errors. Single streamed/nonstreamed and two-member
cast Stop, pending keyboard ownership and native vision modes are covered.
424 units, root lint and actionlint pass; test lint has0errors/24warnings.
Actual immutable image full42-case acceptance remains pending. See
full-workspace-review-20261106/source-checks-v13.json and review.md.

The full November6 source review for pendingv1.19.12 passes38 browser cases
with both real Juiced cases enabled,424 unit tests, lint and actionlint.
The final run is source-browser-release.log;38 diagnostics have zero uncaught
page errors. Independent baseline/follow-up/final review retains175 captures,
including all16 destinations, normal/Advanced,320/390/768/1280px,150% text and
short editors. A new regression checks every category at320/390/150%, native
selector readability, Done hit-testing and prompt action sizes. Direct character
and group start, double-click protection, native Escape, keyboard upload,
history retry, native provider changes and enlarged chat-tools bounds are covered.
Actualv1.19.12 image verification is pending. Evidence:
docs/evidence/full-workspace-review-20261106/.

Verified v1.19.11 preview: http://127.0.0.1:8016, Podman container
st-advanced-release-20261106, five fresh synthetic named volumes, no overlays.
All34 browser cases passed with both live cases enabled against source and this
actual pulled image. Advanced controls has an additional expanded source pass
at1280/390/320px and a real-settings-API/container-restart persistence check.
Run standalone persistence checks after the shared synthetic suite completes.
Exact logs, diagnostics and images: docs/evidence/advanced-controls-20261106/.
Prior containers and their synthetic volumes remain preserved.

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
