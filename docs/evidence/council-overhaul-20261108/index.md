# Council overhaul evidence

v1.19.23 source and actual-image browser acceptance both pass all 99 cases,
including both live Juiced cases, with no skips, flaky results or uncaught page
errors. The same three council members accepted the finished scope and final release proof.
[Handoff, identity, connections, migration and rollback](handoff.md).

Tagged source `640283d97ec54996b6b91d0bff88ff7c79213cd4` matches the 20-file runtime
manifest. Actual amd64 verification used five fresh synthetic volumes, no source
overlays, enabled heartbeat and normal Juiced HTTPS validation. Native amd64 and
arm64 startup gates passed in workflow 42524646047. Full browser/live acceptance
ran on amd64. This is not physical-device or ARM64 browser qualification.

- [Final source](source-v23-final/summary.json): 99 passes in 691.69 seconds,
  501 unit tests in 27 suites, root lint/actionlint pass, test lint 0 errors/53 warnings.
- [Actual release](release-v23/summary.json): 99 passes in 759.51 seconds,
  54 console errors and 85 failed requests retained in 99 diagnostic files.
- [Synthetic upgrade](release-v23/migration-after.json):eight exact fields
  preserved through own v1.19.22 to v1.19.23 volume-preserving replacement and normal browser
  reload. Actual desktop/448px chat/Scene renders are in release-v23/.
- story/, control/ and quality/ retain the same members' scope votes, source
  critiques, independent source renders and final review/verdict records.
- release-first-attempt/ retains the actual v1.19.22 run with 92/93 passes and one failure; release/ retains
  that held image's registry/workflow/runtime identity. The first failure was
  untraced and remains unattributed. Passing repetitions did not close it.
- rename-delta/ proves controlled v1.19.22 rename and collection failures, passing native
  ownership corrections, conflict/old-path/different-incarnation protections.
- source-precondition-attempt/ retains 95/99 with inherited synthetic draft restore
  disabled, the explicit fixture precondition correction and 5 affected passes.
- source-keyboard-before/ retains 98/99 and observed synthetic+native duplicate
  clicks for one Enter. source-v23-final/ records the shared keyboard repair,
  seven fail-before units, real file-picker and custom/editor/menu regressions.

Earlier source-final/ is the v1.19.22 candidate 93-case evidence, not the current
v1.19.23 run. The first prototype broad run passed 88/91 and omitted native cast
controls in 3 cases. Those prototype omissions were repaired before v1.19.22; they do not
establish that the published v1.19.21 baseline had the prototype defects. Earlier failed
summary, layout and footer states are preserved with their corrections.

Selected reports, diagnostics and before/after screens are committed. Complete
local test output and superseded partial runs remain available locally; they are
not swept into delivery. Private delegation routing and prior production receipts
are excluded. No production app, data, config, screens, logs or volumes were
accessed, and no production or shared test stack85 deployment was performed for this task.
Only normal inference/discovery requests reached existing Juiced. Physical phone
lock/GPU, real microphone hardware, audible quality and paid providers remain
unqualified.
