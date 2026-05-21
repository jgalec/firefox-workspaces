# AGENTS.md

## Project Overview
- Firefox WebExtension to manage isolated workspaces across windows, with persistent tab state and fast restoration.
- Core runtime logic lives in `background/`; user interaction lives in `popup/` and `options/`.
- Main objective: keep project contexts separated while restoring sessions reliably and efficiently.

## Communication
- Always respond to the user in Spanish.
- Keep tone direct, technical, and professional.

## Code Standards
- Write variables, functions, comments, and internal documentation in English.

## Documentation-First Workflow
- Before proposing or implementing any major feature, refactor, or design change, read and follow the docs in `docs/`.
- Use `docs/technical-overview.md` for architecture, event handling, and state hydration details.
- Use `docs/design-guidelines.md` for visual standards, spacing, and accessibility rules.
- Use `docs/features.md` for current capabilities and functional scope.

## Setup / Run
- Load the extension in Firefox via `about:debugging` -> `This Firefox` -> `Load Temporary Add-on`.
- Select `manifest.json` from the repository root.
- Re-load the extension after code changes when needed.

## Validation
- Verify popup flows: create, rename, reorder, and switch workspaces.
- Verify restore behavior with pinned tabs, tab groups, and container identities when applicable.
- Verify lazy restoration behavior (discarded tabs) and lock-protected restore flow.
- Verify toolbar indicator color updates per active workspace/window mapping.

## Repository Map
- `manifest.json`: extension metadata, permissions, and entry points.
- `background/background.js`: background bootstrap and runtime wiring.
- `background/manager.js`: workspace lifecycle, window creation, and restoration orchestration.
- `background/storage.js`: single storage gateway for `browser.storage.local`.
- `background/state.js`: in-memory `windowId` <-> `workspaceId` mapping and invariants.
- `background/events.js`: internal pub/sub event bus used for decoupled coordination.
- `background/indicator.js`: toolbar indicator color updates by active workspace/window.
- `background/menus.js`: context menu integration.
- `background/logger.js`: logging utilities.
- `popup/popup.html`: popup entry markup.
- `popup/popup.js`: popup bootstrap/controller.
- `popup/logic.js`: workspace actions and interaction flow.
- `popup/ui.js`: DOM rendering and UI state updates.
- `popup/io.js`: bridge layer between popup and background APIs.
- `popup/popup.css`: popup styles based on Mozilla Protocol guidelines.
- `options/restore.html`: restore/import view entry page.
- `options/import.js`: import and destructive restore flow handling.
- `options/import.css`: styles for options/restore view.
- `docs/technical-overview.md`: architecture, events, and hydration details.
- `docs/design-guidelines.md`: visual system, spacing, and accessibility rules.
- `docs/features.md`: current feature scope and behavior.

## Change Safety Rules
- Keep `StorageService` (`storage.js`) as the single storage gateway.
- Preserve `StateManager` invariants for `windowId` <-> `workspaceId` mapping.
- Do not bypass restore lock mechanisms in `WorkspaceManager`.
- Maintain event-driven decoupling via `EventBus`; avoid tight UI-runtime coupling.
- Preserve compatibility with declared Firefox permissions in `manifest.json`.

## Do / Don't
- Do route all persistence through `StorageService`; don't access `browser.storage.local` directly from other modules.
- Do update window/workspace links through `StateManager`; don't mutate mapping state ad-hoc.
- Do use `EventBus` for cross-module coordination; don't couple popup code directly to background internals.
- Do keep restore lock semantics intact in `WorkspaceManager`; don't introduce restore-time auto-save races.

## Commit / PR Conventions
- Commits should be concise, imperative, and explain intent (why).
- PR descriptions should include scope, risk, and manual validation steps.

## WebExtension Structure (MDN)
1. `manifest.json`: metadata, permissions (`storage`, `tabs`, `tabHide`, `tabGroups`, `menus`), and Gecko ID (`my-extension@username`).
2. Background scripts: event-driven architecture via `WorkspaceManager`.
3. UI elements: popup-based main interface plus dedicated Options/Restore views.

## Technical Architecture
- `StorageService` (`storage.js`): single entry point for `browser.storage.local`.
- `StateManager` (`state.js`): live mapping of `windowId` to `workspaceId`.
- `WorkspaceManager` (`manager.js`): orchestrates window creation and tab restoration.
- `IndicatorManager` (`indicator.js`): updates browser toolbar icon color dynamically.
- `EventBus` (`events.js`): lightweight system to decouple logic from UI side-effects.
- Lazy loading restores tabs in discarded state to save memory.
- Lock mechanism prevents auto-save collisions during restoration.

## Design System
- Framework: Mozilla Protocol (colors, spacing, typography).
- Iconography: Heroicons only.
- Implementation: use CSS masks (`.icon-svg`) for `currentColor` support.
- Color palette:
  - Mozilla Black: `#161616` (primary dark background).
  - Mozilla White: `#fafafa` (primary light background).
  - Primary Blue: `#0060df`.
  - Success Green: `#00d230`.
  - Error Red: `#ff4f5e`.
