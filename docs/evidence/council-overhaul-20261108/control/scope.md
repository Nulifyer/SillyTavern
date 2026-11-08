# Control member scope proposal

I support one connected Scene details workflow. A reader should inspect the story's current context, correct its native source, understand a selected reply's recorded context, and follow related native branches. The useful outcome is a path from a surprising reply to an informed correction. A feature catalogue would dilute that outcome.

This is a source review and proposal. I have not inspected a running fixture or production. Research input includes the fork baseline, the full comparison, and the NovelAI and Voxta dedicated reviews. Their documented context and diagnostics mechanisms support the design question, not a claim that this fork lacks memory or prompt controls.

## Proposed delivery

- Show the native effective summary and its anchor, attached lore and retrieval destinations, and their actual scope. Distinguish summary text, authored scenario and retrieved context. Report disabled, unavailable and missing provenance explicitly.
- Expose the existing story-specific scenario editor with a clear story-only label. Keep shared character, persona, lore, provider and preset editors reachable, with accurate scope labels.
- Add selected-reply context inspection. Separate captured client assembly from current setup. Capture the exact model identifier, provider, preset, configured capacity and output reservation at generation time. Reveal technical detail after a readable explanation.
- Reuse native compatibility processing for an explicitly labeled reconstruction when needed. State that provider adapters and the model server's template remain separate visibility boundaries. No invented reasons for missing lore or claims that included text was obeyed.
- Show native parent, branch and checkpoint relationships where source metadata supports them. Use exact owner and transcript identity, preserve selected alternatives, and explain that a branch is not a frozen copy of every shared setting.
- Keep default Start immediate. Scene details and inspection are optional. Opening them must not call inference, change a draft, remount chat messages, or alter native settings.

## Native owners and integration

`public/scripts/extensions/memory/index.js` owns summary selection, insertion and editing. Its `getLatestMemoryFromChat` and `getIndexOfLatestChatSummary` deliberately skip the final message. Workspace must consume an owner-provided effective snapshot rather than scan arbitrary `extra.memory` values with a competing rule. `setMemoryContext` owns the extension prompt and message anchor. A generated summary anchor alone does not establish an exact covered message range.

`public/script.js` owns scenario metadata and native generation. `setCharacterSettingsOverrides` edits `chat_metadata.scenario`, examples and system prompt through the native popup. The workspace should route there, not add another scenario store.

`public/scripts/itemized-prompts.js` owns itemized prompt storage. `public/script.js` captures prompt components in `finishGenerating`. `public/scripts/openai.js:createGenerationParameters` constructs chat request settings. `src/endpoints/backends/chat-completions.js` applies `postProcessPrompt` in `/generate`; `/process` exposes the same converter. These are distinct stages. A view must not call a reconstruction the final provider request.

`public/scripts/bookmarks.js` owns native branch and checkpoint creation. `createBranch` already supports selected swipes and `main_chat`; parent messages keep `extra.branches`. `WorkspaceChats` owns owner/file identity and routes exact opens into native load transactions. Extend that existing index or projection only as needed, without another transcript lifecycle.

`WorkspaceSettings` owns one mounted native control tree. Keep advanced controls, All controls, classic restoration, native provider selection, exact model IDs, presets and manual sampling/context settings intact. Service discovery remains transient metadata applied through native owners.

## Acceptance criteria

1. A synthetic story can inspect its current summary and scenario, open the appropriate native editor, save, reload and see the correction. Scenario Save and Cancel must match their labels, and Escape must not commit. An editor captures its original story identity and rejects obsolete saves. Another story and shared card remain unchanged for a story-local scenario edit.
2. Current setup and selected historical reply are visibly distinct. Changing model, preset or budgets after a reply does not rewrite its captured values.
3. Two characters with the same story filename, group versus character stories, changed swipes, Continue, rename, delete and reload never display another identity's prompt. Missing legacy provenance is unavailable or explicitly unverified. It never falls back to a newer unrelated record.
4. Captured, reconstructed and unavailable stages have truthful labels. Provider/template stages that were not captured stay unavailable. Tokens with overlapping native categories are not presented as an exact additive accounting.
5. Inspection and correction preserve native message nodes, draft text and selection, generation ownership, stop behavior and same-story return. Stale asynchronous results cannot update another story's panel.
6. Native provider, keys, custom parameters, prompt manager, deep sampling, media and extension controls remain reachable with one mounted control tree. Opening the new views does not change explicit values.
7. Context rendering uses text-safe sinks. Diagnostic display or any export excludes credentials, authorization headers and sensitive endpoint query values. Story text is disclosed only through the user-invoked view.
8. Parent/branch/checkpoint navigation opens the exact native transcript, handles missing or archived targets truthfully, and preserves the current story on failed or obsolete reads. Original transcript and selected swipe remain intact.
9. Desktop and 320/390/448px layouts permit keyboard and touch inspection, correction and return. New interactive fields enter the focus trap. Escape closes nested inspection before native Stop.

## Risks and required boundaries

Observed: itemized prompt storage is keyed only by `chatId`, in `itemized-prompts.js:23–31`. `script.js:5413` replaces records by message index. The current OpenAI itemization limit also reads live `oai_settings` in `itemizedParams`. These are inadequate as exact historical provenance for the proposed view. New bounded diagnostics need full owner/file/message/swipe identity and immutable captured settings. Preserve existing records without eager migration or deletion. A missing capture is a valid state.

Observed: the native override TEXT popup commits after dismissal without capturing its original story identity. The owner needs honest Save/Cancel behavior and an identity guard before presenting it as a safe story correction.

Observed: the mobile inspector focus trap currently enumerates only buttons and summaries in `workspace.js`. New controls require corresponding focus handling or native modal routing. Routine panel refresh must not steal input focus or replace an open disclosure.

Inference: comprehensive provider wire capture would expand this into an adapter instrumentation project. It is outside this delivery. Client capture plus a native reconstruction can meet this scope if labels and unavailable states are honest. Capturing a complete request object would also risk persisting credentials and media; capture an allowlisted diagnostic projection instead.

Exclude automatic summary generation, a new memory engine, a new prompt assembler, complete state snapshots, a model registry, protocol proxy, automatic service tests, runtime/cache changes, character creation wizard, generated suggestions, export overhaul, continuous calls and cast simulation. Optional media retain their existing entry points. Physical phone lock, audible quality and paid providers remain unqualified unless separately tested.

## Initial position

Approve this scope for council discussion. Final approval depends on a shared plan that retains the identity, disclosure and native-owner criteria above. No implementation or final product acceptance is claimed here.
