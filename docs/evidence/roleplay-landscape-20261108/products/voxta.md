# Voxta

Reviewed 2026-11-08. Voxta combines voice and text companions with authored roleplay scenarios and app integrations. Its audience includes casual chat users and creators who want scripted, multi-character experiences. Official identity is corroborated: [voxta.ai](https://voxta.ai/) links to `doc.voxta.ai`; those docs link to the [voxta-ai GitHub organization](https://github.com/voxta-ai), which identifies itself as official and links back. This review covers public documentation, not application interaction or implementation inspection. No account, inference, device test, production access or purchase was used. Expected benefits below are reviewer judgments, not measured outcomes.

## Supported strengths

1. Character selection explains the starting situation. The [Characters screen](https://doc.voxta.ai/docs/server/interface/characters) documents searchable cards, tags, optional creator readmes, separate New Chat and Resume Last Chat actions, and a visible default scenario that users can remove or replace. Creation offers manual, AI-assisted and VRoid paths. These mechanisms should help users understand the premise before committing and distinguish a fresh conversation from continuation.

2. History identifies an exact conversation. [Chat history](https://doc.voxta.ai/docs/server/interface/chat-history) supports title/character search, scenario filtering, independent conversation resumption, renaming, favorites and downloads including images. Cards show the latest summary. Creator-enabled Explore exposes summarized chapters, remembered content and the state journal. This should reduce accidental continuation of the wrong story and make memory mistakes easier to investigate.

3. Memory has visible layers and correction mechanisms. [Memory books](https://doc.voxta.ai/docs/server/studio/memory-books) distinguish authored lore, recalled event memories and an always-included understanding of participants. Entries can be pinned, weighted and edited. Superseded facts retain readable history. Recall uses the last ten messages and a token budget. This gives creators concrete ways to diagnose continuity problems rather than trusting an unexplained memory promise. Automatic memories and understanding are explicitly experimental.

4. Simplified chat retains routes to expert inspection. [Chat](https://doc.voxta.ai/docs/server/interface/chat) separates voice-oriented, transcript and debug views, with an inspector for live story state. [Diagnostics](https://doc.voxta.ai/docs/server/interface/diagnostics) shows resolved prompts, raw results, parameters, call identifiers and timings, with downloadable reports. These mechanisms should help explain surprising replies and isolate provider or prompt failures. Neither documentation nor this review establishes response quality.

5. Service choices are explicit and reusable. [Manage Modules](https://doc.voxta.ai/docs/server/interface/settings) groups providers by function and identifies the active choice. Named configurations save modules, presets and enabled functions. Summarization can inherit the reply model or use another. This should reduce repeated setup while preserving specialist control over text, voices, transcription and images. [Service tests](https://doc.voxta.ai/docs/server/interface/test-services) document individual retry, error output and a settings link, providing a concrete recovery path.

## Tradeoffs and unknowns

Editing, deletion and regeneration appear in Chat view, not simpler views. Correction may therefore be harder to discover. [Multi-character turn-taking](https://doc.voxta.ai/docs/server/interface/chat) is documented. Conversation forks, checkpoints, alternate-reply preservation and edit-triggered state rollback were not established. Unknown means unverified, not absent.

Configurations cannot switch during a chat. Scenarios and characters can force configurations, with scenario precedence. This offers authored consistency but complicates expectations about which setup applies. Full sampler parity and provider-specific setting coverage remain unverified. [Configuration rules](https://doc.voxta.ai/docs/server/interface/settings)

[Installation documentation](https://doc.voxta.ai/docs/server/get-started/install) lists Windows desktop, Linux server and subscriber Android APK editions. Android can run on its own or connect to a PC. Full desktop, Linux and Android require a subscription; Lite is cloud-only. The [main site](https://voxta.ai/) states no macOS build or iOS app. Responsive web behavior, touch correction and reconnect recovery were not tested. Local hosting is documented, but the [terms](https://doc.voxta.ai/docs/cloud/terms) identify the software as proprietary.

Portability requires care. The [editor](https://doc.voxta.ai/docs/server/studio/characters) claims character-card-v2 imports, while the gallery describes Voxta-format PNG imports. Assets require `.voxpak`; cross-tool fidelity is untested. [Backup instructions](https://doc.voxta.ai/docs/server/reference/backups) require the database and asset folder together. Windows device keys do not move between PCs; encrypted Device-mode content needs preparation before migration. Chat-download round-trip restoration was not established.

## Proposals for this fork

- Keep new-story and exact-history actions distinct, with a premise and scenario visible before starting.
- Offer a compact explanation of recalled lore and summaries, with correction links to their existing owners.
- Keep prompt diagnostics reachable from the active story, including the effective provider and settings.
- Show the effective service configuration and its source when defaults and overrides interact.

These are proposals, not claims that the fork lacks these capabilities. Do not copy hidden correction controls, an unexplained experimental understanding layer, or the full scenario scripting system without a separate authoring need. Each adds discovery or maintenance costs beyond ordinary chat.

## Core sources

[Characters](https://doc.voxta.ai/docs/server/interface/characters), [Chat history](https://doc.voxta.ai/docs/server/interface/chat-history), [Memory books](https://doc.voxta.ai/docs/server/studio/memory-books), [Chat](https://doc.voxta.ai/docs/server/interface/chat), [Diagnostics](https://doc.voxta.ai/docs/server/interface/diagnostics), [Manage Modules](https://doc.voxta.ai/docs/server/interface/settings). Supplementary official sources are linked beside their claims.
