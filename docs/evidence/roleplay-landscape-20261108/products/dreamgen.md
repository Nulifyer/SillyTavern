# DreamGen

Reviewed 2026-11-08. DreamGen targets people creating AI roleplay scenarios and prose stories, including adventures with several characters. Official identity was checked through the [homepage](https://dreamgen.com/), its linked [documentation index](https://dreamgen.com/docs), and the [migration guide](https://dreamgen.com/docs/migrating-from-v1-to-v2), which explicitly identifies `v2.dreamgen.com` as DreamGen V2. This is stronger evidence than treating the supplied URL alone as authoritative.

This review covers public documentation retrieved on the review date. No account, chat generation, purchase, production access, browser automation, or device test occurred. Documentation establishes intended workflows, not their reliability. Expected benefits and proposed adaptations below are reviewer inferences. No comparison claim about the fork is established here.

## Supported strengths

- The scenario editor separates Plot, Setting, Style, History, Characters, Locations, Objects, and Openings. Authors can leave sections unused, and opening descriptions explain different starting situations to readers. This gives the premise a readable structure without requiring every author to complete a large form. The expected benefit is better alignment between the story someone chooses and the story they start. [Scenario editor](https://dreamgen.com/docs/scenario-editor)
- Each V2 session receives its own scenario copy. Editing it does not change the original, and later original changes do not disrupt the session. This is the strongest mechanism here. It gives an ongoing story a stable starting definition while allowing relationships and world details to evolve locally. The migration guide still labels synchronization from the original as forthcoming; that is not a verified available feature. [V1 to V2 migration](https://dreamgen.com/docs/migrating-from-v1-to-v2)
- “Create Sequel” summarizes a session, updates character descriptions, and starts another session with the summary in its scenario. The expected benefit is an explicit chapter transition rather than silently relying on an ever-growing transcript. Summary accuracy and recovery of omitted details remain untested. [Migration guide](https://dreamgen.com/docs/migrating-from-v1-to-v2)
- Retry preserves alternatives and supports directed rewriting; forks create independent sessions. This should make experimentation less costly because the previous route remains available. It also distinguishes changing one response from pursuing another story direction. [Roleplay guide](https://dreamgen.com/docs/how-to-role-play)

## Tradeoffs and unknowns

Memory is bounded. The guide documents truncating old history and warns that excessive pinning can cause context problems. It also documents switching models after generation failures. None of this establishes automatic recovery without lost input. [Roleplay guide](https://dreamgen.com/docs/how-to-role-play)

Human visibility and model visibility can differ. Hidden opening interactions inform the AI without appearing to the reader, while Excluded interactions do the reverse. These mechanisms support author guidance and secrets, but complicate understanding what influenced a reply. [Scenario editor](https://dreamgen.com/docs/scenario-editor)

Markdown and DreamGen JSON export are documented. Cross-tool round-trip fidelity is unknown. The mobile toolbar is documented; touch, keyboard, accessibility, and narrow-screen usability were not tested. Full assembled-prompt inspection, external API keys, local endpoints, the complete text sampler controls, and self-hosting were not established. Unknown does not mean absent. [Roleplay guide](https://dreamgen.com/docs/how-to-role-play)

The linked import route and a search-discovered Tavern Card Importer route both returned HTTP 500 through the fetch tool. This is a retrieval limit, not proof of a product outage. Current external-card compatibility remains unverified. V1 JSON migration is documented, but it does not prove arbitrary card compatibility. [Import](https://dreamgen.com/app/tools/import), [card importer](https://dreamgen.com/app/tools/scenario-importer), [migration guide](https://dreamgen.com/docs/migrating-from-v1-to-v2)

AniMuse documentation explains positive and negative image prompts, presets, CFG, steps, and Turbo mode. Image controls therefore have concrete documentation, but their integration with an exact chat was not established. Voice selection, TTS, and dictation remain unknown in the inspected sources. [AniMuse guide](https://dreamgen.com/docs/how-to-generate-images/animuse)

## Patterns to consider

These proposals do not imply that the fork lacks equivalent native features.

- Show whether an edit changes a reusable character/scenario or only the current story. Preserve the relationship between the two.
- Make a sequel recap reviewable before starting, with the exact source story available for checking omissions.
- Offer a few directed retry actions beside existing expert controls. Preserve alternatives and distinguish retry from a new story branch.
- Explain each opening's premise before starting. Keep optional world details available without making them mandatory onboarding work.

Do not copy silent prompt contributions without an inspection path. Do not treat a generated recap as a faithful archive. Do not promise portability from a JSON extension alone. These are design objections, not observed failures.

## Sources

The six primary references are the linked homepage, documentation index, scenario editor, migration guide, roleplay guide, and AniMuse guide. The two import URLs above record failed retrievals only.
