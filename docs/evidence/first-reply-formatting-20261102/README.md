# First-reply prompt formatting

User evidence: screenshot of `System message must be at the beginning`, then
confirmation that it occurs on the first reply. The user's selected model is
unknown; no production app or data was inspected.

Target: local Podman `st-ui-release-20261102`, published v1.19.9 source
`9ab8d2cedec44448c7f8ea49c4dfba5c8799ebf1`, image index
`sha256:1aeffc008478d6923152ae4dc61eb3115c56e97d0da3cb3a62b8cc17f4be33bf`.
Five synthetic volumes; no source overlays. See container.json.

## Observed result

- Real discovery and native connection succeeded for `Qwen3.5-2B`.
- Native post-history instructions produced a system message after the first
  user turn. With prompt processing None, the first story reply reproduced
  the exact line 85, column 32 Jinja exception from the user's screenshot.
  The error arrived inside an HTTP 200 event stream.
- Selecting native `semi_tools` (Semi-strict, alternating roles, with tools),
  saving, reloading, reconnecting, reopening the same synthetic transcript and
  retrying produced a streamed reply. The later system instruction remained
  present in the browser request; the existing backend converter handled it.
- The saved selector remained visible and selected at 390px.
- The regression passed in 10.8 seconds. browser.log and
  first-reply-formatting.json hold the result, submitted synthetic prompts,
  exact error and returned text. PNGs show failure, recovery and mobile setting.
- No page or console errors were captured. Four requests were recorded as
  `net::ERR_ABORTED` across reload: `/img/ai4.png`, `/api/settings/save`, and two
  `/api/ping` requests. No inference transport request failed.

The first test attempt timed out because its helper assumed reload restored an
in-memory active story. The test now explicitly opens its exact transcript
from Stories, matching the workspace's library landing behavior. The corrected
case passed; the final log includes console/network capture and a scrolled
mobile screenshot of the selected control.

## Scope and limits

Only test, documentation and evidence files changed. No replacement image,
tag, server-template patch, forced global formatting change or production
configuration change is needed. The existing setting changes later system
instructions to user-role priority while preserving text/order. It is an
explicit compatibility choice; save it in the relevant prompt preset if a
Connection Manager profile reloads that preset.

This proves this model/message-order case, not every provider template or tool
workflow. The earlier 27-case release acceptance used another story model and
did not cover this combination. No unit tests were rerun because application
code did not change. Root lint and continuity validation passed.
