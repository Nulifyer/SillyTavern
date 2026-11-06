# Homelab handoff for v1.19.16

[Release v1.19.16](https://github.com/Nulifyer/SillyTavern/releases/tag/v1.19.16).
Source: `05e7858f429a5fc5680e2d64919a47f5505d029d`.
[Workflow 42310788170](https://github.com/Nulifyer/SillyTavern/actions/runs/42310788170)
passed native amd64/arm64 build, startup, heartbeat and publication gates.

```yaml
image: ghcr.io/nulifyer/sillytavern@sha256:f54190820e830b5ff24eb760136504c6c6ecf9ecf9523997abfbc5a6fdc3b657
```

| Architecture | Manifest digest |
| --- | --- |
| linux/amd64 | `sha256:7381723771bccf5f78eee8da195d78462687f484d7ddc2e3511f4d1375f3ff38` |
| linux/arm64 | `sha256:bd73ac13eb42a1e7d2a45b2850a580b13f1c22d5f4cd6e0b36ee157af2acd418` |

Version, `sha-05e7858f429a5fc5680e2d64919a47f5505d029d` and latest tags match
that index. Anonymous pull succeeded. Actual amd64 container
`st-mobile-resume-release-20261106` on port 8023 has five fresh synthetic volumes,
no source overlays, 28 tagged runtime-file matches, version 1.19.16 and passing
heartbeat/HTTPS Juiced checks. Those checks passed again after a native restart.
The stock sd.cpp endpoint remains byte-identical to v1.19.8.

All 63 browser cases passed on this image in 8.2 minutes, zero skips, flaky cases or
uncaught page errors. Includes both live Juiced cases, confirmed hidden/freeze/
resume, real HTTP stream reset/early EOF, failed-save/reload recovery, multiple
unsaved replies, cast queues, keyboard, microphone permission races, all settings,
Advanced controls and the 18-state Android/touch/DPR3 portrait matrix.
425 unit tests, root lint and actionlint passed; test lint has 0 errors and 28 warnings.
Source attempts and corrected fixtures are retained in [review.md](review.md).

[Browser summary](browser-summary.json) classifies 33 console entries and network
failures. They include deliberate outages/guards, CSRF 403, stream failures and
one settings save aborted by a fixture reload. Separate [native persistence proof](manual-restart.json)
uses no settings mocks: real Save/readback, stop/start, failed ping, Retry,
ping 204/status 200 and reload retained Qwen3.5-2B, manual context `12288`, temperature `0.85`,
Advanced controls enabled and the exact draft. No inference was sent during that recovery.
Native Auto-connect remained off. Final recovery renders at 448×921,
448×400 and 320px with enlarged text, the live image and Pixel portrait were inspected.
Manual partial-text UI fixtures are separate from real transport-loss tests.
Final renders: [phone](manual/reload.png), [keyboard height](manual/keyboardHeight.png),
[large text](manual/largeText.png).

## Connection and migration

Enter `https://juiced.swarm.nulteck.com` once in Settings > Servers and choose
Verify & discover. Select enabled models for the services wanted. Juiced is
key-free on the tested LAN/VPN route; normal provider-key support remains.
Existing connections, explicit sampling, prompts and manual context limits persist.
Automatic context uses reported configured capacity. Advanced controls and All
controls expose native settings; Classic layout remains available.

| Service | Tested model and protocol |
| --- | --- |
| Story replies | `TheDrummer_Skyfall-31B-v4.2-GGUF-IQ4_NL`, OpenAI base `/v1`, streaming, thinking off |
| Optional image writer | `Qwen3.5-4B-Uncensored-HauhauCS-Aggressive-Q8_0`, independent Connection Manager profile, 512 output, editable instructions |
| Images | `z-image-turbo-nsfw-v2-GGUF-Q8_0`, native sd.cpp, root URL without `/v1`; 512px, 8 steps, CFG 1, Euler/Simple |
| Speech | `kokoro-v1`, `/v1/audio/speech`, discovered voice `af_heart`; audio remains opt-in |
| Dictation | `asr4all-l-gptq-Q8_0`, `/v1/audio/transcriptions`; HTTPS/permission or audio-file input |
| Vision | `Ornith-1.5-35B-A3B-GGUF-Q6_K`, chat `/v1` |

Discover available voices instead of entering a list. Current-chat image prompting
remains default; selecting a separate writer never replaces the story model.
Juiced's sd.cpp subset does not provide all AUTOMATIC1111, img2img, hires or server
image-saving workflows. Retrieval keeps native provider setup; no enabled
embeddings model was reported. No model policy, runtime or cache was reconfigured.

If a template rejects late system messages, native prompt formatting
`Semi-strict (alternating roles; with tools)`, value `semi_tools`, passed the
Qwen3.5-2B first-reply regression. Discovery alone does not validate every prompt.
The previous [connection guide](../full-workspace-review-20261106/handoff.md)
contains the broader settings walkthrough.

Returning to a suspended tab revalidates an already connected compatible provider
without replacing its settings or replaying inference. Reload respects native
Auto-connect; if it is off, use native Connect. Restore unsent input controls local
text recovery. Older global drafts require explicit recovery in the intended story.
Received text can be appended to a draft without Send. Recording stops when hidden;
already submitted transcription/image requests can finish after resume.

## Deployment and rollback

Homelab owns the later production update. This thread never accessed production69,
its application/data/config/volumes, or shared85. Record the actual pre-update image
and take the normal private backup. Preserve every existing volume identity,
mount path and Traefik/network boundary. Change the image reference and reload
browser tabs after recreation. Never copy synthetic data into production or add
source overlays. If using test85 later, remove its old overlay through its guarded
owner before image qualification; preserve any user-added test work.

Rollback restores the recorded pre-update image with the same volumes. Verified
previous v1.19.15 index:
`ghcr.io/nulifyer/sillytavern@sha256:28c8a422df7b9ad588a9308c74ea73bacd3744919bd50b19056e18be981b92a7`.
It lacks this recovery feature. Copy unsaved browser text before rollback or
clearing browser storage; older versions do not read the new local checkpoints.
Never delete volumes, move published tags, or overwrite new chats with an old
backup without the owner's recovery plan.

Physical phone lock, physical microphone, audible quality and paid-provider
inference remain unqualified. OS tab discard cannot reattach its old HTTP
inference; local received text supports explicit continuation or regeneration.
Blocked storage retains text only in the open tab and shows a copy warning.
ARM64 has native startup/heartbeat proof; full browser/live acceptance ran on amd64.
