# Container releases

This fork publishes `ghcr.io/nulifyer/sillytavern` from published GitHub Releases.
Ordinary branch pushes and tag pushes do not publish images.
Each build checks out the release tag, rather than the current `release` branch.

## Publish a release

For a new fork, enable GitHub Actions on the Actions tab before publishing.
This fork has Actions enabled.

1. Push the completed changes to the fork's `release` branch.
2. Create a version tag on that commit, such as `v1.19.2`.
3. Publish a [GitHub Release](https://github.com/Nulifyer/SillyTavern/releases/new) for that tag.
4. Wait for [Publish release container](https://github.com/Nulifyer/SillyTavern/actions/workflows/docker-publish.yml) to succeed.

Use tags that are valid container tags: letters, numbers, underscores, periods,
and hyphens, with no leading period or hyphen. Tags must be at most 128 characters.
Do not move published tags. Create a new tag for a new build.

The workflow publishes one image index with `linux/amd64` and `linux/arm64` builds.
Docker and Podman select the matching architecture when they pull the image.
The workflow inspects both manifest entries and starts the amd64 image to check
HTTP startup and the enabled heartbeat health check.

| Image tag | Purpose |
| --- | --- |
| `v1.19.2` | The exact GitHub Release tag |
| `sha-<full-commit-sha>` | The commit checked out for that release |
| `latest` | The release GitHub currently identifies as its latest stable release |

Prereleases never update `latest`. Republishing an older release does not update
`latest`. The workflow summary includes the published digest for a fixed image
reference, such as `ghcr.io/nulifyer/sillytavern@sha256:...`.

To retry a build, open the workflow and select **Run workflow**. Enter an existing
published release tag. Draft releases and tags without a published release are rejected.
The workflow uses `GITHUB_TOKEN` with `packages: write`; no registry secret is required.
The upstream npm publishing workflow is disabled for forks.

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
To pin a release, put `SILLYTAVERN_IMAGE_TAG=v1.19.2` in the deployment's `.env` file.
For a new deployment using the included file, run:

```sh
docker compose -f docker/docker-compose.yml pull
docker compose -f docker/docker-compose.yml up -d
```

To roll back, select a previous release tag, pull it, and recreate the service.
Use the workflow's digest reference when you need to pin the exact published image.
