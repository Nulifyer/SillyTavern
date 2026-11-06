# Status

## Project state

Latest verified release is v1.19.15, source f7dcc34e95690561d607ae779a0c218cea5944e4.
Image index: `sha256:28c8a422df7b9ad588a9308c74ea73bacd3744919bd50b19056e18be981b92a7`.
Published branch: release. Production69 and shared85 remain untouched.

## Active tasks

Mobile tab suspension/reconnection [follow-up](work/mobile-resume.md). Native draft ownership now checkpoints
per user/character or cast/story; native streaming owners retain partial text and
clean up interrupted requests. Foreground checks must preserve explicit provider
settings and never replay inference. Dictation cancels a hidden microphone session.
All edits remain uncommitted pending full source acceptance. Focused transport-loss proof passed.

## Next action

Commit/publish v1.19.16 through a GitHub Release, await native multiarch workflow,
then run the full63-case suite on the pulled image with five fresh volumes and
no overlays. Source runtime files are frozen. Never deploy production here.

## Verification

425units/root lint/actionlint pass. Test lint has0errors/28warnings. Source full
run61/63 passed, zero uncaught errors. The legacy fixture now seeds its key before
reload; navigation budget is30s with all readiness assertions retained. Final4
focused cases passed after those test corrections and keyboard activation repair.
Earlier12 repeated owner checks passed, including both multi-choice EOF outcomes,
foreground retry/dry-run/APP_READY retention and the prior navigation timeout.
Both real Juiced cases passed in the full source run. Published-image acceptance
is required before final handoff. Evidence: docs/evidence/mobile-resume-20261106/.

## Blockers

None external. Publication and full actual-image acceptance remain open.

## Limits

CDP freeze/active and controlled HTTP failures are browser simulations, not physical
phone lock qualification. Actual OS tab discard cannot reattach the original HTTP
inference; recovery must preserve local text and require explicit user action.
No Juiced runtime, policy or cache changes. No production data access.
