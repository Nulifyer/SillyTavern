# NovelAI

Reviewed 2026-11-08. NovelAI serves writers building stories, worlds, and virtual companionship. Identity was checked through [Anlatan's project listing](https://anlatan.ai/), which links NovelAI, and [NovelAI's links page](https://novelai.net/links), which explicitly links the supplied documentation domain. This review uses public documentation only. No account, inference, device testing, or live editor inspection occurred. Benefits below are design inferences, not measured outcomes.

## Supported strengths

1. Context inspection explains memory failures. Last Context and Current Context expose assembled text, insertion stages, token allocations, inclusion decisions, and reasons entries were excluded. Enabled but inactive lore entries can also be inspected. This gives a writer evidence for correcting context competition before blindly changing prompts. The mechanism matters more than a larger advertised context window. [Advanced Settings](https://docs.novelai.net/en/text/editor/advancedsettings/)

2. Revision belongs to the story. The editor saves user inputs and generations in a branching edit history. Undo, Redo, Retry, and the History selector let writers continue from an alternative generation. Inline generation starts at an earlier text position. Distinguishing original prompt, generated text, edits, and user additions also preserves authorship information. These mechanisms could make experimentation less costly and help recover an exact earlier continuation. [Editor](https://docs.novelai.net/en/text/editor/)

3. Lore is selective and editable. Lorebook entries activate when keys occur in recent context, or remain Always On. Import/export supports `.json`, `.lorebook`, and PNG-embedded lorebooks. Character details can therefore travel independently of a whole story. The intended benefit is reusable world material without inserting every entry on every turn. Hidden entries support scenario spoilers, but also disappear from the Context Viewer until revealed. [Lorebook](https://docs.novelai.net/en/text/lorebook/)

4. Scenario sharing differs from exact continuation. `.scenario` imports present descriptions, tags, and customizable placeholders. `.story` exports preserve branches and history, while plaintext exports only prose. This distinction could help users choose between replaying a premise and carrying an exact draft forward. It also creates a privacy warning: sharing `.story` exposes discarded retries. [Story Settings](https://docs.novelai.net/en/text/editor/storysettings/)

## Tradeoffs and unknowns

Roleplay onboarding requires authoring. The documented chat workflow manually combines character information in Memory, a sample dialogue, Phrase Bias groups, and Stop Sequences. It even describes temporarily disabling a bias when an answer spans generations. This offers control, but is a demanding first conversation. The guide references Clio, which the newer model catalog marks retired, so its applicability to current models needs validation. No character-card import standard, character marketplace, or managed group-speaker workflow was established. [Chat Format](https://docs.novelai.net/en/text/chatformat/), [Models](https://docs.novelai.net/en/text/models/)

Story shelves organize a library. Mobile browser access and PWA installation are documented, but touch usability and exact-story resumption were not tested. Failure recovery has hard limits: clearing browser storage can permanently delete local stories, and password reset can destroy access to remote stories. The FAQ recommends downloads. Its older context-limit figures conflict with the newer Models page, so no single universal limit is reported here. [FAQ](https://docs.novelai.net/en/faq/), [Models](https://docs.novelai.net/en/text/models/)

Expert settings are substantial. Their location in an Advanced tab is useful disclosure, but the chat setup still depends on them. A NovelAI model selector is documented; arbitrary external endpoints are not established. Full-app self-hosting is unknown. Released weights for retired models do not establish a self-hosted equivalent of the service. Cross-tool migration fidelity is also untested. [Advanced Settings](https://docs.novelai.net/en/text/editor/advancedsettings/), [Models](https://docs.novelai.net/en/text/models/)

Media controls are documented separately. TTS supports browser synthesis or NovelAI streamed voices, automatic reading, and audio downloads. Image generation exposes prompts, tag suggestions, editing, and generation settings. This does not establish automatic scene illustration or per-character conversational voices. [Text To Speech](https://docs.novelai.net/en/text/usersettings/tts/), [Image basics](https://docs.novelai.net/en/image/basics/)

## Proposals for the fork

These are proposals, not commitments or claims that native controls are missing.

- Make existing context inspection reachable beside story memory, with reasons for excluded lore. Start with a readable diagnosis and retain expert details.
- Label exact continuation and reusable premise as distinct actions. Preview the premise and variables before starting a new story.
- Offer a deliberate export choice between complete history and the selected narrative. State whether rejected replies travel with it.
- Put backup and storage consequences beside archive/export actions. Explain recovery limits before a destructive action.

Do not copy manual bias configuration as routine character onboarding. Do not hide active prompt material without a reveal path. Do not present browser-local storage as a backup, or treat released retired-model weights as proof of full service portability.

## Core workflow sources

[Editor](https://docs.novelai.net/en/text/editor/), [Story Settings](https://docs.novelai.net/en/text/editor/storysettings/), [Advanced Settings](https://docs.novelai.net/en/text/editor/advancedsettings/), [Lorebook](https://docs.novelai.net/en/text/lorebook/), [Chat Format](https://docs.novelai.net/en/text/chatformat/), [FAQ](https://docs.novelai.net/en/faq/). Identity, model, and media references are linked beside the narrower claims above.
