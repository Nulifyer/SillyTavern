# Homelab handoff for v1.19.11

Source: `78bca3473f897ddf8f8552179296b37155af833f`.
[Release v1.19.11](https://github.com/Nulifyer/SillyTavern/releases/tag/v1.19.11).
[Publication workflow42248135919](https://github.com/Nulifyer/SillyTavern/actions/runs/42248135919).

```yaml
image: ghcr.io/nulifyer/sillytavern@sha256:6e2a1b345b05c6fa45ff4fe0fa550b2687f2d38b23d830e596aa4b439aa76c49
```

- linux/amd64: `sha256:942311a7bfe01d76745f207cfa92a5e45ed1ffcc298e1d031b00f19b6a7645b2`
- linux/arm64: `sha256:01b3796142d836ba92309a3074a371d2c9ab19857ca8668755a48095f5f1cdcc`

Both native architecture builds passed HTTP startup and heartbeat gates.
Anonymous pull, 18 tagged source-file matches, five synthetic volumes without
source overlays, and HTTPS Juiced reachability passed on the local amd64 image.
All 34 browser cases passed on the actual image, including both live Juiced cases.
Diagnostics recorded zero uncaught page errors. Advanced controls and selected
native settings survived a standalone container restart. The real speech backend
returned 67 voices. Evidence: released-browser.log, released-browser-diagnostics.json,
released-live-juiced.json and released-persistence.json in this directory.

Homelab owns the deployment. This thread never accessed or changed production69
or shared test85. Record the actual pre-update image and take a matching backup
before updating. Preserve every existing config/data/plugin/extension/backup
volume identity and the Traefik boundary. Recreate only the SillyTavern service,
then reload browser tabs so they load the new UI.

Verified fallback v1.19.9 index:
`ghcr.io/nulifyer/sillytavern@sha256:1aeffc008478d6923152ae4dc61eb3115c56e97d0da3cb3a62b8cc17f4be33bf`.
For rollback, restore the recorded image with the same volume identities; retain
the pre-update backup if settings also need restoring. Do not delete volumes or
reset user data. Never move a published tag.

Open Settings > Servers and verify `https://juiced.swarm.nulteck.com`. Choose
models per service and Use model. Services remain optional. Existing explicit
context limits remain manual; enable Use discovered context size to adopt the
reported runtime capacity. Editing the context field or loading an explicit
preset disables automatic sizing. The training maximum is not used as runtime
capacity. Normal provider keys remain managed by their native forms.

Advanced controls expands native settings inside the workspace and survives
reload. All controls removes section filters. Provider-specific controls remain
conditional on the provider. Appearance & behavior can still switch to classic
layout for native drawer pinning and custom themes. Prompts, sampling, profiles,
custom API parameters, image workflows, voice mappings and extension settings
retain their native owners. Details: docs/model-services.md.

Vision uses its own model with the native shared story-server address. Retrieval
keeps native provider setup because its compatible URL belongs to the existing
text-completion configuration. No enabled embeddings model was reported. No
Juiced runtime, model policy or cache setting was changed. Physical microphone
and audible speech quality remain unqualified.
