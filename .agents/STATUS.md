# Status

## Project state

Fork: https://github.com/Nulifyer/SillyTavern. Published branch: release.
Release v1.19.7 is published and verified. `latest` points to its multiarch image.

## Current batch

The cohesive roleplay screen redesign is complete.

## In progress

Published source: 12e97ded6c020177fee4a51fee75e13242ffe63c.
Published-image preview: 8007. Regression source: 8002.
Screen contracts and research: docs/roleplay-workspace.md.

## Next action

None. Requested work is complete.

## Blockers

None.

## Verification

Lint, 411 unit tests, and all 20 browser cases passed.
Every settings category fit desktop and phone with native controls preserved.
Phone flows passed at 320/390/768px, reduced height, and enlarged fonts.
Release run 37839974023 passed both native startup checks and publication.
Anonymous manifests, empty-auth Podman pull, HTTP, version, and heartbeat passed.
Served workspace modules and CSS matched source bytes. The published-image browser
confirmed desktop/phone layout, voice opt-in, tools initially off, and one new transcript.
Exact digest and release evidence: docs/container-releases.md.
