# RisuAI

Reviewed 2026-11-08. RisuAI is a roleplay client for character creators and readers who connect model services and manage their own stories. The landing page uses "RisuAI"; the source repository uses "Risuai." The `kwaroran/Risuai` repository identifies risuai.net as its website and recommended installation, corroborating the starting URL. The character guide belongs to the same maintainer's documentation site. [Website](https://risuai.net/) · [Repository](https://github.com/kwaroran/Risuai) · [Character guide](https://kwaroran.github.io/docs/guides/making-bots/)

This review covers public documentation and source at commit `8e1fee403a903e0c608c2a86dfa2c3e96b93acef`. No account, chat generation, installation, browser interaction, or device test ran. Source inspection establishes implementation, not deployed behavior. All expected user benefits below are inferences.

## Supported strengths

- The character guide separates description, first message, and image. Its description template includes backstory, motivation, and speech. This gives creators specific places to establish a premise and opening scene. The landing page also offers character discovery through RisuRealm, but its claim of an easy start remains marketing evidence. [Guide](https://kwaroran.github.io/docs/guides/making-bots/) · [Website](https://risuai.net/)
- The story sidebar implements named chats within a character, folders, duplication, selection, and a separate New Chat action. These mechanisms could help readers resume a particular story while preserving other conversations with that character. Source inspection does not establish how clearly the deployed interface distinguishes similar names. [Story sidebar](https://github.com/kwaroran/Risuai/blob/8e1fee403a903e0c608c2a86dfa2c3e96b93acef/src/lib/SideBars/SideChatList.svelte)
- Message controls implement editing, rerolls, bookmarks, and branching. Branching copies the conversation through the selected message, assigns a new chat identifier, and inserts a link to the original conversation and message. Optional folder creation groups branches. This preserves a navigable origin when exploring an alternate scene. [Message controls](https://github.com/kwaroran/Risuai/blob/8e1fee403a903e0c608c2a86dfa2c3e96b93acef/src/lib/ChatScreens/Chat.svelte)
- HypaV3 memory summaries are editable. The summary item can regenerate a summary from referenced messages, then apply or cancel the replacement. Under the selected-summary view, available metrics label selections Important, Recent, or Similar. This is the strongest pattern here: readers could inspect and repair a compressed account of their story. Recall accuracy remains untested. [Memory summary editor](https://github.com/kwaroran/Risuai/blob/8e1fee403a903e0c608c2a86dfa2c3e96b93acef/src/lib/Others/HypaV3Modal/modal-summary-item.svelte)
- Chat export offers JSON, TXT, HTML File, and HTML Embed. Import handles recognized Risu chat schemas and JSONL message records. Native version 2 import remaps colliding folder identifiers. These mechanisms offer preservation and migration routes, although accepted file types do not establish a lossless round trip. [Chat serialization](https://github.com/kwaroran/Risuai/blob/8e1fee403a903e0c608c2a86dfa2c3e96b93acef/src/ts/characters.ts)

## Tradeoffs and unknowns

Expert control is substantial on paper. The README documents provider choices, prompt ordering, variables, conditions, regex scripts, plugins, lorebooks, group chats, TTS, and embedded media. It also links a work-in-progress wiki. That breadth increases the number of concepts a reader may need to understand; it does not prove that advanced settings stay out of the ordinary reading flow. [README](https://github.com/kwaroran/Risuai)

Source shows a conditional per-message model-information button. This review did not establish complete visibility of the assembled request, activated lore, or token allocation. Prompt customization alone does not prove prompt transparency. [Message controls](https://github.com/kwaroran/Risuai/blob/8e1fee403a903e0c608c2a86dfa2c3e96b93acef/src/lib/ChatScreens/Chat.svelte)

Below 640 pixels, message actions move into a popup with names. That is a concrete responsive mechanism, but touch targets, keyboard behavior, long-chat scrolling, and Android installation were not tested. The website advertises Android and web access. [Message controls](https://github.com/kwaroran/Risuai/blob/8e1fee403a903e0c608c2a86dfa2c3e96b93acef/src/lib/ChatScreens/Chat.svelte) · [Platforms](https://risuai.net/)

Docker self-hosting is documented, not exercised. Authentication, upgrades, backups, and multiuser isolation remain outside this evidence. Character-card migration fidelity, media preservation, voice setup, image-generation configuration, and provider-error recovery also remain unverified. The summary regeneration handler catches errors, but this does not establish a reliable recovery workflow. [Installation](https://github.com/kwaroran/Risuai) · [Memory error handling](https://github.com/kwaroran/Risuai/blob/8e1fee403a903e0c608c2a86dfa2c3e96b93acef/src/lib/Others/HypaV3Modal/modal-summary-item.svelte)

## Patterns to consider

These are proposals for the fork, not implementation commitments or claims that existing controls are absent.

- Give each branch a visible origin link and group related branches. Preserve exact-story navigation when alternatives multiply.
- Offer editable memory summaries with links to their source messages and explanations of selection. Make correction possible before adding more automation.
- Keep New Chat distinct from named-story selection. Test recognition with several similar stories for one character.
- Put export beside story management, with separate labels for editable archives and readable transcripts.

Do not turn memory support into unlimited-memory promises without accuracy evidence. Do not treat a generated summary as canonical story text. Do not adopt icon menus solely because they reduce visible controls; test whether readers can find branch, retry, and recovery actions. Do not present rich exports as universally compatible without migration fixtures.

## Sources

Identity and scope: [website](https://risuai.net/), [official repository and README](https://github.com/kwaroran/Risuai), [character guide](https://kwaroran.github.io/docs/guides/making-bots/). Implementation: [stories](https://github.com/kwaroran/Risuai/blob/8e1fee403a903e0c608c2a86dfa2c3e96b93acef/src/lib/SideBars/SideChatList.svelte), [message controls](https://github.com/kwaroran/Risuai/blob/8e1fee403a903e0c608c2a86dfa2c3e96b93acef/src/lib/ChatScreens/Chat.svelte), [memory editor](https://github.com/kwaroran/Risuai/blob/8e1fee403a903e0c608c2a86dfa2c3e96b93acef/src/lib/Others/HypaV3Modal/modal-summary-item.svelte), [chat serialization](https://github.com/kwaroran/Risuai/blob/8e1fee403a903e0c608c2a86dfa2c3e96b93acef/src/ts/characters.ts). Source links pin the inspected commit.
