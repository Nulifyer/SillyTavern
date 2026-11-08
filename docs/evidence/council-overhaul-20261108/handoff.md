# Council overhaul release handoff

Status: v1.19.23 verified and accepted by all three original council members.
Do not deploy v1.19.22 from this handoff.
The same story, control and quality council members approve the finished scope
and released-image evidence. Each reports satisfied=true with no open findings.

Council reviews: [story](story/review.md), [native control](control/review.md),
[UI and quality](quality/review.md). Their direct interaction used independent
source fixtures. Final approval also reviewed matching published-image evidence,
parent-run browser/service checks and actual-image screenshots; it is not a claim
that all three independently drove the final container.

## Published identity

- Release: [v1.19.23](https://github.com/Nulifyer/SillyTavern/releases/tag/v1.19.23).
- Tagged source: `640283d97ec54996b6b91d0bff88ff7c79213cd4`.
- [Workflow 42524646047](https://github.com/Nulifyer/SillyTavern/actions/runs/42524646047)
  passed native amd64/arm64 HTTP and enabled heartbeat startup gates.
- Image index: `sha256:14327cb00f8adf4504502f1abc7395dcf64dcc9c9aa200394146ae428d009d72`.
- linux/amd64: `sha256:2aaa54b777919f4503e20905b5567bf1da8938998a6576f8c2f3c99e2ffca964`.
- linux/arm64: `sha256:a9845bf2f1d3380792fbe7ccf71c4403de3b8a1f808e8ceed789227d41a0f3be`.

```text
ghcr.io/nulifyer/sillytavern@sha256:14327cb00f8adf4504502f1abc7395dcf64dcc9c9aa200394146ae428d009d72
```

Anonymous registry requests verified version, full-commit and latest tags share
this index. Both architecture labels identify the tagged source and version.
The pulled amd64 image reports 1.19.23, matches 20 runtime hashes, passes native
heartbeat and reaches Juiced through default HTTPS certificate verification.
The stock image endpoint matches v1.19.8. The full actual-image browser suite passed.

## Verification

- Source: 501 unit tests in 27 suites, root lint and actionlint pass. Test lint
  reports zero errors and 53 warnings. The frozen source passed all 99 browser
  cases in 691.69 seconds, including both opt-in live Juiced cases.
- Actual pulled amd64 image: all 99 browser cases passed together in 759.51
  seconds, both live cases, zero skipped/flaky results and no uncaught page
  errors. [Report and diagnostics](release-v23/summary.json).
- Console/network diagnostics remain visible. Actual-image runs recorded 54
  console errors and 85 failed requests: 81 aborted, 3 ERR_FAILED and 1 controlled
  incomplete chunk. The source run recorded 56 console errors and 87 failed
  requests. Fault-test diagnostics are retained, not called a clean console.
- Fresh setup used five new synthetic volumes with no source overlays. A
  separate existing synthetic v1.19.22 profile upgraded to the same v1.19.23
  image with all five of its volume identities preserved. Exact story integrity,
  premise, browser draft, provider, URL, model, 32768 context and 0.83 temperature
  matched before and after. [Migration readback](release-v23/migration-after.json).
  Automatic reconnect stayed disabled as configured; no inference was sent in
  this manual migration check. Desktop and 448x921 chat/Scene details renders
  and Escape draft preservation are recorded in [manual review](release-v23/manual-review.json).

The original v1.19.22 actual-image 92/93 failure remains held evidence. Controlled
rename timing and character-publication failures fail that image and pass the
replacement. The later inherited-preference source 95/99 run and keyboard 98/99
run remain documented, along with their focused corrections. The original
untraced v1.19.22 failure remains unattributed. See [evidence index](index.md).

## Product outcome

The council chose an optional Scene details flow: inspect Setup & memory, inspect
the selected reply's recorded client context, correct native story settings, and
find related stories. It preserves the native transcript and composer. Starting
a story remains immediate, with automatic naming and optional Rename afterward.
Native advanced settings, presets, prompt editors, providers, extensions and
classic layout remain available. There is no recovered character-text popup.

Summary text, its native effective anchor and paused/injected states are visible.
Attached lore means configured attachments, not proof that a request activated
an entry. Shared character definitions and story-only overrides have distinct
scope. Apply, Cancel and Escape use the native editor; failed save keeps pending
text and offers retry. Branch/checkpoint creation waits for save acknowledgement,
preserves selected alternatives and does not register a failed cast branch.
The shared keyboard handler preserves native button, link and editor behavior;
custom controls activate once. A real Enter/file-picker regression covers the
observed duplicate activation and keeps custom menu keyboard behavior intact.

Reply captures are browser-local diagnostics for one exact account, entity,
story, message, swipe and response revision. They retain at most 60 captures, each
bounded to 240000 characters with component/message limits and labeled omissions.
They show recorded client assembly and allowlisted request fields. They do not
expose server conversion, provider processing or model templates. Counts are not
fabricated additive token accounting. Legacy, edited, copied or evicted captures
say unavailable. The old native itemization cache remains untouched.

## Connections and controls

1. Open Settings, Servers. Enter `https://juiced.swarm.nulteck.com` and Verify &
   discover. Select only wanted services. Existing native settings/profile owners
   persist selections; there is no parallel inference proxy or hardcoded catalog.
2. Under Story replies, select `TheDrummer_Skyfall-31B-v4.2-GGUF-IQ4_NL` and Use
   model. The native compatible base is `/v1`. Current discovery reported 32768
   context in manual setup. The live acceptance fixture uses an explicit 16384
   context budget; this is a bounded test, not a claim that 16K is model capacity.
   Reply controls expose context, output and common sampling overrides. Advanced
   controls retain full native provider, prompt-processing and preset controls.
   If native automatic reconnect is disabled, use Use model or the native Connect
   action again after reload. The saved server and model do not need re-entry.
3. Image prompts remain current-chat by default. An optional separate Connection
   Manager writer can use `Qwen3.5-4B-Uncensored-HauhauCS-Aggressive-Q8_0` with 512
   output and thinking off. Instructions and budget remain editable. This does
   not replace the story model.
4. Images use the stock stable-diffusion.cpp protocol at the HTTPS root, without
   `/v1`, with `z-image-turbo-nsfw-v2-GGUF-Q8_0`. The neutral fixture explicitly
   uses 512px, 8 steps, CFG 1, Euler/Simple. Explicit sampling wins. Juiced offers the
   txt2img/discovery/progress subset, no img2img, hires or server image saving.
5. Optional speech uses OpenAI Compatible `/v1/audio/speech`, `kokoro-v1` and
   `af_heart`. Select from voices actually discovered. Dictation uses
   `/v1/audio/transcriptions`, `asr4all-l-gptq-Q8_0`, secure-context microphone
   permission and visible failure/retry. Transcription becomes an editable user
   draft and is never automatically sent. Vision uses the actual enabled Ornith
   catalog selection rather than a generic alias.

The separate live Qwen3.5-2B case reproduces the post-history system-message error
and recovers with native **Semi-strict (alternating roles; with tools)**. Discovery
alone does not establish every model's prompt-template compatibility. See
[the first-reply instructions](../../model-services.md#connected-but-the-first-reply-fails).

LAN Juiced access is key-free. Other providers retain normal key support.
Disabled models require explicit server-side enabling by the user. No runtime,
policy, backend or cache settings changed. Persistent-cache claims remain limited
to documented Chat Completions semantics with a stable X-Juiced-Session-Id.

## Migration and rollback

This release adds optional message capture references and branch origins. It does
not bulk rewrite chats, character cards or existing settings. Old stories remain
readable without captures or guessed ancestry. Drafts retain account/entity/file
isolation; rename acknowledgement does not claim an atomic metadata transaction.

Homelab owns the later production update. Preserve all existing volume identities
and mount paths, including config, data, plugins, extensions and backups where
present. Take the normal private pre-update backup. Pull/recreate the chosen
immutable image under the existing infrastructure contract. Do not copy synthetic
test volumes or source overlays into production, overwrite existing settings with
an init script, or restore older backups over newer chats without a recovery plan.

Shared test stack85 was not used. If Homelab later reuses it, its old writer
source overlay must be removed through its owning guarded procedure before
qualifying a published image. Preserve its volume identities and user-added work.

Verified rollback image v1.19.21:

```text
ghcr.io/nulifyer/sillytavern@sha256:a2831236504e74d4eb4c20fb8eb8736b38b9897bbffd20e3de7ea537e510aaa0
```

Use the same volume identities. No production app, data, config, screens, logs or
volumes were accessed and no production deployment was performed for this task.

## Limits

Chromium desktop/mobile emulation includes Pixel 9 Pro XL, 448x997 screen and 448x921
browser, reduced 400px height, landscape, 320/390/768px widths and enlarged native
text. Physical phone lock/GPU restoration, real microphone hardware, audible
speech quality and paid-provider behavior remain unqualified. Native ARM64
startup gates do not establish ARM64 browser/live behavior. An image upload
already submitted when Stop is pressed can leave an unused media file.
