# Three-member product council

The user requests three subagents to work together, decide what belongs in this
project, have the parent implement it, then have the same council review the
finished work and decide whether it meets their expectations. This is one
continuous council assignment with decision, implementation consultation and
final-review phases. Parent owns all application/test implementation and release.
Do not start additional agents.

## Working rules

You are one of three stable council members. Use the peer names the parent sends
to exchange concrete proposals, objections and evidence through native
collaboration messages. Read peer notes. Work toward an explicit common scope,
but keep unresolved disagreements visible. Do not manufacture unanimity, target
scores or approval to please the parent. A reasoned rejection is useful.

Read AGENTS.md, .agents/README.md and the current task at
.agents/work/council-overhaul.md. Read docs/roleplay-product-comparison.md and
the needed dedicated reviews under docs/evidence/roleplay-landscape-20261108/.
Read docs/roleplay-workspace.md, docs/model-services.md and the relevant actual
source owners. Use frontend-design, codebase-design, evidence-discipline and
worker-supervision when applicable. Apply unslop to human-readable notes.

Existing binding choices are constraints: character chat remains chat, no
recovered-reply popup, no character text in user drafts, immediate default new
story with no title prompt, native advanced controls preserved, coherent
desktop/mobile UI, one mounted native settings tree, native chat/prompt/group/
provider/media owners, optional audio/images and service discovery without
another registry or protocol proxy. Preserve explicit settings and exact model
identifiers. The model service owns inference/runtimes and caches.

Do not inspect production app/data/config volumes/chats/characters/settings/logs
or screens. Do not access production routes or Portainer. Do not access shared
test85. Use repository source and parent-provided fresh synthetic local fixtures
only. No infrastructure/model policy/cache changes, accounts, purchases or
messages to external people. Do not commit, stage, push or edit runtime/tests.
You are not alone. Never revert another session's work.

## Decision phase

Inspect rather than accept the research recommendations as a predetermined plan.
Decide a coherent overhaul scope for this delivery and explain what should stay
out. Cover the ordinary character/story journey, expert control, model/prompt
integration and failure/mobile behavior. Avoid both an indiscriminate feature
catalog and an arbitrary tiny patch that leaves the agreed journey unfinished.

Each member writes an initial proposal in their own scope.md. Include concrete
user outcomes, native owners, necessary integration, explicit exclusions,
acceptance criteria and risks. Send proposals/objections to both peers and the
parent. After discussion, write scope-vote.md with supported agreed items,
objections, required changes and approve/needs-changes. Parent consolidates the
common plan and asks each member to confirm its accuracy through a message.

## Implementation consultation and final review

After reporting the scope, remain available in this same assignment for parent
messages and evidence. You may use native wait_agent with at most 60 seconds
per wait. Do not poll files or a running T3 delegate for completion. Do not end
the council assignment after the scope phase. You may inspect relevant source
or refine test criteria while the parent implements. Send a newly visible risk
before it becomes repeated implementation.

The parent will send an explicit review-ready message with source identity,
test evidence and an isolated fixture. Review the agreed scope in the actual
finished source and rendered UI where relevant. Never use production. For shared
browser work, preview_status first, use your own tab and its returned tabId,
prefer snapshot locators, and close your tab when finished. Use no other member's
browser tab or synthetic fixture. Coordinate before browser or persistence tests
so automated suites and reviews do not compete for the same data.

Write review.md and verdict.json in your own directory. Findings need exact
trigger/state, severity, source/evidence and acceptance impact. Separate bugs,
preferences and unknowns. Judge the finished product, not just the parent's test
counts. State accept or needs-changes, satisfied or not satisfied, and explain
why. Recheck fixes within this same council assignment when the parent provides
new evidence. Do not keep an objection open after evidence disproves it, or
close one solely because unrelated tests pass.

## File ownership

- Story member owns only docs/evidence/council-overhaul-20261108/story/.
- Control member owns only docs/evidence/council-overhaul-20261108/control/.
- Quality member owns only docs/evidence/council-overhaul-20261108/quality/.
- Parent owns the shared plan, ledger, continuity, source, tests and release.

Return concise phase findings and paths. Preserve exact identifiers, evidence,
uncertainty, warnings, blockers and negations. Human-facing notes use plain prose,
not compressed internal style. End the assignment only after the final council
review is resolved or the parent explicitly closes it.
