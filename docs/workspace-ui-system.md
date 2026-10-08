# Workspace UI system

The workspace uses plain CSS over SillyTavern's native DOM. This standard applies
shared typography and control rules across navigation, character selection,
profiles, story lists, settings, and the composer.

## Sources reviewed

Reviewed October 8, 2026:

- [Primer button guidance](https://primer.style/product/components/button/)
  distinguishes primary, secondary, and quiet actions and recommends restrained
  use of large buttons.
- [Primer size tokens](https://primer.style/product/primitives/size/) pairs
  standard 32px controls with defined padding and spacing.
- [Primer responsive guidance](https://primer.style/product/getting-started/foundations/responsive/)
  recommends 44px mobile targets and supports browser font preferences.
- [Primer typography](https://primer.style/product/getting-started/foundations/typography/)
  uses relative font units, matched line heights, and readable line lengths.
- [Radix typography](https://www.radix-ui.com/themes/docs/theme/typography/)
  defines related 12px, 14px, and 16px text roles.
- [Radix spacing](https://www.radix-ui.com/themes/docs/theme/spacing/)
  defines a shared spacing scale and proportional density changes.
- [Radix styling](https://www.radix-ui.com/themes/docs/overview/styling/)
  explains its vanilla CSS implementation and token-based customization.
- [Radix button CSS](https://github.com/radix-ui/themes/blob/1faff10ac26ae17f09944d418c6949b93fc6b566/packages/radix-ui-themes/src/components/_internal/base-button.css)
  separates alignment, sizing, and state variants. Source commit:
  `1faff10ac26ae17f09944d418c6949b93fc6b566`.

## Product choices

These values adapt those principles to a dark character-roleplay workspace.
They are defined in `public/css/workspace.css` at the workspace boundary.

| Role | Default size | Use |
| --- | --- | --- |
| Metadata | 12px | Dates, descriptions, tags, toolbar labels |
| Interface | 14px | Navigation, buttons, inputs, story titles |
| Reading | 16px | Transcript text and phone composer text |
| Section title | 20px | Dialog and panel headings |
| Page title | 24px | Character library, chats, settings |
| Character name | 30px | Character profile, with the existing literary serif |
| Action icon | 16px | Common buttons and native composer controls |
| Desktop control | 32px minimum | Standard and icon actions |
| Phone control | 44px minimum | Touch targets; icon glyphs retain their scale |

Text uses `rem` units multiplied by the native font preference. Controls and the
header grow when text grows. Native composer size variables map to this scale,
so an inherited icon multiplier cannot enlarge the wand independently.

Interface text uses a line-height near 20px at the default 14px size. Transcript
text uses a 1.625 line-height and an 80ch maximum width. Shared section spacing
uses 8, 12, 16, 24, and 32px steps. Controls use a 6px radius; panels use 12px.

Flat dark surfaces, lavender emphasis, and visible focus outlines retain the
approved visual direction. A profile's Start new story action carries primary emphasis. The latest-story preview
has a separate Continue action. Persistent navigation and cast creation use secondary emphasis.

## Audit corrections

The previous stylesheet mixed 9–11px labels with large headings, used unrelated
control sizes, and fixed workspace fonts independently of native preferences.
Those text roles now share the scale above. Native composer controls retain their
native visibility and actions, including generation stop and extension menus.

Repeated rules for the header portrait, icon targets, sidebar sizing, and textarea
alignment now have one base declaration. General mobile rules precede narrower
rules, so a 900px rule cannot undo an intended 600px layout refinement.

## Verification

Review real character, profile, story, and settings screens in the collaborative
browser. Cover desktop and 320/390/768px widths. Inspect multiline input and native
reply generation states. The browser suite also exercises the native 150% font
preference combined with a 20px browser font default at phone width.

## Screen redesign

The screen and action contract is in roleplay-workspace.md. Settings now use a
category workspace with task sections. Native controls move as one tree and return
to their original parents on exit. They are never copied. Character profiles use
an identity column and a premise/history column. Phone profiles collapse to one column.

The composer keeps the writing field and send/stop together. Voice, scene illustration,
native chat menus, extension menus, and model status sit below it. Voice is always
visible as an opt-in toggle. Scene illustration is a direct manual request.

The context boundary has a text label when older messages leave model context.
The first-message boundary is hidden because it does not identify omitted history.
