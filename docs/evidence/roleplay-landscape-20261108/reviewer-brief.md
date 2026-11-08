# Dedicated product review brief

The user requests many roleplay chat products, one separate review agent per
product, then a comparison with their custom SillyTavern fork. Research date:
2026-11-08. Review only your assigned product; parent owns the cross-product
comparison. You are not alone in the shared checkout. Do not revert, stage,
commit or edit anyone else's files. Do not start subagents.

Read repository AGENTS.md, this brief, and the frontend-design and
evidence-discipline skills under /home/nulifyer/.agents/skills/. Apply unslop to
the human-readable review. Do not load unrelated project records.

Use web search/open for current official documentation, help pages, product
announcements, repositories and published UI images. Prefer 3–6 useful primary
sources rather than search snippets or affiliate comparisons. Verify official
source identity and exact product spelling. Public documentation/source review
is sufficient. Do not use preview tools, create accounts, sign in, purchase,
post, generate images/chat, or call inference. Do not read or open production
SillyTavern data, config volumes, logs, screens or app routes. Do not change code,
containers, infrastructure, settings, model runtimes, policies or caches.

The fork already has native character cards, personas, world info/lorebooks,
editable prompt manager, connection profiles, sampler/context overrides, groups,
branch/checkpoint operations, summarization and vector extensions. Its workspace
adds character profiles, exact-story history/archive, immediate new stories,
service-specific settings, one-server discovery, optional separate image writer,
images, opt-in TTS and dictation. Advanced/native controls and classic layout
remain available. Never assume a native feature is absent because the workspace
does not promote it. Parent verifies the fork side of the comparison.

Review the concrete workflows: choose/import/create a character; understand its
premise; start or continue an exact conversation; edit/retry/branch; manage long
story memory; see what context/prompts are used; configure models/voices/images;
use mobile; recover from failure; move or export content. Study scope boundaries
and progressive disclosure. State why a mechanism could help; do not call a
product good solely because its landing page says so.

Write only your assigned two files, <slug>.md and <slug>.json, under
docs/evidence/roleplay-landscape-20261108/products/. Parent owns the brief,
manifest, ledger, baseline and final comparison. No other writes.

The Markdown review should be about 500–850 words with:

- Product identity, audience and evidence boundary, with review date.
- Three to five supported strengths, each explaining the mechanism, expected
  user benefit and a direct source link. Benefits are your inference unless tested.
- Concrete tradeoffs and unknowns, including expert control, migration,
  self-hosting and mobile evidence where relevant.
- Three to five patterns worth considering for this fork, plus things not to
  copy and why. These are proposals, not implementation commitments.
- A short source list. Cite near claims; do not quote over 25 words per source.

The JSON should contain slug, product, reviewedAt, officialUrl, evidenceBoundary,
sources [{url,title,supports}], strengths [{mechanism,benefitInference,evidenceUrls}],
tradeoffs, unknowns, reusablePatterns and doNotCopy. Include a capabilities object
with these keys: characterOnboarding, storyOrganization, editRetryBranch,
memoryLore, promptTransparency, modelConnections, advancedControls, groupRoleplay,
imagesVoice, mobile, portability, selfHosting. Each value has status
documented|source-inspected|marketing-only|unknown, note and evidenceUrls. Unknown
means not established, not absent. Distinguish documented features from first-hand
interaction; do not invent device tests, scores, benchmarks, guarantees or prices.

Return paths, the strongest finding, objections/limits and source URLs. Stop when
the two bounded review files are complete. If evidence is sparse, complete an
honest limited review rather than substituting another product.

Keep updates and the final handoff direct and compact. Remove greetings,
repetition, vague summaries, and unsupported commentary. Preserve exact
identifiers, paths, commands, errors, numbers, evidence, uncertainty,
warnings, changes, verification, blockers, and the words not, never, no,
only, and except. Separate observed facts from inference when it matters.
Apply unslop to the human-readable deliverable, not compressed internal notes.
