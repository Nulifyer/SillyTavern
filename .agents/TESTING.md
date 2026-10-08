# Testing

## Evidence standard

Fixtures verify integrations, not paid-provider responses or audible quality.
Manifest and OCI labels establish the digest, architectures, and source.

## Fast checks

- npm run lint
- /home/nulifyer/go/bin/actionlint .github/workflows/docker-publish.yml
- git diff --check

## Full checks

- npm --prefix tests run test:unit
- cd tests && ST_BASE_URL=http://127.0.0.1:8002 npx playwright test workspace.e2e.js --workers=1

The v1.19.7 redesign passed lint, all 411 unit tests, and all 20 browser cases.
The v1.19.8 correction passed the full 20-case browser suite with all settings
categories checked at 1280/390/320px. Five final settings, phone popup-priority,
and enlarged-font cases also passed after the last Escape guard update.
Coverage includes pending-reply return through four story entry points, stable
message/composer nodes during streamed replies, manual scene images with automatic
tools off, voice opt-in/persistence, exact story lifecycle, casts, all settings
categories, native menu entry points, and classic restoration.
Phone checks cover 320/390/768px, reduced height, and the native 150% font preference
combined with a 20px browser default. Design evidence: docs/roleplay-workspace.md.

Native amd64 and ARM64 release jobs passed HTTP and heartbeat checks. Anonymous
manifests, empty-auth Podman pull, local startup, and version checks passed.
Published-image workspace modules and CSS matched the source. Browser checks
confirmed desktop/phone layout, voice opt-in, tools initially off, and one new-story
transcript in v1.19.7. The v1.19.8 image confirmed the corrected 320px picker and
native dropdown Escape behavior. Exact release evidence and digest: docs/container-releases.md.

## Environment

Published-image preview: 8008. Disposable regression data: /tmp/sillytavern-workspace-e2e-data,
port 8002. Settings writes isolated; cleanup uses native owners.

## Known gaps

No live paid-provider or audible speech-quality checks.
