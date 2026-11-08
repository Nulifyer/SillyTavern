# Roleplay product landscape and fork comparison

Status: complete
Owner: root
Repository: /home/nulifyer/Projects/SillyTavern
Base: runtime v1.19.21, 24fbda8c25d6898fde1e99aa005303592dd3ddaf; existing local deployment records preserved
Project: [Roleplay workspace](../../docs/roleplay-workspace.md)
Request source: User asks for many other roleplay chat solutions, one review subagent per solution, and a compiled comparison with this project.

## Goal

Identify concrete product strengths and reusable interaction patterns, then compare
them with the fork's existing behavior and native SillyTavern capabilities.

## Acceptance checks
- [x] Review 20 distinct products with one dedicated agent per product.
- [x] Each review cites primary sources and separates documentation, marketing, source inspection and interaction evidence.
- [x] Compare against source owners and prior synthetic acceptance, preserving advanced controls and native capabilities.
- [x] Compile a product list, capability comparison and prioritized recommendations with tradeoffs and acceptance criteria.

## Scope
In: public product research, dedicated review artifacts, source-based fork inventory and synthesis.
Out: implementation, deployment, production data/screens/logs, accounts, purchases, messages to external people, inference or model changes.

## Current state
Phase: all 20 dedicated reviews integrated into the product comparison, evidence matrix and prioritized recommendations
Dependencies: public documentation/source availability
Integration: complete. Parent owns synthesis and source qualifications; all 20 assigned reviews returned.
Next action: no pending research work. If implementation is requested, use the report's coherent batches and acceptance criteria. Keep production-data access out of scope.

## Decisions
| Decision | Reason | Evidence |
| --- | --- | --- |
| Use public official docs/source as the primary evidence | Avoid inventing usability or model quality from marketing | Research brief |
| Label inaccessible signed-in/mobile flows as untested | No accounts or device interaction authorized for competitors | Scope |
| Separate absent features from native features with weak presentation | User requires advanced SillyTavern control to remain available | docs/model-services.md and native source |

## Findings
| Finding | Evidence | Status |
| --- | --- | --- |
| Native summarization, lore, vectors, branches, response swipes and prompt itemization already exist | baseline.md under evidence | Source inventoried; not a new browser test |
| Memory/context explanation, branch navigation and edit-scope clarity are the recommended first batch | docs/roleplay-product-comparison.md | Proposal grounded in source and dedicated reviews |
| Story-local scenario overrides already exist | public/script.js:9064–9113 | Recommendation corrected to improve scope presentation |
| Backend compatibility processing can change messages after client assembly | src/endpoints/backends/chat-completions.js:2241 | Future inspection must distinguish captured stages |
| Backyard reports shutdown | https://backyard.ai/ and parent-checks.json | Historical reference only |

## Changes
| Path or artifact | Change | Verification |
| --- | --- | --- |
| docs/evidence/roleplay-landscape-20261108/ | 20 reviews, source baseline, comparison data, CSV, HTML and qualifications | JSON/citation/link validation and HTML preview checks |
| docs/roleplay-product-comparison.md | Full product catalog, current-fork comparison and prioritized proposals | Parent synthesis complete |

## Risks and unknowns
- Vendor documentation can describe behavior that was not interactively tested.
- Some services require sign-in or a paid tier; report limits rather than fabricate access.
- Research does not establish comparative model quality, memory accuracy or physical mobile reliability.
- The research phase changed no runtime code. Its records are accepted inputs to the subsequent council overhaul; private delegation routing stays local.
