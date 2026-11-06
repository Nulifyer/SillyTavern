# Status

## Project state

Published and verified v1.19.11, source `78bca3473f897ddf8f8552179296b37155af833f`.
Fork: https://github.com/Nulifyer/SillyTavern. Published branch: release.
Workflow42248135919 passed native amd64/arm64 startup and publication gates.
Image index: `sha256:6e2a1b345b05c6fa45ff4fe0fa550b2687f2d38b23d830e596aa4b439aa76c49`.

## Active tasks

None. [Service workspace task](work/service-workspace.md) is complete.

## Next action

Homelab can use docs/evidence/advanced-controls-20261106/handoff.md for its later
update, preserving all existing volume identities and retaining the pre-update
image/backup. Production69 and shared test85 were never accessed or changed here.
No implementation or release-verification work remains in this batch.

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
