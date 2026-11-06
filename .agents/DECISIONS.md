# Decisions

## Binding decisions

- Use the approved dark slate and lavender character workspace.
- Separate character browsing from entering a transcript.
- Group advanced controls under Settings while retaining their native owners. A persistent Advanced controls switch exposes native settings in the workspace; All controls removes category section filters. Classic layout remains available for native windowing and themes.
- Archive retains transcript files. Deletion requires confirmation.
- Publish containers only from published GitHub Releases, with manual rebuilds of
  existing published releases. Prereleases do not move latest.
- Use ghcr.io/nulifyer/sillytavern for the fork and support amd64 and arm64.
- Build and start containers on native amd64 and arm64 runners. An emulated ARM
  build hit a QEMU illegal instruction after compilation in run 37717246139.
- Use the T3 Code collaborative browser for visual inspection.
- Voice defaults off and has a visible chat toggle using native TTS settings.
- Scene images are one manual request. Automatic image tools remain off by default.
- Settings use persistent categories and task sections with one mounted native control tree.
- WorkspaceSettings alone closes workspace-mounted panels. Classic outside-click and drawer toggles exclude those panels.
- Service setup discovers transient metadata and applies choices through native chat, Connection Manager, image, TTS and dictation owners. It does not persist another model registry or add an inference proxy.
- Dictation sends mono 16 kHz PCM WAV, inserts draft text without sending, and cancels when story identity changes.
- Returning to the active story is allowed during generation and preserves its mounted transcript.
- Use compact desktop controls, larger mobile touch targets, and flat dropdown surfaces.
- Restrict upstream GitHub App bot jobs to the upstream repository.

## Open decisions

None.

## Superseded decisions

The initial shell's many configuration navigation entries and immediate character
chat selection are superseded by profile and scene workflows.

## Service workspace, November 2, 2026

- Settings opens Servers directly and preserves the underlying story; no second settings overview.
- Group service setup and real prompts around existing native DOM owners; restore those nodes in classic layout.
- New compatible connections use configured `context_length` when available, never the training maximum as runtime capacity. Existing explicit limits migrate as manual; direct edits and explicit presets disable automatic sizing.
- Adapt T3 Code's composer shell in plain DOM/CSS with its MIT notice. Preserve the native textarea, form, send/stop ancestry and extension controls.
- Native compatible vision shares the story server address and uses its own model. Retrieval retains its current extension provider controls; do not overwrite the shared text-completion URL to automate embeddings.
