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
- Start character/cast stories immediately using native automatic names; Rename is a later action. Coalesce rapid starts.
- Foreground native editors handle Escape; inert background controls must not receive it. Native generation owns interactive Stop cancellation, including cast queues; quiet callers retain rejection.
- Workspace owns transient menu dismissal; native modules own their popup state/actions. Ignore programmatic outside clicks/focus restoration. Escape closes nested menus before background Stop; settings disclosures remain persistent. See docs/workspace-ui-system.md.
- Native activation fulfillment notifies readiness even after its startup timeout. Service preparation is idempotent per native section; settings recover only their empty active category. Do not remount existing forms/rows on late extension events.
- Native local tab fragments resolve against the full document URL, including its query. Background tabs must never fetch/insert the application index or duplicate native control IDs.
- Mounted native forms use natural height, with wrapped actions contained before tags/notes. Phone character identity gets a full row above statistics.

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

## Browser suspension, November 6, 2026

- Browser recovery owns lifecycle probes and local text checkpoints. Native generation, provider status and transcript save modules retain their operations. No automatic inference replay or background model job service.
- Keep the native Restore unsent input preference. Store drafts per user, stable character avatar or cast ID, and story filename. Rename carries checkpoints; older global drafts require explicit recovery into the intended story.
- Retain unacknowledged reply text per message ID/send date. Clear completed records only after an exact native save acknowledgment or matching loaded transcript. Interrupted text remains available until dismissed. Local checkpoints never overwrite a server transcript.
- Foreground probes coalesce, time out after10seconds and require native ping204. Renew expired CSRF through the native token endpoint. Compatible model checks are read-only and ignore stale provider responses; preserve models, dropdowns, prompts, profiles, context and sampling.
- Hidden/frozen microphone recording or pending permission is cancelled. An already submitted transcription may finish into its original story draft. Permission results belong to their request sequence.

## Foreground chat layout correction, November 7, 2026

The user clarified that recovery means restoring the existing chat display when
the tab becomes active. It does not mean adding a reply recovery workflow.
This supersedes the earlier local reply checkpoint/panel decision. Remove that
workflow and its insertion of character text into user drafts. Preserve existing
local reply records without reading, migrating or deleting them. Native chat owns
replies and transcript saves. Keep per-story unsent user drafts separate.

Native positioning, textarea fitting and scroll ownership repair foreground
geometry without remounting messages or changing focus. Preserve history anchors;
follow the bottom only when already following it. Run layout repair independently
of bounded connectivity probes, with story, visibility and Settings guards.

## Audit correction, November 8, 2026

Native character/group load operations validate a successful file read before
changing mounted data or owner identity. Exact-story opens use one native
transaction. One shared load lifetime rejects obsolete reads and explicit close
invalidates pending work. Missing or malformed metadata is not permission to
save over an existing nonempty file. Genuine missing/empty files remain valid new
conversations; disk and JSONL errors are visible read failures.

Character rename migrates draft/archive keys at their native state owners.
Native status owns response identity and distinguishes unsupported verification
from failed verification. Recording cleanup and image cancellation belong to
one operation lifetime. Image prompts, inference, uploads and callbacks retain
full story identity. Workspace presentation does not duplicate those policies.
