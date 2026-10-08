# Testing

## Evidence standard

Fixtures verify native integrations, not paid-provider responses or audible quality.
Manifest inspection establishes published architectures and digest.

## Fast checks

- npm run lint
- /home/nulifyer/go/bin/actionlint .github/workflows/docker-publish.yml
- git diff --check

## Full checks

- npm --prefix tests run test:unit
- cd tests && ST_BASE_URL=http://127.0.0.1:8002 npx playwright test workspace.e2e.js --workers=1
- Podman build, HTTP startup, enabled heartbeat, and shared T3 Code visual inspection.

October 7: lint, 411 units, 14 browser cases passed. Final sanitized rename and
delayed-image regressions passed. Mobile widths: 320, 390, 768.

## Environment

Native preview: 8000. Disposable regression data: /tmp/sillytavern-workspace-e2e-data,
port 8002. Settings writes are isolated. Cleanup uses native transcript owners.

## Known gaps

No live paid-provider or audible speech checks. ARM images build in CI;
this host executes amd64.
