# KoboldAI Lite

Reviewed 2026-11-08. KoboldAI Lite is a browser interface for roleplay, fiction, interactive adventures and instruction chat. It targets people bringing a local backend, a provider endpoint or AI Horde. Identity is verified: the [official KoboldAI FAQ](https://koboldai.com/Koboldai.net/) explicitly names `lite.koboldai.net` and the LostRuins repository. KoboldAI.net names the hosted service, while KoboldAI Lite names the interface.

This review covers public documentation and source only. No accounts, generation, browser automation or device tests were used. Source observations refer to commit `f53b6561137e3bf1f3ebcab91e704a8c585b1617`, whose `index.html` declares `LITEVER = 354`. The deployed website and bundled copies were not matched to that commit. Benefits below are reviewer inferences, not measured outcomes.

## Supported strengths

1. Character setup has several concrete entrances. The Scenarios selector offers sample premises, card import and a character creator. `preview_temp_scenario()` displays title, mode, author when supplied, and a description before loading. The creator separates persona, scenario and greeting, then directs subsequent editing to Context. These mechanisms should help someone understand what they are starting and create a usable premise without learning the entire prompt configuration. Evidence: [scenario preview and creator source](https://github.com/LostRuins/lite.koboldai.net/blob/f53b6561137e3bf1f3ebcab91e704a8c585b1617/index.html#L13017).

2. Revision supports immediate corrections and retained alternatives. Documentation describes editing existing text, Back, Redo and Retry. Source adds selectable conversation branches through `clone_new_branch()` and `switch_branch()`, with `max_branches = 8`. This should support trying another response or plot direction while retaining an alternative. It is a bounded branch list, not evidence of a visual story tree. Evidence: [editing documentation](https://koboldai.com/KoboldAILite/#what-are-the-buttons-above-the-user-text-input-box), [branch implementation](https://github.com/LostRuins/lite.koboldai.net/blob/f53b6561137e3bf1f3ebcab91e704a8c585b1617/index.html#L30462).

3. Memory mechanisms explain their effect on prompts. Documentation distinguishes persistent Memory, a recent Author's Note and keyword-triggered World Info. Source exposes the submitted payload and captured response through `show_last_req()`. Together these give writers a way to adjust continuity and investigate a surprising reply. This is stronger evidence than an unexplained claim that the system remembers everything. Evidence: [memory documentation](https://koboldai.com/KoboldAILite/#how-do-i-make-the-ai-remember-things), [request inspector](https://github.com/LostRuins/lite.koboldai.net/blob/f53b6561137e3bf1f3ebcab91e704a8c585b1617/index.html#L14067).

4. Content can travel with its configuration. Documented imports include Tavern character cards, KoboldAI saves and lore formats. Saves can include UI, generation and sampler settings. The source distinguishes browser slots, server slots and a scenario library. These mechanisms should reduce setup work when reopening an exact saved conversation, although fidelity across formats is untested. The [repository README](https://github.com/LostRuins/lite.koboldai.net) also documents a single-page interface bundled with KoboldCpp, reducing frontend installation work. Evidence: [formats and save settings](https://koboldai.com/KoboldAILite/), [slot implementation](https://github.com/LostRuins/lite.koboldai.net/blob/f53b6561137e3bf1f3ebcab91e704a8c585b1617/index.html#L16859).

## Tradeoffs and unknowns

Expert control is substantial: modes, samplers, presets, context limits and prompt formatting are documented. That breadth creates configuration decisions. The [main-interface guide](https://koboldai.com/Guides/Kobold_Lite/KoboldLite_Main/) separates AI, Settings and Context, but discoverability and novice success remain untested. Its Remote Support link returned 404 during review.

Branches clone `gametext_arr`; switching restores conversation text and clears undo/retry state when requested. These functions do not snapshot memory, lore or settings. Treating them as full story-state checkpoints would overstate the source. Likewise, slots establish resumable saves, not a verified character-centered archive or search experience.

The source warns that browser storage can disappear and recommends downloading saves. The official FAQ says there is no direct cloud-drive integration. Local storage also does not imply private inference: Horde sends prompts to volunteers, and some provider connections use a disclosed CORS proxy. Self-hosting the frontend still requires a working generation backend. See the [official FAQ](https://koboldai.com/Koboldai.net/).

Image connections, browser/server speech output and voice input appear in source, but provider reliability and voice quality were not tested. Narrow-screen CSS and a [standalone, portrait-oriented PWA manifest](https://raw.githubusercontent.com/LostRuins/lite.koboldai.net/f53b6561137e3bf1f3ebcab91e704a8c585b1617/manifest.json) establish mobile intent only. Keyboard behavior, touch usability and recovery after network loss remain unknown.

## Patterns worth considering

- Show a premise and opening-message preview before starting a story. Preserve the distinction between character definition and conversation history.
- Place request inspection beside response details. Explain which memory and lore contributed without requiring writers to inspect raw JSON first.
- Make save location, export and storage-loss warnings visible where users resume stories.
- Explain branch scope before creation. Offer full-state checkpoints only when memory, lore and settings actually travel with the branch.

These are proposals, not implementation commitments. Do not copy numbered slots as the main history navigation without evaluating exact-story retrieval. Do not copy automatic image generation or complex provider choices into the default writing path merely because the source supports them. Keep those choices explicit and optional.

Sources: [repository](https://github.com/LostRuins/lite.koboldai.net), [official FAQ](https://koboldai.com/Koboldai.net/), [main guide](https://koboldai.com/Guides/Kobold_Lite/KoboldLite_Main/), [feature documentation](https://koboldai.com/KoboldAILite/), [pinned source](https://github.com/LostRuins/lite.koboldai.net/blob/f53b6561137e3bf1f3ebcab91e704a8c585b1617/index.html), [PWA manifest](https://raw.githubusercontent.com/LostRuins/lite.koboldai.net/f53b6561137e3bf1f3ebcab91e704a8c585b1617/manifest.json).
