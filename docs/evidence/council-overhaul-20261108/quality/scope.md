# Quality proposal

I support a connected Scene details workflow. A reader should be able to identify the current story, understand the setup and memory that may affect its next reply, inspect the recorded context for a particular reply, correct the relevant native setting, and follow an existing branch without losing the current draft. These belong together because a confusing response is the concrete trigger for all four actions.

This proposal follows the approved slate/lavender foundations in docs/workspace-ui-system.md and docs/roleplay-workspace.md. It does not call for another visual identity or dashboard. Character chat remains the primary screen. Scene details is user-invoked, and detailed prompt text remains secondary to readable identity, scope and availability information.

## Evidence inspected

I read AGENTS.md, the council brief, .agents/README.md and its four indexed records, .agents/work/council-overhaul.md, the research comparison, its baseline/index, and the dedicated NovelAI, Agnai and Kindroid reviews. Those reviews describe documentation and source, not hands-on competitor usability. I inspected workspace.js, workspace-settings.js, workspace-tools.js, workspace.css, itemized-prompts.js, bookmarks.js, the native memory extension and browser-recovery.js. This is source review only. No browser, production or shared test85 access has occurred.

Observed implementation facts matter to the design:

- workspace.js renderInspector currently rebuilds a small character/action panel using a signature that omits memory and generation context. A richer view needs deliberate refresh and focus ownership rather than rerendering its fields on every stream event.
- workspace.js mobile inspector keyboard loop currently selects only buttons and summaries. New selects, inputs or links must remain usable and included in the focus boundary.
- workspace-settings.js moves one native settings tree. Summary and deeper correction controls should reuse this owner and its unavailable/late-activation treatment.
- extensions/memory/index.js getLatestMemoryFromChat deliberately excludes the final message. Its editor updates native memory through setMemoryContext. A workspace scan of the last message would be a second and potentially conflicting interpretation.
- itemized-prompts.js currently stores prompts under chatId, while alternatives are found by mesId. Historical context needs owner, story, message and selected-reply identity before it can safely make historical claims.
- bookmarks.js creates native branch snapshots from messages and uses main_chat plus message extra.branches. A branch is not a complete frozen copy of settings, memory and world state.
- browser-recovery.js already owns tab geometry and per-story user drafts. New details must preserve that owner and must not restore character text into the composer.

## Scope and native owners

1. Add a compact Scene details structure with current story identity, memory/setup, reply context, related branches and existing story controls. Keep one obvious close/return action. Long content wraps and scrolls inside its region.
2. Explain native summary availability, source/coverage where established, attached lore and scenario scope. Link to native summary, World Info, persona, prompt and story-scenario editors. Do not invent memory activation or exclusion reasons. Distinguish stored summary from effective injected summary when the native owner can establish that distinction.
3. Inspect a chosen response using recorded identity and immutable configuration. Label current setup separately. Label compatibility reconstruction and unavailable server/template stages explicitly. The native backend converter remains the conversion owner; credentials never enter the inspection view.
4. Present bounded native branch relationships and exact-story navigation. Show an unknown or missing parent as such. Preserve selected alternatives and original transcripts. Clearly describe branch copying limits before creation.
5. Preserve ordinary entry, immediate new story, native response actions, optional images/voice/dictation, and the existing advanced-control and classic-layout paths.

Workspace presentation owns navigation and readable grouping. Native summary, World Info, scenario, itemization, bookmark, transcript, settings and generation owners retain mutations and persistence. No new memory store, prompt assembler, model registry, inference proxy or lifecycle controller belongs in this scope.

## Acceptance criteria

- Opening Scene details or recorded context performs no inference, settings mutation, summary regeneration, transcript save, message replacement or composer/draft insertion.
- Current story identity stays visible. Historical context never borrows a record from another character/cast with the same filename, another reply alternative, or newer configuration. Legacy/missing/failed records get an honest unavailable state and a useful next action.
- A story scenario change leaves its shared character and another story unchanged. Other correction links disclose shared scope before editing. Summary/manual edits use native persistence; a failed save cannot claim saved success.
- Opening failed or obsolete branch/context/editor work preserves the mounted story, draft, scroll and active operation. Rename and character rename do not silently retarget records. Missing ancestry is recoverable and not invented.
- An archived story can be inspected. Any mutation follows the existing read-only/archive policy and requires restoring the story where appropriate. Inspection must not unarchive it implicitly.
- A held reply allows read-only inspection. Mutations obey native generation gates. Stream/status updates do not destroy input focus, open disclosure state or selected text. Nested Escape closes the topmost native editor/menu/detail layer before background Stop.
- Desktop, 320/390/448px phones, 768px intermediate width, 150% native font, larger browser text and reduced phone height retain visible labels, exact identifying names, a reachable close/return action, readable content and 44px touch targets. Keyboard users can enter, navigate and leave every new control with visible focus and no background escape.
- Hidden/frozen-tab resume with details open preserves native transcript/composer nodes, user draft/selection and history position. A held connectivity probe must not delay geometry repair. No inference is replayed and no recovery popup appears.
- Existing settings controls remain single mounted instances, preserve explicit values and return to classic parents. Unavailable/late extensions show accurate status and recover without duplicate controls.

## Verification and exclusions

Parent should run focused behavior checks plus relevant existing regression suites. Final council review also needs rendered desktop and phone journeys on a fresh isolated synthetic fixture. My fixture and tab must be separate from other council members and automated persistence suites. Screenshots establish visual state only; keyboard, touch, reload, failure, cancellation and suspension need exercised interactions. Physical Pixel lock/GPU behavior remains unqualified without physical-device evidence.

Exclude service-test panels, character-creation redesign, new opening wizards, full-state snapshots, export redesign, automatic memory generation, game meters and infrastructure/model changes. Preserve their existing native capabilities. These additions would give this delivery unrelated decisions and failure states without completing the selected correction journey.

## Risks and conditions

The chief risk is making the narrow inspector a pile of equally weighted controls. Group by the reader's question and use progressive detail. Another risk is attractive diagnostics that sound more certain than the recorded evidence. Missing capture is a valid result. Historical prompt identity and branch-rename behavior are correctness work necessary for these claims, not optional polish.

This is a scope proposal, not approval of implementation or a claim that the acceptance criteria already pass.
