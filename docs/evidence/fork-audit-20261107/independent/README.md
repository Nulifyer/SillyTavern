# Independent source checks

These checks execute extracted repository functions with synthetic dependencies.
They do not use the application, browser storage, containers, providers or network.
No production, shared fixture or existing user data is accessed.

Run from the repository root:

```sh
node docs/evidence/fork-audit-20261107/independent/reproduce-source.mjs
```

The default source is immutable commit `13005c03ee62b009fadbe208f78e8a793eacdc0a`.
Pass another Git revision, or `worktree`, to inspect changed source. These are
diagnostic checks, not complete browser or server integration tests. The JSON
records behavior without asserting that a defect must remain present.

The HTTP load checks execute native load and initialization functions. Saves
are captured as synthetic arguments. Server disk writes and integrity checks
are not executed. The missing integrity slug matters because
`src/endpoints/chats.js:538` skips validation when the incoming slug is absent.

The recording check uses a fake MediaRecorder and two synthetic tracks. Its
stop event is deliberately delayed until the second recording starts. UI updates
and timers are stubbed. It checks stale cleanup ownership, not real microphone
hardware or normal browser event timing.

The rename checks use actual draft and archive key calculations. They model the
native avatar change and the later chat-change/list refresh. They do not execute
the native character rename endpoint or persistent storage.

The status check delays a synthetic response and changes the configured URL.
It records the native `saveModelList` call. It does not execute the dropdown or
context update, whose current-URL attribution is established by source review.

`source-results.json` records the six checks. `focused-unit.log` records the
existing compatible-services and util Jest suites, 20 tests passing. Those
suites do not cover the reproduced load, rename, recorder or status races.
