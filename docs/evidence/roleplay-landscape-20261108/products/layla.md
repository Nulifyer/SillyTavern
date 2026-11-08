# Layla

Reviewed 2026-11-08. Layla is an Android and iOS AI assistant and character-roleplay app for people choosing on-device models or connected services. Source identity was checked beyond the supplied URL. The [roleplay page](https://www.layla-network.ai/ai-roleplay) links to Layla Help, whose footer links back to the product website. Its linked [documentation repository](https://github.com/l3utterfly/help.layla-network.ai) confirms that it publishes that wiki. This establishes documentation provenance, not access to the application's implementation.

This review covers public official pages and instructions only. No app interaction, account, purchase, model inference, device test, or production access occurred. Benefits below are reasoned expectations, not measured outcomes.

## Supported strengths

1. Layla starts with a use case, including Roleplay, Basic, and Expert, then configures recommended features and mini-apps. Users can change that choice later. The [getting-started guide](https://help.layla-network.ai/getting-started/) also separates local models from cloud use. This should reduce the decisions before a first story while preserving an expert route. It does not prove that onboarding is easy on a particular phone.

2. Character creation gives the premise explicit fields for description, personality, scenario, and greetings. A Summary previews the combined character text. Optional voice, images, references, and agents sit in Advanced. TavernPNG import fills compatible fields, and export produces a portable card. These mechanisms should help authors understand what defines a character before adding integrations. See the [character guide](https://help.layla-network.ai/how-do-i-create-custom-characters/). The documentation does not establish complete card-field compatibility.

3. History identifies conversations by title, character, message preview, and activity date, with search across titles and message content. Message actions support editing either speaker, alternative regenerated replies, Continue for cut-off replies, and a branch from a selected message that preserves the original. Together these should help users recover an exact story and try another outcome without overwriting it. Sources: [History](https://help.layla-network.ai/how-does-conversation-history-work-in-layla/) and [message actions](https://help.layla-network.ai/edit-regenerate-branch-messages-layla/).

4. Expert controls expose prompt presets, delimiters, and a Live Preview assembled from example text. The guide explains how `{{instruction}}` supplies task instructions and how removing it can disrupt memory or lorebooks. This makes formatting mistakes more diagnosable than an unexplained prompt box. The preview is a template example, not established visibility into every actual request or retrieved memory. See [prompt configuration](https://help.layla-network.ai/how-to-set-up-custom-prompt-templates-for-models/).

5. Connected models have named endpoints, exact model identifiers, model discovery, and an expandable Extra JSON area. The [API guide](https://help.layla-network.ai/how-to-connect-layla-to-any-openai-compatible-api/) covers models on a user's PC or home server and troubleshooting. This should let a phone use stronger hardware while keeping provider-specific controls optional. A self-hosted inference endpoint does not establish a self-hostable Layla application.

## Tradeoffs and unknowns

The [roleplay page](https://www.layla-network.ai/ai-roleplay) advertises long-term memory, keyword-based SillyTavern lorebook imports, document retrieval, and offline voices. Memory quality, retrieval inspection, and lorebook round-trip fidelity remain untested. Multi-character roleplay is documented in onboarding, but turn scheduling and group context controls were not established.

The [history-configuration guide](https://help.layla-network.ai/how-layla-chat-histories-work-across-characters-personas-models-and-roleplay-scenarios/) contradicts itself. Its matrix says character, model, scenario, and generation settings are not saved with a conversation, while its reopening instructions and specification say they are restored. It also separates configuration deletion from history deletion, while History warns that deleting a character deletes associated chats and memories. Do not assume reliable restoration or safe character deletion from these sources.

History documents export copies, but not their format, reimport, or full chat migration. Permanent deletion is unrecoverable. Mobile availability is documented, but touch usability, accessibility, battery use, and performance were not tested. The getting-started guide acknowledges local hardware and storage constraints and offers cloud switching, which changes privacy and connectivity conditions.

## Patterns to consider

These are proposals for the fork, not claims that its native controls are missing or implementation commitments:

- Offer reversible setup choices that reveal relevant controls without duplicating their owners.
- Preview the assembled character premise beside scenario and greeting fields.
- Keep conversation identity, branch origin, and searchable previews visible when continuing a story.
- Put prompt examples and dependency explanations beside advanced settings, including what an edit can disable.

Do not copy random greeting selection without showing the chosen opening. Do not hide essential recovery actions behind long-press alone. Do not copy ambiguous history-restoration promises or destructive character deletion without explicit scope and recovery design.

## Sources

- [Roleplay overview](https://www.layla-network.ai/ai-roleplay) and [wiki repository](https://github.com/l3utterfly/help.layla-network.ai).
- [Getting started](https://help.layla-network.ai/getting-started/) and [character creation](https://help.layla-network.ai/how-do-i-create-custom-characters/).
- [History](https://help.layla-network.ai/how-does-conversation-history-work-in-layla/), [configuration semantics](https://help.layla-network.ai/how-layla-chat-histories-work-across-characters-personas-models-and-roleplay-scenarios/), and [message actions](https://help.layla-network.ai/edit-regenerate-branch-messages-layla/).
- [Prompt configuration](https://help.layla-network.ai/how-to-set-up-custom-prompt-templates-for-models/) and [API connections](https://help.layla-network.ai/how-to-connect-layla-to-any-openai-compatible-api/).

Wiki evidence describes intended behavior and can contain errors. No application source or runtime behavior was inspected.
