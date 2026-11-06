# Mobile suspension review

The user asked for recovery after phone lock, switching tabs and browser pause.
Only local synthetic containers were used. Production69, its application/data/
config/volumes and shared85 were never accessed or changed.

## Reproduction and fixes

Actual v1.19.15 on port 8022 failed the draft reload case after confirmed hidden/freeze/
resume. The healthy paused reply passed. Baseline log and failing render are in
this folder. The existing native backup was debounced, read the live textarea when its
timer fired, and had no background flush or story key. The baseline loses the
newly entered draft when reloaded immediately after suspension. The global key
also cannot safely identify the intended story. The new owner keeps the native recovery preference and checkpoints drafts
synchronously by user, stable avatar/cast ID and story filename. Rename migrates
the record. An older global draft requires explicit recovery into the chosen story.

Native stream errors previously skipped normal finalization/save and left received
text unpersisted. Interruption now retains partial text, stops cast progression,
cleans up UI state and skips success events, tools and automatic continuation.
Quiet callers still reject. Custom/OpenAI streams require a normal completion
marker or all requested choices' finish reasons instead of accepting early EOF
as success. Multi-choice EOF cases cover both complete and incomplete sets. The first stream update
is eligible to render immediately, including the one-content-chunk fixture. The shared forwarding
helper preserves SSE content type/no-transform and handles upstream stream resets.
The stock sd.cpp image endpoint remains unchanged from v1.19.8.

Recovery checkpoints retain several unacknowledged messages. A native successful
save acknowledges only matching message ID/send date/text and completed status;
a failed save never clears them. The loaded native transcript can also confirm
saved completed text. Interrupted text remains until dismissed. Recovery offers
received text beside the composer and only appends after an explicit action. It
does not overwrite or invent a server transcript, or replay inference.

Foreground checks coalesce, time out after 10 seconds and require native ping 204.
403 renews the native CSRF token. Read-only compatible-provider status avoids model
list/dropdown mutation and rejects stale provider responses. Explicit native
settings remain authoritative. A hidden microphone or pending permission cancels;
stale permission results cannot clear ownership of a later attempt. An already
submitted transcription can finish into its original draft.

## Evidence discipline

Initial CDP-only tests did not freeze visible pages. Those results were not used
as suspension proof. Playwright enables focus emulation on its original CDP
session. The corrected test helper disables that override on that same session,
opens a background tab, asserts document visibility=hidden and observes the actual
freeze event, then activates/returns the original tab and restores emulation.
The helper uses Playwright's in-process original-session access only in tests.

The read-only reviewer found the dropdown mutation, overwritten earlier unsaved
reply, and stale microphone pending flag. All were corrected before publication,
with browser cases for each. One early extended run failed on an artificial CSRF
token that the real server correctly rejected; the fixture now renews the actual
synthetic session token without logging it. One source run was intentionally
interrupted after 11 passes for review corrections. A later focused run had one
preloader timeout before its reset case and 5 passes. These attempts are not final
acceptance. The first full source candidate had 58 passes and 2 failures: one navigation click
timeout and one disappearing foreground failure notice. Repeated traces exposed
two recovery resets: late APP_READY and prompt counting dry runs emitting
GENERATION_STARTED. Recovery now preserves newer notices across initialization
and ignores dry-run generation events. A deterministic before-fix case fails on
the dry-run reset. Final results belong in source-summary.json and browser-summary.json.

Source recovery screenshots are controlled UI-state fixtures, not network-loss
proof. They were inspected at 448×921, 448×400 and 320px with enlarged text. Recovery
buttons initially wrapped into narrow columns; explicit intrinsic width corrected
that. Scrolling reveals actions without moving the composer. Adding received text
preserved the existing draft and returned focus to it without adding a chat message.

The image test initially tried typing while the existing image workflow had made
the composer inert. No text was inserted. Its corrected case enters the draft
before the image request, then verifies one completion across actual freeze/resume.
The transcription case similarly holds an already submitted request across pause.

## Limits

Browser lifecycle simulation is not physical phone-lock qualification. Browser
OS discard cannot reattach its former HTTP inference. Reload offers local text;
continuing or regenerating is explicit. Browser storage denial retains text only
in this tab and shows a copy-before-reload warning. Native recovery opt-out is
preserved. Clearing browser data removes local recovery. Foreground automatic
model checks use the existing compatible-provider status owner; other native
providers retain their normal Connect workflow. No server inference job queue,
Juiced proxy or model runtime/policy/cache changes were added.

The final source run passed61/63 cases with zero uncaught page errors. Its two
failures were a legacy fixture that seeded the old key after initialization,
and a reload exceeding the10second navigation timeout. The migration fixture now
loads that key through a real reload. Navigation has a30second budget; the native
preloader and usable-screen assertions remain. Four focused corrections passed
in51.1seconds. Keyboard Enter activation had added a newline after moving focus
into the composer; recovery buttons now consume that activation before the new
focus can receive its default keypress. Received text and existing drafts match
exactly, with no Send. Runtime source is frozen for published-image acceptance.

## Published-image acceptance

The pulled v1.19.16 image passed all 63 cases in 8.2 minutes, zero skips, flaky
cases or uncaught page errors. Both live Juiced cases passed. Five fresh synthetic
volumes, no overlays, 28 tagged runtime-file matches, native heartbeat/version,
HTTPS reachability, registry source labels and both native startup gates passed.
The runtime stayed unchanged after its source tag. The final manual review
inspected collapsed/expanded recovery at 448×921, scrolled actions at 448×400,
320px with enlarged text, the live image and the Pixel portrait render.

Manual native Save/readback, container stop/start, failed ping and keyboard Retry
recovered with ping 204/status 200 and zero inference calls. Reload retained exact
draft text, Qwen3.5-2B, context `12288`, temperature `0.85` and Advanced controls enabled and native
Auto-connect=false. Keyboard append returned focus to the composer without an
extra newline or Send. The controlled partial-text UI fixture is identified in
manual-restart.json; real transport-loss proof remains in the automated cases.
33 console entries and 107 failed requests remain classified in browser-summary.json.
One settings save was aborted by a fixture reload; settled native settings
persistence passed separately with no mocks. Production69/shared85 were untouched.
