# Status

## Project state

Published and verified v1.19.11, source `78bca3473f897ddf8f8552179296b37155af833f`.
Fork: https://github.com/Nulifyer/SillyTavern. Published branch: release.
Workflow42248135919 passed native amd64/arm64 startup and publication gates.
Image index: `sha256:6e2a1b345b05c6fa45ff4fe0fa550b2687f2d38b23d830e596aa4b439aa76c49`.

## Active tasks

[Full workspace review](work/full-workspace-review.md) is active. User requests a complete manual visual/workflow audit and fixes, including immediate story creation, with an independent critique. [Service workspace task](work/service-workspace.md) remains complete for its narrower scope.

## Next action

v1.19.12 sourcec78f9f5e312dfcbbe3df1c02b55456af427a3873 is published; workflow
42263052988 passed both native startup gates and publication. Actual image8019
reproduced a further advanced-mode state defect: native vision set to current
story model still displayed the separate model as Saved. This blocks the final
handoff. v1.19.13 corrects that derived state, qualifies writer profiles, ignores
inert keyboard targets and completes interactive single/cast Stop cancellation.
Source41-case pass plus corrected search focused pass complete, both live cases
passed;42diagnostics zero uncaught errors. Publish immutablev1.19.13 and run
full42-case acceptance on its actual image before handoff.
Baseline8017 and source8018 have disjoint
fresh synthetic volumes. The baseline has no overlays. Independent critique
captured101 baseline and52 follow-up settings views; supported fixes cover story
entry, history recovery, native editor ownership, service selection feedback and
responsive native controls. Source lint,424 unit tests and actionlint pass.
The38-case v1.19.12 frozen source suite with live Juiced passed, with zero uncaught page
errors. Immediate creation also suppresses duplicate rapid starts from profile
and header. Publication and actual image acceptance remain. Evidence:
docs/evidence/full-workspace-review-20261106/ and the active ledger.
Production69 and test85 remain untouched; no Homelab deployment is authorized.

## Blockers

None. Physical microphone and audible quality remain unqualified. Retrieval
retains native provider setup; Juiced reported no enabled embeddings model.

## Verification

34 browser cases passed on source and the actual pulled image, including both
live Juiced cases. The expanded advanced-controls case covers1280/390/320px,
provider parameters, sampling edits, formatting, extensions, discovery/apply,
reload and value preservation. Lint,424 unit tests and actionlint passed.
The actual image has five synthetic volumes and no overlays, matches18 tagged
files, reports1.19.11 and reaches Juiced over HTTPS. Standalone restart persistence
passed. Local synthetic preview:8016, st-advanced-release-20261106.
Evidence and exact digests: docs/evidence/advanced-controls-20261106/.
[Service workspace task](work/service-workspace.md) is complete. Its original
v1.19.10 interrupted verification is retained honestly in the publication record.
