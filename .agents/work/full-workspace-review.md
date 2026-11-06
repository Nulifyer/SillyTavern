# Full workspace UI/UX and integration review

Status: active
Owner: SillyTavern project thread mcp:a1b3f2ea-069d-4f17-8247-e0cab15abe73
Repository: /home/nulifyer/Projects/SillyTavern
Base: feat/cohesive-workspace at e5deb86f2, published v1.19.11 source78bca3473f897ddf8f8552179296b37155af833f
Project: ../PLAN.md
Request source: User, November6, full every-screen/button visual and workflow review, responsive UI, remove mandatory new-story title step, coherent upstream overhaul with native advanced capabilities and better model integration. Explicit frontend-design skill and independent critique authorized.

## Goal

Walk the whole app as a person uses it, inspect rendered screens and action
states at desktop/tablet/phone widths, repair supported defects and friction,
and verify the resulting release. Simplify entry and recovery while retaining
native provider, prompt, sampling, extension and classic-layout controls.

## Acceptance checks

- [x] Maintain a screen/action/state inventory with manual visual evidence, behavior checks and explicit unavailable external-provider/hardware paths.
- [x] Walk first use, character/profile/story/archive/cast/chat, every settings category and advanced section, menus/editors/dialogs and classic restoration.
- [x] Inspect desktop, tablet and320/390px, enlarged text, keyboard/touch targets, long/empty content, loading/error/retry and pending navigation.
- [x] Start a character/group story immediately without a title modal; preserve existing transcripts and offer Rename afterward.
- [x] Recheck model-service workflows and shared lifecycle/configuration ownership with real Juiced calls from local synthetic containers; no duplicated registry/proxy.
- [x] Obtain an independent design critique and resolve supported findings using fresh renders.
- [ ] Run required checks, publish a new immutable version, visually/behaviorally verify its actual image without overlays, and update the Homelab handoff.

## Scope

In: Workspace UI/UX, native advanced entry points, model integrations, test fixtures, evidence/continuity, source and release.
Out: Production69, production app/data/config/volumes, shared test85, shared infrastructure/HA, GPU managers, Juiced runtime/model/cache policy changes, third-party paid credentials.

## Current state

Phase: Fresh visual critique and final source acceptance; pendingv1.19.12.
Dependencies: Local Podman, T3 browser, synthetic fixtures, existing Juiced HTTPS, GitHub release access.
Integration: v1.19.11 remains published. Root clean at task start. Older local synthetic containers/data are preserved.
Next action: Commit verified source, publish immutablev1.19.12 through the normal release workflow, pull/run its actual image, repeat38cases and manual workflows, and record the Homelab handoff. Sourcefrozen38passed in5.1minutes with bothlivecases;424units/lint/actionlint pass. The independent critic has no remaining supported objection in reviewed states and closed its tab. Its22final captures are retained. Never deployproduction69.

Targets: baselinehttp://127.0.0.1:8017 st-full-review-baseline-20261106 (actualv1.19.11,nooverlays); sourcehttp://127.0.0.1:8018 st-full-review-source-20261106 (ownfreshvolumes,readonlypublic/src). Parentbrowser tabs3baseline,5source; reviewerowns4source. Do not close a user-owned tab. Preserve older local synthetic targets.

Evidence: docs/evidence/full-workspace-review-20261106/review.md, baseline-settings-index.json(101captures), followup-settings-index.json(52captures), baselinecorecaptures, source-browser-final.log, unit-final.log, lint-final.log, actionlint.log. Source tests output /tmp/st-full-review-source-final (copy durable evidence when complete). Initial focused2failures were test assumptions; initial fullsource34pass/3fail reflected inherited150%font fixture. Reset fixturefont to1, retain explicit150%test. New enlargedall16case found supported layout failures; fixes and narrowing-preset/target assertions recorded. Do not count prior failed passes as final acceptance.

## Decisions

| Decision | Reason | Evidence |
| --- | --- | --- |
| Use frontend-design's five user questions per workflow | User explicitly requested the skill and a cohesive overhaul | User November6 request and skill |
| Keep native owners and Advanced controls | Simplification must preserve advanced options | ../DECISIONS.md |
| Independent read-only critique | User authorized a subagent to challenge choices | Agent ux_critique |

## Findings

| Finding | Evidence | Status |
| --- | --- | --- |
| startStory requires a title-input modal even when an automatic title is allowed | baselineTitleSnapshot.png and workspace.js | Reproduced; fixed, direct character/group creation regression passes |
| History errors hidden on profiles; cached Stories replaced on failure | baselineHistoryFailure.png, workspace-views.js | Shared state presentation and retry; regression passes |
| Native Advanced Definitions Escape closes Settings underneath | baseline/follow-up reviewer captures, RossAscends-mods.js/workspace.js | Shared keyboard ownership fixed and manually/automatically verified |
| Dictation file action lacks keyboard target; overrides escape native collapse | Baseline/follow-up captures and dictation.js/service-connections.js | Keyboard button and content owner fixed; Enter chooser and collapse verified |
| Phone categories, late provider setup, tiny creation/profile/preset targets and several enlarged rows | review.md and indexed captures | Shared responsive corrections under final recheck |
| Applied service state can look saved after model/voice selection changes or native provider changes | service-connections.js and new browser case | Derived native selections/pending feedback; context only applies to active discovered server |
| Prior release has34 browser passes, but that is not a complete manual visual audit | Previous task evidence and user correction | New coverage required |

## Changes

| Path or artifact | Change | Verification |
| --- | --- | --- |
| public/scripts/workspace*.js/css, service-connections.js, dictation.js, RossAscends-mods.js, index.html | Coherent flow/state/responsive corrections, native owners retained | Fresh critique and browser/unit/lint checks |
| tests/workspace.e2e.js |38cases; direct start/rename, history retry, native Escape/upload/collapse, derived service state, all16@320/390/150% | Final source run ongoing |
| package.json/package-lock.json | Prepare1.19.12, no tag moved | Publication pending |

## Risks and unknowns

- Native provider/extension combinations require honest coverage boundaries; never fabricate keys or claim unperformed hardware/provider checks.
- Preserve old and concurrent work. Fresh review volumes must not replace previous synthetic test work.
- Visual screenshots do not prove keyboard operation or end-to-end behavior; record those checks separately.
