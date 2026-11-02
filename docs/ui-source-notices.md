# UI source attribution

The composer surface structure and corresponding layout rules are adapted from
[T3 Code](https://github.com/pingdotgg/t3code), source commit
`6f41364805e31a1f8d59c18c7cc451630cd9265d`:

- `apps/web/src/components/chat/ComposerSurface.tsx`
- `apps/web/src/components/chat/ComposerControlsBar.tsx`
- `apps/web/src/components/chat/ComposerPrimaryActions.tsx`

The adaptation uses one shell, an editor surface, a footer containing the model
and primary actions, and a separate context strip. It is implemented in plain
DOM/CSS around the existing SillyTavern form and action nodes. No agent tools,
worktrees, permissions UI, React runtime or Tiptap editor were imported.

Copyright (c) 2026 T3 Tools Inc. Used under the MIT license. The complete notice
is distributed in [public/licenses/T3-Code.txt](../public/licenses/T3-Code.txt).
SillyTavern's own license continues to apply to this fork.
