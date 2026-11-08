# Nomi

Reviewed 2026-11-08. Nomi targets ongoing AI companionship, including friendship, romance, and fantasy roleplay. Official identity is supported by the [homepage](https://nomi.ai/) linking to Nomipedia and the [terms](https://nomi.ai/terms-of-service/) naming Glimpse.ai, Inc. as platform owner. This is public documentation research, not a hands-on evaluation. No account, inference calls, production access, purchases, or browser automation were used. Expected benefits below are inferences, not tested outcomes.

## Supported strengths

1. Character creation asks for relationship type, name, traits, interests, and appearance before chatting. Optional Shared Notes add identity and roleplay context later. This separates an approachable starting point from detailed authorship. The expected benefit is less setup before discovering whether a character works. The [beginner guide](https://nomi.ai/nomi-knowledge/nomi-101-a-beginners-guide-to-getting-started-with-your-ai-companion/) dates to 2024, so its exact labels and layout may be stale.

2. Roleplay Starters turn uncertainty into an editable premise. The documented flow is `+` → `New Roleplay`, choose a category or enter an idea, review generated options, adjust one, then begin. Suggestions use Backstory, recent conversations, and previous roleplays. This could reduce blank-composer friction while letting the user approve the scenario. Clearing `Current Roleplay` ends that framing. This does not establish a separate archived story or branch. [Roleplay Starters](https://wiki.nomi.ai/How_do_I_use_Roleplay_Starters%3F)

3. Mind Map 2.0 makes part of learned context inspectable through a graph and a searchable, sortable table. Users can edit or add topic dossiers. Each individual chat and group has its own map. This could help diagnose mistaken relationships or missing lore without guessing through conversation. Initial automatic formation can take roughly 500+ messages, according to the announcement. [Mind Map 2.0](https://nomi.ai/updates/mind-map-2-0-bringing-nomi-memory-into-view/)

4. Group chat combines a shared Backstory and Mind Map with manual next-speaker selection or Auto-play. One Nomi can join multiple groups. Setting the scene and cast roles at group level could make ensemble stories easier to direct. Nomis do not have full access to each other's individual Backstory+, so common facts need explicit group context. [Group chat documentation](https://wiki.nomi.ai/How_does_group_chat_work%3F)

## Tradeoffs and unknowns

Nomi prioritizes companion continuity over direct transcript authorship. Its current FAQ explicitly says users cannot delete Nomi messages or reroll them. The older guide also rejects editing and regeneration, recommending `(OOC:)` corrections instead. This adds a conversational recovery path, but does not provide deterministic replacement of a bad turn. Exact-history checkpoints, branch navigation, and transport-failure recovery remain unestablished. [Message policy](https://wiki.nomi.ai/Can_I_delete_my_Nomi%27s_messages%3F), [guide](https://nomi.ai/nomi-knowledge/nomi-101-a-beginners-guide-to-getting-started-with-your-ai-companion/)

Mind Maps are dossiers, not the underlying memories. The wiki says those memories cannot be inspected, edited, or removed by users. Dossiers can update automatically or be locked, and the system recalls relevant entries dynamically. Thus, an editable map is partial transparency, not evidence of a complete prompt or per-response context inspector. Custom model endpoints, sampler settings, context budgets, and system-prompt editing were not established. [Memory distinctions](https://wiki.nomi.ai/Are_Mind_Map_Entries_Memories_And_How_Are_They_Unique)

The guide documents contextual selfies, separately prompted art, voice messages, and an ElevenLabs integration. Current homepage copy also advertises hands-free calls. Output quality, latency, present integration details, and failure states were not tested. [Guide](https://nomi.ai/nomi-knowledge/nomi-101-a-beginners-guide-to-getting-started-with-your-ai-companion/), [homepage](https://nomi.ai/)

The platform FAQ documents web, iOS, Android, and a PWA. This establishes availability, not responsive quality or feature parity. Local operation is explicitly unsupported. Migration documentation describes reconstructing identity and history with Backstory+ and Mind Maps, not direct transfer. Native transcript export, standard character-card import, and round-trip backup were not established. [Platforms](https://wiki.nomi.ai/What_platforms_does_Nomi_support%3F), [local operation](https://wiki.nomi.ai/Can_I_run_Nomi_locally%3F), [migration](https://wiki.nomi.ai/How_do_I_move_another_AI_to_Nomi%3F)

## Proposals for the fork

- Offer editable premise suggestions beside the existing new-story action. State whether accepting one creates a story or changes the current story.
- Make remembered lore searchable and correctable. Separate authored facts, generated summaries, and context selected for a reply.
- Keep a simple character setup path, then expose detailed premise and behavior fields when needed. Preserve native advanced controls.
- Keep cast roles and shared scene facts beside group speaker controls. Explain which facts belong to the story and which follow the character.

These are proposals, not implementation commitments. Do not copy the ban on transcript correction, the implication that editing a dossier repairs all memory, or claims of human-level recall without evaluation. Do not treat an attractive memory graph as a substitute for searchable text or exact-story recovery.

## Source list

Core workflow references are the beginner guide, Roleplay Starters, Mind Map 2.0, and group-chat documentation linked above. The linked terms and targeted FAQs establish identity, restrictions, mobile availability, and migration limits. These sources describe intended behavior, not verified reliability.
