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

October 7: lint, 411 units, 16 browsers passed, including single-transcript creation,
creative-tool defaults and persistence, suffix rename, and delayed image generation.
Responsive widths: 320/390/768 with both creative tools enabled. Shared preview inspected.
Workflow syntax passed with actionlint; inherited bot shell scripts retain upstream
ShellCheck warnings. Bot jobs skip cleanly in runs 37721742189 and 37721742045.
Run 37721950185 passed native amd64/ARM64 HTTP and heartbeat checks for v1.19.4.
Anonymous manifests, empty-auth Podman pull, local startup, and version passed.
Digest: docs/container-releases.md.

October 8: lint, 411 units, and 16 browsers passed for composer sizing.
The delayed model fixture checks stop visibility and 32px desktop controls;
responsive cases check 44px phone controls with 16px icons. Multiline input grows.
Desktop and 390px screenshots were inspected in the shared preview.

The UI-system pass passed lint and 17 browser cases, including the native 150%
font preference with a 20px browser default. Final phone/profile target checks
passed at 320/390/768px. Sources and sizing roles: docs/workspace-ui-system.md.

## Environment

Published-image preview: 8005. Disposable regression data: /tmp/sillytavern-workspace-e2e-data,
port 8002. Settings writes isolated; cleanup uses native owners.

## Known gaps

No live paid-provider or audible speech-quality checks.
