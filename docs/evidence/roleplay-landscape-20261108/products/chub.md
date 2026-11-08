# Chub AI

Reviewed 2026-11-08. Chub AI is a hosted character directory and roleplay chat frontend for readers and creators who want configurable model connections. Official identity has corroboration beyond the supplied URL. GitHub marks [CharHubAI](https://github.com/CharHubAI) as controlling chub.ai, and its [stage-template repository](https://github.com/CharHubAI/stage-template) links to docs.chub.ai. This review uses public documentation and repository descriptions only. No account, chat generation, device test, or live workflow inspection occurred. Direct command-line access to chub.ai returned “This service is not available in your country.” That establishes this research environment's access limit, not a global availability rule.

## Supported strengths

1. Character creation separates searchable information from model instructions. Taglines explain the premise, creator notes provide reader-facing guidance, and description, scenario, and greeting define the interaction. Alternate greetings offer different openings. Expected benefit, not tested: readers can understand an encounter before committing, while creators can explain usage without adding those notes to the prompt. [Character Creation](https://docs.chub.ai/docs/the-basics/character-creation)

2. “View Full Chat Tree” exposes branches for revisiting alternate replies. “All Chats” lists conversations with the current character, and chat names can change. Expected benefit, not tested: writers can retain competing story directions and distinguish separate runs. The docs establish a tree and named chats, not successful recovery of a particular historical state. [Just Chatting](https://docs.chub.ai/docs/the-basics/just-chatting)

3. Long-story memory has explicit controls. Chat Memory accepts an edited summary or generated summary of messages outside the context window. Lorebooks add keyword-triggered content with scan depth, token budget, priorities, and recursive scanning. Characterbooks require “Use V2 Spec.” Expected benefit, not tested: writers can correct remembered facts and reserve context for relevant setting details. Neither mechanism guarantees continuity. [Just Chatting](https://docs.chub.ai/docs/the-basics/just-chatting), [Lorebooks](https://docs.chub.ai/docs/advanced-setups/lorebooks)

4. Configuration, Secrets, and Character Settings separate model tuning, connections, and character edits. Presets are model-specific. Character edits can affect the user's chats without changing the shared character. Expected benefit, not tested: readers can tailor a character while preserving its public definition. The exact propagation across the user's separate chats remains untested. [Just Chatting](https://docs.chub.ai/docs/the-basics/just-chatting)

## Tradeoffs and unknowns

Expert controls are substantial. The docs list system and post-history instructions, temperature, Top K, Top P, penalties, and external connections including Kobold/Ooba. Prompting explains limited history, macros, section ordering, and optional assistant prefill. This is evidence of configuration transparency, not proof of an inspector showing the exact outgoing request. Prefill explicitly may cause API errors. Connection setup and prompt choices may burden first use, an inference from the documented steps. Error recovery and retention of failed input remain unknown. [API Connections](https://docs.chub.ai/docs/the-basics/api-connections), [Prompting](https://docs.chub.ai/docs/advanced-setups/prompting)

Portability has a concrete export route: JSONL labeled for SillyTavern, PNG, and text. Full branch preservation, metadata fidelity, bulk export, and exact character/chat import procedures were not established. Adding characters to a chat, in-chat “Imagine” image generation, and text-to-speech configuration are documented. Voice choices, dictation, image controls, message editing, and retry behavior were not established. Sharing creates a public chat entry as well as a link, so it needs explicit scope and confirmation. [Just Chatting](https://docs.chub.ai/docs/the-basics/just-chatting)

Connecting a locally hosted model does not establish self-hosting of the Chub application. The public stage template establishes extension development only. Its README claims iOS and Android support, but that is not evidence of current app availability or touch usability. Documentation image filenames include 2023 and 2025 dates. Current narrow-screen behavior, accessibility, store distribution, and implementation parity remain unknown. No mobile score is justified. [API Connections](https://docs.chub.ai/docs/the-basics/api-connections), [stage-template](https://github.com/CharHubAI/stage-template)

## Patterns to consider

These are proposals, not commitments or claims of missing fork capabilities.

- Put a readable premise and selectable opening beside the start-story action, using the distinction in Character Creation.
- Give existing branch operations a navigable tree with story names, borrowing the documented chat organization.
- Make the current summary editable and show what it covers, drawing on Chat Memory's context boundary.
- Label preset ownership, connection settings, and character-edit scope where users make changes, following the documented separation.

Do not copy hidden prerequisites such as “Use V2 Spec.” without explaining their effect beside affected fields. Do not let sharing appear private merely because the docs call it anonymized. Do not treat local-model connectivity or an extension SDK as evidence that the whole application can be self-hosted.

## Sources

All read on 2026-11-08. Documentation describes intended behavior; benefits and proposals were not tested.

- [CharHubAI identity](https://github.com/CharHubAI) and [stage-template](https://github.com/CharHubAI/stage-template).
- [Character Creation](https://docs.chub.ai/docs/the-basics/character-creation).
- [Just Chatting](https://docs.chub.ai/docs/the-basics/just-chatting).
- [API Connections](https://docs.chub.ai/docs/the-basics/api-connections).
- [Prompting](https://docs.chub.ai/docs/advanced-setups/prompting).
- [Lorebooks](https://docs.chub.ai/docs/advanced-setups/lorebooks).
