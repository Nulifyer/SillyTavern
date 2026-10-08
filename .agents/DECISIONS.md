# Decisions

## Binding decisions

- Use the approved dark slate and lavender character workspace.
- Separate character browsing from entering a transcript.
- Group advanced controls under Settings while retaining their native owners.
- Archive retains transcript files. Deletion requires confirmation.
- Publish containers only from published GitHub Releases, with manual rebuilds of
  existing published releases. Prereleases do not move latest.
- Use ghcr.io/nulifyer/sillytavern for the fork and support amd64 and arm64.
- Build and start containers on native amd64 and arm64 runners. An emulated ARM
  build hit a QEMU illegal instruction after compilation in run 37717246139.
- Use the T3 Code collaborative browser for visual inspection.
- Voice and images default off. Workspace toggles use native extension settings.
- Use compact desktop controls, larger mobile touch targets, and flat dropdown surfaces.
- Restrict upstream GitHub App bot jobs to the upstream repository.

## Open decisions

None.

## Superseded decisions

The initial shell's many configuration navigation entries and immediate character
chat selection are superseded by profile and scene workflows.
