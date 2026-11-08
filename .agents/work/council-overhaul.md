# Council-selected roleplay overhaul

Status: active
Owner: root
Repository: /home/nulifyer/Projects/SillyTavern
Base: feat/cohesive-workspace, 40a0a114cf82d1fff86699d1e4dc10f6fbc3db7f; runtime v1.19.21
Project: [Roleplay workspace](../../docs/roleplay-workspace.md)
Request source: User asks for a three-agent council to decide what belongs in the project, parent implementation, then review by the same council until they are satisfied with the project.

## Goal

Deliver the council's agreed, cohesive product scope while retaining native
SillyTavern power, then obtain evidence-based verdicts from the same three members.

## Acceptance checks
- [x] Three named council members discuss the research and source and agree on scope, exclusions, ownership and observable criteria.
- [x] Parent implements the agreed scope without replacing native owners or removing advanced capabilities.
- [x] Meaningful source unit/lint/browser and real service checks cover changes and preserved workflows; final image acceptance remains part of delivery.
- [ ] The same three members review the finished implementation and evidence, with objections resolved or explicitly retained.
- [ ] Release and continuity records match the verified result and normal project delivery process.

## Scope
In: council decisions, parent implementation, synthetic local tests, council review and verified project delivery.
Out: production app/data/screens/logs/volumes, a production redeploy, shared test85, model/runtime/policy/cache changes and unrelated work.

## Current state
Phase: parent implementation present; same council source/render review and acceptance fixes active
Dependencies: completed 20-product research and current source
Integration: parent is the only runtime/test implementer; council members own separate decision/review notes.
Next action: complete final combined source acceptance, resolve remaining same-council findings, publish and verify the actual immutable image without production deployment.

## Decisions
| Decision | Reason | Evidence |
| --- | --- | --- |
| Keep the same three member identities through decision and final review | Explicit user request | Current request |
| Keep production unchanged for this overhaul | Latest deployment authorization was for the previous version refresh | Scope |
| Use native operation owners and fresh synthetic fixtures | Preserve control and protect data | AGENTS.md and project decisions |

## Findings
| Finding | Evidence | Status |
| --- | --- | --- |
| The research and native source identify both existing capabilities and presentation/integration gaps | docs/roleplay-product-comparison.md | Input, not predetermined council scope |

## Changes
| Path or artifact | Change | Verification |
| --- | --- | --- |
| docs/evidence/council-overhaul-20261108/ | Council briefs, decisions, review and acceptance evidence | Pending |

## Risks and unknowns
- The council must inspect the actual native owners before selecting scope.
- Public competitor evidence is not a usability benchmark or a mandate to copy features.
- Physical Pixel lock/GPU restoration remains unqualified without a physical device.
- Research and prior deployment records are uncommitted inputs. Preserve them and do not sweep unrelated or private operational records into delivery.

## Implementation and evidence

Native owners now provide guarded acknowledged overrides, summary snapshots/save
feedback, immutable bounded browser-local client captures, exact branch origins
and safe group registration retry. Scene details presents these through Setup &
memory, Reply context and Related stories; native advanced/control trees remain.
Keyed updates preserve prompt text node identity, scroll, selection and focus.

487 unit tests/26 suites pass. Broad source attempt88passed/3failed/0skipped;
the3 cast entry-point omissions are fixed and an affected7-case run passes.
A later4-case run passes. Both real Juiced cases passed in the broad attempt;
this is not final all-suite acceptance. Failed summary destination attempts and
first broad artifacts are retained. Same members own source-critique/review files
under their directories. Final verdicts and actual image acceptance are pending.

## Source acceptance

All three members accept implementation and are satisfied with the agreed scope.
Source93/93 passes669.43s, both live cases, zero skipped/flaky/page errors. Root
lint/actionlint pass; test lint0errors53warnings. Late footer paint/reduced-height
copy was separately verified by quality and an8.6s regression. Final release
verdicts remain pending published-image full-suite proof. Research/approved scope
commit6cc7a957b excludes private delegation routing and prior production receipt.
