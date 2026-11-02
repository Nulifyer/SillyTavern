# Shared screen lifecycle follow-up

Status: complete
Owner: SillyTavern project thread mcp:a1b3f2ea-069d-4f17-8247-e0cab15abe73
Repository: /home/nulifyer/Projects/SillyTavern
Base: feat/cohesive-workspace at bfe2fe1ff
Project: ../PLAN.md
Request source: User, November 2, 2026, image settings still disappear after some settings change. User then requested all screens be checked as a core issue.

## Goal

Establish and repair the shared cause of disappearing settings, verify all screens
with realistic control changes, and publish a verified correction if application
code changes. Preserve the deployment boundary in the original request.

## Acceptance checks

- [x] Reproduce an exact trigger and retain its trace or identify the tested version boundary honestly.
- [x] Check all categories, direct switching, changed controls, dialogs, delayed saves/provider responses, keyboard, desktop and phone.
- [x] Verify the existing repair at its owner and run applicable lint/browser gates. No application code changed; unit tests were not rerun.
- [x] Verify the existing immutable image. No application changes or new publication were needed.
- [x] Update release handoff and project state without updating production69 or test85.

## Scope

In: Shared SillyTavern UI lifecycle, source, tests, synthetic local containers, release and continuity.
Out: Production app/data/config/chats/characters/settings, test85 changes, Juiced runtime/policy/cache changes, Homelab production deployment.

## Current state

Phase: Complete. User confirmed the affected page is v1.19.8.
Dependencies: Homelab owns the later deployment using docs/container-releases.md.
Integration: Actual v1.19.9 image passed all 27 controlled cases. v1.19.8 reproduced the shared failure. No application change or new image was needed.
Next action: Homelab deploys the immutable v1.19.9 index, preserving volumes and taking the normal private backup. This project thread does not deploy production.

## Decisions

| Decision | Reason | Evidence |
| --- | --- | --- |
| Check shared owners before changing individual extensions | User requested all screens; earlier local drawer correction is incomplete evidence for this report | Current user request |
| Do not assume publication means deployment | Original task forbids this thread updating production; test85 remains older | docs/container-releases.md |

## Findings

| Finding | Evidence | Status |
| --- | --- | --- |
| Initial local image source/model/sampler changes and automatic-tools checkbox did not hide v1.19.9 | T3 browser on 8014, root class/style trace | Observed; v1.19.8 failure confirmed below |
| Earlier category tests return through the overview between categories | tests/workspace.e2e.js | New case now covers direct rail switching and a delayed save |
| User's affected page is v1.19.8 | User's explicit version answer in this thread | Confirmed |
| v1.19.8 hides the mounted panel on Writing & replies > Presets | docs/evidence/shared-screen-lifecycle-20261102/v1.19.8-reproduction.log and hidden-panel PNG | Reproduced; class changes to closedDrawer |
| v1.19.9 passes all 27 controlled browser cases; 2 live cases skipped | docs/evidence/shared-screen-lifecycle-20261102/browser.log | Verified actual image without overlays |
| 33 changed-control checkpoints and a delayed-save/navigation race preserve mounted panels | settings-changes.json in the same evidence directory | Passed |

## Changes

| Path or artifact | Change | Verification |
| --- | --- | --- |
| tests/workspace.e2e.js | Direct rail switching with changed native controls and delayed save | Passed on v1.19.9 at 1280/390/320px |
| docs/evidence/shared-screen-lifecycle-20261102/ | Logs, all-category contact sheets, image settings screenshots, old-version failure and image identity | Inspected |

## Risks and unknowns

- The user named v1.19.8. The exact image control from their report remains unknown; the shared drawer failure is independently reproduced on that version.
- v1.19.9 passes establish the exercised paths. A remaining failure after its deployment needs its own reproduction; do not dismiss it using these passes.
- No production deployment occurred. The original release's real-service evidence remains valid for the unchanged application source; the follow-up used controlled fixtures.
