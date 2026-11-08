# Foreground chat correction

The user reported that the recovered-text popup interrupted character chat, then
clarified the requirement: restore the existing chat UI when its tab becomes
active so the character response remains visible and is not cut off.

The original design confused layout recovery with data recovery. It added a
persistent composer-side reply panel and an action that put character text in the
user's draft. Its save acknowledgment filtered only complete checkpoints, so
saved interrupted/tool-intermediary records could still trigger the panel.
The lifecycle code checked connectivity but did not refresh native geometry.
These source findings were independently reviewed by ux_critique, read-only.

The correction removes that reply workflow and its checkpoint/save hooks. It
leaves old local reply records untouched. It preserves native transcript saving
and per-story unsent drafts. Native positioning, composer fitting and scroll
ownership restore geometry after resume, preserving the history anchor or bottom
following intent. Layout repair does not await network checks, rebuild message
nodes, move focus, reload transcripts or replay prompts. Delayed work is guarded
against hidden tabs, changed stories, Settings and new user interaction.

The v1.19.19 comparison reproduces the recovery panel and history-position loss
at a reduced viewport height. It does not establish the precise GPU/OS cause of
the user's physical-phone cutoff. Device suspension remains emulated.
Exact final source/image results and artifacts are added after verification.

The final pre-release focused run passed 7 cases in 42.7 seconds, with Android UA,
DPR 3 and a 448×997 screen. The same 5 comparison cases on actual v1.19.19 passed
2 and failed 3 in 46.1 seconds: history position on desktop and Android, and the
unsolicited reply panel. Both final-line cases already passed on v1.19.19.
An earlier 10-case source run also covered reset/EOF, save errors and old global
drafts. Both phases retain diagnostics and screenshots. Final desktop and reduced
height Android latest-reply renders were visually inspected, as was the old panel.
The final read-only implementation critique found no actionable blocker.

## Broader source check

The first full source run completed all 72 cases: 69 passed and 3 failed in
610.7 seconds, including both live Juiced cases passing. Failures were keyboard
file chooser timeout, the header not reflecting a duplicated-character story
rename, and an empty draft after the late-permission suspension test. Diagnostics
for all cases and the three failure renders are retained in source-full/.
Their cause is unresolved; they were not excluded or reclassified as passes.

After restarting only the owned source fixture, an isolated attempt started
before HTTP readiness and failed all 6 iterations with connection errors.
The app subsequently returned HTTP200 and version1.19.20. The corrected ready
run passed all three cases twice, 6/6 in27.9seconds, without source changes.
The initial source run used hot source overlays on a server started before the
package-version bump, so its cached /version remained1.19.19. The restarted
source server reported1.19.20. Neither source phase is release-image proof.

Stored logs omit ANSI formatting and trailing whitespace; errors and counts are retained.

## Actual image acceptance

The pulled v1.19.20 image passed all 72cases together in 9.2 minutes with
both live Juiced cases,zero skipped/flaky results andzero uncaught page errors. Full raw
console/network events remain in released/ and browser-summary.json. This clean
image result supersedes the failed source acceptance run for delivery; it does
not erase that run or establish the cause of its three failures.

The actual-image Pixel latest-reply, desktop history and old-checkpoint/no-popup
renders were inspected after the full run. The final line is above the composer,
the selected user draft remains separate, and old records produce no panel.
The 115 aborted requests are retained by case; 2 ERR_FAILED events belong to deliberate
cast/quiet transport failures and 1 incomplete-chunk event belongs to the real reset
fixture. The 24 console entries include the deliberate save/delete/status/stream
failures and pending-illustration guard. None is an uncaught page error.
