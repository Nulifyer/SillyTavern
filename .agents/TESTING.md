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

October 7: lint, 411 units, 14 browsers passed, including suffix rename and delayed
image generation. Responsive widths: 320/390/768. Shared preview inspected.
Run 37718961147 passed native amd64/ARM64 HTTP and heartbeat checks.
Anonymous manifests, empty-auth Podman pull, local startup, and version passed.
Digest: docs/container-releases.md.

## Environment

Published-image preview: 8003. Disposable regression data: /tmp/sillytavern-workspace-e2e-data,
port 8002. Settings writes isolated; cleanup uses native owners.

## Known gaps

No live paid-provider or audible speech-quality checks.
