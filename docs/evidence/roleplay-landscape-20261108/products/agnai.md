# Agnai / Agnaistic

Reviewed 2026-11-08. Agnaistic, shortened to Agnai, is a hosted and open-source character-roleplay application for solo writers and shared conversations. Identity is corroborated: the [repository](https://github.com/agnaistic/agnai) names Agnaistic and links `agnai.chat`; the [guide](https://agnai.guide/) links back to that repository. The same organization hosts [the guides repository](https://github.com/agnaistic/guides).

Evidence covers public documentation and source at `fccee00f5f7628d150760c787c4be87e6b1a652c`, the `dev` head returned by GitHub during review. It does not establish the hosted deployment's revision. No account, chat generation, device interaction, deployment or migration was tested. Expected benefits below are design inferences.

## Supported strengths

1. Character creation permits a small starting definition. The guide recommends name and plain-text personality, then explains optional fields. Creator's notes describe the character in lists, while scenario and greeting establish the situation and opening. This should help authors start without completing an expert form and help readers understand a character's premise. [Character guide](https://agnai.guide/docs/creating-a-character/)

2. A character can support separate story premises. The creation form names the conversation, selects a scenario and offers `Override Character Definitions`. Its helper text confines overrides to the new conversation. This should reduce duplicate character cards when the same cast appears in different stories. [CreateChatForm.tsx](https://github.com/agnaistic/agnai/blob/fccee00f5f7628d150760c787c4be87e6b1a652c/web/pages/Chat/CreateChatForm.tsx)

3. Conversation history has explicit identity and revision controls. The list searches conversation or character names, filters by character, sorts activity and links each row to its chat ID. Rows include names and recency. Message actions implement edit, regenerate and fork from an earlier message. These mechanisms should make an exact story easier to resume and alternatives easier to explore. Actual branch preservation and recovery were not exercised. [ChatList.tsx](https://github.com/agnaistic/agnai/blob/fccee00f5f7628d150760c787c4be87e6b1a652c/web/pages/Character/ChatList.tsx), [Message.tsx](https://github.com/agnaistic/agnai/blob/fccee00f5f7628d150760c787c4be87e6b1a652c/web/pages/Chat/components/Message.tsx)

4. Memory has explainable selection controls. Keyword entries use a token budget, priority for inclusion and weight for ordering. This should let authors reserve context for relevant lore. The guide also documents retrieved chat history and uploaded material through separate template placeholders. These are mechanisms for retrieval, not evidence of reliable story recall. [Memory instructions](https://github.com/agnaistic/agnai/blob/fccee00f5f7628d150760c787c4be87e6b1a652c/instructions/memory.md), [Embeddings guide](https://agnai.guide/docs/memory/embeddings.html)

5. Presets organize provider-dependent controls. Configured global services become selectable in a chat preset, whose General, Prompt, Memory and Advanced tabs separate concerns. The guide explains how response-token reservations reduce remaining context. This should support gradual tuning while retaining expert access. [Chat settings](https://agnai.guide/docs/chat-settings/)

## Tradeoffs and unknowns

Prompt visibility has a material limit. `Message Prompt` explicitly warns that its reconstruction is approximate. Authenticated server generation may retrieve more history, and OpenAI Turbo uses a different server-only payload. It is useful for investigation but cannot prove what a past request sent. [PromptModal.tsx](https://github.com/agnaistic/agnai/blob/fccee00f5f7628d150760c787c4be87e6b1a652c/web/pages/Chat/components/PromptModal.tsx)

Memory selection can depend on loaded history. The instructions warn about depths above 100 when only 100 messages initially load. The embeddings guide similarly requires older messages to load and says user embeds need `{{user_embed}}` in the template. Configuration alone therefore does not establish coverage. Some chat-settings sections remain placeholders, weakening guidance for expert tuning and failure recovery. [Memory instructions](https://github.com/agnaistic/agnai/blob/fccee00f5f7628d150760c787c4be87e6b1a652c/instructions/memory.md), [Embeddings guide](https://agnai.guide/docs/memory/embeddings.html), [Chat settings](https://agnai.guide/docs/chat-settings/)

Companion mode warns that editing, retrying and deleting are unavailable. Preserve that qualification when describing the controls. Character import lists successful and failed files separately. Chat import validates files and names Agnaistic and TavernAI formats. Those are concrete recovery aids, not evidence of network-failure recovery. [Creation form](https://github.com/agnaistic/agnai/blob/fccee00f5f7628d150760c787c4be87e6b1a652c/web/pages/Chat/CreateChatForm.tsx), [Character import](https://github.com/agnaistic/agnai/blob/fccee00f5f7628d150760c787c4be87e6b1a652c/web/pages/Character/ImportCharacter.tsx), [Chat import](https://github.com/agnaistic/agnai/blob/fccee00f5f7628d150760c787c4be87e6b1a652c/web/pages/Character/ImportChat.tsx)

Portability has source evidence: character downloads offer JSON and image cards; chat JSON includes messages and parent references. Full migration fidelity remains untested. Self-hosting has NPM and Docker instructions, but guest data resides in browser storage and clearing it deletes that data. The README documents multiple humans and bots in groups. Voice and image settings are documented, including character-specific configuration, but service operation was not tested. Mobile touch, keyboard, accessibility and offline behavior remain unknown. [Character download](https://github.com/agnaistic/agnai/blob/fccee00f5f7628d150760c787c4be87e6b1a652c/web/pages/Character/DownloadModal.tsx), [Chat export](https://github.com/agnaistic/agnai/blob/fccee00f5f7628d150760c787c4be87e6b1a652c/web/pages/Chat/ChatExport.tsx), [README](https://github.com/agnaistic/agnai), [Character guide](https://agnai.guide/docs/creating-a-character/)

## Proposals for the fork

- Make the character, exact conversation and conversation-only overrides visibly distinct.
- Offer a minimal character definition, with premise and greeting beside the start action.
- Show why a memory qualified, its budget and whether sufficient history was loaded.
- Label reconstructed prompts as approximate and identify server-only differences.
- Report import successes and failures separately so users can retry only failed files.

Do not copy permanent Companion restrictions into ordinary story editing. Do not make scrolling an unexplained prerequisite for memory coverage. Do not present an export button as proof of lossless migration. These proposals concern presentation and verification, not claims that the fork lacks native capabilities.

## Source index

All sources are public primary material, accessed 2026-11-08. Source-file links above pin the inspected revision.

- [Repository and README](https://github.com/agnaistic/agnai), [guide identity](https://agnai.guide/).
- [Character authoring, voice and images](https://agnai.guide/docs/creating-a-character/).
- [Chat presets and settings](https://agnai.guide/docs/chat-settings/).
- [Memory rules](https://github.com/agnaistic/agnai/blob/fccee00f5f7628d150760c787c4be87e6b1a652c/instructions/memory.md), [embedding limits](https://agnai.guide/docs/memory/embeddings.html).
- [Conversation source](https://github.com/agnaistic/agnai/blob/fccee00f5f7628d150760c787c4be87e6b1a652c/web/pages/Chat/CreateChatForm.tsx), with control and exchange files linked above.
- [Prompt approximation warning](https://github.com/agnaistic/agnai/blob/fccee00f5f7628d150760c787c4be87e6b1a652c/web/pages/Chat/components/PromptModal.tsx).
