# Interrupted reply recovery

Visible streaming replies use a server-owned generation job. Native providers
still construct requests and interpret their protocols. Closing a browser
subscription does not close the provider request. Explicit Stop cancels that
request on the server.

The server writes response bytes into a private account journal before publishing
them. Retained clients resume after their last sequence number. A reloaded client
replays the same bytes through the original native parser, using the captured
provider settings and exact message seed. It does not rebuild a prompt or repeat
inference. Replies remain character messages; user drafts are independent.

T3 Code reference source was inspected at
`bbdc7dca320ee4fbc7131498aaffef2fa1eb3d41`. Its separation between server ingestion
and client subscriptions informed this design. This implementation uses native
SillyTavern routers, parsers, story identities and transcript files.

## Persistence and ownership

The native user turn is saved before inference starts. Jobs carry an immutable
story identity and a disk baseline hash. Final reply commits compare that baseline
before writing the native JSONL file. A write-ahead candidate hash reconciles a
successful save whose HTTP acknowledgement was lost. A concurrent edit preserves
the saved conversation and retains the uncommitted reply.

For a conflicting story, the inline status offers **Discard interrupted reply**.
Confirmation stops the old job and removes its replay journal; it leaves the saved
conversation and unsent draft intact. Cancelling keeps the reply available. This
explicit choice releases the story for a new reply without silently overwriting
another tab's edits.

Replay finalizes the native message without repeating tool calls, narration,
automatic continuation, or subsequent cast members. A server restart marks an
unfinished job interrupted and exposes its retained bytes; it never restarts the
provider request. Continue extends the native reply while preserving unsent text,
including slash commands.

## Boundaries

The relay applies to visible streaming replies from Chat Completion, Text
Completion, Kobold and NovelAI. Quiet requests, impersonation and nonstreaming
requests keep their native lifetimes. Provider requests remain subject to native
timeouts and errors. Recovery cannot manufacture output after a provider or
server stopped producing it.

Per account: two active jobs, 64 unresolved jobs, 16 MiB context and 64 MiB response
journal per job, and a 30-minute generation limit. Small acknowledged receipts are
bounded and expire after seven days; unresolved output is retained. Journals live
under the account's `generation-jobs` directory, with private file permissions.
Provider credentials and request headers are excluded from the journal.

## Checks

`tests/generation-jobs.test.js` covers durable jobs, account/story boundaries,
limits, resource cleanup and commit receipts. `tests/generation-transport.test.js`
covers cursors, byte decoding, retry, cancellation and lost acknowledgements.
`tests/stream-recovery.e2e.js` exercises native reload/reconnect/Stop/Continue and
failure behavior. `tests/stream-recovery-lifecycle.e2e.js` owns isolated source or
immutable-image fixtures, including real server termination, swipe/multi-choice
parsing, changed provider settings, concurrent edits, cast and tool side effects.

See the follow-up evidence for exact runs and qualification limits. Source tests
do not establish published-image or production behavior by themselves.
