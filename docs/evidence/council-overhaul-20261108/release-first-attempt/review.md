# v1.19.22 release acceptance held

Source8a26aa977c0f505631e768905be70898ac9506d2 and its published image passed native
amd64/arm64 HTTP and heartbeat startup gates. Registry, labels and runtime proof
are retained in ../release/. The actual fresh five-volume/no-overlay browser run
passed92of93 cases in762.756seconds, including both live Juiced cases, but failed
the identical-filename draft isolation case. report.json and the failed case's
screenshot/diagnostics are retained. The original failure was not traced.

The same council reopened acceptance. Controlled rename and collection failures
were subsequently reproduced in this actual image and fixed in replacement
source. Those before/after results are in ../rename-delta/. Passing eight traced
repetitions of the initial case does not disprove the first failure. The original
tag and image remain immutable. Its GitHub Release notes mark deployment handoff
held; use the verified replacement once its own actual-image proof is complete.
No production update was performed for this council overhaul.
