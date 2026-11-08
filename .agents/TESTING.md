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

Earlier v1.19.7/8 verification and immutable digests are recorded in
[container releases](../docs/container-releases.md). The current suite retains
those story lifecycle, voice opt-in, tools-off, streamed node identity, native
menu/dropdown, settings, phone/enlarged-text and classic-layout regressions.

## Message portrait follow-up

Use `--grep 'message portraits|within a 448px'` for the focused regression.
It checks image containment and text/name separation, including Android/mobile/
touch at DPR3 in18viewport/font states. Pixel9ProXL uses Chromium448×997 screen,
448×921 browser height, reduced448×400 height, and997×448/945×396 landscape.
Native font scales1/1.5 are covered, plus320/390/768/1280 widths. The448px
roleplay case checks navigation, tools/dialogs, inspector and composer. These are
emulator profiles, not physical-device qualification. Source2cases pass and
prior actualv1.19.14 fails the new containment assertion. Actualv1.19.15 passed
all45cases with both live cases/zero uncaught errors in 6.2 minutes. Final focused
visible-portrait rerun passed in8.2seconds. Evidence:
docs/evidence/mobile-portraits-20261106/.

## Environment

Latest verified v1.19.21: http://127.0.0.1:8033,
st-fork-fixes-release-20261108, five fresh volumes/no overlays. All 86 browser
cases passed together in 10.6 minutes, both live Juiced cases, no
skipped/flaky results or uncaught errors. 37 runtime matches/version/heartbeat/
HTTPS and both architecture labels pass. 478 unit tests in 24 suites, root lint
and actionlint pass; test lint has 0 errors and 51 warnings. Evidence and limits:
`docs/evidence/audit-fixes-20261108/`. Source 8032 uses overlays, not image proof.
Run the full suite with ST_BASE_URL=http://127.0.0.1:8033 and ST_JUICED_URL set.
Use `--grep 'audited'` for failed character/group/reload reads, exact-history and
Close races, rename/reload, stale status, recorder, writer Stop, late upload and
missing-integrity save guards. Strict JSONL/I/O and native owner units are in
chat-loading, chat-load-ownership, chat-integrity, workspace-state-ownership and
image-operation-ownership tests. Earlier fixtures/evidence remain preserved.
Do not overlap persistence checks with fixture runs. Never use production data.

## Shared-screen follow-up

November2 actualv1.19.9 passed27controlled cases after reproducing the disappearing
settings on unmodifiedv1.19.8. The11category save/navigation checks retain native
nodes at1280/390/320px. Evidence and prior matrix:
`docs/evidence/shared-screen-lifecycle-20261102/`.

## First-reply template regression

The first-reply template regression is a separate opt-in live case:
`cd tests && ST_BASE_URL=http://127.0.0.1:8014 ST_JUICED_URL=https://juiced.swarm.nulteck.com npx playwright test workspace.e2e.js --workers=1 --grep 'first reply with post-history'`.
It reproduces Qwen3.5-2B's late-system Jinja error with native post-history
instructions, applies native `semi_tools`, reloads, reopens the same synthetic
story and retries. It checks the saved setting at 390px. Evidence lives in
docs/evidence/first-reply-formatting-20261102/. Discovery success alone does
not prove a model accepts every story prompt. Earlier 27-case acceptance did
not cover this message-order/model combination.

Late activation: `--grep 'late extension activation'` holds the actual SD
template beyond APP_READY. Images recover without navigation; switching away
keeps native/model node identity, focus and unapplied choice. Repeated native
readiness signals do not duplicate sections or collapse opened details.

## Known gaps

Menu dismissal: run `--grep 'transient menus dismiss|search opens character profiles and a fixture'`.
Desktop and Pixel9ProXL touch cases cover outside click/tap, inside interaction,
one open menu, scrim, Tab exit, layered/rapid Escape, SD keyboard activation,
synthetic click rejection, native settings node identity and classic touch closure.
The held reply checks menu dismissal before native Stop at1280/448px.
Evidence and exact failed attempts: docs/evidence/menu-dismissal-20261106/.

No live paid-provider, physical microphone or audible speech-quality checks.
The synthetic microphone case tests browser recording, encoding and permission
failure. Real speech is decoded in the browser and transcribed by Juiced.

## Mobile lifecycle follow-up

The recovery cases assert actual document hidden/freeze before resuming. Playwright
normally forces every page visible. The test-only freezePage helper disables that
focus override on Playwright's original CDP session, opens another tab and asserts
the browser events. It restores the original page and emulation after resume.
This uses Playwright's in-process test seam; if its internals change, fail rather
than silently replacing real suspension with a synthetic event.

Run the full workspace suite with ST_JUICED_URL set for both live cases. Recovery
coverage includes healthy paused chat/image/transcription requests; reset and early
EOF with partial text in native character bubbles; native save failure without a
reply-recovery workflow; old local records unchanged and without UI; cast queue/Stop and quiet rejection; per-character/story draft
isolation/rename and opt-out; blocked storage/old global draft isolation; coalesced status,
CSRF, stale provider rejection, dropdown preservation, timeout/retry; two pending
microphone permissions; mobile/reduced keyboard height and enlarged text.
Physical phone lock remains unqualified. Actual-image acceptance requires five
fresh synthetic volumes and no source overlays. Never test production data here.

## Foreground chat layout correction

The user clarified that recovery means restoring the existing UI after returning
to a tab. Reply backup/panel tests are superseded by native bubble/draft isolation
and old-record preservation checks. The added desktop/Pixel cases freeze an actual
hidden tab, complete one long reply, reduce height to400px and hold the heartbeat.
They check final-line visibility or history position, composer/chat bounds,
message node identity, draft selection and exactly one generation request.

Use `--grep 'Foreground chat layout|old reply checkpoints'`. Actual v1.19.19 fails
both history-position cases and the old-record popup case; both final-line cases
already pass there. Actual v1.19.20 passed all 72cases together; focused source 7 cases also passed.
Android UA/DPR 3 is explicit. Evidence:
`docs/evidence/chat-resume-20261107/`. Source fixture 8029 uses overlays and is not
release-image proof. Physical phone/GPU restoration remains unqualified.

## Council Scene details candidate

Candidate v1.19.22 source passed all 93 workspace browser cases in 669.43 seconds,
both opt-in live Juiced cases, with no skips, flaky outcomes or uncaught page
errors. The native suite passes 487 tests in 26 suites. Root lint/actionlint pass;
test lint reports 0 errors and 53 warnings. Exact diagnostics: 53 console errors
and 91 failed requests (87 aborts, 3 deliberate ERR_FAILED, 1 controlled incomplete
chunk). These are retained, not described as an error-free console/network.

The first broad attempt had 88 passes and 3 cast failures. Native cast controls
were restored and an affected seven-case run passed. The late native footer
paint/compact-copy correction passed a separate phone/enlarged-text case; the
actual published image must run the entire suite on the final bytes.

New coverage includes native summary anchor/save failure/retry, single-tree
summary/Author’s Note/classic restoration, override Apply/Cancel/Escape/failure
rollback/obsolete owner, immutable streaming and nonstreaming client captures,
Continue/in-progress inspection, rename/edit invalidation, PRE identity/focus/
selection/scroll, frozen details, 320/390/448/768/1024/1280 widths, and selected-
alternative cast registration failure/retry without phantom membership. Evidence:
`docs/evidence/council-overhaul-20261108/source-final/`. Separate council fixtures
8036/8037/8038 contain neutral data and source overlays; none is image proof.
