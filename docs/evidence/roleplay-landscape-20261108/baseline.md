# Fork baseline for the product comparison

Inspected on 2026-11-08. Runtime source is v1.19.21,
`24fbda8c25d6898fde1e99aa005303592dd3ddaf`. This inventory reads repository
source and project documentation only. It does not inspect production data or
screens and is not a fresh usability test. Prior synthetic release acceptance
passed 86 browser cases and 478 source unit tests; see the
[release evidence](../audit-fixes-20261108/handoff.md).

| Capability | Current evidence | Comparison boundary |
| --- | --- | --- |
| Character discovery and profile | public/scripts/workspace-views.js:178 and :232 | Local library, search/filter, premise, opening, stories and native editor. Not a built-in hosted social marketplace. |
| Immediate story start | public/scripts/workspace.js:387; tests/workspace.e2e.js:285 | Native automatic name, no title prompt, later Rename. |
| Exact history and archive | public/scripts/workspace-chats.js:57, :103, :125 | Exact file identity, archive/restore, rename/delete. Native storage owns files. |
| Alternative replies | public/script.js:6703 and :6894 | Native swipes preserve response alternatives. Do not present another response-choice system as a missing core capability. |
| Branches and checkpoints | public/scripts/bookmarks.js:187, :255, :452 | Native operations exist. Workspace story rows do not present a branch tree. Do not label branching absent. |
| Editable long-story summary | public/scripts/extensions/memory/settings.html:17; manifest.json | Native summary text, restore, pause, summarize and editable summary prompt. Current workspace has no dedicated summary destination. |
| Lore and retrieval | workspace-views.js:9 and :19; extensions/vectors/manifest.json | World & lore and native Vector Storage remain available. Do not equate retrieval with guaranteed factual memory. |
| Prompt transparency | workspace-settings.js:82 and :99; itemized-prompts.js:248 | Native prompt manager, formatting and itemization exist. Their controls remain technical. |
| Compatibility processing | src/endpoints/backends/chat-completions.js:2241 and :2979 | Native backend processing can change messages after client itemization. An inspection view must label stages. The existing process route uses the native converter. |
| Model setup | docs/model-services.md; service-connections.js | Service-specific discovery uses native owners. No duplicated model registry or inference proxy. |
| Context and tuning | docs/model-services.md | Configured capacity discovery is optional; existing explicit settings remain manual. Advanced controls and classic layout remain available. |
| Cast/group stories | workspace.js:399; group-chats.js | Native member/activation/reply-order controls. Cast scene inspector links its editor. |
| Voice, image and dictation | workspace-tools.js; dictation.js; native extensions | Optional services, separate image writer, editable prompts, native media and per-character voice mappings. Not a new continuous realtime-call system. |
| Mobile and tab recovery | browser-recovery.js; tests/workspace.e2e.js:1580 and :2434 | Prior synthetic Android/DPR/touch and hidden/freeze checks. Physical lock/GPU behavior remains unqualified. |
| Import/export and native customization | native character/chat modules, advanced controls | Existing cards, chat formats, lore, themes/extensions and provider forms remain native. Not every format has new workspace-specific acceptance. |
| Story-specific scenario override | public/script.js:9064–9113 | Existing native chat_metadata.scenario override. Do not call a story-local scenario absent. Full frozen copies of all character/world definitions are not established. |
| Scene controls | workspace.js:305 | Inspector links persona, lore, writing, background, cast and story actions. It does not present one consolidated memory/context explanation. |

Likely comparison categories are capabilities already present, presentation gaps,
optional extension/integration work, genuinely different product scope and
unknowns requiring validation. Recommendations must distinguish these categories.
No feature is declared missing merely because another product uses a simpler name.
