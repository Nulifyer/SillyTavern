# v1.19.19 release handoff

Verified for a later Homelab deployment. Production69, its app/data/config/volumes
and shared test85 were never accessed or changed. This thread did not deploy them.

## Immutable release

- [Release v1.19.19](https://github.com/Nulifyer/SillyTavern/releases/tag/v1.19.19)
- Source: `031bc97933cab8827b473080c50d95c52b9f55af`
- [Workflow 42324206240](https://github.com/Nulifyer/SillyTavern/actions/runs/42324206240): native amd64/arm64 builds, startup and publication passed.
- Image: `ghcr.io/nulifyer/sillytavern:v1.19.19`

Pin the image index:

```text
ghcr.io/nulifyer/sillytavern@sha256:4aaf8c5450b26d1086309de6321f9759b7b93f96d9a5eadacf489240411ee9a4
```

| Architecture | Manifest digest |
| --- | --- |
| linux/amd64 | `sha256:9665f6167c716b9e2748905d0ffa4860a6bc3aea12b530765190f4046c70d9a5` |
| linux/arm64 | `sha256:67c11b8316ae5f130196cf6c12ccf776df075aa65a2b8daa206c72f2e07e1d37` |

Version, `sha-031bc97933cab8827b473080c50d95c52b9f55af` and latest tags matched this index.
Both architecture labels identify the tagged source. Full browser/service checks
ran on amd64; ARM64 has native startup proof.

## Result and evidence

More/story menus close on outside click/tap, Tab exit and workspace actions.
Outside taps still activate the target. Escape closes native image choices,
Extension tools and More one layer at a time before background Stop. Native
editors/dialogs keep priority. Settings/recovered-text disclosures stay open.
Native chat-load timers respect later focus; synthetic clicks cannot dismiss menus.
Extensions finishing after their five-second startup timeout notify actual
readiness. Newly arrived service controls are grouped once; an empty active
category recovers without navigation, remounting existing forms or losing input.

The actual pulled image on 8028, `st-menu-query-release-20261106`, passed
all 68 browser cases together in 9.0 minutes with both live Juiced cases,
zero skips/flaky cases and zero uncaught page errors. Five fresh synthetic
volumes, no overlays, 31 tagged runtime matches, version/heartbeat and HTTPS 200
passed. Stock sd.cpp backend matches v1.19.8. 425 unit tests, root lint and actionlint pass;
test lint has 0 errors and 50 warnings. Desktop and Pixel 9 Pro XL touch/DPR3, portrait,
landscape, reduced height and enlarged text are covered. Final native menus and
settings persistence were checked visually without settings mocks.

- [Actual browser summary](browser-summary.json): every case, console errors and failed-request reasons.
- [Runtime/volume proof](released-source-check.json), [registry](registry/image-proof.json), [workflow](workflow.json).
- [Review and failed attempts](review.md), [source acceptance](source-acceptance.json).
- `released/`: per-case diagnostics, neutral live scene and mobile/menu renders.
- `manual/`: shared-browser renders, native Save/readback/reload proof.

Intentional outage/reset/permission/guard fixtures produce console and network
failures. Zero uncaught errors does not mean zero console/network events. Source validation used five focused cases: query navigation, both held-template
regressions and desktop/Pixel menus. The final actual image ran
all 68 together. The v1.19.17 baseline and all prior attempts remain linked in review.md. No case was excluded.

v1.19.17 passed its 65-case suite but failed the added held-extension regression
and subsequent controlled review. It is an immutable intermediate. The final handoff is
v1.19.19. [Earlier menu/host-network attempts](../review.md) remain preserved.

The manual query URL additionally exposed remote background-tab loading and
duplicate app/control IDs. v1.19.18 passed 67 cases but failed the new query
regression. v1.19.19 resolves local fragment tabs against the complete current
document URL, preserving queries without fetching the app index into a tab.
Both prior versions are immutable intermediates.

## Connections and migration

Preserve all existing production volumes, mount paths, network/Traefik boundaries,
profiles, keys and sampling. This release adds no settings/chat format migration.
Homelab must record the actual pre-update image and private backup before changing
only the image reference. Never mount these local test volumes into production.
Reload open tabs after recreation to load one consistent version.

Existing connections need no discovery reset. Advanced controls, All controls and
classic layout retain native options. For a new setup, follow
[model-services.md](../../../model-services.md): enter
`https://juiced.swarm.nulteck.com` once in Settings → Servers, Verify & discover,
then select/apply only the wanted services. Native owners keep the settings.
OpenAI services use `/v1`; stock sd.cpp uses the root without `/v1`.

Observed live selections:

- Story: `TheDrummer_Skyfall-31B-v4.2-GGUF-IQ4_NL`, streaming, 16K, thinking off.
  Explicit context/sampling remain editable; reported configured capacity can
  size new connections automatically. A connected model can still reject a
  prompt template: the reproduced Qwen3.5-2B first-reply case uses native
  **Semi-strict (alternating roles; with tools)** processing.
- Optional image writer: `Qwen3.5-4B-Uncensored-HauhauCS-Aggressive-Q8_0`, 512
  output tokens, thinking off. Current chat remains the default; a separate writer
  never replaces the story model. Instructions and budget remain editable.
- Images: `z-image-turbo-nsfw-v2-GGUF-Q8_0`, stock sd.cpp txt2img. Neutral fixture
  used 512px/8 steps/CFG 1/Euler/Simple. Explicit parameters win. This server subset
  does not provide A1111 img2img/hires/scripts/server image saving.
- Voice: opt-in OpenAI Compatible, `kokoro-v1`, `af_heart`; voices are discovered.
- Dictation: `asr4all-l-gptq-Q8_0`, native compatible endpoint, mono 16 kHz PCM WAV.
  Browser permission/secure context applies; transcription enters an unsent draft.
- Vision: `Ornith-1.5-35B-A3B-GGUF-Q6_K`, native compatible chat endpoint.

LAN/VPN access is key-free here. Other providers retain their native key fields.
Disabled services require user enablement; no model policy/runtime/cache was
changed. Ornith persistent cache qualification remains Chat Completions with
stable `X-Juiced-Session-Id`; this task makes no broader cache claim. Physical
phone lock/microphone, audible quality and paid providers remain unqualified.

## Rollback

Record the actual pre-update image privately. Verified fallback v1.19.16:

```text
ghcr.io/nulifyer/sillytavern@sha256:f54190820e830b5ff24eb760136504c6c6ecf9ecf9523997abfbc5a6fdc3b657
```

Recreate with the same production volume identities and no source overlays, then
reload tabs. Retain the private backup; do not restore it over newer chats without
the owner's recovery plan. v1.19.16 retains draft/reply recovery but lacks this batch's menu/readiness/query
fixes. Use the plain root URL when rolling back. Copy any unsaved
text before clearing browser storage or choosing an older fallback without it.
