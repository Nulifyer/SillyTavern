# Interrupted chat stream recovery

Status: in progress
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

- [ ] Server generation survives subscriber disconnect and page reload.
- [ ] Retained clients resume from their cursor; reloaded clients reconstruct the same native target from durable bytes.
- [ ] One provider invocation, no duplicate message, no duplicated continuation prefix or swipe, no repeated tool effects.
- [ ] Completion while absent, reload before first token and after partial output, repeated reload, reconnect and explicit Stop are covered.
- [ ] Server restart retains partial output and marks interruption without repeating inference.
- [ ] Native save failure retains recoverable output; concurrent story edits cannot be overwritten by recovery.
- [ ] Authenticated accounts and story identities remain isolated; private journals contain no provider credentials.
- [ ] Applicable browser, unit and integration checks pass with exact evidence and limitations.

## Current state

Observed: native backend handlers abort provider work on browser socket close.
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

Final frozen unit checks pass657 cases in34 suites, including job/transport,
provider-error parsers and ownership tests. The ten isolated source lifecycle
cases pass with stable hashes, zero uncaught page errors and owned8058 stopped:
real SIGKILL/restart, repeated reload, swipe/multi-choice, changed provider
settings, concurrent disk edit, lost commit acknowledgement and tool/cast replay.
Console/network fault diagnostics remain recorded. Earlier mixed-source and
focused core runs retain their narrower scopes in the evidence index.

The full source workspace102/live and native recovery cases pass within the
recorded source batches. Source UI/translation/TTS fixture corrections and the
subsequent bounded menu lifetime repair are tracked in source-qualification.json;
those batches are not one clean final-source run. Immutable-image lifecycle and
browser qualification remain required.
See ../../docs/evidence/ui-followup-20261109/source-lifecycle-summary.json.

Next action: finish frozen source acceptance, publish the inspected source and
qualify its actual immutable image before the production refresh.

## Boundaries

No production app routes, screens, logs or volume contents. Use fresh synthetic
local fixtures. No paid-provider credentials. Preserve unrelated working changes.
Raw relay recovery covers one inference; browser cast/tool orchestration needs
explicit side-effect qualification before claiming full recovery.
