# UI and interrupted-stream follow-up

Status: source batches qualified; publication, immutable-image and production checks pending.
This record follows the user-reported composer seam and interrupted-reply failures.
The prior v1.19.24 acceptance did not establish visual completeness.

## Changes and checks

The composer uses one continuous background with readable text, placeholders,
field boundaries and native checkbox marks. Continue is visible on phones and
keeps unsent text, including slash commands. Shared shell metadata, command search,
conditional native controls, provider statuses and notifications receive contrast
checks after their actual animations settle. Portrait checks assert native modal
layering and compare actual pixels with underlying chat/composer hidden.

Durable server jobs separate provider generation from browser subscriptions.
Cursor replay and the original native parser restore the same reply. Save receipts
and exact transcript revision checks avoid duplicate output and preserve another
tab's edit. Confirmed conflict discard releases the story without changing the
saved conversation or draft. See [stream architecture](../../stream-recovery.md).

Native reviews also corrected stale lorebook/gallery windows, popup reentry and
cleanup, repeated DND/AllTalk handlers, settings write order, failed Data Bank
operations, Quick Reply ownership, swipe keyboard actions, favorites and delayed
image-service Apply results. Lorebook writes use per-book queues and an operation
lifetime shared by import/rename/delete; failed saves retain a retryable draft.

## Final source review

The [merged coverage receipt](source-review/merged-source-review-coverage.json)
reconciles370/370 first-party public files at current hashes,2037/2037 static
registration candidates and266 separately expanded command/inline/wrapper
registrations. There are no missing owners, source/extraction drift, substantive
read-range gaps, unclassified candidates or syntax failures. Partition ledgers
and exact final delta reviews are retained alongside it. Source-only leads remain
explicit; a reviewed registration is not proof of every runtime path.

The final frozen unit run passes657 cases in34 suites. The
[source qualification record](source-qualification.json) distinguishes all first
attempts and corrected followups: workspace102/live and lifecycle10 pass; first
UI26/28 and native242/250 retain their failures. UI2 and translation/TTS21 rechecks
pass, with independent mixed-library and menu lifetime proofs. This is not one
clean391-case final-source run. Full immutable-image acceptance is pending.
The earlier artifacts below retain their original scopes and must not be summed
into final-run claims.

## Evidence types

- `frontend-source-inventory.json`: every public JS/CSS/HTML file, static event
  registration candidates, imports and hashes. `source-inventory.mjs` regenerates
  it. Computed/dynamic registrations may be absent. This is an inventory, not
  proof that each implementation line was manually reviewed or each listener run.
- `listener-review.json`, `native-source-review.json`, `stream-source-review.json`:
  independent, explicitly scoped source reviews at their recorded hashes.
  Their original findings/status are retained; subsequent fixes need test evidence.
- `keyboard-negative.json`, `native-negative-experiments.json` and
  `lorebook-save-negative.json`: controlled unchanged-source reproductions,
  separate from actual-browser qualification.
- `workspace-source-summary.json`: 102/102 source workspace cases in 859.2 seconds,
  both authorized live-service cases, zero skips/flaky/page errors. Console/network
  diagnostics remain counted. Source changed during this run; image acceptance
  must exercise the final bytes together.
- `unit.txt`: historical unit output at its recorded source state; final frozen unit output is recorded separately.
- `stream-core.txt`: 8/8 native recovery browser cases together in 1.4 minutes.
- `stream-conflict-responsive.txt`: conflict preservation, Cancel, explicit discard,
  unchanged draft and successful next reply, including 320/390px and landscape.
- `native-ownership.txt`: 10/10 native lorebook, popup, gallery and Ollama cases.
- `native-data-bank-summary.json`, `lorebook-summary.json`,
  `native-swipe-favorite.json`: exact scoped actual-browser results and hashes.

Raw runs and failed attempts remain under /tmp/st-ui-followup-20261109. They are
not relabelled successful. Private deployment receipts are local and excluded from
publication. No production app screens, routes, logs or volume contents are used.

## Limits

These checks do not qualify all possible custom themes, third-party extensions,
content combinations, external providers, physical devices or audible quality.
Provider protocol tests use held synthetic responses except the named live-service
cases. Clipboard/favorite failure checks mock browser boundaries as documented.
The final release record must distinguish source, actual image and deployment
metadata evidence. A file count or passing geometry scan is not a whole-UI claim.
