# Roleplay workspace

The workspace helps people choose characters, write scenes, and manage exact transcripts.
Character cards, providers, extensions, and stored stories remain compatible with SillyTavern.

## Design review

Reviewed on October 8, 2026. These are design references and source observations,
not evidence from a user usability study.

[Linear's redesign](https://linear.app/now/how-we-redesigned-the-linear-ui) explains
its persistent navigation and clearer hierarchy. Its product screenshot was inspected.
Use quiet navigation, distinguish the selected item, and put contextual actions beside content.
Do not reproduce its issue-tracking controls.

[NN/g progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/)
separates frequent actions from specialized options. Voice and scene illustration belong
in the chat. Provider setup and prompt formatting belong in Settings.
[Recognition rather than recall](https://www.nngroup.com/articles/recognition-and-recall/)
informs explicit labels, character portraits, story previews, and visible state.

Reviewed T3 Code commit `cdd331b6c3f78bf24b039b09937b837d2d71a4e7`:

- [MessagesTimeline](https://github.com/pingdotgg/t3code/blob/cdd331b6c3f78bf24b039b09937b837d2d71a4e7/apps/web/src/components/chat/MessagesTimeline.tsx)
  memoizes the timeline and rows. It remembers position by thread and separates manual navigation from live following.
- [ComposerSurface](https://github.com/pingdotgg/t3code/blob/cdd331b6c3f78bf24b039b09937b837d2d71a4e7/apps/web/src/components/chat/ComposerSurface.tsx)
  separates the input, attached context, and secondary controls.
- [Connection runtime](https://github.com/pingdotgg/t3code/blob/cdd331b6c3f78bf24b039b09937b837d2d71a4e7/docs/internals/connection-runtime.md)
  gives live connection and thread state a shared owner, independent of presentation.

Apply these principles to the existing vanilla JavaScript application. Keep native chat
and streaming owners. Preserve the mounted transcript and composer during workspace navigation.
Use keyed DOM reconciliation for browsing pages and update toolbar state without rebuilding it.
Do not introduce a second generation pipeline or migrate frameworks to imitate T3 Code.

## Screen and action contract

| Screen | User task | Primary action | Secondary actions and state |
| --- | --- | --- | --- |
| Stories | Continue an exact conversation. | Open a story row. | Search title, character, and preview. Group by recency. Show the open story and reply state. Row menu contains rename, archive, and confirmed delete. |
| Characters | Choose a character before beginning. | Open a portrait and profile. | Search premise and tags. Filter characters, casts, and favorites. Import/create are library actions. Create cast belongs beside the collection. |
| Character profile | Understand the premise and choose a scene. | Start new story immediately. | Native automatic naming; Rename is available afterward. Identity column has portrait, description, and edit. Content shows premise, expandable opening/card details, latest-story preview, and active/archived history. Continue opens that exact file. |
| Cast profile | Understand who is in the story. | Start a cast story. | Show member portraits and profiles. Edit cast exposes native reply order, activation, and member controls. |
| Conversation | Write the next turn and read the reply. | Send, or stop while generating. | Header shows story title and character/cast. Portrait opens scene details. History and story menu manage the current scene. Composer tools act on this scene. |
| Scene details | Change the story context without replacing the conversation. | View character/cast context. | Member profiles, persona, lore, writing settings, backdrop, and story actions. Close returns focus to its trigger. |
| Archive | Keep completed stories without losing them. | Restore a story. | Search, read archived transcripts, rename, confirmed permanent delete. Restore enables the composer for new turns; native message actions remain available. |
| Settings category | Configure a provider or behavior. | Use the full editing area; Done returns to the previous screen. | Servers is the entry point. Persistent category navigation retains native controls. Voice/image categories isolate extension settings. Desktop has a category column; phone has a grouped category picker and persistent Done. |
| Character editor | Create or change a card. | Native save/create/import. | Full editing canvas retains all card fields, tags, metadata, export, and group configuration. It uses the same category workspace as settings. |
| Create cast | Choose several roleplay participants. | Create cast after selecting at least two characters. | Name, searchable character selection, visible selection count. Creating the cast does not create a transcript until Start new story. |
| Search | Find a destination, character, or story. | Open a keyboard-selectable result. | Ctrl/Cmd K, arrow navigation, Enter, Escape. Story results follow the same rules as every story row. |

## Navigation and generation

Selecting the already active story is a presentation change. It succeeds during generation
or image generation without opening the file again, clearing a draft, or resetting scroll.
Recent rows, profile history, Stories, and search all use the same transcript identity check.

Browsing characters, profiles, stories, archive, and settings does not stop the active reply.
An open-story control and recent-story row provide consistent return paths.
Changing to another transcript or mutating its identity waits for native generation to stop.
Errors identify that restriction. They do not claim the current story is a different story.

The native transcript remains mounted. Workspace rendering does not replace message nodes
on connection, toolbar, index, or settings updates. Portrait and inspector contents update
only when their relevant identity changes. Native scrolling remains the streaming owner.

## Voice and images

Voice narration starts off. Its visible chat button is an `aria-pressed` toggle.
One click enables native TTS and its configured automatic narration behavior.
Another click disables TTS and stops playback. Provider and character voice mapping remain
in Voice settings. Read latest reply and playback controls are in the secondary options menu.
Persist the existing account preference; do not override an explicit previous choice.
Native chat actions and extension tools also use that labeled secondary menu. Phone
keeps voice and scene illustration visible without a second row of unrelated icons.

Illustrate scene is an explicit manual request. One click uses native scene prompt generation
and the configured image provider. It creates one illustration in the current conversation.
It does not turn on automatic image triggers, commands, or function tools.
The scene shortcut skips the optional prompt-review dialog; other native image actions
retain that preference.
Show busy state and prevent duplicate clicks or transcript switches while the request runs.
Allow returning to that same story while it runs. Show provider failures beside the composer
with a direct Image settings action. Disable scene illustration until a reply finishes.

Portrait and custom-prompt generation are secondary image options. Preserve native media
storage, provider configuration, and prompt processing. Custom prompts are text, never slash commands.
Automatic image tools remain off by default and are a separate advanced preference.

## Visual system

Use the approved slate workspace with restrained lavender selection and focus.
Palette: base `#171b26`, navigation `#121620`, surface `#202635`, border `#343d50`,
text `#e9edf5`, muted text `#a2aec5`, accent `#c0b7ff`.
Noto Sans carries interface and chat text. Georgia identifies character profile names.
Portraits carry roleplay identity. Surfaces and dividers indicate structure, with no decorative gradients.

Desktop uses persistent navigation, content, and optional scene details.
Profiles use an identity column and narrative/history column.
Settings use a category column and full-width control area instead of floating drawers.
Phone uses one content column, an overlay main navigation, and touch-sized controls.
Keep body text readable, control icons proportional, and message lines below 80 characters.
Sizing rules and primary CSS references are in workspace-ui-system.md.

## Ownership and compatibility

`workspace-chats.js` owns transcript indexing, identity, and archive identifiers.
Native character, group, transcript, image, TTS, and settings modules own mutations.
`workspace-settings.js` mounts the existing control tree and restores its native parent on exit.
It never duplicates inputs or provider state. Classic layout retains the original control tree.
Native drawer entry points route into the same settings owner. Character editing opens
from a profile or library creation action. It is not a second library under Settings.
Creative categories show provider setup first; playback and automatic-image preferences
remain available in expandable sections. Classic layout restores native menu anchors.
`workspace-tools.js` owns scene-action presentation and the manual-image busy state.
`workspace-views.js` owns browsing-page structure. `workspace.js` coordinates navigation and events.

Classic drawer auto-close handlers exclude workspace-mounted panels. Clicking a
Settings section, heading, dialog or dropdown must not change panel visibility.
Done, Escape, category navigation and layout restoration use WorkspaceSettings.

Models & connections includes one-server service discovery. ServiceConnections
owns transient setup presentation and the discovery address preference. Native
owners apply each chosen connection. Dictation owns microphone/file decoding and
draft insertion. See [model service setup](model-services.md) for endpoints,
optional services, migration and limits.

The native recent-chat endpoint enumerates transcript files. Large libraries may need a
server index later. Do not perform per-message index requests while a reply streams.

## Verification requirements

Verify exact-story return during a pending reply from recent rows, history, and search.
Check draft, scroll, and message-node identity. Other-story switches must remain blocked.
Verify one manual scene image while automatic image settings remain off.
Verify voice opt-in and disable from the chat, native persistence, and System voice mapping.
Check every settings category and all native panel identities, including classic restoration.
Inspect library, profile, Stories, Archive, chat, cast picker, Settings, and editor screenshots.
Check 320/390/768px layouts, enlarged fonts, keyboard focus, and reduced-height phone dialogs.

## Verified redesign

On October 8, 2026, lint, all 411 unit tests, and all 20 workspace browser cases passed.
The native settings control IDs survived every category at 1280px and 390px.
The v1.19.8 follow-up extends every category to 320px and checks the visible
Select2 lorebook picker width and native Escape behavior. Phone
flows passed at 320/390/768px, including larger text and reduced-height layouts.
The scene fixture generated exactly one provider request and one media message with
automatic image tools off and prompt review enabled. Voice opt-in persisted and native
System voice narration used its configured map. Pending-reply return preserved draft,
scroll, and message identity through Recent stories, Stories, profile history, and search.
Native streamed replies kept the composer and character portrait mounted.

Desktop and phone library, profile, Stories, Archive, chat, scene details, cast picker,
settings categories, and editor layouts were inspected. Checks use controlled providers;
they do not establish paid-provider output quality or audible speech quality.

## Service workspace and composer, November 2

Settings now opens directly to Servers and keeps the current story mounted.
Service destinations own model selection and relevant native prompts. Story
replies groups connection, reply controls and the prompt manager in three tabs.
Image prompts separates native purpose templates from optional writer-only
instructions. Provider/profile forms remain expandable. The redundant settings
overview and its duplicated creative-tool toggles were removed.

The composer adapts T3 Code's shell, editor surface, footer and context strip
from commit `6f41364805e31a1f8d59c18c7cc451630cd9265d`. It moves the existing
SillyTavern form, textarea and actions rather than creating another editor.
Send/stop stay inside their native form ancestry. The model name appears in the
footer; native draft, stream, extension menu and classic-layout owners remain.
Assistant text has a flat reading surface and user messages have a quieter
right-aligned bubble. Source and MIT notice: [ui-source-notices.md](ui-source-notices.md).

Context sizing and migration follow [model-services.md](model-services.md).
Reported runtime capacity takes precedence over training maximum only while
Automatic is enabled. Existing explicit limits remain manual.

## Advanced access, November 6

Simplification changes presentation and flow, not the available native settings.
Settings exposes a persistent Advanced controls switch. It expands provider
forms, native sampling/formatting sections and extension preferences without
changing their values. All controls shows section groups together. Existing
provider-specific visibility still applies. Classic layout remains available
for native drawer pinning and custom themes, alongside advanced access inside
the workspace.

## Returning to a mobile tab

Returning after a phone lock or tab switch restores the existing chat geometry
and checks connectivity without sending another prompt. Reuse native viewport
positioning, composer sizing and scroll ownership. Preserve the reader's history
position, or keep the latest line visible if already following the reply. Do not
remount messages, move focus or wait for connectivity before fixing the display.

Character responses remain in the transcript. Remove the recovered-reply panel
and the action that inserts a character response into the user's draft. Native
generation and saving own reply completion and interruption. A broken connection
stops the writing state and cast queue; received text stays in its native bubble.
The app never resends an interrupted reply automatically.

The native Restore unsent input preference controls per-story user drafts. Drafts
belong to one user, character or cast, and story; renaming carries that draft.
Existing older local reply/global-draft records remain untouched and do not open
UI. If browser storage is blocked, retain the current draft in this tab and show
a compact storage warning. A discarded tab cannot reconnect to its former HTTP
inference request.

Recording and pending microphone permission stop when the tab becomes hidden or
frozen. Dictation stays opt-in and requires another explicit recording action.
An already submitted transcription can complete after resume. Image completion
uses the same native request and does not generate a second illustration.

## Product research, November 8, 2026

The [20-product comparison](roleplay-product-comparison.md) studies memory and
context inspection, branch navigation, edit scope, onboarding and service setup.
These are proposals, not approved implementation changes or replacement design
foundations. Preserve native controls and owners. The research did not inspect
production content or test signed-in competitor workflows.

## Scene details, council-selected implementation

The optional header portrait opens Scene details while the native conversation
stays mounted. Setup & memory shows the story override or shared character/cast
source, the native effective summary and configured lore attachments. Summary
text belongs to the story; automation, prompts and insertion settings are shared.
An anchor is not a verified coverage range, and attachment is not activation.

Reply context shows bounded client diagnostics for the selected reply and
alternative. New native captures retain the recorded model, provider, preset,
context/output budgets and allowlisted client text. They are local to the browser,
limited to 60 replies and 240,000 characters each. Media/tool payloads and connection
credentials/headers are omitted. Older, edited, copied or evicted revisions show
unavailable instead of borrowing the legacy filename cache. Server conversion,
the final provider request and model templates remain unavailable.

Related stories uses native parent/origin metadata within the exact character or
cast. New branches copy the selected alternative, transcript and chat overrides;
reusable cards, lore and provider presets remain shared. Ambiguous or missing
legacy ancestry stays unavailable. Native group registration retries reuse only
an identical saved child, with no force overwrite or orphan deletion.

Native source editors and advanced settings remain reachable through one control
tree. Override Apply waits for acknowledgement; failure preserves pending fields
for retry and restores the previous in-memory setup. Cancel/Escape discard pending edits.
Archives remain inspectable and require explicit Restore before mutation. Opening
details never generates a summary, saves a transcript or changes the draft.

Native keyboard activation keeps browser buttons, links, disclosures and text
editors under browser ownership. The legacy keyboard helper activates only custom
interactables and respects an existing key handler. One Enter must never produce
a synthetic click followed by a second native click, including audio selection.
