# Kindroid

Reviewed 2026-11-08. Kindroid is an adult AI companion service that explicitly includes roleplay and creative writing. The requested `https://docs.kindroid.ai/` redirected to `https://kindroid.ai/`. That homepage links to the current Help Center at `https://kindroid.ai/v2/docs/`, establishing the documentation's official relationship. [Product homepage](https://kindroid.ai/)

This review covers public documentation, not first-hand interaction. No account, inference call, device test, production access, or browser automation was used. Expected benefits below are design inferences, not measured outcomes.

## Supported strengths

1. Creation has a defined stopping point. Community and Create paths lead to a Kin with personality and an opening greeting. Response Directive, Key Memories, and Example Messages are optional fine-tuning. This should let a novice establish the premise before learning behavioral controls. Closing an unfinished flow prompts for confirmation, although the draft is not saved. [Customizing personality](https://kindroid.ai/v2/docs/customizing-personality/)

2. Corrections have different scopes. Regenerate retains response versions, Suggest revises using feedback, and Tweak makes a manual edit. Scenarios branch into an instanced groupchat. Favorites and date-based History help locate past exchanges. These mechanisms should reduce pressure to accept a poor reply or lose the point where a story diverged. [Chat features and tools](https://kindroid.ai/v2/docs/chat-features-and-tools/)

3. Memory offers inspectable intervention. A reply's Long term memory sheet shows recalled memories and journals, with Deprioritize for an unhelpful memory. Subscribers can edit Learned Context and approve or dismiss suggested journal entries before recall. This should help users correct continuity without rewriting a character. It is the strongest mechanism here because it connects a generated reply to editable evidence. [Memory](https://kindroid.ai/v2/docs/memory/)

4. Media has explicit continuity controls. Shared chat history connects calls and text. Custom voice design and tuning live in voice settings, while selfies have a gallery and prompt controls. Video models support a per-Kin default and a per-request override. This should reduce repeated setup while keeping experimental media choices local. [Voice](https://kindroid.ai/v2/docs/voice-calls-and-video-calls/), [Selfies](https://kindroid.ai/v2/docs/selfies-video-selfies-avatars/)

## Tradeoffs and unknowns

Scenarios require a subscription and a free group slot. They copy at most 150 messages, stopping at a chat break, and exclude unshown voice-call context. Rewind covers only the last 10 messages with eligibility restrictions. Neither operation establishes an exact full-state checkpoint. [Chat tools](https://kindroid.ai/v2/docs/chat-features-and-tools/)

Cascaded Memory details are invisible. The displayed long-term memories are only a subset, and retrieval can miss information. Full assembled prompt inspection is not established. [Memory](https://kindroid.ai/v2/docs/memory/) Group memory formation and recall have separate switches, and group conversations can update individual memory. Treating every group as an isolated story would be unsafe without checking those settings. [Groupchats](https://kindroid.ai/v2/docs/groupchats/)

Expert controls include directives, dynamism, reasoning effort, model selection, and flairs. These do not establish arbitrary provider connections or a complete sampler interface. Kin creation requires Male or Female. Do not confuse this restriction with persona options, which also include Nonbinary. [Personality](https://kindroid.ai/v2/docs/customizing-personality/)

Export produces an emailed `.jsonl` account copy, with media as links. Requests require verified email and normally have a 30-day interval. An expired preview or subscription makes the account read-only while preserving export. Importing an external character card, restoring an export, and self-hosting were not established. Shared Kin templates explicitly exclude chat history, journals, long-term memory, and custom voices. [FAQs](https://kindroid.ai/v2/docs/faqs/), [Sharing](https://kindroid.ai/v2/docs/sharing-kindroids-referrals/)

Mobile availability is documented for iOS and Android, but ergonomics and accessibility were not tested. Mobile image rules can remove a generated selfie and refund its credit. [FAQs](https://kindroid.ai/v2/docs/faqs/) Calls warn that parallel text-chat use with Shared chat history can cause undefined behavior and lost memory. [Voice](https://kindroid.ai/v2/docs/voice-calls-and-video-calls/) The selfie page still calls Atelier latest, while the October 12 update names Vignette. The current default remains unresolved. [Selfies](https://kindroid.ai/v2/docs/selfies-video-selfies-avatars/), [Update log](https://kindroid.ai/v2/docs/update-log/)

## Patterns to consider

These are proposals for the fork, not implementation commitments or claims that native tools are missing.

- Put a premise and opening greeting before optional expert configuration.
- Connect each reply to recalled material and offer correction beside that evidence.
- Show the scope of retry, manual edit, rewind, and branch before the user confirms.
- Separate persistent media defaults from a request's temporary override.

Do not copy invisible memory as the only continuity mechanism, a bounded Scenario as an exact checkpoint, or template sharing as a backup. Each leaves state outside the user's immediate view. Preserve explicit story identity and explain what survives a reset. Do not copy binary-only Kin creation when broader character identity is needed.

## Sources

Primary workflow sources are Personality, Chat tools, Memory, Voice, Selfies, and FAQs, linked above. Identity, Sharing, Groupchats, and the dated Update log provide narrower supporting evidence. Documentation describes intended behavior only.
