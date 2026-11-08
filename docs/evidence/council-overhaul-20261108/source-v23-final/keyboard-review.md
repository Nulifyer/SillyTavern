# Native keyboard activation correction

The clean source run passed 98 of 99 cases in 721.797 seconds. Keyboard audio
selection failed. Console, network and page-error diagnostics for that case were
clear. Its failure and before report are retained in ../source-keyboard-before/.

Test-only event instrumentation observed two clicks for one trusted Enter on the
native Choose audio file button. The global keyboard handler first synthesized
a click; the browser then dispatched its native click. Both called the same
connected file input's click method while user activation was present. The JSON
focused report timed out waiting for the filechooser event. Three trace-enabled
attempts timed out and produced incomplete archives; those archives are not used
as proof of browser behavior.

The shared keyboard owner now leaves native controls and editable content to the
browser, respects an existing prevented default, composition and modifiers, and
consumes a custom interactable's Enter before activating it once. Dictation has
no special keyboard workaround. The actual Enter/filechooser/cancel/focus test
asserts exactly one native button activation, plus one custom and one already-
owned activation. A textarea inside a custom control keeps its newline without
activating the parent. Seven focused units fail before and pass after the fix.

The affected keyboard, composer/search and desktop/Pixel menu run passes four
cases in 43.8 seconds. The full unit suite passes 501 tests in 27 suites. Root lint,
actionlint and test lint pass, with 53 existing test warnings. The 20-file manifest
identifies the final runtime; the full source and actual-image runs remain
separate acceptance gates. The same council reviews this correction.
