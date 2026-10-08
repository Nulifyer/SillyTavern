# Status

## Project state

Fork: https://github.com/Nulifyer/SillyTavern. Published branch: release.
Release v1.19.4 is published. `latest` points to its multi-architecture image.

## Current batch

Normalize native composer sizing after the user's screenshot showed an oversized wand.

## In progress

Workspace CSS now scopes native composer size tokens: 16px icons, 32px desktop
controls, and 44px phone controls. Browser regressions check multiline growth and
native generation stop visibility. Desktop and phone rendering passed verification.

## Next action

Publish v1.19.5 and verify the resulting public image and latest alias.

## Blockers

None.

## Verification

Computed styles on v1.19.4 confirmed 28.5px wand and stop icons beside a 17px menu
and 14px text. The current source preview is on 8002; published v1.19.4 is on 8004.

Lint, 411 unit tests, and 16 browser tests passed. Native generation stop visibility,
multiline growth, and 320/390/768px control dimensions passed. Desktop and 390px
screenshots were inspected in the shared preview.
