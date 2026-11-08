# Status

## Project state

Latest publication: v1.19.20, source e750add4eb6f448f68673707f7ca258e836a882b.
The release passed its 72-case browser suite, but an independent audit found
critical uncovered defects. Production handoff is now on hold. No runtime fixes
or new container were published during this review. Production69/shared85 were
never accessed or changed by this thread.

## Active tasks

Independent review is complete. Six runtime findings remain unfixed: failed
character/group reads can overwrite transcripts; character rename strands
user drafts/archive state; normal status responses can apply stale server context;
stale recorder cleanup can stop a newer recording; unsupported providers get
false foreground warnings; a pending separate image writer cannot be cancelled.
Main agent owns follow-up implementation/validation/continuity. The independent
reviewer wrote evidence only and made no runtime/source/test changes.

## Next action

Fix the native client/server chat load/save contract first. Failed HTTP/network/
payload/disk reads must not initialize or save a new conversation. Preserve the
current transcript/draft until a new load succeeds. Cover character and group
open/reload/new paths and valid empty/new chats. Add integrity-bypass regression.
Then address the other five owner-level findings in the audit report, verify
missing cases and publish a replacement through the normal process. Do not deploy
production here. Keep all existing volumes and concurrent work untouched.

## Verification

Audit: docs/evidence/fork-audit-20261107/review.md.
Actual v1.19.20 on fresh local port 8031 reproduced destructive failed-read fallback and false
provider warning. Both audit invariants failed. Six isolated source observations
were independently rerun exactly; focused existing units passed 20/20. All 34 changed
runtime/package files versus upstream base match v1.19.20 bytes. These checks are
review evidence, not fixes or a clean bill of health.

Prior release proof remains in docs/evidence/chat-resume-20261107/: all 72 browser
cases passed together with both live Juiced cases; 425 source unit tests/lint passed;
32 sampled runtime matches, five fresh volumes/no overlays and native architecture
startup gates passed. Earlier source run with 69 passes and 3 failures remains unresolved despite later
isolated 6/6 and released 72/72 passes. The rename failure included HTTP400.

## Limits

Narrow image-result ownership races need browser reproduction. Physical phone/
GPU restoration and real microphone quality remain unqualified. No production,
shared fixture, model policy/cache or infrastructure operations were performed.

## Blockers

Production handoff held pending the critical native load/save correction.
