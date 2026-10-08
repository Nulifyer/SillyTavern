# Status

## Project state

v1.19.1 published automatically in run 37716598748. amd64/arm64 manifests,
anonymous pull access, and CI HTTP/heartbeat passed.

## Current batch

Publish v1.19.2 with exact archive identifiers for titles ending in .jsonl.

## In progress

Suffix regression reproduced lost archive state; normalization fixed at the API
boundary. Lint and 14 browser checks passed. Documentation edits are task-owned.

## Next action

Commit the verified patch, publish v1.19.2, and inspect its image digest.

## Blockers

None.

## Verification

v1.19.1: lint, 411 units, 14 browsers, Podman checks, and visual inspection passed.
Responsive widths: 320, 390, 768.
