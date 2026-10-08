# Status

## Project state

Fork: https://github.com/Nulifyer/SillyTavern. Published branch: release.
Release v1.19.3 is published. The follow-up fixes are verified and ready for v1.19.4.

## Current batch

Create one story per action, tighten control sizing, make creative tools opt-in,
and guard upstream bot jobs that fail without their GitHub App credentials.

## In progress

Application changes are ready to commit. CI guards are pushed at 6ccf6fca8.
Regression source preview is on port 8002.
Published source remains 1061f87fbd0a98114e90eac49071c534f91914c2 on port 8003.

## Next action

Commit the verified application fixes and publish v1.19.4, then verify its image.

## Blockers

None.

## Verification

Lint, 411 units, and 16 browser tests passed. Widths: 320/390/768.
Workflow syntax passed. New bot runs skipped cleanly after the CI guard push.
Desktop and 390px Settings were inspected; extension headers have no gradients.
