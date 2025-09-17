# Editor Refactor Inventory

This note captures the current surface area of `src/components/editor/components/Editor.tsx` so we can split the file incrementally without losing track of behaviour.

## Responsibilities Observed

- **Editor lifecycle & collaboration wiring** – bootstraps TipTap with Yjs, handles provider events, connection status, presence awareness, and error recovery.
- **View layout orchestration** – decides between borderless vs. single-page layouts, renders header chrome, manages ruler visibility, and ties in rehearsal view overlays.
- **State buckets for rehearsal features** – rehearsal mode toggling, auto-follow microphone integration, rehearse line position/word box, awareness syncing, and related timers.
- **Context/menu handling** – owns global context menu state, submenu positioning, click routing for scene/cue/comment context, and toolbar visibility logic.
- **Sidebar data & UI state** – computes scenes/cues/comments from DOM, maintains filters, expansions, inline editing, and active selections for the right sidebar.
- **Overlay composition** – positions floating cues/comments layers, cue connectors, rehearsal highlights, context-specific popovers, and other HUD elements.
- **Utility glue code** – shared scroll/highlight helpers, logging, throttled updates, and a large number of inline callbacks passed to child components.

## Existing Modules Nearby

- `src/components/editor/hooks/` already exposes:
  - `useEditorCore` for TipTap + collaboration initialisation.
  - `useContentMigration`, `testMigration`, and `useResponsiveDesign` for ancillary concerns.
- `src/components/editor/components/` contains prebuilt UI pieces:
  - Overlays: `FloatingCuesLayer`, `FloatingCommentsLayer`, `CueConnectors`, `RulerOverlay`.
  - Tooling: toolbar folder, audio transcription (unused in editor), page canvas utilities.
  - Layout primitives inside `components/page` and `components/ui`.
- Styles and theme tokens live under `src/components/editor/styles/`, already namespaced by feature (sidebar, cues, rehearsal, etc.).

## Initial Seam Candidates

- **Sidebar computation** – the effect that scrapes DOM for scenes/cues/comments plus related state setters can become a `useSidebarData` hook returning structured collections and setters for active items.
- **Rehearsal features** – rehearsal mode toggles, auto-follow service coordination, and awareness sync logic form a coherent `useRehearsalMode` hook.
- **Collaboration presence** – awareness listeners, connection status, and live user counts can move into `useCollaborationPresence` (potentially layered atop `useEditorCore`).
- **Layout shell** – header, view mode switch, and container sizing can be isolated into an `EditorShell` component composing `EditorContent` and the right sidebar.
- **Right sidebar** – extract into `RightSidebar` with dedicated tab components so the main editor only coordinates which tab is active.

These seams align with the new refactor checklist and keep the incremental changes bounded.

