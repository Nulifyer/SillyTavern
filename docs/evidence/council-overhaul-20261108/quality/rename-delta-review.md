# Replacement delta review

The rename fix addresses the observed timing boundary at its native owner. CHAT_RENAME_ACKNOWLEDGED runs after the file acknowledgement and before the slower definition write or transcript reload. BrowserRecovery moves the draft before the new title accepts input. Its transition is bounded to that exact old/new owner pair; a different story clears it. The established CHAT_RENAMED completion event remains available. Native character discovery now parses and normalizes a candidate before replacing the shared array, removing the transient empty-owner window.

I read script.js rename/getCharacters, browser-recovery.js acknowledgement, transition/save/change paths, group-chats.js rename, the seven focused browser cases and their32.2-second passing log. The new tests hold real character/cast metadata endpoints, type after file acknowledgement, exercise503 metadata failures and retry, hold response JSON decoding, check owner/message-node continuity, reject malformed collection shapes, and retain the original same-filename sibling assertion. The492-pass unit log is supplementary evidence. These checks exercise the identified failure instead of merely changing timing.

One validation question was sent to the parent. Candidate validation currently accepts any non-array object card. An empty object or missing/null avatar can therefore publish before the active avatar lookup rejects it. The malformed browser case covers a non-array collection and[null], but not a malformed object card. Stable avatar identity is the native ownership boundary; optional description fields do not need stronger validation. The parent should either validate that required identity and cover the object case, or narrow the claim that every published candidate is valid.

I have not repeated the broad browser review. Q1 and its true enlarged-font failure-footer proof remain accepted. Final satisfaction requires the replacement image's full99-case run and exact runtime identity. No production access or additional fixture mutation occurred for this delta review.

## Source delta accepted

I rechecked the final validation and transition changes. getCharacters now rejects absent, nonstring or empty avatar identities before publishing. The malformed browser case includes five invalid shapes and preserves the prior object references and owner. This closes the candidate-validation question.

The acknowledgement now also checks the captured native active identity, including integrity. A real CHAT_CHANGED to the previous filename retires the temporary transition instead of lending it permission. Focused units cover a different incarnation, returning to the old name, unrelated stories, account/entity separation, destination conflicts and a superseding rename. The final focused browser log has8 passes, including the strengthened true-font failure footer case, in43.9seconds. The final unit log has494 passes in26 suites.

The Q2 native rename/draft defect is resolved in source against the identified trigger. I accept this implementation delta and have no open source objection. Final release satisfaction remains pending the replacement v1.19.23 image's complete99-case and service evidence. This is the same council review, not a new scope decision.

The council then found that the active-identity guard had to protect stored-record migration too. I rechecked the correction: when the live old/new path is occupied by a different captured native identity, acknowledgeRename returns before writeDraft or moveDraft. The strengthened unit dispatches a new-incarnation input before the stale acknowledgement and asserts its record stays under the old key with no renamed record. I accept this final bounded guard for source freeze. The parent's rerun was pending at this exact recheck; earlier494 results were not treated as proof of this additional line.

## Draft-preference fixture qualification

The later full source run inherited restore_user_input=false from its synthetic settings. The parent reported normal input events with zero draft storage writes, which agrees with the native saveDraft preference guard. I reviewed the harness correction: beforeEach enables restoration only on the initial settings read, while settings saved within that test remain authoritative through reload. The dedicated opt-out case still saves false and reloads with false. This is a valid precondition for restoration tests and preserves the explicit opt-out contract.

That evidence qualifies the traced source-run failures only. It does not retrospectively explain the first untraced v1.19.22 image failure. The independently controlled held-rename reproduction on v1.19.22 remains a real defect, and the replacement native fix remains necessary. Failed runs stay preserved; final acceptance still requires the clean complete replacement run.
