# Action menu dismissal review

The user asked for temporary menus to hide when clicking elsewhere, including
on phones. Root owns source, tests, release and continuity. Production69 and
shared test85 are outside this task; only local synthetic containers are used.

## Findings and changes

- Observed on pulledv1.19.16/8023: clicking the Stories heading leaves a story
  action menu open. Both new desktop and448×921 touch regressions fail the
  outside-dismissal assertion on that image. Before/after-click captures and
  baseline-summary.json retain the evidence.
- Workspace only closed `.workspace-scene-menu` after a workspace action.
  The workspace owner now handles completed outside clicks/taps, another menu,
  action selection, Tab exit and Escape. It never consumes outside clicks.
- Native Chat actions used hover/focus to decide whether a click was outside.
  A focused touch anchor could keep it open. Its native owner now uses event
  containment. Native owners expose expanded state so rapid Escape does not
  toggle a fading-out menu open again.
- Body-mounted native Chat actions, Extension tools and SD image choices belong
  to the composer menu chain. Interior interactions retain their parent anchor.
  Escape closes the deepest child first and returns focus to its trigger.
  The SD trigger now supports keyboard activation and focus return.
- Independent source critique found two gaps before publication: background
  generation Stop took Escape before menus, and the SD child was missing from
  the ownership chain. Both were corrected and added to browser regressions.
  The critique performed no runtime or visual verification.
- Settings/recovery/character disclosures are excluded. Existing native owners
  retain provider actions and settings lifecycle. No inference adapter, model
  setting, storage schema or stock sd.cpp backend change is introduced.

## Iteration evidence

The first two source trials reached the new dismissal checks, then failed
fixture assertions: a nonexistent `#sd_settings` ID, then an assumption that
the advanced disclosure was open. The fixture now selects `.sd_settings` and
explicitly opens the disclosure. Trial3 reloaded before the debounced layout
save; it now waits for the save response. Trial4 had one phone menu become
hidden before Rename. Late native focus restoration was a possible cause,
not traced proof. Trial5 passed both cases. The final implementation explicitly
ignores programmatic focus moves and only dismisses on intentional Tab moves;
the regression checks that distinction. Trial summaries retain exact outcomes.

The mobile scrim fixture targets the exposed right edge, because its center is
covered by navigation. Test titles use the existing cleanup prefix. These are
fixture corrections, not excluded application screens.

The first full source run passed55/65. Its menu timing failures were real
regressions in the initial dismissal implementation. A captured setter stack
then proved a synthetic textarea click from script.js's delayed chat-load
callback called dismissOutsideActionMenus and closed More. The final handler
accepts only trusted user clicks/taps. Native delayed autofocus also checks
that focus has not moved since scheduling. The test explicitly sends a
synthetic textarea click while More is open and requires it to stay open.
`source-trace/` retains the stack and six repeated menu runs. Some of those
runs used the pre-fix handler; they are diagnostic evidence, not final acceptance.

That full attempt also failed one draft-switching case. Three focused repeats
passed afterward; the final full run remains the acceptance check. No draft
failure is silently excluded or attributed to the menu fix without proof.

The first fresh-container focused run started before HTTP readiness and failed
all three navigations with connection reset/socket errors. After version200,
the held-request case passed and both nested-menu fixtures found SD disabled.
They now enable the native control through Settings. The first tracing attempt
failed only its diagnostic writer after a reload cleared page globals; traces
are now captured before reload. These attempts remain separate from acceptance.

## Acceptance

Final source full run:61pass/4fail in9.3minutes, both live cases passed.
The four failures were old phone fixtures expecting More to remain open after
an outside click. Updated fixtures assert closure, then reopen before the next
native tool. All four passed at320/390/448/768px in26.7seconds with unchanged
runtime. Final nested keyboard menu pair passed in30.7seconds. No case was
excluded.425units, root lint and actionlint passed; test lint0errors/33warnings.
Temporary setter tracing was removed; captured evidence remains. Exact union:
source-acceptance.json. Published-image acceptance must run all65 together.

Source and actual-image results are recorded separately in their JSON summaries.
The actual image must use five fresh synthetic volumes with no source overlays.
Both live Juiced cases, all existing screen/settings/recovery cases and the new
desktop/Pixel touch menu cases must pass. Inspect the final open/dismissed renders.

Browser emulation does not qualify physical Pixel hardware, phone lock,
microphone hardware or audible speech quality. Native ARM64 startup gates do
not establish ARM64 browser acceptance. Console/network fault fixtures are
reported separately from uncaught page errors.
