# Story implementation critique

Source reviewed during implementation on 2026-11-08, followed by the isolated rendered review below. This is not a final verdict. Parent owns fixes and automated verification.

| Finding | Trigger and evidence | Impact | Status |
| --- | --- | --- | --- |
| Branch from an unswiped reply fails | `workspace.js` passed `swipe_id ?? 0`; `bookmarks.js` rejected that value when no `swipes` array existed. `getFirstMessage` creates no swipe array for ordinary greetings without alternatives. | The new branch action could not explore an ordinary greeting or legacy unswiped reply. | Fixed and exercised on 8036. |
| New branch bypasses illustration switch guard | `workspace.js` guarded `creativeTools.busy` for existing transcript changes but omitted `scene-branch`. `workspace-scene.js` disabled branching only for archived/generating stories. | A branch could open another story during the image-provider stage, contradicting the existing image journey. | Fixed on source recheck; provider interaction remains with parent evidence. |
| Attached lore sources absent | Setup had a World & lore link but no attached-source names or scopes. | The user could not identify which attached book to correct, leaving an agreed memory outcome incomplete. | Native snapshot added; rendered empty state and scope verified. |
| Summary configuration scope mislabeled | Summary destination said edits affect this story. Native summary text belongs to message extras, while source/prompt/pause/insertion configuration belongs to shared `extension_settings.memory`. | A reader could mistake shared configuration edits for a local story change. | Corrected copy verified in rendered setup. |

Strengths visible in source include explicit exact-story identity, optional scene sections, cast premise copy that acknowledges native member assembly, honest missing context, branch origin metadata and native scenario Apply/Cancel with owner guard. These remain subject to exercised tests and rendered review.

## Rechecks on the isolated story fixture

The parent assigned `http://127.0.0.1:8036`, container `st-council-story-20261108`, with five fresh synthetic volumes and source overlays. I used only my own tab `tab_n_dfebdf42-64d6-46f6-9748-1374a67d0b39`. This is source-fixture review, not a published-image claim.

- Ordinary unswiped greeting branch succeeded through the new action. It opened the native branch, showed its exact parent and returned to the original filename. The original unsent draft reappeared. The original related-story section listed its child.
- Source now gates new branch and override actions on illustration busy state. The new button state also includes that owner. I did not run an image provider in this fixture; integration coverage remains with parent tests.
- Native `getWorldInfoBindings` now provides configured global, story, persona and character attachments. Rendered setup showed the honest empty state and the inclusion/activation boundary. I have not created a synthetic lorebook in this manual pass.
- Rendered copy now distinguishes story summary text from shared automation, prompts and injection settings. The update-state text says not paused and requires an available source and update trigger. Those source findings are closed.

Additional rendered checks passed. Start new story was immediate. Escape discarded a pending premise. Apply persisted a story premise after reload, while a sibling story and the reusable card retained empty premises. A local native `/send` and `/sendas` created three neutral messages without inference. Editing the native summary showed an acknowledged save; reload retained its exact text and message 2 anchor. Restore Previous acknowledged its save; after reload the editor was empty and all three stored memory extras were absent. The newer retry-capable override popup also passed normal Apply and explicit Cancel after refresh.

At 1280×800, 390×700 and 320×400, the inspected story setup and native override editor had no horizontal document overflow. The small native popup retained reachable Apply and Cancel. Captures are `desktop-setup.png`, `mobile-390-setup.png` and `mobile-320-override.png`. These dimensions are browser emulation, not physical-device qualification.

Final verdict is pending the parent's completed automated evidence and final review request. No new blocking story finding emerged in this pass.

## Open source finding from the branch recheck

Major, obsolete operation ownership. `bookmarks.js:branchChat` checks the active owner, awaits `saveItemizedPrompts(fileName)`, then opens the filename through the live character/group selection without rechecking. `createNewBookmark` similarly awaits prompt-cache persistence after its guard and before the native transcript save. A character or cast switch during that IndexedDB await can redirect the operation to the new owner. Sent to parent with a request to recheck captured identity and generation after the cache await and use captured target IDs. This finding remains open pending a fix and affected evidence.

Archive review also passed on 8036. I archived the sibling story through its native workspace menu, reopened it from Archive, and saw the exact filename plus Archived and Read only. Story overrides, all source-edit destinations and branch creation were disabled. The composer remained inert. Explicit Restore through the story menu returned it to active state. Inspection did not restore it. I then closed my browser tab. Parent automation still owns failure/race, generated-capture, group, suspension and broad regression evidence.

The cache-await ownership fix is present on source recheck. `branchChat` now rechecks identity and generation immediately after cache persistence; `createNewBookmark` additionally rechecks its original message. The shared ancestry resolver now governs both parent and child lists. The ownership finding is implemented and awaits the parent's native regression result for verified closure. The control member owns the related failed-group-registration retry review.
