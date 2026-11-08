# AI Dungeon

Reviewed 2026-11-08. AI Dungeon targets freeform roleplay and interactive storytelling. Its primary unit is an Adventure started from a reusable Scenario. Source identity was checked through the [product homepage](https://aidungeon.com/), which links to the help domain, and its [linked terms](https://help.aidungeon.com/terms-of-service), which identify Latitude, Inc. as operator. The review began at the [Guidebook](https://help.aidungeon.com/).

Evidence is public official documentation only. No account, generated output, app interaction, device test, or source-code inspection was used. Benefits below are untested design inferences. Documentation establishes advertised workflows, not their reliability or current visual quality.

## Supported strengths

- Scenarios expose their Story Cards before play, with search and type filters for characters, places, and lore. Starting one copies its setup into a new Adventure. This gives players a way to understand the premise before committing. [Scenario documentation](https://help.aidungeon.com/faq/what-are-scenarios). Character Creator uses creator-defined choices and separate player-facing Notes and AI-facing Entry text. This can explain an option without forcing its entire prompt into onboarding. The docs warn that generated Plot Essentials can contain mistakes. [Character Creator](https://help.aidungeon.com/faq/whats-the-difference-between-scenarios-and-worlds).

- Saved content has explicit types and recovery operations. My Stuff separates Scenarios and Adventures, offers search and bookmarks, and supports Duplicate for experiments. Trash supports Restore before permanent deletion. These mechanisms should reduce the effort of finding an exact story and protecting an alternative version. They do not establish a visual branch tree. [My Stuff](https://help.aidungeon.com/faq/my-stuff).

- Recovery works at the text being read. Players edit previous inputs and outputs directly, and Retry retains alternative generations in a Retry Stack. Undo and Redo cover session actions. This should make small corrections cheaper than regenerating an otherwise usable response. [How to play](https://help.aidungeon.com/faq/how-to-play). For empty outputs, official troubleshooting distinguishes settings, scripts, and model problems, with script ERROR badges and Raw Model Output for diagnosis. [Generation troubleshooting](https://help.aidungeon.com/faq/the-ai-isnt-generating-anything-why-is-that).

- Memory has inspectable components. Auto Summarization maintains an editable Story Summary, while Memory Bank retrieves summarized past events. [Memory System](https://help.aidungeon.com/faq/the-memory-system). View Context opens from the latest response and shows how components consume context. [Context guide](https://help.aidungeon.com/how-do-i-manage-context). Inspect Input exposes the last text sent to the AI, and Context Warning flags components that did not fit. This can make continuity failures explainable rather than mysterious. [System settings](https://help.aidungeon.com/understanding-settings).

- Model choice has a shortcut, while tuning sits in Model Settings. Settings persist separately for each model; available controls vary. This should let frequent users switch models without repeatedly configuring them. [Model switching](https://help.aidungeon.com/faq/how-do-i-change-the-ai-model-im-using). Documented controls include context length, temperature, Top-K, Top-P, and penalties. [Model settings](https://help.aidungeon.com/faq/what-are-advanced-settings).

## Tradeoffs and unknowns

Undo only covers actions since the last refresh. Retry can consume credits. Duplication supports separate experiments, but checkpoint ancestry and durable branch navigation remain unestablished. [How to play](https://help.aidungeon.com/faq/how-to-play), [My Stuff](https://help.aidungeon.com/faq/my-stuff).

Story Card JSON import fully overwrites existing cards. The docs explicitly require backups. Import/export is web-only, including mobile browsers, and unavailable in native iOS and Android apps. Adventure text can download as a ZIP, but complete state restoration, character-card compatibility, and cross-tool round trips were not established. [Card transfer](https://help.aidungeon.com/story-cards-import-and-export), [download settings](https://help.aidungeon.com/understanding-settings).

Mobile apps and mobile web are documented, without usability testing. Cloud models and account storage are documented; offline play is explicitly unavailable. A supported self-hosted application and arbitrary external model endpoints remain unknown. [Getting started](https://help.aidungeon.com/getting-started). Context capacity depends on model and membership. [Model settings](https://help.aidungeon.com/faq/what-are-advanced-settings). See mode and an image-model selector are documented; voice configuration was not established. [System settings](https://help.aidungeon.com/understanding-settings). Multiplayer uses human participants and host model settings, which does not establish independently scheduled AI character groups. [Multiplayer](https://help.aidungeon.com/faq/do-you-support-multiplayer).

## Patterns to consider

These are proposals, not implementation commitments or claims that the fork lacks native equivalents.

1. Put premise and optional lore inspection beside the start-story action. Keep player explanations distinct from model instructions.
2. Keep reusable setup and exact saved stories visibly distinct. Make duplicate and restore actions easy to understand.
3. Link a response to its actual context, included lore, and capacity warnings through existing native controls.
4. Keep model switching close to play, with deeper controls retaining model-specific values.

Do not copy replacement-only import without a preview, backup, and explicit replacement choice. Do not imply session Undo is durable history. Avoid a random Quickstart that can combine incompatible character choices, a limitation the Character Creator documentation acknowledges.

## Source index

The six central workflow sources are below. The companion JSON indexes supporting sources and capability limits.

- [Scenarios](https://help.aidungeon.com/faq/what-are-scenarios)
- [My Stuff](https://help.aidungeon.com/faq/my-stuff)
- [How to play](https://help.aidungeon.com/faq/how-to-play)
- [Memory System](https://help.aidungeon.com/faq/the-memory-system)
- [Context guide](https://help.aidungeon.com/how-do-i-manage-context)
- [System settings](https://help.aidungeon.com/understanding-settings)
