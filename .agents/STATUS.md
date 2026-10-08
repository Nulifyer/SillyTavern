# Status

## Project state

Roleplay UI and archive suffix fix verified. v1.19.1 published successfully.
v1.19.2 build cancelled after QEMU crashed; its tag remains unchanged.

## Current batch

Publish v1.19.3 using native architecture runners.

## In progress

Workflow builds and starts amd64/arm64 images separately, then merges the index.
Actionlint and diff checks passed. Cancelled log retained in /tmp/sillytavern-v1.19.2-cancelled-build.log.

## Next action

Commit the workflow, publish v1.19.3, and verify both native startup checks.

## Blockers

None.

## Verification

Lint, 411 units, 14 browsers passed. Mobile widths: 320, 390, 768.
Desktop/phone and Podman checks passed for the redesign.
