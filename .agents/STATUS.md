# Status

## Project state

Fork: https://github.com/Nulifyer/SillyTavern. Published branch: release.
Release v1.19.6 is published and verified. `latest` points to its multiarch image.

## Current batch

None. The composer fix and UI-system pass are complete.

## In progress

Published source: 78e7ac9aff0d002848c302c413a49d101170a577.
Published-image preview: 8006. Regression source: 8002.
UI sizing rules and research sources: docs/workspace-ui-system.md.

## Next action

None. Requested work is complete.

## Blockers

None.

## Verification

Lint and 17 browser tests passed, with final phone target checks at 320/390/768px.
Native 150% font preference and a 20px browser default passed together.
Desktop library/profile/settings and phone profile/composer screenshots were inspected.
Release run 37735911482 passed both native startup checks and publication.
Anonymous manifests, empty-auth Podman pull, HTTP, version, and heartbeat passed.
Served CSS matched the source byte for byte. The published-image browser confirmed
matching icon sizes, creative tools off, and one transcript for a new story.
Digest and release evidence: docs/container-releases.md.
