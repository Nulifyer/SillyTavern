# Independent fork audit

Reviewed immutable source `13005c03ee62b009fadbe208f78e8a793eacdc0a`.
The first fork commit is `c7c0288c6`, following upstream base
`06bde939fb1e9c4c8d8641d810f0a916b5bce127`. No remote fetch was needed.

This review found consequential defects beyond the removed reply recovery UI.
The highest priority is the native failed-load path, which can save a greeting
over an existing transcript. Do not treat the prior green browser suite as
qualification of that path.

## Ranked findings

1. **Critical: failed transcript reads can overwrite existing conversations.**
   `public/script.js:7773` catches a failed load and calls `getChatResult`.
   The caller already cleared chat data and metadata at `7839-7844`.
   `getChatResult` initializes and saves a greeting at `7782-7789`.
   The save has no integrity slug. `src/endpoints/chats.js:538` therefore skips
   integrity validation, including for current-format protected files.
   The adjacent group path converts HTTP failures into an empty list at
   `public/scripts/group-chats.js:195-210`, initializes greetings, and saves at
   `304` before installing its new metadata at `312`.
   Both initialization paths produced greeting-only writes with empty metadata
   in `source-results.json`. The parent separately confirmed actual-image
   character transcript destruction in its synthetic browser fixture.
   This is inherited native behavior exposed by workspace story actions.
   Fix the native load/save contract. Failed reads must never initialize or
   save a new conversation. Preserve the loaded story until a new load succeeds.
   Cover character and group open/reload/new paths, HTTP/network/payload failures,
   and successful empty/new files. The backend currently returns HTTP200 `{}`
   for both some legitimate empty states and exceptions at
   `src/endpoints/chats.js:599-618`, so distinguish those states at that owner.

2. **High: native character rename loses access to drafts and archive state.**
   Draft identity includes the avatar filename at
   `public/scripts/browser-recovery.js:9-10`. Archive identity includes it at
   `public/scripts/workspace-chats.js:12-13`. Neither owner handles native
   `CHARACTER_RENAMED`. Native rename emits that event before reselecting the
   character at `public/script.js:7338-7350`. After the avatar changes, the
   draft owner clears the composer because its new key is absent. All archived
   stories for that character no longer match their stored IDs and appear active.
   Isolated execution confirmed an empty draft with its old record retained,
   and archive state changing from `true` to `false`.
   Migrate each owner's character keys on the native rename event. Keep group
   state separate, handle an existing destination deliberately, and never copy
   state to a duplicate character. Verify active and inactive story drafts,
   archived stories, reload, groups and duplication.

3. **Medium: normal connection responses can apply another server's context.**
   `public/scripts/openai.js:4491-4492` captures request settings, but stale
   rejection at `4589` and `4606` only applies to read-only foreground checks.
   Normal Connect accepts an old response at `4596-4597`. Native URL editing
   does not cancel it at `7175-7177`. `saveModelList` attributes metadata to the
   current URL at `2071`, then applies automatic context at `2086`.
   Isolated execution held server A's response, changed the URL to B, and
   confirmed A's model metadata reached `saveModelList` while B was active.
   If both servers have the same model ID, A's capacity can overwrite B's budget.
   Bind every normal status response to its captured provider/address and discard
   obsolete responses. Test delayed A, URL edit to B, shared model ID, and distinct
   context limits. Preserve intentional manual context changes.

4. **Medium: an old recorder's stop event stops a newer recording.**
   `public/scripts/dictation.js:168` calls shared `stopTracks` before checking
   the recording sequence at `169`. Cancellation releases the active state at
   `128-136`, allowing another recording before the previous stop event runs.
   In isolated execution, stream 2 was live before recorder 1's delayed stop
   event and ended afterward. Recorder 2 still reported `recording`.
   Check ownership before cleanup, or close only the captured recorder's stream
   and timer. Apply the same ownership rule to delayed error events at `166`.
   Verify cancel 1, start 2, delayed stop/error 1, then successful stop 2.
   Existing pending-permission tests cover a different race.

5. **Medium: foreground checks falsely report failures for valid native providers.**
   `public/scripts/browser-recovery.js:184-188` treats a false return from every
   OpenAI-family read-only status check as a connection failure.
   `public/scripts/openai.js:4501-4502` returns false for unsupported read-only
   verification of Claude, AI21, VertexAI, Perplexity, ZAI and MiniMax.
   Valid connections therefore display a warning after foregrounding the tab.
   The parent separately confirmed this on its actual-image synthetic fixture,
   with connected Claude status and zero provider-status/inference requests.
   Distinguish unsupported verification from a failed verification, or only probe
   supported sources. Test every unsupported source without inference or key writes.

6. **Medium: the independent image writer cannot be cancelled while pending.**
   `public/scripts/workspace-tools.js:145-171` sets busy while awaiting the
   native image operation. That blocks story changes and inerts the composer via
   `public/scripts/workspace.js:295` and `449`.
   Native image generation awaits its prompt at
   `public/scripts/extensions/stable-diffusion/index.js:3097`, but only creates
   its stoppable loader at `3110`. The added independent writer request at
   `3340-3375` receives no abort signal and does not expose native generation Stop.
   A held writer request therefore keeps the workflow busy without a cancellation
   action. This is source-traced, not browser-reproduced by this reviewer.
   The native image operation should acquire cancellation before prompt writing
   and pass the same signal into the independent writer. Verify a held writer can
   be cancelled, produces no image, releases busy state, and permits another story.

## Additional source risks and unresolved evidence

- Native image result ownership uses only the story filename at
  `public/scripts/extensions/stable-diffusion/index.js:3419,3522`. It checks before
  the awaited media save at `3529`, then obtains current context at `5050`.
  Switching to classic layout clears the composer guard at
  `public/scripts/workspace.js:573-577`. A same-filename character switch, a switch
  during the media save, or a switch while the writer is pending may attach an
  image to the wrong story. A differently named story switched during image
  inference is already rejected by the native guard. Reproduce the narrower
  cases before claiming an observed wrong-story insertion.
- The old source-run rename failure includes a native error dialog and HTTP400
  in `chat-resume-20261107/source-full/`, beyond its stale-header assertion.
  Its cause remains unresolved. The keyboard file chooser timeout had its
  intended button focused with no captured console/page/request failure.
  The late-permission case lost the draft without captured console/page errors.
  Later isolated and released-image passes do not explain these failures.
- Native read/write and image operations still depend on mutable global context.
  UI-only navigation guards cannot guarantee their ownership across native,
  extension, classic and asynchronous entry paths. Fix those invariants at the
  operation owner instead of adding more workspace-specific guards.

## Coverage and limits

Inspected all maintained runtime changes against the upstream base. Source review
covered the eight workspace/service/dictation/recovery modules, composer and audio
helpers, CSS/HTML, native chat/group open/save/generation/cancel paths, provider
status/context/profile application, extension readiness, image writer/generation,
TTS, captions, server discovery/transcription, SSE forwarding and release workflow.
Reviewed project routing, indexed continuity records, design/service contracts,
release procedures and the previous failed source-run artifacts.

Ran the six isolated source checks in `reproduce-source.mjs`. The exact outputs
are in `source-results.json`. Ran the existing compatible-services and util Jest
suites, 20 tests passing. `focused-unit.log` retains the output. `git diff --check`
passed. No runtime code, tests, fixture data, container or remote state was changed.
The parent authorized only the new `independent/` evidence files.

This reviewer did not run browser mutation tests, live providers, hardware tests,
or image provenance checks. The parent owns those checks and its additional
browser/provenance evidence. No production or shared deployment/data was accessed.
This audit does not establish that every upstream path or provider is defect-free.
