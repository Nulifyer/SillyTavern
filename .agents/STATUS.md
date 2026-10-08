# Status

## Project state

Fork: https://github.com/Nulifyer/SillyTavern. Published branch: release.
Release v1.19.4 is published and verified. `latest` points to its multi-architecture image.

## Current batch

None. The follow-up fixes and release are complete.

## In progress

Published source: 2221fd52600fd69d41994dafe56da9ca82de444d.
The actual published-image preview runs on port 8004. Regression source is on 8002.

## Next action

None. Requested work is complete.

## Blockers

None.

## Verification

Lint, 411 units, and 16 browser tests passed. Widths: 320/390/768.
Workflow syntax passed. New bot runs skipped cleanly after the CI guard push.
Desktop and 390px Settings were inspected; extension headers have no gradients.
Release run 37721950185 passed both native startup checks and publication.
Anonymous manifests, empty-auth Podman pull, local HTTP, version, and heartbeat passed.
The image digest is in docs/container-releases.md.
