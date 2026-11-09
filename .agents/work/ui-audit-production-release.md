# UI audit production release

Status: active
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
- [ ] Publish only inspected audit changes and version metadata.
- [ ] Native amd64/arm64 release build/startup gates pass; exact image identity recorded.
- [ ] Actual published image passes applicable browser, source-byte and native health checks on fresh synthetic volumes.
- [ ] Production uses the verified image and reports healthy.
- [ ] Stack definition/environment, volume identities, network and routing metadata remain unchanged.

## Current state
Phase: Release preparation.
Baseline: origin/release e4f5f726019a7e7f9ac1a936663d24d30d98e157;
latest published release v1.19.23 at 640283d97ec54996b6b91d0bff88ff7c79213cd4.
Production container b5ccc17605566a7680bf303d07d99cb55302f5a0428f984796788f45d88135cb
is running and healthy; stack69 name=sillytavern, endpoint7, Docker Standalone.
Next action: Commit the inspected audit batch/version bump, publish v1.19.24 and verify its image.

## Evidence and boundaries
Local audit: ui-interaction-audit.md and docs/evidence/ui-interaction-audit-20261109/audit-summary.json.
Release evidence: docs/evidence/ui-interaction-audit-20261109/release-v24/.
Production receipt stays local/private and must not be swept into a public commit.
No production app routes, screens, logs or volume contents may be read.
Use /home/nulifyer/Projects/Homelab/portainer.sh for deployment metadata and lifecycle operations.
Rollback baseline: verified v1.19.23 index sha256:14327cb00f8adf4504502f1abc7395dcf64dcc9c9aa200394146ae428d009d72.
