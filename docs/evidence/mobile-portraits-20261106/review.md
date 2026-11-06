# Mobile message portrait correction

The user reported a character portrait touching or overlapping chat text on
mobile, then requested Pixel 9 Pro XL sizing. Actual v1.19.14 on local8021
reproduced a50x50 image inside a30x38 avatar container. The image ended atx81,
using the20px gap before the name/text; text could wrap beneath its lower edge.
Earlier page-width checks did not compare image and container bounds.

The workspace now sizes the image to100% of its avatar container and prevents
the avatar column from shrinking. Native image cropping and portrait interaction
remain. No inference, settings-schema or chat-format behavior changed.

The new regression fails on the actualv1.19.14 image and passes on source. Its
final Pixel matrix uses Android/mobile/touch context at DPR3 and18viewport/font
states, including448x997, browser-height448x921, reduced-height448x400,
landscape997x448/945x396,320/390/768/1280 widths and normal/150% native text.
The independent448px roleplay flow also passed navigation, inspector, native
lorebook picker, tools and composer checks. Source focused result:2passes.
An initial Pixel fixture tried to set the worker's defaultBrowserType inside a
describe; Playwright rejected configuration before execution. Explicit context
options fixed the fixture. Its failed attempt is retained.

Pixel dimensions reference the primary
[Chromium DevTools profile](https://chromium.googlesource.com/devtools/devtools-frontend/+/f1fbee878f8958db80c0d421888ad49e9b03b790%5E%21/)
and browser-height values from the
[Playwright device descriptor](https://github.com/microsoft/playwright/blob/main/packages/isomorphic/deviceDescriptorsSource.json).
These are emulator settings, not measurements from the user's hardware. The
shared T3 browser separately inspected the source at448x997 CSS pixels. Its
resize changes CSS size only; the automated Pixel case adds DPR/mobile/touch.

Publication and actualv1.19.15 acceptance are pending. Production69, shared85
and all production data remain untouched. Prior live Juiced proof is in the
v1.19.14 handoff. Final image acceptance will run the full45-case suite, including
both live cases, from five new synthetic volumes without source overlays.
