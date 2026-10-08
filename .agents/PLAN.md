# Plan

## Goal

Deliver a cohesive dark character roleplay workspace in Nulifyer's SillyTavern fork,
with homelab images published from GitHub Releases.

## Success conditions

- Character selection includes a profile and explicit continue/new-story choices.
- Users can manage exact transcripts, archive, restore, rename, and confirm deletion.
- Single-character and group stories have clear identity and usable entry paths.
- Image generation and TTS use existing capabilities with nearby configuration.
- Desktop and phone flows pass browser checks.
- Published GitHub Releases build their tagged commits for amd64 and arm64 in GHCR.

## Scope

Character library, profiles, scene history, lifecycle actions, cast creation,
conversation presentation, image and voice entry points, settings navigation,
responsive behavior, and container delivery.

## Product boundaries

Preserve existing settings, extension insertion points, stored data, and native
generation. Do not reproduce T3 Code's coding-specific buttons.
The user approved a dark chat workspace and release-only container publishing.

## Architecture boundaries

Native modules remain the owners of characters, groups, chat actions, providers,
image generation, and TTS. Workspace modules own presentation and archive indexing.

## Phases

1. Fork, inspect, and implement the initial dark shell.
2. Configure and verify release container publishing.
3. Implement roleplay stories and responsive views from docs/roleplay-workspace.md.
4. Verify, deliver, publish a new release, and inspect the published image.

## Open planning questions

None. Anonymous GHCR pulls were verified for v1.19.0.
