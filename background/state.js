/**
 * State Manager
 * Handles in-memory state tracking for windows and restoration locks.
 */

const StateManager = {
    // Maps WindowID (number) -> WorkspaceID (string)
    windowToWorkspaceMap: {},

    // Set of WindowIDs currently being restored (to block auto-save)
    restoringWindows: new Set(),

    /**
     * Links a window to a workspace in memory.
     */
    linkWindow(windowId, workspaceId) {
        this.windowToWorkspaceMap[windowId] = workspaceId;
    },

    /**
     * Unlinks a window (e.g., on close).
     */
    unlinkWindow(windowId) {
        delete this.windowToWorkspaceMap[windowId];
    },

    /**
     * Gets the workspace ID for a given window.
     */
    getWorkspaceId(windowId) {
        return this.windowToWorkspaceMap[windowId];
    },

    /**
     * Locks a window to prevent auto-saving during restoration.
     */
    lockWindow(windowId) {
        this.restoringWindows.add(windowId);
        Logger.debug(`State: Locked window ${windowId}`);
    },

    /**
     * Unlocks a window.
     */
    unlockWindow(windowId) {
        this.restoringWindows.delete(windowId);
        Logger.debug(`State: Unlocked window ${windowId}`);
    },

    /**
     * Checks if a window is locked.
     */
    isLocked(windowId) {
        return this.restoringWindows.has(windowId);
    },

    /**
     * Resets the map (useful for hydration).
     */
    resetMap() {
        this.windowToWorkspaceMap = {};
    }
};
