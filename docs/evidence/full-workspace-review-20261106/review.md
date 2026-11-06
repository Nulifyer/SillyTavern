# Full workspace review

The review uses local synthetic containers only. Production69 and shared test85
were never accessed. Baseline8017 is the unmodified v1.19.11 image. Source8018
has disjoint fresh volumes and read-only source mounts. The baseline source is
e5deb86f2; its application files match v1.19.11 source78bca347.

## Workflow direction

The user wants to choose a character, start writing immediately, and optionally
configure other model services. Experienced users must retain native prompts,
sampling, provider profiles, extension settings and classic layout. This is a
product assumption from the request, not a usability-study result.

| Task | Context and next action | Confirmation and recovery |
| --- | --- | --- |
| Begin a scene | Character profile explains identity/premise; Start new story opens the native transcript directly | Automatic native filename; Rename afterward. Previous files remain in Stories |
| Connect services | Servers verifies one address; each service selects its own model, relevant instructions and overrides | Selection is separate from applied native configuration. Failed discovery/apply retains settings and offers retry |
| Tune an existing setup | Category navigation, common controls, Advanced controls and All controls | Native owners retain values; classic layout restores the original controls |
| Find a conversation | Stories, Archive and profile history share exact transcript identity | Loading and errors must not imply an empty history; cached rows stay available; retry updates the same list |
| Use an editor or dialog | The active editor owns keyboard dismissal before the surrounding settings page | Close returns to the same page without losing the native control tree |

## Baseline coverage

[baseline-settings-index.json](baseline-settings-index.json) maps all16 settings
destinations to101 retained captures. The independent reviewer inspected1280px
normal,768px Advanced,390px normal/Advanced, plus targeted320px,150% text and
320×420 expanded editor states. Long forms were scrolled fully at768px. This is
not every viewport/mode combination or every alternate-provider form.

The parent also walked onboarding, library/profile, title modal, story history,
Stories, Archive/Restore, search, conversation, scene details, creative tools,
image options and character creation in the actual baseline image. Matching
`baseline*.png` files retain those states. Automated checks separately establish
action behavior; captures alone do not establish successful saves or inference.
The native account popup was visually reviewed on phone; multi-account features
are disabled in the fresh configuration. Account resets, backup restore and
administrator mutations were not executed.

## Findings and corrections

| Severity | Screen/state and evidence | Impact | Correction |
| --- | --- | --- | --- |
| Major friction | Profile Start new story; baselineTitleSnapshot.png | Mandatory optional-title dialog interrupts writing | Call native story owner directly; keep Rename afterward |
| Major | Profile history after synthetic503; baselineHistoryFailure.png | Failure appears as an empty archive or silently stale history | Shared history loading/error/retry state; preserve known rows |
| Major | Native Advanced Definitions Escape; baseline-settings/advanced-definitions320-afterEscape.png | Underlying Settings closes while editor stays floating | Native keyboard owner declares active Escape targets before workspace handling |
| Major | Dictation file upload; baseline-settings/dictation1280-normal.png | Plain prose label is not a keyboard-operable action | Native Choose audio file button; shared status and limits |
| Major friction | Images provider at approximatelyy1654 on390px | Dependent tuning appears before connection setup | Provider disclosure directly follows discovered service setup |
| Major friction | Blank Character editor; baseline-settings/character-editor1280-normal.png | Create submit is an unlabeled icon among secondary actions | Label and emphasize the existing native submit; explain existing-character autosave |
| Minor | Phone settings rail approximately1813px wide | Categories are hidden offscreen; headers consume first viewport | Grouped native category picker and compact header; same Done button stays in the phone bar |
| Minor | Settings global header still says Characters | Current location is misleading | Settings title and active category; hide underlying story header actions |
| Minor | Model/voice choice after a successful apply | Old Saved message remains attached to an unapplied choice | Pending-choice feedback; read applied state from native provider owners on changes/return |
| Ownership | Extensions has collapsed Dictation but visible endpoint overrides | Native collapse no longer controls its whole form | Adopt fields inside native drawer content |
| Minor | Scene backgrounds390px retains five columns | Names and menus are difficult to distinguish | Two phone columns and larger menu targets |
| Minor | Profile/prompt icon targets | Some controls measure24–28px wide or16×18px | Native workspace action/expansion targets grow for touch |
| Polish | Composer tools phone; baselineChatToolsPhone.png | Native anchor margins create horizontal menu scrolling | Reset margins at the workspace menu owner |
| Major | Enlarged chat tools at320×568; sourceTools150.png | Top actions hide behind header and long labels scroll horizontally | Menu height follows its anchor/header; labels wrap, including native menu anchors |
| Major | Rapid start on a fresh character; double-start-browser.log | Double-click creates two transcripts | Shared synchronous creation guard and native double-click suppression; regression covers profile and header |

## Boundaries

The baseline reviewer exercised navigation, normal/Advanced toggles, scrolling,
font scaling/restoration, expanded editor dismissal, Advanced Definitions Escape,
and opening/cancelling the audio chooser. Alternate paid providers, physical
microphones, audible quality, account administration, extension installation and
external destructive actions remain unqualified. No credentials are fabricated.
Live Juiced acceptance and release-image results are recorded separately when
complete. A discovered connection is not proof that every model accepts every
assembled story prompt.

## Current result

The independent final critique reports no remaining supported objection in its
reviewed states. [final-critique-index.json](final-critique-index.json) retains22
captures,11 final proof selections, measurements, hashes and superseded findings.
It verifies320px/native150% text and the320×420 expanded editor. It does not claim
to cover inference or release acceptance. The source menu/rapid-start findings
were subsequently verified by the parent's focused browser regressions. The
parent inspected the repaired menu at320×568/150% text; it begins below the
header and has equal227px scroll/client widths, with vertical scrolling for
the remaining actions. See sourceTools150After.png.

The first38-case source pass had37 passes and a streaming-test setup failure.
The test now explicitly enables native streaming. Its next full pass succeeded
with38 cases, including both live Juiced cases. The subsequent rapid-start guard
has a separate before/fix regression. The final frozen source run passed all38
cases in5.1minutes, including both live Juiced cases, with no uncaught page
errors. Lint,424unit tests and actionlint pass. Exact failed attempts remain in
the logs. Source hashes still match frozen-source.sha256. Publication and actual
image acceptance are pending.

The release excludes docs/evidence from its Docker context. Dockerfile copies
the repository; these retained browser artifacts are review material and are
not needed by the runtime. Public assets, licenses and native build/startup
gates remain part of the normal release process.

Text logs normalize terminal escape codes and trailing spaces. Error text, result
counts and structured browser diagnostics are retained.

## Published-image follow-up

v1.19.12 was published fromc78f9f5e312dfcbbe3df1c02b55456af427a3873 by
[workflow42263052988](https://github.com/Nulifyer/SillyTavern/actions/runs/42263052988).
Both native architecture startup gates passed. Its actual pulled image on8019
has five fresh volumes, no overlays, valid heartbeat and version1.19.12.
[Registry proof](v12-registry/image-proof.json) records its immutable digests.

An added native-mode check reproduced a further selection defect on that image:
captioning set to Current story model still showed the old separate vision
model as Saved. Native request code uses the story model in this mode
(`extensions/shared.js:111`). The failed assertion and screenshot are retained in
v12-native-vision-ready-browser.log and v12-native-vision/. The initial attempt
ran before HTTP readiness and returned ERR_CONNECTION_RESET; the ready retry
establishes the actual UI defect.

v1.19.13 corrects the derived model for both native caption modes and qualifies
optional writer profiles by mode/API. It removes a redundant writer-selection
assignment. Source focused checks pass. v1.19.12 is not the final deployment
recommendation; its tag is preserved. Final39-case source and published-image
acceptance are pending.

The pending-reply keyboard extension also reproduced Escape activating Stop
behind an inert mobile sidebar on the actualv1.19.12 image. It left navigation
open and produced an uncaught `Clicked stop button` rejection. Native Escape
ownership now excludes inert ancestors, preserving both sidebar/inspector
dismissal and the active reply. Explicit Stop had the same uncaught rejection;
the interactive cancellation owner now completes its cleanup without reporting
a failed reply. Quiet API callers retain rejection. Source streamed/nonstreamed
Stop and pending navigation regressions pass; actual final-image acceptance is
pending. Reproduction logs/screenshots are retained in v12-pending-escape/ and
v12-stop-reply/.

The independent source critique identified the native cast queue's additional
cancellation boundary. A two-member list-order regression reproduced uncaught
`AbortSignal was fired. Group generation stopped` before the correction. Generate
now handles that delegation through its existing error owner and captures the
request signal instead of consulting a later mutable controller. Quiet callers
still reject. The focused three-case native vision/pending navigation/cast Stop
run passes. The full final42-case source run is in progress.

The final source run's first case inherited the deliberately failed cast-stop
fixture: its companion and cast also mention Seraphina. Search correctly matched
all three. The test had assumed one matching card. It now chooses the exact
Seraphina profile by accessible name. The failure is retained and does not
establish an application search defect. Fresh actual-image acceptance must use
the corrected test and pass all42 cases.

The final application source run completed41passes/1search-fixture assertion
failure in8.4minutes, both real Juiced cases passing. All42diagnostics have zero
uncaught page errors. The sole failure was the one-result assumption described
above; an exact-name focused rerun and final actual-image42-case pass are the
acceptance checks for the corrected fixture. Runtime source hashes remain
frozen.

v1.19.13 source607198579bb3090dcda68c34aab252d2558c5647 is published;
workflow42270651338 is running. Source push and annotated tag push succeeded.
The first gh release attempt selected upstream by local CLI default and safely
failed tag verification; explicit -R Nulifyer/SillyTavern created the intended
fork release. No upstream release was created. Actual-image acceptance pending.

The cast-stop screenshot initially caught the asynchronous header before its
refresh. Added explicit generation-status hidden and Image enabled assertions
passed on unchanged application source (cast-state-final-browser.log,1pass).
This was not evidence of a persistent application state defect. The stronger
assertions will also run in actual-image acceptance.

Workflow42270651338 completed successfully, including both native startup and
heartbeat gates. Anonymous pull and registry proof establish index/architectures
and matching version/source/latest tags (v13-registry/). Actual local8020 matches
24runtime files and stockv1.19.8 sd.cpp handler, has five fresh volumes/no overlays,
reports1.19.13 and reaches Juiced over verified HTTPS200. Parent inspected the
desktop/phone onboarding and completed its native persona Save. One initial
preview navigation preceded HTTP readiness and returned ERR_SOCKET_NOT_CONNECTED;
HTTP-ready retry succeeded. The phone screenshot was repeated after resize
settled and Save is visible/hit-testable. Final browser acceptance is running.

The actualv1.19.13 image passed42browser cases in5.4minutes, both live cases,
zero uncaught page errors. Subsequent pixel inspection of its character editor
revealed overlapping action controls/tags/Creator's Notes at390px; parent
reproduced this interactively after layout settled (v13-character-overlap-phone).
Native100% heights plus the workspace's mobile flex wrapping let the actions
flow outside the avatar row; the form's grid also retained a fixed100% height.
The next immutablev1.19.14 scopes this native form to natural height/overflow,
uses a96×120 portrait and lets native actions, More and tags take their own
space. No model/protocol code changes fromv1.19.13. A new eight-viewport/scale
character-layout regression supplements width-only checks; final actual-image
acceptance must run43cases. The prior42-pass result does not disprove this
visual defect. Independent source re-review requested before publication.

The new character-layout case fails against the actualv1.19.13 image because
the toolbar extends below its owning avatar block, and passes all eight
width/scale combinations on corrected source in10.2seconds. It also opens and
dismisses Advanced Definitions at every size. The first focused attempt selected
a hidden character-editor destination directly; the corrected fixture enters
through the character profile, as a user does. Both attempts are retained.
Parent inspected every actualv1.19.13 phone settings capture, normal mode, plus
advanced speech and the corrected source character actions. No other supported
overlap was found in those captures. The new full source43-case run omits the
two opt-in live cases because only CSS changed; the actualv1.19.14 run will
enable both. Priorv1.19.13 actual-image live proof remains retained.

Independent re-review found the character name shortened to S... at320px/150%
because token statistics consumed its row. The phone header now gives identity
a full wrapping row above statistics. The strengthened eight-state character
regression passes in10.1seconds on final CSS. Parent inspected320px/150% and
1280px renders. The controlled source run passed41cases/2opt-in live skips in
4.5minutes, zero uncaught errors in retained diagnostics. The header correction
has its separate focused pass; no inference code changed. These runs briefly
overlapped in separate browser contexts with per-context mock settings; no
standalone persistence claim is based on them. Final published-image acceptance
will run all43 with both live cases, followed by standalone persistence.

The independent final character critique retains28captures and16Edit/Create
width/scale measurements (character-critique-index.json). It freshly verified
the final CSS hash53e6b47d8d7d88c405a342cbd09c4bdbe2322371c16402ccbe8e1722dd7dfa67,
full320px/150% identity, native Advanced Definitions/Escape, and representative
Connection Profile, Presets, Appearance and sampling rows. It reports no
remaining supported overlap or critical usability defect within those states.
Its CSS-only font override was removed and tab6 closed. No further source
change is supported. Final image acceptance remains.
