# Same-document background tabs

The manual reload review used a query URL and exposed a separate native bug:
fragment anchors resolve against base href=/ and lose the current query. jQuery
UI classified the background tabs as remote, fetched / and inserted the complete
application into a background panel. Every sidebar/native control ID was then
duplicated; settings targeted the wrong copy. DOM ancestry and actualv18 failure
establish this cause. It is not a source overlay or a provider error.

Backgrounds is the only local jQuery tabs initialization in this source. Its
owner now resolves fragment anchors against the full current document URL before
initializing the widget. Path/query values remain intact, and both native Global
and Chat panels retain their original identities. No tab proxy, global widget
override or new state registry is introduced.

The new query test opens both background tabs, switches to Images, reloads with
the query intact and requires one sidebar/native settings tree. It also records
any XHR/fetch of the root index and requires none. Actualv18 fails; sourcev19
passes along with both held-template cases and desktop/Pixel menus (five cases).
Earlier v17/v18 actual suites passed65/67 respectively, but did not cover this
query path. They remain immutable intermediates. Final acceptance is all68 on
the actualv19 image plus native Save/readback/root and query navigation review.

Actualv18 baseline also recorded the uncaught error `cannot call methods on
autocomplete prior to initialization; attempted to call method 'widget'` and
the extra index's preloader remained (expected0, received1 after30000ms). Source
has no uncaught errors in all five focused cases.425units/lint/actionlint pass;
test lint0errors/50warnings. Earlier failing attempts remain retained.

## Final actual-image acceptance

Actualv1.19.19 passed all68cases together in9.0minutes, both live Juiced cases,
zero skips/flaky cases/uncaught errors.31runtime files match the tag; five fresh
volumes/no overlays, native version/heartbeat/HTTPS and both architecture labels
passed. Native UI Save/readback, location.reload() and query navigation retained
Advanced=true/steps8/automatic tools off. All seven inspected control IDs remain
unique and root XHR/fetch count is0. Root/query/desktop/Pixel renders inspected;
owned browser tab closed. Source/runtime are unchanged after tag.

32console entries belong to deliberate HTTP500/503/403/502/409, EOF/reset and
busy/delete guard cases.106failed requests:103ERR_ABORTED,2syntheticERR_FAILED,
1real fixtureERR_INCOMPLETE_CHUNKED_ENCODING. No claim of zero console/network
errors.425units/root lint/actionlint pass; test lint0errors/50warnings. Exact
results are in browser-summary.json and manual/native-settings.json.
