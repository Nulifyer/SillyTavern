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

Current verified release preview: http://127.0.0.1:8014, Podman container
st-ui-release-20261102 with five fresh synthetic named volumes and no overlays.
Baseline 8012 and source 8013 containers are stopped. Browser settings writes are
isolated; cleanup uses native owners and only the run-specific synthetic prefix.
All 27 browser cases passed against source and the actual v1.19.9 image.
Historical regression data at /tmp/sillytavern-workspace-e2e-data and port 8002
is not the current acceptance environment.

## Shared-screen follow-up

The current controlled suite has 27 browser cases plus 2 opt-in live cases.
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
