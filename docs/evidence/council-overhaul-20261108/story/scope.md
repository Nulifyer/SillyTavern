# Story council proposal

I propose one connected authoring journey. A reader opens the exact story, understands its current premise and memory, investigates a surprising reply, corrects the right definition, and explores another direction without losing the original. Scene details should be the optional entry point. Ordinary character chat and immediate Start new story remain the default.

This proposal is based on repository source and the completed public-source research. It is not a rendered UI finding or a claim that competitor workflows were tested.

## Outcomes and owners

1. Scene details identifies this exact story and character or cast. It shows the effective premise, whether it comes from this story or the reusable character, and a native story-override editor. The native `setCharacterSettingsOverrides` operation owns `chat_metadata.scenario`, examples and system-prompt changes. Character editing must be labeled as affecting the reusable card.
2. Scene memory shows the effective native summary, its message anchor where known, attached lore sources and useful links to the native summary, World Info, Author's Note and retrieval controls. Generated summary, authored material and retrieved context remain distinct. Disabled, empty and unavailable extension states must say what they mean. Opening this view never requests inference.
3. Reply context distinguishes a recorded generation from today's setup. The view should explain the available model and context contributions in readable language, retain native advanced prompt access, and label captured, reconstructed and unavailable stages. It must never imply that current lore or the current summary necessarily appeared in an earlier response.
4. Branch relationships expose the native parent and linked branches beside the active story, with exact transcript navigation. Existing native branch actions preserve the selected swipe. Explain that a branch copies transcript content and chat metadata, while shared character, lorebook, provider and preset settings remain shared. Missing or ambiguous ancestry must not be guessed from title suffixes.

`WorkspaceChats` continues to own transcript indexing and archive identity. Native chat/group/bookmark owners retain reads, writes, branch creation and activation. Workspace modules present state and controls. A small native export for summary state is preferable to copying memory-selection rules into workspace code.

## Why these belong together

The 20-product comparison covers many unrelated capabilities. The strongest shared pattern is giving writers a way to understand and change story continuity. RisuAI links summaries to source material. Agnai distinguishes conversation-only overrides from character changes. Chub and RisuAI expose related conversations. NovelAI, AI Dungeon and Voxta distinguish prompt composition and diagnostics. These are useful mechanisms, not evidence that their usability or recall is better.

The fork already has the underlying operations. `workspace.js` currently presents identity and links in `renderInspector`; `workspace-chats.js` identifies records with entity kind, avatar or group ID, and filename. `script.js:9058` owns native story overrides. `bookmarks.js:168` snapshots through a selected message, optionally selecting a swipe, and stores `main_chat` plus parent message links. `memory/index.js:357` chooses the current summary differently from a naïve reverse scan. `script.js:7457` merges current chat metadata into branch saves. These observed owners argue for integration rather than replacement.

## Required acceptance

- Start a story with one action and no required naming, setup, memory or voice step. Continue an existing story from profile, Stories and search by exact identity.
- Two characters and a cast can have the same filename without memory, context or ancestry crossing owners.
- A story-specific premise edit survives reload and leaves the shared card and a sibling story unchanged. Removing the override restores the shared premise. The screen states the real save and dismissal behavior.
- Summary correction uses the native owner, survives reload and stays in its story. Disabled, unavailable, empty and out-of-date states do not claim recall success. Failed persistence is visible and must not be called saved.
- Opening memory or context preserves the mounted message nodes, draft and selection, current story and inference count. An old response remains distinguishable from current configuration after model or premise changes.
- Branch navigation covers character and cast stories, selected swipe, nested branches, legacy stories, archives, deleted parents and rename. A missing or obsolete target reports failure while keeping the current transcript and draft. Renamed links either resolve through supported identity or explicitly report unavailable; no same-title guess.
- At 320, 390 and 448 CSS pixels, enlarged text and reduced keyboard height, a reader can identify the story, use the editors, navigate ancestry, dismiss the view and return to the same draft. Keyboard focus and Escape follow existing native popup ownership.
- Advanced controls, exact model identifiers, manual settings and classic layout remain available. Existing tab suspension, narration, dictation and manual-image behavior remain intact.

## Exclusions

No creation wizard, mandatory scene picker, frozen copies of all character/world settings, new memory store, regenerated recap workflow, branch graph canvas, prompt assembly engine, model registry, inference proxy, automatic summary generation on opening, paid-service test requirement, export overhaul, realtime voice, marketplace or production access. A flat related-story list with honest origins is sufficient; a full graph is not required.

## Risks and unknowns

Native ancestry is filename based. A rename can leave an old `main_chat` or `extra.branches` target. The parent should establish actual rename behavior before promising permanent ancestry. Broken links may be shown honestly, but a newly created branch should have useful navigation in both directions.

The native summary is stored on message extras and can be paused independently of whether a summary exists. Its anchor is not proof that every original event is accurately represented. Do not fabricate a covered message range.

The native override popup currently commits pending fields after dismissal. If this editor is exposed prominently, its controls and copy must accurately communicate confirmation and cancellation. A new Cancel button that still saves would fail the ordinary correction journey.
