# Homelab handoff for v1.19.14

Source: `06ab7010310dfa174be81d7eefa38ecdc195778c`.
[Release v1.19.14](https://github.com/Nulifyer/SillyTavern/releases/tag/v1.19.14).
[Workflow 42273796301](https://github.com/Nulifyer/SillyTavern/actions/runs/42273796301)
passed both native architecture builds, HTTP startup, heartbeat and publication.

```yaml
image: ghcr.io/nulifyer/sillytavern@sha256:5f8324a85c392cb2682b5c0892d7088bcf8687af9148413c1cfbe5336441c24b
```

- linux/amd64: `sha256:cd64e3eaa4538856f6d11747b6dbff36fd9281a163affb1b7a4ab55b822db3c2`
- linux/arm64: `sha256:36fa952fed1d629e064b5d09e05113f6dc8c27522b3b816b49ced499366d5daf`

Anonymous version, source and latest tags match. Twenty-four checked runtime
files match the tag. Local amd64 container `st-full-review-release14-20261106`
on port 8021 has five fresh synthetic volumes, no overlays, version 1.19.14,
valid native heartbeat and verified HTTPS 200 to Juiced.

All 43 Chromium browser cases passed on this actual image in 6.2 minutes,
including both live Juiced cases, with zero uncaught page errors. Console and
network diagnostics retain the intentional failure/retry and cancellation
fixtures; see v14-browser-summary.json. Source checks passed 41 controlled
cases plus the final character regression separately, 424 unit tests, lint and actionlint.

Standalone persistence passed after the suite, using the actual native settings
API with no mock routes. Advanced controls, Qwen3.5-2B, manual 12,288-token
context, temperature 0.85, image steps 20 and voice off survived native Save,
container restart and browser reload. Server metadata still reports 16,384;
manual context remains selected. Evidence: v14-persistence.json and
v14-manual-after-restart.png.

Visual review covers all 16 settings destinations and core story flows, with
independent baseline/follow-up/final captures and fresh Edit/Create review.
Desktop, tablet, 320/390px, enlarged text, native editors and pending navigation
are covered. The final actual-image character and live chat/image screenshots
were inspected, along with its manual onboarding, server setup and post-restart
phone settings. Exact findings, coverage and failed attempts: review.md.

v1.19.12 and v1.19.13 remain immutable; neither is this task's final deployment
recommendation. Actual-image follow-up findings are retained in review.md.

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
  thinking off. Test output budget 128; users retain their explicit budgets.
- Optional writer: `Qwen3.5-4B-Uncensored-HauhauCS-Aggressive-Q8_0`,
  512 output tokens, thinking off. Story model stays selected.
- Images: `z-image-turbo-nsfw-v2-GGUF-Q8_0`, stock sd.cpp root URL,
  explicit 512px, 8 steps, CFG 1, Euler/Simple. These are observed working fixture
  settings, not universal defaults or a speed promise.
- Vision: `Ornith-1.5-35B-A3B-GGUF-Q6_K` through native captioning/chat.
- Narration: `kokoro-v1`, `af_heart`; select available voices from discovery.
- Dictation: `asr4all-l-gptq-Q8_0`; microphone/file audio is normalized to
  mono 16 kHz PCM WAV, maximum 120 seconds. Recognized text enters the draft
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
