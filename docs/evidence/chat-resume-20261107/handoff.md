# v1.19.20 release handoff

**Deployment handoff on hold after the independent audit.** A failed character or
group read can initialize and save over an existing transcript. The character
case was reproduced in a fresh actual-image fixture, including a current-format
file with integrity metadata. This native load/save defect is not fixed in
v1.19.20. See the [audit and reproductions](../fork-audit-20261107/review.md).
The historical test results below remain accurate but did not cover this path.

[Release v1.19.20](https://github.com/Nulifyer/SillyTavern/releases/tag/v1.19.20)
corrects foreground chat layout without a recovered-reply workflow.
Production69 and shared test85 were never accessed or changed by this thread.
Homelab owns any later production update.

## Immutable release

- Source/tag: `e750add4eb6f448f68673707f7ca258e836a882b` / `v1.19.20`.
- [Workflow 42439301418](https://github.com/Nulifyer/SillyTavern/actions/runs/42439301418): both native builds/startup checks and publication passed.
- Image: `ghcr.io/nulifyer/sillytavern:v1.19.20`.
- Index: `sha256:a674a6e99b86737ec10479e39d0fb423927585ec895f557737ba8b1e5b8b8d09`.
- linux/amd64: `sha256:17f4a373cc5fee1ef318f906f32f57a0df9ccc71d4270c0c15a55d05916f92ce`.
- linux/arm64: `sha256:c5313b1107aedaff44105db23a52e59700a9cd4a69a96f29d0ccbf3da4a1bc8a`.

Pin:

```yaml
image: ghcr.io/nulifyer/sillytavern:v1.19.20@sha256:a674a6e99b86737ec10479e39d0fb423927585ec895f557737ba8b1e5b8b8d09
```

Version, latest and sha-e750add4eb6f448f68673707f7ca258e836a882b were observed at the same index.
Both architecture labels identify the tagged source. Runtime/browser verification
below ran on amd64; ARM64 has native startup proof.

## Behavior and ownership

Returning to a visible tab repairs the existing layout using native mobile
positioning, composer fitting and scroll ownership. Preserve the history anchor,
or follow the bottom only when already following it. Layout repair does not wait
for network probes, replace message nodes, move focus, reload chats or replay
prompts. Hidden tabs, changed stories, Settings and new interaction guard delayed
work.

Removed the recovered-reply panel, character-text insertion into user drafts,
reply checkpoints and save-acknowledgment hooks. Character replies stay in native
bubbles; native generation and transcript saving remain their owners. Per-story
unsent user drafts still respect the native preference. Existing local reply and
old unscoped draft records are untouched and do not open UI. No settings/chat
format migration. Actual connection failures use compact inline status/Retry.

## Verification and evidence

The actual pulled image, st-chat-resume-release-20261107 on 8030, passed all 72
browser cases together in 9.2 minutes, including both real Juiced cases.
No exclusions, skipped cases, flaky results or uncaught page errors in that run.
Five fresh synthetic volumes, no source overlays, 32 runtime files matching the tag,
version 1.19.20, heartbeat and Juiced HTTPS 200 passed. Stock sd.cpp handler matches
v1.19.8. Both native publication/startup gates passed. Root lint/actionlint and
425 unit tests pass; test lint has 0 errors and 51 warnings.

Desktop uses 1280×800. Android Pixel 9 Pro XL uses a 448×997 screen, DPR 3,
touch and a 448×921 browser viewport. Both test a 400px reduced height. Real hidden/freeze events precede reply
completion. The new cases check visible final text or preserved reading position,
composer bounds, draft selection, node identity and one generation request while
holding the heartbeat. Existing cases cover all settings/native controls, classic
layout, live services, outages, microphone lifecycle, menus and portrait sizing.
Physical phone locking/GPU restoration and audible speech quality remain
unqualified. These checks do not establish every device-specific cutoff cause.

Console errors: 24. Failed requests: 118, comprising 115 aborted requests,
2 deliberate transport failures and 1 reset-stream incomplete chunk. Fault/guard
fixtures deliberately produce console/network errors; exact events and reasons
are retained. Zero uncaught errors is not zero console/network errors.

- [Browser summary](browser-summary.json), [full report](released/report.json).
- [Runtime/volume/source proof](released-source-check.json), [registry](registry/image-proof.json), [workflow](workflow.json).
- [Design review, baseline and failed source attempts](review.md), [source acceptance](source-acceptance.json).
- `released/`: diagnostics and targeted resume/live-service renders.

Actual v1.19.19 failed both reduced-height history-position cases and the old
checkpoint popup case. Its two final-line cases already passed. The first full
source run had 69 passes and 3 failures; all three passed twice in the ready isolated
rerun. Their cause remains unresolved. A separate isolated attempt started before
server readiness and failed on connection errors. All attempts remain preserved;
the final actual-image run above passed all 72 together.

## Existing deployment and rollback

Before updating, Homelab must record the actual current image and private backup.
Keep the existing stack/project identity, volume identities/mounts, network,
Traefik boundaries, settings, keys, profiles and sampling. Change only the image
reference using the verified pin. Do not create a new stack or delete volumes.
Reload every open app tab after recreation so it loads one consistent client.
Do not clear browser storage to remove the retired panel; no clearing is needed.

For rollback, select the recorded previous image/digest, pull and recreate with
the same volumes. Restore the matching private backup only if a later operation
changed data and the rollback requires it. Older clients can display their former
recovery panel because old local records were preserved.

## Service connections

Existing connections remain native and need no reset. For a new connection, use
Settings → Servers, enter `https://juiced.swarm.nulteck.com`, Verify & discover,
then select/apply only the wanted services. No Juiced key is required. Advanced
controls, All controls and classic layout remain available. Exact connection and
optional-service instructions are in [model-services.md](../../model-services.md).

OpenAI services use `/v1`; stock sd.cpp uses the root without `/v1`. Container DNS
`http://juiced:8080` requires a shared Docker network; it was not used by this local
test container. Keep outbound private-address filtering enabled and allow only
the actual trusted service destination where needed. Discovery does not guarantee
that every model accepts every prompt template; the tested Qwen first-reply case
uses native Semi-strict processing. No server model/policy/cache changes were made.
