# Model service workspace and chat surface

Status: active
Owner: SillyTavern project thread mcp:a1b3f2ea-069d-4f17-8247-e0cab15abe73
Repository: /home/nulifyer/Projects/SillyTavern
Base: feat/cohesive-workspace at ee7928fc2
Project: ../PLAN.md
Request source: User, November 2, 2026, reduce redundant UI, organize settings by model service with editable prompts, reuse polished T3 Code chat/composer UI, and discover context/capabilities automatically while keeping common overrides.

## Goal

Provide one server discovery area and task-focused service settings with relevant
model, prompt and common tuning controls together. Adapt T3 Code's composer
structure to native SillyTavern controls. Prefer reported model capabilities to
manual entry; preserve existing explicit settings and provider ownership.

## Acceptance checks

- [x] Separate server discovery from service configuration; remove the repeated settings overview and visible duplicate connection forms.
- [x] Story, image writer, image generation, narration, dictation and vision have clear service destinations and their relevant prompts/settings.
- [x] Reported context is available automatically for new connections; existing explicit limits survive migration and common overrides remain accessible.
- [x] Adapt T3 composer/editor/footer/primary-action layout with source and license attribution, retaining native draft, send, stop, transcript, scroll and extension owners.
- [x] Verify desktop/phone, keyboard, pending requests, repeated navigation, reload, native controls and real Juiced requests with synthetic data.
- [ ] Run required checks, publish and verify the actual immutable container, update handoff without accessing or changing production69/test85.

## Scope

In: SillyTavern service settings presentation, discovery metadata, native setting integration, chat surface, tests, docs and release.
Out: Coding-agent features, framework migration, duplicate provider registry/inference proxy, production app/data, Homelab deployment, Juiced runtime/policy/cache changes.

## Current state

Phase: Source acceptance passed; publication and actual-image acceptance pending.
Dependencies: Local Podman test containers, Juiced HTTPS metadata/inference, T3 browser, GitHub release access.
Integration: v1.19.9 remains published. Root checkout clean before this task.
Next action: Finish controlled and live browser coverage for service prompts, context migration/overrides, composer and classic restoration; then publish and verify the immutable image.

## Decisions

| Decision | Reason | Evidence |
| --- | --- | --- |
| Keep native settings and generation owners | Existing compatibility and migration contract | ../DECISIONS.md |
| Adapt T3 ComposerSurface structure in plain DOM/CSS | T3 uses React/Tiptap; this fork's native draft/editor behavior must survive | T3 source 6f41364805e31a1f8d59c18c7cc451630cd9265d |
| Prefer reported configured context over training maximum | Server reports both; training maximum need not equal runtime capacity | Juiced /v1/models metadata |
| Preserve old explicit context limits on migration | User requested optional overrides; earlier task requires settings preservation | Current and original user request |

## Findings

| Finding | Evidence | Status |
| --- | --- | --- |
| Discovery currently drops context_length/max_context_window | src/endpoints/openai.js custom discover mapping | Safe capability fields preserved |
| Juiced reports Qwen2B context16384 and Skyfall context32768 | /tmp/st-juiced-chat-metadata.json, read-only HTTPS | Observed, no runtime changes |
| T3 Code permits reuse under MIT with notice retention | Public LICENSE and pinned local reference | Attribution required for adapted portions |

## Changes

| Path or artifact | Change | Verification |
| --- | --- | --- |
| public/scripts/service-connections.js, workspace-settings.js | One server hub, native service sections, actual prompt editors | All16 destinations fit1280/390/320; remaining regression in progress |
| src/endpoints/openai.js, public/scripts/openai.js | Sanitized metadata; automatic configured context and manual override/migration | Focused13 unit tests passed; browser cases in progress |
| public/scripts/composer-surface.js, CSS | Adapted T3 shell using original form/editor/actions; license notice | Manual desktop/390px inspected; full browser pending |

## Risks and unknowns

- Server capability metadata can be absent or stale; show that explicitly and retain manual/native controls.
- Preserve one mounted native control tree and classic restoration, including the prompt manager and composer action controls.
- Audio/embedding services do not all accept chat-style prompts; show only real native controls rather than inventing prompts.
