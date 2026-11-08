# Backyard AI

Reviewed 2026-11-08. Backyard AI addressed character creators and people writing interactive roleplay. Its official identity is supported by the [Terms of Use](https://backyard.ai/terms), which name Ahoy Labs, Inc. and explicitly identify backyard.ai. The desktop route redirects to [desktop.backyard.ai](https://desktop.backyard.ai/), which links back to the main site.

The decisive current finding is closure. The [homepage](https://backyard.ai/) says Backyard has shut down, new accounts and normal cloud features are closed, and the self-service data download window has closed. This review records historical mechanisms, not an available service recommendation.

Evidence is public primary-source documentation only. Search-indexed copies retain older documentation, while opening several of those URLs now returns closure notices. Those copies establish historical descriptions only. No account, inference, installation, device test, UI interaction, or production access was used. Expected benefits below are design judgments, not tested outcomes.

## Supported historical strengths

1. Character authoring connected the premise to the opening exchange. The indexed [Character Prompt guide](https://backyard.ai/docs/creating-characters/character-prompt) describes persona, scenario, example dialogue and first message fields. Instructions sat under an advanced tab. This could let creators establish a playable situation before adjusting model behavior. It does not establish how clearly a browsing user saw that premise.

2. Lore had a concrete activation rule. The same [guide](https://backyard.ai/docs/creating-characters/character-prompt) says keywords in the most recent four messages cause associated lore text to enter context. It also explains that excess history drops oldest first. Selective insertion could reserve context for relevant facts, but it is not durable story memory or a guarantee of recall.

3. Expert controls had explanatory documentation. The [Model Parameters guide](https://backyard.ai/docs/models/model-parameters), returned as an older page by web open, separates base controls from optional samplers. It explains Temperature, Min-P, Repeat Penalty, Top P and Top K. Explaining mechanisms beside controls could help users diagnose repetitive or erratic output. The documentation does not demonstrate control availability across every client or hosted model.

4. Mobile access reused desktop resources. The indexed [Mobile Tethering announcement](https://backyard.ai/blog/mobile-tethering), dated February 28, 2024, describes opt-in access to existing local models, characters and chats through a phone browser. It required the desktop app running and the same account on both devices. This could support continuity without moving model execution to the phone. Current operation is unknown.

## Tradeoffs and unknowns

Closure outweighs historical convenience. The [desktop download page](https://desktop.backyard.ai/) explicitly marks the app deprecated and unsupported. It offers Windows and macOS downloads and identifies llama.cpp, but this is not evidence of a maintained, independently self-hostable server. No binaries were downloaded or executed. Tethering historically depended on Backyard's web routing and authentication, so local inference alone does not establish post-closure remote access.

Migration has a documented boundary. Opening the [tethering URL](https://backyard.ai/blog/mobile-tethering) returned an earlier closure notice describing JSONL and BYAF archives for compatible single-character chats. It named README.txt, byaf/index.json and unavailable-media.jsonl. That notice set archive requests to November 4, 2026 at 11:59 p.m. Pacific and downloads to November 6 at the same time. Both dates precede this review. The homepage's closed-window notice takes precedence. Archive completeness, group-chat compatibility, import fidelity and support-assisted recovery remain unverified.

Exact-story selection, archive organization, retry, branching, group roleplay and failure recovery were not established. The indexed Character Prompt guide mentions editing replies, but not branch semantics. Prompt inputs and context eviction are explained; a live assembled-prompt inspector is unverified. Voice was advertised in indexed homepage content, while voice configuration and image generation remain unverified. No touch layout, keyboard behavior, mobile app operation or accessibility was tested. Unknown does not mean absent.

## Patterns to consider

- Put the scenario and first exchange together when preparing a story. This follows the authoring mechanism above and could make the starting situation easier to assess.
- Keep editable instructions discoverable behind an advanced control. Explain which fields affect generation and which only label a character.
- Show why lore entered context and when history left it. Use documented activation rules to explain memory limits before users mistake them for permanent recall.
- Make export a routine story action with format coverage and missing-media reporting. The archive notice provides useful identifiers, but an exit deadline is a poor substitute for continuing access.

These are proposals, not implementation commitments. Do not copy account-dependent remote access as proof of independence, or describe keyword lore as complete memory. Do not copy historical availability claims into current onboarding. The documented shutdown makes those distinctions consequential.

## Sources

- [Homepage and current closure notice](https://backyard.ai/)
- [Terms of Use and operator identity](https://backyard.ai/terms)
- [Character Prompt, historical indexed documentation](https://backyard.ai/docs/creating-characters/character-prompt)
- [Model Parameters, older documentation returned by web open](https://backyard.ai/docs/models/model-parameters)
- [Mobile Tethering, indexed announcement and earlier closure notice](https://backyard.ai/blog/mobile-tethering)
- [Desktop app deprecation notice](https://desktop.backyard.ai/)
