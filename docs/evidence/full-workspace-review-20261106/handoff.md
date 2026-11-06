# Full workspace review release handoff

Source: `607198579bb3090dcda68c34aab252d2558c5647`.
[Release v1.19.13](https://github.com/Nulifyer/SillyTavern/releases/tag/v1.19.13).
[Workflow42270651338](https://github.com/Nulifyer/SillyTavern/actions/runs/42270651338)
passed both native build/startup/heartbeat gates and publication.

```yaml
image: ghcr.io/nulifyer/sillytavern@sha256:fadeb1b6bb283c80d26d3488c3a49e134b0acb262a0df94d7ad51e14c0a682d8
```

- linux/amd64: `sha256:2e9718adedf4f00dd3a3bd44a3e16d8898b292977807433509de3033213c6d8c`
- linux/arm64: `sha256:1f84ca9214df7a10e82b7552962bfc2084b84bab53e1735bfffec951054df0b6`

Anonymous tag, source-tag and latest manifests match. Twenty-four checked runtime
files match the tag. Local amd64 container st-full-review-release13-20261106 on
8020 has five fresh synthetic volumes/no overlays, version1.19.13, valid native
heartbeat and HTTPS200 to Juiced. Actual-image42-case acceptance passed, but pixel review then found native
character toolbar overlap. This v1.19.13 block is historical. Final deployment
recommendation is pendingv1.19.14 and its43-case image acceptance.

Do not use v1.19.12 or v1.19.13 as this task's final deployment recommendation. Its tag
remains immutable; actual-image native-mode and keyboard findings are retained
in review.md.

Homelab owns the later update. Production endpoint7 stack69, its application
and all private data/config/volumes were never accessed. Shared test85 was also
untouched. Local synthetic volumes are separate and must never be mounted into
production. Preserve existing config/data/plugins/extensions/backups identities
and Traefik/network boundaries. Record the actual pre-update image and take the
normal matching private backup before changing the service image. Reload tabs
after recreation so they load the new assets.

The new UI opens character/cast stories immediately with automatic native names.
Rename is available afterward; existing transcripts remain intact. Settings
opens Servers, with grouped phone categories and persistent Done. Native
prompts, provider profiles, explicit sampling and extension owners remain.
Advanced controls exposes native settings in the workspace; All controls removes
section filters. Appearance & behavior retains classic layout for original
windowing and themes. Provider-specific controls remain conditional.

Enter https://juiced.swarm.nulteck.com once in Settings > Servers, then Verify &
discover. Select each wanted service and Use model. Optional services remain
optional; audio remains opt-in. Native provider forms continue to own keys for
other providers. This LAN deployment is key-free. Do not use container DNS
http://juiced:8080 from a local container without the required shared network.
Chat uses /v1; stock stable-diffusion.cpp uses the root URL. Setup derives those
addresses and discovers models/voices without a second persistent registry.

Existing explicit context limits remain manual. Use discovered context size
opts into the reported runtime capacity; it does not use training maximum.
Editing context or choosing an explicit preset disables automatic sizing.
Setup preserves explicit sampling. A separate image writer is optional; current
chat remains the default, and writer instructions/output budget stay editable.
Vision uses the shared story-server address and follows its native choice of
current story model or a separate model. No enabled embeddings model was
reported; Retrieval retains native provider setup.

Live fixture selections (nonexplicit synthetic story/image/audio):

- Story: `TheDrummer_Skyfall-31B-v4.2-GGUF-IQ4_NL`, 16K, streaming,
  thinking off. Test output budget128; users retain their explicit budgets.
- Optional writer: `Qwen3.5-4B-Uncensored-HauhauCS-Aggressive-Q8_0`,
  512 output tokens, thinking off. Story model stays selected.
- Images: `z-image-turbo-nsfw-v2-GGUF-Q8_0`, stock sd.cpp root URL,
  explicit512px/8steps/CFG1/Euler/Simple. These are observed working fixture
  settings, not universal defaults or a speed promise.
- Vision: `Ornith-1.5-35B-A3B-GGUF-Q6_K` through native captioning/chat.
- Narration: `kokoro-v1`, `af_heart`; select available voices from discovery.
- Dictation: `asr4all-l-gptq-Q8_0`; microphone/file audio is normalized to
  mono16kHz PCM WAV, maximum120seconds. Recognized text enters the draft
  for review and is never sent automatically. Secure context and browser
  microphone permission are required for recording.

For the reproduced Qwen3.5-2B first-reply late-system error, choose the native
Semi-strict (alternating roles; with tools) Prompt Post-Processing setting and
retry. Discovery does not establish that every model accepts every assembled
story prompt. The original user's model remains unknown.

Rollback must use the actual recorded pre-update image and the same volumes.
Verified fallback v1.19.11 index:
`ghcr.io/nulifyer/sillytavern@sha256:6e2a1b345b05c6fa45ff4fe0fa550b2687f2d38b23d830e596aa4b439aa76c49`.
Retain the pre-update backup if settings need restoring. Never delete volumes,
reset user data, move published tags or restore an old backup over new chats
without the owner's recovery plan. If test85 is reused, its old writer overlay
must be removed through the owning Homelab procedure before image acceptance,
while preserving its volume identities and user-added test work.

Coverage limits: Chromium desktop/mobile viewports, not physical phone hardware;
physical microphone and audible quality unqualified. Paid-provider inference,
all alternate-provider conditional forms, administrator mutations and extension
installation are not qualified. ARM64 receives native CI startup/heartbeat
gates; full browser/live-service acceptance runs on amd64. sd.cpp remains a
txt2img subset without img2img, hires or server-side saving. No Juiced runtime,
policy or cache was changed. Persistent caches are not generally qualified by
this client review and still require their documented session semantics.
