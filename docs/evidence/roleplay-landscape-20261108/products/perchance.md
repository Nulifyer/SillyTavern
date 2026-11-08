# Perchance AI Character Chat

Reviewed 2026-11-08. This browser app targets people creating characters and continuing fictional conversations. Its page title is "AI Character Chat". Public source and documentation were inspected without accounts, inference, browser automation, or device tests. Benefits below are design inferences, not measured outcomes.

## Identity and evidence boundary

The URL alone is insufficient attribution. Perchance's [privacy policy](https://perchance.org/privacy-policy) says anyone can publish generators. The [downloaded app source](https://perchance.org/api/downloadGenerator?generatorName=ai-character-chat) identifies `generatorName="ai-character-chat"` and `generatorPublicId="04f1a4119d30b5672a3e08fddd12fce4"`, matching the [live page's iframe](https://perchance.org/ai-character-chat). Its `tipsButton` opens `ai-character-chat-docs#tips`, establishing the documentation relationship. This verifies the reviewed app and its own documentation, not the author's legal identity or ownership of similarly named sites. No forks or unofficial tutorials supply capability evidence.

The web reader returned iframe shells for the app and docs. A read-only HTTP fetch of Perchance's public `downloadGenerator` endpoint exposed `modelText` and `outputTemplate`. No downloaded JavaScript was executed.

## Supported strengths

1. Character creation has several entry points. The source has starter characters with taglines, a manual editor, character-file import, and a "new chat" character list. Selecting a character creates a new thread. Initial messages can establish the premise or show instructions hidden from the AI. This should let creators explain a scenario before the first user reply. The editor's "show more settings" disclosure keeps optional configuration behind an explicit action. [App source](https://perchance.org/api/downloadGenerator?generatorName=ai-character-chat), [initial-message documentation](https://perchance.org/ai-character-chat-docs#initial-messages).

2. Stories have independent records. The source stores thread IDs, names, folder paths, favorites, and recent activity separately from characters. Opening an existing thread restores its unsent draft. Message regeneration preserves selectable variants, and double-tapping a message opens editing. A duplication handler copies a whole thread and its messages. These mechanisms should support resuming the intended story and trying an alternative without discarding the original. Duplication is not evidence of a navigable branch tree. [App source](https://perchance.org/api/downloadGenerator?generatorName=ai-character-chat).

3. Long-story memory has user controls. The docs describe summaries, retrieved memories, thread lore, and character lorebook URLs. `/mem` and `/lore` open editors. A message's brain control exposes memory search queries. This gives users a way to investigate or repair recalled facts. It does not prove reliable recall or complete prompt transparency. [Memory documentation](https://perchance.org/ai-character-chat-docs#memories-and-lore).

4. Recovery includes an escape route outside normal initialization. Source handlers export individual threads as JSON including characters or as message text. The app exposes emergency export if loading stalls. Import handles character cards and TavernAI-style JSONL chats through separate parsers. These paths should reduce dependence on a working conversation screen, although no recovery or migration round trip was tested. [App source](https://perchance.org/api/downloadGenerator?generatorName=ai-character-chat).

## Tradeoffs and unknowns

Browser storage is a serious ownership tradeoff. The docs warn that clearing site data loses characters and chats, and recommend regular exports. Source also warns about browser storage eviction. Cross-device synchronization was not established. [Tips](https://perchance.org/ai-character-chat-docs#tips), [app source](https://perchance.org/api/downloadGenerator?generatorName=ai-character-chat).

Expert controls include role/reminder editing, response-length limits, memory settings, shortcuts, and custom JavaScript. The source's temperature editor is commented out, so stored `temperature` fields do not establish an active sampler control. External model connections, current model identity, and a complete assembled-prompt inspector remain unverified. Hosted inference is explicit in the imported [AI text plugin](https://perchance.org/ai-text-plugin).

One documentation mismatch matters. The [instruction guide](https://perchance.org/ai-character-chat-docs#instruction-and-reminder) says reminders cannot be thread-specific, but current source contains `thread.character.reminderMessage` overrides. Their user-facing availability remains unresolved. The plugin also documents concurrency limits and `quota_exceeded` for tickets. The page's "unlimited" title is not a tested service guarantee.

Images have documented `/image` commands. Voice appears as custom-code guidance, not evidence of a built-in voice selector. [Tips and custom-code examples](https://perchance.org/ai-character-chat-docs#custom-code-examples). Group chat is documented through adding characters above the reply box. Mobile has documented tap access and source-specific touch handling, but layout, accessibility, and keyboard behavior were not tested. General generator HTML downloads in the [platform FAQ](https://perchance.org/perchance-faq) do not establish self-hosted or offline AI inference.

## Patterns to consider

These are proposals for parent evaluation, not implementation commitments or claims that the fork lacks them:

- Separate character selection from exact-story continuation, with a visible thread identifier and restored draft.
- Offer message-level memory evidence beside memory and lore editors.
- Keep export reachable when ordinary app initialization fails.
- Put creator configuration behind explicit disclosure, while keeping premise and initial-message guidance visible.

Do not copy browser-only persistence without a clear backup path. Do not make ordinary voice setup require JavaScript. Do not present thread duplication as a branch history or a memory-query display as the full prompt. Each would promise more than the inspected mechanism establishes.

## Sources

Primary sources are the [app](https://perchance.org/ai-character-chat), its [public source download](https://perchance.org/api/downloadGenerator?generatorName=ai-character-chat), app-linked [documentation](https://perchance.org/ai-character-chat-docs), [AI text plugin](https://perchance.org/ai-text-plugin), [platform FAQ](https://perchance.org/perchance-faq), and [privacy policy](https://perchance.org/privacy-policy). Dynamic source identifiers and unresolved capabilities are preserved in the companion JSON.
