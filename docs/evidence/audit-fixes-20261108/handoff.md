# v1.19.21 release handoff

[Release v1.19.21](https://github.com/Nulifyer/SillyTavern/releases/tag/v1.19.21)
fixes all six independent-audit findings and replaces the held v1.19.20 handoff.
Homelab owns the later production update. Production69 and shared test85 were
never accessed or changed here.

## Immutable release

- Source/tag: `24fbda8c25d6898fde1e99aa005303592dd3ddaf` / `v1.19.21`.
- [Workflow 42482760159](https://github.com/Nulifyer/SillyTavern/actions/runs/42482760159) passed both native builds, startup gates and publication.
- Image: `ghcr.io/nulifyer/sillytavern:v1.19.21`.
- Index: `sha256:a2831236504e74d4eb4c20fb8eb8736b38b9897bbffd20e3de7ea537e510aaa0`.
- linux/amd64: `sha256:7c3206bf7f1132f8248b15bae68628980f1ce92ded11d624ef5e194fd04a7a84`.
- linux/arm64: `sha256:3b96306b71479da324cee5b50232e785ef32b543cd199db39964b7082429647c`.

```yaml
image: ghcr.io/nulifyer/sillytavern:v1.19.21@sha256:a2831236504e74d4eb4c20fb8eb8736b38b9897bbffd20e3de7ea537e510aaa0
```

Version, latest and sha-24fbda8c25d6898fde1e99aa005303592dd3ddaf were observed at the same index.
Both architecture labels identify the tagged source. Browser and live-service
acceptance ran on amd64; ARM64 has native startup proof.

## Fixed behavior

- Failed, corrupt or obsolete character/group reads preserve the mounted story,
  draft and owner. Exact-story navigation reads only that file. Server integrity
  checks reject missing incoming metadata when a nonempty transcript exists.
  Missing/empty files still start normally; corrupt JSONL and disk failures are
  visible read errors, never permission to initialize over an existing story.
- Native character rename carries active/inactive user drafts and archive IDs.
  Destination draft conflicts and failed storage writes preserve source text.
- Normal and foreground connection responses retain their request/server
  identity. Old metadata cannot change a newly edited URL's catalog or context.
  Unsupported read-only provider verification does not report a false failure.
- Delayed recorder stop/error/timer events cannot terminate a newer recording.
- Stop works while the optional image writer is pending and cancels the native
  prompt/inference operation. Late image results retain character/cast and file
  identity through upload/callbacks, including same-named stories.

These changes use native load, status, recording and image owners. Advanced
controls, native provider/prompt settings and classic layout remain available.
Character replies stay in native chat bubbles. There is no recovered-reply popup
or insertion of character replies into user drafts. Foreground layout repair
retains message nodes, reading position and composer geometry.

## Verification

The actual pulled image, st-fork-fixes-release-20261108 on http://127.0.0.1:8033, passed
all 86 browser cases together in 10.6 minutes, including both real Juiced
cases. No exclusions, skipped cases, flaky results or uncaught page errors.
Five fresh synthetic volumes, no overlays, 37 runtime files matching the tag,
version 1.19.21, heartbeat and Juiced HTTPS 200 passed. The stock sd.cpp backend
handler still matches v1.19.8. Both native architecture startup gates passed.
Source checks passed 478 unit tests in 24 suites, root lint and actionlint.
Test lint has 0 errors and 51 warnings.

Coverage includes the six audited defects, failed character/group/reload reads,
invalid payloads, stale clients without integrity metadata, exact historical
navigation, explicit Close during a held read, rename/reload migration, status
response races, recorder races, pending writer cancellation and late image
upload. The existing suite covers all settings categories, native control
identity, advanced/classic access, desktop/mobile navigation, dialogs, keyboard,
menus, portraits, suspension/resume, reconnect and provider failures/retry.

Desktop uses 1280×800. Pixel 9 Pro XL emulation uses a 448×997 screen, DPR 3,
touch and a 448×921 viewport, reduced to 400px height for keyboard/resume cases.
Other layout cases include 320/390/768px and enlarged text. Suspension tests
assert actual document hidden/freeze events. Physical phone lock/GPU restoration,
real microphone hardware, audible speech quality and live paid providers remain
unqualified. Passing this suite does not establish every untouched upstream path.

Console errors: 45. Failed requests: 82. Fault/guard
fixtures deliberately produce errors and aborts. Exact events are retained;
zero uncaught page errors does not mean zero console/network errors. The fresh
context-migration case also logged one aborted `/api/settings/save`; its migration
assertions passed. The failed-request totals include 78 aborts, 3 deliberate
transport failures and 1 reset-stream incomplete chunk.

- [Browser summary](browser-summary.json), [full report](released/report.json) and per-case diagnostics/renders in released/.
- [Source/version/volumes/HTTPS proof](released-source-check.json), [registry](registry/image-proof.json), [tag aliases](registry/tag-index-proof.json), [workflow](workflow.json).
- [Implementation review and failed attempts](review.md), [source checks](source-acceptance.json), [original audit](../fork-audit-20261107/review.md).

The initial expanded source run had one upload-harness timeout caused by the
wrong intercepted URL. Its corrected focused rerun passed. The earlier v1.19.20
source run's three failures remain unexplained; this replacement acceptance does
not establish their causes. All earlier evidence remains preserved.

## Connections and migration

Existing native connections, explicit sampling, contexts, profiles and prompt
templates need no reset. Existing context limits stay manual unless automatic
sizing is explicitly enabled. No chat/settings file-format migration or browser
storage clearing is required. Rename migrates only the affected user's draft and
archive keys; existing assistant checkpoint records remain untouched and have no UI.
Reload every open app tab after recreation so it uses one consistent client.
An older open client that attempts an unprotected save to a nonempty transcript
will now receive HTTP400 instead of bypassing integrity checks.

For a new Juiced connection, open Settings > Servers, enter
`https://juiced.swarm.nulteck.com`, choose Verify & discover, then select/apply
only the wanted services. No key is required for this LAN runtime. Story chat and
the optional separate image writer remain independent. OpenAI services use the
`/v1` base; stock sd.cpp uses the root without `/v1`. Voices/models come from
discovery. Dictation needs HTTPS/localhost and microphone permission. Optional
services remain optional. Exact steps, prompt controls, manual overrides and
limits are in [model-services.md](../../model-services.md).

The live cases exercised `TheDrummer_Skyfall-31B-v4.2-GGUF-IQ4_NL` chat,
`Qwen3.5-4B-Uncensored-HauhauCS-Aggressive-Q8_0` as the separate writer,
a neutral `z-image-turbo-nsfw-v2-GGUF-Q8_0` image, `kokoro-v1` speech,
`asr4all-l-gptq-Q8_0` transcription, `Ornith-1.5-35B-A3B-GGUF-Q6_K` vision
and `Qwen3.5-2B` first-reply prompt ordering. Native
Semi-strict processing handles the tested late-system template failure; this
is an explicit configuration choice, not a forced conversion for every model.
Discovery alone does not prove a model accepts every story prompt. Container DNS
`http://juiced:8080` needs a shared Docker network and was not used locally.
No model runtime/policy/cache changes were made. Persistent cache support is not
claimed for every protocol. An already submitted image upload can finish writing
an unused media file after Stop; its result cannot append to another story.

## Homelab update and rollback

Record the actual current image/digest and take a private backup before updating.
Keep the existing stack/project identity, volume identities/mounts, network,
Traefik boundaries, settings, keys and profiles. Change only the image reference
to the verified pin. Do not create a new stack or delete volumes. Keep outbound
private-address filtering and allow only the actual trusted destination where
needed. This thread did not apply the production update.

Rollback uses the recorded previous image/digest with the same volumes. Restore
the matching private backup only if intervening data changes require it. The held
v1.19.20 has a known transcript-overwrite defect and is not a recommended rollback
target merely because it passed its earlier suite. Older versions can show their
former recovery panel because old local records were deliberately preserved.
