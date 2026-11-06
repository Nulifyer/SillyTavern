# Container releases

This fork publishes `ghcr.io/nulifyer/sillytavern` from published GitHub Releases.
Ordinary branch pushes and tag pushes do not publish images.
Each build checks out the release tag, rather than the current `release` branch.

## Publish a release

For a new fork, enable GitHub Actions on the Actions tab before publishing.
This fork has Actions enabled.

1. Push the completed changes to the fork's `release` branch.
2. Create a version tag on that commit, such as `v1.19.16`.
3. Publish a [GitHub Release](https://github.com/Nulifyer/SillyTavern/releases/new) for that tag.
4. Wait for [Publish release container](https://github.com/Nulifyer/SillyTavern/actions/workflows/docker-publish.yml) to succeed.

Use tags that are valid container tags: letters, numbers, underscores, periods,
and hyphens, with no leading period or hyphen. Tags must be at most 128 characters.
Do not move published tags. Create a new tag for a new build.

The workflow publishes one image index with `linux/amd64` and `linux/arm64` builds.
Docker and Podman select the matching architecture when they pull the image.
Each architecture builds on its own native GitHub runner. Both images must pass
HTTP startup and the enabled heartbeat check before the workflow combines them
into the release image index. Architecture staging tags use `sha-<commit>-<arch>`;
use the release, commit, or latest tag for homelab deployments.

| Image tag | Purpose |
| --- | --- |
| `v1.19.16` | The exact GitHub Release tag |
| `sha-<full-commit-sha>` | The commit checked out for that release |
| `latest` | The release GitHub currently identifies as its latest stable release |

Prereleases never update `latest`. Republishing an older release does not update
`latest`. The workflow summary includes the published digest for a fixed image
reference, such as `ghcr.io/nulifyer/sillytavern@sha256:...`.

To retry a build, open the workflow and select **Run workflow**. Enter an existing
published release tag. Draft releases and tags without a published release are rejected.
The workflow uses `GITHUB_TOKEN` with `packages: write`; no registry secret is required.
The upstream npm publishing workflow is disabled for forks.
Upstream issue, pull request, and merge-conflict bot jobs run only in
`SillyTavern/SillyTavern`. The fork does not have the upstream GitHub App credentials.
Runs 37719493332 and 37719493429 failed at token creation because `appId` was missing.
Repository guards prevent those inherited jobs from failing on fork pushes.
The fork's lint, unit-test, and release-container jobs remain available.

## Allow your homelab to pull the image

The first release of this fork was verified with an anonymous registry request.
Your homelab can pull the image without a registry login.
If package visibility changes, open the [package settings](https://github.com/users/Nulifyer/packages/container/sillytavern/settings)
and select **Public** to allow anonymous pulls.

If you keep the package private, create a personal access token with `read:packages`.
Use it with `docker login ghcr.io --username Nulifyer --password-stdin` on the homelab.
Podman supports the equivalent `podman login` command.
See [GitHub's registry documentation](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry).

## Update a Compose deployment

Change the existing service's image to:

```yaml
image: ghcr.io/nulifyer/sillytavern:latest
```

Keep your existing config, data, plugin, and extension volumes.
The fork uses the same mount paths as upstream SillyTavern.
Then pull and recreate the service:

```sh
docker compose pull sillytavern
docker compose up -d sillytavern
```

The included `docker/docker-compose.yml` uses the fork's image and does not build locally.
To pin a release, put `SILLYTAVERN_IMAGE_TAG=v1.19.16` in the deployment's `.env` file.
For a new deployment using the included file, run:

```sh
docker compose -f docker/docker-compose.yml pull
docker compose -f docker/docker-compose.yml up -d
```

To roll back, select a previous image tag whose publish workflow succeeded, pull
it, and recreate the service.
Use the workflow's digest reference when you need to pin the exact published image.

## v1.19.10 publication record

Published source `bdda669a52be568ecc61729ac566b93d2dafd3cd`,
[workflow 41521719715](https://github.com/Nulifyer/SillyTavern/actions/runs/41521719715),
image index `sha256:b4c7ed23b175064356b82a709990c5d33873420f47d8848feb2ef41f87f7a10a`.
Both native architecture startup gates passed. The retained image browser run
passed 32 cases and failed 1 literal-model-output assertion after successful
first-reply recovery. The interrupted final rerun has no surviving result.
Its evidence is in `docs/evidence/service-workspace-20261102/`. v1.19.11 adds
explicit advanced access and will supersede this unfinished acceptance handoff.

## Verified release

### v1.19.16

[Release v1.19.16](https://github.com/Nulifyer/SillyTavern/releases/tag/v1.19.16)
is source `05e7858f429a5fc5680e2d64919a47f5505d029d`.
[Workflow 42310788170](https://github.com/Nulifyer/SillyTavern/actions/runs/42310788170)
passed native amd64/arm64 startup, heartbeat and publication gates.

```text
ghcr.io/nulifyer/sillytavern@sha256:f54190820e830b5ff24eb760136504c6c6ecf9ecf9523997abfbc5a6fdc3b657
```

- linux/amd64: `sha256:7381723771bccf5f78eee8da195d78462687f484d7ddc2e3511f4d1375f3ff38`
- linux/arm64: `sha256:bd73ac13eb42a1e7d2a45b2850a580b13f1c22d5f4cd6e0b36ee157af2acd418`

Adds per-story draft and unsaved reply recovery across browser suspension/reload.
Native generation handles interrupted streams and cast queues without replay;
read-only foreground checks preserve settings and model dropdowns. Late readiness
and prompt-counting dry runs cannot erase newer failures. Hidden microphone
recording/permission cancels safely. Advanced controls and Pixel sizing remain.

The pulled image passed all 63 browser cases in 8.2 minutes with both live Juiced
cases, zero skips/flaky cases/uncaught page errors. Five fresh synthetic volumes,
no overlays, 28 tagged runtime-file matches, heartbeat/version and HTTPS passed.
Real native Save/stop/start/Retry/reload retained explicit settings and exact text.
Recovery renders at 448×921, 448×400 and 320px/enlarged text were inspected.
425 unit tests, root lint and actionlint pass; test lint has 0 errors/28 warnings.
Console/network events and corrected source fixtures are retained and classified.

[Handoff, connections, evidence and rollback](evidence/mobile-resume-20261106/handoff.md).
Homelab owns deployment. This thread never accessed or updated production69/shared85.
Physical phone lock remains unqualified. ARM64 has native startup proof; full
browser/live-service acceptance ran on amd64. OS discard cannot reattach an old
HTTP inference request; local text recovery supports explicit continuation.


### v1.19.15

[Release v1.19.15](https://github.com/Nulifyer/SillyTavern/releases/tag/v1.19.15)
is source `f7dcc34e95690561d607ae779a0c218cea5944e4`.
[Workflow 42298436889](https://github.com/Nulifyer/SillyTavern/actions/runs/42298436889)
passed native amd64/arm64 startup, heartbeat and publication gates.

```text
ghcr.io/nulifyer/sillytavern@sha256:28c8a422df7b9ad588a9308c74ea73bacd3744919bd50b19056e18be981b92a7
```

- linux/amd64: `sha256:0d98b09ee4c92999ee433554595e3d32b2aba48def6ed86220c2bec170f6300d`
- linux/arm64: `sha256:8e1563d2322f22830f2631f3b398de5efd7293b22b1ab357a82672e8cb6921c4`

Fixes the mobile message portrait rendering at 50×50px inside a 30×38px
container. The image follows its responsive container and the avatar column
cannot shrink into text. Pixel 9 Pro XL browser emulation covers portrait,
landscape, reduced browser/keyboard height, DPR 3 and normal/150% native text.
No settings-schema or inference code changed.

The actual pulled amd64 image passed all 45 browser cases in 6.2 minutes,
including both live Juiced cases, with zero uncaught page errors. A final
focused portrait capture rerun passed. The 18-state Android/touch/DPR3 bounds
matrix and final normal/enlarged/landscape renders passed inspection. Five
fresh synthetic volumes, no overlays, 24 tagged runtime-file matches, native
heartbeat/version and HTTPS Juiced reachability passed. Version/source/latest
tags and both architecture labels match. Source lint, 424 units and actionlint
pass; test lint has zero errors and 24 warnings.

[Handoff, evidence and rollback](evidence/mobile-portraits-20261106/handoff.md).
Homelab owns deployment. Production69 and shared test85 remain untouched.
Physical Pixel hardware is not qualified. ARM64 has native startup gates;
full browser/live-service acceptance ran on amd64. Existing connection and
volume-preservation instructions remain in the v1.19.14 handoff below.

### v1.19.14

[Release v1.19.14](https://github.com/Nulifyer/SillyTavern/releases/tag/v1.19.14)
is source `06ab7010310dfa174be81d7eefa38ecdc195778c`.
[Workflow 42273796301](https://github.com/Nulifyer/SillyTavern/actions/runs/42273796301)
passed native amd64/arm64 builds, HTTP startup, heartbeat and publication.
Anonymous version, source and latest tags share this immutable index:

```text
ghcr.io/nulifyer/sillytavern@sha256:5f8324a85c392cb2682b5c0892d7088bcf8687af9148413c1cfbe5336441c24b
```

- linux/amd64: `sha256:cd64e3eaa4538856f6d11747b6dbff36fd9281a163affb1b7a4ab55b822db3c2`
- linux/arm64: `sha256:36fa952fed1d629e064b5d09e05113f6dc8c27522b3b816b49ced499366d5daf`

The pulled amd64 image passed all 43 browser cases in 6.2 minutes, including both
live Juiced cases, with zero uncaught page errors. It has five fresh synthetic
volumes and no source overlays. Twenty-four runtime files match the tag; the
stock sd.cpp handler still matches v1.19.8. Version, HTTPS Juiced reachability,
and native heartbeat passed. Standalone native Save, restart and browser reload
preserved Advanced controls, the selected model, manual context, temperature,
image steps and voice off.

The visual review covers all 16 settings destinations and core story flows,
with desktop/tablet/phone and enlarged text. It adds immediate character/cast
story creation, recoverable history failures, shared keyboard ownership,
service state derived from native owners, grouped phone settings and readable
native character actions. Advanced controls, All controls and classic layout
retain native options. Source checks passed 41 controlled cases, a focused final
character regression, 424 unit tests, lint and actionlint. The two live cases
were disabled only in the CSS-only source run and both passed on the final image.

v1.19.12 and v1.19.13 remain immutable intermediate releases. Actual-image checks
found further native vision/keyboard/cancellation state issues in v1.19.12;
v1.19.13 passed 42 cases before pixel inspection found character-toolbar overlap.
The added regression fails on v1.19.13 and passes on this image. Neither older
version is this review's final deployment recommendation.

[Homelab handoff](evidence/full-workspace-review-20261106/handoff.md) records
exact setup, migration, rollback and limits. Production69 and shared test85
were never accessed or updated. Preserve every existing volume identity and
record the actual pre-update image and private backup before Homelab deploys.
ARM64 passed native startup gates; full browser/service acceptance ran on amd64.
Physical microphone, audible quality, paid-provider inference and administrator
mutations remain unqualified. No Juiced runtime, policy or cache was changed.

### v1.19.11

[Release v1.19.11](https://github.com/Nulifyer/SillyTavern/releases/tag/v1.19.11)
is source `78bca3473f897ddf8f8552179296b37155af833f`. [Workflow 42248135919](https://github.com/Nulifyer/SillyTavern/actions/runs/42248135919) passed both native
amd64/arm64 builds, HTTP startup, heartbeat and multiarch publication gates.
Anonymous registry requests verified the version, source and latest tags share:

```text
ghcr.io/nulifyer/sillytavern@sha256:6e2a1b345b05c6fa45ff4fe0fa550b2687f2d38b23d830e596aa4b439aa76c49
```

- linux/amd64: `sha256:942311a7bfe01d76745f207cfa92a5e45ed1ffcc298e1d031b00f19b6a7645b2`
- linux/arm64: `sha256:01b3796142d836ba92309a3074a371d2c9ab19857ca8668755a48095f5f1cdcc`

An empty-auth Podman pull succeeded. The actual amd64 image passed all 34 browser
cases, including both real Juiced cases, with zero uncaught page errors. It ran
on 8016 with five fresh synthetic named volumes and no source overlays. Eighteen
files match the tag; the stock sd.cpp handler still matches v1.19.8. HTTPS Juiced
reachability, native heartbeat and version 1.19.11 passed. The Advanced controls
preference and selected native settings survived a standalone container restart.

The release keeps advanced controls inside the simplified workspace. All controls
removes section filters; classic layout remains available for native windowing
and themes. Source checks passed 424 unit tests, lint and actionlint. Real service
proof covers story streaming, independent writer/image, Ornith captioning,
67 discovered voices, decoded Kokoro speech and ASR draft insertion without
sending. Physical microphone and audible quality remain unqualified. Retrieval
keeps native provider setup; no enabled embeddings model was reported.

[Homelab handoff](evidence/advanced-controls-20261106/handoff.md) contains exact
setup, migration and rollback steps. Preserve existing volumes and retain the
actual pre-update image and backup. Verified fallback is v1.19.9 below.
Production69 and shared test85 were never accessed or changed. Evidence:
`docs/evidence/advanced-controls-20261106/`.

### v1.19.9

[Release v1.19.9](https://github.com/Nulifyer/SillyTavern/releases/tag/v1.19.9)
was published from source `9ab8d2cedec44448c7f8ea49c4dfba5c8799ebf1` by
[workflow 41404996482](https://github.com/Nulifyer/SillyTavern/actions/runs/41404996482).
Both native amd64/arm64 build, HTTP startup and enabled heartbeat gates passed.
Anonymous registry requests verified that `v1.19.9`, the full-source tag and
`latest` share this immutable image index:

```text
ghcr.io/nulifyer/sillytavern@sha256:1aeffc008478d6923152ae4dc61eb3115c56e97d0da3cb3a62b8cc17f4be33bf
```

Architecture manifests:

- linux/amd64: `sha256:1ffeb88b9a12c44b68f4599a4c22d42d385b48e84acdbd29c5abd69fe2116d0b`
- linux/arm64: `sha256:8d09f7dd4f1ca371c9dc6aee66e076b1c4a66ca77fda736089729ad838c54984`

OCI labels on both architectures identify the tagged source and version.
An empty-auth Podman pull succeeded. The actual amd64 image ran locally at
`http://127.0.0.1:8014` with five fresh named volumes and no source overlays.
It reported version 1.19.9 and passed enabled native heartbeat. Eighteen selected
source/config files matched the tag, including the stock image backend, which
also matches v1.19.8 byte-for-byte.

Source lint and all 423 unit tests passed. All 27 browser cases passed against
both committed source and the actual GHCR image. Coverage includes every
Settings category at 1280/390/320px, section and popup ownership, navigation,
story lifecycle, keyboard, pending requests, failure/retry, stale discovery,
synthetic settings preservation/reload, independent dictation with TTS disabled,
and larger-text/reduced-height mobile flows. Real Juiced checks used streaming
story chat, an independent writer, one neutral scene image, browser-decoded
speech and speech-to-transcription draft insertion. The browser never sent that
transcript as a chat message. No page errors were captured in the real flow.
ARM64 passed native startup gates; full browser/service acceptance ran on amd64.

[Evidence](evidence/ui-juiced-20261102/) includes before/after render screenshots,
source/released browser logs, live request summaries, native save/reload proof,
manifest/OCI labels, workflow jobs and selected source hashes. Browser coverage uses Chromium desktop/mobile viewports. Physical microphone
hardware, audible quality and paid providers were not qualified.

First-reply follow-up: `Qwen3.5-2B` rejects a later system message from native
post-history instructions with `System message must be at the beginning`.
The existing **Semi-strict (alternating roles; with tools)** prompt-processing
setting resolves the reproduced case on this exact release image. Discovery
alone does not check story-prompt compatibility. See the
[connection steps](model-services.md#connected-but-the-first-reply-fails) and
[first-reply evidence](evidence/first-reply-formatting-20261102/).
This configuration correction needs no replacement image or tag.

Shared-screen follow-up: the user confirmed their affected page is v1.19.8.
The v1.19.9 image then passed the expanded 27-case controlled browser suite;
the 2 live cases were skipped in this follow-up because inference code did not
change. The original release's live evidence remains above. Added coverage
changes settings across 33 category/viewport checkpoints and completes a delayed
save after navigation. All 12 categories were visually inspected at
1280/390/320px. See [follow-up evidence](evidence/shared-screen-lifecycle-20261102/).
No new image is required. The affected instance needs the existing v1.19.9 fix.

#### Homelab handoff

Production endpoint7 stack69 and its data were never accessed or updated by this
task. Shared test stack85 was also untouched. Homelab owns the later update.
Before deploying, take the normal private config/data backup, preserve all
existing volume identities and mount paths, and change only the image reference
under the existing deployment/network contract. Do not mount test data into
production. No chat or character format migration was introduced.

If stack85 is reused to verify this release, remove its old three-file writer
source overlay using its owning Homelab procedure before testing. An overlay can
mask defects in the published image. Preserve the test volume identities and any
user-added test work. This local verification used no overlays.

For connection setup, follow [model-services.md](model-services.md). Enter
`https://juiced.swarm.nulteck.com` once in Models & connections, then Verify &
discover. Select only the services wanted. Native settings and saved profiles
remain the configuration owners. Tested selections:

- Story: `TheDrummer_Skyfall-31B-v4.2-GGUF-IQ4_NL`, 16K context, streaming,
  thinking off through native Additional Parameters. Test replies used 128 output
  tokens; setup preserves the user's explicit response/sampling preferences.
- Optional writer: `Qwen3.5-4B-Uncensored-HauhauCS-Aggressive-Q8_0`, 512 output
  tokens, thinking off. Current chat remains the default. Instructions/budget
  stay editable in Image generation. The story model remains selected.
- Images: stock stable-diffusion.cpp at the root URL, model
  `z-image-turbo-nsfw-v2-GGUF-Q8_0`. The neutral fixture explicitly selected
  512px, 8 steps, CFG 1, Euler/Simple. Setup does not overwrite sampling.
- Narration: OpenAI Compatible, `kokoro-v1`, `af_heart`. Discovery returned 67
  backend voices. Voice remains opt-in and preserves previous explicit choices.
- Dictation: `asr4all-l-gptq-Q8_0`. Microphone and audio-file decoding send mono
  16 kHz PCM WAV; text goes into the draft for review, never automatic sending.

The service is key-free for this LAN deployment. No credentials were requested,
fabricated for runtime access or copied from another deployment. Other providers
retain their native key settings. No Juiced runtimes, model policies or caches
were reconfigured. Generic OpenAI-compatible servers retain chat discovery and
native optional-service settings.

The deployed FUTO service rejected unnormalized speech WAV with HTTP 400,
`Use 16 kHz WAV, 1-8 channels, maximum 120 seconds`. The exact reproducible server
compatibility gap is in `transcription-format-gap.json`. Generic browser audio
encoding passes; Juiced owns support for other OpenAI input formats. This release
adds no Juiced-specific inference proxy or alternate image adapter. sd.cpp remains
a txt2img subset without img2img, hires, scripts or server-side image saving.
Persistent cache qualification still requires the documented stable session
header; setup does not add it or change cache policies.

Rollback pin:

```text
ghcr.io/nulifyer/sillytavern@sha256:201db6d8f386bd366064ca1cc7d0e8b51da9b442cb53d539b7b72ee330ef0085
```

That is the verified v1.19.8 index. Pull/recreate with the same production volume
identities and no source overlays. Retain the pre-update settings/data backup.
Do not restore old backups over newly written chats without the owner's recovery
plan. The older image does not expose the new separate-writer/dictation UI.

### Writer integration trial before v1.19.9

The working source adds an optional Connection Manager image-writer profile with
editable system instructions and output budget. Juiced v0.5.0 now serves the
existing sd.cpp image protocol directly. The temporary OpenAI image transport
patch, format selector and five format-only tests were removed after real image
acceptance. The backend image handler is identical to published v1.19.8.
Current-chat prompt generation remains the default. No additional proxy is required.

This trial used uncommitted, unpublished source. The fresh homelab test at
https://sillytavern-test.swarm.nulteck.com uses v1.19.8 with a persistent source
overlay. It does not mount production data. Focused lint and all411 remaining
unit tests passed after transport removal. The unchanged backend produced a
neutral512px image through Juiced in26.29s. Earlier chat, TTS, caption and browser
scene→writer→image checks remain dated evidence of the writer trial.
The full browser regression suite was not rerun for this patch.

Evidence and production migration instructions are owned by
`/home/nulifyer/Projects/Homelab/docs/juiced-deployment.md`, with request/response
artifacts under `docs/evidence/sillytavern-juiced-test/` in that repository.
The current protocol migration and source hashes are in
`docs/evidence/juiced-compatibility/` in Homelab.
Before production use, publish through the normal workflow above, remove the
test overlay and verify the released image itself. Preserve production volumes
and make private connection-setting changes in the user's UI. Local FUTO
microphone dictation still needs a configurable transcription endpoint.

### v1.19.8

[Release v1.19.8](https://github.com/Nulifyer/SillyTavern/releases/tag/v1.19.8)
was published by [automatic release run 37842068836](https://github.com/Nulifyer/SillyTavern/actions/runs/37842068836).
Both native architecture jobs passed server startup checks. Anonymous requests
verified that version, full-commit, and `latest` tags share this image index:

```text
sha256:201db6d8f386bd366064ca1cc7d0e8b51da9b442cb53d539b7b72ee330ef0085
```

OCI labels identify source commit `88e6ea7a242e8ea03c5404c35e2a2d2edc8f7248`.
An empty-auth Podman pull succeeded. The image started on port 8008, served HTTP
200, reported version 1.19.8 through `/version`, and passed native heartbeat.
Served workspace modules, CSS, and the image adapter matched source bytes.
At 320px, the published-image browser confirmed a 278px-wide lorebook picker with
44px height. Escape dismissed the native list while keeping Settings open.
Inherited upstream bot and npm jobs skipped on the fork; publication succeeded.

## Previous releases

### v1.19.7

[Release v1.19.7](https://github.com/Nulifyer/SillyTavern/releases/tag/v1.19.7)
was published by [automatic release run 37839974023](https://github.com/Nulifyer/SillyTavern/actions/runs/37839974023).
Both native architecture jobs passed server startup checks. Anonymous registry
requests verified at publication that version, full-commit, and `latest` tags shared this digest:

```text
sha256:8cd19c09d5e0322eefcf2885cc1b3f1d044ba6e4699f2ef82e5c258ffd92a22b
```

OCI labels identify source commit `12e97ded6c020177fee4a51fee75e13242ffe63c`.
An anonymous Podman pull with an empty auth file succeeded.
The pulled image started locally on port 8007, served HTTP 200, reported version
1.19.7 through `/version`, and passed the native heartbeat health check.
Served workspace CSS, coordinator, settings owner, creative-tool owner, and native
image adapter matched source bytes. Desktop and phone browser checks confirmed
the new profile/chat flow, voice off and direct opt-in/disable, automatic image tools off, scene details, and exactly
one new transcript.
The release workflow passed; inherited upstream bot and npm jobs skipped on the fork.

### v1.19.6

[Release v1.19.6](https://github.com/Nulifyer/SillyTavern/releases/tag/v1.19.6)
was published by [automatic release run 37735911482](https://github.com/Nulifyer/SillyTavern/actions/runs/37735911482).
Both native architecture jobs passed server startup checks. Anonymous registry
requests verified at publication that version, full-commit, and `latest` tags shared this digest:

```text
sha256:d741b5615207f510dd3410fe6a937222db26111444e51033f699b89acd79ef9f
```

OCI labels identify source commit `78e7ac9aff0d002848c302c413a49d101170a577`.
An anonymous Podman pull with an empty auth file succeeded.
The pulled image started locally on port 8006, served HTTP 200, reported version
1.19.6, and passed the native heartbeat health check.
The served workspace CSS matched the verified source byte for byte.
The upstream bot workflows skipped cleanly on the fork after their repository guards.

### v1.19.3

[Release v1.19.3](https://github.com/Nulifyer/SillyTavern/releases/tag/v1.19.3)
was published by [automatic release run 37718961147](https://github.com/Nulifyer/SillyTavern/actions/runs/37718961147).
Both native amd64 and ARM64 jobs passed HTTP startup and heartbeat checks.
Anonymous manifest requests and a Podman pull with an empty auth file succeeded.
The release, latest, and commit tags share one digest.

```text
Commit: 1061f87fbd0a98114e90eac49071c534f91914c2
Image: ghcr.io/nulifyer/sillytavern@sha256:a23610767e7c217cc152a5ea82699599b7c000487f3362a9add4367f461028d2
```

v1.19.2's emulated ARM build stopped after QEMU reported an illegal instruction.
That attempt was cancelled and its tag retained. Use v1.19.3 for this workspace,
or v1.19.1 when selecting the previous successfully published image.
