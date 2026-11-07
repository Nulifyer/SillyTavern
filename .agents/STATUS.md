# Status

## Project state

Latest fully verified release: v1.19.16. v1.19.17 published; actual65passed, but manual reload found a late-extension gap.
Fork: https://github.com/Nulifyer/SillyTavern. Published branch: release.
Previous immutable source/digests/handoff remain in docs/container-releases.md.

## Active tasks

Root owns menu/late-extension/query fixes, browser evidence, release and continuity.
v17actual65passed andv18actual67passed. Query navigation in native reload review
revealed duplicate app IDs: base href=/ made jQuery UI background fragment tabs
remote, fetching the complete index into a background panel. This explains the
manual query-page missing settings; earlier attribution solely to late activation
was not isolated. Separate held-template regression independently failsv17 and
passesv18. v17/v18 remain immutable intermediates.

## Next action

Publish v1.19.19 with local background fragment anchors resolved against the full
current document URL. Source query/late/menu5cases pass; actualv18 baseline fails
with duplicate preloader and autocomplete widget error.425units/lint/actionlint
pass; test lint0errors/50warnings. Root owns all new edits. Verify actual19 with
five fresh volumes/no overlays, all68cases/live Juiced and native Save/readback/
root reload/query visual review. Then finish docs/handoff. Never touch69/85.

## Verification

v18 workflow42321695043 passed native amd64/arm64 startup/publication. Actual18
on8027 matched30runtime files/version/heartbeat/HTTPS and passed67cases in8.8min.
v19 source has31recorded runtime hashes; stock sd.cpp backend unchanged. Evidence:
docs/evidence/menu-dismissal-20261106/v19/ and parent v17/v18 iterations.

## Blockers

None.

## Limits

Physical phone/microphone/lock and audible quality remain unqualified. ARM64
requires native startup gates; full browser/live checks run on amd64. Production
app/data/config/volumes and shared85 were never accessed. No Juiced runtime,
policy, cache or shared infrastructure changes. Homelab owns later deployment.
