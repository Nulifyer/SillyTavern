# SpicyChat

Reviewed 2026-11-08. SpicyChat is a hosted character-chat service for SFW and adult fantasy roleplay. Identity was cross-checked against its [root-domain landing page](https://spicychat.ai/pages), which names NextDay AI USA Inc., and documentation linking to [spicychat.ai/download](https://docs.spicychat.ai/advanced/mobile-apps.md) and [same-domain support](https://docs.spicychat.ai/support.md). This supports treating docs.spicychat.ai as first-party documentation, rather than relying on its name alone.

This is a public documentation review. No account, chat generation, purchase, device test, application interaction, or production access occurred. Benefits below are design inferences, not measured outcomes. Documentation establishes advertised workflows, not their reliability or current entitlement enforcement.

## Supported strengths

- Discovery explains a character before commitment. Search respects filters, including excluded tags. Profiles expose title, tags and greeting; creators may also reveal personality, scenario and example dialogue. Creation separates these fields and places further controls behind "Advance". This could help newcomers understand the premise without first learning prompt configuration. Hidden definitions limit that benefit. [Characters](https://docs.spicychat.ai/product-guides/characters.md), [creation guide](https://docs.spicychat.ai/product-guides/creating-chatbots.md).
- Conversation cloning supports deliberate alternatives. Users can name full or partial copies while preserving the original. Regeneration retains selectable variations, and character replies can be edited. These mechanisms could make experimentation less costly than overwriting a story. They do not establish a visible branch tree or merge workflow. [Character Chats](https://docs.spicychat.ai/product-guides/character-chats.md).
- Memory has an explicit correction workflow. Memory Manager lets subscribers add, edit, delete and pin individual memories, including automatically extracted ones. Entries have a 250-character limit. Pinning is documented as including that memory in generation prompts. This could let users repair a mistaken relationship fact directly. It does not prove that a model will obey it, and deleted memories cannot be restored. [Memory Manager](https://docs.spicychat.ai/product-guides/premium-features/memory-manager.md).
- Rulebooks make selected story state visible. Meters represent trust, currency, health or time. Rules update meters and influence character behavior at specified levels; a status line explains the current state. Templates and JSON import reduce authoring setup. This could help players understand a relationship or game mechanic without inspecting every instruction. Accuracy of automatic updates remains untested. [Rulebooks](https://docs.spicychat.ai/product-guides/rulebooks).

## Tradeoffs and unknowns

The main Chats list shows only the latest conversation per character. Older stories require entering the character's chat and opening Saved Chats. That creates a documented retrieval cost for multiple concurrent stories. More seriously, support acknowledges a history-loading failure with many saved conversations for one character. Starting a new chat is its workaround; that does not restore access to the desired story. [Chat navigation](https://docs.spicychat.ai/product-guides/character-chats.md), [known issue](https://support.spicychat.ai/support/solutions/articles/153000260620-my-chat-history-won-t-load).

Expert controls include model selection, temperature, Top-P, Top-K and response limits; some require subscriptions. The archived OpenAI-key integration explicitly ended November 17, 2025. Other external endpoints, self-hosting and a complete assembled-prompt inspector were not established. Descriptions of prompt inputs and editable memories provide partial transparency. [Settings](https://docs.spicychat.ai/advanced/generation-settings.md), [API retirement](https://docs.spicychat.ai/archive/openai-api), [generation inputs](https://support.spicychat.ai/support/solutions/articles/153000260635-how-spicychat-generates-replies).

Lorebooks document keyword-triggered context, but only one attaches per character and edits affect existing chats. Character JSON/PNG imports leave tags, visibility and advanced fields to manual completion. Rulebook JSON export is documented; chat export and lossless character migration out were not established. [Lorebook](https://docs.spicychat.ai/product-guides/lorebook), [character import](https://docs.spicychat.ai/advanced/importing-characters.md), [Rulebook transfer](https://docs.spicychat.ai/product-guides/rulebooks/import-export-and-ai).

Groups support 2 to 10 characters and manual speaker selection. They do not support TTS, conversation image generation or image sending. Group drafts stay in the originating browser and device and disappear if its cache is cleared. Single-character chat documents subscription-dependent images and voice selection, including narration. Mobile documentation specifies direct Android APK installation, no current native iOS app, and home-screen web access. Touch usability and accessibility remain untested. [Groups](https://docs.spicychat.ai/product-guides/group-chat.md), [images](https://docs.spicychat.ai/product-guides/character-chats.md), [voice](https://docs.spicychat.ai/product-guides/premium-features/text-to-speech.md), [mobile](https://docs.spicychat.ai/advanced/mobile-apps.md).

## Patterns to consider

These proposals concern presentation and safeguards; they do not imply missing native fork capabilities.

- Put premise, greeting and definition visibility beside the character's start action.
- Offer a named full or partial clone, with the preserved source clearly identified.
- Make memory correction accessible from the story, distinguishing extracted facts from user-pinned facts.
- Consider optional story meters with readable rules and inspectable changes.
- Preview imported fields and flag anything requiring manual completion before saving.

Do not copy latest-chat-only history navigation, irreversible memory deletion without recovery, or browser-only drafts without a visible persistence warning. Avoid treating hidden definitions or memory snippets as complete prompt transparency.

## Core sources

- [Characters](https://docs.spicychat.ai/product-guides/characters.md)
- [Character Chats](https://docs.spicychat.ai/product-guides/character-chats.md)
- [Memory Manager](https://docs.spicychat.ai/product-guides/premium-features/memory-manager.md)
- [Rulebooks](https://docs.spicychat.ai/product-guides/rulebooks)
- [Generation Settings](https://docs.spicychat.ai/advanced/generation-settings.md)
- [Mobile Apps](https://docs.spicychat.ai/advanced/mobile-apps.md)

Supplementary links above support identity, portability and failure limits. No third-party review supports a capability claim.
