# Final control review

Accept v1.19.23. I am satisfied with the agreed control and integration scope. No control objection remains open. This accepts the verified release and does not authorize a production deployment.

## Finished identity

The release source is `640283d97ec54996b6b91d0bff88ff7c79213cd4`. The immutable image index is `sha256:14327cb00f8adf4504502f1abc7395dcf64dcc9c9aa200394146ae428d009d72`. I compared the 20-file source manifest, current repository bytes and the parent-recorded image hashes. All 20 match. `../release-v23/tag-source-verification.json` also records 20 matches to the release source.

I read the registry, architecture labels and workflow artifacts. Workflow `42524646047` completed successfully, including native amd64 and arm64 startup gates. Both image architectures identify the same source and v1.19.23. The actual acceptance container is `st-council-v11923-release-20261108` at `http://127.0.0.1:8041`, with five fresh synthetic volumes and no source overlays. Its runtime artifact records v1.19.23, a passing native heartbeat, stock image handler preservation and Juiced HTTPS status 200.

## Evidence and review boundaries

My independent browser work used only the assigned fresh synthetic source fixture `st-council-control-20261108` at port 8037 and my own tab. I exercised native configuration, generated captures, correction, persistence, failure and retry, alternatives, Continue, rename, narrow layouts and classic restoration. `render-checks.json`, `desktop-context.png`, `phone390-context.png` and `phone320-override-retry.png` record that work. I closed my tab and restored every temporary fetch interception.

The final image runs and migration were performed by the parent. I inspected their artifacts and the affected test implementations. I also inspected the parent's actual-image desktop and 448px chat/Scene details screenshots, plus the 320px enlarged override-failure capture. That is review of recorded actual-image renders, not another independent interaction run by me.

| Evidence | Result |
| --- | --- |
| `../source-v23-final/summary.json` | 99 source browser cases passed in 691.693 seconds; zero skips, unexpected failures, flaky results or uncaught page errors. |
| `../release-v23/summary.json` and `report.json` | 99 actual-image cases passed in 759.512 seconds, including both named live Juiced cases; zero skips, unexpected failures, flaky results or uncaught page errors. |
| `../source-v23-final/st-council-v23-keyboard-units.log` | 501 unit tests passed in 27 suites. |
| Final lint artifacts | Root lint and actionlint passed; test lint has zero errors and 53 warnings. |
| `../release-v23/migration-after.json` | Synthetic v1.19.22 to v1.19.23 migration preserved all eight checked fields: full owner, premise, draft, URL, exact model, context 32768, temperature 0.83 and provider. |
| `../release-v23/manual-review.json` | Existing synthetic profile stayed disconnected because auto-connect was off; configuration and draft persisted without inference or resets. |

The actual-image summary retains 54 console-error records and 85 failed-request records, including 81 aborted requests. I do not relabel those diagnostics as zero errors. The source summary retains its own diagnostics. Both reports show zero uncaught page errors and all expected cases passing.

## Satisfied control outcomes

Scene details connects current premise, native summary, attached lore, correction destinations, selected reply evidence and exact related stories. It remains optional. Immediate Start, ordinary character chat, optional media and native advanced settings remain available.

Native summary selection and editing retain one owner. Scope copy distinguishes story summary text from shared automation, prompts and injection settings. My native summary edit acknowledged persistence and survived reload. Story overrides use a real native Apply/Cancel operation. Escape leaves metadata unchanged. Failed persistence retains pending text, rolls committed metadata back and permits retry. The final image's enlarged failure screenshot visibly paints both Apply and Cancel.

Captured context uses an allowlisted native client stage, immutable exact model/provider/preset/budgets and account/entity/file/message/swipe/revision identity. Today's settings do not rewrite recorded values. My actual native request check excluded synthetic header and arbitrary-body sentinels from stored captures. Native Continue and response alternatives retained separate matching references. A changing active reply shows in progress while older unchanged replies remain inspectable. Legacy, edited, copied, missing and evicted captures stay unavailable. The view does not claim final provider/template visibility, perfect recall or additive token accounting.

Native branch/checkpoint, transcript, provider, prompt and media owners remain intact. Parent and inverse ancestry use exact or unique resolution. Failed group registration can retry only an exactly matching saved child without force overwrite or unrelated deletion. The actual native cast regression verifies selected-alternative preservation, no phantom membership and successful retry. Native cache-await operations recheck owner identity.

The verified rename correction addresses the reproduced v1.19.22 loss. File acknowledgement precedes slower metadata persistence, with one bounded BrowserRecovery transition. Native chat changes retire old-name permission. Exact integrity-bearing request identity protects current composer, pointer and reload decisions. A stale acknowledgement cannot migrate a newer incarnation's persisted draft. Destination conflicts preserve both records. Character refresh parses, validates and normalizes before publishing, so delayed or malformed JSON cannot expose a temporarily empty owner.

Keyboard activation remains with the shared native owner. Native controls, editable content, prevented defaults, IME and modifiers retain their existing ownership. Eligible custom controls receive one consumed Enter activation. The real file-chooser check verifies one activation, cancellation and returned focus. No dictation-specific workaround was added.

My inspection preserved native message nodes, draft text and selection. At 320 by 400 pixels, the corrected classic return control passed a real click. Summary and model controls remained the same unique nodes through restoration. Source and actual-image evidence cover the remaining agreed desktop, phone, suspension, media and expert-control regressions.

## Failed evidence retained and findings closed

The first v1.19.22 image run passed 92 of 93 cases and lost a draft in the same-filename case. Subsequent controlled tests established real rename and character-publication races. Their failures and after-fix evidence remain in `../release-first-attempt/` and `../rename-delta/`. Repeated passing attempts alone were not used to dismiss the failure.

A later source run passed 98 of 99 and exposed duplicate Enter activation of a native file chooser. Its failure, event observations and failing-before units remain in `../source-keyboard-before/` and `../source-v23-final/`. The final 99-case source and image runs include the shared-owner correction.

Initial capture containment, omission labels, budgets, summary scope, ancestry, rename readiness, group retry, classic return and active-revision findings are resolved. The quality member's footer paint/clipping finding was rechecked in the corrected source and the final image render. The rename transition, stale-incarnation and staged-collection findings are resolved in their affected tests and final combined runs. There are no open bugs or preferences blocking this scope.

## Limits

My own interactions used source overlays. The parent supplied immutable-image execution, migration and render evidence. ARM64 has native startup proof; browser and live-service acceptance ran on amd64. The manual migration screenshots use CSS resizing, with Android/touch/DPR behavior covered separately by the automated suite.

Physical phone lock/GPU restoration, microphone hardware, audible quality and paid-provider behavior remain unqualified. A captured client stage does not expose every provider transformation or model template. File rename and character/group metadata persistence are not one atomic backend transaction. This acceptance covers the agreed journey and observed build, not every untouched upstream behavior.

No production or shared test85 access occurred in this review. No infrastructure, model runtime, policy or cache change is part of this acceptance.
