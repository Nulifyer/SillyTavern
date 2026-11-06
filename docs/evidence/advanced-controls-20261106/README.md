# Advanced controls acceptance

The user clarified that simplified flow must preserve SillyTavern's advanced
settings. v1.19.10 retained native control nodes, but collapsed provider forms
had vague labels. This batch adds a persistent Advanced controls switch inside
the workspace and an All controls filter for sectioned settings. The same native
provider, prompt, sampling and extension owners retain their values and handlers.

The advanced regression opens custom API parameters, edits native temperature,
checks prompt formatting and extension forms at 1280/390/320px, verifies discovery
and Use model do not collapse advanced forms, saves/reloads the preference and
value, then collapses controls without resetting the value. The broader suite
covers native control-tree identity, classic restoration, dialogs, pending saves,
streaming, first-reply template recovery and real Juiced service requests.

Only local synthetic containers are used. No production69 or shared test85
access, data inspection, mount or deployment is authorized or performed here.
Published-image acceptance must use five separate synthetic named volumes and no
source overlays. Existing v1.19.10 test work remains preserved.

The November2 interrupted full rerun has no surviving result. Its retained image
run passed 32 cases and failed 1 assertion expecting the literal noun 'book' from
Qwen. The corrected test verifies preserved red-teapot/blue-book input and a
nonempty recovered reply. It does not claim deterministic model output.

Final acceptance:34 source browser cases passed, the expanded advanced case
passed separately, and all 34 cases passed on the pulled v1.19.11 image with both
live cases enabled. No browser cases were excluded. Lint,424 unit tests and
actionlint passed. Released diagnostics contain zero uncaught page errors;
intentional failure/retry and aborted navigation requests remain recorded.
The isolated restart check ran after the suite, because the earlier overlapping
check observed shared synthetic settings changes. Its before/after values match.

Actual image test: st-advanced-release-20261106, 127.0.0.1:8016, five new named
volumes. Local-only flags disabled whitelist/IPv6/browser launch and set
SILLYTAVERN_SECURITYOVERRIDE=true with host binding restricted to 127.0.0.1.
These are test flags, not production configuration changes. Heartbeat interval 30.
Existing test containers and volumes were preserved. The handoff owns immutable
identity, setup, migration and rollback details.
