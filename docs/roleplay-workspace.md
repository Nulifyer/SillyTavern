# Roleplay workspace

The workspace helps people choose a character, begin a scene, and return to their
stories. Character cards and transcripts remain compatible with SillyTavern.
The interface can change independently of the original drawer layout.

## User stories and acceptance criteria

| Story | Required behavior |
| --- | --- |
| I want to find someone to roleplay with. | Search the character library by name, description, or tags. Filter characters, groups, and favorites. Show real portraits and descriptions. |
| I want to understand a character before chatting. | Open a profile with the character premise, scenario, opening message, and existing chats. Browsing must not switch the active chat. |
| I want to begin another scene with the same character. | Start a new chat from the profile or current conversation. Keep previous transcripts. Allow a descriptive scene title. |
| I want to continue a previous scene. | Chats show the character or cast, title, last activity, and a message preview. Opening a row resumes that exact transcript. |
| I want to tidy my list without losing a story. | Archive a chat, remove it from active lists, and retain it in Archive. Restore it without recreating the transcript. Persist archive state in account settings. |
| I want to remove a chat permanently. | Confirm deletion with the scene title and character or cast. Close an active chat before deletion so its autosave cannot recreate it. Show failed operations. |
| I want several characters in one story. | Create a named cast by selecting character portraits. Show cast members in the profile and conversation. Retain the native group reply and member configuration. |
| I want an illustration of the scene. | Expose scene, portrait, and custom-prompt generation beside the composer. Use the installed image extension and its configured provider. Explain configuration when unavailable. |
| I want to hear the characters. | Expose reading the latest reply and playback controls beside the composer. Use native TTS voices, providers, and group voice mapping. Make voice configuration reachable. |
| I want to adjust behavior without losing my place. | Group model, generation, persona, lore, image, voice, appearance, and extension settings on one Settings page. Keep all native controls available. |
| I want to roleplay on my phone. | Library, profile, chat lists, cast selection, and settings fit narrow screens. Navigation overlays the page. Keep composer actions usable without horizontal scrolling. |

## Reference review

Reviewed T3 Code at commit `d720210996a514368ba99f4860063110033d93fa`.
Its [sidebar](https://github.com/pingdotgg/t3code/blob/d720210996a514368ba99f4860063110033d93fa/apps/web/src/components/Sidebar.tsx)
places thread lifecycle operations in contextual menus.
Its [composer surface](https://github.com/pingdotgg/t3code/blob/d720210996a514368ba99f4860063110033d93fa/apps/web/src/components/chat/ComposerSurface.tsx)
keeps the writing area and related controls together.
Its [message timeline](https://github.com/pingdotgg/t3code/blob/d720210996a514368ba99f4860063110033d93fa/apps/web/src/components/chat/MessagesTimeline.tsx)
handles scrolling separately from the composer.
These structures inform our conversation layout and contextual actions.
Coding-specific controls do not belong in the roleplay workspace.

Open WebUI's [archive documentation](https://github.com/open-webui/docs/blob/main/docs/features/chat-conversations/data-controls/archived-chats.md)
describes archiving as hiding a conversation while retaining its contents.
Its archive offers search, restore, and permanent deletion.
Our Archive uses the same lifecycle distinction and has a direct navigation entry.

These are source observations and design references, not a usability study.

## Information architecture

```text
Sidebar                  Main view
SillyTavern              Characters: search, filters, portraits, profile
New story                Chats: scene title, character/cast, preview, actions
Chats                    Archive: search, restore, delete
Characters               Profile: continue/new, scene history, expandable card details
Archive                  Conversation: cast identity, transcript, composer
Recent scenes            Settings: grouped destinations into native controls
Settings
Model connection
Active persona
```

Character browsing is a page, not an editor. Editing a card is an explicit profile
action. A profile separates **Continue** from **New story** so the user chooses
whether to resume an existing scene or create another transcript.

The conversation header identifies the character or cast and the current scene.
Its menu owns rename, archive, and delete. Image and voice actions belong near the
composer because they act on the current scene. Settings are reachable from those
actions when a provider or voice needs configuration.

## Visual direction

Keep the approved dark slate and lavender palette from `workspace-design.md`.
Character portraits carry the identity. Reduce navigation to everyday tasks.
Use a readable central transcript and quiet chrome around the story.
Use Noto Sans for controls and chat, and Georgia for library and profile headings.
Align text left and keep touch targets at least 44 pixels where practicable.

```text
Desktop: sidebar | header and full library/profile/chat page
Phone:   menu and title | one page | composer and scene tools in chat
```

The first shell put every configuration drawer in navigation and selected chats
immediately from character cards. This revision removes that navigation density
and adds a profile step. It gives scene history and lifecycle operations their own
presentation rather than relying on the original composer menu.

## Ownership

The shell owns views, focus, responsive navigation, and presentation.
One workspace chat module owns transcript indexing and archive preferences.
Native character, group, chat, provider, image, and TTS modules own their actions.
Archive preferences store identifiers only. Transcript contents remain in their
existing files. Do not create another generation pipeline or character database.

The native recent-chat endpoint currently enumerates transcript files. The
workspace reuses it. Large libraries may need a server index later; avoid
per-message requests and keep indexing separate from message rendering.
