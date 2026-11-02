# Status

## Project state

Fork: https://github.com/Nulifyer/SillyTavern. Published branch: release.
Published v1.19.8 source: 88e6ea7a242e8ea03c5404c35e2a2d2edc8f7248.
The November 2 UI repair and Juiced setup release is in progress.

## Active tasks

- [UI repair and Juiced release](work/ui-juiced-release.md), owned by the SillyTavern project thread. Owns source, tests, publication and release-image acceptance.

## Next action

Finish the independent dictation-category regression, commit v1.19.9, then publish and verify the pulled release image.

## Blockers

None. Production stack69 and all its data remain outside scope. Homelab owns the later production update.

## Verification

Reproduced disappearing Settings controls on unmodified v1.19.8 in a fresh local container. The shared outside-click handler closed mounted panels after section clicks. The new regression fails before the repair and passes at 1280/390/320px after it. All 25 controlled browser cases pass, with the live case run separately. Final category ownership checks remain in progress after separating dictation from the optional TTS extension. Lint and all 423 unit tests pass.

Real Juiced discovery from the local container returned enabled chat/image/speech/transcription models and 67 backend voices. Real streaming chat, separate writer/image, speech and transcription pass. Final released-image acceptance remains outstanding. Evidence: docs/evidence/ui-juiced-20261102/.

The accepted uncommitted input retains the optional Connection Manager image writer, editable instructions and output budget. Current-chat generation remains the default. The stock sd.cpp image backend is unchanged. Historical stack85 used a persistent writer overlay; it is not release-image evidence. This task uses only fresh local volumes.
