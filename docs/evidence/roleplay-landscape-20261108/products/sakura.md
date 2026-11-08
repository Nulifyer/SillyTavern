# Sakura AI

Reviewed 2026-11-08. Sakura AI is a hosted character-chat service aimed at roleplay and companion conversations. Identity is corroborated: its [privacy policy](https://www.sakura.fm/privacy) names Sakura AI, LLC and `sakura.fm`; the [App Store listing](https://apps.apple.com/us/app/sakura-chat-with-ai-bots/id6467520779) names the same seller and links back to that domain. This review covers public web extracts and publisher descriptions, not signed-in interaction. No account, chat generation, purchase, device test, or browser automation was used. Benefits below are design inferences.

## Supported strengths

- The [Explore page](https://www.sakura.fm/) puts character search, thematic tags, portraits, premise descriptions, and creator links together. Tags include Anime, Horror, Vampire, and OC. The inferred benefit is a choice based on the desired story before service configuration. This supports discovery, not a claim about recommendation quality or catalog size. Some extracted descriptions are extremely long, so compactness is inconsistent.
- A public [Mira character page](https://www.sakura.fm/chat/N28DH9O) exposes a greeting, Description, Scenario, and Creator before any generated exchange. The mechanism separates character identity from the opening situation and shows the voice readers would encounter. That may help users reject a mismatched premise before investing in a conversation. This is user-authored content hosted by Sakura, not official feature documentation. The retrieved profile extract was cached several months earlier.
- [Sakura+](https://www.sakura.fm/buy) advertises Fusion Mode as multiple response options per message under Diamond. Alternative continuations may help a writer choose tone or direction without composing a replacement. This is a marketing-supported mechanism, not an observed interaction. The page does not establish how selection works, whether alternatives persist, or whether choosing one creates a branch.
- The official [iOS listing](https://apps.apple.com/us/app/sakura-chat-with-ai-bots/id6467520779), app ID `6467520779`, documents iPhone and iPad compatibility. Dedicated distribution may make frequent mobile access easier. Installation, keyboard behavior, touch targets, accessibility, synchronization, and feature parity remain untested. The listing alone does not establish a good mobile workflow.

## Tradeoffs and unknowns

The public [Create](https://www.sakura.fm/create) and [Chat History](https://www.sakura.fm/chats) extracts show sign-up/log-in prompts, not editable forms or saved stories. Character creation is advertised in the publisher's app description, but import formats and editor fields remain unverified. Exact-conversation continuation, separate stories for one character, archives, naming, checkpoints, message editing, retry, and branching are unknown. Public character links do not prove resumable story identifiers.

The [subscription page](https://www.sakura.fm/buy) names Dragonfruit and Glowing Dragonfruit models, associates images with Infinite, and markets Infinite Memory. It explains neither context limits nor memory editing, retrieval, summaries, lorebooks, or forgetting behavior. No retention guarantee follows from that label. Provider connections, local endpoints, sampler controls, assembled-prompt inspection, and voice configuration are unestablished. A published scenario reveals author content, not the actual prompt sent to a model. Native group roleplay is also unknown; a scenario with several characters would not establish separate character orchestration.

The same page acknowledges daily message limits and directs free-message applications to Discord. Paid plans bundle model, memory, response-choice, and image claims, which may complicate choosing one needed capability. No prices are reported, and model-quality comparisons were not tested. [Support](https://www.sakura.fm/support) directs users to a Discord support channel. That is a documented help route, not evidence of in-chat retry, draft preservation, outage recovery, or support response times.

Character-card export, conversation export, migration fidelity, public source code, and self-hosting are unknown. The [privacy policy](https://www.sakura.fm/privacy) identifies the operator but does not establish those capabilities. Its stated update date is January 06, 2024. Do not infer local control, private storage, or chat-specific guarantees from hosted access.

## Patterns to consider

These are proposals for the fork, not implementation commitments or claims that its existing native controls are missing.

- Keep a short premise and creator attribution beside character selection. Expand long definitions separately.
- Distinguish the character description, story scenario, and opening message in the profile preview.
- Consider optional response alternatives for authoring. Define selection and preservation explicitly; do not assume Fusion Mode provides branching.
- Show model, memory, image, and voice capabilities where users choose a service. Keep advanced controls reachable and disclose limits.

Do not copy an absolute memory promise without inspectable memory and limits. Do not make Discord the only recovery instruction; retain actionable errors and the user's draft inside the workspace.

Sources: [Explore](https://www.sakura.fm/), [Mira](https://www.sakura.fm/chat/N28DH9O), [Sakura+](https://www.sakura.fm/buy), [iOS publisher listing](https://apps.apple.com/us/app/sakura-chat-with-ai-bots/id6467520779), [privacy policy](https://www.sakura.fm/privacy), and [support](https://www.sakura.fm/support). Access-boundary pages are linked above.
