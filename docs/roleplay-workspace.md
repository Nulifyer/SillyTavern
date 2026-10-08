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
| Character profile | Understand the premise and choose a scene. | Start new story. | Identity column has portrait, description, and edit. Content shows premise, expandable opening/card details, latest-story preview, and active/archived history. Continue opens that exact file. |
| Cast profile | Understand who is in the story. | Start a cast story. | Show member portraits and profiles. Edit cast exposes native reply order, activation, and member controls. |
| Conversation | Write the next turn and read the reply. | Send, or stop while generating. | Header shows story title and character/cast. Portrait opens scene details. History and story menu manage the current scene. Composer tools act on this scene. |
| Scene details | Change the story context without replacing the conversation. | View character/cast context. | Member profiles, persona, lore, writing settings, backdrop, and story actions. Close returns focus to its trigger. |
| Archive | Keep completed stories without losing them. | Restore a story. | Search, read archived transcripts, rename, confirmed permanent delete. Restore enables the composer for new turns; native message actions remain available. |
| Settings overview | Find the right configuration task. | Choose a labeled category. | Writing, story world, workspace, and creative tools. Automatic tool preferences are secondary. |
| Settings category | Configure a provider or behavior. | Use the full editing area; Done returns to the previous screen. | Persistent category navigation. Every native control remains available. Voice/image categories isolate their extension settings. Desktop has a category column; phone has a scrollable category strip. |
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
