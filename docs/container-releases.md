# Container releases

This fork publishes `ghcr.io/nulifyer/sillytavern` from published GitHub Releases.
Ordinary branch pushes and tag pushes do not publish images.
Each build checks out the release tag, rather than the current `release` branch.

## Publish a release

For a new fork, enable GitHub Actions on the Actions tab before publishing.
This fork has Actions enabled.

1. Push the completed changes to the fork's `release` branch.
2. Create a version tag on that commit, such as `v1.19.8`.
3. Publish a [GitHub Release](https://github.com/Nulifyer/SillyTavern/releases/new) for that tag.
4. Wait for [Publish release container](https://github.com/Nulifyer/SillyTavern/actions/workflows/docker-publish.yml) to succeed.

Use tags that are valid container tags: letters, numbers, underscores, periods,
and hyphens, with no leading period or hyphen. Tags must be at most 128 characters.
Do not move published tags. Create a new tag for a new build.

The workflow publishes one image index with `linux/amd64` and `linux/arm64` builds.
Docker and Podman select the matching architecture when they pull the image.
Each architecture builds on its own native GitHub runner. Both images must pass
HTTP startup and the enabled heartbeat check before the workflow combines them
into the release image index. Architecture staging tags use `sha-<commit>-<arch>`;
use the release, commit, or latest tag for homelab deployments.

| Image tag | Purpose |
| --- | --- |
| `v1.19.8` | The exact GitHub Release tag |
| `sha-<full-commit-sha>` | The commit checked out for that release |
| `latest` | The release GitHub currently identifies as its latest stable release |

Prereleases never update `latest`. Republishing an older release does not update
`latest`. The workflow summary includes the published digest for a fixed image
reference, such as `ghcr.io/nulifyer/sillytavern@sha256:...`.

To retry a build, open the workflow and select **Run workflow**. Enter an existing
published release tag. Draft releases and tags without a published release are rejected.
The workflow uses `GITHUB_TOKEN` with `packages: write`; no registry secret is required.
The upstream npm publishing workflow is disabled for forks.
Upstream issue, pull request, and merge-conflict bot jobs run only in
`SillyTavern/SillyTavern`. The fork does not have the upstream GitHub App credentials.
Runs 37719493332 and 37719493429 failed at token creation because `appId` was missing.
Repository guards prevent those inherited jobs from failing on fork pushes.
The fork's lint, unit-test, and release-container jobs remain available.

## Allow your homelab to pull the image

The first release of this fork was verified with an anonymous registry request.
Your homelab can pull the image without a registry login.
If package visibility changes, open the [package settings](https://github.com/users/Nulifyer/packages/container/sillytavern/settings)
and select **Public** to allow anonymous pulls.

If you keep the package private, create a personal access token with `read:packages`.
Use it with `docker login ghcr.io --username Nulifyer --password-stdin` on the homelab.
Podman supports the equivalent `podman login` command.
See [GitHub's registry documentation](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry).

## Update a Compose deployment

Change the existing service's image to:

```yaml
image: ghcr.io/nulifyer/sillytavern:latest
```

Keep your existing config, data, plugin, and extension volumes.
The fork uses the same mount paths as upstream SillyTavern.
Then pull and recreate the service:

```sh
docker compose pull sillytavern
docker compose up -d sillytavern
```

The included `docker/docker-compose.yml` uses the fork's image and does not build locally.
To pin a release, put `SILLYTAVERN_IMAGE_TAG=v1.19.8` in the deployment's `.env` file.
For a new deployment using the included file, run:

```sh
docker compose -f docker/docker-compose.yml pull
docker compose -f docker/docker-compose.yml up -d
```

To roll back, select a previous image tag whose publish workflow succeeded, pull
it, and recreate the service.
Use the workflow's digest reference when you need to pin the exact published image.

## Verified release

[Release v1.19.8](https://github.com/Nulifyer/SillyTavern/releases/tag/v1.19.8)
was published by [automatic release run 37842068836](https://github.com/Nulifyer/SillyTavern/actions/runs/37842068836).
Both native architecture jobs passed server startup checks. Anonymous requests
verified that version, full-commit, and `latest` tags share this image index:

```text
sha256:201db6d8f386bd366064ca1cc7d0e8b51da9b442cb53d539b7b72ee330ef0085
```

OCI labels identify source commit `88e6ea7a242e8ea03c5404c35e2a2d2edc8f7248`.
An empty-auth Podman pull succeeded. The image started on port 8008, served HTTP
200, reported version 1.19.8 through `/version`, and passed native heartbeat.
Served workspace modules, CSS, and the image adapter matched source bytes.
At 320px, the published-image browser confirmed a 278px-wide lorebook picker with
44px height. Escape dismissed the native list while keeping Settings open.
Inherited upstream bot and npm jobs skipped on the fork; publication succeeded.

## Previous releases

### v1.19.7

[Release v1.19.7](https://github.com/Nulifyer/SillyTavern/releases/tag/v1.19.7)
was published by [automatic release run 37839974023](https://github.com/Nulifyer/SillyTavern/actions/runs/37839974023).
Both native architecture jobs passed server startup checks. Anonymous registry
requests verified at publication that version, full-commit, and `latest` tags shared this digest:

```text
sha256:8cd19c09d5e0322eefcf2885cc1b3f1d044ba6e4699f2ef82e5c258ffd92a22b
```

OCI labels identify source commit `12e97ded6c020177fee4a51fee75e13242ffe63c`.
An anonymous Podman pull with an empty auth file succeeded.
The pulled image started locally on port 8007, served HTTP 200, reported version
1.19.7 through `/version`, and passed the native heartbeat health check.
Served workspace CSS, coordinator, settings owner, creative-tool owner, and native
image adapter matched source bytes. Desktop and phone browser checks confirmed
the new profile/chat flow, voice off and direct opt-in/disable, automatic image tools off, scene details, and exactly
one new transcript.
The release workflow passed; inherited upstream bot and npm jobs skipped on the fork.

### v1.19.6

[Release v1.19.6](https://github.com/Nulifyer/SillyTavern/releases/tag/v1.19.6)
was published by [automatic release run 37735911482](https://github.com/Nulifyer/SillyTavern/actions/runs/37735911482).
Both native architecture jobs passed server startup checks. Anonymous registry
requests verified at publication that version, full-commit, and `latest` tags shared this digest:

```text
sha256:d741b5615207f510dd3410fe6a937222db26111444e51033f699b89acd79ef9f
```

OCI labels identify source commit `78e7ac9aff0d002848c302c413a49d101170a577`.
An anonymous Podman pull with an empty auth file succeeded.
The pulled image started locally on port 8006, served HTTP 200, reported version
1.19.6, and passed the native heartbeat health check.
The served workspace CSS matched the verified source byte for byte.
The upstream bot workflows skipped cleanly on the fork after their repository guards.

### v1.19.3

[Release v1.19.3](https://github.com/Nulifyer/SillyTavern/releases/tag/v1.19.3)
was published by [automatic release run 37718961147](https://github.com/Nulifyer/SillyTavern/actions/runs/37718961147).
Both native amd64 and ARM64 jobs passed HTTP startup and heartbeat checks.
Anonymous manifest requests and a Podman pull with an empty auth file succeeded.
The release, latest, and commit tags share one digest.

```text
Commit: 1061f87fbd0a98114e90eac49071c534f91914c2
Image: ghcr.io/nulifyer/sillytavern@sha256:a23610767e7c217cc152a5ea82699599b7c000487f3362a9add4367f461028d2
```

v1.19.2's emulated ARM build stopped after QEMU reported an illegal instruction.
That attempt was cancelled and its tag retained. Use v1.19.3 for this workspace,
or v1.19.1 when selecting the previous successfully published image.
