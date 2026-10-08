# SillyTavern workspace

The fork adds a dark character roleplay workspace.
The primary flow is library → character profile → new or existing scene.
[Roleplay workspace](roleplay-workspace.md) contains the user stories and reference review.
The classic layout remains available in Settings.

## Existing UI and UX map

The browser loads `public/index.html`, then `public/script.js` initializes settings, extensions, characters, and chat.
The server starts at `server.js`. Express serves the page and API handlers under `src/endpoints/`.
The frontend uses ES modules, jQuery, Handlebars templates, and CSS. Webpack bundles shared libraries.

| Area | Existing owner | User workflow | Friction observed in the original UI |
| --- | --- | --- | --- |
| Navigation | `#top-settings-holder` in `public/index.html` | Open one of nine icon drawers | Names are primarily in tooltips. Setup, creative tools, and account settings share one row. |
| Conversations | `#sheld`, `#chat`, `#form_sheld`; `public/script.js` | Send, edit, regenerate, swipe, attach files, run commands | The conversation occupies a narrow central strip. Chat management is inside the composer menu. |
| Home and recent chats | `public/scripts/welcome-screen.js`; `public/scripts/templates/welcomePanel.html` | Resume a chat, rename, pin, delete, or use a temporary assistant | Version information leads the page. Instructions and shortcuts compete with recent chats. |
| Character library | `#right-nav-panel`; `selectCharacterById()` in `public/script.js` | Search, sort, tag, import, create, edit, or select characters | Import and creation actions are icons. Character selection and editing share a panel. |
| Groups | `public/scripts/group-chats.js` | Create a group, choose members, manage group chats | Group creation is another icon in the character toolbar. |
| Connections | `#rm_api_block`; API modules such as `public/scripts/openai.js` | Select a provider, enter credentials, select a model, connect | The connection icon has status, but setup depends on recognizing its meaning. |
| Generation | `#left-nav-panel`; API-specific settings modules | Choose presets, context limits, samplers, and output limits | Many advanced controls appear in dense sections without a shared panel heading. |
| Prompt formatting | `#AdvancedFormatting`; context, instruct, and system prompt modules | Configure how instructions and messages reach a model | The relationship to generation and connections is implicit. |
| World info | `#WorldInfo`; `public/scripts/world-info.js` | Create lorebooks and activation rules | The tool is powerful, but its purpose is not explained by the navigation icon. |
| Personas | `#PersonaManagement`; `public/scripts/personas.js` | Choose the user's name, avatar, and description | The active persona is not persistently visible in the main navigation. |
| Extensions | `#rm_extensions_block`; `public/scripts/extensions.js` | Install and configure extra capabilities | Extension settings share the same navigation emphasis as everyday chat tasks. |
| Appearance and account | `#user-settings-block`, `#Backgrounds`; `public/scripts/power-user.js` | Change themes, backgrounds, preferences, and account options | Appearance settings, expert options, and account controls are densely arranged. |

These observations came from source inspection and the original app running in the shared browser.
They are design findings, not usability study results.

## Design direction

The user selected a dark chat workspace. The design treats SillyTavern as a place to write with characters.
Character portraits provide the strongest visual identity. Navigation and controls use quieter surfaces.

| Token | Value | Role |
| --- | --- | --- |
| Workspace | `#171b26` | Main background |
| Navigation | `#121620` | Sidebar |
| Surface | `#202635` | Composer and character cards |
| Border | `#343d50` | Grouping and separation |
| Text | `#e9edf5` | Primary content |
| Accent | `#c0b7ff` | Primary actions, active navigation, focus |

Noto Sans uses the app's existing local font files for controls and chat.
Georgia gives library and profile headings a literary voice without an external font request.
Chat text uses a 1.8 line height and an 820px maximum conversation column, including avatars and controls.

## Implemented behavior

The sidebar exposes Chats, Characters, and Archive, with recent stories and a
Settings link. The character library searches names, descriptions, and tags and
filters characters, casts, and favorites. Cards open profiles without replacing
the active transcript or its unsent draft.

Profiles offer Continue and Start new story before scenario, opening message, and
card details. New stories keep existing transcripts and reject duplicate titles
before changing the current scene. Scene rows identify the character or cast,
show the title, preview, and activity date, and resume that exact transcript.

Contextual menus rename, archive, restore, or delete scenes. Archive state stores
identifiers in account settings; transcript files stay in their existing locations.
Archived stories remain readable and disable the composer until restored.
Deletion defaults to keeping the story and closes an active transcript before
calling its native deletion owner.

Cast creation selects real library characters. Native group settings retain
member management and reply behavior. Image controls offer scene illustration,
portrait, and custom prompts through the existing image extension. Custom prompts
are text, including characters that resemble slash commands. Voice controls use
the native narration queue and refresh voice assignments when opened or enabled.

Settings groups model connection, generation, persona, world info, image, voice,
appearance, prompt formatting, and extensions. Each destination opens its native
controls in a titled panel. Escape and close restore focus. Ctrl/Cmd+K searches
characters, scenes, and settings.

On phones, navigation overlays the page with focus containment and an inert
background. Library, profiles, cast selection, lists, settings, and composer tools
fit a single column. Focus outlines, reduced motion, safe-area spacing, and browser
zoom remain available. Classic layout can be selected in Settings and restored
with its visible workspace button.

The workspace composer scopes the native size tokens to 16px icons and 32px
desktop controls. Phone controls use 44px touch targets with the same icon size.
At default font preferences its single-line desktop form is 48px tall; additional
lines grow through the native textarea sizing. Typography and controls follow
[the workspace UI system](workspace-ui-system.md). Native owners retain generation
and script control visibility.

## Ownership and compatibility

Starting a story asks the native character or group owner to create it directly.
It does not load the previous default transcript first. Loading a missing default
previously saved an unwanted second story. Workspace casts have no transcript
until the user starts their first story.

Voice and image generation default to off. Settings exposes separate controls
backed by the native extension settings, not separate workspace preferences.
Turning voice off stops playback. Turning images off blocks generation commands,
interactive triggers, and image function tools. Existing media stays readable.
Previously saved voice choices remain in effect.

Desktop controls use 14px labels with 32px minimum targets.
Mobile controls use 44px minimum targets. Both grow with font preferences.
Unitless line heights keep labels and padding proportional. Dropdowns and settings headers use solid dark backgrounds.
These choices follow the [MDN box model](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Styling_basics/Box_model),
[MDN line-height guidance](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/line-height),
and [W3C target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html).
The frontend uses native HTML controls, CSS, ES modules, and the existing jQuery
owners. No additional UI framework is required for these changes.

| File | Responsibility |
| --- | --- |
| `public/scripts/workspace.js` | Views, navigation, focus, dialogs, native action dispatch, and layout preference |
| `public/scripts/workspace-views.js` | Library, profiles, scene rows, contextual menus, and settings presentation |
| `public/scripts/workspace-chats.js` | Transcript indexing, archive identifiers, and adapters to native chat actions |
| `public/css/workspace.css` | Scoped tokens, desktop layout, and responsive rules |
| `public/index.html` | Static landmarks and dialogs |
| `public/script.js` | Startup and native character and transcript actions |

The workspace preserves native control IDs and extension insertion points.
Characters, transcripts, providers, image generation, and TTS keep their existing
owners. No second transcript database or generation pipeline is introduced.

The recent-chat endpoint enumerates files. Index refreshes are debounced around
lifecycle events rather than token rendering. Large libraries may eventually need
a server index. Arbitrary third-party styles and movable-panel replacements need
separate compatibility checks; classic layout remains available. New workspace
labels fall back to English where translations are unavailable.

## Verification

Install dependencies with `npm ci` and `npm ci --prefix tests`.
Use a disposable data directory for browser regressions:

```sh
node server.js --port 8002 --dataRoot /tmp/sillytavern-workspace-e2e-data --browserLaunchEnabled false
```

In another terminal:

```sh
npm run lint
npm --prefix tests run test:unit
cd tests
npx playwright install chromium
ST_BASE_URL=http://127.0.0.1:8002 npx playwright test workspace.e2e.js --workers=1
```

Browser tests isolate settings saves and clean up only their own transcripts and
characters. They exercise native persistence, scene creation and duplicate titles,
exact resumption, archive/restore, rename/delete and failed operations, settings,
search, casts, image generation, narration, and classic layout. Responsive cases
cover 320, 390, and 768 CSS pixels and a reduced-height composer viewport.

Model, image, and speech outputs use controlled fixtures. These checks verify the
native integration paths and do not establish paid-provider responses or audible
speech quality. The shared T3 Code preview supplies desktop and phone visual
inspection. Exact delivery evidence is recorded in `.agents/TESTING.md`.
