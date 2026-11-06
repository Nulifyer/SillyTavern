# Homelab handoff for v1.19.15

Source: `f7dcc34e95690561d607ae779a0c218cea5944e4`.
[Release v1.19.15](https://github.com/Nulifyer/SillyTavern/releases/tag/v1.19.15).
[Workflow 42298436889](https://github.com/Nulifyer/SillyTavern/actions/runs/42298436889)
passed native amd64/arm64 builds, startup, heartbeat and publication.

```yaml
image: ghcr.io/nulifyer/sillytavern@sha256:28c8a422df7b9ad588a9308c74ea73bacd3744919bd50b19056e18be981b92a7
```

- linux/amd64: `sha256:0d98b09ee4c92999ee433554595e3d32b2aba48def6ed86220c2bec170f6300d`
- linux/arm64: `sha256:8e1563d2322f22830f2631f3b398de5efd7293b22b1ab357a82672e8cb6921c4`

Version, source and latest tags match. The anonymous pull succeeded. Local
amd64 container `st-mobile-portraits-release-20261106` on port 8022 has five
fresh synthetic volumes and no source overlays. Version 1.19.15, 24 tagged
runtime-file matches, native heartbeat and HTTPS Juiced reachability passed.

All 45 browser cases passed on this actual image in 6.2 minutes, including
both live Juiced cases, with zero uncaught page errors. All 18 Android/mobile/
touch portrait-bound states passed at DPR 3. A separate final visible-portrait
rerun passed after scrolling the first message to the top for clearer captures.
The final normal/enlarged portrait and landscape renders were inspected.
Console/network diagnostics retain intentional failure/retry/guard fixtures
and aborted requests, classified in browser-summary.json.

Source lint, 424 unit tests and actionlint passed. Test lint has zero errors
and 24 warnings. Source focused Pixel/roleplay checks passed. No runtime source
changed after tag publication; the subsequent test-only adjustment positions
the first message visibly before measurement/capture.


The change keeps chat portrait images inside their responsive avatar container
and prevents the avatar column from shrinking. It corrects a reproduced 50x50
image inside a 30x38 mobile container that used the gap beside message text.
The new Android/mobile/touch regression uses DPR 3 and 18 viewport/font states,
including Pixel 9 Pro XL portrait, landscape, browser height, reduced keyboard
height, and normal/150% native text. The 448px roleplay case also checks menus,
navigation, dialogs and composer layout. This is browser emulation; no physical
Pixel hardware is qualified.

No settings-schema, chat-format or inference code changed. Existing provider,
model, prompt, sampling, Advanced controls and classic layout options remain.
Use the [connection and migration instructions](../full-workspace-review-20261106/handoff.md)
from v1.19.14, with the new image pin above. Enter the Juiced root URL once in
Settings > Servers and discover models. Chat uses /v1; native sd.cpp uses the
root URL. Optional services remain optional, and explicit context/sampling
choices remain preserved. No Juiced runtime, policy or cache was changed.

Homelab owns the later deployment. This thread never accessed production69,
the production app/data/config/volumes or shared test85. Record the actual
pre-update image and take the normal private backup. Preserve every existing
volume identity, mount path and Traefik/network boundary. Change only the image
reference and reload browser tabs after recreation. Never mount synthetic data
into production or add a source overlay to verify this image.

For rollback, restore the recorded pre-update image with the same volumes.
Verified previous v1.19.14 index:
`ghcr.io/nulifyer/sillytavern@sha256:5f8324a85c392cb2682b5c0892d7088bcf8687af9148413c1cfbe5336441c24b`.
That older image retains the portrait-sizing defect. Keep the backup if settings
need restoring; never overwrite new chats with an old backup without the owner's
recovery plan. Never delete volumes or move a published tag.

ARM64 has native startup/heartbeat proof; browser/live-service acceptance runs
on amd64. Physical microphone, audible quality and paid-provider inference
remain unqualified. Exact before/after renders, the failing prior-image case,
Pixel measurements and final browser diagnostics are in this evidence folder.
