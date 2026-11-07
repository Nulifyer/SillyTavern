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
