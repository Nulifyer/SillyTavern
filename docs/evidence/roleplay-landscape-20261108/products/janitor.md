# JanitorAI

Reviewed 2026-11-08. JanitorAI supports character creation and roleplay chats, including adult themes. Its official help center's [website URL FAQ](https://help.janitorai.com/en/article/faq-whats-the-website-url-1yojful/) explicitly identifies `https://janitorai.com/`. This identity check excludes similarly named sites and unofficial guides.

This is a public documentation review, not an interaction test. The homepage returned HTTP 403 through a plain HTTP request; the web fetcher could not open the homepage or help center. Plain HTTP retrieval successfully returned the help articles below. No account, chat generation, purchases, browser automation, device tests, or source-code inspection were performed. Benefits below are hypotheses based on documented mechanisms.

## Supported strengths

- Character creation separates the reader's premise from model instructions. The optional Character Bio is explicitly for readers and does not enter the bot's context. Personality, Scenario, and Initial Message have different jobs. Tags support search and filtering. This separation could let creators explain a complicated premise without spending model context on promotional text. The initial message also gives readers a concrete starting situation. [Character creation overview](https://help.janitorai.com/en/article/the-basics-the-character-creation-page-overview-15xevon/)

- Scripts offer a documented path from forms to code, with a debugging step. Users create a Lorebook script, add keyword entries, assign it to characters, and inspect a Test Chat's Changes tab through Show Debug Panel. Individual entries can become Advanced scripts that modify personality and scenario separately. The guide also documents copying the `entries` array into its JSON Editor. This could make conditional lore approachable while giving experienced creators a way to diagnose activation. Compatibility with real exported files was not tested. [Scripts walkthrough](https://help.janitorai.com/en/article/how-to-use-scripts-your-beginner-friendly-step-by-step-guide-1bdk5hc/)

- Memory guidance asks users to preserve story state explicitly. Its template separates environment, relationship, current plot, character facts, user facts, and consequential past events. It also describes asking for recaps and using them as memory. This could help writers preserve decisions instead of repeatedly pasting whole scenes. It does not establish automatic summarization or reliable recall. [Memory and context management](https://help.janitorai.com/en/article/chat-memory-context-management-9oivt3/)

- The documented janitor+ Router workflow places model choice beside context limits, token rates, custom prompts, generation settings, and a wallet. Users select it through API settings without managing another provider's API key. This could reduce configuration mistakes and make model choice more understandable. The guide says existing external proxies remain available, but this review did not verify their setup. [janitor+ Router](https://help.janitorai.com/en/article/janitor-router-1dyrzul/)

## Tradeoffs and unknowns

Router requires a janitor+ subscription and bills usage per token. Its documentation says web only, with mobile support planned. Do not infer a current model inventory, current prices, or app parity from this review. The mobile moderation FAQ describes iOS and Android apps and a web setting named `Enable NSFW for App`. It also describes approved-link restrictions, despite later claiming identical website behavior. That blanket parity claim conflicts with Router's narrower availability. Mobile usability, accessibility, and touch behavior remain untested. [Router](https://help.janitorai.com/en/article/janitor-router-1dyrzul/), [mobile moderation](https://help.janitorai.com/en/article/faq-mobile-app-moderation-vttat8/)

The memory article describes approximately 8k–9k JLLM context, while Router exposes model-specific limits. That figure is not a universal current limit. Scripts' debug panel establishes visibility into script changes, not inspection of the complete assembled model request. Expert controls exist in documentation; exact sampler coverage and prompt ordering remain unknown.

The Scripts walkthrough mentions `+ New Chat`, but does not establish finding and continuing an exact previous story. Message editing, retries, branches, character import, native chat export/import, generated images, voices, group roleplay, and self-hosting were not established by the selected sources. Unknown does not mean absent. The documented lorebook transfer is not evidence of complete migration.

Failure recovery deserves particular caution. The Missing Chats article suggests sending a message and refreshing, but also says some migration losses cannot be restored. This is a published warning, not an observed incident or measured failure rate. [Missing Chats](https://help.janitorai.com/en/article/missing-chats-1ybet2f/)

## Proposals for the fork

- Label premise text and model instructions separately, including whether each enters context.
- Offer a simple lore-entry path with per-entry advanced editing and a visible explanation of activation.
- Put structured story-state prompts beside editable memory, without promising permanent recall.
- Show connection context limits and cost information beside model choice when the provider supplies them.

Do not copy blanket app-parity promises, imply that generated recaps are backups, or treat lorebook transfer as full portability. Avoid the Scripts guide's changing names for group-selection controls. The fork already has native expert tools; these proposals concern explanation and discovery, not evidence that those tools are missing.

## Sources

The eight primary sources are linked beside their claims: official URL FAQ, character creation overview, Scripts walkthrough, memory guide, Router guide, mobile moderation FAQ, and Missing Chats, plus the [help center](https://help.janitorai.com/en/) used to locate them. Article publication history and deployed behavior were not independently verified.
