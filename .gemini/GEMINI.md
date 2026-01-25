## Project Rules
- **Communication:** Always respond to the user in Spanish.
- **Code:** Variables, functions, comments, and internal documentation must be in English.
- **Tone:** Direct, technical, and professional.

## Development Workflow & Documentation
**CRITICAL:** Before proposing or implementing any major feature, refactoring, or design change, you MUST read and follow the specialized documentation in the `docs/` folder:

- **`docs/technical-overview.md`:** Detailed architecture, event-handling logic, and the state-hydration process. Refer to this for core logic changes.
- **`docs/design-guidelines.md`:** Visual standards, spacing, and accessibility rules. Refer to this for any UI modifications.
- **`docs/features.md`:** Current capabilities and functional scope.

## WebExtension Anatomy (MDN Standards)
1. **manifest.json**: Metadata, permissions (`storage`, `tabs`, `tabHide`, `tabGroups`, `menus`), and Gecko ID (`my-extension@username`).
2. **Background Scripts**: Event-driven architecture via `WorkspaceManager`.
3. **UI Elements**: Popup-based main interface and dedicated Option/Restore views.

## Technical Architecture & Patterns (Summary)
*For full details, see `docs/technical-overview.md`.*

- **StorageService (`storage.js`):** Single entry point for `browser.storage.local`.
- **StateManager (`state.js`):** Live mapping of `windowId` to `workspaceId`.
- **WorkspaceManager (`manager.js`):** Orchestrates window creation and tab restoration.
- **IndicatorManager (`indicator.js`):** Dynamically updates the browser toolbar icon color.
- **EventBus (`events.js`):** Lightweight system to decouple logic from UI side-effects.
- **Lazy Loading:** Mechanism to restore tabs in a "discarded" state to save memory.
- **Lock Mechanism:** Prevents auto-save collisions during restoration.

## Design System Summary
*For full details, see `docs/design-guidelines.md`.*

- **Framework:** Mozilla Protocol (Colors, Spacing, Typography).
- **Iconography:** **Heroicons** only.
- **Implementation:** Use **CSS Masks** (`.icon-svg`) for dynamic `currentColor` support.
- **Palette:**
    - **Mozilla Black:** `#161616` (Primary Background Dark)
    - **Mozilla White:** `#fafafa` (Primary Background Light)
    - **Primary Blue:** `#0060df`
    - **Success Green:** `#00d230`
    - **Error Red:** `#ff4f5e`