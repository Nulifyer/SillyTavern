# Status

## Project state

Latest verified publication is v1.19.19, source
031bc97933cab8827b473080c50d95c52b9f55af. This thread never deployed production69.

## Active tasks

Correct foreground chat layout after the user's November 7 clarification.
Main agent owns implementation, tests, release and continuity. ux_critique
completed two read-only design reviews. No worker edits.

Removed the recovered-reply panel, assistant-to-user draft insertion and reply
checkpoint/save hooks. Existing local reply records remain untouched. Native chat
retains replies/saving; per-story user drafts remain. Foreground geometry now uses
native positioning, composer fitting and scroll anchors independently of probes.

## Next action

Publish v1.19.20 through the normal GitHub
Release workflow, then run the full suite on its pulled image with five fresh
synthetic volumes and no overlays. Update evidence/release handoff afterwards.
Never access or deploy production69; preserve all existing production data.

## Verification

Initial source focused run: 10 passed in 70.5 seconds. Unit tests: 425 passed.
Root lint passed. Final Android-profile7cases pass; actual19 comparison2pass/3fail.
Full source69pass/3fail; isolated rerun of those3cases twice passes6/6. Causes
unresolved; all attempts retained. No browser case was excluded.
Source fixture: http://127.0.0.1:8029, st-chat-resume-source-20261107, five fresh
synthetic volumes with source overlays. It is not release-image proof.
Evidence owner: docs/evidence/chat-resume-20261107/.

## Blockers

None.

## Limits

Physical phone locking/GPU restoration and audible quality remain unqualified.
No production69/shared85 access or changes. No Juiced runtime/policy/cache changes.
