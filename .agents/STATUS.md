# Status

## Project state

Fork: https://github.com/Nulifyer/SillyTavern. Published branch: release.
Release v1.19.8 is published and verified. `latest` points to its multiarch image.

## Current batch

The cohesive roleplay redesign and mobile picker correction are complete.

## In progress

Published source: 88e6ea7a242e8ea03c5404c35e2a2d2edc8f7248.
Published-image preview: 8008. Regression source: 8002.
Screen contracts and research: docs/roleplay-workspace.md.

## Next action

None. Requested work is complete.

## Blockers

None.

## Verification

Lint, 411 unit tests, and all 20 browser cases passed.
Every settings category fit desktop and phone with native controls preserved.
Phone flows passed at 320/390/768px, reduced height, and enlarged fonts.
Release run 37842068836 passed both native startup checks and publication.
Anonymous manifests, empty-auth Podman pull, HTTP, version, and heartbeat passed.
Served workspace modules and CSS matched source bytes. The published-image browser
confirmed the corrected 320px picker and native dropdown Escape behavior.
The v1.19.7 image verified voice opt-in, tools initially off, and one new transcript.
Exact digest and release evidence: docs/container-releases.md.
