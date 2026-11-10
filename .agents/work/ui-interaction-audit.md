# UI interaction audit

Status: complete; reopened follow-up verified and deployed as v1.19.25
Owner: Codex root; independent source/visual review and bounded implementation workers
Repository: /home/nulifyer/Projects/SillyTavern
Base: e4f5f726019a7e7f9ac1a936663d24d30d98e157
Project: ../PLAN.md
Request source: November 9 user asks to actually audit every view/action/control at different window sizes, specifically enlarged portraits behind the sidebar, including selected background images.

## Goal
Inspect the rendered application through its interactive states, fix observed UI defects, and leave explicit coverage and evidence rather than treating previous passing suites as an exhaustive audit.

## Prior v1.19.24 acceptance (bounded; reopened below)
- [x] Inventory workspace views, native settings destinations, overlays, and actions with explicit tested/unqualified coverage.
- [x] Reproduce and correct enlarged portrait overlap, keyboard dismissal, and containment with selected backgrounds.
- [x] Exercise desktop, tablet, phone, landscape/reduced height, and enlarged text with bright/dark backgrounds.
- [x] Inspect menus, dialogs, native editors, settings disclosures, dropdowns, story and cast lifecycle, and error/retry states.
- [x] Verify corrections with fresh browser renders and appropriate regression checks.

## Scope
In: Local synthetic app fixture, workspace/native UI integration, shared layering and responsive corrections, tests and audit evidence.
Out: Production app/data/volumes, deployment/release, paid provider credentials and physical device qualification.

## Current state

The reopened audit is complete. All 370 first-party frontend files and 2,037 static
candidates are reconciled at current hashes, with 266 expanded registrations kept
separate. Final actual-image UI 28, workspace 102/live, native 251 and lifecycle 10
pass with no failed/skipped/flaky/uncaught page errors.657 units pass. The actual
settings/provider inventories have664 states and 30,222 control observations,
zero unexpected enabled-control obstructions or horizontal panel overflow.

Production runs healthy v1.19.25, source `3a6e1cc6a4dc5299a870f9bdbfc36397b6208e3b`.
Volumes and deployment metadata remain unchanged; production app/data was never
inspected. Release/image/privacy scope and exact failed/qualified attempts are
owned by ui-followup-release.md and the linked final acceptance record:
../../docs/evidence/ui-followup-20261109/release-v25/acceptance.md.
Next action: none; preserve earlier v1.19.24 evidence as historical coverage.

## November 9 follow-up

The user screenshot shows an opaque composer ancestor over the selected image.
Remove that painted seam, keep fields and placeholder readable, and expose native
Continue without consuming an unsent draft. Geometry checks alone did not catch
this. Current evidence adds real composited-color assertions and settled screenshots.

- [x] Composer paint continuity across selected bright/dark images and window sizes.
- [x] Continue invokes native continuation and preserves a slash-command draft across reload.
- [x] Independent listener review found duplicate keyboard registration, tabindex loss and search navigation defects; focused checks pass.
- [x] Native ownership review found stale lore/gallery windows, repeated popup cleanup, DND listener leaks, failed Data Bank deletes and stale Quick Reply operations; targeted browser checks pass.
- [x] All source cases qualified across explicitly recorded attempts and corrected followups; no single clean combined source-run claim.
- [x] Final actual published image checks and production delivery complete.

The source inventory lists every shipped public JS/CSS/HTML file and static event
registration candidates. It does not assert that every implementation line or
listener has been manually reviewed or executed. Per-file review manifests and
actual browser cases record those narrower scopes separately. Current source
fixtures are 8056 (UI), 8057 (stream/native) and 8059 (workspace/live), with synthetic
roots under /tmp/st-ui-followup-20261109. Follow-up evidence belongs in
../../docs/evidence/ui-followup-20261109/. The original evidence below remains a
historical v1.19.24 record, not final proof for these uncommitted changes.

## Decisions
| Decision | Reason | Evidence |
| --- | --- | --- |
| Use synthetic local data only | Existing project privacy boundary | ../DECISIONS.md |
| Track explicit control/state coverage | User requests actual complete UI inspection | Current request |
| Include bright and dark backgrounds | User's explicit follow-up | Current request |

## Findings
| Finding | Evidence | Status |
| --- | --- | --- |
| Enlarged portrait opens at x=0, z=29 under 232px sidebar and chat | Shared browser reproduction, portrait-before/ | Fixed using native Popup; portrait-after 24 background/viewport states pass |
| Background menus let Escape close Settings; folders lack keyboard activation | Shared browser and background-actions/ | Corrected; full background/folder workflow passes at 1280/390/320px |
| Mobile folder grid shrinks tiles to about 42px and clips rename control | provider-background-run3/ screenshot and pointer interception | Minimum-width folder grid corrected; full folder lifecycle passes |
| Author Note depth label collapses to letters between controls | settings-inventory-run2/ authors-note-390x844.png | Wrapping correction and 4 enlarged text states pass |
| Empty expression cards overlap upload/delete actions with labels | Provider inventory 60 obscured desktop control observations | Reserve card height; final audit inventory has no expression action obstructions |
| Message editor Cancel clipped at 320px | audit-final/native screenshot and native test failure | Toolbar now wraps; 44px phone targets added |
| Chat actions menu opens above viewport in short landscape | native-run2, shared browser rect top=-382; transformed html has height 0 | Viewport-height root and shared native Popper containment corrected; workspace and classic short-window checks pass |
| Thumbnail zoom controls do not change fixed phone grid | Shared browser, workspace.css former fixed two-column rule | Native gallery width now limits columns and zoom buttons; full zoom and bulk folder checks passed |
| Selecting unavailable speech providers rejects without native status feedback | verified-final provider diagnostics: Edge unavailable module and fetch rejection | Native interactive/startup loading reports error, preserves picker, clears stale status on another selection; programmatic connection setup still rejects |
| Global background deletion ignores failed server response | backgrounds.js delBackground request handling | Preserve selection and gallery on failure; explicit failure/retry regression added |
| XTTS edits reject without feedback and Reload is a no-op | expanded-delta browser diagnostics; xtts.js | Edits retain local values, report server failure, and Reload retries readiness/settings; focused regression passes |
| Disconnected model-template binding refuses without explanation; async result is not awaited | dialog-toggle-delta checkbox audit and power-user.js | Explicit connection guidance and awaited binding result; checkbox audit passes |
| A reply starting around resume can override a restored history-reading position | final-workspace, foreground-trace/, foreground-stacks/, late-stream-before/ | Stream placeholder insertion/startup respect reader lock; stream-reader-verified 11/11 pass, including deterministic desktop/phone delayed-start cases |
| Gallery welcome toast covers its close button on a 320px phone | final-audit-restarted/native extension failure screenshot | Inline help; named button role and native keyboard owner. Three Enter runs and two final Enter/Space runs pass at four sizes |
| Native provider hint forces max-content width; Quick Replies action row cannot wrap | provider-overflow-before/ and overflow-diagnostic/*-overflow.json | Workspace hint sizing and Quick Replies wrapping corrected; provider-overflow-after passes 8 phone form states |

## Changes
| Path or artifact | Change | Verification |
| --- | --- | --- |
| public/script.js, public/css/workspace.css | Modal portrait, focus/keyboard, insertion row and folder/card layout | Focused portrait and enlarged text checks pass |
| public/scripts/backgrounds.js, public/scripts/keyboard.js, public/index.html | Native menu dismissal, folder/close keyboard, labels and duplicate close-chat ID removal | Full background workflow and final gallery keyboard checks pass |
| public/scripts/extensions/gallery/*, public/scripts/extensions/tts/* | Inline gallery help and truthful speech failure/retry status | Focused failure/retry and native dialog checks pass |
| tests/ui-audit.e2e.js, tests/workspace.e2e.js | Inventories, action regressions, event receipts, obstruction and horizontal-overflow assertions | 184 settings states/8852 observations; 480 provider states/21351 observations; zero unexpected obstructions or root horizontal overflow |

## Verification and coverage
Evidence root: docs/evidence/ui-interaction-audit-20261109/.
[Machine summary](../../docs/evidence/ui-interaction-audit-20261109/audit-summary.json) owns exact counts, coverage and limits.
Source manifest: source-sha256.json; all recorded runtime/test files match final bytes.
- 18 registered settings destinations, 160 provider/source choices, 8 sizes; portraits use 3 selected backgrounds across 24 combinations.
- 438 settings and 103 provider checkbox/radio actions; newly revealed fields receive the same layout assertions.
- Workspace broad run: 99/100 pass. Remaining assertion assumed a new writer profile despite an existing match. Corrected native-reuse/preservation assertion passes 3 repeats on that same fixture. All 100 distinct cases are covered after that correction; this is not a claim of a single 100/100 run.
- UI broad run: 12/13 pass. Remaining gallery Close role was corrected; its final desktop/phone/landscape pointer, Enter and Space case passes twice. All 13 distinct cases are covered after correction; this is not a claim of a single 13/13 run.
- Deterministic delayed-stream regression failed on desktop and phone before correction; 11 focused resume/stream/phone cases pass afterward.
- 501 unit tests in 27 suites, root lint, test lint and diff checks pass. Test lint retains 82 warnings/0 errors. Continuity has no structural errors and retains the existing TESTING.md length warning.
- Zero uncaught page errors in the acceptance runs. Console/network diagnostics, including rejected requests and 404s, are retained rather than called clean networks.
- Shared-browser follow-up includes 320px Quick Replies/World & lore, Account, and nested Settings Snapshots at 320×400. Tabs opened for this task are closed.

## Risks and unknowns
- The first final-audit attempt lost fixture 8050: its server exited with code 0, then all later page loads were refused. The cause is not established. The fixture was restarted; preserve the interrupted run separately from the restarted result.
- The first combined source run exposed a test-environment assumption: two real-stream cases used host.containers.internal, which does not resolve on this host. ST_PROVIDER_HOST makes the fixture address explicit without changing the container default.
- The disabled-TTS test overrides the general neutral settings route; its workspace preference is now explicit to avoid saved-layout dependence.
- Previous suites do not establish exhaustive interactive UI coverage. New evidence must distinguish actual action checks, geometry scans and screenshot review.
- Provider-specific external behavior and physical hardware need separate qualification.
- Two final-workspace cases timed out at the shared new-story visibility wait (5 seconds), before reaching their intended action. Focused rechecks pass; fixture readiness now has an explicit 20-second limit. Geometry and action outcome assertions are unchanged.
- Inventory initially scrolled hidden Select2 proxies, which could move the viewport and distort screenshots. It now leaves proxies alone, restores horizontal offsets, and asserts root panel scrollWidth <= clientWidth+1. Keep earlier scans as attempts; use accepted-audit-contained for final layout evidence.
- Qualification covers the current workspace and shipped native forms/flows, not every possible combination of user content, custom theme or third-party extension. External provider output, physical hardware, destructive account resets and real snapshot restores remain unqualified. See the summary for explicit action versus layout coverage.
