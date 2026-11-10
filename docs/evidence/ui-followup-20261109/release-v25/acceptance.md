# v1.19.25 acceptance and production update

Production runs **v1.19.25**, reports healthy with zero restarts, and retains all
four volume identities/mounts, stack definition/environment, network and routing.
Two healthy metadata samples are recorded. No production application routes,
screens, logs or volume contents were inspected.

[Release](https://github.com/Nulifyer/SillyTavern/releases/tag/v1.19.25) ·
[Native architecture workflow](https://github.com/Nulifyer/SillyTavern/actions/runs/42765176165) ·
[Production verification](production-verification.json)

Source: `3a6e1cc6a4dc5299a870f9bdbfc36397b6208e3b`

```text
ghcr.io/nulifyer/sillytavern@sha256:6d0432fbfd5c7bf562a10a22a4f4164d8b7d61d6f77e306e2fa099f68c545d09
```

The composer has visible Continue while preserving drafts. Selected-background
paint, portrait layering, contrast, short-window controls and native interaction
ownership are corrected. Visible streams use server-owned jobs and replay through
native parsers after reconnect/reload. Server restart retains partial output
without repeating inference. Native save receipts protect lost acknowledgements
and concurrent edits; recovery does not repeat completed tools or cast turns.

| Final immutable amd64 image suite | Passed | Failed / skipped / flaky |
| --- | ---: | --- |
| Workspace, including both live Juiced cases | 102 | 0 / 0 / 0 |
| Native actions and ownership | 251 | 0 / 0 / 0 |
| UI audit | 28 | 0 / 0 / 0 |
| Real restart and recovery lifecycle | 10 | 0 / 0 / 0 |
| Total | 391 | 0 / 0 / 0 |

[Exact cases, hashes and diagnostics](image-acceptance.json) record zero uncaught
page errors. Console/network entries remain counted, including injected failures,
unconfigured providers, synthetic missing avatars, navigation, restart and lost
acknowledgements. These are not clean-console or clean-network claims.

All 657 unit cases in 34 suites pass. Root lint, actionlint and diff checks pass;
test lint has zero errors and 134 warnings. The manual source gate reconciles
370 first-party frontend files and 2,037 current static event candidates, with
266 command/inline/wrapper registrations recorded separately. There are no source
hash gaps, missing owners or unclassified extracted candidates. Source review,
geometry observations and actual actions remain separate evidence.

The completed inventories cover 184 settings states at eight viewport sizes and
480 provider states, with 30,222 control observations and zero unexpected enabled
control obstructions or horizontal panel overflow. Paint, enlarged-text, selected
background, menu/dialog and keyboard cases add their own recorded matrices.
[Inventory summary](ui-inventory-summary.json)

Each final main fixture uses five fresh named volumes without source overlays.
After the suites, all 378 runtime files match source in each final fixture,
including all 370 reviewed frontend owners. All 369 directly served source files
match; `/lib.js` matches the compiled image bundle rather than its source entry.
Native heartbeat checks pass. The workspace fixture has no engine health command;
its native heartbeat was checked directly. The other two final fixtures also
report engine health as healthy. Both architectures pass native startup; full
browser acceptance ran on amd64.
[Post-suite proof](image-fixtures-post-suites.json)

The lifecycle suite uses 50 fresh volumes and verifies 11 starts of the same
immutable image. Rootless file access preserves owner, mode and inode without
changing application permissions. An actual v1.19.24 upgrade preserves eight
exact settings/story/draft fields and all five migration volume identities.
[Lifecycle](lifecycle-summary.json) · [Migration](migration.json)

Earlier source and image attempts remain recorded. Test-only followups corrected
a Playwright chooser interception race, rootless fixture file access, and stale
DOM measurements. An intermediate inspector selector was too broad and was
restricted to the original input domain. The initial reroll restore timeout was
not reproduced; its cause remains unconfirmed. The final full UI suite passes
using current keyed input locators. No application changes followed publication.
[Source batches](../source-qualification.json) ·
[Chooser diagnosis](filechooser-diagnosis.json) ·
[UI diagnosis](ui-harness-diagnosis.json) ·
[Rootless boundary proof](lifecycle-file-boundary-proof.json)

Physical devices/microphones, audible quality, paid-provider output, arbitrary
custom themes/third-party combinations and browser death during a tool's own
execution remain unqualified. Rollback baseline is v1.19.24, index
`sha256:c955042e0cc754aa32c713e7a539879769b518c8a436574efe7a575b3fae6f42`.
Keep existing volumes and retained job journals; v1.19.24 cannot read the new jobs.
