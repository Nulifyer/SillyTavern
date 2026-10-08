# SillyTavern workspace

The fork adds a dark workspace around SillyTavern's existing chat and settings controls.
The primary flow is to choose a character, connect a model, and continue a conversation.
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
Georgia gives the home headline a literary voice without an external font request.
Chat text uses a 1.8 line height and an 820px maximum conversation column, including avatars and controls.

```text
Desktop
+-------------------+-----------------------------------------------+
| SillyTavern        | Conversation name              History  New  |
| Find anything     +-----------------------------------------------+
| Workspace         |                                               |
| Characters        | Home: start, characters, connection, recent   |
|                   | Chat: readable messages and existing actions  |
| World info        |                                               |
| Personas          |       Existing settings panel opens here      |
|                   |                                               |
| Generation        |                                               |
| Connections       +-----------------------------------------------+
| Prompt formatting | Message composer                              |
| Extensions        | Connection guidance or send shortcut          |
| Backgrounds       +-----------------------------------------------+
| Settings          |
| Your characters   |
| Model / persona   |
+-------------------+

Phone
+-----------------------------------+
| Menu   Conversation   History New |
+-----------------------------------+
| Home or conversation              |
|                                   |
| Settings open in a full-width     |
| panel with a title and close      |
| control.                          |
+-----------------------------------+
| Message composer                  |
+-----------------------------------+
```

Content is left aligned. The home page starts with an invitation to choose a character.
It uses actual character data and existing recent chats, rather than invented examples or activity counts.
The sidebar groups conversations, creative tools, and configuration.
An initial review removed a dashboard-style metrics header because those metrics would not help users start chatting.

## Implemented behavior

- Persistent named navigation replaces the icon-only bar in workspace mode.
- Desktop settings open in titled panels. The close button and Escape return users to the conversation.
- The character library keeps search, sorting, tags, import, editing, and group controls.
- Create, Import, and New group have visible text labels.
- Sidebar shortcuts and home cards select actual characters through `selectCharacterById()`.
- The home page keeps existing recent chat, pin, rename, delete, and temporary chat handlers.
- Connection guidance reflects the existing `online_status` value. It does not perform a separate connection check.
- The header exposes chat history and new chat actions through their existing handlers.
- Ctrl/Cmd+K opens a searchable list of tools and characters. Arrow keys and Enter select results.
- Phone navigation uses an overlay, keyboard focus containment, Escape, and an inert conversation while open.
- Focus outlines, reduced motion, safe-area spacing, and browser zoom remain available.
- Settings saves the layout preference in account storage. A restore button is visible in classic mode.
- Existing custom themes and movable panel settings are available through classic mode.

The default home assistant help text is hidden until the user sends a message.
A character assigned as the home assistant remains visible.
Selected background images remain subtle in the workspace so conversation text stays readable.

## Ownership and compatibility

`public/scripts/workspace.js` owns shell navigation, search, presentation state, and the layout preference.
`public/css/workspace.css` owns workspace tokens and scoped layout rules.
`public/index.html` owns the shell's static landmarks and search dialog.
`public/scripts/templates/welcomePanel.html` owns the home layout.
`public/script.js` initializes the shell after existing controls and account settings are ready.

The shell does not create another character store, chat API, provider configuration, or generation pipeline.
It delegates to existing functions and event handlers. It preserves existing control IDs and extension insertion points.
New labels use the existing translation mechanism. Languages without translations fall back to English.

Third-party extensions can inject their own styles and markup. Arbitrary third-party extension compatibility is not guaranteed.
Use the classic layout when an extension expects movable drawers or replaces the page's layout.
Future changes should update the shell's destination table instead of adding separate navigation logic.

## Verification

Start the app with `npm ci` and `npm start -- --autorun false`.
Install test dependencies with `npm ci --prefix tests`.
Install Chromium with `npx --prefix tests playwright install chromium`.

Run:

```sh
npm run lint
npm --prefix tests run test:unit
cd tests
npx playwright test workspace.e2e.js --workers=1
```

The workspace tests use the running local server. They isolate settings writes with route fixtures.
They cover drawer navigation, character selection, history, search, phone layout, and classic layout restoration.
An intercepted model response verifies connection state, message submission, and reply rendering through the existing generation pipeline.
They use the app's bundled character. They do not require or verify a live paid model response.

Verified on October 7, 2026: repository lint passed, all 411 unit tests passed, and all seven workspace browser tests passed.
The shared browser also confirmed the desktop conversation, phone character library, search dialog, and classic layout switch.
