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

The v1.19.6 UI-system pass passed lint and 17 browser cases. Final phone/profile
checks passed at 320/390/768px, including a reduced-height viewport. The native
150% font preference and a 20px browser default passed together. Composer v1.19.5
also passed all 411 unit tests. Sources and sizing roles: docs/workspace-ui-system.md.

Native amd64 and ARM64 release jobs passed HTTP and heartbeat checks. Anonymous
manifests, empty-auth Podman pull, local startup, and version checks passed.
Published-image CSS matched the source; browser checks confirmed icon sizing,
creative tools off, and one new-story transcript. Exact release evidence and
digest: docs/container-releases.md.

## Environment

Published-image preview: 8006. Disposable regression data: /tmp/sillytavern-workspace-e2e-data,
port 8002. Settings writes isolated; cleanup uses native owners.

## Known gaps

No live paid-provider or audible speech-quality checks.
