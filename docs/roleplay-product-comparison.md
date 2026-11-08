# Roleplay chat products compared with this fork

The most useful direction is to make the fork's existing authoring tools easier
to understand within a story. Memory inspection, context explanations, branch
navigation and clear edit scope are the strongest candidates. Preserve the native
controls that already make SillyTavern powerful.

Reviewed on 2026-11-08, with one dedicated agent for each of 20 products. The
reviews use public documentation, official announcements and selected source
code. No competitor accounts, generated conversations, installations or device
tests were used. A documented mechanism can suggest a useful design, but does
not establish good usability, recall accuracy or model quality.

The fork comparison uses v1.19.21 source and the existing synthetic release
evidence. It does not inspect production content or screens. This is a research
report of the baseline, not an implemented redesign. The subsequent
[council-selected plan](council-overhaul-plan.md) tracks the agreed implementation.

## The 20 products

### Configurable authoring clients and tools

| Product | Mechanism worth studying | What it means for this fork | Boundary or tradeoff |
| --- | --- | --- | --- |
| RisuAI | [Editable summaries with source-message references, regeneration and apply/cancel](https://github.com/kwaroran/Risuai/blob/8e1fee403a903e0c608c2a86dfa2c3e96b93acef/src/lib/Others/HypaV3Modal/modal-summary-item.svelte). | Expose native summaries beside the story and make corrections inspectable. | Source inspection only. A generated summary is not the original transcript. |
| Agnai / Agnaistic | [Conversation-only character and scenario overrides](https://github.com/agnaistic/agnai/blob/fccee00f5f7628d150760c787c4be87e6b1a652c/web/pages/Chat/CreateChatForm.tsx). | Clearly distinguish the character, this scene and the shared connection. | Its prompt viewer warns that reconstructed prompts can differ from server requests. Companion mode deliberately removes editing controls. |
| Chub AI | [Full chat trees, named conversations and editable Chat Memory](https://docs.chub.ai/docs/the-basics/just-chatting). | Surface native branches as a navigable relationship between stories. | Documentation only. Local-model connectivity does not establish self-hosting of the application. |
| KoboldAI Lite | [Explicit Memory, Author's Note, World Info and downloadable saves](https://koboldai.com/KoboldAILite/), plus a source-inspected request inspector. | Explain how context works without requiring raw JSON as the first view. | Its branch implementation copies conversation text, not all memory, lore and settings. Browser saves have separate persistence risks. |
| Layla | [Reversible use-case onboarding with later inference configuration](https://help.layla-network.ai/getting-started/). | Make the ordinary path small while retaining an obvious expert path. | Offline phone inference has hardware requirements and is a different backend scope. History/configuration documentation conflicts remain unresolved. |
| WyvernChat | [Branching from saved alternative replies](https://app.wyvern.chat/blog/visual-novel-mega-patch). | Show branch origin and the selected reply when exploring another direction. | World branches share party state. Active StoryEngine sessions do not have exact state branching. |
| Voxta | [Resolved prompts, raw results and per-call diagnostics](https://doc.voxta.ai/docs/server/interface/diagnostics), with saved service configurations. | Explain the effective model/prompt configuration from the current story. | Automatic memory is experimental. Proprietary installed editions and device-key backup rules add operational constraints. |
| Perchance AI Character Chat | [Message-level memory queries and editable memory/lore](https://perchance.org/ai-character-chat-docs#memories-and-lore), backed by public app source. | Link a surprising reply to remembered material and its editor. | The documentation reader returned iframe shells. The reviewer inspected public source without executing it. Storage is browser-bound and independent inference hosting is unestablished. |

### Story and scenario authoring

| Product | Mechanism worth studying | What it means for this fork | Boundary or tradeoff |
| --- | --- | --- | --- |
| NovelAI | [Context composition, token allocation and inclusion/exclusion reasons](https://docs.novelai.net/en/text/editor/advancedsettings/). | Put an understandable context explanation above optional technical detail. | Story-writing is its main workflow. Its chat setup guide requires more manual formatting. Full-history exports can include rejected alternatives. |
| DreamGen | [Structured scenarios](https://dreamgen.com/docs/scenario-editor) and [session-specific scenario copies](https://dreamgen.com/docs/migrating-from-v1-to-v2). | Make premise, opening and edit scope explicit. Consider a reviewable sequel recap only as an optional later feature. | The dedicated reviewer retrieved the guide, but the parent's later fetch failed. Scenario-copy and sequel claims remain documentation evidence, not independent interaction tests. |
| AI Dungeon | [Response-linked context inspection](https://help.aidungeon.com/how-do-i-manage-context), with separate reusable Scenarios and saved Adventures. | Keep reusable setup distinct from exact transcripts and explain what fitted in context. | Session Undo ends at refresh. Story Card import replaces existing cards. Human multiplayer is not the same as scheduled AI cast turns. |

### Hosted character and companion products

| Product | Mechanism worth studying | What it means for this fork | Boundary or tradeoff |
| --- | --- | --- | --- |
| Character.AI | [One Memory screen for authored context, pins, editable Facts and usage](https://blog.character.ai/memory/), with explicit carryover to a new chat. | Bring existing memory tools together and make continuity a deliberate choice. | Paid qualifications apply. Full assembled-prompt inspection is unestablished. Its lorebook import discards advanced settings. |
| JanitorAI | [Simple lore forms, per-entry advanced scripts and activation debugging](https://help.janitorai.com/en/article/how-to-use-scripts-your-beginner-friendly-step-by-step-guide-1bdk5hc/). | Provide friendly entry forms while keeping the native expert controls and activation evidence. | Router is documented as paid and web-only. Parent retrieval of the Scripts guide failed, so that finding relies on the dedicated review. |
| Kindroid | [Per-reply recalled-memory inspection and correction controls](https://kindroid.ai/v2/docs/memory/). | Show what contributed to a reply and where the user can correct it. | Some memory remains hidden. Group participation can affect individual memory. Its Scenarios copy bounded history rather than every state component. |
| Nomi | [Searchable, editable conceptual dossiers](https://nomi.ai/updates/mind-map-2-0-bringing-nomi-memory-into-view/). | A readable facts index can help people understand a long story. | [Editing dossiers does not edit underlying memories](https://wiki.nomi.ai/Are_Mind_Map_Entries_Memories_And_How_Are_They_Unique). Its deliberate lack of rerolls conflicts with this fork's authoring-control goal. |
| Replika | [Guided creation ending with a named companion](https://help.replika.com/hc/en-us/articles/115001095892-How-do-I-begin-Replika), plus companion-level voice selection. | Give first use a concrete finish and keep voice identity near character identity. | Companion memory is not an exact-story archive. Classic and 2.0 documentation does not establish platform parity. |
| SpicyChat | [Editable, pinnable extracted memories](https://docs.spicychat.ai/product-guides/premium-features/memory-manager.md) and optional rule-driven story meters. | Make corrections accessible and distinguish authored facts from extracted ones. | Main history initially shows the latest conversation per character. Pin inclusion is not guaranteed model adherence. Some media features exclude groups. |
| Sakura AI | [Search, tags, premises and creator attribution](https://www.sakura.fm/). | Help readers recognize the desired premise before starting. Our profiles already provide much of this locally. | Creation/history are gated. Response alternatives and absolute memory claims are marketing evidence, not verified operation. |
| CHAI | [Simple character selection and private/shared creation](https://www.chai-research.com/), with documented personas and saved-memory concepts. | Keep a short path into character chat and expose the scope of personal information. | No hands-on test. A separately branded web FAQ is not proof of native-app parity. Export, expert controls and self-hosting remain unestablished. |

### Historical reference

| Product | Mechanism worth studying | What it means for this fork | Boundary or tradeoff |
| --- | --- | --- | --- |
| Backyard AI | Historical premise/greeting fields, [explained sampler controls](https://backyard.ai/docs/models/model-parameters) and opt-in desktop tethering. | Keep expert settings understandable and make routine exports available. | [The current homepage reports shutdown and a closed download window](https://backyard.ai/). The desktop app is deprecated. This is a historical reference, not a current alternative recommendation. |

Full dedicated reviews and their source indexes are in
[the product review index](evidence/roleplay-landscape-20261108/index.md).
The [interactive matrix](evidence/roleplay-landscape-20261108/comparison.html)
lets readers inspect the scope and citations for each capability. Matrix colors
represent evidence type, not quality scores or a promise that every feature exists.

## What is already here

This fork already has the underlying capabilities below. These are source and
prior-test findings, not assumptions based on competitors' terminology.

- Character cards, editable scenarios, alternate greetings, personas and lorebooks.
- Native message editing, response swipes, branches and checkpoints.
- Editable native summaries, summary restoration and vector retrieval extensions.
- Prompt manager, formatting, itemized prompts, presets, provider keys and custom parameters.
- Character and cast profiles, exact-story history, archive/restore and immediate story start.
- One-server service discovery, optional context sizing and explicit manual overrides.
- Images, separate optional image writer, opt-in narration, voice mapping and dictation.
- Advanced controls within the workspace and classic layout as another option.

There is also a native story-specific scenario override in
[script.js](../public/script.js). A full frozen copy of every character/world
definition is a separate capability and has not been established here. Do not
introduce another scenario store simply because a competitor calls its feature
a session copy.

The inspected source owners and prior synthetic test boundaries are indexed in
[the fork baseline](evidence/roleplay-landscape-20261108/baseline.md). Native
summary code exists, but this research does not prove its configuration or recall
quality for every provider. Existing service discovery also does not prove that
a selected model will accept every assembled story prompt.

## Recommended changes compared with the current fork

These are proposals. The order reflects this project's goals and the user's
reported friction, not measured competitor rankings.

| Priority | Change | Current fork | Smallest useful outcome |
| --- | --- | --- | --- |
| First | Scene memory | Summary, lore and retrieval exist under separate native owners. | An optional view in Scene details showing the current summary, attached lore, scope and correction links. No automatic popup. |
| First | Explain a reply's context | Native client itemization exists. Backend compatibility processing can transform messages. | Show recorded generation stages with advanced detail. Label unavailable or reconstructed information. |
| First | Branch navigation | Native branches/checkpoints exist, while workspace stories are listed flat. | Show origin, selected reply and related stories using existing transcript identities. |
| First | Clear edit scope | Native character, story, preset and connection scopes exist. | Show what a change affects and which override currently wins. Verify the real persistence rules before adding labels. |
| Next | Short character creation | Full native editor and rich profile previews already exist. | Lead with identity, premise and opening, with every existing field still reachable. |
| Next | Optional scene/opening choices | Immediate start, alternate greetings and scenario overrides already exist. | Add choices only when wanted. Default Start remains one action with no title prompt. |
| Next | Discoverable reply controls | Edit, retry, continue, swipes and branches already exist. | Make actions understandable on touch and keyboard, with distinct preservation/deletion consequences. |
| Next | Effective service settings and tests | Service setup, discovery, retries and independent writer already exist. | Explain the effective endpoint/model/preset and offer explicit, cancellable tests for optional services. |
| Next | Export scope and fidelity | Native exports exist. Complete cross-tool restoration is not established. | Explain text versus structured story versus backup, then verify synthetic round trips. |
| Later | Cast direction | Native member, activation and reply-order controls exist. | Keep active speaker, turn mode and shared scene context close to the conversation. |
| Later | Story media retrieval | Native galleries, media storage and voice mapping exist. | Find an image's originating message and understand voice-setting scope. |
| Preserve | Mobile continuity | Synthetic Pixel, menu, portrait and tab-resume regressions passed on the release image. | Keep transcript/draft identity and reading position. Physical phone locking still needs separate qualification. |

### First batch: memory and context

Study RisuAI, Character.AI, Kindroid, NovelAI, AI Dungeon and Voxta together.
Their useful common mechanism is a path between an unexpected response, the
information supplied to it, and a correction. The proposal is a user-invoked
Scene details view that connects the existing native owners.

Keep authored facts, generated summaries, retrieved passages and recent messages
distinct. Show which story and message range a summary covers. If summarization
is disabled or unavailable, show that state rather than an empty success surface.
A memory search query is not the complete prompt, and a summary editor is not
proof that every underlying influence is visible. Nomi's dossier distinction is
a useful warning against merging those concepts.

For reply inspection, distinguish the last generation from the current setup.
Display the effective model, configured capacity, output reservation and available
context contributions. Continue to expose native prompt text and parameters.
Client itemization and the final provider request are different stages: the native
backend can apply compatibility processing after assembly. Label captured,
reconstructed and unavailable stages. The model server's own chat template is
another visibility boundary. Reuse the native converter rather than introducing
a second implementation to populate diagnostics. Keep credentials out of context
views and diagnostic exports.
Native World Info or retrieval owners may need bounded diagnostic instrumentation
to explain omissions. Do not invent exclusion reasons from a token bar.

Acceptance should cover opening and editing this view without replacing message
nodes, changing the draft or triggering inference. Check reload, stale summaries,
failed saves, branch changes and different characters with the same story name.
Character replies stay in chat. There is no recovered-reply panel or automatic
insertion of character text into the user's draft.

### Second batch: branches and scope

Study Chub, RisuAI, WyvernChat and Agnai for ancestry and exact-story selection.
Use native branch/bookmark operations and extend the existing story index only
where necessary. Preserve the original transcript and selected response. Show
what a branch copies, especially memory, lore and settings. KoboldAI Lite's
text-only branch copying and Wyvern's shared party state show why a branch must
not automatically be called a full-state checkpoint.

Scope labels should identify this story, reusable character, preset or service.
They must describe actual persistence. DreamGen's isolated scenario copy is an
interesting different model, not permission to silently change SillyTavern's
existing character semantics. Start with making current behavior clear.

Acceptance should include old native stories, selected swipe branches, archived
stories, characters renamed after branching, group stories and mobile ancestry.
Opening a failed or obsolete branch must preserve the current scene. Test that
a story-local scenario edit leaves the shared character and another story alone.

### Third batch: creation and everyday controls

Study Layla, Agnai, Kindroid and hosted character catalogs for a short ordinary
path. Keep Start new story immediate. Premise selection, opening alternatives
and generated suggestions should be optional. Suggestions require an explicit
request, cancellation and a review step before they change any saved definition.

Put commonly adjusted reply controls near the story while retaining the native
prompt manager, presets, custom parameters and provider settings. A readable
label such as response length can lead to the existing token control. The
underlying value and its scope must remain inspectable. Preserve exact model
names and explicit sampling instead of substituting opaque service labels.

Acceptance should include a minimal new card, an existing detailed imported card,
classic-layout restoration, keyboard action discovery and 320/390/448px layouts.
No mandatory title, model list, wizard, voice setup or image configuration should
stand between a configured character and the first chat turn.

## Controls and behavior to preserve

Keep the native character, chat, generation, group, prompt, media and settings
owners. Workspace modules should present their controls and state. This avoids
another model registry, prompt assembly pipeline, memory store or transcript
lifecycle competing with upstream behavior.

Keep service functions separate. Story chat, optional image writer, images,
speech and transcription can share discovery while retaining their actual
endpoints, prompts and overrides. A successful catalog response is not a test
generation. If a user explicitly requests a service test, disclose the request
and let them cancel it. Never reconfigure Juiced runtimes or policies as a side
effect of frontend setup.

Keep exact transcripts available even when memory is summarized. Keep alternative
replies, native imports/exports, lorebook controls and deep tuning accessible.
Keep microphone and narration opt-in. Existing tab recovery should repair the
mounted chat without replaying inference or showing a recovery workflow.

## Patterns not to copy

- Absolute memory promises. Inclusion, retrieval and model adherence are different things.
- A simpler mode that removes editing, retry or export from an authoring product.
- Latest-chat-only navigation when the user has several stories with one character.
- A new-story action that requires naming, account deletion or a long setup wizard.
- Silent shared-character edits disguised as scene changes.
- Export labels that hide omitted media, variants, branches or metadata.
- A downloaded frontend presented as independent offline inference or maintained self-hosting.
- Continuous calls, device-model management, a social marketplace or game simulation added merely to imitate another product's scope.

Optional rule-driven story meters are worth exploring for game-like roleplay,
as documented by SpicyChat. They would add new state and rule ownership, so they
come after the core story workflow. This research does not authorize that change.

## Evidence and limits

All 20 dedicated reviews contain capability records for onboarding, story
organization, revision/branches, memory/lore, prompt transparency, connections,
advanced controls, groups, media, mobile, portability and self-hosting. Their
statuses describe evidence, not feature completeness. A documented negative or
limit is still documented evidence. Unknown does not mean absent.

The parent checked key primary pages and source for the central recommendations.
DreamGen and Janitor guide reopens failed. Perchance's documentation reopen was
an iframe shell. Their source boundaries remain explicit in the reviews and
[parent checks](evidence/roleplay-landscape-20261108/parent-checks.json).
No claim that every indexed URL was independently revalidated is made.

There are no comparative model-quality, response-speed, recall-accuracy or
hands-on competitor mobile results. Public feature descriptions do not establish
current account entitlements or a complete migration path. The fork's prior
86-case browser run and 478 unit tests establish their recorded coverage only.
No new application tests were needed for this research-only change.

The next implementation decision should select a coherent batch and its
acceptance criteria. It should not treat this catalog as a commitment to copy
every feature.
