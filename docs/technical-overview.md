# Technical Overview & Architecture

This document provides a deep dive into the technical decisions, architecture, and evolutionary steps taken during the development of **Firefox Workspaces**.

## 1. WebExtension Anatomy (MDN Standards)
Reference: [MDN - Anatomy of a WebExtension](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Anatomy_of_a_WebExtension)

1. **manifest.json**: The single required file. Holds metadata, permissions, and paths.
2. **Background Scripts**: The extension's central "brain". Handles events (browser startup, tab changes). In Firefox MV3, these are non-persistent scripts (Event Pages).
3. **Content Scripts**: JavaScript/CSS injected into web pages. Not extensively used in this project as we focus on browser-level management.
4. **UI Elements**:
   - **Browser Action (Popup)**: The main interface triggered from the toolbar.
   - **Options/Restore Page**: Dedicated full-page interfaces for data management.
5. **Web Accessible Resources**: Icons and assets bundled with the extension.

## 2. Technical Architecture

### 2.1 State Management (Background Process)
The extension uses a persistent background script (non-persistent in Manifest V3 but treated as an Event Page) that acts as the "Source of Truth":
- **Storage Service (`storage.js`):** A wrapper around `browser.storage.local`. It abstracts the complexity of fetching and saving the workspace array, ensuring atomic updates.
- **State Manager (`state.js`):** Maintains a live mapping between browser `windowId` and extension `workspaceId`. This is critical because `windowId` is volatile and changes every time a window is closed and reopened.
- **Workspace Manager (`manager.js`):** The orchestrator. It handles the "Hydration" process (linking existing windows to storage objects on startup) and the "Capture" logic for converting unmanaged windows into workspaces.

### 1.2 Event-Driven Persistence
Instead of manual saving, the extension employs a reactive model:
- **Listeners:** The manager listens to `tabs.onUpdated`, `tabs.onMoved`, `tabs.onCreated`, and `tabs.onRemoved`.
- **Throttling/Locking:** During workspace restoration (opening a window), a "Lock" is applied to prevent the save-listeners from overwriting the clean workspace state with the intermediate tab states while the window is still loading.

## 2. Step-by-Step Implementation Log

### Phase 1: Foundation & Storage (Day 1)
- Defined the JSON schema for a workspace (ID, Name, Color, Tabs[], Groups[]).
- Implemented `StorageService` to handle CRUD operations.
- Created the basic `manifest.json` with necessary permissions (`storage`, `tabs`, `tabHide`, `menus`).

### Phase 2: Session Restoration Logic
- Developed the `openWorkspace` function which creates a new Firefox window and sequentially restores tabs, pins, and groups.
- **Challenge:** Tabs in Firefox often load as `about:blank` initially. We implemented a filtering system to ensure only valid web/file URLs are stored and restored.

### Phase 3: Modular Popup UI
- Split the popup logic into three distinct layers:
    - **`ui.js`:** Responsible for DOM injection and template cloning.
    - **`logic.js`:** Handles communication with the background script and internal state (like the color picker).
    - **`io.js`:** Specifically manages Export and Import operations.
- Implemented **Theme Awareness** using CSS variables synchronized with `prefers-color-scheme`.

### Phase 4: Visual Language & Brand Alignment
- **Mozilla Protocol:** Conducted a design audit to replace generic colors with official Mozilla Hex codes (Mozilla Black, Mozilla Green, Red 50) according to the [Mozilla Protocol Color Fundamentals](https://protocol.mozilla.org/docs/fundamentals/color).
- **Icon System:** Implemented a professional **CSS Mask SVG** system using icons sourced from [Heroicons](https://heroicons.com/). This architecture allows using a single SVG file per icon while enabling dynamic, theme-aware coloring directly through the `background-color` CSS property.

### Phase 5: Reordering & UX Refinement
- Implemented a "Reorder Mode".
- **Logic:** We disabled clicking (workspace switching) while in reorder mode to prevent accidental navigation.
- **Feedback:** Added a "Check" icon that replaces the "Move" icon when reordering is active, providing a clear "Done/Save" signal.

### Phase 6: Destructive Restoration (The "Source of Truth")
- **Decision:** Chose "Option 3" (Full Replace) over complex merging.
- **Security:** Integrated custom modals to warn users that their current data will be purged.
- **Workflow:** Upon successful restoration, the background script is forced to "Re-hydrate" (refreshing all window mappings) to ensure the UI and storage stay in sync.

## 3. Future Considerations
- **Syncing:** Possible integration with Firefox Sync for cross-device workspaces.
- **Performance:** Throttling `saveWindowState` for users with hundreds of tabs.
- **Tab Hiding API:** Exploring the `tabHide` permission to allow switching workspaces within the same window (Alternative mode).