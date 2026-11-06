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
