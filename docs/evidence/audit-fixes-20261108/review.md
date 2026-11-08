# Independent audit fixes

This batch fixes the six findings in
[the independent audit](../fork-audit-20261107/review.md). The previous v1.19.20
handoff remains held until the replacement image passes acceptance.

## Ownership changes

- Native character/group loads share a cancellable read lifetime. They validate
  response shape before clearing the current transcript, changing its owner or
  saving anything. Exact-story navigation loads that file directly. Stale loads,
  closed chats, removed/reordered characters and replaced groups cannot commit.
  Native completion hooks check their lifetime after awaited extension callbacks.
- Server reads distinguish missing/empty files from disk errors and corrupt JSONL.
  Integrity checking rejects missing incoming metadata for existing nonempty
  files, including legacy headers. Explicit force and configured integrity policy
  remain native controls. Group integrity is installed before its initial save.
- Native character rename migrates user-scoped drafts and archived story IDs.
  Existing destination drafts and failed storage writes preserve source text.
  Group/duplicate state and old assistant checkpoints remain separate.
- Native status responses retain their request identity. Late normal Connect data
  cannot be attributed to a different server; it stops only its own loader.
  Unsupported foreground verification is distinct from failure and performs no
  inference or key writes.
- Recorder stop, error and timeout cleanup belong to the recording sequence.
  Stale events cannot stop a newer stream or its timer.
- Native image cancellation begins before writing the prompt. One signal reaches
  the optional writer, main-model prompt, caption and inference. Story identity
  includes character/group and filename, and is checked through asynchronous
  upload and message callbacks. Workspace Stop is a neutral cancellation outcome.
  An already submitted image upload may finish writing an unused media file after
  Stop; its late result cannot append to another chat.

Parent owned load/save, shared browser tests, integration and release. The prior
independent reviewer implemented the migration/status/recorder changes and their
focused tests, then reviewed load integration. The image reviewer implemented its
native operation changes and focused tests. Neither worker committed or performed
production/shared infrastructure operations. All changes remain in one checkout.

## Verification phases

478 unit tests pass in 24 suites. Root lint and actionlint pass. Test lint has
0 errors and 51 warnings. The Jest ownership suite has one narrow exclusion of
Playwright's standalone-expect rule because its cases use Jest test.each.

Initial focused browser run passed 10/10. Expanded run passed 11/12; its final
upload case waited on the wrong intercepted URL, /api/files/upload. The actual
native endpoint is /api/images/upload. After correcting the harness, the image
Stop/late-upload pair passed 2/2, including keyboard Stop. The first failure is
retained and is not classified as an application defect.

The full source run passed all 86 cases with both live Juiced cases. A final
review then reproduced an older foreground response overriding a newer native
Connect. The native request revision now guards both modes. Its new unit test
failed before the one-line fix and passes afterward. Two focused status browser
cases passed after that last change. The final image must run all 86 together.
Source8032 has public/src/package overlays and is not release-image proof. The
actual image must have fresh synthetic volumes and no overlays. No production69
or shared85 app/data/config/volume was accessed. Juiced policies, runtimes and
caches were not changed. Physical phone/GPU resume and real microphone hardware
remain unqualified. Earlier source-run failures remain preserved in the audit;
passing replacement checks alone does not establish their historical causes.

## Actual image acceptance

The pulled v1.19.21 image passed all 86 cases together in 10.6 minutes,
including both live Juiced cases, with no skipped/flaky results or uncaught page
errors. All 37 checked runtime files match the immutable tag; five fresh volumes
and no overlays are verified. See [handoff](handoff.md), browser-summary.json and
released/ for exact console/network diagnostics. The corrected image-upload
harness case passes in this full run. Historical failed attempts remain intact.

## Visual follow-up

Inspected actual-image captures of the 320px changed image controls, native image
prompt editor, live story/image, 390px draft and reduced-height Pixel final reply.
The final line, draft selection and composer fit in the Pixel capture without a
recovered-reply panel. A T3 shared-browser pass opened Stories and the native
character chat at 1280×800 and 448×921. The portrait remains beside the text and
the complete greeting remains scrollable above the composer. These last two
shots use CSS resize, not Android emulation; automated Pixel cases use the
documented Android/DPR/touch profile. Shared-browser shots and review metadata
are in shared-browser/ and shared-browser-review.json.

The final suite logged 45 console errors and 82 failed requests. Three explicit
transport-failure fixtures and one reset stream account for the non-abort
requests. The fresh-context migration case also recorded an aborted settings
save; its migration assertions passed. No claim of zero console/network errors
is made. See the per-case diagnostics for exact errors.
