# Interrupted chat stream recovery

Status: complete
Owner: Codex root; server worker owns durable relay, independent reviewer challenges recovery coverage
Project: ../PLAN.md

## Request and outcome

The user reports that returning to an interrupted chat stream or reloading still
loses the expected last-message behavior. They request T3 Code source inspection
and reliable server/client recovery. This expands the earlier layout-only work.
Replies must stay in native character bubbles, and reconnecting must not repeat
inference or put character output in the user draft. A visible Continue action
is part of the reopened UI audit.

## Acceptance

- [x] Server generation survives subscriber disconnect and page reload.
- [x] Retained clients resume from their cursor; reloaded clients reconstruct the same native target from durable bytes.
- [x] One provider invocation, no duplicate message, no duplicated continuation prefix or swipe, no repeated tool effects.
- [x] Completion while absent, reload before first token and after partial output, repeated reload, reconnect and explicit Stop are covered.
- [x] Server restart retains partial output and marks interruption without repeating inference.
- [x] Native save failure retains recoverable output; concurrent story edits cannot be overwritten by recovery.
- [x] Authenticated accounts and story identities remain isolated; private journals contain no provider credentials.
- [x] Applicable browser, unit and integration checks pass with exact evidence and limitations.

## Current state

Original failure: native backend handlers aborted provider work on browser socket close.
StreamingProcessor holds unfinished text in browser memory. Browser recovery
repairs layout/drafts/connectivity but cannot recover destroyed response bytes.

Reference T3 source: bbdc7dca320ee4fbc7131498aaffef2fa1eb3d41, inspected in
/tmp/st-ui-followup-t3-ref. Server provider ingestion is independent of client
subscriptions; committed events can be replayed by cursor or snapshot.

Design: existing native provider routers execute through a server-owned request
and writable response. A private per-user journal owns replay cursors and terminal
state. Native parsers and chat finalization remain the reply owners. A compare-and-
swap commit protects concurrent edits. Reload does not start another Generate call.

Current implementation includes durable jobs, cursor replay through native
parsers, native transcript CAS/receipts, original parser-setting capture and
explicit server Stop. Continue retains the user draft. A reloaded replay does not
repeat tools, narration or remaining cast turns.

Final verification: 657 units in 34 suites pass. The immutable v1.19.25 image
passes all 391 final browser cases, including native recovery and all 10 lifecycle
cases: real SIGKILL/restart, repeated reload, swipe/multi-choice, original parser,
concurrent disk edit, lost acknowledgement and tool/cast replay. No failed,
skipped, flaky or uncaught page errors. Namespace fixture I/O preserves file
ownership/mode/inode; it changes no application code or permissions.

Production now runs verified source `3a6e1cc6a4dc5299a870f9bdbfc36397b6208e3b`,
index `sha256:6d0432fbfd5c7bf562a10a22a4f4164d8b7d61d6f77e306e2fa099f68c545d09`.
Native health is healthy; volumes and deployment metadata are unchanged.
Exact attempts, diagnostics, architecture and qualification limits:
../../docs/evidence/ui-followup-20261109/release-v25/acceptance.md.

Next action: none for this request. Replayed completed tools/cast effects are
qualified; browser death during a tool's own execution is not qualified.

## Boundaries

No production app routes, screens, logs or volume contents. Use fresh synthetic
local fixtures. No paid-provider credentials. Preserve unrelated working changes.
Raw relay recovery covers one inference; browser cast/tool orchestration needs
explicit side-effect qualification before claiming full recovery.
