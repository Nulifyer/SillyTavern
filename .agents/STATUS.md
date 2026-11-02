# Status

## Project state

Fork: https://github.com/Nulifyer/SillyTavern. Published branch: release.
Published and verified v1.19.9 source: 9ab8d2cedec44448c7f8ea49c4dfba5c8799ebf1.
Release workflow 41404996482 passed native amd64/arm64 startup and publication.
Image index: sha256:1aeffc008478d6923152ae4dc61eb3115c56e97d0da3cb3a62b8cc17f4be33bf.

## Active tasks

[Model service workspace and chat surface](work/service-workspace.md) is active.
v1.19.10 source is implemented: one server hub, native service sections/prompts,
automatic configured context with migration/manual overrides, and a T3-derived
composer using the original form/editor/action nodes. No framework migration.

## Next action

Commit and publish v1.19.10 through GitHub Release, then pull
and browser-test its actual GHCR image with five fresh synthetic volumes and no
overlays. Return the immutable handoff for Homelab's later update.

## Blockers

None. Production69 and shared test85 remain untouched. Physical microphone and
audible quality remain unqualified. Retrieval retains native provider setup;
no enabled embeddings model is currently reported by Juiced.

## Verification

424 unit tests, lint, actionlint and continuity validation pass. Source browser
coverage passed all31 controlled cases across the full30-pass run and corrected
320px rerun; voice failure/retry passed separately. Both live cases pass, including the first-reply template failure/recovery,
independent writer/image, Ornith vision caption, 28 voices, decoded Kokoro speech
and dictation inserted without sending. Browser diagnostics report no page errors.
Published-image verification remains pending.

Source preview: http://127.0.0.1:8013, st-ui-dev-20261102, four synthetic named
volumes plus read-only public/src overlays. Prior actual v1.19.9 preview remains
on8014. User last reported v1.19.8; this thread never deployed production.
Evidence: docs/evidence/service-workspace-20261102/.
Historical release, first-reply and shared-screen proofs remain in docs/evidence/.
