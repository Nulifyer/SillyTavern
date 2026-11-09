# UI audit production release

Status: complete
Owner: Codex root, solo
Request: November 9 user says “update prod” after the completed UI interaction audit.
Project: ../PLAN.md

## Goal and authority
Publish the audited fixes as v1.19.24, qualify the actual image with synthetic
data, and update endpoint 7 / Portainer stack 69 to that image. This request
authorizes the necessary source commit, release branch push, tag, GitHub Release
and existing-stack update. Preserve unrelated work and the production privacy
boundary in ../DECISIONS.md.

## Acceptance
- [x] Publish only inspected audit changes and version metadata.
- [x] Native amd64/arm64 release build/startup gates pass; exact image identity recorded.
- [x] Actual published image passes applicable browser, source-byte and native health checks on fresh synthetic volumes.
- [x] Production uses the verified image and reports healthy.
- [x] Stack definition/environment, volume identities, network and routing metadata remain unchanged.

## Current state
Phase: Published, verified and deployed.
Baseline: origin/release e4f5f726019a7e7f9ac1a936663d24d30d98e157;
latest published release v1.19.23 at 640283d97ec54996b6b91d0bff88ff7c79213cd4.
The production baseline was running and healthy on v1.19.23;
stack 69 name=sillytavern, endpoint 7, Docker Standalone.
Published: v1.19.24, source b3675f243f443f494b77a1af272e1b02088a3553.
Workflow 42720940996 passes both native builds/startup gates and publication.
Index: sha256:c955042e0cc754aa32c713e7a539879769b518c8a436574efe7a575b3fae6f42.
Actual-image fixtures: st-ui-v24-workspace on localhost8053 and st-ui-v24-audit
on localhost8054, ten fresh named volumes and no source overlays. Both report
healthy; version/revision and all 15 changed public-file hashes match source.
Fourteen served JS/CSS hashes match too. A separate actual v1.19.23→v1.19.24
upgrade preserves eight exact synthetic settings/transcript/draft fields and all
five volume identities (migration.json). The first migration attempt had an
ambiguous sidebar/main-list selector; its corrected fresh-volume rerun passes.
Image UI audit: all 13 cases pass in 9.6 minutes, zero uncaught page errors,
zero unexpected enabled-control obstructions and horizontal overflow in the
184 settings/480 provider states and their conditional fields. Both live Juiced
cases pass, including actual image, speech decoding and transcription.
Actual-image acceptance is complete: 102/102 workspace cases (both live Juiced
cases included) and 13/13 UI audit cases pass. Zero skipped/flaky cases or uncaught
page errors. Durations: 14.1 minutes and 9.6 minutes. image-acceptance.json records
exact identity, diagnostics and limits. Both native fixture health checks pass.
Production now runs v1.19.24 with the expected source and index digest. Docker
reports healthy and zero restarts in two metadata checks. Stack source,
Portainer environment, four volume identities/mounts, network membership,
Traefik labels and the saved latest image reference match the baseline.
Next action: None for this request. Keep the private operational receipt local.

## Evidence and boundaries
Local audit: ui-interaction-audit.md and docs/evidence/ui-interaction-audit-20261109/audit-summary.json.
Release evidence: docs/evidence/ui-interaction-audit-20261109/release-v24/.
Production receipt stays local/private and must not be swept into a public commit.
Private receipt: release-v24/production-update.private.json beneath the evidence root.
No production app routes, screens, logs or volume contents may be read.
Use /home/nulifyer/Projects/Homelab/portainer.sh for deployment metadata and lifecycle operations.
Rollback baseline: verified v1.19.23 index sha256:14327cb00f8adf4504502f1abc7395dcf64dcc9c9aa200394146ae428d009d72.
