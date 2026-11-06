# Status

## Project state

Fork: https://github.com/Nulifyer/SillyTavern. Published branch: release.
Published and verified v1.19.9 source: 9ab8d2cedec44448c7f8ea49c4dfba5c8799ebf1.
Release workflow 41404996482 passed native amd64/arm64 startup and publication.
Image index: sha256:1aeffc008478d6923152ae4dc61eb3115c56e97d0da3cb3a62b8cc17f4be33bf.

## Active tasks

[Model service workspace and chat surface](work/service-workspace.md) continues.
User steering November6: simplify presentation and flow, preserve full advanced
SillyTavern control. Native controls remain, but v1.19.10 labels and collapsed
sections make access unclear. A persistent Advanced controls option and All
controls filters are being verified before a new release.

## Next action

Publish v1.19.11 and verify its actual image. Source passed34 browser cases
including real Juiced services,424 unit tests, lint and actionlint. v1.19.10 is already published; never move its tag.
Homelab owns deployment. Production69 and shared test85 remain untouched.

## Blockers

None. Physical microphone and audible quality remain unqualified. Retrieval
retains native provider setup; no enabled embeddings model was reported November2.

## Verification

November2 source passed424 unit tests, lint, actionlint, controlled browser cases
and both live Juiced cases. v1.19.10 publication workflow41521719715 passed both
native architecture startup gates. Its pulled-image identity and18 source hashes
were verified. Retained actual-image run has32 passes and1 model-noun assertion
failure after successful first-reply recovery. The interrupted final rerun result
is missing, so full published-image acceptance and release handoff are unfinished.

Source preview8013 uses only synthetic test volumes. Original v1.19.10 synthetic
container8015 is stopped. Evidence: docs/evidence/service-workspace-20261102/.
Current November6 advanced-controls evidence will be recorded separately.
