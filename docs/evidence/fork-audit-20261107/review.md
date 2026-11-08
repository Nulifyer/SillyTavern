# Independent fork audit

All six findings were subsequently fixed and verified in
[v1.19.21](../audit-fixes-20261108/handoff.md). The audit observations below
describe the earlier source and v1.19.20; their negative evidence is preserved.

The independent review found six defects. The production handoff is on hold until
the critical native chat load/save defect is fixed. This review did not change
runtime code or publish a new container.

Reviewed source: `13005c03ee62b009fadbe208f78e8a793eacdc0a`.
Upstream comparison base: `06bde939fb1e9c4c8d8641d810f0a916b5bce127`.
Released runtime: v1.19.20, source `e750add4eb6f448f68673707f7ca258e836a882b`.
Reviewer: independent_fork_audit. Main agent independently validated evidence and
ran browser reproductions. Production69/shared85 and their app/config/data were
never accessed or changed. No Juiced runtime/policy/cache changes.

## Ranked findings

1. Critical: failed character or group reads can save greetings over existing
   transcripts. A missing incoming integrity slug bypasses server checks even
   when the existing file has valid integrity metadata. This is inherited native
   behavior, exposed by workspace story actions. Fix the shared client/server
   load contract and preserve the current story until the next load succeeds.
2. High: native character rename changes the avatar filename used by custom draft
   and archive keys. Those owners do not migrate keys on CHARACTER_RENAMED.
   The composer loses access to drafts and archived stories appear active.
3. Medium: delayed normal Connect responses are not bound to their original
   server URL. Old model metadata can be attributed to the newly entered server,
   including an incorrect automatic context limit for a shared model ID.
4. Medium: a cancelled recorder's delayed stop event cleans shared resources before
   checking its sequence. It can stop the next recording's stream and timer.
5. Medium: unsupported read-only verification returns false for Claude, AI21,
   VertexAI, Perplexity, ZAI and MiniMax. Foreground handling misreads that as a
   failed connection and repeatedly warns despite native connected state.
6. Medium: the separate image writer has no exposed cancellation path while its
   prompt request is pending. The composer and story changes remain blocked.

[Independent findings](independent/findings.md) owns the exact source references,
proposed owner-level fixes, regression cases, coverage and limits. The image
writer issue is source-traced. Do not label it browser-reproduced.

## Parent browser confirmation

A fresh actual-image container on http://127.0.0.1:8031 used five disjoint synthetic
volumes and no overlays. [Fixture proof](browser-fixture.json) records its image
and mounts. Two preservation invariants failed on v1.19.20, as recorded in the
[report](browser/report.json), observations and renders under browser/:

- Current-format character transcript with a valid integrity token: three saved
  messages before opening. One synthetic HTTP503 read caused a native HTTP200
  save with no incoming integrity. The stored transcript then contained only
  the greeting. Both the synthetic user and assistant messages were lost.
- Synthetic Claude connected-state fixture: foreground showed a model connection
  warning while native status stayed connected. There were zero provider status
  or inference requests. This tests the state contract, not live Claude access.

These are failing audit regressions, not two successful application tests. Only
new disposable fixture data was affected. No production data was inspected.
The temporary scripts are retained in browser-tests/. They intentionally exercise
an overwrite in disposable data. Run them only against the documented fresh local
fixture, never production or a shared/user-populated instance. Copy this directory
into a temporary directory with a node_modules symlink to tests/node_modules, then
run Playwright with its included config. The config targets only localhost8031.

## Independent source execution and provenance

The reviewer executed six isolated source checks for character/group failures,
recording ownership, draft/archive rename and stale connection metadata. The main
agent reran the script and reproduced every output exactly. The immutable source,
stubs and limits are documented in [independent/README.md](independent/README.md).
These checks do not execute a browser or disk writes. Existing focused unit suites
passed 20/20 and do not cover these defects.

All 34 added or modified tracked public/src/package runtime files versus the
upstream base match the actual v1.19.20 image. The [full runtime comparison](full-fork-runtime-check.json)
expands the previous 32-file sample by four files; two previously sampled files
were unchanged versus this base. Deleted paths and build configuration are not
byte comparisons and were reviewed as source.

The 72 release browser cases ran on the actual image. The 425 unit tests ran in
the source checkout, not inside the container. Earlier chat wording conflated
those execution locations. Passing those checks did not cover the newly found
read failure, character rename and asynchronous ownership cases.

## Remaining risks and limits

Image result ownership uses only a filename and checks before an awaited media
save. Same-named stories on different characters, classic-layout switching, or
switching during that save need dedicated reproduction. This is an unverified
risk, not an observed wrong-story image insertion. A normal differently named
story switch during image inference is already guarded.

The three earlier source-run failures remain unresolved. The rename attempt
included a native error dialog and HTTP400, not merely a stale header. The file
picker was focused at timeout; the late microphone case lost its draft. Later
isolated and release-image passes do not explain those failures.

The audit reviewed all maintained runtime changes and adjacent native owners.
It does not establish every untouched upstream path or provider as defect-free.
No live paid-provider, physical-phone/GPU-resume or real microphone checks were
performed in this review. Runtime fixes and their new regressions remain open.
